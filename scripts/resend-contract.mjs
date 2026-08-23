#!/usr/bin/env node
// Resend provider contract test (CREDENTIALLED, separate from default
// acceptance). This is NOT part of `mise run acceptance`. It is run
// via `mise run contracts` when real Resend credentials are present.
//
// What it verifies against the live Resend API:
//   1. Authentication: a GET against /domains succeeds with the
//      configured API key.
//   2. Webhook verification assumptions: the documented Svix-style
//      signature algorithm round-trips on the configured webhook
//      signing secret (provided as env).
//   3. Received email metadata retrieval: GET /emails/receiving/{id}
//      returns the documented shape for an email_id known to the
//      account (the test does not invent a fake id).
//   4. Received email body retrieval: same call returns html/text.
//
// Required env:
//   RESEND_API_KEY                — real Resend API key
//   RESEND_WEBHOOK_SIGNING_SECRET — real signing secret
// Optional env:
//   RESEND_EMAIL_ID               — a known received email id to probe
//                                   metadata + body fetch
//   RESEND_BASE_URL               — override the default
//                                   https://api.resend.com (useful for
//                                   staging)

import { Webhook } from "svix";

const apiKey = process.env.RESEND_API_KEY;
const signingSecret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
const baseUrl = process.env.RESEND_BASE_URL ?? "https://api.resend.com";
const probeEmailId = process.env.RESEND_EMAIL_ID;

if (!apiKey || !signingSecret) {
  console.error("RESEND_API_KEY and RESEND_WEBHOOK_SIGNING_SECRET are required.");
  process.exit(2);
}

async function callResend(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.info(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

// 1. Authentication.
{
  const r = await callResend("/domains");
  if (r.status === 401 || r.status === 403) {
    record("authentication", false, `Resend rejected the API key (${r.status})`);
    process.exit(1);
  }
  if (r.status >= 200 && r.status < 300) {
    record("authentication", true, `GET /domains -> ${r.status}`);
  } else {
    record("authentication", false, `unexpected status ${r.status}`);
  }
}

// 2. Webhook signature round-trip.
{
  const wh = new Webhook(signingSecret);
  const msgId = `msg_test_${Date.now()}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({ type: "email.received", test: true });
  const signature = wh.sign(msgId, new Date(parseInt(ts, 10) * 1000), payload);
  let verified = false;
  try {
    wh.verify(payload, {
      "svix-id": msgId,
      "svix-timestamp": ts,
      "svix-signature": signature,
    });
    verified = true;
  } catch (err) {
    record(
      "webhook signature round-trip",
      false,
      `verify() threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (verified) {
    record("webhook signature round-trip", true, "Svix verify() accepted our signature");
  }
}

// 3 + 4. Received email metadata + body (only if we have a known id).
if (probeEmailId) {
  const r = await callResend(`/emails/receiving/${encodeURIComponent(probeEmailId)}`);
  if (r.status === 200 && r.json && typeof r.json === "object") {
    const fields = ["id", "from", "to", "subject"];
    const missing = fields.filter((f) => !(f in r.json));
    if (missing.length === 0) {
      record(
        "received email metadata shape",
        true,
        `id/from/to/subject present (${Object.keys(r.json).length} keys)`,
      );
    } else {
      record("received email metadata shape", false, `missing fields: ${missing.join(", ")}`);
    }
    if ("html" in r.json || "text" in r.json) {
      record("received email body fetch", true, "html or text body present in the response");
    } else {
      record("received email body fetch", false, "neither html nor text field present in response");
    }
  } else {
    record("received email fetch", false, `GET /emails/receiving/${probeEmailId} -> ${r.status}`);
  }
} else {
  console.info("(skipped received-email fetch — set RESEND_EMAIL_ID to enable)");
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\nResend contract: ${failed.length} failure(s).`);
  process.exit(1);
}
console.info(`\nResend contract: ${results.length} checks passed.`);
