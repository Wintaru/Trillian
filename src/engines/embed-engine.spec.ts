import { describe, it, expect, beforeEach } from "vitest";
import { EmbedEngine } from "./embed-engine.js";

describe("EmbedEngine", () => {
  let engine: EmbedEngine;

  beforeEach(() => {
    engine = new EmbedEngine();
  });

  describe("createSession", () => {
    it("should create a session with empty state", () => {
      const result = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      expect(result.sessionId).toContain("user1");
      expect(result.state).toEqual({ fields: [] });
    });

    it("should create a session with initial state", () => {
      const initialState = {
        title: "Hello",
        description: "World",
        fields: [],
      };

      const result = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState,
      });

      expect(result.state.title).toBe("Hello");
      expect(result.state.description).toBe("World");
    });

    it("should create a session with editing info", () => {
      const result = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        editingMessageId: "msg123",
        editingChannelId: "ch456",
      });

      const session = engine.getSession(result.sessionId, "user1");
      expect(session?.editingMessageId).toBe("msg123");
      expect(session?.editingChannelId).toBe("ch456");
    });
  });

  describe("getSession", () => {
    it("should return null for non-existent session", () => {
      expect(engine.getSession("nope", "user1")).toBeNull();
    });

    it("should return null for wrong user", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      expect(engine.getSession(sessionId, "user2")).toBeNull();
    });

    it("should return the session for the correct user", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const session = engine.getSession(sessionId, "user1");
      expect(session).not.toBeNull();
      expect(session?.userId).toBe("user1");
    });
  });

  describe("updateField", () => {
    it("should update the title", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "title",
        values: { title: "My Title" },
      });

      expect(state?.title).toBe("My Title");
    });

    it("should clear a field when empty string is provided", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: { title: "Old", fields: [] },
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "title",
        values: { title: "" },
      });

      expect(state?.title).toBeUndefined();
    });

    it("should parse hex color", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "color",
        values: { color: "#FF5733" },
      });

      expect(state?.color).toBe(0xff5733);
    });

    it("should handle color without hash", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "color",
        values: { color: "00FF00" },
      });

      expect(state?.color).toBe(0x00ff00);
    });

    it("should update image fields", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "image",
        values: {
          imageUrl: "https://example.com/img.png",
          thumbnailUrl: "https://example.com/thumb.png",
        },
      });

      expect(state?.imageUrl).toBe("https://example.com/img.png");
      expect(state?.thumbnailUrl).toBe("https://example.com/thumb.png");
    });

    it("should update footer fields", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "footer",
        values: { footerText: "Footer!", footerIconUrl: "https://example.com/icon.png" },
      });

      expect(state?.footerText).toBe("Footer!");
      expect(state?.footerIconUrl).toBe("https://example.com/icon.png");
    });

    it("should update author fields", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.updateField({
        sessionId,
        userId: "user1",
        field: "author",
        values: { authorName: "Author", authorUrl: "https://example.com" },
      });

      expect(state?.authorName).toBe("Author");
      expect(state?.authorUrl).toBe("https://example.com");
    });

    it("should return null for expired/missing session", () => {
      const state = engine.updateField({
        sessionId: "nonexistent",
        userId: "user1",
        field: "title",
        values: { title: "Test" },
      });

      expect(state).toBeNull();
    });
  });

  describe("addField", () => {
    it("should add a field", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const state = engine.addField({
        sessionId,
        userId: "user1",
        name: "Field 1",
        value: "Value 1",
        inline: true,
      });

      expect(state?.fields).toHaveLength(1);
      expect(state?.fields[0]).toEqual({ name: "Field 1", value: "Value 1", inline: true });
    });

    it("should not exceed 25 fields", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: {
          fields: Array.from({ length: 25 }, (_, i) => ({
            name: `Field ${i}`,
            value: `Value ${i}`,
            inline: false,
          })),
        },
      });

      const state = engine.addField({
        sessionId,
        userId: "user1",
        name: "Extra",
        value: "Extra",
        inline: false,
      });

      expect(state?.fields).toHaveLength(25);
    });
  });

  describe("removeField", () => {
    it("should remove a field by index", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: {
          fields: [
            { name: "A", value: "1", inline: false },
            { name: "B", value: "2", inline: false },
          ],
        },
      });

      const state = engine.removeField({ sessionId, userId: "user1", index: 0 });

      expect(state?.fields).toHaveLength(1);
      expect(state?.fields[0].name).toBe("B");
    });

    it("should ignore out-of-bounds index", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: {
          fields: [{ name: "A", value: "1", inline: false }],
        },
      });

      const state = engine.removeField({ sessionId, userId: "user1", index: 5 });

      expect(state?.fields).toHaveLength(1);
    });
  });

  describe("validateSend", () => {
    it("should reject empty embed", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      const result = engine.validateSend({
        sessionId,
        userId: "user1",
        targetChannelId: "ch1",
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("empty_embed");
    });

    it("should accept non-empty embed", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: { title: "Hello", fields: [] },
      });

      const result = engine.validateSend({
        sessionId,
        userId: "user1",
        targetChannelId: "ch1",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("sent");
    });

    it("should return 'edited' reason for editing sessions", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
        initialState: { title: "Hello", fields: [] },
        editingMessageId: "msg123",
        editingChannelId: "ch456",
      });

      const result = engine.validateSend({
        sessionId,
        userId: "user1",
        targetChannelId: "ch1",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("edited");
    });

    it("should reject missing session", () => {
      const result = engine.validateSend({
        sessionId: "nope",
        userId: "user1",
        targetChannelId: "ch1",
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("session_not_found");
    });
  });

  describe("destroySession", () => {
    it("should remove the session", () => {
      const { sessionId } = engine.createSession({
        userId: "user1",
        guildId: "guild1",
        channelId: "channel1",
      });

      engine.destroySession(sessionId);
      expect(engine.getSession(sessionId, "user1")).toBeNull();
    });
  });
});
