
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-6628516125-4d93e",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:854748639823:web:be6bca24b650bebb0d303a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-6628516125-4d93e.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBPrJjnyytshyMXiO3GIcYsgDpC4WlYq3g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-6628516125-4d93e.firebaseapp.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "854748639823",
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
