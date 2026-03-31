import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReminderEngine } from "./reminder-engine.js";
import type { ReminderAccessor } from "../accessors/reminder-accessor.js";

function createMockAccessor(): ReminderAccessor {
  return {
    create: vi.fn(),
    cancel: vi.fn(),
    getById: vi.fn(),
    listPendingForUser: vi.fn(),
    countPendingForUser: vi.fn(),
    getDueReminders: vi.fn(),
    markDelivered: vi.fn(),
  } as unknown as ReminderAccessor;
}

describe("ReminderEngine", () => {
  let accessor: ReminderAccessor;
  let engine: ReminderEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new ReminderEngine(accessor);
    vi.restoreAllMocks();
  });

  describe("createReminder", () => {
    it("should create a valid reminder", async () => {
      vi.mocked(accessor.countPendingForUser).mockResolvedValue(0);
      vi.mocked(accessor.create).mockResolvedValue(42);

      const deliverAt = Date.now() + 3_600_000; // 1 hour from now
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Test reminder",
        deliverAt,
        isPublic: false,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("created");
      expect(result.reminderId).toBe(42);
      expect(result.deliverAt).toBe(deliverAt);
    });

    it("should reject empty message", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "",
        deliverAt: Date.now() + 3_600_000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "empty_message" });
      expect(accessor.create).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only message", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "   ",
        deliverAt: Date.now() + 3_600_000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "empty_message" });
    });

    it("should reject message over 1000 characters", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "a".repeat(1001),
        deliverAt: Date.now() + 3_600_000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "message_too_long" });
    });

    it("should reject past dates", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() - 1000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "past_date" });
    });

    it("should reject times less than 1 minute away", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() + 30_000, // 30 seconds
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "too_soon" });
    });

    it("should reject times more than 1 year away", async () => {
      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() + 366 * 24 * 60 * 60 * 1000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "too_far" });
    });

    it("should reject when user has 25 pending reminders", async () => {
      vi.mocked(accessor.countPendingForUser).mockResolvedValue(25);

      const result = await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() + 3_600_000,
        isPublic: false,
      });

      expect(result).toEqual({ success: false, reason: "too_many" });
    });

    it("should pass isPublic to accessor", async () => {
      vi.mocked(accessor.countPendingForUser).mockResolvedValue(0);
      vi.mocked(accessor.create).mockResolvedValue(1);

      await engine.createReminder({
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-1",
        message: "Public reminder",
        deliverAt: Date.now() + 3_600_000,
        isPublic: true,
      });

      expect(accessor.create).toHaveBeenCalledWith(
        "guild-1",
        "channel-1",
        "user-1",
        "Public reminder",
        expect.any(Number),
        true,
        expect.any(Number),
      );
    });
  });

  describe("cancelReminder", () => {
    it("should cancel a pending reminder owned by the user", async () => {
      vi.mocked(accessor.getById).mockResolvedValue({
        id: 1,
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() + 3_600_000,
        isPublic: 0,
        channelId: "channel-1",
        status: "pending",
        createdAt: Date.now(),
      });

      const result = await engine.cancelReminder(1, "user-1");

      expect(result).toEqual({ success: true, reason: "cancelled" });
      expect(accessor.cancel).toHaveBeenCalledWith(1);
    });

    it("should reject when reminder not found", async () => {
      vi.mocked(accessor.getById).mockResolvedValue(null);

      const result = await engine.cancelReminder(999, "user-1");

      expect(result).toEqual({ success: false, reason: "not_found" });
    });

    it("should reject when user doesn't own the reminder", async () => {
      vi.mocked(accessor.getById).mockResolvedValue({
        id: 1,
        userId: "user-2",
        message: "Test",
        deliverAt: Date.now() + 3_600_000,
        isPublic: 0,
        channelId: "channel-1",
        status: "pending",
        createdAt: Date.now(),
      });

      const result = await engine.cancelReminder(1, "user-1");

      expect(result).toEqual({ success: false, reason: "not_owner" });
    });

    it("should reject when reminder already delivered", async () => {
      vi.mocked(accessor.getById).mockResolvedValue({
        id: 1,
        userId: "user-1",
        message: "Test",
        deliverAt: Date.now() - 1000,
        isPublic: 0,
        channelId: "channel-1",
        status: "delivered",
        createdAt: Date.now() - 3_600_000,
      });

      const result = await engine.cancelReminder(1, "user-1");

      expect(result).toEqual({ success: false, reason: "already_delivered" });
    });
  });

  describe("listReminders", () => {
    it("should return paginated results", async () => {
      vi.mocked(accessor.countPendingForUser).mockResolvedValue(3);
      vi.mocked(accessor.listPendingForUser).mockResolvedValue([
        { id: 1, message: "First", deliverAt: Date.now() + 1000, isPublic: 0, channelId: "ch-1", status: "pending", createdAt: Date.now() },
        { id: 2, message: "Second", deliverAt: Date.now() + 2000, isPublic: 1, channelId: "ch-1", status: "pending", createdAt: Date.now() },
      ]);

      const result = await engine.listReminders("user-1", 1, 10);

      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.reminders).toHaveLength(2);
      expect(accessor.listPendingForUser).toHaveBeenCalledWith("user-1", 10, 0);
    });

    it("should calculate offset for page 2", async () => {
      vi.mocked(accessor.countPendingForUser).mockResolvedValue(15);
      vi.mocked(accessor.listPendingForUser).mockResolvedValue([]);

      await engine.listReminders("user-1", 2, 10);

      expect(accessor.listPendingForUser).toHaveBeenCalledWith("user-1", 10, 10);
    });
  });

  describe("getDueReminders", () => {
    it("should delegate to accessor", async () => {
      const due = [
        { id: 1, guildId: "g-1", channelId: "ch-1", userId: "u-1", message: "Test", deliverAt: Date.now(), isPublic: 0 },
      ];
      vi.mocked(accessor.getDueReminders).mockResolvedValue(due);

      const result = await engine.getDueReminders();

      expect(result).toEqual(due);
    });
  });

  describe("markDelivered", () => {
    it("should delegate to accessor", async () => {
      await engine.markDelivered(42);

      expect(accessor.markDelivered).toHaveBeenCalledWith(42, expect.any(Number));
    });
  });
});
