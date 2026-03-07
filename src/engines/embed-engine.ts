import type {
  CreateEmbedSessionRequest,
  CreateEmbedSessionResponse,
  UpdateEmbedFieldRequest,
  AddEmbedFieldRequest,
  RemoveEmbedFieldRequest,
  EmbedSession,
  EmbedState,
  SendEmbedResponse,
  SendEmbedRequest,
  SaveTemplateRequest,
  SaveTemplateResponse,
  LoadTemplateRequest,
  LoadTemplateResponse,
  ListTemplatesRequest,
  ListTemplatesResponse,
  DeleteTemplateRequest,
  DeleteTemplateResponse,
} from "../types/embed-contracts.js";
import type { EmbedTemplateAccessor } from "../accessors/embed-template-accessor.js";
import { isEmbedEmpty } from "../utilities/embed-preview.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_FIELDS = 25;
const MAX_TEMPLATES_PER_USER = 25;
const MAX_TEMPLATE_NAME_LENGTH = 50;

function emptyState(): EmbedState {
  return { fields: [] };
}

export class EmbedEngine {
  private sessions = new Map<string, EmbedSession>();
  private lastCleanup = Date.now();

  constructor(private templateAccessor?: EmbedTemplateAccessor) {}

  createSession(request: CreateEmbedSessionRequest): CreateEmbedSessionResponse {
    this.cleanupIfNeeded();

    const sessionId = `${request.userId}-${Date.now()}`;
    const state = request.initialState ?? emptyState();

    const session: EmbedSession = {
      sessionId,
      userId: request.userId,
      guildId: request.guildId,
      channelId: request.channelId,
      state,
      editingMessageId: request.editingMessageId,
      editingChannelId: request.editingChannelId,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return { sessionId, state };
  }

  getSession(sessionId: string, userId: string): EmbedSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  updateField(request: UpdateEmbedFieldRequest): EmbedState | null {
    const session = this.getSession(request.sessionId, request.userId);
    if (!session) return null;

    const state = session.state;

    switch (request.field) {
      case "title":
        state.title = request.values.title || undefined;
        break;
      case "description":
        state.description = request.values.description || undefined;
        break;
      case "color": {
        const hex = request.values.color?.replace("#", "");
        if (hex) {
          const parsed = parseInt(hex, 16);
          state.color = isNaN(parsed) ? undefined : parsed;
        } else {
          state.color = undefined;
        }
        break;
      }
      case "image":
        state.imageUrl = request.values.imageUrl || undefined;
        state.thumbnailUrl = request.values.thumbnailUrl || undefined;
        break;
      case "footer":
        state.footerText = request.values.footerText || undefined;
        state.footerIconUrl = request.values.footerIconUrl || undefined;
        break;
      case "author":
        state.authorName = request.values.authorName || undefined;
        state.authorIconUrl = request.values.authorIconUrl || undefined;
        state.authorUrl = request.values.authorUrl || undefined;
        break;
      case "url":
        state.url = request.values.url || undefined;
        break;
    }

    return state;
  }

  addField(request: AddEmbedFieldRequest): EmbedState | null {
    const session = this.getSession(request.sessionId, request.userId);
    if (!session) return null;
    if (session.state.fields.length >= MAX_FIELDS) return session.state;

    session.state.fields.push({
      name: request.name,
      value: request.value,
      inline: request.inline,
    });

    return session.state;
  }

  removeField(request: RemoveEmbedFieldRequest): EmbedState | null {
    const session = this.getSession(request.sessionId, request.userId);
    if (!session) return null;
    if (request.index >= 0 && request.index < session.state.fields.length) {
      session.state.fields.splice(request.index, 1);
    }
    return session.state;
  }

  validateSend(request: SendEmbedRequest): SendEmbedResponse {
    const session = this.getSession(request.sessionId, request.userId);
    if (!session) {
      return { success: false, reason: "session_not_found" };
    }
    if (isEmbedEmpty(session.state)) {
      return { success: false, reason: "empty_embed" };
    }

    const reason = session.editingMessageId ? "edited" : "sent";
    return { success: true, reason };
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async saveTemplate(request: SaveTemplateRequest): Promise<SaveTemplateResponse> {
    if (!this.templateAccessor) {
      return { success: false, reason: "saved" };
    }
    if (request.name.length > MAX_TEMPLATE_NAME_LENGTH) {
      return { success: false, reason: "name_too_long" };
    }

    const count = await this.templateAccessor.countTemplates(request.guildId, request.userId);
    const existing = await this.templateAccessor.loadTemplate(
      request.guildId,
      request.userId,
      request.name,
    );

    if (!existing && count >= MAX_TEMPLATES_PER_USER) {
      return { success: false, reason: "too_many_templates" };
    }

    const embedData = JSON.stringify(request.state);
    const { isUpdate } = await this.templateAccessor.saveTemplate(
      request.guildId,
      request.userId,
      request.name,
      embedData,
      Date.now(),
    );

    return { success: true, reason: isUpdate ? "updated" : "saved" };
  }

  async loadTemplate(request: LoadTemplateRequest): Promise<LoadTemplateResponse> {
    if (!this.templateAccessor) {
      return { success: false, reason: "not_found" };
    }

    const row = await this.templateAccessor.loadTemplate(
      request.guildId,
      request.userId,
      request.name,
    );

    if (!row) {
      return { success: false, reason: "not_found" };
    }

    const state = JSON.parse(row.embedData) as EmbedState;
    return { success: true, reason: "loaded", state };
  }

  async listTemplates(request: ListTemplatesRequest): Promise<ListTemplatesResponse> {
    if (!this.templateAccessor) {
      return { templates: [] };
    }

    const templates = await this.templateAccessor.listTemplates(request.guildId, request.userId);
    return { templates };
  }

  async deleteTemplate(request: DeleteTemplateRequest): Promise<DeleteTemplateResponse> {
    if (!this.templateAccessor) {
      return { success: false, reason: "not_found" };
    }

    const deleted = await this.templateAccessor.deleteTemplate(
      request.guildId,
      request.userId,
      request.name,
    );

    return {
      success: deleted,
      reason: deleted ? "deleted" : "not_found",
    };
  }

  private cleanupIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCleanup < SESSION_TTL_MS) return;
    this.lastCleanup = now;

    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
