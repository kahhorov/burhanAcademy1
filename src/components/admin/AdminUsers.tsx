import React, { useMemo, useState } from 'react';
import {
  Search,
  Crown,
  Ban,
  BookOpen,
  X,
  MinusCircle,
  AlertTriangle,
  Radio,
  ShieldAlert } from
'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
interface AdminUsersProps {
  users: any[];
  courses: any[];
  fetchData: () => void;
}
export function AdminUsers({ users, courses, fetchData }: AdminUsersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const usersPerPage = 20;
  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
      (u.displayName?.toLowerCase() || '').includes(
        searchTerm.toLowerCase()
      ) || (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );
  const paidCourses = courses.filter((c) => c.isPaid === true);
  const toggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      });
      toast.success(
        currentStatus ?
        'Foydalanuvchi blokdan chiqarildi' :
        'Foydalanuvchi bloklandi'
      );
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const grantPremium = async (userId: string) => {
    try {
      const now = new Date();
      const expiresAt = new Date(now.setMonth(now.getMonth() + 1));
      await updateDoc(doc(db, 'users', userId), {
        isPremium: true,
        premiumExpiresAt: expiresAt
      });
      toast.success('Foydalanuvchiga premium tarif berildi');
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const revokePremium = async (userId: string) => {
    if (!window.confirm('Premiumni olib tashlashni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isPremium: false,
        premiumExpiresAt: null
      });
      toast.success('Premium tarif olib tashlandi');
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const toggleOnlineClassAccess = async (
  userId: string,
  currentStatus: boolean) =>
  {
    try {
      await updateDoc(doc(db, 'users', userId), {
        hasOnlineClassAccess: !currentStatus
      });
      toast.success(
        !currentStatus ?
        'Online darsga ruxsat berildi' :
        'Online dars ruxsati olib tashlandi'
      );
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const openAssignModal = (user: any) => {
    setSelectedUser(user);
    setSelectedCourseId('');
    setAssignModalOpen(true);
  };
  const handleAssignCourse = async () => {
    if (!selectedCourseId || !selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        purchasedCourses: arrayUnion(selectedCourseId)
      });
      toast.success('Kurs muvaffaqiyatli biriktirildi');
      setSelectedCourseId('');
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const handleRevokeCourse = async (userId: string, courseId: string) => {
    if (!window.confirm('Kursni olib tashlashni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        purchasedCourses: arrayRemove(courseId)
      });
      toast.success('Kurs olib tashlandi');
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Foydalanuvchilar ({filteredUsers.length})
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Qidirish..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111827] text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
              <th className="p-4 font-medium">Foydalanuvchi</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Holati</th>
              <th className="p-4 font-medium text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paginatedUsers.map((u) =>
            <tr
              key={u.id}
              className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${u.isBlocked ? 'opacity-50' : ''}`}>

                <td className="p-4">
                  <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {u.displayName || 'Ismsiz'}
                    {u.isTeacher &&
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Ustoz
                      </span>
                  }
                  </div>
                </td>
                <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">
                  {u.email}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {u.isBlocked ?
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Bloklangan
                      </span> :
                  u.isPremium ?
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Premium
                      </span> :

                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        Oddiy
                      </span>
                  }
                    {u.hasOnlineClassAccess &&
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Online Dars
                      </span>
                  }
                  </div>
                  {u.purchasedCourses && u.purchasedCourses.length > 0 &&
                <div className="mt-2 flex flex-wrap gap-1">
                      {u.purchasedCourses.map((cid: string) => {
                    const c = courses.find((course) => course.id === cid);
                    return c ?
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">

                            {c.title}
                            <button
                        onClick={() => handleRevokeCourse(u.id, cid)}
                        className="hover:text-red-500 ml-1">

                              <X className="w-3 h-3" />
                            </button>
                          </span> :
                    null;
                  })}
                    </div>
                }
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    {!u.isBlocked &&
                  <>
                        <button
                      onClick={() =>
                      toggleOnlineClassAccess(
                        u.id,
                        u.hasOnlineClassAccess
                      )
                      }
                      className={`p-2 rounded-lg ${u.hasOnlineClassAccess ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                      title="Online dars ruxsati">

                          <Radio className="w-4 h-4" />
                        </button>
                        {u.isPremium ?
                    <button
                      onClick={() => revokePremium(u.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Premiumni olib tashlash">

                            <MinusCircle className="w-4 h-4" />
                          </button> :

                    <button
                      onClick={() => grantPremium(u.id)}
                      className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"
                      title="Premium berish">

                            <Crown className="w-4 h-4" />
                          </button>
                    }
                        <button
                      onClick={() => openAssignModal(u)}
                      className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg"
                      title="Kurs berish">

                          <BookOpen className="w-4 h-4" />
                        </button>
                      </>
                  }
                    <button
                    onClick={() => toggleBlock(u.id, u.isBlocked)}
                    className={`p-2 rounded-lg ${u.isBlocked ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                    title={u.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}>

                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {paginatedUsers.length === 0 &&
            <tr>
                <td
                colSpan={4}
                className="p-8 text-center text-gray-500 dark:text-gray-400">

                  Foydalanuvchilar topilmadi
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      {totalPages > 1 &&
      <div className="flex justify-center gap-2 mt-6">
          {Array.from({
          length: totalPages
        }).map((_, i) =>
        <button
          key={i}
          onClick={() => setCurrentPage(i + 1)}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-teal-600 text-white' : 'bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>

              {i + 1}
            </button>
        )}
        </div>
      }

      <AnimatePresence>
        {assignModalOpen && selectedUser &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) =>
          e.target === e.currentTarget && setAssignModalOpen(false)
          }>

            <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            className="bg-white dark:bg-[#111827] rounded-2xl p-6 w-full max-w-md border border-gray-100 dark:border-gray-800">

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Kurs biriktirish
                </h3>
                <button
                onClick={() => setAssignModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400">

                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Foydalanuvchi:
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedUser.displayName || selectedUser.email}
                </p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kursni tanlang (faqat pullik kurslar)
                </label>
                <select
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}>

                  <option value="">Tanlang...</option>
                  {paidCourses.map((c) =>
                <option
                  key={c.id}
                  value={c.id}
                  disabled={selectedUser.purchasedCourses?.includes(c.id)}>

                      {c.title}{' '}
                      {selectedUser.purchasedCourses?.includes(c.id) ?
                  '(Olingan)' :
                  ''}
                    </option>
                )}
                </select>
                {selectedCourse &&
              <p className="mt-2 text-sm font-medium text-teal-600 dark:text-teal-400">
                    Narxi:{' '}
                    {selectedCourse.isPaid ?
                `${new Intl.NumberFormat('uz-UZ').format(selectedCourse.price)} so'm` :
                'Bepul'}
                  </p>
              }
              </div>
              <button
              onClick={handleAssignCourse}
              disabled={!selectedCourseId}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors">

                Berish
              </button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}