import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("engineer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const isAuth = localStorage.getItem("waterflow_auth") === "true";
    const savedRole = localStorage.getItem("waterflow_role");

    if (isAuth && savedRole === "Administrator") {
      navigate("/admin-dashboard", { replace: true });
    } else if (isAuth) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleLogin = (e) => {
    e.preventDefault();

    const accounts = {
      engineer: {
        email: "engineer@waterflow.com",
        password: "engineer123",
        roleName: "Engineer",
        userName: "Field Engineer",
        redirectPath: "/dashboard",
      },
      admin: {
        email: "admin@waterflow.com",
        password: "admin123",
        roleName: "Administrator",
        userName: "System Admin",
        redirectPath: "/admin-dashboard",
      },
    };

    const selectedAccount = accounts[role];

    if (
      email.trim().toLowerCase() === selectedAccount.email &&
      password === selectedAccount.password
    ) {
      localStorage.setItem("waterflow_auth", "true");
      localStorage.setItem("waterflow_role", selectedAccount.roleName);
      localStorage.setItem("waterflow_user", selectedAccount.userName);

      navigate(selectedAccount.redirectPath, { replace: true });
    } else {
      alert(`Invalid ${selectedAccount.roleName} email or password`);
    }
  };

  const handleForgotPassword = () => {
    alert("Password reset verification sent to your email.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage:
          'linear-gradient(90deg, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.72) 45%, rgba(2,6,23,0.55) 100%), url("https://www.dwi.gov.uk/wp-content/uploads/2020/10/mini_Blue-pipes-01.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        padding: "70px 90px",
        boxSizing: "border-box",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1.1fr 420px",
          alignItems: "center",
          gap: "80px",
        }}
      >
        <div style={{ color: "#ffffff", maxWidth: "680px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 18px",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              marginBottom: "28px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            <span>💧</span>
            Intelligent Water Infrastructure
          </div>

          <h1
            style={{
              fontSize: "86px",
              lineHeight: "0.95",
              margin: "0 0 22px",
              fontWeight: "900",
              letterSpacing: "-3px",
            }}
          >
            PipeGuard
          </h1>

          <h2
            style={{
              fontSize: "42px",
              lineHeight: "1.15",
              margin: "0 0 22px",
              fontWeight: "800",
              maxWidth: "620px",
            }}
          >
            Real-time pipeline inspection, risk alerts and maintenance control.
          </h2>
        </div>

        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.96)",
            borderRadius: "28px",
            padding: "36px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.38)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: "26px" }}>
            <p
              style={{
                margin: "0 0 8px",
                color: "#0284c7",
                fontSize: "13px",
                fontWeight: "800",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              Secure Access
            </p>

            <h2
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "30px",
                fontWeight: "850",
              }}
            >
              {role === "engineer" ? "Engineer Login" : "Admin Login"}
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              padding: "6px",
              background: "#e2e8f0",
              borderRadius: "16px",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setRole("engineer");
                setEmail("");
                setPassword("");
              }}
              style={{
                flex: 1,
                padding: "13px",
                border: "none",
                borderRadius: "12px",
                background: role === "engineer" ? "#0284c7" : "transparent",
                color: role === "engineer" ? "white" : "#475569",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              Engineer
            </button>

            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setEmail("");
                setPassword("");
              }}
              style={{
                flex: 1,
                padding: "13px",
                border: "none",
                borderRadius: "12px",
                background: role === "admin" ? "#0284c7" : "transparent",
                color: role === "admin" ? "white" : "#475569",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <label style={{ fontSize: "13px", fontWeight: "800" }}>
              Email Address
            </label>

            <input
              type="email"
              placeholder={
                role === "engineer"
                  ? "engineer@waterflow.com"
                  : "admin@waterflow.com"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "15px",
                marginTop: "8px",
                marginBottom: "18px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <label style={{ fontSize: "13px", fontWeight: "800" }}>
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "15px",
                marginTop: "8px",
                marginBottom: "12px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {role === "engineer" && (
              <div style={{ textAlign: "right", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#0284c7",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "16px",
                border: "none",
                borderRadius: "15px",
                background: "linear-gradient(135deg, #0284c7, #0f766e)",
                color: "white",
                fontSize: "15px",
                fontWeight: "900",
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(2,132,199,0.28)",
              }}
            >
              Login as {role === "engineer" ? "Engineer" : "Admin"}
            </button>
          </form>

          <div
            style={{
              marginTop: "22px",
              padding: "15px",
              borderRadius: "16px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#475569",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            <b style={{ color: "#0f172a" }}>Demo Accounts</b>
            <br />
            Engineer: engineer@waterflow.com / engineer123
            <br />
            Admin: admin@waterflow.com / admin123
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;