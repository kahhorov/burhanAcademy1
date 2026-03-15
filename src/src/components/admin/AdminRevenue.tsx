import React from 'react';
const formatPrice = (price: number) =>
new Intl.NumberFormat('uz-UZ').format(price);
interface AdminRevenueProps {
  users: any[];
  courses: any[];
  premiumPrice: number;
}
export function AdminRevenue({
  users,
  courses,
  premiumPrice
}: AdminRevenueProps) {
  const premiumUsersCount = users.filter((u) => u.isPremium).length;
  const estimatedRevenue = premiumUsersCount * premiumPrice;
  const paidCourses = courses.filter((c) => c.isPaid);
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Tushumlar hisoboti
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-900/30">
          <p className="text-sm font-medium text-green-600/80 dark:text-green-400 mb-1">
            Jami tushum (Premium)
          </p>
          <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
            {formatPrice(estimatedRevenue)} so'm
          </h3>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
          <p className="text-sm font-medium text-blue-600/80 dark:text-blue-400 mb-1">
            Premium obunalar
          </p>
          <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {premiumUsersCount} ta
          </h3>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30">
          <p className="text-sm font-medium text-amber-600/80 dark:text-amber-400 mb-1">
            Premium narxi
          </p>
          <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">
            {formatPrice(premiumPrice)} so'm
          </h3>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Kurslar bo'yicha tushum
      </h3>
      <div className="space-y-3 mb-8">
        {paidCourses.map((course) => {
          const purchasedCount = users.filter((u) =>
          u.purchasedCourses?.includes(course.id)
          ).length;
          const courseRevenue = purchasedCount * (course.price || 0);
          return (
            <div
              key={course.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111827]">

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {course.title}
                </h4>
                <p className="text-sm text-gray-500">
                  {purchasedCount} ta sotib olgan
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600 dark:text-green-400">
                  {formatPrice(courseRevenue)} so'm
                </p>
                <p className="text-xs text-gray-500">
                  {formatPrice(course.price)} so'm/kurs
                </p>
              </div>
            </div>);

        })}
        {paidCourses.length === 0 &&
        <p className="text-gray-500 text-center py-8">Pullik kurslar yo'q</p>
        }
      </div>
    </div>);

}