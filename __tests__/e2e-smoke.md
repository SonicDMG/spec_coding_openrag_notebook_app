# End-to-End Smoke Test Guide

This document describes the manual E2E smoke test to verify the complete application flow.

## Prerequisites

1. OpenRAG must be running at `http://localhost:3000`
2. `OPENRAG_API_KEY` must be set in `.env.local`
3. Run `npm run dev` to start the app on port 3001

## Test Flow

### 1. Create Notebook
- [ ] Open http://localhost:3001
- [ ] Click "New notebook"
- [ ] Enter name "Test Notebook"
- [ ] Click "Create"
- [ ] Verify redirect to notebook page with three panels

### 2. Add Text Source
- [ ] In Sources panel, click "Add"
- [ ] Select "Text" tab
- [ ] Paste sample text (e.g., "The quick brown fox jumps over the lazy dog. This is a test document about animals.")
- [ ] Click "Add text source"
- [ ] Verify source appears in list with checkbox checked

### 3. Add URL Source (Optional)
- [ ] Click "Add" again
- [ ] Select "URL" tab
- [ ] Enter a public URL (e.g., https://en.wikipedia.org/wiki/Artificial_intelligence)
- [ ] Click "Add URL source"
- [ ] Wait for fetch to complete
- [ ] Verify source appears in list

### 4. Chat with Sources
- [ ] In Chat panel, type "What is this document about?"
- [ ] Press Enter or click Send
- [ ] Verify streaming response appears token by token
- [ ] Verify source citations appear below response
- [ ] Verify "Save to note" button appears after response completes

### 5. Save Chat Response as Note
- [ ] Click "Save to note" on the AI response
- [ ] Verify note appears in Notes panel with question as title
- [ ] Click the note to open it
- [ ] Verify full response is displayed
- [ ] Click back arrow to return to notes list

### 6. Create Manual Note
- [ ] In Notes panel, click "New"
- [ ] Enter title "My Manual Note"
- [ ] Enter body "This is a test note I created manually."
- [ ] Click "Save"
- [ ] Verify note appears in list

### 7. Generate Overview
- [ ] Ensure at least one source is checked
- [ ] Click "Overview" button in Notes panel
- [ ] Wait for generation to complete
- [ ] Verify overview note appears with date in title
- [ ] Open the note to view generated summary

### 8. Generate Data Table
- [ ] Click "Table" button
- [ ] Optionally enter a focus prompt (e.g., "Extract key facts")
- [ ] Click "Generate table"
- [ ] Wait for generation
- [ ] Verify table note appears
- [ ] Open note to view rendered table

### 9. Generate Mind Map
- [ ] Click "Mind map" button
- [ ] Optionally enter a topic (e.g., "Main concepts")
- [ ] Click "Generate mindmap"
- [ ] Wait for generation
- [ ] Verify mind map note appears
- [ ] Open note to view interactive graph
- [ ] Test pan and zoom functionality

### 10. Source Selection
- [ ] Uncheck one source in Sources panel
- [ ] Verify selection counter updates (e.g., "1 of 2 selected")
- [ ] Try to chat - verify it still works with remaining sources
- [ ] Uncheck all sources
- [ ] Verify chat input is disabled with message
- [ ] Verify generate buttons are disabled

### 11. Edit Note
- [ ] Open any text note (manual, chat, or overview)
- [ ] Click edit (pencil icon)
- [ ] Modify title and/or body
- [ ] Click checkmark to save
- [ ] Verify changes are persisted

### 12. Delete Note
- [ ] Click trash icon on a note
- [ ] Verify confirmation prompt
- [ ] Click "Delete"
- [ ] Verify note is removed from list

### 13. Remove Source
- [ ] Hover over a source in Sources panel
- [ ] Click trash icon
- [ ] Verify confirmation prompt
- [ ] Click "Remove"
- [ ] Verify source is removed from list

### 14. Mobile Responsive (Optional)
- [ ] Resize browser window to < 1024px width
- [ ] Verify single-panel view with tab bar
- [ ] Click "Sources", "Chat", "Notes" tabs
- [ ] Verify each panel displays correctly

### 15. Notebook Management
- [ ] Click back arrow to return to home
- [ ] Verify notebook appears in list with source/note counts
- [ ] Hover over notebook, click pencil to rename
- [ ] Enter new name and save
- [ ] Verify name updates
- [ ] Click trash icon to delete
- [ ] Confirm deletion
- [ ] Verify notebook is removed

## Expected Results

All steps should complete without errors. The application should:
- ✅ Create and manage notebooks
- ✅ Ingest text, PDF, and URL sources
- ✅ Stream chat responses with source citations
- ✅ Save chat responses as notes
- ✅ Generate overview, table, and mind map notes
- ✅ Support CRUD operations on notes
- ✅ Handle source selection correctly
- ✅ Display appropriate empty states and disabled states
- ✅ Work responsively on mobile viewports

## Common Issues

**Chat fails with "OpenRAG service error":**
- Verify OpenRAG is running on port 3000
- Check OPENRAG_API_KEY is correct
- Check OpenRAG logs for errors

**Source ingestion fails:**
- For PDFs: Ensure file is not password-protected
- For URLs: Ensure URL is publicly accessible
- Check OpenRAG document ingestion logs

**Generation fails with "Could not extract...":**
- Ensure sources contain relevant content for the requested generation type
- Try with different or more sources
- Check OpenRAG model configuration
