import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { SelectOption } from "@nous-research/ui/ui/components/select";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { modelManagerApi } from "@/lib/model-manager-api";
import {
  DEFAULT_FILTERS,
  domainLeaderboard,
  filterModels,
  formatBytes,
  modelSpeed,
  sortModels,
  type ModelDownloadJob,
  type ModelFilters,
  type ModelManagerOverviewResponse,
  type ModelManagerRegistryResponse,
  type ModelSortKey,
} from "@/lib/model-manager";
import {
  DomainBars,
  FitLegend,
  ModelScatter,
  type BarRow,
  type ScatterPoint,
} from "@/components/model-manager/ModelCharts";
import { ModelFiltersBar } from "@/components/model-manager/ModelFiltersBar";
import { ModelTable } from "@/components/model-manager/ModelTable";
import {
  FilterSelect,
  MachineCard,
  SelectedDetail,
  ServingCard,
} from "@/components/model-manager/ModelManagerPanels";
import { errorMessage } from "@/lib/api-error";
import { cn, themedBody } from "@/lib/utils";

function DownloadBanner({
  job,
  onTogglePause,
}: {
  job: ModelDownloadJob;
  onTogglePause: () => void;
}) {
  const moving = job.status === "running" || job.status === "paused";
  return (
    <div className="space-y-1.5 rounded-md border border-border/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate">
          {job.detail}
          {job.status === "error" && job.error ? ` — ${job.error}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {job.percent !== undefined && <span>{job.percent}%</span>}
          {job.bytes_per_sec ? <span>{formatBytes(job.bytes_per_sec)}/s</span> : null}
          {moving && (
            <Button size="sm" outlined onClick={onTogglePause}>
              {job.status === "paused" ? "Resume" : "Pause"}
            </Button>
          )}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-foreground/60 transition-all"
          style={{ width: `${job.percent ?? 2}%` }}
        />
      </div>
    </div>
  );
}

function activeFilterCount(filters: ModelFilters): number {
  const lists =
    filters.types.length +
    filters.domains.length +
    filters.architectures.length +
    filters.licenses.length;
  const scalars = [filters.query, filters.maxParamsB, filters.minContext].filter(
    (value) => value !== "" && value !== null,
  ).length;
  return lists + scalars + (filters.fit === "any" ? 0 : 1);
}

export default function ModelManagerPage() {
  const [overview, setOverview] = useState<ModelManagerOverviewResponse | null>(null);
  const [registry, setRegistry] = useState<ModelManagerRegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<ModelFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<ModelSortKey>("quality");
  const [descending, setDescending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartDomain, setChartDomain] = useState("general");
  const [job, setJob] = useState<ModelDownloadJob | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextOverview, nextRegistry] = await Promise.all([
        modelManagerApi.overview(),
        modelManagerApi.registry(),
      ]);
      setOverview(nextOverview);
      setRegistry(nextRegistry);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(() => registry?.models ?? [], [registry]);
  const domains = useMemo(() => registry?.meta.domains ?? [], [registry]);
  const filtered = useMemo(() => filterModels(models, filters), [models, filters]);
  const rows = useMemo(() => sortModels(filtered, sort, descending), [filtered, sort, descending]);
  const licenses = useMemo(
    () => [...new Set(models.map((model) => model.license).filter(Boolean))].sort(),
    [models],
  );
  const selected = useMemo(
    () => models.find((model) => model.id === selectedId) ?? rows[0] ?? null,
    [models, rows, selectedId],
  );
  const domainLabels = useMemo(
    () => Object.fromEntries(domains.map((domain) => [domain.id, domain.label])),
    [domains],
  );

  const scatterPoints = useMemo<ScatterPoint[]>(
    () =>
      rows.map((model) => ({
        id: model.id,
        label: model.name,
        x: model.size_bytes / 1024 ** 3,
        y: model.quality,
        level: model.fit.level,
        detail: `${formatBytes(model.size_bytes)} · ${model.fit.label}`,
      })),
    [rows],
  );

  const speedPoints = useMemo<ScatterPoint[]>(
    () =>
      rows.flatMap((model) => {
        const speed = modelSpeed(model);
        return speed && speed > 0
          ? [{
              id: model.id,
              label: model.name,
              x: speed,
              y: model.quality,
              level: model.fit.level,
              detail: `${Math.round(speed)} tok/s · quality ${model.quality}`,
            }]
          : [];
      }),
    [rows],
  );

  const leaderboard = useMemo<BarRow[]>(
    () =>
      domainLeaderboard(filtered, chartDomain).map(({ model, score }) => ({
        id: model.id,
        label: model.name,
        value: score,
        detail: `${score}/100 for ${chartDomain} · quality ${model.quality} · ${model.fit.label}`,
        level: model.fit.level,
      })),
    [filtered, chartDomain],
  );

  // Poll the active download until it settles, then re-read what landed on disk.
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setTimeout(async () => {
      try {
        const next = await modelManagerApi.job(job.job_id);
        setJob(next);
        if (next.status === "done") {
          setNotice(`${next.target} downloaded.`);
          setBusyId(null);
          await load();
        } else if (next.status === "error") {
          setNotice(next.error ?? "Download failed.");
          setBusyId(null);
        } else if (next.status === "paused") {
          setBusyId(null);
        }
      } catch (error) {
        setNotice(errorMessage(error));
        setBusyId(null);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [job, load]);

  const startDownload = useCallback(
    async (modelId: string) => {
      setBusyId(modelId);
      setNotice(null);
      try {
        const started = await modelManagerApi.download(modelId);
        if (started.already_downloaded) {
          setNotice("Already on disk.");
          setBusyId(null);
          await load();
          return;
        }
        if (started.job_id) setJob(await modelManagerApi.job(started.job_id));
      } catch (error) {
        setNotice(errorMessage(error));
        setBusyId(null);
      }
    },
    [load],
  );

  const removeModel = useCallback(
    async (modelId: string) => {
      if (confirmRemove !== modelId) {
        setConfirmRemove(modelId);
        return;
      }
      setConfirmRemove(null);
      setBusyId(modelId);
      try {
        await modelManagerApi.remove(modelId);
        setNotice("Removed from disk.");
        await load();
      } catch (error) {
        setNotice(errorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [confirmRemove, load],
  );

  const togglePause = useCallback(async () => {
    if (!job) return;
    try {
      if (job.status === "paused") {
        const resumed = await modelManagerApi.resume(job.job_id);
        if (resumed.job_id) setJob(await modelManagerApi.job(resumed.job_id));
      } else {
        await modelManagerApi.pause(job.job_id);
        setJob(await modelManagerApi.job(job.job_id));
      }
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, [job]);

  if (loading && !registry) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        Reading this machine and the model registry…
      </div>
    );
  }

  if (loadError && !registry) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">The Model Manager could not load: {loadError}</p>
        <Button size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 p-4 md:p-6", themedBody)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-base text-foreground">Model Manager</h1>
          <p className="text-xs text-muted-foreground">
            {registry?.total ?? 0} models graded across {domains.length} domains, priced for this
            machine. {overview?.counts.fits_native ?? 0} run fully on your GPU.
          </p>
        </div>
        <Button size="sm" outlined onClick={() => void load()}>
          <RefreshCw className="mr-1 size-3.5" /> Refresh
        </Button>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-xs">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        {overview && <MachineCard hardware={overview.hardware} />}
        {overview && <ServingCard serving={overview.serving} />}
      </div>

      {job && <DownloadBanner job={job} onTogglePause={() => void togglePause()} />}

      <ModelFiltersBar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        descending={descending}
        onDescendingChange={setDescending}
        licenses={licenses}
        meta={registry?.meta ?? null}
        domains={domains}
        shown={rows.length}
        total={models.length}
        activeFilterCount={activeFilterCount(filters)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className={cn("text-sm", themedBody)}>Quality vs size</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Upper-left is the frontier: most quality per gigabyte. Click a point to inspect.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <ModelScatter
              points={scatterPoints}
              xLabel="Download size (GB, log scale)"
              yLabel="Quality"
              xFormat={(value) => value.toFixed(0)}
              logX
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            <FitLegend />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className={cn("text-sm", themedBody)}>Quality vs speed here</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Estimated tokens/second on this machine at a 32K window.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <ModelScatter
              points={speedPoints}
              xLabel="Estimated tokens/second"
              yLabel="Quality"
              xFormat={(value) => String(Math.round(value))}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            <FitLegend />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className={cn("text-sm", themedBody)}>Best for a domain</CardTitle>
            <FilterSelect
              id="mm-domain-chart"
              label="Domain leaderboard"
              value={chartDomain}
              onValueChange={setChartDomain}
            >
              {domains.map((domain) => (
                <SelectOption key={domain.id} value={domain.id}>
                  {domain.label}
                </SelectOption>
              ))}
            </FilterSelect>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {domains.find((domain) => domain.id === chartDomain)?.description ?? ""} Scoped to the
            filters above.
          </p>
        </CardHeader>
        <CardContent>
          <DomainBars rows={leaderboard} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        </CardContent>
      </Card>

      {selected && (
        <SelectedDetail
          model={selected}
          domainLabels={domainLabels}
          onDownload={(id) => void startDownload(id)}
          onRemove={(id) => void removeModel(id)}
          busy={busyId === selected.id}
          removable={selected.installed}
        />
      )}

      <ModelTable
        rows={rows}
        selectedId={selected?.id ?? null}
        job={job}
        busyId={busyId}
        confirmRemove={confirmRemove}
        onSelect={setSelectedId}
        onDownload={(id) => void startDownload(id)}
        onRemove={(id) => void removeModel(id)}
      />

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {registry?.meta.notes} Reference machine: {registry?.meta.reference_hardware}.
      </p>
    </div>
  );
}
