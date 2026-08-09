import { useState } from "react";

export function DevicePreCheck({ onComplete }: { onComplete: () => void }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    setChecking(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // stop tracks immediately since we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      onComplete();
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera and microphone access was denied. Please allow permissions in your browser settings to join the lesson.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera or microphone found on your device. Please ensure they are connected.");
      } else {
        setError("Could not access your camera/mic. " + err.message);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold">Check your device</h2>
      <p className="mb-8 text-muted-foreground">
        We need access to your camera and microphone so the tutor can see and hear you clearly.
      </p>
      
      {error && (
        <div className="mb-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <button 
        onClick={requestPermissions}
        disabled={checking}
        className="rounded-full bg-brand px-8 py-3 font-semibold text-primary-foreground hover:bg-brand/90 disabled:opacity-50"
      >
        {checking ? "Checking permissions..." : "Allow camera & mic"}
      </button>

      <div className="mt-8 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
         <p className="font-medium text-ink mb-1">Having trouble?</p>
         <p>If your internet is very slow, the video might struggle. You can turn off your camera inside the room to save data.</p>
      </div>
    </div>
  );
}
