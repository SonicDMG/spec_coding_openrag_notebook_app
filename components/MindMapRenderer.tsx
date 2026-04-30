'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MindMapData, MindMapNode, MindMapEdge } from '@/lib/types'

interface Props { data: MindMapData }

const X_SPACING = 280
const LEAF_HEIGHT = 65

function computeLayout(nodes: MindMapNode[], edges: MindMapEdge[]) {
  const childrenMap = new Map<string, string[]>()
  const parentMap = new Map<string, string>()

  for (const e of edges) {
    if (!childrenMap.has(e.from)) childrenMap.set(e.from, [])
    childrenMap.get(e.from)!.push(e.to)
    parentMap.set(e.to, e.from)
  }

  const rootId = nodes.find(n => !parentMap.has(n.id))?.id ?? nodes[0]?.id
  if (!rootId) return null

  // Count leaf-units in each subtree
  const subtreeLeaves = new Map<string, number>()
  function calcLeaves(id: string): number {
    const kids = childrenMap.get(id) ?? []
    const count = kids.length === 0 ? 1 : kids.reduce((s, k) => s + calcLeaves(k), 0)
    subtreeLeaves.set(id, count)
    return count
  }
  calcLeaves(rootId)

  // Assign (x, y) top-down DFS
  const positions = new Map<string, { x: number; y: number }>()
  const levels = new Map<string, number>()

  function assign(id: string, depth: number, yTop: number) {
    levels.set(id, depth)
    const leaves = subtreeLeaves.get(id) ?? 1
    const yCentre = yTop + (leaves * LEAF_HEIGHT) / 2
    positions.set(id, { x: depth * X_SPACING, y: yCentre })

    let cursor = yTop
    for (const kid of childrenMap.get(id) ?? []) {
      assign(kid, depth + 1, cursor)
      cursor += (subtreeLeaves.get(kid) ?? 1) * LEAF_HEIGHT
    }
  }

  const totalH = (subtreeLeaves.get(rootId) ?? 1) * LEAF_HEIGHT
  assign(rootId, 0, 0)

  // Place orphans below the tree
  let orphanY = totalH + LEAF_HEIGHT
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: X_SPACING, y: orphanY })
      levels.set(n.id, 1)
      orphanY += LEAF_HEIGHT
    }
  }

  return { positions, levels }
}

const LEVEL_STYLES: React.CSSProperties[] = [
  // 0 — central
  { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: 8, fontWeight: 700, padding: '10px 18px', fontSize: 14 },
  // 1 — category
  { background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))', border: '1.5px solid hsl(var(--border))', borderRadius: 7, fontWeight: 600, padding: '7px 14px', fontSize: 13 },
  // 2 — item
  { background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 12px', fontSize: 12 },
  // 3+ — detail
  { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 5, padding: '4px 10px', fontSize: 11 },
]

export default function MindMapRenderer({ data }: Props) {
  const layout = useMemo(() => computeLayout(data.nodes, data.edges), [data.nodes, data.edges])

  const nodes: Node[] = useMemo(() => {
    if (!layout) return []
    const { positions, levels } = layout
    return data.nodes.map(n => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      const level = levels.get(n.id) ?? 0
      const style = LEVEL_STYLES[Math.min(level, LEVEL_STYLES.length - 1)]
      return { id: n.id, data: { label: n.label }, position: pos, style }
    })
  }, [data.nodes, layout])

  const edges: Edge[] = useMemo(() =>
    data.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      label: e.label,
      labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
      style: { stroke: 'hsl(var(--border))' },
    })), [data.edges])

  return (
    <div className="w-full h-full rounded-lg border overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.15 }}>
        <Background color="hsl(var(--muted))" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
