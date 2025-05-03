import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseconfig.js"; // Import your initialized Firebase auth instance

// 1. Create the Context
const AuthContext = createContext();

// 2. Create a custom hook to easily use the context later
export function useAuth() {
  return useContext(AuthContext);
}

// 3. Create the Provider Component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // To track if Firebase has checked auth status initially

  // This effect runs once when the component mounts
  useEffect(() => {
    // Set up the Firebase listener
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // This callback function runs whenever the auth state changes
      // It receives the 'user' object if logged in, or 'null' if logged out
      setCurrentUser(user);
      setLoading(false); // Firebase has now checked, so set loading to false
    });

    // Cleanup function: Unsubscribe from the listener when the component unmounts
    return unsubscribe;
  }, []); // Empty dependency array means this effect runs only once on mount

  // The value object holds the state we want to provide to consuming components
  const value = {
    currentUser,
    loading,
  };

  // Render the Context Provider, passing the value
  // We only render children when not loading to prevent rendering routes
  // before the initial auth check is complete.
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
