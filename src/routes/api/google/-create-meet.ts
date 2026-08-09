import { createOAuthClient, createMeetEvent } from '../../../integrations/google/googleClient'
import fs from 'fs'
import path from 'path'

const TOKENS_FILE = path.join(process.cwd(), 'google_tokens.json')

function loadTokensForUser(userId: string) {
  try {
    const data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'))
    return data[userId]
  } catch (err) {
    return null
  }
}

export default async function handler(req: any, res: any) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    res.status(500).send('Missing Google OAuth environment variables')
    return
  }

  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const { userId = 'default', summary = 'QuickTutor meeting', description } = req.body

  const tokens = loadTokensForUser(userId)
  if (!tokens) return res.status(401).json({ error: 'No tokens for user. Complete OAuth first.' })

  const oauth2Client = createOAuthClient(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  oauth2Client.setCredentials(tokens)

  try {
    const { joinUrl, event } = await createMeetEvent(oauth2Client, { summary, description })
    res.json({ ok: true, joinUrl, event })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
