# NotebookLM OSS Clone — Requirements

## Personas

### P1 — The Student
A university student who uploads lecture notes, research papers, and textbook excerpts. Wants to ask questions about the material and get quick summaries before exams.

### P2 — The Researcher
A professional who collects PDFs and articles on a topic. Wants to synthesize information across multiple sources without reading everything in full.

### P3 — The Casual Explorer
A curious person who pastes in articles or uploads documents they found interesting. Wants to have a conversation with the content to understand it better.

---

## User Flows

### Flow A — Create a Notebook and Add Sources
1. User opens the app and sees a list of their notebooks (empty on first visit).
2. User creates a new notebook and gives it a name.
3. User adds one or more sources to the notebook (upload file or paste text).
4. User sees the sources listed in the left panel.

### Flow B — Chat with Sources
1. User opens a notebook that has at least one source.
2. Optionally, the user checks/unchecks sources to narrow the context.
3. User types a question in the center chat panel.
4. The app responds with an answer grounded in the selected sources.
5. User continues the conversation, asking follow-up questions.

### Flow C — Save a Chat Response as a Note
1. User receives a useful chat response.
2. User clicks "Save to note" on that response.
3. The response appears as a new note in the right Notes panel.

### Flow D — Generate an Overview Note
1. User is in a notebook with at least one source selected.
2. User triggers "Generate overview."
3. A new note appears in the right Notes panel with the generated content.

### Flow E — Manage Notebooks and Sources
1. User opens a notebook.
2. User removes a source they no longer need.
3. User renames or deletes the notebook.

---

## Requirements

### Notebooks

**REQ-001 — Create a Notebook**
A user can create a new, empty notebook with a user-supplied name.

Acceptance criteria:
- A notebook requires a non-empty name to be created.
- The new notebook appears immediately in the notebook list.
- A notebook starts with zero sources and zero notes.

---

**REQ-002 — List Notebooks**
A user can see all notebooks they have created.

Acceptance criteria:
- Each entry shows the notebook name and source count.
- The list is shown on the main/home screen, sorted by most recently created first.
- Clicking a notebook opens it.
- When no notebooks exist, a visible prompt tells the user how to create their first one.

---

**REQ-003 — Rename a Notebook**
A user can change the name of an existing notebook.

Acceptance criteria:
- The updated name is reflected everywhere the notebook appears.
- An empty name is not accepted.

---

**REQ-004 — Delete a Notebook**
A user can delete a notebook along with all of its sources and notes.

Acceptance criteria:
- The user is asked to confirm before deletion.
- After deletion the notebook no longer appears in the list and the user is returned to the home notebook list.

---

### Layout

**REQ-005 — Three-Panel Notebook View**
When a notebook is open, the interface is divided into three panels: Sources (left), Chat (center), and Notes (right).

Acceptance criteria:
- All three panels are visible simultaneously on a desktop-width viewport (≥ 1024px).
- On a narrow viewport (< 1024px), only one panel is shown at a time; the Chat panel is shown by default with navigation controls to switch to Sources or Notes.
- The notebook title is displayed prominently above the panels.

---

### Sources

**REQ-006 — Add a Text Source**
A user can add a source by pasting plain text directly into the app.

Acceptance criteria:
- The source requires a non-empty body of text.
- The user can optionally supply a title; if omitted, the title is derived from the first line of the text, truncated to 60 characters.
- The source appears in the left Sources panel after saving.
- If the same text content already exists as a source in the notebook, the user is warned and the duplicate is not added.

---

**REQ-007 — Add a File Source (PDF)**
A user can upload a PDF file as a source.

Acceptance criteria:
- Only PDF files are accepted; other file types are rejected with a clear message.
- The filename (without extension) is used as the default source title.
- The source appears in the left Sources panel after upload completes.
- If the file cannot be parsed (e.g., corrupted or password-protected), the user sees an error and the source is not added.
- If a file with the same name already exists as a source in the notebook, the user is warned and the duplicate is not added.

---

