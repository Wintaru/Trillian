import { eq, and, sql, desc, like, or, lte, ne } from "drizzle-orm";
import { db } from "./database.js";
import {
  libraryBooks,
  libraryEntries,
  libraryBorrows,
  libraryReviews,
  libraryWishlist,
} from "../db/schema.js";

// --- Row types ---

export interface BookRow {
  id: number;
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  pageCount: number;
  publishYear: number;
  genres: string;
  createdAt: number;
}

export interface EntryWithBookRow {
  entryId: number;
  bookId: number;
  guildId: string;
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  pageCount: number;
  publishYear: number;
  genres: string;
  ownerId: string;
  condition: string;
  availabilityType: string;
  status: string;
  note: string;
  addedAt: number;
}

export interface BorrowRow {
  id: number;
  libraryEntryId: number;
  borrowerId: string;
  status: string;
  borrowedAt: number;
  approvedAt: number | null;
  dueDate: number | null;
  returnedAt: number | null;
  lastReminderAt: number | null;
}

export interface BorrowDetailRow {
  borrowId: number;
  entryId: number;
  title: string;
  author: string;
  coverUrl: string;
  ownerId: string;
  borrowerId: string;
  status: string;
  borrowedAt: number;
  approvedAt: number | null;
  dueDate: number | null;
  returnedAt: number | null;
  lastReminderAt: number | null;
}

export interface ReviewRow {
  id: number;
  bookId: number;
  userId: string;
  rating: number;
  review: string;
  createdAt: number;
}

export interface WishRow {
  id: number;
  guildId: string;
  userId: string;
  isbn: string | null;
  title: string;
  author: string;
  addedAt: number;
}

// --- Select helpers ---

const entryWithBookSelect = {
  entryId: libraryEntries.id,
  bookId: libraryBooks.id,
  guildId: libraryEntries.guildId,
  isbn: libraryBooks.isbn,
  title: libraryBooks.title,
  author: libraryBooks.author,
  coverUrl: libraryBooks.coverUrl,
  description: libraryBooks.description,
  pageCount: libraryBooks.pageCount,
  publishYear: libraryBooks.publishYear,
  genres: libraryBooks.genres,
  ownerId: libraryEntries.ownerId,
  condition: libraryEntries.condition,
  availabilityType: libraryEntries.availabilityType,
  status: libraryEntries.status,
  note: libraryEntries.note,
  addedAt: libraryEntries.addedAt,
};

const borrowDetailSelect = {
  borrowId: libraryBorrows.id,
  entryId: libraryEntries.id,
  title: libraryBooks.title,
  author: libraryBooks.author,
  coverUrl: libraryBooks.coverUrl,
  ownerId: libraryEntries.ownerId,
  borrowerId: libraryBorrows.borrowerId,
  status: libraryBorrows.status,
  borrowedAt: libraryBorrows.borrowedAt,
  approvedAt: libraryBorrows.approvedAt,
  dueDate: libraryBorrows.dueDate,
  returnedAt: libraryBorrows.returnedAt,
  lastReminderAt: libraryBorrows.lastReminderAt,
};

export class LibraryAccessor {
  // --- Books (shared metadata) ---

  async findBookByIsbn(isbn: string): Promise<BookRow | null> {
    const rows = await db
      .select()
      .from(libraryBooks)
      .where(eq(libraryBooks.isbn, isbn))
      .limit(1);
    return (rows[0] as BookRow | undefined) ?? null;
  }

  async insertBook(data: {
    isbn: string;
    title: string;
    author: string;
    coverUrl: string;
    description: string;
    pageCount: number;
    publishYear: number;
    genres: string;
    createdAt: number;
  }): Promise<{ id: number }> {
    const result = await db
      .insert(libraryBooks)
      .values(data)
      .onConflictDoNothing()
      .returning({ id: libraryBooks.id });
    if (result.length === 0) {
      // Already exists — fetch it
      const existing = await this.findBookByIsbn(data.isbn);
      return { id: existing!.id };
    }
    return result[0]!;
  }

  // --- Library Entries ---

