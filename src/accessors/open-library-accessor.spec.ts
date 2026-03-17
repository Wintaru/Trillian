import { describe, it, expect } from "vitest";
import { extractIsbn } from "./open-library-accessor.js";

describe("extractIsbn", () => {
  describe("bare ISBN", () => {
    it("should accept a valid ISBN-13", () => {
      expect(extractIsbn("9780143127550")).toBe("9780143127550");
    });

    it("should accept an ISBN-13 with hyphens", () => {
      expect(extractIsbn("978-0-14-312755-0")).toBe("9780143127550");
    });

    it("should convert a valid ISBN-10 to ISBN-13", () => {
      // ISBN-10: 0143127551 -> ISBN-13: 9780143127550
      expect(extractIsbn("0143127551")).toBe("9780143127550");
    });

    it("should accept an ISBN-10 with hyphens", () => {
      expect(extractIsbn("0-14-312755-1")).toBe("9780143127550");
    });

    it("should handle ISBN-10 with X check digit", () => {
      // ISBN-10: 080442957X -> ISBN-13: 9780804429573
      expect(extractIsbn("080442957X")).toBe("9780804429573");
    });

    it("should return null for invalid ISBN", () => {
      expect(extractIsbn("1234567890")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(extractIsbn("")).toBeNull();
    });

    it("should return null for random text", () => {
      expect(extractIsbn("hello world")).toBeNull();
    });
  });

  describe("Amazon URLs", () => {
    it("should extract ISBN from /dp/ URL", () => {
      expect(extractIsbn("https://www.amazon.com/dp/0143127551")).toBe("9780143127550");
    });

    it("should extract ISBN from /gp/product/ URL", () => {
      expect(extractIsbn("https://www.amazon.com/gp/product/0143127551")).toBe("9780143127550");
    });

    it("should extract ISBN from URL with extra path", () => {
      expect(extractIsbn("https://www.amazon.com/Some-Book-Title/dp/0143127551/ref=sr_1_1")).toBe("9780143127550");
    });
  });

  describe("Open Library URLs", () => {
    it("should extract ISBN-13 from Open Library URL", () => {
      expect(extractIsbn("https://openlibrary.org/isbn/9780143127550")).toBe("9780143127550");
    });

    it("should extract ISBN-10 from Open Library URL", () => {
      expect(extractIsbn("https://openlibrary.org/isbn/0143127551")).toBe("9780143127550");
    });
  });

  describe("Google Books URLs", () => {
    it("should extract ISBN from isbn query parameter", () => {
      expect(extractIsbn("https://books.google.com/books?isbn=9780143127550")).toBe("9780143127550");
    });
  });

  describe("Barnes & Noble URLs", () => {
    it("should extract ISBN from ean query parameter", () => {
      expect(extractIsbn("https://www.barnesandnoble.com/w/some-book?ean=9780143127550")).toBe("9780143127550");
    });
  });

  describe("generic URLs", () => {
    it("should find ISBN-13 in arbitrary URL path", () => {
      expect(extractIsbn("https://example.com/book/9780143127550/details")).toBe("9780143127550");
    });

    it("should return null for URL with no ISBN", () => {
      expect(extractIsbn("https://example.com/some/page")).toBeNull();
    });
  });
});
