import { EmbedBuilder } from "discord.js";
import type {
  RoundPlaylistResponse,
  RoundResultsResponse,
  OdesliLinks,
  MusicClubSongEntry,
} from "../types/music-club-contracts.js";

const EMBED_COLOR = 0xe91e63;
const FIELD_MAX_LENGTH = 1024;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

type PlatformKey = "spotify" | "youtube" | "appleMusic" | "tidal";

const PLATFORM_ORDER: { key: PlatformKey; label: string; patterns: string[] }[] = [
  { key: "spotify", label: "Spotify", patterns: ["spotify.com"] },
  { key: "youtube", label: "YouTube", patterns: ["youtube.com", "youtu.be", "music.youtube.com"] },
  { key: "appleMusic", label: "Apple Music", patterns: ["music.apple.com"] },
  { key: "tidal", label: "Tidal", patterns: ["tidal.com", "listen.tidal.com"] },
];

function detectOriginalPlatform(originalUrl: string): PlatformKey | null {
  const lower = originalUrl.toLowerCase();
  for (const platform of PLATFORM_ORDER) {
    if (platform.patterns.some((p) => lower.includes(p))) return platform.key;
  }
  return null;
}

export function buildPlatformLinks(links: OdesliLinks, originalUrl: string): string {
  const originalPlatform = detectOriginalPlatform(originalUrl);

  // Build ordered list: original platform first, then the rest
  const ordered = originalPlatform
    ? [
        PLATFORM_ORDER.find((p) => p.key === originalPlatform)!,
        ...PLATFORM_ORDER.filter((p) => p.key !== originalPlatform),
      ]
    : PLATFORM_ORDER;

  const parts: string[] = [];
  for (const platform of ordered) {
    const url = links[platform.key];
    if (url) parts.push(`[${platform.label}](${url})`);
  }
  if (links.pageUrl) parts.push(`[All Platforms](${links.pageUrl})`);
  if (parts.length === 0) parts.push(`[Link](${originalUrl})`);
  return parts.join(" | ");
}

function songDisplayName(song: { title: string; artist: string; originalUrl: string }): string {
  if (song.title && song.artist) return `**${song.title}** — ${song.artist}`;
  if (song.title) return `**${song.title}**`;
  return `[Song Link](${song.originalUrl})`;
}

export function buildRoundAnnouncementEmbed(
  roundId: number,
  submissionsCloseAt: number,
  memberCount: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Music Club — Round #${roundId}`)
    .setDescription(
      `A new round has started! Submit a song for the playlist.\n\n` +
      `Submissions close <t:${Math.floor(submissionsCloseAt / 1000)}:R>`,
    )
    .setColor(EMBED_COLOR)
    .addFields({ name: "Members", value: `${memberCount}`, inline: true })
    .setFooter({ text: "Click the button below or use /musicclub submit" })
    .setTimestamp();
}

export function buildPlaylistEmbed(playlist: RoundPlaylistResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Music Club — Round #${playlist.roundId} Playlist`)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  if (playlist.songs.length === 0) {
    embed.setDescription("No songs were submitted this round.");
    return embed;
  }

  embed.setDescription(
    `${playlist.songs.length} song(s) submitted. ` +
    `Ratings close <t:${Math.floor(playlist.ratingsCloseAt / 1000)}:R>`,
  );

  for (const song of playlist.songs.slice(0, 25)) {
    const name = songDisplayName(song);
    const links = buildPlatformLinks(song.links, song.originalUrl);
    const reasonText = song.reason ? `\n> ${song.reason}` : "";
    const value = truncate(
      `Submitted by <@${song.userId}>${reasonText}\n${links}`,
      FIELD_MAX_LENGTH,
    );
    embed.addFields({ name, value });
  }

  embed.setFooter({ text: "Rate each song using the buttons below or /musicclub rate" });
  return embed;
}

export function buildResultsEmbed(results: RoundResultsResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Music Club — Round #${results.roundId} Results`)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  if (results.songs.length === 0) {
    embed.setDescription("No songs were submitted this round.");
    return embed;
  }

  const medals = ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const lines = results.songs.map((song, i) => {
    const rank = i + 1;
    const medal = medals[rank] ?? `#${rank}`;
    const name = song.title && song.artist
      ? `${song.title} — ${song.artist}`
      : "Unknown";
    const ratingText = song.ratingCount > 0
      ? `**${song.averageRating}/10** (${song.ratingCount} rating${song.ratingCount !== 1 ? "s" : ""})`
      : "No ratings";
    const links = buildPlatformLinks(song.links, "");
    return `${medal} ${name} by <@${song.userId}> — ${ratingText}\n${links}`;
  });

  const songSection = truncate(lines.join("\n\n"), 3500);

  if (results.raterTallies.length > 0) {
    const tallyLines = results.raterTallies.map((t) =>
      `<@${t.userId}>: **${t.totalPointsGiven}** pts (${t.songsRated} song${t.songsRated !== 1 ? "s" : ""} rated)`,
    );
    embed.setDescription(`${songSection}\n\n**Rater Scores**\n${tallyLines.join("\n")}`);
  } else {
    embed.setDescription(songSection);
  }

  return embed;
}

export function buildSubmissionReminderEmbed(
  roundId: number,
  submissionsCloseAt: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Music Club — Round #${roundId}`)
    .setDescription(
      `Submissions are closing soon! Get your song in before it's too late.\n\n` +
      `Submissions close <t:${Math.floor(submissionsCloseAt / 1000)}:R>`,
    )
    .setColor(EMBED_COLOR)
    .setFooter({ text: "Use /musicclub submit or click the button on the announcement" })
    .setTimestamp();
}

export function buildRatingReminderEmbed(
  roundId: number,
  ratingsCloseAt: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Music Club — Round #${roundId}`)
    .setDescription(
      `Ratings are closing soon! Make sure you've rated all the songs.\n\n` +
      `Ratings close <t:${Math.floor(ratingsCloseAt / 1000)}:R>`,
    )
    .setColor(EMBED_COLOR)
    .setFooter({ text: "Use /musicclub rate or click the Rate Songs button on the playlist" })
    .setTimestamp();
}

export function buildSongRatingConfirmEmbed(
  song: MusicClubSongEntry,
  rating: number,
  changed: boolean,
): EmbedBuilder {
  const label = changed ? "Rating updated!" : "Rating submitted!";
  return new EmbedBuilder()
    .setTitle(label)
    .setDescription(`${songDisplayName(song)} — **${rating}/10**`)
    .setColor(EMBED_COLOR);
}
