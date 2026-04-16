import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Play,
  BookOpen,
  Users,
  Award,
  Clock,
  ArrowRight,
  Star,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    videos: 0,
    rating: 4.9,
  });
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const lessonsSnapshot = await getDocs(collection(db, "lessons"));
        setStats({
          videos: lessonsSnapshot.size > 0 ? lessonsSnapshot.size : 0,
          rating: 4.9,
        });
      } catch (error) {
        console.warn("Stats yuklashda xatolik:", error);
        setStats({
          videos: 0,
          rating: 4.9,
        });
      }
    };
    fetchStats();
  }, []);
  const benefits = [
    {
      icon: <BookOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      title: t("interactiv_lessons"),
      desc: t("benefit_desc1"),
    },
    {
      icon: <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      title: t("native_speakers"),
      desc: t("benefit_desc2"),
    },
    {
      icon: <Award className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      title: t("certificates"),
      desc: t("benefit_desc3"),
    },
    {
      icon: <Clock className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      title: t("own_pace"),
      desc: t("benefit_desc4"),
    },
  ];

  const levels = [
    {
      id: "beginner",
      badge: t("beginner"),
      badgeColor:
        "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
      bg: "bg-teal-50 dark:bg-[#111827] border-teal-100 dark:border-teal-900/50",
      title: t("arab_alphabet"),
      desc: t("alphabet_desc"),
      weeks: 4,
      students: "3400+",
      rating: 5,
      arabicLetter: "ا",
    },
    {
      id: "intermediate",
      badge: t("intermediate"),
      badgeColor:
        "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      bg: "bg-gray-100 dark:bg-[#111827] border-gray-200 dark:border-gray-700",
      title: t("grammar_basics"),
      desc: t("grammar_desc"),
      weeks: 8,
      students: "3400+",
      rating: 5,
      arabicLetter: "ب",
    },
    {
      id: "advanced",
      badge: t("advanced"),
      badgeColor:
        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-[#111827] border-gray-100 dark:border-gray-800",
      title: t("fluent_speaking"),
      desc: t("speaking_desc"),
      weeks: 12,
      students: "3400+",
      rating: 5,
      arabicLetter: "ج",
    },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative hero-pattern text-white py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#042f2e]/80 dark:to-[#021817]/90"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-5 pointer-events-none flex items-center justify-center">
          <span className="text-[40rem] leading-none select-none">
            اللغة العربية
          </span>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-sm mb-8">
            <Star className="w-4 h-4 text-amber-400" />
            <span>{t("welcome_message")}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            {t("hero_title")}{" "}
            <span className="text-amber-400">{t("hero_highlight")}</span>{" "}
            {t("hero_subtitle")}
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-teal-50 mb-10 leading-relaxed">
            {t("hero_desc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/courses"
              className="w-full sm:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-full font-medium transition-colors shadow-lg shadow-teal-600/30"
            >
              {t("free_start")}
            </Link>
            <Link
              to="/free-courses"
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-full font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {t("demo_lesson")}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[#042f2e] dark:bg-[#021817] text-white py-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="py-4 md:py-0">
              <div className="text-4xl font-bold mb-2">3400+</div>
              <div className="text-teal-200/70 text-sm">{t("students")}</div>
            </div>
            <div className="py-4 md:py-0">
              <div className="text-4xl font-bold mb-2">{stats.videos}</div>
              <div className="text-teal-200/70 text-sm">
                {t("video_lessons")}
              </div>
            </div>
            <div className="py-4 md:py-0">
              <div className="text-4xl font-bold mb-2">{stats.rating}</div>
              <div className="text-teal-200/70 text-sm">{t("avg_rating")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white dark:bg-[#0a0f1a] relative">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage: "radial-gradient(#0d9488 2px, transparent 2px)",
            backgroundSize: "30px 30px",
          }}
        ></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-sm font-medium mb-4">
              {t("why_us")}
            </span>
            <h2 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              {t("benefits_title")}{" "}
              <span className="text-amber-500">{t("benefits_highlight")}</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t("benefits_desc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#111827] p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center mb-6">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Course Levels Section */}
      <section className="py-20 bg-gray-50 dark:bg-[#0a0f1a]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium mb-4">
              Kurslar
            </span>
            <h2 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              {t("level_title")}{" "}
              <span className="text-amber-500">{t("level_highlight")}</span>{" "}
              {t("level_subtitle")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t("level_desc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {levels.map((level) => (
              <div
                key={level.id}
                onClick={() => navigate(`/courses?level=${level.id}`)}
                className={`relative overflow-hidden rounded-3xl border p-8 cursor-pointer transition-transform hover:-translate-y-1 ${level.bg}`}
              >
                <div className="absolute -right-4 -top-8 text-[12rem] text-black/5 dark:text-white/5 select-none pointer-events-none">
                  {level.arabicLetter}
                </div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-6">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${level.badgeColor}`}
                    >
                      {level.badge}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {level.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 flex-grow">
                    {level.desc}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {level.weeks} {t("weeks")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{level.students} {t("students_count")}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex text-amber-500">
                      {[...Array(level.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-sm font-medium flex items-center gap-1 text-gray-900 dark:text-white">
                      {t("details")} <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              to="/courses"
              className="inline-flex items-center justify-center px-6 py-3 border border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white rounded-full font-medium transition-colors"
            >
              {t("all_courses")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
