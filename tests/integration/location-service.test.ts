import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { LocationService } from "../../src/services/location-service";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const service = new LocationService({ db: db as unknown as D1Database, audit, clock });
  return { db, clock, audit, service };
}

describe("LocationService", () => {
  it("proposes a location, then activates it", async () => {
    const { service } = setup();
    const loc = await service.propose({
      chapterId: "chap_melbourne",
      name: "Gertrude Street Gallery",
      suburb: "Fitzroy",
      address: "146 Gertrude St",
      sourceUrl: "https://example.com/gertrude",
      locationType: "gallery",
      tags: ["gallery", "fitzroy"],
    });
    expect(loc.status).toBe("REVERIFY_DUE");
    await service.activate(loc.id, "operator_1");
    const after = await service.get(loc.id);
    expect(after?.status).toBe("ACTIVE");
  });

  it("retire removes the location from the active set", async () => {
    const { service } = setup();
    const loc = await service.propose({
      chapterId: "chap_melbourne",
      name: "Old Place",
    });
    await service.activate(loc.id, "operator_1");
    await service.retire(loc.id, "operator_1", "Closed permanently");
    const after = await service.get(loc.id);
    expect(after?.status).toBe("RETIRED");
  });
});
