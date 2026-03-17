import { describe, it, expect, vi, beforeEach } from "vitest";
import { LibraryEngine } from "./library-engine.js";
import type { LibraryAccessor } from "../accessors/library-accessor.js";
import type { OpenLibraryAccessor } from "../accessors/open-library-accessor.js";

function createMockAccessor(): LibraryAccessor {
  return {
    findBookByIsbn: vi.fn().mockResolvedValue(null),
    insertBook: vi.fn().mockResolvedValue({ id: 1 }),
    insertEntry: vi.fn().mockResolvedValue({ id: 1 }),
    getEntryWithBook: vi.fn().mockResolvedValue(null),
    updateEntry: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(true),
    hasEntryByOwnerAndIsbn: vi.fn().mockResolvedValue(false),
    listAvailableEntries: vi.fn().mockResolvedValue([]),
    countAvailableEntries: vi.fn().mockResolvedValue(0),
    searchEntries: vi.fn().mockResolvedValue([]),
    countSearchResults: vi.fn().mockResolvedValue(0),
    getEntriesByOwner: vi.fn().mockResolvedValue([]),
    countEntriesByOwner: vi.fn().mockResolvedValue(0),
    insertBorrow: vi.fn().mockResolvedValue({ id: 1 }),
    getBorrow: vi.fn().mockResolvedValue(null),
    getBorrowWithDetails: vi.fn().mockResolvedValue(null),
    updateBorrow: vi.fn().mockResolvedValue(undefined),
    getActiveBorrowForEntry: vi.fn().mockResolvedValue(null),
    getPendingBorrowsForEntry: vi.fn().mockResolvedValue([]),
    hasPendingOrActiveBorrow: vi.fn().mockResolvedValue(false),
    getOverdueBorrows: vi.fn().mockResolvedValue([]),
    upsertReview: vi.fn().mockResolvedValue("reviewed"),
    getReviewsForBook: vi.fn().mockResolvedValue([]),
    getAverageRating: vi.fn().mockResolvedValue({ avg: 0, count: 0 }),
    insertWish: vi.fn().mockResolvedValue(true),
    removeWish: vi.fn().mockResolvedValue(true),
    getWishlistByUser: vi.fn().mockResolvedValue([]),
    getWishlistMatchesByIsbn: vi.fn().mockResolvedValue([]),
    getMostBorrowed: vi.fn().mockResolvedValue([]),
    getMostActiveLenders: vi.fn().mockResolvedValue([]),
    getGenreBreakdown: vi.fn().mockResolvedValue([]),
    getTotalBooks: vi.fn().mockResolvedValue(0),
    getTotalBorrows: vi.fn().mockResolvedValue(0),
  } as unknown as LibraryAccessor;
}

function createMockOpenLibrary(): OpenLibraryAccessor {
  return {
    lookupByIsbn: vi.fn().mockResolvedValue({
      isbn: "9780143127550",
      title: "Sapiens",
      author: "Yuval Noah Harari",
      coverUrl: "https://covers.openlibrary.org/b/id/12345-L.jpg",
      coverImage: Buffer.from("fake-image"),
      description: "A brief history of humankind.",
      pageCount: 443,
      publishYear: 2015,
      genres: ["History", "Science"],
    }),
    fetchCoverImage: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  } as unknown as OpenLibraryAccessor;
}

