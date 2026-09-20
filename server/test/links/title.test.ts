import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TITLE_FETCH_TIMEOUT_MS, fetchPageTitle, type FetchLike } from "../../src/links/title.js";

function okResponse(html: string) {
  return { ok: true, status: 200, text: async () => html };
}

describe("fetchPageTitle", () => {
  it("returns the page's title when the fetch succeeds", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<html><head><title>Example Page</title></head></html>"));

    const result = await fetchPageTitle("https://example.com/page", { fetchImpl });

    expect(result).toEqual({ title: "Example Page", source: "fetched" });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/page", { signal: expect.anything() });
  });

  it("trims whitespace and collapses newlines inside the title", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<title>\n  Example   Page \n</title>"));

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result).toEqual({ title: "Example Page", source: "fetched" });
  });

  it("decodes common HTML entities in the title", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<title>Fish &amp; Chips &mdash;&#39;n&#39; more</title>"));

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result.source).toBe("fetched");
    expect(result.title).toBe("Fish & Chips &mdash;'n' more");
  });

  it("is case-insensitive and tolerant of attributes on the <title> tag", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse('<TITLE class="x">Example</TITLE>'));

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result).toEqual({ title: "Example", source: "fetched" });
  });

  it("falls back to the hostname when the page has no <title>", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<html><body>no title here</body></html>"));

    const result = await fetchPageTitle("https://example.com/page", { fetchImpl });

    expect(result).toEqual({ title: "example.com", source: "fallback", error: "Page has no title." });
  });

  it("falls back to the hostname when the <title> is blank", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<title>   </title>"));

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result).toEqual({ title: "example.com", source: "fallback", error: "Page has no title." });
  });

  it("falls back to the hostname on a non-2xx response", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" });

    const result = await fetchPageTitle("https://example.com/missing", { fetchImpl });

    expect(result).toEqual({
      title: "example.com",
      source: "fallback",
      error: "Request failed with status 404."
    });
  });

  it("falls back to the hostname on a network error", async () => {
    const fetchImpl: FetchLike = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result).toEqual({ title: "example.com", source: "fallback", error: "getaddrinfo ENOTFOUND" });
  });

  it("falls back to the hostname on a non-Error rejection", async () => {
    const fetchImpl: FetchLike = vi.fn().mockRejectedValue("boom");

    const result = await fetchPageTitle("https://example.com", { fetchImpl });

    expect(result).toEqual({ title: "example.com", source: "fallback", error: "Unknown error while fetching the page." });
  });

  it("times out and falls back to the hostname when the fetch takes too long", async () => {
    const fetchImpl: FetchLike = vi.fn().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );

    const result = await fetchPageTitle("https://example.com", { fetchImpl, timeoutMs: 20 });

    expect(result).toEqual({
      title: "example.com",
      source: "fallback",
      error: "Timed out after 20ms."
    });
  });

  it("defaults the timeout to 3 seconds", async () => {
    const fetchImpl: FetchLike = vi.fn().mockResolvedValue(okResponse("<title>Example</title>"));

    await fetchPageTitle("https://example.com", { fetchImpl });

    expect(DEFAULT_TITLE_FETCH_TIMEOUT_MS).toBe(3000);
  });

  it("returns source \"invalid\" without a hostname fallback for an invalid URL", async () => {
    const fetchImpl: FetchLike = vi.fn();

    const result = await fetchPageTitle("not a url", { fetchImpl });

    expect(result).toEqual({ title: "", source: "invalid", error: "URL is not valid." });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns source \"invalid\" for a non-string input", async () => {
    const result = await fetchPageTitle(undefined);

    expect(result).toEqual({ title: "", source: "invalid", error: "URL is required." });
  });
});
