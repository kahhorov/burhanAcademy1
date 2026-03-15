import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  UserCheck,
  Sparkles,
  AlertTriangle,
  Search,
  CheckCircle } from
'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where,
  getDocs } from
'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
interface AdminTeachersProps {
  teachers: any[];
  users: any[];
  fetchData: () => void;
}
export function AdminTeachers({
  teachers,
  users,
  fetchData
}: AdminTeachersProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    userId?: string;
  } | null>(null);
  // Search user state
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    photoUrl: '',
    experience: '',
    userId: '',
    bio: {
      uz: '',
      ru: '',
      en: ''
    },
    specialization: {
      uz: '',
      ru: '',
      en: ''
    }
  });
  const handleSearchUser = async () => {
    if (!searchEmail) return;
    setIsSearching(true);
    setFoundUser(null);
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', searchEmail)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userData = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        };
        setFoundUser(userData);
        setFormData((prev) => ({
          ...prev,
          name: userData.displayName || '',
          photoUrl: userData.photoURL || '',
          userId: userData.id
        }));
        toast.success('Foydalanuvchi topildi!');
      } else {
        toast.error('Bunday email bilan foydalanuvchi topilmadi.');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      toast.error('Qidirishda xatolik yuz berdi.');
    } finally {
      setIsSearching(false);
    }
  };
  const openModal = (teacher: any = null) => {
    setSearchEmail('');
    setFoundUser(null);
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({
        ...teacher
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        photoUrl: '',
        experience: '',
        userId: '',
        bio: {
          uz: '',
          ru: '',
          en: ''
        },
        specialization: {
          uz: '',
          ru: '',
          en: ''
        }
      });
    }
    setIsModalOpen(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && !formData.userId) {
      toast.error('Iltimos, avval foydalanuvchini email orqali toping.');
      return;
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'teachers', editingId), formData);
        toast.success("O'qituvchi yangilandi");
      } else {
        // 1. Create teacher profile
        await addDoc(collection(db, 'teachers'), formData);
        // 2. Update user role to isTeacher: true
        if (formData.userId) {
          await updateDoc(doc(db, 'users', formData.userId), {
            isTeacher: true
          });
        }
        toast.success("O'qituvchi yaratildi va rol berildi 🎉");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Xatolik yuz berdi');
    }
  };
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      // 1. Delete teacher profile
      await deleteDoc(doc(db, 'teachers', deleteConfirm.id));
      // 2. Revoke teacher role if userId exists
      if (deleteConfirm.userId) {
        await updateDoc(doc(db, 'users', deleteConfirm.userId), {
          isTeacher: false
        });
      }
      toast.success("O'chirildi va rol olib tashlandi");
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Xatolik yuz berdi');
    }
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            O'qituvchilar
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {teachers.length} ta o'qituvchi
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-colors">

          <Plus className="w-4 h-4" /> O'qituvchi qo'shish
        </button>
      </div>

      <div className="space-y-4">
        {teachers.map((teacher) =>
        <div
          key={teacher.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111827] hover:shadow-md transition-all group">

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg overflow-hidden flex-shrink-0">
                {teacher.photoUrl ?
              <img
                src={teacher.photoUrl}
                alt=""
                className="w-full h-full object-cover" /> :


              teacher.name?.charAt(0) || 'T'
              }
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {teacher.name}
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] rounded-full uppercase tracking-wider">
                    Ustoz
                  </span>
                </h3>
                <p className="text-sm text-gray-500">
                  {teacher.experience} tajriba •{' '}
                  {typeof teacher.specialization === 'object' ?
                teacher.specialization?.uz :
                teacher.specialization}
                </p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
              onClick={() => openModal(teacher)}
              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">

                <Edit className="w-5 h-5" />
              </button>
              <button
              onClick={() =>
              setDeleteConfirm({
                id: teacher.id,
                name: teacher.name,
                userId: teacher.userId
              })
              }
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">

                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) =>
          e.target === e.currentTarget && setIsModalOpen(false)
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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ?
                  "O'qituvchini tahrirlash" :
                  "Yangi o'qituvchi qo'shish"}
                  </h3>
                </div>
                <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400">

                  <X className="w-5 h-5" />
                </button>
              </div>

              {!editingId &&
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    1. Foydalanuvchini email orqali toping
                  </label>
                  <div className="flex gap-2">
                    <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Foydalanuvchi emaili..."
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                    <button
                  type="button"
                  onClick={handleSearchUser}
                  disabled={isSearching || !searchEmail}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2">

                      {isSearching ?
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :

                  <Search className="w-5 h-5" />
                  }
                      Qidirish
                    </button>
                  </div>
                  {foundUser &&
              <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Foydalanuvchi topildi:{' '}
                      {foundUser.displayName || foundUser.email}
                    </div>
              }
                </div>
            }

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    📷 O'qituvchi rasmi (URL)
                  </label>
                  <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    photoUrl: e.target.value
                  })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Ism
                    </label>
                    <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value
                    })
                    }
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Tajriba
                    </label>
                    <input
                    type="text"
                    required
                    value={formData.experience}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      experience: e.target.value
                    })
                    }
                    placeholder="Masalan: 5 yil"
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                    Mutaxassislik
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['uz', 'ru', 'en'] as const).map((lang) =>
                  <div key={lang}>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          {lang}
                        </label>
                        <input
                      type="text"
                      required
                      value={formData.specialization[lang]}
                      onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialization: {
                          ...formData.specialization,
                          [lang]: e.target.value
                        }
                      })
                      }
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-600" />

                      </div>
                  )}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                    Bio
                  </h4>
                  <div className="space-y-3">
                    {(['uz', 'ru', 'en'] as const).map((lang) =>
                  <div key={lang}>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          {lang}
                        </label>
                        <textarea
                      required
                      value={formData.bio[lang]}
                      onChange={(e) =>
                      setFormData({
                        ...formData,
                        bio: {
                          ...formData.bio,
                          [lang]: e.target.value
                        }
                      })
                      }
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm outline-none resize-none focus:ring-2 focus:ring-teal-600"
                      rows={2} />

                      </div>
                  )}
                  </div>
                </div>

                <button
                type="submit"
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors">

                  {editingId ? 'Yangilash' : 'Saqlash'} ✨
                </button>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm &&
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirm(null)}>

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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-md border border-gray-100 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  O'qituvchini o'chirish
                </h3>
              </div>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                "{deleteConfirm.name}" ismli o'qituvchini o'chirishni
                tasdiqlaysizmi?
              </p>
              <div className="flex gap-3">
                <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">

                  Bekor qilish
                </button>
                <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors">

                  O'chirish
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}