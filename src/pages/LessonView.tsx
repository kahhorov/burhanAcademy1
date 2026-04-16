import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where as whereFilter,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
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
  Award,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { setLocalCache, getLocalCache } from "../lib/utils";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
}

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [navigatingLessonId, setNavigatingLessonId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRating, setIsRating] = useState(false);

  const confettiColors = [
    "#F59E0B",
    "#FBBF24",
    "#FCD34D",
    "#FDE68A",
    "#FEF3C7",
    "#8B5CF6",
    "#A78BFA",
    "#C4B5FD",
    "#EC4899",
    "#F472B6",
    "#10B981",
    "#34D399",
    "#6EE7B7",
  ];

  const fireConfetti = useCallback(() => {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 150; i++) {
      const colorIndex = Math.floor(Math.random() * confettiColors.length);
      pieces.push({
        id: i,
        x: Math.random() * 120 - 10,
        y: -10 - Math.random() * 30,
        rotation: Math.random() * 720,
        scale: 0.3 + Math.random() * 1.2,
        color: confettiColors[colorIndex],
        delay: Math.random() * 0.8,
        duration: 2.5 + Math.random() * 2,
      });
    }
    setConfettiPieces(pieces);
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      setTimeout(() => setConfettiPieces([]), 800);
    }, 4000);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    const fetchLessonData = async () => {
      if (!lessonId) return;
      setLoading(true);
      try {
        const lessonDoc = await getDoc(doc(db, "lessons", lessonId));
        
        if (!lessonDoc.exists()) {
          navigate("/courses");
          return;
        }

        const lessonData = { id: lessonDoc.id, ...lessonDoc.data() };
        setLesson(lessonData);
        setLocalCache(`lesson_${lessonId}`, lessonData);
        
        const [courseDoc, modulesSnapshot, lessonsSnapshot] = await Promise.all([
          getDoc(doc(db, "courses", lessonData.courseId)),
          getDocs(query(collection(db, "modules"), whereFilter("courseId", "==", lessonData.courseId))),
          getDocs(query(collection(db, "lessons"), whereFilter("courseId", "==", lessonData.courseId)))
        ]);
        
        if (!courseDoc.exists()) {
          navigate("/courses");
          return;
        }
        const courseData = { id: courseDoc.id, ...courseDoc.data() };
        setCourse(courseData);
        setLocalCache(`course_${lessonData.courseId}`, courseData);
        
        const fetchedModules = modulesSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => a.order - b.order);
        
        const allLessons = lessonsSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => a.order - b.order);
        
        setAllLessonsFlat(allLessons);
        
        const grouped: Record<string, any[]> = {};
        if (fetchedModules.length > 0) {
          setModules(fetchedModules);
          fetchedModules.forEach((m) => {
            grouped[m.id] = allLessons.filter((l) => l.moduleId === m.id);
          });
          const currentModule = fetchedModules.find(m => m.id === lessonData.moduleId);
          setExpandedModuleId(currentModule ? currentModule.id : fetchedModules[0].id);
        } else {
          setModules([{ id: "default", title: t("all_lessons"), order: 1 }]);
          grouped["default"] = allLessons;
          setExpandedModuleId("default");
        }
        setLessonsByModule(grouped);
        
        setUserRating(0);
        setNavigatingLessonId(null);
      } catch (error) {
        console.error("Error fetching lesson:", error);
        toast.error(t("error_occurred"));
        setNavigatingLessonId(null);
      } finally {
        setLoading(false);
      }
    };
    fetchLessonData();
  }, [lessonId, user, navigate, t]);

  const isLessonCompleted = useCallback(
    (lessonIdToCheck: string) => {
      const lessonData = allLessonsFlat.find((l) => l.id === lessonIdToCheck);
      return lessonData?.lessonFinished === true;
    },
    [allLessonsFlat],
  );

  const currentIndex = allLessonsFlat.findIndex((l) => l.id === lesson?.id);
  const isLastLesson = currentIndex === allLessonsFlat.length - 1;
  const isOnlyLesson = allLessonsFlat.length === 1;
  const completedCount = allLessonsFlat.filter((l) =>
    isLessonCompleted(l.id),
  ).length;
  const progressPercentage =
    allLessonsFlat.length > 0
      ? Math.round((completedCount / allLessonsFlat.length) * 100)
      : 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100);
    return () => clearTimeout(timeout);
  }, [progressPercentage]);

  const completeLesson = async () => {
    if (!user) {
      toast.error(t("login_first"));
      return;
    }
    if (!lesson || isSubmitting) {
      toast.error(t("lesson_not_loaded"));
      return;
    }
    const lessonIdToUpdate = lesson.id;
    const courseId = lesson.courseId;
    setIsSubmitting(true);
    try {
      await setDoc(
        doc(db, "lessons", lessonIdToUpdate),
        {
          lessonFinished: true,
        },
        { merge: true },
      );
      setAllLessonsFlat((prev) =>
        prev.map((l) =>
          l.id === lessonIdToUpdate ? { ...l, lessonFinished: true } : l,
        ),
      );
      toast.success(t("lesson_completed"));
      if (
        allLessonsFlat.length === 1 ||
        currentIndex === allLessonsFlat.length - 1
      ) {
        setTimeout(() => {
          toast.success(t("all_lessons_completed"), {
            duration: 4000,
          });
        }, 500);
        setTimeout(() => navigate(`/courses/${courseId}`), 1500);
      } else {
        const nextLesson = allLessonsFlat[currentIndex + 1];
        if (nextLesson) {
          setTimeout(() => navigate(`/lessons/${nextLesson.id}`), 500);
        }
      }
    } catch (error) {
      console.error("Complete error:", error);
      toast.error(t("error_occurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishAndRate = async (rating: number) => {
    if (!user) {
      toast.error(t("login_first"));
      return;
    }
    if (!lesson || isRating) {
      toast.error(t("lesson_not_loaded"));
      return;
    }
    if (userRating > 0) {
      toast.error(t("already_rated"));
      return;
    }
    const lessonIdToRate = lesson.id;
    setIsRating(true);
    try {
      const ratingKey = user.uid + "_" + lessonIdToRate;
      await setDoc(doc(db, "ratings", ratingKey), {
        userId: user.uid,
        lessonId: lessonIdToRate,
        rating: rating,
        createdAt: new Date(),
      });
      setUserRating(rating);
      fireConfetti();
      toast.success(`${rating} yulduz baho berdingiz!`, {
        icon: "⭐",
      });
    } catch (error) {
      console.error("Rating error:", error);
      toast.error(t("error_occurred"));
    } finally {
      setIsRating(false);
    }
  };

  if (!lesson)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-[#0a0f1a] dark:to-[#0a1515]">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 sm:border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-teal-600 dark:text-teal-400 text-sm font-medium">{t("loading")}</p>
        </div>
      </div>
    );

  const getYouTubeId = (urlOrId: string) => {
    if (!urlOrId) return "";
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = urlOrId.match(regExp);
    return match && match[2].length === 11 ? match[2] : urlOrId;
  };
  const ytId = getYouTubeId(lesson.youtubeId || lesson.videoUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-[#0a0f1a] dark:to-[#0a1515] text-slate-900 dark:text-slate-100 flex flex-col font-sans py-2 sm:py-4 transition-colors duration-500 relative overflow-hidden">
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[9999]">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{
                  x: `${piece.x}vw`,
                  y: `${piece.y}vh`,
                  rotate: 0,
                  opacity: 1,
                  scale: piece.scale,
                }}
                animate={{
                  y: "110vh",
                  rotate: piece.rotation + 720,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: piece.duration,
                  delay: piece.delay,
                  ease: "linear",
                }}
                className="absolute"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: piece.color,
                  borderRadius:
                    piece.id % 3 === 0
                      ? "50%"
                      : piece.id % 3 === 1
                        ? "2px"
                        : "0",
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center px-3 sm:px-6 justify-between gap-2">
        <Link
          to={`/courses/${course?.id}`}
          className="flex items-center gap-2 sm:gap-3 border border-teal-200 dark:border-teal-800/50 bg-white/70 dark:bg-teal-900/50 backdrop-blur-md py-1.5 sm:py-2 px-3 sm:px-4 rounded-full group hover:bg-white dark:hover:bg-teal-900/70 transition-all shadow-sm"
        >
          <ChevronLeft
            size={16}
            className="sm:w-[19px] sm:h-[19px] text-teal-600 dark:text-teal-400 group-hover:-translate-x-1 transition-transform"
          />
          <h1 className="font-bold text-xs sm:text-sm text-teal-700 dark:text-teal-300">
            {t("courses")}
          </h1>
        </Link>
        <div className="w-28 sm:w-40 md:w-48 border border-teal-200 dark:border-teal-800/50 bg-white/70 dark:bg-teal-900/50 backdrop-blur-md py-1 sm:py-1.5 px-2 sm:px-4 rounded-full flex justify-center items-center gap-2 sm:gap-3 shadow-sm">
          <p className="text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-300 whitespace-nowrap">
            {animatedProgress}%
          </p>
          <div className="w-full bg-teal-200 dark:bg-teal-800 rounded-full h-1.5 sm:h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-teal-600 to-emerald-600 h-full rounded-full"
              animate={{ width: `${animatedProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden relative mt-1 sm:mt-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`flex-grow flex flex-col transition-all duration-300 ${sidebarOpen ? "lg:mr-80" : ""} overflow-y-auto pb-20 sm:pb-4`}
        >
          <div className="w-full aspect-video relative max-h-[50vh] sm:max-h-[60vh] md:max-h-[75vh] max-w-[98vw] sm:max-w-[95vw] md:max-w-[75vw] mx-auto mt-2 sm:mt-4 rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-teal-500/30 dark:border-teal-500/20 bg-black">
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
                          `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                      }}
                      alt={lesson.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-14 h-14 sm:w-18 sm:h-18 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl"
                      >
                        <PlayCircle className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white ml-0.5 sm:ml-1" />
                      </motion.div>
                    </div>
                    <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex items-center justify-between">
                      <div className="bg-black/60 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-white text-[10px] sm:text-xs font-medium">
                        <span className="flex items-center gap-1">
                          <MonitorPlay className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          {t("video_lesson")}
                        </span>
                      </div>
                      <div className="bg-black/60 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-white text-[10px] sm:text-xs font-medium">
                        <span className="flex items-center gap-1">
                          <CircleDot className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 animate-pulse" />
                          {t("lesson")}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`}
                    title={lesson.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 italic bg-gradient-to-br from-zinc-900 to-zinc-800">
                <div className="text-center p-4">
                  <MonitorPlay className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm sm:text-base">{t("no_courses")}</p>
                </div>
              </div>
            )}
          </div>

          {!sidebarOpen && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSidebarOpen(true)}
              className="fixed right-3 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 shadow-xl shadow-teal-600/30 text-white flex items-center justify-center hover:shadow-teal-600/50 transition-shadow"
            >
              <PanelLeftOpen className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </motion.button>
          )}

          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-3 sm:space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 dark:bg-teal-900/40 backdrop-blur-xl border border-teal-200 dark:border-teal-800/50 rounded-xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 shadow-lg shadow-teal-200/30 dark:shadow-none"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 md:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-teal-100 to-emerald-100 dark:from-teal-900/50 dark:to-emerald-900/50 text-teal-700 dark:text-teal-400 text-[10px] sm:text-xs font-bold tracking-wider uppercase mb-2 sm:mb-3 border border-teal-200/50 dark:border-teal-800/50">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-2" />{" "}
                    {t("next_lesson")}
                  </div>
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                    #{currentIndex + 1}. {lesson.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 sm:mt-2">
                    {completedCount} / {allLessonsFlat.length} {t("lesson_count")}
                  </p>
                </div>
                <button
                  onClick={completeLesson}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white rounded-xl sm:rounded-xl md:rounded-2xl font-bold transition-all shadow-lg shadow-teal-600/30 hover:shadow-teal-600/50 text-sm sm:text-base transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t("loading")}
                    </>
                  ) : (
                    <>
                      {(isLastLesson || isOnlyLesson
                        ? t("course_finish")
                        : t("lesson_finish"))}
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white/80 dark:bg-teal-900/20 backdrop-blur-xl border border-teal-200 dark:border-teal-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg"
            >
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1 text-sm sm:text-base flex items-center gap-2">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  {t("rate_lesson_title")}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  {userRating > 0
                    ? t("thank_you")
                    : t("rate_lesson_desc")}
                </p>
              </div>
              <div className="flex gap-1 sm:gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={userRating > 0 || isRating}
                    onClick={() => handleFinishAndRate(star)}
                    className={`p-2 sm:p-2.5 rounded-xl transition-all transform hover:scale-110 active:scale-95 ${userRating > 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30"}`}
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${star <= (userRating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                    />
                  </button>
                ))}
              </div>
            </motion.div>

            <AnimatePresence>
              {userRating > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -20 }}
                  transition={{ type: "spring", damping: 15, stiffness: 150 }}
                  className="relative overflow-hidden bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-900/40 dark:via-yellow-900/20 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-600/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-center shadow-xl shadow-amber-500/20"
                >
                  <div className="absolute inset-0 overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: -20, opacity: 0, rotate: 0 }}
                        animate={{ 
                          y: [-20, window.innerHeight], 
                          opacity: [0, 1, 1, 0],
                          rotate: 360 * (i % 2 === 0 ? 1 : -1)
                        }}
                        transition={{ 
                          duration: 3, 
                          delay: i * 0.1,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                        className="absolute text-2xl"
                        style={{ 
                          left: `${Math.random() * 100}%`, 
                          top: 0,
                        }}
                      >
                        {['⭐', '🌟', '✨', '💫'][i % 4]}
                      </motion.div>
                    ))}
                  </div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                    className="relative z-10"
                  >
                    <div className="flex items-center justify-center gap-3 mb-3">
                      {[...Array(userRating)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.1, type: "spring" }}
                        >
                          <Star className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500 fill-amber-500" />
                        </motion.div>
                      ))}
                    </div>
                    <p className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">
                      {t("awesome_rating")} {userRating} {t("stars_given")}
                    </p>
                    <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-500">
                      {t("rating_thanks")}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[85vw] sm:w-[360px] md:w-[400px] lg:w-[440px] flex flex-col z-[999] bg-white/95 dark:bg-[#0a1515]/95 backdrop-blur-2xl border-l border-teal-200 dark:border-teal-800 shadow-2xl"
            >
              <div className="p-4 sm:p-5 md:p-6 border-b border-teal-200 dark:border-teal-800 flex justify-between items-start bg-white/50 dark:bg-teal-900/50">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-1 truncate">
                    {course?.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {completedCount} / {allLessonsFlat.length} {t("lesson_count")}
                  </p>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-teal-100 dark:hover:bg-teal-800 rounded-full transition-colors text-slate-500 dark:text-slate-400 flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2 sm:space-y-3">
                {modules.map((module, mIdx) => {
                  const moduleLessons = lessonsByModule[module.id] || [];
                  const isExpanded = expandedModuleId === module.id;
                  const moduleCompletedCount = moduleLessons.filter((l) =>
                    isLessonCompleted(l.id),
                  ).length;
                  return (
                    <div
                      key={module.id}
                      className="bg-teal-50 dark:bg-teal-900/30 rounded-xl sm:rounded-2xl border border-teal-200/50 dark:border-teal-800/50 overflow-hidden shadow-sm"
                    >
                      <button
                        onClick={() =>
                          setExpandedModuleId(isExpanded ? null : module.id)
                        }
                        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-teal-100 dark:hover:bg-teal-800/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-teal-100 to-emerald-100 dark:from-teal-900/50 dark:to-emerald-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-inner">
                            <MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {mIdx + 1}. {module.title}
                            </h4>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                              {moduleCompletedCount}/{moduleLessons.length} {t("lesson")}
                            </p>
                          </div>
                        </div>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-teal-900 flex items-center justify-center shadow-sm flex-shrink-0 ml-2">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-500" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1.5 sm:space-y-2">
                              {moduleLessons.map((l) => {
                                const lIdx = allLessonsFlat.findIndex(
                                  (al) => al.id === l.id,
                                );
                                const isActive = l.id === lesson.id;
                                const isCompleted = isLessonCompleted(l.id);
                                const isNavigating = navigatingLessonId === l.id;
                                return (
                                  <button
                                    key={l.id}
                                    onClick={() => {
                                      if (!isActive && !isNavigating) {
                                        setNavigatingLessonId(l.id);
                                        navigate(`/lessons/${l.id}`);
                                      }
                                    }}
                                    disabled={isActive || isNavigating}
                                    className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all ${isActive ? "bg-white dark:bg-teal-900/50 shadow-md border border-teal-300 dark:border-teal-500/50 scale-[1.02]" : "hover:bg-white dark:hover:bg-teal-900/30 border border-transparent"}`}
                                  >
                                    <div className="flex-shrink-0">
                                      {isNavigating ? (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-600 flex items-center justify-center">
                                          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                      ) : isActive ? (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center text-white animate-pulse">
                                          <CircleDot className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                      ) : isCompleted ? (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                          <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                      <h5
                                        className={`text-xs sm:text-sm font-bold truncate ${isActive ? "text-teal-700 dark:text-teal-400" : "text-slate-700 dark:text-slate-300"}`}
                                      >
                                        #{lIdx + 1}. {l.title}
                                      </h5>
                                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 block font-medium">
                                        {l.duration || "10:00"}
                                      </span>
                                    </div>
                                  </button>
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
