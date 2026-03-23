import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  MonitorPlay,
  ChevronDown,
  ChevronUp,
  Youtube,
  Video,
  Sparkles,
  AlertTriangle } from
'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  increment } from
'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
interface AdminLessonsProps {
  courses: any[];
  modules: any[];
  lessons: any[];
  fetchData: () => void;
}
export function AdminLessons({
  courses,
  modules,
  lessons,
  fetchData
}: AdminLessonsProps) {
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    lesson: any;
  } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeId: '',
    videoUrl: '',
    isFree: true,
    duration: '',
    order: 1,
    courseId: '',
    moduleId: ''
  });
  const courseModules = modules.
  filter((m) => m.courseId === selectedCourseId).
  sort((a, b) => (a.order || 0) - (b.order || 0));
  const openModal = (lesson: any = null) => {
    if (lesson) {
      setEditingId(lesson.id);
      setFormData({
        title: lesson.title || '',
        description: lesson.description || '',
        youtubeId: lesson.youtubeId || '',
        videoUrl: lesson.videoUrl || '',
        isFree: lesson.isFree !== false,
        duration: lesson.duration || '',
        order: lesson.order || 1,
        courseId: lesson.courseId || selectedCourseId,
        moduleId: lesson.moduleId || ''
      });
    } else {
      if (!selectedCourseId) {
        toast.error('Avval kursni tanlang');
        return;
      }
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        youtubeId: '',
        videoUrl: '',
        isFree: true,
        duration: '',
        order: 1,
        courseId: selectedCourseId,
        moduleId: ''
      });
    }
    setIsModalOpen(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.moduleId) {
      toast.error('Modulni tanlang');
      return;
    }
    try {
      const dataToSave = {
        title: formData.title,
        description: formData.description,
        youtubeId: formData.isFree ? formData.youtubeId : '',
        videoUrl: !formData.isFree ? formData.videoUrl : '',
        isFree: formData.isFree,
        duration: formData.duration,
        order: formData.order,
        courseId: formData.courseId,
        moduleId: formData.moduleId
      };
      if (editingId) {
        await updateDoc(doc(db, 'lessons', editingId), dataToSave);
        toast.success('Dars yangilandi');
      } else {
        await addDoc(collection(db, 'lessons'), dataToSave);
        await updateDoc(doc(db, 'courses', formData.courseId), {
          lessonsCount: increment(1)
        });
        toast.success('Dars yaratildi! 🎉');
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
      await deleteDoc(doc(db, 'lessons', deleteConfirm.lesson.id));
      await updateDoc(doc(db, 'courses', deleteConfirm.lesson.courseId), {
        lessonsCount: increment(-1)
      });
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
            Darslar
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Kursni tanlang va darslarni boshqaring
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg transition-colors">

          <Plus className="w-4 h-4" /> Dars qo'shish
        </button>
      </div>

      <div className="mb-6">
        <select
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value);
            setExpandedModuleId(null);
          }}
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
      <div className="space-y-4">
          {courseModules.length === 0 ?
        <div className="text-center py-12 text-gray-500">
              <MonitorPlay className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Bu kursda hali modullar yo'q</p>
            </div> :

        courseModules.map((module) => {
          const moduleLessons = lessons.
          filter((l) => l.moduleId === module.id).
          sort((a, b) => (a.order || 0) - (b.order || 0));
          const isExpanded = expandedModuleId === module.id;
          return (
            <div
              key={module.id}
              className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#111827]">

                  <button
                onClick={() =>
                setExpandedModuleId(isExpanded ? null : module.id)
                }
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
                        <MonitorPlay className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          #{module.order}-Modul. {module.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {moduleLessons.length} ta dars
                        </p>
                      </div>
                    </div>
                    {isExpanded ?
                <ChevronUp className="w-5 h-5 text-gray-400" /> :

                <ChevronDown className="w-5 h-5 text-gray-400" />
                }
                  </button>

                  <AnimatePresence>
                    {isExpanded &&
                <motion.div
                  initial={{
                    height: 0,
                    opacity: 0
                  }}
                  animate={{
                    height: 'auto',
                    opacity: 1
                  }}
                  exit={{
                    height: 0,
                    opacity: 0
                  }}
                  className="overflow-hidden border-t border-gray-100 dark:border-gray-800">

                        <div className="p-4 space-y-2">
                          {moduleLessons.map((lesson, idx) =>
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 group">

                              <div className="flex items-center gap-3">
                                <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${lesson.isFree !== false ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>

                                  {lesson.isFree !== false ?
                          <Youtube className="w-4 h-4" /> :

                          <Video className="w-4 h-4" />
                          }
                                </div>
                                <div>
                                  <h5 className="font-medium text-sm text-gray-900 dark:text-white">
                                    #{lesson.order}. {lesson.title}
                                  </h5>
                                  <p className="text-xs text-gray-500">
                                    {lesson.duration}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                          onClick={() => openModal(lesson)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">

                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                          onClick={() =>
                          setDeleteConfirm({
                            lesson
                          })
                          }
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">

                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                    )}
                          {moduleLessons.length === 0 &&
                    <p className="text-sm text-gray-400 text-center py-4">
                              Bu modulda hali darslar yo'q
                            </p>
                    }
                        </div>
                      </motion.div>
                }
                  </AnimatePresence>
                </div>);

        })
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
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? 'Darsni tahrirlash' : 'Yangi dars'}
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
                    📂 Modulni tanlang
                  </label>
                  <select
                  required
                  value={formData.moduleId}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    moduleId: e.target.value,
                    order:
                    lessons.filter((l) => l.moduleId === e.target.value).
                    length + 1
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600">

                    <option value="">Modulni tanlang...</option>
                    {modules.
                  filter((m) => m.courseId === formData.courseId).
                  sort((a, b) => (a.order || 0) - (b.order || 0)).
                  map((m) =>
                  <option key={m.id} value={m.id}>
                          #{m.order}-Modul. {m.title}
                        </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Dars nomi
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
                    Dars turi
                  </label>
                  <div className="flex gap-3">
                    <button
                    type="button"
                    onClick={() =>
                    setFormData({
                      ...formData,
                      isFree: true
                    })
                    }
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-colors ${formData.isFree ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>

                      <Youtube className="w-4 h-4" /> Bepul (YouTube)
                    </button>
                    <button
                    type="button"
                    onClick={() =>
                    setFormData({
                      ...formData,
                      isFree: false
                    })
                    }
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-colors ${!formData.isFree ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>

                      <Video className="w-4 h-4" /> Pullik (Video)
                    </button>
                  </div>
                </div>
                {formData.isFree ?
              <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      🔗 YouTube URL yoki ID
                    </label>
                    <input
                  type="text"
                  required
                  value={formData.youtubeId}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    youtubeId: e.target.value
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                  </div> :

              <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      🎬 Video URL
                    </label>
                    <input
                  type="text"
                  required
                  value={formData.videoUrl}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    videoUrl: e.target.value
                  })
                  }
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                  </div>
              }
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      ⏱ Davomiyligi
                    </label>
                    <input
                    type="text"
                    required
                    value={formData.duration}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: e.target.value
                    })
                    }
                    placeholder="14:38"
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600" />

                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      # Tartib raqami
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
                </div>
                <button
                type="submit"
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors">

                  {editingId ? 'Yangilash' : 'Darsni saqlash'} ✨
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
                  Darsni o'chirish
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                <span className="font-semibold">
                  "{deleteConfirm.lesson.title}"
                </span>{' '}
                darsini o'chirishni tasdiqlaysizmi?
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