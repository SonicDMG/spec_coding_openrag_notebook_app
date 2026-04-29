import { makeTestDb } from '@/lib/db'
import type Database from 'better-sqlite3'

// Patch getDb to return in-memory DB for every test
let testDb: Database.Database
jest.mock('@/lib/db', () => {
  const actual = jest.requireActual('@/lib/db')
  return { ...actual, getDb: () => testDb }
})

import {
  getNotebooks, getNotebook, createNotebook, updateNotebook, deleteNotebook,
  getSources, getSource, createSource, deleteSource, sourceExistsByFilename, sourceExistsByUrl,
  getNotes, getNote, createNote, updateNote, deleteNote,
  getSourceCount, getNoteCount,
} from '@/lib/store'

beforeEach(() => { testDb = makeTestDb() })
afterEach(() => { testDb.close() })

const NOW = new Date().toISOString()
const nb = () => createNotebook({ id: 'nb1', name: 'Test Notebook', openragFilterId: 'f1', createdAt: NOW })

// ── Notebooks ──────────────────────────────────────────────────────────────

describe('notebooks', () => {
  test('getNotebooks returns empty array initially', () => {
    expect(getNotebooks()).toEqual([])
  })

  test('createNotebook and getNotebook round-trip', () => {
    const created = nb()
    expect(created.id).toBe('nb1')
    expect(created.name).toBe('Test Notebook')
    expect(getNotebook('nb1')).toEqual(created)
  })

  test('getNotebook returns undefined for unknown id', () => {
    expect(getNotebook('nope')).toBeUndefined()
  })

  test('getNotebooks sorts newest first', () => {
    createNotebook({ id: 'nb1', name: 'First', openragFilterId: '', createdAt: '2024-01-01T00:00:00Z' })
    createNotebook({ id: 'nb2', name: 'Second', openragFilterId: '', createdAt: '2024-06-01T00:00:00Z' })
    const list = getNotebooks()
    expect(list[0].id).toBe('nb2')
    expect(list[1].id).toBe('nb1')
  })

  test('updateNotebook renames', () => {
    nb()
    const updated = updateNotebook('nb1', { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
  })

  test('deleteNotebook removes it', () => {
    nb()
    deleteNotebook('nb1')
    expect(getNotebook('nb1')).toBeUndefined()
  })
})

// ── Sources ────────────────────────────────────────────────────────────────

describe('sources', () => {
  beforeEach(() => nb())

  const src = () => createSource({
    id: 'src1', notebookId: 'nb1', title: 'My Source',
    type: 'text', openragFilename: 'nb1-src1.txt', createdAt: NOW,
  })

  test('getSources returns empty initially', () => {
    expect(getSources('nb1')).toEqual([])
  })

  test('createSource and getSource round-trip', () => {
    const s = src()
    expect(s.id).toBe('src1')
    expect(getSource('nb1', 'src1')).toEqual(s)
  })

  test('getSource returns undefined for unknown id', () => {
    expect(getSource('nb1', 'nope')).toBeUndefined()
  })

  test('deleteSource removes it', () => {
    src()
    deleteSource('nb1', 'src1')
    expect(getSource('nb1', 'src1')).toBeUndefined()
  })

  test('sourceExistsByFilename detects duplicates', () => {
    src()
    expect(sourceExistsByFilename('nb1', 'nb1-src1.txt')).toBe(true)
    expect(sourceExistsByFilename('nb1', 'other.txt')).toBe(false)
  })

  test('sourceExistsByUrl detects duplicates', () => {
    createSource({ id: 'src2', notebookId: 'nb1', title: 'URL', type: 'url', url: 'https://example.com', openragFilename: 'nb1-src2.txt', createdAt: NOW })
    expect(sourceExistsByUrl('nb1', 'https://example.com')).toBe(true)
    expect(sourceExistsByUrl('nb1', 'https://other.com')).toBe(false)
  })

  test('getSourceCount', () => {
    expect(getSourceCount('nb1')).toBe(0)
    src()
    expect(getSourceCount('nb1')).toBe(1)
  })

  test('sources cascade-delete with notebook', () => {
    src()
    deleteNotebook('nb1')
    expect(getSources('nb1')).toEqual([])
  })
})

// ── Notes ──────────────────────────────────────────────────────────────────

describe('notes', () => {
  beforeEach(() => nb())

  const note = () => createNote({
    id: 'note1', notebookId: 'nb1', title: 'My Note', type: 'manual',
    body: 'Hello world', createdAt: NOW, updatedAt: NOW,
  })

  test('getNotes returns empty initially', () => {
    expect(getNotes('nb1')).toEqual([])
  })

  test('createNote and getNote round-trip', () => {
    const n = note()
    expect(n.id).toBe('note1')
    expect(n.body).toBe('Hello world')
    expect(getNote('nb1', 'note1')).toEqual(n)
  })

  test('createNote with tableData serialises/deserialises', () => {
    const td = { headers: ['A', 'B'], rows: [['1', '2']] }
    const n = createNote({ id: 'note2', notebookId: 'nb1', title: 'T', type: 'table', tableData: td, createdAt: NOW, updatedAt: NOW })
    expect(n.tableData).toEqual(td)
  })

  test('createNote with mindMapData serialises/deserialises', () => {
    const mm = { nodes: [{ id: 'n1', label: 'Root' }], edges: [] }
    const n = createNote({ id: 'note3', notebookId: 'nb1', title: 'M', type: 'mindmap', mindMapData: mm, createdAt: NOW, updatedAt: NOW })
    expect(n.mindMapData).toEqual(mm)
  })

  test('getNotes sorts newest first', () => {
    createNote({ id: 'note1', notebookId: 'nb1', title: 'A', type: 'manual', body: 'a', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' })
    createNote({ id: 'note2', notebookId: 'nb1', title: 'B', type: 'manual', body: 'b', createdAt: '2024-06-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' })
    expect(getNotes('nb1')[0].id).toBe('note2')
  })

  test('updateNote patches title and body', () => {
    note()
    const updated = updateNote('nb1', 'note1', { title: 'New Title', body: 'New body', updatedAt: NOW })
    expect(updated.title).toBe('New Title')
    expect(updated.body).toBe('New body')
  })

  test('deleteNote removes it', () => {
    note()
    deleteNote('nb1', 'note1')
    expect(getNote('nb1', 'note1')).toBeUndefined()
  })

  test('getNoteCount', () => {
    expect(getNoteCount('nb1')).toBe(0)
    note()
    expect(getNoteCount('nb1')).toBe(1)
  })

  test('notes cascade-delete with notebook', () => {
    note()
    deleteNotebook('nb1')
    expect(getNotes('nb1')).toEqual([])
  })
})
