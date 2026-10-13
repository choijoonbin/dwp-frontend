#!/usr/bin/env python3
"""Independently validate Wave3 MOD-PER-COMPPLAN Phase B or Phase C.

This validator intentionally does not import the materializer and never runs
application tests.  Bundle mode accepts either the pre-commit workspace at
the exact Phase A carrier or a clean pushed direct-child Phase B carrier.
Promotion mode accepts only the clean pushed promotion-only direct child.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[5]
WORKSPACE = DEFAULT_FRONTEND.parent
DEFAULT_BACKEND = WORKSPACE / ".codex-worktrees/hris/wave3-20261013/control-backend-pin"
DEFAULT_AGENT = WORKSPACE / "dwp_agent"
DEFAULT_WORKTREE_ROOT = WORKSPACE / ".codex-worktrees/hris/wave3-20261013/mod-per-compplan"

HRIS_REL = Path("docs/06-delivery/hris")
PHASE_A_REL = HRIS_REL / "wave3-2026-10-13"
SUCCESSOR_REL = HRIS_REL / "wave3-delegation-successors/2026-10-13/mod-per-compplan-r1"
PROMOTION_REL = HRIS_REL / "2026-10-13-wave3-mod-per-compplan-promotion-receipt.v1.json"

PHASE_A_COMMIT = "1f187a7903d2792b696a6f8ca2b207ebb79b33e1"
PHASE_A_TREE = "17da7a80fed75c137ca76ea23081dae05155b19b"
PHASE_A_PARENT = "388ad0fb2e50689cdc2a00186ffc6ca07f237e57"
BACKEND_COMMIT = "3565c3e61b6c37a6b8088cc5250791fce32a0d9f"
BACKEND_TREE = "af973ef11d003edcf266673330300c612ffe247b"
AGENT_COMMIT = "1d46fc4ab49c604efb7464574c49d13ee453e059"
AGENT_TREE = "0b9a8dbfd828478ee825452e5aca8688c83e37ab"
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()

TOKEN_ID = "HRIS-WAVE3-START-MOD-PER-COMPPLAN-R1"
LEASE_ID = "HRIS-WAVE3-LEASE-MOD-PER-COMPPLAN-PERFORMANCE-V17-R2"
PROMOTION_ID = "HRIS-WAVE3-MOD-PER-COMPPLAN-PROMOTION-20261013-R1"
PACKET_ID = "HRIS-WAVE3-PACKET-MOD-PER-COMPPLAN-R2-PHASE-A"
MODULE_ID = "MOD-PER-COMPPLAN"
EXPIRES_AT = "2026-10-20T14:30:00+09:00"
V17_PATH = "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql"

PHASE_A_FILES = {
    "manifest": (
        PHASE_A_REL / "manifest.v1.json",
        "dd370dacbce5240f87ddcf77fa1fd21d478faa1a8fd372acd6ff73c5ceda6a82",
        "ae119946a79349c7d2390b1d7b9a706f9e25440b4815958e5a0cf12a9496ced7",
    ),
    "authority": (
        PHASE_A_REL / "authority-refresh.v1.json",
        "71677e4242c881d092bb329fe6e87c1357a8cef32ab818aa631f94f1b4dc8f30",
        "2f294eef78f203ffd278e01a995ec02cbaa07f45e058a5b5ecfb2e3b297918b2",
    ),
    "controlRequests": (
        PHASE_A_REL / "control-requests.v1.json",
        "0da7d28e69e087bc4815086a7365bc37763bf96d2653b4ecb8e5b38cedff106c",
        "7d5a3712cdb782b2a28810da02fa9227252762287f29210ed1de799b0410cb26",
    ),
    "packet": (
        PHASE_A_REL / "mod-per-compplan/packet.v2.json",
        "f87751ba8760de6b19b950953ec0cc4b97d2dab99f96b0b1e25fefeb1ea7cc51",
        "6c00ef9d5f5c7b8d06c659e237a6dc2dbdd9b5704223f6dd2611986149353283",
    ),
    "touch": (
        PHASE_A_REL / "mod-per-compplan/touch-manifest.v1.json",
        "2b80e40e9460462e19007b6adb96d85bfc05bd56c173898024b78f8e4bb4eda3",
        "da59b212c28661570697d5ccf192f51b79fd0b1be083cc47da3870b97b42c67f",
    ),
    "reservation": (
        PHASE_A_REL / "mod-per-compplan/migration-lease.v1.json",
        "34022eec7fcf1866da0a941bdec9d4e7cea31106a2b8b64fb04fad810605868a",
        "1439168c05c813e17d72e3889b0e1da314ac1029fd5fd12f060b84868bbc5689",
    ),
    "grant": (
        PHASE_A_REL / "mod-per-compplan/prestart-control-grant-receipt.v1.json",
        "60a460dcc8d4b8134e59a77fd574410299d0a0b2e67f84959a9dd7de9da47c23",
        "434334f825716925fb834aec047e65d1de2cddb6c51f4c8f482562feec7d016c",
    ),
    "testReceipt": (
        PHASE_A_REL / "workforce-compensation-targeted-test-execution-receipt.v1.json",
        "adbc2b920ac9f6284492212af559b2966a1ec7c402ed96f7dbcea459eb108569",
        "11fd3f37dcb37f3a39adbf82dafff05c978e2b1acfb84d067cdfb179f55c37d7",
    ),
}

CSV_FIELDS = [
    "module", "slice_id", "token_id", "repo", "absolute_path", "branch",
    "upstream", "head", "tree", "state_sha256", "clean", "ahead",
    "behind", "state",
]
TOOL_FILES = [
    "README.md",
    "materialize_wave3_mod_per_compplan_activation.py",
    "validate_wave3_mod_per_compplan_activation.py",
    "test_wave3_mod_per_compplan_activation.py",
    "contracts/wave3-activation-manifest.schema.v1.json",
    "contracts/wave3-activation-state.schema.v1.json",
    "contracts/wave3-migration-lease-admission.schema.v1.json",
    "contracts/wave3-promotion-receipt.schema.v1.json",
    "contracts/wave3-start-token.schema.v1.json",
]
ARTIFACT_FILES = [
    "migration-lease-admission.v1.json",
    "registers/module-worktrees.active.v1.csv",
    "tokens/mod-per-compplan.start-token.v1.json",
    "state/activation-pending-promotion.v1.json",
]
BUNDLE_FILES = TOOL_FILES + ARTIFACT_FILES + ["manifest.v1.json"]
BUNDLE_REPOSITORY_PATHS = {
    str(SUCCESSOR_REL / relative) for relative in BUNDLE_FILES
}
JSON_ARTIFACTS = {
    "lease": "migration-lease-admission.v1.json",
    "token": "tokens/mod-per-compplan.start-token.v1.json",
    "state": "state/activation-pending-promotion.v1.json",
    "manifest": "manifest.v1.json",
}
PROMOTION_SELF_REFERENCE_RULE = (
    "The promotion receipt is carried by a later direct-child commit and "
    "pins the immutable Wave3 MOD-PER-COMPPLAN Phase B bundle commit."
)

EXPECTED_WORKTREES = {
    "frontend": {
        "path": "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave3-20261013/mod-per-compplan/frontend",
        "branch": "codex/hris-wave3-per-compplan-frontend-20261013-r1",
        "head": PHASE_A_COMMIT,
        "tree": PHASE_A_TREE,
    },
    "backend": {
        "path": "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave3-20261013/mod-per-compplan/backend",
        "branch": "codex/hris-wave3-per-compplan-backend-20261013-r1",
        "head": BACKEND_COMMIT,
        "tree": BACKEND_TREE,
    },
}
DOMAIN_TABLES = [
    "prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_proposals",
    "prf_cmp_proposal_revisions", "prf_cmp_approved_snapshots",
    "prf_cmp_approved_snapshot_lines",
]


class Audit:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            raise RuntimeError(message)

    def equal(self, actual: Any, expected: Any, message: str) -> None:
        self.require(actual == expected, f"{message}: expected={expected!r} actual={actual!r}")


def run(*argv: str, cwd: Path) -> str:
    result = subprocess.run(argv, cwd=cwd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.stdout.strip()


def git(root: Path, *args: str) -> str:
    return run("git", *args, cwd=root)


def git_bytes(root: Path, *args: str) -> bytes:
    result = subprocess.run(
        ("git", *args),
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout


def configured_upstream(root: Path) -> str:
    return git(root, "rev-parse", "--abbrev-ref", "@{upstream}")


def verify_configured_upstream_value(
    actual: str,
    expected: str,
    label: str,
    audit: Audit,
) -> None:
    audit.equal(actual, expected, f"{label} configured upstream")


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"JSON object required: {path}")
    return value


def verify_seal(value: dict[str, Any], label: str, audit: Audit) -> None:
    copy = deepcopy(value)
    actual = copy.pop("sealedPayloadSha256", None)
    audit.equal(actual, sha256_bytes(canonical_bytes(copy)), f"{label} seal")


def resolve_local_ref(schema: dict[str, Any], root: dict[str, Any]) -> dict[str, Any]:
    reference = schema.get("$ref")
    if reference is None:
        return schema
    if not isinstance(reference, str) or not reference.startswith("#/$defs/"):
        raise RuntimeError(f"unsupported schema reference: {reference!r}")
    name = reference.removeprefix("#/$defs/")
    resolved = root.get("$defs", {}).get(name)
    if not isinstance(resolved, dict):
        raise RuntimeError(f"unresolved schema reference: {reference}")
    return resolved


def verify_schema_is_recursively_closed(
    schema: dict[str, Any],
    label: str,
    audit: Audit,
) -> None:
    root = schema
    seen: set[int] = set()

    def visit(node: Any, path: str) -> None:
        if not isinstance(node, dict):
            return
        resolved = resolve_local_ref(node, root)
        marker = id(resolved)
        if marker in seen:
            return
        seen.add(marker)
        node_type = resolved.get("type")
        if node_type == "object":
            audit.equal(
                resolved.get("additionalProperties"),
                False,
                f"{path} closes additional properties",
            )
            properties = resolved.get("properties")
            required = resolved.get("required")
            audit.require(isinstance(properties, dict), f"{path} properties object")
            audit.require(isinstance(required, list), f"{path} required array")
            if isinstance(properties, dict) and isinstance(required, list):
                audit.equal(
                    set(required), set(properties), f"{path} exact required/property set"
                )
                audit.equal(
                    len(required), len(set(required)), f"{path} unique required names"
                )
                for key, child in properties.items():
                    visit(child, f"{path}.{key}")
        elif node_type == "array":
            prefix_items = resolved.get("prefixItems", [])
            audit.require(isinstance(prefix_items, list), f"{path} prefixItems array")
            if isinstance(prefix_items, list):
                for index, child in enumerate(prefix_items):
                    audit.require(isinstance(child, dict), f"{path} prefixItems[{index}] schema")
                    visit(child, f"{path}[{index}]")
            item_rule = resolved.get("items")
            audit.require(
                isinstance(item_rule, dict) or item_rule is False,
                f"{path} array item schema",
            )
            if isinstance(item_rule, dict):
                visit(item_rule, f"{path}[]")

    visit(schema, f"{label} schema")
    for name, definition in schema.get("$defs", {}).items():
        visit(definition, f"{label} schema.$defs.{name}")


def verify_schema_instance(
    value: Any,
    schema: dict[str, Any],
    label: str,
    audit: Audit,
) -> None:
    root = schema

    def visit(instance: Any, node: dict[str, Any], path: str) -> None:
        rule = resolve_local_ref(node, root)
        if "const" in rule:
            audit.equal(instance, rule["const"], f"{path} const")
        if "enum" in rule:
            audit.require(instance in rule["enum"], f"{path} enum")
        node_type = rule.get("type")
        if node_type == "object":
            audit.require(isinstance(instance, dict), f"{path} object")
            if not isinstance(instance, dict):
                return
            properties = rule.get("properties", {})
            required = set(rule.get("required", []))
            audit.equal(set(instance), required, f"{path} exact fields")
            for key, child in properties.items():
                if key in instance:
                    visit(instance[key], child, f"{path}.{key}")
        elif node_type == "array":
            audit.require(isinstance(instance, list), f"{path} array")
            if not isinstance(instance, list):
                return
            if "minItems" in rule:
                audit.require(len(instance) >= rule["minItems"], f"{path} minItems")
            if "maxItems" in rule:
                audit.require(len(instance) <= rule["maxItems"], f"{path} maxItems")
            if rule.get("uniqueItems"):
                rendered = [canonical_bytes(item) for item in instance]
                audit.equal(len(rendered), len(set(rendered)), f"{path} uniqueItems")
            prefix_items = rule.get("prefixItems", [])
            audit.require(isinstance(prefix_items, list), f"{path} prefixItems array")
            item_rule = rule.get("items")
            audit.require(
                isinstance(item_rule, dict) or item_rule is False,
                f"{path} item schema",
            )
            for index, child in enumerate(instance):
                if isinstance(prefix_items, list) and index < len(prefix_items):
                    visit(child, prefix_items[index], f"{path}[{index}]")
                elif isinstance(item_rule, dict):
                    visit(child, item_rule, f"{path}[{index}]")
                else:
                    audit.require(False, f"{path}[{index}] additional item forbidden")
        elif node_type == "string":
            audit.require(isinstance(instance, str), f"{path} string")
            if isinstance(instance, str) and "pattern" in rule:
                audit.require(re.fullmatch(rule["pattern"], instance) is not None, f"{path} pattern")
        elif node_type == "integer":
            audit.require(
                isinstance(instance, int) and not isinstance(instance, bool),
                f"{path} integer",
            )
        elif node_type == "boolean":
            audit.require(isinstance(instance, bool), f"{path} boolean")

    verify_schema_is_recursively_closed(schema, label, audit)
    visit(value, schema, label)


def verify_top_level_schema(value: dict[str, Any], schema: dict[str, Any], label: str, audit: Audit) -> None:
    """Compatibility name; validation is deliberately recursive."""

    verify_schema_instance(value, schema, label, audit)


def verify_inventory(frontend: Path, phase: str, audit: Audit) -> None:
    root = frontend / SUCCESSOR_REL
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    }
    expected = set(BUNDLE_FILES)
    audit.equal(actual, expected, "Phase B exact file inventory")
    promotion_exists = (frontend / PROMOTION_REL).is_file()
    audit.equal(
        promotion_exists,
        phase == "promotion",
        f"{phase} promotion receipt boundary",
    )


def verify_phase_b_diff(frontend: Path, bundle_commit: str, audit: Audit) -> None:
    audit.equal(
        git(frontend, "rev-parse", f"{bundle_commit}^"),
        PHASE_A_COMMIT,
        "Phase B carrier direct parent",
    )
    changes = git(
        frontend, "diff", "--name-status", PHASE_A_COMMIT, bundle_commit
    ).splitlines()
    observed = set()
    for line in changes:
        cols = line.split("\t")
        audit.require(
            len(cols) == 2 and cols[0] == "A",
            f"Phase B carrier non-additive change: {line}",
        )
        if len(cols) == 2:
            observed.add(cols[1])
    audit.equal(observed, BUNDLE_REPOSITORY_PATHS, "Phase B carrier exact diff")
    audit.equal(
        git(
            frontend,
            "ls-tree",
            "-r",
            "--name-only",
            bundle_commit,
            "--",
            PROMOTION_REL.as_posix(),
        ),
        "",
        "promotion receipt absent from Phase B",
    )


def verify_committed_bundle_blobs(
    frontend: Path,
    bundle_commit: str,
    audit: Audit,
) -> None:
    for relative in BUNDLE_FILES:
        repository_path = str(SUCCESSOR_REL / relative)
        audit.equal(
            git_bytes(frontend, "show", f"{bundle_commit}:{repository_path}"),
            (frontend / repository_path).read_bytes(),
            f"immutable Phase B blob {repository_path}",
        )


def verify_frontend_carrier(frontend: Path, phase: str, audit: Audit) -> tuple[str | None, str | None]:
    audit.equal(git(frontend, "branch", "--show-current"), "dwp-dev", "frontend branch")
    verify_configured_upstream_value(
        configured_upstream(frontend), "origin/dwp-dev", "frontend", audit
    )
    head = git(frontend, "rev-parse", "HEAD")
    remote = git(frontend, "rev-parse", "origin/dwp-dev")
    status = git(frontend, "status", "--porcelain=v1", "--untracked-files=all")
    if phase == "bundle" and head == PHASE_A_COMMIT:
        audit.equal(remote, PHASE_A_COMMIT, "frontend remote Phase A pin")
        for line in status.splitlines():
            path = line[3:]
            if " -> " in path:
                path = path.split(" -> ", 1)[1]
            audit.require(path.startswith(SUCCESSOR_REL.as_posix() + "/"), f"pre-commit change outside Phase B: {line}")
        bundle_commit = None
        bundle_tree = None
    elif phase == "bundle":
        audit.equal(remote, head, "pushed Phase B carrier")
        audit.require(not status, "committed Phase B carrier is dirty")
        audit.equal(
            git(frontend, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split(),
            ["0", "0"],
            "pushed Phase B carrier 0/0",
        )
        verify_phase_b_diff(frontend, head, audit)
        verify_committed_bundle_blobs(frontend, head, audit)
        bundle_commit = head
        bundle_tree = git(frontend, "rev-parse", "HEAD^{tree}")
    else:
        audit.equal(remote, head, "pushed Phase C carrier")
        audit.require(not status, "committed Phase C carrier is dirty")
        audit.equal(
            git(frontend, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split(),
            ["0", "0"],
            "pushed Phase C carrier 0/0",
        )
        bundle_commit = git(frontend, "rev-parse", "HEAD^")
        bundle_tree = git(frontend, "rev-parse", f"{bundle_commit}^{{tree}}")
        verify_phase_b_diff(frontend, bundle_commit, audit)
        audit.equal(
            git(frontend, "diff", "--name-status", bundle_commit, head),
            f"A\t{PROMOTION_REL.as_posix()}",
            "Phase C exact one-file diff",
        )
        verify_committed_bundle_blobs(frontend, bundle_commit, audit)
        audit.equal(
            git_bytes(frontend, "show", f"{head}:{PROMOTION_REL.as_posix()}"),
            (frontend / PROMOTION_REL).read_bytes(),
            "committed Phase C receipt bytes",
        )
    audit.equal(git(frontend, "rev-parse", f"{PHASE_A_COMMIT}^{{tree}}"), PHASE_A_TREE, "Phase A tree")
    audit.equal(git(frontend, "rev-parse", f"{PHASE_A_COMMIT}^"), PHASE_A_PARENT, "Phase A parent")
    return bundle_commit, bundle_tree


def verify_phase_a(frontend: Path, backend: Path, audit: Audit) -> dict[str, dict[str, Any]]:
    docs: dict[str, dict[str, Any]] = {}
    for label, (relative, file_sha, seal) in PHASE_A_FILES.items():
        payload = (frontend / relative).read_bytes()
        audit.equal(sha256_bytes(payload), file_sha, f"Phase A {label} file hash")
        value = read_json(frontend / relative)
        verify_seal(value, f"Phase A {label}", audit)
        audit.equal(value["sealedPayloadSha256"], seal, f"Phase A {label} exact seal")
        docs[label] = value
    phase_a_manifest = docs["manifest"]
    expected_paths = {row["path"] for row in phase_a_manifest["artifacts"] + phase_a_manifest["toolPins"]} | {str(PHASE_A_FILES["manifest"][0])}
    changes = git(frontend, "diff", "--name-status", PHASE_A_PARENT, PHASE_A_COMMIT).splitlines()
    observed = set()
    for line in changes:
        cols = line.split("\t")
        audit.require(len(cols) == 2 and cols[0] == "A", f"Phase A non-additive carrier entry: {line}")
        observed.add(cols[1])
    audit.equal(observed, expected_paths, "Phase A carrier exact closed set")

    grant = docs["grant"]
    states = {row["category"]: row["state"] for row in grant["conditions"]}
    audit.equal(states, {
        "TYPED_ARTIFACT_BOOTSTRAP": "ALLOCATED_REGISTERED_GRANTED",
        "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
    }, "two fulfilled prestart conditions")
    typed = next(row for row in grant["conditions"] if row["category"] == "TYPED_ARTIFACT_BOOTSTRAP")
    audit.equal(typed["domainTables"], DOMAIN_TABLES, "typed-artifact domain table allocation")
    audit.equal(typed["sharedFoundationTables"], ["prf_per_artifact_versions"], "typed-artifact shared table allocation")
    workforce = next(row for row in grant["conditions"] if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION")
    audit.equal(workforce["targetedTestExecutionReceiptSeal"], docs["testReceipt"]["sealedPayloadSha256"], "grant targeted receipt seal")
    audit.equal(workforce["targetedTestTotals"], {"tests": 24, "failures": 0, "errors": 0, "skipped": 0}, "grant targeted totals")
    for ref in workforce["evidenceFiles"] + workforce["legacyCompatibilityEvidenceFiles"]:
        payload = (backend / ref["path"]).read_bytes()
        audit.equal(len(payload), ref["bytes"], f"prestart evidence bytes {ref['path']}")
        audit.equal(sha256_bytes(payload), ref["sha256"], f"prestart evidence hash {ref['path']}")
    requests = docs["controlRequests"]["requests"]
    audit.equal(len([row for row in requests if row["phase"] == "PRE_START"]), 2, "prestart obligation count")
    audit.equal(len([row for row in requests if row["phase"] == "AFTER_PUSHED_MODULE_RESULT"]), 5, "post-result obligation count")
    audit.require(all(row["moduleMayImplement"] is False for row in requests), "Central obligation leaked to module")

    touch = docs["touch"]
    audit.equal(len(touch["allowedPaths"]), 8, "allowed path count")
    audit.equal(len(touch["commonControlOnlyPaths"]), 68, "common-Control path count")
    audit.equal(sha256_bytes(canonical_bytes(touch["allowedPaths"])), "491b1ab54a53daa2fd34a356f89eaa74c2438364bb1cc7d14f19c426028a4de3", "allowed path digest")
    audit.equal(sha256_bytes(canonical_bytes(touch["commonControlOnlyPaths"])), "b2cdd49b6627fb4dd75843740431390947e8dd5206dc954220b1c3ae91d14c89", "common-Control path digest")
    audit.equal(touch["moduleMayEditCommonControlPaths"], False, "common-Control edit denial")
    receipt = docs["testReceipt"]
    audit.equal(receipt["totals"], {"tests": 24, "failures": 0, "errors": 0, "skipped": 0}, "sealed targeted test totals")
    for report in receipt["reports"]:
        payload = (backend / report["path"]).read_bytes()
        audit.equal(len(payload), report["bytes"], f"targeted report bytes {report['className']}")
        audit.equal(sha256_bytes(payload), report["sha256"], f"targeted report hash {report['className']}")
        suite = ET.fromstring(payload)
        audit.equal(int(suite.attrib["tests"]), report["tests"], f"targeted report tests {report['className']}")
        audit.equal(sum(int(suite.attrib[key]) for key in ("failures", "errors", "skipped")), 0, f"targeted report clean {report['className']}")
    return docs


def verify_repository(
    root: Path,
    commit: str,
    tree: str,
    label: str,
    audit: Audit,
    *,
    expected_upstream: str | None = None,
) -> None:
    audit.equal(git(root, "rev-parse", "HEAD"), commit, f"{label} commit")
    audit.equal(git(root, "rev-parse", "HEAD^{tree}"), tree, f"{label} tree")
    audit.equal(git(root, "rev-parse", "origin/dwp-dev"), commit, f"{label} origin/dwp-dev")
    if expected_upstream is not None:
        verify_configured_upstream_value(
            configured_upstream(root), expected_upstream, label, audit
        )
    audit.equal(git(root, "status", "--porcelain=v1"), "", f"{label} clean")


def verify_performance_boundary(backend: Path, audit: Audit) -> None:
    root = backend / "dwp-people-server/src/main/resources/db/performance-migration"
    versions = []
    for path in root.glob("V*__*.sql"):
        match = re.match(r"V(\d+)__", path.name)
        if match:
            versions.append(int(match.group(1)))
    audit.equal(sorted(versions), [1, 2, 3, 16], "Performance migration versions")
    audit.require(not (backend / V17_PATH).exists(), "V17 path is occupied")


def read_register(frontend: Path, audit: Audit) -> tuple[list[dict[str, str]], bytes]:
    path = frontend / SUCCESSOR_REL / "registers/module-worktrees.active.v1.csv"
    raw = path.read_bytes()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        audit.equal(reader.fieldnames, CSV_FIELDS, "worktree register header")
    audit.equal(len(rows), 2, "worktree row count")
    audit.equal([row["repo"] for row in rows], ["frontend", "backend"], "worktree row order")
    audit.equal(len({(row["repo"], row["absolute_path"]) for row in rows}), 2, "worktree row uniqueness")
    for row in rows:
        repo = row["repo"]
        spec = EXPECTED_WORKTREES[repo]
        expected = {
            "module": "PER", "slice_id": MODULE_ID, "token_id": TOKEN_ID,
            "repo": repo, "absolute_path": spec["path"], "branch": spec["branch"],
            "upstream": f"origin/{spec['branch']}", "head": spec["head"],
            "tree": spec["tree"], "state_sha256": EMPTY_SHA256, "clean": "true",
            "ahead": "0", "behind": "0", "state": "CREATED_PUSHED_CLEAN",
        }
        audit.equal(row, expected, f"{repo} register row")
        worktree = Path(spec["path"])
        audit.equal(git(worktree, "branch", "--show-current"), spec["branch"], f"{repo} live branch")
        audit.equal(git(worktree, "rev-parse", "HEAD"), spec["head"], f"{repo} live HEAD")
        audit.equal(git(worktree, "rev-parse", "HEAD^{tree}"), spec["tree"], f"{repo} live tree")
        verify_configured_upstream_value(
            configured_upstream(worktree),
            f"origin/{spec['branch']}",
            f"{repo} module worktree",
            audit,
        )
        audit.equal(git(worktree, "rev-parse", "@{upstream}"), spec["head"], f"{repo} upstream contains exact HEAD")
        audit.equal(git(worktree, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split(), ["0", "0"], f"{repo} live 0/0")
        audit.equal(git(worktree, "status", "--porcelain=v1"), "", f"{repo} live clean")
    return rows, raw


def verify_lease(frontend: Path, lease: dict[str, Any], docs: dict[str, dict[str, Any]], rows: list[dict[str, str]], audit: Audit) -> None:
    schema = read_json(frontend / SUCCESSOR_REL / "contracts/wave3-migration-lease-admission.schema.v1.json")
    verify_top_level_schema(lease, schema, "lease", audit)
    verify_seal(lease, "lease", audit)
    audit.equal(lease["ownerTokenId"], TOKEN_ID, "lease owner token")
    audit.equal(lease["worktreeBinding"], rows[1], "lease backend worktree")
    audit.equal(lease["observedVersions"], ["V1", "V2", "V3", "V16"], "lease observed versions")
    audit.equal(lease["currentHighWater"], "V16", "lease high-water")
    audit.equal(lease["outOfOrder"], False, "lease outOfOrder")
    audit.equal(lease["version"], "V17", "lease version")
    audit.equal(lease["exactRelativePath"], V17_PATH, "lease exact path")
    audit.equal(lease["tableAllocation"]["domainTables"], DOMAIN_TABLES, "lease domain tables")
    audit.equal(lease["tableAllocation"]["sharedFoundationTables"], ["prf_per_artifact_versions"], "lease shared table")
    audit.equal(lease["tableAllocation"]["totalTableCount"], 7, "lease total tables")
    audit.equal(lease["migrationAdmissionAuthorized"], True, "lease admitted")
    audit.equal(lease["effectiveAfterPromotionOnly"], True, "lease promotion gate")
    audit.require(datetime.fromisoformat(lease["expiresAt"]) <= datetime.fromisoformat(docs["reservation"]["expiresAt"]), "lease extends Phase A expiry")
    predecessor = lease["predecessorReservation"]
    audit.equal(predecessor["leaseId"], docs["reservation"]["leaseId"], "lease predecessor identity")
    audit.equal(predecessor["sealedPayloadSha256"], docs["reservation"]["sealedPayloadSha256"], "lease predecessor seal")


def verify_token(frontend: Path, token: dict[str, Any], docs: dict[str, dict[str, Any]], rows: list[dict[str, str]], lease: dict[str, Any], audit: Audit) -> None:
    schema = read_json(frontend / SUCCESSOR_REL / "contracts/wave3-start-token.schema.v1.json")
    verify_top_level_schema(token, schema, "token", audit)
    verify_seal(token, "token", audit)
    audit.equal(token["state"], "ISSUED_PENDING_PROMOTION_RECEIPT", "token pre-promotion state")
    audit.equal(token["worktreeBindings"], rows, "token worktree bindings")
    audit.equal(token["effectiveAllowedPaths"], docs["touch"]["allowedPaths"], "token allowed closed set")
    audit.equal(token["protectedPaths"], docs["touch"]["commonControlOnlyPaths"], "token protected closed set")
    audit.equal(token["pathPolicy"]["allowedPathsSha256"], "491b1ab54a53daa2fd34a356f89eaa74c2438364bb1cc7d14f19c426028a4de3", "token allowed path digest")
    audit.equal(token["pathPolicy"]["protectedPathsSha256"], "b2cdd49b6627fb4dd75843740431390947e8dd5206dc954220b1c3ae91d14c89", "token protected path digest")
    audit.equal(token["dependencyPinsSha256"], sha256_bytes(canonical_bytes(token["dependencyBinding"])), "token dependency digest")
    obligations = token["controlObligations"]
    audit.equal(len(obligations["preStart"]), 2, "token prestart obligations")
    audit.equal(len(obligations["afterPushedModuleResult"]), 5, "token post-result obligations")
    audit.require(all(not row["moduleMayImplement"] for row in obligations["preStart"] + obligations["afterPushedModuleResult"]), "token delegates a Central obligation")
    expected_requests = docs["controlRequests"]["requests"]
    audit.equal(obligations["preStart"], [row for row in expected_requests if row["phase"] == "PRE_START"], "token exact prestart obligations")
    audit.equal(obligations["afterPushedModuleResult"], [row for row in expected_requests if row["phase"] == "AFTER_PUSHED_MODULE_RESULT"], "token exact post-result obligations")
    audit.equal(token["preStartControlGrant"]["conditionStates"], {
        "TYPED_ARTIFACT_BOOTSTRAP": "ALLOCATED_REGISTERED_GRANTED",
        "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
    }, "token grant states")
    audit.equal(token["migrationLease"]["leaseId"], LEASE_ID, "token lease ID")
    audit.equal(token["migrationLease"]["sealedPayloadSha256"], lease["sealedPayloadSha256"], "token lease seal")
    expected_authority = {
        "domainAuthoringOnly": True,
        "sourceChangeAuthorized": True,
        "effectiveAfterPromotionOnly": True,
        "currentlyEffective": False,
        "exactWorktreesOnly": True,
        "exactAllowedPathsOnly": True,
        "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
        "migrationEditAuthorized": True,
        "commitAndPushTokenBranchesAuthorized": True,
        "sharedControlPathChangeAuthorized": False,
        "integrationMergeAuthorized": False,
        "payConsumptionAuthorized": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }
    audit.equal(token["authority"], expected_authority, "token authority boundary")
    audit.equal(token["activationReceiptId"], PROMOTION_ID, "future promotion ID")
    audit.require("receiptSha256" not in token and "promotionReceiptSha256" not in token, "token pins nonexistent promotion hash")


def verify_state(frontend: Path, state: dict[str, Any], rows: list[dict[str, str]], register_raw: bytes, token: dict[str, Any], token_raw: bytes, lease: dict[str, Any], lease_raw: bytes, audit: Audit) -> None:
    schema = read_json(frontend / SUCCESSOR_REL / "contracts/wave3-activation-state.schema.v1.json")
    verify_top_level_schema(state, schema, "state", audit)
    verify_seal(state, "state", audit)
    audit.equal(state["currentActiveTokenClosedSet"], [], "current token set before promotion")
    audit.equal(state["activeTokenClosedSetAfterPromotion"], [TOKEN_ID], "future token closed set")
    audit.equal(state["worktreeRegister"]["bindings"], rows, "state worktree bindings")
    audit.equal(state["worktreeRegister"]["sha256"], sha256_bytes(register_raw), "state register hash")
    delegation = state["effectiveDelegationAfterPromotion"]
    audit.equal(delegation["tokenSha256"], sha256_bytes(token_raw), "state token hash")
    audit.equal(delegation["tokenSealedPayloadSha256"], token["sealedPayloadSha256"], "state token seal")
    audit.equal(delegation["migrationLeaseSha256"], sha256_bytes(lease_raw), "state lease hash")
    audit.equal(state["effectiveDelegationAfterPromotion"]["migrationLeaseSeal"], lease["sealedPayloadSha256"], "state lease seal")
    authority = state["authority"]
    audit.equal(authority["promotionReceiptIssued"], False, "state promotion absent")
    audit.equal(authority["currentModuleAuthoringAuthorized"], False, "state current authoring denial")
    audit.equal(authority["moduleAuthoringAuthorizedAfterPromotion"], True, "state future authoring")
    for key in ("sharedControlPathChangeAuthorizedForModule", "integrationMergeAuthorized", "payConsumptionAuthorized", "customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"):
        audit.equal(authority[key], False, f"state denied authority {key}")


def verify_manifest(frontend: Path, manifest: dict[str, Any], docs: dict[str, dict[str, Any]], audit: Audit) -> None:
    root = frontend / SUCCESSOR_REL
    schema = read_json(root / "contracts/wave3-activation-manifest.schema.v1.json")
    verify_top_level_schema(manifest, schema, "manifest", audit)
    verify_seal(manifest, "manifest", audit)
    audit.equal(manifest["predecessorPins"]["phaseACarrier"], {
        "commit": PHASE_A_COMMIT, "tree": PHASE_A_TREE, "parent": PHASE_A_PARENT,
        "branch": "dwp-dev", "upstream": "origin/dwp-dev",
    }, "manifest Phase A carrier")
    expected_predecessors = {
        "phaseACarrier", "phaseAManifest", "packet", "preStartControlGrant",
        "touchPolicy", "migrationReservation", "targetedTestExecutionReceipt",
        "authorityRefresh", "controlRequests",
    }
    audit.equal(set(manifest["predecessorPins"]), expected_predecessors, "manifest predecessor closed set")
    for row in manifest["artifacts"]:
        payload = (frontend / row["path"]).read_bytes()
        audit.equal(len(payload), row["bytes"], f"manifest artifact bytes {row['path']}")
        audit.equal(sha256_bytes(payload), row["sha256"], f"manifest artifact hash {row['path']}")
    audit.equal({row["path"] for row in manifest["artifacts"]}, {str(SUCCESSOR_REL / path) for path in ARTIFACT_FILES}, "manifest artifact paths")
    for row in manifest["toolPins"]:
        payload = (frontend / row["path"]).read_bytes()
        audit.equal(len(payload), row["bytes"], f"manifest tool bytes {row['path']}")
        audit.equal(sha256_bytes(payload), row["sha256"], f"manifest tool hash {row['path']}")
    audit.equal({row["path"] for row in manifest["toolPins"]}, {str(SUCCESSOR_REL / path) for path in TOOL_FILES}, "manifest tool paths")
    audit.equal(manifest["activeTokenClosedSetAfterPromotion"], [TOKEN_ID], "manifest future token set")
    audit.equal(manifest["promotionReceiptCount"], 0, "manifest promotion count")
    audit.equal(manifest["productionAuthorization"], False, "manifest production denial")


def verify_promotion_receipt(
    frontend: Path,
    receipt: dict[str, Any],
    bundle_commit: str,
    bundle_tree: str,
    artifacts: dict[str, dict[str, Any]],
    rows: list[dict[str, str]],
    register_raw: bytes,
    token_raw: bytes,
    lease_raw: bytes,
    audit: Audit,
) -> None:
    root = frontend / SUCCESSOR_REL
    schema = read_json(root / "contracts/wave3-promotion-receipt.schema.v1.json")
    verify_schema_instance(receipt, schema, "promotion receipt", audit)
    verify_seal(receipt, "promotion receipt", audit)
    audit.equal(receipt["issuedAt"], artifacts["token"]["issuedAt"], "promotion issuedAt")
    audit.equal(receipt["activeTokenClosedSet"], [TOKEN_ID], "promotion active-token singleton")

    manifest_raw = (root / "manifest.v1.json").read_bytes()
    state_raw = (root / JSON_ARTIFACTS["state"]).read_bytes()
    predecessor = receipt["predecessor"]
    audit.equal(
        predecessor["phaseACarrier"],
        artifacts["token"]["predecessorAuthority"]["phaseACarrier"],
        "promotion Phase A carrier",
    )
    audit.equal(
        predecessor["phaseAManifest"],
        artifacts["token"]["predecessorAuthority"]["phaseAManifest"],
        "promotion Phase A manifest",
    )
    audit.equal(
        predecessor["activationState"],
        {
            "path": str(SUCCESSOR_REL / JSON_ARTIFACTS["state"]),
            "bytes": len(state_raw),
            "sha256": sha256_bytes(state_raw),
            "sealedPayloadSha256": artifacts["state"]["sealedPayloadSha256"],
        },
        "promotion activation-state pin",
    )

    bundle = receipt["bundleCommit"]
    audit.equal(bundle["commit"], bundle_commit, "promotion exact Phase B commit")
    audit.equal(bundle["tree"], bundle_tree, "promotion exact Phase B tree")
    audit.equal(
        git(frontend, "rev-parse", f"{bundle_commit}^{{tree}}"),
        bundle_tree,
        "promotion resolved Phase B tree",
    )
    audit.equal(
        bundle["manifestPath"],
        str(SUCCESSOR_REL / "manifest.v1.json"),
        "promotion manifest path",
    )
    audit.equal(bundle["manifestSha256"], sha256_bytes(manifest_raw), "promotion manifest hash")
    audit.equal(bundle["selfReferenceRule"], PROMOTION_SELF_REFERENCE_RULE, "promotion self-reference rule")
    audit.equal(
        git_bytes(
            frontend,
            "show",
            f"{bundle_commit}:{SUCCESSOR_REL / 'manifest.v1.json'}",
        ),
        manifest_raw,
        "promotion committed manifest bytes",
    )

    token = artifacts["token"]
    lease = artifacts["lease"]
    delegation = receipt["delegation"]
    expected_delegation = {
        "module": "PER",
        "moduleId": MODULE_ID,
        "sliceId": MODULE_ID,
        "sessionId": "HRIS-PER",
        "packetId": PACKET_ID,
        "packetPath": token["packetPath"],
        "packetSha256": token["packetFileSha256"],
        "packetSealedPayloadSha256": token["dependencyBinding"]["packetSealedPayloadSha256"],
        "tokenId": TOKEN_ID,
        "tokenPath": str(SUCCESSOR_REL / JSON_ARTIFACTS["token"]),
        "tokenSha256": sha256_bytes(token_raw),
        "tokenSealedPayloadSha256": token["sealedPayloadSha256"],
        "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
        "migrationLeaseId": LEASE_ID,
        "migrationLeasePath": str(SUCCESSOR_REL / JSON_ARTIFACTS["lease"]),
        "migrationLeaseSha256": sha256_bytes(lease_raw),
        "migrationLeaseSealedPayloadSha256": lease["sealedPayloadSha256"],
        "migrationExactRelativePath": V17_PATH,
        "worktrees": rows,
        "effectivePacketState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
        "authority": "DOMAIN_AUTHORING_ONLY",
        "controlObligations": token["controlObligations"],
    }
    audit.equal(delegation, expected_delegation, "promotion exact delegation")
    audit.equal(delegation["worktrees"], rows, "promotion exact ordered worktrees")
    audit.equal(len(delegation["controlObligations"]["preStart"]), 2, "promotion prestart obligations")
    audit.equal(len(delegation["controlObligations"]["afterPushedModuleResult"]), 5, "promotion post-result obligations")
    audit.equal(
        sha256_bytes(register_raw),
        artifacts["state"]["worktreeRegister"]["sha256"],
        "promotion worktree register binding",
    )
    audit.equal(
        receipt["authority"],
        {
            "moduleParallelDevelopmentAuthorized": True,
            "authorizedModules": ["PER"],
            "authorizedSlices": [MODULE_ID],
            "startTokensIssued": [TOKEN_ID],
            "migrationAdmissionAuthorized": [LEASE_ID],
            "sharedControlPathChangeAuthorizedForModule": False,
            "integrationMergeAuthorized": False,
            "payConsumptionAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
        "promotion authority closed set",
    )


def reject_future_carrier_references(value: Any, path: str, audit: Audit) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            audit.require(key not in {"bundleCommit", "bundleTree", "promotionReceiptSha256"}, f"Phase B contains future carrier field at {path}.{key}")
            reject_future_carrier_references(child, f"{path}.{key}", audit)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_future_carrier_references(child, f"{path}[{index}]", audit)


def validate(
    frontend: Path,
    backend: Path,
    agent: Path,
    worktree_root: Path,
    phase: str,
) -> int:
    audit = Audit()
    verify_inventory(frontend, phase, audit)
    root = frontend / SUCCESSOR_REL
    artifacts = {label: read_json(root / relative) for label, relative in JSON_ARTIFACTS.items()}
    bundle_commit, bundle_tree = verify_frontend_carrier(frontend, phase, audit)
    verify_repository(backend, BACKEND_COMMIT, BACKEND_TREE, "backend control pin", audit)
    verify_repository(
        agent,
        AGENT_COMMIT,
        AGENT_TREE,
        "agent pin",
        audit,
        expected_upstream="origin/dwp-dev",
    )
    verify_performance_boundary(backend, audit)
    docs = verify_phase_a(frontend, backend, audit)
    rows, register_raw = read_register(frontend, audit)
    verify_performance_boundary(worktree_root / "backend", audit)
    lease_raw = (root / JSON_ARTIFACTS["lease"]).read_bytes()
    token_raw = (root / JSON_ARTIFACTS["token"]).read_bytes()
    verify_lease(frontend, artifacts["lease"], docs, rows, audit)
    verify_token(frontend, artifacts["token"], docs, rows, artifacts["lease"], audit)
    verify_state(frontend, artifacts["state"], rows, register_raw, artifacts["token"], token_raw, artifacts["lease"], lease_raw, audit)
    verify_manifest(frontend, artifacts["manifest"], docs, audit)
    for label, value in artifacts.items():
        reject_future_carrier_references(value, label, audit)
    if phase == "promotion":
        audit.require(bundle_commit is not None, "promotion bundle commit missing")
        audit.require(bundle_tree is not None, "promotion bundle tree missing")
        receipt = read_json(frontend / PROMOTION_REL)
        verify_promotion_receipt(
            frontend,
            receipt,
            str(bundle_commit),
            str(bundle_tree),
            artifacts,
            rows,
            register_raw,
            token_raw,
            lease_raw,
            audit,
        )
    return audit.checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Independently validate Wave3 MOD-PER-COMPPLAN Phase B/C")
    parser.add_argument("--phase", choices=("bundle", "promotion"), default="bundle")
    parser.add_argument("--frontend-root", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend-root", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--agent-root", type=Path, default=DEFAULT_AGENT)
    parser.add_argument("--worktree-root", type=Path, default=DEFAULT_WORKTREE_ROOT)
    args = parser.parse_args()
    checks = validate(
        args.frontend_root.resolve(),
        args.backend_root.resolve(),
        args.agent_root.resolve(),
        args.worktree_root.resolve(),
        args.phase,
    )
    if args.phase == "bundle":
        print(f"WAVE3_MOD_PER_COMPPLAN_PHASE_B_INDEPENDENT_VALIDATION_PASS checks={checks} artifacts=5 token=1 worktrees=2 promotion=0")
    else:
        print(f"WAVE3_MOD_PER_COMPPLAN_PHASE_C_INDEPENDENT_VALIDATION_PASS checks={checks} artifacts=1 activeTokens=1")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError, KeyError, json.JSONDecodeError, ET.ParseError) as exc:
        print(f"WAVE3_MOD_PER_COMPPLAN_ACTIVATION_VALIDATION_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
