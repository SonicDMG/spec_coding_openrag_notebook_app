import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebook, createNote } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

const PROMPT = `You are a research assistant. Summarise the provided documents into a structured overview.
Use clear headings and bullet points. Cover the main topics, key arguments, and important details.
Do NOT output JSON — write plain prose with markdown formatting.`

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const selectedSourceIds: string[] = body?.selectedSourceIds ?? []
  if (!selectedSourceIds.length) return err(400, 'selectedSourceIds must not be empty.', 'VALIDATION_ERROR')

  try {
    const filenames = resolveSelectedFilenames(notebookId, selectedSourceIds)
    const chatParams = {
      message: PROMPT,
      filterId: notebook.openragFilterId,
      filters: { data_sources: filenames },
      limit: QUERY_LIMIT,
      scoreThreshold: QUERY_SCORE_THRESHOLD,
      stream: false as const,
    }
    console.log('[OpenRAG Debug] overview chat.create:', JSON.stringify(chatParams))

    const response = await openrag.chat.create(chatParams)

    const now = new Date().toISOString()
    const dateStr = now.slice(0, 10)
    const note = createNote({
      id: `note_${uuid()}`, notebookId,
      title: `Overview — ${dateStr}`, type: 'overview',
      body: response.response, createdAt: now, updatedAt: now,
    })
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}
