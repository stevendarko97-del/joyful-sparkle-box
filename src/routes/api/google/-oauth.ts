import { createOAuthClient, getTokenFromCode, getAuthUrl } from '../../../integrations/google/googleClient'
import fs from 'fs'
import path from 'path'

// Simple token store (demo). Replace with DB (Supabase) in production.
const TOKENS_FILE = path.join(process.cwd(), 'google_tokens.json')

function saveTokensForUser(userId: string, tokens: any) {
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'))
  } catch (_) {
    data = {}
  }
  ;(data as any)[userId] = tokens
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2))
}

export default async function handler(req: any, res: any) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    res.status(500).send('Missing Google OAuth environment variables')
    return
  }

  const oauth2Client = createOAuthClient(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)

  if (req.method === 'GET') {
    // Start OAuth flow: /api/google/oauth?userId=alice
    const userId = String(req.query.userId || req.query.user || 'default')
    const url = getAuthUrl(oauth2Client, userId)
    res.writeHead(302, { Location: url })
    res.end()
    return
  }

  if (req.method === 'POST') {
    // Callback exchange: expects { code, userId }
    const { code, userId } = req.body
    if (!code) return res.status(400).send('Missing code')
    try {
      const tokens = await getTokenFromCode(oauth2Client, code)
      const uid = userId || 'default'
      saveTokensForUser(uid, tokens)
      res.json({ ok: true, userId: uid })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).send('Method not allowed')
}
