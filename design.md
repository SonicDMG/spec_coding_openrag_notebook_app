# NotebookLM OSS Clone — Technical Design

## 1. Architecture Overview

```
Browser (Next.js frontend)
        │
        │  HTTP / SSE
        ▼
Next.js App Router (port 3001)
  ├── /app              — React pages and layouts
  ├── /app/api          — Route Handlers (server-side only)
  │       ├── notebooks/...
  │       ├── sources/...
  │       ├── chat/...
  │       ├── notes/...
  │       └── generate/...
  └── /lib
          ├── store.ts  — metadata persistence layer
          └── openrag.ts — singleton OpenRAG SDK client
        │
        │  openrag-sdk (TypeScript)
        ▼
OpenRAG (port 3000)
  ├── Document store (embeddings + raw text)
  ├── Chat / RAG engine
  ├── Search
  └── Knowledge Filters
```

The Next.js app owns:
- Notebook metadata (id, name, timestamps)
- Source metadata (id, title, type, url, openrag filename mapping)
- Notes (text, table data, mind map data)

OpenRAG owns:
- Raw document text and vector embeddings
- One persistent knowledge filter per notebook
- Optional: OpenRAG-side chat conversation history (we use `chat_id` for follow-up messages)

---

## 2. Data Models

### Notebook
```ts
interface Notebook {
  id: string;           // uuid
  name: string;
  openragFilterId: string; // knowledge filter ID in OpenRAG
  createdAt: string;    // ISO 8601
}
```

### Source
```ts
interface Source {
  id: string;           // uuid
  notebookId: string;
  title: string;
  type: 'text' | 'pdf' | 'url';
  url?: string;         // populated for 'url' type only
  openragFilename: string; // key used in OpenRAG: "{notebookId}-{sourceId}"
  createdAt: string;    // ISO 8601
}
```

`checked` (whether the source is selected for chat) is **not** persisted — it is ephemeral React state that resets to `true` for all sources on every page load (per REQ-010 / REQ-014).

### Note
```ts
interface Note {
  id: string;           // uuid
  notebookId: string;
  title: string;
  type: 'manual' | 'chat' | 'overview' | 'table' | 'mindmap';
  body?: string;        // plain text; present for manual, chat, overview
  tableData?: {
    headers: string[];
    rows: string[][];
  };                    // present for 'table' type
  mindMapData?: {
    nodes: { id: string; label: string }[];
    edges: { from: string; to: string; label: string }[];
  };                    // present for 'mindmap' type
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

---

## 3. Document Naming Convention in OpenRAG

Every document ingested to OpenRAG is stored under a filename derived from:

```
{notebookId}-{sourceId}
```

Examples:
- PDF: `nb_abc123-src_def456.pdf`
- Text paste: `nb_abc123-src_def456.txt`
- URL content (saved as text): `nb_abc123-src_def456.txt`

This convention ensures:
- Documents from different notebooks never collide.
- Filtering by notebook is a simple `data_sources` array lookup using stored `openragFilename` values.
- Deleting a source maps 1:1 to deleting a single document in OpenRAG.

---

## 4. Knowledge Filter Design

### Why knowledge filters
OpenRAG's knowledge filters let a chat or search request be scoped to a pre-defined set of documents. Without them every chat query searches the entire OpenRAG document store, which would return results from other notebooks' documents.

### Filter types

#### 4.1 Notebook Filter (persistent)

One filter per notebook, maintained for the lifetime of the notebook.

```
Name:        notebook-{notebookId}
Description: Sources for notebook "{notebookName}"
queryData:
  filters:
    data_sources: [ ...openragFilename for every source in notebook ]
  limit: 10
  scoreThreshold: 0.3
```

**Lifecycle:**
| Event | Action on OpenRAG |
|---|---|
| Notebook created | `client.knowledge_filters.create(...)` → store returned `id` as `openragFilterId` |
| Source added | `client.knowledge_filters.update(filterId, { queryData: { filters: { data_sources: [...] } } })` |
| Source removed | same update, with that filename removed |
| Notebook deleted | `client.knowledge_filters.delete(filterId)` |

**Used when:** all sources in the notebook are selected (the common case).

#### 4.2 Selection Filter (ephemeral)

Created immediately before a chat or generation request when only a subset of sources is selected. Deleted immediately after the response completes (or errors).

```
Name:        sel-{notebookId}-{unix_ms}
Description: Ephemeral selection filter
queryData:
  filters:
    data_sources: [ ...openragFilename for each checked source ]
  limit: 10
  scoreThreshold: 0.3
