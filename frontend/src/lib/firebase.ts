import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { FIREBASE_CONFIG } from "./env";

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

export { app, auth };
