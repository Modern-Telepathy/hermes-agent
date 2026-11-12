import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTERS,
  domainLeaderboard,
  filterModels,
  formatBytes,
  formatContext,
  formatParams,
  modelSpeed,
  sortModels,
  type ManagedModel,
} from "./model-manager";

function model(overrides: Partial<ManagedModel> = {}): ManagedModel {
  return {
    id: "example-8b",
    name: "Example 8B",
    family: "Example",
    publisher: "Acme",
    type: "chat",
    architecture: "dense",
    params_b: 8,
    active_params_b: 8,
    context_tokens: 131072,
    max_output_tokens: 8192,
    license: "apache-2.0",
    released: "2026-01",
    quant: "Q4_K_M",
    size_bytes: 5 * 1024 ** 3,
    kv_kib_per_token: 112,
    ref_tok_per_sec: 90,
    quality: 70,
    benchmarks: {},
    domains: { general: 70, coding: 66 },
    capabilities: ["tools"],
    runtime: "llamacpp",
    repo: "acme/example-8b-GGUF",
    install_hint: "",
    notes: "",
    downloadable: true,
    best_domain: "general",
    fit: {
      level: "native",
      required_bytes: 6 * 1024 ** 3,
      available_bytes: 24 * 1024 ** 3,
      context_tokens: 32768,
      estimated_tok_per_sec: 88,
      label: "Runs on your GPU",
      detail: "",
    },
    installed: false,
    installed_model_ids: [],
    installed_bytes: 0,
    ...overrides,
  };
}

describe("filterModels", () => {
  it("returns everything for the default filters", () => {
    const rows = [model(), model({ id: "other-4b", type: "vision" })];
    expect(filterModels(rows, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it("searches names, publishers and capabilities", () => {
    const rows = [model(), model({ id: "gemma", name: "Gemma", publisher: "Google" })];
    expect(filterModels(rows, { ...DEFAULT_FILTERS, query: "google" })).toHaveLength(1);
    expect(filterModels(rows, { ...DEFAULT_FILTERS, query: "tools" })).toHaveLength(2);
    expect(filterModels(rows, { ...DEFAULT_FILTERS, query: "nothing" })).toHaveLength(0);
  });

  it("requires every selected domain, not just one", () => {
    const both = model({ domains: { coding: 80, vision: 70 } });
    const onlyCoding = model({ id: "coder", domains: { coding: 90 } });
    const rows = [both, onlyCoding];
    const filtered = filterModels(rows, { ...DEFAULT_FILTERS, domains: ["coding", "vision"] });
    expect(filtered.map((row) => row.id)).toEqual(["example-8b"]);
  });

  it("applies fit, parameter and context limits", () => {
    const big = model({ id: "big", params_b: 70, fit: { ...model().fit, level: "spills" } });
    const rows = [model(), big];
    expect(filterModels(rows, { ...DEFAULT_FILTERS, fit: "native" })).toHaveLength(1);
    expect(filterModels(rows, { ...DEFAULT_FILTERS, maxParamsB: 70 })).toHaveLength(2);
    expect(filterModels(rows, { ...DEFAULT_FILTERS, maxParamsB: 8 })).toHaveLength(1);
    expect(filterModels(rows, { ...DEFAULT_FILTERS, minContext: 200000 })).toHaveLength(0);
  });

  it("filters to models already on disk", () => {
    const rows = [model(), model({ id: "installed", installed: true, installed_bytes: 1 })];
    expect(filterModels(rows, { ...DEFAULT_FILTERS, fit: "installed" }).map((r) => r.id)).toEqual([
      "installed",
    ]);
  });
});

describe("sortModels", () => {
  const rows = [
    model({ id: "small", quality: 60, size_bytes: 2 * 1024 ** 3, context_tokens: 8192 }),
    model({ id: "big", quality: 90, size_bytes: 40 * 1024 ** 3, context_tokens: 262144 }),
  ];

  it("sorts by quality in both directions", () => {
    expect(sortModels(rows, "quality", true).map((r) => r.id)).toEqual(["big", "small"]);
    expect(sortModels(rows, "quality", false).map((r) => r.id)).toEqual(["small", "big"]);
  });

  it("sorts by size and context", () => {
    expect(sortModels(rows, "size", false).map((r) => r.id)).toEqual(["small", "big"]);
    expect(sortModels(rows, "context", true).map((r) => r.id)).toEqual(["big", "small"]);
  });

  it("sorts by estimated speed using the machine fit", () => {
    const slow = model({ id: "slow", fit: { ...model().fit, estimated_tok_per_sec: 5 } });
    const fast = model({ id: "fast", fit: { ...model().fit, estimated_tok_per_sec: 120 } });
    expect(sortModels([slow, fast], "speed", true).map((r) => r.id)).toEqual(["fast", "slow"]);
  });

  it("does not mutate its input", () => {
    const input = [model({ id: "a", quality: 1 }), model({ id: "b", quality: 2 })];
    sortModels(input, "quality", true);
    expect(input.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("domainLeaderboard", () => {
  it("ranks only graded models, strongest first, and respects the limit", () => {
    const rows = [
      model({ id: "a", domains: { coding: 70 } }),
      model({ id: "b", domains: { coding: 92 } }),
      model({ id: "c", domains: { writing: 99 } }),
    ];
    const ranked = domainLeaderboard(rows, "coding", 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].model.id).toBe("b");
    expect(ranked[0].score).toBe(92);
  });
});

describe("formatting", () => {
  it("formats bytes in the band a reader expects", () => {
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GB");
    expect(formatBytes(40 * 1024 ** 3)).toBe("40 GB");
    expect(formatBytes(0)).toBe("—");
  });

  it("formats context windows", () => {
    expect(formatContext(131072)).toBe("128K");
    expect(formatContext(1048576)).toBe("1M");
    expect(formatContext(null)).toBe("—");
  });

  it("shows active parameters for mixture-of-experts models", () => {
    expect(formatParams(model({ params_b: 400, active_params_b: 32, architecture: "moe" }))).toBe(
      "400B (32B active)",
    );
    expect(formatParams(model())).toBe("8.0B");
  });

  it("prefers the machine estimate and falls back to the reference rate", () => {
    expect(modelSpeed(model({ ref_tok_per_sec: 90 }))).toBe(88);
    const unknown = model({
      ref_tok_per_sec: 42,
      fit: { ...model().fit, estimated_tok_per_sec: null },
    });
    expect(modelSpeed(unknown)).toBe(42);
  });
});
