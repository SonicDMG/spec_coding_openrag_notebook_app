import { NextResponse } from 'next/server'
import { openrag } from '@/lib/openrag'
import { getNotebooks } from '@/lib/store'
import { mapSdkError } from '@/lib/errors'

export async function GET() {
  try {
    // Exclude filters already managed by a notebook in this app — deleting
    // that notebook would destroy the filter and break any second notebook
    // pointing to it.
    const managedIds = new Set(getNotebooks().map(nb => nb.openragFilterId))
    const filters = await openrag.knowledgeFilters.search(undefined, 100)

    const available = filters
      .filter(f => !managedIds.has(f.id))
      .map(f => {
        const dataSources = f.queryData?.filters?.data_sources ?? []
        return {
          id: f.id,
          name: f.name,
          description: f.description ?? '',
          documentCount: dataSources.length,
          dataSources,
        }
      })

    return NextResponse.json({ filters: available })
  } catch (e) {
    return mapSdkError(e)
  }
}
