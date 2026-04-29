import { getNotebook } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export const maxDuration = 300

export async function POST(req: Request, { params }: Ctx) {
  const { notebookId } = await params
  const notebook = getNotebook(notebookId)
  if (!notebook) return err(404, 'Notebook not found.', 'NOT_FOUND')

  const body = await req.json().catch(() => null)
  const message: string = body?.message?.trim()
  const selectedSourceIds: string[] = body?.selectedSourceIds ?? []
  const chatId: string | undefined = body?.chatId ?? undefined

  if (!message) return err(400, 'message must not be empty.', 'VALIDATION_ERROR')
  if (!selectedSourceIds.length) return err(400, 'selectedSourceIds must not be empty.', 'VALIDATION_ERROR')

  try {
    const filenames = resolveSelectedFilenames(notebookId, selectedSourceIds)
    const chatParams = {
      message,
      chatId,
      filterId: notebook.openragFilterId,
      filters: { data_sources: filenames },
      limit: QUERY_LIMIT,
      scoreThreshold: QUERY_SCORE_THRESHOLD,
      stream: true as const,
    }
    console.log('[OpenRAG Debug] chat.create:', JSON.stringify(chatParams))

    const stream = await openrag.chat.create(chatParams)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content') {
              controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`))
            } else if (event.type === 'sources') {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`))
            } else if (event.type === 'done') {
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ chatId: event.chatId })}\n\n`))
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
