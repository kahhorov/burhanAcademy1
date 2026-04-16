import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  BookOpen,
  Sparkles,
  AlertTriangle } from
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
interface AdminCoursesProps {
  courses: any[];
  fetchData: () => void;
}
export function AdminCourses({ courses, fetchData }: AdminCoursesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'beginner',
    isPaid: false,
    price: 0,
    thumbnailUrl: '',
    language: "O'zbekcha",
    rating: 5.0,
    ratingsCount: 0,
    lessonsCount: 0
  });
  const formatPrice = (price: number) =>
  new Intl.NumberFormat('uz-UZ').format(price);
  const openModal = (course: any = null) => {
    if (course) {
      setEditingId(course.id);
      setFormData({
        ...course
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        level: 'beginner',
        isPaid: false,
        price: 0,
        thumbnailUrl: '',
        language: "O'zbekcha",
        rating: 5.0,
        ratingsCount: 0,
        lessonsCount: 0
      });
    }
    setIsModalOpen(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), formData);
        toast.success('Kurs yangilandi');
      } else {
        await addDoc(collection(db, 'courses'), {
          ...formData,
          tags: [formData.level]
        });
        toast.success('Kurs yaratildi 🎉');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const modulesQuery = query(collection(db, 'modules'), where('courseId', '==', deleteConfirm.id));
      const modulesSnapshot = await getDocs(modulesQuery);
      for (const moduleDoc of modulesSnapshot.docs) {
        const lessonsQuery = query(collection(db, 'lessons'), where('moduleId', '==', moduleDoc.id));
        const lessonsSnapshot = await getDocs(lessonsQuery);
        for (const lessonDoc of lessonsSnapshot.docs) {
          await deleteDoc(doc(db, 'lessons', lessonDoc.id));
        }
        await deleteDoc(doc(db, 'modules', moduleDoc.id));
      }
      await deleteDoc(doc(db, 'courses', deleteConfirm.id));
      toast.success("O'chirildi");
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Kurslar ro'yxati
          </h2>
          <p className="text-sm text-gray-500 mt-1">{courses.length} ta kurs</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 transition-colors">

          <Plus className="w-4 h-4" /> Yangi kurs
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {courses.map((course) =>
        <div
          key={course.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111827] hover:shadow-md transition-all group">

            <div className="flex items-center gap-4">
              <div className="w-16 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                {course.thumbnailUrl ?
              <img
                src={course.thumbnailUrl}
                className="w-full h-full object-cover"
                alt="" /> :


              <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-gray-400" />
                  </div>
              }
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {course.title}
                </h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-medium">
                    {course.level}
                  </span>
                  {course.isPaid ?
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {formatPrice(course.price)} so'm
                    </span> :

                <span className="text-green-600 dark:text-green-400 font-medium">
                      Bepul
                    </span>
                }
                  <span className="text-gray-400">
                    • {course.lessonsCount || 0} dars
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
              onClick={() => openModal(course)}
              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">

                <Edit className="w-5 h-5" />
              </button>
              <button
              onClick={() =>
              setDeleteConfirm({
                id: course.id,
                title: course.title
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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? 'Kursni tahrirlash' : 'Yangi kurs'}
                  </h3>
                </div>
                <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400">

                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    🖼 Kurs rasmi (URL)
                  </label>
                  <input
                  type="text"
                  value={formData.thumbnailUrl}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    thumbnailUrl: e.target.value
                  })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Kurs nomi
                  </label>
                  <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    title: e.target.value
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Tavsif
                  </label>
                  <textarea
                  required
                  value={formData.description}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  rows={3} />

                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Daraja
                    </label>
                    <select
                    value={formData.level}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      level: e.target.value
                    })
                    }
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none">

                      <option value="beginner">Boshlang'ich</option>
                      <option value="intermediate">O'rta daraja</option>
                      <option value="advanced">Yuqori daraja</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Til
                    </label>
                    <select
                    value={formData.language}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      language: e.target.value
                    })
                    }
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none">

                      <option value="O'zbekcha">O'zbekcha</option>
                      <option value="Русский">Русский</option>
                      <option value="English">English</option>
                    </select>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                    type="checkbox"
                    checked={formData.isPaid}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPaid: e.target.checked
                    })
                    }
                    className="w-5 h-5 rounded-md accent-teal-600" />

                    <span className="font-medium text-gray-900 dark:text-white">
                      Pullik kurs
                    </span>
                  </label>
                  {formData.isPaid &&
                <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Narxi (so'm)
                      </label>
                      <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: Number(e.target.value)
                    })
                    }
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none" />

                    </div>
                }
                </div>
                <button
                type="submit"
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors">

                  {editingId ? 'Yangilash' : 'Kursni saqlash'} ✨
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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-md border border-gray-100 dark:border-gray-800">

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Kursni o'chirish
                </h3>
              </div>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                "{deleteConfirm.title}" kursini o'chirishni tasdiqlaysizmi?
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