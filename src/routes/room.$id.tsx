import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageSquare, Users, Pencil, AlertCircle, CheckCircle2, Sparkles, X, ShieldCheck, Lock, CreditCard, Clock } from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";

export const Route = createFileRoute("/room/$id")({
  component: LessonRoom,
  head: () => ({
    meta: [
      { title: "Live classroom — Quick Tutor" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

type Msg = { id: string; sender: string; text: string; ts: number };

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function openPaystackPopup(
  email: string,
  amountCents: number,
  reference: string,
  onSuccess: (trxref: string) => void,
  onClose: () => void
) {
  const envKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;
  const key = (envKey && envKey !== "pk_test_placeholder") ? envKey : "pk_test_d923dcac32522f2aa54f4f5ceb9efd3d7f4be793";
  if (!key) {
    onSuccess(reference);
    return;
  }
  const handler = (window as any).PaystackPop?.setup({
    key,
    email,
    amount: amountCents,
    currency: "GHS",
    ref: reference,
    callback: (response: { reference: string; trxref: string }) =>
      onSuccess(response.reference || response.trxref || reference),
    onClose: () => onClose(),
  });
  if (handler) handler.openIframe();
  else onSuccess(reference);
}

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
  const remoteStreamRef = useRef<MediaStream | null>(null);
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

  // Support / Report Issue
  const [reportOpen, setReportOpen] = useState(false);

  // Session Completion Modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  // Re-attach video stream once DOM elements are rendered
  useEffect(() => {
    if (joined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (joined && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [joined, remoteConnected]);

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
    (socket: Socket) => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Prepare remote stream
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }

      pc.ontrack = (e) => {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        // Use e.track directly — e.streams[0] is undefined in many browsers/environments
        const track = e.track;
        if (track && !remoteStreamRef.current.getTracks().find(t => t.id === track.id)) {
          remoteStreamRef.current.addTrack(track);
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        setRemoteConnected(true);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("ice", e.candidate);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setRemoteConnected(true);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setRemoteConnected(false);
        }
      };

      return pc;
    },
    []
  );

  const joinRoom = useCallback(async () => {
    setJoining(true);
    setAccessError(null);
    try {
      // 1. Acquire local media with graceful fallback
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err1: any) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setCamOn(false);
          toast.info("Camera not available or denied. Joined with microphone only.");
        } catch (err2: any) {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#18181b";
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = "#a1a1aa";
            ctx.font = "bold 22px sans-serif";
            ctx.fillText("Audio/Video Not Detected", 180, 240);
          }
          stream = canvas.captureStream ? canvas.captureStream(1) : new MediaStream();
          setCamOn(false);
          setMicOn(false);
          toast.info("Camera/microphone not detected. You can still use chat, whiteboard, and screen sharing.");
        }
      }

      localStreamRef.current = stream;

      // 2. Connect to Socket.IO with the JWT token
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

      socket.on("joined", async ({ isInitiator }: { isInitiator: boolean }) => {
        setupPeerConnection(socket);
        setJoined(true);
        setJoining(false);
      });

      socket.on("peer-joined", async () => {
        // Another participant entered our room — initiate WebRTC offer
        const pc = setupPeerConnection(socket);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit("offer", pc.localDescription);
        } catch (err) {
          console.error("Failed to create offer on peer-joined:", err);
        }
      });

      socket.on("offer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        const pc = setupPeerConnection(socket);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", pc.localDescription);
        } catch (err) {
          console.error("Failed to handle offer:", err);
        }
      });

      socket.on("answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          } catch (err) {
            console.error("Failed to handle answer:", err);
          }
        }
      });

      socket.on("ice", async (candidate: RTCIceCandidateInit) => {
        if (pcRef.current && candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Failed to add ICE candidate:", err);
          }
        }
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
        if (sender) await sender.replaceTrack(camTrack);
      }
      setSharing(false);
      return;
    }
    // Guard: peer connection must exist (both users joined)
    if (!pcRef.current) {
      toast.info("Wait for your lesson partner to join before sharing your screen.");
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        // No existing video sender — add the track
        pcRef.current.addTrack(screenTrack, screenStream);
      }
      screenTrack.onended = () => shareScreen(); // auto-stop on browser UI cancel
      setSharing(true);
    } catch { /* user cancelled */ }
  };

  const cleanupAndExit = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    navigate({ to: booking?.student_id === user?.id ? "/dashboard/student" : "/dashboard/teacher" });
  };

  const handleLeaveClick = () => {
    // If the booking is already completed or cancelled, just exit cleanly
    if (booking?.status === "completed" || booking?.status === "cancelled") {
      cleanupAndExit();
      return;
    }
    // Show completion confirmation pop-up
    setShowCompletionModal(true);
  };

  const handleConfirmCompletion = async () => {
    setCompleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/teacher/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        toast.success("Lesson confirmed as completed! Payout and records updated.");
        cleanupAndExit();
      } else {
        toast.error("Failed to update status. Exiting room...");
        cleanupAndExit();
      }
    } catch {
      cleanupAndExit();
    } finally {
      setCompleting(false);
    }
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

  const handlePayNow = () => {
    if (!user || !booking) return;
    const reference = `qt-${booking.id}-${Date.now()}`;
    openPaystackPopup(
      user.email,
      booking.price_cents || 4000,
      reference,
      async (trxref: string) => {
        const token = localStorage.getItem("token");
        await fetch(`${BACKEND}/api/paystack/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reference: trxref, booking_id: booking.id }),
        }).catch(() => {});
        toast.success("Payment confirmed! Classroom unlocked.");
        // Refresh booking info from server
        const res = await fetch(`${BACKEND}/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBooking(data.booking);
        }
      },
      () => toast.info("Payment window closed.")
    );
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

  // ── Payment Lock Screen: Unpaid / Pending Bookings Cannot Start Live Lessons ──
  if (booking.status === "pending") {
    const isStudent = booking.student_id === user?.id;
    return (
      <div className="grid min-h-screen place-items-center bg-[#09090b] px-6 text-center text-white py-12">
        <div className="max-w-md w-full rounded-3xl bg-[#18181b] border border-white/10 p-8 shadow-2xl space-y-6">
          <div className="mx-auto size-20 rounded-3xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Lock className="size-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              Payment Required
            </span>
            <h1 className="font-serif text-3xl font-bold">
              {isStudent ? "Classroom Locked" : "Awaiting Student Payment"}
            </h1>
            <p className="text-xs text-white/60 leading-relaxed">
              {isStudent
                ? `This live session with ${otherName} is not yet paid. Please complete payment to unlock the video room and start your lesson.`
                : `The student (${otherName}) has booked this session but has not yet completed payment. The live video room will unlock automatically once paid.`}
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/5 space-y-2 text-xs text-left">
            <div className="flex justify-between">
              <span className="text-white/60">Scheduled Time:</span>
              <span className="font-semibold text-white">{new Date(booking.scheduled_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Lesson Rate:</span>
              <span className="font-bold text-emerald-400">GH₵ {(booking.price_cents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Status:</span>
              <span className="font-bold text-amber-400 uppercase text-[10px]">Unpaid / Pending</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {isStudent && (
              <button
                onClick={handlePayNow}
                className="w-full h-11 rounded-full bg-brand hover:bg-brand/90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <CreditCard className="size-4" />
                Pay Now with MoMo / Card (GH₵ {(booking.price_cents / 100).toFixed(2)})
              </button>
            )}

            <Link
              to={isStudent ? "/dashboard/student" : "/dashboard/teacher"}
              className="w-full h-10 rounded-full border border-white/10 hover:bg-white/5 text-white/80 text-xs font-semibold flex items-center justify-center transition-colors"
            >
              ← Back to {isStudent ? "Student" : "Tutor"} Dashboard
            </Link>
          </div>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReportOpen(true)}
            className="shrink-0 rounded-full border border-destructive/40 text-destructive/90 px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            title="Report problem to admin"
          >
            <AlertCircle className="size-3.5" />
            Report Issue
          </button>
          <button
            onClick={handleLeaveClick}
            className="shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            Leave classroom
          </button>
        </div>
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
                  onClick={handleLeaveClick}
                  title="Leave / End Lesson"
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
        <aside className="w-80 shrink-0 flex flex-col border-l border-white/10 bg-white/[0.02]">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setTab("chat")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === "chat" ? "border-b-2 border-brand text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <MessageSquare className="size-3.5" />
              Lesson Chat
            </button>
            <button
              onClick={() => setTab("attendance")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === "attendance" ? "border-b-2 border-brand text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Users className="size-3.5" />
              Participants
            </button>
          </div>

          {tab === "attendance" ? (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                <div className="size-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold">
                  {user?.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">You ({user?.email})</p>
                  <p className="text-[10px] text-green-400">Connected</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-ink">
                  {otherName[0]?.toUpperCase() ?? "P"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{otherName}</p>
                  <p className={`text-[10px] ${remoteConnected ? "text-green-400" : "text-white/40"}`}>
                    {remoteConnected ? "In classroom" : "Waiting to join..."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-white/40 py-8">
                    Send a message to your lesson partner during the session.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === "You" ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[10px] text-white/40 mb-1">{m.sender}</span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        m.sender === "You" ? "bg-brand text-white" : "bg-white/10 text-white"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
                className="p-3 border-t border-white/10 flex gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={joined ? "Message…" : "Join to chat"}
                  maxLength={2000}
                  disabled={!joined}
                  className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-40 text-foreground"
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

      {/* ── Lesson Wrap-Up & Completion Confirmation Pop-up ── */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#18181b] border border-white/10 p-6 sm:p-8 text-white shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold">Wrap Up Lesson</h3>
                  <p className="text-xs text-white/60">Session with {otherName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="size-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/5 space-y-2 text-xs leading-relaxed text-white/80">
              <p className="font-semibold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="size-4 text-accent-gold" />
                Was this lesson successfully completed?
              </p>
              <p className="text-white/60">
                Confirming completion finalizes the session, unlocks student reviews, and settles the tutor's payout in the Admin Payout Ledger.
              </p>
              {booking?.price_cents && (
                <div className="pt-2 border-t border-white/10 flex justify-between text-[11px]">
                  <span className="text-white/60">Session Value:</span>
                  <span className="font-bold text-white">GHS {(booking.price_cents / 100).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleConfirmCompletion}
                disabled={completing}
                className="w-full h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="size-4" />
                {completing ? "Finalizing Session..." : "Yes, Confirm Lesson Completed"}
              </button>

              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  setReportOpen(true);
                }}
                className="w-full h-10 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <AlertCircle className="size-3.5 text-red-400" />
                Report an Issue / Dispute
              </button>

              <button
                onClick={cleanupAndExit}
                className="w-full h-9 rounded-full text-white/50 hover:text-white text-xs font-medium transition-colors"
              >
                Exit Classroom (Leave as In-Progress)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      <ReportDialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          cleanupAndExit();
        }}
        bookingId={bookingId}
        bookingLabel={`Live Lesson with ${otherName}`}
      />
    </div>
  );
}
