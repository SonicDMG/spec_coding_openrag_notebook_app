import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { createHash } from 'crypto'
import { getNotebook, createSource, sourceExistsByFilename, sourceExistsByContentHash } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { updateNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'
import type { SourceType } from '@/lib/types'

type Ctx = { params: Promise<{ notebookId: string }> }

const ALLOWED_EXTS = ['.pdf', '.csv', '.md', '.html', '.docx', '.txt']
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}

function extFromName(name: string): string | null {
  const lower = name.toLowerCase()
  return ALLOWED_EXTS.find(e => lower.endsWith(e)) ?? null
}

function sourceTypeFromExt(ext: string): SourceType {
  const map: Record<string, SourceType> = {
    '.pdf': 'pdf',
    '.csv': 'csv',
    '.md': 'md',
    '.html': 'html',
    '.docx': 'docx',
    '.txt': 'txt',
  }
  return map[ext] ?? 'txt'
}

// Increase timeout for large file uploads
export const maxDuration = 300 // 5 minutes

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return err(400, 'file is required.', 'VALIDATION_ERROR')

  const ext = extFromName(file.name)
  if (!ext) return err(400, `Only ${ALLOWED_EXTS.join(', ')} files are accepted.`, 'VALIDATION_ERROR')

  const baseName = file.name.replace(new RegExp(`\\${ext}$`, 'i'), '')
  const title = (formData?.get('title') as string | null)?.trim() || baseName

  try {
    const buffer = await file.arrayBuffer()
    const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

    const existingSource = sourceExistsByContentHash(notebookId, contentHash)
    if (existingSource) {
      return NextResponse.json(existingSource, { status: 200 })
    }

    const sourceId = `src_${uuid()}`
    const openragFilename = `${notebookId}-${sourceId}${ext}`

    if (sourceExistsByFilename(notebookId, openragFilename)) {
      return err(409, 'A source with this filename already exists in the notebook.', 'DUPLICATE_SOURCE')
    }

    const blob = new Blob([buffer], { type: MIME_TYPES[ext] ?? 'application/octet-stream' })

    const result = await openrag.documents.ingest({ file: blob, filename: openragFilename })

    try {
      await openrag.documents.waitForTask(result.task_id)
    } catch (waitError) {
      console.error('Task wait error:', waitError)
    }

    const source = createSource({
      id: sourceId,
      notebookId,
      title,
      type: sourceTypeFromExt(ext),
      openragFilename,
      contentHash,
      createdAt: new Date().toISOString(),
    })

    await updateNotebookFilter(notebook.openragFilterId, notebookId)
    return NextResponse.json(source, { status: 201 })
  } catch (e) {
    console.error('File upload error:', e)
    return mapSdkError(e)
  }
}
