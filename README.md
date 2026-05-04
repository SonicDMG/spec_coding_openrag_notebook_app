# Workshop - Spec coding a simple OpenRAG Notebook application

## Workshop Contents
1. [Set up OpenRAG](#1-set-up-openrag)
2. [Configure your environment](#2-configure-your-environment)
3. [Install dependencies and run the app](#3-install-dependencies-and-run-the-app)
4. [Building the service layer](#4-building-the-service-layer)
5. [Building the Web UI](#5-building-the-web-ui)

## Prerequisites
 - Node.js 18 or higher
 - An OpenRAG instance (local or hosted)
 - An agentic coding tool (Claude Code, Cursor, IBM Bob)

## 1. Set up OpenRAG

This application uses [OpenRAG](https://openr.ag) as its document store and RAG engine. OpenRAG handles document ingestion, vector embeddings, knowledge filters, and chat.

### 1a. Run OpenRAG locally

Follow the [OpenRAG quickstart](https://docs.openr.ag/quickstart) to get a local instance running. By default it listens on port `3000`.

### 1b. Obtain your OpenRAG API key

Once OpenRAG is running, generate an API key from the OpenRAG admin interface or follow the instructions in the OpenRAG documentation. Copy the key — you will need it in the next step.

## 2. Configure your environment

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `OPENRAG_API_KEY` | API key for your OpenRAG instance |
| `OPENRAG_URL` | Base URL of your OpenRAG instance (e.g., `http://localhost:3000`) |

## 3. Install dependencies and run the app

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3001](http://localhost:3001).

## 4. Building the service layer

To build this application from scratch, we use an approach called **Spec Coding**. This is a multi-step process where we guide an AI coding agent (like Claude Code, Cursor, or IBM Bob) to generate a **requirements doc**, then a **design doc** and **OpenAPI specification**, then a **TODO list**, and finally the implementation — one task at a time.

### Sample prompts

### 4a. Prompt for generating the requirements doc

_I am building an open-source, locally-runnable notebook application inspired by NotebookLM. Users can create notebooks, add sources (text, PDF, or URL), chat with those sources using a RAG pipeline powered by OpenRAG, and save responses as notes. Notes can also include AI-generated artifacts such as overviews, data tables, and mind maps. Please help me build a `requirements.md` document for this project with numbered REQ-IDs, acceptance criteria for each, personas, and user flows. At this point, do not focus on implementation details or technology choices._

### 4b. Prompt for generating the design doc and OpenAPI spec

_Read the `requirements.md` document. From those requirements:_
1. _Create a `design.md` file that describes the data models (Notebook, Source, Note) and system architecture._
2. _Inside `design.md`, detail the creation of a Next.js 14 App Router application (TypeScript) with server-side Route Handlers for all API endpoints. Use SQLite via `better-sqlite3` for notebook/source/note metadata persistence. Use the `openrag-sdk` npm package to communicate with an OpenRAG instance for document ingestion, knowledge filter management, and RAG chat. Be sure each endpoint maps back to a REQ-ID._
3. _Create an `openapi.yaml` (OpenAPI 3.1) file that describes all API endpoints, request/response schemas, and error responses._

### 4c. Prompt for generating the TODO list

_Read the `requirements.md`, `design.md`, and `openapi.yaml`. From those requirements, create a `todo.md` file that breaks down the tasks required to complete the project. Each task should be checkable when complete._

### 4d. Prompt for implementing the TODO list

_Read `requirements.md`, `design.md`, `openapi.yaml`, and `todo.md`. Work through each unchecked task one at a time, implementing the code, marking each task done as you complete it, and stopping to confirm before moving to the next section._

## 5. Building the Web UI
_*Bonus Step*_

_Can you help me build a three-panel web UI on top of the service layer? The left panel shows sources with checkboxes and a search filter. The center panel is a chat interface with streaming responses. The right panel is a notes list that supports AI-generated overviews, data tables, and mind maps. Build it in React using Next.js App Router, Tailwind CSS, and shadcn/ui components. All API calls should use the endpoints defined in `openapi.yaml`._
