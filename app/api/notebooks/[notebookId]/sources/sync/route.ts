import { NextResponse } from 'next/server'
import { getNotebook } from '@/lib/store'
import { importNotebookFilterSources } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')
  if (!notebook.openragFilterId) return err(400, 'Notebook has no OpenRAG filter.', 'VALIDATION_ERROR')

  try {
    const added = await importNotebookFilterSources(notebookId, notebook.openragFilterId)
    return NextResponse.json({ added })
  } catch (e) {
    return mapSdkError(e)
  }
}
