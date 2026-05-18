# Akkhar-Code × ASM Integration Brief

> **To:** Yi Guo — ASM author, Tencent Ads PM  
> **From:** Akkhar-Labs Architecture  
> **Date:** 2026-05-16  
> **Status:** Draft — converge on merged format  
> **Purpose:** Ship the three artifacts you need for Trust Delta schema diff

---

## 1. Receipt JSON Shape

Akkhar-Code's Phase 4 (Atomic Execution) closes every pipeline run with an
immutable **Execution Receipt**. This is the JSON shape your Trust Delta
consumer would ingest.

```json
{
  "receipt_version": "0.1",
  "pipeline_id": "ak_pipe_8f3a1c9e-22b7-4d01-aef3-70bc4e5d99f1",
  "service_id": "akkhar-labs/akkhar-code@1.0",
  "model_id": "akkhar-labs/orchestrator-v1:phase4-executor",
  "timestamp_start": "2026-05-12T09:41:03.112Z",
  "timestamp_end": "2026-05-12T09:41:04.887Z",
  "duration_ms": 1775,
  "phase_summary": {
    "phase1_discovery": {
      "ambiguities_surfaced": 3,
      "ambiguities_resolved": 3,
      "skipped": false
    },
    "phase2_planning": {
      "file_operations_planned": 7,
      "refinement_iterations": 1,
      "estimated_complexity": "moderate"
    },
    "phase3_gating": {
      "decision": "approved",
      "approved_at": "2026-05-12T09:41:02.004Z"
    },
    "phase4_execution": {
      "status": "success",
      "operations_executed": 7,
      "operations_failed": 0,
      "rollback_performed": false,
      "bytes_written": 14382
    }
  },
  "plan_hash": "sha256:a1c4f89e3b…d702f",
  "seal": {
    "algorithm": "sha256",
    "scope": "execution_payload",
    "digest": "sha256:e4b2c91f7a…88d3e",
    "byte_range": "see §2"
  },
  "billing": {
    "dimension": "pipeline_run",
    "unit": "per_run",
    "quantity": 1,
    "input_tokens": 2840,
    "output_tokens": 11206,
    "currency": "USD",
    "cost": 0.0037
  },
  "outcome": {
    "files_created": 2,
    "files_modified": 4,
    "files_deleted": 1,
    "test_strategy_emitted": true
  }
}
```

### Field glossary

| Field | Type | Unit / Note |
|-------|------|-------------|
| `pipeline_id` | UUIDv4, `ak_pipe_` prefix | One per prompt-to-execution run |
| `service_id` | ASM-compatible string | See §3 for convention |
| `model_id` | Scoped identifier | Identifies the model + phase role |
| `duration_ms` | int | Wall-clock, Phase 1 start → Phase 4 commit |
| `phase_summary.*` | object | Per-phase counters; all phases always present |
| `plan_hash` | `sha256:hex` | Hash of the **approved** `ImplementationPlan` JSON |
| `seal.digest` | `sha256:hex` | Hash of the execution payload byte range (§2) |
| `billing.dimension` | string | Maps to ASM `pricing.billing_dimensions[].dimension` |
| `billing.input_tokens` / `output_tokens` | int | Aggregate across all 4 phases |
| `billing.cost` | float | Estimated; actual settlement via AP2/payment rail |

---

## 2. Seal: What It Computes Over

Your earlier example used `sha256_checksum_of_raw_stream`. Here is the actual
byte range and construction for Akkhar-Code receipts.

### Sealed byte range

The seal covers a **canonical execution payload** — not the full receipt, and
not the raw model output stream. The payload is constructed as follows:

```
SEALED_BYTES = canonical_json(
  pipeline_id            // 36 bytes UUID
  + plan_hash            // 32 bytes (raw SHA-256, not hex)
  + ordered_file_ops[]   // For each FileOperation in execution order:
      filepath (UTF-8)
      + action enum (1 byte: 0x01=create, 0x02=modify, 0x03=delete, 0x04=rename)
      + content_hash (32 bytes, SHA-256 of post-write file content)
  + timestamp_end        // 8 bytes, Unix epoch ms, big-endian
)
```

### Concrete example

```
pipeline_id:    ak_pipe_8f3a1c9e-22b7-4d01-aef3-70bc4e5d99f1
plan_hash:      a1c4f89e3b…d702f
file_ops[0]:    src/auth/middleware.ts | 0x01 (create) | sha256:ff91…
file_ops[1]:    src/routes/api.ts     | 0x02 (modify) | sha256:3a8c…
  …
file_ops[6]:    src/old/legacy.ts     | 0x03 (delete) | sha256:0000…
timestamp_end:  2026-05-12T09:41:04.887Z → 1778603264887

seal.digest = sha256( canonical_json( above ) )
            = sha256:e4b2c91f7a…88d3e
```

