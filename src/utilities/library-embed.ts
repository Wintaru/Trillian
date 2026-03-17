import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import type {
  LibraryEntryView,
  BookInfoResponse,
  StatsResponse,
  WishlistEntry,
  BookReviewView,
} from "../types/library-contracts.js";

/** Create an AttachmentBuilder from a cover image buffer, or null if no image. */
export function coverAttachment(image: Buffer | null): AttachmentBuilder | null {
  if (!image) return null;
  return new AttachmentBuilder(image, { name: "cover.jpg" });
}

const COVER_ATTACHMENT_URL = "attachment://cover.jpg";

const EMBED_COLOR = 0x8b4513; // saddlebrown
const FIELD_MAX_LENGTH = 1024;
const DESC_MAX_LIST = 256;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  lend: "Available to Lend",
  give: "Free to Take",
  reference: "Reference Only",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  lent: "Checked Out",
  given_away: "Given Away",
};

function starRating(rating: number): string {
  const full = Math.round(rating);
  return "\u2605".repeat(full) + "\u2606".repeat(5 - full);
}

function formatCondition(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

function formatAvailability(type: string): string {
  return AVAILABILITY_LABELS[type] ?? type;
}

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function footerText(
  page: number,
  totalPages: number,
  total: number,
  noun: string,
  nextHint: string,
): string {
  const base = `Page ${page}/${totalPages} \u00b7 ${total} ${noun}${total === 1 ? "" : "s"}`;
  if (page < totalPages) {
    return `${base} \u00b7 ${nextHint}${page + 1} for next page`;
  }
  return base;
}

// --- Book Info (detailed) ---

export function buildBookInfoEmbed(
  response: BookInfoResponse,
  reviews: BookReviewView[],
): EmbedBuilder {
  const entry = response.entry!;
  const embed = new EmbedBuilder()
    .setTitle(`${entry.title}`)
    .setColor(EMBED_COLOR)
    .setDescription(truncate(entry.description || "No description available.", FIELD_MAX_LENGTH));

  if (entry.coverImage) {
    embed.setImage(COVER_ATTACHMENT_URL);
  } else if (entry.coverUrl) {
    embed.setImage(entry.coverUrl);
  }

  embed.addFields(
    { name: "Author", value: entry.author || "Unknown", inline: true },
    { name: "ISBN", value: entry.isbn, inline: true },
    { name: "Entry ID", value: `#${entry.entryId}`, inline: true },
  );

  if (entry.publishYear > 0 || entry.pageCount > 0) {
    const details: string[] = [];
    if (entry.publishYear > 0) details.push(`Published: ${entry.publishYear}`);
    if (entry.pageCount > 0) details.push(`${entry.pageCount} pages`);
    embed.addFields({ name: "Details", value: details.join(" \u00b7 "), inline: false });
  }

  if (entry.genres.length > 0) {
    embed.addFields({ name: "Genres", value: entry.genres.join(", "), inline: false });
  }

  embed.addFields(
    { name: "Owner", value: `<@${entry.ownerId}>`, inline: true },
    { name: "Condition", value: formatCondition(entry.condition), inline: true },
    { name: "Availability", value: formatAvailability(entry.availabilityType), inline: true },
    { name: "Status", value: formatStatus(entry.status), inline: true },
  );

  if (entry.note) {
    embed.addFields({ name: "Note from Owner", value: truncate(entry.note, FIELD_MAX_LENGTH), inline: false });
  }

  // Rating
  if (response.ratingCount && response.ratingCount > 0) {
    embed.addFields({
      name: "Rating",
      value: `${starRating(response.averageRating!)} (${response.averageRating!.toFixed(1)}/5 from ${response.ratingCount} review${response.ratingCount === 1 ? "" : "s"})`,
      inline: false,
    });
  }

  // Active borrow
  if (response.activeBorrow) {
    const b = response.activeBorrow;
    let borrowText = `Borrowed by <@${b.borrowerId}>`;
    if (b.dueDate) {
      borrowText += ` \u00b7 Due: <t:${Math.floor(b.dueDate / 1000)}:D>`;
    }
    embed.addFields({ name: "Current Borrow", value: borrowText, inline: false });
  }

  // Pending borrows
  if (response.pendingBorrows && response.pendingBorrows.length > 0) {
    const pending = response.pendingBorrows
      .map((b) => `<@${b.borrowerId}> (requested <t:${Math.floor(b.borrowedAt / 1000)}:R>)`)
      .join("\n");
    embed.addFields({ name: "Pending Requests", value: truncate(pending, FIELD_MAX_LENGTH), inline: false });
  }

  // Reviews
  if (reviews.length > 0) {
    const reviewText = reviews
      .slice(0, 3)
      .map((r) => {
        const stars = starRating(r.rating);
        const text = r.review ? ` — ${truncate(r.review, 200)}` : "";
        return `${stars} <@${r.userId}>${text}`;
      })
      .join("\n");
    embed.addFields({
      name: `Reviews${reviews.length > 3 ? ` (showing 3 of ${reviews.length})` : ""}`,
      value: reviewText,
      inline: false,
    });
  }

  return embed;
}

// --- List / Search / Shelf ---

function entryLine(entry: LibraryEntryView): string {
  const status = entry.status === "lent" ? " [Lent]" : "";
  const availability = entry.availabilityType === "give" ? " [Free]" : "";
  const condition = ` (${formatCondition(entry.condition)})`;
  return `**#${entry.entryId}** — *${entry.title}* by ${entry.author}${condition}${availability}${status}`;
}

/**
 * Set the thumbnail from the first entry that has a cover image.
 * Returns an AttachmentBuilder if using a stored image, or null if using a URL.
 */
export function listCoverAttachment(entries: LibraryEntryView[]): AttachmentBuilder | null {
  const firstWithImage = entries.find((e) => e.coverImage);
  if (firstWithImage) return coverAttachment(firstWithImage.coverImage);
  return null;
}

function setFirstCoverThumbnail(embed: EmbedBuilder, entries: LibraryEntryView[]): void {
  const firstWithImage = entries.find((e) => e.coverImage);
  if (firstWithImage) {
    embed.setThumbnail(COVER_ATTACHMENT_URL);
    return;
  }
  const firstWithUrl = entries.find((e) => e.coverUrl);
  if (firstWithUrl) embed.setThumbnail(firstWithUrl.coverUrl);
}

export function buildListEmbed(
  entries: LibraryEntryView[],
  page: number,
  totalPages: number,
  total: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Community Library")
    .setColor(EMBED_COLOR)
    .setFooter({ text: footerText(page, totalPages, total, "book", "/library list page:") });

  if (entries.length === 0) {
    embed.setDescription("The library is empty. Use `/library add` to share a book!");
  } else {
    embed.setDescription(entries.map(entryLine).join("\n"));
    setFirstCoverThumbnail(embed, entries);
  }

  return embed;
}

export function buildSearchEmbed(
  entries: LibraryEntryView[],
  query: string,
  page: number,
  totalPages: number,
  total: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Search: "${query}"`)
    .setColor(EMBED_COLOR)
    .setFooter({
      text: footerText(page, totalPages, total, "result", `/library search ${query} page:`),
    });

  if (entries.length === 0) {
    embed.setDescription(`No books found matching "${query}".`);
  } else {
    embed.setDescription(entries.map(entryLine).join("\n"));
    setFirstCoverThumbnail(embed, entries);
  }

  return embed;
}

export function buildShelfEmbed(
  entries: LibraryEntryView[],
  ownerId: string,
  page: number,
  totalPages: number,
  total: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Bookshelf")
    .setDescription(entries.length > 0 ? entries.map(entryLine).join("\n") : "No books on this shelf.")
    .setColor(EMBED_COLOR)
    .setFooter({
      text: footerText(page, totalPages, total, "book", `/library shelf <@${ownerId}> page:`),
    });

  if (entries.length > 0) setFirstCoverThumbnail(embed, entries);

  return embed;
}

// --- Wishlist ---

export function buildWishlistEmbed(entries: WishlistEntry[], userId: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Your Wishlist")
    .setColor(EMBED_COLOR);

  if (entries.length === 0) {
    embed.setDescription("Your wishlist is empty. Use `/library wishlist add` to add a book!");
  } else {
    const lines = entries.map((e, i) => {
      const isbn = e.isbn ? ` (ISBN: ${e.isbn})` : "";
      return `**${i + 1}.** *${e.title || "Unknown"}* by ${e.author || "Unknown"}${isbn} — ID: ${e.id}`;
    });
    embed.setDescription(lines.join("\n"));
  }

  return embed;
}

// --- Stats ---

export function buildStatsEmbed(stats: StatsResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Library Statistics")
    .setColor(EMBED_COLOR)
    .addFields(
      { name: "Total Books", value: `${stats.totalBooks}`, inline: true },
      { name: "Total Borrows", value: `${stats.totalBorrows}`, inline: true },
    );

  if (stats.mostBorrowed.length > 0) {
    const lines = stats.mostBorrowed.map(
      (b, i) => `**${i + 1}.** *${b.title}* by ${b.author} (${b.count} borrow${b.count === 1 ? "" : "s"})`,
    );
    embed.addFields({ name: "Most Borrowed", value: lines.join("\n"), inline: false });
  }

  if (stats.topLenders.length > 0) {
    const lines = stats.topLenders.map(
      (l, i) => `**${i + 1}.** <@${l.ownerId}> (${l.count} book${l.count === 1 ? "" : "s"})`,
    );
    embed.addFields({ name: "Top Lenders", value: lines.join("\n"), inline: false });
  }

  if (stats.genreBreakdown.length > 0) {
    const lines = stats.genreBreakdown.map(
      (g) => `${g.genre}: ${g.count}`,
    );
    embed.addFields({ name: "Genres", value: lines.join("\n"), inline: false });
  }

  return embed;
}

// --- Help ---

export function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Community Library")
    .setColor(EMBED_COLOR)
    .setDescription(
      "Share and borrow books with your community! Add books by ISBN or bookstore URL.\n\n" +
      "**Subcommands:**\n" +
      "`add <isbn_or_url> [condition] [availability] [note]` — Add a book\n" +
      "`remove <entry_id>` — Remove your book\n" +
      "`list [page]` — Browse all books\n" +
      "`search <query> [page]` — Search by title or author\n" +
      "`shelf [@user] [page]` — View someone's shared books\n" +
      "`info <entry_id>` — Detailed book info\n" +
      "`borrow <entry_id>` — Request to borrow\n" +
      "`wishlist <add|remove|list> [isbn_or_title]` — Manage your wishlist\n" +
      "`review <isbn_or_url> <rating 1-5> [text]` — Rate/review a book\n" +
      "`stats` — Library statistics\n\n" +
      "**Conditions:** like_new, good, fair, poor\n" +
      "**Availability types:** lend (borrowable), give (free to take), reference (not lending)\n\n" +
      "**Tips:**\n" +
      "- You can paste an Amazon, Barnes & Noble, or Open Library URL instead of an ISBN\n" +
      "- Borrow requests are sent to the owner via DM with Approve/Deny buttons\n" +
      "- Use `info` to see action buttons (borrow, return, edit note)\n" +
      "- Add books to your wishlist to get notified when someone shares them",
    );
}

// --- Add Book Success ---

export function buildAddedBookEmbed(entry: LibraryEntryView): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Book Added to Library!")
    .setColor(EMBED_COLOR)
    .setDescription(`**${entry.title}** by ${entry.author}`)
    .addFields(
      { name: "Entry ID", value: `#${entry.entryId}`, inline: true },
      { name: "ISBN", value: entry.isbn, inline: true },
      { name: "Condition", value: formatCondition(entry.condition), inline: true },
      { name: "Availability", value: formatAvailability(entry.availabilityType), inline: true },
    );

  if (entry.coverImage) {
    embed.setImage(COVER_ATTACHMENT_URL);
  } else if (entry.coverUrl) {
    embed.setImage(entry.coverUrl);
  }
  if (entry.note) embed.addFields({ name: "Note", value: truncate(entry.note, FIELD_MAX_LENGTH), inline: false });

  return embed;
}
