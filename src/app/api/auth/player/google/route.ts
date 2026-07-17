import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function buildAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// GET — informa se Google OAuth está configurado e devolve authUrl (real) ou sinaliza demo.
export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (clientId && redirectUri) {
    const state = crypto.randomBytes(16).toString('hex')
    return NextResponse.json({
      configured: true,
      demo: false,
      authUrl: buildAuthUrl(state),
    })
  }
  return NextResponse.json({
    configured: false,
    demo: true,
    note: 'GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_REDIRECT_URI ausentes. Use POST /api/auth/player/google/demo para simular.',
  })
}
