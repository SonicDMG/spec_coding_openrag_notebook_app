import { v4 as uuid } from 'uuid'
import { getNotebook, createNote } from '@/lib/store'
import { openrag } from '@/lib/openrag'
import { resolveSelectedFilenames, QUERY_LIMIT, QUERY_SCORE_THRESHOLD } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'
import type { MindMapData } from '@/lib/types'

type Ctx = { params: Promise<{ notebookId: string }> }

export const maxDuration = 300

function buildPrompt(topic?: string) {
  const topicLine = topic
    ? `The central topic is: ${topic}.`
    : 'Derive the central topic from the overall collection or dataset name found in the content.'
  return `You are a knowledge mapping assistant. ${topicLine}

Analyze the documents to understand the domain and ontology of the data. Build a hierarchical mind map that reflects the natural structure of the content:

1. CENTRAL NODE (id "n1"): The name of the overall collection, dataset, or main subject — use the actual title from the content.
2. CATEGORY NODES: The natural groupings, types, classes, or classifications that exist within the data. Use the exact category names from the content.
3. ITEM NODES: Individual named entities, records, or items within each category — use their actual names or titles from the data, not paraphrases.
4. DETAIL NODES: Every item node must have children showing its actual properties and attributes from the content — things like stat values, damage types, effects, costs, ranges, descriptions, or any other domain-specific facts. Use concise factual labels with no type prefix (e.g. "2d6 fire", "60 ft range", "3 MP", "stuns 1 turn"). Every item node must have at least 2 detail node children.

Core rule: no named entity node should ever be a leaf — it must always have children with supporting detail pulled from the content.

Use the data's own vocabulary for every label. Edge labels must describe the real relationship (e.g. "includes", "contains", "has", "deals", "costs", "range", "effect") — never use vague labels like "relates to".

Return ONLY strictly valid JSON — no prose, no markdown fences, no extra characters. Use this exact format:
{"nodes":[{"id":"n1","label":"Collection Title"},{"id":"n2","label":"Category A"},{"id":"n3","label":"Item Name"},{"id":"n4","label":"Detail: value"}],"edges":[{"from":"n1","to":"n2","label":"includes"},{"from":"n2","to":"n3","label":"contains"},{"from":"n3","to":"n4","label":"has"}]}
Rules: every edge "from"/"to" must reference an existing node id; each object must open with exactly { and a quoted key; the output must parse with JSON.parse() without errors.`
}

// Extract the JSON object containing nodes and edges from the response.
// OpenRAG may append a metadata blob like {"search_query": "..."} at the end.
function extractMindMapJson(content: string): MindMapData | null {
  // Find the JSON object that contains "nodes" and "edges"
  const nodesMatch = content.match(/\{"nodes":\s*\[[\s\S]*?\]/)
  const edgesMatch = content.match(/"edges":\s*\[[\s\S]*?\]\s*\}/)

  if (!nodesMatch || !edgesMatch) return null

  // Reconstruct the full JSON object
  const nodesStart = nodesMatch.index!
  const edgesEnd = edgesMatch.index! + edgesMatch[0]!.length

  try {
    let jsonStr = content.slice(nodesStart, edgesEnd)
    // Fix common LLM JSON artifact: {"{"key" -> {"key"
    jsonStr = jsonStr.replace(/\{"\{"/g, '{"')
    const data = JSON.parse(jsonStr)
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
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

  const topic = body?.topic?.trim()

  try {
    const filenames = resolveSelectedFilenames(notebookId, selectedSourceIds)
    const chatParams = {
      message: buildPrompt(topic),
      filterId: notebook.openragFilterId,
      filters: { data_sources: filenames },
      limit: QUERY_LIMIT,
      scoreThreshold: QUERY_SCORE_THRESHOLD,
      stream: true as const,
    }
    console.log('[OpenRAG Debug] mindmap chat.create:', JSON.stringify(chatParams))

    const stream = await openrag.chat.create(chatParams)
    let fullContent = ''

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const topicDesc = topic ? ` about "${topic}"` : ''
          const statusMsg = `I have started creating a mind map${topicDesc} for you.\n\nThis will analyze the structure of your selected sources — discovering categories, groupings, and individual items — and organize them into a hierarchical visual diagram.\n\nYou can find it in the Notes panel once it finishes generating.`
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ message: statusMsg })}\n\n`))

          for await (const event of stream) {
            if (event.type === 'content') {
              fullContent += event.delta
              controller.enqueue(encoder.encode(`event: content\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`))
            } else if (event.type === 'sources') {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`))
            } else if (event.type === 'done') {
              // Parse the JSON response, stripping any metadata blob
              const mindMapData = extractMindMapJson(fullContent)
              if (!mindMapData) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Could not extract concept map from the selected sources.' })}\n\n`))
                controller.close()
                return
              }

              if (mindMapData.nodes.length < 2) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Fewer than two distinct concepts were identified in the selected sources.' })}\n\n`))
                controller.close()
                return
              }

              // Save the note
              const now = new Date().toISOString()
              const dateStr = now.slice(0, 10)
              const title = topic ? topic.slice(0, 60) : `Mind Map — ${dateStr}`
              const note = createNote({ id: `note_${uuid()}`, notebookId, title, type: 'mindmap', mindMapData, createdAt: now, updatedAt: now })
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