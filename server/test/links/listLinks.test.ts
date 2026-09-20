import { describe, expect, it, vi } from "vitest";
import { listLinks, LINKS_PAGE_SIZE } from "../../src/links/listLinks.js";
import { encodeCursor } from "../../src/links/cursor.js";
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

describe("listLinks", () => {
  it("lists links using the default page size when no tag or cursor is given", async () => {
    const records = [makeRecord({ id: "2" }), makeRecord({ id: "1" })];
    const find = vi.fn().mockResolvedValue(records);

    const result = await listLinks({}, { find });

    expect(find).toHaveBeenCalledWith({ tag: undefined, after: null, limit: LINKS_PAGE_SIZE });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.links).toEqual(records);
      expect(result.cursor).toBe(encodeCursor(records[records.length - 1]));
    }
  });

  it("trims and forwards a single tag filter", async () => {
    const find = vi.fn().mockResolvedValue([]);

    await listLinks({ tag: "  reading  " }, { find });

    expect(find).toHaveBeenCalledWith({ tag: "reading", after: null, limit: LINKS_PAGE_SIZE });
  });

  it("rejects more than one tag", async () => {
    const find = vi.fn();

    const result = await listLinks({ tag: ["a", "b"] }, { find });

    expect(result).toEqual({ ok: false, status: 400, error: "Only one tag may be specified." });
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects a non-string tag", async () => {
    const result = await listLinks({ tag: 42 });

    expect(result).toEqual({ ok: false, status: 400, error: "tag must be a string." });
  });

  it("rejects a blank tag", async () => {
    const result = await listLinks({ tag: "   " });

    expect(result).toEqual({ ok: false, status: 400, error: "tag must not be blank." });
  });

  it("decodes a supplied cursor and passes its position to find", async () => {
    const cursor = encodeCursor({ id: "10", created_at: new Date("2024-02-02T00:00:00.000Z") });
    const find = vi.fn().mockResolvedValue([]);

    await listLinks({ cursor }, { find });

    expect(find).toHaveBeenCalledWith({
      tag: undefined,
      after: { id: "10", createdAt: new Date("2024-02-02T00:00:00.000Z") },
      limit: LINKS_PAGE_SIZE
    });
  });

  it("rejects an invalid cursor without querying", async () => {
    const find = vi.fn();

    const result = await listLinks({ cursor: "not-a-real-cursor!!!" }, { find });

    expect(result).toEqual({ ok: false, status: 400, error: "cursor is not valid." });
    expect(find).not.toHaveBeenCalled();
  });

  it("returns cursor: null when there are no links (empty page)", async () => {
    const find = vi.fn().mockResolvedValue([]);

    const result = await listLinks({}, { find });

    expect(result).toEqual({ ok: true, links: [], cursor: null });
  });

  it("always returns a cursor for a non-empty page, even when it is the last one", async () => {
    // Fewer rows than LINKS_PAGE_SIZE means this is the last page — the
    // cursor is still populated with the last row's position (LAR-25).
    const records = [makeRecord({ id: "1" })];
    const find = vi.fn().mockResolvedValue(records);

    const result = await listLinks({}, { find });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cursor).not.toBeNull();
      expect(result.cursor).toBe(encodeCursor(records[0]));
    }
  });

  it("returns a 500 result when the query fails", async () => {
    const find = vi.fn().mockRejectedValue(new Error("connection refused"));

    const result = await listLinks({}, { find });

    expect(result).toEqual({ ok: false, status: 500, error: "connection refused" });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    const find = vi.fn().mockRejectedValue("boom");

    const result = await listLinks({}, { find });

    expect(result).toEqual({ ok: false, status: 500, error: "Failed to list links." });
  });
});
