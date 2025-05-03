// src/components/ProtectedRoute.js (Create this file)

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Now this import will work!

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth(); // Get state from context
  const location = useLocation();

  // Handle loading state (important!)
  if (loading) {
    // You can return null or a loading spinner while auth state is initializing
    return <div>Loading Authentication...</div>;
  }

  // If loading is false and user exists, render the protected component
  if (currentUser) {
    return children;
  }

  // If loading is false and no user, redirect to sign-in
  // Pass the current location so user can be redirected back after login
  return <Navigate to="/signin" state={{ from: location }} replace />;
}

export default ProtectedRoute;
