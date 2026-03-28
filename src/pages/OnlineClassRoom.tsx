/**
 * OnlineClassRoom.tsx — TO'LIQ TUZATILGAN
 *
 * ASOSIY TUZATISH:
 * Xonaga YANGI kirgan foydalanuvchi har bir MAVJUD peer'ga OFFER yuboradi.
 * Mavjud peer'lar esa ANSWER bilan javob beradi.
 * Ikki tomon ham PC yaratadi lekin offer faqat BIR tomondan ketadi.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import {
  Camera,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  ShieldAlert,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Config ───────────────────────────────────────────────────────────────────

const SOCKET_URL =
  (import.meta as { env: Record<string, string> }).env.VITE_SOCKET_URL ??
  "http://localhost:4000";

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
  // Bu peer offer yuboradimi yoki kutadimi
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

// ─── ParticipantTile ─────────────────────────────────────────────────────────

function ParticipantTile({
  peer,
  cameraStream,
  isLocal,
  isSharing,
  featured = false,
  nameOverride,
  className,
}: {
  peer: RemotePeer;
  cameraStream: MediaStream | null;
  isLocal: boolean;
  isSharing: boolean;
  featured?: boolean;
  nameOverride?: string;
  className?: string;
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
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10 bg-[#162033]",
        featured
          ? "min-h-[320px] md:min-h-[460px]"
          : "min-h-[180px] md:min-h-[220px]",
        peer.isSpeaking ? "ring-2 ring-emerald-400/80" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <VideoEl
        stream={cameraStream}
        muted={isLocal}
        className={[
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
          showVideo ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      <div
        className={[
          "absolute inset-0",
          showVideo
            ? "bg-gradient-to-t from-black/70 via-transparent to-transparent"
            : "bg-[radial-gradient(ellipse_at_top,#1d3159_0%,transparent_60%),linear-gradient(150deg,#162033,#0e1525)]",
        ].join(" ")}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div
            className={[
              "flex items-center justify-center overflow-hidden rounded-full font-bold shadow-lg",
              featured ? "h-24 w-24 text-4xl" : "h-16 w-16 text-2xl",
              peer.isAdmin || peer.isTeacher
                ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white"
                : "bg-white/10 text-white",
            ].join(" ")}
          >
            {peer.photoURL ? (
              <img
                src={peer.photoURL}
                alt={name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{name}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {peer.isVideoOff ? "Kamera o'chiq" : "Ulanmoqda..."}
            </p>
          </div>
        </div>
      )}

      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {(peer.isAdmin || peer.isTeacher) && (
          <span className="flex items-center gap-1 rounded-full bg-blue-600/30 px-2.5 py-1 text-[10px] font-semibold text-blue-100 backdrop-blur">
            <ShieldAlert className="h-3 w-3" />
            {peer.isAdmin ? "Admin" : "Ustoz"}
          </span>
        )}
        {isSharing && (
          <span className="flex items-center gap-1 rounded-full bg-cyan-600/30 px-2.5 py-1 text-[10px] font-semibold text-cyan-100 backdrop-blur">
            <MonitorUp className="h-3 w-3" />
            Screen
          </span>
        )}
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
        <div className="min-w-0 rounded-xl bg-black/50 px-3 py-2 backdrop-blur">
          <p className="truncate text-xs font-semibold text-white">{name}</p>
          <p className="text-[10px] text-gray-300">{subtitle}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-black/50 px-2 py-2 backdrop-blur">
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

function TeacherPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10",
        "bg-[radial-gradient(ellipse_at_top,#243a6d_0%,transparent_55%),linear-gradient(150deg,#162033,#0e1525)]",
        compact
          ? "min-h-[180px] md:min-h-[220px]"
          : "min-h-[320px] md:min-h-[460px]",
      ].join(" ")}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-2xl">
          <ShieldAlert className="h-9 w-9" />
        </div>
        <div>
          <p className="text-xl font-semibold text-white">Ustoz</p>
          <p className="mt-1.5 max-w-xs text-sm text-slate-400">
            Kamera yoki ekran yoqilganda ko'rinadi
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

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

  // ── Refs ──
  const socketRef = useRef<Socket | null>(null);
  const mySocketIdRef = useRef<string | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(true);
  const videoOffRef = useRef(true);
  const pcsRef = useRef<Map<string, PCEntry>>(new Map());
  const mediaPromRef = useRef<Promise<MediaStream | null> | null>(null);

  // Speaking detection
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

  // ── Remote stream helpers ────────────────────────────────────────────────

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
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close().catch(() => undefined);
    }
    audioCtxRef.current = null;
  }, []);

  const startSpeaking = useCallback(
    (stream: MediaStream) => {
      if (!stream.getAudioTracks().length) return;
      const Ctx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;
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
        console.error("Speaking detect:", e);
      }
    },
    [stopSpeaking],
  );

  // ── Track sync ───────────────────────────────────────────────────────────

  const syncTracks = useCallback((entry: PCEntry) => {
    const cam = localRef.current;
    const scr = screenRef.current;

    // Audio
    const audioTrack = cam?.getAudioTracks()[0] ?? null;
    if (audioTrack) {
      if (!entry.audioSender) {
        entry.audioSender = entry.pc.addTrack(audioTrack, cam!);
      } else if (entry.audioSender.track !== audioTrack) {
        void entry.audioSender.replaceTrack(audioTrack);
      }
    } else if (entry.audioSender) {
      try {
        entry.pc.removeTrack(entry.audioSender);
      } catch {
        /**/
      }
      entry.audioSender = null;
    }

    // Camera video
    const videoTrack = cam?.getVideoTracks()[0] ?? null;
    if (videoTrack) {
      if (!entry.videoSender) {
        entry.videoSender = entry.pc.addTrack(videoTrack, cam!);
      } else if (entry.videoSender.track !== videoTrack) {
        void entry.videoSender.replaceTrack(videoTrack);
      }
    } else if (entry.videoSender) {
      try {
        entry.pc.removeTrack(entry.videoSender);
      } catch {
        /**/
      }
      entry.videoSender = null;
    }

    // Screen share
    const screenTrack = scr?.getVideoTracks()[0] ?? null;
    if (screenTrack) {
      if (!entry.screenSender) {
        entry.screenSender = entry.pc.addTrack(screenTrack, scr!);
      }
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

  /**
   * PC YARATISH
   * isOfferer = true  → biz offer yuboramiz (yangi kirgan foydalanuvchi)
   * isOfferer = false → biz answer kutamiz (mavjud peer)
   */
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

      // ICE → socket
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

      // Remote track qabul qilish
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

      // Negotiation — FAQAT isOfferer=true bo'lsa offer yuboramiz
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
          console.error("onnegotiationneeded:", e);
        } finally {
          entry.makingOffer = false;
        }
      };

      // Track'larni qo'shamiz — isOfferer=true bo'lsa negotiation trigger bo'ladi
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
        if (!e.screenSender) {
          e.screenSender = e.pc.addTrack(track, stream);
        }
      }

      socketRef.current?.emit("screen-share-start", { streamId: stream.id });
      track.onended = () => {
        void stopScreen();
      };
    } catch (e) {
      const err = e as DOMException;
      if (err?.name !== "AbortError" && err?.name !== "NotAllowedError") {
        toast.error("Screen share ishlamadi.");
      }
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
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, [closeAll, stopSpeaking]);

  // ══════════════════════════════════════════════════════════════════════════
  // SOCKET.IO CONNECTION + EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // ── Ulandi ──────────────────────────────────────────────────────────────
    socket.on("connect", async () => {
      mySocketIdRef.current = socket.id ?? null;
      setConnected(true);
      console.log("✅ Socket.io ulandi:", socket.id);

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

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("❌ Socket.io uzildi:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.io xatolik:", err);
      toast.error("Server bilan ulanishda xatolik");
    });

    // ── Xonaga qo'shildim ───────────────────────────────────────────────────
    // existingPeers — bu peer'larga BIZ offer yuboramiz
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
        console.log(
          "🏠 Xonaga qo'shildim, mavjud peer'lar:",
          existingPeers.length,
        );

        if (roomState?.screenSharerId) {
          setScreenSharerId(roomState.screenSharerId);
          setScreenShareStreamId(roomState.screenShareStreamId ?? null);
        }

        setRemotePeers((prev) => {
          const next = new Map(prev);
          existingPeers.forEach((p) => next.set(p.socketId, p));
          return next;
        });

        // Media tayyor bo'lishini kutamiz
        await ensureMedia();

        // Mavjud peer'larga OFFER yuboramiz (biz initiator'miz)
        for (const peer of existingPeers) {
          createPC(peer.socketId, true); // isOfferer = true
        }
      },
    );

    // ── Yangi peer qo'shildi ────────────────────────────────────────────────
    // Yangi peer BIZ ga offer yuboradi, biz ANSWER kutamiz
    socket.on("peer-joined", (peer: RemotePeer & { socketId: string }) => {
      console.log("👋 Yangi peer:", peer.displayName, peer.socketId);

      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.set(peer.socketId, peer);
        return next;
      });

      // isOfferer = false → biz offer YUBORMAMIZ, kutamiz
      createPC(peer.socketId, false);
    });

    // ── Peer ketdi ──────────────────────────────────────────────────────────
    socket.on("peer-left", ({ socketId }: { socketId: string }) => {
      console.log("🚪 Peer ketdi:", socketId);
      closePC(socketId);
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
      if (screenSharerId === socketId) {
        setScreenSharerId(null);
        setScreenShareStreamId(null);
      }
    });

    // ── Qatnashuvchilar yangilandi ──────────────────────────────────────────
    socket.on(
      "participants-updated",
      (list: (RemotePeer & { socketId: string })[]) => {
        setRemotePeers((prev) => {
          const next = new Map(prev);
          list.forEach((p) => {
            if (p.socketId !== socket.id) next.set(p.socketId, p);
          });
          return next;
        });
      },
    );

    // ── Peer holati yangilandi ──────────────────────────────────────────────
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

    // ── OFFER qabul qilish ──────────────────────────────────────────────────
    // Server "peer-joined" dan KEYIN yangi peer bu offer'ni yuboradi
    socket.on(
      "offer",
      async ({
        from,
        offer,
      }: {
        from: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        console.log("📨 Offer keldi:", from.slice(0, 6));

        await ensureMedia();

        // Bu peer'dan offer keldi → biz answer beramiz (isOfferer=false)
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
          console.error("Offer process:", e);
        }
      },
    );

    // ── ANSWER qabul qilish ─────────────────────────────────────────────────
    socket.on(
      "answer",
      async ({
        from,
        answer,
      }: {
        from: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        console.log("📩 Answer keldi:", from.slice(0, 6));
        const entry = pcsRef.current.get(from);
        if (!entry) return;

        try {
          await entry.pc.setRemoteDescription(answer);
        } catch (e) {
          console.error("Answer process:", e);
        }
      },
    );

    // ── ICE candidate ───────────────────────────────────────────────────────
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
          // Ba'zan normal — ignore
        }
      },
    );

    // ── Screen share ────────────────────────────────────────────────────────
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

    // ── Kicked / Class ended ────────────────────────────────────────────────
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

  // Local stream o'zgarganda barcha PC'larni sync
  useEffect(() => {
    for (const entry of pcsRef.current.values()) syncTracks(entry);
  }, [localStream, screenStream, syncTracks]);

  // Mute
  useEffect(() => {
    const s = localRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
    socketRef.current?.emit("state-update", { isMuted });
  }, [isMuted]);

  // Video
  useEffect(() => {
    const s = localRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => {
      t.enabled = !isVideoOff;
    });
    socketRef.current?.emit("state-update", { isVideoOff });
  }, [isVideoOff]);

  // Unmount
  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  // ── Stream getter ────────────────────────────────────────────────────────

  const getStreams = useCallback(
    (sid: string) => {
      if (sid === mySocketIdRef.current) {
        return { camera: localStream, screen: screenStream };
      }
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
      const ra = Number(a.isAdmin || a.isTeacher);
      const rb = Number(b.isAdmin || b.isTeacher);
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

  // ── Early returns ────────────────────────────────────────────────────────

  if (!connected && !localStream) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-gray-400">Server bilan ulanmoqda...</p>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729] px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#162033] p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <VideoOff className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Media qurilma kerak</h2>
          <p className="mt-3 text-sm text-gray-400">{permissionError}</p>
          <button
            onClick={() => {
              setPermissionError(null);
              void ensureMedia();
            }}
            className="mt-6 rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f1729] text-white">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#162033]/90 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-sm font-bold text-slate-950">
            BA
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Burhan Academy Live
            </p>
            <p className="text-xs text-gray-400">
              {allPeers.length} qatnashuvchi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!connected && (
            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-[11px] font-semibold text-yellow-200">
              Qayta ulanmoqda...
            </span>
          )}
          {(isAdmin || isTeacher) && (
            <span className="hidden rounded-full bg-blue-500/20 px-3 py-1 text-[11px] font-semibold text-blue-100 sm:inline-flex">
              {isAdmin ? "Admin" : "Ustoz"}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-semibold text-red-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            JONLI
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 gap-3 overflow-hidden p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          {/* Presenter */}
          {!presenterMinimized && (
            <div className="relative">
              {screenSharerPeer || isLocalScreen ? (
                <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-black md:min-h-[400px]">
                  {screenShareStream ? (
                    <VideoEl
                      stream={screenShareStream}
                      muted={isLocalScreen}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-gray-500">
                      <MonitorUp className="h-10 w-10 text-cyan-400" />
                      <p className="text-sm">Ekran ulanmoqda...</p>
                    </div>
                  )}
                  <div className="absolute left-4 top-4 rounded-xl bg-black/60 px-3 py-1.5 text-xs font-medium backdrop-blur">
                    {isLocalScreen ? "Siz" : screenSharerPeer?.displayName} —
                    ekran ulashmoqda
                  </div>
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
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
                  />
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : needTeacherPH ? (
                <div className="relative">
                  <TeacherPlaceholder />
                  <button
                    onClick={() => setPresenterMinimized(true)}
                    className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-[#101827]">
                  <div className="text-center text-gray-500">
                    <Camera className="mx-auto mb-2 h-10 w-10" />
                    <p className="text-sm">Ulanmoqda...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gallery */}
          <div className="rounded-2xl border border-white/5 bg-[#101827]/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {presenterMinimized
                    ? "Barcha video oynalar"
                    : "Qatnashuvchilar"}
                </p>
                <p className="text-xs text-gray-500">
                  {galleryList.filter((p) => !p.isVideoOff).length} kamera yoqiq
                </p>
              </div>
              <button
                onClick={() => setPresenterMinimized((v) => !v)}
                className="rounded-xl bg-white/8 p-2 text-white hover:bg-white/15"
              >
                {presenterMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>
            </div>

            {galleryList.length > 0 ||
            ((screenSharerPeer || isLocalScreen) && presenterMinimized) ? (
              <div className="grid auto-rows-[minmax(160px,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(screenSharerPeer || isLocalScreen) && presenterMinimized && (
                  <div className="relative min-h-[160px] overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {screenShareStream ? (
                      <VideoEl
                        stream={screenShareStream}
                        muted={isLocalScreen}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">
                        <MonitorUp className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium backdrop-blur">
                      {isLocalScreen ? "Siz" : "Ustoz"} ekrani
                    </div>
                  </div>
                )}

                {galleryList.map((p) => {
                  const isLocal = p.socketId === mySocketIdRef.current;
                  return (
                    <ParticipantTile
                      key={p.socketId}
                      peer={p}
                      cameraStream={getStreams(p.socketId).camera}
                      isLocal={isLocal}
                      isSharing={p.isScreenSharing}
                      nameOverride={
                        !isAdmin &&
                        !isTeacher &&
                        (p.isAdmin || p.isTeacher) &&
                        p.isVideoOff
                          ? "Ustoz"
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500">
                Hozircha boshqa qatnashuvchilar ulanmagan
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {showUserList && (
          <aside className="fixed inset-x-3 bottom-[88px] z-30 max-h-[50vh] overflow-hidden rounded-2xl border border-white/10 bg-[#162033]/95 shadow-2xl md:static md:bottom-auto md:max-h-none md:w-72 md:shrink-0 xl:w-80">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-cyan-300" />
                Qatnashuvchilar ({allPeers.length})
              </span>
              <button
                onClick={() => setShowUserList(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="overflow-y-auto p-2"
              style={{ maxHeight: "calc(100% - 52px)" }}
            >
              {allPeers.map((p) => {
                const self = p.socketId === mySocketIdRef.current;
                const canKick =
                  (isAdmin || isTeacher) && !self && !p.isAdmin && !p.isTeacher;
                return (
                  <div
                    key={p.socketId}
                    className={[
                      "mb-1.5 flex items-center justify-between rounded-xl border px-3 py-2.5",
                      p.isSpeaking
                        ? "border-emerald-400/30 bg-emerald-500/8"
                        : "border-white/5 bg-white/[0.02]",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold",
                          p.isAdmin || p.isTeacher
                            ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white"
                            : "bg-white/10 text-white",
                        ].join(" ")}
                      >
                        {p.photoURL ? (
                          <img
                            src={p.photoURL}
                            alt={p.displayName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                            }}
                          />
                        ) : (
                          p.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {self ? "Siz" : p.displayName}
                        </p>
                        <p className="truncate text-[10px] text-gray-400">
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
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/15"
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

      {/* Controls */}
      <footer className="flex shrink-0 flex-col gap-3 border-t border-white/5 bg-[#162033]/90 px-4 py-3 sm:h-20 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
        <p className="hidden text-xs text-gray-500 sm:block">
          {isInitializing
            ? "Kamera va mikrofon ulanmoqda..."
            : !hasAudio && !hasVideo
              ? "Media qurilma topilmadi"
              : connected
                ? "Ulanish tayyor ✓"
                : "Qayta ulanmoqda..."}
        </p>

        <div className="mx-auto flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            disabled={!hasAudio}
            title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              !hasAudio
                ? "cursor-not-allowed bg-gray-700/50 text-gray-600"
                : isMuted
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-white/10 text-white hover:bg-white/20",
            ].join(" ")}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={handleToggleVideo}
            disabled={!hasVideo}
            title={isVideoOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              !hasVideo
                ? "cursor-not-allowed bg-gray-700/50 text-gray-600"
                : isVideoOff
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-white/10 text-white hover:bg-white/20",
            ].join(" ")}
          >
            {isVideoOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </button>

          {(isAdmin || isTeacher) && (
            <button
              onClick={() => void toggleScreen()}
              title={isScreenSharing ? "Ekranni to'xtatish" : "Ekran ulashish"}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                isScreenSharing
                  ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  : "bg-white/10 text-white hover:bg-white/20",
              ].join(" ")}
            >
              <MonitorUp className="h-5 w-5" />
            </button>
          )}

          {isAdmin || isTeacher ? (
            <button
              onClick={handleEndClass}
              className="flex h-11 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white hover:bg-red-400"
            >
              <PhoneOff className="h-4 w-4" /> Darsni tugatish
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="flex h-11 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white hover:bg-red-400"
            >
              <PhoneOff className="h-4 w-4" /> Chiqish
            </button>
          )}
        </div>

        <div className="flex justify-end sm:w-28">
          {!showUserList && (
            <button
              onClick={() => setShowUserList(true)}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
            >
              <Users className="h-4 w-4" /> {allPeers.length}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
