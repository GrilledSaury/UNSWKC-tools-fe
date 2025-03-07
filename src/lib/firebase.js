// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDdZ_18LD-g43jQank7noAc5v-kgHGxWwg",
  authDomain: "unswkc-tools.firebaseapp.com",
  projectId: "unswkc-tools",
  storageBucket: "unswkc-tools.firebasestorage.app",
  messagingSenderId: "298646554098",
  appId: "1:298646554098:web:09d8727beb9221f4b9176b",
  measurementId: "G-9GGXPNNGVX"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const db = getFirestore()
export const auth = getAuth()
export const storage = getStorage(app)
const analytics = getAnalytics(app)
