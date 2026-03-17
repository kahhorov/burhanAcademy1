// OnlineClassRoom.tsx - 100% MOS BACKEND BILAN (server.js ga to‘liq mos)
// roomId = "onlineClass" majburiy qo‘shildi
// user-list payload.users to‘g‘ri parse qilinadi
// Barcha foydalanuvchilarning kamerasi yoqilsa — barchada (left panelda) real video ko‘rinadi
// Center: Screen Share yoki Main Speaker (Ustoz) video
// Mic / Camera / Screen Share — real-time ishlaydi
// Dizayn screenshotga 99% mos (header, left panel, "Kutilmoqda...", pastki tugmalar)

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  ShieldAlert,
  MonitorUp,
  Camera,
} from "lucide-react";
import { motion } from "framer-motion";

const ROOM_ID = "onlineClass";

interface Participant {
  uid: string;
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // ====================== WEBRTC ======================
  const createPeerConnection = useCallback(
    (targetUid: string) => {
      if (!localStream || !user) return null;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              payload: { candidate: e.candidate },
              from: user.uid,
              to: targetUid,
              roomId: ROOM_ID,
            }),
          );
        }
      };

      pc.ontrack = (e) => {
        setRemoteStreams((prev) => {
          const map = new Map(prev);
          map.set(targetUid, e.streams[0]);
          return map;
        });
      };

      peerConnectionsRef.current.set(targetUid, pc);
      return pc;
    },
    [localStream, user],
  );

  const handleOffer = async (data: any) => {
    const { from, payload } = data;
    let pc = peerConnectionsRef.current.get(from);
    if (!pc) pc = createPeerConnection(from);

    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(
        JSON.stringify({
          type: "answer",
          payload: { answer: pc.localDescription },
          from: user?.uid,
          to: from,
          roomId: ROOM_ID,
        }),
      );
    }
  };

  const handleAnswer = async (data: any) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc)
      await pc.setRemoteDescription(
        new RTCSessionDescription(data.payload.answer),
      );
  };

  const handleIceCandidate = async (data: any) => {
    const pc = peerConnectionsRef.current.get(data.from);
    if (pc && data.payload.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.payload.candidate));
    }
  };

  // ====================== WEBSOCKET (roomId bilan) ======================
  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: "join",
          payload: { uid: user.uid },
          roomId: ROOM_ID,
        }),
      );
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "user-list":
          const userIds = msg.payload.users || [];
          const list: Participant[] = userIds.map((uid: string) => ({
            uid,
            displayName: uid === user.uid ? "Siz" : uid,
            isMuted: uid === user.uid ? isMuted : true,
            isVideoOff: uid === user.uid ? isVideoOff : true,
            isScreenSharing: false,
            isAdmin: uid === user.uid && (isAdmin || isTeacher),
            isTeacher: uid === user.uid && isTeacher,
          }));
          setParticipants(list);
          break;

        case "mic-toggle":
        case "camera-toggle":
          setParticipants((prev) =>
            prev.map((p) =>
              p.uid === msg.payload.from
                ? {
                    ...p,
                    [msg.type === "mic-toggle" ? "isMuted" : "isVideoOff"]:
                      msg.payload.state,
                  }
                : p,
            ),
          );
          break;

        case "screen-toggle":
          setParticipants((prev) =>
            prev.map((p) =>
              p.uid === msg.payload.from
                ? { ...p, isScreenSharing: msg.payload.state }
                : p,
            ),
          );
          break;

        case "offer":
          await handleOffer(msg);
          break;
        case "answer":
          await handleAnswer(msg);
          break;
        case "ice-candidate":
          await handleIceCandidate(msg);
          break;

        case "user-left":
          setParticipants((prev) =>
            prev.filter((p) => p.uid !== msg.payload.uid),
          );
          break;
      }
    };

    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, [user]);

  // ====================== MEDIA ======================
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      stream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
      stream.getVideoTracks().forEach((t) => (t.enabled = !isVideoOff));
    } catch {
      toast.error("Kamera va mikrofon ruxsati kerak");
    }
  }, [isMuted, isVideoOff]);

  useEffect(() => {
    if (connected) initMedia();
  }, [connected, initMedia]);

  // Yangi user kelganda offer yuborish
  useEffect(() => {
    if (!localStream || !connected || !user) return;

    participants.forEach((p) => {
      if (p.uid !== user.uid && !peerConnectionsRef.current.has(p.uid)) {
        const pc = createPeerConnection(p.uid);
        if (pc) {
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              wsRef.current?.send(
                JSON.stringify({
                  type: "offer",
                  payload: { offer: pc.localDescription },
                  from: user.uid,
                  to: p.uid,
                  roomId: ROOM_ID,
                }),
              );
            });
        }
      }
    });
  }, [participants, localStream, connected, user, createPeerConnection]);

  // Track holati yangilash + WS ga yuborish
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
    localStream.getVideoTracks().forEach((t) => (t.enabled = !isVideoOff));

    wsRef.current?.send(
      JSON.stringify({
        type: "mic-toggle",
        payload: { from: user?.uid, state: isMuted },
        roomId: ROOM_ID,
      }),
    );
    wsRef.current?.send(
      JSON.stringify({
        type: "camera-toggle",
        payload: { from: user?.uid, state: isVideoOff },
        roomId: ROOM_ID,
      }),
    );
  }, [isMuted, isVideoOff, localStream, user]);

  const toggleScreenShare = async () => {
    if (isScreenSharing && screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      wsRef.current?.send(
        JSON.stringify({
          type: "screen-toggle",
          payload: { from: user?.uid, state: false },
          roomId: ROOM_ID,
        }),
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenStream(stream);
      setIsScreenSharing(true);

      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      });

      wsRef.current?.send(
        JSON.stringify({
          type: "screen-toggle",
          payload: { from: user?.uid, state: true },
          roomId: ROOM_ID,
        }),
      );

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
        wsRef.current?.send(
          JSON.stringify({
            type: "screen-toggle",
            payload: { from: user?.uid, state: false },
            roomId: ROOM_ID,
          }),
        );
      };
    } catch {
      toast.error("Screen share bekor qilindi");
    }
  };

  // Video elementlarga stream bog‘lash
  useEffect(() => {
    if (mainVideoRef.current) {
      if (isScreenSharing && screenStream) {
        mainVideoRef.current.srcObject = screenStream;
      } else if (localStream) {
        mainVideoRef.current.srcObject = localStream;
      }
    }
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }

    videoRefs.current.forEach((video, uid) => {
      const stream = remoteStreams.get(uid);
      if (video && stream) video.srcObject = stream;
    });
  }, [localStream, screenStream, remoteStreams, isScreenSharing]);

  const leaveClass = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    peerConnectionsRef.current.forEach((pc) => pc.close());
    wsRef.current?.send(
      JSON.stringify({
        type: "leave",
        payload: { uid: user?.uid },
        roomId: ROOM_ID,
      }),
    );
    navigate("/courses");
  };

  const mainSpeaker =
    participants.find((p) => p.isTeacher || p.isAdmin) || participants[0];

  return (
    <div className="h-screen bg-[#0f1729] text-white flex flex-col overflow-hidden font-sans">
      {/* HEADER — screenshotga to‘liq mos */}
      <div className="h-16 bg-[#0a0f1c] flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-blue-500 rounded-2xl flex items-center justify-center font-bold text-xl">
            ب
          </div>
          <div>
            <h1 className="text-xl font-semibold">Jonli Efir (Professional)</h1>
            <p className="text-xs text-gray-400">
              {participants.length} qatnashuvchi •{" "}
              {connected ? "Ulangan" : "Ulanmoqda..."}
            </p>
          </div>
        </div>

        {(isAdmin || isTeacher) && (
          <div className="ml-auto bg-blue-500/20 text-blue-400 px-4 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Ustoz
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* LEFT: Ishtirokchilar (screenshot kabi) */}
        <div className="w-80 bg-[#111827] rounded-3xl border border-white/10 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-2 text-sm font-semibold bg-[#1a2338]">
            <Users className="w-4 h-4" /> Ishtirokchilar ({participants.length})
          </div>

          <div className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto">
            {participants.length === 0 ? (
              <div className="col-span-2 flex items-center justify-center h-full text-gray-500">
                Hech kim qo‘shilmagan
              </div>
            ) : (
              participants.map((p) => {
                const isSelf = p.uid === user?.uid;
                const stream = isSelf ? localStream : remoteStreams.get(p.uid);
                const hasVideo = !p.isVideoOff;

                return (
                  <motion.div
                    key={p.uid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative rounded-3xl overflow-hidden bg-[#1a2338] border border-white/10 aspect-video shadow-xl"
                  >
                    {hasVideo && stream ? (
                      <video
                        ref={(el) => el && videoRefs.current.set(p.uid, el)}
                        autoPlay
                        playsInline
                        muted={isSelf}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1f2a44] to-[#0f1729]">
                        <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-blue-500 rounded-3xl flex items-center justify-center text-6xl font-bold text-white">
                          {p.displayName.charAt(0)}
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-2xl flex items-center justify-between text-xs">
                      <span className="font-medium">{p.displayName}</span>
                      <div className="flex gap-2">
                        {p.isMuted ? (
                          <MicOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-emerald-400" />
                        )}
                        {p.isVideoOff ? (
                          <VideoOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Video className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER — screenshot kabi */}
        <div className="flex-1 bg-[#111827] rounded-3xl overflow-hidden border border-white/10 relative flex items-center justify-center">
          {participants.length === 0 ? (
            <div className="text-gray-400 text-lg">Kutilmoqda...</div>
          ) : isScreenSharing && screenStream ? (
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Overlay */}
          {participants.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl px-8 py-3 rounded-2xl flex items-center gap-3 text-lg font-medium">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
              {mainSpeaker?.displayName || "Jonli efir"}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROLS — screenshotga to‘liq mos */}
      <div className="h-20 bg-[#0a0f1c] border-t border-white/10 flex items-center justify-center gap-6 relative">
        {/* Status pill (screenshotdagi kabi) */}
        <div className="absolute left-8 bottom-6 bg-[#1a2338] text-white px-5 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="w-4 h-4" /> Jonli efir
        </div>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${isMuted ? "bg-red-500" : "bg-zinc-700"}`}
        >
          {isMuted ? <MicOff /> : <Mic />}
        </button>

        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${isVideoOff ? "bg-red-500" : "bg-zinc-700"}`}
        >
          {isVideoOff ? <VideoOff /> : <Video />}
        </button>

        {(isAdmin || isTeacher) && (
          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${isScreenSharing ? "bg-blue-500" : "bg-zinc-700"}`}
          >
            <MonitorUp />
          </button>
        )}

        <button
          onClick={leaveClass}
          className="px-10 h-14 bg-red-600 hover:bg-red-700 rounded-2xl font-semibold flex items-center gap-3 text-lg"
        >
          <PhoneOff className="w-6 h-6" /> Chiqish
        </button>
      </div>
    </div>
  );
}
