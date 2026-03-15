import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  ShieldAlert,
  BookOpen,
  PlayCircle,
  Users,
  Settings,
  LayoutDashboard,
  FolderTree,
  Crown,
  CircleDollarSign,
  UserCheck,
  User as UserIcon,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminDashboard } from "../components/admin/AdminDashboard";
import { AdminCourses } from "../components/admin/AdminCourses";
import { AdminModules } from "../components/admin/AdminModules";
import { AdminLessons } from "../components/admin/AdminLessons";
import { AdminTeachers } from "../components/admin/AdminTeachers";
import { AdminUsers } from "../components/admin/AdminUsers";
import { AdminPremium } from "../components/admin/AdminPremium";
import { AdminRevenue } from "../components/admin/AdminRevenue";
import { AdminSettings } from "../components/admin/AdminSettings";
import { AdminOnlineClass } from "../components/admin/AdminOnlineClass";
export function AdminPage() {
  const { t } = useTranslation();
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Read active tab from URL params, default to 'dashboard'
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "dashboard",
  );
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    telegramUsername: "",
  });
  const [premiumSettings, setPremiumSettings] = useState({
    monthlyPrice: 150000,
    yearlyPrice: 1500000,
    isActive: true,
  });
  // Handle tab change - update state AND URL
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams(
      {
        tab: tabId,
      },
      {
        replace: true,
      },
    );
  };
  // Sync URL param on mount and when URL changes externally
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  const fetchData = async () => {
    setLoading(true);
    try {
      if (
        [
          "dashboard",
          "revenue",
          "users",
          "premium",
          "online",
          "teachers",
        ].includes(activeTab)
      ) {
        const usersSnap = await getDocs(collection(db, "users"));
        setUsers(
          usersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      }
      if (
        [
          "dashboard",
          "courses",
          "modules",
          "lessons",
          "users",
          "revenue",
        ].includes(activeTab)
      ) {
        const coursesSnap = await getDocs(collection(db, "courses"));
        setCourses(
          coursesSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      }
      if (["modules", "lessons"].includes(activeTab)) {
        const mSnap = await getDocs(collection(db, "modules"));
        setModules(
          mSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      }
      if (["dashboard", "lessons"].includes(activeTab)) {
        const lSnap = await getDocs(collection(db, "lessons"));
        setLessons(
          lSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      }
      if (activeTab === "teachers") {
        const tSnap = await getDocs(collection(db, "teachers"));
        setTeachers(
          tSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      }
      if (activeTab === "premium" || activeTab === "dashboard") {
        const docSnap = await getDoc(doc(db, "settings", "premium"));
        if (docSnap.exists()) {
          setPremiumSettings({
            monthlyPrice: docSnap.data().monthlyPrice || 150000,
            yearlyPrice: docSnap.data().yearlyPrice || 1500000,
            isActive: docSnap.data().isActive !== false,
          });
        }
      }
      if (activeTab === "settings") {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
          setSettings({
            telegramUsername: docSnap.data().telegramUsername || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, activeTab]);
  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0f1a] p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Ruxsat yo'q
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Bu sahifaga faqat adminlar kira oladi.
        </p>
      </div>
    );
  }
  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: "courses",
      label: "Kurslar",
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: "modules",
      label: "Modullar",
      icon: <FolderTree className="w-5 h-5" />,
    },
    {
      id: "lessons",
      label: "Darslar",
      icon: <PlayCircle className="w-5 h-5" />,
    },
    {
      id: "teachers",
      label: "O'qituvchilar",
      icon: <UserCheck className="w-5 h-5" />,
    },
    {
      id: "users",
      label: "Foydalanuvchilar",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "online",
      label: "Online Dars",
      icon: <Radio className="w-5 h-5" />,
    },
    {
      id: "premium",
      label: "Premium",
      icon: <Crown className="w-5 h-5" />,
    },
    {
      id: "revenue",
      label: "Tushumlar",
      icon: <CircleDollarSign className="w-5 h-5" />,
    },
    {
      id: "settings",
      label: "Sozlamalar",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-[#0a0f1a] py-8">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Panel
          </h1>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row min-h-[700px]">
          <div className="w-full md:w-64 bg-gray-50/50 dark:bg-gray-900/30 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col">
            <div className="mb-6 p-4 bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center border-2 border-teal-200 dark:border-teal-800 mb-3 overflow-hidden">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Admin"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-8 h-8" />
                )}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate w-full">
                {user?.displayName || "Admin"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-full mt-1">
                {user?.email}
              </p>
            </div>

            <nav className="space-y-1.5 flex-grow">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? "bg-teal-600 text-white shadow-md shadow-teal-600/20" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 p-6 lg:p-8 overflow-y-auto relative">
            {loading && (
              <div className="absolute inset-0 flex justify-center items-center bg-white/50 dark:bg-[#111827]/50 backdrop-blur-sm z-10">
                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="h-full"
              >
                {activeTab === "dashboard" && (
                  <AdminDashboard
                    users={users}
                    courses={courses}
                    lessons={lessons}
                    premiumPrice={premiumSettings.monthlyPrice}
                  />
                )}
                {activeTab === "courses" && (
                  <AdminCourses courses={courses} fetchData={fetchData} />
                )}
                {activeTab === "modules" && (
                  <AdminModules
                    courses={courses}
                    modules={modules}
                    fetchData={fetchData}
                  />
                )}
                {activeTab === "lessons" && (
                  <AdminLessons
                    courses={courses}
                    modules={modules}
                    lessons={lessons}
                    fetchData={fetchData}
                  />
                )}
                {activeTab === "teachers" && (
                  <AdminTeachers
                    teachers={teachers}
                    users={users}
                    fetchData={fetchData}
                  />
                )}
                {activeTab === "users" && (
                  <AdminUsers
                    users={users}
                    courses={courses}
                    fetchData={fetchData}
                  />
                )}
                {activeTab === "online" && <AdminOnlineClass users={users} />}
                {activeTab === "premium" && <AdminPremium users={users} />}
                {activeTab === "revenue" && (
                  <AdminRevenue
                    users={users}
                    courses={courses}
                    premiumPrice={premiumSettings.monthlyPrice}
                  />
                )}
                {activeTab === "settings" && (
                  <AdminSettings initialSettings={settings} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
