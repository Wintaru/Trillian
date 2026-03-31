import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaylistEngine } from "./playlist-engine.js";
import type { PlaylistAccessor } from "../accessors/playlist-accessor.js";
import type { SongMetadataAccessor } from "../accessors/song-metadata-accessor.js";

function createMockAccessor(): PlaylistAccessor {
  return {
    createPlaylist: vi.fn(),
    getPlaylist: vi.fn(),
    updatePlaylist: vi.fn(),
    setPlaylistStatus: vi.fn(),
    deletePlaylist: vi.fn(),
    listPlaylists: vi.fn(),
    addSong: vi.fn(),
    getSong: vi.fn(),
    getSongsForPlaylist: vi.fn(),
    updateSongNote: vi.fn(),
    deleteSong: vi.fn(),
    upsertLink: vi.fn(),
    getLink: vi.fn(),
    getLinksForPlaylist: vi.fn(),
    deleteLink: vi.fn(),
  } as unknown as PlaylistAccessor;
}

function createMockSongMetadata(): SongMetadataAccessor {
  return {
    getMetadata: vi.fn(),
  } as unknown as SongMetadataAccessor;
}

const PLAYLIST_ROW = {
  id: 1,
  guildId: "g1",
  creatorUserId: "u1",
  title: "Test Playlist",
  description: "A test playlist",
  status: "open",
  createdAt: 1000,
  closedAt: 0,
};

