import React, { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface AdminPremiumProps {
  users: any[];
}

export function AdminPremium({ users }: AdminPremiumProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    monthlyPrice: 150000,
    yearlyPrice: 1500000,
    isActive: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, "settings", "premium"));
      if (docSnap.exists()) {
        setSettings({
          monthlyPrice: docSnap.data().monthlyPrice || 150000,
          yearlyPrice: docSnap.data().yearlyPrice || 1500000,
          isActive: docSnap.data().isActive !== false,
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "settings", "premium"), settings, {
        merge: true,
      });
      toast.success("Premium sozlamalar saqlandi");
    } catch (error) {
      toast.error("Xatolik yuz berdi");
    }
  };

  const premiumUsers = users.filter((u) => u.isPremium);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t("unlimited");
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        {t("premium_settings")}
      </h2>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6 mb-8">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("monthly_price")}
              </label>
              <input
                type="number"
                value={settings.monthlyPrice}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    monthlyPrice: Number(e.target.value),
                  })
                }
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("yearly_price")}
              </label>
              <input
                type="number"
                value={settings.yearlyPrice}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    yearlyPrice: Number(e.target.value),
                  })
                }
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={settings.isActive}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  isActive: e.target.checked,
                })
              }
              className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("premium_active")}
            </label>
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors mt-2"
          >
            {t("save")}
          </button>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        {t("premium_subscribers")} ({premiumUsers.length})
      </h3>
      <div className="space-y-3">
        {premiumUsers.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111827]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {u.displayName || "Ismsiz"}
                </p>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {t("plan")}:{" "}
                {u.premiumPlanType === "yearly"
                  ? t("yearly_plan")
                  : u.premiumPlanType === "monthly"
                    ? t("monthly_plan")
                    : t("unlimited")}
              </p>
              <p className="text-xs text-gray-500">{t("expiry_date_label")}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(u.premiumExpiresAt)}
              </p>
              {u.premiumPurchasePrice && (
                <p className="text-xs text-gray-400 mt-1">
                  {u.premiumPurchasePrice.toLocaleString()} so'm
                </p>
              )}
            </div>
          </div>
        ))}
        {premiumUsers.length === 0 && (
          <p className="text-gray-500 text-center py-4">
            {t("no_premium_users")}
          </p>
        )}
      </div>
    </div>
  );
}