  async insertEntry(data: {
    bookId: number;
    guildId: string;
    ownerId: string;
    condition: string;
    availabilityType: string;
    note: string;
    addedAt: number;
    updatedAt: number;
  }): Promise<{ id: number }> {
    const result = await db
      .insert(libraryEntries)
      .values(data)
      .returning({ id: libraryEntries.id });
    return result[0]!;
  }

  async getEntryWithBook(entryId: number): Promise<EntryWithBookRow | null> {
    const rows = await db
      .select(entryWithBookSelect)
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(eq(libraryEntries.id, entryId))
      .limit(1);
    return (rows[0] as EntryWithBookRow | undefined) ?? null;
  }

  async updateEntry(
    entryId: number,
    data: Partial<{ condition: string; availabilityType: string; status: string; note: string; updatedAt: number }>,
  ): Promise<void> {
    await db.update(libraryEntries).set(data).where(eq(libraryEntries.id, entryId));
  }

  async deleteEntry(entryId: number): Promise<boolean> {
    const result = await db
      .delete(libraryEntries)
      .where(eq(libraryEntries.id, entryId))
      .returning({ id: libraryEntries.id });
    return result.length > 0;
  }

  async hasEntryByOwnerAndIsbn(guildId: string, ownerId: string, isbn: string): Promise<boolean> {
    const rows = await db
      .select({ id: libraryEntries.id })
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          eq(libraryEntries.ownerId, ownerId),
          eq(libraryBooks.isbn, isbn),
          ne(libraryEntries.status, "given_away"),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async listAvailableEntries(
    guildId: string,
    limit: number,
    offset: number,
  ): Promise<EntryWithBookRow[]> {
    return db
      .select(entryWithBookSelect)
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
        ),
      )
      .orderBy(desc(libraryEntries.addedAt))
      .limit(limit)
      .offset(offset) as Promise<EntryWithBookRow[]>;
  }

  async countAvailableEntries(guildId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
        ),
      );
    return Number(rows[0]!.count);
  }

  async searchEntries(
    guildId: string,
    query: string,
    limit: number,
    offset: number,
  ): Promise<EntryWithBookRow[]> {
    const pattern = `%${query}%`;
    return db
      .select(entryWithBookSelect)
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
          or(
            like(libraryBooks.title, pattern),
            like(libraryBooks.author, pattern),
          ),
        ),
      )
      .orderBy(desc(libraryEntries.addedAt))
      .limit(limit)
      .offset(offset) as Promise<EntryWithBookRow[]>;
  }

  async countSearchResults(guildId: string, query: string): Promise<number> {
    const pattern = `%${query}%`;
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
          or(
            like(libraryBooks.title, pattern),
            like(libraryBooks.author, pattern),
          ),
        ),
      );
    return Number(rows[0]!.count);
  }

  async getEntriesByOwner(
    guildId: string,
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<EntryWithBookRow[]> {
    return db
      .select(entryWithBookSelect)
      .from(libraryEntries)
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          eq(libraryEntries.ownerId, ownerId),
          ne(libraryEntries.status, "given_away"),
        ),
      )
      .orderBy(desc(libraryEntries.addedAt))
      .limit(limit)
      .offset(offset) as Promise<EntryWithBookRow[]>;
  }

  async countEntriesByOwner(guildId: string, ownerId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          eq(libraryEntries.ownerId, ownerId),
          ne(libraryEntries.status, "given_away"),
        ),
      );
    return Number(rows[0]!.count);
  }

  // --- Borrows ---

  async insertBorrow(data: {
    libraryEntryId: number;
    borrowerId: string;
    status: string;
    borrowedAt: number;
  }): Promise<{ id: number }> {
    const result = await db
      .insert(libraryBorrows)
      .values(data)
      .returning({ id: libraryBorrows.id });
    return result[0]!;
  }

  async getBorrow(borrowId: number): Promise<BorrowRow | null> {
    const rows = await db
      .select()
      .from(libraryBorrows)
      .where(eq(libraryBorrows.id, borrowId))
      .limit(1);
    return (rows[0] as BorrowRow | undefined) ?? null;
  }

  async getBorrowWithDetails(borrowId: number): Promise<BorrowDetailRow | null> {
    const rows = await db
      .select(borrowDetailSelect)
      .from(libraryBorrows)
      .innerJoin(libraryEntries, eq(libraryBorrows.libraryEntryId, libraryEntries.id))
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(eq(libraryBorrows.id, borrowId))
      .limit(1);
    return (rows[0] as BorrowDetailRow | undefined) ?? null;
  }

  async updateBorrow(
    borrowId: number,
    data: Partial<{
      status: string;
      approvedAt: number | null;
      dueDate: number | null;
      returnedAt: number | null;
      lastReminderAt: number | null;
    }>,
  ): Promise<void> {
    await db.update(libraryBorrows).set(data).where(eq(libraryBorrows.id, borrowId));
  }

  async getActiveBorrowForEntry(entryId: number): Promise<BorrowRow | null> {
    const rows = await db
      .select()
      .from(libraryBorrows)
      .where(
        and(
          eq(libraryBorrows.libraryEntryId, entryId),
          eq(libraryBorrows.status, "active"),
        ),
      )
      .limit(1);
    return (rows[0] as BorrowRow | undefined) ?? null;
  }

  async getPendingBorrowsForEntry(entryId: number): Promise<BorrowRow[]> {
    return db
      .select()
      .from(libraryBorrows)
      .where(
        and(
          eq(libraryBorrows.libraryEntryId, entryId),
          eq(libraryBorrows.status, "pending"),
        ),
      ) as Promise<BorrowRow[]>;
  }

  async hasPendingOrActiveBorrow(entryId: number, borrowerId: string): Promise<boolean> {
    const rows = await db
      .select({ id: libraryBorrows.id })
      .from(libraryBorrows)
      .where(
        and(
          eq(libraryBorrows.libraryEntryId, entryId),
          eq(libraryBorrows.borrowerId, borrowerId),
          or(
            eq(libraryBorrows.status, "pending"),
            eq(libraryBorrows.status, "active"),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async getOverdueBorrows(now: number, reminderCooldownMs: number): Promise<BorrowDetailRow[]> {
    const cooldownThreshold = now - reminderCooldownMs;
    return db
      .select(borrowDetailSelect)
      .from(libraryBorrows)
      .innerJoin(libraryEntries, eq(libraryBorrows.libraryEntryId, libraryEntries.id))
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryBorrows.status, "active"),
          lte(libraryBorrows.dueDate, now),
          or(
            sql`${libraryBorrows.lastReminderAt} IS NULL`,
            lte(libraryBorrows.lastReminderAt, cooldownThreshold),
          ),
        ),
      ) as Promise<BorrowDetailRow[]>;
  }

  // --- Reviews ---

  async upsertReview(data: {
    bookId: number;
    guildId: string;
    userId: string;
    rating: number;
    review: string;
    createdAt: number;
  }): Promise<"reviewed" | "updated"> {
    const existing = await db
      .select({ id: libraryReviews.id })
      .from(libraryReviews)
      .where(
        and(
          eq(libraryReviews.bookId, data.bookId),
          eq(libraryReviews.guildId, data.guildId),
          eq(libraryReviews.userId, data.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(libraryReviews)
        .set({ rating: data.rating, review: data.review, createdAt: data.createdAt })
        .where(eq(libraryReviews.id, existing[0]!.id));
      return "updated";
    }

    await db.insert(libraryReviews).values(data);
    return "reviewed";
  }

  async getReviewsForBook(bookId: number, guildId: string): Promise<ReviewRow[]> {
    return db
      .select({
        id: libraryReviews.id,
        bookId: libraryReviews.bookId,
        userId: libraryReviews.userId,
        rating: libraryReviews.rating,
        review: libraryReviews.review,
        createdAt: libraryReviews.createdAt,
      })
      .from(libraryReviews)
      .where(
        and(
          eq(libraryReviews.bookId, bookId),
          eq(libraryReviews.guildId, guildId),
        ),
      )
      .orderBy(desc(libraryReviews.createdAt)) as Promise<ReviewRow[]>;
  }

  async getAverageRating(
    bookId: number,
    guildId: string,
  ): Promise<{ avg: number; count: number }> {
    const rows = await db
      .select({
        avg: sql<number>`coalesce(avg(${libraryReviews.rating}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(libraryReviews)
      .where(
        and(
          eq(libraryReviews.bookId, bookId),
          eq(libraryReviews.guildId, guildId),
        ),
      );
    return { avg: Number(rows[0]!.avg), count: Number(rows[0]!.count) };
  }

  // --- Wishlist ---

  async insertWish(data: {
    guildId: string;
    userId: string;
    isbn: string | null;
    title: string;
    author: string;
    addedAt: number;
  }): Promise<boolean> {
    const result = await db
      .insert(libraryWishlist)
      .values(data)
      .onConflictDoNothing()
      .returning({ id: libraryWishlist.id });
    return result.length > 0;
  }

  async removeWish(wishId: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(libraryWishlist)
      .where(
        and(
          eq(libraryWishlist.id, wishId),
          eq(libraryWishlist.userId, userId),
        ),
      )
      .returning({ id: libraryWishlist.id });
    return result.length > 0;
  }

  async getWishlistByUser(guildId: string, userId: string): Promise<WishRow[]> {
    return db
      .select()
      .from(libraryWishlist)
      .where(
        and(
          eq(libraryWishlist.guildId, guildId),
          eq(libraryWishlist.userId, userId),
        ),
      )
      .orderBy(desc(libraryWishlist.addedAt)) as Promise<WishRow[]>;
  }

  async getWishlistMatchesByIsbn(guildId: string, isbn: string): Promise<WishRow[]> {
    return db
      .select()
      .from(libraryWishlist)
      .where(
        and(
          eq(libraryWishlist.guildId, guildId),
          eq(libraryWishlist.isbn, isbn),
        ),
      ) as Promise<WishRow[]>;
  }

  // --- Stats ---

  async getMostBorrowed(
    guildId: string,
    limit: number,
  ): Promise<{ title: string; author: string; count: number }[]> {
    return db
      .select({
        title: libraryBooks.title,
        author: libraryBooks.author,
        count: sql<number>`count(*)`,
      })
      .from(libraryBorrows)
      .innerJoin(libraryEntries, eq(libraryBorrows.libraryEntryId, libraryEntries.id))
      .innerJoin(libraryBooks, eq(libraryEntries.bookId, libraryBooks.id))
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          or(
            eq(libraryBorrows.status, "active"),
            eq(libraryBorrows.status, "returned"),
          ),
        ),
      )
      .groupBy(libraryBooks.id)
      .orderBy(desc(sql`count(*)`))
      .limit(limit) as Promise<{ title: string; author: string; count: number }[]>;
  }

  async getMostActiveLenders(
    guildId: string,
    limit: number,
  ): Promise<{ ownerId: string; count: number }[]> {
    return db
      .select({
        ownerId: libraryEntries.ownerId,
        count: sql<number>`count(*)`,
      })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
        ),
      )
      .groupBy(libraryEntries.ownerId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit) as Promise<{ ownerId: string; count: number }[]>;
  }

  async getGenreBreakdown(
    guildId: string,
  ): Promise<{ genre: string; count: number }[]> {
    // Genres are stored as JSON arrays — we need to extract individual genres
    // SQLite json_each lets us unnest the JSON array
    return db.all(sql`
      SELECT je.value AS genre, COUNT(*) AS count
      FROM ${libraryEntries}
      INNER JOIN ${libraryBooks} ON ${libraryEntries.bookId} = ${libraryBooks.id}
      CROSS JOIN json_each(${libraryBooks.genres}) AS je
      WHERE ${libraryEntries.guildId} = ${guildId}
        AND ${libraryEntries.status} != 'given_away'
        AND je.value != ''
      GROUP BY je.value
      ORDER BY count DESC
      LIMIT 10
    `) as unknown as Promise<{ genre: string; count: number }[]>;
  }

  async getTotalBooks(guildId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.guildId, guildId),
          ne(libraryEntries.status, "given_away"),
        ),
      );
    return Number(rows[0]!.count);
  }

  async getTotalBorrows(guildId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(libraryBorrows)
      .innerJoin(libraryEntries, eq(libraryBorrows.libraryEntryId, libraryEntries.id))
      .where(eq(libraryEntries.guildId, guildId));
    return Number(rows[0]!.count);
  }
}
