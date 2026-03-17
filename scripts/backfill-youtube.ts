/**
 * One-time script to backfill YouTube links for existing music club songs.
 * Re-fetches Odesli data and falls back to YouTube Data API search.
 *
 * Usage: npx tsx scripts/backfill-youtube.ts
 */

import "dotenv/config";
import { db } from "../src/accessors/database.js";
import { musicClubSongs } from "../src/db/schema.js";
import { OdesliAccessor } from "../src/accessors/odesli-accessor.js";
import { YouTubeAccessor } from "../src/accessors/youtube-accessor.js";
import type { OdesliLinks } from "../src/types/music-club-contracts.js";
import { eq } from "drizzle-orm";

const googleApiKey = process.env["GOOGLE_API_KEY"];
if (!googleApiKey) {
  console.error("GOOGLE_API_KEY is required in .env");
  process.exit(1);
}

const odesli = new OdesliAccessor();
const youtube = new YouTubeAccessor(googleApiKey);

const songs = await db.select().from(musicClubSongs);
console.log(`Found ${songs.length} songs to process.\n`);

for (const song of songs) {
  let links: OdesliLinks;
  try {
    links = JSON.parse(song.odesliData) as OdesliLinks;
  } catch {
    links = { pageUrl: "" };
  }

  if (links.youtube) {
    console.log(`✓ ${song.title} — ${song.artist} (already has YouTube)`);
    continue;
  }

  // Try Odesli first (it may have YouTube now even if it didn't before)
  const odesliResult = await odesli.getLinks(song.originalUrl);
  if (odesliResult?.links.youtube) {
    links.youtube = odesliResult.links.youtube;
    console.log(`✓ ${song.title} — ${song.artist} (YouTube from Odesli)`);
  } else {
    // Fall back to YouTube search
    const query = [song.title, song.artist].filter(Boolean).join(" - ");
    if (query) {
      const youtubeUrl = await youtube.searchVideo(query);
      if (youtubeUrl) {
        links.youtube = youtubeUrl;
        console.log(`✓ ${song.title} — ${song.artist} (YouTube from search)`);
      } else {
        console.log(`✗ ${song.title} — ${song.artist} (no YouTube found)`);
        continue;
      }
    } else {
      console.log(`✗ Song #${song.id} — no title/artist to search`);
      continue;
    }
  }

  // Also backfill any other missing platform links from Odesli
  if (odesliResult) {
    if (!links.spotify && odesliResult.links.spotify) links.spotify = odesliResult.links.spotify;
    if (!links.appleMusic && odesliResult.links.appleMusic) links.appleMusic = odesliResult.links.appleMusic;
    if (!links.tidal && odesliResult.links.tidal) links.tidal = odesliResult.links.tidal;
    if (!links.pageUrl && odesliResult.links.pageUrl) links.pageUrl = odesliResult.links.pageUrl;
  }

  await db
    .update(musicClubSongs)
    .set({ odesliData: JSON.stringify(links) })
    .where(eq(musicClubSongs.id, song.id));
}

console.log("\nDone!");
process.exit(0);
