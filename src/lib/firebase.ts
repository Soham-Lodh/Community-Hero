import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Double check environment variables
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
};

// Check if we have valid-looking credentials
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "";

if (!isConfigured) {
  console.warn("Firebase credentials are not fully configured in your environment variables. Please check the Secrets/Environment configuration.");
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true, // Crucial for reliable connections in sandboxed preview frames
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  GET = 'GET',
  LIST = 'LIST',
  WRITE = 'WRITE'
}

export function handleFirestoreError(error: any, operation: OperationType, path: string) {
  console.error(`[Firestore Error] during ${operation} on path [${path}]:`, error);
  throw error;
}

export { app, db, auth, googleProvider };
