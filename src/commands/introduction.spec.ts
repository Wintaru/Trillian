import { describe, it, expect, vi } from "vitest";
import { createIntroductionCommand } from "./introduction.js";

describe("introduction command", () => {
  const command = createIntroductionCommand("!");

  it("should have correct name and description", () => {
    expect(command.name).toBe("introduction");
    expect(command.description).toBe("Get a personal overview of all bot features");
  });

  it("should reply with an ephemeral embed on slash command", async () => {
    const interaction = {
      reply: vi.fn(),
    };

    await command.executeSlash(interaction as never);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const call = interaction.reply.mock.calls[0][0];
    expect(call.flags).toContain("Ephemeral");
    expect(call.embeds).toHaveLength(1);

    const embed = call.embeds[0];
    expect(embed.data.title).toBe("Hi, I'm Trillian!");
    expect(embed.data.footer?.text).toContain("!");
  });

  it("should reply with an embed on prefix command", async () => {
    const message = {
      reply: vi.fn(),
    };

    await command.executePrefix(message as never, { args: [] });

    expect(message.reply).toHaveBeenCalledTimes(1);
    const call = message.reply.mock.calls[0][0];
    expect(call.embeds).toHaveLength(1);
    expect(call.embeds[0].data.title).toBe("Hi, I'm Trillian!");
  });

  it("should include the configured prefix in the footer", () => {
    const customCommand = createIntroductionCommand("?");
    const interaction = { reply: vi.fn() };

    customCommand.executeSlash(interaction as never);

    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.data.footer?.text).toContain("?");
  });
});
