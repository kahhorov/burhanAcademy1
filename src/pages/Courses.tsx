import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  arrayUnion,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Users,
  Star,
  PlayCircle,
  BookOpen,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

function formatCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return k.toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  isPaid: boolean;
  price?: number;
  thumbnailUrl?: string;
  lessonsCount: number;
  rating: number;
  ratingsCount?: number;
}

interface CourseWithRating extends Course {
  calculatedRating: number;
  calculatedRatingsCount: number;
  totalRatingValue: number;
}

export function Courses() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const levelFilter = searchParams.get("level");
  const [courses, setCourses] = useState<CourseWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(levelFilter || "all");
  const {
    user,
    isPremium,
    purchasedCourses,
    hasOnlineClassAccess,
    isTeacher,
    isAdmin,
  } = useAuth();
  const [onlineClass, setOnlineClass] = useState<any>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "onlineClass"), (snap) => {
      if (snap.exists()) {
        setOnlineClass(snap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        let q = collection(db, "courses");
        if (activeFilter !== "all") {
          q = query(q, where("level", "==", activeFilter)) as any;
        }

        const snapshot = await getDocs(q);
        let coursesData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          calculatedRating: 0,
          calculatedRatingsCount: 0,
          totalRatingValue: 0,
        })) as CourseWithRating[];

        const ratingsSnapshot = await getDocs(collection(db, "ratings"));
        const ratingsByCourse: Record<string, { total: number; count: number }> = {};
        
        ratingsSnapshot.docs.forEach((r) => {
          const data = r.data();
          if (data.lessonId) {
            const lessonDoc = ratingsByCourse[data.lessonId] || { total: 0, count: 0 };
            lessonDoc.total += data.rating || 0;
            lessonDoc.count += 1;
            ratingsByCourse[data.lessonId] = lessonDoc;
          }
        });

        const lessonsSnapshot = await getDocs(collection(db, "lessons"));
        const courseRatings: Record<string, { total: number; count: number }> = {};
        
        lessonsSnapshot.docs.forEach((l) => {
          const lessonData = l.data();
          const lessonCourseId = lessonData.courseId;
          const lessonRatings = ratingsByCourse[l.id];
          if (lessonRatings && lessonCourseId) {
            const existing = courseRatings[lessonCourseId] || { total: 0, count: 0 };
            existing.total += lessonRatings.total;
            existing.count += lessonRatings.count;
            courseRatings[lessonCourseId] = existing;
          }
        });

        coursesData = coursesData.map((course) => {
          const courseRating = courseRatings[course.id] || { total: 0, count: 0 };
          return {
            ...course,
            calculatedRating: courseRating.count > 0 ? Math.round((courseRating.total / courseRating.count) * 10) / 10 : 0,
            calculatedRatingsCount: courseRating.count,
            totalRatingValue: courseRating.total,
          };
        });

        setCourses(coursesData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setLoading(false);
      }
    };
    fetchCourses();
  }, [activeFilter]);

  const filters = [
    { id: "all", label: t("filter_all") },
    { id: "beginner", label: t("beginner") },
    { id: "intermediate", label: t("intermediate") },
    { id: "advanced", label: t("advanced") },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  const handleOnlineClassClick = () => {
    if (!user) {
      toast.error(t("login_first"));
      navigate("/auth");
      return;
    }
    if (isTeacher || isAdmin) {
      setShowJoinModal(true);
      return;
    }
    if (onlineClass?.isPaid && !isPremium && !hasOnlineClassAccess) {
      navigate("/pricing");
      return;
    }
    setShowJoinModal(true);
  };

  const joinOnlineClass = async () => {
    if (!user || !onlineClass) return;
    setJoining(true);
    try {
      const currentJoined = onlineClass.joinedUsers || [];
      const kickedUsers = onlineClass.kickedUsers || [];
      
      if (kickedUsers.includes(user.uid) && !isAdmin && !isTeacher) {
        toast.error(t("kicked_from_class"));
        setJoining(false);
        return;
      }
      
      if (
        !isPremium &&
        !isAdmin &&
        !isTeacher &&
        onlineClass.limit &&
        currentJoined.length >= onlineClass.limit &&
        !currentJoined.includes(user.uid)
      ) {
        toast.error(`${t("limit_reached")} ${onlineClass.limit}`);
        setJoining(false);
        return;
      }
      
      if (!isAdmin && !isTeacher && !currentJoined.includes(user.uid)) {
        await setDoc(
          doc(db, "settings", "onlineClass"),
          { joinedUsers: arrayUnion(user.uid) },
          { merge: true },
        );
      }
      setShowJoinModal(false);
      navigate("/live-chat");
    } catch (error) {
      console.error("Error joining:", error);
      toast.error(t("join_error"));
    } finally {
      setJoining(false);
    }
  };

  const isOnlineClassActive = onlineClass?.isActive === true;
  const needsPurchase = onlineClass?.isPaid && !isPremium && !hasOnlineClassAccess && !isTeacher && !isAdmin;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1a] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">
            {t("all_courses_title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-6 sm:mb-8 text-sm sm:text-base">
            {t("start_learning")}
          </p>

          <button
            onClick={handleOnlineClassClick}
            className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-white shadow-lg transition-all hover:scale-105 text-sm sm:text-base mx-auto ${
              isOnlineClassActive
                ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 animate-pulse"
                : needsPurchase
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
            }`}
          >
            <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
            {needsPurchase
              ? t("live_stream_buy")
              : isOnlineClassActive
              ? t("join_live")
              : t("online_class")}
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-12">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.id
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-white dark:bg-[#111827] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 sm:py-20">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : courses.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
          >
            {courses.map((course) => {
              const isPurchased = isPremium || purchasedCourses.includes(course.id);
              const hasRating = course.calculatedRating > 0;
              
              return (
                <motion.div
                  key={course.id}
                  variants={itemVariants}
                  className="h-full"
                >
                  <Link
                    to={`/courses/${course.id}`}
                    className="bg-white dark:bg-[#111827] rounded-xl sm:rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
                  >
                    <div className="h-36 sm:h-44 lg:h-48 bg-teal-900 relative overflow-hidden flex items-center justify-center">
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-5xl sm:text-6xl text-white/20">ب</div>
                      )}
                      <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                        <span
                          className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm ${
                            course.isPaid ? "bg-amber-500 text-white" : "bg-green-500 text-white"
                          }`}
                        >
                          {course.isPaid ? t("paid") : t("free")}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-5 lg:p-6 flex flex-col flex-grow">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-[10px] sm:text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 sm:py-1 rounded">
                          {t(course.level)}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 sm:w-4 sm:h-4 ${
                                  hasRating && star <= Math.round(course.calculatedRating)
                                    ? "text-amber-400 fill-amber-400"
                                    : star <= Math.round(course.calculatedRating)
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-gray-300 dark:text-gray-600"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                            {hasRating ? course.calculatedRating.toFixed(1) : "0.0"}
                          </span>
                          {course.calculatedRatingsCount > 0 && (
                            <span className="text-[10px] sm:text-xs text-gray-400">
                              ({course.calculatedRatingsCount})
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 line-clamp-2 flex-grow">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{course.lessonsCount || 0} {t("lessons")}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>3400+</span>
                          </div>
                        </div>
                        {course.isPaid ? (
                          isPurchased ? (
                            <div className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-sm">
                              {t("purchased")}
                            </div>
                          ) : (
                            <div className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-sm">
                              {formatCount(course.price || 0)} so'm
                            </div>
                          )
                        ) : (
                          <div className="font-bold text-green-600 dark:text-green-400 text-[10px] sm:text-sm">
                            {t("free")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-16 sm:py-20 bg-white dark:bg-[#111827] rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800">
            <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("no_courses")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              {t("coming_soon_free")}
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowJoinModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 text-center"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Radio className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t("online_class_title")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
                {t("online_class_desc")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm sm:text-base"
                >
                  {t("cancel")}
                </button>
                {isOnlineClassActive ? (
                  <button
                    onClick={joinOnlineClass}
                    disabled={joining}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70 flex justify-center items-center text-sm sm:text-base"
                  >
                    {joining ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      t("join_live")
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-3 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl font-medium cursor-not-allowed text-sm sm:text-base"
                  >
                    {t("not_active")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
