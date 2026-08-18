export function getBackendUrl(): string {
  // Check if an explicit env var is set
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    // If running in development (on standard dev ports like 5173, 3000, etc.)
    const port = window.location.port;
    if (port && port !== "80" && port !== "443" && port !== "4000") {
      return `http://${window.location.hostname}:4000`;
    }
    // In production, use the current host / origin
    return window.location.origin;
  }

  return "http://localhost:4000";
}

export const BACKEND_URL = getBackendUrl();
