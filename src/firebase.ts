import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = {
	VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
	VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
	VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
	VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
	VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
	VITE_FIREBASE_APP_ID: firebaseConfig.appId,
};

const missingKeys = Object.entries(requiredConfig)
	.filter(([, value]) => !value)
	.map(([key]) => key);

if (missingKeys.length > 0) {
	throw new Error(
		`Firebase config is missing: ${missingKeys.join(', ')}. Add these keys to your .env.local file.`,
	);
}

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);
