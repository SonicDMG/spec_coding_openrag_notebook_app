import { getNotebook, getSource, deleteSource, getFilenameRefCount } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { updateNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string; sourceId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const { notebookId, sourceId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const source = getSource(notebookId, sourceId)
  if (!source) return err(404, 'Source not found.', 'NOT_FOUND')

  deleteSource(notebookId, sourceId)

  // Only delete from OpenRAG when no other notebook references this document
  if (getFilenameRefCount(source.openragFilename) === 0) {
    try { await openrag.documents.delete(source.openragFilename) } catch { /* best-effort */ }
  }

  try { await updateNotebookFilter(notebookId) } catch { /* best-effort */ }

  return new Response(null, { status: 204 })
}
