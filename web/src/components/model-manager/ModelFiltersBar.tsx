// Every filter the registry can answer, in one bar. The page owns the state; this
// component only renders it and reports edits.

import { Search } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { SelectOption } from "@nous-research/ui/ui/components/select";
import {
  SORT_OPTIONS,
  formatContext,
  toggleInList,
  type ModelDomain,
  type ModelFilters,
  type ModelManagerMeta,
  type ModelSortKey,
} from "@/lib/model-manager";
import { Chip, FilterSelect } from "@/components/model-manager/ModelManagerPanels";
import { cn, themedBody } from "@/lib/utils";

const FIT_OPTIONS = [
  { value: "any", label: "Any fit" },
  { value: "native", label: "Runs fully on GPU" },
  { value: "runs", label: "Runs on this machine" },
  { value: "installed", label: "Already on disk" },
];

const PARAM_LIMITS = [4, 8, 14, 32, 70, 120, 400];
const CONTEXT_FLOORS = [0, 32768, 131072, 262144, 1048576];

export function ModelFiltersBar({
  filters,
  onChange,
  sort,
  onSortChange,
  descending,
  onDescendingChange,
  licenses,
  meta,
  domains,
  shown,
  total,
  activeFilterCount,
  onReset,
}: {
  filters: ModelFilters;
  onChange: (next: ModelFilters) => void;
  sort: ModelSortKey;
  onSortChange: (value: ModelSortKey) => void;
  descending: boolean;
  onDescendingChange: (value: boolean) => void;
  licenses: string[];
  meta: ModelManagerMeta | null;
  domains: ModelDomain[];
  shown: number;
  total: number;
  activeFilterCount: number;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className={cn("text-sm", themedBody)}>Find a model</CardTitle>
          <span className="text-[11px] text-muted-foreground">
            {shown} of {total} shown
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="ml-2 underline underline-offset-2 hover:text-foreground"
              >
                clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </button>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => onChange({ ...filters, query: event.target.value })}
              placeholder="Search models, publishers, capabilities"
              className="pl-8"
              aria-label="Search models"
            />
          </div>
          <FilterSelect
            id="mm-sort"
            label="Sort by"
            value={sort}
            onValueChange={(value) => onSortChange(value as ModelSortKey)}
          >
            {SORT_OPTIONS.map((option) => (
              <SelectOption key={option.value} value={option.value}>
                {option.label}
              </SelectOption>
            ))}
          </FilterSelect>
          <FilterSelect
            id="mm-direction"
            label="Sort direction"
            value={descending ? "desc" : "asc"}
            onValueChange={(value) => onDescendingChange(value === "desc")}
          >
            <SelectOption value="desc">Best first</SelectOption>
            <SelectOption value="asc">Worst first</SelectOption>
          </FilterSelect>
          <FilterSelect
            id="mm-fit"
            label="Hardware fit"
            value={filters.fit}
            onValueChange={(value) => onChange({ ...filters, fit: value as ModelFilters["fit"] })}
          >
            {FIT_OPTIONS.map((option) => (
              <SelectOption key={option.value} value={option.value}>
                {option.label}
              </SelectOption>
            ))}
          </FilterSelect>
          <FilterSelect
            id="mm-max-params"
            label="Maximum parameters"
            value={filters.maxParamsB?.toString() ?? "any"}
            onValueChange={(value) =>
              onChange({ ...filters, maxParamsB: value === "any" ? null : Number(value) })
            }
          >
            <SelectOption value="any">Any size</SelectOption>
            {PARAM_LIMITS.map((limit) => (
              <SelectOption key={limit} value={String(limit)}>
                ≤ {limit}B params
              </SelectOption>
            ))}
          </FilterSelect>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Type
            </span>
            {(meta?.types ?? []).map((type) => (
              <Chip
                key={type.id}
                active={filters.types.includes(type.id)}
                onClick={() => onChange({ ...filters, types: toggleInList(filters.types, type.id) })}
              >
                {type.label}
              </Chip>
            ))}
            <span className="ml-2 mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Architecture
            </span>
            {(meta?.architectures ?? []).map((arch) => (
              <Chip
                key={arch.id}
                active={filters.architectures.includes(arch.id)}
                onClick={() =>
                  onChange({
                    ...filters,
                    architectures: toggleInList(filters.architectures, arch.id),
                  })
                }
              >
                {arch.label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Domain
            </span>
            {domains.map((domain) => (
              <Chip
                key={domain.id}
                active={filters.domains.includes(domain.id)}
                onClick={() =>
                  onChange({ ...filters, domains: toggleInList(filters.domains, domain.id) })
                }
              >
                {domain.label}
              </Chip>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <FilterSelect
              id="mm-license"
              label="Licence"
              value={filters.licenses[0] ?? "any"}
              onValueChange={(value) =>
                onChange({ ...filters, licenses: value === "any" ? [] : [value] })
              }
            >
              <SelectOption value="any">Any licence</SelectOption>
              {licenses.map((license) => (
                <SelectOption key={license} value={license}>
                  {license}
                </SelectOption>
              ))}
            </FilterSelect>
            <FilterSelect
              id="mm-min-context"
              label="Minimum context"
              value={filters.minContext?.toString() ?? "0"}
              onValueChange={(value) => onChange({ ...filters, minContext: Number(value) || null })}
            >
              {CONTEXT_FLOORS.map((floor) => (
                <SelectOption key={floor} value={String(floor)}>
                  {floor === 0 ? "Any context" : `${formatContext(floor)}+ context`}
                </SelectOption>
              ))}
            </FilterSelect>
          </div>
        </div>

        {filters.domains.length > 1 && (
          <Badge tone="outline">matches all {filters.domains.length} selected domains</Badge>
        )}
      </CardContent>
    </Card>
  );
}
