// firebaseConfig.js
import firebase from 'firebase/app';
import 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyD0S5KHpg26off537YxJKxeg3nEClBoSi4",
    authDomain: "alexanderlehnbom-507fd.firebaseapp.com",
    projectId: "alexanderlehnbom-507fd",
    storageBucket: "alexanderlehnbom-507fd.appspot.com",
    messagingSenderId: "49690909662",
    appId: "1:49690909662:web:768be2d438b4dd34f11b4f",
    measurementId: "G-68V09J4FWY"
  };

firebase.initializeApp(firebaseConfig);

export const db = firebase.firestore();
