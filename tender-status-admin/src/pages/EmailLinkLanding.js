// src/pages/EmailLinkLanding.js (Create this file)

import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom"; // Import Link for error state
import { completeEmailLinkSignIn } from "../firebase/firebaseconfig"; // Import your function

function EmailLinkLanding() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // This effect runs once when the component mounts
  useEffect(() => {
    const finishSignIn = async () => {
      // Check if the current URL is actually a sign-in link
      // The completeEmailLinkSignIn function already includes 'isSignInWithEmailLink' check
      try {
        // Attempt to complete the sign-in process using the current URL
        // This function handles getting the email (from storage/prompt)
        // and signing the user in.
        const user = await completeEmailLinkSignIn(window.location.href);

        // If successful, user object is returned (though often auth context handles the update)
        console.log(
          "Sign in successful, navigating to operator dashboard",
          user
        );

        // Redirect to the main dashboard or intended page after successful sign-in
        // 'replace: true' removes this verification page from browser history
        navigate("/operator", { replace: true });
      } catch (err) {
        // Handle errors (e.g., invalid link, expired link, email mismatch)
        console.error("Error during email link sign-in completion:", err);
        setError(
          err.message ||
            "Failed to sign in. The link might be invalid or expired. Please try requesting a new link."
        );
        setLoading(false); // Stop loading indicator on error
      }
      // No need to setLoading(false) in the success case because we navigate away
    };

    finishSignIn();

    // No cleanup needed for this effect as it runs once and navigates or errors out.
  }, [navigate]); // Dependency array includes navigate

  // Render based on state
  if (loading) {
    return <div>Verifying your sign-in link, please wait...</div>; // Or a loading spinner
  }

  if (error) {
    return (
      <div>
        <h1>Sign-In Error</h1>
        <p style={{ color: "red" }}>{error}</p>
        <p>
          Please return to the <Link to="/signin">Sign In page</Link> to request
          a new link.
        </p>
      </div>
    );
  }

  // Should ideally not reach here if success leads to navigation
  // But as a fallback:
  return (
    <div>
      Processing complete. If you are not redirected, please go to the
      dashboard.
    </div>
  );
}

export default EmailLinkLanding;
