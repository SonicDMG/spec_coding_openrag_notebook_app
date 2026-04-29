import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebook, getNotes, createNote, getNoteCount } from '@/lib/store'
import { err } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { notebookId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')
  return NextResponse.json({ notes: getNotes(notebookId) })
}

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const type = body?.type
  const rawBody = body?.body?.trim()

  if (!['manual', 'chat'].includes(type)) return err(400, "type must be 'manual' or 'chat'.", 'VALIDATION_ERROR')
  if (!rawBody) return err(400, 'body must not be empty.', 'VALIDATION_ERROR')
  if (type === 'chat' && !body?.title?.trim()) return err(400, 'title is required for chat notes.', 'VALIDATION_ERROR')

  const title = body?.title?.trim() || rawBody.split('\n')[0].slice(0, 60) || 'Untitled Note'
  const now = new Date().toISOString()
  const note = createNote({ id: `note_${uuid()}`, notebookId, title, type, body: rawBody, createdAt: now, updatedAt: now })
  return NextResponse.json(note, { status: 201 })
}