```

**Lifecycle:** create → use as `filter_id` in `chat.create()` or `search.query()` → delete. The delete always runs in a `finally` block so orphaned filters are not left behind.

### Filter selection logic (server-side, per request)

```
if (selectedSourceIds.length === allSources.length) {
  filterId = notebook.openragFilterId   // use persistent filter
} else {
  filterId = await createEphemeralFilter(selectedSourceIds)
  // ... call OpenRAG ...
  await deleteFilter(filterId)           // always in finally
}
```

---

## 5. OpenRAG SDK Integration

### Client initialization (`/lib/openrag.ts`)

```ts
import { OpenRAGClient } from 'openrag-sdk';

// Module-level singleton — reused across all Route Handler invocations
export const openrag = new OpenRAGClient({
  apiKey: process.env.OPENRAG_API_KEY!,
  baseUrl: process.env.OPENRAG_URL ?? 'http://localhost:3000',
});
```

The client is never imported in any client component. All SDK calls happen exclusively inside Next.js Route Handlers.

### 5.1 Document Ingestion (REQ-006, REQ-007, REQ-008)

**PDF upload:**
```ts
// file: File from multipart form
const result = await openrag.documents.ingest({
  file: fileBuffer,
  filename: source.openragFilename,   // e.g. "nb_abc-src_def.pdf"
});
await openrag.documents.waitForTask(result.task_id);
```

**Text / URL (saved as .txt):**
```ts
const blob = new Blob([textContent], { type: 'text/plain' });
const result = await openrag.documents.ingest({
  file: blob,
  filename: source.openragFilename,   // e.g. "nb_abc-src_def.txt"
});
await openrag.documents.waitForTask(result.task_id);
```

URL content extraction (fetching and stripping HTML) happens on the server before ingestion, not inside OpenRAG.

### 5.2 Chat — Streaming (REQ-013, REQ-015)

```ts
const stream = await openrag.chat.create({
  message: userMessage,
  chat_id: chatId ?? undefined,    // undefined starts a new conversation
  filter_id: resolvedFilterId,
  stream: true,
});

