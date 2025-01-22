// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
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
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const analytics = getAnalytics(app);
