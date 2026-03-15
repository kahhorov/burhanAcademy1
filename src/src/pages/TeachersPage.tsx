import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Award } from 'lucide-react';
interface Teacher {
  id: string;
  name: string;
  bio: {
    uz: string;
    ru: string;
    en: string;
  };
  photoUrl: string;
  specialization: {
    uz: string;
    ru: string;
    en: string;
  };
  experience: string;
}
export function TeachersPage() {
  const { t, i18n } = useTranslation();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'teachers'));
        const teachersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Teacher[];
        setTeachers(teachersData);
      } catch (error) {
        console.error('Error fetching teachers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);
  const getLocalizedText = (obj: any) => {
    if (!obj) return '';
    return obj[i18n.language] || obj.uz || '';
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1a] py-16 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#0d9488 2px, transparent 2px)',
          backgroundSize: '30px 30px'
        }}>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-sm font-medium mb-4">
            {t('teachers')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('our_teachers').split(' ')[0]}{' '}
            <span className="text-amber-500">
              {t('our_teachers').split(' ').slice(1).join(' ')}
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
            {t('teachers_desc')}
          </p>
        </div>

        {loading ?
        <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div> :
        teachers.length > 0 ?
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {teachers.map((teacher) =>
          <div
            key={teacher.id}
            className="bg-white dark:bg-[#111827] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all duration-300 group flex flex-col">

                <div className="h-64 bg-teal-50 dark:bg-teal-900/20 relative overflow-hidden flex items-center justify-center">
                  {teacher.photoUrl ?
              <img
                src={teacher.photoUrl}
                alt={teacher.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :


              <div className="text-6xl text-teal-600/20 flex items-center justify-center w-full h-full bg-teal-100 dark:bg-teal-900/40">
                      {teacher.name.charAt(0)}
                    </div>
              }
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-teal-600 dark:text-teal-400 shadow-sm">
                    {getLocalizedText(teacher.specialization)}
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {teacher.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 flex-grow line-clamp-3">
                    {getLocalizedText(teacher.bio)}
                  </p>
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>
                        {teacher.experience} {t('experience').toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
          )}
          </div> :

        <div className="text-center py-20 bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t('no_teachers')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tez orada o'qituvchilar ro'yxati qo'shiladi.
            </p>
          </div>
        }
      </div>
    </div>);

}