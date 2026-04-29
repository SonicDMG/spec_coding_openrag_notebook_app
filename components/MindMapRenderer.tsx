'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MindMapData } from '@/lib/types'

interface Props { data: MindMapData }

export default function MindMapRenderer({ data }: Props) {
  const nodes: Node[] = useMemo(() =>
    data.nodes.map((n, i) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: i === 0 ? 300 : (i % 3) * 250, y: i === 0 ? 20 : Math.floor(i / 3) * 120 + 120 },
      style: i === 0
        ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: 8, fontWeight: 600, padding: '8px 16px' }
        : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 12px', fontSize: 13 },
    })), [data.nodes])

  const edges: Edge[] = useMemo(() =>
    data.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      labelStyle: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
      style: { stroke: 'hsl(var(--border))' },
    })), [data.edges])

  return (
    <div className="w-full h-full rounded-lg border overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="hsl(var(--muted))" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
