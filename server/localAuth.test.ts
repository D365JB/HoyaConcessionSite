import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./localAuth";

describe("local password authentication", () => {
  it("stores a salted hash rather than the raw password", async () => {
    const password = "A secure password for testing";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  });

  it("accepts the original password and rejects an incorrect password", async () => {
    const hash = await hashPassword("A secure password for testing");
    await expect(verifyPassword("A secure password for testing", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
