import React, { useEffect, useState } from 'react';
import { Radio, Users, Settings, Play, Square, Eye } from 'lucide-react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
interface AdminOnlineClassProps {
  users: any[];
}
export function AdminOnlineClass({ users }: AdminOnlineClassProps) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    isActive: false,
    isPaid: false,
    price: 100000,
    limit: 20,
    joinedUsers: [] as string[],
    kickedUsers: [] as string[],
    participantStates: {} as Record<string, any>
  });
  // Use onSnapshot for real-time updates
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
        {
          merge: true
        }
      );
      toast.success('Sozlamalar saqlandi');
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const toggleClassStatus = async () => {
    const newStatus = !settings.isActive;
    try {
      await setDoc(
        doc(db, 'settings', 'onlineClass'),
        {
          isActive: newStatus,
          joinedUsers: newStatus ? [] : settings.joinedUsers,
          kickedUsers: newStatus ? [] : settings.kickedUsers,
          participantStates: newStatus ? {} : {},
          chatMessages: newStatus ? [] : []
        },
        {
          merge: true
        }
      );
      toast.success(
        newStatus ? 'Online dars boshlandi!' : 'Online dars yakunlandi'
      );
      if (newStatus) {
        navigate('/live-chat');
      }
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  // Build joined users list with real-time participant state data
  const joinedUsersList = settings.joinedUsers.map((uid) => {
    const firestoreUser = users.find((u) => u.id === uid);
    const participantState = settings.participantStates[uid] || {};
    return {
      id: uid,
      displayName:
      participantState.displayName ||
      firestoreUser?.displayName ||
      firestoreUser?.email?.split('@')[0] ||
      'Foydalanuvchi',
      email: firestoreUser?.email || '',
      photoURL: participantState.photoURL || firestoreUser?.photoURL || '',
      isMuted: participantState.isMuted ?? true,
      isVideoOff: participantState.isVideoOff ?? true,
      isTeacher:
      participantState.isTeacher || firestoreUser?.isTeacher || false,
      isAdmin: participantState.isAdmin || firestoreUser?.isAdmin || false
    };
  });
  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-red-500" /> Online Dars Boshqaruvi
        </h2>
        <div className="flex items-center gap-3">
          {settings.isActive &&
          <button
            onClick={() => navigate('/live-chat')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors">

              <Eye className="w-4 h-4" /> Efirga kirish
            </button>
          }
          <button
            onClick={toggleClassStatus}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-colors ${settings.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>

            {settings.isActive ?
            <>
                <Square className="w-4 h-4 fill-current" /> Darsni yakunlash
              </> :

            <>
                <Play className="w-4 h-4 fill-current" /> Darsni boshlash
              </>
            }
          </button>
        </div>
      </div>

      {/* Live status indicator */}
      {settings.isActive &&
      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-700 dark:text-red-400 font-medium text-sm">
            Jonli efir faol — {settings.joinedUsers.length} ta qatnashuvchi
            onlayn
          </span>
        </div>
      }

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 h-fit">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Settings className="w-5 h-5" /> Sozlamalar
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Maksimal qatnashuvchilar soni
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
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

            </div>
            <div className="flex items-center gap-3 pt-2">
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
                className="w-5 h-5 text-teal-600 rounded focus:ring-teal-600" />

              <label
                htmlFor="isPaid"
                className="text-sm font-medium text-gray-700 dark:text-gray-300">

                Online dars pullik
              </label>
            </div>
            {settings.isPaid &&
            <motion.div
              initial={{
                opacity: 0,
                height: 0
              }}
              animate={{
                opacity: 1,
                height: 'auto'
              }}>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 mt-2">
                  Oylik narxi (so'm)
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
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

              </motion.div>
            }
            <button
              onClick={handleSaveSettings}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors mt-4">

              Sozlamalarni saqlash
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Users className="w-5 h-5" /> Qatnashuvchilar
            </h3>
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
              {settings.joinedUsers.length} / {settings.limit}
            </span>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {joinedUsersList.map((u) =>
            <div
              key={u.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">

                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                  {u.photoURL ?
                <img
                  src={u.photoURL}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none';
                  }} /> :


                u.displayName?.charAt(0) || 'U'
                }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {u.displayName || 'Ismsiz'}
                    {(u.isTeacher || u.isAdmin) &&
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                        {u.isAdmin ? 'Admin' : 'Ustoz'}
                      </span>
                  }
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                  className={`w-2 h-2 rounded-full ${u.isMuted ? 'bg-red-400' : 'bg-green-400'}`}
                  title={u.isMuted ? "Mikrofon o'chiq" : 'Mikrofon yoniq'} />

                  <div
                  className={`w-2 h-2 rounded-full ${u.isVideoOff ? 'bg-red-400' : 'bg-green-400'}`}
                  title={u.isVideoOff ? "Kamera o'chiq" : 'Kamera yoniq'} />

                </div>
              </div>
            )}
            {joinedUsersList.length === 0 &&
            <div className="text-center py-8 text-gray-500">
                Hali hech kim qo'shilmagan
              </div>
            }
          </div>
        </div>
      </div>
    </div>);

}