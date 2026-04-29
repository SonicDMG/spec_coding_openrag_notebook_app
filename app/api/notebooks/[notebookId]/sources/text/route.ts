import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { createHash } from 'crypto'
import { getNotebook, createSource, sourceExistsByContentHash } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { updateNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const json = await req.json().catch(() => null)
  const body = json?.body?.trim()
  if (!body) return err(400, 'body is required and cannot be empty.', 'VALIDATION_ERROR')

  const title = json?.title?.trim() || `Text source ${new Date().toLocaleString()}`

  try {
    // Calculate content hash
    const contentHash = createHash('sha256').update(body, 'utf8').digest('hex')
    
    // Check if this exact content already exists in the notebook
    const existingSource = sourceExistsByContentHash(notebookId, contentHash)
    if (existingSource) {
      return NextResponse.json(existingSource, { status: 200 })
    }

    const sourceId = `src_${uuid()}`
    const openragFilename = `${notebookId}-${sourceId}.txt`

    const blob = new Blob([body], { type: 'text/plain' })
    const result = await openrag.documents.ingest({ file: blob, filename: openragFilename })
    await openrag.documents.waitForTask(result.task_id)

    const source = createSource({ 
      id: sourceId, 
      notebookId, 
      title, 
      type: 'text', 
      openragFilename,
      contentHash,
      createdAt: new Date().toISOString() 
    })
    
    await updateNotebookFilter(notebook.openragFilterId, notebookId)
    return NextResponse.json(source, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}