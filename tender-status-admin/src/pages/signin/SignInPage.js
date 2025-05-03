// src/pages/SignInPage.js (Create this file inside a 'pages' folder or similar)

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext"; // Import the hook for auth state
import {
  handleGoogleSignIn,
  sendEmailLink,
} from "../../firebase/firebaseconfig"; // Import your Firebase interaction functions
import "./SignInPage.css"; // Import your CSS styles
import Logo from "../../components/logo";

function SignInPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const { currentUser, loading: authLoading } = useAuth(); // Get user and loading status from context
  const navigate = useNavigate();
  const location = useLocation();

  // Determine where to redirect after login
  const from = location.state?.from?.pathname || "/operator"; // Default to /operator

  // Effect to redirect if user is already logged in
  useEffect(() => {
    // Don't redirect until auth state is confirmed (loading is false)
    if (!authLoading && currentUser) {
      console.log("User already logged in, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [currentUser, authLoading, navigate, from]);

  // Handler for Google Sign-In button
  const googleSignInHandler = async () => {
    setError("");
    setMessage("");
    setLoadingGoogle(true);
    try {
      await handleGoogleSignIn();
      // Successful sign-in will trigger the useEffect above to redirect
      // No need to navigate explicitly here if using context properly
    } catch (err) {
      setError(
        err.message || "Failed to sign in with Google. Please check console."
      );
    } finally {
      setLoadingGoogle(false);
    }
  };

  // Handler for sending the Email Link
  const sendEmailLinkHandler = async (event) => {
    event.preventDefault(); // Prevent default form submission if wrapped in <form>
    setError("");
    setMessage("");
    setLoadingEmail(true);
    try {
      await sendEmailLink(email);
      setMessage(
        "Sign-in link sent successfully! Please check your email inbox (and spam folder)."
      );
      setEmail(""); // Clear the input field
    } catch (err) {
      setError(err.message || "Failed to send sign-in link. Please try again.");
    } finally {
      setLoadingEmail(false);
    }
  };

  // Don't render the sign-in form if auth is still loading or if user exists (before redirect effect kicks in)
  if (authLoading || currentUser) {
    return <div>Loading...</div>; // Or a spinner
  }

  // Render the Sign-In UI
  return (
    <div className="signin-container">
      <Logo /> {/* Logo component */}
      <h2>TENDER STATUS - SIGN IN</h2>
      {message && <p className="success-message">{message}</p>}{" "}
      <div>
        <form onSubmit={sendEmailLinkHandler}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.name@ritz-carltonyachtcollection.com"
            required
            disabled={loadingEmail}
          />

          <small>
            For users with <b> @ritz-carltonyachtcollection.com </b> emails
          </small>

          <button type="submit" disabled={loadingEmail}>
            {loadingEmail ? "Sending..." : "Send Sign-In Link"}
          </button>
        </form>
        <p>
          <small>Click the link sent to your email to complete sign-in.</small>
        </p>
        {error && <p className="error-message">{error}</p>} {/* Style errors */}
      </div>
      <div className="divider">OR</div>
      <div>
        <button onClick={googleSignInHandler} disabled={loadingGoogle}>
          {loadingGoogle ? "Signing In..." : "Sign In with Google"}
        </button>
        <p>
          <small>Use the designated admin Gmail account.</small>
        </p>
      </div>
    </div>
  );
}

export default SignInPage;
