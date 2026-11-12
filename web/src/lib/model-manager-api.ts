// Model Manager API calls. A sibling of `api.ts` rather than more entries in its facade:
// that file is over its line cap, and this surface is self-contained.

import { fetchJSON } from "./api";
import type {
  ModelDownloadJob,
  ModelDownloadStartResponse,
  ModelManagerOverviewResponse,
  ModelManagerRegistryResponse,
} from "./model-manager";

export const modelManagerApi = {
  overview: () => fetchJSON<ModelManagerOverviewResponse>("/api/model-manager/overview"),
  registry: () => fetchJSON<ModelManagerRegistryResponse>("/api/model-manager/registry"),
  download: (modelId: string) =>
    fetchJSON<ModelDownloadStartResponse>("/api/model-manager/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    }),
  job: (jobId: string) =>
    fetchJSON<ModelDownloadJob>(`/api/model-manager/jobs/${encodeURIComponent(jobId)}`),
  pause: (jobId: string) =>
    fetchJSON<{ ok: boolean }>("/api/model-manager/jobs/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    }),
  resume: (jobId: string) =>
    fetchJSON<ModelDownloadStartResponse>("/api/model-manager/jobs/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    }),
  remove: (modelId: string) =>
    fetchJSON<{ ok: boolean; removed_files: number; freed_bytes: number }>(
      `/api/model-manager/models/${encodeURIComponent(modelId)}`,
      { method: "DELETE" },
    ),
};
