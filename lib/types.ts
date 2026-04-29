export type NoteType = 'manual' | 'chat' | 'overview' | 'table' | 'mindmap'
export type SourceType = 'text' | 'pdf' | 'url' | 'csv' | 'md' | 'html' | 'docx' | 'txt' | 'md'

export interface Notebook {
  id: string
  name: string
  openragFilterId: string
  createdAt: string
}

export interface Source {
  id: string
  notebookId: string
  title: string
  type: SourceType
  url?: string
  openragFilename: string
  contentHash?: string
  createdAt: string
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface MindMapNode {
  id: string
  label: string
}

export interface MindMapEdge {
  from: string
  to: string
  label: string
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

export interface Note {
  id: string
  notebookId: string
  title: string
  type: NoteType
  body?: string
  tableData?: TableData
  mindMapData?: MindMapData
  createdAt: string
  updatedAt: string
}

export interface ApiError {
  error: string
  code?: string
}

export interface OpenRAGSource {
  filename: string
  text: string
  score: number
  page?: number | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: OpenRAGSource[]
  saved?: boolean
  suggestions?: ChatSuggestion[]
}

export interface ChatSuggestion {
  label: string
  action: 'generate' | 'chat'
  mode?: 'overview' | 'table' | 'mindmap'
  prompt?: string
}
