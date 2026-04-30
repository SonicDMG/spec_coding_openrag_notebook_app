import { NextResponse } from 'next/server'
import { openrag } from '@/lib/openrag'
import { mapSdkError } from '@/lib/errors'

export async function GET() {
  try {
    const filters = await openrag.knowledgeFilters.search(undefined, 100)

    const available = filters.map(f => {
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
