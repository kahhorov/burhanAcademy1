import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
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

interface ParticipantState {
  displayName?: string;
  email?: string;
  photoURL?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isAdmin?: boolean;
  isTeacher?: boolean;
  isSpeaking?: boolean;
}

interface Participant {
  uid: string;
  displayName: string;
  photoURL: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isSpeaking: boolean;
}

interface OnlineClassState {
  isActive?: boolean;
  joinedUsers?: string[];
  kickedUsers?: string[];
  participantStates?: Record<string, ParticipantState>;
  sessionId?: string;
  screenSharerId?: string;
  screenShareStreamId?: string;
  signals?: Record<string, Record<string, RoomSignal>>;
}

interface RoomSignal {
  from: string;
  to: string;
  sessionId: string;
  createdAt: number;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  screenSender: RTCRtpSender | null;
}

type RemoteStreams = Record<string, Record<string, MediaStream>>;

const onlineClassDocRef = doc(db, "settings", "onlineClass");

const rtcConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
};

const createSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}`;

const createSignalId = (from: string, to: string) =>
  `${from}_${to}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getName = (
  displayName?: string | null,
  email?: string | null,
  fallback = "Foydalanuvchi",
) => displayName || email?.split("@")[0] || fallback;

function MediaView({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream ?? null;

    if (stream) {
      const playPromise = element.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => undefined);
      }
    }

    return () => {
      if (element.srcObject === stream) {
        element.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

function ParticipantTile({
  participant,
  stream,
  isLocal,
  isSharing,
  featured = false,
  nameOverride,
  subtitleOverride,
  className,
}: {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isSharing: boolean;
  featured?: boolean;
  nameOverride?: string;
  subtitleOverride?: string;
  className?: string;
}) {
  const showVideo = Boolean(stream) && !participant.isVideoOff;
  const defaultName = isLocal ? "Siz" : participant.displayName;
  const name = nameOverride || defaultName;
  const subtitle =
    subtitleOverride ||
    (participant.isAdmin
      ? "Admin"
      : participant.isTeacher
        ? "Ustoz"
        : "Talaba");

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#162033] ${featured ? "min-h-[320px] md:min-h-[460px]" : "min-h-[180px] md:min-h-[220px]"} ${participant.isSpeaking ? "ring-2 ring-emerald-400/80" : ""} ${className || ""}`}
    >
      {stream ? (
        <MediaView
          stream={stream}
          muted={isLocal}
          className={`absolute inset-0 h-full w-full object-cover ${showVideo ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}

      <div
        className={`absolute inset-0 ${showVideo ? "bg-gradient-to-t from-black/70 via-black/10 to-transparent" : "bg-[radial-gradient(circle_at_top,#1d3159,transparent_55%),linear-gradient(135deg,#162033,#0f1729)]"}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div
            className={`flex items-center justify-center overflow-hidden rounded-full font-bold ${featured ? "h-24 w-24 text-4xl" : "h-20 w-20 text-3xl"} ${participant.isAdmin || participant.isTeacher ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white" : "bg-white/10 text-white"}`}
          >
            {participant.photoURL ? (
              <img
                src={participant.photoURL}
                alt={participant.displayName}
                className="h-full w-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              participant.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-sm text-gray-400">
              {participant.isVideoOff ? "Kamera o'chiq" : "Ulanmoqda..."}
            </p>
          </div>
        </div>
      )}

      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        {(participant.isAdmin || participant.isTeacher) && (
          <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1 text-[11px] font-semibold text-blue-100">
            <ShieldAlert className="h-3.5 w-3.5" />
            {participant.isAdmin ? "Admin" : "Ustoz"}
          </span>
        )}
        {isSharing && (
          <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">
            <MonitorUp className="h-3.5 w-3.5" />
            Screen
          </span>
        )}
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="min-w-0 rounded-2xl bg-black/45 px-4 py-3 backdrop-blur">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-gray-300">{subtitle}</p>
        </div>

        <div className="flex gap-2 rounded-2xl bg-black/45 px-3 py-2 backdrop-blur">
          <div
            className={`rounded-full p-2 ${participant.isMuted ? "text-red-300" : "text-emerald-300"}`}
          >
            {participant.isMuted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </div>
          <div
            className={`rounded-full p-2 ${participant.isVideoOff ? "text-red-300" : "text-emerald-300"}`}
          >
            {participant.isVideoOff ? (
              <VideoOff className="h-4 w-4" />
            ) : (
              <Video className="h-4 w-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherPlaceholder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#243a6d,transparent_50%),linear-gradient(135deg,#162033,#0f1729)] ${compact ? "min-h-[180px] md:min-h-[220px]" : "min-h-[320px] md:min-h-[460px]"}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-white">Ustoz</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
            Kamera yoqilganda yoki ekran ulashilganda shu yerda ko'rinadi.
          </p>
        </div>
      </div>
    </div>
  );
}

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const [showUserList, setShowUserList] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth >= 1280 : true),
  );
  const [isPresenterMinimized, setIsPresenterMinimized] = useState(false);
  const [onlineClass, setOnlineClass] = useState<OnlineClassState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>({});

  const onlineClassRef = useRef<OnlineClassState | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, PeerEntry>>({});
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const mediaPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(true);
  const isVideoOffRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    onlineClassRef.current = onlineClass;
  }, [onlineClass]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  const resetSpeaking = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close().catch(() => undefined);
    }

    audioContextRef.current = null;
  }, []);

  const updateSpeakingState = useCallback(
    async (speaking: boolean) => {
      if (!user || !onlineClassRef.current?.isActive) return;

      try {
        await setDoc(
          onlineClassDocRef,
          { [`participantStates.${user.uid}.isSpeaking`]: speaking },
          { merge: true },
        );
      } catch {
        // ignore
      }
    },
    [onlineClassDocRef, user],
  );

  const detectSpeaking = useCallback(
    (stream: MediaStream) => {
      if (!stream.getAudioTracks().length) return;

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return;

      resetSpeaking();

      try {
        audioContextRef.current = new AudioContextCtor();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;
        analyserRef.current.smoothingTimeConstant = 0.85;
        sourceRef.current =
          audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);

        const size = analyserRef.current.frequencyBinCount;
        const data = new Uint8Array(size);
        let wasSpeaking = false;

        const tick = () => {
          if (!analyserRef.current) return;

          if (isMutedRef.current) {
            if (wasSpeaking) {
              wasSpeaking = false;
              void updateSpeakingState(false);
            }
            frameRef.current = requestAnimationFrame(tick);
            return;
          }

          analyserRef.current.getByteFrequencyData(data);
          let total = 0;
          for (let index = 0; index < size; index += 1) total += data[index];

          const speaking = total / size > 10;
          if (speaking !== wasSpeaking) {
            wasSpeaking = speaking;
            void updateSpeakingState(speaking);
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        tick();
      } catch (error) {
        console.error("Speaking detector error:", error);
      }
    },
    [resetSpeaking, updateSpeakingState],
  );

  const updateParticipantState = useCallback(async (overrides?: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isSpeaking?: boolean;
  }) => {
    if (!user || !onlineClassRef.current?.isActive) return;

    const stream = localStreamRef.current;
    const hasAudio = Boolean(stream?.getAudioTracks().length);
    const hasVideo = Boolean(stream?.getVideoTracks().length);

    try {
      await setDoc(
        onlineClassDocRef,
        {
          [`participantStates.${user.uid}`]: {
            displayName: getName(
              user.displayName,
              user.email,
              isAdmin ? "Admin" : isTeacher ? "Ustoz" : "Foydalanuvchi",
            ),
            email: user.email || "",
            photoURL: user.photoURL || "",
            isMuted:
              overrides?.isMuted ?? (hasAudio ? isMutedRef.current : true),
            isVideoOff:
              overrides?.isVideoOff ?? (hasVideo ? isVideoOffRef.current : true),
            isAdmin: Boolean(isAdmin),
            isTeacher: Boolean(isTeacher),
            isSpeaking: overrides?.isSpeaking ?? false,
          },
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Participant state error:", error);
    }
  }, [isAdmin, isTeacher, onlineClassDocRef, user]);

  const setRemoteStream = useCallback((uid: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [stream.id]: stream,
      },
    }));
  }, []);

  const patchLocalParticipant = useCallback(
    (patch: Partial<Participant>) => {
      if (!user) return;

      setParticipants((prev) =>
        prev.map((participant) =>
          participant.uid === user.uid ? { ...participant, ...patch } : participant,
        ),
      );
    },
    [user],
  );

  const removeRemoteStream = useCallback((uid: string, streamId: string) => {
    setRemoteStreams((prev) => {
      if (!prev[uid]?.[streamId]) return prev;

      const nextUserStreams = { ...(prev[uid] || {}) };
      delete nextUserStreams[streamId];

      const next = { ...prev };
      if (Object.keys(nextUserStreams).length) next[uid] = nextUserStreams;
      else delete next[uid];
      return next;
    });
  }, []);

  const closePeer = useCallback((uid: string) => {
    const peer = peersRef.current[uid];
    if (!peer) return;

    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;

    try {
      peer.pc.close();
    } catch {
      // ignore
    }

    delete peersRef.current[uid];
    setRemoteStreams((prev) => {
      if (!prev[uid]) return prev;
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach(closePeer);
  }, [closePeer]);

  const cleanupMedia = useCallback(() => {
    closeAllPeers();

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    resetSpeaking();
    setRemoteStreams({});
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, [closeAllPeers, resetSpeaking]);

  const sendSignal = useCallback(
    async (
      to: string,
      payload: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      },
    ) => {
      if (!user || !onlineClassRef.current?.sessionId) return;

      const signalId = createSignalId(user.uid, to);
      const data: RoomSignal = {
        from: user.uid,
        to,
        sessionId: onlineClassRef.current.sessionId,
        createdAt: Date.now(),
      };

      if (payload.description) {
        data.description = payload.description;
      }

      if (payload.candidate) {
        data.candidate = payload.candidate;
      }

      try {
        await setDoc(
          onlineClassDocRef,
          {
            [`signals.${to}.${signalId}`]: data,
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Signal send error:", error);
      }
    },
    [user],
  );

  const syncLocalTracks = useCallback((peer: PeerEntry) => {
    const stream = localStreamRef.current;
    if (stream) {
      const audio = stream.getAudioTracks()[0];
      const video = stream.getVideoTracks()[0];

      if (audio && !peer.audioSender) {
        peer.audioSender = peer.pc.addTrack(audio, stream);
      }

      if (video && !peer.videoSender) {
        peer.videoSender = peer.pc.addTrack(video, stream);
      }
    }

    const shareStream = screenStreamRef.current;
    const screenTrack = shareStream?.getVideoTracks()[0];

    if (screenTrack && !peer.screenSender) {
      peer.screenSender = peer.pc.addTrack(screenTrack, shareStream);
    }

    if (!screenTrack && peer.screenSender) {
      try {
        peer.pc.removeTrack(peer.screenSender);
      } catch {
        // ignore
      }
      peer.screenSender = null;
    }
  }, []);

  const createPeer = useCallback(
    (uid: string) => {
      const existing = peersRef.current[uid];
      if (existing) {
        syncLocalTracks(existing);
        return existing;
      }

      if (!user) throw new Error("Foydalanuvchi topilmadi");

      const peer: PeerEntry = {
        pc: new RTCPeerConnection(rtcConfig),
        polite: user.uid > uid,
        makingOffer: false,
        ignoreOffer: false,
        settingAnswer: false,
        pendingCandidates: [],
        audioSender: null,
        videoSender: null,
        screenSender: null,
      };

      peersRef.current[uid] = peer;

      peer.pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(uid, { candidate: event.candidate.toJSON() });
        }
      };

      peer.pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteStream(uid, stream);

        event.track.onended = () => {
          const hasLiveTrack = stream
            .getTracks()
            .some((track) => track.readyState === "live");
          if (!hasLiveTrack) removeRemoteStream(uid, stream.id);
        };
      };

      peer.pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await peer.pc.setLocalDescription();

          if (peer.pc.localDescription) {
            await sendSignal(uid, {
              description: {
                type: peer.pc.localDescription.type,
                sdp: peer.pc.localDescription.sdp || "",
              },
            });
          }
        } catch (error) {
          console.error("Negotiation error:", error);
        } finally {
          peer.makingOffer = false;
        }
      };

      peer.pc.onconnectionstatechange = () => {
        if (
          peer.pc.connectionState === "failed" ||
          peer.pc.connectionState === "closed"
        ) {
          closePeer(uid);
        }
      };

      syncLocalTracks(peer);

      return peer;
    },
    [closePeer, removeRemoteStream, sendSignal, setRemoteStream, syncLocalTracks, user],
  );

  const flushCandidates = useCallback(async (peer: PeerEntry) => {
    if (!peer.pc.remoteDescription) return;

    while (peer.pendingCandidates.length) {
      const candidate = peer.pendingCandidates.shift();
      if (!candidate) continue;

      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Queued ICE error:", error);
      }
    }
  }, []);

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOffRef.current;
      });
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Brauzer kamera yoki mikrofonni qo'llab-quvvatlamaydi.";
      setPermissionError(message);
      toast.error(message);
      return null;
    }

    if (mediaPromiseRef.current) return mediaPromiseRef.current;

    mediaPromiseRef.current = (async () => {
      setIsInitializing(true);
      setPermissionError(null);

      const audio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      const video: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      };

      const attempts: Array<{
        constraints: MediaStreamConstraints;
        warning?: string;
      }> = [
        { constraints: { audio, video } },
        { constraints: { audio, video: true } },
        {
          constraints: { audio, video: false },
          warning: "Kamera topilmadi. Hozircha faqat mikrofon ishlaydi.",
        },
        {
          constraints: { audio: false, video },
          warning: "Mikrofon topilmadi. Hozircha faqat kamera ishlaydi.",
        },
      ];

      let stream: MediaStream | null = null;
      let warning = "";
      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
          warning = attempt.warning || "";
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!stream) {
        const mediaError = lastError as DOMException | null;
        const message =
          mediaError?.name === "NotAllowedError" ||
          mediaError?.name === "PermissionDeniedError"
            ? "Kamera va mikrofon uchun brauzer ruxsatini yoqing."
            : mediaError?.name === "NotFoundError"
              ? "Kamera yoki mikrofon topilmadi."
              : "Kamera yoki mikrofonni ishga tushirib bo'lmadi.";

        setPermissionError(message);
        toast.error(message);
        throw mediaError || new Error(message);
      }

      if (warning) toast.warning(warning);

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOffRef.current;
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      if (stream.getAudioTracks().length) detectSpeaking(stream);
      else void updateSpeakingState(false);

      await updateParticipantState();
      return stream;
    })()
      .catch((error) => {
        console.error("Local media error:", error);
        return null;
      })
      .finally(() => {
        setIsInitializing(false);
        mediaPromiseRef.current = null;
      });

    return mediaPromiseRef.current;
  }, [detectSpeaking, updateParticipantState, updateSpeakingState]);

  const stopScreenShare = useCallback(async () => {
    const stream = screenStreamRef.current;
    if (!stream) return;

    Object.values(peersRef.current).forEach((peer) => {
      if (!peer.screenSender) return;
      try {
        peer.pc.removeTrack(peer.screenSender);
      } catch {
        // ignore
      }
      peer.screenSender = null;
    });

    stream.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    if (user && onlineClassRef.current?.screenSharerId === user.uid) {
      try {
        await setDoc(
          onlineClassDocRef,
          {
            screenSharerId: deleteField(),
            screenShareStreamId: deleteField(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Stop screen share error:", error);
      }
    }
  }, [onlineClassDocRef, user]);

  const toggleScreenShare = useCallback(async () => {
    if (!user || (!isAdmin && !isTeacher)) return;

    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        toast.error("Screen share boshlanmadi.");
        return;
      }

      await setDoc(
        onlineClassDocRef,
        {
          screenSharerId: user.uid,
          screenShareStreamId: stream.id,
        },
        { merge: true },
      );

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      Object.values(peersRef.current).forEach((peer) => {
        if (!peer.screenSender) {
          peer.screenSender = peer.pc.addTrack(track, stream);
        }
      });

      track.onended = () => {
        void stopScreenShare();
      };
    } catch (error) {
      const mediaError = error as DOMException;
      if (
        mediaError?.name !== "AbortError" &&
        mediaError?.name !== "NotAllowedError"
      ) {
        toast.error("Screen share ishlamadi.");
      }
    }
  }, [isAdmin, isTeacher, onlineClassDocRef, stopScreenShare, user]);

  const removeSelf = useCallback(async () => {
    if (!user) return;

    try {
      await setDoc(
        onlineClassDocRef,
        {
          joinedUsers: arrayRemove(user.uid),
          [`participantStates.${user.uid}`]: deleteField(),
          [`signals.${user.uid}`]: deleteField(),
          ...(onlineClassRef.current?.screenSharerId === user.uid
            ? {
                screenSharerId: deleteField(),
                screenShareStreamId: deleteField(),
              }
            : {}),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Remove self error:", error);
    }
  }, [onlineClassDocRef, user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const unsubscribe = onSnapshot(
      onlineClassDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          toast.info("Online dars topilmadi.");
          navigate("/courses");
          return;
        }

        const data = snapshot.data() as OnlineClassState;
        const joinedUsers = data.joinedUsers || [];
        const kickedUsers = data.kickedUsers || [];

        setOnlineClass(data);

        if (!data.isActive) {
          cleanupMedia();
          toast.info("Online dars yakunlandi.");
          navigate("/courses");
          return;
        }

        if (kickedUsers.includes(user.uid) && !isAdmin && !isTeacher) {
          cleanupMedia();
          toast.error("Siz bu darsdan chiqarilgansiz.");
          navigate("/courses");
          return;
        }

        if (!isAdmin && !isTeacher && !joinedUsers.includes(user.uid)) {
          cleanupMedia();
          toast.error("Bu darsga qo'shilmagansiz.");
          navigate("/courses");
          return;
        }

        const states = data.participantStates || {};
        const idsSet = new Set<string>([
          ...joinedUsers,
          ...Object.keys(states),
        ]);

        if (isAdmin || isTeacher || joinedUsers.includes(user.uid)) {
          idsSet.add(user.uid);
        }

        const ids = Array.from(idsSet).filter((id) => !kickedUsers.includes(id));

        const nextParticipants = ids
          .map((id) => {
            const state = states[id] || {};
            const self = id === user.uid;
            const admin = self ? isAdmin : Boolean(state.isAdmin);
            const teacher = self ? isTeacher : Boolean(state.isTeacher);

            return {
              uid: id,
              displayName: self
                ? getName(
                    user.displayName,
                    user.email,
                    isAdmin ? "Admin" : isTeacher ? "Ustoz" : "Siz",
                  )
                : getName(
                    state.displayName,
                    state.email,
                    admin ? "Admin" : teacher ? "Ustoz" : "Foydalanuvchi",
                  ),
              photoURL: self ? user.photoURL || "" : state.photoURL || "",
              isMuted: self
                ? !localStreamRef.current?.getAudioTracks().length ||
                  isMutedRef.current
                : state.isMuted ?? true,
              isVideoOff: self
                ? !localStreamRef.current?.getVideoTracks().length ||
                  isVideoOffRef.current
                : state.isVideoOff ?? true,
              isAdmin: admin,
              isTeacher: teacher,
              isSpeaking: self ? false : Boolean(state.isSpeaking),
            };
          })
          .sort((a, b) => {
            const aRole = Number(a.isAdmin || a.isTeacher);
            const bRole = Number(b.isAdmin || b.isTeacher);
            if (aRole !== bRole) return bRole - aRole;
            if (a.uid === user.uid) return -1;
            if (b.uid === user.uid) return 1;
            return a.displayName.localeCompare(b.displayName);
          });

        setParticipants(nextParticipants);
        setRoomReady(true);
      },
      (error) => {
        console.error("Room snapshot error:", error);
        toast.error("Online darsni yuklab bo'lmadi.");
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    cleanupMedia,
    isAdmin,
    isTeacher,
    navigate,
    onlineClassDocRef,
    user,
  ]);

  useEffect(() => {
    if (!onlineClass?.isActive || onlineClass.sessionId) return;
    if (!user || (!isAdmin && !isTeacher)) return;

    void setDoc(
      onlineClassDocRef,
      { sessionId: createSessionId() },
      { merge: true },
    ).catch((error) => {
      console.error("Session init error:", error);
    });
  }, [isAdmin, isTeacher, onlineClass?.isActive, onlineClass?.sessionId, onlineClassDocRef, user]);

  useEffect(() => {
    const sessionId = onlineClass?.sessionId || null;

    if (
      previousSessionIdRef.current &&
      sessionId &&
      previousSessionIdRef.current !== sessionId
    ) {
      closeAllPeers();
      setRemoteStreams({});
      processedSignalsRef.current.clear();
    }

    previousSessionIdRef.current = sessionId;
  }, [closeAllPeers, onlineClass?.sessionId]);

  useEffect(() => {
    if (!roomReady || !onlineClass?.isActive || !user) return;
    void ensureLocalMedia();
    void updateParticipantState();
  }, [
    ensureLocalMedia,
    onlineClass?.isActive,
    roomReady,
    updateParticipantState,
    user,
  ]);

  useEffect(() => {
    if (!user || !onlineClass?.isActive || !onlineClass.sessionId) return;

    const unsubscribe = onSnapshot(
      onlineClassDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data() as OnlineClassState;
        const signals = data.signals?.[user.uid] || {};

        Object.entries(signals).forEach(([signalId, signal]) => {
          if (processedSignalsRef.current.has(signalId)) return;
          if (signal.sessionId !== onlineClass.sessionId) {
            void setDoc(
              onlineClassDocRef,
              {
                [`signals.${user.uid}.${signalId}`]: deleteField(),
              },
              { merge: true },
            ).catch(() => undefined);
            return;
          }

          processedSignalsRef.current.add(signalId);

          void (async () => {
            try {
              if (signal.description) {
                if (signal.description.type === "offer") {
                  await ensureLocalMedia();
                }

                const peer = createPeer(signal.from);
                const readyForOffer =
                  !peer.makingOffer &&
                  (peer.pc.signalingState === "stable" || peer.settingAnswer);
                const offerCollision =
                  signal.description.type === "offer" && !readyForOffer;

                peer.ignoreOffer = !peer.polite && offerCollision;
                if (!peer.ignoreOffer) {
                  peer.settingAnswer = signal.description.type === "answer";
                  await peer.pc.setRemoteDescription(signal.description);
                  peer.settingAnswer = false;
                  await flushCandidates(peer);

                  if (signal.description.type === "offer") {
                    await peer.pc.setLocalDescription();
                    if (peer.pc.localDescription) {
                      await sendSignal(signal.from, {
                        description: {
                          type: peer.pc.localDescription.type,
                          sdp: peer.pc.localDescription.sdp || "",
                        },
                      });
                    }
                  }
                }
              }

              if (signal.candidate) {
                const peer = createPeer(signal.from);
                if (peer.ignoreOffer) return;

                if (peer.pc.remoteDescription) {
                  await peer.pc.addIceCandidate(signal.candidate);
                } else {
                  peer.pendingCandidates.push(signal.candidate);
                }
              }
            } catch (error) {
              console.error("Signal process error:", error);
            } finally {
              try {
                await setDoc(
                  onlineClassDocRef,
                  {
                    [`signals.${user.uid}.${signalId}`]: deleteField(),
                  },
                  { merge: true },
                );
              } catch {
                // ignore
              }
            }
          })();
        });
      },
      (error) => {
        console.error("Signal listener error:", error);
      },
    );

    return () => {
      unsubscribe();
      processedSignalsRef.current.clear();
    };
  }, [
    createPeer,
    ensureLocalMedia,
    flushCandidates,
    onlineClass?.isActive,
    onlineClass?.sessionId,
    sendSignal,
    user?.uid,
    user,
  ]);

  useEffect(() => {
    if (!user || !onlineClass?.isActive || !onlineClass.sessionId) return;

    const activeIds = new Set<string>();

    participants.forEach((participant) => {
      if (participant.uid === user.uid) return;
      activeIds.add(participant.uid);
      createPeer(participant.uid);
    });

    Object.keys(peersRef.current).forEach((uid) => {
      if (!activeIds.has(uid)) closePeer(uid);
    });
  }, [
    closePeer,
    createPeer,
    onlineClass?.isActive,
    onlineClass?.sessionId,
    participants,
    user,
  ]);

  useEffect(() => {
    Object.values(peersRef.current).forEach(syncLocalTracks);
  }, [localStream, screenStream, syncLocalTracks]);

  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    if (isMuted) void updateSpeakingState(false);
    void updateParticipantState();
  }, [isMuted, updateParticipantState, updateSpeakingState]);

  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !isVideoOff;
    });

    void updateParticipantState();
  }, [isVideoOff, updateParticipantState]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const getStreams = (uid: string) => {
    if (uid === user?.uid) {
      return {
        camera: localStream,
        screen: screenStream,
      };
    }

    const streams = remoteStreams[uid] || {};
    const screenId =
      onlineClass?.screenSharerId === uid ? onlineClass.screenShareStreamId : "";

    return {
      camera:
        Object.values(streams).find((stream) => stream.id !== screenId) || null,
      screen: screenId ? streams[screenId] || null : null,
    };
  };

  const handleLeave = async () => {
    await stopScreenShare();
    cleanupMedia();
    await removeSelf();
    navigate("/courses");
  };

  const handleEndClass = async () => {
    if (!isAdmin && !isTeacher) return;

    await stopScreenShare();
    cleanupMedia();

    try {
      await setDoc(
        onlineClassDocRef,
        {
          isActive: false,
          joinedUsers: [],
          kickedUsers: [],
          participantStates: {},
          sessionId: deleteField(),
          screenSharerId: deleteField(),
          screenShareStreamId: deleteField(),
          signals: deleteField(),
        },
        { merge: true },
      );

      toast.success("Online dars yakunlandi.");
      navigate("/admin?tab=online");
    } catch (error) {
      console.error("End class error:", error);
      toast.error("Darsni tugatib bo'lmadi.");
    }
  };

  const handleKickUser = async (uid: string) => {
    if (!isAdmin && !isTeacher) return;

    try {
      await setDoc(
        onlineClassDocRef,
        {
          joinedUsers: arrayRemove(uid),
          kickedUsers: arrayUnion(uid),
          [`participantStates.${uid}`]: deleteField(),
        },
        { merge: true },
      );
      toast.success("Foydalanuvchi chiqarildi.");
    } catch (error) {
      console.error("Kick user error:", error);
      toast.error("Foydalanuvchini chiqarib bo'lmadi.");
    }
  };

  const handleToggleMute = () => {
    if (!hasLocalAudio) return;

    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    patchLocalParticipant({ isMuted: nextMuted });
    if (nextMuted) {
      void updateSpeakingState(false);
    }
    void updateParticipantState({
      isMuted: nextMuted,
      isVideoOff: isVideoOffRef.current,
      isSpeaking: false,
    });
  };

  const handleToggleVideo = () => {
    if (!hasLocalVideo) return;

    const nextVideoOff = !isVideoOffRef.current;
    isVideoOffRef.current = nextVideoOff;
    setIsVideoOff(nextVideoOff);

    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });

    patchLocalParticipant({ isVideoOff: nextVideoOff });
    void updateParticipantState({
      isMuted: isMutedRef.current,
      isVideoOff: nextVideoOff,
      isSpeaking: false,
    });
  };

  const screenSharer = onlineClass?.screenSharerId
    ? participants.find((participant) => participant.uid === onlineClass.screenSharerId)
    : undefined;
  const screenSharerStream = screenSharer
    ? getStreams(screenSharer.uid).screen
    : null;
  const presenterParticipant =
    participants.find((participant) => participant.isAdmin || participant.isTeacher) ||
    (isAdmin || isTeacher
      ? participants.find((participant) => participant.uid === user?.uid) || participants[0]
      : undefined);
  const presenterStream = presenterParticipant
    ? getStreams(presenterParticipant.uid).camera
    : null;
  const showTeacherPlaceholder =
    !isAdmin &&
    !isTeacher &&
    !screenSharer &&
    !presenterParticipant;
  const presenterName =
    presenterParticipant &&
    !isAdmin &&
    !isTeacher &&
    (presenterParticipant.isAdmin || presenterParticipant.isTeacher) &&
    presenterParticipant.isVideoOff
      ? "Ustoz"
      : presenterParticipant?.displayName || "Ustoz";
  const cameraParticipants = participants.filter(
    (participant) => !participant.isVideoOff,
  );
  const galleryParticipants = isPresenterMinimized
    ? cameraParticipants
    : screenSharer
      ? cameraParticipants
      : cameraParticipants.filter(
          (participant) => participant.uid !== presenterParticipant?.uid,
        );
  const hasLocalAudio = Boolean(localStream?.getAudioTracks().length);
  const hasLocalVideo = Boolean(localStream?.getVideoTracks().length);

  if (!roomReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-gray-400">Jonli darsga ulanmoqda...</p>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#162033] p-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <VideoOff className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Kamera yoki mikrofon kerak
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Jonli suhbat ishlashi uchun brauzer kameraga va mikrofonga ruxsat
            berishi kerak.
          </p>
          <button
            onClick={() => {
              setPermissionError(null);
              void ensureLocalMedia();
            }}
            className="mt-8 rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f1729] text-white">
      <div className="flex h-16 items-center justify-between border-b border-white/5 bg-[#162033]/90 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 font-bold text-slate-950">
            BA
          </div>
          <div>
            <h1 className="text-base font-semibold">Burhan Academy Live</h1>
            <p className="text-xs text-gray-400">
              {participants.length} qatnashuvchi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(isAdmin || isTeacher) && (
            <span className="hidden rounded-full bg-blue-500/20 px-3 py-1 text-[11px] font-semibold text-blue-100 md:inline-flex">
              {isAdmin ? "Admin" : "Ustoz"}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-semibold text-red-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            JONLI
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 gap-4 overflow-hidden p-3 md:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          {!isPresenterMinimized &&
            (screenSharer ? (
              <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-white/10 bg-[#101827] shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:min-h-[420px]">
                {screenSharerStream ? (
                  <MediaView
                    stream={screenSharerStream}
                    muted={screenSharer.uid === user?.uid}
                    className="absolute inset-0 h-full w-full bg-black object-contain"
                  />
                ) : null}
                <div className="absolute left-4 top-4 rounded-full bg-black/45 px-4 py-2 text-xs font-semibold backdrop-blur md:left-5 md:top-5">
                  {screenSharer.uid === user?.uid
                    ? "Siz"
                    : screenSharer.displayName}{" "}
                  ekran ulashmoqda
                </div>
                <button
                  onClick={() => setIsPresenterMinimized(true)}
                  className="absolute right-4 top-4 rounded-full bg-black/45 p-2 text-white backdrop-blur transition-colors hover:bg-black/60"
                  title="Kichiklashtirish"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                {!screenSharerStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <MonitorUp className="h-10 w-10 text-cyan-300" />
                    <p className="text-sm text-gray-300">
                      Screen share ulanmoqda...
                    </p>
                  </div>
                )}
              </div>
            ) : presenterParticipant ? (
              <div className="relative">
                <ParticipantTile
                  participant={presenterParticipant}
                  stream={presenterStream}
                  isLocal={presenterParticipant.uid === user?.uid}
                  isSharing={onlineClass?.screenSharerId === presenterParticipant.uid}
                  nameOverride={presenterName}
                  featured
                />
                <button
                  onClick={() => setIsPresenterMinimized(true)}
                  className="absolute right-4 top-4 rounded-full bg-black/45 p-2 text-white backdrop-blur transition-colors hover:bg-black/60"
                  title="Kichiklashtirish"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            ) : showTeacherPlaceholder ? (
              <div className="relative">
                <TeacherPlaceholder />
                <button
                  onClick={() => setIsPresenterMinimized(true)}
                  className="absolute right-4 top-4 rounded-full bg-black/45 p-2 text-white backdrop-blur transition-colors hover:bg-black/60"
                  title="Kichiklashtirish"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-[#101827] md:min-h-[420px]">
                <div className="text-center text-gray-400">
                  <Camera className="mx-auto mb-3 h-12 w-12 text-gray-500" />
                  Qatnashuvchilar ulanmoqda...
                </div>
              </div>
            ))}

          <div className="rounded-3xl border border-white/5 bg-[#101827]/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {isPresenterMinimized
                    ? "Barcha video oynalar"
                    : "Jonli qatnashuvchilar"}
                </p>
                <p className="text-xs text-gray-400">
                  Kamera yoqilgan foydalanuvchilar shu yerda ko'rinadi
                </p>
              </div>
              <button
                onClick={() => setIsPresenterMinimized((value) => !value)}
                className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                title={isPresenterMinimized ? "Kattalashtirish" : "Kichiklashtirish"}
              >
                {isPresenterMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>
            </div>
            {galleryParticipants.length > 0 || (screenSharer && isPresenterMinimized) ? (
              <div className="grid auto-rows-[minmax(180px,1fr)] gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                {screenSharer && isPresenterMinimized && (
                  <div className="relative min-h-[180px] overflow-hidden rounded-3xl border border-white/10 bg-[#101827]">
                    {screenSharerStream ? (
                      <MediaView
                        stream={screenSharerStream}
                        muted={screenSharer.uid === user?.uid}
                        className="absolute inset-0 h-full w-full bg-black object-contain"
                      />
                    ) : null}
                    <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                      Ustoz ekrani
                    </div>
                    {!screenSharerStream && (
                      <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-gray-300">
                        Screen share ulanmoqda...
                      </div>
                    )}
                  </div>
                )}
                {galleryParticipants.map((participant) => (
                  <ParticipantTile
                    key={participant.uid}
                    participant={participant}
                    stream={getStreams(participant.uid).camera}
                    isLocal={participant.uid === user?.uid}
                    isSharing={onlineClass?.screenSharerId === participant.uid}
                    nameOverride={
                      !isAdmin &&
                      !isTeacher &&
                      (participant.isAdmin || participant.isTeacher) &&
                      participant.isVideoOff
                        ? "Ustoz"
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center text-center text-sm text-gray-400">
                Hozircha boshqa qatnashuvchilar ulanmagan.
              </div>
            )}
          </div>
        </div>

        {showUserList && (
          <aside className="fixed inset-x-3 bottom-3 z-30 max-h-[55vh] overflow-hidden rounded-3xl border border-white/10 bg-[#162033]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:absolute md:inset-y-3 md:right-3 md:left-auto md:w-[min(340px,calc(100vw-24px))] md:max-h-none xl:relative xl:inset-auto xl:w-80">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-cyan-300" />
                Qatnashuvchilar ({participants.length})
              </h2>
              <button
                onClick={() => setShowUserList(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-full overflow-y-auto p-3">
              {participants.map((participant) => {
                const self = participant.uid === user?.uid;
                const canKick =
                  (isAdmin || isTeacher) &&
                  !self &&
                  !participant.isAdmin &&
                  !participant.isTeacher;

                return (
                  <div
                    key={participant.uid}
                    className={`mb-2 flex items-center justify-between rounded-2xl border px-3 py-3 ${participant.isSpeaking ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/5 bg-white/[0.03]"}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${participant.isAdmin || participant.isTeacher ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white" : "bg-white/10 text-white"}`}
                      >
                        {participant.photoURL ? (
                          <img
                            src={participant.photoURL}
                            alt={participant.displayName}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              (event.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          participant.displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {self ? "Siz" : participant.displayName}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {participant.isAdmin
                            ? "Admin"
                            : participant.isTeacher
                              ? "Ustoz"
                              : "Talaba"}
                          {onlineClass?.screenSharerId === participant.uid
                            ? " - Screen share"
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <div
                        className={`rounded-full p-2 ${participant.isMuted ? "text-red-300" : "text-emerald-300"}`}
                      >
                        {participant.isMuted ? (
                          <MicOff className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`rounded-full p-2 ${participant.isVideoOff ? "text-red-300" : "text-emerald-300"}`}
                      >
                        {participant.isVideoOff ? (
                          <VideoOff className="h-4 w-4" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                      </div>
                      {canKick && (
                        <button
                          onClick={() => handleKickUser(participant.uid)}
                          className="rounded-full p-2 text-red-300 hover:bg-red-500/15"
                          title="Chiqarish"
                        >
                          <PhoneOff className="h-4 w-4" />
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

      <div className="flex flex-col gap-3 border-t border-white/5 bg-[#162033]/90 px-4 py-4 md:h-24 md:flex-row md:items-center md:justify-between md:px-8 md:py-0">
        <div className="hidden text-sm text-gray-400 md:block">
          {!hasLocalAudio || !hasLocalVideo
            ? "Qurilmalardan biri topilmadi, lekin jonli ulanish ishlayapti."
            : isInitializing
              ? "Kamera va mikrofon ulanmoqda..."
              : "Kamera, mikrofon va jonli ulanish tayyor."}
        </div>

        <div className="order-2 mx-auto flex items-center gap-3 md:order-none md:gap-4">
          <button
            onClick={handleToggleMute}
            disabled={!hasLocalAudio}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${!hasLocalAudio ? "cursor-not-allowed bg-gray-700/60 text-gray-500" : isMuted ? "bg-red-500 text-white hover:bg-red-400" : "bg-white/10 text-white hover:bg-white/20"}`}
            title={
              hasLocalAudio
                ? isMuted
                  ? "Mikrofonni yoqish"
                  : "Mikrofonni o'chirish"
                : "Mikrofon topilmadi"
            }
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={handleToggleVideo}
            disabled={!hasLocalVideo}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${!hasLocalVideo ? "cursor-not-allowed bg-gray-700/60 text-gray-500" : isVideoOff ? "bg-red-500 text-white hover:bg-red-400" : "bg-white/10 text-white hover:bg-white/20"}`}
            title={
              hasLocalVideo
                ? isVideoOff
                  ? "Kamerani yoqish"
                  : "Kamerani o'chirish"
                : "Kamera topilmadi"
            }
          >
            {isVideoOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </button>

          {(isAdmin || isTeacher) && (
            <button
              onClick={() => void toggleScreenShare()}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${isScreenSharing ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-white/10 text-white hover:bg-white/20"}`}
              title="Ekran ulashish"
            >
              <MonitorUp className="h-5 w-5" />
            </button>
          )}

          {isAdmin || isTeacher ? (
            <button
              onClick={() => void handleEndClass()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-red-500 px-6 text-sm font-semibold text-white hover:bg-red-400"
            >
              <PhoneOff className="h-5 w-5" />
              Darsni tugatish
            </button>
          ) : (
            <button
              onClick={() => void handleLeave()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-red-500 px-6 text-sm font-semibold text-white hover:bg-red-400"
            >
              <PhoneOff className="h-5 w-5" />
              Chiqish
            </button>
          )}
        </div>

        <div className="order-1 flex w-full justify-end md:order-none md:w-[110px]">
          {!showUserList && (
            <button
              onClick={() => setShowUserList(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              <Users className="h-4 w-4" />
              {participants.length}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
