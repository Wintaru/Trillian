import type { PollAccessor } from "../accessors/poll-accessor.js";
import type {
  CreatePollRequest,
  CreatePollResponse,
  CastVoteRequest,
  CastVoteResponse,
  ClosePollRequest,
  ClosePollResponse,
  GetPollResultsRequest,
  PollResults,
} from "../types/poll-contracts.js";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MAX_QUESTION_LENGTH = 256;
const DEFAULT_DURATION_MINUTES = 480;
const MAX_DURATION_MINUTES = 10080;

export class PollEngine {
  constructor(private pollAccessor: PollAccessor) {}

  async createPoll(request: CreatePollRequest): Promise<CreatePollResponse> {
    const durationMinutes = request.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    if (request.options.length < MIN_OPTIONS || request.options.length > MAX_OPTIONS) {
      throw new Error(`Polls must have between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`);
    }

    if (request.question.length > MAX_QUESTION_LENGTH) {
      throw new Error(`Question must be ${MAX_QUESTION_LENGTH} characters or fewer.`);
    }

    if (durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES) {
      throw new Error(`Duration must be between 1 and ${MAX_DURATION_MINUTES} minutes.`);
    }

    const now = Date.now();
    const closesAt = now + durationMinutes * 60 * 1000;

    const { id } = await this.pollAccessor.createPoll(
      request.guildId,
      request.channelId,
      request.creatorId,
      request.question,
      request.options,
      closesAt,
      now,
    );

    return {
      pollId: id,
      question: request.question,
      options: request.options,
      closesAt,
    };
  }

  async setPollMessageId(pollId: number, messageId: string): Promise<void> {
    await this.pollAccessor.setPollMessageId(pollId, messageId);
  }

  async castVote(request: CastVoteRequest): Promise<CastVoteResponse> {
    const poll = await this.pollAccessor.getPoll(request.pollId);

    if (!poll) {
      return { success: false, reason: "poll_not_found" };
    }

    if (poll.status !== "open") {
      return { success: false, reason: "poll_closed" };
    }

    const options: string[] = JSON.parse(poll.options);
    if (request.optionIndex < 0 || request.optionIndex >= options.length) {
      return { success: false, reason: "invalid_option" };
    }

    const hadPreviousVote = await this.pollAccessor.upsertVote(
      request.pollId,
      request.userId,
      request.optionIndex,
    );

    return {
      success: true,
      reason: hadPreviousVote ? "changed" : "voted",
    };
  }

  async closePoll(request: ClosePollRequest): Promise<ClosePollResponse> {
    const poll = await this.pollAccessor.getPoll(request.pollId);

    if (!poll) {
      return { success: false, reason: "not_found", results: null };
    }

    if (poll.status !== "open") {
      return { success: false, reason: "already_closed", results: null };
    }

    if (poll.creatorId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "not_authorized", results: null };
    }

    await this.pollAccessor.closePoll(request.pollId);

    const results = await this.getPollResults({ pollId: request.pollId });
    return { success: true, reason: "closed", results };
  }

  async getPollResults(request: GetPollResultsRequest): Promise<PollResults | null> {
    const poll = await this.pollAccessor.getPoll(request.pollId);
    if (!poll) return null;

    const options: string[] = JSON.parse(poll.options);
    const rawCounts = await this.pollAccessor.getVoteCounts(request.pollId);

    const voteCounts = new Array<number>(options.length).fill(0);
    for (const row of rawCounts) {
      voteCounts[row.optionIndex] = row.count;
    }

    const totalVotes = voteCounts.reduce((sum, c) => sum + c, 0);

    return {
      pollId: poll.id,
      question: poll.question,
      options,
      voteCounts,
      totalVotes,
      status: poll.status as "open" | "closed",
      closesAt: poll.closesAt,
    };
  }

  async closeExpiredPolls(): Promise<{ id: number; channelId: string; messageId: string }[]> {
    const now = Date.now();
    const expired = await this.pollAccessor.getOpenPollsDueBefore(now);

    for (const poll of expired) {
      await this.pollAccessor.closePoll(poll.id);
    }

    return expired;
  }
}
