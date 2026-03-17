import type { LibraryAccessor, EntryWithBookRow } from "../accessors/library-accessor.js";
import type { OpenLibraryAccessor } from "../accessors/open-library-accessor.js";
import { extractIsbn } from "../accessors/open-library-accessor.js";
import type {
  AddBookRequest,
  AddBookResponse,
  RemoveBookRequest,
  RemoveBookResponse,
  ListBooksRequest,
  ListBooksResponse,
  SearchBooksRequest,
  SearchBooksResponse,
  ShelfRequest,
  ShelfResponse,
  BookInfoRequest,
  BookInfoResponse,
  BorrowRequest,
  BorrowResponse,
  ApproveBorrowRequest,
  ApproveBorrowResponse,
  ReturnBookRequest,
  ReturnBookResponse,
  UpdateNoteRequest,
  UpdateNoteResponse,
  WishlistAddRequest,
  WishlistRemoveRequest,
  WishlistListRequest,
  WishlistResponse,
  ReviewRequest,
  ReviewResponse,
  StatsRequest,
  StatsResponse,
  LibraryEntryView,
  BorrowDetailView,
  BookCondition,
  AvailabilityType,
  EntryStatus,
  BorrowStatus,
} from "../types/library-contracts.js";
import * as logger from "../utilities/logger.js";

function toEntryView(row: EntryWithBookRow): LibraryEntryView {
  return {
    entryId: row.entryId,
    bookId: row.bookId,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    coverUrl: row.coverUrl,
    coverImage: row.coverImage ?? null,
    description: row.description,
    pageCount: row.pageCount,
    publishYear: row.publishYear,
    genres: JSON.parse(row.genres) as string[],
    ownerId: row.ownerId,
    condition: row.condition as BookCondition,
    availabilityType: row.availabilityType as AvailabilityType,
    status: row.status as EntryStatus,
    note: row.note,
    addedAt: row.addedAt,
  };
}

function toBorrowDetailView(row: {
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
}): BorrowDetailView {
  return {
    borrowId: row.borrowId,
    entryId: row.entryId,
    title: row.title,
    author: row.author,
    coverUrl: row.coverUrl,
    ownerId: row.ownerId,
    borrowerId: row.borrowerId,
    status: row.status as BorrowStatus,
    borrowedAt: row.borrowedAt,
    approvedAt: row.approvedAt,
    dueDate: row.dueDate,
    returnedAt: row.returnedAt,
  };
}

export class LibraryEngine {
  constructor(
    private libraryAccessor: LibraryAccessor,
    private openLibraryAccessor: OpenLibraryAccessor,
    private defaultLoanDays: number,
  ) {}

  // --- Add Book ---

  async addBook(request: AddBookRequest): Promise<AddBookResponse> {
    const isbn = extractIsbn(request.isbnOrUrl);
    if (!isbn) {
      return { success: false, reason: "isbn_not_found" };
    }

    // Check if this owner already has this book in this guild
    const alreadyOwns = await this.libraryAccessor.hasEntryByOwnerAndIsbn(
      request.guildId,
      request.ownerId,
      isbn,
    );
    if (alreadyOwns) {
      return { success: false, reason: "already_own" };
    }

    // Get or create the book record
    let existingBook = await this.libraryAccessor.findBookByIsbn(isbn);
    if (!existingBook) {
      const metadata = await this.openLibraryAccessor.lookupByIsbn(isbn);
      if (!metadata) {
        return { success: false, reason: "book_not_found" };
      }

      const { id } = await this.libraryAccessor.insertBook({
        isbn: metadata.isbn,
        title: metadata.title,
        author: metadata.author,
        coverUrl: metadata.coverUrl,
        coverImage: metadata.coverImage,
        description: metadata.description,
        pageCount: metadata.pageCount,
        publishYear: metadata.publishYear,
        genres: JSON.stringify(metadata.genres),
        createdAt: Date.now(),
      });
      existingBook = (await this.libraryAccessor.findBookByIsbn(isbn))!;
      logger.info(`Library: added new book "${metadata.title}" (ISBN: ${isbn}, bookId: ${id})`);
    } else if (!existingBook.coverImage) {
      // Existing book has no cover image — try to fetch one now
      try {
        const coverImage = await this.openLibraryAccessor.fetchCoverImage(isbn, existingBook.coverUrl);
        if (coverImage) {
          await this.libraryAccessor.updateBook(existingBook.id, { coverImage });
          existingBook = (await this.libraryAccessor.findBookByIsbn(isbn))!;
        }
      } catch {
        // Non-fatal — just use the entry without a cover
      }
    }

    const now = Date.now();
    const { id: entryId } = await this.libraryAccessor.insertEntry({
      bookId: existingBook.id,
      guildId: request.guildId,
      ownerId: request.ownerId,
      condition: request.condition,
      availabilityType: request.availabilityType,
      note: request.note,
      addedAt: now,
      updatedAt: now,
    });

    const entry = await this.libraryAccessor.getEntryWithBook(entryId);

    // Check wishlist matches
    const wishlistMatches = await this.libraryAccessor.getWishlistMatchesByIsbn(request.guildId, isbn);
    const wishlistUserIds = wishlistMatches
      .map((w) => w.userId)
      .filter((uid) => uid !== request.ownerId);

    return {
      success: true,
      reason: "added",
      entry: entry ? toEntryView(entry) : undefined,
      wishlistUserIds: wishlistUserIds.length > 0 ? wishlistUserIds : undefined,
    };
  }

