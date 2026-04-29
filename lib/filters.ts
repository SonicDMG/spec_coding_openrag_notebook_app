import { v4 as uuid } from 'uuid'
import { openrag } from './openrag'
import { getSources, getSource, updateNotebook, createSource } from './store'
import type { SourceType } from './types'

export const QUERY_LIMIT = 10
export const QUERY_SCORE_THRESHOLD = 0.3

// In-memory lock to prevent concurrent filter updates for the same notebook
const filterUpdateLocks = new Map<string, Promise<void>>()

function buildQueryData(filenames: string[]) {
  return {
    filters: { data_sources: filenames },
    limit: QUERY_LIMIT,
    scoreThreshold: QUERY_SCORE_THRESHOLD,
  }
}

export async function createNotebookFilter(notebookId: string, notebookName: string): Promise<string> {
  const filterName = `notebook-${notebookId}`

  try {
    const existingFilters = await openrag.knowledgeFilters.search(filterName, 10)
    const matchingFilter = existingFilters.find(f => f.name === filterName)

    if (matchingFilter) {
      console.log(`Found existing filter for notebook ${notebookId}: ${matchingFilter.id}`)
      return matchingFilter.id
    }
  } catch (error) {
    console.error('Error searching for existing filter:', error)
  }

  const result = await openrag.knowledgeFilters.create({
    name: filterName,
    description: `Sources for notebook: ${notebookName}`,
    queryData: buildQueryData([]),
  })
  console.log(`Created new filter for notebook ${notebookId}: ${result.id}`)
  return result.id!
}

export async function updateNotebookFilter(filterId: string, notebookId: string): Promise<void> {
  const existingLock = filterUpdateLocks.get(notebookId)
  if (existingLock) {
    await existingLock
  }

  const updatePromise = (async () => {
    const sources = getSources(notebookId)
    const filenames = sources.map(s => s.openragFilename)

    try {
      await openrag.knowledgeFilters.update(filterId, {
        queryData: buildQueryData(filenames),
      })
    } catch (error) {
      console.error('Filter update failed:', error)
      const name = (error as any)?.name
      if (name === 'NotFoundError' || name === 'ServerError') {
        console.log('Attempting to recreate filter...')
        try {
          const result = await openrag.knowledgeFilters.create({
            name: `notebook-${notebookId}`,
            description: `Recreated filter for notebook`,
            queryData: buildQueryData(filenames),
          })
          console.log('Filter recreated with ID:', result.id)
          updateNotebook(notebookId, { openragFilterId: result.id! })
        } catch (recreateError) {
          console.error('Filter recreation also failed:', recreateError)
        }
      }
    } finally {
      filterUpdateLocks.delete(notebookId)
    }
  })()

  filterUpdateLocks.set(notebookId, updatePromise)
  await updatePromise
}

export async function importNotebookFilterSources(notebookId: string, filterId: string): Promise<number> {
  const filter = await openrag.knowledgeFilters.get(filterId)
  if (!filter) throw new Error('Filter not found')

  const filenames = filter.queryData?.filters?.data_sources ?? []
  if (filenames.length === 0) return 0

  const now = new Date().toISOString()
  let count = 0

  for (const filename of filenames) {
    const lower = filename.toLowerCase()
    let type: SourceType = 'txt'
    if (lower.endsWith('.pdf')) type = 'pdf'
    else if (lower.endsWith('.csv')) type = 'csv'
    else if (lower.endsWith('.md')) type = 'md'
    else if (lower.endsWith('.html')) type = 'html'
    else if (lower.endsWith('.docx')) type = 'docx'

    const title = filename.replace(/^notebook-[^-]+-/, '').replace(/\.(pdf|txt|csv|md|html|docx)$/i, '') || filename

    createSource({
      id: `src_${uuid()}`,
      notebookId,
      title,
      type,
      openragFilename: filename,
      createdAt: now,
    })
    count++
  }

  return count
}

export async function deleteNotebookFilter(filterId: string): Promise<void> {
  try {
    await openrag.knowledgeFilters.delete(filterId)
  } catch (error) {
    console.error('Filter deletion failed (non-fatal):', error)
  }
}

/**
 * Returns the OpenRAG filenames for the selected source IDs.
 * When all notebook sources are selected the full list is returned directly.
 * Synchronous — no API calls.
 */
export function resolveSelectedFilenames(
  notebookId: string,
  selectedSourceIds: string[],
): string[] {
  const allSources = getSources(notebookId)

  if (selectedSourceIds.length === allSources.length) {
    return allSources.map(s => s.openragFilename)
  }

  return selectedSourceIds
    .map(id => getSource(notebookId, id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map(s => s.openragFilename)
}
