import { NextResponse } from 'next/server'
import { getNotebook, getNote, updateNote, deleteNote } from '@/lib/store'
import { err } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string; noteId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { notebookId, noteId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')
  if (!getNote(notebookId, noteId)) return err(404, 'Note not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const patch: { title?: string; body?: string } = {}

  if (body?.title !== undefined) {
    const t = body.title.trim()
    if (!t) return err(400, 'title must not be empty.', 'VALIDATION_ERROR')
    patch.title = t
  }
  if (body?.body !== undefined) {
    const b = body.body.trim()
    if (!b) return err(400, 'body must not be empty.', 'VALIDATION_ERROR')
    patch.body = b
  }
  if (!Object.keys(patch).length) return err(400, 'At least one of title or body must be provided.', 'VALIDATION_ERROR')

  const updated = updateNote(notebookId, noteId, { ...patch, updatedAt: new Date().toISOString() })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { notebookId, noteId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')
  if (!getNote(notebookId, noteId)) return err(404, 'Note not found.', 'NOT_FOUND')
  deleteNote(notebookId, noteId)
  return new Response(null, { status: 204 })
}
