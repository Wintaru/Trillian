/**
 * Reports who hasn't rated (or hasn't finished rating) in the current listening round.
 * Run with: pnpm tsx scripts/rating-status.ts
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, or } from "drizzle-orm";
import * as schema from "../src/db/schema.js";

const sqlite = new Database("data/bot.db");
const db = drizzle(sqlite, { schema });

// Find the active listening round
const [round] = await db
  .select()
  .from(schema.musicClubRounds)
  .where(
    and(
      or(
        eq(schema.musicClubRounds.status, "listening"),
        eq(schema.musicClubRounds.status, "open"),
      ),
    ),
  )
  .orderBy(schema.musicClubRounds.id)
  .limit(1);

if (!round) {
  console.log("No active round found.");
  sqlite.close();
  process.exit(0);
}

console.log(`\nRound #${round.id} — status: ${round.status}`);
console.log(`Ratings close: ${new Date(round.ratingsCloseAt).toLocaleString()}\n`);

if (round.status !== "listening") {
  console.log("Round is not in listening phase yet — no ratings expected.");
  sqlite.close();
  process.exit(0);
}

// Get songs (submitters) and ratings for this round
const songs = await db
  .select()
  .from(schema.musicClubSongs)
  .where(eq(schema.musicClubSongs.roundId, round.id));

const submitterIds = new Set(songs.map((s) => s.userId));

const ratings = await db
  .select()
  .from(schema.musicClubRatings)
  .innerJoin(schema.musicClubSongs, eq(schema.musicClubRatings.songId, schema.musicClubSongs.id))
  .where(eq(schema.musicClubSongs.roundId, round.id));

// Build a set of (userId, songId) pairs that have been rated
const ratedPairs = new Set(ratings.map((r) => `${r.music_club_ratings.userId}:${r.music_club_ratings.songId}`));

// Only submitters are expected to rate (each rates every song except their own)
const rows: { userId: string; needed: number; done: number }[] = [];

for (const submitterId of submitterIds) {
  const songsToRate = songs.filter((s) => s.userId !== submitterId);
  const done = songsToRate.filter((s) => ratedPairs.has(`${submitterId}:${s.id}`)).length;
  rows.push({ userId: submitterId, needed: songsToRate.length, done });
}

rows.sort((a, b) => a.done - b.done);

const notStarted = rows.filter((r) => r.done === 0);
const inProgress = rows.filter((r) => r.done > 0 && r.done < r.needed);
const finished = rows.filter((r) => r.done >= r.needed && r.needed > 0);

console.log(`Submitters: ${submitterIds.size}  |  Songs this round: ${songs.length}\n`);

if (notStarted.length > 0) {
  console.log(`--- Haven't rated at all (${notStarted.length}) ---`);
  for (const r of notStarted) {
    console.log(`  <@${r.userId}>  (0 / ${r.needed})`);
  }
  console.log();
}

if (inProgress.length > 0) {
  console.log(`--- Partially rated (${inProgress.length}) ---`);
  for (const r of inProgress) {
    console.log(`  <@${r.userId}>  (${r.done} / ${r.needed})`);
  }
  console.log();
}

if (finished.length > 0) {
  console.log(`--- Finished (${finished.length}) ---`);
  for (const r of finished) {
    console.log(`  <@${r.userId}>  (${r.done} / ${r.needed})`);
  }
  console.log();
}

sqlite.close();
