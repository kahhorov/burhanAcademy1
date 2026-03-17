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
  ShieldAlert,
  X,
  MonitorUp,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Participant {
  uid: string;
  displayName: string;
  photoURL?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isSpeaking?: boolean;
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

  const wsRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const uidRef = useRef(user?.uid);

  // Assign localStream to video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Connect to WebSocket server
  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to server");
      setConnected(true);
      // Join room
      ws.send(JSON.stringify({ type: "join", payload: { uid: user.uid } }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "user-list":
            // Create participants with default states
            const list: Participant[] = msg.payload.map((uid: string) => ({
              uid,
              displayName: uid === user.uid ? "Siz" : uid,
              isMuted: true,
              isVideoOff: true,
              isScreenSharing: false,
              isAdmin: uid === user.uid ? isAdmin || isTeacher : false,
              isTeacher: uid === user.uid ? isTeacher : false,
            }));
            setParticipants(list);
            break;
          case "mic-toggle":
            setParticipants((prev) =>
              prev.map((p) =>
                p.uid === msg.payload.uid
                  ? { ...p, isMuted: msg.payload.state }
                  : p,
              ),
            );
            break;
          case "camera-toggle":
            setParticipants((prev) =>
              prev.map((p) =>
                p.uid === msg.payload.uid
                  ? { ...p, isVideoOff: msg.payload.state }
                  : p,
              ),
            );
            break;
          case "screen-toggle":
            setParticipants((prev) =>
              prev.map((p) =>
                p.uid === msg.payload.uid
                  ? { ...p, isScreenSharing: msg.payload.state }
                  : p,
              ),
            );
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("Invalid WS message", err);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [user]);

  // Initialize media
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);
      // Set initial track states
      stream.getAudioTracks().forEach((track) => (track.enabled = !isMuted));
      stream.getVideoTracks().forEach((track) => (track.enabled = !isVideoOff));
    } catch (err) {
      console.error("Media error:", err);
      toast.error("Kamera yoki mikrofonni yoqib ruxsat bering");
    }
  }, [isMuted, isVideoOff]);

  useEffect(() => {
    if (connected) initMedia();
  }, [connected, initMedia]);

  // Toggle mic
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
        payload: { uid: user?.uid, state: newState },
      }),
    );
  };

  // Toggle camera
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
        payload: { uid: user?.uid, state: newState },
      }),
    );
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      wsRef.current?.send(
        JSON.stringify({
          type: "screen-toggle",
          payload: { uid: user?.uid, state: false },
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
      wsRef.current?.send(
        JSON.stringify({
          type: "screen-toggle",
          payload: { uid: user?.uid, state: true },
        }),
      );
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
        wsRef.current?.send(
          JSON.stringify({
            type: "screen-toggle",
            payload: { uid: user?.uid, state: false },
          }),
        );
      };
    } catch (err) {
      console.error("Screen share error:", err);
      toast.error("Ekran ulashishda xatolik");
    }
  };

  const leaveClass = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    wsRef.current?.send(
      JSON.stringify({ type: "leave", payload: { uid: user?.uid } }),
    );
    navigate("/courses");
  };

  return (
    <div className="h-screen bg-[#0f1729] text-white flex flex-col">
      {/* Top header */}
      <div className="h-14 flex items-center justify-between px-6 bg-[#162033]/90 border-b border-white/5">
        <h1 className="font-semibold">Jonli Efir</h1>
        <div>{participants.length} qatnashuvchi</div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 p-4 gap-4 overflow-hidden">
        {/* Main video */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#1a2540] border border-white/5">
          {isScreenSharing && screenStream ? (
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Participants sidebar */}
        <div className="w-64 bg-[#162033] rounded-2xl p-2 flex flex-col overflow-y-auto">
          {participants.map((p) => (
            <div
              key={p.uid}
              className="flex items-center justify-between p-2 rounded hover:bg-white/5 mb-1"
            >
              <span>{p.displayName}</span>
              <div className="flex gap-1">
                {p.isMuted ? (
                  <MicOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Mic className="w-4 h-4 text-green-400" />
                )}
                {p.isVideoOff ? (
                  <VideoOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Video className="w-4 h-4 text-green-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="h-20 flex items-center justify-center gap-4 bg-[#162033]/90 border-t border-white/5 px-4">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full ${isMuted ? "bg-red-500" : "bg-green-500"} flex items-center justify-center`}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={toggleCamera}
          className={`w-12 h-12 rounded-full ${isVideoOff ? "bg-red-500" : "bg-green-500"} flex items-center justify-center`}
        >
          {isVideoOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>
        {(isAdmin || isTeacher) && (
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full ${isScreenSharing ? "bg-blue-500" : "bg-gray-700"} flex items-center justify-center`}
          >
            <MonitorUp className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={leaveClass}
          className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
