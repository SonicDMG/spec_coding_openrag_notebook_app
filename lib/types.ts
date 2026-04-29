export type NoteType = 'manual' | 'chat' | 'overview' | 'table' | 'mindmap'
export type SourceType = 'text' | 'pdf' | 'url'

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
