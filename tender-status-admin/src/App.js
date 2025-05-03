import React from "react";
// Import your page/view components
import RadioOperatorDashboard from "./pages/operator dashboard/RadioOperatorDashboard";
import FeedbackAnalytics from "./pages/analytics/feedbackanalytics";
import SignInPage from "./pages/signin/SignInPage"; // ** You'll need to create this page **
import EmailLinkLanding from "./pages/EmailLinkLanding"; // ** You'll need to create this page **
// Import routing components
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Import your ProtectedRoute component
import ProtectedRoute from "./components/ProtectedRoute"; // ** Adjust path if needed **

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- Public Routes --- */}
        {/* The Sign-in page is public */}
        <Route path="/signin" element={<SignInPage />} />

        {/* The page that handles the email link verification is public */}
        <Route
          path="/email-link-signin/verify"
          element={<EmailLinkLanding />}
        />
        {/* --- Protected Routes --- */}
        {/* Wrap the elements of routes needing authentication with ProtectedRoute */}
        <Route
          path="/operator"
          element={
            <ProtectedRoute>
              {" "}
              {/* Wrap with ProtectedRoute */}
              <RadioOperatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              {" "}
              {/* Wrap with ProtectedRoute */}
              <FeedbackAnalytics />
            </ProtectedRoute>
          }
        />

        {/* --- Root Path Handling --- */}
        {/* Redirect logged-in users from "/" to "/operator".
            If not logged in, ProtectedRoute will redirect them to "/signin". */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate replace to="/operator" />
            </ProtectedRoute>
          }
        />

        {/* --- Catch-all 404 Route --- */}
        {/* This should usually be the last route */}
        <Route
          path="*"
          element={<div className="not-found">Page Not Found</div>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
