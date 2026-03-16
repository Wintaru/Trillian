import { describe, it, expect, vi, beforeEach } from "vitest";
import { YouTubeAccessor } from "./youtube-accessor.js";

describe("YouTubeAccessor", () => {
  let accessor: YouTubeAccessor;

  beforeEach(() => {
    accessor = new YouTubeAccessor("test-api-key");
    vi.restoreAllMocks();
  });

  it("should return a YouTube URL for a successful search", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: { videoId: "dQw4w9WgXcQ" } }],
      }),
    } as Response);

    const result = await accessor.searchVideo("Never Gonna Give You Up - Rick Astley");
    expect(result).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("should return null when no results found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    const result = await accessor.searchVideo("nonexistent song xyz");
    expect(result).toBeNull();
  });

  it("should return null on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const result = await accessor.searchVideo("test query");
    expect(result).toBeNull();
  });

  it("should return null on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const result = await accessor.searchVideo("test query");
    expect(result).toBeNull();
  });

  it("should pass the API key in the request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    await accessor.searchVideo("test");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("key=test-api-key");
  });
});
