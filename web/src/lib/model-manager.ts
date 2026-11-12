// Model Manager domain types and pure selection helpers.
//
// The registry arrives whole (a few dozen rows) so filters, sorting and the charts all
// derive from one array: a chart click filters the table and a filter chip moves the
// chart in the same frame, with no second request.

export type FitLevel = "native" | "spills" | "too_big" | "external";

export interface ManagedModelFit {
  level: FitLevel;
  required_bytes: number;
  available_bytes: number;
  context_tokens: number;
  estimated_tok_per_sec: number | null;
  label: string;
  detail: string;
}

export interface ManagedModel {
  id: string;
  name: string;
  family: string;
  publisher: string;
  type: string;
  architecture: string;
  params_b: number;
  active_params_b: number;
  context_tokens: number;
  max_output_tokens: number;
  license: string;
  released: string;
  quant: string;
  size_bytes: number;
  kv_kib_per_token: number;
  ref_tok_per_sec: number;
  quality: number;
  benchmarks: Record<string, number | null>;
  domains: Record<string, number>;
  capabilities: string[];
  runtime: string;
  repo: string | null;
  install_hint: string;
  notes: string;
  downloadable: boolean;
  best_domain: string | null;
  fit: ManagedModelFit;
  installed: boolean;
  installed_model_ids: string[];
  installed_bytes: number;
}

export interface ModelDomain {
  id: string;
  label: string;
  description: string;
}

export interface ModelManagerMeta {
  schema_version: number;
  reference_hardware: string;
  notes: string;
  domains: ModelDomain[];
  types: { id: string; label: string }[];
  architectures: { id: string; label: string }[];
}

export interface ModelManagerHardware {
  platform: string;
  arch: string;
  cpu: string;
  cpu_cores: number;
  vram_total_bytes: number;
  vram_usable_bytes: number;
  ram_total_bytes: number;
  ram_available_bytes: number;
  unified_memory: boolean;
  engine_installed: boolean;
  models_dir: string;
  gpu_name: string | null;
  gpu_util_percent: number | null;
  vram_used_bytes: number | null;
}

export interface InstalledModelRow {
  model_id: string;
  stem: string;
  path: string;
  size_bytes: number;
}

export interface ServingModel {
  id: string;
  provider: string;
  status: string;
  base_url: string | null;
  context_tokens: number | null;
  size_bytes: number | null;
}

export interface ModelManagerOverviewResponse {
  hardware: ModelManagerHardware;
  serving: ServingModel[];
  installed: InstalledModelRow[];
  counts: { total: number; downloadable: number; fits_native: number };
  meta: ModelManagerMeta;
}

export interface ModelManagerRegistryResponse {
  models: ManagedModel[];
  total: number;
  matched: number;
  hardware: ModelManagerHardware;
  meta: ModelManagerMeta;
}

export interface ModelDownloadJob {
  job_id: string;
  kind: string;
  target: string;
  model_id: string | null;
  status: "running" | "paused" | "done" | "error";
  phase: string;
  detail: string;
  total_bytes: number | null;
  done_bytes: number;
  percent?: number;
  bytes_per_sec?: number;
  eta_seconds?: number | null;
  started_at: number;
  error: string | null;
  can_pause: boolean;
  can_resume: boolean;
}

export interface ModelDownloadStartResponse {
  job_id: string | null;
  model_id: string;
  already_downloaded?: boolean;
  quant?: string;
  total_bytes?: number;
}

export type ModelSortKey =
  | "quality"
  | "size"
  | "params"
  | "context"
  | "speed"
  | "released"
  | "name";

export type FitFilter = "any" | "native" | "runs" | "installed";

export interface ModelFilters {
  query: string;
  types: string[];
  domains: string[];
  licenses: string[];
  architectures: string[];
  maxParamsB: number | null;
  minContext: number | null;
  fit: FitFilter;
}

export const DEFAULT_FILTERS: ModelFilters = {
  query: "",
  types: [],
  domains: [],
  licenses: [],
  architectures: [],
  maxParamsB: null,
  minContext: null,
  fit: "any",
};

export const SORT_OPTIONS: { value: ModelSortKey; label: string }[] = [
  { value: "quality", label: "Overall quality" },
  { value: "size", label: "Download size" },
  { value: "params", label: "Parameters" },
  { value: "context", label: "Context window" },
  { value: "speed", label: "Speed on this machine" },
  { value: "released", label: "Newest" },
  { value: "name", label: "Name" },
];

