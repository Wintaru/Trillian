import type { PlaylistAccessor } from "../accessors/playlist-accessor.js";
import type { SongMetadataAccessor } from "../accessors/song-metadata-accessor.js";
import type {
  CreatePlaylistRequest,
  CreatePlaylistResponse,
  EditPlaylistRequest,
  EditPlaylistResponse,
  ClosePlaylistRequest,
  ClosePlaylistResponse,
  ReopenPlaylistRequest,
  ReopenPlaylistResponse,
  DeletePlaylistRequest,
  DeletePlaylistResponse,
  AddSongRequest,
  AddSongResponse,
  RemoveSongRequest,
  RemoveSongResponse,
  EditSongRequest,
  EditSongResponse,
  AddLinkRequest,
  AddLinkResponse,
  RemoveLinkRequest,
  RemoveLinkResponse,
  PlaylistListEntry,
  PlaylistViewResponse,
} from "../types/playlist-contracts.js";

const MAX_TITLE_LENGTH = 100;

export class PlaylistEngine {
  constructor(
    private readonly playlistAccessor: PlaylistAccessor,
    private readonly songMetadataAccessor: SongMetadataAccessor,
  ) {}

  // --- Playlist CRUD ---

  async createPlaylist(request: CreatePlaylistRequest): Promise<CreatePlaylistResponse> {
    if (request.title.length > MAX_TITLE_LENGTH) {
      return { success: false, reason: "title_too_long" };
    }

    const playlistId = await this.playlistAccessor.createPlaylist(
      request.guildId,
      request.userId,
      request.title,
      request.description ?? "",
      Date.now(),
    );

    return { success: true, playlistId, reason: "created" };
  }

  async editPlaylist(request: EditPlaylistRequest): Promise<EditPlaylistResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.creatorUserId !== request.userId) return { success: false, reason: "not_creator" };
    if (request.title && request.title.length > MAX_TITLE_LENGTH) {
      return { success: false, reason: "title_too_long" };
    }

    const fields: { title?: string; description?: string } = {};
    if (request.title !== undefined) fields.title = request.title;
    if (request.description !== undefined) fields.description = request.description;

    await this.playlistAccessor.updatePlaylist(request.playlistId, fields);
    return { success: true, reason: "updated" };
  }

  async closePlaylist(request: ClosePlaylistRequest): Promise<ClosePlaylistResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.creatorUserId !== request.userId) return { success: false, reason: "not_creator" };
    if (playlist.status === "closed") return { success: false, reason: "already_closed" };

    await this.playlistAccessor.setPlaylistStatus(request.playlistId, "closed", Date.now());
    return { success: true, reason: "closed" };
  }

  async reopenPlaylist(request: ReopenPlaylistRequest): Promise<ReopenPlaylistResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.creatorUserId !== request.userId) return { success: false, reason: "not_creator" };
    if (playlist.status === "open") return { success: false, reason: "already_open" };

    await this.playlistAccessor.setPlaylistStatus(request.playlistId, "open", 0);
    return { success: true, reason: "reopened" };
  }

  async deletePlaylist(request: DeletePlaylistRequest): Promise<DeletePlaylistResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.creatorUserId !== request.userId) return { success: false, reason: "not_creator" };

    await this.playlistAccessor.deletePlaylist(request.playlistId);
    return { success: true, reason: "deleted" };
  }

  async listPlaylists(guildId: string, status?: string): Promise<PlaylistListEntry[]> {
    return this.playlistAccessor.listPlaylists(guildId, status ?? "open");
  }

  async viewPlaylist(playlistId: number): Promise<PlaylistViewResponse | null> {
    const playlist = await this.playlistAccessor.getPlaylist(playlistId);
    if (!playlist) return null;

    const songs = await this.playlistAccessor.getSongsForPlaylist(playlistId);
    const links = await this.playlistAccessor.getLinksForPlaylist(playlistId);

    const songCount = songs.length;

    return {
      playlist: {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        creatorUserId: playlist.creatorUserId,
        songCount,
        status: playlist.status,
        createdAt: playlist.createdAt,
      },
      songs,
      links,
    };
  }

  // --- Song CRUD ---

  async addSong(request: AddSongRequest): Promise<AddSongResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.status !== "open") return { success: false, reason: "playlist_not_open" };

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url);
      if (!parsedUrl.protocol.startsWith("http")) throw new Error("not http");
    } catch {
      return { success: false, reason: "invalid_url" };
    }

    let title = "";
    let artist = "";
    const metadata = await this.songMetadataAccessor.getMetadata(parsedUrl.href);
    if (metadata) {
      title = metadata.title;
      artist = metadata.artist;
    }

    const songId = await this.playlistAccessor.addSong(
      request.playlistId,
      request.userId,
      parsedUrl.href,
      title,
      artist,
      request.note ?? "",
      Date.now(),
    );

    return { success: true, songId, reason: "added" };
  }

  async removeSong(request: RemoveSongRequest): Promise<RemoveSongResponse> {
    const song = await this.playlistAccessor.getSong(request.songId);
    if (!song) return { success: false, reason: "not_found" };

    const playlist = await this.playlistAccessor.getPlaylist(song.playlistId);
    if (song.userId !== request.userId && playlist?.creatorUserId !== request.userId) {
      return { success: false, reason: "not_authorized" };
    }

    await this.playlistAccessor.deleteSong(request.songId);
    return { success: true, reason: "removed" };
  }

  async editSong(request: EditSongRequest): Promise<EditSongResponse> {
    const song = await this.playlistAccessor.getSong(request.songId);
    if (!song) return { success: false, reason: "not_found" };

    const playlist = await this.playlistAccessor.getPlaylist(song.playlistId);
    if (song.userId !== request.userId && playlist?.creatorUserId !== request.userId) {
      return { success: false, reason: "not_authorized" };
    }

    await this.playlistAccessor.updateSongNote(request.songId, request.note, Date.now());
    return { success: true, reason: "updated" };
  }

  // --- Platform Links ---

  async addLink(request: AddLinkRequest): Promise<AddLinkResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };
    if (playlist.status !== "open") return { success: false, reason: "playlist_not_open" };

    const result = await this.playlistAccessor.upsertLink(
      request.playlistId,
      request.userId,
      request.platform,
      request.url,
      Date.now(),
    );

    return { success: true, reason: result };
  }

  async removeLink(request: RemoveLinkRequest): Promise<RemoveLinkResponse> {
    const playlist = await this.playlistAccessor.getPlaylist(request.playlistId);
    if (!playlist) return { success: false, reason: "not_found" };

    const link = await this.playlistAccessor.getLink(request.playlistId, request.platform);
    if (!link) return { success: false, reason: "not_found" };

    if (link.userId !== request.userId && playlist.creatorUserId !== request.userId) {
      return { success: false, reason: "not_authorized" };
    }

    await this.playlistAccessor.deleteLink(request.playlistId, request.platform);
    return { success: true, reason: "removed" };
  }
}
