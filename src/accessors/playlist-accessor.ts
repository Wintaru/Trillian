import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "./database.js";
import { openPlaylists, openPlaylistSongs, openPlaylistLinks } from "../db/schema.js";

export class PlaylistAccessor {
  // --- Playlists ---

  async createPlaylist(
    guildId: string,
    userId: string,
    title: string,
    description: string,
    createdAt: number,
  ): Promise<number> {
    const result = await db
      .insert(openPlaylists)
      .values({ guildId, creatorUserId: userId, title, description, createdAt })
      .returning({ id: openPlaylists.id });
    return result[0].id;
  }

  async getPlaylist(id: number): Promise<{
    id: number;
    guildId: string;
    creatorUserId: string;
    title: string;
    description: string;
    status: string;
    createdAt: number;
    closedAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(openPlaylists)
      .where(eq(openPlaylists.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async updatePlaylist(
    id: number,
    fields: { title?: string; description?: string },
  ): Promise<void> {
    await db
      .update(openPlaylists)
      .set(fields)
      .where(eq(openPlaylists.id, id));
  }

  async setPlaylistStatus(id: number, status: string, closedAt?: number): Promise<void> {
    const set: Record<string, unknown> = { status };
    if (closedAt !== undefined) set.closedAt = closedAt;
    await db
      .update(openPlaylists)
      .set(set)
      .where(eq(openPlaylists.id, id));
  }

  async deletePlaylist(id: number): Promise<boolean> {
    // Delete songs and links first
    await db.delete(openPlaylistSongs).where(eq(openPlaylistSongs.playlistId, id));
    await db.delete(openPlaylistLinks).where(eq(openPlaylistLinks.playlistId, id));
    const result = await db
      .delete(openPlaylists)
      .where(eq(openPlaylists.id, id))
      .returning({ id: openPlaylists.id });
    return result.length > 0;
  }

  async listPlaylists(
    guildId: string,
    status?: string,
  ): Promise<
    {
      id: number;
      title: string;
      description: string;
      creatorUserId: string;
      songCount: number;
      status: string;
      createdAt: number;
    }[]
  > {
    const songCountSq = db
      .select({
        playlistId: openPlaylistSongs.playlistId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(openPlaylistSongs)
      .groupBy(openPlaylistSongs.playlistId)
      .as("song_counts");

    const conditions = [eq(openPlaylists.guildId, guildId)];
    if (status && status !== "all") {
      conditions.push(eq(openPlaylists.status, status));
    }

    const rows = await db
      .select({
        id: openPlaylists.id,
        title: openPlaylists.title,
        description: openPlaylists.description,
        creatorUserId: openPlaylists.creatorUserId,
        songCount: sql<number>`coalesce(${songCountSq.count}, 0)`,
        status: openPlaylists.status,
        createdAt: openPlaylists.createdAt,
      })
      .from(openPlaylists)
      .leftJoin(songCountSq, eq(openPlaylists.id, songCountSq.playlistId))
      .where(and(...conditions))
      .orderBy(desc(openPlaylists.createdAt));

    return rows.map((r) => ({ ...r, songCount: Number(r.songCount) }));
  }

  // --- Songs ---

  async addSong(
    playlistId: number,
    userId: string,
    songUrl: string,
    title: string,
    artist: string,
    note: string,
    now: number,
  ): Promise<number> {
    const result = await db
      .insert(openPlaylistSongs)
      .values({ playlistId, userId, songUrl, title, artist, note, submittedAt: now, updatedAt: now })
      .returning({ id: openPlaylistSongs.id });
    return result[0].id;
  }

  async getSong(songId: number): Promise<{
    id: number;
    playlistId: number;
    userId: string;
    songUrl: string;
    title: string;
    artist: string;
    note: string;
    submittedAt: number;
    updatedAt: number;
  } | null> {
    const rows = await db
      .select()
      .from(openPlaylistSongs)
      .where(eq(openPlaylistSongs.id, songId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getSongsForPlaylist(playlistId: number): Promise<
    {
      id: number;
      userId: string;
      songUrl: string;
      title: string;
      artist: string;
      note: string;
      submittedAt: number;
    }[]
  > {
    return db
      .select({
        id: openPlaylistSongs.id,
        userId: openPlaylistSongs.userId,
        songUrl: openPlaylistSongs.songUrl,
        title: openPlaylistSongs.title,
        artist: openPlaylistSongs.artist,
        note: openPlaylistSongs.note,
        submittedAt: openPlaylistSongs.submittedAt,
      })
      .from(openPlaylistSongs)
      .where(eq(openPlaylistSongs.playlistId, playlistId))
      .orderBy(openPlaylistSongs.submittedAt);
  }

  async updateSongNote(songId: number, note: string, now: number): Promise<void> {
    await db
      .update(openPlaylistSongs)
      .set({ note, updatedAt: now })
      .where(eq(openPlaylistSongs.id, songId));
  }

  async deleteSong(songId: number): Promise<boolean> {
    const result = await db
      .delete(openPlaylistSongs)
      .where(eq(openPlaylistSongs.id, songId))
      .returning({ id: openPlaylistSongs.id });
    return result.length > 0;
  }

  // --- Platform Links ---

  async upsertLink(
    playlistId: number,
    userId: string,
    platform: string,
    url: string,
    now: number,
  ): Promise<"added" | "updated"> {
    const result = await db
      .insert(openPlaylistLinks)
      .values({ playlistId, userId, platform, url, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ id: openPlaylistLinks.id });

    if (result.length > 0) return "added";

    await db
      .update(openPlaylistLinks)
      .set({ url, userId, updatedAt: now })
      .where(
        and(
          eq(openPlaylistLinks.playlistId, playlistId),
          eq(openPlaylistLinks.platform, platform),
        ),
      );

    return "updated";
  }

  async getLink(
    playlistId: number,
    platform: string,
  ): Promise<{ id: number; playlistId: number; userId: string; platform: string; url: string } | null> {
    const rows = await db
      .select()
      .from(openPlaylistLinks)
      .where(
        and(
          eq(openPlaylistLinks.playlistId, playlistId),
          eq(openPlaylistLinks.platform, platform),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getLinksForPlaylist(playlistId: number): Promise<
    { platform: string; url: string; userId: string }[]
  > {
    return db
      .select({
        platform: openPlaylistLinks.platform,
        url: openPlaylistLinks.url,
        userId: openPlaylistLinks.userId,
      })
      .from(openPlaylistLinks)
      .where(eq(openPlaylistLinks.playlistId, playlistId))
      .orderBy(openPlaylistLinks.platform);
  }

  async deleteLink(playlistId: number, platform: string): Promise<boolean> {
    const result = await db
      .delete(openPlaylistLinks)
      .where(
        and(
          eq(openPlaylistLinks.playlistId, playlistId),
          eq(openPlaylistLinks.platform, platform),
        ),
      )
      .returning({ id: openPlaylistLinks.id });
    return result.length > 0;
  }
}
