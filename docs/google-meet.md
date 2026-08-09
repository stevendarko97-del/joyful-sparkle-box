Google Meet integration (Calendar conferenceData)

Overview
- This integration creates Google Meet join links by creating Calendar events with `conferenceData.createRequest`.
- A server-side OAuth 2.0 flow is required so meetings are created under users' Google accounts.

Files added
- `src/integrations/google/googleClient.ts` — helpers for OAuth and creating Meet events (uses `googleapis`).
- `src/routes/api/google/oauth.ts` — route to start OAuth (`GET`) and exchange code (`POST`).
- `src/routes/api/google/create-meet.ts` — `POST` endpoint to create a meeting for a user.

Quick setup
1. Create a Google Cloud project and enable the Calendar API.
2. Configure OAuth consent screen (External/internal as appropriate).
3. Create OAuth credentials (Web application) and add the redirect URI (e.g. `http://localhost:3000/api/google/oauth/callback` or your app's callback).
4. Set environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`

Local test flow
1. Start your app.
2. Navigate to `/api/google/oauth?userId=yourUserId` to start OAuth; sign in and accept.
3. Exchange the code by POSTing `{ code, userId }` to `/api/google/oauth` (some frameworks handle the callback automatically).
4. Call `POST /api/google/create-meet` with JSON `{ userId, summary }` to create a meeting and receive `joinUrl`.

Notes & next steps
- The token store is a simple JSON file (`google_tokens.json`) used for demo purposes — replace with Supabase or another DB and secure storage for refresh tokens.
- Google Meet embedding directly in an iframe is restricted; this approach returns the Meet join URL which you can open in a new tab or, when available and permitted, use the Google Meet SDK.
- Add token refresh handling: use `oauth2Client.on('tokens', ...)` or refresh via `oauth2Client.getAccessToken()` and persist new tokens.
