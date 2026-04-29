import { NextResponse } from 'next/server'

export function err(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })
}

export function mapSdkError(e: unknown): NextResponse {
  const name = (e as { name?: string })?.name ?? ''
  if (name === 'AuthenticationError') return err(500, 'OpenRAG authentication failed — check OPENRAG_API_KEY.', 'AUTH_ERROR')
  if (name === 'NotFoundError')       return err(404, 'Resource not found in OpenRAG.', 'NOT_FOUND')
  if (name === 'ValidationError')     return err(422, 'OpenRAG rejected the request.', 'UNPROCESSABLE')
  if (name === 'RateLimitError')      return err(429, 'OpenRAG rate limit exceeded. Please try again shortly.', 'RATE_LIMITED')
  if (name === 'ServerError')         return err(502, 'OpenRAG service error. Please try again.', 'OPENRAG_ERROR')
  console.error('Unexpected error:', e)
  return err(500, 'An unexpected error occurred.', 'INTERNAL_ERROR')
}
