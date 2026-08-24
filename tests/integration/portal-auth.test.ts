import { describe, expect, it } from "vitest";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { requireOnboardingSession, requireOperator } from "../../src/lib/portal-auth";
import { isSameOriginMutation } from "../../src/lib/request-security";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  return db;
}

function addMember(
  db: MockD1Database,
  input: {
    id: string;
    email: string;
    membershipState: string;
    sessionId: string;
    expiresAt?: string;
    revokedAt?: string | null;
  },
) {
  db.insert("members", {
    id: input.id,
    email: input.email,
    preferred_name: input.id,
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: null,
    birthday: null,
    timezone: "Australia/Melbourne",
    created_at: "2026-08-15T10:00:00.000Z",
  });
  db.insert("memberships", {
    id: `mship_${input.id}`,
    member_id: input.id,
    tier_id: null,
    state: input.membershipState,
    created_at: "2026-08-15T10:00:00.000Z",
  });
  db.insert("member_sessions", {
    id: input.sessionId,
    member_id: input.id,
    created_at: "2026-08-15T10:00:00.000Z",
    expires_at: input.expiresAt ?? "2099-01-01T00:00:00.000Z",
    revoked_at: input.revokedAt ?? null,
  });
}

function requestFor(sessionId: string): Request {
  return new Request("https://club.loftwah.com/onboarding/identity/", {
    headers: { cookie: `society_session=${encodeURIComponent(sessionId)}` },
  });
}

describe("central operator boundary", () => {
  it("allows only a valid session whose member email is OPERATOR_EMAIL", async () => {
    const db = setup();
    addMember(db, {
      id: "mem_operator",
      email: "Operator@example.com",
      membershipState: "ACTIVE",
      sessionId: "ses_operator",
    });
    addMember(db, {
      id: "mem_member",
      email: "member@example.com",
      membershipState: "ACTIVE",
      sessionId: "ses_member",
    });

    const env = { DB: db as never, OPERATOR_EMAIL: " operator@example.com " };
    await expect(requireOperator(requestFor("ses_operator"), env)).resolves.toMatchObject({
      operatorEmail: "operator@example.com",
      member: { id: "mem_operator" },
    });
    await expect(requireOperator(requestFor("ses_member"), env)).resolves.toBeNull();
    await expect(requireOperator(requestFor("tampered"), env)).resolves.toBeNull();
  });

  it("fails closed when OPERATOR_EMAIL is not configured", async () => {
    const db = setup();
    addMember(db, {
      id: "mem_operator",
      email: "operator@example.com",
      membershipState: "ACTIVE",
      sessionId: "ses_operator",
    });
    await expect(
      requireOperator(requestFor("ses_operator"), { DB: db as never }),
    ).resolves.toBeNull();
  });
});

describe("onboarding ownership boundary", () => {
  it("rejects a cross-origin onboarding mutation signal", () => {
    const request = new Request("https://club.loftwah.com/api/onboarding/identity", {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("binds to the authenticated member, never the latest applicant", async () => {
    const db = setup();
    addMember(db, {
      id: "mem_first",
      email: "first@example.com",
      membershipState: "APPLICANT",
      sessionId: "ses_first",
    });
    addMember(db, {
      id: "mem_latest",
      email: "latest@example.com",
      membershipState: "APPLICANT",
      sessionId: "ses_latest",
    });

    const context = await requireOnboardingSession(requestFor("ses_first"), { DB: db as never });
    expect(context?.member.id).toBe("mem_first");
    expect(context?.membershipState).toBe("APPLICANT");
  });

  it.each([
    ["expired", { expiresAt: "2000-01-01T00:00:00.000Z" }],
    ["revoked", { revokedAt: "2026-08-15T10:00:01.000Z" }],
  ])("rejects a %s capability", async (_label, session) => {
    const db = setup();
    addMember(db, {
      id: "mem_applicant",
      email: "applicant@example.com",
      membershipState: "APPLICANT",
      sessionId: "ses_applicant",
      ...session,
    });
    await expect(
      requireOnboardingSession(requestFor("ses_applicant"), { DB: db as never }),
    ).resolves.toBeNull();
  });

  it("rejects a malformed or tampered capability and active members", async () => {
    const db = setup();
    addMember(db, {
      id: "mem_active",
      email: "active@example.com",
      membershipState: "ACTIVE",
      sessionId: "ses_active",
    });
    await expect(
      requireOnboardingSession(requestFor("unknown"), { DB: db as never }),
    ).resolves.toBeNull();
    await expect(
      requireOnboardingSession(
        new Request("https://club.loftwah.com/onboarding/identity/", {
          headers: { cookie: "society_session=%ZZ" },
        }),
        { DB: db as never },
      ),
    ).resolves.toBeNull();
    await expect(
      requireOnboardingSession(requestFor("ses_active"), { DB: db as never }),
    ).resolves.toBeNull();
  });
});
