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

### 1b. Install OpenRAG using the Claude Code SKILL (alternative)

The OpenRAG repo includes a SKILL that automates the installation process. No cloning required — ask your AI coding assistant (Claude Code, Cursor, etc.) to install the SKILL locally first, then invoke it:

> Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/install/SKILL.md and install it into my local `.claude/skills` directory.

Once installed, invoke it:

```
/openrag_install
```

The SKILL will draft a requirements spec, create a task list, guide you through configuration, and verify that OpenRAG is running at `http://localhost:3000` before finishing.

### 1c. Obtain your OpenRAG API key

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

_I'm building an open-source, locally-runnable notebook application inspired by NotebookLM, powered by OpenRAG. Write requirements in `requirements.md` with:_

- _Numbered IDs (REQ-001, REQ-002 ...)_
- _Acceptance criteria for each_
- _Personas and User flows_

_Do not include any implementation details such as code or technology choices._

_This should be an MVP/demo level project, no production/enterprise level code, no security concerns, build only the most basic application._

### 4b. Prompt for generating the design doc and OpenAPI spec

First, install the OpenRAG SDK SKILL so your agent knows how to use it:

> Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/sdk/SKILL.md and install it into my local `.claude/skills` directory.

Then prompt your agent:

_Read `requirements.md`. From those requirements:_
1. _Create a `design.md` describing the data models and system architecture. Use the `openrag_sdk` SKILL for all OpenRAG integration. Be sure each endpoint maps back to a REQ-ID._
2. _Create an `openapi.yaml` (OpenAPI 3.1) file that describes all API endpoints, request/response schemas, and error responses._

### 4c. Prompt for validating the OpenAPI spec

_Validate `openapi.yaml`. Check that every REQ-ID in `requirements.md` is covered by at least one endpoint. List any gaps and fix them._

### 4d. Prompt for implementation

_Read `requirements.md`, `design.md`, `openapi.yaml`._

1. _Create `todo.md` breaking the spec into tasks_
2. _Implement each task. Use `.env` for creds._
3. _Write tests and run them after each task_
4. _Mark each task done in `todo.md` when it passes_

### 4e. Prompt for fixing failing tests

_Run all tests. For any that fail:_

1. _Read the error output_
2. _Check `openapi.yaml` for the expected behavior_
3. _Fix the implementation, not the test_
4. _Re-run until green_

## 5. Building the Web UI
_*Bonus Step*_

_Can you help me build a three-panel web UI on top of the service layer? The left panel shows sources with checkboxes and a search filter. The center panel is a chat interface with streaming responses. The right panel is a notes list that supports AI-generated overviews, data tables, and mind maps. Build it in React using Next.js App Router, Tailwind CSS, and shadcn/ui components. All API calls should use the endpoints defined in `openapi.yaml`._