  // --- Remove Book ---

  async removeBook(request: RemoveBookRequest): Promise<RemoveBookResponse> {
    const entry = await this.libraryAccessor.getEntryWithBook(request.entryId);
    if (!entry) return { success: false, reason: "not_found" };
    if (entry.ownerId !== request.userId) return { success: false, reason: "not_owner" };

    const activeBorrow = await this.libraryAccessor.getActiveBorrowForEntry(request.entryId);
    if (activeBorrow) return { success: false, reason: "currently_lent" };

    // Deny any pending borrows
    const pendingBorrows = await this.libraryAccessor.getPendingBorrowsForEntry(request.entryId);
    for (const borrow of pendingBorrows) {
      await this.libraryAccessor.updateBorrow(borrow.id, { status: "denied" });
    }

    await this.libraryAccessor.deleteEntry(request.entryId);
    return { success: true, reason: "removed" };
  }

  // --- List Books ---

  async listBooks(request: ListBooksRequest): Promise<ListBooksResponse> {
    const offset = (request.page - 1) * request.pageSize;
    const total = await this.libraryAccessor.countAvailableEntries(request.guildId);
    const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
    const rows = await this.libraryAccessor.listAvailableEntries(request.guildId, request.pageSize, offset);

    return {
      entries: rows.map(toEntryView),
      total,
      page: request.page,
      totalPages,
    };
  }

  // --- Search Books ---

  async searchBooks(request: SearchBooksRequest): Promise<SearchBooksResponse> {
    const offset = (request.page - 1) * request.pageSize;
    const total = await this.libraryAccessor.countSearchResults(request.guildId, request.query);
    const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
    const rows = await this.libraryAccessor.searchEntries(
      request.guildId,
      request.query,
      request.pageSize,
      offset,
    );

    return {
      entries: rows.map(toEntryView),
      total,
      page: request.page,
      totalPages,
      query: request.query,
    };
  }

  // --- Shelf ---

  async getShelf(request: ShelfRequest): Promise<ShelfResponse> {
    const offset = (request.page - 1) * request.pageSize;
    const total = await this.libraryAccessor.countEntriesByOwner(request.guildId, request.ownerId);
    const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
    const rows = await this.libraryAccessor.getEntriesByOwner(
      request.guildId,
      request.ownerId,
      request.pageSize,
      offset,
    );

    return {
      entries: rows.map(toEntryView),
      total,
      page: request.page,
      totalPages,
      ownerId: request.ownerId,
    };
  }

  // --- Book Info ---

