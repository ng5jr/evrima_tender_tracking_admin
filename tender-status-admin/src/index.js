// src/index.js (or wherever you render your App component)

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // Your global styles
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext"; // Import the provider

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      {" "}
      {/* Wrap your App component here */}
      <App />
    </AuthProvider>
  </React.StrictMode>
);
