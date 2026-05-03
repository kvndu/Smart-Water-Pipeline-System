import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "../utils/authService";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email || !token) {
      setError("Invalid or missing password reset token.");
    }
  }, [email, token]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      resetPassword(email, token, password);
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
            🔑
          </div>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "28px", fontWeight: "900" }}>
            Create New Password
          </h2>
          <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: "14px", lineHeight: "1.5" }}>
            Please enter your new password below for {email}.
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
              Password has been successfully updated!
            </div>

            <button
              onClick={() => navigate("/login")}
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
              }}
            >
              Go to Login
            </button>
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
              New Password
            </label>

            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!email || !token}
              style={{
                width: "100%",
                padding: "15px",
                marginTop: "8px",
                marginBottom: "16px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
                fontSize: "14px",
                fontWeight: "600",
              }}
            />

            <label style={{ fontSize: "13px", fontWeight: "800", color: "#334155" }}>
              Confirm Password
            </label>

            <input
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!email || !token}
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
              disabled={loading || !email || !token}
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
                opacity: (!email || !token) ? 0.5 : 1,
              }}
            >
              {loading ? "Updating..." : "Update Password"}
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

export default ResetPassword;
