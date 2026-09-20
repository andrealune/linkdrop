import { describe, expect, it, vi } from "vitest";
import { deleteLink } from "../../src/links/deleteLink.js";

/**
 * Unit coverage for the deleteLink() business logic (LAR-26): id
 * well-formedness, the "not found" case, and error handling. The actual
 * DELETE FROM SQL lives in src/links/repository.ts (see
 * test/links/repository.test.ts) and is injected here via `remove` —
 * mirroring the createLink()/insertLink() split in createLink.test.ts.
 * Authentication is a separate concern, covered by test/auth.test.ts and
 * exercised end-to-end in test/links/deleteLinks.test.ts.
 */
describe("deleteLink", () => {
  it("returns ok when the link is deleted", async () => {
    const remove = vi.fn().mockResolvedValue(true);

    const result = await deleteLink("42", { remove });

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith("42");
  });

  it("returns 404 when no link with that id exists", async () => {
    const remove = vi.fn().mockResolvedValue(false);

    const result = await deleteLink("42", { remove });

    expect(result).toEqual({ ok: false, status: 404, error: "Link not found." });
  });

  it("returns 400 for a non-numeric id", async () => {
    const remove = vi.fn();

    const result = await deleteLink("not-a-number", { remove });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
    expect(remove).not.toHaveBeenCalled();
  });

  it("returns 400 for a zero id", async () => {
    const result = await deleteLink("0", { remove: vi.fn() });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
  });

  it("returns 400 for a negative id", async () => {
    const result = await deleteLink("-1", { remove: vi.fn() });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
  });

  it("returns 400 for an id with leading zeros", async () => {
    const result = await deleteLink("007", { remove: vi.fn() });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
  });

  it("returns 400 for an id containing non-digit characters", async () => {
    const result = await deleteLink("12a", { remove: vi.fn() });

    expect(result).toEqual({ ok: false, status: 400, error: "id must be a positive integer." });
  });

  it("returns 500 when the delete fails", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("connection lost"));

    const result = await deleteLink("42", { remove });

    expect(result).toEqual({ ok: false, status: 500, error: "connection lost" });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    const remove = vi.fn().mockRejectedValue("boom");

    const result = await deleteLink("42", { remove });

    expect(result).toEqual({ ok: false, status: 500, error: "Failed to delete link." });
  });
});
