import { EmbedBuilder } from "discord.js";
import type { PollResults } from "../types/poll-contracts.js";

function buildBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

export function buildPollEmbed(results: PollResults): EmbedBuilder {
  const optionLines = results.options.map((opt, i) => {
    const count = results.voteCounts[i] ?? 0;
    const pct = results.totalVotes > 0 ? Math.round((count / results.totalVotes) * 100) : 0;
    const bar = buildBar(pct);
    return `**${i + 1}.** ${opt}\n${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)`;
  });

  const statusText = results.status === "open" ? "Open" : "Closed";
  const timeText =
    results.closesAt && results.status === "open"
      ? ` | Closes <t:${Math.floor(results.closesAt / 1000)}:R>`
      : "";

  return new EmbedBuilder()
    .setTitle(results.question)
    .setDescription(optionLines.join("\n\n"))
    .setFooter({
      text: `Poll #${results.pollId} | ${statusText} | ${results.totalVotes} total vote${results.totalVotes !== 1 ? "s" : ""}${timeText}`,
    })
    .setColor(results.status === "open" ? 0x57f287 : 0xed4245);
}
