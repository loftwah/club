// ID generation. Single chokepoint for ID creation so the format is
// consistent across the system. ULIDs are time-sortable, which makes
// D1 row ordering roughly chronological without an extra index.

import { ulid } from "ulid";

export function newId(prefix?: string): string {
  const id = ulid();
  return prefix ? `${prefix}_${id}` : id;
}

export function newEventId(): string {
  return newId("evt");
}

export function newMemberId(): string {
  return newId("mem");
}

export function newJobId(): string {
  return newId("job");
}

export function newCommunicationId(): string {
  return newId("com");
}

export function newInboundId(): string {
  return newId("inb");
}

export function newWaitlistId(): string {
  return newId("wl");
}

export function newMilestoneId(): string {
  return newId("ms");
}

export function newFulfilmentId(): string {
  return newId("ft");
}

export function newCommitmentId(): string {
  return newId("cmt");
}

export function newCallId(): string {
  return newId("call");
}

export function newGiftId(): string {
  return newId("gift");
}

export function newLeaseId(): string {
  return newId("lease");
}

export function newAgentId(): string {
  return newId("agent");
}
