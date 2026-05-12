import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'notebooklm.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.exec('PRAGMA busy_timeout = 10000') // Wait up to 10s instead of throwing immediately
  migrate(_db)
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      openrag_filter_id TEXT NOT NULL DEFAULT '',
      created_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id               TEXT PRIMARY KEY,
      notebook_id      TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      type             TEXT NOT NULL,
      url              TEXT,
      openrag_filename TEXT NOT NULL,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id           TEXT PRIMARY KEY,
      notebook_id  TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      type         TEXT NOT NULL CHECK(type IN ('manual','chat','overview','table','mindmap')),
      body         TEXT,
      table_data   TEXT,
      mind_map_data TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      sources     TEXT,
      saved       INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _migrations (
      id     TEXT PRIMARY KEY,
      ran_at TEXT NOT NULL
    );
  `)

  function hasMigration(id: string): boolean {
    return !!db.prepare('SELECT 1 FROM _migrations WHERE id = ?').get(id)
  }

  function markMigration(id: string): void {
    db.prepare('INSERT OR IGNORE INTO _migrations (id, ran_at) VALUES (?, ?)')
      .run(id, new Date().toISOString())
  }

  // Migration: Add openrag_chat_id to notebooks
  if (!hasMigration('add_openrag_chat_id')) {
    const nbCols = db.prepare("PRAGMA table_info(notebooks)").all() as Array<{ name: string }>
    if (!nbCols.some(c => c.name === 'openrag_chat_id')) {
      db.exec('ALTER TABLE notebooks ADD COLUMN openrag_chat_id TEXT')
    }
    markMigration('add_openrag_chat_id')
  }

  // Migration: Add content_hash column if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(sources)").all() as Array<{ name: string }>
  const hasContentHash = columns.some(col => col.name === 'content_hash')

  if (!hasContentHash) {
    db.exec(`ALTER TABLE sources ADD COLUMN content_hash TEXT`)
  }

  // Migration: Remove CHECK constraint on sources.type to allow csv, md, html, docx, txt
  if (!hasMigration('drop_sources_type_check')) {
    const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sources'").get() as { sql: string } | undefined
    if (tableSql?.sql?.includes("CHECK(type IN ('text','pdf','url'))")) {
      try {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          BEGIN TRANSACTION;
          CREATE TABLE sources_new (
            id               TEXT PRIMARY KEY,
            notebook_id      TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
            title            TEXT NOT NULL,
            type             TEXT NOT NULL,
            url              TEXT,
            openrag_filename TEXT NOT NULL,
            content_hash     TEXT,
            created_at       TEXT NOT NULL
          );
          INSERT INTO sources_new SELECT * FROM sources;
          DROP TABLE sources;
          ALTER TABLE sources_new RENAME TO sources;
          COMMIT;
          PRAGMA foreign_keys = ON;
        `)
      } catch (e: any) {
        if (e?.code === 'SQLITE_BUSY') {
          console.warn('[migrate] Database busy during sources.type migration — will retry on next startup.')
          return // Don't mark migration as complete
        }
        throw e
      }
    }
    markMigration('drop_sources_type_check')
  }
}

export function makeTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
