export interface CreatePollRequest {
  guildId: string;
  channelId: string;
  creatorId: string;
  question: string;
  options: string[];
  durationMinutes: number | null;
}

export interface CreatePollResponse {
  pollId: number;
  question: string;
  options: string[];
  closesAt: number | null;
}

export interface CastVoteRequest {
  pollId: number;
  userId: string;
  optionIndex: number;
}

export interface CastVoteResponse {
  success: boolean;
  reason: "voted" | "changed" | "poll_closed" | "poll_not_found" | "invalid_option";
}

export interface ClosePollRequest {
  pollId: number;
  requesterId: string;
  isAdmin: boolean;
}

export interface ClosePollResponse {
  success: boolean;
  reason: "closed" | "already_closed" | "not_found" | "not_authorized";
  results: PollResults | null;
}

export interface PollResults {
  pollId: number;
  question: string;
  options: string[];
  voteCounts: number[];
  totalVotes: number;
  status: "open" | "closed";
  closesAt: number | null;
}

export interface GetPollResultsRequest {
  pollId: number;
}
