# Workshop - Spec coding a simple OpenRAG Notebook application

## Workshop Contents
1. [Install OpenRAG SKILLs](#1-install-openrag-skills)
2. [Set up OpenRAG](#2-set-up-openrag)
3. [Run the example app (optional)](#3-run-the-example-app-optional)
4. [Building the service layer](#4-building-the-service-layer)
5. [Building the Web UI](#5-building-the-web-ui)

## Prerequisites
 - An OpenRAG instance (local or hosted)
 - An agentic coding tool (Claude Code, IBM Bob, Cursor, etc.)

## 1. Install OpenRAG SKILLs

Before anything else, install both OpenRAG SKILLs into your AI coding agent. This gives your agent the knowledge it needs to install OpenRAG and integrate with it throughout the workshop — with no interruptions later.

Ask your AI coding agent (Claude Code, IBM Bob, Cursor, etc.) to run both of the following:

```
Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/install/SKILL.md and install it into your local skills directory.
```

```
Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/sdk/SKILL.md and install it into your local skills directory.
```

## 2. Set up OpenRAG

This application uses [OpenRAG](https://openr.ag) as its document store and RAG engine. OpenRAG handles document ingestion, vector embeddings, knowledge filters, and chat.

### 2a. Run OpenRAG locally

Follow the [OpenRAG quickstart](https://docs.openr.ag/quickstart) to get a local instance running. By default it listens on port `3000`.

### 2b. Install OpenRAG using the SKILL (alternative)

With the install SKILL already set up in step 1, simply invoke it:

```
/openrag_install
```

The SKILL will draft a requirements spec, create a task list, guide you through configuration, and verify that OpenRAG is running at `http://localhost:3000` before finishing.

### 2c. Obtain your OpenRAG API key

Once OpenRAG is running, generate an API key from the OpenRAG admin interface or follow the instructions in the OpenRAG documentation. Copy the key — you will need it in the next step.

## 3. Run the example app (optional)

This repo includes a fully built reference implementation. If you'd like to run it before building your own, follow these steps.

### 3a. Configure your environment

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `OPENRAG_API_KEY` | API key for your OpenRAG instance |
| `OPENRAG_URL` | Base URL of your OpenRAG instance (e.g., `http://localhost:3000`) |

### 3b. Install dependencies and start the app

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3001](http://localhost:3001).

## 4. Building the service layer

To build this application from scratch, we use an approach called **Spec Coding**. This is a multi-step process where we guide an AI coding agent (like Claude Code, IBM Bob, or Cursor) to generate a **requirements doc**, then a **design doc** and **OpenAPI specification**, then validate coverage, and finally implement — one task at a time.

### Sample prompts

### 4a. Prompt for generating the requirements doc

```
I'm building an open-source, locally-runnable notebook application inspired by NotebookLM, powered by OpenRAG. Write requirements in requirements.md with:

- Numbered IDs (REQ-001, REQ-002 ...)
- Acceptance criteria for each
- Personas and User flows

Do not include any implementation details such as code or technology choices.

This should be an MVP/demo level project, no production/enterprise level code, no security concerns, build only the most basic application.
```

### 4b. Prompt for generating the design doc and OpenAPI spec

```
Read requirements.md. From those requirements:
1. Create a design.md describing the data models and system architecture. Use the openrag_sdk SKILL for all OpenRAG integration. Be sure each endpoint maps back to a REQ-ID.
2. Create an openapi.yaml (OpenAPI 3.1) file that describes all API endpoints, request/response schemas, and error responses.
```

### 4c. Prompt for validating the OpenAPI spec

```
Validate openapi.yaml. Check that every REQ-ID in requirements.md is covered by at least one endpoint. List any gaps and fix them.
```

### 4d. Prompt for implementation

```
Read requirements.md, design.md, openapi.yaml.

1. Create todo.md breaking the spec into tasks
2. Implement each task. Use .env for creds.
3. Write tests and run them after each task
4. Mark each task done in todo.md when it passes
```

### 4e. Prompt for fixing failing tests

```
Run all tests. For any that fail:

1. Read the error output
2. Check openapi.yaml for the expected behavior
3. Fix the implementation, not the test
4. Re-run until green
```

## 5. Building the Web UI
_*Bonus Step*_

```
Can you help me build a three-panel web UI on top of the service layer? The left panel shows sources with checkboxes and a search filter. The center panel is a chat interface with streaming responses. The right panel is a notes list that supports AI-generated overviews, data tables, and mind maps. All API calls should use the endpoints defined in openapi.yaml.
```
