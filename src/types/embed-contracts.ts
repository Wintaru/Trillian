export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedState {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  fields: EmbedField[];
  imageUrl?: string;
  thumbnailUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  authorName?: string;
  authorIconUrl?: string;
  authorUrl?: string;
}

export interface EmbedSession {
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  state: EmbedState;
  editingMessageId?: string;
  editingChannelId?: string;
  createdAt: number;
}

export interface CreateEmbedSessionRequest {
  userId: string;
  guildId: string;
  channelId: string;
  initialState?: EmbedState;
  editingMessageId?: string;
  editingChannelId?: string;
}

export interface CreateEmbedSessionResponse {
  sessionId: string;
  state: EmbedState;
}

export type EmbedFieldName =
  | "title"
  | "description"
  | "color"
  | "image"
  | "thumbnail"
  | "footer"
  | "author"
  | "url";

export interface UpdateEmbedFieldRequest {
  sessionId: string;
  userId: string;
  field: EmbedFieldName;
  values: Record<string, string>;
}

export interface AddEmbedFieldRequest {
  sessionId: string;
  userId: string;
  name: string;
  value: string;
  inline: boolean;
}

export interface RemoveEmbedFieldRequest {
  sessionId: string;
  userId: string;
  index: number;
}

export interface SendEmbedRequest {
  sessionId: string;
  userId: string;
  targetChannelId: string;
}

export type SendEmbedReason =
  | "sent"
  | "edited"
  | "session_not_found"
  | "session_expired"
  | "empty_embed";

export interface SendEmbedResponse {
  success: boolean;
  reason: SendEmbedReason;
}

export interface SaveTemplateRequest {
  guildId: string;
  userId: string;
  name: string;
  state: EmbedState;
}

export type SaveTemplateReason =
  | "saved"
  | "updated"
  | "name_too_long"
  | "too_many_templates";

export interface SaveTemplateResponse {
  success: boolean;
  reason: SaveTemplateReason;
}

export interface LoadTemplateRequest {
  guildId: string;
  userId: string;
  name: string;
}

export interface LoadTemplateResponse {
  success: boolean;
  reason: "loaded" | "not_found";
  state?: EmbedState;
}

export interface ListTemplatesRequest {
  guildId: string;
  userId: string;
}

export interface ListTemplatesResponse {
  templates: { name: string; createdAt: number; updatedAt: number }[];
}

export interface DeleteTemplateRequest {
  guildId: string;
  userId: string;
  name: string;
}

export interface DeleteTemplateResponse {
  success: boolean;
  reason: "deleted" | "not_found";
}
