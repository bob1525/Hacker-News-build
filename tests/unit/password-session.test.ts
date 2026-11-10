import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { readSession, signSession } from "@/lib/session-token";
import { pickVoters } from "@/lib/domain/voters";

describe("passwords and sessions", () => {
  it("hashes a password so the right one verifies and the wrong one does not", async () => {
    const stored = await hashPassword("news12345");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("news12345", stored)).toBe(true);
    expect(await verifyPassword("different", stored)).toBe(false);
    expect(await verifyPassword("news12345", "nope")).toBe(false);
    const again = await hashPassword("news12345");
    expect(again).not.toBe(stored);
  });

  it("round-trips a session token and rejects garbage", async () => {
    process.env.AUTH_SECRET = "unit-test-secret-key-not-for-production";
    const token = await signSession("user_123");
    expect(await readSession(token)).toBe("user_123");
    expect(await readSession(`${token}tampered`)).toBeNull();
    expect(await readSession("not-a-token")).toBeNull();
  });
});

describe("seed voters", () => {
  const people = ["pg", "dang", "nash", "rvn"];

  it("never includes the author and stays inside the pool", () => {
    const voters = pickVoters(people, "rvn", 10, 1);
    expect(voters).not.toContain("rvn");
    expect(new Set(voters).size).toBe(voters.length);
    expect(voters.length).toBe(3);
  });

  it("is deterministic for the same salt", () => {
    expect(pickVoters(people, "pg", 2, 4)).toEqual(pickVoters(people, "pg", 2, 4));
    expect(pickVoters(people, "pg", 0, 4)).toEqual([]);
  });
});
