import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { Layout } from './src/components/Layout';
import { Home } from './src/pages/Home';
import { Courses } from './src/pages/Courses';
import { FreeCourses } from './src/pages/FreeCourses';
import { CourseDetail } from './src/pages/CourseDetail';
import { LessonView } from './src/pages/LessonView';
import { TeachersPage } from './src/pages/TeachersPage';
import { PricingPage } from './src/pages/PricingPage';
import { AuthPage } from './src/pages/AuthPage';
import { AdminPage } from './src/pages/AdminPage';
import { OnlineClassRoom } from './src/pages/OnlineClassRoom';
import './src/lib/i18n';
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors theme="system" />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="courses" element={<Courses />} />
              <Route path="free-courses" element={<FreeCourses />} />
              <Route path="courses/:courseId" element={<CourseDetail />} />
              <Route path="teachers" element={<TeachersPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route path="/lessons/:lessonId" element={<LessonView />} />
            <Route path="/online-class" element={<OnlineClassRoom />} />
            <Route path="/live-chat" element={<OnlineClassRoom />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>);

}