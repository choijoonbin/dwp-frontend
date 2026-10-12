#!/usr/bin/env python3
"""Independently validate the HRIS G7 evidence-promotion bundle.

This validator deliberately does not import the materializer.  It checks the
historical inputs, raw G6 run, successor overlay, packet/token/lease bindings,
Git objects and the four live PER/TIM worktrees as one batched validation.
No application command or W1 runner is executed.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[4]
HRIS_REL = Path("docs/06-delivery/hris")
EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

EXPECTED = {
    "preflight": "5a95ded883cc520be5cf3705b26348972801f19f4565d65a2896e5515bf02e29",
    "g5": "4a5a3505414dbec26ea4ef35eb4b4371c9c765272a39285298f3374090ec58ae",
    "stale": "603f81f13f5168825468c18d9f5a04e4ca389288a121fe1ad33c21b2ff6812de",
    "staleEvidence": "d17ed348749715c660fae624e05e1df7dbee6adf6c4679c73b7c9883eab25047",
    "orderedIds": "10256b4f5b2098f3616cbb4316a5551ddf103b4e2babf81559641ef735cd1bd2",
    "sortedIds": "b85059fa5048866ebf7c134d74d8e07a9cc7af68485093260d0c18010b1d6216",
    "g6Result": "0a4675a69a658b0fc7695877a267ff36f18b0a5820c865a9b55c2195d79969b1",
    "g6Checkpoint": "fe1b549f3f31a9e14ec75e9c3c23b0f194b0a911e9b5bef5a21dbee80018f877",
    "g6Runtime": "ff83fd941e7433ef9245d8b8f6de35e4722a710a7b32cdc3443152766a6ad145",
    "authorization": "852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b",
    "gateway": "325fd7acfcf0ed42cd03db0105003c6a53d8434467e594e023d227c64b734856",
}

BASE_PINS = {
    "frontend": ("4546024ca9036f217c1d13ddb0622c21a3264b60", "8f2a3068f9efbca5daf77a5fdf7f0d7d1670976c"),
    "backend": ("c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329", "099c88ee32c584764802f3efd77c23364c65b8c4"),
    "agent": ("1d46fc4ab49c604efb7464574c49d13ee453e059", "0b9a8dbfd828478ee825452e5aca8688c83e37ab"),
}

PACKETS = {
    "SYS": "packets/sys-007.v1.json",
    "HRM": "packets/hrm-010.v1.json",
    "PER": "packets/per-006.v1.json",
    "TIM": "packets/tim-006.v1.json",
}
TOKENS = {
    "PER": "tokens/per-006.start-token.v1.json",
    "TIM": "tokens/tim-006.start-token.v1.json",
}
MIGRATIONS = {
    "SYS": ("dwp-platform-server/src/main/resources/db/migration", 324, 325, "V325__create_hris_reference_configuration_lifecycle.sql", "RESERVED_CONTROL_ONLY"),
    "HRM": ("dwp-people-server/src/main/resources/db/migration", 53, 54, "V54__create_employee_change_request_lifecycle.sql", "RESERVED_CONTROL_ONLY"),
    "PER": ("dwp-people-server/src/main/resources/db/performance-migration", 1, 2, "V2__per_create_population_freeze.sql", "ADMITTED_DOMAIN_AUTHORING"),
    "TIM": ("dwp-time-server/src/main/resources/db/migration", 7, 8, "V8__tim_create_clock_ingestion.sql", "ADMITTED_DOMAIN_AUTHORING"),
}

EXPECTED_CLASSIFICATIONS = {
    "INTEGRATED_FROZEN_G5_G6": 5,
    "AUTHORIZED_DOMAIN_AUTHORING": 2,
    "PACKET_PREPARED_START_WITHHELD": 2,
    "WITHHELD_PRODUCER_NOT_IMPLEMENTED": 1,
    "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED": 1,
    "RETIRED_UNCHANGED": 2,
    "QUEUED_NOT_SELECTED": 89,
}


class Audit:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)

    def equal(self, actual: Any, expected: Any, message: str) -> None:
        self.require(actual == expected, f"{message}: expected={expected!r}, actual={actual!r}")

    def finish(self) -> None:
        if self.errors:
            for message in self.errors:
                print(f"FAIL: {message}", file=sys.stderr)
            raise SystemExit(f"G7 validation failed: {len(self.errors)} error(s), {self.checks} checks")
        print(f"PASS: G7 delegation validation ({self.checks} checks)")


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_sha(path: Path) -> str:
    return sha(path.read_bytes())


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def read_json(path: Path, audit: Audit) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - aggregate every artifact error
        audit.require(False, f"cannot parse JSON {path}: {exc}")
        return {}
    audit.require(isinstance(value, dict), f"JSON root is not an object: {path}")
    return value if isinstance(value, dict) else {}


def read_csv(path: Path, audit: Audit) -> tuple[list[str], list[dict[str, str]]]:
    try:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            return list(reader.fieldnames or []), list(reader)
    except Exception as exc:  # noqa: BLE001
        audit.require(False, f"cannot parse CSV {path}: {exc}")
        return [], []


def verify_seal(value: dict[str, Any], label: str, audit: Audit) -> None:
    body = copy.deepcopy(value)
    actual = body.pop("sealedPayloadSha256", None)
    audit.equal(actual, sha(canonical(body)), f"{label} sealed payload")


def run_git(root: Path, *args: str) -> tuple[int, str]:
    completed = subprocess.run(
        ["git", "-C", str(root), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return completed.returncode, completed.stdout.strip()


def run_git_bytes(root: Path, *args: str) -> tuple[int, bytes]:
    completed = subprocess.run(
        ["git", "-C", str(root), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return completed.returncode, completed.stdout


def verify_git_object(root: Path, commit: str, tree: str, label: str, audit: Audit) -> None:
    code, actual = run_git(root, "rev-parse", f"{commit}^{{tree}}")
    audit.equal(code, 0, f"{label} commit object exists")
    audit.equal(actual, tree, f"{label} tree")


def verify_input_authorities(frontend: Path, preflight: dict[str, Any], audit: Audit) -> None:
    authorities = preflight.get("inputAuthorities", [])
    audit.equal(len(authorities), 20, "preflight input authority count")
    seen = set()
    for item in authorities:
        path = frontend / item.get("path", "")
        identifier = item.get("id")
        audit.require(identifier not in seen, f"duplicate input authority id: {identifier}")
        seen.add(identifier)
        audit.require(path.is_file(), f"input authority missing: {identifier}")
        if path.is_file():
            audit.equal(file_sha(path), item.get("sha256"), f"input authority hash {identifier}")


def verify_g6(frontend: Path, g6_root: Path, audit: Audit) -> dict[str, Any]:
    hris = frontend / HRIS_REL
    receipt = read_json(hris / "2026-10-12-g6-w1-successor-receipt.json", audit)
    verify_seal(receipt, "G6 receipt", audit)
    audit.equal(receipt.get("status"), "PASS", "G6 receipt status")
    execution = receipt.get("execution", {})
    audit.equal(execution.get("executionCount"), 1, "G6 execution count")
    audit.equal((execution.get("phasesPassed"), execution.get("phasesTotal")), (28, 28), "G6 phase count")
    checkpoint = receipt.get("checkpoint", {})
    audit.equal((checkpoint.get("assertionsPassed"), checkpoint.get("assertionsTotal")), (15, 15), "G6 checkpoint count")
    audit.equal(checkpoint.get("frontendCommit"), BASE_PINS["frontend"][0], "G6 frontend commit")
    audit.equal(checkpoint.get("activeAuthorization", {}).get("checksum"), EXPECTED["authorization"], "G6 active authorization")
    audit.equal(receipt.get("rollbackAndCleanup", {}).get("activeBundleAtFinish", {}).get("version"), 33, "G6 rollback version")
    audit.require(receipt.get("rollbackAndCleanup", {}).get("teardownVerifiedClean") is True, "G6 teardown not clean")
    security = receipt.get("security", {})
    audit.require(security.get("syntheticOnly") is True, "G6 not synthetic-only")
    audit.require(security.get("customerDataUsed") is False, "G6 customer data used")
    audit.require(security.get("productionActivationPerformed") is False, "G6 production activation occurred")
    audit.equal(security.get("evidenceSecretScanFindings"), 0, "G6 evidence secret findings")
    audit.equal(security.get("finalResultSecretScanFindings"), 0, "G6 result secret findings")
    raw_paths = {
        "result.json": EXPECTED["g6Result"],
        "checkpoint/manifest.json": EXPECTED["g6Checkpoint"],
        "runtime.json": EXPECTED["g6Runtime"],
    }
    for relative, expected_hash in raw_paths.items():
        path = g6_root / relative
        audit.require(path.is_file(), f"G6 raw evidence missing: {relative}")
        if path.is_file():
            audit.equal(file_sha(path), expected_hash, f"G6 raw hash {relative}")
    if (g6_root / "result.json").is_file():
        raw_result = read_json(g6_root / "result.json", audit)
        audit.equal(raw_result.get("scope"), "FULL_BACKEND_WITH_EXTERNAL_CHECKPOINT", "G6 scope")
        audit.equal(Counter(item.get("status") for item in raw_result.get("phases", [])), Counter({"PASS": 28}), "G6 raw phase statuses")
        audit.require(raw_result.get("rollbackComplete") is True, "G6 raw rollback incomplete")
    if (g6_root / "checkpoint/manifest.json").is_file():
        raw_checkpoint = read_json(g6_root / "checkpoint/manifest.json", audit)
        audit.equal(Counter(item.get("status") for item in raw_checkpoint.get("assertions", [])), Counter({"PASS": 15}), "G6 raw assertion statuses")
        audit.equal(raw_checkpoint.get("provenance", {}).get("frontend", {}).get("gitHead"), BASE_PINS["frontend"][0], "G6 raw frontend pin")
    return receipt


def verify_overlay(frontend: Path, audit: Audit) -> dict[str, Any]:
    hris = frontend / HRIS_REL
    stale = hris / "current-slice-integration-status.v1.csv"
    successor = hris / "g7-delegation/2026-10-12/successor-slice-overlay.v1.csv"
    old_fields, old_rows = read_csv(stale, audit)
    new_fields, new_rows = read_csv(successor, audit)
    audit.equal(len(old_rows), 102, "stale overlay row count")
    audit.equal(len(new_rows), 102, "successor overlay row count")
    audit.equal(new_fields[: len(old_fields)], old_fields, "successor base columns")
    expected_extra = [
        "g7_classification", "g7_authority", "g7_packet_id", "g7_start_token_id",
        "g7_dependency_result_pins", "g7_producer_result_pins", "g7_migration_lease_id",
        "g7_touch_policy_digest", "g7_evidence_refs", "g7_authority_note",
    ]
    audit.equal(new_fields[len(old_fields):], expected_extra, "successor G7 columns")
    for index, (old, new) in enumerate(zip(old_rows, new_rows), start=1):
        for field in old_fields:
            audit.equal(new.get(field), old.get(field), f"overlay preserved row {index} field {field}")
    ids = [row.get("slice_id", "") for row in new_rows]
    audit.equal(len(set(ids)), 102, "successor unique IDs")
    audit.equal(sha(("\n".join(ids) + "\n").encode()), EXPECTED["orderedIds"], "successor ordered ID digest")
    audit.equal(sha(("\n".join(sorted(ids)) + "\n").encode()), EXPECTED["sortedIds"], "successor sorted ID digest")
    audit.equal(Counter(row.get("module") for row in new_rows), Counter({"HRM": 22, "PAY": 21, "PER": 22, "SYS": 17, "TIM": 20}), "successor module counts")
    audit.equal(Counter(row.get("source_kind") for row in new_rows), Counter({"BASE_TARGET_FAMILY": 86, "MODERN_CAPABILITY": 16}), "successor source-kind counts")
    audit.equal(Counter(row.get("g7_classification") for row in new_rows), Counter(EXPECTED_CLASSIFICATIONS), "successor classification counts")
    row_by_id = {row["slice_id"]: row for row in new_rows}
    for slice_id in ("BASE-TFR-PER-006", "BASE-TFR-TIM-006"):
        audit.equal(row_by_id[slice_id].get("g7_classification"), "AUTHORIZED_DOMAIN_AUTHORING", f"{slice_id} classification")
        audit.require(row_by_id[slice_id].get("g7_start_token_id", "") not in {"", "NONE"}, f"{slice_id} token missing")
    for slice_id in ("BASE-TFR-SYS-007", "BASE-TFR-HRM-010"):
        audit.equal(row_by_id[slice_id].get("g7_classification"), "PACKET_PREPARED_START_WITHHELD", f"{slice_id} classification")
        audit.equal(row_by_id[slice_id].get("g7_start_token_id"), "NONE", f"{slice_id} token must be withheld")
    evidence = read_json(hris / "g7-delegation/2026-10-12/successor-slice-overlay.evidence.v1.json", audit)
    verify_seal(evidence, "overlay evidence", audit)
    audit.equal(evidence.get("successorOverlay", {}).get("sha256"), file_sha(successor), "overlay evidence raw hash")
    audit.equal(evidence.get("sourceOverlay", {}).get("sha256"), EXPECTED["stale"], "stale overlay immutable pin")
    return evidence


def verify_packets_and_tokens(frontend: Path, preflight: dict[str, Any], audit: Audit) -> tuple[dict[str, Any], dict[str, Any]]:
    base = frontend / HRIS_REL / "g7-delegation/2026-10-12"
    candidates = {row["module"]: row for row in preflight.get("candidates", [])}
    packets: dict[str, dict[str, Any]] = {}
    packet_hashes: dict[str, str] = {}
    for module, relative in PACKETS.items():
        path = base / relative
        packet = read_json(path, audit)
        packets[module] = packet
        packet_hashes[module] = file_sha(path) if path.is_file() else ""
        verify_seal(packet, f"{module} packet", audit)
        audit.equal(packet.get("schema"), "dwp.hris.g7-module-work-packet.v1", f"{module} packet schema")
        audit.equal(packet.get("module"), module, f"{module} packet module")
        candidate = candidates.get(module, {})
        audit.equal(packet.get("slice", {}).get("sliceId"), candidate.get("sliceId"), f"{module} packet slice")
        audit.equal(packet.get("slice", {}).get("primaryContractRefs"), candidate.get("primaryContractRefs"), f"{module} primary contract refs")
        audit.equal(packet.get("slice", {}).get("operationBindings"), candidate.get("operationBindings"), f"{module} operation bindings")
        audit.equal([item.get("dependencyId") for item in packet.get("dependencies", [])], candidate.get("dependencyIds"), f"{module} dependency IDs")
        path_policy = packet.get("pathPolicy", {})
        audit.equal(packet.get("pathPolicySha256"), sha(canonical(path_policy)), f"{module} path policy digest")
        audit.require(not set(path_policy.get("allowedPaths", [])) & set(path_policy.get("protectedPaths", [])), f"{module} allowed/protected path collision")
        audit.require(set(path_policy.get("commonControlOnlyPaths", [])) == {
            *(f"backend:{path}" for path in preflight.get("commonControlOnlyPaths", {}).get("backend", [])),
            *(f"frontend:{path}" for path in preflight.get("commonControlOnlyPaths", {}).get("frontend", [])),
        }, f"{module} common-Control path set drift")
        expected_state = "PACKET_AUTHORIZED_DOMAIN_AUTHORING" if module in {"PER", "TIM"} else "PACKET_PREPARED_START_WITHHELD"
        audit.equal(packet.get("lifecycleState"), expected_state, f"{module} packet state")
        expected_authority = module in {"PER", "TIM"}
        audit.equal(packet.get("authority", {}).get("sourceChangeAuthorized"), expected_authority, f"{module} source authority")
        audit.equal(packet.get("startTokenId") is not None, expected_authority, f"{module} start token binding")
        audit.require(packet.get("verificationBindings", {}).get("fullW1OrPromotionRunInModulePacket") is False, f"{module} packet allows W1")
        commands = packet.get("verificationBindings", {}).get("moduleCommands", [])
        command_text = json.dumps(commands, ensure_ascii=False).lower()
        audit.require("w1" not in command_text, f"{module} packet contains a W1 command")
        for command in commands:
            argv = command.get("argv", [])
            if argv[:3] == ["yarn", "vitest", "run"]:
                audit.require(len(argv) > 3, f"{module} packet contains broad Vitest command")
            if argv and argv[0] == "./gradlew":
                audit.require("--tests" in argv, f"{module} packet contains broad Gradle test command")
        for source_pin in packet.get("contractPins", {}).get("moduleSourceEvidence", []):
            source_path = frontend / source_pin.get("path", "")
            audit.require(source_path.is_file(), f"{module} source evidence missing: {source_pin.get('path')}")
            if source_path.is_file():
                raw = source_path.read_bytes()
                audit.equal(len(raw), source_pin.get("bytes"), f"{module} source evidence bytes {source_pin.get('path')}")
                audit.equal(sha(raw), source_pin.get("sha256"), f"{module} source evidence hash {source_pin.get('path')}")
        if module in {"SYS", "HRM"}:
            audit.require(bool(packet.get("releaseConditions")), f"{module} withheld packet lacks release conditions")
        else:
            audit.equal(packet.get("releaseConditions"), [], f"{module} authorized packet release conditions")
    token_files = sorted(path.name for path in (base / "tokens").glob("*.json")) if (base / "tokens").is_dir() else []
    audit.equal(token_files, ["per-006.start-token.v1.json", "tim-006.start-token.v1.json"], "active token file closed set")
    tokens: dict[str, dict[str, Any]] = {}
    for module, relative in TOKENS.items():
        path = base / relative
        token = read_json(path, audit)
        tokens[module] = token
        verify_seal(token, f"{module} token", audit)
        audit.equal(token.get("module"), module, f"{module} token module")
        audit.equal(token.get("packetId"), packets[module].get("packetId"), f"{module} token packet ID")
        audit.equal(token.get("packetFileSha256"), packet_hashes[module], f"{module} token packet raw hash")
        audit.equal(token.get("pathPolicySha256"), packets[module].get("pathPolicySha256"), f"{module} token path policy")
        audit.equal(token.get("dependencyPinsSha256"), packets[module].get("dependencyPinsSha256"), f"{module} token dependency digest")
        audit.equal(token.get("state"), "ISSUED_PENDING_PROMOTION_RECEIPT", f"{module} token pre-promotion state")
        audit.require(token.get("authority", {}).get("domainAuthoringOnly") is True, f"{module} token is not domain-only")
        audit.require(token.get("authority", {}).get("sharedControlPathChangeAuthorized") is False, f"{module} token allows common paths")
        audit.require(token.get("authority", {}).get("integrationMergeAuthorized") is False, f"{module} token allows integration merge")
        audit.equal(len(token.get("worktreeBindings", [])), 2, f"{module} token worktree count")
    packet_bindings = [binding for packet in packets.values() for binding in packet.get("slice", {}).get("operationBindings", [])]
    plan = read_json(base / "delegation-plan.v1.json", audit)
    verify_seal(plan, "delegation plan", audit)
    pay_hold = next((row for row in plan.get("withheld", []) if row.get("module") == "PAY"), {})
    for module in ("SYS", "HRM"):
        prepared_hold = next((row for row in plan.get("withheld", []) if row.get("module") == module), {})
        audit.require(prepared_hold.get("packetIssued") is True, f"{module} prepared packet not recorded")
        audit.require(prepared_hold.get("tokenIssued") is False, f"{module} token authority leak in plan")
        audit.equal(prepared_hold.get("migrationLeaseStatus"), "RESERVED_CONTROL_ONLY", f"{module} reserved lease state in plan")
    all_bindings = packet_bindings + pay_hold.get("operationBindings", [])
    expected_bindings = [binding for row in preflight.get("candidates", []) for binding in row.get("operationBindings", [])]
    audit.equal(all_bindings, expected_bindings, "27 candidate operation bindings")
    pay_candidate = candidates.get("PAY", {})
    audit.equal(pay_hold.get("producerBinding"), pay_candidate.get("producerBinding"), "PAY producer binding preserved")
    dependency_resolution = pay_hold.get("dependencyResolution", {})
    audit.equal(dependency_resolution.get("keep"), ["DEP-001", "DEP-002", "DEP-003", "DEP-016", "DEP-019"], "PAY kept dependencies")
    audit.equal(set(dependency_resolution.get("dropFromThisSlice", {})), {"DEP-007", "DEP-008", "DEP-009"}, "PAY dropped dependencies")
    agent_hold = next((row for row in plan.get("withheld", []) if row.get("module") == "AGENT"), {})
    audit.equal(agent_hold.get("state"), "NO_CANONICAL_SLICE_NO_PACKET", "Agent hold state")
    return packets, tokens


def verify_leases(frontend: Path, backend: Path, packets: dict[str, Any], tokens: dict[str, Any], audit: Audit) -> dict[str, Any]:
    path = frontend / HRIS_REL / "g7-delegation/2026-10-12/migration-leases.v1.json"
    register = read_json(path, audit)
    verify_seal(register, "migration lease register", audit)
    rows = register.get("leases", [])
    audit.equal(len(rows), 4, "migration lease count")
    by_module = {row.get("module"): row for row in rows}
    audit.equal(set(by_module), set(MIGRATIONS), "migration lease modules")
    seen_paths = set()
    for module, (root, high, version, filename, status) in MIGRATIONS.items():
        row = by_module.get(module, {})
        verify_seal(row, f"{module} migration lease", audit)
        audit.equal(row.get("streamRoot"), root, f"{module} migration root")
        audit.equal(row.get("frozenHighWater"), high, f"{module} migration high-water")
        audit.equal(row.get("version"), version, f"{module} migration version")
        expected_path = f"{root}/{filename}"
        audit.equal(row.get("exactRelativePath"), expected_path, f"{module} migration path")
        audit.equal(row.get("status"), status, f"{module} migration status")
        audit.require(expected_path not in seen_paths, f"duplicate migration path: {expected_path}")
        seen_paths.add(expected_path)
        versions = []
        for candidate in (backend / root).glob("V*.sql"):
            match = re.match(r"V([0-9]+)__", candidate.name)
            if match:
                versions.append(int(match.group(1)))
        audit.equal(max(versions, default=0), high, f"{module} live migration high-water")
        audit.require(not (backend / expected_path).exists(), f"{module} leased migration already exists")
        audit.equal(packets[module].get("migrationLease", {}).get("leaseId"), row.get("leaseId"), f"{module} packet lease ID")
        expected_admitted = module in {"PER", "TIM"}
        audit.equal(row.get("migrationAdmissionAuthorized"), expected_admitted, f"{module} migration admission")
        if expected_admitted:
            audit.equal(tokens[module].get("migrationLeaseId"), row.get("leaseId"), f"{module} token lease ID")
        else:
            audit.equal(row.get("ownerTokenId"), None, f"{module} reserved lease owner token")
    return register


def verify_control_requests(frontend: Path, packets: dict[str, Any], audit: Audit) -> dict[str, Any]:
    path = frontend / HRIS_REL / "g7-delegation/2026-10-12/control-requests.v1.json"
    register = read_json(path, audit)
    verify_seal(register, "Control request register", audit)
    requests = register.get("requests", [])
    ids = [row.get("requestId") for row in requests]
    audit.equal(len(ids), len(set(ids)), "Control request unique IDs")
    audit.equal(len(ids), 18, "Control request count")
    raw_sha = file_sha(path)
    for module, packet in packets.items():
        control = packet.get("centralControlRequests", {})
        audit.equal(control.get("registerSha256"), raw_sha, f"{module} Control register hash")
        audit.equal(set(control.get("requestIds", [])), {row.get("requestId") for row in requests if row.get("module") == module}, f"{module} Control request IDs")
        audit.require(control.get("moduleMayImplement") is False, f"{module} may implement Control request")
    return register


def verify_manifest(frontend: Path, audit: Audit) -> dict[str, Any]:
    base = frontend / HRIS_REL / "g7-delegation/2026-10-12"
    manifest = read_json(base / "manifest.v1.json", audit)
    verify_seal(manifest, "G7 manifest", audit)
    audit.equal(manifest.get("packetCount"), 4, "manifest packet count")
    audit.equal(manifest.get("tokenCount"), 2, "manifest token count")
    audit.equal(manifest.get("overlayRows"), 102, "manifest overlay count")
    audit.equal(manifest.get("artifactCount"), len(manifest.get("artifacts", [])), "manifest artifact count")
    for group in ("sourcePins", "toolPins", "artifacts"):
        rows = manifest.get(group, [])
        paths = [row.get("path") for row in rows]
        audit.equal(len(paths), len(set(paths)), f"manifest {group} unique paths")
        for row in rows:
            path = frontend / row.get("path", "")
            audit.require(path.is_file(), f"manifest {group} path missing: {row.get('path')}")
            if path.is_file():
                raw = path.read_bytes()
                audit.equal(len(raw), row.get("bytes"), f"manifest {group} bytes {row.get('path')}")
                audit.equal(sha(raw), row.get("sha256"), f"manifest {group} hash {row.get('path')}")
    return manifest


def verify_worktrees(frontend: Path, audit: Audit) -> None:
    path = frontend / HRIS_REL / "g7-delegation/2026-10-12/registers/module-worktrees.v1.csv"
    fields, rows = read_csv(path, audit)
    audit.require(bool(fields), "worktree register has no fields")
    audit.equal(len(rows), 4, "worktree register row count")
    audit.equal(Counter(row.get("module") for row in rows), Counter({"PER": 2, "TIM": 2}), "worktree modules")
    audit.equal(Counter(row.get("repo") for row in rows), Counter({"frontend": 2, "backend": 2}), "worktree repos")
    for row in rows:
        root = Path(row.get("absolute_path", ""))
        audit.require(root.is_dir(), f"worktree missing: {root}")
        if not root.is_dir():
            continue
        for args, expected, label in (
            (("rev-parse", "HEAD"), row.get("head"), "head"),
            (("rev-parse", "HEAD^{tree}"), row.get("tree"), "tree"),
            (("branch", "--show-current"), row.get("branch"), "branch"),
            (("rev-parse", "--abbrev-ref", "@{upstream}"), row.get("upstream"), "upstream"),
        ):
            code, actual = run_git(root, *args)
            audit.equal(code, 0, f"worktree {root} {label} command")
            audit.equal(actual, expected, f"worktree {root} {label}")
        code, status = run_git(root, "status", "--porcelain=v1", "--untracked-files=all")
        audit.equal(code, 0, f"worktree {root} status command")
        audit.equal(status, "", f"worktree {root} clean")
        code, counts = run_git(root, "rev-list", "--left-right", "--count", "HEAD...@{upstream}")
        audit.equal(code, 0, f"worktree {root} ahead/behind command")
        audit.equal(counts, "0\t0", f"worktree {root} ahead/behind")


def verify_promotion(frontend: Path, manifest: dict[str, Any], tokens: dict[str, Any], audit: Audit) -> None:
    hris = frontend / HRIS_REL
    receipt_path = hris / "2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
    receipt = read_json(receipt_path, audit)
    verify_seal(receipt, "G7 promotion receipt", audit)
    audit.equal(receipt.get("status"), "PASS_SCOPED_DELEGATION", "G7 receipt status")
    bundle = receipt.get("bundleCommit", {})
    commit = bundle.get("commit", "")
    tree = bundle.get("tree", "")
    verify_git_object(frontend, commit, tree, "G7 bundle", audit)
    manifest_path = hris / "g7-delegation/2026-10-12/manifest.v1.json"
    audit.equal(bundle.get("manifestSha256"), file_sha(manifest_path), "G7 receipt manifest hash")
    code, committed_manifest = run_git_bytes(
        frontend,
        "show",
        f"{commit}:docs/06-delivery/hris/g7-delegation/2026-10-12/manifest.v1.json",
    )
    audit.equal(code, 0, "G7 manifest exists in bundle commit")
    if code == 0:
        audit.equal(sha(committed_manifest), bundle.get("manifestSha256"), "G7 bundle commit manifest hash")
    delegations = receipt.get("delegations", [])
    audit.equal([row.get("module") for row in delegations], ["PER", "TIM"], "G7 authorized module order")
    audit.equal([row.get("tokenId") for row in delegations], [tokens["PER"].get("tokenId"), tokens["TIM"].get("tokenId")], "G7 active token IDs")
    authority = receipt.get("authority", {})
    audit.equal(authority.get("authorizedModules"), ["PER", "TIM"], "G7 authority modules")
    audit.equal(authority.get("startTokensIssued"), [tokens["PER"].get("tokenId"), tokens["TIM"].get("tokenId")], "G7 authority token set")
    audit.require(authority.get("moduleParallelDevelopmentAuthorized") is True, "G7 parallel authority missing")
    for key in ("sharedControlPathChangeAuthorizedForModules", "integrationMergeAuthorized", "customerDataAuthorized", "customerActivationAuthorized", "productionReleaseAuthorized"):
        audit.require(authority.get(key) is False, f"G7 authority unexpectedly grants {key}")
    prepared = receipt.get("preparedStartWithheld", [])
    audit.equal([row.get("module") for row in prepared], ["SYS", "HRM"], "G7 prepared/withheld modules")
    audit.require(all(row.get("tokenId") is None and row.get("sourceChangeAuthorized") is False for row in prepared), "SYS/HRM receipt authority leak")
    withheld_modules = {row.get("module") for row in receipt.get("withheld", [])}
    audit.require({"SYS", "HRM", "PAY", "AGENT"}.issubset(withheld_modules), "G7 withheld set incomplete")
    audit.require(receipt.get("codeReexecutionPerformed") is False, "G7 receipt claims code reexecution")
    audit.require(receipt.get("applicationSourceChanged") is False, "G7 receipt claims source change")
    roadmap = hris / "2026-10-12-g7-integration-roadmap-status.md"
    audit.require(roadmap.is_file(), "G7 roadmap status missing")
    if roadmap.is_file():
        text = roadmap.read_text(encoding="utf-8")
        audit.require("BASE-TFR-PER-006" in text and "BASE-TFR-TIM-006" in text, "G7 roadmap omits authorized slices")
        audit.require("START_WITHHELD" in text and "BASE-TFR-HRM-010" in text, "G7 roadmap omits withheld state")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("bundle", "promotion"), default="promotion")
    parser.add_argument("--frontend-root", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend-root", type=Path, default=DEFAULT_FRONTEND.parent / "backend")
    parser.add_argument("--agent-root", type=Path, default=Path("/Users/a10697/Work/DWP/dwp_agent"))
    parser.add_argument("--g6-evidence-root", type=Path, default=(DEFAULT_FRONTEND.parent / "backend/output/hris-w1-synthetic-20261012t005606z-dd1c1db1"))
    args = parser.parse_args()
    frontend = args.frontend_root.resolve()
    backend = args.backend_root.resolve()
    agent = args.agent_root.resolve()
    g6_root = args.g6_evidence_root.resolve()
    audit = Audit()
    hris = frontend / HRIS_REL
    preflight_path = hris / "2026-10-07-g7-module-delegation-preflight.json"
    g5_path = hris / "2026-10-12-g5-integrated-stabilization-freeze-receipt.json"
    stale_path = hris / "current-slice-integration-status.v1.csv"
    stale_evidence_path = hris / "current-slice-integration-status.v1.evidence.json"
    for path, expected, label in (
        (preflight_path, EXPECTED["preflight"], "preflight"),
        (g5_path, EXPECTED["g5"], "G5 receipt"),
        (stale_path, EXPECTED["stale"], "stale overlay"),
        (stale_evidence_path, EXPECTED["staleEvidence"], "stale overlay evidence"),
    ):
        audit.require(path.is_file(), f"{label} missing")
        if path.is_file():
            audit.equal(file_sha(path), expected, f"{label} raw hash")
    preflight = read_json(preflight_path, audit)
    audit.equal(preflight.get("state"), "PREPARED_BLOCKED_PENDING_G5_G6_PROMOTION", "immutable preflight state")
    audit.require(preflight.get("authority", {}).get("moduleParallelDevelopmentAuthorized") is False, "preflight was mutated into authority")
    verify_input_authorities(frontend, preflight, audit)
    verify_git_object(frontend, *BASE_PINS["frontend"], "frozen frontend", audit)
    verify_git_object(backend, *BASE_PINS["backend"], "frozen backend", audit)
    verify_git_object(agent, *BASE_PINS["agent"], "frozen Agent", audit)
    verify_g6(frontend, g6_root, audit)
    verify_overlay(frontend, audit)
    packets, tokens = verify_packets_and_tokens(frontend, preflight, audit)
    verify_leases(frontend, backend, packets, tokens, audit)
    verify_control_requests(frontend, packets, audit)
    manifest = verify_manifest(frontend, audit)
    verify_worktrees(frontend, audit)
    if args.phase == "promotion":
        verify_promotion(frontend, manifest, tokens, audit)
    audit.finish()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
