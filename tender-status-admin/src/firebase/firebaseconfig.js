// src/firebase/firebaseconfig.js  (Or maybe rename to firebase.js or firebaseUtils.js)

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider, // Import GoogleAuthProvider
  signInWithPopup, // Import signInWithPopup
  signOut, // Import signOut
  sendSignInLinkToEmail, // Import sendSignInLinkToEmail
  isSignInWithEmailLink, // Import isSignInWithEmailLink (needed for completeEmailLinkSignIn)
  signInWithEmailLink, // Import signInWithEmailLink (needed for completeEmailLinkSignIn)
  onAuthStateChanged, // Keep this if used elsewhere or in context
  createUserWithEmailAndPassword, // Add this import
  signInWithEmailAndPassword, // Add this import
  sendPasswordResetEmail, // Add this import
} from "firebase/auth";

// --- Your Firebase Config from .env ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);

// --- Initialize Services ---
const auth = getAuth(app);
const db = getFirestore(app);
const googleAuthProvider = new GoogleAuthProvider(); // Initialize Google provider

// --- Define and Export Auth Functions ---

// Gmail Sign-In (Restricted)
const ALLOWED_GMAIL = "evrimatenderrcyc@gmail.com"; // Make sure this is correct

export const handleGoogleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const user = result.user;

    if (user.email !== ALLOWED_GMAIL) {
      await signOut(auth); // Sign out unauthorized user
      throw new Error("This Google account is not authorized for access.");
    }
    // If successful and allowed, the user is signed in.
    // Auth state change will be handled by onAuthStateChanged listener (in AuthContext)
  } catch (error) {
    console.error("Error signing in with Google:", error);
    // Re-throw a more specific error or the original one
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled.");
    }
    throw error; // Re-throw for the component to catch
  }
};

// Sign Out
export const handleSignOut = async () => {
  // Ensure this is exported if needed elsewhere
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

// Email Link Sign-In (Domain Restricted)
const allowedDomain = "@ritz-carltonyachtcollection.com";

const actionCodeSettings = (redirectUrl) => ({
  // URL must be whitelisted in the Firebase Console -> Authentication -> Settings -> Authorized domains
  // Use the provided redirectUrl which should match where your EmailLinkLanding component is mounted
  url: redirectUrl,
  handleCodeInApp: true,
});

export const sendEmailLink = async (
  email /* No redirectUrl param needed here now */
) => {
  // ... (your existing domain validation for email) ...
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new Error("Invalid email format provided.");
  }
  if (!email.toLowerCase().endsWith(allowedDomain)) {
    throw new Error(`Only ${allowedDomain} email addresses are allowed.`);
  }

  // --- DYNAMICALLY CREATE REDIRECT URL ---
  // window.location.origin gives you the base URL (e.g., "http://localhost:3000" or "https://admin.Evrimatenderstatus.com")
  const redirectUrl = `${window.location.origin}/email-link-signin/verify`;
  console.log("SENDING LINK - Using redirectUrl:", redirectUrl); // Keep this for debugging
  // ---------------------------------------

  // Make sure the domain part of this 'redirectUrl' (e.g., localhost OR admin.Evrimatenderstatus.com)
  // is listed in your Firebase Authentication -> Settings -> Authorized domains.

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings(redirectUrl));
    window.localStorage.setItem("emailForSignIn", email);
  } catch (error) {
    console.error("Error sending email link:", error);
    // Check specifically for auth/unauthorized-continue-uri again just in case
    if (error.code === "auth/unauthorized-continue-uri") {
      console.error(
        `Ensure the domain of "${redirectUrl}" is added to Firebase Authorized Domains.`
      );
    }
    throw new Error("Failed to send sign-in link. Please try again later.");
  }
};

// Complete Email Link Sign-In (Needs to be called from the landing page)
export const completeEmailLinkSignIn = async (url = window.location.href) => {
  if (isSignInWithEmailLink(auth, url)) {
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      // User opened the link on a different device/browser. Prompt for email.
      // You'll need a UI prompt instead of window.prompt in a real app
      email = window.prompt("Please provide your email for confirmation:");
      if (!email) {
        throw new Error("Email confirmation is required to complete sign-in.");
      }
    }

    try {
      const result = await signInWithEmailLink(auth, email, url);
      window.localStorage.removeItem("emailForSignIn"); // Clean up stored email
      console.log("Email link sign-in success:", result.user);
      return result.user; // Return the user object on success
    } catch (error) {
      console.error("Error completing email link sign-in:", error);
      window.localStorage.removeItem("emailForSignIn"); // Clean up even on error
      // Provide more specific errors based on error.code
      throw new Error(
        "Failed to sign in with email link. The link may be invalid or expired."
      );
    }
  } else {
    throw new Error("Invalid sign-in link."); // Or handle non-link access gracefully
  }
};

// Email domain validation helper
const validateRitzCarltonEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new Error("Invalid email format provided.");
  }
  if (!email.toLowerCase().endsWith(allowedDomain)) {
    throw new Error(`Only ${allowedDomain} email addresses are allowed.`);
  }
  return true;
};

// Email/Password Sign Up (Domain Restricted)
export const signUpWithEmailPassword = async (email, password) => {
  try {
    // Validate the email domain
    validateRitzCarltonEmail(email);

    // Create the user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error during email/password sign up:", error);

    // Return more user-friendly error messages
    if (error.code === "auth/email-already-in-use") {
      throw new Error("This email is already registered. Please sign in instead.");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use at least 6 characters.");
    }

    throw error; // Re-throw other errors
  }
};

// Email/Password Sign In (Domain Restricted)
export const signInWithEmailPassword = async (email, password) => {
  try {
    // Validate the email domain
    validateRitzCarltonEmail(email);

    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error during email/password sign in:", error);

    // Return more user-friendly error messages
    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      throw new Error("Invalid email or password. Please try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many unsuccessful login attempts. Please try again later.");
    }

    throw error; // Re-throw other errors
  }
};

// Add this new function for password reset
export const resetPassword = async (email) => {
  try {
    // Validate the email domain
    validateRitzCarltonEmail(email);

    // Send password reset email
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);

    if (error.code === "auth/user-not-found") {
      throw new Error("No account exists with this email address.");
    }

    throw error;
  }
};

// --- Export Core Services ---
export {
  auth,
  db,
  googleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  // Include the new exports
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
}; // Include all necessary exports
// Note: We also exported handleGoogleSignIn, handleSignOut, sendEmailLink, completeEmailLinkSignIn above
