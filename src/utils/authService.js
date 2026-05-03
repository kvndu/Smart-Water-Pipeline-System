// authService.js
// Handles simulated authentication for the presentation to avoid SMTP/rate limits.

const AUTH_USERS_KEY = "waterflow_app_users";

// Initialize default users if not exists
export function initAuth() {
  const existing = localStorage.getItem(AUTH_USERS_KEY);
  if (!existing) {
    const initialUsers = [
      {
        id: "USR-001",
        name: "System Admin",
        email: "admin@waterflow.com",
        password: "admin123", // In a real app, this would be hashed
        role: "Administrator",
        status: "Active",
        permissions: ["Admin Dashboard", "Engineer Management", "System Issues", "Access Control"],
      },
      {
        id: "USR-002",
        name: "Field Engineer",
        email: "engineer@waterflow.com",
        password: "engineer123",
        role: "Engineer",
        status: "Active",
        permissions: ["Dashboard", "Pipelines", "Alerts", "Maintenance", "Reports"],
      },
    ];
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(initialUsers));
  }
}

export function getAllUsers() {
  initAuth();
  return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "[]");
}

export function saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

export function login(email, password, role) {
  const users = getAllUsers();
  
  // Map 'admin' from UI to 'Administrator' role in DB
  const searchRole = role.toLowerCase() === "admin" ? "administrator" : role.toLowerCase();

  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password &&
      u.role.toLowerCase() === searchRole
  );

  if (!user) {
    const displayRole = role === "admin" ? "Admin" : "Engineer";
    throw new Error(`Invalid ${displayRole} email or password.`);
  }

  if (user.status !== "Active") {
    throw new Error("Your account has been deactivated. Please contact an Administrator.");
  }

  // Set active session
  localStorage.setItem("waterflow_auth", "true");
  localStorage.setItem("waterflow_role", user.role);
  localStorage.setItem("waterflow_user", user.name);
  localStorage.setItem("waterflow_email", user.email);

  return user;
}

export function logout() {
  localStorage.removeItem("waterflow_auth");
  localStorage.removeItem("waterflow_role");
  localStorage.removeItem("waterflow_user");
  localStorage.removeItem("waterflow_email");
}

export function requestPasswordReset(email) {
  const users = getAllUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    throw new Error("No account found with this email address.");
  }

  if (user.status !== "Active") {
    throw new Error("Cannot reset password for an inactive account.");
  }

  // In a real app, we would send an email with a secure token.
  // For the demo, we will simulate this by storing a temporary token.
  const token = Math.random().toString(36).substring(2, 15);
  localStorage.setItem(`reset_token_${email.toLowerCase()}`, token);
  
  return token; // We return it so the UI can redirect automatically for the demo
}

export function resetPassword(email, token, newPassword) {
  const storedToken = localStorage.getItem(`reset_token_${email.toLowerCase()}`);
  
  if (!storedToken || storedToken !== token) {
    throw new Error("Invalid or expired password reset link.");
  }

  const users = getAllUsers();
  const updatedUsers = users.map((u) => {
    if (u.email.toLowerCase() === email.toLowerCase()) {
      return { ...u, password: newPassword };
    }
    return u;
  });

  saveUsers(updatedUsers);
  localStorage.removeItem(`reset_token_${email.toLowerCase()}`);
}

export function updateUserRoleStatus(id, role, status) {
  const users = getAllUsers();
  const updatedUsers = users.map((u) => {
    if (u.id === id) {
      return { ...u, role, status };
    }
    return u;
  });
  saveUsers(updatedUsers);
}

export function toggleUserPermission(id, permission) {
  const users = getAllUsers();
  const updatedUsers = users.map((user) => {
    if (user.id !== id) return user;
    const hasPermission = user.permissions.includes(permission);
    return {
      ...user,
      permissions: hasPermission
        ? user.permissions.filter((p) => p !== permission)
        : [...user.permissions, permission],
    };
  });
  saveUsers(updatedUsers);
}
