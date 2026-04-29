import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebook, createNote } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'
import type { TableData } from '@/lib/types'

type Ctx = { params: Promise<{ notebookId: string }> }

export const maxDuration = 300

function buildPrompt(focus?: string) {
  const focusLine = focus ? `Focus specifically on: ${focus}.` : 'Identify the most meaningful columns from the content.'
  return `You are a data extraction assistant. ${focusLine}
Extract structured tabular data from the provided documents.
Return ONLY valid JSON in this exact format — no prose, no markdown fences:
{"headers":["Col1","Col2"],"rows":[["val1","val2"],["val3","val4"]]}`
}

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const selectedSourceIds: string[] = body?.selectedSourceIds ?? []
  if (!selectedSourceIds.length) return err(400, 'selectedSourceIds must not be empty.', 'VALIDATION_ERROR')

  const prompt = body?.prompt?.trim()

  try {
    const filenames = resolveSelectedFilenames(notebookId, selectedSourceIds)
    const chatParams = {
      message: buildPrompt(prompt),
      filterId: notebook.openragFilterId,
      filters: { data_sources: filenames },
      limit: QUERY_LIMIT,
      scoreThreshold: QUERY_SCORE_THRESHOLD,
      stream: false as const,
    }
    console.log('[OpenRAG Debug] table chat.create:', JSON.stringify(chatParams))

    const response = await openrag.chat.create(chatParams)

    let tableData: TableData
    try {
      tableData = JSON.parse(response.response)
      if (!Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) throw new Error()
    } catch {
      return err(422, 'Could not extract tabular data from the selected sources.', 'UNPROCESSABLE')
    }

    const now = new Date().toISOString()
    const dateStr = now.slice(0, 10)
    const title = prompt ? prompt.slice(0, 60) : `Data Table — ${dateStr}`
    const note = createNote({ id: `note_${uuid()}`, notebookId, title, type: 'table', tableData, createdAt: now, updatedAt: now })
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}
