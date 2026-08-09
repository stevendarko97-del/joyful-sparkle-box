import { google } from 'googleapis'

const { OAuth2 } = google.auth

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'profile',
  'email',
]

export function createOAuthClient(clientId: string, clientSecret: string, redirectUri: string) {
  return new OAuth2(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(oauth2Client: any, state?: string) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function getTokenFromCode(oauth2Client: any, code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  return tokens
}

export async function createMeetEvent(oauth2Client: any, opts: { summary: string; description?: string; start?: string; end?: string }) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const startTime = opts.start || new Date().toISOString()
  const endTime = opts.end || new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const event = {
    summary: opts.summary,
    description: opts.description || '',
    start: { dateTime: startTime },
    end: { dateTime: endTime },
    conferenceData: {
      createRequest: { requestId: `quicktutor-${Date.now()}` },
    },
  }

  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
  })

  // joinUrl is available under conferenceData.entryPoints
  const conferenceData = res.data.conferenceData
  let joinUrl: string | undefined
  if (conferenceData && conferenceData.entryPoints) {
    const join = conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video')
    joinUrl = join ? join.uri : undefined
  }

  return { event: res.data, joinUrl }
}
