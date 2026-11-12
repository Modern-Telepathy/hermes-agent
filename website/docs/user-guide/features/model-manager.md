---
sidebar_position: 5
title: Model Manager
description: Browse every model worth running, see what fits this machine, filter by domain, and download — with charts.
---

# Model Manager

The Model Manager is the dashboard's one place to answer *which model should I run for
this?* It reads your hardware, lists models graded across thirteen domains, prices each
one against your machine, and downloads the build you pick.

Open **Dashboard → Model Manager** (`hermes dashboard`, then the sidebar entry next to
**Models**). The **Models** page is about the models your API calls already use; the
Model Manager is about the models worth running.

## What it shows

**This machine** — GPU (or CPU), usable GPU memory, system RAM, the detected platform,
and whether the managed llama.cpp engine is installed. On unified-memory machines the
budget is derived from free physical memory minus headroom, the same rule the local
runtime uses before any launch.

**Running now** — every model currently serving or configured: the managed llama.cpp
router, an Ollama daemon, LM Studio, and the model Hermes is set to use. A machine with
none of them running simply shows nothing here.

**The registry** — one row per model with its type (chat, reasoning, coding, vision,
embedding, speech, image), architecture (dense, mixture-of-experts, hybrid), parameter
count with active parameters for MoE, download size, native context window, maximum
output, quantisation, licence, release date, capability tags, reference benchmarks
(MMLU-Pro, GPQA, HumanEval, AIME, MMMU, SWE-bench, MTEB, WER, HPS v3) and per-domain
scores.

Each row also carries a **fit verdict for this machine**:

| Verdict | Meaning |
|---|---|
| Runs on your GPU | Fits fully in usable GPU memory at a 32K window |
| Uses system RAM | Works, but part runs on the CPU and generation is slower |
| Too big for this machine | Needs more than GPU + system memory together |
| Runs outside llama.cpp | An embedding, speech or image model with its own runtime |

The verdict prices weights, the KV cache at the planning window, and runtime overhead —
so a long-context model is priced for the window a first launch actually gets, not the
advertised maximum.

## Filters, sorting and charts

- **Search** across model, family, publisher, licence and capability tags.
- **Type**, **architecture** and **domain** chips. Selecting several domains asks for
  models strong in *all* of them.
- **Fit** — runs fully on GPU, runs at all, or already on disk.
- **Maximum parameters**, **minimum context** and **licence**.
- **Sort** by quality, download size, parameters, context, speed on this machine, release
  date or name, in either direction.

Three charts sit above the table, and all of them follow the filters:

- **Quality vs size** (log scale) — the frontier of quality per gigabyte.
- **Quality vs speed here** — estimated tokens/second on your hardware against quality.
- **Best for a domain** — a leaderboard for the selected domain, scoped to the current
  filters.

Clicking a point or a bar selects that model, which opens its detail panel and highlights
its table row. Colours follow the fit verdict, so what will actually run fast is obvious
at a glance.

## Downloading

A downloadable model shows **Download**. The Model Manager resolves the best 4-bit GGUF
in the model's Hugging Face repository, then transfers it through the same resumable
downloader the local runtime uses, with byte progress, rate, ETA, pause and resume.
Finished files land in the machine-wide models directory, and the local runtime picks
them up — a downloaded model can then be selected like any other local model.

Embedding, speech and image models are listed for comparison but are not served by
llama.cpp; their row says how to run them instead (Ollama, NeMo, an image-generation
provider).

**Remove** deletes every file of that model, split parts included.

## About the scores

Domain scores and benchmarks are curated reference figures from public leaderboards and
vendor model cards, normalised to 0–100. They grade the full-precision model, not the
4-bit build you download, and they are guidance for choosing a model rather than a
measurement of your hardware. Token rates are reference-machine estimates; the Model
Manager recomputes a per-machine rate from memory fit. The page footer names the
reference machine.

The registry ships with Hermes (`hermes_cli/model_manager/registry.json`) so the list
works offline; the download step is the only part that needs the network.
