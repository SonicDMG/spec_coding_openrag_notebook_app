import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { createHash } from 'crypto'
import { getNotebook, createSource, sourceExistsByFilename, sourceExistsByContentHash } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { updateNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

// Increase timeout for large PDF uploads
export const maxDuration = 300 // 5 minutes

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return err(400, 'file is required.', 'VALIDATION_ERROR')
  if (file.type !== 'application/pdf') return err(400, 'Only PDF files are accepted.', 'VALIDATION_ERROR')

  const baseName = file.name.replace(/\.pdf$/i, '')
  const title = (formData?.get('title') as string | null)?.trim() || baseName

  try {
    // Read file content and calculate hash
    const buffer = await file.arrayBuffer()
    const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')
    
    // Check if this exact content already exists in the notebook
    const existingSource = sourceExistsByContentHash(notebookId, contentHash)
    if (existingSource) {
      return NextResponse.json(existingSource, { status: 200 })
    }

    const sourceId = `src_${uuid()}`
    const openragFilename = `${notebookId}-${sourceId}.pdf`

    // Check filename collision (shouldn't happen with UUID but be safe)
    if (sourceExistsByFilename(notebookId, openragFilename)) {
      return err(409, 'A source with this filename already exists in the notebook.', 'DUPLICATE_SOURCE')
    }

    const blob = new Blob([buffer], { type: 'application/pdf' })
    
    // Ingest document to OpenRAG
    const result = await openrag.documents.ingest({ file: blob, filename: openragFilename })
    
    // Wait for ingestion to complete with timeout handling
    try {
      await openrag.documents.waitForTask(result.task_id)
    } catch (waitError) {
      // If wait fails, document might still be processing
      console.error('Task wait error:', waitError)
      // Continue anyway - document is queued in OpenRAG
    }

    const source = createSource({ 
      id: sourceId, 
      notebookId, 
      title, 
      type: 'pdf', 
      openragFilename,
      contentHash,
      createdAt: new Date().toISOString() 
    })
    
    await updateNotebookFilter(notebook.openragFilterId, notebookId)
    return NextResponse.json(source, { status: 201 })
  } catch (e) {
    console.error('PDF upload error:', e)
    return mapSdkError(e)
  }
}
