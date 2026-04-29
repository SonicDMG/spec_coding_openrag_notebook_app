import { NextResponse } from 'next/server'
import { getNotebook, updateNotebook, deleteNotebook, getSources, getNotes } from '@/lib/store'
import { updateNotebookFilter, deleteNotebookFilter } from '@/lib/filters'
import { openrag } from '@/lib/openrag'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')
  return NextResponse.json(notebook)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const name = body?.name?.trim()
  if (!name) return err(400, 'name must not be empty.', 'VALIDATION_ERROR')

  const updated = updateNotebook(notebookId, { name })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  try {
    // Delete all documents from OpenRAG
    const sources = getSources(notebookId)
    await Promise.allSettled(sources.map(s => openrag.documents.delete(s.openragFilename)))

    // Delete the knowledge filter
    if (notebook.openragFilterId) {
      await deleteNotebookFilter(notebook.openragFilterId).catch(() => {})
    }

    deleteNotebook(notebookId) // cascade-deletes sources + notes
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return mapSdkError(e)
  }
}
