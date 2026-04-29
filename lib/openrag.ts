import { OpenRAGClient } from 'openrag-sdk'

if (!process.env.OPENRAG_API_KEY) {
  throw new Error('OPENRAG_API_KEY is not set')
}

export const openrag = new OpenRAGClient({
  apiKey: process.env.OPENRAG_API_KEY,
  baseUrl: process.env.OPENRAG_URL ?? 'http://localhost:3000',
})
