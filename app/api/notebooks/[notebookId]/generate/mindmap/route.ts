import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebook, createNote } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'
import type { MindMapData } from '@/lib/types'

type Ctx = { params: Promise<{ notebookId: string }> }

export const maxDuration = 300

function buildPrompt(topic?: string) {
  const topicLine = topic ? `Focus on the topic: ${topic}.` : 'Use the central concept from the content.'
  return `You are a knowledge mapping assistant. ${topicLine}
Identify key concepts and their relationships in the provided documents.
Return ONLY valid JSON in this exact format — no prose, no markdown fences:
{"nodes":[{"id":"n1","label":"Concept"}],"edges":[{"from":"n1","to":"n2","label":"relates to"}]}`
}

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const selectedSourceIds: string[] = body?.selectedSourceIds ?? []
  if (!selectedSourceIds.length) return err(400, 'selectedSourceIds must not be empty.', 'VALIDATION_ERROR')

  const topic = body?.topic?.trim()

  try {
    const filenames = resolveSelectedFilenames(notebookId, selectedSourceIds)
    const chatParams = {
      message: buildPrompt(topic),
      filterId: notebook.openragFilterId,
      filters: { data_sources: filenames },
      limit: QUERY_LIMIT,
      scoreThreshold: QUERY_SCORE_THRESHOLD,
      stream: false as const,
    }
    console.log('[OpenRAG Debug] mindmap chat.create:', JSON.stringify(chatParams))

    const response = await openrag.chat.create(chatParams)

    let mindMapData: MindMapData
    try {
      mindMapData = JSON.parse(response.response)
      if (!Array.isArray(mindMapData.nodes) || !Array.isArray(mindMapData.edges)) throw new Error()
    } catch {
      return err(422, 'Could not extract concept map from the selected sources.', 'UNPROCESSABLE')
    }

    if (mindMapData.nodes.length < 2) {
      return err(422, 'Fewer than two distinct concepts were identified in the selected sources.', 'UNPROCESSABLE')
    }

    const now = new Date().toISOString()
    const dateStr = now.slice(0, 10)
    const title = topic ? topic.slice(0, 60) : `Mind Map — ${dateStr}`
    const note = createNote({ id: `note_${uuid()}`, notebookId, title, type: 'mindmap', mindMapData, createdAt: now, updatedAt: now })
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}
