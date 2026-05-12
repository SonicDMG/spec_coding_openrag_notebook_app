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

// Extract the JSON object containing headers and rows from the response.
// OpenRAG may append a metadata blob like {"search_query": "..."} at the end.
function extractTableJson(content: string): TableData | null {
  // Find the JSON object that contains "headers" and "rows"
  const headersMatch = content.match(/\{"headers":\s*\[[\s\S]*?\]/)
  const rowsMatch = content.match(/"rows":\s*\[[\s\S]*?\]\s*\}/)

  if (!headersMatch || !rowsMatch) return null

  // Reconstruct the full JSON object
  const headersStart = headersMatch.index!
  const rowsEnd = rowsMatch.index! + rowsMatch[0]!.length

  try {
    const jsonStr = content.slice(headersStart, rowsEnd)
    const data = JSON.parse(jsonStr)
    if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) return null
    return data
  } catch {
    return null
  }
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
      stream: true as const,
    }
    console.log('[OpenRAG Debug] table chat.create:', JSON.stringify(chatParams))

    const stream = await openrag.chat.create(chatParams)
    let fullContent = ''

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const focusDesc = prompt ? ` focusing on "${prompt}"` : ''
          const statusMsg = `I have started creating a data table${focusDesc} for you.\n\nThis will extract structured tabular data from your selected sources, organizing key information into rows and columns.\n\nYou can find it in the Notes panel once it finishes generating.`
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ message: statusMsg })}\n\n`))

          for await (const event of stream) {
            if (event.type === 'content') {
              fullContent += event.delta
              controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`))
            } else if (event.type === 'sources') {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`))
            } else if (event.type === 'done') {
              // Parse the JSON response, stripping any metadata blob
              const tableData = extractTableJson(fullContent)
              if (!tableData) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Could not extract tabular data from the selected sources.' })}\n\n`))
                controller.close()
                return
              }

              // Save the note
              const now = new Date().toISOString()
              const dateStr = now.slice(0, 10)
              const title = prompt ? prompt.slice(0, 60) : `Data Table — ${dateStr}`
              const note = createNote({ id: `note_${uuid()}`, notebookId, title, type: 'table', tableData, createdAt: now, updatedAt: now })
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ note })}\n\n`))
            }
          }
        } catch (e) {
          const msg = e instanceof Error && e.name === 'AbortError'
            ? 'Request timed out — the generation took too long. Try selecting fewer sources.'
            : (e instanceof Error ? e.message : 'Stream error')
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