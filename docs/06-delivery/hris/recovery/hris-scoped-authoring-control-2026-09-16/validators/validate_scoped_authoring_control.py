#!/usr/bin/env python3
"""Fail-closed read-only preflight for HRIS scoped authoring preparation."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKSPACE = Path("/Users/a10697/Work/DWP")
BLUEPRINT = WORKSPACE / "output/hris-porting-blueprint-2026-09-09"
PACKAGE = WORKSPACE / "output/hris-scoped-authoring-control-2026-09-16"
SESSIONS = ("HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS")
SLUGS = {session: session.removeprefix("HRIS-").lower() for session in SESSIONS}


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def git(worktree: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(worktree), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def csv_rows(path: Path, key: str) -> dict[str, dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return {row[key]: row for row in csv.DictReader(handle)}


def payload_digest_valid(value: dict[str, Any], digest_field: str) -> bool:
    expected = value.get(digest_field)
    payload = dict(value)
    payload.pop(digest_field, None)
    return isinstance(expected, str) and expected == sha256_bytes(canonical_json_bytes(payload))


def add_check(checks: list[dict[str, Any]], blockers: list[str], check_id: str, passed: bool, detail: Any) -> None:
    checks.append({"checkId": check_id, "status": "PASS" if passed else "FAIL", "detail": detail})
    if not passed:
        blockers.append(check_id)


def validate(session_id: str) -> dict[str, Any]:
    slug = SLUGS[session_id]
    packet_path = PACKAGE / f"packets/{slug}.v1.json"
    manifest_path = PACKAGE / "manifests/control-manifest.v1.json"
    gate_path = BLUEPRINT / "g0/current-g3-gate-decision.json"
    slice_path = BLUEPRINT / "coding-readiness/g3-slice-code-go-register.csv"
    allocation_path = BLUEPRINT / "coding-readiness/g3-file-allocation-register.csv"
    migration_path = BLUEPRINT / "g0/migration-allocation-register.csv"
    catalog_path = BLUEPRINT / "g0/g3-verification-command-catalog.v1.json"

    checks: list[dict[str, Any]] = []
    blockers: list[str] = []

    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    gate = json.loads(gate_path.read_text(encoding="utf-8"))
    slice_rows = csv_rows(slice_path, "slice_id")
    allocation_rows = csv_rows(allocation_path, "allocation_id")
    migration_rows = csv_rows(migration_path, "allocation_id")
    command_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    profiles = {profile["profileId"]: profile for profile in command_catalog["profiles"]}

    add_check(checks, blockers, "manifest-payload-seal", payload_digest_valid(manifest, "sealedPayloadSha256"), manifest_path.name)
    add_check(checks, blockers, "packet-payload-seal", payload_digest_valid(packet, "sealedPayloadSha256"), packet["packetId"])
    add_check(checks, blockers, "packet-session", packet.get("sessionId") == session_id, packet.get("sessionId"))

    indexed = [entry for entry in manifest.get("packets", []) if entry.get("sessionId") == session_id]
    indexed_ok = len(indexed) == 1 and indexed[0].get("fileSha256") == sha256_file(packet_path)
    add_check(checks, blockers, "packet-index-file-digest", indexed_ok, sha256_file(packet_path))

    gate_ok = (
        gate.get("effectiveGate") == "CLOSED_FAIL_SAFE"
        and packet["officialGateSnapshot"]["effectiveGate"] == "CLOSED_FAIL_SAFE"
        and packet["officialGateSnapshot"]["sha256"] == sha256_file(gate_path)
    )
    add_check(checks, blockers, "official-gate-remains-closed", gate_ok, gate.get("currentState"))

    authority_ok = (
        packet.get("mode") == "PREPARE_ONLY_NO_CODE"
        and packet.get("lifecycleState") == "PACKET_ISSUED_HOLD"
        and packet["authority"].get("officialGateAuthority") == "NONE"
        and packet["authority"].get("moduleCodeAuthority") == "NONE_START_TOKEN_WITHHELD"
        and packet["holdPolicy"].get("startToken") == "WITHHELD"
        and packet["holdPolicy"].get("startCommandIssued") is False
        and packet["holdPolicy"].get("developmentStarted") is False
    )
    add_check(checks, blockers, "no-code-authority-and-start-token-withheld", authority_ok, packet["holdPolicy"])

    for side in ("backend", "frontend"):
        expected = packet["worktrees"][side]
        worktree = Path(expected["worktreePath"])
        repository_root = Path(expected["repositoryRoot"])
        try:
            head = git(worktree, "rev-parse", "HEAD")
            tree = git(worktree, "rev-parse", "HEAD^{tree}")
            branch = git(worktree, "branch", "--show-current")
            status = git(worktree, "status", "--porcelain=v1")
            branch_ref = git(repository_root, "rev-parse", f"refs/heads/{expected['branch']}")
            worktree_listing = git(repository_root, "worktree", "list", "--porcelain")
            registered_count = sum(
                1 for line in worktree_listing.splitlines() if line == f"worktree {worktree}"
            )
            passed = (
                head == expected["authoringBaseHeadSha"] == expected["observedHeadSha"]
                and tree == expected["authoringBaseTreeSha"] == expected["observedTreeSha"]
                and branch == expected["branch"]
                and branch_ref == head
                and status == ""
                and registered_count == 1
            )
            detail = {
                "path": str(worktree),
                "branch": branch,
                "head": head,
                "tree": tree,
                "dirtyCount": len(status.splitlines()) if status else 0,
                "registeredCount": registered_count,
                "statusPorcelainSha256": sha256_bytes(status.encode("utf-8")),
            }
        except (subprocess.CalledProcessError, FileNotFoundError) as error:
            passed = False
            detail = {"path": str(worktree), "error": type(error).__name__}
        add_check(checks, blockers, f"{side}-worktree-exact-clean", passed, detail)

    first_slice_id = packet["firstSlice"]["sliceId"]
    first_slice = slice_rows.get(first_slice_id)
    slice_ok = bool(first_slice) and first_slice["session_id"] == session_id
    if first_slice:
        row_digest = sha256_bytes(canonical_json_bytes(first_slice))
        slice_ok = slice_ok and row_digest == packet["firstSlice"]["sliceRowSha256"]
        slice_ok = slice_ok and first_slice["code_go_token"] == packet["firstSlice"]["codeGoTokenReference"]
    else:
        row_digest = "MISSING"
    add_check(checks, blockers, "first-slice-binding", slice_ok, {"sliceId": first_slice_id, "rowSha256": row_digest})

    allocation_ids = packet["firstSlice"].get("fileAllocationIds", [])
    allocation_ok = bool(allocation_ids) and all(
        allocation_id in allocation_rows and allocation_rows[allocation_id]["session_id"] == session_id
        for allocation_id in allocation_ids
    )
    add_check(checks, blockers, "file-allocation-ownership", allocation_ok, allocation_ids)

    migration_id = packet["migrationPolicy"]["allocationId"]
    migration_row = migration_rows.get(migration_id)
    migration_ok = bool(migration_row) and migration_row["session_id"] == session_id
    migration_ok = migration_ok and packet["migrationPolicy"].get("migrationCreated") is False
    migration_ok = migration_ok and packet["migrationPolicy"].get("migrationExecuted") is False
    migration_ok = migration_ok and packet["migrationPolicy"].get("migrationPromoted") is False
    add_check(checks, blockers, "migration-reservation-hold", migration_ok, packet["migrationPolicy"])

    binding_failures: list[str] = []
    for binding in packet.get("contractBindings", []):
        binding_path = WORKSPACE / binding["path"]
        if not binding_path.is_file() or sha256_file(binding_path) != binding["sha256"] or binding_path.stat().st_size != binding["byteLength"]:
            binding_failures.append(binding["path"])
    add_check(checks, blockers, "canonical-contract-fixture-digests", not binding_failures, {"count": len(packet.get("contractBindings", [])), "failures": binding_failures})

    catalog_ok = packet["verificationBindings"]["commandCatalogSha256"] == sha256_file(catalog_path)
    profile_ids = (
        packet["verificationBindings"]["backendProfileId"],
        packet["verificationBindings"]["frontendProfileId"],
    )
    catalog_ok = catalog_ok and all(
        profile_id in profiles and profiles[profile_id]["ownerSessionId"] == session_id
        for profile_id in profile_ids
    )
    if first_slice:
        catalog_ok = catalog_ok and packet["verificationBindings"]["frontendTestPath"] == first_slice["frontend_test_path"]
    add_check(checks, blockers, "closed-verification-profile-binding", catalog_ok, list(profile_ids))

    path_policy = packet.get("pathPolicy", {})
    path_policy_ok = (
        bool(path_policy.get("allowedBackendGlobs"))
        and bool(path_policy.get("allowedFrontendGlobs"))
        and "contracts/**" in path_policy.get("forbiddenGlobs", [])
        and "contracts/**" in path_policy.get("centralSingleWriterGlobs", [])
        and path_policy.get("touchManifestState") == "NOT_ISSUED_UNTIL_START_COMMAND"
    )
    add_check(checks, blockers, "path-policy-and-control-single-writer", path_policy_ok, path_policy)

    frontend_test = Path(packet["worktrees"]["frontend"]["worktreePath"]) / packet["verificationBindings"]["frontendTestPath"]
    checks.append(
        {
            "checkId": "future-test-path-binding-only",
            "status": "PASS",
            "detail": {
                "path": str(frontend_test),
                "existsBeforeDevelopment": frontend_test.exists(),
                "expectedBeforeDevelopment": False,
                "testsExecuted": False,
            },
        }
    )

    result = "PREFLIGHT_PASS_READY_TO_START_HOLD" if not blockers else "PREFLIGHT_FAIL"
    receipt: dict[str, Any] = {
        "schema": "dwp.hris.scoped-g3-preflight-receipt.v1",
        "receiptId": f"PREFLIGHT-{SLUGS[session_id].upper()}-V1",
        "packetId": packet["packetId"],
        "packetFileSha256": sha256_file(packet_path),
        "sessionId": session_id,
        "observedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "checks": checks,
        "blockers": blockers,
        "result": result,
        "officialGate": "CLOSED_FAIL_SAFE",
        "implementationAuthority": "NONE_START_TOKEN_WITHHELD",
        "startCommandIssued": False,
        "developmentStarted": False,
        "testsExecuted": False,
        "codeChangesObserved": False if not blockers else None,
    }
    receipt["receiptPayloadSha256"] = sha256_bytes(canonical_json_bytes(receipt))
    return receipt


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def refresh_aggregate_state() -> None:
    manifest = json.loads((PACKAGE / "manifests/control-manifest.v1.json").read_text(encoding="utf-8"))
    module_states: dict[str, str] = {}
    receipt_refs: list[dict[str, str]] = []
    for session_id in SESSIONS:
        slug = SLUGS[session_id]
        receipt_path = PACKAGE / f"receipts/{slug}-preflight.v1.json"
        if receipt_path.is_file():
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            state = "READY_TO_START_HOLD" if receipt.get("result") == "PREFLIGHT_PASS_READY_TO_START_HOLD" else "PREFLIGHT_FAIL"
            module_states[session_id] = state
            receipt_refs.append(
                {
                    "sessionId": session_id,
                    "path": str(receipt_path.relative_to(WORKSPACE)),
                    "sha256": sha256_file(receipt_path),
                    "result": receipt.get("result", "UNKNOWN"),
                }
            )
        else:
            module_states[session_id] = "PACKET_ISSUED_HOLD"

    all_ready = all(state == "READY_TO_START_HOLD" for state in module_states.values())
    current_state: dict[str, Any] = {
        "schema": "dwp.hris.scoped-authoring-readiness-state.v1",
        "observedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "aggregateState": "ALL_MODULES_READY_TO_START_HOLD" if all_ready else "PREFLIGHT_IN_PROGRESS",
        "officialGate": "CLOSED_FAIL_SAFE",
        "startCommandIssued": False,
        "developmentStarted": False,
        "moduleStates": module_states,
        "receiptRefs": receipt_refs,
        "controlManifestSha256": sha256_file(PACKAGE / "manifests/control-manifest.v1.json"),
        "controlManifestPayloadSha256": manifest["sealedPayloadSha256"],
        "nextPermittedAction": "WAIT_FOR_EXPLICIT_USER_START_INSTRUCTION" if all_ready else "COMPLETE_REMAINING_READ_ONLY_PREFLIGHTS",
        "nextForbiddenAction": "START_SCOPED_AUTHORING",
    }
    current_state["sealedPayloadSha256"] = sha256_bytes(canonical_json_bytes(current_state))
    write_json(PACKAGE / "state/current-readiness.v1.json", current_state)

    transition_path = PACKAGE / "registers/scoped-authoring-state-transition-register.csv"
    with transition_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["transitionId", "sessionId", "fromState", "toState", "evidenceRef", "capturedAt"])
        for packet in manifest["packets"]:
            session_id = packet["sessionId"]
            slug = SLUGS[session_id]
            writer.writerow([
                f"TRANSITION-{slug.upper()}-001",
                session_id,
                "DRAFT",
                "PACKET_ISSUED_HOLD",
                f"packets/{slug}.v1.json",
                manifest["issuedAt"],
            ])
            receipt_path = PACKAGE / f"receipts/{slug}-preflight.v1.json"
            if receipt_path.is_file():
                receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
                writer.writerow([
                    f"TRANSITION-{slug.upper()}-002",
                    session_id,
                    "PACKET_ISSUED_HOLD",
                    "READY_TO_START_HOLD" if receipt["result"] == "PREFLIGHT_PASS_READY_TO_START_HOLD" else "PREFLIGHT_FAIL",
                    f"receipts/{slug}-preflight.v1.json",
                    receipt["observedAt"],
                ])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=SESSIONS)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--write-receipt", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if bool(args.session) == bool(args.all):
        parser.error("choose exactly one of --session or --all")

    sessions = SESSIONS if args.all else (args.session,)
    receipts = [validate(session_id) for session_id in sessions]
    if args.write_receipt:
        for receipt in receipts:
            slug = SLUGS[receipt["sessionId"]]
            write_json(PACKAGE / f"receipts/{slug}-preflight.v1.json", receipt)
        refresh_aggregate_state()

    failed = [receipt for receipt in receipts if receipt["result"] != "PREFLIGHT_PASS_READY_TO_START_HOLD"]
    if args.compact:
        print(
            json.dumps(
                {
                    "status": "PASS" if not failed else "FAIL",
                    "results": [
                        {
                            "sessionId": receipt["sessionId"],
                            "result": receipt["result"],
                            "blockers": receipt["blockers"],
                            "startCommandIssued": receipt["startCommandIssued"],
                            "developmentStarted": receipt["developmentStarted"],
                        }
                        for receipt in receipts
                    ],
                },
                separators=(",", ":"),
            )
        )
    else:
        print(json.dumps(receipts[0] if len(receipts) == 1 else receipts, indent=2, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
