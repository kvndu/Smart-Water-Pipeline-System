import axios from "axios";
import { fetchPipelines } from "./pipelineService.js";

const API_BASE = "http://127.0.0.1:8000";
const fallbackApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

function getLimitFromUrl(url, fallback = 2000) {
  const match = String(url).match(/[?&]limit=(\d+)/);
  return match ? Number(match[1]) : fallback;
}

const api = {
  async get(url, config) {
    if (String(url).startsWith("/pipelines-with-risk")) {
      const limit = getLimitFromUrl(url);
      const data = await fetchPipelines(limit);
      return { data };
    }

    if (String(url).startsWith("/live-rain")) {
      return {
        data: {
          location: "Kitchener/Waterloo",
          rain_mm: 0,
          rainfall_mm: 0,
          source: "Simulated live rain value",
          updated_at: new Date().toISOString(),
        },
      };
    }

    if (String(url).startsWith("/maintenance-logs")) {
      return { data: [] };
    }

    return fallbackApi.get(url, config);
  },

  post: (...args) => fallbackApi.post(...args),
  put: (...args) => fallbackApi.put(...args),
  patch: (...args) => fallbackApi.patch(...args),
  delete: (...args) => fallbackApi.delete(...args),
};

export default api;
