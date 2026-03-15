import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  PlayCircle,
  Star,
  Lock,
  CheckCircle,
  Globe,
  Trophy,
  MonitorPlay,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
export function CourseDetail() {
  const { courseId } = useParams();
  const { t } = useTranslation();
  const { user, isPremium, purchasedCourses, isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, any[]>>(
    {},
  );
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminTelegram, setAdminTelegram] = useState("burhan_admin");
  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >({});
  const [lastWatchedLessonId, setLastWatchedLessonId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;
      try {
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        if (courseDoc.exists()) {
          setCourse({
            id: courseDoc.id,
            ...courseDoc.data(),
          });
        }
        const modulesQuery = query(
          collection(db, "modules"),
          where("courseId", "==", courseId),
        );
        const modulesSnapshot = await getDocs(modulesQuery);
        const fetchedModules = modulesSnapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a: any, b: any) => a.order - b.order);
        const lessonsQuery = query(
          collection(db, "lessons"),
          where("courseId", "==", courseId),
        );
        const lessonsSnapshot = await getDocs(lessonsQuery);
        const allLessons = lessonsSnapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a: any, b: any) => a.order - b.order);
        setTotalLessons(allLessons.length);
        const grouped: Record<string, any[]> = {};
        if (fetchedModules.length > 0) {
          setModules(fetchedModules);
          fetchedModules.forEach((m, idx) => {
            grouped[m.id] = allLessons.filter((l) => l.moduleId === m.id);
            setExpandedModules((prev) => ({
              ...prev,
              [m.id]: idx === 0,
            }));
          });
        } else {
          const defaultModuleId = "default";
          setModules([
            {
              id: defaultModuleId,
              title: "Barcha darslar",
              order: 1,
            },
          ]);
          grouped[defaultModuleId] = allLessons;
          setExpandedModules({
            [defaultModuleId]: true,
          });
        }
        setLessonsByModule(grouped);
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists() && settingsDoc.data().telegramUsername) {
          setAdminTelegram(settingsDoc.data().telegramUsername);
        }
        if (user) {
          const progressDoc = await getDoc(
            doc(db, `users/${user.uid}/progress`, courseId),
          );
          if (progressDoc.exists() && progressDoc.data().lastLessonId) {
            setLastWatchedLessonId(progressDoc.data().lastLessonId);
          }
        }
      } catch (error) {
        console.error("Error fetching course details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseData();
  }, [courseId, user]);
  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };
  const hasAccess =
    !course?.isPaid ||
    isPremium ||
    isTeacher ||
    isAdmin ||
    purchasedCourses.includes(course?.id);
  const handleStartLearning = () => {
    if (!user) {
      toast.error("Siz ro'yxatdan o'tmagansiz");
      navigate("/auth");
      return;
    }
    if (!hasAccess) {
      window.open(`https://t.me/${adminTelegram}`, "_blank");
      return;
    }
    if (lastWatchedLessonId) {
      navigate(`/lessons/${lastWatchedLessonId}`);
    } else {
      const firstModule = modules[0];
      if (firstModule && lessonsByModule[firstModule.id]?.length > 0) {
        navigate(`/lessons/${lessonsByModule[firstModule.id][0].id}`);
      } else {
        toast.info("Darslar topilmadi");
      }
    }
  };
  const handleContact = () => {
    if (!user) {
      navigate("/auth");
    } else {
      toast.info("Siz ro'yxatdan o'tgansiz");
    }
  };
  const formatNumber = (num: number) => {
    if (num >= 1000000)
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return num.toString();
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0f1a]">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0f1a]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Kurs topilmadi
          </h2>
          <Link
            to="/courses"
            className="text-teal-600 dark:text-teal-400 hover:underline"
          >
            Kurslarga qaytish
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1a] pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link
            to="/courses"
            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            Kurslar
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {course.title}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-8">
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />{" "}
                  {t(course.level || "beginner")}
                </span>
                {course.tags?.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                {course.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-6 leading-relaxed">
                {course.description}
              </p>
              <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-current" />
                  <span className="text-gray-900 dark:text-white">
                    {course.rating || "0.0"}
                  </span>
                  <span>
                    ({formatNumber(course.ratingsCount || 0)} ta sharh)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>{course.language || "O'zbekcha"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-green-500" />
                  <span>{t(course.level || "beginner")}</span>
                </div>
              </div>
            </div>

            <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-lg mb-16 group">
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-8xl font-bold text-slate-600 dark:text-white/10">
                    {course.title.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-6 left-6">
                <button className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md hover:bg-black/70 text-white rounded-full text-sm font-medium transition-colors border border-white/10">
                  <PlayCircle className="w-4 h-4 text-blue-400" /> Bepul
                  tanishuv videosi
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  O'quv dasturi
                </h2>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium">
                  {modules.length} ta modul • {totalLessons} ta dars
                </span>
              </div>
              <div className="space-y-4">
                {modules.map((module, mIdx) => {
                  const moduleLessons = lessonsByModule[module.id] || [];
                  const isExpanded = expandedModules[module.id];
                  return (
                    <div
                      key={module.id}
                      className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#111827]"
                    >
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full flex items-center justify-between p-5 sm:p-6 bg-gray-50/50 dark:bg-[#111827]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <MonitorPlay className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">
                              {mIdx + 1}-Modul. {module.title}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {moduleLessons.length} ta dars
                            </p>
                          </div>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{
                              height: 0,
                              opacity: 0,
                            }}
                            animate={{
                              height: "auto",
                              opacity: 1,
                            }}
                            exit={{
                              height: 0,
                              opacity: 0,
                            }}
                            transition={{
                              duration: 0.3,
                            }}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <div className="p-2 sm:p-4">
                              {moduleLessons.map((lesson, lIdx) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group"
                                >
                                  <div className="flex items-center gap-3">
                                    {!hasAccess ? (
                                      <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    ) : (
                                      <Lock className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      #{lIdx + 1}. {lesson.title}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {lesson.duration || "10:00"}
                                  </span>
                                </div>
                              ))}
                              {moduleLessons.length === 0 && (
                                <div className="p-4 text-center text-sm text-gray-500">
                                  Bu modulda darslar yo'q
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 sticky top-24">
            <div className="animateB bg-white dark:bg-[#111827] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-800">
              <div className="relative z-10">
                <div className="mb-6">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    KURS NARXI
                  </span>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-3">
                    {course.isPaid ? (
                      hasAccess ? (
                        <>
                          <span className="line-through text-gray-400 text-2xl">
                            {course.price?.toLocaleString()} so'm
                          </span>
                          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-lg px-3 py-1 rounded-lg">
                            Sotib olingan
                          </span>
                        </>
                      ) : (
                        `${course.price?.toLocaleString()} so'm`
                      )
                    ) : (
                      "Bepul"
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {hasAccess ? (
                    <button
                      onClick={handleStartLearning}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-600/20"
                    >
                      Kursni ko'rish
                    </button>
                  ) : (
                    <a
                      href={`https://t.me/${adminTelegram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-600/20"
                    >
                      Sotib olish
                    </a>
                  )}
                  <button
                    onClick={handleContact}
                    className="w-full flex items-center justify-center py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
                  >
                    Bog'lanish
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" /> Kurs
                    nimalarni o'z ichiga oladi:
                  </h4>
                  <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center gap-3">
                      <MonitorPlay className="w-4 h-4 text-blue-500" />{" "}
                      {totalLessons} yuqori sifatli video darslar
                    </li>
                    <li className="flex items-center gap-3">
                      <Trophy className="w-4 h-4 text-blue-500" />{" "}
                      {totalLessons} ta darsliklar soni
                    </li>
                    <li className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-blue-500" /> Materiallarga
                      cheksiz umrbod ruxsat
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 flex items-start gap-3 border border-gray-100 dark:border-gray-800">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Barcha darsliklar va materiallarga cheksiz umrbod ruxsat.
                    Kursga yoziling va o'zingiz xohlagan vaqtda o'rganishni
                    boshlang!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
