# Workshop - Spec coding a simple OpenRAG Notebook application

## Workshop Contents
1. [Set up OpenRAG](#1-set-up-openrag)
2. [Configure your environment](#2-configure-your-environment)
3. [Install dependencies and run the app](#3-install-dependencies-and-run-the-app)
4. [Building the service layer](#4-building-the-service-layer)
5. [Building the Web UI](#5-building-the-web-ui)

## Prerequisites
 - An OpenRAG instance (local or hosted)
 - An agentic coding tool (Claude Code, IBM Bob, Cursor, etc.)

## 1. Set up OpenRAG

This application uses [OpenRAG](https://openr.ag) as its document store and RAG engine. OpenRAG handles document ingestion, vector embeddings, knowledge filters, and chat.

### 1a. Run OpenRAG locally

Follow the [OpenRAG quickstart](https://docs.openr.ag/quickstart) to get a local instance running. By default it listens on port `3000`.

### 1b. Install OpenRAG using an AI coding agent SKILL (alternative)

The OpenRAG repo includes a SKILL that automates the installation process. No cloning required — ask your AI coding agent (Claude Code, IBM Bob, Cursor, etc.) to fetch and install the SKILL locally, then invoke it:

```
Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/install/SKILL.md and install it into your local skills directory.
```

Once installed, invoke it with:

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

```
I'm building an open-source, locally-runnable notebook application inspired by NotebookLM, powered by OpenRAG. Write requirements in requirements.md with:

- Numbered IDs (REQ-001, REQ-002 ...)
- Acceptance criteria for each
- Personas and User flows

Do not include any implementation details such as code or technology choices.

This should be an MVP/demo level project, no production/enterprise level code, no security concerns, build only the most basic application.
```

### 4b. Prompt for generating the design doc and OpenAPI spec

First, install the OpenRAG SDK SKILL so your agent knows how to use it. Ask your AI coding agent (Claude Code, IBM Bob, Cursor, etc.):

```
Please fetch the SKILL at https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/sdk/SKILL.md and install it into your local skills directory.
```

Then prompt your agent:

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
