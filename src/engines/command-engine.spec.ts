import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandEngine } from "./command-engine.js";
import type { Command, CommandContext } from "../types/command.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

function createMockCommand(name: string): Command {
  return {
    name,
    description: `${name} command`,
    slashData: new SlashCommandBuilder().setName(name).setDescription(`${name} command`),
    executeSlash: vi.fn(),
    executePrefix: vi.fn(),
  };
}

function createMockInteraction(commandName: string): ChatInputCommandInteraction {
  return {
    commandName,
    replied: false,
    deferred: false,
    reply: vi.fn(),
    followUp: vi.fn(),
  } as unknown as ChatInputCommandInteraction;
}

function createMockMessage(content: string): Message {
  return {
    content,
    author: { bot: false },
    reply: vi.fn(),
  } as unknown as Message;
}

describe("CommandEngine", () => {
  let engine: CommandEngine;
  let pingCommand: Command;

  beforeEach(() => {
    pingCommand = createMockCommand("ping");
    engine = new CommandEngine([pingCommand]);
  });

  describe("handleSlashCommand", () => {
    it("should execute a known slash command", async () => {
      const interaction = createMockInteraction("ping");
      await engine.handleSlashCommand(interaction);
      expect(pingCommand.executeSlash).toHaveBeenCalledWith(interaction);
    });

    it("should reply with unknown command for unregistered commands", async () => {
      const interaction = createMockInteraction("unknown");
      await engine.handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Unknown command.",
        flags: 64,
      });
    });

    it("should handle errors in slash command execution", async () => {
      vi.mocked(pingCommand.executeSlash).mockRejectedValue(new Error("test error"));
      const interaction = createMockInteraction("ping");
      await engine.handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "An error occurred while executing this command.",
        flags: 64,
      });
    });
  });

  describe("handlePrefixCommand", () => {
    it("should execute a known prefix command", async () => {
      const message = createMockMessage("!ping");
      await engine.handlePrefixCommand(message, "!");
      expect(pingCommand.executePrefix).toHaveBeenCalledWith(message, { args: [] });
    });

    it("should pass arguments to the command", async () => {
      const message = createMockMessage("!ping arg1 arg2");
      await engine.handlePrefixCommand(message, "!");
      expect(pingCommand.executePrefix).toHaveBeenCalledWith(message, {
        args: ["arg1", "arg2"],
      });
    });

    it("should ignore messages without the prefix", async () => {
      const message = createMockMessage("ping");
      await engine.handlePrefixCommand(message, "!");
      expect(pingCommand.executePrefix).not.toHaveBeenCalled();
    });

    it("should ignore bot messages", async () => {
      const message = createMockMessage("!ping");
      (message.author as { bot: boolean }).bot = true;
      await engine.handlePrefixCommand(message, "!");
      expect(pingCommand.executePrefix).not.toHaveBeenCalled();
    });

    it("should ignore unknown commands silently", async () => {
      const message = createMockMessage("!unknown");
      await engine.handlePrefixCommand(message, "!");
      expect(message.reply).not.toHaveBeenCalled();
    });
  });

  describe("getSlashCommandData", () => {
    it("should return slash command JSON data", () => {
      const data = engine.getSlashCommandData();
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual(
        expect.objectContaining({ name: "ping", description: "ping command" }),
      );
    });
  });
});
