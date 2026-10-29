/**
 * In-memory stand-in for the ioredis commands the app uses, so tests need no Redis server.
 * Add a command here when production code starts using it.
 */
export class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();
  now = () => Date.now();

  async get(key: string): Promise<string | null> {
    return this.entry(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    const existing = this.entry(key);
    if (args.includes('NX') && existing) return null;
    let expiresAt: number | null = null;
    const ex = args.indexOf('EX');
    if (ex !== -1) expiresAt = this.now() + Number(args[ex + 1]) * 1000;
    if (args.includes('KEEPTTL')) expiresAt = existing?.expiresAt ?? null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (this.entry(key) && this.store.delete(key)) removed += 1;
    return removed;
  }

  async incr(key: string): Promise<number> {
    const existing = this.entry(key);
    const next = Number(existing?.value ?? '0') + 1;
    this.store.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const existing = this.entry(key);
    if (!existing) return 0;
    existing.expiresAt = this.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const existing = this.entry(key);
    if (!existing) return -2;
    if (existing.expiresAt === null) return -1;
    return Math.ceil((existing.expiresAt - this.now()) / 1000);
  }

  multi() {
    const queued: (() => Promise<unknown>)[] = [];
    const chain = {
      set: (key: string, value: string, ...args: (string | number)[]) => {
        queued.push(() => this.set(key, value, ...args));
        return chain;
      },
      exec: async () => {
        const results: [null, unknown][] = [];
        for (const run of queued) results.push([null, await run()]);
        return results;
      },
    };
    return chain;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  keys(): string[] {
    return [...this.store.keys()].filter((key) => this.entry(key));
  }

  private entry(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }
}
