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

// One CSS variable name per hierarchy level
const LEVEL_COLOR_VARS = ['--note-color', '--node-color-1', '--node-color-2', '--node-color-3']

function colorVar(level: number, alpha?: number): string {
  const v = `var(${LEVEL_COLOR_VARS[Math.min(level, LEVEL_COLOR_VARS.length - 1)]})`
  return alpha !== undefined ? `hsl(${v} / ${alpha})` : `hsl(${v})`
}

const LEVEL_STYLES = (level: number): React.CSSProperties => {
  const styles: React.CSSProperties[] = [
    // 0 — root: solid fill
    { background: colorVar(0), color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: 8, fontWeight: 700, padding: '10px 18px', fontSize: 14 },
    // 1 — category: tinted bg, colored text
    { background: colorVar(1, 0.12), color: colorVar(1), border: `1.5px solid ${colorVar(1, 0.4)}`, borderRadius: 7, fontWeight: 600, padding: '7px 14px', fontSize: 13 },
    // 2 — item: subtle tint
    { background: colorVar(2, 0.08), color: colorVar(2), border: `1px solid ${colorVar(2, 0.35)}`, borderRadius: 6, padding: '6px 12px', fontSize: 12 },
    // 3+ — detail: faintest tint
    { background: colorVar(3, 0.06), color: colorVar(3), border: `1px solid ${colorVar(3, 0.28)}`, borderRadius: 5, padding: '4px 10px', fontSize: 11 },
  ]
  return styles[Math.min(level, styles.length - 1)]
}

export default function MindMapRenderer({ data }: Props) {
  const layout = useMemo(() => computeLayout(data.nodes, data.edges), [data.nodes, data.edges])

  const { nodes, edges } = useMemo(() => {
    if (!layout) return { nodes: [], edges: [] }
    const { positions, levels } = layout

    const nodes: Node[] = data.nodes.map(n => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      const level = levels.get(n.id) ?? 0
      return { id: n.id, data: { label: n.label }, position: pos, style: LEVEL_STYLES(level) }
    })

    const edges: Edge[] = data.edges.map((e, i) => {
      const srcLevel = levels.get(e.from) ?? 0
      return {
        id: `e${i}`,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        label: e.label,
        labelStyle: { fontSize: 10, fill: colorVar(srcLevel, 0.65) },
        style: { stroke: colorVar(srcLevel, 0.4) },
      }
    })

    return { nodes, edges }
  }, [data.nodes, data.edges, layout])

  return (
    <div className="w-full h-full rounded-lg border overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.15 }}>
        <Background color="hsl(var(--muted))" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
