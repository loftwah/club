// Clock abstraction.
//
// Cloudflare Workers do not have a controllable system clock. All "now"
// lookups in the domain layer go through this interface. In production
// the real-clock implementation is used; in tests the fake clock is
// used to advance time deterministically.

export interface Clock {
  now(): Date;
  /** ISO 8601 timestamp in UTC. */
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowIso(): string {
    return new Date().toISOString();
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  static at(iso: string): FixedClock {
    return new FixedClock(new Date(iso));
  }
  now(): Date {
    return new Date(this.current);
  }
  nowIso(): string {
    return this.current.toISOString();
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(iso: string): void {
    this.current = new Date(iso);
  }
}
