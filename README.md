<div align="center">
  <img src="assets/openrag-logo.svg" alt="OpenRAG" width="120" style="background:#1e1b2e; border-radius:12px; padding:16px;" />

  # 🐕 Spec Code Your Next RAG App 🤖

  ### Build AI-powered applications in minutes using OpenRAG and your favorite AI coding agent

  _This repo contains a fully built reference app — an open-source notebook powered by OpenRAG — and a step-by-step workshop for spec coding your own._
</div>

<div align="center">
  <img src="assets/openrag_vhs.gif" alt="OpenRAG Demo" width="600" />
</div>

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

Ask your AI coding agent (Claude Code, IBM Bob, Cursor, etc.) to run the following:

```
Please fetch and install both OpenRAG SKILLs into your global skills directory:
- https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/install/SKILL.md
- https://github.com/langflow-ai/openrag/blob/main/plugins/openrag/skills/sdk/SKILL.md
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

Once OpenRAG is running at `http://localhost:3000`:

1. Open **Settings** from the left navigation
2. Scroll to the **API Keys** section
3. Click **Create your first API key**, give it a name, and confirm
4. Copy the key immediately — it starts with `orag_` and **will not be shown again**

You will need this key in the next step.

## 3. Run the example app (optional)

> [!TIP]
> This step is optional. If you're here to build your own app, skip ahead to [step 4](#4-building-the-service-layer).

This repo includes a fully built reference implementation. If you'd like to run it before building your own, follow these steps.

<img src="assets/notebooklm_oss_app.png" alt="OpenRAG Notebook App" width="800" />

### 3a. Configure your environment

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `OPENRAG_API_KEY` | API key for your OpenRAG instance |
| `OPENRAG_URL` | Base URL of your OpenRAG instance (e.g., `http://localhost:3000`) |

A completed `.env.local` should look like this:

```
OPENRAG_API_KEY=orag_abc123xyz
OPENRAG_URL=http://localhost:3000
```

### 3b. Install dependencies and start the app

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3001](http://localhost:3001).

## 4. Building the service layer

We use an approach called **Spec Coding**: guiding an AI coding agent (like Claude Code, IBM Bob, or Cursor) to generate a **requirements doc**, then a **design doc** and **OpenAPI specification**, then validate coverage, and finally implement — one task at a time. For a deeper dive into the methodology, see the [workshop slides](assets/openrag_spec_coding.pdf).

You can build **any application you like** using this approach — the notebook app is just a reference. To build something different, replace the description in prompt 4a ("an open-source, locally-runnable notebook application inspired by NotebookLM") with your own idea. The rest of the prompts work as-is.

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
1. Create design.md with data model and knowledge filters needed for OpenRAG.
2. Create openapi.yaml (OpenAPI 3.1) with all endpoints, schemas, and error responses.
3. Map each endpoint back to a REQ-ID.
4. Detail the technical requirements for frontend and backend.
5. Use the openrag_sdk SKILL for all OpenRAG SDK integration details.
6. Ask questions regarding the application tech stack to use for this type of app.
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

## Wrapping up

If you've made it this far, you've spec coded a working RAG-powered application from scratch using an AI coding agent — nice work. From here, the app is yours to extend, redesign, or tear down and rebuild in a completely different direction.

### Troubleshooting

If things go sideways, here are some things to check:

**OpenRAG won't connect**
- Confirm OpenRAG is running: open `http://localhost:3000` in your browser
- Double-check `OPENRAG_URL` in your `.env` file — no trailing slash
- Verify your `OPENRAG_API_KEY` is valid and hasn't expired

**The agent goes off the rails**
- Pull it back to the spec: ask it to re-read `requirements.md` and `openapi.yaml` before continuing
- Break the problem into a smaller task and ask it to focus on just that
- If the code is in a bad state, ask the agent to summarize what changed and walk it back to the last known good point using git

**Tests keep failing**
- Make sure your OpenRAG instance is running when tests execute
- Ask the agent to run a single failing test in isolation and explain the error before attempting a fix
- Remind the agent: fix the implementation, not the test

**The agent invented something not in the spec**
- Ask it to identify which REQ-ID covers the behavior in question
- If none does, ask it to remove the code or add a requirement first before implementing

### Resources

- OpenRAG documentation: [docs.openr.ag](https://docs.openr.ag)
- OpenRAG GitHub: [github.com/langflow-ai/openrag](https://github.com/langflow-ai/openrag)
