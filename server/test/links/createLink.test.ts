import { describe, expect, it, vi } from "vitest";
import { createLink, MAX_TITLE_LENGTH } from "../../src/links/createLink.js";
import type { LinkRecord } from "../../src/links/repository.js";

function makeRecord(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    id: "1",
    url: "https://example.com/",
    title: "Example",
    tags: [],
    created_at: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides
  };
}

describe("createLink", () => {
  it("rejects a missing URL without calling fetchTitle or insert", async () => {
    const fetchTitle = vi.fn();
    const insert = vi.fn();

    const result = await createLink({}, { fetchTitle, insert });

    expect(result).toEqual({ ok: false, status: 400, error: "URL is required." });
    expect(fetchTitle).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid URL", async () => {
    const result = await createLink({ url: "not a url" });

    expect(result).toEqual({ ok: false, status: 400, error: "URL is not valid." });
  });

  it("rejects a non-string title", async () => {
    const result = await createLink({ url: "https://example.com", title: 42 });

    expect(result).toEqual({ ok: false, status: 400, error: "Title must be a string." });
  });

  it(`rejects a title longer than ${MAX_TITLE_LENGTH} characters`, async () => {
    const result = await createLink({ url: "https://example.com", title: "a".repeat(MAX_TITLE_LENGTH + 1) });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
    });
  });

  it(`accepts a title exactly ${MAX_TITLE_LENGTH} characters long`, async () => {
    const title = "a".repeat(MAX_TITLE_LENGTH);
    const fetchTitle = vi.fn();
    const insert = vi.fn().mockResolvedValue(makeRecord({ title }));

    const result = await createLink({ url: "https://example.com", title }, { fetchTitle, insert });

    expect(fetchTitle).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({ url: "https://example.com/", title });
    expect(result).toEqual({ ok: true, link: makeRecord({ title }) });
  });

  it("trims a supplied title before validating and storing it", async () => {
    const insert = vi.fn().mockResolvedValue(makeRecord({ title: "Hello" }));

    await createLink({ url: "https://example.com", title: "  Hello  " }, { insert, fetchTitle: vi.fn() });

    expect(insert).toHaveBeenCalledWith({ url: "https://example.com/", title: "Hello" });
  });

  it("fetches the title from the page when none is supplied", async () => {
    const fetchTitle = vi.fn().mockResolvedValue({ title: "Fetched Title", source: "fetched" });
    const insert = vi.fn().mockResolvedValue(makeRecord({ title: "Fetched Title" }));

    const result = await createLink({ url: "https://example.com" }, { fetchTitle, insert });

    expect(fetchTitle).toHaveBeenCalledWith("https://example.com/");
    expect(insert).toHaveBeenCalledWith({ url: "https://example.com/", title: "Fetched Title" });
    expect(result).toEqual({ ok: true, link: makeRecord({ title: "Fetched Title" }) });
  });

  it("fetches the title when a blank title is supplied", async () => {
    const fetchTitle = vi.fn().mockResolvedValue({ title: "Fetched Title", source: "fetched" });
    const insert = vi.fn().mockResolvedValue(makeRecord({ title: "Fetched Title" }));

    await createLink({ url: "https://example.com", title: "   " }, { fetchTitle, insert });

    expect(fetchTitle).toHaveBeenCalledOnce();
  });

  it("truncates a fetched title that exceeds the max length", async () => {
    const longTitle = "a".repeat(MAX_TITLE_LENGTH + 50);
    const fetchTitle = vi.fn().mockResolvedValue({ title: longTitle, source: "fetched" });
    const insert = vi.fn().mockResolvedValue(makeRecord({ title: longTitle.slice(0, MAX_TITLE_LENGTH) }));

    await createLink({ url: "https://example.com" }, { fetchTitle, insert });

    expect(insert).toHaveBeenCalledWith({
      url: "https://example.com/",
      title: longTitle.slice(0, MAX_TITLE_LENGTH)
    });
  });

  it("stores a null title when fetching fails to produce one", async () => {
    const fetchTitle = vi.fn().mockResolvedValue({ title: "", source: "invalid", error: "URL is not valid." });
    const insert = vi.fn().mockResolvedValue(makeRecord({ title: null }));

    await createLink({ url: "https://example.com" }, { fetchTitle, insert });

    expect(insert).toHaveBeenCalledWith({ url: "https://example.com/", title: null });
  });

  it("returns a 500 result when persisting the link fails", async () => {
    const fetchTitle = vi.fn();
    const insert = vi.fn().mockRejectedValue(new Error("connection refused"));

    const result = await createLink({ url: "https://example.com", title: "Example" }, { fetchTitle, insert });

    expect(result).toEqual({ ok: false, status: 500, error: "connection refused" });
  });

  it("falls back to a generic message for a non-Error rejection from insert", async () => {
    const insert = vi.fn().mockRejectedValue("boom");

    const result = await createLink({ url: "https://example.com", title: "Example" }, { insert, fetchTitle: vi.fn() });

    expect(result).toEqual({ ok: false, status: 500, error: "Failed to save link." });
  });
});
