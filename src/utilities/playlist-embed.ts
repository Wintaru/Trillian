import { EmbedBuilder } from "discord.js";
import type {
  PlaylistViewResponse,
  PlaylistListEntry,
  PlaylistLinkEntry,
} from "../types/playlist-contracts.js";

const EMBED_COLOR = 0x1db954;
const FIELD_MAX_LENGTH = 1024;

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
  tidal: "Tidal",
  amazon_music: "Amazon Music",
  soundcloud: "SoundCloud",
  other: "Other",
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function songDisplayName(song: { title: string; artist: string; songUrl: string }): string {
  if (song.title && song.artist) return `**${song.title}** — ${song.artist}`;
  if (song.title) return `**${song.title}**`;
  return `[Song Link](${song.songUrl})`;
}

function buildPlatformLinksSection(links: PlaylistLinkEntry[]): string {
  if (links.length === 0) return "";
  const parts = links.map((link) => {
    const label = PLATFORM_LABELS[link.platform] ?? link.platform;
    return `[${label}](${link.url})`;
  });
  return parts.join(" | ");
}

export function buildPlaylistViewEmbed(view: PlaylistViewResponse): EmbedBuilder {
  const { playlist, songs, links } = view;
  const statusLabel = playlist.status === "open" ? "Open" : "Closed";

  const embed = new EmbedBuilder()
    .setTitle(`${playlist.title}`)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  const descParts: string[] = [];
  if (playlist.description) descParts.push(playlist.description);
  descParts.push(`**Status:** ${statusLabel} | **Songs:** ${songs.length} | **Created by:** <@${playlist.creatorUserId}>`);

  const platformLinks = buildPlatformLinksSection(links);
  if (platformLinks) descParts.push(`**Listen:** ${platformLinks}`);

  embed.setDescription(descParts.join("\n\n"));

  if (songs.length === 0) {
    embed.addFields({ name: "No songs yet", value: "Be the first to add a song with `/playlist add`!" });
    return embed;
  }

  for (const [i, song] of songs.slice(0, 25).entries()) {
    const name = `${i + 1}. ${songDisplayName(song)}`;
    const noteText = song.note ? `\n> ${song.note}` : "";
    const value = truncate(
      `Submitted by <@${song.userId}>${noteText}\n[Link](${song.songUrl})`,
      FIELD_MAX_LENGTH,
    );
    embed.addFields({ name, value });
  }

  if (songs.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${songs.length} songs` });
  } else {
    embed.setFooter({ text: `Playlist #${playlist.id}` });
  }

  return embed;
}

export function buildPlaylistListEmbed(playlists: PlaylistListEntry[], statusFilter: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Playlists")
    .setColor(EMBED_COLOR)
    .setTimestamp();

  if (playlists.length === 0) {
    const filterLabel = statusFilter === "all" ? "" : ` ${statusFilter}`;
    embed.setDescription(`No${filterLabel} playlists found. Create one with \`/playlist create\`!`);
    return embed;
  }

  const lines = playlists.map((p) => {
    const status = p.status === "open" ? "Open" : "Closed";
    const desc = p.description ? ` — ${p.description}` : "";
    return `**#${p.id}** ${p.title}${desc}\n${status} | ${p.songCount} song(s) | by <@${p.creatorUserId}>`;
  });

  embed.setDescription(truncate(lines.join("\n\n"), 4096));
  return embed;
}

export function buildPlaylistHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Playlist Commands")
    .setColor(EMBED_COLOR)
    .setDescription("Create and manage open-ended collaborative playlists.")
    .addFields(
      {
        name: "Playlist Management",
        value: [
          "`/playlist create <title> [description]` — Create a new playlist",
          "`/playlist edit <id> [title] [description]` — Edit your playlist",
          "`/playlist close <id>` — Close your playlist to new submissions",
          "`/playlist reopen <id>` — Reopen a closed playlist",
          "`/playlist delete <id>` — Delete your playlist and all its songs",
        ].join("\n"),
      },
      {
        name: "Browsing",
        value: [
          "`/playlist list [status]` — List playlists (open/closed/all)",
          "`/playlist view <id>` — View a playlist's songs",
        ].join("\n"),
      },
      {
        name: "Songs",
        value: [
          "`/playlist add <playlist> <url> [note]` — Add a song to a playlist",
          "`/playlist remove <song>` — Remove your song (or any song if you're the playlist creator)",
          "`/playlist editsong <song> <note>` — Edit a song's note",
        ].join("\n"),
      },
      {
        name: "Platform Links",
        value: [
          "`/playlist link <playlist> <platform> <url>` — Add a platform playlist link (e.g. Spotify, Apple Music)",
          "`/playlist removelink <playlist> <platform>` — Remove a platform link",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Playlist creators can manage all songs and links in their playlists" });
}
