// --- Playlist CRUD ---

export interface CreatePlaylistRequest {
  guildId: string;
  userId: string;
  title: string;
  description?: string;
}

export interface CreatePlaylistResponse {
  success: boolean;
  playlistId?: number;
  reason: "created" | "title_too_long";
}

export interface EditPlaylistRequest {
  playlistId: number;
  userId: string;
  title?: string;
  description?: string;
}

export interface EditPlaylistResponse {
  success: boolean;
  reason: "updated" | "not_found" | "not_creator" | "title_too_long";
}

export interface ClosePlaylistRequest {
  playlistId: number;
  userId: string;
}

export interface ClosePlaylistResponse {
  success: boolean;
  reason: "closed" | "already_closed" | "not_found" | "not_creator";
}

export interface ReopenPlaylistRequest {
  playlistId: number;
  userId: string;
}

export interface ReopenPlaylistResponse {
  success: boolean;
  reason: "reopened" | "already_open" | "not_found" | "not_creator";
}

export interface DeletePlaylistRequest {
  playlistId: number;
  userId: string;
}

export interface DeletePlaylistResponse {
  success: boolean;
  reason: "deleted" | "not_found" | "not_creator";
}

// --- Song CRUD ---

export interface AddSongRequest {
  playlistId: number;
  userId: string;
  url: string;
  note?: string;
}

export interface AddSongResponse {
  success: boolean;
  songId?: number;
  reason: "added" | "playlist_not_open" | "not_found" | "invalid_url";
}

export interface RemoveSongRequest {
  songId: number;
  userId: string;
}

export interface RemoveSongResponse {
  success: boolean;
  reason: "removed" | "not_found" | "not_authorized";
}

export interface EditSongRequest {
  songId: number;
  userId: string;
  note: string;
}

export interface EditSongResponse {
  success: boolean;
  reason: "updated" | "not_found" | "not_authorized";
}

// --- Platform Links ---

export interface AddLinkRequest {
  playlistId: number;
  userId: string;
  platform: string;
  url: string;
}

export interface AddLinkResponse {
  success: boolean;
  reason: "added" | "updated" | "not_found" | "playlist_not_open";
}

export interface RemoveLinkRequest {
  playlistId: number;
  userId: string;
  platform: string;
}

export interface RemoveLinkResponse {
  success: boolean;
  reason: "removed" | "not_found" | "not_authorized";
}

// --- Views ---

export interface PlaylistListEntry {
  id: number;
  title: string;
  description: string;
  creatorUserId: string;
  songCount: number;
  status: string;
  createdAt: number;
}

export interface PlaylistSongEntry {
  id: number;
  userId: string;
  songUrl: string;
  title: string;
  artist: string;
  note: string;
  submittedAt: number;
}

export interface PlaylistLinkEntry {
  platform: string;
  url: string;
  userId: string;
}

export interface PlaylistViewResponse {
  playlist: PlaylistListEntry;
  songs: PlaylistSongEntry[];
  links: PlaylistLinkEntry[];
}
