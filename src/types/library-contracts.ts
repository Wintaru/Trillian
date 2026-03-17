// --- Type Aliases ---

export type BookCondition = "like_new" | "good" | "fair" | "poor";
export type AvailabilityType = "lend" | "give" | "reference";
export type EntryStatus = "available" | "lent" | "given_away";
export type BorrowStatus = "pending" | "active" | "returned" | "denied";

// --- Book Metadata (from Open Library) ---

export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  pageCount: number;
  publishYear: number;
  genres: string[];
}

// --- View Models ---

export interface LibraryEntryView {
  entryId: number;
  bookId: number;
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  pageCount: number;
  publishYear: number;
  genres: string[];
  ownerId: string;
  condition: BookCondition;
  availabilityType: AvailabilityType;
  status: EntryStatus;
  note: string;
  addedAt: number;
}

export interface BorrowDetailView {
  borrowId: number;
  entryId: number;
  title: string;
  author: string;
  coverUrl: string;
  ownerId: string;
  borrowerId: string;
  status: BorrowStatus;
  borrowedAt: number;
  approvedAt: number | null;
  dueDate: number | null;
  returnedAt: number | null;
}

// --- Add Book ---

export interface AddBookRequest {
  isbnOrUrl: string;
  guildId: string;
  ownerId: string;
  condition: BookCondition;
  availabilityType: AvailabilityType;
  note: string;
}

export interface AddBookResponse {
  success: boolean;
  reason: "added" | "isbn_not_found" | "book_not_found" | "already_own";
  entry?: LibraryEntryView;
  wishlistUserIds?: string[];
}

// --- Remove Book ---

export interface RemoveBookRequest {
  entryId: number;
  userId: string;
}

export interface RemoveBookResponse {
  success: boolean;
  reason: "removed" | "not_found" | "not_owner" | "currently_lent";
}

// --- List Books ---

export interface ListBooksRequest {
  guildId: string;
  page: number;
  pageSize: number;
}

export interface ListBooksResponse {
  entries: LibraryEntryView[];
  total: number;
  page: number;
  totalPages: number;
}

// --- Search Books ---

export interface SearchBooksRequest {
  guildId: string;
  query: string;
  page: number;
  pageSize: number;
}

export interface SearchBooksResponse {
  entries: LibraryEntryView[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
}

// --- Shelf ---

export interface ShelfRequest {
  guildId: string;
  ownerId: string;
  page: number;
  pageSize: number;
}

export interface ShelfResponse {
  entries: LibraryEntryView[];
  total: number;
  page: number;
  totalPages: number;
  ownerId: string;
}

// --- Book Info ---

export interface BookInfoRequest {
  entryId: number;
  viewerId: string;
}

export interface BookInfoResponse {
  success: boolean;
  reason: "found" | "not_found";
  entry?: LibraryEntryView;
  activeBorrow?: BorrowDetailView;
  pendingBorrows?: BorrowDetailView[];
  averageRating?: number;
  ratingCount?: number;
}

// --- Borrow ---

export interface BorrowRequest {
  entryId: number;
  borrowerId: string;
  guildId: string;
}

export interface BorrowResponse {
  success: boolean;
  reason:
    | "requested"
    | "not_found"
    | "not_available"
    | "not_lendable"
    | "own_book"
    | "already_requested"
    | "already_borrowing";
  borrowId?: number;
  ownerId?: string;
  title?: string;
}

// --- Approve/Deny Borrow ---

export interface ApproveBorrowRequest {
  borrowId: number;
  ownerId: string;
  approve: boolean;
  dueDate: number | null;
}

export interface ApproveBorrowResponse {
  success: boolean;
  reason: "approved" | "denied" | "not_found" | "not_owner" | "not_pending";
  borrowerId?: string;
  title?: string;
  dueDate?: number | null;
}

// --- Return Book ---

export interface ReturnBookRequest {
  borrowId: number;
  userId: string;
}

export interface ReturnBookResponse {
  success: boolean;
  reason: "returned" | "given_away" | "not_found" | "not_active" | "not_authorized";
  title?: string;
  ownerId?: string;
  borrowerId?: string;
}

// --- Update Note ---

export interface UpdateNoteRequest {
  entryId: number;
  ownerId: string;
  note: string;
}

export interface UpdateNoteResponse {
  success: boolean;
  reason: "updated" | "not_found" | "not_owner";
}

// --- Wishlist ---

export interface WishlistAddRequest {
  guildId: string;
  userId: string;
  isbn: string;
  title: string;
  author: string;
}

export interface WishlistRemoveRequest {
  wishId: number;
  userId: string;
}

export interface WishlistListRequest {
  guildId: string;
  userId: string;
}

export interface WishlistEntry {
  id: number;
  isbn: string;
  title: string;
  author: string;
  addedAt: number;
}

export interface WishlistResponse {
  success: boolean;
  reason: "added" | "removed" | "listed" | "not_found" | "already_exists" | "not_owner";
  entries?: WishlistEntry[];
}

// --- Review ---

export interface ReviewRequest {
  isbnOrUrl: string;
  guildId: string;
  userId: string;
  rating: number;
  review: string;
}

export interface ReviewResponse {
  success: boolean;
  reason: "reviewed" | "updated" | "isbn_not_found" | "book_not_found" | "invalid_rating";
  averageRating?: number;
  ratingCount?: number;
  title?: string;
}

export interface BookReviewView {
  userId: string;
  rating: number;
  review: string;
  createdAt: number;
}

// --- Stats ---

export interface StatsRequest {
  guildId: string;
}

export interface StatsResponse {
  totalBooks: number;
  totalBorrows: number;
  mostBorrowed: { title: string; author: string; count: number }[];
  topLenders: { ownerId: string; count: number }[];
  genreBreakdown: { genre: string; count: number }[];
}
