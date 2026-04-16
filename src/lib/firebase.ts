import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAb4fPX5kphPqL7WFH-WaNlriCxeUD_Gpc",
  authDomain: "burhanacademy-6b944.firebaseapp.com",
  projectId: "burhanacademy-6b944",
  storageBucket: "burhanacademy-6b944.firebasestorage.app",
  messagingSenderId: "181357584562",
  appId: "1:181357584562:web:a46f51a8e958f190cde9ab",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase persistence set to LOCAL");
  })
  .catch((err) => {
    console.error("Firebase persistence error:", err);
  });

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
