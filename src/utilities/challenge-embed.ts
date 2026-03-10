import { EmbedBuilder } from "discord.js";
import type {
  GradeSubmissionResponse,
  ChallengeResultsResponse,
  ChallengeLeaderboardResponse,
} from "../types/challenge-contracts.js";
import { languageName } from "../engines/translate-engine.js";

const EMBED_COLOR = 0x5865f2;
const FIELD_MAX_LENGTH = 1024;

export function buildChallengeEmbed(
  sentence: string,
  language: string,
  direction: string,
  closesAt: number,
  context: string,
): EmbedBuilder {
  const lang = languageName(language);
  const dirLabel = direction === "to_english"
    ? `Translate to English`
    : `Translate to ${lang}`;

  const embed = new EmbedBuilder()
    .setTitle(`Translation Challenge — ${lang}`)
    .setDescription(`> ${sentence}`)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  embed.addFields({ name: "Direction", value: dirLabel, inline: true });
  embed.addFields({
    name: "Closes",
    value: `<t:${Math.floor(closesAt / 1000)}:R>`,
    inline: true,
  });

  if (context) {
    embed.addFields({ name: "Hint", value: truncate(context, FIELD_MAX_LENGTH) });
  }

  embed.setFooter({ text: "Click Submit Translation to enter your answer" });

  return embed;
}

export function buildGradeEmbed(
  grade: GradeSubmissionResponse,
  userTranslation: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Your Translation Graded")
    .setColor(EMBED_COLOR)
    .setTimestamp();

  embed.addFields({ name: "Your Translation", value: truncate(userTranslation, FIELD_MAX_LENGTH) });
  embed.addFields({ name: "Accuracy", value: `${grade.accuracyScore}/10`, inline: true });
  embed.addFields({ name: "Grammar", value: `${grade.grammarScore}/10`, inline: true });
  embed.addFields({ name: "Naturalness", value: `${grade.naturalnessScore}/10`, inline: true });
  embed.addFields({ name: "Composite Score", value: `**${grade.compositeScore}/10**` });

  if (grade.feedback) {
    embed.addFields({ name: "Feedback", value: truncate(grade.feedback, FIELD_MAX_LENGTH) });
  }

  return embed;
}

export function buildResultsEmbed(results: ChallengeResultsResponse): EmbedBuilder {
  const lang = languageName(results.language);

  const embed = new EmbedBuilder()
    .setTitle(`Challenge Results — ${lang}`)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  embed.addFields({ name: "Sentence", value: `> ${results.sentence}` });
  embed.addFields({ name: "Reference Translation", value: results.referenceTranslation });

  if (results.context) {
    embed.addFields({ name: "Context", value: truncate(results.context, FIELD_MAX_LENGTH) });
  }

  if (results.submissions.length === 0) {
    embed.addFields({ name: "Submissions", value: "No submissions received." });
  } else {
    const lines = results.submissions.slice(0, 10).map((sub) => {
      const medal = sub.rank === 1 ? "**#1**" : `#${sub.rank}`;
      return `${medal} <@${sub.userId}> — **${sub.compositeScore}/10** — "${truncate(sub.translation, 80)}"`;
    });
    embed.addFields({ name: "Top Submissions", value: truncate(lines.join("\n"), FIELD_MAX_LENGTH) });
  }

  embed.setFooter({ text: `${results.submissions.length} submission(s)` });

  return embed;
}

export function buildChallengeLeaderboardEmbed(
  response: ChallengeLeaderboardResponse,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Translation Challenge Leaderboard")
    .setColor(EMBED_COLOR)
    .setTimestamp();

  if (response.entries.length === 0) {
    embed.setDescription("No challenge data yet. Participate in a daily challenge to get started!");
    return embed;
  }

  const lines = response.entries.map((entry) => {
    const medal = entry.position <= 3
      ? ["", "**#1**", "**#2**", "**#3**"][entry.position]
      : `#${entry.position}`;
    return `${medal} <@${entry.userId}> — Avg: **${entry.averageScore}/10** | Challenges: ${entry.totalChallenges}`;
  });

  embed.setDescription(truncate(lines.join("\n"), 4096));

  return embed;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
