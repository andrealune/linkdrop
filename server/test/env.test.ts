import { describe, expect, it, vi } from "vitest";
import { assertAdminTokenPresent, parseCorsOrigin } from "../src/env.js";

describe("assertAdminTokenPresent", () => {
  it("logs and exits with code 1 when LINKDROP_ADMIN_TOKEN is missing", () => {
    const exit = vi.fn();
    const log = vi.fn();

    assertAdminTokenPresent({ LINKDROP_ADMIN_TOKEN: undefined }, exit, log);

    expect(log).toHaveBeenCalledWith("LINKDROP_ADMIN_TOKEN not set");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("logs and exits with code 1 when LINKDROP_ADMIN_TOKEN is an empty string", () => {
    const exit = vi.fn();
    const log = vi.fn();

    assertAdminTokenPresent({ LINKDROP_ADMIN_TOKEN: "" }, exit, log);

    expect(log).toHaveBeenCalledWith("LINKDROP_ADMIN_TOKEN not set");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does nothing when LINKDROP_ADMIN_TOKEN is set", () => {
    const exit = vi.fn();
    const log = vi.fn();

    assertAdminTokenPresent({ LINKDROP_ADMIN_TOKEN: "secret-token" }, exit, log);

    expect(log).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("parseCorsOrigin", () => {
  it("returns an empty allow-list when CORS_ORIGIN is unset", () => {
    expect(parseCorsOrigin(undefined)).toEqual([]);
  });

  it("returns an empty allow-list when CORS_ORIGIN is blank", () => {
    expect(parseCorsOrigin("   ")).toEqual([]);
  });

  it('returns "*" unchanged', () => {
    expect(parseCorsOrigin("*")).toBe("*");
  });

  it("splits a single origin into a one-element list", () => {
    expect(parseCorsOrigin("https://example.com")).toEqual(["https://example.com"]);
  });

  it("splits a comma separated list of origins, trimming whitespace", () => {
    expect(parseCorsOrigin("https://a.example, https://b.example ,https://c.example")).toEqual([
      "https://a.example",
      "https://b.example",
      "https://c.example"
    ]);
  });

  it("throws for a value that is only commas", () => {
    expect(() => parseCorsOrigin(",,,")).toThrow(/Invalid CORS_ORIGIN value/);
  });
});
