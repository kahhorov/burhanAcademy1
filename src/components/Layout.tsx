import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Moon,
  Sun,
  Globe,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  ChevronDown,
  User as UserIcon,
  Radio,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
export function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnlineClassActive, setIsOnlineClassActive] = useState(false);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "onlineClass"),
      (docSnap) => {
        if (docSnap.exists()) {
          setIsOnlineClassActive(docSnap.data().isActive === true);
        } else {
          setIsOnlineClassActive(false);
        }
      },
    );
    return () => unsubscribe();
  }, []);
  const navLinks = [
    {
      path: "/",
      label: "home",
    },
    {
      path: "/courses",
      label: "courses",
    },
    {
      path: "/teachers",
      label: "teachers",
    },
    {
      path: "/pricing",
      label: "pricing",
    },
  ];

  const closeMenu = () => setIsMobileMenuOpen(false);
  // Don't show layout on online class page to maximize screen space
  if (
    location.pathname === "/online-class" ||
    location.pathname === "/live-chat"
  ) {
    return <Outlet />;
  }
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0a0f1a] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link
              to="/"
              className="flex items-center gap-3"
              onClick={closeMenu}
            >
              <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                ب
              </div>
              <div>
                <h1 className="font-bold text-xl leading-tight text-gray-900 dark:text-white">
                  Burhan
                </h1>
                <p className="text-[10px] tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                  Academy
                </p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-full relative">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${location.pathname === link.path ? "bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"}`}
                >
                  {link.label === "Demo darslar" ? link.label : t(link.label)}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${location.pathname.startsWith("/admin") ? "bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"}`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  {t("admin_panel")}
                </Link>
              )}
              {isOnlineClassActive && (
                <div className="absolute -top-3 -right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase animate-pulse shadow-lg shadow-red-500/50">
                  <Radio className="w-3 h-3" />
                  Jonli
                </div>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative group">
                <div className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer py-2">
                  <Globe className="w-4 h-4" />
                  <span className="uppercase">{i18n.language}</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                  <button
                    onClick={() => i18n.changeLanguage("uz")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${i18n.language === "uz" ? "text-teal-600 dark:text-teal-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    O'zbekcha
                  </button>
                  <button
                    onClick={() => i18n.changeLanguage("ru")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${i18n.language === "ru" ? "text-teal-600 dark:text-teal-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    Русский
                  </button>
                  <button
                    onClick={() => i18n.changeLanguage("en")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${i18n.language === "en" ? "text-teal-600 dark:text-teal-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    English
                  </button>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[100px] truncate">
                      {user.displayName || user.email?.split("@")[0]}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t("logout")}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-full transition-colors"
                >
                  {t("login")}
                </Link>
              )}
            </div>

            <div className="md:hidden flex items-center gap-4">
              {isOnlineClassActive && (
                <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase animate-pulse shadow-lg shadow-red-500/50">
                  <Radio className="w-3 h-3" />
                  Jonli
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-full"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-full"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-gray-800 shadow-lg">
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${location.pathname === link.path ? "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                >
                  {link.label === "Demo darslar" ? link.label : t(link.label)}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-2 ${location.pathname.startsWith("/admin") ? "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                >
                  <ShieldAlert className="w-5 h-5" />
                  {t("admin_panel")}
                </Link>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                <div className="px-4 py-2 mb-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tilni tanlang
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        i18n.changeLanguage("uz");
                        closeMenu();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm ${i18n.language === "uz" ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                    >
                      UZ
                    </button>
                    <button
                      onClick={() => {
                        i18n.changeLanguage("ru");
                        closeMenu();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm ${i18n.language === "ru" ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                    >
                      RU
                    </button>
                    <button
                      onClick={() => {
                        i18n.changeLanguage("en");
                        closeMenu();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm ${i18n.language === "en" ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                {user ? (
                  <div className="mt-2">
                    <div className="px-4 py-2 flex items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || "User"}
                          className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
                          <UserIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.displayName || user.email}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      {t("logout")}
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    onClick={closeMenu}
                    className="block mt-2 px-4 py-3 text-center bg-teal-600 hover:bg-teal-700 text-white text-base font-medium rounded-xl transition-colors"
                  >
                    {t("login")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      {!location.pathname.startsWith("/admin") &&
        !location.pathname.startsWith("/lessons") &&
        !location.pathname.startsWith("/online-class") && (
          <footer className="bg-white dark:bg-[#111827] text-gray-600 dark:text-gray-400 py-12 border-t border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                      ع
                    </div>
                    <h2 className="font-bold text-xl text-gray-900 dark:text-white">
                      Arabiy
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Arab tilini zamonaviy usulda o'rganish uchun eng yaxshi
                    platforma.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Tezkor havolalar
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link
                        to="/"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Bosh sahifa
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/courses"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Kurslar
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/free-courses"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Demo darslar
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/teachers"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        O'qituvchilar
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Kurslar
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link
                        to="/courses?level=beginner"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Arab alifbosi
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/courses?level=intermediate"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Grammatika asoslari
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/courses?level=advanced"
                        className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        Ravon gapirish
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Aloqa
                  </h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-teal-600 dark:text-teal-400">
                        ✉
                      </span>{" "}
                      info@burhan.uz
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-teal-600 dark:text-teal-400">
                        📞
                      </span>{" "}
                      +998 90 123 45 67
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-teal-600 dark:text-teal-400">
                        📍
                      </span>{" "}
                      Toshkent shahri
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-500">
                © {new Date().getFullYear()} Burhan Academy. Barcha huquqlar
                himoyalangan.
              </div>
            </div>
          </footer>
        )}
    </div>
  );
}
