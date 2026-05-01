import { supabase } from "./supabaseClient.js";

// ═══════════════════════════════════════════════════════════
// Helper — gracefully handle missing tables
// ═══════════════════════════════════════════════════════════

async function safeQuery(queryFn) {
  try {
    const result = await queryFn();
    if (result.error) {
      // If table doesn't exist yet, return empty gracefully
      if (
        result.error.message?.includes("schema cache") ||
        result.error.message?.includes("does not exist") ||
        result.error.code === "PGRST204" ||
        result.error.code === "42P01"
      ) {
        console.warn("Table not found — returning empty. Run supabase_migration.sql to fix.");
        return { data: [], error: null };
      }
      throw result.error;
    }
    return result;
  } catch (err) {
    if (
      err?.message?.includes("schema cache") ||
      err?.message?.includes("does not exist")
    ) {
      console.warn("Table not found — returning empty. Run supabase_migration.sql to fix.");
      return { data: [], error: null };
    }
    throw err;
  }
}

async function safeMutate(mutateFn) {
  try {
    const result = await mutateFn();
    if (result.error) {
      if (
        result.error.message?.includes("schema cache") ||
        result.error.message?.includes("does not exist")
      ) {
        console.warn("Table not found — skipping write. Run supabase_migration.sql to fix.");
        return { data: null, error: null };
      }
      throw result.error;
    }
    return result;
  } catch (err) {
    if (
      err?.message?.includes("schema cache") ||
      err?.message?.includes("does not exist")
    ) {
      console.warn("Table not found — skipping write. Run supabase_migration.sql to fix.");
      return { data: null, error: null };
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════
// MAINTENANCE LOGS — completed repair records
// ═══════════════════════════════════════════════════════════

export async function fetchMaintenanceLogs() {
  const { data } = await safeQuery(() =>
    supabase
      .from("maintenance_logs")
      .select("*")
      .order("completed_at", { ascending: false })
  );
  return data || [];
}

export async function insertMaintenanceLog(log) {
  const { data } = await safeMutate(() =>
    supabase.from("maintenance_logs").insert([log]).select()
  );
  return data?.[0] || null;
}

// ═══════════════════════════════════════════════════════════
// MAINTENANCE STATUS — per-pipeline workflow status
// ═══════════════════════════════════════════════════════════

export async function fetchAllMaintenanceStatuses() {
  const { data } = await safeQuery(() =>
    supabase.from("maintenance_status").select("*")
  );

  const statusMap = {};
  (data || []).forEach((row) => {
    statusMap[row.watmainid] = row.status;
  });

  return statusMap;
}

export async function upsertMaintenanceStatus(watmainid, status) {
  await safeMutate(() =>
    supabase
      .from("maintenance_status")
      .upsert(
        {
          watmainid,
          status,
          updated_at: new Date().toISOString(),
          updated_by: localStorage.getItem("waterflow_user") || "Engineer",
        },
        { onConflict: "watmainid" }
      )
  );
}

// ═══════════════════════════════════════════════════════════
// INCIDENTS — manual incident reports
// ═══════════════════════════════════════════════════════════

export async function fetchIncidents() {
  const { data } = await safeQuery(() =>
    supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
  );
  return data || [];
}

export async function insertIncident(incident) {
  const { data } = await safeMutate(() =>
    supabase.from("incidents").insert([incident]).select()
  );
  return data?.[0] || null;
}

// ═══════════════════════════════════════════════════════════
// ENGINEERS — engineer management CRUD
// ═══════════════════════════════════════════════════════════

export async function fetchEngineers() {
  const { data } = await safeQuery(() =>
    supabase
      .from("engineers")
      .select("*")
      .order("created_at", { ascending: false })
  );
  return data || [];
}

export async function insertEngineer(engineer) {
  const { data } = await safeMutate(() =>
    supabase.from("engineers").insert([engineer]).select()
  );
  return data?.[0] || null;
}

export async function updateEngineer(id, updates) {
  const { data } = await safeMutate(() =>
    supabase.from("engineers").update(updates).eq("id", id).select()
  );
  return data?.[0] || null;
}

export async function deleteEngineer(id) {
  await safeMutate(() =>
    supabase.from("engineers").delete().eq("id", id)
  );
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOGS — system activity tracking
// ═══════════════════════════════════════════════════════════

export async function fetchAuditLogs() {
  const { data } = await safeQuery(() =>
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
  );
  return data || [];
}

export async function insertAuditLog(log) {
  const { data } = await safeMutate(() =>
    supabase.from("audit_logs").insert([log]).select()
  );
  return data?.[0] || null;
}

// ═══════════════════════════════════════════════════════════
// SYSTEM ISSUES — admin issue tickets CRUD
// ═══════════════════════════════════════════════════════════

export async function fetchSystemIssues() {
  const { data } = await safeQuery(() =>
    supabase
      .from("system_issues")
      .select("*")
      .order("created_at", { ascending: false })
  );
  return data || [];
}

export async function insertSystemIssue(issue) {
  const { data } = await safeMutate(() =>
    supabase.from("system_issues").insert([issue]).select()
  );
  return data?.[0] || null;
}

export async function updateSystemIssue(id, updates) {
  const { data } = await safeMutate(() =>
    supabase.from("system_issues").update(updates).eq("id", id).select()
  );
  return data?.[0] || null;
}

export async function deleteSystemIssue(id) {
  await safeMutate(() =>
    supabase.from("system_issues").delete().eq("id", id)
  );
}
