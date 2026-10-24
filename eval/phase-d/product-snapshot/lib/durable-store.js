import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, unlinkSync, copyFileSync, constants } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function decode(raw) {
    const data = JSON.parse(raw);
    if (![1, 2].includes(data.schemaVersion))
        throw new Error('STORE_SCHEMA_UNSUPPORTED');
    if (!Array.isArray(data.reviews) || data.reviews.some((r) => r.schemaVersion !== 1 || typeof r.id !== 'string' || !Array.isArray(r.calls) || !Array.isArray(r.messages) || !Array.isArray(r.stages) || !Array.isArray(r.followups)))
        throw new Error('STORE_CORRUPT');
    if (data.schemaVersion === 2 && (!Number.isSafeInteger(data.generation) || data.generation < 1 || data.checksum !== digest(data.reviews)))
        throw new Error('STORE_CHECKSUM_MISMATCH');
    return data;
}
export class DurableReviewStore {
    file;
    reviews = [];
    info = { schemaVersion: 2, generation: 0, backupAvailable: false };
    token = randomUUID();
    closed = false;
    constructor(file) {
        this.file = file;
        mkdirSync(dirname(file), { recursive: true });
        this.acquire();
        try {
            if (!existsSync(file)) {
                if (!existsSync(file + '.bak'))
                    return;
                const backup = readFileSync(file + '.bak', 'utf8');
                decode(backup);
                this.atomic(file, backup);
                this.info.recoveryNotice = '主记录文件缺失，已从上一有效备份恢复；最近一次保存可能缺失，请核对记录。';
            }
            let raw = readFileSync(file, 'utf8');
            let data;
            try {
                data = decode(raw);
            }
            catch (error) {
                if (error instanceof Error && error.message === 'STORE_SCHEMA_UNSUPPORTED')
                    throw error;
                if (!existsSync(file + '.bak'))
                    throw new Error('STORE_CORRUPT', { cause: error });
                const backup = readFileSync(file + '.bak', 'utf8');
                data = decode(backup);
                const quarantine = `${file}.corrupt-${Date.now()}-${this.token}`;
                renameSync(file, quarantine);
                this.info.recoveryNotice = '已从上一有效备份恢复，损坏文件已保留；最近一次保存可能缺失，请核对记录。';
                raw = backup;
                this.atomic(file, backup);
            }
            this.reviews = data.reviews;
            this.info.generation = data.generation ?? 0;
            this.info.recoveryNotice ??= data.recoveryNotice;
            this.info.migratedFrom = data.migratedFrom;
            let changed = false;
            if (data.schemaVersion === 1) {
                if (!existsSync(file + '.v1-backup'))
                    copyFileSync(file, file + '.v1-backup', constants.COPYFILE_EXCL);
                this.info.migratedFrom = 1;
                changed = true;
            }
            for (const r of this.reviews) {
                if (r.state === 'running') {
                    r.state = 'interrupted';
                    changed = true;
                }
                for (const c of r.calls)
                    if (c.state === 'running') {
                        c.state = 'interrupted';
                        c.errorCode = 'HOST_RESTART';
                        c.endedAt = new Date().toISOString();
                        changed = true;
                    }
                for (const s of r.stages)
                    if (s.state === 'running') {
                        s.state = 'interrupted';
                        changed = true;
                    }
                for (const f of r.followups)
                    if (f.state === 'running') {
                        f.state = 'interrupted';
                        f.errorCode = 'HOST_RESTART';
                        changed = true;
                    }
            }
            this.info.backupAvailable = existsSync(file + '.bak');
            if (changed)
                this.save();
        }
        catch (error) {
            this.close();
            throw error;
        }
    }
    acquire() {
        const lock = this.file + '.lock';
        if (existsSync(lock)) {
            let owner;
            try {
                owner = JSON.parse(readFileSync(lock, 'utf8'));
            }
            catch {
                throw new Error('STORE_LOCK_INVALID');
            }
            if (typeof owner.pid !== 'number' || !Number.isInteger(owner.pid) || owner.pid < 1)
                throw new Error('STORE_LOCK_INVALID');
            let alive = true;
            try {
                process.kill(owner.pid, 0);
            }
            catch (error) {
                if (error.code === 'ESRCH')
                    alive = false;
                else
                    throw new Error('STORE_IN_USE');
            }
            if (alive)
                throw new Error('STORE_IN_USE');
            unlinkSync(lock);
        }
        try {
            writeFileSync(lock, JSON.stringify({ pid: process.pid, token: this.token, createdAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
        }
        catch (error) {
            throw new Error('STORE_IN_USE', { cause: error });
        }
    }
    atomic(path, contents) {
        const tmp = `${path}.${randomUUID()}.tmp`;
        try {
            writeFileSync(tmp, contents, { flag: 'wx', mode: 0o600 });
            const fd = openSync(tmp, 'r+');
            try {
                fsyncSync(fd);
            }
            finally {
                closeSync(fd);
            }
            renameSync(tmp, path);
        }
        catch (error) {
            try {
                if (existsSync(tmp))
                    unlinkSync(tmp);
            }
            catch { }
            throw error;
        }
    }
    save() {
        if (this.closed)
            throw new Error('STORE_CLOSED');
        try {
            if (existsSync(this.file)) {
                const previous = readFileSync(this.file, 'utf8'), decoded = decode(previous);
                if ((decoded.generation ?? 0) !== this.info.generation)
                    throw new Error('STORE_CHANGED_EXTERNALLY');
                this.atomic(this.file + '.bak', previous);
                this.info.backupAvailable = true;
            }
            const generation = this.info.generation + 1;
            this.atomic(this.file, JSON.stringify({ schemaVersion: 2, generation, checksum: digest(this.reviews), reviews: this.reviews, lastSavedAt: new Date().toISOString(), ...(this.info.migratedFrom ? { migratedFrom: this.info.migratedFrom } : {}), ...(this.info.recoveryNotice ? { recoveryNotice: this.info.recoveryNotice } : {}) }));
            this.info.generation = generation;
        }
        catch (error) {
            if (error instanceof Error && error.message === 'STORE_CHANGED_EXTERNALLY')
                throw error;
            throw new Error('STORE_WRITE_FAILED', { cause: error });
        }
    }
    snapshot() {
        if (existsSync(this.file)) {
            const raw = readFileSync(this.file, 'utf8');
            decode(raw);
            return raw;
        }
        return JSON.stringify({ schemaVersion: 2, generation: 1, checksum: digest([]), reviews: [] });
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        try {
            const lock = this.file + '.lock';
            if (JSON.parse(readFileSync(lock, 'utf8')).token === this.token)
                unlinkSync(lock);
        }
        catch { }
    }
}
//# sourceMappingURL=durable-store.js.map