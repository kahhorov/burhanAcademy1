import React, { useEffect, useState, Children } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Star, PlayCircle, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
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
export function FreeCourses() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const levelFilter = searchParams.get('level');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(levelFilter || 'all');
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'courses'), where('isPaid', '==', false));
        const snapshot = await getDocs(q);
        let coursesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        if (activeFilter !== 'all') {
          coursesData = coursesData.filter((c) => c.level === activeFilter);
        }
        setCourses(coursesData);
      } catch (error) {
        console.error('Error fetching free courses:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [activeFilter]);
  const filters = [
  {
    id: 'all',
    label: 'Barcha darslar'
  },
  {
    id: 'beginner',
    label: t('beginner')
  },
  {
    id: 'intermediate',
    label: t('intermediate')
  },
  {
    id: 'advanced',
    label: t('advanced')
  }];

  const containerVariants = {
    hidden: {
      opacity: 0
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1a] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            Demo <span className="text-amber-500">darslar</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Bepul darslarimiz orqali ta'lim sifatini sinab ko'ring va
            o'rganishni boshlang.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {filters.map((filter) =>
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === filter.id ? 'bg-teal-600 text-white shadow-md' : 'bg-white dark:bg-[#111827] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'}`}>

              {filter.label}
            </button>
          )}
        </div>

        {loading ?
        <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div> :
        courses.length > 0 ?
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {courses.map((course) =>
          <motion.div
            key={course.id}
            variants={itemVariants}
            className="h-full">

                <Link
              to={`/courses/${course.id}`}
              className="bg-white dark:bg-[#111827] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">

                  <div className="h-48 bg-teal-900 relative overflow-hidden flex items-center justify-center">
                    {course.thumbnailUrl ?
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :


                <div className="text-6xl text-white/20">ب</div>
                }
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold shadow-sm bg-green-500 text-white">
                        {t('free')}
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
                        <span>{course.rating || '4.9'}</span>
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
                            {course.lessonsCount || 0} {t('lessons')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>3400+</span>
                        </div>
                      </div>
                      <div className="font-bold text-green-600 dark:text-green-400">
                        {t('free')}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
          )}
          </motion.div> :

        <div className="text-center py-20 bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Hali bepul darsliklar yo'q
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tez orada yangi bepul darslar qo'shiladi.
            </p>
          </div>
        }
      </div>
    </div>);

}