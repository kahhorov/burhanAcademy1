/**
 * OnlineClassRoom.tsx — PROFESSIONAL UI + BUG FIXES
 *
 * Yangiliklar:
 * 1. Dark/Light mode toggle
 * 2. Chiroyli custom scrollbar
 * 3. Ortga qaytish tugmasi (courses sahifasiga)
 * 4. Duplicate peer muammosi tuzatildi (uid bo'yicha deduplication)
 * 5. Professional dizayn — glassmorphism, smooth animations
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft,
  Camera,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Moon,
  PhoneOff,
  ShieldAlert,
  Sun,
  Users,
  Video,
  VideoOff,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

// ─── Config ───────────────────────────────────────────────────────────────────

const SOCKET_URL =
  (import.meta as { env: Record<string, string> }).env.VITE_SOCKET_URL ??
  "https://burhanacademybackend.onrender.com";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemotePeer {
  socketId: string;
  uid: string;
  displayName: string;
  photoURL: string;
  isAdmin: boolean;
  isTeacher: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeaking?: boolean;
  screenStreamId?: string | null;
}

interface PCEntry {
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  screenSender: RTCRtpSender | null;
  isOfferer: boolean;
  makingOffer: boolean;
  streams: Map<string, MediaStream>;
}

type RemoteStreamsMap = Map<string, Map<string, MediaStream>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getName = (
  displayName?: string | null,
  email?: string | null,
  fallback = "Foydalanuvchi",
) => displayName || email?.split("@")[0] || fallback;

// ─── CSS injector ─────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

  .live-room * { font-family: 'Outfit', sans-serif; box-sizing: border-box; }

  /* Custom scrollbar */
  .live-room ::-webkit-scrollbar { width: 4px; height: 4px; }
  .live-room ::-webkit-scrollbar-track { background: transparent; }
  .live-room ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 99px; }
  .live-room ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.7); }

  /* Light mode scrollbar */
  .live-room.light ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); }

  /* Animations */
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); } 50% { box-shadow: 0 0 0 6px rgba(52,211,153,0); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

  .fade-in { animation: fadeIn 0.3s ease forwards; }
  .speaking-ring { animation: pulse-ring 1.5s ease infinite; }
  .live-dot { animation: blink 1.5s ease infinite; }

  /* Tile hover */
  .peer-tile { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .peer-tile:hover { transform: translateY(-2px); }

  /* Control button */
  .ctrl-btn { transition: all 0.15s ease; }
  .ctrl-btn:hover:not(:disabled) { transform: scale(1.08); }
  .ctrl-btn:active:not(:disabled) { transform: scale(0.95); }

  /* Glassmorphism */
  .glass-dark { background: rgba(15,23,42,0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
  .glass-light { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); border: 1px solid rgba(0,0,0,0.08); }
`;

// ─── VideoEl ─────────────────────────────────────────────────────────────────

function VideoEl({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) el.play().catch(() => undefined);
  }, [stream]);
  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  peer,
  size = "md",
}: {
  peer: RemotePeer;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-xl",
    xl: "h-24 w-24 text-3xl",
  };
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold`}
      style={{
        background:
          peer.isAdmin || peer.isTeacher
            ? "linear-gradient(135deg,#6366f1,#06b6d4)"
            : "linear-gradient(135deg,#334155,#475569)",
      }}
    >
      {peer.photoURL ? (
        <img
          src={peer.photoURL}
          alt={peer.displayName}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className="text-white">
          {peer.displayName.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ─── ParticipantTile ─────────────────────────────────────────────────────────

function ParticipantTile({
  peer,
  cameraStream,
  isLocal,
  isSharing,
  featured = false,
  nameOverride,
  isDark,
}: {
  peer: RemotePeer;
  cameraStream: MediaStream | null;
  isLocal: boolean;
  isSharing: boolean;
  featured?: boolean;
  nameOverride?: string;
  isDark: boolean;
}) {
  const name = nameOverride ?? (isLocal ? "Siz" : peer.displayName);
  const subtitle = peer.isAdmin ? "Admin" : peer.isTeacher ? "Ustoz" : "Talaba";

  const hasLiveVideo = Boolean(
    cameraStream
      ?.getVideoTracks()
      .some((t) => t.readyState === "live" && t.enabled),
  );
  const showVideo = !peer.isVideoOff && hasLiveVideo;

  return (
    <div
      className={`peer-tile fade-in relative overflow-hidden rounded-2xl ${
        featured ? "min-h-[340px] md:min-h-[480px]" : "min-h-[180px]"
      } ${peer.isSpeaking ? "speaking-ring" : ""}`}
      style={{
        background: isDark
          ? "linear-gradient(145deg,#0f172a,#1e293b)"
          : "linear-gradient(145deg,#f1f5f9,#e2e8f0)",
        border: peer.isSpeaking
          ? "1.5px solid rgba(52,211,153,0.6)"
          : isDark
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* Video */}
      <VideoEl
        stream={cameraStream}
        muted={isLocal}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          showVideo ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Gradient overlay */}
      {showVideo && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      )}

      {/* Avatar when no video */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Avatar peer={peer} size={featured ? "xl" : "lg"} />
          <div className="text-center">
            <p
              className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}
            >
              {name}
            </p>
            <p
              className={`mt-0.5 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {peer.isVideoOff ? "Kamera o'chiq" : "Ulanmoqda..."}
            </p>
          </div>
        </div>
      )}

      {/* Top badges */}
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {(peer.isAdmin || peer.isTeacher) && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur"
            style={{ background: "rgba(99,102,241,0.35)" }}
          >
            <ShieldAlert className="h-3 w-3" />
            {peer.isAdmin ? "Admin" : "Ustoz"}
          </span>
        )}
        {isSharing && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur"
            style={{ background: "rgba(6,182,212,0.35)" }}
          >
            <MonitorUp className="h-3 w-3" />
            Screen
          </span>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
        <div
          className="min-w-0 rounded-xl px-3 py-2"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <p className="truncate text-xs font-semibold text-white">{name}</p>
          <p className="text-[10px] text-slate-300">{subtitle}</p>
        </div>
        <div
          className="flex gap-1 rounded-xl px-2 py-2"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className={`p-1 ${peer.isMuted ? "text-red-400" : "text-emerald-400"}`}
          >
            {peer.isMuted ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </span>
          <span
            className={`p-1 ${peer.isVideoOff ? "text-red-400" : "text-emerald-400"}`}
          >
            {peer.isVideoOff ? (
              <VideoOff className="h-3.5 w-3.5" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── TeacherPlaceholder ───────────────────────────────────────────────────────

function TeacherPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-2xl md:min-h-[480px]"
      style={{
        background: isDark
          ? "linear-gradient(145deg,#0f172a,#1e293b)"
          : "linear-gradient(145deg,#f1f5f9,#e2e8f0)",
        border: isDark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* Decorative rings */}
      <div
        className="absolute h-64 w-64 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle,#6366f1,transparent)" }}
      />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}
        >
          <ShieldAlert className="h-9 w-9 text-white" />
        </div>
        <div>
          <p
            className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-800"}`}
          >
            Ustoz
          </p>
          <p
            className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Kamera yoki ekran yoqilganda ko'rinadi
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ControlButton ────────────────────────────────────────────────────────────

function CtrlBtn({
  onClick,
  disabled,
  active,
  danger,
  children,
  title,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`ctrl-btn flex items-center justify-center rounded-full font-medium transition-all ${className} ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : danger
            ? "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/25"
            : active
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
              : "bg-white/10 text-white hover:bg-white/20 backdrop-blur"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenterMinimized, setPresenterMinimized] = useState(false);
  const [showUserList, setShowUserList] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1280,
  );

  // uid → RemotePeer (uid bo'yicha deduplication — asosiy tuzatish)
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(
    new Map(),
  );
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamsMap>(
    new Map(),
  );
  const [screenSharerId, setScreenSharerId] = useState<string | null>(null);
  const [screenShareStreamId, setScreenShareStreamId] = useState<string | null>(
    null,
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const mySocketIdRef = useRef<string | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(true);
  const videoOffRef = useRef(true);
  // socketId → PCEntry
  const pcsRef = useRef<Map<string, PCEntry>>(new Map());
  // uid → socketId mapping (duplicate oldini olish uchun)
  const uidToSocketRef = useRef<Map<string, string>>(new Map());
  const mediaPromRef = useRef<Promise<MediaStream | null> | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    videoOffRef.current = isVideoOff;
  }, [isVideoOff]);
  useEffect(() => {
    localRef.current = localStream;
  }, [localStream]);
  useEffect(() => {
    screenRef.current = screenStream;
  }, [screenStream]);

  // Inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // ── Remote streams ──────────────────────────────────────────────────────

  const addRemoteStream = useCallback((sid: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      const m = new Map(next.get(sid) ?? []);
      m.set(stream.id, stream);
      next.set(sid, m);
      return next;
    });
  }, []);

  const dropRemoteStream = useCallback((sid: string, streamId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      const m = new Map(next.get(sid) ?? []);
      m.delete(streamId);
      if (m.size === 0) next.delete(sid);
      else next.set(sid, m);
      return next;
    });
  }, []);

  const dropAllRemoteStreams = useCallback((sid: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(sid);
      return next;
    });
  }, []);

  // ── Speaking detection ───────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioSrcRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSrcRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current?.state !== "closed")
      audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }, []);

  const startSpeaking = useCallback(
    (stream: MediaStream) => {
      if (!stream.getAudioTracks().length) return;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      stopSpeaking();
      try {
        audioCtxRef.current = new Ctx();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.smoothingTimeConstant = 0.8;
        audioSrcRef.current =
          audioCtxRef.current.createMediaStreamSource(stream);
        audioSrcRef.current.connect(analyserRef.current);
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        let prev = false;
        const tick = () => {
          if (!analyserRef.current) return;
          if (mutedRef.current) {
            if (prev) {
              prev = false;
              socketRef.current?.emit("state-update", { isSpeaking: false });
            }
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          analyserRef.current.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          const now = avg > 12;
          if (now !== prev) {
            prev = now;
            socketRef.current?.emit("state-update", { isSpeaking: now });
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        console.error("Speaking:", e);
      }
    },
    [stopSpeaking],
  );

  // ── Track sync ───────────────────────────────────────────────────────────

  const syncTracks = useCallback((entry: PCEntry) => {
    const cam = localRef.current;
    const scr = screenRef.current;

    const audioTrack = cam?.getAudioTracks()[0] ?? null;
    if (audioTrack) {
      if (!entry.audioSender)
        entry.audioSender = entry.pc.addTrack(audioTrack, cam!);
      else if (entry.audioSender.track !== audioTrack)
        void entry.audioSender.replaceTrack(audioTrack);
    } else if (entry.audioSender) {
      try {
        entry.pc.removeTrack(entry.audioSender);
      } catch {
        /**/
      }
      entry.audioSender = null;
    }

    const videoTrack = cam?.getVideoTracks()[0] ?? null;
    if (videoTrack) {
      if (!entry.videoSender)
        entry.videoSender = entry.pc.addTrack(videoTrack, cam!);
      else if (entry.videoSender.track !== videoTrack)
        void entry.videoSender.replaceTrack(videoTrack);
    } else if (entry.videoSender) {
      try {
        entry.pc.removeTrack(entry.videoSender);
      } catch {
        /**/
      }
      entry.videoSender = null;
    }

    const screenTrack = scr?.getVideoTracks()[0] ?? null;
    if (screenTrack) {
      if (!entry.screenSender)
        entry.screenSender = entry.pc.addTrack(screenTrack, scr!);
    } else if (entry.screenSender) {
      try {
        entry.pc.removeTrack(entry.screenSender);
      } catch {
        /**/
      }
      entry.screenSender = null;
    }
  }, []);

  // ── PC lifecycle ─────────────────────────────────────────────────────────

  const closePC = useCallback(
    (sid: string) => {
      const e = pcsRef.current.get(sid);
      if (!e) return;
      e.pc.onicecandidate = null;
      e.pc.onnegotiationneeded = null;
      e.pc.ontrack = null;
      e.pc.onconnectionstatechange = null;
      e.pc.oniceconnectionstatechange = null;
      try {
        e.pc.close();
      } catch {
        /**/
      }
      pcsRef.current.delete(sid);
      dropAllRemoteStreams(sid);
    },
    [dropAllRemoteStreams],
  );

  const closeAll = useCallback(() => {
    for (const sid of [...pcsRef.current.keys()]) closePC(sid);
  }, [closePC]);

  const createPC = useCallback(
    (targetSid: string, isOfferer: boolean): PCEntry => {
      const existing = pcsRef.current.get(targetSid);
      if (existing) {
        syncTracks(existing);
        return existing;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const entry: PCEntry = {
        pc,
        audioSender: null,
        videoSender: null,
        screenSender: null,
        isOfferer,
        makingOffer: false,
        streams: new Map(),
      };
      pcsRef.current.set(targetSid, entry);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            to: targetSid,
            candidate: candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") pc.restartIce();
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          pcsRef.current.delete(targetSid);
          dropAllRemoteStreams(targetSid);
        }
      };

      pc.ontrack = ({ track, streams }) => {
        const stream =
          streams.length > 0 ? streams[0] : new MediaStream([track]);
        entry.streams.set(stream.id, stream);
        addRemoteStream(targetSid, stream);
        track.onunmute = () => addRemoteStream(targetSid, stream);
        track.onended = () => {
          const live = stream.getTracks().some((t) => t.readyState === "live");
          if (!live) {
            entry.streams.delete(stream.id);
            dropRemoteStream(targetSid, stream.id);
          }
        };
      };

      pc.onnegotiationneeded = async () => {
        if (!entry.isOfferer || entry.makingOffer) return;
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription && socketRef.current) {
            socketRef.current.emit("offer", {
              to: targetSid,
              offer: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            });
          }
        } catch (e) {
          console.error("negotiation:", e);
        } finally {
          entry.makingOffer = false;
        }
      };

      syncTracks(entry);
      return entry;
    },
    [addRemoteStream, dropAllRemoteStreams, dropRemoteStream, syncTracks],
  );

  // ── Local media ──────────────────────────────────────────────────────────

  const ensureMedia = useCallback(async () => {
    if (localRef.current) {
      localRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !mutedRef.current;
      });
      localRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !videoOffRef.current;
      });
      return localRef.current;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Brauzer media qurilmalarni qo'llab-quvvatlamaydi.";
      setPermissionError(msg);
      toast.error(msg);
      return null;
    }
    if (mediaPromRef.current) return mediaPromRef.current;

    mediaPromRef.current = (async () => {
      setIsInitializing(true);
      setPermissionError(null);
      const audioC: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      const videoC: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      };
      const tries: { c: MediaStreamConstraints; warn?: string }[] = [
        { c: { audio: audioC, video: videoC } },
        { c: { audio: audioC, video: true } },
        { c: { audio: audioC, video: false }, warn: "Kamera topilmadi" },
        { c: { audio: false, video: videoC }, warn: "Mikrofon topilmadi" },
      ];
      let stream: MediaStream | null = null;
      let warnMsg = "";
      let lastErr: unknown;
      for (const t of tries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(t.c);
          warnMsg = t.warn ?? "";
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!stream) {
        const err = lastErr as DOMException | null;
        const msg =
          err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError"
            ? "Kamera/mikrofon uchun brauzer ruxsatini bering."
            : err?.name === "NotFoundError"
              ? "Kamera yoki mikrofon topilmadi."
              : "Media qurilmani yoqib bo'lmadi.";
        setPermissionError(msg);
        toast.error(msg);
        throw err ?? new Error(msg);
      }
      if (warnMsg) toast.warning(warnMsg);
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !mutedRef.current;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !videoOffRef.current;
      });
      localRef.current = stream;
      setLocalStream(stream);
      if (stream.getAudioTracks().length) startSpeaking(stream);
      return stream;
    })()
      .catch((e) => {
        console.error("ensureMedia:", e);
        return null;
      })
      .finally(() => {
        setIsInitializing(false);
        mediaPromRef.current = null;
      });

    return mediaPromRef.current;
  }, [startSpeaking]);

  // ── Screen share ─────────────────────────────────────────────────────────

  const stopScreen = useCallback(async () => {
    const s = screenRef.current;
    if (!s) return;
    for (const e of pcsRef.current.values()) {
      if (!e.screenSender) continue;
      try {
        e.pc.removeTrack(e.screenSender);
      } catch {
        /**/
      }
      e.screenSender = null;
    }
    s.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    socketRef.current?.emit("screen-share-stop");
  }, []);

  const toggleScreen = useCallback(async () => {
    if (!isAdmin && !isTeacher) return;
    if (screenRef.current) {
      await stopScreen();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        toast.error("Screen share boshlanmadi.");
        return;
      }
      screenRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      for (const e of pcsRef.current.values()) {
        if (!e.screenSender) e.screenSender = e.pc.addTrack(track, stream);
      }
      socketRef.current?.emit("screen-share-start", { streamId: stream.id });
      track.onended = () => {
        void stopScreen();
      };
    } catch (e) {
      const err = e as DOMException;
      if (err?.name !== "AbortError" && err?.name !== "NotAllowedError")
        toast.error("Screen share ishlamadi.");
    }
  }, [isAdmin, isTeacher, stopScreen]);

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    closeAll();
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    stopSpeaking();
    setRemoteStreams(new Map());
    setRemotePeers(new Map());
    uidToSocketRef.current.clear();
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, [closeAll, stopSpeaking]);

  // ══════════════════════════════════════════════════════════════════════════
  // SOCKET.IO
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Server uyg'onishi uchun ping
    fetch(`${SOCKET_URL}/health`).catch(() => undefined);

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", async () => {
      mySocketIdRef.current = socket.id ?? null;
      setConnected(true);
      await ensureMedia();
      socket.emit("join-room", {
        roomId: "burhan-academy-live",
        uid: user.uid,
        displayName: getName(
          user.displayName,
          user.email,
          isAdmin ? "Admin" : isTeacher ? "Ustoz" : "Foydalanuvchi",
        ),
        photoURL: user.photoURL ?? "",
        isAdmin: Boolean(isAdmin),
        isTeacher: Boolean(isTeacher),
      });
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () =>
      toast.error("Server bilan ulanishda xatolik"),
    );

    // ── Room joined ──────────────────────────────────────────────────────────
    socket.on(
      "room-joined",
      async ({
        existingPeers,
        roomState,
      }: {
        socketId: string;
        existingPeers: (RemotePeer & { socketId: string })[];
        roomState: {
          screenSharerId?: string;
          screenShareStreamId?: string;
        } | null;
      }) => {
        if (roomState?.screenSharerId) {
          setScreenSharerId(roomState.screenSharerId);
          setScreenShareStreamId(roomState.screenShareStreamId ?? null);
        }

        // DUPLICATE FIX: uid bo'yicha tekshiramiz
        setRemotePeers((prev) => {
          const next = new Map(prev);
          existingPeers.forEach((p) => {
            // Agar bu uid allaqachon bor bo'lsa, eski socketId'ni olib tashlaymiz
            const oldSid = uidToSocketRef.current.get(p.uid);
            if (oldSid && oldSid !== p.socketId) next.delete(oldSid);
            uidToSocketRef.current.set(p.uid, p.socketId);
            next.set(p.socketId, p);
          });
          return next;
        });

        await ensureMedia();
        for (const peer of existingPeers) createPC(peer.socketId, true);
      },
    );

    // ── Peer joined ──────────────────────────────────────────────────────────
    socket.on("peer-joined", (peer: RemotePeer & { socketId: string }) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        // DUPLICATE FIX: agar bu uid boshqa socketId bilan mavjud bo'lsa olib tashlaymiz
        const oldSid = uidToSocketRef.current.get(peer.uid);
        if (oldSid && oldSid !== peer.socketId) {
          next.delete(oldSid);
          closePC(oldSid);
        }
        uidToSocketRef.current.set(peer.uid, peer.socketId);
        next.set(peer.socketId, peer);
        return next;
      });
      createPC(peer.socketId, false);
    });

    // ── Peer left ────────────────────────────────────────────────────────────
    socket.on("peer-left", ({ socketId }: { socketId: string }) => {
      closePC(socketId);
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(socketId);
        if (peer) uidToSocketRef.current.delete(peer.uid);
        next.delete(socketId);
        return next;
      });
      if (screenSharerId === socketId) {
        setScreenSharerId(null);
        setScreenShareStreamId(null);
      }
    });

    // ── Participants updated ─────────────────────────────────────────────────
    socket.on(
      "participants-updated",
      (list: (RemotePeer & { socketId: string })[]) => {
        setRemotePeers((prev) => {
          const next = new Map(prev);
          // uid bo'yicha deduplication
          const seenUids = new Set<string>();
          list.forEach((p) => {
            if (p.socketId === socket.id) return;
            if (seenUids.has(p.uid)) return; // duplicate skip
            seenUids.add(p.uid);
            const oldSid = uidToSocketRef.current.get(p.uid);
            if (oldSid && oldSid !== p.socketId) next.delete(oldSid);
            uidToSocketRef.current.set(p.uid, p.socketId);
            next.set(p.socketId, p);
          });
          return next;
        });
      },
    );

    // ── State updated ────────────────────────────────────────────────────────
    socket.on(
      "peer-state-updated",
      (data: Partial<RemotePeer> & { socketId: string }) => {
        const { socketId, ...rest } = data;
        setRemotePeers((prev) => {
          const next = new Map(prev);
          const p = next.get(socketId);
          if (p) next.set(socketId, { ...p, ...rest });
          return next;
        });
      },
    );

    // ── WebRTC signals ───────────────────────────────────────────────────────
    socket.on(
      "offer",
      async ({
        from,
        offer,
      }: {
        from: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        await ensureMedia();
        const entry = pcsRef.current.get(from) ?? createPC(from, false);
        try {
          await entry.pc.setRemoteDescription(offer);
          await entry.pc.setLocalDescription();
          if (entry.pc.localDescription) {
            socket.emit("answer", {
              to: from,
              answer: {
                type: entry.pc.localDescription.type,
                sdp: entry.pc.localDescription.sdp,
              },
            });
          }
        } catch (e) {
          console.error("offer:", e);
        }
      },
    );

    socket.on(
      "answer",
      async ({
        from,
        answer,
      }: {
        from: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        const entry = pcsRef.current.get(from);
        if (!entry) return;
        try {
          await entry.pc.setRemoteDescription(answer);
        } catch (e) {
          console.error("answer:", e);
        }
      },
    );

    socket.on(
      "ice-candidate",
      async ({
        from,
        candidate,
      }: {
        from: string;
        candidate: RTCIceCandidateInit;
      }) => {
        const entry = pcsRef.current.get(from);
        if (!entry) return;
        try {
          await entry.pc.addIceCandidate(candidate);
        } catch {
          /**/
        }
      },
    );

    // ── Screen share ─────────────────────────────────────────────────────────
    socket.on(
      "screen-share-started",
      ({ socketId, streamId }: { socketId: string; streamId: string }) => {
        setScreenSharerId(socketId);
        setScreenShareStreamId(streamId);
        setRemotePeers((prev) => {
          const next = new Map(prev);
          const p = next.get(socketId);
          if (p)
            next.set(socketId, {
              ...p,
              isScreenSharing: true,
              screenStreamId: streamId,
            });
          return next;
        });
      },
    );

    socket.on("screen-share-stopped", ({ socketId }: { socketId: string }) => {
      if (screenSharerId === socketId) {
        setScreenSharerId(null);
        setScreenShareStreamId(null);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const p = next.get(socketId);
        if (p)
          next.set(socketId, {
            ...p,
            isScreenSharing: false,
            screenStreamId: null,
          });
        return next;
      });
    });

    socket.on("kicked", ({ message }: { message: string }) => {
      toast.error(message);
      cleanup();
      navigate("/courses");
    });
    socket.on("class-ended", ({ message }: { message: string }) => {
      toast.info(message);
      cleanup();
      navigate("/courses");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    for (const entry of pcsRef.current.values()) syncTracks(entry);
  }, [localStream, screenStream, syncTracks]);

  useEffect(() => {
    const s = localRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
    socketRef.current?.emit("state-update", { isMuted });
  }, [isMuted]);

  useEffect(() => {
    const s = localRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => {
      t.enabled = !isVideoOff;
    });
    socketRef.current?.emit("state-update", { isVideoOff });
  }, [isVideoOff]);

  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  // ── Getters ──────────────────────────────────────────────────────────────

  const getStreams = useCallback(
    (sid: string) => {
      if (sid === mySocketIdRef.current)
        return { camera: localStream, screen: screenStream };
      const all = remoteStreams.get(sid) ?? new Map<string, MediaStream>();
      const peer = remotePeers.get(sid);
      const scrId = peer?.isScreenSharing ? (peer.screenStreamId ?? "") : "";
      const screen = scrId ? (all.get(scrId) ?? null) : null;
      const camera = [...all.values()].find((s) => s.id !== scrId) ?? null;
      return { camera, screen };
    },
    [localStream, remotePeers, remoteStreams, screenStream],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleToggleMute = () => {
    if (!hasAudio) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (next) socketRef.current?.emit("state-update", { isSpeaking: false });
  };

  const handleToggleVideo = () => {
    if (!hasVideo) return;
    const next = !videoOffRef.current;
    videoOffRef.current = next;
    setIsVideoOff(next);
    localRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const handleLeave = () => {
    void stopScreen();
    cleanup();
    socketRef.current?.disconnect();
    navigate("/courses");
  };
  const handleEndClass = () => {
    if (!isAdmin && !isTeacher) return;
    socketRef.current?.emit("end-class");
    cleanup();
    navigate("/admin?tab=online");
  };
  const handleKick = (targetSid: string) => {
    if (!isAdmin && !isTeacher) return;
    socketRef.current?.emit("kick-user", { targetSocketId: targetSid });
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const hasAudio = Boolean(localStream?.getAudioTracks().length);
  const hasVideo = Boolean(localStream?.getVideoTracks().length);

  const localPeer: RemotePeer = {
    socketId: mySocketIdRef.current ?? "local",
    uid: user?.uid ?? "",
    displayName: getName(
      user?.displayName,
      user?.email,
      isAdmin ? "Admin" : isTeacher ? "Ustoz" : "Siz",
    ),
    photoURL: user?.photoURL ?? "",
    isAdmin: Boolean(isAdmin),
    isTeacher: Boolean(isTeacher),
    isMuted,
    isVideoOff,
    isScreenSharing,
    isSpeaking: false,
  };

  const allPeers: RemotePeer[] = [localPeer, ...[...remotePeers.values()]].sort(
    (a, b) => {
      const ra = Number(a.isAdmin || a.isTeacher),
        rb = Number(b.isAdmin || b.isTeacher);
      if (ra !== rb) return rb - ra;
      if (a.socketId === mySocketIdRef.current) return -1;
      if (b.socketId === mySocketIdRef.current) return 1;
      return a.displayName.localeCompare(b.displayName);
    },
  );

  const screenSharerPeer = screenSharerId
    ? remotePeers.get(screenSharerId)
    : undefined;
  const isLocalScreen = screenSharerId === mySocketIdRef.current;
  const screenShareStream = isLocalScreen
    ? screenStream
    : screenShareStreamId
      ? (remoteStreams.get(screenSharerId ?? "")?.get(screenShareStreamId) ??
        null)
      : null;

  const presenterPeer =
    allPeers.find((p) => p.isAdmin || p.isTeacher) ?? allPeers[0];
  const isLocalPresenter = presenterPeer?.socketId === mySocketIdRef.current;
  const presenterStream = presenterPeer
    ? getStreams(presenterPeer.socketId).camera
    : null;
  const needTeacherPH =
    !isAdmin && !isTeacher && !screenSharerPeer && !presenterPeer;

  const galleryList =
    presenterMinimized || screenSharerPeer
      ? allPeers.filter((p) => !p.isVideoOff)
      : allPeers.filter(
          (p) => !p.isVideoOff && p.socketId !== presenterPeer?.socketId,
        );

  // Theme colors
  const bg = isDark ? "#060d1f" : "#f0f4ff";
  const surface = isDark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.85)";
  const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const text = isDark ? "#e2e8f0" : "#1e293b";
  const subtext = isDark ? "#64748b" : "#64748b";

  // ── Loading state ────────────────────────────────────────────────────────

  if (!connected && !localStream) {
    return (
      <div
        className="live-room flex h-screen items-center justify-center"
        style={{ background: bg }}
      >
        <div className="text-center">
          <div className="relative mx-auto mb-6 h-16 w-16">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
            <div
              className="absolute inset-2 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-500"
              style={{
                animationDirection: "reverse",
                animationDuration: "0.6s",
              }}
            />
          </div>
          <p className="text-sm font-medium" style={{ color: text }}>
            Server bilan ulanmoqda...
          </p>
          <p className="mt-1 text-xs" style={{ color: subtext }}>
            Iltimos kuting
          </p>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div
        className="live-room flex h-screen items-center justify-center px-4"
        style={{ background: bg }}
      >
        <div
          className="w-full max-w-md rounded-3xl p-8 text-center"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "rgba(239,68,68,0.15)" }}
          >
            <VideoOff className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: text }}>
            Media qurilma kerak
          </h2>
          <p className="mt-3 text-sm" style={{ color: subtext }}>
            {permissionError}
          </p>
          <button
            onClick={() => {
              setPermissionError(null);
              void ensureMedia();
            }}
            className="mt-6 rounded-full px-8 py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────────────────────

  return (
    <div
      className={`live-room ${isDark ? "dark" : "light"} flex h-screen flex-col overflow-hidden`}
      style={{ background: bg, color: text }}
    >
      {/* ── HEADER ── */}
      <header
        className="flex h-16 shrink-0 items-center justify-between px-4 md:px-5"
        style={{
          background: surface,
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${border}`,
        }}
      >
        {/* Left: back + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/courses")}
            className="ctrl-btn flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.06)",
            }}
            title="Kurslarga qaytish"
          >
            <ArrowLeft className="h-4 w-4" style={{ color: text }} />
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}
          >
            BA
          </div>
          <div>
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: text }}
            >
              Burhan Academy Live
            </p>
            <p className="text-xs" style={{ color: subtext }}>
              {allPeers.length} qatnashuvchi
            </p>
          </div>
        </div>

        {/* Right: badges + theme toggle */}
        <div className="flex items-center gap-2">
          {!connected && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24" }}
            >
              <WifiOff className="h-3 w-3" /> Qayta ulanmoqda
            </span>
          )}
          {connected && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}
            >
              <Wifi className="h-3 w-3" /> Jonli
            </span>
          )}
          {(isAdmin || isTeacher) && (
            <span
              className="hidden rounded-full px-3 py-1 text-[11px] font-semibold sm:inline-flex"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
            >
              {isAdmin ? "Admin" : "Ustoz"}
            </span>
          )}
          {/* Dark/Light toggle */}
          <button
            onClick={() => setIsDark((v) => !v)}
            className="ctrl-btn flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.06)",
            }}
            title={isDark ? "Yorug' rejim" : "Qorong'u rejim"}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-500" />
            )}
          </button>
          {/* Participants toggle (mobile) */}
          <button
            onClick={() => setShowUserList((v) => !v)}
            className="ctrl-btn flex h-9 items-center gap-1.5 rounded-xl px-3 xl:hidden"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.06)",
            }}
          >
            <Users className="h-4 w-4" style={{ color: text }} />
            <span className="text-xs font-semibold" style={{ color: text }}>
              {allPeers.length}
            </span>
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="relative flex flex-1 gap-3 overflow-hidden p-3">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
          {/* Presenter area */}
          {!presenterMinimized && (
            <div className="fade-in relative">
              {screenSharerPeer || isLocalScreen ? (
                <div
                  className="relative min-h-[260px] overflow-hidden rounded-2xl md:min-h-[420px]"
                  style={{ background: "#000", border: `1px solid ${border}` }}
                >
                  {screenShareStream ? (
                    <VideoEl
                      stream={screenShareStream}
                      muted={isLocalScreen}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3">
                      <MonitorUp className="h-10 w-10 text-indigo-400" />
                      <p className="text-sm text-slate-400">
                        Ekran ulanmoqda...
                      </p>
                    </div>
                  )}
                  <div
                    className="absolute left-4 top-4 rounded-xl px-3 py-1.5 text-xs font-medium text-white"
                    style={{
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {isLocalScreen ? "Siz" : screenSharerPeer?.displayName} —
                    ekran ulashmoqda
                  </div>
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="ctrl-btn absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-white"
                    style={{
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : presenterPeer ? (
                <div className="relative">
                  <ParticipantTile
                    peer={presenterPeer}
                    cameraStream={presenterStream}
                    isLocal={isLocalPresenter}
                    isSharing={presenterPeer.isScreenSharing}
                    nameOverride={
                      !isAdmin &&
                      !isTeacher &&
                      (presenterPeer.isAdmin || presenterPeer.isTeacher) &&
                      presenterPeer.isVideoOff
                        ? "Ustoz"
                        : undefined
                    }
                    featured
                    isDark={isDark}
                  />
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="ctrl-btn absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-white"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : needTeacherPH ? (
                <div className="relative">
                  <TeacherPlaceholder isDark={isDark} />
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="ctrl-btn absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-white"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex min-h-[260px] items-center justify-center rounded-2xl"
                  style={{ background: surface, border: `1px solid ${border}` }}
                >
                  <div className="text-center" style={{ color: subtext }}>
                    <Camera className="mx-auto mb-2 h-10 w-10 opacity-40" />
                    <p className="text-sm">Ulanmoqda...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gallery */}
          <div
            className="rounded-2xl p-3"
            style={{ background: surface, border: `1px solid ${border}` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: text }}>
                  {presenterMinimized
                    ? "Barcha video oynalar"
                    : "Qatnashuvchilar"}
                </p>
                <p className="text-xs" style={{ color: subtext }}>
                  {galleryList.filter((p) => !p.isVideoOff).length} kamera yoqiq
                </p>
              </div>
              <button
                onClick={() => setPresenterMinimized((v) => !v)}
                className="ctrl-btn flex h-8 w-8 items-center justify-center rounded-xl"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.06)",
                }}
              >
                {presenterMinimized ? (
                  <Maximize2 className="h-4 w-4" style={{ color: text }} />
                ) : (
                  <Minimize2 className="h-4 w-4" style={{ color: text }} />
                )}
              </button>
            </div>

            {galleryList.length > 0 ||
            ((screenSharerPeer || isLocalScreen) && presenterMinimized) ? (
              <div className="grid auto-rows-[minmax(160px,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(screenSharerPeer || isLocalScreen) && presenterMinimized && (
                  <div
                    className="relative min-h-[160px] overflow-hidden rounded-2xl"
                    style={{ background: "#000" }}
                  >
                    {screenShareStream ? (
                      <VideoEl
                        stream={screenShareStream}
                        muted={isLocalScreen}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <MonitorUp className="h-8 w-8" />
                      </div>
                    )}
                    <div
                      className="absolute left-2 top-2 rounded-lg px-2 py-1 text-[10px] font-medium text-white"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      {isLocalScreen ? "Siz" : "Ustoz"} ekrani
                    </div>
                  </div>
                )}
                {galleryList.map((p) => (
                  <ParticipantTile
                    key={p.socketId}
                    peer={p}
                    cameraStream={getStreams(p.socketId).camera}
                    isLocal={p.socketId === mySocketIdRef.current}
                    isSharing={p.isScreenSharing}
                    isDark={isDark}
                    nameOverride={
                      !isAdmin &&
                      !isTeacher &&
                      (p.isAdmin || p.isTeacher) &&
                      p.isVideoOff
                        ? "Ustoz"
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div
                className="flex min-h-[120px] items-center justify-center text-sm"
                style={{ color: subtext }}
              >
                Hozircha boshqa qatnashuvchilar ulanmagan
              </div>
            )}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        {showUserList && (
          <aside
            className="fixed inset-x-3 bottom-[84px] z-30 flex max-h-[55vh] flex-col overflow-hidden rounded-2xl md:static md:bottom-auto md:max-h-none md:w-72 md:shrink-0 xl:w-80"
            style={{
              background: surface,
              border: `1px solid ${border}`,
              backdropFilter: "blur(20px)",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${border}` }}
            >
              <span
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: text }}
              >
                <Users className="h-4 w-4 text-indigo-400" />
                Qatnashuvchilar ({allPeers.length})
              </span>
              <button
                onClick={() => setShowUserList(false)}
                className="ctrl-btn flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ color: subtext }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {allPeers.map((p) => {
                const self = p.socketId === mySocketIdRef.current;
                const canKick =
                  (isAdmin || isTeacher) && !self && !p.isAdmin && !p.isTeacher;
                return (
                  <div
                    key={p.socketId}
                    className="mb-1.5 flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
                    style={{
                      background: p.isSpeaking
                        ? "rgba(52,211,153,0.08)"
                        : isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.03)",
                      border: p.isSpeaking
                        ? "1px solid rgba(52,211,153,0.25)"
                        : `1px solid ${border}`,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar peer={p} size="sm" />
                      <div className="min-w-0">
                        <p
                          className="truncate text-xs font-semibold"
                          style={{ color: text }}
                        >
                          {self ? "Siz" : p.displayName}
                        </p>
                        <p
                          className="truncate text-[10px]"
                          style={{ color: subtext }}
                        >
                          {p.isAdmin
                            ? "Admin"
                            : p.isTeacher
                              ? "Ustoz"
                              : "Talaba"}
                          {p.isScreenSharing ? " · Screen" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <span
                        className={`p-1.5 ${p.isMuted ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {p.isMuted ? (
                          <MicOff className="h-3.5 w-3.5" />
                        ) : (
                          <Mic className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span
                        className={`p-1.5 ${p.isVideoOff ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {p.isVideoOff ? (
                          <VideoOff className="h-3.5 w-3.5" />
                        ) : (
                          <Video className="h-3.5 w-3.5" />
                        )}
                      </span>
                      {canKick && (
                        <button
                          onClick={() => handleKick(p.socketId)}
                          className="ctrl-btn rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                          title="Chiqarish"
                        >
                          <PhoneOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* ── CONTROLS ── */}
      <footer
        className="flex shrink-0 flex-col gap-3 px-4 py-3 sm:h-20 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0"
        style={{
          background: surface,
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${border}`,
        }}
      >
        {/* Status */}
        <p className="hidden text-xs sm:block" style={{ color: subtext }}>
          {isInitializing
            ? "Kamera va mikrofon ulanmoqda..."
            : !hasAudio && !hasVideo
              ? "Media qurilma topilmadi"
              : connected
                ? "✓ Ulanish tayyor"
                : "Qayta ulanmoqda..."}
        </p>

        {/* Buttons */}
        <div className="mx-auto flex items-center gap-2.5">
          {/* Mic */}
          <CtrlBtn
            onClick={handleToggleMute}
            disabled={!hasAudio}
            danger={isMuted}
            className="h-11 w-11"
            title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </CtrlBtn>

          {/* Camera */}
          <CtrlBtn
            onClick={handleToggleVideo}
            disabled={!hasVideo}
            danger={isVideoOff}
            className="h-11 w-11"
            title={isVideoOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
          >
            {isVideoOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </CtrlBtn>

          {/* Screen share */}
          {(isAdmin || isTeacher) && (
            <CtrlBtn
              onClick={() => void toggleScreen()}
              active={isScreenSharing}
              className="h-11 w-11"
              title={isScreenSharing ? "Ekranni to'xtatish" : "Ekran ulashish"}
            >
              <MonitorUp className="h-5 w-5" />
            </CtrlBtn>
          )}

          {/* Separator */}
          <div className="h-8 w-px mx-1" style={{ background: border }} />

          {/* Leave / End */}
          {isAdmin || isTeacher ? (
            <CtrlBtn
              onClick={handleEndClass}
              danger
              className="h-11 gap-2 px-5 text-sm"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">Darsni tugatish</span>
              <span className="sm:hidden">Tugatish</span>
            </CtrlBtn>
          ) : (
            <CtrlBtn
              onClick={handleLeave}
              danger
              className="h-11 gap-2 px-5 text-sm"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Chiqish</span>
            </CtrlBtn>
          )}
        </div>

        {/* Sidebar toggle (desktop) */}
        <div className="hidden sm:flex sm:w-40 sm:justify-end">
          <button
            onClick={() => setShowUserList((v) => !v)}
            className="ctrl-btn flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.06)",
              color: text,
            }}
          >
            <Users className="h-4 w-4" />
            {allPeers.length} qatnashuvchi
          </button>
        </div>
      </footer>
    </div>
  );
}
