import { NextRequest, NextResponse } from 'next/server'

// 서버 사이드 환경변수 — 브라우저에 노출 안 됨
const CHATBOT_URL = process.env.CHATBOT_SERVER_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${CHATBOT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) {
      return NextResponse.json({ reply: '서버 오류가 발생했습니다.' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ reply: '답변 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
