import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Review } from './domain.js';
export interface ReviewStore { reviews: Review[]; save(): void }
export class FileReviewStore implements ReviewStore {
  reviews: Review[] = [];
  constructor(readonly file: string) {
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      if (data.schemaVersion !== 1 || !Array.isArray(data.reviews) || data.reviews.some((r: Review) => r.schemaVersion !== 1 || !Array.isArray(r.calls) || !Array.isArray(r.messages) || !Array.isArray(r.stages) || !Array.isArray(r.followups))) throw new Error('STORE_SCHEMA_UNSUPPORTED');
      this.reviews = data.reviews;
      let changed = false;
      for (const r of this.reviews) {
        if (r.state === 'running') { r.state = 'interrupted'; changed = true; }
        for (const c of r.calls) if (c.state === 'running') { c.state = 'interrupted'; c.errorCode = 'HOST_RESTART'; c.endedAt = new Date().toISOString(); changed = true; }
        for (const s of r.stages) if (s.state === 'running') { s.state = 'interrupted'; changed = true; }
        for (const f of r.followups) if (f.state === 'running') { f.state = 'interrupted'; changed = true; }
      }
      if (changed) this.save();
    }
  }
  save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify({ schemaVersion: 1, reviews: this.reviews }), { flag: 'wx', mode: 0o600 });
      // Windows FlushFileBuffers requires a writable handle.
      const fd = openSync(tmp, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(tmp, this.file);
    } catch (error) { try { if (existsSync(tmp)) unlinkSync(tmp); } catch {} throw new Error('STORE_WRITE_FAILED', { cause: error }); }
  }
}
