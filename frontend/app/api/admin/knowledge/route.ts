import { NextRequest } from 'next/server'

const CHATBOT_URL = process.env.CHATBOT_SERVER_URL || 'http://localhost:8001'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(`${CHATBOT_URL}/knowledge`, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return Response.json({ error: 'chatbot server error' }, { status: 502 })
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${CHATBOT_URL}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return Response.json({ error: 'chatbot server error' }, { status: 502 })
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
