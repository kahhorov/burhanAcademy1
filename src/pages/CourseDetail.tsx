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
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return k.toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

export function CourseDetail() {
  const { courseId } = useParams();
  const { t } = useTranslation();
  const { user, isPremium, purchasedCourses, isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, any[]>>({});
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminTelegram, setAdminTelegram] = useState("burhan_admin");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [lastWatchedLessonId, setLastWatchedLessonId] = useState<string | null>(null);
  const [courseRating, setCourseRating] = useState({ total: 0, count: 0, average: 0 });

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const [courseDoc, modulesSnapshot, lessonsSnapshot] = await Promise.all([
          getDoc(doc(db, "courses", courseId)),
          getDocs(query(collection(db, "modules"), where("courseId", "==", courseId))),
          getDocs(query(collection(db, "lessons"), where("courseId", "==", courseId)))
        ]);
        
        if (!courseDoc.exists()) {
          navigate("/courses");
          return;
        }
        
        setCourse({ id: courseDoc.id, ...courseDoc.data() });
        
        const fetchedModules = modulesSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => a.order - b.order);
        
        const allLessons = lessonsSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => a.order - b.order);
        
        setTotalLessons(allLessons.length);
        
        const lessonIds = allLessons.map((l) => l.id);
        const ratingsSnapshot = await getDocs(collection(db, "ratings"));
        
        let totalRating = 0;
        let ratingsCount = 0;
        
        ratingsSnapshot.docs.forEach((r) => {
          const data = r.data();
          if (data.lessonId && lessonIds.includes(data.lessonId)) {
            totalRating += data.rating || 0;
            ratingsCount += 1;
          }
        });
        
        setCourseRating({
          total: totalRating,
          count: ratingsCount,
          average: ratingsCount > 0 ? Math.round((totalRating / ratingsCount) * 10) / 10 : 0
        });
        
        const grouped: Record<string, any[]> = {};
        if (fetchedModules.length > 0) {
          setModules(fetchedModules);
          fetchedModules.forEach((m) => {
            grouped[m.id] = allLessons.filter((l) => l.moduleId === m.id);
          });
          setExpandedModules({ [fetchedModules[0].id]: true });
        } else {
          setModules([{ id: "default", title: t("all_lessons"), order: 1 }]);
          grouped["default"] = allLessons;
          setExpandedModules({ "default": true });
        }
        setLessonsByModule(grouped);
        
        if (user) {
          const progressDoc = await getDoc(doc(db, `users/${user.uid}/progress`, courseId));
          if (progressDoc.exists() && progressDoc.data().lastLessonId) {
            setLastWatchedLessonId(progressDoc.data().lastLessonId);
          }
        }
        
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists() && settingsDoc.data().telegramUsername) {
          setAdminTelegram(settingsDoc.data().telegramUsername);
        }
      } catch (error) {
        console.error("Error fetching course details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseData();
  }, [courseId, user, navigate, t]);

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
      toast.error(t("not_registered"));
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
        toast.info(t("lessons_not_found"));
      }
    }
  };

  const handleContact = () => {
    if (!user) {
      navigate("/auth");
    } else {
      toast.info(t("already_registered"));
    }
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
        <div className="text-center p-4">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            {t("course_not_found")}
          </h2>
          <Link
            to="/courses"
            className="text-teal-600 dark:text-teal-400 hover:underline"
          >
            {t("back_to_courses")}
          </Link>
        </div>
      </div>
    );
  }

  const hasRating = courseRating.count > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1a] pb-16 sm:pb-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
          <Link
            to="/courses"
            className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {t("courses")}
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium truncate">
            {course.title}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          <div className="lg:col-span-8">
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider uppercase bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  {t(course.level || "beginner")}
                </span>
                {course.tags?.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider uppercase bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 tracking-tight">
                {course.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-lg mb-4 sm:mb-6 leading-relaxed">
                {course.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 sm:w-4 sm:h-4 ${
                          hasRating && star <= Math.round(courseRating.average)
                            ? "text-amber-400 fill-amber-400"
                            : "text-gray-300 dark:text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {hasRating ? courseRating.average.toFixed(1) : "0.0"}
                  </span>
                  {courseRating.count > 0 && (
                    <span className="text-gray-400 text-[10px] sm:text-xs">
                      ({courseRating.count})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                  <span>{course.language || 'UZ'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                  <span>3400+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  <span>{t(course.level || "beginner")}</span>
                </div>
              </div>
            </div>

            <div className="relative w-full aspect-video rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-lg mb-8 sm:mb-12 lg:mb-16 group">
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-6xl sm:text-7xl lg:text-8xl font-bold text-slate-600 dark:text-white/10">
                    {course.title.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6">
                <button className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-black/50 backdrop-blur-md hover:bg-black/70 text-white rounded-full text-xs sm:text-sm font-medium transition-colors border border-white/10">
                  <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" /> {t("free_trial")}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {t("course_program")}
                </h2>
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-xs sm:text-sm font-medium">
                  {modules.length} {t("module_count")} • {totalLessons} {t("lesson_count_short")}
                </span>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {modules.map((module, mIdx) => {
                  const moduleLessons = lessonsByModule[module.id] || [];
                  const isExpanded = expandedModules[module.id];
                  return (
                    <div
                      key={module.id}
                      className="border border-gray-200 dark:border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden bg-white dark:bg-[#111827]"
                    >
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full flex items-center justify-between p-3 sm:p-4 lg:p-5 bg-gray-50/50 dark:bg-[#111827]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base lg:text-lg">
                              {mIdx + 1}-Modul. {module.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {moduleLessons.length} {t("lesson_count_short")}
                            </p>
                          </div>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <div className="p-2 sm:p-3 lg:p-4">
                              {moduleLessons.map((lesson, lIdx) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg sm:rounded-xl transition-colors group"
                                >
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    {!hasAccess ? (
                                      <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                                    ) : (
                                      <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                      #{lIdx + 1}. {lesson.title}
                                    </span>
                                  </div>
                                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {lesson.duration || "10:00"}
                                  </span>
                                </div>
                              ))}
                              {moduleLessons.length === 0 && (
                                <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-500">
                                  {t("no_lessons_in_module")}
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

          <div className="lg:col-span-4">
            <div className="sticky top-20 sm:top-24 bg-white dark:bg-[#111827] p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-none border border-gray-100 dark:border-gray-800">
              <div className="mb-4 sm:mb-6">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("course_price")}
                </span>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                  {course.isPaid ? (
                    hasAccess ? (
                      <>
                        <span className="line-through text-lg sm:text-xl lg:text-2xl text-gray-400">
                          {course.price?.toLocaleString()} so'm
                        </span>
                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm sm:text-base lg:text-lg px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg">
                          {t("purchased")}
                        </span>
                      </>
                    ) : (
                      <>{course.price?.toLocaleString()} so'm</>
                    )
                  ) : (
                    <span className="text-green-600 dark:text-green-400">{t("free")}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 lg:mb-8">
                {hasAccess ? (
                  <button
                    onClick={handleStartLearning}
                    className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-600/20 text-sm sm:text-base"
                  >
                    {t("view_course")}
                  </button>
                ) : (
                  <a
                    href={`https://t.me/${adminTelegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-600/20 text-sm sm:text-base"
                  >
                    {t("buy_course")}
                  </a>
                )}
                <button
                  onClick={handleContact}
                  className="w-full flex items-center justify-center py-3 sm:py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors text-sm sm:text-base"
                >
                  {t("contact")}
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 lg:mb-8">
                <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" /> {t("what_includes")}
                </h4>
                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2 sm:gap-3">
                    <MonitorPlay className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                    {totalLessons} {t("high_quality_videos")}
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                    {totalLessons} {t("course_description")}
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                    {t("unlimited_access")}
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 border border-gray-100 dark:border-gray-800">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {t("materials_access")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
