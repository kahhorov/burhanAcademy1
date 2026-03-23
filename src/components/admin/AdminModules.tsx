import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  FolderTree,
  Sparkles,
  AlertTriangle } from
'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc } from
'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
interface AdminModulesProps {
  courses: any[];
  modules: any[];
  fetchData: () => void;
}
export function AdminModules({
  courses,
  modules,
  fetchData
}: AdminModulesProps) {
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    order: 1,
    courseId: ''
  });
  const courseModules = modules.
  filter((m) => m.courseId === selectedCourseId).
  sort((a, b) => (a.order || 0) - (b.order || 0));
  const openModal = (module: any = null) => {
    if (module) {
      setEditingId(module.id);
      setFormData({
        ...module
      });
    } else {
      if (!selectedCourseId) {
        toast.error('Avval kursni tanlang');
        return;
      }
      setEditingId(null);
      setFormData({
        title: '',
        order: courseModules.length + 1,
        courseId: selectedCourseId
      });
    }
    setIsModalOpen(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'modules', editingId), formData);
        toast.success('Modul yangilandi');
      } else {
        await addDoc(collection(db, 'modules'), formData);
        toast.success('Modul yaratildi 🎉');
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
      await deleteDoc(doc(db, 'modules', deleteConfirm.id));
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
            Modullar
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Kursni tanlang va modullarni boshqaring
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 transition-colors">

          <Plus className="w-4 h-4" /> Modul qo'shish
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          📚 Kursni tanlang
        </label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600">

          <option value="">Kursni tanlang...</option>
          {courses.map((c) =>
          <option key={c.id} value={c.id}>
              {c.title}
            </option>
          )}
        </select>
      </div>

      {selectedCourseId &&
      <div className="space-y-3">
          {courseModules.length === 0 ?
        <div className="text-center py-12 text-gray-500">
              <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Bu kursda hali modullar yo'q</p>
            </div> :

        courseModules.map((module, idx) =>
        <motion.div
          key={module.id}
          initial={{
            opacity: 0,
            y: 5
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: idx * 0.05
          }}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#111827] hover:shadow-md transition-all group">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md font-bold text-sm">
                    {module.order}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    #{module.order}-Modul. {module.title}
                  </h3>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
              onClick={() => openModal(module)}
              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">

                    <Edit className="w-5 h-5" />
                  </button>
                  <button
              onClick={() =>
              setDeleteConfirm({
                id: module.id,
                title: module.title
              })
              }
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">

                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
        )
        }
        </div>
      }

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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? 'Modulni tahrirlash' : 'Yangi modul'}
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
                    Modul nomi
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
                  placeholder="Masalan: TypeScript asoslari"
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Tartib raqami
                  </label>
                  <input
                  type="number"
                  required
                  min={1}
                  value={formData.order}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    order: Number(e.target.value)
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                </div>
                <button
                type="submit"
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors">

                  {editingId ? 'Yangilash' : 'Modulni saqlash'} ✨
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
              scale: 0.95
            }}
            animate={{
              opacity: 1,
              scale: 1
            }}
            exit={{
              opacity: 0,
              scale: 0.95
            }}
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Modulni o'chirish
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                <span className="font-semibold">"{deleteConfirm.title}"</span>{' '}
                modulini o'chirishni tasdiqlaysizmi?
              </p>
              <div className="flex gap-3">
                <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors">

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