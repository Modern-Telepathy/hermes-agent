// Presentational pieces of the Model Manager: machine facts, what is serving, the
// selected model's detail, and the two small controls the filter bar shares.

import type { ReactNode } from "react";
import { Cpu, Download, HardDrive, MemoryStick, Server, Trash2 } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Label } from "@nous-research/ui/ui/components/label";
import { Select } from "@nous-research/ui/ui/components/select";
import {
  FIT_TONE,
  formatBytes,
  formatContext,
  formatParams,
  type ManagedModel,
  type ModelManagerHardware,
  type ServingModel,
} from "@/lib/model-manager";
import { cn, themedBody } from "@/lib/utils";

const BENCH_LABELS: Record<string, string> = {
  mmlu_pro: "MMLU-Pro",
  gpqa: "GPQA",
  humaneval: "HumanEval",
  aime: "AIME",
  mmmu: "MMMU",
  swe_bench: "SWE-bench",
  mteb: "MTEB",
  wer: "WER",
  hps_v3: "HPS v3",
};

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-foreground/40 bg-foreground/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** The library Select carries no accessible name of its own; pair it with a hidden label. */
export function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select id={id} value={value} onValueChange={onValueChange}>
        {children}
      </Select>
    </div>
  );
}

export function MachineCard({ hardware }: { hardware: ModelManagerHardware }) {
  const usable = hardware.unified_memory ? hardware.ram_available_bytes : hardware.vram_usable_bytes;
  const facts: { icon: ReactNode; label: string; value: string }[] = [
    {
      icon: <Cpu className="size-3.5" />,
      label: hardware.gpu_name ? "GPU" : "Compute",
      value: hardware.gpu_name || hardware.cpu || `${hardware.arch} CPU`,
    },
    {
      icon: <MemoryStick className="size-3.5" />,
      label: hardware.unified_memory ? "Usable unified memory" : "Usable GPU memory",
      value: formatBytes(usable),
    },
    {
      icon: <HardDrive className="size-3.5" />,
      label: "System RAM",
      value: `${formatBytes(hardware.ram_total_bytes)} (${formatBytes(hardware.ram_available_bytes)} free)`,
    },
    {
      icon: <Server className="size-3.5" />,
      label: "Managed engine",
      value: hardware.engine_installed ? "Installed" : "Not installed",
    },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm", themedBody)}>This machine</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {fact.icon}
                {fact.label}
              </dt>
              <dd className="mt-0.5 truncate text-xs text-foreground" title={fact.value}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 truncate text-[10px] text-muted-foreground" title={hardware.models_dir}>
          {hardware.platform} · {hardware.cpu_cores} cores · models live in{" "}
          <span className="font-mono">{hardware.models_dir}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export function ServingCard({ serving }: { serving: ServingModel[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm", themedBody)}>Running now</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {serving.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing is serving right now. Downloaded models start with the local runtime, and
            Ollama or LM Studio models appear here when their daemon is running.
          </p>
        ) : (
          serving.map((row) => (
            <div
              key={`${row.provider}:${row.id}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="truncate font-mono" title={row.id}>
                {row.id}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge tone="secondary">{row.provider}</Badge>
                <Badge tone={row.status === "active" ? "success" : "outline"}>{row.status}</Badge>
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function BenchmarkList({ model }: { model: ManagedModel }) {
  const entries = Object.entries(model.benchmarks).filter(
    ([, value]) => value !== null && value !== undefined,
  ) as [string, number][];
  if (entries.length === 0) return null;
  return (
    <dl className="grid gap-1.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-2 text-[11px]">
          <dt className="text-muted-foreground">{BENCH_LABELS[key] ?? key}</dt>
          <dd className="font-mono text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SelectedDetail({
  model,
  domainLabels,
  onDownload,
  onRemove,
  busy,
  removable,
}: {
  model: ManagedModel;
  domainLabels: Record<string, string>;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  busy: boolean;
  removable: boolean;
}) {
  const topDomains = Object.entries(model.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, score]) => ({ id, label: domainLabels[id] ?? id, score }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className={cn("text-sm", themedBody)}>{model.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={FIT_TONE[model.fit.level]}>{model.fit.label}</Badge>
            {model.installed && <Badge tone="outline">On disk</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {model.notes || `${model.family} by ${model.publisher}.`}
        </p>
        <p className="text-[11px] text-muted-foreground">{model.fit.detail}</p>

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Reference benchmarks
            </h3>
            <BenchmarkList model={model} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Best domains
            </h3>
            <ul className="space-y-1">
              {topDomains.map((domain) => (
                <li key={domain.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 shrink-0 text-muted-foreground">{domain.label}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-foreground/50"
                      style={{ width: `${domain.score}%` }}
                    />
                  </span>
                  <span className="w-6 text-right font-mono text-muted-foreground">
                    {domain.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatParams(model)}</span>
          <span>·</span>
          <span>{formatContext(model.context_tokens)} context</span>
          <span>·</span>
          <span>{model.quant}</span>
          <span>·</span>
          <span>{model.license}</span>
          {model.released && (
            <>
              <span>·</span>
              <span>released {model.released}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {model.capabilities.map((capability) => (
            <Badge key={capability} tone="secondary">
              {capability}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {model.downloadable && !model.installed && (
            <Button size="sm" disabled={busy} onClick={() => onDownload(model.id)}>
              <Download className="mr-1 size-3.5" />
              Download {model.quant}
            </Button>
          )}
          {removable && (
            <Button size="sm" outlined disabled={busy} onClick={() => onRemove(model.id)}>
              <Trash2 className="mr-1 size-3.5" />
              Remove
            </Button>
          )}
          {!model.downloadable && (
            <span className="text-[11px] text-muted-foreground">
              {model.install_hint || "Runs outside the managed llama.cpp engine."}
            </span>
          )}
          {model.repo && (
            <a
              className="text-[11px] underline underline-offset-2 hover:text-foreground"
              href={`https://huggingface.co/${model.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              {model.repo}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
