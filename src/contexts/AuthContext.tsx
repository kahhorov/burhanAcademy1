import React, { useEffect, useState, createContext, useContext } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential } from
'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot } from
'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { toast } from 'sonner';
interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isPremium: boolean;
  premiumExpiresAt: any;
  isBlocked: boolean;
  purchasedCourses: string[];
  hasOnlineClassAccess: boolean;
  userProgress: Record<string, any>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (
  email: string,
  pass: string,
  name: string)
  => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateAdminCredentials: (
  currentPassword: string,
  newEmail?: string,
  newPassword?: string)
  => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [purchasedCourses, setPurchasedCourses] = useState<string[]>([]);
  const [hasOnlineClassAccess, setHasOnlineClassAccess] = useState(false);
  const [userProgress, setUserProgress] = useState<Record<string, any>>({});
  const checkPremiumExpiration = async (userId: string, expiresAt: any) => {
    if (!expiresAt) return false;
    const now = new Date();
    const expirationDate = expiresAt.toDate ?
    expiresAt.toDate() :
    new Date(expiresAt);
    if (now > expirationDate) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          isPremium: false,
          premiumExpiresAt: null
        });
        toast.info("Premium ta'rifingiz muddati tugadi.");
        return true;
      } catch (e) {
        console.error('Failed to update expired premium', e);
      }
    }
    return false;
  };
  const fetchUserData = async (currentUser: User) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const isUserAdmin =
      currentUser.email === 'maqsadjon@gmail.com' ||
      userDoc.exists() && userDoc.data().isAdmin === true;
      const isUserTeacher =
      userDoc.exists() && userDoc.data().isTeacher === true;
      setIsAdmin(isUserAdmin);
      setIsTeacher(isUserTeacher);
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.isBlocked) {
          await signOut(auth);
          toast.error('Sizning hisobingiz bloklangan. Tizimga kira olmaysiz.', {
            style: {
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #f87171'
            }
          });
          setUser(null);
          setIsBlocked(true);
          return;
        }
        setIsBlocked(false);
        let currentPremiumStatus = data.isPremium || false;
        if (currentPremiumStatus && data.premiumExpiresAt) {
          const isExpired = await checkPremiumExpiration(
            currentUser.uid,
            data.premiumExpiresAt
          );
          if (isExpired) currentPremiumStatus = false;
        }
        setIsPremium(currentPremiumStatus);
        setPremiumExpiresAt(data.premiumExpiresAt || null);
        setPurchasedCourses(data.purchasedCourses || []);
        setHasOnlineClassAccess(data.hasOnlineClassAccess || false);
        if (currentUser.email === 'maqsadjon@gmail.com' && !data.isAdmin) {
          try {
            await updateDoc(userDocRef, {
              isAdmin: true
            });
          } catch (e) {
            console.warn('Could not update admin flag:', e);
          }
        }
      } else {
        try {
          await setDoc(userDocRef, {
            email: currentUser.email,
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            isPremium: false,
            purchasedCourses: [],
            hasOnlineClassAccess: false,
            isAdmin: isUserAdmin,
            isTeacher: false,
            isBlocked: false,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Could not create user doc:', e);
        }
        setIsPremium(false);
        setPurchasedCourses([]);
        setHasOnlineClassAccess(false);
        setIsBlocked(false);
      }
    } catch (error: any) {
      console.warn('Error fetching user data:', error);
      if (currentUser.email === 'maqsadjon@gmail.com') setIsAdmin(true);
      setIsPremium(false);
      setPurchasedCourses([]);
      setHasOnlineClassAccess(false);
    }
  };
  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await fetchUserData(currentUser);
        if (!isBlocked) {
          setUser(currentUser);
          unsubscribeSnapshot = onSnapshot(
            doc(db, 'users', currentUser.uid),
            async (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.isBlocked) {
                  signOut(auth);
                  setUser(null);
                  setIsBlocked(true);
                  toast.error('Sizning hisobingiz bloklandi.', {
                    style: {
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #f87171'
                    }
                  });
                } else {
                  setIsBlocked(false);
                  setIsTeacher(data.isTeacher === true);
                  let currentPremiumStatus = data.isPremium || false;
                  if (currentPremiumStatus && data.premiumExpiresAt) {
                    const isExpired = await checkPremiumExpiration(
                      currentUser.uid,
                      data.premiumExpiresAt
                    );
                    if (isExpired) currentPremiumStatus = false;
                  }
                  setIsPremium(currentPremiumStatus);
                  setPremiumExpiresAt(data.premiumExpiresAt || null);
                  setPurchasedCourses(data.purchasedCourses || []);
                  setHasOnlineClassAccess(data.hasOnlineClassAccess || false);
                }
              }
            }
          );
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsTeacher(false);
        setIsPremium(false);
        setPurchasedCourses([]);
        setHasOnlineClassAccess(false);
        setUserProgress({});
      }
      setLoading(false);
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);
  const refreshUserData = async () => {
    if (user) await fetchUserData(user);
  };
  const login = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await fetchUserData(res.user);
      if (!isBlocked) toast.success('Muvaffaqiyatli kirdingiz');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error(
          'Google login uchun domenni Firebase Console da ruxsat bering.'
        );
      } else if (
      error.code !== 'auth/popup-closed-by-user' &&
      error.code !== 'auth/cancelled-popup-request')
      {
        toast.error('Google orqali kirishda xatolik yuz berdi');
      }
      throw error;
    }
  };
  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await fetchUserData(res.user);
      if (!isBlocked) toast.success('Muvaffaqiyatli kirdingiz');
    } catch (error: any) {
      console.error(error);
      if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/invalid-credential')
      {
        toast.error("Email yoki parol noto'g'ri.");
      } else {
        toast.error('Tizimga kirishda xatolik yuz berdi.');
      }
      throw error;
    }
  };
  const registerWithEmail = async (
  email: string,
  pass: string,
  name: string) =>
  {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        pass
      );
      await updateProfile(userCredential.user, {
        displayName: name
      });
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        displayName: name,
        isPremium: false,
        purchasedCourses: [],
        hasOnlineClassAccess: false,
        isAdmin: email === 'maqsadjon@gmail.com',
        isTeacher: false,
        isBlocked: false,
        createdAt: serverTimestamp()
      });
      setUser(auth.currentUser);
      setIsPremium(false);
      setPurchasedCourses([]);
      setHasOnlineClassAccess(false);
      if (email === 'maqsadjon@gmail.com') setIsAdmin(true);
      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz");
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use')
      toast.error("Bu email allaqachon ro'yxatdan o'tgan");else
      if (error.code === 'auth/weak-password')
      toast.error("Parol kamida 6 ta belgidan iborat bo'lishi kerak");else
      toast.error("Ro'yxatdan o'tishda xatolik");
      throw error;
    }
  };
  const updateAdminCredentials = async (
  currentPassword: string,
  newEmail?: string,
  newPassword?: string) =>
  {
    if (!user || !user.email) throw new Error('Foydalanuvchi topilmadi');
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      if (newEmail && newEmail !== user.email) {
        await updateEmail(user, newEmail);
        await updateDoc(doc(db, 'users', user.uid), {
          email: newEmail
        });
      }
      if (newPassword) {
        await updatePassword(user, newPassword);
      }
      await auth.currentUser?.reload();
      setUser(auth.currentUser);
      toast.success("Ma'lumotlar muvaffaqiyatli yangilandi");
    } catch (error: any) {
      console.error(error);
      throw new Error('Xatolik yuz berdi: ' + error.message);
    }
  };
  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Tizimdan chiqdingiz');
    } catch (error) {
      toast.error('Chiqishda xatolik yuz berdi');
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isTeacher,
        isPremium,
        premiumExpiresAt,
        isBlocked,
        purchasedCourses,
        hasOnlineClassAccess,
        userProgress,
        login,
        loginWithEmail,
        registerWithEmail,
        logout,
        refreshUserData,
        updateAdminCredentials
      }}>

      {children}
    </AuthContext.Provider>);

}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
  throw new Error('useAuth must be used within an AuthProvider');
  return context;
};