import { describe, expect, it } from "vitest";
import { STANDARD_SLOT_DEFINITIONS } from "./db";
import { volunteerSlots } from "../drizzle/schema";

describe("standard concession volunteer roles", () => {
  it("creates only Co-Cook, Kitchen Assistant, and two Cashier slots", () => {
    expect(STANDARD_SLOT_DEFINITIONS).toEqual([
      { role: "co_cook", count: 1 },
      { role: "kitchen_assistant", count: 1 },
      { role: "cashier", count: 2 },
    ]);
    expect(STANDARD_SLOT_DEFINITIONS.reduce((total, slot) => total + slot.count, 0)).toBe(4);
  });

  it("does not allow Runner as a persisted volunteer-slot role", () => {
    expect(volunteerSlots.role.enumValues).toEqual(["co_cook", "kitchen_assistant", "cashier"]);
    expect(volunteerSlots.role.enumValues).not.toContain("runner");
  });
});
