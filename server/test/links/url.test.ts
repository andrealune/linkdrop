import { describe, expect, it } from "vitest";
import { MAX_URL_LENGTH, validateUrl } from "../../src/links/url.js";

describe("validateUrl", () => {
  it("accepts a plain https URL", () => {
    const result = validateUrl("https://example.com/page?query=1");

    expect(result.valid).toBe(true);
    expect(result.url).toBeInstanceOf(URL);
    expect(result.url?.hostname).toBe("example.com");
  });

  it("accepts a plain http URL", () => {
    const result = validateUrl("http://example.com");

    expect(result.valid).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    const result = validateUrl("  https://example.com  ");

    expect(result.valid).toBe(true);
    expect(result.url?.toString()).toBe("https://example.com/");
  });

  it("trims tabs and newlines, not just spaces", () => {
    const result = validateUrl("\t\nhttps://example.com\n\t");

    expect(result.valid).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = validateUrl("");

    expect(result).toEqual({ valid: false, error: "URL is required." });
  });

  it("rejects a value that is only whitespace", () => {
    const result = validateUrl("   ");

    expect(result).toEqual({ valid: false, error: "URL is required." });
  });

  it("rejects a non-string input", () => {
    const result = validateUrl(undefined);

    expect(result).toEqual({ valid: false, error: "URL is required." });
  });

  it("rejects other non-string input types", () => {
    for (const input of [null, 42, true, ["https://example.com"], { url: "https://example.com" }]) {
      expect(validateUrl(input)).toEqual({ valid: false, error: "URL is required." });
    }
  });

  it(`rejects a URL longer than ${MAX_URL_LENGTH} characters`, () => {
    const longUrl = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;

    const result = validateUrl(longUrl);

    expect(result).toEqual({
      valid: false,
      error: `URL must be ${MAX_URL_LENGTH} characters or fewer.`
    });
  });

  it(`accepts a URL exactly ${MAX_URL_LENGTH} characters long`, () => {
    const padding = "a".repeat(MAX_URL_LENGTH - "https://example.com/".length);
    const url = `https://example.com/${padding}`;
    expect(url.length).toBe(MAX_URL_LENGTH);

    const result = validateUrl(url);

    expect(result.valid).toBe(true);
  });

  it(`accepts a URL one character below the ${MAX_URL_LENGTH} limit`, () => {
    const padding = "a".repeat(MAX_URL_LENGTH - "https://example.com/".length - 1);
    const url = `https://example.com/${padding}`;
    expect(url.length).toBe(MAX_URL_LENGTH - 1);

    const result = validateUrl(url);

    expect(result.valid).toBe(true);
  });

  it(`rejects a URL just one character over the ${MAX_URL_LENGTH} limit`, () => {
    const padding = "a".repeat(MAX_URL_LENGTH - "https://example.com/".length + 1);
    const url = `https://example.com/${padding}`;
    expect(url.length).toBe(MAX_URL_LENGTH + 1);

    const result = validateUrl(url);

    expect(result).toEqual({
      valid: false,
      error: `URL must be ${MAX_URL_LENGTH} characters or fewer.`
    });
  });

  it("length is checked before well-formedness (a too-long, malformed URL reports the length error)", () => {
    const tooLong = `not a url ${"a".repeat(MAX_URL_LENGTH)}`;

    const result = validateUrl(tooLong);

    expect(result).toEqual({
      valid: false,
      error: `URL must be ${MAX_URL_LENGTH} characters or fewer.`
    });
  });

  it("rejects a malformed URL", () => {
    const result = validateUrl("not a url");

    expect(result).toEqual({ valid: false, error: "URL is not valid." });
  });

  it("rejects a URL missing a scheme", () => {
    const result = validateUrl("example.com/page");

    expect(result).toEqual({ valid: false, error: "URL is not valid." });
  });

  it("rejects a scheme-relative URL (//host/path)", () => {
    const result = validateUrl("//example.com/page");

    expect(result).toEqual({ valid: false, error: "URL is not valid." });
  });

  it("rejects an http(s) URL with no host", () => {
    const result = validateUrl("https://");

    expect(result).toEqual({ valid: false, error: "URL is not valid." });
  });

  it("rejects a URL with a port number out of range", () => {
    const result = validateUrl("https://example.com:99999");

    expect(result).toEqual({ valid: false, error: "URL is not valid." });
  });

  it("rejects non-http(s) schemes such as javascript:", () => {
    const result = validateUrl("javascript:alert(1)");

    expect(result).toEqual({
      valid: false,
      error: "URL must start with http:// or https://."
    });
  });

  it("rejects non-http(s) schemes such as ftp:", () => {
    const result = validateUrl("ftp://example.com/file.txt");

    expect(result).toEqual({
      valid: false,
      error: "URL must start with http:// or https://."
    });
  });

  it("rejects non-http(s) schemes such as mailto:", () => {
    const result = validateUrl("mailto:someone@example.com");

    expect(result).toEqual({
      valid: false,
      error: "URL must start with http:// or https://."
    });
  });

  it("accepts an uppercase scheme, case-insensitively", () => {
    const result = validateUrl("HTTPS://Example.com/Page");

    expect(result.valid).toBe(true);
    expect(result.url?.protocol).toBe("https:");
  });
});
