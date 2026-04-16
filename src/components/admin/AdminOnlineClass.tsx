import React, { useEffect, useState, useRef } from 'react';
import { Radio, Users, Settings, Play, Square, Eye } from 'lucide-react';
import { collection, deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const createSessionId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}`;

interface AdminOnlineClassProps {
  users: any[];
}

interface UserInfo {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  isAdmin?: boolean;
  isTeacher?: boolean;
}

export function AdminOnlineClass({ users: propUsers }: AdminOnlineClassProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    isActive: false,
    isPaid: false,
    price: 100000,
    limit: 20,
    joinedUsers: [] as string[],
    kickedUsers: [] as string[],
    participantStates: {} as Record<string, any>
  });

  const [usersMap, setUsersMap] = useState<Map<string, UserInfo>>(new Map());
  const usersLoadedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const newMap = new Map<string, UserInfo>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          newMap.set(doc.id, {
            id: doc.id,
            displayName: data.displayName || data.email?.split('@')[0] || 'Foydalanuvchi',
            email: data.email || '',
            photoURL: data.photoURL || '',
            isAdmin: data.isAdmin || false,
            isTeacher: data.isTeacher || false,
          });
        });
        setUsersMap(newMap);
        usersLoadedRef.current = true;
      },
      (error) => {
        console.warn('Users listener error:', error);
        if (!usersLoadedRef.current && propUsers.length > 0) {
          const fallbackMap = new Map<string, UserInfo>();
          propUsers.forEach((u) => {
            fallbackMap.set(u.id, {
              id: u.id,
              displayName: u.displayName || u.email?.split('@')[0] || 'Foydalanuvchi',
              email: u.email || '',
              photoURL: u.photoURL || '',
              isAdmin: u.isAdmin || false,
              isTeacher: u.isTeacher || false,
            });
          });
          setUsersMap(fallbackMap);
          usersLoadedRef.current = true;
        }
      }
    );
    return () => unsubscribe();
  }, [propUsers]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'onlineClass'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            isActive: data.isActive || false,
            isPaid: data.isPaid || false,
            price: data.price || 100000,
            limit: data.limit || 20,
            joinedUsers: data.joinedUsers || [],
            kickedUsers: data.kickedUsers || [],
            participantStates: data.participantStates || {}
          });
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await setDoc(
        doc(db, 'settings', 'onlineClass'),
        {
          isPaid: settings.isPaid,
          price: settings.price,
          limit: settings.limit
        },
        { merge: true }
      );
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t("error_occurred"));
    }
  };

  const toggleClassStatus = async () => {
    const newStatus = !settings.isActive;
    try {
      await setDoc(
        doc(db, 'settings', 'onlineClass'),
        {
          isActive: newStatus,
          joinedUsers: [],
          kickedUsers: [],
          participantStates: {},
          chatMessages: [],
          sessionId: newStatus ? createSessionId() : deleteField(),
          screenSharerId: deleteField(),
          screenShareStreamId: deleteField(),
          signals: deleteField()
        },
        { merge: true }
      );
      toast.success(
        newStatus ? t("online_class_started") : t("online_class_ended")
      );
      if (newStatus) {
        navigate('/live-chat');
      }
    } catch (error) {
      toast.error(t("error_occurred"));
    }
  };

  const participantIds = Array.from(
    new Set([...settings.joinedUsers, ...Object.keys(settings.participantStates)])
  );

  const joinedUsersList = participantIds.map((uid) => {
    const firestoreUser = usersMap.get(uid) || { id: uid, displayName: '', email: '', photoURL: '' };
    const participantState = settings.participantStates[uid] || {};
    
    let displayName = participantState.displayName;
    if (!displayName) {
      displayName = firestoreUser?.displayName || 
                    firestoreUser?.email?.split('@')[0] || 
                    'Foydalanuvchi';
    }
    
    return {
      id: uid,
      displayName,
      email: firestoreUser?.email || '',
      photoURL: participantState.photoURL || firestoreUser?.photoURL || '',
      isMuted: participantState.isMuted ?? true,
      isVideoOff: participantState.isVideoOff ?? true,
      isTeacher: participantState.isTeacher || firestoreUser?.isTeacher || false,
      isAdmin: participantState.isAdmin || firestoreUser?.isAdmin || false
    };
  });

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" /> {t("online_class_management")}
        </h2>
        <div className="flex items-center gap-2 sm:gap-3">
          {settings.isActive && (
            <button
              onClick={() => navigate('/live-chat')}
              className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors text-sm"
            >
              <Eye className="w-4 h-4" /> {t("join_stream")}
            </button>
          )}
          <button
            onClick={toggleClassStatus}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-white transition-colors text-sm ${
              settings.isActive 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {settings.isActive ? (
              <>
                <Square className="w-4 h-4 fill-current" /> {t("end_class")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> {t("start_class")}
              </>
            )}
          </button>
        </div>
      </div>

      {settings.isActive && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3">
          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400 font-medium text-xs sm:text-sm">
            {t("live_stream_active")} — {settings.joinedUsers.length} {t("students_count")} {t("online")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 h-fit">
          <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" /> {t("settings")}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                {t("max_participants")}
              </label>
              <input
                type="number"
                value={settings.limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    limit: Number(e.target.value)
                  })
                }
                className="w-full p-2 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
              <input
                type="checkbox"
                id="isPaid"
                checked={settings.isPaid}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    isPaid: e.target.checked
                  })
                }
                className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 rounded focus:ring-teal-600"
              />
              <label
                htmlFor="isPaid"
                className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("online_class_paid")}
              </label>
            </div>
            {settings.isPaid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 sm:mt-3"
              >
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  {t("monthly_price")}
                </label>
                <input
                  type="number"
                  value={settings.price}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      price: Number(e.target.value)
                    })
                  }
                  className="w-full p-2 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </motion.div>
            )}
            <button
              onClick={handleSaveSettings}
              className="w-full py-2 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg sm:rounded-xl font-medium transition-colors text-sm sm:text-base mt-2 sm:mt-4"
            >
              {t("save")}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" /> {t("participants")}
            </h3>
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold">
              {joinedUsersList.length} / {settings.limit}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2">
            {joinedUsersList.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl border border-gray-100 dark:border-gray-800"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold overflow-hidden flex-shrink-0 text-sm sm:text-base">
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    u.displayName?.charAt(0) || 'U'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate flex items-center gap-1 sm:gap-2">
                    {u.displayName || t("unnamed")}
                    {(u.isTeacher || u.isAdmin) && (
                      <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                        {u.isAdmin ? 'Admin' : t("teacher")}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  <div
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                      u.isMuted ? 'bg-red-400' : 'bg-green-400'
                    }`}
                    title={u.isMuted ? t("mic_off") : t("mic_on")}
                  />
                  <div
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                      u.isVideoOff ? 'bg-red-400' : 'bg-green-400'
                    }`}
                    title={u.isVideoOff ? t("camera_off") : t("camera_on")}
                  />
                </div>
              </div>
            ))}
            {joinedUsersList.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm">
                {t("no_participants")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
