// --- Membership ---

export interface JoinClubRequest {
  userId: string;
  guildId: string;
}

export interface JoinClubResponse {
  success: boolean;
  reason: "joined" | "already_member";
}

export interface LeaveClubRequest {
  userId: string;
  guildId: string;
}

export interface LeaveClubResponse {
  success: boolean;
  reason: "left" | "not_member";
}

// --- Submissions ---

export interface SubmitSongRequest {
  roundId: number;
  userId: string;
  guildId: string;
  url: string;
  reason?: string;
}

export interface SubmitSongResponse {
  success: boolean;
  reason:
    | "submitted"
    | "resubmitted"
    | "round_not_open"
    | "round_not_found"
    | "not_member"
    | "invalid_url";
  song?: MusicClubSongEntry;
}

// --- Ratings ---

export interface RateSongRequest {
  songId: number;
  userId: string;
  guildId: string;
  rating: number;
}

export interface RateSongResponse {
  success: boolean;
  reason:
    | "rated"
    | "changed"
    | "round_not_listening"
    | "song_not_found"
    | "own_song"
    | "invalid_rating"
    | "not_member";
}

// --- Round Lifecycle ---

export interface StartRoundRequest {
  guildId: string;
  channelId: string;
  submissionDays: number;
  ratingDays: number;
}

export interface StartRoundResponse {
  roundId: number;
  submissionsCloseAt: number;
  ratingsCloseAt: number;
}

// --- Views ---

export interface OdesliLinks {
  spotify?: string;
  appleMusic?: string;
  youtube?: string;
  tidal?: string;
  amazonMusic?: string;
  soundcloud?: string;
  pageUrl: string;
}

export interface MusicClubSongEntry {
  id: number;
  userId: string;
  title: string;
  artist: string;
  originalUrl: string;
  links: OdesliLinks;
  reason: string;
}

export interface RoundPlaylistResponse {
  roundId: number;
  status: string;
  songs: MusicClubSongEntry[];
  submissionsCloseAt: number;
  ratingsCloseAt: number;
}

export interface RaterTally {
  userId: string;
  totalPointsGiven: number;
  songsRated: number;
}

export interface RoundResultsResponse {
  roundId: number;
  raterTallies: RaterTally[];
}

