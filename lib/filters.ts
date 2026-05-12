import { v4 as uuid } from 'uuid'
import { openrag } from './openrag'
import { getSources, getSource, getNotebook, updateNotebook, createSource, sourceExistsByFilename } from './store'
import type { SourceType } from './types'

export const QUERY_LIMIT = 10
export const QUERY_SCORE_THRESHOLD = 0.3

// In-memory lock to prevent concurrent filter updates for the same notebook
const filterUpdateLocks = new Map<string, Promise<void>>()

function buildFilterName(notebookId: string, notebookName: string): string {
  const sanitized = notebookName.replace(/\s+/g, '-').replace(/[^\w\-]/g, '').toLowerCase().slice(0, 40)
  const shortId = notebookId.replace(/^nb_/, '').slice(0, 8)
  return `${sanitized}-${shortId}`
}

function buildQueryData(filenames: string[]) {
  return {
    filters: { data_sources: filenames },
    limit: QUERY_LIMIT,
    scoreThreshold: QUERY_SCORE_THRESHOLD,
  }
}

export async function createNotebookFilter(notebookId: string, notebookName: string): Promise<string> {
  const filterName = buildFilterName(notebookId, notebookName)

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

    if (filenames.length === 0) {
      filterUpdateLocks.delete(notebookId)
      return
    }

    try {
      await openrag.knowledgeFilters.update(filterId, {
        queryData: buildQueryData(filenames),
      })
    } catch (error) {
      console.error('Filter update failed:', error)
      if ((error as any)?.name === 'NotFoundError') {
        // The filter was deleted from OpenRAG (e.g. manual cleanup). Find or
        // recreate it and update the notebook record so future calls use the
        // correct ID.
        try {
          const notebook = getNotebook(notebookId)
          if (notebook) {
            const newFilterId = await createNotebookFilter(notebookId, notebook.name)
            updateNotebook(notebookId, { openragFilterId: newFilterId })
            await openrag.knowledgeFilters.update(newFilterId, {
              queryData: buildQueryData(filenames),
            })
            console.log(`Filter re-linked for notebook ${notebookId}: ${newFilterId}`)
          }
        } catch (relinkError) {
          console.error('Filter re-link failed:', relinkError)
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
    if (sourceExistsByFilename(notebookId, filename)) continue

    const lower = filename.toLowerCase()
    let type: SourceType = 'txt'
    if (lower.endsWith('.pdf')) type = 'pdf'
    else if (lower.endsWith('.csv')) type = 'csv'
    else if (lower.endsWith('.md')) type = 'md'
    else if (lower.endsWith('.html')) type = 'html'
    else if (lower.endsWith('.docx')) type = 'docx'

    const title = filename
      .replace(/^src_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
      .replace(/\.(pdf|txt|csv|md|html|docx)$/i, '')
      .replace(/_/g, ' ') || filename

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
