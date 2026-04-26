import { useMemo, useState } from "react";

const initialEngineers = [
  {
    id: "ENG-001",
    name: "Kasun Perera",
    email: "kasun@pipeguard.com",
    phone: "0771234567",
    image: "",
    nic: "982345678V",
    address: "Colombo 05",
    area: "Colombo North",
    department: "Pipeline Inspection",
    designation: "Field Engineer",
    experience: 4,
    shift: "Morning",
    emergencyContact: "0712223334",
    joinDate: "2024-01-15",
    status: "Active",
    assignedPipelines: 24,
  },
  {
    id: "ENG-002",
    name: "Nimal Silva",
    email: "nimal@pipeguard.com",
    phone: "0779876543",
    image: "",
    nic: "950112233V",
    address: "Panadura",
    area: "Colombo South",
    department: "Maintenance",
    designation: "Maintenance Engineer",
    experience: 6,
    shift: "Evening",
    emergencyContact: "0704445556",
    joinDate: "2023-08-10",
    status: "Active",
    assignedPipelines: 18,
  },
];

export default function EngineerManagement() {
  const [engineers, setEngineers] = useState(initialEngineers);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    image: "",
    nic: "",
    address: "",
    area: "",
    department: "Pipeline Inspection",
    designation: "Field Engineer",
    experience: "",
    shift: "Morning",
    emergencyContact: "",
    joinDate: "",
    status: "Active",
    assignedPipelines: "",
  };

  const [form, setForm] = useState(emptyForm);

  const filteredEngineers = useMemo(() => {
    const keyword = search.toLowerCase();

    return engineers.filter(
      (engineer) =>
        engineer.id.toLowerCase().includes(keyword) ||
        engineer.name.toLowerCase().includes(keyword) ||
        engineer.email.toLowerCase().includes(keyword) ||
        engineer.area.toLowerCase().includes(keyword) ||
        engineer.department.toLowerCase().includes(keyword) ||
        engineer.status.toLowerCase().includes(keyword)
    );
  }, [engineers, search]);

  const stats = useMemo(() => {
    return {
      total: engineers.length,
      active: engineers.filter((e) => e.status === "Active").length,
      leave: engineers.filter((e) => e.status === "On Leave").length,
      inactive: engineers.filter((e) => e.status === "Inactive").length,
    };
  }, [engineers]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        image: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const engineerData = {
      ...form,
      experience: Number(form.experience || 0),
      assignedPipelines: Number(form.assignedPipelines || 0),
    };

    if (editingId) {
      setEngineers((prev) =>
        prev.map((engineer) =>
          engineer.id === editingId
            ? { ...engineer, ...engineerData }
            : engineer
        )
      );

      resetForm();
      return;
    }

    const newEngineer = {
      id: `ENG-${String(engineers.length + 1).padStart(3, "0")}`,
      ...engineerData,
    };

    setEngineers((prev) => [...prev, newEngineer]);
    resetForm();
  };

  const handleEdit = (engineer) => {
    setEditingId(engineer.id);

    setForm({
      name: engineer.name,
      email: engineer.email,
      phone: engineer.phone,
      image: engineer.image || "",
      nic: engineer.nic,
      address: engineer.address,
      area: engineer.area,
      department: engineer.department,
      designation: engineer.designation,
      experience: engineer.experience,
      shift: engineer.shift,
      emergencyContact: engineer.emergencyContact,
      joinDate: engineer.joinDate,
      status: engineer.status,
      assignedPipelines: engineer.assignedPipelines,
    });
  };

  const handleDelete = (id) => {
    const ok = window.confirm("Are you sure you want to remove this engineer?");
    if (!ok) return;

    setEngineers((prev) => prev.filter((engineer) => engineer.id !== id));
  };

  const removeSelectedImage = () => {
    setForm((prev) => ({
      ...prev,
      image: "",
    }));
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.badge}>ADMIN MODULE</p>
          <h1 style={styles.title}>Engineer Management</h1>
          <p style={styles.subtitle}>
            Register engineers with profile photos, assign areas, manage status,
            and monitor pipeline responsibilities.
          </p>
        </div>

        <div style={styles.adminBox}>
          <div style={styles.adminIcon}>👷</div>
          <div>
            <strong>Engineer Control</strong>
            <p style={styles.adminText}>Admin management panel</p>
          </div>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Engineers" value={stats.total} color="#0284c7" />
        <StatCard label="Active" value={stats.active} color="#16a34a" />
        <StatCard label="On Leave" value={stats.leave} color="#d97706" />
        <StatCard label="Inactive" value={stats.inactive} color="#dc2626" />
      </div>

      <div style={styles.layout}>
        <section style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.cardTitle}>
              {editingId ? "Update Engineer" : "Add New Engineer"}
            </h2>
            <span style={styles.formBadge}>
              {editingId ? editingId : "New Account"}
            </span>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.imageUploadBox}>
              <div style={styles.imagePreview}>
                {form.image ? (
                  <img src={form.image} alt="Engineer" style={styles.image} />
                ) : (
                  <div style={styles.noImage}>
                    <span style={{ fontSize: "26px" }}>👤</span>
                    <small>No photo</small>
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <span style={styles.label}>Engineer Profile Photo</span>

                <label style={styles.uploadBtn}>
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </label>

                {form.image && (
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    style={styles.removePhotoBtn}
                  >
                    Remove Photo
                  </button>
                )}

                <p style={styles.uploadHint}>
                  JPG, PNG or WEBP image can be used.
                </p>
              </div>
            </div>

            <div style={styles.twoCol}>
              <Input
                label="Full Name"
                name="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={handleChange}
                required
              />

              <Input
                label="Email Address"
                name="email"
                type="email"
                placeholder="engineer@pipeguard.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div style={styles.twoCol}>
              <Input
                label="Phone Number"
                name="phone"
                placeholder="0771234567"
                value={form.phone}
                onChange={handleChange}
                required
              />

              <Input
                label="NIC Number"
                name="nic"
                placeholder="NIC number"
                value={form.nic}
                onChange={handleChange}
                required
              />
            </div>

            <Input
              label="Address"
              name="address"
              placeholder="Engineer residential address"
              value={form.address}
              onChange={handleChange}
              required
            />

            <div style={styles.twoCol}>
              <Input
                label="Assigned Area"
                name="area"
                placeholder="Example: Colombo North"
                value={form.area}
                onChange={handleChange}
                required
              />

              <Select
                label="Department"
                name="department"
                value={form.department}
                onChange={handleChange}
                options={[
                  "Pipeline Inspection",
                  "Maintenance",
                  "Risk Monitoring",
                  "Leak Detection",
                  "Emergency Response",
                ]}
              />
            </div>

            <div style={styles.twoCol}>
              <Select
                label="Designation"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                options={[
                  "Field Engineer",
                  "Maintenance Engineer",
                  "Inspection Engineer",
                  "Senior Engineer",
                  "Junior Engineer",
                ]}
              />

              <Select
                label="Work Shift"
                name="shift"
                value={form.shift}
                onChange={handleChange}
                options={["Morning", "Evening", "Night", "Rotational"]}
              />
            </div>

            <div style={styles.twoCol}>
              <Input
                label="Experience Years"
                name="experience"
                type="number"
                placeholder="Years"
                min="0"
                value={form.experience}
                onChange={handleChange}
                required
              />

              <Input
                label="Assigned Pipelines"
                name="assignedPipelines"
                type="number"
                placeholder="Pipeline count"
                min="0"
                value={form.assignedPipelines}
                onChange={handleChange}
                required
              />
            </div>

            <div style={styles.twoCol}>
              <Input
                label="Emergency Contact"
                name="emergencyContact"
                placeholder="Emergency phone"
                value={form.emergencyContact}
                onChange={handleChange}
                required
              />

              <Input
                label="Join Date"
                name="joinDate"
                type="date"
                value={form.joinDate}
                onChange={handleChange}
                required
              />
            </div>

            <Select
              label="Account Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={["Active", "On Leave", "Inactive"]}
            />

            <button type="submit" style={styles.primaryBtn}>
              {editingId ? "Save Engineer Details" : "Create Engineer Account"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={styles.cancelBtn}
              >
                Cancel Update
              </button>
            )}
          </form>
        </section>

        <section style={styles.tableCard}>
          <div style={styles.tableTop}>
            <div>
              <h2 style={styles.cardTitle}>Registered Engineers</h2>
              <p style={styles.tableSub}>
                Search, update, and remove engineer records.
              </p>
            </div>

            <input
              placeholder="Search engineer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />
          </div>

          <div style={styles.table}>
            <div style={styles.tableHead}>
              <span>ID</span>
              <span>Engineer</span>
              <span>Area</span>
              <span>Department</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {filteredEngineers.map((engineer) => (
              <div style={styles.tableRow} key={engineer.id}>
                <span style={styles.id}>{engineer.id}</span>

                <div style={styles.engineerProfile}>
                  <div style={styles.avatar}>
                    {engineer.image ? (
                      <img
                        src={engineer.image}
                        alt={engineer.name}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>

                  <div>
                    <strong>{engineer.name}</strong>
                    <p style={styles.small}>{engineer.email}</p>
                    <p style={styles.smallLight}>{engineer.phone}</p>
                  </div>
                </div>

                <div>
                  <strong>{engineer.area}</strong>
                  <p style={styles.smallLight}>
                    {engineer.assignedPipelines} pipelines
                  </p>
                </div>

                <div>
                  <strong>{engineer.department}</strong>
                  <p style={styles.smallLight}>{engineer.designation}</p>
                </div>

                <span
                  style={{
                    ...styles.status,
                    ...getStatusStyle(engineer.status),
                  }}
                >
                  {engineer.status}
                </span>

                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() => handleEdit(engineer)}
                    style={styles.editBtn}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(engineer.id)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredEngineers.length === 0 && (
              <div style={styles.empty}>No engineer records found.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        required={required}
        min={min}
        style={styles.input}
      />
    </label>
  );
}

function Select({ label, name, value, onChange, options }) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        style={styles.input}
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <h2 style={{ ...styles.statValue, color }}>{value}</h2>
    </div>
  );
}

function getStatusStyle(status) {
  if (status === "Active") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (status === "On Leave") {
    return { background: "#fef3c7", color: "#92400e" };
  }

  return { background: "#fee2e2", color: "#991b1b" };
}

const styles = {
  page: {
    padding: "34px",
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef6fb 100%)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    marginBottom: "24px",
  },
  badge: {
    margin: "0 0 8px",
    color: "#0284c7",
    fontWeight: 900,
    letterSpacing: "1.5px",
    fontSize: "13px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "38px",
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "10px",
    color: "#64748b",
    maxWidth: "760px",
    lineHeight: 1.6,
  },
  adminBox: {
    background: "#ffffff",
    padding: "16px 18px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  adminIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    display: "grid",
    placeItems: "center",
    fontSize: "23px",
  },
  adminText: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },
  statCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    fontSize: "13px",
  },
  statValue: {
    margin: "12px 0 0",
    fontSize: "34px",
    fontWeight: 950,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "470px 1fr",
    gap: "22px",
    alignItems: "start",
  },
  formCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  tableCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
    overflowX: "auto",
  },
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: 900,
  },
  formBadge: {
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  imageUploadBox: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px dashed #93c5fd",
  },
  imagePreview: {
    width: "86px",
    height: "86px",
    borderRadius: "18px",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  noImage: {
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    gap: "4px",
  },
  uploadBtn: {
    display: "inline-block",
    marginTop: "8px",
    padding: "9px 13px",
    borderRadius: "12px",
    background: "#0284c7",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: "13px",
  },
  removePhotoBtn: {
    marginLeft: "8px",
    padding: "9px 13px",
    borderRadius: "12px",
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: "13px",
  },
  uploadHint: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 600,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  labelWrap: {
    display: "grid",
    gap: "7px",
  },
  label: {
    color: "#334155",
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
    fontWeight: 700,
    color: "#0f172a",
  },
  primaryBtn: {
    marginTop: "8px",
    padding: "15px",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(2,132,199,0.22)",
  },
  cancelBtn: {
    padding: "14px",
    border: "none",
    borderRadius: "14px",
    background: "#e2e8f0",
    color: "#334155",
    fontWeight: 900,
    cursor: "pointer",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "18px",
  },
  tableSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  search: {
    width: "270px",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#f8fafc",
    fontWeight: 700,
  },
  table: {
    display: "grid",
    gap: "10px",
    minWidth: "920px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.7fr 2fr 1.4fr 1.5fr 0.9fr 1fr",
    padding: "12px 16px",
    color: "#64748b",
    fontWeight: 900,
    fontSize: "13px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.7fr 2fr 1.4fr 1.5fr 0.9fr 1fr",
    alignItems: "center",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "16px",
    color: "#334155",
    fontWeight: 800,
  },
  id: {
    color: "#0284c7",
    fontWeight: 950,
  },
  engineerProfile: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "15px",
    background: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    flexShrink: 0,
    fontSize: "20px",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  small: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
  },
  smallLight: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 600,
  },
  status: {
    padding: "8px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    textAlign: "center",
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  editBtn: {
    border: "none",
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "9px 12px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  deleteBtn: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "9px 12px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    padding: "24px",
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
    borderRadius: "16px",
    fontWeight: 800,
  },
};