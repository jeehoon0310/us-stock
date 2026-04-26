import { NextRequest } from 'next/server'
import { saveProfileResult, getProfileResults, deleteProfileResult } from '@/lib/board-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results = getProfileResults(200)
    return Response.json({ results, total: results.length })
  } catch {
    return Response.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      user_name, user_email, profile, score,
      age, experience, purpose, sectors,
      required_return, investable, target, duration,
    } = body

    if (!profile || score === undefined || !age || experience === undefined || !purpose || !Array.isArray(sectors) || !duration) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }

    saveProfileResult({
      user_name: user_name || '익명',
      user_email,
      profile,
      score,
      age,
      experience,
      purpose,
      sectors,
      required_return: required_return ?? 0,
      investable: investable || undefined,
      target: target || undefined,
      duration,
    })

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id required' }, { status: 400 })
    deleteProfileResult(id)
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'DB error' }, { status: 500 })
  }
}
