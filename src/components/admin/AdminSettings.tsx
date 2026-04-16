import React, { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
interface AdminSettingsProps {
  initialSettings: {
    telegramUsername: string;
  };
}
export function AdminSettings({ initialSettings }: AdminSettingsProps) {
  const { t } = useTranslation();
  const { user, updateAdminCredentials } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [adminCreds, setAdminCreds] = useState({
    currentPassword: "",
    newEmail: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    setSettings(initialSettings);
    if (user?.email) {
      setAdminCreds((prev) => ({
        ...prev,
        newEmail: user.email || "",
      }));
    }
  }, [initialSettings, user]);
  const saveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "general"), settings, {
        merge: true,
      });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t("error_occurred"));
    }
  };
  const handleUpdateAdminCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCreds.currentPassword) {
      toast.error(t("current_password_required"));
      return;
    }
    if (
      adminCreds.newPassword &&
      adminCreds.newPassword !== adminCreds.confirmPassword
    ) {
      toast.error(t("passwords_dont_match"));
      return;
    }
    if (adminCreds.newPassword && adminCreds.newPassword.length < 6) {
      toast.error(t("password_min_length"));
      return;
    }
    setIsUpdatingCreds(true);
    try {
      await updateAdminCredentials(
        adminCreds.currentPassword,
        adminCreds.newEmail !== user?.email ? adminCreds.newEmail : undefined,
        adminCreds.newPassword ? adminCreds.newPassword : undefined,
      );
      setAdminCreds((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdatingCreds(false);
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {t("general_settings")}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telegram Username (Admin)
            </label>
            <div className="flex items-center">
              <span className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-xl text-gray-500">
                @
              </span>
              <input
                type="text"
                value={settings.telegramUsername}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    telegramUsername: e.target.value,
                  })
                }
                className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-r-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="burhan_admin"
              />
            </div>
          </div>
          <button
            onClick={saveSettings}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
          >
            {t("save")}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {t("admin_credentials")}
        </h2>
        <form onSubmit={handleUpdateAdminCreds} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("new_email")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={adminCreds.newEmail}
                onChange={(e) =>
                  setAdminCreds({
                    ...adminCreds,
                    newEmail: e.target.value,
                  })
                }
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("new_password")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={adminCreds.newPassword}
                onChange={(e) =>
                  setAdminCreds({
                    ...adminCreds,
                    newPassword: e.target.value,
                  })
                }
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="••••••••"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          {adminCreds.newPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("confirm_new_password")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminCreds.confirmPassword}
                  onChange={(e) =>
                    setAdminCreds({
                      ...adminCreds,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("current_password")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={adminCreds.currentPassword}
                onChange={(e) =>
                  setAdminCreds({
                    ...adminCreds,
                    currentPassword: e.target.value,
                  })
                }
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isUpdatingCreds}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70 flex justify-center items-center"
          >
            {isUpdatingCreds ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              t("update_info")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
