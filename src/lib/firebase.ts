import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);

// Explicitly target the africa-south1 Storage bucket.
// The bucket name is read from the environment variable set in apphosting.yaml
// so it stays in sync across environments without hard-coding.
export const storage = getStorage(
  app,
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ? `gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`
    : undefined,
);

export default app;
