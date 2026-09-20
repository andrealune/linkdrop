import { describe, expect, it, vi } from "vitest";
import { MAX_TAGS, updateLinkTags } from "../../src/links/updateLinkTags.js";
import type { LinkRecord } from "../../src/links/repository.js";

/**
 * Unit coverage for the updateLinkTags() business logic (LAR-27): id
 * well-formedness, tag normalization/validation, the "not found" case,
 * and error handling. The actual UPDATE SQL lives in
 * src/links/repository.ts and is injected here via `replace` — mirroring
 * the deleteLink()/deleteLinkById() split in deleteLink.test.ts.
 * Authentication is a separate concern, covered by test/auth.test.ts and
 * exercised end-to-end in test/links/postLinksTags.test.ts.
 */
function sampleLink(tags: string[]): LinkRecord {
  return {
    id: "42",
    url: "https://example.com/",
    title: "Example",
    tags,
    created_at: new Date("2024-01-01T00:00:00.000Z")
  };
}

describe("updateLinkTags", () => {
  it("normalizes tags (trims and lowercases) before persisting", async () => {
    const replace = vi.fn().mockResolvedValue(sampleLink(["news", "to-read"]));

    const result = await updateLinkTags("42", { tags: ["  News ", "To-Read"] }, { replace });

    expect(result).toEqual({ ok: true, link: sampleLink(["news", "to-read"]) });
    expect(replace).toHaveBeenCalledWith("42", ["news", "to-read"]);
  });

  it("deduplicates tags that normalize to the same value", async () => {
    const replace = vi.fn().mockResolvedValue(sampleLink(["news"]));

    const result = await updateLinkTags("42", { tags: ["news", "News", " news "] }, { replace });

    expect(result.ok).toBe(true);
    expect(replace).toHaveBeenCalledWith("42", ["news"]);
  });

  it("accepts an empty array, clearing all tags", async () => {
    const replace = vi.fn().mockResolvedValue(sampleLink([]));

    const result = await updateLinkTags("42", { tags: [] }, { replace });

    expect(result).toEqual({ ok: true, link: sampleLink([]) });
    expect(replace).toHaveBeenCalledWith("42", []);
  });

  it(`accepts up to ${MAX_TAGS} distinct tags`, async () => {
    const tags = ["a", "b", "c", "d", "e"];
    const replace = vi.fn().mockResolvedValue(sampleLink(tags));

    const result = await updateLinkTags("42", { tags }, { replace });

    expect(result.ok).toBe(true);
    expect(replace).toHaveBeenCalledWith("42", tags);
  });

  it(`rejects more than ${MAX_TAGS} distinct tags`, async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: ["a", "b", "c", "d", "e", "f"] }, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: `A link may have at most ${MAX_TAGS} tags.` });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a non-array tags value", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: "news" }, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: "tags must be an array." });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a missing tags field", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", {}, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: "tags must be an array." });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a non-string tag entry", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: ["news", 5] }, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: "Each tag must be a string." });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a blank tag", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: ["  "] }, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: "Tags must not be blank." });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a tag with characters outside a-z0-9-", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: ["news!"] }, { replace });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Tags may only contain lowercase letters, numbers and hyphens."
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a tag containing spaces or underscores", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("42", { tags: ["to read"] }, { replace });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Tags may only contain lowercase letters, numbers and hyphens."
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns 404 when no link with that id exists", async () => {
    const replace = vi.fn().mockResolvedValue(null);

    const result = await updateLinkTags("42", { tags: ["news"] }, { replace });

    expect(result).toEqual({ ok: false, status: 404, error: "Link not found." });
  });

  it("returns 400 for a non-numeric id", async () => {
    const replace = vi.fn();

    const result = await updateLinkTags("not-a-number", { tags: ["news"] }, { replace });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns 400 for a zero id", async () => {
    const result = await updateLinkTags("0", { tags: ["news"] }, { replace: vi.fn() });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
  });

  it("returns 500 when the update fails", async () => {
    const replace = vi.fn().mockRejectedValue(new Error("connection lost"));

    const result = await updateLinkTags("42", { tags: ["news"] }, { replace });

    expect(result).toEqual({ ok: false, status: 500, error: "connection lost" });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    const replace = vi.fn().mockRejectedValue("boom");

    const result = await updateLinkTags("42", { tags: ["news"] }, { replace });

    expect(result).toEqual({ ok: false, status: 500, error: "Failed to update tags." });
  });
});
