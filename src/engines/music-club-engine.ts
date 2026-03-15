import type { MusicClubAccessor } from "../accessors/music-club-accessor.js";
import type { OdesliAccessor } from "../accessors/odesli-accessor.js";
import type {
  JoinClubRequest,
  JoinClubResponse,
  LeaveClubRequest,
  LeaveClubResponse,
  SubmitSongRequest,
  SubmitSongResponse,
  RateSongRequest,
  RateSongResponse,
  StartRoundRequest,
  StartRoundResponse,
  RoundPlaylistResponse,
  RoundResultsResponse,
  OdesliLinks,
  MusicClubSongEntry,
  SongRatingResult,
} from "../types/music-club-contracts.js";

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseOdesliData(raw: string): OdesliLinks {
  try {
    return JSON.parse(raw) as OdesliLinks;
  } catch {
    return { pageUrl: "" };
  }
}

function toSongEntry(row: {
  id: number;
  userId: string;
  originalUrl: string;
  title: string;
  artist: string;
  odesliData: string;
  reason: string;
}): MusicClubSongEntry {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    artist: row.artist,
    originalUrl: row.originalUrl,
    links: parseOdesliData(row.odesliData),
    reason: row.reason,
  };
}

export class MusicClubEngine {
  constructor(
    private readonly musicClubAccessor: MusicClubAccessor,
    private readonly odesliAccessor: OdesliAccessor,
  ) {}

  async join(request: JoinClubRequest): Promise<JoinClubResponse> {
    const already = await this.musicClubAccessor.isMember(request.userId, request.guildId);
    if (already) {
      return { success: true, reason: "already_member" };
    }
    await this.musicClubAccessor.addMember(request.userId, request.guildId, Date.now());
    return { success: true, reason: "joined" };
  }

  async leave(request: LeaveClubRequest): Promise<LeaveClubResponse> {
    const removed = await this.musicClubAccessor.removeMember(request.userId, request.guildId);
    if (!removed) {
      return { success: false, reason: "not_member" };
    }
    return { success: true, reason: "left" };
  }

  async submitSong(request: SubmitSongRequest): Promise<SubmitSongResponse> {
    const isMember = await this.musicClubAccessor.isMember(request.userId, request.guildId);
    if (!isMember) {
      return { success: false, reason: "not_member" };
    }

    if (!isValidUrl(request.url)) {
      return { success: false, reason: "invalid_url" };
    }

    const round = await this.musicClubAccessor.getRound(request.roundId);
    if (!round) {
      return { success: false, reason: "round_not_found" };
    }
    if (round.status !== "open") {
      return { success: false, reason: "round_not_open" };
    }

    // Resolve cross-platform links via Odesli (non-fatal if it fails)
    let title = "";
    let artist = "";
    let odesliData: OdesliLinks = { pageUrl: "" };

    const odesliResult = await this.odesliAccessor.getLinks(request.url);
    if (odesliResult) {
      title = odesliResult.title;
      artist = odesliResult.artist;
      odesliData = odesliResult.links;
    }

    const reason = await this.musicClubAccessor.upsertSong(
      request.roundId,
      request.userId,
      request.url,
      title,
      artist,
      JSON.stringify(odesliData),
      request.reason ?? "",
      Date.now(),
    );

    const song = toSongEntry({
      id: 0,
      userId: request.userId,
      originalUrl: request.url,
      title,
      artist,
      odesliData: JSON.stringify(odesliData),
      reason: request.reason ?? "",
    });

    return { success: true, reason, song };
  }

  async rateSong(request: RateSongRequest): Promise<RateSongResponse> {
    const isMember = await this.musicClubAccessor.isMember(request.userId, request.guildId);
    if (!isMember) {
      return { success: false, reason: "not_member" };
    }

    if (!Number.isInteger(request.rating) || request.rating < 1 || request.rating > 10) {
      return { success: false, reason: "invalid_rating" };
    }

    const song = await this.musicClubAccessor.getSong(request.songId);
    if (!song) {
      return { success: false, reason: "song_not_found" };
    }

    if (song.userId === request.userId) {
      return { success: false, reason: "own_song" };
    }

    const round = await this.musicClubAccessor.getRound(song.roundId);
    if (!round || round.status !== "listening") {
      return { success: false, reason: "round_not_listening" };
    }

    const result = await this.musicClubAccessor.upsertRating(
      request.songId,
      request.userId,
      request.rating,
      Date.now(),
    );

    return { success: true, reason: result };
  }

