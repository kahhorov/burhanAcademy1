// OnlineClassRoom.tsx - To'liq WebSocket bilan moslashtirilgan frontend
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  doc,
  onSnapshot,
  setDoc,
  arrayRemove,
  arrayUnion,
  deleteField,
} from "firebase/firestore";
import { db } from "../lib/firebase";
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
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Participant {
  id: string;
  uid: string;
  name: string;
  displayName: string;
  photoURL: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
}

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  // Media states
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Class states
  const [onlineClass, setOnlineClass] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showUserList, setShowUserList] = useState(true);

  // WebSocket states
  const [wsConnected, setWsConnected] = useState(false);

  // Refs
  const localVideoMainRef = useRef<HTMLVideoElement>(null);
  const localVideoSmallRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Audio context for speaking detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs for sync
  const onlineClassRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const isMutedRef = useRef(true);
  const isVideoOffRef = useRef(true);
  const participantsRef = useRef<Participant[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    onlineClassRef.current = onlineClass;
  }, [onlineClass]);

  useEffect(() => {
    initializedRef.current = initialized;
  }, [initialized]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // WebSocket connection setup
  useEffect(() => {
    if (!user || !initialized) return;

    const connectWebSocket = () => {
      const ws = new WebSocket("ws://localhost:3001");

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
        // Send join message
        ws.send(
          JSON.stringify({
            type: "join",
            payload: {
              uid: user.uid,
              displayName:
                user.displayName ||
                user.email?.split("@")[0] ||
                "Foydalanuvchi",
              photoURL: user.photoURL || "",
              isAdmin,
              isTeacher,
            },
          }),
        );
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "user-list":
              handleUserList(data.payload);
              break;

            case "mic-toggle":
              handleParticipantMicToggle(data.payload);
              break;

            case "camera-toggle":
              handleParticipantCameraToggle(data.payload);
              break;

            case "screen-toggle":
              handleParticipantScreenToggle(data.payload);
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "leave",
            payload: { uid: user.uid },
          }),
        );
        wsRef.current.close();
      }
    };
  }, [user, initialized, isAdmin, isTeacher]);

  const handleUserList = (userList: string[]) => {
    setParticipants((prev) => {
      const currentParticipants = [...prev];

      // Add new participants from userList
      userList.forEach((uid) => {
        if (!currentParticipants.some((p) => p.uid === uid)) {
          currentParticipants.push({
            id: uid,
            uid,
            name: uid === user?.uid ? "Siz" : "Foydalanuvchi",
            displayName:
              uid === user?.uid
                ? user?.displayName || user?.email?.split("@")[0] || "Siz"
                : "Foydalanuvchi",
            photoURL: uid === user?.uid ? user?.photoURL || "" : "",
            isMuted: true,
            isVideoOff: true,
            isAdmin: uid === user?.uid ? isAdmin : false,
            isTeacher: uid === user?.uid ? isTeacher : false,
            isSpeaking: false,
            isScreenSharing: false,
          });
        }
      });

      // Remove participants not in userList
      const filteredParticipants = currentParticipants.filter(
        (p) => userList.includes(p.uid) || p.uid === user?.uid,
      );

      return filteredParticipants;
    });
  };

  const handleParticipantMicToggle = (payload: any) => {
    const { uid, state } = payload;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, isMuted: state } : p)),
    );
  };

  const handleParticipantCameraToggle = (payload: any) => {
    const { uid, state } = payload;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, isVideoOff: state } : p)),
    );
  };

  const handleParticipantScreenToggle = (payload: any) => {
    const { uid, state } = payload;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, isScreenSharing: state } : p)),
    );
  };

  // Assign streams to video elements
  useEffect(() => {
    if (localStream) {
      if (localVideoMainRef.current) {
        localVideoMainRef.current.srcObject = localStream;
      }
      if (localVideoSmallRef.current) {
        localVideoSmallRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Main Firebase listener
  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "settings", "onlineClass"),
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOnlineClass(data);

          const joinedUsers: string[] = data.joinedUsers || [];
          const kickedUsers: string[] = data.kickedUsers || [];

          // Check if user was kicked
          if (kickedUsers.includes(user.uid) && !isAdmin && !isTeacher) {
            cleanupMedia();
            toast.error("Siz bu darsdan chiqarilgansiz.");
            navigate("/courses");
            return;
          }

          const isUserJoined =
            joinedUsers.includes(user.uid) || isAdmin || isTeacher;

          if (!data.isActive) {
            cleanupMedia();
            toast.info("Online dars yakunlandi");
            navigate("/courses");
            return;
          }

          if (!isUserJoined) {
            toast.error("Siz bu darsga qo'shilmagansiz");
            navigate("/courses");
            return;
          }

          setInitialized(true);

          const participantStates = data.participantStates || {};

          // Build participants list from joinedUsers
          const participantsList: Participant[] = joinedUsers.map(
            (uid: string) => {
              const state = participantStates[uid] || {};
              const isSelf = uid === user.uid;

              // Find existing participant state
              const existingParticipant = participantsRef.current.find(
                (p) => p.uid === uid,
              );

              return {
                id: uid,
                uid: uid,
                name: isSelf
                  ? "Siz"
                  : state.displayName || state.name || "Foydalanuvchi",
                displayName: isSelf
                  ? user.displayName || user.email?.split("@")[0] || "Siz"
                  : state.displayName || state.name || "Foydalanuvchi",
                photoURL: isSelf ? user.photoURL || "" : state.photoURL || "",
                isMuted: isSelf
                  ? isMutedRef.current
                  : (existingParticipant?.isMuted ?? state.isMuted ?? true),
                isVideoOff: isSelf
                  ? isVideoOffRef.current
                  : (existingParticipant?.isVideoOff ??
                    state.isVideoOff ??
                    true),
                isAdmin: state.isAdmin ?? false,
                isTeacher: state.isTeacher ?? false,
                isSpeaking: state.isSpeaking ?? false,
                isScreenSharing: existingParticipant?.isScreenSharing ?? false,
              };
            },
          );

          // Add admin/teacher if not in joinedUsers list
          if (
            (isAdmin || isTeacher) &&
            !participantsList.some((p) => p.uid === user.uid)
          ) {
            participantsList.unshift({
              id: user.uid,
              uid: user.uid,
              name: "Siz",
              displayName:
                user.displayName ||
                user.email?.split("@")[0] ||
                (isAdmin ? "Admin" : "Ustoz"),
              photoURL: user.photoURL || "",
              isMuted: isMutedRef.current,
              isVideoOff: isVideoOffRef.current,
              isAdmin: isAdmin,
              isTeacher: isTeacher,
              isSpeaking: false,
              isScreenSharing: false,
            });
          }

          setParticipants(participantsList);
        } else {
          toast.info("Online dars topilmadi");
          navigate("/courses");
        }
      },
    );

    return () => {
      unsubscribe();
      cleanupMedia();
    };
  }, [user, isAdmin, isTeacher, navigate]);

  const detectSpeaking = useCallback((stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      analyserRef.current.smoothingTimeConstant = 0.85;

      microphoneRef.current =
        audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastSpeakingState = false;

      const checkAudioLevel = () => {
        if (!analyserRef.current || isMutedRef.current) {
          if (lastSpeakingState) {
            updateSpeakingState(false);
            lastSpeakingState = false;
          }
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isCurrentlySpeaking = average > 10;

        if (isCurrentlySpeaking !== lastSpeakingState) {
          updateSpeakingState(isCurrentlySpeaking);
          lastSpeakingState = isCurrentlySpeaking;
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (e) {
      console.error("Error setting up audio detection:", e);
    }
  }, []);

  const updateSpeakingState = async (speaking: boolean) => {
    if (!user || !initializedRef.current) return;

    try {
      await setDoc(
        doc(db, "settings", "onlineClass"),
        {
          [`participantStates.${user.uid}.isSpeaking`]: speaking,
        },
        { merge: true },
      );
    } catch (e) {
      // Ignore minor errors
    }
  };

  const initMedia = async () => {
    if (isInitializing) return;

    try {
      setIsInitializing(true);
      setPermissionError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);

      // Set initial track states
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });

      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOff;
      });

      detectSpeaking(stream);
      await updateParticipantState();

      toast.success("Mikrofon va kameraga ulandi");
    } catch (error: any) {
      console.error("Media permission error:", error);
      setPermissionError(error.message);

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        toast.error("Mikrofon va kameraga ruxsat berilmagan", {
          duration: 5000,
          action: {
            label: "Qayta urunish",
            onClick: () => initMedia(),
          },
        });
      } else {
        toast.error("Media qurilmalariga ulanishda xatolik");
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing && screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);

        // Notify others
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "screen-toggle",
              payload: {
                uid: user?.uid,
                state: false,
              },
            }),
          );
        }
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Notify others
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "screen-toggle",
            payload: {
              uid: user?.uid,
              state: true,
            },
          }),
        );
      }

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);

        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "screen-toggle",
              payload: {
                uid: user?.uid,
                state: false,
              },
            }),
          );
        }
      };
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
        toast.error("Ekran ulashishda xatolik");
      }
    }
  };

  const updateParticipantState = async () => {
    if (!user || !onlineClassRef.current?.isActive || !initializedRef.current)
      return;

    try {
      await setDoc(
        doc(db, "settings", "onlineClass"),
        {
          [`participantStates.${user.uid}`]: {
            displayName:
              user.displayName ||
              user.email?.split("@")[0] ||
              (isAdmin ? "Admin" : "Foydalanuvchi"),
            photoURL: user.photoURL || "",
            isMuted,
            isVideoOff,
            isAdmin: isAdmin || false,
            isTeacher: isTeacher || false,
            isSpeaking: false,
          },
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error updating participant state:", error);
    }
  };

  const cleanupMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
    }
  }, [localStream, screenStream]);

  // Init media when class is active
  useEffect(() => {
    if (user && onlineClass?.isActive && initialized) {
      initMedia();
    }

    return () => {
      cleanupMedia();
    };
  }, [user, onlineClass?.isActive, initialized]);

  // Update participant state and notify others when mute/video changes
  useEffect(() => {
    if (!user || !onlineClass?.isActive || !initialized || !localStream) return;

    updateParticipantState();

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !isVideoOff;
    });

    // Notify others via WebSocket
    if (wsRef.current && wsConnected) {
      wsRef.current.send(
        JSON.stringify({
          type: "mic-toggle",
          payload: {
            uid: user.uid,
            state: isMuted,
          },
        }),
      );

      wsRef.current.send(
        JSON.stringify({
          type: "camera-toggle",
          payload: {
            uid: user.uid,
            state: isVideoOff,
          },
        }),
      );
    }

    if (isMuted) {
      updateSpeakingState(false);
    }
  }, [
    isMuted,
    isVideoOff,
    user,
    initialized,
    onlineClass?.isActive,
    localStream,
    wsConnected,
  ]);

  const handleLeave = async () => {
    if (!user) return;

    // Notify others
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "leave",
          payload: { uid: user.uid },
        }),
      );
    }

    cleanupMedia();
    setLocalStream(null);
    setScreenStream(null);

    try {
      if (!isAdmin && !isTeacher) {
        await setDoc(
          doc(db, "settings", "onlineClass"),
          {
            joinedUsers: arrayRemove(user.uid),
            [`participantStates.${user.uid}`]: deleteField(),
          },
          { merge: true },
        );
      } else {
        await setDoc(
          doc(db, "settings", "onlineClass"),
          {
            [`participantStates.${user.uid}`]: deleteField(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      console.error("Error leaving:", error);
    }

    navigate("/courses");
  };

  const handleEndClass = async () => {
    if (!isAdmin && !isTeacher) return;

    // Notify all participants
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "class-ended",
          payload: {},
        }),
      );
    }

    cleanupMedia();
    setLocalStream(null);
    setScreenStream(null);

    try {
      await setDoc(
        doc(db, "settings", "onlineClass"),
        {
          isActive: false,
          joinedUsers: [],
          kickedUsers: [],
          participantStates: {},
        },
        { merge: true },
      );

      toast.success("Dars yakunlandi");
      navigate("/admin?tab=online");
    } catch (error) {
      toast.error("Xatolik yuz berdi");
    }
  };

  const handleKickUser = async (uid: string) => {
    if (!isAdmin && !isTeacher) return;

    try {
      await setDoc(
        doc(db, "settings", "onlineClass"),
        {
          joinedUsers: arrayRemove(uid),
          kickedUsers: arrayUnion(uid),
          [`participantStates.${uid}`]: deleteField(),
        },
        { merge: true },
      );

      toast.success("Foydalanuvchi chiqarildi");
    } catch (error) {
      toast.error("Xatolik yuz berdi");
    }
  };

  // Loading state
  if (!initialized) {
    return (
      <div className="h-screen bg-[#0f1729] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Jonli efirga ulanmoqda...</p>
        </div>
      </div>
    );
  }

  // Permission error state
  if (permissionError) {
    return (
      <div className="h-screen bg-[#0f1729] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <VideoOff className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Ruxsat talab qilinadi
          </h2>
          <p className="text-gray-400 mb-8">
            Mikrofon va kameradan foydalanish uchun ruxsat bering. Brauzeringiz
            sozlamalarida ruxsat berishingiz mumkin.
          </p>
          <button
            onClick={initMedia}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
          >
            Qayta urunish
          </button>
        </div>
      </div>
    );
  }

  // Separate teacher/admin (main speaker) from students
  const mainSpeaker =
    participants.find((p) => p.isAdmin || p.isTeacher) || participants[0];
  const otherParticipants = participants.filter(
    (p) => p.uid !== mainSpeaker?.uid,
  );
  const isMainSpeakerSelf = mainSpeaker?.uid === user?.uid;

  return (
    <div className="h-screen bg-[#0f1729] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 bg-[#162033]/90 backdrop-blur-md border-b border-white/5 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-sm">
            ب
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">
              Jonli Efir
            </h1>
            <p className="text-[11px] text-gray-400">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              | {participants.length} qatnashuvchi
              {!wsConnected && (
                <span className="ml-2 text-yellow-500">
                  (Ulanish uzildi...)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || isTeacher) && (
            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" /> Ustoz
            </span>
          )}
          <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            JONLI
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative p-4 gap-4">
        {/* Center: Main Speaker / Screen Share */}
        <div className="flex-1 flex flex-col relative rounded-2xl overflow-hidden bg-[#1a2540] border border-white/5 shadow-2xl">
          {isScreenSharing && screenStream ? (
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : mainSpeaker ? (
            <div
              className={`w-full h-full relative flex items-center justify-center ${
                mainSpeaker.isSpeaking
                  ? "ring-4 ring-green-500/40 ring-inset rounded-2xl"
                  : ""
              }`}
            >
              {/* Main speaker video */}
              {!mainSpeaker.isVideoOff && isMainSpeakerSelf && localStream ? (
                <video
                  ref={localVideoMainRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : !mainSpeaker.isVideoOff && !isMainSpeakerSelf ? (
                <div className="w-full h-full bg-[#1a2540] flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      {mainSpeaker.displayName} kamerasi yoniq
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold shadow-2xl z-10 relative ${
                      mainSpeaker.isAdmin || mainSpeaker.isTeacher
                        ? "bg-gradient-to-br from-blue-500 to-purple-600"
                        : "bg-gray-700"
                    }`}
                  >
                    {mainSpeaker.photoURL ? (
                      <img
                        src={mainSpeaker.photoURL}
                        alt={mainSpeaker.displayName}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      mainSpeaker.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {mainSpeaker.isSpeaking && (
                    <>
                      <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping" />
                      <div className="absolute -inset-4 rounded-full border-2 border-green-400/50 animate-pulse" />
                    </>
                  )}
                </div>
              )}

              {/* Main speaker overlay info */}
              <div className="absolute bottom-6 left-6 px-4 py-2.5 bg-black/60 backdrop-blur-md rounded-xl text-sm font-medium flex items-center gap-3">
                {(mainSpeaker.isAdmin || mainSpeaker.isTeacher) && (
                  <ShieldAlert className="w-4 h-4 text-blue-400" />
                )}
                <span>
                  {isMainSpeakerSelf
                    ? `Siz (${isAdmin ? "Admin" : "Ustoz"})`
                    : mainSpeaker.displayName}
                </span>
                <div
                  className={`p-1.5 rounded-full ${
                    mainSpeaker.isMuted ? "bg-red-500/80" : "bg-green-500/80"
                  }`}
                >
                  {mainSpeaker.isMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              Kutilmoqda...
            </div>
          )}
        </div>

        {/* Right Sidebar: ALL Participants */}
        <AnimatePresence>
          {showUserList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#162033] rounded-2xl border border-white/10 flex flex-col shadow-xl overflow-hidden flex-shrink-0"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" /> Qatnashuvchilar (
                  {participants.length})
                </h2>
                <button
                  onClick={() => setShowUserList(false)}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Main Speaker at top */}
                {mainSpeaker && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                        {mainSpeaker.photoURL ? (
                          <img
                            src={mainSpeaker.photoURL}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          mainSpeaker.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium flex items-center gap-1.5 truncate">
                          {isMainSpeakerSelf ? "Siz" : mainSpeaker.displayName}
                          <ShieldAlert className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <div
                        className={`p-1 rounded-full ${
                          mainSpeaker.isMuted
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {mainSpeaker.isMuted ? (
                          <MicOff className="w-3.5 h-3.5" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div
                        className={`p-1 rounded-full ${
                          mainSpeaker.isVideoOff
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {mainSpeaker.isVideoOff ? (
                          <VideoOff className="w-3.5 h-3.5" />
                        ) : (
                          <Video className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section header for other participants */}
                {otherParticipants.length > 0 && (
                  <div className="pt-3 pb-1 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Qatnashuvchilar ({otherParticipants.length})
                  </div>
                )}

                {/* ALL other participants */}
                {otherParticipants.map((p) => {
                  const isSelf = p.uid === user?.uid;
                  return (
                    <div
                      key={p.uid}
                      className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors group ${
                        p.isSpeaking
                          ? "bg-green-500/10 border border-green-500/30"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium relative flex-shrink-0 overflow-hidden">
                          {p.photoURL ? (
                            <img
                              src={p.photoURL}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            p.displayName.charAt(0).toUpperCase()
                          )}
                          {p.isSpeaking && (
                            <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping" />
                          )}
                        </div>
                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                          {isSelf ? "Siz" : p.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div
                          className={`p-1 rounded-full ${
                            p.isMuted ? "text-red-400/70" : "text-green-400"
                          }`}
                        >
                          {p.isMuted ? (
                            <MicOff className="w-3.5 h-3.5" />
                          ) : (
                            <Mic className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div
                          className={`p-1 rounded-full ${
                            p.isVideoOff ? "text-red-400/70" : "text-green-400"
                          }`}
                        >
                          {p.isVideoOff ? (
                            <VideoOff className="w-3.5 h-3.5" />
                          ) : (
                            <Video className="w-3.5 h-3.5" />
                          )}
                        </div>
                        {(isAdmin || isTeacher) &&
                          !isSelf &&
                          !p.isAdmin &&
                          !p.isTeacher && (
                            <button
                              onClick={() => handleKickUser(p.uid)}
                              className="p-1 text-red-400/50 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                              title="Chiqarish"
                            >
                              <PhoneOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty state when no other participants */}
                {otherParticipants.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Hali hech kim qo'shilmagan
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="h-20 bg-[#162033]/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-between px-8 z-20 flex-shrink-0">
        <div className="w-48 hidden md:block text-sm text-gray-400 font-medium">
          {new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        <div className="flex items-center gap-4 mx-auto">
          {/* Mic toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
            title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Camera toggle */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isVideoOff
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
            title={isVideoOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
          >
            {isVideoOff ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </button>

          {/* Screen share (admin/teacher only) */}
          {(isAdmin || isTeacher) && (
            <button
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isScreenSharing
                  ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              title="Ekranni ulashish"
            >
              <MonitorUp className="w-5 h-5" />
            </button>
          )}

          {/* End/Leave */}
          {isAdmin || isTeacher ? (
            <button
              onClick={handleEndClass}
              className="px-6 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold flex items-center gap-2 ml-4 transition-all shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-5 h-5" /> Darsni tugatish
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="w-16 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center ml-4 transition-all shadow-lg shadow-red-500/20"
              title="Chiqish"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="w-48 flex items-center justify-end">
          {!showUserList && (
            <button
              onClick={() => setShowUserList(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-all text-sm font-medium"
            >
              <Users className="w-4 h-4" />
              <span>{participants.length}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
