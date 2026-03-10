import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeeplAccessor } from "./deepl-accessor.js";

const mockResponse = {
  translations: [
    {
      detected_source_language: "EN",
      text: "Hola mundo",
    },
  ],
};

describe("DeeplAccessor", () => {
  let accessor: DeeplAccessor;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    accessor = new DeeplAccessor("test-api-key");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return parsed response on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await accessor.translate("Hello world", "ES");

    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].text).toBe("Hola mundo");
    expect(result.translations[0].detected_source_language).toBe("EN");
  });

  it("should send correct auth header", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    await accessor.translate("Hello", "ES");

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "https://api-free.deepl.com/v2/translate",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "DeepL-Auth-Key test-api-key",
        }),
      }),
    );
  });

  it("should include source_lang in body when provided", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    await accessor.translate("Hello", "ES", "EN");

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string) as Record<string, unknown>;
    expect(body["source_lang"]).toBe("EN");
  });

  it("should omit source_lang from body when not provided", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    await accessor.translate("Hello", "ES");

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("source_lang");
  });

  it("should throw on non-OK HTTP status", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    await expect(accessor.translate("Hello", "ES")).rejects.toThrow("HTTP 403");
  });
});
