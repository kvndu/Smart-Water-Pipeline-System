import { supabase } from "./supabaseClient.js";
import { mapPipelineRow } from "./pipelineMapper.js";

export async function fetchPipelines(limit = 2000) {
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 2000;

  const { data, error } = await supabase
    .from("pipelines")
    .select("*")
    .limit(safeLimit);

  if (error) {
    console.error("Supabase pipeline fetch failed:", error);
    throw error;
  }

  return (data || []).map(mapPipelineRow);
}

export async function fetchPipelineById(id) {
  const rows = await fetchPipelines(20000);
  return rows.find((row) => String(row.pipeline_id) === String(id) || String(row.object_id) === String(id)) || null;
}