describe("LibraryEngine", () => {
  let engine: LibraryEngine;
  let accessor: LibraryAccessor;
  let openLibrary: OpenLibraryAccessor;

  beforeEach(() => {
    accessor = createMockAccessor();
    openLibrary = createMockOpenLibrary();
    engine = new LibraryEngine(accessor, openLibrary, 14);
  });

  describe("addBook", () => {
    it("should return isbn_not_found for invalid input", async () => {
      const result = await engine.addBook({
        isbnOrUrl: "not-an-isbn",
        guildId: "guild1",
        ownerId: "user1",
        condition: "good",
        availabilityType: "lend",
        note: "",
      });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("isbn_not_found");
    });

    it("should return already_own if user already has the book", async () => {
      vi.mocked(accessor.hasEntryByOwnerAndIsbn).mockResolvedValue(true);

      const result = await engine.addBook({
        isbnOrUrl: "9780143127550",
        guildId: "guild1",
        ownerId: "user1",
        condition: "good",
        availabilityType: "lend",
        note: "",
      });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_own");
    });

    it("should look up book from Open Library when not cached", async () => {
      vi.mocked(accessor.findBookByIsbn).mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 1, isbn: "9780143127550", title: "Sapiens", author: "Yuval Noah Harari",
        coverUrl: "", coverImage: null, description: "", pageCount: 443, publishYear: 2015, genres: "[]", createdAt: 0,
      });
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "guild1", isbn: "9780143127550", title: "Sapiens",
        author: "Yuval Noah Harari", coverUrl: "", coverImage: null, description: "", pageCount: 443,
        publishYear: 2015, genres: "[]", ownerId: "user1", condition: "good",
        availabilityType: "lend", status: "available", note: "", addedAt: 0,
      });

      const result = await engine.addBook({
        isbnOrUrl: "9780143127550",
        guildId: "guild1",
        ownerId: "user1",
        condition: "good",
        availabilityType: "lend",
        note: "Great book",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("added");
      expect(openLibrary.lookupByIsbn).toHaveBeenCalledWith("9780143127550");
      expect(accessor.insertBook).toHaveBeenCalled();
      expect(accessor.insertEntry).toHaveBeenCalled();
    });

    it("should return book_not_found if Open Library lookup fails", async () => {
      vi.mocked(openLibrary.lookupByIsbn).mockResolvedValue(null);

      const result = await engine.addBook({
        isbnOrUrl: "9780143127550",
        guildId: "guild1",
        ownerId: "user1",
        condition: "good",
        availabilityType: "lend",
        note: "",
      });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("book_not_found");
    });

    it("should return wishlist user IDs when matches exist", async () => {
      vi.mocked(accessor.findBookByIsbn).mockResolvedValue({
        id: 1, isbn: "9780143127550", title: "Sapiens", author: "Yuval Noah Harari",
        coverUrl: "", coverImage: null, description: "", pageCount: 443, publishYear: 2015, genres: "[]", createdAt: 0,
      });
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "guild1", isbn: "9780143127550", title: "Sapiens",
        author: "Yuval Noah Harari", coverUrl: "", coverImage: null, description: "", pageCount: 443,
        publishYear: 2015, genres: "[]", ownerId: "user1", condition: "good",
        availabilityType: "lend", status: "available", note: "", addedAt: 0,
      });
      vi.mocked(accessor.getWishlistMatchesByIsbn).mockResolvedValue([
        { id: 1, guildId: "guild1", userId: "user2", isbn: "9780143127550", title: "", author: "", addedAt: 0 },
        { id: 2, guildId: "guild1", userId: "user1", isbn: "9780143127550", title: "", author: "", addedAt: 0 },
      ]);

      const result = await engine.addBook({
        isbnOrUrl: "9780143127550",
        guildId: "guild1",
        ownerId: "user1",
        condition: "good",
        availabilityType: "lend",
        note: "",
      });

      expect(result.success).toBe(true);
      // Should not include the owner's own wishlist entry
      expect(result.wishlistUserIds).toEqual(["user2"]);
    });
  });

  describe("removeBook", () => {
    it("should return not_found for missing entry", async () => {
      const result = await engine.removeBook({ entryId: 99, userId: "user1" });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_found");
    });

    it("should return not_owner if caller is not the owner", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "other_user", condition: "good", availabilityType: "lend",
        status: "available", note: "", addedAt: 0,
      });

      const result = await engine.removeBook({ entryId: 1, userId: "user1" });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_owner");
    });

    it("should return currently_lent if book has active borrow", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "user1", condition: "good", availabilityType: "lend",
        status: "lent", note: "", addedAt: 0,
      });
      vi.mocked(accessor.getActiveBorrowForEntry).mockResolvedValue({
        id: 1, libraryEntryId: 1, borrowerId: "user2", status: "active",
        borrowedAt: 0, approvedAt: 0, dueDate: null, returnedAt: null, lastReminderAt: null,
      });

      const result = await engine.removeBook({ entryId: 1, userId: "user1" });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("currently_lent");
    });

    it("should remove entry and deny pending borrows", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "user1", condition: "good", availabilityType: "lend",
        status: "available", note: "", addedAt: 0,
      });
      vi.mocked(accessor.getPendingBorrowsForEntry).mockResolvedValue([
        { id: 10, libraryEntryId: 1, borrowerId: "user3", status: "pending", borrowedAt: 0, approvedAt: null, dueDate: null, returnedAt: null, lastReminderAt: null },
      ]);

      const result = await engine.removeBook({ entryId: 1, userId: "user1" });
      expect(result.success).toBe(true);
      expect(result.reason).toBe("removed");
      expect(accessor.updateBorrow).toHaveBeenCalledWith(10, { status: "denied" });
      expect(accessor.deleteEntry).toHaveBeenCalledWith(1);
    });
  });

  describe("requestBorrow", () => {
    it("should reject borrowing own book", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "user1", condition: "good", availabilityType: "lend",
        status: "available", note: "", addedAt: 0,
      });

      const result = await engine.requestBorrow({ entryId: 1, borrowerId: "user1", guildId: "g" });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("own_book");
    });

    it("should reject reference-only books", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "user1", condition: "good", availabilityType: "reference",
        status: "available", note: "", addedAt: 0,
      });

      const result = await engine.requestBorrow({ entryId: 1, borrowerId: "user2", guildId: "g" });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_lendable");
    });

    it("should create a pending borrow request", async () => {
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "Book Title", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "owner1", condition: "good", availabilityType: "lend",
        status: "available", note: "", addedAt: 0,
      });

      const result = await engine.requestBorrow({ entryId: 1, borrowerId: "user2", guildId: "g" });
      expect(result.success).toBe(true);
      expect(result.reason).toBe("requested");
      expect(result.ownerId).toBe("owner1");
      expect(result.title).toBe("Book Title");
      expect(accessor.insertBorrow).toHaveBeenCalled();
    });
  });

  describe("approveBorrow", () => {
    it("should approve and set entry to lent", async () => {
      vi.mocked(accessor.getBorrowWithDetails).mockResolvedValue({
        borrowId: 1, entryId: 1, title: "T", author: "A", coverUrl: "",
        ownerId: "owner1", borrowerId: "user2", status: "pending",
        borrowedAt: 0, approvedAt: null, dueDate: null, returnedAt: null, lastReminderAt: null,
      });

      const result = await engine.approveBorrow({
        borrowId: 1,
        ownerId: "owner1",
        approve: true,
        dueDate: null,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("approved");
      expect(accessor.updateBorrow).toHaveBeenCalled();
      expect(accessor.updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: "lent" }));
    });

    it("should deny borrow", async () => {
      vi.mocked(accessor.getBorrowWithDetails).mockResolvedValue({
        borrowId: 1, entryId: 1, title: "T", author: "A", coverUrl: "",
        ownerId: "owner1", borrowerId: "user2", status: "pending",
        borrowedAt: 0, approvedAt: null, dueDate: null, returnedAt: null, lastReminderAt: null,
      });

      const result = await engine.approveBorrow({
        borrowId: 1,
        ownerId: "owner1",
        approve: false,
        dueDate: null,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("denied");
    });

    it("should reject if not owner", async () => {
      vi.mocked(accessor.getBorrowWithDetails).mockResolvedValue({
        borrowId: 1, entryId: 1, title: "T", author: "A", coverUrl: "",
        ownerId: "owner1", borrowerId: "user2", status: "pending",
        borrowedAt: 0, approvedAt: null, dueDate: null, returnedAt: null, lastReminderAt: null,
      });

      const result = await engine.approveBorrow({
        borrowId: 1,
        ownerId: "not_owner",
        approve: true,
        dueDate: null,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_owner");
    });
  });

  describe("returnBook", () => {
    it("should mark book as returned and available", async () => {
      vi.mocked(accessor.getBorrowWithDetails).mockResolvedValue({
        borrowId: 1, entryId: 1, title: "T", author: "A", coverUrl: "",
        ownerId: "owner1", borrowerId: "user2", status: "active",
        borrowedAt: 0, approvedAt: 0, dueDate: null, returnedAt: null, lastReminderAt: null,
      });
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "owner1", condition: "good", availabilityType: "lend",
        status: "lent", note: "", addedAt: 0,
      });

      const result = await engine.returnBook({ borrowId: 1, userId: "user2" });
      expect(result.success).toBe(true);
      expect(result.reason).toBe("returned");
      expect(accessor.updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: "available" }));
    });

    it("should mark give entries as given_away on return", async () => {
      vi.mocked(accessor.getBorrowWithDetails).mockResolvedValue({
        borrowId: 1, entryId: 1, title: "T", author: "A", coverUrl: "",
        ownerId: "owner1", borrowerId: "user2", status: "active",
        borrowedAt: 0, approvedAt: 0, dueDate: null, returnedAt: null, lastReminderAt: null,
      });
      vi.mocked(accessor.getEntryWithBook).mockResolvedValue({
        entryId: 1, bookId: 1, guildId: "g", isbn: "x", title: "T", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]",
        ownerId: "owner1", condition: "good", availabilityType: "give",
        status: "lent", note: "", addedAt: 0,
      });

      const result = await engine.returnBook({ borrowId: 1, userId: "user2" });
      expect(result.success).toBe(true);
      expect(result.reason).toBe("given_away");
      expect(accessor.updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: "given_away" }));
    });
  });

  describe("reviewBook", () => {
    it("should reject invalid rating", async () => {
      const result = await engine.reviewBook({
        isbnOrUrl: "9780143127550",
        guildId: "g",
        userId: "u",
        rating: 6,
        review: "",
      });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("invalid_rating");
    });

    it("should reject if book not in library", async () => {
      const result = await engine.reviewBook({
        isbnOrUrl: "9780143127550",
        guildId: "g",
        userId: "u",
        rating: 4,
        review: "Great",
      });
      expect(result.success).toBe(false);
      expect(result.reason).toBe("book_not_found");
    });

    it("should upsert review and return average", async () => {
      vi.mocked(accessor.findBookByIsbn).mockResolvedValue({
        id: 1, isbn: "9780143127550", title: "Sapiens", author: "A",
        coverUrl: "", coverImage: null, description: "", pageCount: 0, publishYear: 0, genres: "[]", createdAt: 0,
      });
      vi.mocked(accessor.getAverageRating).mockResolvedValue({ avg: 4.5, count: 2 });

      const result = await engine.reviewBook({
        isbnOrUrl: "9780143127550",
        guildId: "g",
        userId: "u",
        rating: 5,
        review: "Excellent",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("reviewed");
      expect(result.averageRating).toBe(4.5);
      expect(result.ratingCount).toBe(2);
    });
  });

  describe("listBooks", () => {
    it("should return paginated results", async () => {
      vi.mocked(accessor.countAvailableEntries).mockResolvedValue(25);
      vi.mocked(accessor.listAvailableEntries).mockResolvedValue([]);

      const result = await engine.listBooks({ guildId: "g", page: 2, pageSize: 10 });
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
      expect(accessor.listAvailableEntries).toHaveBeenCalledWith("g", 10, 10);
    });
  });
});
