import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  PlayCircle,
  CheckCircle,
  Star,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MonitorPlay,
  CircleDot,
  ChevronLeft,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { VideoPlayer } from "../components/ui/video-player";

export function LessonView() {
  const { lessonId } = useParams();
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lesson, setLesson] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isPlayed, setIsPlayed] = useState(false);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, any[]>>(
    {},
  );
  const [allLessonsFlat, setAllLessonsFlat] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      toast.error(t("login_required"));
      navigate("/");
      return;
    }
    const fetchLessonData = async () => {
      if (!lessonId) return;
      try {
        const lessonDoc = await getDoc(doc(db, "lessons", lessonId));
        if (lessonDoc.exists()) {
          const lessonData = {
            id: lessonDoc.id,
            ...lessonDoc.data(),
          };
          setLesson(lessonData);
          const courseDoc = await getDoc(
            doc(db, "courses", lessonData.courseId),
          );
          if (courseDoc.exists())
            setCourse({
              id: courseDoc.id,
              ...courseDoc.data(),
            });
          const modulesQuery = query(
            collection(db, "modules"),
            where("courseId", "==", lessonData.courseId),
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
            where("courseId", "==", lessonData.courseId),
          );
          const lessonsSnapshot = await getDocs(lessonsQuery);
          const allLessons = lessonsSnapshot.docs
            .map((d) => ({
              id: d.id,
              ...d.data(),
            }))
            .sort((a: any, b: any) => a.order - b.order);
          setAllLessonsFlat(allLessons);
          const grouped: Record<string, any[]> = {};
          if (fetchedModules.length > 0) {
            setModules(fetchedModules);
            fetchedModules.forEach((m) => {
              grouped[m.id] = allLessons.filter((l) => l.moduleId === m.id);
            });
            const currentModule = fetchedModules.find(
              (m) => m.id === lessonData.moduleId,
            );
            setExpandedModuleId(
              currentModule ? currentModule.id : fetchedModules[0].id,
            );
          } else {
            setModules([
              {
                id: "default",
                title: "Barcha darslar",
                order: 1,
              },
            ]);
            grouped["default"] = allLessons;
            setExpandedModuleId("default");
          }
          setLessonsByModule(grouped);
          if (user) {
            await setDoc(
              doc(db, `users/${user.uid}/progress`, lessonData.courseId),
              {
                lastLessonId: lessonId,
                lastWatchedAt: serverTimestamp(),
              },
              {
                merge: true,
              },
            );
            refreshUserData();
            const ratingsQuery = query(
              collection(db, "ratings"),
              where("userId", "==", user.uid),
              where("lessonId", "==", lessonId),
            );
            const ratingsSnap = await getDocs(ratingsQuery);
            if (!ratingsSnap.empty)
              setUserRating(ratingsSnap.docs[0].data().rating);
            else setUserRating(0);
          }
        }
      } catch (error) {
        console.error("Error fetching lesson:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLessonData();
  }, [lessonId, user]);
  const goToNextLesson = () => {
    if (!lesson || allLessonsFlat.length === 0) return;
    const currentIndex = allLessonsFlat.findIndex((l) => l.id === lesson.id);
    if (currentIndex < allLessonsFlat.length - 1)
      navigate(`/lessons/${allLessonsFlat[currentIndex + 1].id}`);
    else {
      toast.success("Kursni muvaffaqiyatli yakunladingiz!");
      navigate(`/courses/${lesson.courseId}`);
    }
  };
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1a]">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  if (!lesson)
    return (
      <div className="p-8 text-center text-gray-900 dark:text-white">
        Dars topilmadi
      </div>
    );

  const currentIndex = allLessonsFlat.findIndex((l) => l.id === lesson.id);
  const isLastLesson = currentIndex === allLessonsFlat.length - 1;
  const progressPercentage =
    allLessonsFlat.length > 0
      ? Math.round(((currentIndex + 1) / allLessonsFlat.length) * 100)
      : 0;
  const getYouTubeId = (urlOrId: string) => {
    if (!urlOrId) return "";
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = urlOrId.match(regExp);
    return match && match[2].length === 11 ? match[2] : urlOrId;
  };
  const ytId = getYouTubeId(lesson.youtubeId || lesson.videoUrl);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 dark:from-[#0a0f1a] dark:to-[#021817] text-slate-900 dark:text-slate-100 flex flex-col font-sans py-4 transition-colors duration-500">
      <div className="flex items-center px-6 justify-between">
        <Link
          to={`/courses/${course?.id}`}
          className="flex items-center gap-4 border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md py-2 px-4 rounded-full group hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
        >
          <ChevronLeft
            size={19}
            className="group-hover:-translate-x-1 transition-transform"
          />

          <h1 className="font-bold text-sm">Kurslar paneli</h1>
        </Link>
        <div className="w-48 border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md py-1.5 px-4 rounded-full flex justify-center items-center gap-3 shadow-sm">
          <p className="text-sm font-medium">{progressPercentage}%</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercentage}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden relative mt-2">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
          className={`flex-grow flex flex-col transition-all duration-300 ${sidebarOpen ? "lg:mr-96" : ""} overflow-y-auto`}
        >
          <div className="w-full aspect-video relative max-h-[80vh] max-w-[95vw] md:max-h-[80vh] md:max-w-[70vw] mx-auto mt-4 rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 bg-black ring-4 ring-slate-900/5 dark:ring-white/5">
            {ytId ? (
              <>
                {!isPlayed ? (
                  <div
                    className="absolute inset-0 z-10 cursor-pointer group"
                    onClick={() => setIsPlayed(true)}
                  >
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                      }}
                      alt={lesson.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors duration-500">
                      <div className="w-12 h-12 md:w-24 md:h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                        <div className="w-0 h-0 border-y-[14px] border-y-transparent border-l-[24px] border-l-white ml-2 drop-shadow-md" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
                    title={lesson.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 italic bg-zinc-900">
                Video mavjud emas
              </div>
            )}
          </div>

          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-teal-600 shadow-xl shadow-teal-600/30 text-white flex items-center justify-center hover:scale-110 transition-all hover:bg-teal-500"
            >
              <PanelLeftOpen className="w-6 h-6" />
            </button>
          )}

          <div className="p-6 lg:p-8 max-w-6xl w-full mx-auto">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 sm:p-8 mb-6 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-teal-100/50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-bold tracking-wider uppercase mb-4 border border-teal-200/50 dark:border-teal-800/50">
                    <Sparkles className="w-3.5 h-3.5 mr-2" /> JORIY DARS
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    #{currentIndex + 1}. {lesson.title}
                  </h2>
                </div>
                <button
                  onClick={goToNextLesson}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-teal-600/30 hover:shadow-teal-600/50 group"
                >
                  {isLastLesson ? "Kursni yakunlash" : "Keyingi dars"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1 text-lg">
                  {t("rate_lesson")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Fikringiz biz uchun muhim
                </p>
              </div>
              <div className="flex gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={userRating > 0}
                    className="p-2 focus:outline-none hover:scale-110 transition-transform disabled:hover:scale-100"
                  >
                    <Star
                      className={`w-8 h-8 ${star <= userRating ? "fill-amber-400 text-amber-400 drop-shadow-sm" : "text-slate-300 dark:text-slate-600 hover:text-amber-400/50"} transition-colors`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{
                x: "100%",
                opacity: 0,
              }}
              animate={{
                x: 0,
                opacity: 1,
              }}
              exit={{
                x: "100%",
                opacity: 0,
              }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 200,
              }}
              className="fixed right-0 top-0 bottom-0 w-full lg:w-96 flex flex-col z-[999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-white/50 dark:bg-slate-900/50">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                    {course?.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sizning o'quv jarayoningiz
                  </p>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                {modules.map((module, mIdx) => {
                  const moduleLessons = lessonsByModule[module.id] || [];
                  const isExpanded = expandedModuleId === module.id;
                  return (
                    <div
                      key={module.id}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-sm"
                    >
                      <button
                        onClick={() =>
                          setExpandedModuleId(isExpanded ? null : module.id)
                        }
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-inner">
                            <MonitorPlay className="w-5 h-5" />
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {mIdx + 1}-Modul. {module.title}
                          </h4>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
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
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {moduleLessons.map((l) => {
                                const lIdx = allLessonsFlat.findIndex(
                                  (al) => al.id === l.id,
                                );
                                const isActive = l.id === lesson.id;
                                const isCompleted = lIdx < currentIndex;
                                return (
                                  <Link
                                    key={l.id}
                                    to={`/lessons/${l.id}`}
                                    className={`flex items-center gap-4 p-3 rounded-xl transition-all ${isActive ? "bg-white dark:bg-slate-700 shadow-md border border-teal-200 dark:border-teal-500/30 scale-[1.02]" : "hover:bg-white dark:hover:bg-slate-700/50 border border-transparent"}`}
                                  >
                                    <div className="flex-shrink-0">
                                      {isActive ? (
                                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                          <CircleDot className="w-5 h-5 animate-pulse" />
                                        </div>
                                      ) : isCompleted ? (
                                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                                          <CheckCircle className="w-5 h-5" />
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                                          <PlayCircle className="w-5 h-5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                      <h5
                                        className={`text-sm font-bold truncate ${isActive ? "text-teal-700 dark:text-teal-400" : "text-slate-700 dark:text-slate-300"}`}
                                      >
                                        #{lIdx + 1}. {l.title}
                                      </h5>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">
                                        {l.duration || "10:00"}
                                      </span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
