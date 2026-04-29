import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebooks, createNotebook, getSourceCount, getNoteCount } from '@/lib/store'
import { createNotebookFilter } from '@/lib/filters'
import { err, mapSdkError } from '@/lib/errors'

export async function GET() {
  const notebooks = getNotebooks()
  const withCounts = notebooks.map(nb => ({
    ...nb,
    sourceCount: getSourceCount(nb.id),
    noteCount: getNoteCount(nb.id),
  }))
  return NextResponse.json({ notebooks: withCounts })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = body?.name?.trim()
  if (!name) return err(400, 'name must not be empty.', 'VALIDATION_ERROR')

  try {
    const id = `nb_${uuid()}`
    const filterId = await createNotebookFilter(id, name)
    const notebook = createNotebook({ id, name, openragFilterId: filterId, createdAt: new Date().toISOString() })
    return NextResponse.json({ ...notebook, sourceCount: 0, noteCount: 0 }, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}