  async getBookInfo(request: BookInfoRequest): Promise<BookInfoResponse> {
    const entry = await this.libraryAccessor.getEntryWithBook(request.entryId);
    if (!entry) return { success: false, reason: "not_found" };

    const activeBorrowRow = await this.libraryAccessor.getActiveBorrowForEntry(request.entryId);
    const pendingBorrowRows = await this.libraryAccessor.getPendingBorrowsForEntry(request.entryId);

    // Get rating info
    const { avg, count } = await this.libraryAccessor.getAverageRating(entry.bookId, entry.guildId);

    // Build borrow detail views (need to construct from available data)
    let activeBorrow: BorrowDetailView | undefined;
    if (activeBorrowRow) {
      const detail = await this.libraryAccessor.getBorrowWithDetails(activeBorrowRow.id);
      if (detail) activeBorrow = toBorrowDetailView(detail);
    }

    const pendingBorrows: BorrowDetailView[] = [];
    for (const row of pendingBorrowRows) {
      const detail = await this.libraryAccessor.getBorrowWithDetails(row.id);
      if (detail) pendingBorrows.push(toBorrowDetailView(detail));
    }

    return {
      success: true,
      reason: "found",
      entry: toEntryView(entry),
      activeBorrow,
      pendingBorrows,
      averageRating: avg,
      ratingCount: count,
    };
  }

  // --- Borrow ---

  async requestBorrow(request: BorrowRequest): Promise<BorrowResponse> {
    const entry = await this.libraryAccessor.getEntryWithBook(request.entryId);
    if (!entry) return { success: false, reason: "not_found" };
    if (entry.status !== "available") return { success: false, reason: "not_available" };
    if (entry.availabilityType === "reference") return { success: false, reason: "not_lendable" };
    if (entry.ownerId === request.borrowerId) return { success: false, reason: "own_book" };

    const hasExisting = await this.libraryAccessor.hasPendingOrActiveBorrow(
      request.entryId,
      request.borrowerId,
    );
    if (hasExisting) return { success: false, reason: "already_requested" };

    const { id: borrowId } = await this.libraryAccessor.insertBorrow({
      libraryEntryId: request.entryId,
      borrowerId: request.borrowerId,
      status: "pending",
      borrowedAt: Date.now(),
    });

    return {
      success: true,
      reason: "requested",
      borrowId,
      ownerId: entry.ownerId,
      title: entry.title,
    };
  }

  // --- Approve/Deny Borrow ---

  async approveBorrow(request: ApproveBorrowRequest): Promise<ApproveBorrowResponse> {
    const borrow = await this.libraryAccessor.getBorrowWithDetails(request.borrowId);
    if (!borrow) return { success: false, reason: "not_found" };
    if (borrow.ownerId !== request.ownerId) return { success: false, reason: "not_owner" };
    if (borrow.status !== "pending") return { success: false, reason: "not_pending" };

    const now = Date.now();

    if (request.approve) {
      const dueDate = request.dueDate ?? now + this.defaultLoanDays * 24 * 60 * 60 * 1000;
      await this.libraryAccessor.updateBorrow(request.borrowId, {
        status: "active",
        approvedAt: now,
        dueDate,
      });
      await this.libraryAccessor.updateEntry(borrow.entryId, {
        status: "lent",
        updatedAt: now,
      });
      return {
        success: true,
        reason: "approved",
        borrowerId: borrow.borrowerId,
        title: borrow.title,
        dueDate,
      };
    }

    await this.libraryAccessor.updateBorrow(request.borrowId, { status: "denied" });
    return {
      success: true,
      reason: "denied",
      borrowerId: borrow.borrowerId,
      title: borrow.title,
    };
  }

  // --- Return Book ---

  async returnBook(request: ReturnBookRequest): Promise<ReturnBookResponse> {
    const borrow = await this.libraryAccessor.getBorrowWithDetails(request.borrowId);
    if (!borrow) return { success: false, reason: "not_found" };
    if (borrow.status !== "active") return { success: false, reason: "not_active" };

    // Either borrower or owner can mark as returned
    if (request.userId !== borrow.borrowerId && request.userId !== borrow.ownerId) {
      return { success: false, reason: "not_authorized" };
    }

    const now = Date.now();
    await this.libraryAccessor.updateBorrow(request.borrowId, {
      status: "returned",
      returnedAt: now,
    });

    // Check if this was a "give" entry — if so, mark as given away
    const entry = await this.libraryAccessor.getEntryWithBook(borrow.entryId);
    if (entry?.availabilityType === "give") {
      await this.libraryAccessor.updateEntry(borrow.entryId, {
        status: "given_away",
        updatedAt: now,
      });
      return {
        success: true,
        reason: "given_away",
        title: borrow.title,
        ownerId: borrow.ownerId,
        borrowerId: borrow.borrowerId,
      };
    }

    await this.libraryAccessor.updateEntry(borrow.entryId, {
      status: "available",
      updatedAt: now,
    });
    return {
      success: true,
      reason: "returned",
      title: borrow.title,
      ownerId: borrow.ownerId,
      borrowerId: borrow.borrowerId,
    };
  }

