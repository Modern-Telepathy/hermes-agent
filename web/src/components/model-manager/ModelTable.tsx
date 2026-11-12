// The table is the exhaustive view: every field the registry carries, one row per model,
// with the row action that applies (download, progress, remove, or "external runtime").

import { Download, Trash2 } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import {
  FIT_TONE,
  formatBytes,
  formatContext,
  formatParams,
  modelSpeed,
  type ManagedModel,
  type ModelDownloadJob,
} from "@/lib/model-manager";
import { cn, themedBody } from "@/lib/utils";

function RowAction({
  model,
  job,
  busy,
  confirmRemove,
  onDownload,
  onRemove,
}: {
  model: ManagedModel;
  job: ModelDownloadJob | null;
  busy: boolean;
  confirmRemove: boolean;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (job?.model_id === model.id && job.status === "running") {
    return <span className="text-[11px] text-muted-foreground">{job.percent ?? 0}%</span>;
  }
  if (model.installed) {
    return (
      <Button
        size="sm"
        outlined
        onClick={(event) => {
          event.stopPropagation();
          onRemove(model.id);
        }}
      >
        <Trash2 className="mr-1 size-3" />
        {confirmRemove ? "Confirm" : "Remove"}
      </Button>
    );
  }
  if (model.downloadable) {
    return (
      <Button
        size="sm"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onDownload(model.id);
        }}
      >
        <Download className="mr-1 size-3" />
        Download
      </Button>
    );
  }
  return <span className="text-[10px] text-muted-foreground">External</span>;
}

export function ModelTable({
  rows,
  selectedId,
  job,
  busyId,
  confirmRemove,
  onSelect,
  onDownload,
  onRemove,
}: {
  rows: ManagedModel[];
  selectedId: string | null;
  job: ModelDownloadJob | null;
  busyId: string | null;
  confirmRemove: string | null;
  onSelect: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm", themedBody)}>All models</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Model</th>
              <th className="py-2 pr-3 font-normal">Type</th>
              <th className="py-2 pr-3 font-normal">Params</th>
              <th className="py-2 pr-3 font-normal">Size</th>
              <th className="py-2 pr-3 font-normal">Context</th>
              <th className="py-2 pr-3 font-normal">tok/s</th>
              <th className="py-2 pr-3 font-normal">Fit</th>
              <th className="py-2 pr-3 font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((model) => {
              const speed = modelSpeed(model);
              return (
                <tr
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  className={cn(
                    "cursor-pointer border-t border-border/40 align-middle",
                    selectedId === model.id && "bg-foreground/5",
                  )}
                >
                  <td className="py-2 pr-3">
                    <div className="flex flex-col">
                      <span className="text-foreground">{model.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {model.publisher} · {model.architecture}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{model.type}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatParams(model)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatBytes(model.size_bytes)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {formatContext(model.context_tokens)}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {speed ? Math.round(speed) : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={FIT_TONE[model.fit.level]}>{model.fit.label}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <RowAction
                      model={model}
                      job={job}
                      busy={busyId === model.id}
                      confirmRemove={confirmRemove === model.id}
                      onDownload={onDownload}
                      onRemove={onRemove}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No models match these filters.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
