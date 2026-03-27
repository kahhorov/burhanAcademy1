import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  MessageCircle,
  Star,
  ShieldCheck,
  Radio,
} from "lucide-react";
export function PricingPage() {
  const { t } = useTranslation();
  const { isPremium, premiumExpiresAt } = useAuth();
  const [adminTelegram, setAdminTelegram] = useState("burhan_admin");
  const [premiumSettings, setPremiumSettings] = useState<any>({
    monthlyPrice: 150000,
    yearlyPrice: 1500000,
  });
  const [onlineClassSettings, setOnlineClassSettings] = useState<any>({
    isPaid: false,
    price: 100000,
  });
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists() && settingsDoc.data().telegramUsername)
          setAdminTelegram(settingsDoc.data().telegramUsername);
        const premiumDoc = await getDoc(doc(db, "settings", "premium"));
        if (premiumDoc.exists()) {
          setPremiumSettings({
            monthlyPrice: premiumDoc.data().monthlyPrice || 150000,
            yearlyPrice: premiumDoc.data().yearlyPrice || 1500000,
          });
        }
        const onlineClassDoc = await getDoc(doc(db, "settings", "onlineClass"));
        if (onlineClassDoc.exists()) {
          setOnlineClassSettings({
            isPaid: onlineClassDoc.data().isPaid || false,
            price: onlineClassDoc.data().price || 100000,
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);
  const features = [
    {
      name: "Barcha dars videolari",
      free: true,
      paid: true,
    },
    {
      name: "Asosiy o'quv materiallari",
      free: true,
      paid: true,
    },
    {
      name: "Darslarni baholash",
      free: true,
      paid: true,
    },
    {
      name: "Barcha pullik kurslarga kirish",
      free: false,
      paid: true,
    },
    {
      name: "Premium qo'shimcha materiallar",
      free: false,
      paid: true,
    },
    {
      name: "O'qituvchi bilan shaxsiy aloqa",
      free: false,
      paid: true,
    },
    {
      name: "Uy vazifalarini tekshirish",
      free: false,
      paid: true,
    },
    {
      name: "Kurs yakunida rasmiy sertifikat",
      free: false,
      paid: true,
    },
    {
      name: "Online darslarga cheksiz kirish",
      free: false,
      paid: true,
    },
  ];

  const onlineClassFeatures = [
    {
      name: "Jonli efirda qatnashish",
      included: true,
    },
    {
      name: "O'qituvchiga savol berish",
      included: true,
    },
    {
      name: "Amaliy mashg'ulotlarda ishtirok",
      included: true,
    },
    {
      name: "Boshqa o'quvchilar bilan muloqot",
      included: true,
    },
    {
      name: "Video darsliklar",
      included: false,
    },
  ];

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1a] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t("pricing_title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
            {t("pricing_desc")}
          </p>
        </div>

        {isPremium && (
          <div className="max-w-3xl mx-auto mb-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
                  Siz premium foydalanuvchisiz!
                </h3>
                <p className="text-green-700 dark:text-green-400/80 text-sm">
                  Barcha kurslar va imkoniyatlar siz uchun ochiq.
                </p>
              </div>
            </div>
            {premiumExpiresAt && (
              <div className="bg-white/50 dark:bg-black/20 px-4 py-2 rounded-xl text-center">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wider">
                  Amal qilish muddati
                </p>
                <p className="font-bold text-green-800 dark:text-green-300">
                  {formatDate(premiumExpiresAt)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center mb-12">
          <div className="bg-gray-200 dark:bg-gray-800 p-1 rounded-full inline-flex relative">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-colors ${billingCycle === "monthly" ? "text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              Oylik
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-colors ${billingCycle === "yearly" ? "text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              Yillik{" "}
              <span className="text-xs text-green-500 ml-1 font-bold">
                -20%
              </span>
            </button>
            <div
              className="absolute top-1 bottom-1 w-1/2 bg-white dark:bg-gray-600 rounded-full shadow transition-transform duration-300 ease-in-out"
              style={{
                transform:
                  billingCycle === "monthly"
                    ? "translateX(0)"
                    : "translateX(100%)",
              }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/10 rounded-bl-full -mr-4 -mt-4"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t("free_plan")}
              </h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-teal-600 dark:text-teal-400">
                  0 so'm
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Arab tilini o'rganishni boshlash uchun ajoyib imkoniyat.
              </p>
              <ul className="space-y-4 mb-8 flex-grow">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    {feature.free ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-sm ${feature.free ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto pt-8">
              <Link
                to="/courses"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-xl font-medium transition-colors"
              >
                {t("start")} <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Premium Plan */}
          <div
            className={`bg-white dark:bg-[#111827] rounded-3xl p-8 border-2 ${isPremium ? "border-green-500" : "border-amber-500"} shadow-xl flex flex-col h-full relative overflow-hidden transform md:-translate-y-4`}
          >
            <div
              className={`absolute top-0 right-0 w-32 h-32 ${isPremium ? "bg-green-50 dark:bg-green-900/10" : "bg-amber-50 dark:bg-amber-900/10"} rounded-bl-full -mr-4 -mt-4`}
            ></div>
            <div
              className={`absolute top-4 right-4 ${isPremium ? "bg-green-500" : "bg-amber-500"} text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1`}
            >
              <Star className="w-3 h-3 fill-current" />{" "}
              {isPremium ? "Faol" : "Eng mashhur"}
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t("paid_plan")}
              </h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  {loading
                    ? "..."
                    : (billingCycle === "monthly"
                        ? premiumSettings.monthlyPrice
                        : premiumSettings.yearlyPrice
                      ).toLocaleString()}{" "}
                  so'm
                </span>
                <span className="text-gray-500 text-sm">
                  / {billingCycle === "monthly" ? "oy" : "yil"}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Mukammal natijaga erishish uchun to'liq imkoniyatlar.
              </p>
              <ul className="space-y-4 mb-8 flex-grow">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    {feature.paid ? (
                      <CheckCircle
                        className={`w-5 h-5 ${isPremium ? "text-green-500" : "text-amber-500"} flex-shrink-0 mt-0.5`}
                      />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-sm ${feature.paid ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto pt-8">
              {isPremium ? (
                <div className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl font-medium">
                  <CheckCircle className="w-5 h-5" /> Sotib olingansiz
                </div>
              ) : (
                <a
                  href={`https://t.me/${adminTelegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-amber-500/20"
                >
                  <MessageCircle className="w-5 h-5" /> Sotib olish
                </a>
              )}
            </div>
          </div>

          {/* Online Class Plan */}
          {onlineClassSettings.isPaid && (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 border border-blue-200 dark:border-blue-900/50 shadow-sm flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-bl-full -mr-4 -mt-4"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-6 h-6 text-blue-500" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Online Dars
                  </h3>
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {loading
                      ? "..."
                      : onlineClassSettings.price.toLocaleString()}{" "}
                    so'm
                  </span>
                  <span className="text-gray-500 text-sm">/ oy</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Ustoz bilan jonli muloqot va amaliyot.
                </p>
                <ul className="space-y-4 mb-8 flex-grow">
                  {onlineClassFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${feature.included ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto pt-8">
                <a
                  href={`https://t.me/${adminTelegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl font-medium transition-colors"
                >
                  <MessageCircle className="w-5 h-5" /> Bog'lanish
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
