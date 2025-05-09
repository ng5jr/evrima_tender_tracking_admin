// src/pages/SignInPage.js (Create this file inside a 'pages' folder or similar)

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext"; // Import the hook for auth state
import {
  handleGoogleSignIn,
  sendEmailLink,
  signUpWithEmailPassword,
  signInWithEmailPassword,
  resetPassword, // Add this import
} from "../../firebase/firebaseconfig"; // Import your Firebase interaction functions
import "./SignInPage.css"; // Import your CSS styles
import Logo from "../../components/logo";

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingEmailPassword, setLoadingEmailPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false); // Add this state

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

  // Handler for Email/Password Sign-In or Sign-Up
  const handleEmailPasswordAuth = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoadingEmailPassword(true);

    try {
      if (isRegistering) {
        // Registration mode
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }

        await signUpWithEmailPassword(email, password);
        setMessage("Account created successfully! You can now sign in.");
        setIsRegistering(false);
      } else {
        // Login mode
        await signInWithEmailPassword(email, password);
        // Successful login will trigger redirect via useEffect
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoadingEmailPassword(false);
    }
  };

  // Add handler for password reset
  const handlePasswordReset = async () => {
    // Validate there's an email to send reset to
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setError("");
    setMessage("");
    setLoadingReset(true);

    try {
      if (window.confirm("Are you sure you want to reset your password?")) {
        // Proceed with password reset
        await resetPassword(email);
        setMessage("Password reset email sent. Please check your inbox.");
      } else {
        // User canceled the reset
        setError("Password reset canceled.");
      }

    } catch (err) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoadingReset(false);
    }
  };

  // Toggle between sign-in and registration
  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
    setMessage("");
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
      {message && <p className="success-message">{message}</p>}

      {/* Email/Password Authentication Form */}
      <div className="auth-section">
        <h3>{isRegistering ? "Create Account" : "Sign In with Email"}</h3>
        <form className="sign-form" onSubmit={handleEmailPasswordAuth}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.name@ritz-carltonyachtcollection.com"
            required
            disabled={loadingEmailPassword || loadingReset}
            autoComplete="off"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            disabled={loadingEmailPassword || loadingReset}
            autoComplete="off"
          />

          {isRegistering && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
              disabled={loadingEmailPassword}
            />
          )}

          {/* Add Forgot Password link (only show when not registering) */}
          <div className="forgot-password">
            <button type="submit" disabled={loadingEmailPassword}>
              {loadingEmailPassword
                ? "Processing..."
                : isRegistering
                  ? "Create Account"
                  : "Sign In"}
            </button>
            {!isRegistering && (

              <button
                type="button"
                onClick={handlePasswordReset}
                className="text-button"
                disabled={loadingReset || loadingEmailPassword}
              >
                {loadingReset ? "Sending..." : "Forgot Password?"}
              </button>

            )}

          </div>
          <small>
            For users with <b>@ritz-carltonyachtcollection.com</b> emails
          </small>


        </form>

        <div className="mode-toggle">
          <button
            onClick={toggleMode}
            className="text-button"
          >
            {isRegistering
              ? "Already have an account? Sign In"
              : "Need an account? Register"}
          </button>
        </div>
      </div>

      <div className="divider">OR</div>

      {/* Email Link Authentication */}
      {/* <div className="auth-section">
        <h3>Sign In with Email Link</h3>
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
            For users with <b>@ritz-carltonyachtcollection.com</b> emails
          </small>

          <button type="submit" disabled={loadingEmail}>
            {loadingEmail ? "Sending..." : "Send Sign-In Link"}
          </button>
        </form>
        <p>
          <small>Click the link sent to your email to complete sign-in.</small>
        </p>
      </div> */}

      {/* <div className="divider">OR</div> */}

      {/* Google Authentication */}
      <div className="auth-section">
        <button onClick={googleSignInHandler} disabled={loadingGoogle}>
          {loadingGoogle ? "Signing In..." : "Sign In with Google"}
        </button>
        <p>
          <small>Use the designated admin Gmail account.</small>
        </p>
      </div>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default SignInPage;
