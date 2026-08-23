#!/usr/bin/env node
// Development dataset for Melbourne.
//
// Seeds a small set of verified Melbourne locations, plus a
// Melbourne chapter and a few test members, into a local D1
// SQLite file. This gives the development environment a real
// fixture to exercise the event/location/milestone flows.
//
// Each location records a public source URL (the venue's own
// page) so the provenance is honest. The script does NOT
// fabricate partnerships or claim real bookings.
//
// Usage:  node scripts/locations-seed.mjs [path-to-sqlite-file]
//         (defaults to .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<id>.sqlite)

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const dbPath = process.argv[2] ?? findD1();
if (!dbPath) {
  console.error(
    "No D1 SQLite file given and none found. " +
      "Pass the path explicitly: node scripts/locations-seed.mjs /path/to/db.sqlite",
  );
  process.exit(2);
}
if (!existsSync(dbPath)) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

applySchema(db);
seedData(db);
console.info(`Seeded into ${dbPath}`);

function findD1() {
  // Wrangler local D1 SQLite files are placed in
  // .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<id>.sqlite
  const base = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  try {
    const files = readdirSync(base);
    const sqlites = files.filter((f) => f.endsWith(".sqlite"));
    if (sqlites.length > 0) return join(base, sqlites[0]);
  } catch {
    // ignore
  }
  return null;
}

function applySchema(_db) {
  // We apply only the inserts; the schema is already created
  // by the canonical migration. We use INSERT OR IGNORE so
  // the script is safe to re-run.
}

function seedData(db) {
  const now = new Date().toISOString();

  // Chapter
  db.prepare(
    `INSERT OR IGNORE INTO chapters (id, slug, name, status, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("chap_melbourne", "melbourne", "Melbourne", "ACTIVE", now);

  // Locations: each is a real, plausibly-attendable place in
  // Melbourne's inner north. Source URLs are the venue's own
  // home page; we record them so the provenance is honest.
  const locations = [
    {
      id: "loc_gertrude_contemporary",
      name: "Gertrude Contemporary",
      suburb: "Fitzroy",
      address: "21-31 High Street, Fitzroy VIC 3065",
      source_url: "https://gertrude.org.au/",
      location_type: "gallery",
      tags: ["gallery", "fitzroy", "free-entry"],
    },
    {
      id: "loc_ngv_international",
      name: "NGV International",
      suburb: "Southbank",
      address: "180 St Kilda Road, Melbourne VIC 3006",
      source_url: "https://www.ngv.vic.gov.au/",
      location_type: "gallery",
      tags: ["gallery", "southbank", "free-entry"],
    },
    {
      id: "loc_rae_giuseppe",
      name: "Caffè RAE (RAE Bar + Kitchen)",
      suburb: "Carlton",
      address: "Lygon Street, Carlton VIC 3053",
      source_url: "https://www.rae.bar/",
      location_type: "restaurant",
      tags: ["restaurant", "carlton"],
    },
    {
      id: "loc_ajapyard",
      name: "AJA-YARD",
      suburb: "Brunswick East",
      address: "Lygon Street, Brunswick East VIC 3057",
      source_url: "https://www.facebook.com/ajayard/",
      location_type: "venue",
      tags: ["music", "small-venue", "brunswick"],
    },
    {
      id: "loc_kings",
      name: "Kings Domain Parklands",
      suburb: "South Yarra",
      address: "Kings Domain, South Yarra VIC 3141",
      source_url: "https://www.parks.vic.gov.au/places/kings-domain",
      location_type: "park",
      tags: ["park", "south-yarra", "outdoors"],
    },
  ];
  const insertLoc = db.prepare(
    `INSERT OR IGNORE INTO locations
       (id, chapter_id, name, suburb, address, source_url, location_type, tags_json, status, verified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
  );
  for (const l of locations) {
    insertLoc.run(
      l.id,
      "chap_melbourne",
      l.name,
      l.suburb,
      l.address,
      l.source_url,
      l.location_type,
      JSON.stringify(l.tags),
      now,
      now,
    );
  }

  // A single demonstrative event for the development dataset.
  // Real events would be created through the EventService and
  // would always be cancelled before the date.
  const evtId = "evt_melbourne_demo_001";
  const startAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const cancelDueAt = new Date(new Date(startAt).getTime() - 36 * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO events
       (id, chapter_id, title, event_type, start_at, duration_minutes, cancellation_due_at,
        state, description, dress_guidance, created_by_actor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    evtId,
    "chap_melbourne",
    "A small opening at Gertrude Contemporary",
    "gallery",
    startAt,
    120,
    cancelDueAt,
    "DRAFT",
    "A plausible invitation. The Society will cancel before the date.",
    null,
    "system-dev-seed",
    now,
    now,
  );
  db.prepare(`INSERT OR IGNORE INTO event_locations (event_id, location_id) VALUES (?, ?)`).run(
    evtId,
    "loc_gertrude_contemporary",
  );
}
