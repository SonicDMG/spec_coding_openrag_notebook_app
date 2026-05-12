import { NextResponse } from 'next/server'
import { getNotebook, updateNotebook, deleteNotebook, getSources, getNotes, getFilenameRefCount } from '@/lib/store'
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
    const sources = getSources(notebookId)

    // Remove local records first so ref counts are accurate for shared docs
    deleteNotebook(notebookId) // cascade-deletes sources + notes + messages

    // Delete from OpenRAG only when no other notebook still references the file
    await Promise.allSettled(
      sources
        .filter(s => getFilenameRefCount(s.openragFilename) === 0)
        .map(s => openrag.documents.delete(s.openragFilename))
    )

    if (notebook.openragFilterId) {
      await deleteNotebookFilter(notebook.openragFilterId).catch(() => {})
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return mapSdkError(e)
  }
}
