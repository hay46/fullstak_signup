import React, { useState } from "react";
import axios from "axios";
import "./Signup.css";

function Auth() {
  // State Management
  const [isSignIn, setIsSignIn] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  // Toggle between Sign In and Sign Up
  const toggleAuthMode = () => {
    setIsSignIn(!isSignIn);
    resetForm();
  };

  // Event Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!isSignIn && !formData.username) {
      alert("❌ Please fill in all fields");
      return;
    }

    if (!formData.email || !formData.password) {
      alert("❌ Please fill in all fields");
      return;
    }

    if (!isSignIn && formData.password.length < 6) {
      alert("❌ Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isSignIn
        ? "http://localhost:5000/signin"
        : "http://localhost:5000/signup";

      const payload = isSignIn
        ? {
            email: formData.email,
            password: formData.password,
          }
        : {
            username: formData.username,
            email: formData.email,
            password: formData.password,
          };

      const res = await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      handleResponse(res.data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper Functions
  const handleResponse = (data) => {
    if (data.success) {
      alert("✅ " + data.message);
      resetForm();
      // You can redirect user or store token here
      if (isSignIn) {
        console.log("User signed in:", data.user);
        // Store user data for future use
        localStorage.setItem("user", JSON.stringify(data.user));
        // Redirect or update app state here
      }
    } else {
      alert("❌ " + (data.error || "Authentication failed!"));
    }
  };

  const handleError = (err) => {
    console.error("Auth error:", err);

    if (err.response) {
      const errorMessage = err.response.data?.error || "Authentication failed!";
      alert(`❌ Error: ${errorMessage}`);
    } else if (err.request) {
      alert(
        "❌ Network error: Cannot connect to server. Please check if the server is running."
      );
    } else {
      alert("❌ Authentication failed: " + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
    });
  };

  // Form Configuration
  const signUpFields = [
    {
      id: "username",
      label: "Username",
      type: "text",
      placeholder: "Enter your username",
      required: true,
    },
    {
      id: "email",
      label: "Email Address",
      type: "email",
      placeholder: "Enter your email",
      required: true,
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      placeholder: "Enter your password (min. 6 characters)",
      required: true,
      minLength: 6,
    },
  ];

  const signInFields = [
    {
      id: "email",
      label: "Email Address",
      type: "email",
      placeholder: "Enter your email",
      required: true,
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      placeholder: "Enter your password",
      required: true,
    },
  ];

  const currentFields = isSignIn ? signInFields : signUpFields;

  return (
    <>
      {/* Header Section */}
      <div className="create-account-this">
        <h1 className="create-account">
          {isSignIn ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="create-and-join">
          {isSignIn
            ? "Please sign in to your account"
            : "Please create this account and join"}
        </p>
      </div>

      {/* Form Section */}
      <div className="signup-container">
        <form id="authForm" onSubmit={handleSubmit} noValidate>
          {currentFields.map((field) => (
            <div key={field.id} className="input-group">
              <label htmlFor={field.id}>{field.label}</label>
              <input
                type={field.type}
                id={field.id}
                name={field.id}
                placeholder={field.placeholder}
                value={formData[field.id]}
                onChange={handleChange}
                required={field.required}
                minLength={field.minLength}
                disabled={loading}
              />
            </div>
          ))}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading
              ? isSignIn
                ? "Signing In..."
                : "Creating Account..."
              : isSignIn
              ? "Sign In"
              : "Sign Up"}
          </button>

          {/* Toggle between Sign In and Sign Up */}
          <div className="auth-toggle">
            <p>
              {isSignIn
                ? "Don't have an account? "
                : "Already have an account? "}
              <span className="toggle-link" onClick={toggleAuthMode}>
                {isSignIn ? "Sign Up" : "Sign In"}
              </span>
            </p>
          </div>

          <p id="message"></p>
        </form>
      </div>
    </>
  );
}

export default Auth;
