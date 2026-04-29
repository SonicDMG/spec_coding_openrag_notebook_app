import { NextResponse } from 'next/server'
import { getNotebook, getSources } from '@/lib/store'
import { err } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { notebookId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')
  return NextResponse.json({ sources: getSources(notebookId) })
}
