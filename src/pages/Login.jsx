import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("Engineer");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // If already logged in, redirect
        if (localStorage.getItem("waterflow_auth") === "true") {
            navigate("/dashboard");
        }
    }, [navigate]);

    const handleLogin = (e) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);

        // Simulate network delay
        setTimeout(() => {
            localStorage.setItem("waterflow_auth", "true");
            localStorage.setItem("waterflow_role", role);
            navigate("/dashboard");
        }, 1200);
    };

    return (
        <div className="loginWrapper">
            <div className="loginLeft">
                <div className="loginBrand">
                    <span style={{ fontSize: "32px", marginRight: "12px" }}>💧</span>
                    <div>
                        <div style={{ fontSize: "28px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>WaterFlow</div>
                        <div style={{ fontSize: "14px", color: "#cbd5e1", marginTop: "4px" }}>Smart Pipeline System</div>
                    </div>
                </div>
                <div className="loginShowcase">
                    <div style={{ fontSize: "42px", fontWeight: 900, marginBottom: "16px", lineHeight: "1.2" }}>
                        Secure.<br />Intelligent.<br />Monitoring.
                    </div>
                    <div style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "340px", lineHeight: "1.6" }}>
                        Real-time analytics, automated preventive maintenance, and robust data management for municipal pipeline infrastructure.
                    </div>
                </div>
            </div>

            <div className="loginRight">
                <div className="loginCard">
                    <div style={{ textAlign: "center", marginBottom: "32px" }}>
                        <div style={{ fontSize: "24px", fontWeight: 900, color: "var(--text)" }}>Welcome Back</div>
                        <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "6px" }}>
                            Sign in to manage the continuous flow.
                        </div>
                    </div>

                    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 800, marginBottom: "8px", color: "var(--text)" }}>
                                User Role
                            </label>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    type="button"
                                    onClick={() => setRole("Engineer")}
                                    style={{
                                        flex: 1, padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: 800,
                                        cursor: "pointer", transition: "all 0.2s",
                                        border: role === "Engineer" ? "2px solid var(--primary)" : "2px solid #e2e8f0",
                                        background: role === "Engineer" ? "#eff6ff" : "transparent",
                                        color: role === "Engineer" ? "var(--primary)" : "var(--muted)"
                                    }}
                                >
                                    🛠️ Engineer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("Administrator")}
                                    style={{
                                        flex: 1, padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: 800,
                                        cursor: "pointer", transition: "all 0.2s",
                                        border: role === "Administrator" ? "2px solid var(--primary)" : "2px solid #e2e8f0",
                                        background: role === "Administrator" ? "#eff6ff" : "transparent",
                                        color: role === "Administrator" ? "var(--primary)" : "var(--muted)"
                                    }}
                                >
                                    🛡️ Admin
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 800, marginBottom: "8px", color: "var(--text)" }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="Ex: ops@waterflow.com"
                                className="input"
                                style={{ width: "100%", padding: "14px", fontSize: "14px" }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 800, marginBottom: "8px", color: "var(--text)" }}>
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="Enter your security token"
                                className="input"
                                style={{ width: "100%", padding: "14px", fontSize: "14px" }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px", fontWeight: 700 }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn primary"
                            style={{ width: "100%", padding: "14px", fontSize: "15px", marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center" }}
                            disabled={loading}
                        >
                            {loading ? "Authenticating..." : "Secure Login"}
                        </button>
                    </form>

                    <div style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "var(--muted)" }}>
                        For emergency system access authorization,<br />please contact the IT department.
                    </div>
                </div>
            </div>

            <style>{`
        .loginWrapper {
          display: flex;
          min-height: 100vh;
          background: #f8fafc;
        }
        .loginLeft {
          flex: 1;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 60px;
          display: flex;
          flex-direction: column;
          position: relative;
          color: #fff;
        }
        .loginBrand {
          display: flex;
          align-items: center;
        }
        .loginShowcase {
          margin-top: auto;
          margin-bottom: auto;
          animation: slideUp 0.6s ease-out;
        }
        .loginRight {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .loginCard {
          background: #fff;
          width: 100%;
          max-width: 440px;
          padding: 48px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.1);
          animation: fadeIn 0.4s ease-out;
        }
        
        @media (max-width: 900px) {
          .loginLeft { display: none; }
          .loginRight { padding: 20px; }
          .loginCard { padding: 32px; border-radius: 16px; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
