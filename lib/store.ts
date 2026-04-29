import type Database from 'better-sqlite3'
import { getDb } from './db'
import type { Notebook, Source, Note, NoteType, SourceType, TableData, MindMapData } from './types'

function db(): Database.Database { return getDb() }

// ── Notebooks ──────────────────────────────────────────────────────────────

export function getNotebooks(): Notebook[] {
  return db().prepare(
    'SELECT id, name, openrag_filter_id as openragFilterId, created_at as createdAt FROM notebooks ORDER BY created_at DESC'
  ).all() as Notebook[]
}

export function getNotebook(id: string): Notebook | undefined {
  return db().prepare(
    'SELECT id, name, openrag_filter_id as openragFilterId, created_at as createdAt FROM notebooks WHERE id = ?'
  ).get(id) as Notebook | undefined
}

export function createNotebook(data: { id: string; name: string; openragFilterId: string; createdAt: string }): Notebook {
  db().prepare(
    'INSERT INTO notebooks (id, name, openrag_filter_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(data.id, data.name, data.openragFilterId, data.createdAt)
  return getNotebook(data.id)!
}

export function updateNotebook(id: string, patch: { name?: string; openragFilterId?: string }): Notebook {
  if (patch.name !== undefined) {
    db().prepare('UPDATE notebooks SET name = ? WHERE id = ?').run(patch.name, id)
  }
  if (patch.openragFilterId !== undefined) {
    db().prepare('UPDATE notebooks SET openrag_filter_id = ? WHERE id = ?').run(patch.openragFilterId, id)
  }
  return getNotebook(id)!
}

export function deleteNotebook(id: string): void {
  db().prepare('DELETE FROM notebooks WHERE id = ?').run(id)
}

// ── Sources ────────────────────────────────────────────────────────────────

export function getSources(notebookId: string): Source[] {
  return db().prepare(
    'SELECT id, notebook_id as notebookId, title, type, url, openrag_filename as openragFilename, content_hash as contentHash, created_at as createdAt FROM sources WHERE notebook_id = ? ORDER BY created_at ASC'
  ).all(notebookId) as Source[]
}

export function getSource(notebookId: string, sourceId: string): Source | undefined {
  return db().prepare(
    'SELECT id, notebook_id as notebookId, title, type, url, openrag_filename as openragFilename, content_hash as contentHash, created_at as createdAt FROM sources WHERE notebook_id = ? AND id = ?'
  ).get(notebookId, sourceId) as Source | undefined
}

export function createSource(data: {
  id: string; notebookId: string; title: string; type: SourceType;
  url?: string; openragFilename: string; contentHash?: string; createdAt: string
}): Source {
  db().prepare(
    'INSERT INTO sources (id, notebook_id, title, type, url, openrag_filename, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.id, data.notebookId, data.title, data.type, data.url ?? null, data.openragFilename, data.contentHash ?? null, data.createdAt)
  return getSource(data.notebookId, data.id)!
}

export function deleteSource(notebookId: string, sourceId: string): void {
  db().prepare('DELETE FROM sources WHERE notebook_id = ? AND id = ?').run(notebookId, sourceId)
}

export function sourceExistsByFilename(notebookId: string, openragFilename: string): boolean {
  const row = db().prepare(
    'SELECT 1 FROM sources WHERE notebook_id = ? AND openrag_filename = ?'
  ).get(notebookId, openragFilename)
  return !!row
}

export function sourceExistsByUrl(notebookId: string, url: string): boolean {
  const row = db().prepare(
    'SELECT 1 FROM sources WHERE notebook_id = ? AND url = ?'
  ).get(notebookId, url)
  return !!row
}

export function sourceExistsByContentHash(notebookId: string, contentHash: string): Source | undefined {
  return db().prepare(
    'SELECT id, notebook_id as notebookId, title, type, url, openrag_filename as openragFilename, content_hash as contentHash, created_at as createdAt FROM sources WHERE notebook_id = ? AND content_hash = ?'
  ).get(notebookId, contentHash) as Source | undefined
}

// ── Notes ──────────────────────────────────────────────────────────────────

function deserialiseNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    notebookId: row.notebookId as string,
    title: row.title as string,
    type: row.type as NoteType,
    body: row.body as string | undefined,
    tableData: row.tableData ? JSON.parse(row.tableData as string) as TableData : undefined,
    mindMapData: row.mindMapData ? JSON.parse(row.mindMapData as string) as MindMapData : undefined,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  }
}

export function getNotes(notebookId: string): Note[] {
  const rows = db().prepare(
    'SELECT id, notebook_id as notebookId, title, type, body, table_data as tableData, mind_map_data as mindMapData, created_at as createdAt, updated_at as updatedAt FROM notes WHERE notebook_id = ? ORDER BY created_at DESC'
  ).all(notebookId) as Record<string, unknown>[]
  return rows.map(deserialiseNote)
}

export function getNote(notebookId: string, noteId: string): Note | undefined {
  const row = db().prepare(
    'SELECT id, notebook_id as notebookId, title, type, body, table_data as tableData, mind_map_data as mindMapData, created_at as createdAt, updated_at as updatedAt FROM notes WHERE notebook_id = ? AND id = ?'
  ).get(notebookId, noteId) as Record<string, unknown> | undefined
  return row ? deserialiseNote(row) : undefined
}

export function createNote(data: {
  id: string; notebookId: string; title: string; type: NoteType;
  body?: string; tableData?: TableData; mindMapData?: MindMapData;
  createdAt: string; updatedAt: string
}): Note {
  db().prepare(
    'INSERT INTO notes (id, notebook_id, title, type, body, table_data, mind_map_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    data.id, data.notebookId, data.title, data.type,
    data.body ?? null,
    data.tableData ? JSON.stringify(data.tableData) : null,
    data.mindMapData ? JSON.stringify(data.mindMapData) : null,
    data.createdAt, data.updatedAt
  )
  return getNote(data.notebookId, data.id)!
}

export function updateNote(notebookId: string, noteId: string, patch: { title?: string; body?: string; updatedAt: string }): Note {
  if (patch.title !== undefined) {
    db().prepare('UPDATE notes SET title = ?, updated_at = ? WHERE notebook_id = ? AND id = ?')
      .run(patch.title, patch.updatedAt, notebookId, noteId)
  }
  if (patch.body !== undefined) {
    db().prepare('UPDATE notes SET body = ?, updated_at = ? WHERE notebook_id = ? AND id = ?')
      .run(patch.body, patch.updatedAt, notebookId, noteId)
  }
  return getNote(notebookId, noteId)!
}

export function deleteNote(notebookId: string, noteId: string): void {
  db().prepare('DELETE FROM notes WHERE notebook_id = ? AND id = ?').run(notebookId, noteId)
}

// ── Counts (for notebook summary) ─────────────────────────────────────────

export function getSourceCount(notebookId: string): number {
  const row = db().prepare('SELECT COUNT(*) as c FROM sources WHERE notebook_id = ?').get(notebookId) as { c: number }
  return row.c
}

export function getNoteCount(notebookId: string): number {
  const row = db().prepare('SELECT COUNT(*) as c FROM notes WHERE notebook_id = ?').get(notebookId) as { c: number }
  return row.c
}