/** Estimated tokens/second on this machine, falling back to the reference rate. */
export function modelSpeed(model: ManagedModel): number | null {
  if (model.fit.estimated_tok_per_sec !== null) return model.fit.estimated_tok_per_sec;
  return model.ref_tok_per_sec > 0 ? model.ref_tok_per_sec : null;
}

export function modelSearchText(model: ManagedModel): string {
  return [
    model.id,
    model.name,
    model.family,
    model.publisher,
    model.type,
    model.license,
    ...model.capabilities,
  ]
    .join(" ")
    .toLowerCase();
}

// One predicate per filter, so adding a filter is one row and no function grows a ladder.
const PREDICATES: ((model: ManagedModel, filters: ModelFilters) => boolean)[] = [
  (model, filters) => {
    const needle = filters.query.trim().toLowerCase();
    return !needle || modelSearchText(model).includes(needle);
  },
  (model, filters) => !filters.types.length || filters.types.includes(model.type),
  (model, filters) =>
    !filters.architectures.length || filters.architectures.includes(model.architecture),
  (model, filters) => !filters.licenses.length || filters.licenses.includes(model.license),
  // A model must be strong in EVERY selected domain: picking "coding" and "vision"
  // asks for a model that does both, not two different models.
  (model, filters) =>
    !filters.domains.length || filters.domains.every((domain) => (model.domains[domain] ?? 0) > 0),
  (model, filters) => filters.maxParamsB === null || model.params_b <= filters.maxParamsB,
  (model, filters) => filters.minContext === null || model.context_tokens >= filters.minContext,
  (model, filters) => FIT_FILTERS[filters.fit](model),
];

const FIT_FILTERS: Record<FitFilter, (model: ManagedModel) => boolean> = {
  any: () => true,
  native: (model) => model.fit.level === "native",
  runs: (model) => model.fit.level === "native" || model.fit.level === "spills",
  installed: (model) => model.installed,
};

export function filterModels(models: ManagedModel[], filters: ModelFilters): ManagedModel[] {
  return models.filter((model) => PREDICATES.every((matches) => matches(model, filters)));
}

function sortValue(model: ManagedModel, key: ModelSortKey): number | string {
  switch (key) {
    case "quality":
      return model.quality;
    case "size":
      return model.size_bytes;
    case "params":
      return model.params_b;
    case "context":
      return model.context_tokens;
    case "speed":
      return modelSpeed(model) ?? -1;
    case "released":
      return model.released;
    case "name":
      return model.name.toLowerCase();
  }
}

export function sortModels(
  models: ManagedModel[],
  key: ModelSortKey,
  descending: boolean,
): ManagedModel[] {
  const sorted = [...models].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (typeof left === "string" || typeof right === "string") {
      return String(left).localeCompare(String(right));
    }
    return left - right;
  });
  return descending ? sorted.reverse() : sorted;
}

export interface DomainRank {
  model: ManagedModel;
  score: number;
}

/** Best models for one domain — the chart that answers "what should I run for X". */
export function domainLeaderboard(
  models: ManagedModel[],
  domain: string,
  limit = 8,
): DomainRank[] {
  return models
    .filter((model) => (model.domains[domain] ?? 0) > 0)
    .map((model) => ({ model, score: model.domains[domain] }))
    .sort((a, b) => b.score - a.score || b.model.quality - a.model.quality)
    .slice(0, limit);
}

export function availableLicenses(models: ManagedModel[]): string[] {
  return [...new Set(models.map((m) => m.license).filter(Boolean))].sort();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
  if (gb >= 10) return `${gb.toFixed(0)} GB`;
  return `${gb.toFixed(1)} GB`;
}

export function formatContext(tokens: number | null | undefined): string {
  if (!tokens || tokens <= 0) return "—";
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_048_576).toFixed(tokens % 1_048_576 === 0 ? 0 : 1)}M`;
  }
  return `${Math.round(tokens / 1024)}K`;
}

export function formatParams(model: ManagedModel): string {
  const total = model.params_b >= 10 ? `${model.params_b.toFixed(0)}B` : `${model.params_b.toFixed(1)}B`;
  if (model.architecture === "moe" && model.active_params_b < model.params_b) {
    return `${total} (${model.active_params_b.toFixed(0)}B active)`;
  }
  return total;
}

export const FIT_TONE: Record<FitLevel, "success" | "warning" | "secondary"> = {
  native: "success",
  spills: "warning",
  too_big: "secondary",
  external: "secondary",
};

export const FIT_COLOR: Record<FitLevel, string> = {
  native: "#22c55e",
  spills: "#f59e0b",
  too_big: "#ef4444",
  external: "#8b8fa3",
};

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
