import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageSquare, Users, Pencil } from "lucide-react";

export const Route = createFileRoute("/room/$id")({
  component: LessonRoom,
  head: () => ({
    meta: [
      { title: "Live classroom — Quick Tutor" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

type Msg = { id: string; sender: string; text: string; ts: number };

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function LessonRoom() {
  const { id: bookingId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [otherName, setOtherName] = useState("Your lesson partner");
  const [notFound, setNotFound] = useState(false);

  // Media state
  const [joined, setJoined] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Chat
  const [tab, setTab] = useState<"chat" | "attendance">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Whiteboard
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Load booking info
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.booking) { setNotFound(true); return; }
        setBooking(data.booking);
        setOtherName(data.other_name || "Your lesson partner");
      })
      .catch(() => setNotFound(true));
  }, [bookingId, user]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Cleanup
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  const setupPeerConnection = useCallback(
    (socket: Socket, isInitiator: boolean) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Add local tracks
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Remote stream
      const remoteStream = new MediaStream();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
        setRemoteConnected(true);
      };

      // ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("ice", e.candidate);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setRemoteConnected(true);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") setRemoteConnected(false);
      };

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => socket.emit("offer", pc.localDescription));
      }

      return pc;
    },
    []
  );

  const joinRoom = useCallback(async () => {
    setJoining(true);
    setAccessError(null);
    try {
      // Acquire local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Connect to Socket.IO with the JWT token
      const token = localStorage.getItem("token");
      const socket = io(BACKEND, {
        query: { room: bookingId, token: token ?? "" },
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect_error", (err) => {
        setAccessError(`Connection failed: ${err.message}`);
        stream.getTracks().forEach((t) => t.stop());
        setJoining(false);
      });

      socket.on("error", ({ message }: { message: string }) => {
        setAccessError(message);
        stream.getTracks().forEach((t) => t.stop());
        socket.disconnect();
      });

      socket.on("joined", ({ isInitiator }: { isInitiator: boolean }) => {
        setupPeerConnection(socket, isInitiator);
        setJoined(true);
        setJoining(false);
      });

      socket.on("peer-joined", () => {
        // Remote peer joined — if we're already in the room as initiator, trigger offer
        if (pcRef.current) return; // already set up
        setupPeerConnection(socket, false);
      });

      socket.on("offer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("answer", pcRef.current.localDescription);
      });

      socket.on("answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        await pcRef.current?.setRemoteDescription(sdp);
      });

      socket.on("ice", async (candidate: RTCIceCandidateInit) => {
        await pcRef.current?.addIceCandidate(candidate);
      });

      socket.on("peer-left", () => {
        setRemoteConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

      socket.on("chat", ({ text, senderName, ts }: { text: string; senderName: string; ts: number }) => {
        setMessages((m) => [...m, { id: `${ts}-remote`, sender: senderName, text, ts }]);
      });

      socket.on("draw-start", ({ x, y, width, height }: { x: number; y: number, width: number, height: number }) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const scaleX = canvas.width / width;
          const scaleY = canvas.height / height;
          ctx.beginPath();
          ctx.moveTo(x * scaleX, y * scaleY);
        }
      });

      socket.on("draw", ({ x, y, width, height }: { x: number; y: number, width: number, height: number }) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const scaleX = canvas.width / width;
          const scaleY = canvas.height / height;
          ctx.strokeStyle = "#991b1b";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.lineTo(x * scaleX, y * scaleY);
          ctx.stroke();
        }
      });

      socket.on("draw-clear", () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      });

      socket.on("whiteboard-toggle", ({ show }: { show: boolean }) => {
        setShowWhiteboard(show);
      });

    } catch (err: any) {
      setAccessError(err.message ?? "Failed to access camera/microphone.");
      setJoining(false);
    }
  }, [bookingId, setupPeerConnection]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const shareScreen = async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(camTrack);
      }
      setSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      sender?.replaceTrack(screenTrack);
      screenTrack.onended = () => setSharing(false);
      setSharing(true);
    } catch { /* user cancelled */ }
  };

  const leaveRoom = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    navigate({ to: booking?.student_id === user?.id ? "/dashboard/student" : "/dashboard/teacher" });
  };

  const sendChat = () => {
    const text = draft.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit("chat", { text });
    setMessages((m) => [...m, { id: `${Date.now()}-me`, sender: "You", text, ts: Date.now() }]);
    setDraft("");
  };

  // Whiteboard
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      socketRef.current?.emit("draw-start", { x, y, width: canvas.width, height: canvas.height });
    }
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.strokeStyle = "#991b1b";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
      socketRef.current?.emit("draw", { x, y, width: canvas.width, height: canvas.height });
    }
  };
  
  const endDraw = () => { drawing.current = false; };
  
  const clearWhiteboard = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      socketRef.current?.emit("draw-clear");
    }
  };

  if (loading || (!booking && !notFound)) {
    return <div className="grid min-h-screen place-items-center bg-ink text-primary-foreground/60 text-sm">Loading classroom…</div>;
  }

  if (notFound || !booking) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl text-primary-foreground">Lesson not found</h1>
          <p className="mt-2 text-sm text-primary-foreground/60">This lesson doesn't exist or you're not a participant.</p>
          <Link to="/" className="mt-6 inline-block h-10 rounded-full bg-brand px-5 text-sm font-medium leading-[40px] text-primary-foreground">Back home</Link>
        </div>
      </div>
    );
  }

  const cancelled = booking.status === "cancelled";

  return (
    <div className="flex h-screen flex-col bg-ink text-primary-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Lesson with {otherName}
            {remoteConnected && joined && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-green-400">
                <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                Connected
              </span>
            )}
          </p>
          <p className="text-xs text-primary-foreground/60">
            {new Date(booking.scheduled_at).toLocaleString()} · {booking.status}
          </p>
        </div>
        <button
          onClick={leaveRoom}
          className="shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium hover:bg-white/10 transition-colors"
        >
          Leave classroom
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main video area */}
        <div className="relative min-h-[320px] flex-1 bg-black">
          {cancelled ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-primary-foreground/70">
              This lesson was cancelled — the classroom is closed.
            </div>
          ) : joined ? (
            <>
              {/* Remote video — full size */}
              <video ref={remoteVideoRef} autoPlay playsInline className="size-full object-cover" />

              {/* Waiting overlay when remote not yet connected */}
              {!remoteConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <p className="text-sm text-primary-foreground/70">Waiting for {otherName} to join…</p>
                  </div>
                </div>
              )}

              {/* Local video PiP */}
              <div className="absolute bottom-20 right-4 w-36 overflow-hidden rounded-xl border border-white/10 bg-zinc-800">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full object-cover" />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <VideoOff className="size-5 text-primary-foreground/50" />
                  </div>
                )}
              </div>

              {/* Whiteboard overlay */}
              {showWhiteboard && (
                <div className="absolute inset-0 z-10 flex flex-col">
                  <div className="flex shrink-0 items-center justify-between bg-black/90 px-4 py-2">
                    <span className="text-xs font-semibold">Whiteboard</span>
                    <div className="flex gap-2">
                      <button onClick={clearWhiteboard} className="rounded px-2 py-1 text-xs bg-white/10 hover:bg-white/20">Clear</button>
                      <button onClick={() => setShowWhiteboard(false)} className="rounded px-2 py-1 text-xs bg-white/10 hover:bg-white/20">Close</button>
                    </div>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={1000}
                    height={800}
                    className="flex-1 bg-white cursor-crosshair w-full object-contain touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                  />
                </div>
              )}

              {/* Controls */}
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 backdrop-blur-sm">
                <button
                  onClick={toggleMic}
                  title={micOn ? "Mute" : "Unmute"}
                  className={`flex size-10 items-center justify-center rounded-full transition-colors ${micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </button>
                <button
                  onClick={toggleCam}
                  title={camOn ? "Stop video" : "Start video"}
                  className={`flex size-10 items-center justify-center rounded-full transition-colors ${camOn ? "bg-white/10 hover:bg-white/20" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                </button>
                <button
                  onClick={shareScreen}
                  title={sharing ? "Stop sharing" : "Share screen"}
                  className={`flex size-10 items-center justify-center rounded-full transition-colors ${sharing ? "bg-blue-600 hover:bg-blue-700" : "bg-white/10 hover:bg-white/20"}`}
                >
                  <Monitor className="size-4" />
                </button>
                <button
                  onClick={() => {
                     const show = !showWhiteboard;
                     setShowWhiteboard(show);
                     socketRef.current?.emit("whiteboard-toggle", { show });
                  }}
                  title="Whiteboard"
                  className={`flex size-10 items-center justify-center rounded-full transition-colors ${showWhiteboard ? "bg-brand hover:bg-brand/80" : "bg-white/10 hover:bg-white/20"}`}
                >
                  <Pencil className="size-4" />
                </button>
                <div className="mx-1 h-6 w-px bg-white/20" />
                <button
                  onClick={leaveRoom}
                  title="Leave"
                  className="flex size-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                >
                  <PhoneOff className="size-4" />
                </button>
              </div>
            </>
          ) : (
            /* Pre-join screen */
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-white/5">
                  <Video className="size-10 text-primary-foreground/40" />
                </div>
                <h2 className="font-serif text-3xl">Ready to join?</h2>
                <p className="mt-3 max-w-[42ch] text-sm text-primary-foreground/70">
                  Your camera and microphone will start when you join. Access is
                  checked against your booking — only you and {otherName} can enter.
                </p>
                {accessError && (
                  <p className="mt-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{accessError}</p>
                )}
                <button
                  onClick={joinRoom}
                  disabled={joining}
                  className="mt-6 h-11 rounded-full bg-brand px-8 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-brand/90 transition-colors"
                >
                  {joining ? "Connecting…" : "Join lesson"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex h-[45vh] w-full shrink-0 flex-col border-t border-white/10 bg-surface text-ink lg:h-auto lg:w-[340px] lg:border-l lg:border-t-0">
          {/* Tabs */}
          <div className="flex shrink-0 border-b border-border">
            {(["chat", "attendance"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${tab === t ? "text-ink border-b-2 border-ink" : "text-muted-foreground hover:text-ink"}`}
              >
                {t === "chat" ? (
                  <span className="flex items-center justify-center gap-1.5"><MessageSquare className="size-3.5" /> Chat</span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Users className="size-3.5" /> Attendance</span>
                )}
              </button>
            ))}
          </div>

          {tab === "attendance" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="rounded-xl bg-card p-3 ring-1 ring-black/5">
                <p className="text-sm font-medium">You</p>
                <p className="text-[11px] text-muted-foreground">{joined ? "✓ Joined" : "Not yet joined"}</p>
              </div>
              {remoteConnected && (
                <div className="rounded-xl bg-card p-3 ring-1 ring-black/5">
                  <p className="text-sm font-medium">{otherName}</p>
                  <p className="text-[11px] text-green-600">✓ Joined</p>
                </div>
              )}
              {!remoteConnected && joined && (
                <p className="text-xs text-muted-foreground">{otherName} hasn't joined yet.</p>
              )}
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground">No messages yet. Say hello 👋</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender === "You";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand text-primary-foreground" : "bg-secondary text-ink"}`}>
                        {!mine && <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.sender}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); sendChat(); }}
                className="flex shrink-0 gap-2 border-t border-border p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={joined ? "Message…" : "Join to chat"}
                  maxLength={2000}
                  disabled={!joined}
                  className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || !joined}
                  className="h-10 rounded-full bg-brand px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