**REQ-008 — Add a URL Source**
A user can provide a public webpage URL as a source.

Acceptance criteria:
- The app fetches and extracts the readable text content of the page.
- The page title is used as the default source title.
- If the URL is unreachable or returns no readable text content, the user sees an error and the source is not added.
- If the same URL already exists as a source in the notebook, the user is warned and the duplicate is not added.
- The source appears in the left Sources panel after fetching completes.

---

**REQ-009 — View Sources in a Notebook**
A user can see all sources that belong to a notebook in the left panel.

Acceptance criteria:
- Each source entry shows its title and type (text, PDF, or URL).
- Each source has a checkbox indicating whether it is included in chat context.

---

**REQ-010 — Select Sources for Chat**
A user can choose which sources are active for the current chat session using checkboxes.

Acceptance criteria:
- All sources are checked (active) by default when the notebook is opened.
- Unchecking a source excludes it from the AI's context for subsequent messages.
- Re-checking it includes it again for subsequent messages.
- A visible indicator shows how many of the total sources are currently selected (e.g., "3 of 5 selected").
- If zero sources are checked, the chat input is disabled with a message indicating that at least one source must be selected.
- Checking/unchecking sources does not affect the visible search filter in the source list; the two are independent.

---

**REQ-011 — Search Sources**
A user can filter the source list by typing in a search box.

Acceptance criteria:
- Typing filters the displayed sources by title in real time.
- Clearing the search restores the full list.
- When no sources match the search term, a "No results" message is shown in place of the list.
- Search is a display-only filter; it does not change which sources are checked or affect chat context.

---

**REQ-012 — Remove a Source**
A user can remove a source from a notebook.

Acceptance criteria:
- The user is asked to confirm before removal.
- After removal the source no longer appears in the source list.
- Subsequent chat responses no longer draw on the removed source's content.
- Existing chat history and notes that were created using that source are not altered.

---

### Chat

**REQ-013 — Ask a Question About Sources**
A user can type a question and receive an answer drawn from the currently selected sources.

Acceptance criteria:
- The chat input is disabled with a visible message when the notebook has no sources, or when zero sources are checked.
- The response is grounded in the content of the selected sources.
- The response indicates which source(s) the answer references (e.g., source title inline or as a footnote).
- If the answer cannot be found in the selected sources, the response explicitly states this rather than drawing on general knowledge.
- The user can send follow-up messages and the model maintains conversation context within the session.

---

**REQ-014 — Conversation History Within a Session**
The center Chat panel shows the full back-and-forth for the current session.

Acceptance criteria:
- User messages and AI responses are displayed in order.
- AI responses render basic markdown formatting (bold, bullet lists).
- A "session" is defined as a single continuous page load. Chat history is cleared when the user navigates away from the notebook or refreshes the page; it does not need to persist across sessions.

---

**REQ-015 — Loading State During Response**
The user sees a visible indicator while the AI is generating a response.

Acceptance criteria:
- An in-progress indicator appears from the moment the user submits a question until the response is fully shown.
- The chat input is disabled during generation.

---

**REQ-016 — Save a Chat Response as a Note**
A user can save an AI chat response directly into the Notes panel.

Acceptance criteria:
- Each AI response has a "Save to note" action, visible only after the response has fully loaded.
- Triggering it creates a new note whose title defaults to the user's question that prompted the response, truncated to 60 characters.
- The note body contains the full AI response text.
- The note is immediately visible in the Notes panel without requiring a page reload.
- Saving the same response a second time creates a second, independent note; no deduplication is enforced.

---

### Notes

**REQ-017 — Notes Panel**
The right panel displays all notes associated with the notebook.

Acceptance criteria:
- Each note shows its title and a preview of the first 100 characters of its content.
- Notes are listed in the order they were created, newest first.
- Clicking a note opens it to show the full content.
- When no notes exist, the panel shows a message indicating that notes can be generated or created manually.

---

**REQ-018 — Generate an Overview Note**
A user can request a structured summary of the currently selected sources, which is saved as a new note.

