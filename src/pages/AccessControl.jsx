import { useMemo, useState, useEffect } from "react";
import { getAllUsers, updateUserRoleStatus, toggleUserPermission } from "../utils/authService";

const permissionOptions = [
  "Admin Dashboard",
  "Engineer Management",
  "System Issues",
  "Access Control",
  "Dashboard",
  "Pipelines",
  "Alerts",
  "Maintenance",
  "Risk Calculator",
  "Reports",
];

export default function AccessControl() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const refreshUsers = () => {
    setUsers(getAllUsers());
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase();

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.role.toLowerCase().includes(keyword) ||
        user.status.toLowerCase().includes(keyword)
    );
  }, [users, search]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "Administrator").length,
      engineers: users.filter((u) => u.role === "Engineer").length,
      active: users.filter((u) => u.status === "Active").length,
    };
  }, [users]);

  const updateUser = (id, field, value) => {
    const userToUpdate = users.find((u) => u.id === id);
    if (!userToUpdate) return;
    
    // Determine new role and status based on which field is updating
    const newRole = field === "role" ? value : userToUpdate.role;
    const newStatus = field === "status" ? value : userToUpdate.status;

    updateUserRoleStatus(id, newRole, newStatus);
    refreshUsers(); // Refresh the list
  };

  const handleTogglePermission = (id, permission) => {
    toggleUserPermission(id, permission);
    refreshUsers();
  };

  return (
    <div className="accessPage">
      <div className="accessHero">
        <div>
          <div className="heroEyebrow">Security & Permissions</div>
          <h1>Access Control</h1>
          <p>
            Manage what system users can see and do. Deactivate users, assign roles,
            and grant module-level permissions.
          </p>
        </div>

        <div className="statsBox">
          <div className="statItem">
            <span>Total Accounts</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="statItem">
            <span>Administrators</span>
            <strong className="adminText">{stats.admins}</strong>
          </div>
          <div className="statItem">
            <span>Active Accounts</span>
            <strong className="okText">{stats.active}</strong>
          </div>
        </div>
      </div>

      <div className="filterPanel">
        <input
          type="text"
          placeholder="Search by name, email, role, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="searchBox"
        />
      </div>

      <div className="userList">
        {filteredUsers.length === 0 ? (
          <div className="emptyState">No users found matching your search.</div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="userCard">
              <div className="cardHeader">
                <div className="userInfo">
                  <div className="avatar">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <small>ID: {user.id}</small>
                  </div>
                </div>

                <div className="userControls">
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.id, "role", e.target.value)}
                    className="roleSelect"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Engineer">Field Engineer</option>
                  </select>

                  <select
                    value={user.status}
                    onChange={(e) => updateUser(user.id, "status", e.target.value)}
                    className={`statusSelect ${user.status.toLowerCase()}`}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="permissionsBox">
                <h4>Module Permissions</h4>
                <div className="permGrid">
                  {permissionOptions.map((permission) => {
                    const checked = user.permissions.includes(permission);
                    return (
                      <label
                        key={permission}
                        className={`permLabel ${checked ? "checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleTogglePermission(user.id, permission)}
                        />
                        <span>{permission}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .accessPage {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .accessHero {
          background: linear-gradient(135deg, #ffffff, #f0fdf4, #dcfce7);
          border: 1px solid #bbf7d0;
          border-radius: 22px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          box-shadow: 0 12px 30px rgba(22, 101, 52, 0.08);
        }

        .heroEyebrow {
          display: inline-block;
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .accessHero h1 {
          margin: 0;
          color: #0f172a;
          font-size: 34px;
          font-weight: 950;
        }

        .accessHero p {
          margin: 8px 0 0;
          color: #475569;
          max-width: 600px;
          line-height: 1.6;
          font-weight: 600;
        }

        .statsBox {
          display: flex;
          gap: 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px 24px;
          box-shadow: 0 10px 26px rgba(15,23,42,0.06);
        }

        .statItem {
          padding-right: 16px;
        }

        .statItem:not(:last-child) {
          border-right: 1px solid #e2e8f0;
        }

        .statItem span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .statItem strong {
          display: block;
          margin-top: 6px;
          color: #0f172a;
          font-size: 26px;
          font-weight: 950;
        }

        .adminText {
          color: #0284c7 !important;
        }

        .okText {
          color: #16a34a !important;
        }

        .filterPanel {
          margin-bottom: 22px;
        }

        .searchBox {
          width: 100%;
          max-width: 500px;
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          font-size: 15px;
          font-weight: 600;
          outline: none;
          background: white;
          box-shadow: 0 6px 16px rgba(15,23,42,0.04);
        }

        .searchBox:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }

        .userList {
          display: grid;
          gap: 20px;
        }

        .userCard {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 10px 26px rgba(15,23,42,0.05);
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .userInfo {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .avatar {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          color: white;
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .userInfo h3 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
        }

        .userInfo p {
          margin: 4px 0 0;
          color: #64748b;
          font-weight: 600;
        }

        .userInfo small {
          display: inline-block;
          margin-top: 6px;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 900;
          color: #475569;
        }

        .userControls {
          display: flex;
          gap: 12px;
        }

        .roleSelect,
        .statusSelect {
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          font-weight: 800;
          outline: none;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
        }

        .statusSelect.active {
          background: #dcfce7;
          border-color: #86efac;
          color: #166534;
        }

        .statusSelect.inactive {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #991b1b;
        }

        .permissionsBox h4 {
          margin: 0 0 16px;
          color: #334155;
          font-size: 15px;
        }

        .permGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .permLabel {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          user-select: none;
          transition: 0.2s ease;
        }

        .permLabel:hover {
          border-color: #94a3b8;
          background: #f1f5f9;
        }

        .permLabel.checked {
          border-color: #0284c7;
          background: #f0f9ff;
          color: #0369a1;
        }

        .permLabel input {
          margin: 0;
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .emptyState {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 20px;
          border: 1px dashed #cbd5e1;
          color: #64748b;
          font-weight: 800;
        }

        @media (max-width: 900px) {
          .accessHero {
            flex-direction: column;
          }

          .statsBox {
            width: 100%;
          }

          .cardHeader {
            flex-direction: column;
          }

          .userControls {
            width: 100%;
          }

          .userControls select {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
