import { describe, it, expect } from "vitest";
import { normalizeTags, MAX_TAGS } from "../../src/links/tags.js";

describe("normalizeTags", () => {
  it("exposes a max of 5 tags", () => {
    expect(MAX_TAGS).toBe(5);
  });

  it("accepts an empty array", () => {
    expect(normalizeTags([])).toEqual({ ok: true, tags: [] });
  });

  it("accepts a list of already-valid lowercase tags", () => {
    expect(normalizeTags(["news", "tech", "long-read"])).toEqual({
      ok: true,
      tags: ["news", "tech", "long-read"]
    });
  });

  it("accepts tags made of digits and hyphens", () => {
    expect(normalizeTags(["web3", "top-10", "2024"])).toEqual({
      ok: true,
      tags: ["web3", "top-10", "2024"]
    });
  });

  it("lowercases mixed- and upper-case tags", () => {
    expect(normalizeTags(["NEWS", "Tech", "lOnG-reAd"])).toEqual({
      ok: true,
      tags: ["news", "tech", "long-read"]
    });
  });

  it("trims surrounding whitespace before validating", () => {
    expect(normalizeTags(["  news  ", "\ttech\n"])).toEqual({
      ok: true,
      tags: ["news", "tech"]
    });
  });

  it("de-duplicates tags that normalize to the same value", () => {
    expect(normalizeTags(["News", "news", " NEWS "])).toEqual({
      ok: true,
      tags: ["news"]
    });
  });

  it("preserves the first-seen casing's normalized order for duplicates", () => {
    expect(normalizeTags(["b", "A", "b", "a"])).toEqual({
      ok: true,
      tags: ["b", "a"]
    });
  });

  it("rejects a non-array value", () => {
    expect(normalizeTags("news")).toEqual({ ok: false, error: "tags must be an array." });
    expect(normalizeTags(undefined)).toEqual({ ok: false, error: "tags must be an array." });
    expect(normalizeTags(null)).toEqual({ ok: false, error: "tags must be an array." });
    expect(normalizeTags({ tags: ["news"] })).toEqual({ ok: false, error: "tags must be an array." });
  });

  it("rejects a non-string tag entry", () => {
    expect(normalizeTags(["news", 42])).toEqual({ ok: false, error: "Each tag must be a string." });
  });

  it("rejects other non-string tag entry types", () => {
    for (const entry of [null, undefined, true, ["news"], { tag: "news" }]) {
      expect(normalizeTags(["news", entry])).toEqual({ ok: false, error: "Each tag must be a string." });
    }
  });

  it("rejects a blank tag", () => {
    expect(normalizeTags([""])).toEqual({ ok: false, error: "Tags must not be blank." });
    expect(normalizeTags(["   "])).toEqual({ ok: false, error: "Tags must not be blank." });
  });

  it("rejects a tag that is blank only after trimming", () => {
    expect(normalizeTags(["\t\n  \t"])).toEqual({ ok: false, error: "Tags must not be blank." });
  });

  it("rejects tags containing spaces", () => {
    expect(normalizeTags(["to read"])).toEqual({
      ok: false,
      error: "Tags may only contain lowercase letters, numbers and hyphens."
    });
  });

  it("rejects tags containing underscores", () => {
    expect(normalizeTags(["to_read"])).toEqual({
      ok: false,
      error: "Tags may only contain lowercase letters, numbers and hyphens."
    });
  });

  it("rejects tags containing other punctuation or symbols", () => {
    for (const tag of ["news!", "c++", "a/b", "café", "#trending"]) {
      expect(normalizeTags([tag])).toEqual({
        ok: false,
        error: "Tags may only contain lowercase letters, numbers and hyphens."
      });
    }
  });

  it("accepts a single-character tag", () => {
    expect(normalizeTags(["a"])).toEqual({ ok: true, tags: ["a"] });
  });

  it("accepts a purely numeric tag", () => {
    expect(normalizeTags(["2024"])).toEqual({ ok: true, tags: ["2024"] });
  });

  it("accepts exactly MAX_TAGS distinct tags", () => {
    const tags = ["a", "b", "c", "d", "e"];
    expect(normalizeTags(tags)).toEqual({ ok: true, tags });
  });

  it("rejects more than MAX_TAGS distinct tags", () => {
    const tags = ["a", "b", "c", "d", "e", "f"];
    expect(normalizeTags(tags)).toEqual({
      ok: false,
      error: `A link may have at most ${MAX_TAGS} tags.`
    });
  });

  it("does not count duplicates towards the MAX_TAGS limit", () => {
    const tags = ["a", "a", "b", "b", "c", "c"];
    expect(normalizeTags(tags)).toEqual({ ok: true, tags: ["a", "b", "c"] });
  });

  it("still rejects more than MAX_TAGS entries when they include duplicates and a trailing invalid one", () => {
    // 6 distinct-looking entries (one is a repeat), well over MAX_TAGS.
    expect(normalizeTags(["a", "b", "c", "d", "e", "a", "f"])).toEqual({
      ok: false,
      error: `A link may have at most ${MAX_TAGS} tags.`
    });
  });

  it("reports the format error for an invalid entry even when the array is over MAX_TAGS", () => {
    // The invalid tag (index 5) is validated before the overall length is
    // checked, so its format error takes precedence over the MAX_TAGS error.
    expect(normalizeTags(["a", "b", "c", "d", "e", "not valid", "f"])).toEqual({
      ok: false,
      error: "Tags may only contain lowercase letters, numbers and hyphens."
    });
  });
});