Acceptance criteria:
- The action is available only when at least one source is selected (checked).
- The action is disabled when zero sources are checked, consistent with REQ-010.
- Each invocation creates a new note; it does not replace any existing overview note.
- The generated note title is "Overview" plus the current date (e.g., "Overview — 2026-04-23").
- The note covers the main topics and key points across the selected sources.
- The note appears in the Notes panel when generation completes.

---

**REQ-019 — Add a Manual Note**
A user can create a plain text note manually without AI generation.

Acceptance criteria:
- The user can supply an optional title and a body; if no title is provided, the title defaults to the first line of the body truncated to 60 characters, or "Untitled Note" if the body is empty.
- An empty body is not accepted; the save action is disabled until at least one character is entered.
- The note appears in the Notes panel after saving.

---

**REQ-020 — Edit a Note**
A user can edit the title or body of an existing note.

Acceptance criteria:
- Any note (manually created, AI-generated, or saved from chat) can be edited.
- The edit replaces the note's current content in place; it does not create a new note.
- An empty body is not accepted when saving an edit.

---

**REQ-021 — Delete a Note**
A user can delete a note from the Notes panel.

Acceptance criteria:
- The user is asked to confirm before deletion.
- After deletion the note no longer appears in the Notes panel.

---

### Studio Components

Studio components are AI-generated visual or structured artifacts saved into the Notes panel alongside text notes. Each component type has its own rendering when opened.

**REQ-024 — Generate a Data Table**
A user can request a data table extracted from the selected sources, which is saved as a new note rendered as a table.

Acceptance criteria:
- The action is available only when at least one source is selected; it is disabled otherwise.
- Before generating, the user may optionally supply a focus prompt (e.g., "Compare each character's HP, class, and abilities"); if omitted, the AI determines the most meaningful columns from the source content.
- The AI produces a table with labeled column headers and one row per distinct entity or data point found in the sources.
- If no clear tabular data can be extracted from the selected sources, the user is shown a message explaining this and no note is created.
- The note title defaults to the focus prompt (truncated to 60 characters) or "Data Table — {date}" if no prompt was given.
- Each invocation creates a new note; it does not replace any existing data table note.
- The note is rendered as a table (not raw text) when opened in the Notes panel.
- The note appears in the Notes panel when generation completes.

---

**REQ-025 — Generate a Mind Map**
A user can request a mind map of key concepts and their relationships drawn from the selected sources, saved as a new note rendered as an interactive graph.

Acceptance criteria:
- The action is available only when at least one source is selected; it is disabled otherwise.
- Before generating, the user may optionally supply a focus topic (e.g., "Combat mechanics"); if omitted, the AI selects the central concept from the source content.
- The AI produces a set of nodes (concepts) and labeled edges (relationships) representing the structure of the content.
- The central concept is visually distinguished as the root node.
- The rendered graph supports pan and zoom so the user can navigate larger maps.
- Nodes are labeled with concept names; edges are labeled with the relationship type (e.g., "is a type of", "requires", "opposes").
- The note title defaults to the focus topic (truncated to 60 characters) or "Mind Map — {date}" if no topic was given.
- Each invocation creates a new note; it does not replace any existing mind map note.
- The note appears in the Notes panel when generation completes.
- If fewer than two distinct concepts can be identified in the selected sources, the user is shown a message explaining this and no note is created.

---

### General UX

**REQ-022 — Empty State Guidance**
When a notebook has no sources, the notebook view communicates this clearly.

Acceptance criteria:
- A visible prompt or message in the Sources panel tells the user how to add their first source.
- The chat input is disabled with a visible message until at least one source exists.
- The note-generation action (REQ-018) is disabled until at least one source exists.

---

**REQ-023 — Error Communication**
When an operation fails, the user is informed with a plain-language message.

Acceptance criteria:
- Failed file uploads, URL fetches, and AI calls each produce a visible, user-facing error message.
- The app does not crash silently; errors are always surfaced.
