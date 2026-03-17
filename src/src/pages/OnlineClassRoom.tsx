// OnlineClassRoom.tsx - To'liq ishlaydigan versiya
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
}

interface WebSocketMessage {
  type: string;
  payload: any;
  to?: string;
  from?: string;
  roomId?: string;
}

export function OnlineClassRoom() {
  const { user, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();
  const { classId } = useParams(); // Get class ID from URL
  const roomId = classId || "default-class"; // Use class ID as room ID

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
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );

  // Video elements refs
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Audio context for speaking detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs for sync
  const onlineClassRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const isMutedRef = useRef(true);
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
    participantsRef.current = participants;
  }, [participants]);

  // WebSocket connection setup
  useEffect(() => {
    if (!user || !initialized) return;

    const connectWebSocket = () => {
      const ws = new WebSocket("ws://localhost:3001");

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setWsConnected(true);

        // Send join message with room ID
        ws.send(
          JSON.stringify({
            type: "join",
            roomId: roomId,
            payload: {
              uid: user.uid,
              metadata: {
                displayName:
                  user.displayName || user.email?.split("@")[0] || "User",
                photoURL: user.photoURL,
                isAdmin,
                isTeacher,
              },
            },
          }),
        );
      };

      ws.onmessage = async (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          switch (data.type) {
            case "user-list":
              console.log("Active users in room:", data.payload.users);
              break;

            case "offer":
              await handleOffer(data.payload);
              break;

            case "answer":
              await handleAnswer(data.payload);
              break;

            case "ice-candidate":
              await handleIceCandidate(data.payload);
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

            case "user-left":
              handleUserLeft(data.payload);
              break;
          }
        } catch (error) {
          console.error("Error handling message:", error);
        }
      };

      ws.onclose = () => {
        console.log("❌ WebSocket disconnected");
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
            roomId: roomId,
            payload: { uid: user.uid },
          }),
        );
        wsRef.current.close();
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [user, initialized, roomId]);

  // Handle user left
  const handleUserLeft = (payload: any) => {
    const { uid } = payload;

    // Remove remote stream
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(uid);
      return newMap;
    });

    // Close peer connection
    const pc = peerConnectionsRef.current.get(uid);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(uid);
    }

    // Update participants list
    setParticipants((prev) => prev.filter((p) => p.uid !== uid));
  };

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback(
    (targetUid: string) => {
      if (!localStream) return null;

      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
      };

      const pc = new RTCPeerConnection(configuration);

      // Add local stream tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === 1) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              roomId: roomId,
              payload: {
                candidate: event.candidate,
                from: user?.uid,
                to: targetUid,
              },
              to: targetUid,
            }),
          );
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log(`Received track from ${targetUid}`);
        const [remoteStream] = event.streams;

        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(targetUid, remoteStream);
          return newMap;
        });

        // Attach to video element
        setTimeout(() => {
          const videoElement = videoRefs.current.get(targetUid);
          if (videoElement && remoteStream) {
            videoElement.srcObject = remoteStream;
          }
        }, 100);
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`Connection with ${targetUid}:`, pc.connectionState);
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          peerConnectionsRef.current.delete(targetUid);
          setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            newMap.delete(targetUid);
            return newMap;
          });
        }
      };

      peerConnectionsRef.current.set(targetUid, pc);
      return pc;
    },
    [localStream, user, roomId],
  );

  // Handle incoming offer
  const handleOffer = async (payload: any) => {
    const { from, offer, to } = payload;

    if (!localStream || !user) return;

    console.log(`Received offer from ${from}`);

    let pc = peerConnectionsRef.current.get(from);
    if (!pc) {
      pc = createPeerConnection(from);
    }

    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (wsRef.current?.readyState === 1) {
          wsRef.current.send(
            JSON.stringify({
              type: "answer",
              roomId: roomId,
              payload: {
                answer: pc.localDescription,
                from: user.uid,
                to: from,
              },
              to: from,
            }),
          );
        }
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    }
  };

  // Handle incoming answer
  const handleAnswer = async (payload: any) => {
    const { from, answer } = payload;
    const pc = peerConnectionsRef.current.get(from);

    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Answer set for ${from}`);
      } catch (error) {
        console.error("Error setting answer:", error);
      }
    }
  };

  // Handle incoming ICE candidate
  const handleIceCandidate = async (payload: any) => {
    const { from, candidate } = payload;
    const pc = peerConnectionsRef.current.get(from);

    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    }
  };

  // Handle participant media toggles
  const handleParticipantMicToggle = (payload: any) => {
    const { from, isMuted: muted } = payload;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === from ? { ...p, isMuted: muted } : p)),
    );
  };

  const handleParticipantCameraToggle = (payload: any) => {
    const { from, isVideoOff: videoOff } = payload;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === from ? { ...p, isVideoOff: videoOff } : p)),
    );
  };

  const handleParticipantScreenToggle = (payload: any) => {
    const { from, isScreenSharing: sharing } = payload;
    console.log(`${from} screen sharing:`, sharing);
  };

  // Initiate calls to all participants when local stream is ready
  useEffect(() => {
    if (!localStream || !wsConnected || !user || !participants.length) return;

    const initiateCalls = async () => {
      for (const participant of participants) {
        if (participant.uid === user.uid) continue;

        // Skip if already connected
        if (peerConnectionsRef.current.has(participant.uid)) continue;

        console.log(`Initiating call to ${participant.uid}`);

        const pc = createPeerConnection(participant.uid);
        if (pc) {
          try {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);

            if (wsRef.current?.readyState === 1) {
              wsRef.current.send(
                JSON.stringify({
                  type: "offer",
                  roomId: roomId,
                  payload: {
                    offer: pc.localDescription,
                    from: user.uid,
                    to: participant.uid,
                  },
                  to: participant.uid,
                }),
              );
            }
          } catch (error) {
            console.error(
              `Error creating offer for ${participant.uid}:`,
              error,
            );
          }
        }
      }
    };

    initiateCalls();
  }, [
    localStream,
    wsConnected,
    user,
    participants,
    createPeerConnection,
    roomId,
  ]);

  // Assign streams to video elements
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
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
                isMuted: isSelf ? isMutedRef.current : (state.isMuted ?? true),
                isVideoOff: isSelf ? isVideoOff : (state.isVideoOff ?? true),
                isAdmin: state.isAdmin ?? false,
                isTeacher: state.isTeacher ?? false,
                isSpeaking: state.isSpeaking ?? false,
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
              isVideoOff,
              isAdmin: isAdmin,
              isTeacher: isTeacher,
              isSpeaking: false,
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
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
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

      toast.success("Media qurilmalariga ulandi");
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
        if (wsRef.current?.readyState === 1) {
          wsRef.current.send(
            JSON.stringify({
              type: "screen-toggle",
              roomId: roomId,
              payload: {
                from: user?.uid,
                isScreenSharing: false,
              },
            }),
          );
        }
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Add screen share track to peer connections
      peerConnectionsRef.current.forEach((pc, targetUid) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      // Notify others
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(
          JSON.stringify({
            type: "screen-toggle",
            roomId: roomId,
            payload: {
              from: user?.uid,
              isScreenSharing: true,
            },
          }),
        );
      }

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);

        if (wsRef.current?.readyState === 1) {
          wsRef.current.send(
            JSON.stringify({
              type: "screen-toggle",
              roomId: roomId,
              payload: {
                from: user?.uid,
                isScreenSharing: false,
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

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();

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
    if (wsRef.current?.readyState === 1 && wsConnected) {
      wsRef.current.send(
        JSON.stringify({
          type: "mic-toggle",
          roomId: roomId,
          payload: {
            from: user.uid,
            isMuted,
          },
        }),
      );

      wsRef.current.send(
        JSON.stringify({
          type: "camera-toggle",
          roomId: roomId,
          payload: {
            from: user.uid,
            isVideoOff,
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
    roomId,
  ]);

  const handleLeave = async () => {
    if (!user) return;

    // Notify others
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(
        JSON.stringify({
          type: "leave",
          roomId: roomId,
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
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(
        JSON.stringify({
          type: "class-ended",
          roomId: roomId,
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

      {/* Main Content - Grid layout for all participants */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
          {/* Local video */}
          <div className="relative aspect-video bg-[#1a2540] rounded-xl overflow-hidden border border-white/10 group">
            {!isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Siz</p>
                </div>
              </div>
            )}

            {/* Overlay info */}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs flex items-center gap-2">
              <span>Siz</span>
              <div
                className={`p-1 rounded-full ${isMuted ? "bg-red-500/80" : "bg-green-500/80"}`}
              >
                {isMuted ? (
                  <MicOff className="w-3 h-3" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
              </div>
            </div>
          </div>

          {/* Remote videos */}
          {participants
            .filter((p) => p.uid !== user?.uid)
            .map((participant) => (
              <div
                key={participant.uid}
                className={`relative aspect-video bg-[#1a2540] rounded-xl overflow-hidden border border-white/10 group ${
                  participant.isSpeaking ? "ring-2 ring-green-500" : ""
                }`}
              >
                {!participant.isVideoOff ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(participant.uid, el);
                        const stream = remoteStreams.get(participant.uid);
                        if (stream) {
                          el.srcObject = stream;
                        }
                      } else {
                        videoRefs.current.delete(participant.uid);
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      {participant.photoURL ? (
                        <img
                          src={participant.photoURL}
                          alt={participant.displayName}
                          className="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-700 mx-auto mb-2 flex items-center justify-center text-2xl font-bold">
                          {participant.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <p className="text-gray-400 text-sm truncate max-w-[120px]">
                        {participant.displayName}
                      </p>
                    </div>
                  </div>
                )}

                {/* Overlay info */}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs flex items-center gap-2">
                  <span className="truncate max-w-[80px]">
                    {participant.displayName}
                  </span>
                  <div
                    className={`p-1 rounded-full ${participant.isMuted ? "bg-red-500/80" : "bg-green-500/80"}`}
                  >
                    {participant.isMuted ? (
                      <MicOff className="w-3 h-3" />
                    ) : (
                      <Mic className="w-3 h-3" />
                    )}
                  </div>
                  {(isAdmin || isTeacher) &&
                    !participant.isAdmin &&
                    !participant.isTeacher && (
                      <button
                        onClick={() => handleKickUser(participant.uid)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                        title="Chiqarish"
                      >
                        <PhoneOff className="w-3 h-3" />
                      </button>
                    )}
                </div>

                {/* Speaking indicator */}
                {participant.isSpeaking && (
                  <div className="absolute inset-0 border-2 border-green-500 rounded-xl pointer-events-none" />
                )}
              </div>
            ))}

          {/* Empty state if no participants */}
          {participants.length <= 1 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Boshqa qatnashuvchilar yo'q</p>
              <p className="text-sm">Bog'lanishni kuting...</p>
            </div>
          )}
        </div>
      </div>

      {/* Screen share overlay */}
      {isScreenSharing && screenStream && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg shadow-2xl"
            />
            <button
              onClick={toggleScreenShare}
              className="absolute top-4 right-4 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium flex items-center gap-2"
            >
              <MonitorUp className="w-4 h-4" /> Ekranni yopish
            </button>
          </div>
        </div>
      )}

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
          <button
            onClick={() => setShowUserList(!showUserList)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-all text-sm font-medium"
          >
            <Users className="w-4 h-4" />
            <span>{participants.length}</span>
          </button>
        </div>
      </div>

      {/* Participants list sidebar */}
      <AnimatePresence>
        {showUserList && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed right-0 top-14 bottom-20 w-80 bg-[#162033] border-l border-white/10 flex flex-col shadow-xl overflow-hidden"
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
              {participants.map((p) => {
                const isSelf = p.uid === user?.uid;
                return (
                  <div
                    key={p.uid}
                    className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors group ${
                      p.isSpeaking
                        ? "bg-green-500/10 border border-green-500/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium relative flex-shrink-0 overflow-hidden">
                        {p.photoURL ? (
                          <img
                            src={p.photoURL}
                            alt=""
                            className="w-full h-full object-cover"
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
                        {(p.isAdmin || p.isTeacher) && (
                          <ShieldAlert className="w-3 h-3 ml-1 inline text-blue-400" />
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div
                        className={`p-1 rounded-full ${p.isMuted ? "text-red-400/70" : "text-green-400"}`}
                      >
                        {p.isMuted ? (
                          <MicOff className="w-3.5 h-3.5" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div
                        className={`p-1 rounded-full ${p.isVideoOff ? "text-red-400/70" : "text-green-400"}`}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
