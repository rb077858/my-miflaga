// מימוש מינימלי של ממשק D1 מעל node:sqlite, לבדיקות בלבד. מריץ את אותם קובצי migration.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const MIGRATIONS = fileURLToPath(new URL('../../migrations/', import.meta.url));

const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args.map(norm)); }
  _prep() { return this.db.prepare(this.sql); }
  async first(col) {
    const row = this._prep().get(...this.args);
    if (!row) return null;
    const plain = { ...row };
    return col ? plain[col] : plain;
  }
  async all() { return { results: this._prep().all(...this.args).map((r) => ({ ...r })), success: true, meta: {} }; }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) {
      const results = this._prep().all(...this.args).map((r) => ({ ...r }));
      return { results, success: true, meta: { changes: results.length } };
    }
    const r = this._prep().run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  _runSync() {
    if (/^\s*(SELECT|WITH)/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      const results = this._prep().all(...this.args).map((r) => ({ ...r }));
      return { results, success: true, meta: { changes: results.length } };
    }
    const r = this._prep().run(...this.args);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
}

export function createD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  return {
    _db: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => s._runSync());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async exec(sql) { db.exec(sql); },
  };
}
