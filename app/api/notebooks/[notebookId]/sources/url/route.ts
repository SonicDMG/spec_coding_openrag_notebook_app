import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { createHash } from 'crypto'
import { getNotebook, createSource, sourceExistsByUrl, sourceExistsByContentHash } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { updateNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const json = await req.json().catch(() => null)
  const url = json?.url?.trim()
  if (!url) return err(400, 'url is required.', 'VALIDATION_ERROR')
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return err(400, 'url must start with http:// or https://', 'VALIDATION_ERROR')
  }

  // Check if URL already exists in this notebook
  if (sourceExistsByUrl(notebookId, url)) {
    return err(409, 'This URL has already been added to the notebook.', 'DUPLICATE_SOURCE')
  }

  const title = json?.title?.trim()

  try {
    const response = await fetch(url)
    if (!response.ok) return err(502, `Failed to fetch URL: ${response.statusText}`, 'FETCH_ERROR')

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return err(400, 'URL must return HTML or plain text content.', 'INVALID_CONTENT_TYPE')
    }

    const html = await response.text()
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) return err(400, 'No text content found at URL.', 'EMPTY_CONTENT')

    // Calculate content hash
    const contentHash = createHash('sha256').update(text, 'utf8').digest('hex')
    
    // Check if this exact content already exists in the notebook
    const existingSource = sourceExistsByContentHash(notebookId, contentHash)
    if (existingSource) {
      return NextResponse.json(existingSource, { status: 200 })
    }

    const sourceId = `src_${uuid()}`
    const openragFilename = `${notebookId}-${sourceId}.txt`
    const finalTitle = title || new URL(url).hostname

    const blob = new Blob([text], { type: 'text/plain' })
    const result = await openrag.documents.ingest({ file: blob, filename: openragFilename })
    await openrag.documents.waitForTask(result.task_id)

    const source = createSource({ 
      id: sourceId, 
      notebookId, 
      title: finalTitle, 
      type: 'url', 
      url, 
      openragFilename,
      contentHash,
      createdAt: new Date().toISOString() 
    })
    
    await updateNotebookFilter(notebook.openragFilterId, notebookId)
    return NextResponse.json(source, { status: 201 })
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      return err(502, 'Failed to fetch URL. Please check the URL and try again.', 'FETCH_ERROR')
    }
    return mapSdkError(e)
  }
}