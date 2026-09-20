import { describe, expect, it, vi } from "vitest";
import { assertAdminTokenPresent } from "../src/env.js";

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
