#!/usr/bin/env python3
"""Inventory stale modern-HRIS successor consumers without importing authors.

This reviewer-owned scanner treats every candidate and generator as plain text.
It does not derive expected counts or identities from an author implementation.
The emitted DAG separates active Gate consumers from immutable historical
evidence so a remediation cannot make an old report appear current.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parents[1]

EXPECTED_SUCCESSOR = {
    "operations": 199,
    "commands": 133,
    "queries": 66,
    "handlers": 25,
    "publicEvents": 155,
    "tables": 115,
}

CANONICAL_BASENAMES = frozenset({
    "modern-capability-closed-set-manifest.v3.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-causal-state-contracts.v2.json",
    "modern-capability-semantic-bindings.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
})

PHYSICAL_BASENAMES = frozenset({
    "modern-query-projection-physical-contracts.v3.json",
    "modern-owner-handler-physical-contracts.v3.json",
    "hrm-modern-forward-ddl.v3.sql",
    "per-modern-forward-ddl.v3.sql",
    "tim-modern-forward-ddl.v3.sql",
    "sys-modern-forward-ddl.v3.sql",
})

LEGACY_ORACLE_BASENAMES = frozenset({
    "modern-causal-independent-review-inventory.v1.json",
    "modern-causal-independent-reviewed-finalization.v1.json",
    "modern-causal-independent-oracle.v1.json",
    "modern-causal-independent-pg-fixtures.v1.json",
    "modern-causal-final-source-authority-manifest.v1.json",
})

TEXT_SUFFIXES = frozenset({
    ".py", ".cjs", ".mjs", ".js", ".json", ".csv", ".md", ".sql",
    ".yaml", ".yml", ".txt",
})

SCAN_ROOTS = (
    BLUEPRINT / "coding-readiness",
    BLUEPRINT / "g0",
    BLUEPRINT / "session-evidence",
    BLUEPRINT / "session-prompts",
)

# These require count syntax or immediate prose adjacency.  That deliberately
# avoids treating an unrelated CSV source line number such as 100 as a modern
# operation count merely because the same row contains the word "operation".
STALE_LITERAL_RULES = (
    ("operations", 100, re.compile(
        r"(?:[\"']operations[\"']\s*:\s*100\b|operations=100\b|"
        r"\boperations?\s*(?:count\s*)?(?:==|=)\s*100\b|"
        r"\b(?:100개\s*(?:planned\s+|public\s+|API\s+)?operations?|100-operation|100\s+operations?)(?![A-Za-z])|"
        r"\bmodern\s+operations?\s+100\b)", re.I)),
    ("commands", 81, re.compile(
        r"(?:[\"']commands[\"']\s*:\s*81\b|commands=81\b|"
        r"\bcommands?\s*(?:count\s*)?(?:==|=)\s*81\b|"
        r"\b(?:81개\s*commands?|81-command|81\s+commands?)(?![A-Za-z]))", re.I)),
    ("queries", 19, re.compile(
        r"(?:[\"']queries[\"']\s*:\s*19\b|queries=19\b|"
        r"\bquer(?:y|ies)\s*(?:count\s*)?(?:==|=)\s*19\b|"
        r"\b(?:19개\s*quer(?:y|ies)|19-query|19\s+quer(?:y|ies))(?![A-Za-z]))", re.I)),
    ("handlers", 4, re.compile(
        r"(?:[\"']handlers[\"']\s*:\s*4\b|handlers=4\b|"
        r"\bhandlers?\s*(?:count\s*)?(?:==|=)\s*4\b|"
        r"\b4(?:개|\s+)(?:internal|owner-result|internal-message)?[-_ ]?handlers?\b)", re.I)),
    ("publicEvents", 86, re.compile(
        r"(?:[\"'](?:publicEvents|events)[\"']\s*:\s*86\b|events=86\b|"
        r"\b(?:public\s+)?events?\s*(?:count\s*)?(?:==|=)\s*86\b|"
        r"\b(?:86개\s*(?:public\s+)?events?|86-event|86\s+(?:public\s+)?events?)(?![A-Za-z])|"
        r"\bmodern\s+events?\s+86\b)", re.I)),
    ("tables", 71, re.compile(
        r"(?:[\"']tables[\"']\s*:\s*71\b|tables=71\b|"
        r"\btables?\s*(?:count\s*)?(?:==|=)\s*71\b|"
        r"\b(?:71개\s*(?:(?:producer-owned|physical)\s+)*tables?|71-table|71\s+(?:(?:producer-owned|physical)\s+)*tables?)(?![A-Za-z]))", re.I)),
    ("activeModernTables", 91, re.compile(
        r"(?:[\"']producer_modern[\"']\s*:\s*91\b|producer_modern\s*=\s*91\b|"
        r"\b(?:active|producer)[-_ ]modern(?:[-_ ]owner)?\s+tables?\s*(?:==|=)?\s*91(?:개)?|"
        r"\b91\s+(?:active|producer)[-_ ]modern(?:[-_ ]owner)?\s+tables?\b)", re.I)),
    ("preScopeModernTables", 106, re.compile(
        r"(?:[\"'](?:tables|tableSpecifications|producer_modern)[\"']\s*:\s*106\b|"
        r"\b(?:active|current|expected|exact|producer)[-_ ]modern(?:[-_ ]owner)?\s+tables?\s*(?:==|=)?\s*106(?:개)?|"
        r"\b106\s+(?:active|current|expected|exact|producer-owned|physical)\s+(?:modern\s+)?tables?\b)", re.I)),
    ("semanticBindings", 3738, re.compile(
        r"(?:[\"'](?:semanticBindings|bindings)[\"']\s*:\s*3738\b|bindings=3738\b|"
        r"\b3,?738(?:개)?\s+(?:exact|explicit|semantic)?\s*bindings?\b)", re.I)),
    ("plannedOwnerTables", 254, re.compile(
        r"(?:[\"']planned_tables[\"']\s*:\s*254\b|planned_tables\s*=\s*254\b|"
        r"\b254\s+(?:planned|authoritative|owner)\s+tables?\b|"
        r"planned(?:\s+owner)?\s+tables?[^0-9\n]{0,30}254(?:개)?)", re.I)),
    ("preScopePlannedOwnerTables", 269, re.compile(
        r"(?:[\"']planned_tables[\"']\s*:\s*269\b|planned_tables\s*=\s*269\b|"
        r"\b269\s+(?:planned|authoritative|owner)\s+tables?\b|"
        r"planned(?:\s+owner)?\s+tables?[^0-9\n]{0,30}269(?:개)?)", re.I)),
)

HISTORICAL_LINE = re.compile(
    r"\b(?:predecessor|historical|history|immutable predecessor|preserved sealed)\b|"
    r"역사|과거|predecessor\s+수량",
    re.I,
)
ACTIVE_ASSERTION = re.compile(
    r"\b(?:active|current|expected|must|exact|latest|require|authoritative|gate|pass)\b|"
    r"현재|정본|정확|필수|통과",
    re.I,
)
HEX64 = re.compile(r"\b[0-9a-f]{64}\b")

KNOWN_INDIRECT_CONSUMERS = {
    "coding-readiness/validate_information_architecture.py": [
        "coding-readiness/generate_information_architecture_register.py",
        "coding-readiness/modern_closed_set_design.py",
        "coding-readiness/hris-information-architecture-register.csv",
    ],
    "coding-readiness/validate_modern_capability_authorization.py": [
        "coding-readiness/modern-capability-authorization-register.csv",
        "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    ],
    "coding-readiness/validate_cross_module_schema_contracts.py": [
        "coding-readiness/cross-module-canonical-schemas.v1.json",
        "coding-readiness/cross-module-schema-binding-register.csv",
        "session-evidence/per/g3-modern-capability-contracts.v2.json",
    ],
    "coding-readiness/validate_physical_owner_prefixes.py": [
        "coding-readiness/physical-owner-prefix-register.csv",
        "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
    ],
    "coding-readiness/validate_g3_slice_code_go.py": [
        "coding-readiness/g3-slice-code-go-register.csv",
        "coding-readiness/g3-contract-primary-ownership-register.csv",
    ],
    "coding-readiness/validate_full_coding_readiness.py": [
        "coding-readiness/validate_modern_capability_contracts.py",
        "coding-readiness/validate_modern_causal_state_contracts.py",
        "coding-readiness/validate_modern_causal_independent_oracle.py",
        "coding-readiness/run_modern_causal_independent_pg_fixtures.py",
        "coding-readiness/validate_modern_causal_final_endorsement.py",
        "coding-readiness/validate_information_architecture.py",
        "coding-readiness/validate_modern_capability_authorization.py",
        "coding-readiness/validate_physical_owner_prefixes.py",
    ],
    "g0/validate_contract_publication_bootstrap.py": [
        "coding-readiness/g3-contract-primary-ownership-register.csv",
    ],
    "g0/validate_code_checkpoint.py": [
        "coding-readiness/validate_full_coding_readiness.py",
        "coding-readiness/g3-slice-code-go-register.csv",
    ],
}

EXTERNALLY_REPRODUCED_FINDINGS = (
    {
        "consumer": "coding-readiness/validate_information_architecture.py",
        "result": "FAIL",
        "evidence": "22 modern node api refs drift plus 2 unknown operations",
    },
    {
        "consumer": "coding-readiness/validate_modern_capability_authorization.py",
        "result": "FAIL",
        "evidence": "26 route/exact-operation closure defects",
    },
    {
        "consumer": "coding-readiness/validate_physical_owner_prefixes.py",
        "result": "FAIL",
        "evidence": "producer_modern expected 91 but candidate has 106; planned owner total expected 254 but candidate has 269",
    },
    {
        "consumer": "coding-readiness/validate_cross_module_schema_contracts.py",
        "result": "FAIL",
        "evidence": "XCON-021 producer evidence field-set drift",
    },
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(BLUEPRINT).as_posix()


def classify(path: Path) -> str:
    rel = relative(path)
    name = path.name
    if "/reports/" in f"/{rel}/" or rel.startswith("coding-readiness/reports/"):
        return "HISTORICAL_EVIDENCE_PRESERVE_BYTES"
    if rel.endswith("initial-independent-findings.v1.json"):
        return "HISTORICAL_EVIDENCE_PRESERVE_BYTES"
    if name == "modern-canonical-predecessor-byte-baseline.v1.json":
        return "HISTORICAL_EVIDENCE_PRESERVE_BYTES"
    if "/semantic-remediation/" in f"/{rel}/" and (
        ".proposal." in name or name == "remediation-integration-plan.md"
    ):
        return "HISTORICAL_DESIGN_PROPOSAL_PRESERVE_BYTES"
    if name in LEGACY_ORACLE_BASENAMES:
        return "PREDECESSOR_ORACLE_PRESERVE_BUT_REMOVE_FROM_ACTIVE_GATE"
    if name in CANONICAL_BASENAMES:
        return "AUTHOR_CANONICAL_CANDIDATE"
    if name in PHYSICAL_BASENAMES or "modern-physical-successor" in rel:
        return "AUTHOR_PHYSICAL_CANDIDATE"
    if name in {
        "generate_modern_canonical_five_successor.py",
        "generate_modern_causal_module_successor.py",
        "generate_modern_closed_set_manifest.py",
        "generate_modern_exact_event_successor.py",
        "generate_modern_operation_ssot_successor.py",
        "generate_modern_semantic_identity_successor.py",
    }:
        return "AUTHOR_SUCCESSOR_PRODUCER_CANDIDATE"
    if name.startswith("generate_modern_") or name in {
        "modern_closed_set_design.py", "modern_causal_successor.py",
        "modern_causal_candidate_projection.py",
    }:
        return "ACTIVE_LEGACY_PRODUCER_TO_SUPERSEDE"
    if name.startswith(("validate_", "audit_", "test_", "run_", "build_", "prepare_")):
        return "ACTIVE_VALIDATOR_OR_GATE_CONSUMER"
    if rel.startswith("session-prompts/") or path.suffix == ".md":
        return "ACTIVE_OPERATOR_DOCUMENT"
    if rel.startswith("session-evidence/") and "g3-modern" in name:
        return "ACTIVE_DERIVED_MODULE_CONTRACT"
    if path.suffix in {".csv", ".json", ".yaml", ".yml"}:
        return "ACTIVE_REGISTER_OR_DERIVED_CONTRACT"
    return "REVIEW_RELEVANT_TEXT"


def is_active(classification: str) -> bool:
    return classification not in {
        "HISTORICAL_EVIDENCE_PRESERVE_BYTES",
        "HISTORICAL_DESIGN_PROPOSAL_PRESERVE_BYTES",
        "PREDECESSOR_ORACLE_PRESERVE_BUT_REMOVE_FROM_ACTIVE_GATE",
        "AUTHOR_CANONICAL_CANDIDATE",
        "AUTHOR_PHYSICAL_CANDIDATE",
        "AUTHOR_SUCCESSOR_PRODUCER_CANDIDATE",
    }


def read_text(path: Path) -> str | None:
    try:
        if path.stat().st_size > 12_000_000:
            return None
        raw = path.read_bytes()
    except OSError:
        return None
    if len(raw) > 12_000_000 or b"\0" in raw:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None


def references(text: str) -> list[str]:
    names = CANONICAL_BASENAMES | PHYSICAL_BASENAMES | LEGACY_ORACLE_BASENAMES
    return sorted(name for name in names if name in text)


def stale_literals(text: str) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for semantic, old_value, context_pattern in STALE_LITERAL_RULES:
            if not re.search(rf"(?<![0-9]){old_value}(?![0-9])", line):
                continue
            if not context_pattern.search(line):
                continue
            historical = bool(HISTORICAL_LINE.search(line)) and not bool(ACTIVE_ASSERTION.search(line))
            hits.append({
                "line": line_no,
                "semantic": semantic,
                "predecessorValue": old_value,
                "disposition": (
                    "EXPLICIT_HISTORICAL_REFERENCE_ALLOWED"
                    if historical else "STALE_ACTIVE_ASSERTION_OR_REVIEW_REQUIRED"
                ),
                "excerpt": line.strip()[:600],
            })
    return hits


def hash_pins(text: str, direct_refs: list[str]) -> list[dict[str, Any]]:
    if not direct_refs and "modern" not in text.lower():
        return []
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for match in HEX64.finditer(line):
            context = line.strip()
            if not re.search(
                r"(?:modern[^\n]{0,80}(?:sha|hash|digest|pin)|"
                r"(?:sha|hash|digest|pin)[^\n]{0,80}modern|"
                r"modern-capability-[^\s\"']+\.json[^\n]{0,80}[0-9a-f]{64}|"
                r"EXPECTED_[A-Z0-9_]*MODERN[A-Z0-9_]*SHA)",
                context,
                re.I,
            ):
                continue
            rows.append({
                "line": line_no,
                "sha256": match.group(0),
                "disposition": "REVIEW_AND_REPIN_IF_CURRENT_AUTHORITY",
                "excerpt": context[:600],
            })
    return rows


def discover() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    nodes: list[dict[str, Any]] = []
    edges: set[tuple[str, str, str]] = set()
    artifact_locations: dict[str, list[Path]] = {}
    for basename in CANONICAL_BASENAMES | LEGACY_ORACLE_BASENAMES:
        path = BLUEPRINT / "coding-readiness" / basename
        artifact_locations[basename] = [path] if path.is_file() else []
    for basename in PHYSICAL_BASENAMES:
        path = BLUEPRINT / "coding-readiness" / "modern-physical-successor" / basename
        artifact_locations[basename] = [path] if path.is_file() else []
    candidate_paths = set((BLUEPRINT / "coding-readiness").rglob("*"))
    candidate_paths.update((BLUEPRINT / "g0").rglob("*"))
    candidate_paths.update((BLUEPRINT / "session-prompts").glob("*"))
    candidate_paths.update((BLUEPRINT / "session-evidence").glob("*/g3-modern-capability-contracts*.json"))
    candidate_paths.update((BLUEPRINT / "session-evidence").glob("pay/g3-modern-capability-consumer-contracts*.json"))
    for path in sorted(candidate_paths):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        rel_hint = relative(path)
        if "/semantic-remediation/" in f"/{rel_hint}/" and (
            ".proposal." in path.name or path.name == "remediation-integration-plan.md"
        ):
            continue
        if "/reports/" in f"/{rel_hint}/" and not any(
            token in path.name
            for token in ("modern", "full-coding", "five-module", "semantic")
        ):
            continue
        if "/.git/" in path.as_posix() or "/node_modules/" in path.as_posix():
            continue
        if HERE in path.parents or path == HERE:
            continue
        text = read_text(path)
        if text is None:
            continue
        direct_refs = references(text)
        literals = stale_literals(text)
        pins = hash_pins(text, direct_refs)
        rel = relative(path)
        classification = classify(path)
        indirect = KNOWN_INDIRECT_CONSUMERS.get(rel, [])
        predecessor_active_refs = sorted(
            name for name in LEGACY_ORACLE_BASENAMES if name in text
        )
        relevant = bool(
            direct_refs or indirect or literals or predecessor_active_refs
            or rel in KNOWN_INDIRECT_CONSUMERS
        )
        if not relevant:
            continue
        node = {
            "path": rel,
            "classification": classification,
            "activeConsumer": is_active(classification),
            "fileSha256AtScan": sha256(path),
            "directArtifactRefs": direct_refs,
            "indirectDependencies": indirect,
            "predecessorOracleRefs": predecessor_active_refs,
            "staleLiteralFindings": literals,
            "hashPinsForReview": pins,
        }
        nodes.append(node)
        for basename in direct_refs:
            matches = artifact_locations.get(basename, [])
            if len(matches) == 1:
                edges.add((relative(matches[0]), rel, "DIRECT_FILE_REFERENCE"))
        for dependency in indirect:
            edges.add((dependency, rel, "KNOWN_RUNTIME_OR_GENERATION_DEPENDENCY"))
    return nodes, [
        {"from": source, "to": target, "kind": kind}
        for source, target, kind in sorted(edges)
    ]


def build_report() -> dict[str, Any]:
    nodes, edges = discover()
    active_stale = [
        {
            "path": node["path"],
            "findings": [
                row for row in node["staleLiteralFindings"]
                if row["disposition"] == "STALE_ACTIVE_ASSERTION_OR_REVIEW_REQUIRED"
            ],
        }
        for node in nodes
        if node["activeConsumer"]
        and any(
            row["disposition"] == "STALE_ACTIVE_ASSERTION_OR_REVIEW_REQUIRED"
            for row in node["staleLiteralFindings"]
        )
    ]
    active_legacy_oracle_refs = [
        {"path": node["path"], "refs": node["predecessorOracleRefs"]}
        for node in nodes
        if node["activeConsumer"] and node["predecessorOracleRefs"]
    ]
    historical = sorted(
        node["path"] for node in nodes
        if node["classification"] in {
            "HISTORICAL_EVIDENCE_PRESERVE_BYTES",
            "HISTORICAL_DESIGN_PROPOSAL_PRESERVE_BYTES",
            "PREDECESSOR_ORACLE_PRESERVE_BUT_REMOVE_FROM_ACTIVE_GATE",
        }
    )
    active_consumers = sorted(
        node["path"] for node in nodes if node["activeConsumer"]
    )
    blockers = (
        sum(len(row["findings"]) for row in active_stale)
        + len(active_legacy_oracle_refs)
        + len(EXTERNALLY_REPRODUCED_FINDINGS)
    )
    return {
        "reportId": "dwp.hris.modern-independent-successor.dependency-dag.v1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "FAIL" if blockers else "PASS",
        "reviewBoundary": "STATIC_TEXT_AND_DECLARED_DEPENDENCIES_NO_AUTHOR_IMPORT",
        "expectedSuccessor": EXPECTED_SUCCESSOR,
        "classificationPolicy": {
            "historicalEvidence": "preserve bytes and never relabel as successor PASS",
            "predecessorOracle": "preserve bytes but remove from active Gate dependency graph",
            "activeConsumer": "derive identities/counts from sealed reviewer oracle; do not import author generator constants",
            "hashPins": "repin only after A/B candidate-ready hashes and independent zero-finding review",
        },
        "scanRoots": [relative(path) for path in SCAN_ROOTS],
        "summary": {
            "nodes": len(nodes),
            "edges": len(edges),
            "activeConsumers": len(active_consumers),
            "historicalOrPredecessorArtifacts": len(historical),
            "activeStaleLiteralFiles": len(active_stale),
            "activeStaleLiteralOccurrences": sum(len(row["findings"]) for row in active_stale),
            "activePredecessorOracleReferenceFiles": len(active_legacy_oracle_refs),
            "externallyReproducedConsumerFailures": len(EXTERNALLY_REPRODUCED_FINDINGS),
            "blockers": blockers,
        },
        "activeConsumers": active_consumers,
        "historicalOrPredecessorArtifactsPreserveBytes": historical,
        "activeStaleLiterals": active_stale,
        "activePredecessorOracleReferences": active_legacy_oracle_refs,
        "externallyReproducedConsumerFailures": list(EXTERNALLY_REPRODUCED_FINDINGS),
        "remediationOrder": [
            "freeze A/B candidate hashes only after both authors declare candidate-ready",
            "run independent static plus hostile validation and require zero findings",
            "seal reviewer-owned successor oracle and reviewed identities/counts",
            "regenerate canonical projections and module contracts from reviewed candidate inputs",
            "update IA, authorization, cross-module, physical-owner, G3 ownership and publication consumers",
            "replace active predecessor independent-oracle/PG/final-endorsement dependencies with successor equivalents",
            "update full-readiness and G0 bootstrap/checkpoint consumers to require successor static, hostile and PostgreSQL 16/18 receipts",
            "rerun dependency DAG and require zero active predecessor assertions/references",
        ],
        "nodes": nodes,
        "edges": edges,
    }


def write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value) + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-report", type=Path)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    report = build_report()
    if args.write_report:
        write(args.write_report, report)
    rendered = json.dumps(
        report, ensure_ascii=False, sort_keys=True,
        separators=(",", ":") if args.compact else None,
        indent=None if args.compact else 2,
    )
    print(rendered)
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
