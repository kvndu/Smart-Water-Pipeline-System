import { useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { fetchIncidents, fetchAuditLogs } from "../utils/databaseService";

export default function Reports() {
  const [loadingType, setLoadingType] = useState(null);

  async function downloadPipelineData() {
    try {
      setLoadingType("pipelines");
      let allRows = [];
      let from = 0;
      const count = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("pipelines")
          .select("*")
          .range(from, from + count - 1);

        if (error) throw error;
        if (data) allRows = [...allRows, ...data];
        if (!data || data.length < count) hasMore = false;
        from += count;
      }

      if (allRows.length === 0) {
        alert("No pipeline data found.");
        return;
      }

      generateCSV(allRows, "Pipeline_Asset_Inventory_Report.csv");
    } catch (err) {
      console.error(err);
      alert("Failed to generate pipeline report.");
    } finally {
      setLoadingType(null);
    }
  }

  async function downloadIncidentLogs() {
    try {
      setLoadingType("incidents");
      const data = await fetchIncidents();
      if (!data || data.length === 0) {
        alert("No incident data found.");
        return;
      }
      generateCSV(data, "System_Incident_Logs.csv");
    } catch (err) {
      console.error(err);
      alert("Failed to generate incident report.");
    } finally {
      setLoadingType(null);
    }
  }

  async function downloadAuditLogs() {
    try {
      setLoadingType("audit");
      const data = await fetchAuditLogs();
      if (!data || data.length === 0) {
        alert("No audit logs found.");
        return;
      }
      generateCSV(data, "System_Audit_Logs.csv");
    } catch (err) {
      console.error(err);
      alert("Failed to generate audit report.");
    } finally {
      setLoadingType(null);
    }
  }

  function generateCSV(dataArray, filename) {
    if (!dataArray || dataArray.length === 0) return;

    // Get headers
    const headers = Object.keys(dataArray[0]);
    
    // Create CSV content
    const csvRows = [];
    csvRows.push(headers.join(",")); // Header row

    for (const row of dataArray) {
      const values = headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) val = "";
        const valString = String(val);
        // Escape quotes and commas
        if (valString.includes(",") || valString.includes("\"") || valString.includes("\n")) {
          return `"${valString.replace(/"/g, '""')}"`;
        }
        return valString;
      });
      csvRows.push(values.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="reportsPage" style={{ padding: "28px", animation: "fadeIn 0.3s ease" }}>
      <div className="hero" style={{ background: "linear-gradient(135deg, #ffffff, #eef8fc, #dff2fa)", padding: "28px", borderRadius: "22px", border: "1px solid #c8e3ef", marginBottom: "32px", boxShadow: "0 12px 30px rgba(20, 65, 90, 0.08)" }}>
        <div>
          <div className="eyebrow" style={{ display: "inline-block", background: "#e2f4fb", color: "#0b6fa4", border: "1px solid #b9ddeb", fontWeight: "900", fontSize: "12px", letterSpacing: "1px", padding: "7px 12px", borderRadius: "999px", textTransform: "uppercase", marginBottom: "10px" }}>
            Report Generation Center
          </div>
          <h1 style={{ margin: 0, fontSize: "30px", color: "#123047" }}>System Reports</h1>
          <p style={{ marginTop: "10px", color: "#5f7688", fontWeight: "600" }}>Export comprehensive system data to CSV for external analysis and archiving.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        
        {/* Pipeline Report */}
        <div className="panel" style={{ background: "white", padding: "28px", borderRadius: "18px", border: "1px solid #d7e6ef", boxShadow: "0 10px 26px rgba(20, 65, 90, 0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: "0 0 12px 0", color: "#123047", fontSize: "20px" }}>Pipeline Asset Inventory</h2>
            <p style={{ color: "#5f7688", fontSize: "14px", lineHeight: "1.5", marginBottom: "20px" }}>
              Download the complete dataset of all {">"}16,000 smart water pipeline assets including material, condition scores, criticality, and geographic coordinates.
            </p>
          </div>
          <button 
            onClick={downloadPipelineData}
            disabled={loadingType !== null}
            style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: loadingType === "pipelines" ? "#94a3b8" : "#0ea5e9", color: "white", fontWeight: "bold", cursor: loadingType !== null ? "not-allowed" : "pointer", transition: "0.2s" }}
          >
            {loadingType === "pipelines" ? "Generating CSV..." : "Download Inventory (CSV)"}
          </button>
        </div>

        {/* Incident Logs Report */}
        <div className="panel" style={{ background: "white", padding: "28px", borderRadius: "18px", border: "1px solid #d7e6ef", boxShadow: "0 10px 26px rgba(20, 65, 90, 0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: "0 0 12px 0", color: "#123047", fontSize: "20px" }}>System Incident Logs</h2>
            <p style={{ color: "#5f7688", fontSize: "14px", lineHeight: "1.5", marginBottom: "20px" }}>
              Export all reported anomalies, leaks, pressure drops, and system failures logged by field engineers and automated sensors.
            </p>
          </div>
          <button 
            onClick={downloadIncidentLogs}
            disabled={loadingType !== null}
            style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: loadingType === "incidents" ? "#94a3b8" : "#f59e0b", color: "white", fontWeight: "bold", cursor: loadingType !== null ? "not-allowed" : "pointer", transition: "0.2s" }}
          >
            {loadingType === "incidents" ? "Generating CSV..." : "Download Incidents (CSV)"}
          </button>
        </div>

        {/* Audit Logs Report */}
        <div className="panel" style={{ background: "white", padding: "28px", borderRadius: "18px", border: "1px solid #d7e6ef", boxShadow: "0 10px 26px rgba(20, 65, 90, 0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: "0 0 12px 0", color: "#123047", fontSize: "20px" }}>Administrator Audit Logs</h2>
            <p style={{ color: "#5f7688", fontSize: "14px", lineHeight: "1.5", marginBottom: "20px" }}>
              Download complete system access and modification logs for security compliance and tracking user activity across the portal.
            </p>
          </div>
          <button 
            onClick={downloadAuditLogs}
            disabled={loadingType !== null}
            style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: loadingType === "audit" ? "#94a3b8" : "#8b5cf6", color: "white", fontWeight: "bold", cursor: loadingType !== null ? "not-allowed" : "pointer", transition: "0.2s" }}
          >
            {loadingType === "audit" ? "Generating CSV..." : "Download Audit Logs (CSV)"}
          </button>
        </div>

      </div>
    </div>
  );
}