  // --- Update Note ---

  async updateNote(request: UpdateNoteRequest): Promise<UpdateNoteResponse> {
    const entry = await this.libraryAccessor.getEntryWithBook(request.entryId);
    if (!entry) return { success: false, reason: "not_found" };
    if (entry.ownerId !== request.ownerId) return { success: false, reason: "not_owner" };

    await this.libraryAccessor.updateEntry(request.entryId, {
      note: request.note,
      updatedAt: Date.now(),
    });
    return { success: true, reason: "updated" };
  }

  // --- Wishlist ---

  async addWish(request: WishlistAddRequest): Promise<WishlistResponse> {
    const added = await this.libraryAccessor.insertWish({
      guildId: request.guildId,
      userId: request.userId,
      isbn: request.isbn || null,
      title: request.title,
      author: request.author,
      addedAt: Date.now(),
    });

    if (!added) return { success: false, reason: "already_exists" };
    return { success: true, reason: "added" };
  }

  async removeWish(request: WishlistRemoveRequest): Promise<WishlistResponse> {
    const removed = await this.libraryAccessor.removeWish(request.wishId, request.userId);
    if (!removed) return { success: false, reason: "not_found" };
    return { success: true, reason: "removed" };
  }

  async listWishlist(request: WishlistListRequest): Promise<WishlistResponse> {
    const rows = await this.libraryAccessor.getWishlistByUser(request.guildId, request.userId);
    return {
      success: true,
      reason: "listed",
      entries: rows.map((row) => ({
        id: row.id,
        isbn: row.isbn ?? "",
        title: row.title,
        author: row.author,
        addedAt: row.addedAt,
      })),
    };
  }

  // --- Review ---

  async reviewBook(request: ReviewRequest): Promise<ReviewResponse> {
    if (request.rating < 1 || request.rating > 5) {
      return { success: false, reason: "invalid_rating" };
    }

    const isbn = extractIsbn(request.isbnOrUrl);
    if (!isbn) return { success: false, reason: "isbn_not_found" };

    const book = await this.libraryAccessor.findBookByIsbn(isbn);
    if (!book) return { success: false, reason: "book_not_found" };

    const action = await this.libraryAccessor.upsertReview({
      bookId: book.id,
      guildId: request.guildId,
      userId: request.userId,
      rating: request.rating,
      review: request.review,
      createdAt: Date.now(),
    });

    const { avg, count } = await this.libraryAccessor.getAverageRating(book.id, request.guildId);

    return {
      success: true,
      reason: action,
      averageRating: avg,
      ratingCount: count,
      title: book.title,
    };
  }

  // --- Stats ---

  async getStats(request: StatsRequest): Promise<StatsResponse> {
    const [totalBooks, totalBorrows, mostBorrowed, topLenders, genreBreakdown] = await Promise.all([
      this.libraryAccessor.getTotalBooks(request.guildId),
      this.libraryAccessor.getTotalBorrows(request.guildId),
      this.libraryAccessor.getMostBorrowed(request.guildId, 5),
      this.libraryAccessor.getMostActiveLenders(request.guildId, 5),
      this.libraryAccessor.getGenreBreakdown(request.guildId),
    ]);

    return { totalBooks, totalBorrows, mostBorrowed, topLenders, genreBreakdown };
  }

  // --- Get Reviews (for info display) ---

  async getReviews(bookId: number, guildId: string): Promise<{ userId: string; rating: number; review: string; createdAt: number }[]> {
    return this.libraryAccessor.getReviewsForBook(bookId, guildId);
  }

  // --- Overdue (for timer) ---

  async getOverdueBorrows(reminderCooldownMs: number = 24 * 60 * 60 * 1000): Promise<BorrowDetailView[]> {
    const rows = await this.libraryAccessor.getOverdueBorrows(Date.now(), reminderCooldownMs);
    return rows.map(toBorrowDetailView);
  }

  async markReminderSent(borrowId: number): Promise<void> {
    await this.libraryAccessor.updateBorrow(borrowId, { lastReminderAt: Date.now() });
  }
}
