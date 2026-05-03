import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { requestPasswordReset } from "../utils/authService";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resetToken = requestPasswordReset(email);
      setToken(resetToken);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "36px",
          boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
          boxSizing: "border-box",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "20px",
              background: "#e0f2fe",
              color: "#0284c7",
              display: "grid",
              placeItems: "center",
              fontSize: "28px",
              margin: "0 auto 20px",
            }}
          >
            🔒
          </div>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "28px", fontWeight: "900" }}>
            Reset Password
          </h2>
          <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: "14px", lineHeight: "1.5" }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                padding: "20px",
                background: "#dcfce7",
                color: "#166534",
                borderRadius: "16px",
                fontSize: "14px",
                fontWeight: "700",
                marginBottom: "24px",
                border: "1px solid #86efac",
              }}
            >
              Check your email! We've sent a password reset link to {email}.
            </div>

            <button
              onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}&token=${token}`)}
              style={{
                width: "100%",
                padding: "16px",
                border: "none",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                color: "white",
                fontSize: "14px",
                fontWeight: "900",
                cursor: "pointer",
                marginBottom: "16px",
                boxShadow: "0 10px 20px rgba(22,163,74,0.2)",
              }}
            >
              [Demo] Click to open email link
            </button>

            <Link
              to="/login"
              style={{
                display: "block",
                color: "#64748b",
                textDecoration: "none",
                fontWeight: "800",
                fontSize: "14px",
              }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: "12px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: "800",
                  marginBottom: "20px",
                  border: "1px solid #f87171",
                }}
              >
                {error}
              </div>
            )}

            <label style={{ fontSize: "13px", fontWeight: "800", color: "#334155" }}>
              Email Address
            </label>

            <input
              type="email"
              placeholder="engineer@waterflow.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "15px",
                marginTop: "8px",
                marginBottom: "24px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
                fontSize: "14px",
                fontWeight: "600",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                border: "none",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0284c7, #0f766e)",
                color: "white",
                fontSize: "15px",
                fontWeight: "900",
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(2,132,199,0.28)",
                marginBottom: "20px",
              }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div style={{ textAlign: "center" }}>
              <Link
                to="/login"
                style={{
                  color: "#64748b",
                  textDecoration: "none",
                  fontWeight: "800",
                  fontSize: "14px",
                }}
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
