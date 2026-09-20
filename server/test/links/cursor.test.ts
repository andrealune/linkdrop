import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../src/links/cursor.js";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a record's id and created_at", () => {
    const record = { id: "42", created_at: new Date("2024-03-01T12:34:56.000Z") };

    const cursor = encodeCursor(record);
    const result = decodeCursor(cursor);

    expect(result).toEqual({
      ok: true,
      cursor: { id: "42", createdAt: new Date("2024-03-01T12:34:56.000Z") }
    });
  });

  it("produces an opaque, URL-safe string", () => {
    const cursor = encodeCursor({ id: "1", created_at: new Date("2024-01-01T00:00:00.000Z") });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns cursor: null when no cursor is supplied", () => {
    expect(decodeCursor(undefined)).toEqual({ ok: true, cursor: null });
  });

  it("rejects a non-string cursor", () => {
    expect(decodeCursor(["a", "b"])).toEqual({
      ok: false,
      error: "cursor must be a non-empty string."
    });
  });

  it("rejects an empty string cursor", () => {
    expect(decodeCursor("")).toEqual({
      ok: false,
      error: "cursor must be a non-empty string."
    });
  });

  it("rejects a cursor that isn't valid base64url/JSON", () => {
    expect(decodeCursor("not-a-real-cursor!!!")).toEqual({
      ok: false,
      error: "cursor is not valid."
    });
  });

  it("rejects a cursor decoding to JSON missing id/created_at", () => {
    const malformed = Buffer.from(JSON.stringify({ foo: "bar" }), "utf8").toString("base64url");

    expect(decodeCursor(malformed)).toEqual({
      ok: false,
      error: "cursor is not valid."
    });
  });

  it("rejects a cursor with an unparsable created_at", () => {
    const malformed = Buffer.from(JSON.stringify({ id: "1", created_at: "not-a-date" }), "utf8").toString(
      "base64url"
    );

    expect(decodeCursor(malformed)).toEqual({
      ok: false,
      error: "cursor is not valid."
    });
  });
});
