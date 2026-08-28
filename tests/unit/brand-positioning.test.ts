// Unit tests for the brand positioning refactor (issue #11).
//
// Asserts that the new product positioning makes the
// scheduled-commitment/cancellation premise and the calendar-
// protection use case explicit in the canonical surfaces
// (homepage, membership, how-it-works) without removing the
// cancellation joke entirely.

import { describe, expect, it } from "vitest";
import { brand } from "../../src/brand/config";

describe("brand positioning (issue #11)", () => {
  it("carries a short proposition that mentions scheduled commitment and cancellation", () => {
    expect(brand.shortProposition).toMatch(/commitment/i);
    expect(brand.shortProposition).toMatch(/cancel/i);
  });

  it("frames the Member tier around calendar protection and credible email", () => {
    const member = brand.tiers.member;
    expect(member.tagline).toMatch(/commitment|calendar|credible/i);
    const joined = member.includes.join(" ");
    expect(joined).toMatch(/calendar/i);
    expect(joined).toMatch(/cancel/i);
  });

  it("frames the Corresponding tier around human validation", () => {
    const corresponding = brand.tiers.corresponding;
    expect(corresponding.tagline).toMatch(/human|letter|valid/i);
    const joined = corresponding.includes.join(" ");
    expect(joined).toMatch(/letter|sign/i);
  });

  it("frames the Deluxe tier around physical evidence and presence", () => {
    const deluxe = brand.tiers.deluxe;
    expect(deluxe.tagline).toMatch(/physical|present|evidence/i);
    const joined = deluxe.includes.join(" ");
    expect(joined).toMatch(/parcel|gift|present/i);
  });
});
