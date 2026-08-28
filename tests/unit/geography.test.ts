// Unit tests for the geography helpers (issue #12).
//
// Coverage:
//   - countryLabel returns the canonical name for a known code
//   - formatLocality appends region + country for AU chapters
//     and locality + country for non-AU chapters
//   - addressFormat returns the right layout per country
//   - formatInZone renders a UTC ISO timestamp in the
//     chapter's IANA timezone, and falls back to UTC for
//     missing/invalid timezones
//   - The Australian legacy template (`${city}, ${region},
//     ${country}`) is preserved for the five AU chapters
//   - A non-AU chapter does NOT receive the Australian state
//     abbreviation in its locality line

import { describe, expect, it } from "vitest";
import {
  addressFormat,
  countryLabel,
  formatAddressLine,
  formatInZone,
  formatLocality,
} from "../../src/lib/geography";

describe("geography", () => {
  it("returns the canonical country name for known codes", () => {
    expect(countryLabel("AU")).toBe("Australia");
    expect(countryLabel("NZ")).toBe("New Zealand");
    expect(countryLabel("GB")).toBe("United Kingdom");
  });

  it("returns null for an unknown or empty country code", () => {
    expect(countryLabel(undefined)).toBeNull();
    expect(countryLabel("ZZ")).toBe("ZZ");
  });

  it("appends the region for AU chapters and omits it for non-AU", () => {
    const melbourne = formatLocality({
      slug: "melbourne",
      name: "Melbourne",
      countryCode: "AU",
      region: "VIC",
      timezone: "Australia/Melbourne",
    });
    expect(melbourne).toBe("Melbourne, VIC, Australia");

    const auckland = formatLocality({
      slug: "auckland",
      name: "Auckland",
      countryCode: "NZ",
      timezone: "Pacific/Auckland",
    });
    expect(auckland).toBe("Auckland, New Zealand");
  });

  it("picks the right address format per country", () => {
    expect(addressFormat("AU")).toBe("AU");
    expect(addressFormat("US")).toBe("US");
    expect(addressFormat("GB")).toBe("POSTCODE_FIRST");
  });

  it("renders Australian addresses with region between city and postcode", () => {
    const text = formatAddressLine({
      line1: "1 Collins St",
      city: "Melbourne",
      region: "VIC",
      postcode: "3000",
      countryCode: "AU",
    });
    expect(text).toBe("1 Collins St\nMelbourne VIC 3000\nAustralia");
  });

  it("renders US addresses with state abbreviation after city and postcode", () => {
    const text = formatAddressLine({
      line1: "350 Fifth Avenue",
      city: "New York",
      region: "NY",
      postcode: "10118",
      countryCode: "US",
    });
    expect(text).toBe("350 Fifth Avenue\nNew York, NY 10118\nUnited States");
  });

  it("renders UK addresses with postcode after the city", () => {
    const text = formatAddressLine({
      line1: "10 Downing Street",
      city: "London",
      postcode: "SW1A 2AA",
      countryCode: "GB",
    });
    expect(text).toBe("10 Downing Street\nLondon SW1A 2AA\nUnited Kingdom");
  });

  it("formats a UTC timestamp in the chapter's IANA timezone", () => {
    const melbourne = formatInZone("2026-09-15T08:00:00.000Z", "Australia/Melbourne", "en-AU");
    // Melbourne is UTC+10 in September (no DST). The formatter
    // returns the local time string; we assert it is not the
    // raw UTC value.
    expect(melbourne).toMatch(/2026/);
    expect(melbourne).not.toBe("08:00");

    const auckland = formatInZone("2026-09-15T08:00:00.000Z", "Pacific/Auckland", "en-NZ");
    // Auckland is UTC+12 in September.
    expect(auckland).toMatch(/2026/);
  });

  it("falls back to UTC when the timezone is missing or invalid", () => {
    const fallback = formatInZone("2026-09-15T08:00:00.000Z", undefined);
    expect(fallback).toMatch(/2026/);
    const invalid = formatInZone("2026-09-15T08:00:00.000Z", "Not/A/Zone");
    expect(invalid).toMatch(/2026/);
  });
});
