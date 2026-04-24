import { NextRequest } from 'next/server'

const CHATBOT_URL = process.env.CHATBOT_SERVER_URL || 'http://localhost:8001'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  try {
    const res = await fetch(`${CHATBOT_URL}/logs/${id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return Response.json({ error: 'chatbot server error' }, { status: 502 })
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'logs'
  const limit = searchParams.get('limit') ?? '50'
  const offset = searchParams.get('offset') ?? '0'

  try {
    const url =
      type === 'stats'
        ? `${CHATBOT_URL}/stats`
        : `${CHATBOT_URL}/logs?limit=${limit}&offset=${offset}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return Response.json({ error: 'chatbot server error' }, { status: 502 })
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
