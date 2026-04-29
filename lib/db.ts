import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'notebooklm.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
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
      type             TEXT NOT NULL CHECK(type IN ('text','pdf','url')),
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
  `)

  // Migration: Add content_hash column if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(sources)").all() as Array<{ name: string }>
  const hasContentHash = columns.some(col => col.name === 'content_hash')
  
  if (!hasContentHash) {
    db.exec(`ALTER TABLE sources ADD COLUMN content_hash TEXT`)
  }
}

export function makeTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}