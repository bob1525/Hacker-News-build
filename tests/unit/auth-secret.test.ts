import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAuthSecret, authSecretProblem, enforceAuthSecretOrExit, MIN_AUTH_SECRET_LENGTH } from "@/lib/auth-secret";
import { signSession } from "@/lib/session-token";

const VALID = "unit-test-secret-key-not-for-production";
const E2E = "e2e-secret-key-not-for-production-use";

describe("AUTH_SECRET startup checks", () => {
  const previous = process.env.AUTH_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  });

  it("rejects a missing secret", () => {
    expect(authSecretProblem(undefined)).toMatch(/missing/i);
    expect(authSecretProblem("   ")).toMatch(/missing/i);
  });

  it("rejects the example placeholder even though it is long", () => {
    expect(authSecretProblem("CHANGE_ME_TO_A_LONG_RANDOM_STRING")).toMatch(/placeholder/i);
    expect(authSecretProblem("replace-with-a-long-random-string")).toMatch(/placeholder/i);
  });

  it("rejects the old built-in fallback instead of signing with it", () => {
    expect(authSecretProblem("dev-hacker-news-secret-change-me-please")).toMatch(/placeholder/i);
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(authSecretProblem("x".repeat(MIN_AUTH_SECRET_LENGTH - 1))).toMatch(/too short/i);
    expect(authSecretProblem("short-local-demo-secret-value")).toMatch(/too short/i);
  });

  it("accepts a 32 character secret and the secrets used by tests", () => {
    expect(authSecretProblem("x".repeat(MIN_AUTH_SECRET_LENGTH))).toBeNull();
    expect(authSecretProblem(VALID)).toBeNull();
    expect(authSecretProblem(E2E)).toBeNull();
    expect(VALID.length).toBeGreaterThanOrEqual(MIN_AUTH_SECRET_LENGTH);
    expect(E2E.length).toBeGreaterThanOrEqual(MIN_AUTH_SECRET_LENGTH);
  });

  it("throws from assertAuthSecret and does not throw for a real secret", () => {
    expect(() => assertAuthSecret(undefined)).toThrow(/AUTH_SECRET/);
    expect(() => assertAuthSecret(VALID)).not.toThrow();
  });

  it("exits the process when the secret is unusable", () => {
    const write = vi.fn();
    const exit = vi.fn((code: number) => {
      throw new Error(`exit:${code}`);
    }) as unknown as (code: number) => never;
    expect(() => enforceAuthSecretOrExit("CHANGE_ME_TO_A_LONG_RANDOM_STRING", exit, write)).toThrow("exit:1");
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/placeholder/i));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does not exit when the secret is usable", () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    enforceAuthSecretOrExit(VALID, exit, vi.fn());
    expect(exit).not.toHaveBeenCalled();
  });

  it("refuses to sign a session when AUTH_SECRET is unset", async () => {
    delete process.env.AUTH_SECRET;
    await expect(signSession("user_123")).rejects.toThrow(/AUTH_SECRET/);
  });
});
