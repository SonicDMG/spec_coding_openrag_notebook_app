import { v4 as uuid } from 'uuid'
import { getNotebook, createNote } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export const maxDuration = 300

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
      stream: true as const,
    }
    console.log('[OpenRAG Debug] overview chat.create:', JSON.stringify(chatParams))

    const stream = await openrag.chat.create(chatParams)
    let fullContent = ''

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status message
          const statusMsg = `I have started creating an overview for you.\n\nThis will summarize the key topics, main arguments, and important details from your selected sources into a structured format.\n\nYou can find it in the Notes panel once it finishes generating.`
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ message: statusMsg })}\n\n`))

          for await (const event of stream) {
            if (event.type === 'content') {
              fullContent += event.delta
              controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`))
            } else if (event.type === 'sources') {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`))
            } else if (event.type === 'done') {
              // Save the note
              const now = new Date().toISOString()
              const dateStr = now.slice(0, 10)
              const note = createNote({
                id: `note_${uuid()}`, notebookId,
                title: `Overview — ${dateStr}`, type: 'overview',
                body: fullContent, createdAt: now, updatedAt: now,
              })
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ note })}\n\n`))
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Stream error'
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return mapSdkError(e)
  }
}