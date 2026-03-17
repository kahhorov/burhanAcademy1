import React, { useEffect, useRef, useState, useCallback } from "react";
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
  MonitorUp,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// -- TYPES --
interface Participant {
  uid: string;
  displayName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

// -- KICHIK VIDEO KOMPONENTI (React'da stream'ni to'g'ri ulash uchun) --
const VideoPlayer = ({
  stream,
  isLocal,
  participant,
}: {
  stream: MediaStream | null;
  isLocal: boolean;
  participant: Participant;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-48 bg-[#1a2540] rounded-xl overflow-hidden border border-white/10 shadow-lg group">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // O'zimizning ovozimiz o'zimizga qaytmasligi uchun
        className={`w-full h-full object-cover ${participant?.isVideoOff ? "hidden" : "block"} ${isLocal ? "scale-x-[-1]" : ""}`}
      />

      {/* Kamera o'chiq bo'lsa Avatar chiqadi */}
      {participant?.isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <span className="text-sm font-medium text-gray-300">
            {participant.displayName}
          </span>
        </div>
      )}

      {/* Foydalanuvchi ismi va holati */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg opacity-100 transition-opacity">
        <span className="text-xs font-medium text-white truncate max-w-[100px]">
          {participant?.displayName} {isLocal && "(Siz)"}
        </span>
        <div className="flex gap-1.5">
          {participant?.isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-green-400" />
          )}
        </div>
      </div>
    </div>
  );
};

// -- ASOSIY KOMPONENT --
export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  // State'lar
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{
    [key: string]: MediaStream;
  }>({});
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false); // Default yoniq
  const [isVideoOff, setIsVideoOff] = useState(false); // Default yoniq
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);

  // Ref'lar (WebRTC uchun)
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null); // State bilan WebRTC ichida sinxron ishlash uchun

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
  };

  // 1. KAMERA VA MIKROFONNI OLISH
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setLocalStream(stream);
      localStreamRef.current = stream; // WebRTC ga berish uchun refga ham saqlaymiz

      stream.getAudioTracks().forEach((track) => (track.enabled = !isMuted));
      stream.getVideoTracks().forEach((track) => (track.enabled = !isVideoOff));

      connectWebSocket(); // Media olingach serverga ulanamiz
    } catch (err) {
      console.error("Media error:", err);
      toast.error("Kamera yoki mikrofonga ruxsat berilmadi!");
    }
  }, []);

  useEffect(() => {
    initMedia();
    return () => {
      // Chiqib ketganda hammasini tozalash
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach((peer) => peer.close());
      wsRef.current?.close();
    };
  }, [initMedia]);

  // 2. WEBSOCKET VA WEBRTC LOGIKASI
  const connectWebSocket = () => {
    if (!user) return;
    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Xonaga ulanish (roomId ni xohlagan ismingiz bilan bering)
      ws.send(
        JSON.stringify({
          type: "join",
          roomId: "math-class-101",
          payload: { uid: user.uid },
        }),
      );
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const { type, payload, from } = data;

      switch (type) {
        case "user-list":
          // Yangi foydalanuvchilar ro'yxati keldi
          const list: Participant[] = payload.map((uid: string) => ({
            uid,
            displayName:
              uid === user.uid ? "Siz" : `User ${uid.substring(0, 4)}`,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
          }));
          setParticipants(list);

          // Menda yo'q foydalanuvchilarga P2P ulanish yaratib, "Offer" yuboramiz
          payload.forEach((remoteUid: string) => {
            if (remoteUid !== user.uid && !peersRef.current[remoteUid]) {
              const peer = createPeerConnection(remoteUid, ws);
              createOffer(peer, remoteUid, ws);
            }
          });
          break;

        case "offer":
          if (!peersRef.current[from]) {
            const peer = createPeerConnection(from, ws);
            await peer.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                type: "answer",
                to: from,
                roomId: "math-class-101",
                payload: peer.localDescription,
                from: user.uid,
              }),
            );
          }
          break;

        case "answer":
          if (peersRef.current[from]) {
            await peersRef.current[from].setRemoteDescription(
              new RTCSessionDescription(payload),
            );
          }
          break;

        case "ice-candidate":
          if (peersRef.current[from]) {
            await peersRef.current[from].addIceCandidate(
              new RTCIceCandidate(payload),
            );
          }
          break;

        // UI holatlarini yangilash (Mic/Cam Toggle)
        case "mic-toggle":
          updateParticipantState(payload.uid, { isMuted: payload.state });
          break;
        case "camera-toggle":
          updateParticipantState(payload.uid, { isVideoOff: payload.state });
          break;
      }
    };
  };

  // WebRTC Ulanishini (PeerConnection) yaratish
  const createPeerConnection = (remoteUid: string, ws: WebSocket) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[remoteUid] = peer;

    // Mahalliy video/ovozimizni unga qo'shamiz
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current!);
      });
    }

    // Undan tarmoq ma'lumotlari kelsa, server orqali unga yuboramiz
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(
          JSON.stringify({
            type: "ice-candidate",
            to: remoteUid,
            roomId: "math-class-101",
            payload: event.candidate,
            from: user?.uid,
          }),
        );
      }
    };

    // Undan video/ovoz kelib tushganda UI ga chiqaramiz
    peer.ontrack = (event) => {
      setRemoteStreams((prev) => ({ ...prev, [remoteUid]: event.streams[0] }));
    };

    return peer;
  };

  const createOffer = async (
    peer: RTCPeerConnection,
    remoteUid: string,
    ws: WebSocket,
  ) => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.send(
      JSON.stringify({
        type: "offer",
        to: remoteUid,
        roomId: "math-class-101",
        payload: peer.localDescription,
        from: user?.uid,
      }),
    );
  };

  const updateParticipantState = (
    uid: string,
    updates: Partial<Participant>,
  ) => {
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, ...updates } : p)),
    );
  };

  // 3. TUGMALAR FUNKSIYALARI
  const toggleMic = () => {
    if (!localStream) return;
    const newState = !isMuted;
    setIsMuted(newState);
    localStream
      .getAudioTracks()
      .forEach((track) => (track.enabled = !newState));
    wsRef.current?.send(
      JSON.stringify({
        type: "mic-toggle",
        roomId: "math-class-101",
        payload: { uid: user?.uid, state: newState },
      }),
    );
    updateParticipantState(user!.uid, { isMuted: newState });
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const newState = !isVideoOff;
    setIsVideoOff(newState);
    localStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !newState));
    wsRef.current?.send(
      JSON.stringify({
        type: "camera-toggle",
        roomId: "math-class-101",
        payload: { uid: user?.uid, state: newState },
      }),
    );
    updateParticipantState(user!.uid, { isVideoOff: newState });
  };

  const leaveClass = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    wsRef.current?.send(
      JSON.stringify({
        type: "leave",
        roomId: "math-class-101",
        payload: { uid: user?.uid },
      }),
    );
    navigate("/courses");
  };

  const me = participants.find((p) => p.uid === user?.uid) || {
    uid: user?.uid,
    displayName: "Siz",
    isMuted,
    isVideoOff,
    isScreenSharing: false,
  };
  const others = participants.filter((p) => p.uid !== user?.uid);

  return (
    <div className="h-screen bg-[#0a0f1c] text-white flex flex-col font-sans">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 bg-[#121b2d] border-b border-white/5 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <h1 className="font-semibold text-lg tracking-wide">
            React.js Masterklass
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">
            {participants.length} ishtirokchi
          </span>
        </div>
      </div>

      {/* Main content Area */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* CHAP TARAF: Foydalanuvchilar ro'yxati (Grid yoki Column) */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
          {/* O'zimizning videomuz */}
          <VideoPlayer
            stream={localStream}
            isLocal={true}
            participant={me as Participant}
          />

          {/* Boshqa foydalanuvchilar videolari */}
          <AnimatePresence>
            {others.map((p) => (
              <motion.div
                key={p.uid}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <VideoPlayer
                  stream={remoteStreams[p.uid] || null}
                  isLocal={false}
                  participant={p}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* O'NG TARAF: Asosiy Ekran (Screen Share yoki Asosiy o'qituvchi) */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#121b2d] border border-white/5 shadow-inner flex items-center justify-center">
          {isScreenSharing && screenStream ? (
            <video
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <MonitorUp className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-gray-300">
                Asosiy ekranga xush kelibsiz
              </h2>
              <p className="text-gray-500 mt-2 text-sm">
                Hozircha hech kim ekran ulashmadi
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Oyna ostidagi Controller (Mikrofon, Kamera, Ekran) */}
      <div className="h-24 flex items-center justify-center gap-6 bg-[#121b2d] border-t border-white/5 pb-2">
        <button
          onClick={toggleMic}
          className={`flex flex-col items-center gap-2 group transition-all`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isMuted ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-gray-800 text-white hover:bg-gray-700"}`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </div>
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200">
            {isMuted ? "Yoqish" : "O'chirish"}
          </span>
        </button>

        <button
          onClick={toggleCamera}
          className={`flex flex-col items-center gap-2 group transition-all`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isVideoOff ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-gray-800 text-white hover:bg-gray-700"}`}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </div>
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200">
            {isVideoOff ? "Yoqish" : "O'chirish"}
          </span>
        </button>

        <div className="w-px h-10 bg-white/10 mx-2"></div>

        <button
          onClick={leaveClass}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-14 rounded-2xl bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-all">
            <PhoneOff className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium text-red-400">Chiqish</span>
        </button>
      </div>
    </div>
  );
}
