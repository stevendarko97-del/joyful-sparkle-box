import * as React from 'react'

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any
  }
}

interface JitsiRoomProps {
  roomName: string
  displayName?: string
  subject?: string
}

export function JitsiRoom({ roomName, displayName = 'Student', subject = 'QuickTutor classroom' }: JitsiRoomProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const apiRef = React.useRef<any>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    if (!containerRef.current) return

    const createJitsi = () => {
      const domain = 'meet.jit.si'
      const options = {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        interfaceConfigOverwrite: {
          DEFAULT_REMOTE_DISPLAY_NAME: 'Guest',
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
        configOverwrite: {
          enableWelcomePage: false,
        },
        userInfo: {
          displayName,
        },
      }

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options)
      apiRef.current.executeCommand('subject', subject)
      setLoaded(true)
    }

    if (window.JitsiMeetExternalAPI) {
      createJitsi()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.onload = () => {
      if (!mounted) return
      if (!window.JitsiMeetExternalAPI) {
        setError('Jitsi API failed to load.')
        return
      }
      createJitsi()
    }
    script.onerror = () => {
      if (!mounted) return
      setError('Unable to load Jitsi script.')
    }

    document.body.appendChild(script)

    return () => {
      mounted = false
      if (apiRef.current) {
        try {
          apiRef.current.executeCommand('hangup')
          apiRef.current.dispose()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [roomName, displayName, subject])

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Video call could not load.</p>
          <p>{error}</p>
          <p className="mt-2">
            Open in a new tab: <a href={`https://meet.jit.si/${encodeURIComponent(roomName)}`} target="_blank" rel="noreferrer" className="underline text-brand">{roomName}</a>
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-ink">Video Classroom</p>
              <p>Room: {roomName}</p>
            </div>
            <p>{loaded ? 'Connected' : 'Loading...'}</p>
          </div>
          <div ref={containerRef} className="h-[560px] w-full rounded-3xl bg-black" />
        </div>
      )}
    </div>
  )
}
