import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

const initialForm = {
  WATMAINID: "",
  STATUS: "ACTIVE",
  PRESSURE_ZONE: "",
  MAP_LABEL: "",
  CATEGORY: "TREATED",
  PIPE_SIZE: "",
  MATERIAL: "",
  LINED: "NO",
  LINED_MATERIAL: "",
  INSTALLATION_DATE: "",
  ACQUISITION: "",
  CONSULTANT: "",
  OWNERSHIP: "",
  BRIDGE_MAIN: "NO",
  BRIDGE_DETAILS: "",
  CRITICALITY: "",
  REL_CLEANING_AREA: "",
  REL_CLEANING_SUBAREA: "",
  Undersized: "N",
  "Shallow Main": "N",
  "Condition Score": "",
  OVERSIZED: "N",
  CLEANED: "N",
  Shape__Length: "",
  risk_level: "",
};

function calculateRisk(condition, criticality) {
  const c = Number(condition);
  const cr = Number(criticality);

  if (!Number.isNaN(c)) {
    if (c <= 4) return "HIGH";
    if (c <= 7) return "MEDIUM";
    return "LOW";
  }

  if (!Number.isNaN(cr)) {
    if (cr >= 8) return "HIGH";
    if (cr >= 5) return "MEDIUM";
  }

  return "LOW";
}

export default function AddPipeline() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "Condition Score" || name === "CRITICALITY") {
        next.risk_level = calculateRisk(
          name === "Condition Score" ? value : next["Condition Score"],
          name === "CRITICALITY" ? value : next.CRITICALITY
        );
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.WATMAINID || !form.MATERIAL || !form.PIPE_SIZE) {
      alert("Please fill WATMAINID, Material and Pipe Size.");
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      OBJECTID: Date.now().toString(),
      ROADSEGMENTID: "",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("pipelines").insert([payload]);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to add pipeline. Check console.");
      return;
    }

    alert("Pipeline added successfully!");
    navigate("/pipelines");
  }

  return (
    <div className="addPipelinePage">
      <div className="hero">
        <div>
          <div className="eyebrow">Asset Management</div>
          <h1>Add New Pipeline</h1>
          <p>
            Add a new water main asset into the real dataset structure used by
            Supabase.
          </p>
        </div>
      </div>

      <form className="formCard" onSubmit={handleSubmit}>
        <Section title="Core Pipeline Details">
          <Input label="Water Main ID" name="WATMAINID" value={form.WATMAINID} onChange={handleChange} />
          <Input label="Status" name="STATUS" value={form.STATUS} onChange={handleChange} />
          <Input label="Pressure Zone" name="PRESSURE_ZONE" value={form.PRESSURE_ZONE} onChange={handleChange} />
          <Input label="Map Label" name="MAP_LABEL" value={form.MAP_LABEL} onChange={handleChange} />
          <Input label="Category" name="CATEGORY" value={form.CATEGORY} onChange={handleChange} />
          <Input label="Pipe Size" name="PIPE_SIZE" value={form.PIPE_SIZE} onChange={handleChange} />
          <Input label="Material" name="MATERIAL" value={form.MATERIAL} onChange={handleChange} />
          <Input label="Length" name="Shape__Length" value={form.Shape__Length} onChange={handleChange} />
        </Section>

        <Section title="Condition & Risk">
          <Input label="Condition Score" name="Condition Score" value={form["Condition Score"]} onChange={handleChange} />
          <Input label="Criticality" name="CRITICALITY" value={form.CRITICALITY} onChange={handleChange} />
          <Input label="Risk Level" name="risk_level" value={form.risk_level} onChange={handleChange} disabled />
          <Input label="Undersized" name="Undersized" value={form.Undersized} onChange={handleChange} />
          <Input label="Shallow Main" name="Shallow Main" value={form["Shallow Main"]} onChange={handleChange} />
          <Input label="Oversized" name="OVERSIZED" value={form.OVERSIZED} onChange={handleChange} />
          <Input label="Cleaned" name="CLEANED" value={form.CLEANED} onChange={handleChange} />
        </Section>

        <Section title="Installation & Ownership">
          <Input label="Installation Date" name="INSTALLATION_DATE" value={form.INSTALLATION_DATE} onChange={handleChange} />
          <Input label="Acquisition" name="ACQUISITION" value={form.ACQUISITION} onChange={handleChange} />
          <Input label="Consultant" name="CONSULTANT" value={form.CONSULTANT} onChange={handleChange} />
          <Input label="Ownership" name="OWNERSHIP" value={form.OWNERSHIP} onChange={handleChange} />
          <Input label="Lined" name="LINED" value={form.LINED} onChange={handleChange} />
          <Input label="Lined Material" name="LINED_MATERIAL" value={form.LINED_MATERIAL} onChange={handleChange} />
        </Section>

        <Section title="Bridge & Cleaning Details">
          <Input label="Bridge Main" name="BRIDGE_MAIN" value={form.BRIDGE_MAIN} onChange={handleChange} />
          <Input label="Bridge Details" name="BRIDGE_DETAILS" value={form.BRIDGE_DETAILS} onChange={handleChange} />
          <Input label="Cleaning Area" name="REL_CLEANING_AREA" value={form.REL_CLEANING_AREA} onChange={handleChange} />
          <Input label="Cleaning Subarea" name="REL_CLEANING_SUBAREA" value={form.REL_CLEANING_SUBAREA} onChange={handleChange} />
        </Section>

        <div className="actions">
          <button type="button" className="ghost" onClick={() => navigate("/pipelines")}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add Pipeline"}
          </button>
        </div>
      </form>

      <style>{`
        .addPipelinePage {
          padding: 28px;
        }

        .hero {
          background: linear-gradient(135deg, #ffffff, #eff6ff);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 22px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.08);
        }

        .eyebrow {
          display: inline-block;
          background: #dbeafe;
          color: #2563eb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .hero h1 {
          margin: 0;
          font-size: 30px;
          color: #0f172a;
        }

        .hero p {
          margin: 8px 0 0;
          color: #64748b;
        }

        .formCard {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.07);
        }

        .section {
          margin-bottom: 28px;
        }

        .section h2 {
          font-size: 20px;
          color: #0f172a;
          margin: 0 0 16px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .field label {
          display: block;
          font-size: 12px;
          color: #64748b;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .field input {
          width: 100%;
          height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-weight: 700;
          color: #0f172a;
        }

        .field input:disabled {
          background: #f1f5f9;
          color: #334155;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }

        button {
          border: none;
          background: #2563eb;
          color: #fff;
          border-radius: 12px;
          padding: 11px 18px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ghost {
          background: #f1f5f9;
          color: #0f172a;
        }

        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      <div className="grid">{children}</div>
    </div>
  );
}

function Input({ label, name, value, onChange, disabled = false }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}