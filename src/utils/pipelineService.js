import { supabase } from "./supabaseClient.js";
import { mapPipelineRow } from "./pipelineMapper.js";

const PAGE_SIZE = 1000;

export async function fetchPipelines() {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .range(from, to);

    if (error) {
      console.error("Supabase pipeline fetch failed:", error);
      throw error;
    }

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows.map(mapPipelineRow);
}

export async function fetchPipelineById(id) {
  const rows = await fetchPipelines();

  return (
    rows.find(
      (row) =>
        String(row.pipeline_id) === String(id) ||
        String(row.object_id) === String(id)
    ) || null
  );
}