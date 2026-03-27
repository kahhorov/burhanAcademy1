import React, { useEffect, useState, Children } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  onSnapshot,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Clock,
  Users,
  Star,
  PlayCircle,
  BookOpen,
  Radio,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
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
}
export function Courses() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const levelFilter = searchParams.get("level");
  const [courses, setCourses] = useState<Course[]>([]);
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
    const fetchCourses = async () => {
      setLoading(true);
      try {
        let q = collection(db, "courses");
        if (activeFilter !== "all") {
          q = query(q, where("level", "==", activeFilter)) as any;
        }

        const snapshot = await getDocs(q);
        const coursesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Course[];
        setCourses(coursesData);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
    const unsubscribe = onSnapshot(
      doc(db, "settings", "onlineClass"),
      (docSnap) => {
        if (docSnap.exists()) {
          setOnlineClass(docSnap.data());
        } else {
          setOnlineClass(null);
        }
      },
    );
    return () => unsubscribe();
  }, [activeFilter]);
  const filters = [
    {
      id: "all",
      label: "Barcha kurslar",
    },
    {
      id: "beginner",
      label: t("beginner"),
    },
    {
      id: "intermediate",
      label: t("intermediate"),
    },
    {
      id: "advanced",
      label: t("advanced"),
    },
  ];

  const containerVariants = {
    hidden: {
      opacity: 0,
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  };
  const handleOnlineClassClick = () => {
    if (!user) {
      toast.error("Iltimos, avval tizimga kiring");
      navigate("/auth");
      return;
    }
    // Teachers and Admins always have access
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
      // Check if user was kicked
      if (kickedUsers.includes(user.uid) && !isAdmin && !isTeacher) {
        toast.error(
          "Siz bu darsdan chiqarilgansiz va qayta qo'shila olmaysiz.",
        );
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
        toast.error(
          `Limit tugadi. Maksimum ${onlineClass.limit} ta foydalanuvchi qo'shila oladi.`,
        );
        setJoining(false);
        return;
      }
      if (!isAdmin && !isTeacher && !currentJoined.includes(user.uid)) {
        await setDoc(
          doc(db, "settings", "onlineClass"),
          {
            joinedUsers: arrayUnion(user.uid),
          },
          {
            merge: true,
          },
        );
      }
      setShowJoinModal(false);
      navigate("/live-chat");
    } catch (error) {
      console.error("Error joining:", error);
      toast.error("Qo'shilishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setJoining(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1a] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            Barcha{" "}
            <span className="text-teal-600 dark:text-teal-400">kurslar</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            O'zingizga mos darajadagi kursni tanlang va o'rganishni boshlang.
          </p>

          <div className="flex justify-center mb-8">
            <button
              onClick={handleOnlineClassClick}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all hover:scale-105 ${onlineClass?.isActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 animate-pulse" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"}`}
            >
              <Radio className="w-5 h-5" />
              {!isTeacher &&
              !isAdmin &&
              onlineClass?.isPaid &&
              !isPremium &&
              !hasOnlineClassAccess
                ? "Jonli efir sotib olish"
                : onlineClass?.isActive
                  ? "Qo'shilish"
                  : "Online dars"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === filter.id ? "bg-teal-600 text-white shadow-md" : "bg-white dark:bg-[#111827] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : courses.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {courses.map((course) => {
              const isPurchased =
                isPremium || purchasedCourses.includes(course.id);
              return (
                <motion.div
                  key={course.id}
                  variants={itemVariants}
                  className="h-full"
                >
                  <Link
                    to={`/courses/${course.id}`}
                    className="bg-white dark:bg-[#111827] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
                  >
                    <div className="h-48 bg-teal-900 relative overflow-hidden flex items-center justify-center">
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-6xl text-white/20">ب</div>
                      )}
                      <div className="absolute top-4 left-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${course.isPaid ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}
                        >
                          {course.isPaid ? t("paid") : t("free")}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-1 rounded">
                          {t(course.level)}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Star className="w-4 h-4 text-amber-500 fill-current" />
                          <span>{course.rating || "4.9"}</span>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-2 flex-grow">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <PlayCircle className="w-4 h-4" />
                            <span>
                              {course.lessonsCount || 0} {t("lessons")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>3400+</span>
                          </div>
                        </div>
                        {course.isPaid ? (
                          isPurchased ? (
                            <div className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md text-sm">
                              Sotib olingan
                            </div>
                          ) : (
                            <div className="font-bold text-gray-900 dark:text-white">
                              {course.price?.toLocaleString()} so'm
                            </div>
                          )
                        ) : (
                          <div className="font-bold text-green-600 dark:text-green-400">
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
          <div className="text-center py-20 bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("no_courses")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tez orada yangi darslar qo'shiladi.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) =>
              e.target === e.currentTarget && setShowJoinModal(false)
            }
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                y: 20,
              }}
              className="bg-white dark:bg-[#111827] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 text-center"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Radio className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Online Dars
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Bu online darsda siz o'qituvchilar bilan jonli efirda
                suhbatlashishingiz, savollaringizga javob olishingiz va amaliy
                mashg'ulotlarda qatnashishingiz mumkin.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Bekor qilish
                </button>
                {onlineClass?.isActive ? (
                  <button
                    onClick={joinOnlineClass}
                    disabled={joining}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70 flex justify-center items-center"
                  >
                    {joining ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Qo'shilish"
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-3 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl font-medium cursor-not-allowed"
                  >
                    Hozir faol emas
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
