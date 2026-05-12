import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getNotebooks, createNotebook, getSourceCount, getNoteCount } from '@/lib/store'
import { createNotebookFilter, importNotebookFilterSources } from '@/lib/filters'
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
  let name = body?.name?.trim()
  const existingFilterId: string | undefined = body?.filterId

  // When importing, derive name from filter if not provided
  if (!name && existingFilterId) {
    const filter = await import('@/lib/openrag').then(m => m.openrag.knowledgeFilters.get(existingFilterId))
    name = filter?.name ?? existingFilterId
  }

  if (!name) return err(400, 'name must not be empty.', 'VALIDATION_ERROR')

  try {
    const id = `nb_${uuid()}`

    let filterId: string
    let importedCount = 0

    if (existingFilterId) {
      filterId = existingFilterId
      // Create notebook first so source FK constraint passes
      const notebook = createNotebook({ id, name, openragFilterId: filterId, createdAt: new Date().toISOString() })
      importedCount = await importNotebookFilterSources(id, filterId)
      return NextResponse.json({ ...notebook, sourceCount: importedCount, noteCount: 0 }, { status: 201 })
    }

    filterId = await createNotebookFilter(id, name)
    const notebook = createNotebook({ id, name, openragFilterId: filterId, createdAt: new Date().toISOString() })
    importedCount = await importNotebookFilterSources(id, filterId)
    return NextResponse.json({ ...notebook, sourceCount: importedCount, noteCount: 0 }, { status: 201 })
  } catch (e) {
    return mapSdkError(e)
  }
}