describe("PlaylistEngine", () => {
  let accessor: PlaylistAccessor;
  let songMetadata: SongMetadataAccessor;
  let engine: PlaylistEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    songMetadata = createMockSongMetadata();
    engine = new PlaylistEngine(accessor, songMetadata);
  });

  // --- createPlaylist ---

  describe("createPlaylist", () => {
    it("should create a playlist", async () => {
      vi.mocked(accessor.createPlaylist).mockResolvedValue(1);

      const result = await engine.createPlaylist({
        guildId: "g1",
        userId: "u1",
        title: "Road Trip",
        description: "Songs for driving",
      });

      expect(result).toEqual({ success: true, playlistId: 1, reason: "created" });
      expect(accessor.createPlaylist).toHaveBeenCalledWith(
        "g1", "u1", "Road Trip", "Songs for driving", expect.any(Number),
      );
    });

    it("should reject titles that are too long", async () => {
      const result = await engine.createPlaylist({
        guildId: "g1",
        userId: "u1",
        title: "A".repeat(101),
      });

      expect(result).toEqual({ success: false, reason: "title_too_long" });
      expect(accessor.createPlaylist).not.toHaveBeenCalled();
    });
  });

  // --- editPlaylist ---

  describe("editPlaylist", () => {
    it("should update a playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.editPlaylist({
        playlistId: 1,
        userId: "u1",
        title: "New Title",
      });

      expect(result).toEqual({ success: true, reason: "updated" });
      expect(accessor.updatePlaylist).toHaveBeenCalledWith(1, { title: "New Title" });
    });

    it("should reject non-creator", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.editPlaylist({
        playlistId: 1,
        userId: "other-user",
        title: "Hijack",
      });

      expect(result).toEqual({ success: false, reason: "not_creator" });
    });

    it("should return not_found for missing playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(null);

      const result = await engine.editPlaylist({
        playlistId: 999,
        userId: "u1",
        title: "X",
      });

      expect(result).toEqual({ success: false, reason: "not_found" });
    });
  });

  // --- closePlaylist ---

  describe("closePlaylist", () => {
    it("should close an open playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.closePlaylist({ playlistId: 1, userId: "u1" });

      expect(result).toEqual({ success: true, reason: "closed" });
      expect(accessor.setPlaylistStatus).toHaveBeenCalledWith(1, "closed", expect.any(Number));
    });

    it("should reject already-closed playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue({ ...PLAYLIST_ROW, status: "closed" });

      const result = await engine.closePlaylist({ playlistId: 1, userId: "u1" });

      expect(result).toEqual({ success: false, reason: "already_closed" });
    });

    it("should reject non-creator", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.closePlaylist({ playlistId: 1, userId: "other" });

      expect(result).toEqual({ success: false, reason: "not_creator" });
    });
  });

  // --- reopenPlaylist ---

  describe("reopenPlaylist", () => {
    it("should reopen a closed playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue({ ...PLAYLIST_ROW, status: "closed" });

      const result = await engine.reopenPlaylist({ playlistId: 1, userId: "u1" });

      expect(result).toEqual({ success: true, reason: "reopened" });
    });

    it("should reject already-open playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.reopenPlaylist({ playlistId: 1, userId: "u1" });

      expect(result).toEqual({ success: false, reason: "already_open" });
    });
  });

  // --- deletePlaylist ---

  describe("deletePlaylist", () => {
    it("should delete a playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.deletePlaylist).mockResolvedValue(true);

      const result = await engine.deletePlaylist({ playlistId: 1, userId: "u1" });

      expect(result).toEqual({ success: true, reason: "deleted" });
    });

    it("should reject non-creator", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.deletePlaylist({ playlistId: 1, userId: "other" });

      expect(result).toEqual({ success: false, reason: "not_creator" });
    });
  });

  // --- addSong ---

  describe("addSong", () => {
    it("should add a song to an open playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(songMetadata.getMetadata).mockResolvedValue({ title: "Test Song", artist: "Test Artist" });
      vi.mocked(accessor.addSong).mockResolvedValue(42);

      const result = await engine.addSong({
        playlistId: 1,
        userId: "u2",
        url: "https://open.spotify.com/track/123",
        note: "Great song",
      });

      expect(result).toEqual({ success: true, songId: 42, reason: "added" });
      expect(accessor.addSong).toHaveBeenCalledWith(
        1, "u2", "https://open.spotify.com/track/123", "Test Song", "Test Artist", "Great song", expect.any(Number),
      );
    });

    it("should reject when playlist is closed", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue({ ...PLAYLIST_ROW, status: "closed" });

      const result = await engine.addSong({
        playlistId: 1,
        userId: "u2",
        url: "https://open.spotify.com/track/123",
      });

      expect(result).toEqual({ success: false, reason: "playlist_not_open" });
    });

    it("should reject invalid URLs", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.addSong({
        playlistId: 1,
        userId: "u2",
        url: "not-a-url",
      });

      expect(result).toEqual({ success: false, reason: "invalid_url" });
    });

    it("should handle metadata fetch failure gracefully", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(songMetadata.getMetadata).mockResolvedValue(null);
      vi.mocked(accessor.addSong).mockResolvedValue(42);

      const result = await engine.addSong({
        playlistId: 1,
        userId: "u2",
        url: "https://example.com/song",
      });

      expect(result).toEqual({ success: true, songId: 42, reason: "added" });
      expect(accessor.addSong).toHaveBeenCalledWith(
        1, "u2", "https://example.com/song", "", "", "", expect.any(Number),
      );
    });
  });

  // --- removeSong ---

  describe("removeSong", () => {
    const SONG_ROW = {
      id: 42,
      playlistId: 1,
      userId: "u2",
      songUrl: "https://example.com",
      title: "Test",
      artist: "Artist",
      note: "",
      submittedAt: 1000,
      updatedAt: 1000,
    };

    it("should allow song owner to remove", async () => {
      vi.mocked(accessor.getSong).mockResolvedValue(SONG_ROW);
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.deleteSong).mockResolvedValue(true);

      const result = await engine.removeSong({ songId: 42, userId: "u2" });

      expect(result).toEqual({ success: true, reason: "removed" });
    });

    it("should allow playlist creator to remove any song", async () => {
      vi.mocked(accessor.getSong).mockResolvedValue(SONG_ROW);
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.deleteSong).mockResolvedValue(true);

      const result = await engine.removeSong({ songId: 42, userId: "u1" });

      expect(result).toEqual({ success: true, reason: "removed" });
    });

    it("should reject unauthorized user", async () => {
      vi.mocked(accessor.getSong).mockResolvedValue(SONG_ROW);
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.removeSong({ songId: 42, userId: "stranger" });

      expect(result).toEqual({ success: false, reason: "not_authorized" });
    });
  });

  // --- editSong ---

  describe("editSong", () => {
    const SONG_ROW = {
      id: 42,
      playlistId: 1,
      userId: "u2",
      songUrl: "https://example.com",
      title: "Test",
      artist: "Artist",
      note: "Old note",
      submittedAt: 1000,
      updatedAt: 1000,
    };

    it("should allow song owner to edit note", async () => {
      vi.mocked(accessor.getSong).mockResolvedValue(SONG_ROW);
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.editSong({ songId: 42, userId: "u2", note: "New note" });

      expect(result).toEqual({ success: true, reason: "updated" });
      expect(accessor.updateSongNote).toHaveBeenCalledWith(42, "New note", expect.any(Number));
    });

    it("should allow playlist creator to edit any song's note", async () => {
      vi.mocked(accessor.getSong).mockResolvedValue(SONG_ROW);
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);

      const result = await engine.editSong({ songId: 42, userId: "u1", note: "Creator edit" });

      expect(result).toEqual({ success: true, reason: "updated" });
    });
  });

  // --- addLink ---

  describe("addLink", () => {
    it("should add a platform link", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.upsertLink).mockResolvedValue("added");

      const result = await engine.addLink({
        playlistId: 1,
        userId: "u2",
        platform: "spotify",
        url: "https://open.spotify.com/playlist/abc",
      });

      expect(result).toEqual({ success: true, reason: "added" });
    });

    it("should reject when playlist is closed", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue({ ...PLAYLIST_ROW, status: "closed" });

      const result = await engine.addLink({
        playlistId: 1,
        userId: "u2",
        platform: "spotify",
        url: "https://open.spotify.com/playlist/abc",
      });

      expect(result).toEqual({ success: false, reason: "playlist_not_open" });
    });
  });

  // --- removeLink ---

  describe("removeLink", () => {
    it("should allow link submitter to remove", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.getLink).mockResolvedValue({
        id: 1, playlistId: 1, userId: "u2", platform: "spotify", url: "https://example.com",
      });
      vi.mocked(accessor.deleteLink).mockResolvedValue(true);

      const result = await engine.removeLink({ playlistId: 1, userId: "u2", platform: "spotify" });

      expect(result).toEqual({ success: true, reason: "removed" });
    });

    it("should allow playlist creator to remove any link", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.getLink).mockResolvedValue({
        id: 1, playlistId: 1, userId: "u2", platform: "spotify", url: "https://example.com",
      });
      vi.mocked(accessor.deleteLink).mockResolvedValue(true);

      const result = await engine.removeLink({ playlistId: 1, userId: "u1", platform: "spotify" });

      expect(result).toEqual({ success: true, reason: "removed" });
    });

    it("should reject unauthorized user", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.getLink).mockResolvedValue({
        id: 1, playlistId: 1, userId: "u2", platform: "spotify", url: "https://example.com",
      });

      const result = await engine.removeLink({ playlistId: 1, userId: "stranger", platform: "spotify" });

      expect(result).toEqual({ success: false, reason: "not_authorized" });
    });
  });

  // --- viewPlaylist ---

  describe("viewPlaylist", () => {
    it("should return playlist with songs and links", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(PLAYLIST_ROW);
      vi.mocked(accessor.getSongsForPlaylist).mockResolvedValue([
        { id: 1, userId: "u2", songUrl: "https://example.com", title: "Song", artist: "Artist", note: "", submittedAt: 1000 },
      ]);
      vi.mocked(accessor.getLinksForPlaylist).mockResolvedValue([
        { platform: "spotify", url: "https://spotify.com/playlist/abc", userId: "u2" },
      ]);

      const result = await engine.viewPlaylist(1);

      expect(result).not.toBeNull();
      expect(result!.playlist.id).toBe(1);
      expect(result!.songs).toHaveLength(1);
      expect(result!.links).toHaveLength(1);
    });

    it("should return null for missing playlist", async () => {
      vi.mocked(accessor.getPlaylist).mockResolvedValue(null);

      const result = await engine.viewPlaylist(999);

      expect(result).toBeNull();
    });
  });
});