### Design rationale

| Choice | Why |
|--------|-----|
| Hash **post-write content**, not diffs | Diffs are presentation; content hashes are deterministic and diffable offline |
| Include `plan_hash` in seal | Binds the receipt to the exact plan the human approved — tamper-evident chain from Phase 3 → Phase 4 |
| Exclude Phase 1/2 chat tokens | Those are advisory; only the approved plan and its execution are settlement-relevant |
| `0x00…` for deletes | Content hash of a deleted file is defined as the zero hash — no ambiguity |

### What this means for Trust Delta

Your verifier can recompute the seal from the receipt fields + the post-write
file content hashes. If `seal.digest` matches, the execution was faithful to
the approved plan. If it doesn't, either the executor deviated or the receipt
was tampered with.

---

## 3. Model Identifier Convention → ASM `service_id` Mapping

### Akkhar-Code's `model_id` format

```
{org}/{product}@{version}:{phase_role}
```

Examples:

| `model_id` | When used |
|------------|-----------|
| `akkhar-labs/akkhar-code@1.0:phase1-discovery` | Ambiguity detection + form generation |
| `akkhar-labs/akkhar-code@1.0:phase2-planner` | Implementation plan generation |
| `akkhar-labs/akkhar-code@1.0:phase4-executor` | Deterministic code write pass |
| `anthropic/claude-sonnet-4-20250514@1.0:phase2-planner` | If an external model backs a phase |

### Mapping to ASM `service_id`

The receipt-level `service_id` identifies the **pipeline as a whole**:

```
akkhar-labs/akkhar-code@1.0
```

This maps 1:1 to an ASM manifest with:

```json
{
  "asm_version": "0.3",
  "service_id": "akkhar-labs/akkhar-code@1.0",
  "taxonomy": "tool.code.orchestration",
  "pricing": {
    "billing_dimensions": [
      { "dimension": "pipeline_run", "unit": "per_run", "cost_per_unit": 0.0037, "currency": "USD" },
      { "dimension": "input_tokens",  "unit": "per_1M",  "cost_per_unit": 3.00,   "currency": "USD" },
      { "dimension": "output_tokens", "unit": "per_1M",  "cost_per_unit": 15.00,  "currency": "USD" }
    ]
  }
}
```

### When a phase delegates to an external model

If Phase 2 planning is backed by, say, `openai/gpt-5@1.0`, the receipt
includes a `delegates_to` array so your system can trace cost and quality
back to the underlying ASM `service_id`:

```json
{
  "delegates_to": [
    {
      "phase": "phase2_planning",
      "asm_service_id": "openai/gpt-5@1.0",
      "model_id": "openai/gpt-5@1.0:phase2-planner",
      "tokens_consumed": { "input": 1200, "output": 4800 }
    }
  ]
}
```

This lets Trust Delta resolve the full cost stack: pipeline-level settlement
via `akkhar-labs/akkhar-code@1.0`, with per-phase attribution to upstream
model providers via their own ASM manifests.

---

## 4. Convergence Checklist

What we need from each side to merge:

| # | Akkhar-Labs ships | Yi ships | Status |
|---|-------------------|----------|--------|
| 1 | Receipt JSON shape (this doc §1) | Trust Delta ingest schema | ✅ / 🔲 |
| 2 | Seal byte-range spec (this doc §2) | Verifier recompute logic | ✅ / 🔲 |
| 3 | `model_id` → `service_id` map (this doc §3) | ASM registry entry for `akkhar-labs/akkhar-code@1.0` | ✅ / 🔲 |
| 4 | `delegates_to` convention for sub-model attribution | Schema diff accommodating nested `service_id` refs | ✅ / 🔲 |
| 5 | Sample `.well-known/asm` for Akkhar-Code pipeline | Validation against `asm-v0.3.schema.json` | 🔲 / 🔲 |

---

## 5. Open Questions for Yi

1. **Receipt ingestion cadence** — Does Trust Delta poll for receipts, or do we
   push to a webhook/endpoint? If push, what's the expected payload envelope?

2. **`billing.cost` authority** — The receipt includes an estimated cost. Does
   ASM treat this as self-reported (and verify against the manifest's
   `pricing.billing_dimensions`), or does Trust Delta recompute from token
   counts × published rates?

3. **Multi-model seal chaining** — When `delegates_to` references an upstream
   model, should each delegate also carry its own seal, or is the pipeline-level
   seal sufficient for settlement?

4. **Taxonomy alignment** — We proposed `tool.code.orchestration`. Does that fit
   your 47-taxonomy set, or should we use an existing leaf?

---

*Send yours whenever ready and we converge on the merged format.*
