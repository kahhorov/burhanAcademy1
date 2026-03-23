import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyB8yH50871bieYPWiVscqiH3H6K9WSXpbY',
  authDomain: 'burhanacademy-af6ea.firebaseapp.com',
  projectId: 'burhanacademy-af6ea',
  storageBucket: 'burhanacademy-af6ea.firebasestorage.app',
  messagingSenderId: '659578083214',
  appId: '1:659578083214:web:39e83471d20038388db6df'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();