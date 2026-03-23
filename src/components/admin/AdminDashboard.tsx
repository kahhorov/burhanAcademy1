import React, { useMemo } from 'react';
import { Users, Crown, CircleDollarSign, BookOpen, Video } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar } from
'recharts';
interface AdminDashboardProps {
  users: any[];
  courses: any[];
  lessons: any[];
  premiumPrice: number;
}
export function AdminDashboard({
  users,
  courses,
  lessons,
  premiumPrice
}: AdminDashboardProps) {
  const totalUsersCount = users.length;
  const premiumUsersCount = users.filter((u) => u.isPremium).length;
  const estimatedRevenue = premiumUsersCount * premiumPrice;
  const chartData = useMemo(() => {
    const months = Array.from(
      {
        length: 5
      },
      (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (4 - i));
        return {
          month: d.getMonth(),
          year: d.getFullYear(),
          name: d.toLocaleString('uz-UZ', {
            month: 'short'
          }),
          users: 0,
          total: 0
        };
      }
    );
    users.forEach((u) => {
      if (u.createdAt) {
        const date = u.createdAt.toDate ?
        u.createdAt.toDate() :
        new Date(u.createdAt);
        const m = date.getMonth();
        const y = date.getFullYear();
        const monthObj = months.find((x) => x.month === m && x.year === y);
        if (monthObj) {
          monthObj.users += 1;
          if (u.isPremium) {
            monthObj.total += premiumPrice;
          }
        }
      }
    });
    return months;
  }, [users, premiumPrice]);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Umumiy ko'rsatkichlar
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Jami foydalanuvchilar
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalUsersCount}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Premium obunachilar
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {premiumUsersCount}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Taxminiy tushum
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {estimatedRevenue.toLocaleString()} so'm
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Dars videolar
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lessons?.length || 0}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            Oxirgi 5 oylik tushumlar
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 0
                }}>

                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                  className="dark:stroke-gray-800" />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12
                  }}
                  dy={10} />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12
                  }}
                  tickFormatter={(value) =>
                  value >= 1000000 ?
                  `${(value / 1000000).toFixed(1)}M` :
                  value
                  } />

                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#111827',
                    color: '#fff'
                  }}
                  formatter={(value: number) => [
                  `${value.toLocaleString()} so'm`,
                  'Tushum']
                  } />

                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0d9488"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)" />

              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            Foydalanuvchilar o'sishi (5 oy)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 0
                }}>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                  className="dark:stroke-gray-800" />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12
                  }}
                  dy={10} />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12
                  }}
                  allowDecimals={false} />

                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#111827',
                    color: '#fff'
                  }}
                  cursor={{
                    fill: '#f3f4f6',
                    className: 'dark:fill-gray-800'
                  }} />

                <Bar
                  dataKey="users"
                  name="Yangi foydalanuvchilar"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]} />

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>);

}