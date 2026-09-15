/**
 * TDTU-TKNT Shared Firebase Authentication Module
 * Project: tknt-tdtu
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

let app = null;
let auth = null;
const googleProvider = new GoogleAuthProvider();

export async function getFirebaseConfig() {
  try {
    const res = await fetch('/__/firebase/init.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[auth-shared] Không tải được /__/firebase/init.json, sử dụng fallback config', e);
  }
  // Fallback cấu hình cho dự án tknt-tdtu
  return {
    authDomain: "tknt-tdtu.firebaseapp.com",
    projectId: "tknt-tdtu"
  };
}

export async function initAuth() {
  if (!auth) {
    const config = await getFirebaseConfig();
    app = initializeApp(config);
    auth = getAuth(app);
  }
  return auth;
}

export async function loginWithGoogle() {
  const authInstance = await initAuth();
  return await signInWithPopup(authInstance, googleProvider);
}

export async function logout() {
  const authInstance = await initAuth();
  return await signOut(authInstance);
}

export async function subscribeAuth(callback) {
  const authInstance = await initAuth();
  return onAuthStateChanged(authInstance, callback);
}
