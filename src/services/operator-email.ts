// Operator task email templates.
//
// Polished HTML + text templates for the human operator. Each
// template carries sufficient context and a direct authenticated
// action link (signed token, not a password-protected URL).
//
// In production, these are sent via Resend with the configured
// RESEND_FROM address and idempotency keys.

import { brand } from "../brand/config.js";

function wrap(title: string, body: string): string {
  return `<!doctype html>
<html><body style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; line-height: 1.6; max-width: 36rem; margin: 0 auto; padding: 2rem 1rem;">
<p style="font-size:12px;color:#666">${escape(brand.shortName)} · operator task</p>
<h1 style="font-family: 'Iowan Old Style', Palatino, Georgia, serif; font-weight: 400; font-size: 1.6rem; margin: 0 0 1rem;">${escape(title)}</h1>
${body}
<hr style="border:none;border-top:1px solid #e8e3d2;margin:2rem 0;" />
<p style="font-size:11px;color:#666">
  Direct action link: <a href="{{ACTION_URL}}">{{ACTION_LABEL}}</a><br />
  This email is the task. Mark complete in the admin to silence the reminder.
</p>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PrintAndSignInput {
  readonly memberName: string;
  readonly memberNumber: string;
  readonly artefactType:
    "welcome_letter" | "birthday_card" | "anniversary_letter" | "milestone_artefact";
  readonly trigger: string;
  readonly actionUrl: string;
  readonly notes?: string;
}

export function renderPrintAndSignEmail(input: PrintAndSignInput): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `[${brand.shortName}] print + sign: ${input.artefactType.replace(/_/g, " ")} for ${input.memberName}`;
  const title = "Print and sign: a member artefact";
  const body = `
<p>Hello,</p>
<p>Please print and sign the following artefact for member <strong>${escape(input.memberName)}</strong> (${escape(input.memberNumber)}).</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">Type</td><td>${escape(input.artefactType.replace(/_/g, " "))}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Trigger</td><td>${escape(input.trigger)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Direct action</td><td><a href="${escape(input.actionUrl)}">${escape(input.actionUrl)}</a></td></tr>
${input.notes ? `<tr><td style="padding:0.4rem 0;color:#666;">Notes</td><td>${escape(input.notes)}</td></tr>` : ""}
</table>
<p>After signing, dispatch via the physical-mail workflow. The task closes when the operator marks it complete in the admin.</p>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nPlease print and sign the artefact.\n\nMember: ${input.memberName} (${input.memberNumber})\nType: ${input.artefactType.replace(/_/g, " ")}\nTrigger: ${input.trigger}\nAction: ${input.actionUrl}\n${input.notes ? `Notes: ${input.notes}\n` : ""}`;
  return { subject, html, text };
}

export interface CallInput {
  readonly memberName: string;
  readonly purpose: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly briefing: string;
  readonly actionUrl: string;
}

export function renderCallEmail(input: CallInput): { html: string; text: string; subject: string } {
  const subject = `[${brand.shortName}] call ${input.memberName}: ${input.purpose}`;
  const title = "Call a member";
  const body = `
<p>Hello,</p>
<p>Call member <strong>${escape(input.memberName)}</strong> for the purpose <em>${escape(input.purpose)}</em>.</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">Allowed window</td><td>${escape(input.windowStart)} → ${escape(input.windowEnd)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Action</td><td><a href="${escape(input.actionUrl)}">Mark call outcome</a></td></tr>
</table>
<h3 style="font-family: 'Iowan Old Style', Palatino, Georgia, serif; font-weight: 400; font-size: 1.1rem; margin: 1.5rem 0 0.5rem;">Briefing</h3>
<pre style="background:#e8e3d2;padding:1rem;border-radius:3px;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:0.85em;">${escape(input.briefing)}</pre>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nCall ${input.memberName} for ${input.purpose}.\nAllowed window: ${input.windowStart} → ${input.windowEnd}\nAction: ${input.actionUrl}\n\nBriefing:\n${input.briefing}\n`;
  return { subject, html, text };
}

export interface GiftInput {
  readonly memberName: string;
  readonly occasion: string;
  readonly budgetAud: number;
  readonly suggestion: string;
  readonly actionUrl: string;
}

export function renderGiftSelectionEmail(input: GiftInput): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `[${brand.shortName}] gift: ${input.occasion} for ${input.memberName}`;
  const title = "Select, approve, and dispatch a gift";
  const body = `
<p>Hello,</p>
<p>Select and approve a gift for member <strong>${escape(input.memberName)}</strong> for <em>${escape(input.occasion)}</em>.</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">Budget</td><td>A$${input.budgetAud.toFixed(2)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">AI suggestion</td><td>${escape(input.suggestion)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Action</td><td><a href="${escape(input.actionUrl)}">Approve or choose another</a></td></tr>
</table>
<p>The Society does not independently make expensive purchases. Your approval is required.</p>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nSelect and approve a gift for ${input.memberName} (${input.occasion}). Budget A$${input.budgetAud.toFixed(2)}.\nAI suggestion: ${input.suggestion}\nAction: ${input.actionUrl}\n`;
  return { subject, html, text };
}

export interface InboundReviewInput {
  readonly fromAddress: string;
  readonly subject: string;
  readonly snippet: string;
  readonly inboundId: string;
  readonly actionUrl: string;
}

export function renderInboundReviewEmail(input: InboundReviewInput): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `[${brand.shortName}] inbound email: ${input.fromAddress}`;
  const title = "Inbound email awaiting review";
  const body = `
<p>Hello,</p>
<p>An inbound email requires your review.</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">From</td><td>${escape(input.fromAddress)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Subject</td><td>${escape(input.subject)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Snippet</td><td>${escape(input.snippet)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Action</td><td><a href="${escape(input.actionUrl)}">Open review</a></td></tr>
</table>
<p>Use the action link to draft a reply, approve or reject candidate facts, and close the inbound message.</p>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nInbound email awaiting review.\n\nFrom: ${input.fromAddress}\nSubject: ${input.subject}\nSnippet: ${input.snippet}\nAction: ${input.actionUrl}\n`;
  return { subject, html, text };
}

export interface CriticalCancellationInput {
  readonly eventTitle: string;
  readonly scheduledAt: string;
  readonly reason: string;
  readonly actionUrl: string;
}

export function renderCriticalCancellationEmail(input: CriticalCancellationInput): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `[${brand.shortName}] CRITICAL: cancellation overdue — ${input.eventTitle}`;
  const title = "CRITICAL: cancellation is overdue";
  const body = `
<p style="color:#a12622"><strong>Operator action required.</strong></p>
<p>The cancellation for the following event is overdue. Without an authoritative cancellation, the event would be live. The Society never lets that happen.</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">Event</td><td>${escape(input.eventTitle)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Scheduled</td><td>${escape(input.scheduledAt)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Reason</td><td>${escape(input.reason)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Action</td><td><a href="${escape(input.actionUrl)}">Trigger deterministic cancellation</a></td></tr>
</table>
<p>The deterministic cancellation copy does not depend on AI; it is ready to send. Use the action link to send it now.</p>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nCRITICAL: cancellation overdue.\n\nEvent: ${input.eventTitle}\nScheduled: ${input.scheduledAt}\nReason: ${input.reason}\nAction: ${input.actionUrl}\n`;
  return { subject, html, text };
}

export interface AppearanceEnquiryInput {
  readonly memberName: string;
  readonly role: string;
  readonly location: string;
  readonly travel: boolean;
  readonly actionUrl: string;
}

export function renderAppearanceEnquiryEmail(input: AppearanceEnquiryInput): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `[${brand.shortName}] appearance enquiry: ${input.role} in ${input.location}`;
  const title = "Appearance service enquiry";
  const body = `
<p>Hello,</p>
<p>Member <strong>${escape(input.memberName)}</strong> has submitted an appearance enquiry.</p>
<table style="border-collapse:collapse;width:100%;font-size:0.95em;">
<tr><td style="padding:0.4rem 0;color:#666;">Role</td><td>${escape(input.role)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Location</td><td>${escape(input.location)}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Travel needed</td><td>${input.travel ? "Yes" : "No"}</td></tr>
<tr><td style="padding:0.4rem 0;color:#666;">Action</td><td><a href="${escape(input.actionUrl)}">Review and quote</a></td></tr>
</table>
<p>Suitability review first; quote only after suitability is approved. Disallowed directions are declined at this step.</p>
`;
  const html = wrap(title, body);
  const text = `${title}\n\nHello,\n\nAppearance enquiry from ${input.memberName}.\n\nRole: ${input.role}\nLocation: ${input.location}\nTravel: ${input.travel ? "yes" : "no"}\nAction: ${input.actionUrl}\n`;
  return { subject, html, text };
}
