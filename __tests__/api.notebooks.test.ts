import { makeTestDb } from '@/lib/db'
import type Database from 'better-sqlite3'

let testDb: Database.Database
jest.mock('@/lib/db', () => {
  const actual = jest.requireActual('@/lib/db')
  return { ...actual, getDb: () => testDb }
})
jest.mock('@/lib/openrag', () => ({ openrag: { knowledgeFilters: { create: jest.fn().mockResolvedValue({ id: 'filter_mock' }), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}), search: jest.fn().mockResolvedValue([]) }, documents: { ingest: jest.fn().mockResolvedValue({ task_id: 't1' }), waitForTask: jest.fn().mockResolvedValue({ status: 'success' }), delete: jest.fn().mockResolvedValue({}) }, chat: { create: jest.fn() } } }))

beforeEach(() => { testDb = makeTestDb() })
afterEach(() => { testDb.close() })

async function callRoute(routePath: string, method: string, body?: unknown, params?: Record<string, string>) {
  // Dynamically import so the mock is active
  const mod = await import(routePath)
  const handler = mod[method]
  const req = new Request('http://localhost', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return handler(req, { params: Promise.resolve(params ?? {}) })
}

describe('GET /api/notebooks', () => {
  test('returns empty list initially', async () => {
    const { GET } = await import('@/app/api/notebooks/route')
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.notebooks).toEqual([])
  })
})

describe('POST /api/notebooks', () => {
  test('creates notebook with valid name', async () => {
    const { POST } = await import('@/app/api/notebooks/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'My Notebook' }) })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('My Notebook')
    expect(data.id).toMatch(/^nb_/)
  })

  test('returns 400 on empty name', async () => {
    const { POST } = await import('@/app/api/notebooks/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/notebooks/[notebookId]', () => {
  test('returns 404 for unknown notebook', async () => {
    const { GET } = await import('@/app/api/notebooks/[notebookId]/route')
    const req = new Request('http://localhost')
    const res = await GET(req, { params: Promise.resolve({ notebookId: 'nope' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/notebooks/[notebookId]', () => {
  test('renames notebook', async () => {
    const { POST } = await import('@/app/api/notebooks/route')
    const { PATCH } = await import('@/app/api/notebooks/[notebookId]/route')
    const createReq = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Old Name' }) })
    const created = await (await POST(createReq)).json()

    const patchReq = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Name' }) })
    const res = await PATCH(patchReq, { params: Promise.resolve({ notebookId: created.id }) })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('New Name')
  })

  test('returns 400 on empty name', async () => {
    const { POST } = await import('@/app/api/notebooks/route')
    const { PATCH } = await import('@/app/api/notebooks/[notebookId]/route')
    const createReq = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NB' }) })
    const created = await (await POST(createReq)).json()
    const patchReq = new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) })
    const res = await PATCH(patchReq, { params: Promise.resolve({ notebookId: created.id }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/notebooks/[notebookId]', () => {
  test('deletes and subsequent GET returns 404', async () => {
    const { POST } = await import('@/app/api/notebooks/route')
    const { GET, DELETE } = await import('@/app/api/notebooks/[notebookId]/route')

    const created = await (await POST(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'To Delete' }) }))).json()
    const del = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ notebookId: created.id }) })
    expect(del.status).toBe(204)

    const get = await GET(new Request('http://localhost'), { params: Promise.resolve({ notebookId: created.id }) })
    expect(get.status).toBe(404)
  })
})

describe('Notes CRUD', () => {
  async function makeNotebook() {
    const { POST } = await import('@/app/api/notebooks/route')
    return (await POST(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NB' }) }))).json()
  }

  test('POST notes - manual note', async () => {
    const nb = await makeNotebook()
    const { POST } = await import('@/app/api/notebooks/[notebookId]/notes/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'manual', body: 'Hello' }) })
    const res = await POST(req, { params: Promise.resolve({ notebookId: nb.id }) })
    expect(res.status).toBe(201)
    const note = await res.json()
    expect(note.type).toBe('manual')
    expect(note.body).toBe('Hello')
  })

  test('POST notes - 400 on empty body', async () => {
    const nb = await makeNotebook()
    const { POST } = await import('@/app/api/notebooks/[notebookId]/notes/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'manual', body: '' }) })
    const res = await POST(req, { params: Promise.resolve({ notebookId: nb.id }) })
    expect(res.status).toBe(400)
  })

  test('POST notes - chat note requires title', async () => {
    const nb = await makeNotebook()
    const { POST } = await import('@/app/api/notebooks/[notebookId]/notes/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat', body: 'Answer' }) })
    const res = await POST(req, { params: Promise.resolve({ notebookId: nb.id }) })
    expect(res.status).toBe(400)
  })

  test('PATCH note updates body', async () => {
    const nb = await makeNotebook()
    const { POST, GET } = await import('@/app/api/notebooks/[notebookId]/notes/route')
    const { PATCH } = await import('@/app/api/notebooks/[notebookId]/notes/[noteId]/route')
    const note = await (await POST(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'manual', body: 'Original' }) }), { params: Promise.resolve({ notebookId: nb.id }) })).json()

    const res = await PATCH(new Request('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Updated' }) }), { params: Promise.resolve({ notebookId: nb.id, noteId: note.id }) })
    expect(res.status).toBe(200)
    expect((await res.json()).body).toBe('Updated')
  })

  test('DELETE note returns 204', async () => {
    const nb = await makeNotebook()
    const { POST } = await import('@/app/api/notebooks/[notebookId]/notes/route')
    const { DELETE } = await import('@/app/api/notebooks/[notebookId]/notes/[noteId]/route')
    const note = await (await POST(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'manual', body: 'Bye' }) }), { params: Promise.resolve({ notebookId: nb.id }) })).json()

    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ notebookId: nb.id, noteId: note.id }) })
    expect(res.status).toBe(204)
  })
})

describe('POST /api/notebooks/[notebookId]/chat', () => {
  test('returns 400 when selectedSourceIds is empty', async () => {
    const { POST: createNb } = await import('@/app/api/notebooks/route')
    const nb = await (await createNb(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NB' }) }))).json()

    const { POST } = await import('@/app/api/notebooks/[notebookId]/chat/route')
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hello', selectedSourceIds: [] }) })
    const res = await POST(req, { params: Promise.resolve({ notebookId: nb.id }) })
    expect(res.status).toBe(400)
  })
})