  async startNewRound(request: StartRoundRequest): Promise<StartRoundResponse> {
    const now = Date.now();
    const submissionsCloseAt = now + request.submissionDays * 24 * 60 * 60 * 1000;
    const ratingsCloseAt = submissionsCloseAt + request.ratingDays * 24 * 60 * 60 * 1000;

    const { id } = await this.musicClubAccessor.createRound(
      request.guildId,
      request.channelId,
      now,
      submissionsCloseAt,
      ratingsCloseAt,
      now,
    );

    return { roundId: id, submissionsCloseAt, ratingsCloseAt };
  }

  async getPlaylist(roundId: number): Promise<RoundPlaylistResponse | null> {
    const round = await this.musicClubAccessor.getRound(roundId);
    if (!round) return null;

    const songs = await this.musicClubAccessor.getSongsForRound(roundId);

    return {
      roundId: round.id,
      status: round.status,
      songs: songs.map(toSongEntry),
      submissionsCloseAt: round.submissionsCloseAt,
      ratingsCloseAt: round.ratingsCloseAt,
    };
  }

  async getLatestPlaylist(guildId: string): Promise<RoundPlaylistResponse | null> {
    const round = await this.musicClubAccessor.getLatestRound(guildId);
    if (!round) return null;
    return this.getPlaylist(round.id);
  }

  async getResults(roundId: number): Promise<RoundResultsResponse | null> {
    const round = await this.musicClubAccessor.getRound(roundId);
    if (!round) return null;

    const songs = await this.musicClubAccessor.getSongsForRound(roundId);
    const ratings = await this.musicClubAccessor.getAverageRatings(roundId);
    const ratingMap = new Map(ratings.map((r) => [r.songId, r]));

    const results: SongRatingResult[] = songs.map((song) => {
      const rating = ratingMap.get(song.id);
      return {
        songId: song.id,
        userId: song.userId,
        title: song.title,
        artist: song.artist,
        reason: song.reason,
        averageRating: rating ? Math.round(rating.averageRating * 10) / 10 : 0,
        ratingCount: rating ? Number(rating.ratingCount) : 0,
        links: parseOdesliData(song.odesliData),
      };
    });

    results.sort((a, b) => b.averageRating - a.averageRating);

    const tallies = await this.musicClubAccessor.getRaterTallies(roundId);
    const raterTallies = tallies.map((t) => ({
      userId: t.userId,
      totalPointsGiven: Number(t.totalPointsGiven),
      songsRated: Number(t.songsRated),
    }));

    return { roundId: round.id, songs: results, raterTallies };
  }

  async getLatestResults(guildId: string): Promise<RoundResultsResponse | null> {
    const round = await this.musicClubAccessor.getLatestRound(guildId);
    if (!round) return null;
    return this.getResults(round.id);
  }

  async transitionToListening(): Promise<{ id: number; channelId: string; messageId: string }[]> {
    const ready = await this.musicClubAccessor.getRoundsReadyToTransition(Date.now());
    for (const round of ready) {
      await this.musicClubAccessor.setRoundStatus(round.id, "listening");
    }
    return ready;
  }

  async closeExpiredRounds(): Promise<{ id: number; channelId: string; playlistMessageId: string }[]> {
    const ready = await this.musicClubAccessor.getRoundsReadyToClose(Date.now());
    for (const round of ready) {
      await this.musicClubAccessor.setRoundStatus(round.id, "closed");
    }
    return ready;
  }

  async getActiveRound(guildId: string): Promise<{ id: number; status: string } | null> {
    const round = await this.musicClubAccessor.getActiveRound(guildId);
    if (!round) return null;
    return { id: round.id, status: round.status };
  }

  async getUserRatingsForRound(
    roundId: number,
    userId: string,
  ): Promise<Map<number, number>> {
    const rows = await this.musicClubAccessor.getUserRatingsForRound(roundId, userId);
    return new Map(rows.map((r) => [r.songId, r.rating]));
  }

  async getMemberCount(guildId: string): Promise<number> {
    return this.musicClubAccessor.getMemberCount(guildId);
  }
}
