import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  uz: {
    translation: {
      home: 'Bosh sahifa',
      courses: 'Kurslar',
      teachers: "O'qituvchilar",
      pricing: 'Narxlar',
      login: 'Kirish',
      start: 'Boshlash',
      hero_title: 'Arab tilini',
      hero_highlight: 'oson',
      hero_subtitle: "o'rganing",
      hero_desc:
      "Zamonaviy interaktiv darslar, professional o'qituvchilar va qulay o'quv tizimi bilan arab tilini boshlang'ichdan mukammal darajagacha o'rganing.",
      free_start: 'Bepul boshlash',
      demo_lesson: "Demo darsni ko'rish",
      students: "O'quvchilar",
      video_lessons: 'Video darslar',
      avg_rating: "O'rtacha baho",
      why_us: 'Nima uchun biz?',
      benefits_title: "O'rganish",
      benefits_highlight: 'afzalliklari',
      benefits_desc:
      "Zamonaviy metodlar va professional o'qituvchilar bilan arab tilini tez va samarali o'rganing",
      level_title: "O'z",
      level_highlight: 'darajangizni',
      level_subtitle: 'tanlang',
      level_desc:
      "Boshlang'ichdan yuqori darajagacha — har bir o'quvchi uchun mos kurs",
      all_courses: "Barcha kurslarni ko'rish",
      no_courses: 'Hali darslar mavjud emas',
      login_required: "Darslarni ko'rish uchun tizimga kiring",
      buy_course: 'Kursni sotib olish',
      free: 'Bepul',
      paid: 'Pullik',
      lessons: 'darslar',
      next_lesson: 'Keyingi dars',
      rate_lesson: 'Darsni baholang',
      logout: 'Chiqish',
      details: 'Batafsil',
      weeks: 'hafta',
      beginner: "Boshlang'ich",
      intermediate: "O'rta daraja",
      advanced: 'Yuqori daraja',
      course_content: 'Kurs tarkibi',
      teacher: "O'qituvchi",
      telegram_contact: "Telegram orqali bog'lanish",
      register: "Ro'yxatdan o'tish",
      email: 'Email',
      password: 'Parol',
      confirm_password: 'Parolni tasdiqlang',
      full_name: "To'liq ism (Foydalanuvchi nomi)",
      or_login_with: 'Yoki ... orqali kiring',
      google_login: 'Google orqali kirish',
      no_account: "Hisobingiz yo'qmi?",
      have_account: 'Hisobingiz bormi?',
      our_teachers: "Bizning o'qituvchilar",
      teachers_desc: "Tajribali va professional o'qituvchilarimiz",
      no_teachers: "Hali o'qituvchilar mavjud emas",
      pricing_title: 'Narxlar',
      pricing_desc: "O'zingizga mos rejani tanlang",
      free_plan: 'Bepul reja',
      paid_plan: 'Premium reja',
      admin_panel: 'Admin panel',
      access_denied: "Ruxsat yo'q",
      save: 'Saqlash',
      delete_confirm: "O'chirishni tasdiqlaysizmi?",
      add_course: "Kurs qo'shish",
      add_lesson: "Dars qo'shish",
      add_teacher: "O'qituvchi qo'shish",
      settings: 'Sozlamalar',
      experience: 'Tajriba',
      specialization: "Yo'nalish",
      blocked_msg: 'Sizning hisobingiz bloklangan. Tizimga kira olmaysiz.'
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'uz',
  fallbackLng: 'uz',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;