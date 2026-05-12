import { NextResponse } from 'next/server'
import { getNotebook, markChatMessageSaved } from '@/lib/store'
import { err } from '@/lib/errors'

type Ctx = { params: Promise<{ notebookId: string; messageId: string }> }

export async function PATCH(_req: Request, { params }: Ctx) {
  const { notebookId, messageId } = await params
  if (!getNotebook(notebookId)) return err(404, 'Notebook not found.', 'NOT_FOUND')
  markChatMessageSaved(notebookId, messageId)
  return new NextResponse(null, { status: 204 })
}