// Pipe to Next.js Response as SSE
const readable = new ReadableStream({
  async start(controller) {
    for await (const event of stream) {
      if (event.type === 'content') {
        controller.enqueue(`event: content\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
      } else if (event.type === 'sources') {
        controller.enqueue(`event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`);
      } else if (event.type === 'done') {
        controller.enqueue(`event: done\ndata: ${JSON.stringify({ chatId: event.chat_id })}\n\n`);
        controller.close();
      }
    }
  },
});

return new Response(readable, {
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
});
```

The frontend receives the `chatId` from the `done` event and stores it in React state to pass back on follow-up messages (REQ-013 conversation context).

### 5.3 Generation (REQ-018, REQ-024, REQ-025)

Overview, data table, and mind map generation use the non-streaming chat API with a structured system prompt instructing the model to return JSON. The server parses the JSON and stores it as the appropriate note type.

Example for data table:
```ts
const response = await openrag.chat.create({
  message: buildTablePrompt(focusPrompt),
  filter_id: resolvedFilterId,
  stream: false,
});
const tableData = JSON.parse(response.response); // { headers, rows }
```

### 5.4 Source Removal (REQ-012)

```ts
await openrag.documents.delete(source.openragFilename);
```

Then update the notebook's persistent knowledge filter to remove that filename.

### 5.5 Error handling

All Route Handlers wrap SDK calls in try/catch and map SDK error types to HTTP status codes:

| SDK Error | HTTP Status |
|---|---|
| `AuthenticationError` | 500 (config issue, not user's fault) |
| `NotFoundError` | 404 |
| `ValidationError` | 422 |
| `RateLimitError` | 429 |
| `ServerError` | 502 |
| Unexpected | 500 |

---

## 6. Frontend Technical Requirements

### 6.1 Page / Route Structure

```
/                          → Home: notebook list (REQ-002)
/notebooks/[notebookId]    → Notebook view: three-panel layout (REQ-005)
```

### 6.2 Three-Panel Layout (REQ-005)

- Desktop (≥ 1024px): CSS Grid, three fixed-width columns, full-height.
- Mobile (< 1024px): single-panel view with a tab bar to switch between Sources, Chat, Notes. Chat is the default panel.

### 6.3 Streaming Chat UI (REQ-013, REQ-015)

The frontend uses the browser's `fetch` + `ReadableStream` to consume the SSE endpoint:
```ts
const res = await fetch('/api/notebooks/{id}/chat', { method: 'POST', body: ... });
const reader = res.body!.getReader();
// Append event.delta tokens to the in-progress message as they arrive
```
The chat input is disabled while the reader is open. The `done` event closes the stream and re-enables the input.

### 6.4 Mind Map Rendering (REQ-025)

Renders `mindMapData` (nodes + edges) as an interactive graph with pan and zoom. **Library choice TBD** (see Section 8).

### 6.5 Markdown Rendering (REQ-014)

AI responses are rendered with a markdown library. Bold, bullet lists, and inline code must be supported at minimum.

### 6.6 State

| State | Location | Persistence |
|---|---|---|
| Notebook list | Server (metadata store) | Persisted |
| Source list | Server (metadata store) | Persisted |
| Source `checked` | React state (local to notebook page) | Session only (resets on load) |
| Chat history | React state (local to notebook page) | Session only |
| `chatId` (OpenRAG) | React state (local to notebook page) | Session only |
| Notes list | Server (metadata store) | Persisted |

---

## 7. Backend Technical Requirements

### 7.1 Route Handlers

All live under `/app/api/`. Each handler:
- Validates inputs and returns `400` for bad data before touching OpenRAG.
- Calls OpenRAG via the singleton client from `/lib/openrag.ts`.
- Reads/writes notebook, source, and note metadata via the store from `/lib/store.ts`.
- Returns `application/json` (or `text/event-stream` for chat).

### 7.2 Metadata Persistence (`/lib/store.ts`)

A thin abstraction over the chosen persistence mechanism (see Section 8). Exposes:

```ts
// Notebooks
getNotebooks(): Notebook[]
getNotebook(id): Notebook | undefined
createNotebook(data): Notebook
updateNotebook(id, patch): Notebook
deleteNotebook(id): void

// Sources
getSources(notebookId): Source[]
getSource(notebookId, sourceId): Source | undefined
createSource(data): Source
deleteSource(notebookId, sourceId): void

// Notes
getNotes(notebookId): Note[]
getNote(notebookId, noteId): Note | undefined
createNote(data): Note
updateNote(notebookId, noteId, patch): Note
deleteNote(notebookId, noteId): void
```

### 7.3 URL Content Extraction (REQ-008)

Server-side fetch of the URL, then HTML-to-text stripping. The page title is extracted from `<title>` or `<h1>`. The resulting plain text is ingested to OpenRAG as a `.txt` file.

### 7.4 File Upload Handling (REQ-007)

Multipart form data parsed in the Route Handler. The PDF `ArrayBuffer` is passed directly to the OpenRAG SDK — no temporary disk writes required.

### 7.5 Generation Prompts

Each generation endpoint sends a structured system prompt to OpenRAG's chat, then parses the response:

- **Overview** (REQ-018): prompt asks for a structured text summary → stored as `body` string.
- **Data Table** (REQ-024): prompt asks for `{ headers: string[], rows: string[][] }` JSON → parsed and stored as `tableData`.
- **Mind Map** (REQ-025): prompt asks for `{ nodes: [{id,label}], edges: [{from,to,label}] }` JSON → parsed and stored as `mindMapData`.

If parsing fails (model returns non-JSON), the endpoint returns `422`.

---

## 8. Open Tech Stack Questions

Before scaffolding the project, the following choices need to be made:

### Q1 — Data Persistence
Where does notebook/source/note metadata live?

| Option | Tradeoff |
|---|---|
| **A. SQLite** (`better-sqlite3`) | Zero external deps, persists across browsers, easy to inspect. Recommended. |
| **B. JSON file on disk** | Even simpler, but no transactions — risky if two tabs write simultaneously. |
| **C. In-memory (Map)** | Zero setup, but all data lost on server restart. Demo-only. |

### Q2 — UI Component Library
| Option | Tradeoff |
|---|---|
| **A. Tailwind CSS + shadcn/ui** | Best DX for Next.js, accessible, fully customizable. Recommended. |
| **B. Tailwind only** | More work to build components from scratch. |
| **C. MUI (Material UI)** | More opinionated, heavier bundle. |

### Q3 — Mind Map Library
| Option | Tradeoff |
|---|---|
| **A. React Flow (`@xyflow/react`)** | Best DX, built-in pan/zoom, MIT licensed, active. Recommended. |
| **B. Cytoscape.js** | More graph-algorithm features, larger API surface. |
| **C. D3-force** | Maximum control, significant implementation effort. |

### Q4 — Markdown Rendering
| Option | Tradeoff |
|---|---|
| **A. `react-markdown`** | Standard, lightweight, composable. Recommended. |
| **B. `marked` + `dangerouslySetInnerHTML`** | Faster, but XSS risk if not sanitized. |

### Q5 — Package Manager
npm / yarn / pnpm / bun?
