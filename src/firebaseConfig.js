// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0S5KHpg26off537YxJKxeg3nEClBoSi4",
  authDomain: "alexanderlehnbom-507fd.firebaseapp.com",
  projectId: "alexanderlehnbom-507fd",
  storageBucket: "alexanderlehnbom-507fd.appspot.com",
  messagingSenderId: "49690909662",
  appId: "1:49690909662:web:768be2d438b4dd34f11b4f",
  measurementId: "G-68V09J4FWY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the Firestore service
export const db = getFirestore(app);
