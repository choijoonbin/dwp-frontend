#!/usr/bin/env python3
"""Fail-closed verifier for the canonical HRIS migration C1 successor.

The default verification reads only immutable Git objects from the pinned backend
commit. ``--check-live`` additionally requires that the integration worktree is at
the pin and clean. Historical G2 artifacts are evidence inputs, never authority.
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
from collections import defaultdict
from pathlib import Path
from typing import Any


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
REGISTER = G0 / "migration-successor-register.v1.json"
ALLOCATION_REGISTER = G0 / "migration-allocation-register.csv"
STREAM_REGISTER = G0 / "migration-stream-register.csv"
VERSION_RE = re.compile(r"^V([0-9]+(?:[._][0-9]+)*)__.+\.sql$")
SHA40_RE = re.compile(r"^[0-9a-f]{40}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

EXPECTED_SOURCE = {
    "commit": "b6d1f23e54e04b86d2b068e47b8bf6c9db608b5f",
    "tree": "84345cd81f8b113d520b0018b159f7c27b503360",
    "predecessorCommit": "db0d2b5067e6fbee27ee58121c5a4406cab132b9",
    "migrationSqlCount": 444,
    "migrationManifestSha256": "accbd9bf1306e3cb67fbb62922747b423587c2daff201fcc79a741b79164403b",
    "migrationSubtreeOids": {
        "dwp-people-server/src/main/resources/db/migration": "ff52f232e127fe3efd2dbe230519453a506868cc",
        "dwp-people-server/src/main/resources/db/performance-migration": "1ac14953b1d0b707628e029d46ad0837b23a9dc2",
        "dwp-payroll-server/src/main/resources/db/migration": "3b050e0f0f3558836c5652323dd0abb58a4d5f4f",
        "dwp-time-server/src/main/resources/db/migration": "18f551c22076544bb1449f61cb5b73d47f2aac47",
        "dwp-auth-server/src/main/resources/db/migration": "07ffefdd34ec250cdd8d1f2e8a8e3dabf4b67ecd",
        "dwp-platform-server/src/main/resources/db/migration": "f064bd4bbfc399e136bf28ced7a7f97066cd307f",
        "dwp-approval-server/src/main/resources/db/migration": "2063d822fb0a5da80778b9cbe43bd83fad663d7f",
        "dwp-notification-server/src/main/resources/db/migration": "fe03230779dc5626c3351a1a37b65227a868504c",
    },
}

EXPECTED_ALLOCATIONS = {
    "MIG-HRM-PEOPLE-51-73": (
        "HRIS-HRM", "dwp-people-server",
        "dwp-people-server/src/main/resources/db/migration",
        "public", "flyway_schema_history", 50, 51, 73,
    ),
    "MIG-PER-PERFORMANCE-1-63": (
        "HRIS-PER", "dwp-people-server",
        "dwp-people-server/src/main/resources/db/performance-migration",
        "hris_performance", "flyway_performance_schema_history", 0, 1, 63,
    ),
    "MIG-PAY-PAYROLL-1-49": (
        "HRIS-PAY", "dwp-payroll-server",
        "dwp-payroll-server/src/main/resources/db/migration",
        "public", "flyway_schema_history", 0, 1, 49,
    ),
    "MIG-TIM-TIME-1-39": (
        "HRIS-TIM", "dwp-time-server",
        "dwp-time-server/src/main/resources/db/migration",
        "public", "flyway_schema_history", 0, 1, 39,
    ),
    "MIG-SYS-AUTH-217-245": (
        "HRIS-SYS", "dwp-auth-server",
        "dwp-auth-server/src/main/resources/db/migration",
        "public", "flyway_schema_history", 216, 217, 245,
    ),
    "MIG-SYS-PLATFORM-261-289": (
        "HRIS-SYS", "dwp-platform-server",
        "dwp-platform-server/src/main/resources/db/migration",
        "public", "flyway_schema_history", 260, 261, 289,
    ),
}

EXPECTED_STREAMS = {
    "people-main": ("dwp-people-server", "dwp-people-server/src/main/resources/db/migration", 50),
    "performance-private": ("dwp-people-server", "dwp-people-server/src/main/resources/db/performance-migration", 0),
    "payroll-main": ("dwp-payroll-server", "dwp-payroll-server/src/main/resources/db/migration", 0),
    "time-main": ("dwp-time-server", "dwp-time-server/src/main/resources/db/migration", 0),
    "auth-main": ("dwp-auth-server", "dwp-auth-server/src/main/resources/db/migration", 216),
    "platform-main": ("dwp-platform-server", "dwp-platform-server/src/main/resources/db/migration", 260),
    "approval-main": ("dwp-approval-server", "dwp-approval-server/src/main/resources/db/migration", 35),
    "notification-main": ("dwp-notification-server", "dwp-notification-server/src/main/resources/db/migration", 30),
}

EXPECTED_PEOPLE_FOUNDATION = {
    47: ("dwp-people-server/src/main/resources/db/migration/V47__enforce_append_only_people_audit_evidence.sql", "9ba4abb575b3b6932ff495a580af99416dd396d6", "828e7dfadf6d69791d5350bde8541b2ebe7ab0225630f50bdcb30a729a9c6e9e", 2026),
    48: ("dwp-people-server/src/main/resources/db/migration/V48__bind_uuid_defaults_to_pg_catalog.sql", "5081696b8e830ddf1d19242f983ee5080527f3b1", "1b101a46df4e26fbf43d008c57d4c81a9d79693d81baf37ca5fdd97d9d56b9d2", 4457),
    49: ("dwp-people-server/src/main/resources/db/migration/V49__add_native_legal_employer_public_id.sql", "b0f3c912a0e0901a69223c2542768e6d846db828", "9fe9f4b2f540b94a38525544e40989452410a860dca3fdc521a0ee07c542ada3", 918),
    50: ("dwp-people-server/src/main/resources/db/migration/V50__align_workforce_policy_role_code_compatibility.sql", "aa8292494ecfce3f6638e640e45145e4c862e119", "6ac12cc8dc366c022e29f57d940923dda11da4909338b6afc200e093f9e00e89", 1004),
}

EXPECTED_LINEAGE = {
    "dwp-auth-server/src/main/resources/db/migration/V211__harden_auth_trigger_execution_boundary.sql": ("dwp-auth-server/src/main/resources/db/migration/V215__harden_auth_trigger_execution_boundary.sql", "12b92335e7a158f7682edc00542c244e6b289737", "22e0f38ab7f15efed15808df97da0582774634c58e6ddb8c50d52149e526e77d", 4681),
    "dwp-auth-server/src/main/resources/db/migration/V212__bind_uuid_defaults_to_pg_catalog.sql": ("dwp-auth-server/src/main/resources/db/migration/V216__bind_uuid_defaults_to_pg_catalog.sql", "5081696b8e830ddf1d19242f983ee5080527f3b1", "1b101a46df4e26fbf43d008c57d4c81a9d79693d81baf37ca5fdd97d9d56b9d2", 4457),
    "dwp-platform-server/src/main/resources/db/migration/V231__harden_partition_maintenance_authority.sql": ("dwp-platform-server/src/main/resources/db/migration/V254__harden_partition_maintenance_authority.sql", "8fddc87d1a9557020c7970305e4172efff77ee69", "b3b4e87d8d4cd5b61214d15446dcc06a2b293849f178057be6dfd756b2037ff2", 6360),
    "dwp-platform-server/src/main/resources/db/migration/V232__harden_platform_trigger_execution_boundary.sql": ("dwp-platform-server/src/main/resources/db/migration/V255__harden_platform_trigger_execution_boundary.sql", "c5343ff3b1ea3c57c4fc9c1ef5afd05858c4ced9", "183f48e714b932ad50339d8d9c16070c6cc299237eebaa490d076d99e3c68bc4", 4068),
    "dwp-platform-server/src/main/resources/db/migration/V233__govern_audit_retention_execution.sql": ("dwp-platform-server/src/main/resources/db/migration/V256__govern_audit_retention_execution.sql", "f228b8b44a57bdc5f67ff36412f4f582064bb69c", "bdbb4f8b10ef3d732c539f955dbf8a4778c85fb003ae606cea4290b5a4f0732d", 8007),
    "dwp-platform-server/src/main/resources/db/migration/V234__add_api_history_default_partition.sql": ("dwp-platform-server/src/main/resources/db/migration/V257__add_api_history_default_partition.sql", "0d9084b236572b4c50beca75243bb7fcab008a84", "254066e1b99f1fbcdd3f26df798ac288a5a418025caec8eaf17401e726b2fdd7", 1061),
    "dwp-platform-server/src/main/resources/db/migration/V235__enforce_append_only_api_history.sql": ("dwp-platform-server/src/main/resources/db/migration/V258__enforce_append_only_api_history.sql", "ae5e4fa12c28abbd1edb1c8af6060db60527d6b8", "11bfb8c6fc89022bf4ce617d2a3b5eb7eb057008a64564aaec755194db7135e6", 850),
    "dwp-platform-server/src/main/resources/db/migration/V236__enforce_append_only_platform_audit_evidence.sql": ("dwp-platform-server/src/main/resources/db/migration/V259__enforce_append_only_platform_audit_evidence.sql", "82aaf71e679b8088c0be4e48e8e49aba12891d48", "4036b0449ad73138ef1895afb6e6324991d4656fcb5c8fb8d377c7ef039bb6e3", 1339),
    "dwp-platform-server/src/main/resources/db/migration/V237__bind_uuid_defaults_to_pg_catalog.sql": ("dwp-platform-server/src/main/resources/db/migration/V260__bind_uuid_defaults_to_pg_catalog.sql", "5081696b8e830ddf1d19242f983ee5080527f3b1", "1b101a46df4e26fbf43d008c57d4c81a9d79693d81baf37ca5fdd97d9d56b9d2", 4457),
    "dwp-approval-server/src/main/resources/db/migration/V15__harden_approval_trigger_execution_boundary.sql": ("dwp-approval-server/src/main/resources/db/migration/V34__harden_approval_trigger_execution_boundary.sql", "003ae341c98d06307c975aaf1458f81d49c59401", "2dcb6710a1d89c09824336bcaf5716f4f4a980b9670d252bd73be426cc4e1490", 1670),
    "dwp-approval-server/src/main/resources/db/migration/V16__protect_step_up_replay_and_idempotency_evidence.sql": ("dwp-approval-server/src/main/resources/db/migration/V35__protect_step_up_replay_and_idempotency_evidence.sql", "eb7a41e44ac22c84b82b0f0f7116a63a7ccee195", "195c02bf0636a4041667f2905c8545b0fde96c4f9bd13654290816752b0750e5", 6208),
}

CURRENT_AUTHORITY_FILES = (
    G0 / "migration-allocation-register.csv",
    G0 / "migration-stream-register.csv",
    G0 / "g3-verification-command-catalog.v1.json",
    ROOT / "coding-readiness/generate_g3_slice_code_go_register.py",
    ROOT / "coding-readiness/validate_g3_slice_code_go.py",
    ROOT / "coding-readiness/validate_full_coding_readiness.py",
    ROOT / "coding-readiness/g3-slice-code-go-register.csv",
)
STALE_IDS = (
    "MIG-HRM-PEOPLE-47-69",
    "MIG-SYS-AUTH-211-239",
    "MIG-SYS-PLATFORM-231-259",
    "MIG-SYS-PLATFORM-261-289",
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def git(repo: Path, *args: str, binary: bool = False) -> str | bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", "replace").strip())
    return result.stdout if binary else result.stdout.decode("utf-8").strip()


def canonical_row_sha256(row: dict[str, str]) -> str:
    data = (
        json.dumps(row, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def migration_inventory(repo: Path, commit: str) -> dict[str, Any]:
    subtree_oids: dict[str, str] = {}
    manifest_lines: list[str] = []
    for migration_dir in sorted(G2_SOURCE["migrationSubtreeOids"]):
        subtree_oids[migration_dir] = str(
            git(repo, "rev-parse", f"{commit}:{migration_dir}")
        )
        listing = str(git(repo, "ls-tree", "-r", commit, "--", migration_dir))
        for line in listing.splitlines():
            metadata, path = line.split("\t", 1)
            _mode, _kind, blob_oid = metadata.split()
            if VERSION_RE.fullmatch(Path(path).name):
                manifest_lines.append(f"{path}\t{blob_oid}")
    manifest = ("\n".join(sorted(manifest_lines)) + "\n").encode("utf-8")
    return {
        "migrationSqlCount": len(manifest_lines),
        "migrationManifestSha256": hashlib.sha256(manifest).hexdigest(),
        "migrationSubtreeOids": subtree_oids,
    }


def load_pre_g3_context() -> dict[str, Any]:
    allocation, allocation_bytes = load_pre_g3(PRE_G3_ALLOCATION_PATH)
    review, review_bytes = load_pre_g3(PRE_G3_REVIEW_PATH)
    evidence, junit, observations = load_preserved_evidence()
    errors = validate_pre_g3_allocation(allocation, check_repository=True)
    errors.extend(
        validate_pre_g3_review(
            review,
            allocation,
            allocation_bytes,
            evidence_docs=evidence,
            junit_docs=junit,
            observation_docs=observations,
            check_repository=True,
        )
    )
    if errors:
        raise ValueError("pre-G3 receipt closure failed: " + ";".join(errors))

    checkpoint_rows = [
        row for row in read_csv(G0 / "checkpoint-register.csv")
        if row.get("checkpoint_id") == "G2-READY-SYS"
    ]
    if len(checkpoint_rows) != 1:
        raise ValueError("immutable G2 SYS checkpoint row is not exact")
    checkpoint = checkpoint_rows[0]
    checkpoint_sha = canonical_row_sha256(checkpoint)
    if (
        checkpoint_sha != G2_SYS_CHECKPOINT_ROW_SHA256
        or checkpoint.get("backend_head_sha") != G2_SOURCE["commit"]
        or checkpoint.get("migration_ids")
        != "MIG-SYS-AUTH-217-245|MIG-SYS-PLATFORM-261-289"
    ):
        raise ValueError("immutable G2 SYS checkpoint row drift")

    source = allocation.get("source", {})
    final_commit = str(source.get("finalCommit", ""))
    final_tree = str(source.get("finalTree", ""))
    repo = Path(G2_SOURCE["repository"])
    if (
        source.get("baselineCommit") != G2_SOURCE["commit"]
        or str(git(repo, "rev-parse", f"{final_commit}^{{tree}}")) != final_tree
    ):
        raise ValueError("pre-G3 source lineage drift")
    inventory = migration_inventory(repo, final_commit)
    expected_source = {
        "repository": G2_SOURCE["repository"],
        "commit": final_commit,
        "tree": final_tree,
        "predecessorCommit": G2_SOURCE["predecessorCommit"],
        "g2BaselineCommit": G2_SOURCE["commit"],
        **inventory,
        "requiredWorktreeState": "CLEAN",
    }
    allocation_ref = {
        "path": str(PRE_G3_ALLOCATION_PATH.relative_to(ROOT)),
        "sha256": pre_g3_digest(allocation_bytes),
        "byteLength": len(allocation_bytes),
        "sealedPayloadSha256": allocation.get("sealedPayloadSha256"),
    }
    review_ref = {
        "path": str(PRE_G3_REVIEW_PATH.relative_to(ROOT)),
        "sha256": pre_g3_digest(review_bytes),
        "byteLength": len(review_bytes),
        "sealedPayloadSha256": review.get("sealedPayloadSha256"),
    }
    lineage = {
        "contractId": PRE_G3_LINEAGE_ID,
        "direction": "PREDECESSOR_TO_SUCCESSOR_ONLY",
        "g2Baseline": {
            "commit": G2_SOURCE["commit"],
            "tree": G2_SOURCE["tree"],
            "approvalHighWater": 35,
            "platformHighWater": 260,
            "sysPlatformAllocation": G2_SYS_PLATFORM_ALLOCATION,
            "checkpointRef": {
                "path": "g0/checkpoint-register.csv",
                "checkpointId": "G2-READY-SYS",
                "canonicalRowSha256": checkpoint_sha,
            },
        },
        "foundation": {
            "allocationRef": allocation_ref,
            "technicalReviewRef": review_ref,
            "finalCommit": final_commit,
            "finalTree": final_tree,
            "exactMigrationFileCount": 5,
            "approvalHighWater": 38,
            "platformHighWater": 261,
        },
        "currentSysPlatformAllocation": CURRENT_SYS_PLATFORM_ALLOCATION,
        "preservedSlotCount": 29,
        "changeReason": (
            "PRE_G3_V261_COMMON_FOUNDATION_CONSUMED_PREVIOUS_FIRST_SYS_SLOT_"
            "AND_SHIFTED_THE_UNIMPLEMENTED_29_SLOT_RESERVATION"
        ),
        "authorityEffect": "G3_ENTRY_RANGE_REBASE_ONLY_NOT_IMPLEMENTATION",
        "productionAuthorization": "NOT_AUTHORIZED_G6",
        "externalIdentityAttestation": "NO_EXTERNAL_IDENTITY_ATTESTATION",
        "g6Boundary": "G6_APPROVAL_NOT_SATISFIED",
    }
    return {
        "allocation": allocation,
        "review": review,
        "source": expected_source,
        "lineage": lineage,
    }


def semantic_seal(payload: dict[str, Any]) -> str:
    unsigned = {key: value for key, value in payload.items() if key != "sealedPayloadSha256"}
    canonical = (
        json.dumps(unsigned, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def render_expected_payload(context: dict[str, Any]) -> dict[str, Any]:
    allocations = []
    for allocation_id, values in EXPECTED_ALLOCATIONS.items():
        session, service, migration_dir, schema, history, baseline, start, end = values
        allocations.append({
            "allocationId": allocation_id,
            "sessionId": session,
            "service": service,
            "migrationDir": migration_dir,
            "schema": schema,
            "historyTable": history,
            "baselineHighWater": baseline,
            "start": start,
            "end": end,
        })
    streams = []
    for stream_key, values in EXPECTED_STREAMS.items():
        service, migration_dir, high_water = values
        streams.append({
            "streamKey": stream_key,
            "service": service,
            "migrationDir": migration_dir,
            "highWater": high_water,
            "boundary": EXPECTED_STREAM_BOUNDARIES[stream_key],
        })
    people = [
        {
            "version": version,
            "path": values[0],
            "blobOid": values[1],
            "sha256": values[2],
            "byteLength": values[3],
        }
        for version, values in EXPECTED_PEOPLE_FOUNDATION.items()
    ]
    rename_lineage = []
    for predecessor_path, values in EXPECTED_LINEAGE.items():
        successor_path, blob_oid, sha256, byte_length = values
        if predecessor_path.startswith("dwp-auth-server/"):
            stream = "AUTH"
        elif predecessor_path.startswith("dwp-platform-server/"):
            stream = "PLATFORM"
        elif predecessor_path.startswith("dwp-approval-server/"):
            stream = "APPROVAL"
        else:
            raise ValueError(f"unclassified rename lineage: {predecessor_path}")
        rename_lineage.append({
            "stream": stream,
            "predecessorPath": predecessor_path,
            "successorPath": successor_path,
            "blobOid": blob_oid,
            "sha256": sha256,
            "byteLength": byte_length,
        })
    payload = {
        "schemaVersion": 1,
        "contractId": "HRIS_MIGRATION_SUCCESSOR_C1_V1",
        "status": "CANONICAL_START_BOUNDARY_SEALED",
        "effectiveGate": "CLOSED_FAIL_SAFE",
        "moduleStartAuthorization": "NONE",
        "source": context["source"],
        "rules": EXPECTED_RULES,
        "allocations": allocations,
        "baselineStreams": streams,
        "preG3FoundationLineage": context["lineage"],
        "peopleCommonFoundation": people,
        "exactRenameLineage": rename_lineage,
        "historicalArtifacts": EXPECTED_HISTORICAL_ARTIFACTS,
    }
    payload["sealedPayloadSha256"] = semantic_seal(payload)
    return payload


def validate_payload(
    payload: dict[str, Any], expected_payload: dict[str, Any]
) -> list[str]:
    errors: list[str] = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    require(payload.get("schemaVersion") == 1, "schema version drift")
    require(payload.get("contractId") == "HRIS_MIGRATION_SUCCESSOR_C1_V1", "contract id drift")
    require(payload.get("status") == "CANONICAL_START_BOUNDARY_SEALED", "canonical status drift")
    require(payload.get("effectiveGate") == "CLOSED_FAIL_SAFE", "gate must remain closed")
    require(payload.get("moduleStartAuthorization") == "NONE", "module start must remain unauthorized")
    require(set(payload) == set(expected_payload), "root closed schema drift")
    require(payload.get("rules") == EXPECTED_RULES, "migration successor rules drift")
    require(
        payload.get("sealedPayloadSha256") == semantic_seal(payload),
        "migration successor semantic seal drift",
    )
    source = payload.get("source", {})
    require(
        isinstance(source, dict)
        and source == expected_payload.get("source"),
        "source commit/tree/predecessor pin drift",
    )

    allocations = payload.get("allocations", [])
    require(isinstance(allocations, list), "allocations must be a list")
    observed: dict[str, tuple[Any, ...]] = {}
    ranges: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    if isinstance(allocations, list):
        for row in allocations:
            if not isinstance(row, dict):
                errors.append("allocation row is not an object")
                continue
            allocation_id = row.get("allocationId", "")
            require(allocation_id not in observed, f"duplicate allocation id: {allocation_id}")
            values = (
                row.get("sessionId"), row.get("service"), row.get("migrationDir"),
                row.get("schema"), row.get("historyTable"), row.get("baselineHighWater"),
                row.get("start"), row.get("end"),
            )
            observed[str(allocation_id)] = values
            if all(isinstance(row.get(key), int) for key in ("baselineHighWater", "start", "end")):
                baseline = int(row["baselineHighWater"])
                start = int(row["start"])
                end = int(row["end"])
                require(start == baseline + 1, f"{allocation_id}: stale high-water/start gap")
                require(start <= end, f"{allocation_id}: invalid range")
                ranges[str(row.get("migrationDir", ""))].append((start, end, str(allocation_id)))
                require(str(allocation_id).endswith(f"-{start}-{end}"), f"{allocation_id}: id/range mismatch")
            else:
                errors.append(f"{allocation_id}: non-integer range")
    require(observed == EXPECTED_ALLOCATIONS, "allocation set or exact values drift")
    for migration_dir, stream_ranges in ranges.items():
        ordered = sorted(stream_ranges)
        for left, right in zip(ordered, ordered[1:]):
            require(left[1] < right[0], f"{migration_dir}: overlapping ranges {left[2]} and {right[2]}")

    streams = payload.get("baselineStreams", [])
    observed_streams: dict[str, tuple[Any, ...]] = {}
    if isinstance(streams, list):
        for row in streams:
            if not isinstance(row, dict):
                errors.append("baseline stream row is not an object")
                continue
            key = str(row.get("streamKey", ""))
            require(key not in observed_streams, f"duplicate stream key: {key}")
            observed_streams[key] = (row.get("service"), row.get("migrationDir"), row.get("highWater"))
    require(observed_streams == EXPECTED_STREAMS, "baseline stream set/high-water drift")
    require(
        streams == expected_payload.get("baselineStreams"),
        "baseline stream boundary/order drift",
    )
    require(
        payload.get("preG3FoundationLineage")
        == expected_payload.get("preG3FoundationLineage"),
        "pre-G3 foundation successor lineage drift",
    )

    foundation = payload.get("peopleCommonFoundation", [])
    observed_foundation: dict[int, tuple[Any, ...]] = {}
    if isinstance(foundation, list):
        for row in foundation:
            if isinstance(row, dict) and isinstance(row.get("version"), int):
                version = int(row["version"])
                require(version not in observed_foundation, f"duplicate People foundation V{version}")
                observed_foundation[version] = (
                    row.get("path"), row.get("blobOid"), row.get("sha256"), row.get("byteLength")
                )
    require(observed_foundation == EXPECTED_PEOPLE_FOUNDATION, "People V47..V50 foundation lineage drift")

    lineage = payload.get("exactRenameLineage", [])
    observed_lineage: dict[str, tuple[Any, ...]] = {}
    if isinstance(lineage, list):
        for row in lineage:
            if not isinstance(row, dict):
                errors.append("lineage row is not an object")
                continue
            old_path = str(row.get("predecessorPath", ""))
            require(old_path not in observed_lineage, f"duplicate predecessor lineage: {old_path}")
            observed_lineage[old_path] = (
                row.get("successorPath"), row.get("blobOid"), row.get("sha256"), row.get("byteLength")
            )
            require(bool(SHA40_RE.fullmatch(str(row.get("blobOid", "")))), f"{old_path}: invalid blob OID")
            require(bool(SHA256_RE.fullmatch(str(row.get("sha256", "")))), f"{old_path}: invalid SHA-256")
    require(observed_lineage == EXPECTED_LINEAGE, "exact-byte rename lineage drift")

    historical = payload.get("historicalArtifacts", {})
    require(
        historical == EXPECTED_HISTORICAL_ARTIFACTS,
        "historical successor boundary drift",
    )
    require(payload == expected_payload, "deterministic migration successor projection drift")
    return errors

EXPECTED_RULES = {
    "versionedFilePattern": r"^V([0-9]+(?:[._][0-9]+)*)__.+\.sql$",
    "createOnly": True,
    "existingEditAllowed": False,
    "outOfOrderAllowed": False,
    "crossStreamForeignKeyAllowed": False,
    "privateStreamsPublishPublicVersions": False,
    "historicalG2ArtifactsMutable": False,
    "lineageEquality": "GIT_BLOB_OID_AND_SHA256_AND_BYTE_LENGTH",
    "preG3FoundationLineageDirection": "PREDECESSOR_TO_SUCCESSOR_ONLY",
}

EXPECTED_STREAM_BOUNDARIES = {
    "people-main": "COMMON_FOUNDATION_THEN_HRM",
    "performance-private": "PRIVATE_STREAM",
    "payroll-main": "NEW_SERVICE_STREAM",
    "time-main": "NEW_SERVICE_STREAM",
    "auth-main": "COMMON_FOUNDATION_THEN_SYS",
    "platform-main": "PRE_G3_COMMON_FOUNDATION_THEN_SYS",
    "approval-main": (
        "PRE_G3_COMMON_SECURITY_FOUNDATION_THEN_CONTROLLED_SHARED_ON_DEMAND"
    ),
    "notification-main": "PROTECTED_EXTERNAL_BASELINE",
}
G2_SYS_CHECKPOINT_ROW_SHA256 = (
    "a70ce64e08cc59ca55da9ea2b11aa623bab43e777200503ce7e2cabb0ee6d08d"
)

EXPECTED_HISTORICAL_ARTIFACTS = {
    "immutablePredecessorProposal": (
        "coding-readiness/semantic-remediation/"
        "common-migration-baseline.proposal.v1.json"
    ),
    "immutableAllocationProposal": (
        "coding-readiness/semantic-remediation/"
        "common-allocation-successor.v1.json"
    ),
    "successorizedCheckpointSummary": "g0/checkpoint-register.csv",
    "successorPolicy": (
        "REFER_AS_HISTORY_ONLY_NEVER_AUTHORIZE_FROM_PREDECESSOR_IDS"
    ),
}

PRE_G3_LINEAGE_ID = "dwp.hris.migration-successor.pre-g3-foundation-lineage.v1"
G2_SYS_PLATFORM_ALLOCATION = {
    "allocationId": "MIG-SYS-PLATFORM-261-289",
    "baselineHighWater": 260,
    "start": 261,
    "end": 289,
    "slotCount": 29,
    "state": "SUPERSEDED_IMMUTABLE_G2_CHECKPOINT_ONLY",
}
CURRENT_SYS_PLATFORM_ALLOCATION = {
    "allocationId": "MIG-SYS-PLATFORM-262-290",
    "baselineHighWater": 261,
    "start": 262,
    "end": 290,
    "slotCount": 29,
    "state": "RESERVED_G3_RANGE_NOT_IMPLEMENTED",
}


def validate_notification_exact_control_authority(
    allocation_rows: list[dict[str, str]],
    ownership_rows: list[dict[str, str]],
) -> list[str]:
    """Reject policy-only or ambiguous Notification migration authority.

    A ``MIGPOL-*`` row records a stream high-water only; it never grants a
    migration filename.  V32 therefore requires one exact Control allocation,
    V31 must remain an absent externally owned hole, and the path owner must
    independently require exact allocation.
    """

    errors: list[str] = []
    notification_v32_rows = [
        row for row in allocation_rows
        if row.get("allocation_id") == "MIG-CONTROL-NOTIFICATION-V32"
    ]
    expected_notification_v32 = {
        "policy_id": "ALLOC-CONTROL-NOTIFICATION-V32",
        "service": "dwp-notification-server",
        "repository": "DWP_BACKEND",
        "migration_dir": (
            "dwp-notification-server/src/main/resources/db/migration"
        ),
        "baseline_commit": G2_SOURCE["commit"],
        "baseline_high_water": "30",
        "allocated_version": "32",
        "exact_filename": (
            "V32__close_approval_sla_delivery_trigger_execution_boundary.sql"
        ),
        "session_id": "CONTROL",
        "vertical_slice": (
            "PRE_G3_COMMON_SECURITY_FOUNDATION_V32_EXACT_"
            "V31_PROTECTED_ABSENT"
        ),
        "create_only": "YES",
        "existing_edit_allowed": "NO",
        "forward_correction_required": "YES",
        "state": "EXACT_PRE_G3_COMMON_FOUNDATION_ALLOCATION",
        "code_gate": "PRE_G3_TECHNICAL_RECEIPT_REQUIRED_NO_G3_NO_G6",
    }
    if (
        len(notification_v32_rows) != 1
        or any(
            notification_v32_rows[0].get(key) != value
            for key, value in expected_notification_v32.items()
        )
    ):
        errors.append("Notification V32 exact Control allocation drift")
    if any(
        row.get("service") == "dwp-notification-server"
        and (
            row.get("allocated_version") == "31"
            or str(row.get("exact_filename", "")).startswith("V31__")
        )
        for row in allocation_rows
    ):
        errors.append("Notification V31 protected absence drift")

    notification_owners = [
        row for row in ownership_rows
        if row.get("ownership_id") == "OWN-BE-MIG-NOTIFICATION"
    ]
    if (
        len(notification_owners) != 1
        or notification_owners[0].get("session_id") != "CONTROL"
        or notification_owners[0].get("path_class")
        != "MIGRATION_EXACT_ALLOCATION_ONLY"
        or notification_owners[0].get("allocation_required") != "YES"
        or notification_owners[0].get("status")
        != "CONTROLLED_PRE_G3_V32_EXACT_V31_AND_FUTURE_PROTECTED"
    ):
        errors.append("Notification exact Control ownership drift")
    return errors


def validate_csv_authorities(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    rows = read_csv(ALLOCATION_REGISTER)
    allocations = {row["allocation_id"]: row for row in rows if row.get("state") == "RESERVED_G3_RANGE"}
    combined_expected = {**EXPECTED_ALLOCATIONS, **LISTENING_EXPECTED_ALLOCATIONS}
    if set(allocations) != set(combined_expected):
        errors.append("migration-allocation-register active allocation set drift")
    for allocation_id, expected in combined_expected.items():
        row = allocations.get(allocation_id, {})
        session, service, path, _schema, _history, baseline, start, end = expected
        baseline_value = "NEW_SERVICE_V0" if baseline == 0 and service in {"dwp-payroll-server", "dwp-time-server"} else str(baseline)
        checks = {
            "service": service,
            "repository": "DWP_BACKEND",
            "migration_dir": path,
            "baseline_commit": G2_SOURCE["commit"],
            "baseline_high_water": baseline_value,
            "allocated_version": f"{start}-{end}",
            "session_id": session,
            "create_only": "YES",
            "existing_edit_allowed": "NO",
            "forward_correction_required": "YES",
            "code_gate": "VALIDATOR_CONTROLLED",
        }
        if not all(row.get(key) == value for key, value in checks.items()):
            errors.append(f"{allocation_id}: migration-allocation-register exact values drift")
        if allocation_id in LISTENING_EXPECTED_ALLOCATIONS and (
            "dwp.hris.sys.listening.stream-authority-successor.v1"
            not in row.get("vertical_slice", "")
        ):
            errors.append(f"{allocation_id}: listening successor precedence missing")
    policy_highwaters = {
        "dwp-people-server": "50", "dwp-auth-server": "216",
        "dwp-platform-server": "261", "dwp-approval-server": "38",
        "dwp-notification-server": "30", "dwp-meeting-server": "41",
        "dwp-payroll-server": "NEW_SERVICE_V0", "dwp-time-server": "NEW_SERVICE_V0",
    }
    policies = {row["service"]: row for row in rows if row.get("policy_id", "").startswith("MIGPOL-")}
    if set(policies) != set(policy_highwaters):
        errors.append("migration policy service set drift")
    for service, highwater in policy_highwaters.items():
        row = policies.get(service, {})
        if row.get("baseline_commit") != G2_SOURCE["commit"] or row.get("baseline_high_water") != highwater:
            errors.append(f"{service}: policy checkpoint/high-water drift")
    if not all((
        policies.get("dwp-platform-server", {}).get("vertical_slice")
        == "PRE_G3_COMMON_FOUNDATION_V254_1_V261_THEN_SYS",
        policies.get("dwp-platform-server", {}).get("state")
        == "RANGE_POLICY_ACTIVE",
        policies.get("dwp-approval-server", {}).get("vertical_slice")
        == "PRE_G3_COMMON_SECURITY_FOUNDATION_V36_V38_THEN_SHARED_ON_DEMAND",
        policies.get("dwp-approval-server", {}).get("state")
        == "CONTROLLED_SHARED_ON_DEMAND",
        policies.get("dwp-approval-server", {}).get("code_gate")
        == "INTEGRATION_CONTROL_ALLOCATION_REQUIRED",
    )):
        errors.append("pre-G3 Platform/Approval current policy lineage drift")

    notification_v32_rows = [
        row for row in rows
        if row.get("allocation_id") == "MIG-CONTROL-NOTIFICATION-V32"
    ]
    expected_notification_v32 = {
        "policy_id": "ALLOC-CONTROL-NOTIFICATION-V32",
        "service": "dwp-notification-server",
        "repository": "DWP_BACKEND",
        "migration_dir": (
            "dwp-notification-server/src/main/resources/db/migration"
        ),
        "baseline_commit": G2_SOURCE["commit"],
        "baseline_high_water": "30",
        "allocated_version": "32",
        "exact_filename": (
            "V32__close_approval_sla_delivery_trigger_execution_boundary.sql"
        ),
        "session_id": "CONTROL",
        "vertical_slice": (
            "PRE_G3_COMMON_SECURITY_FOUNDATION_V32_EXACT_"
            "V31_PROTECTED_ABSENT"
        ),
        "create_only": "YES",
        "existing_edit_allowed": "NO",
        "forward_correction_required": "YES",
        "state": "EXACT_PRE_G3_COMMON_FOUNDATION_ALLOCATION",
        "code_gate": "PRE_G3_TECHNICAL_RECEIPT_REQUIRED_NO_G3_NO_G6",
    }
    if (
        len(notification_v32_rows) != 1
        or any(
            notification_v32_rows[0].get(key) != value
            for key, value in expected_notification_v32.items()
        )
    ):
        errors.append("Notification V32 exact Control allocation drift")
    if any(
        row.get("service") == "dwp-notification-server"
        and (
            row.get("allocated_version") == "31"
            or str(row.get("exact_filename", "")).startswith("V31__")
        )
        for row in rows
    ):
        errors.append("Notification V31 protected absence drift")

    notification_owners = [
        row for row in read_csv(OWNERSHIP_REGISTER)
        if row.get("ownership_id") == "OWN-BE-MIG-NOTIFICATION"
    ]
    if (
        len(notification_owners) != 1
        or notification_owners[0].get("session_id") != "CONTROL"
        or notification_owners[0].get("path_class")
        != "MIGRATION_EXACT_ALLOCATION_ONLY"
        or notification_owners[0].get("allocation_required") != "YES"
        or notification_owners[0].get("status")
        != "CONTROLLED_PRE_G3_V32_EXACT_V31_AND_FUTURE_PROTECTED"
    ):
        errors.append("Notification exact Control ownership drift")

    historical = [row for row in rows if row.get("code_gate") == "HISTORICAL_G2_ONLY"]
    if len(historical) != 1 or historical[0].get("allocation_id") != "MIG-PER-PEOPLE-70-89":
        errors.append("historical G2 allocation boundary drift")
    if any(
        row.get("session_id") == "HRIS-PER"
        and row.get("migration_dir") == "dwp-people-server/src/main/resources/db/migration"
        and row.get("code_gate") != "HISTORICAL_G2_ONLY"
        for row in rows
    ):
        errors.append("PER private migration leaked into People public stream")

    stream_rows = read_csv(STREAM_REGISTER)
    stream_allocations = {row.get("migration_allocation_id") for row in stream_rows}
    if stream_allocations != set(combined_expected) or len(stream_rows) != len(combined_expected):
        errors.append("migration-stream-register allocation set drift")
    for row in stream_rows:
        allocation_id = row.get("migration_allocation_id", "")
        expected = combined_expected.get(allocation_id)
        if expected is None:
            continue
        session, service, path, schema, history, baseline, _start, _end = expected
        expected_highwater = str(baseline)
        if not all((
            row.get("session_id") == session,
            row.get("service") == service,
            row.get("migration_location") == path,
            row.get("database_schema") == schema,
            row.get("history_table") == history,
            row.get("baseline_high_water") == expected_highwater,
            row.get("cross_stream_fk_allowed") == "NO",
            row.get("out_of_order_allowed") == "NO",
        )):
            errors.append(f"{row.get('stream_id')}: stream configuration drift")
        if allocation_id in LISTENING_EXPECTED_ALLOCATIONS and not (
            row.get("bootstrap_allocation_id", "").startswith("G3-CTL-SYS-LISTEN-")
            and row.get("bootstrap_checkpoint_kind") == "CENTRAL_MATERIALIZATION"
            and row.get("state")
            == "CONTROL_BOOTSTRAP_REQUIRED_BEFORE_LISTENING_MIGRATION_TOUCH"
        ):
            errors.append(f"{row.get('stream_id')}: listening Control bootstrap boundary drift")

    try:
        listening = json.loads(LISTENING_SUCCESSOR.read_text(encoding="utf-8"))
        overlay_allocations = {
            row.get("allocationId")
            for row in listening.get("migrationReservations", [])
        }
        if (
            listening.get("contractId")
            != "dwp.hris.sys.listening.stream-authority-successor.v1"
            or listening.get("status")
            != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
            or overlay_allocations != set(LISTENING_EXPECTED_ALLOCATIONS)
        ):
            errors.append("SYS listening migration successor authority drift")
    except (OSError, json.JSONDecodeError, TypeError):
        errors.append("SYS listening migration successor authority unreadable")

    for path in CURRENT_AUTHORITY_FILES:
        text = path.read_text(encoding="utf-8")
        for stale_id in STALE_IDS:
            if stale_id in text:
                errors.append(f"{path.relative_to(ROOT)} still authorizes stale id {stale_id}")
    return errors


def versions_at(repo: Path, commit: str, migration_dir: str) -> tuple[list[tuple[int, ...]], list[str]]:
    listing = str(git(repo, "ls-tree", "-r", "--name-only", commit, "--", migration_dir))
    paths = [line for line in listing.splitlines() if line]
    versions: list[tuple[int, ...]] = []
    for path in paths:
        match = VERSION_RE.fullmatch(Path(path).name)
        if match:
            versions.append(tuple(int(part) for part in re.split(r"[._]", match.group(1))))
    return versions, paths


def validate_git(payload: dict[str, Any], check_live: bool) -> list[str]:
    errors: list[str] = []
    source = payload["source"]
    repo = Path(source["repository"])
    commit = source["commit"]
    predecessor = source["predecessorCommit"]
    if not repo.is_dir():
        return ["backend repository missing"]
    try:
        if git(repo, "rev-parse", f"{commit}^{{tree}}") != source["tree"]:
            errors.append("pinned backend tree drift")
        if source.get("g2BaselineCommit") != G2_SOURCE["commit"]:
            errors.append("immutable G2 baseline commit pointer drift")
        if git(repo, "rev-parse", f"{G2_SOURCE['commit']}^{{tree}}") != G2_SOURCE["tree"]:
            errors.append("immutable G2 baseline tree drift")
        g2_inventory = migration_inventory(repo, G2_SOURCE["commit"])
        if any(
            g2_inventory.get(key) != G2_SOURCE.get(key)
            for key in (
                "migrationSqlCount", "migrationManifestSha256",
                "migrationSubtreeOids",
            )
        ):
            errors.append("immutable G2 migration inventory drift")
        if subprocess.run(
            ["git", "-C", str(repo), "merge-base", "--is-ancestor", G2_SOURCE["commit"], commit],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        ).returncode:
            errors.append("final migration successor does not descend from G2 baseline")
        if check_live:
            if git(repo, "rev-parse", "HEAD") != commit:
                errors.append("live backend HEAD differs from C1 pin")
            if git(repo, "status", "--porcelain=v1"):
                errors.append("live backend worktree is not clean")

        manifest_lines: list[str] = []
        subtree_oids = source.get("migrationSubtreeOids", {})
        if not isinstance(subtree_oids, dict):
            errors.append("migration subtree OID map is not an object")
            subtree_oids = {}
        for migration_dir, expected_oid in sorted(subtree_oids.items()):
            actual_oid = str(git(repo, "rev-parse", f"{commit}:{migration_dir}"))
            if actual_oid != expected_oid:
                errors.append(f"{migration_dir}: migration subtree OID drift")
            tree_listing = str(git(repo, "ls-tree", "-r", commit, "--", migration_dir))
            for line in tree_listing.splitlines():
                metadata, path = line.split("\t", 1)
                _mode, _kind, blob_oid = metadata.split()
                if VERSION_RE.fullmatch(Path(path).name):
                    manifest_lines.append(f"{path}\t{blob_oid}")
        manifest_bytes = ("\n".join(sorted(manifest_lines)) + "\n").encode("utf-8")
        if len(manifest_lines) != source.get("migrationSqlCount"):
            errors.append("pinned migration SQL count drift")
        if hashlib.sha256(manifest_bytes).hexdigest() != source.get("migrationManifestSha256"):
            errors.append("pinned migration path/blob manifest drift")

        for stream in payload["baselineStreams"]:
            versions, _paths = versions_at(repo, commit, stream["migrationDir"])
            highwater = max((version[0] for version in versions), default=0)
            if len(versions) != len(set(versions)):
                errors.append(f"{stream['streamKey']}: duplicate committed migration version")
            if highwater != stream["highWater"]:
                errors.append(f"{stream['streamKey']}: committed high-water {highwater} != {stream['highWater']}")

        for allocation in payload["allocations"]:
            versions, _paths = versions_at(repo, commit, allocation["migrationDir"])
            occupied = sorted(
                version for version in versions
                if allocation["start"] <= version[0] <= allocation["end"]
            )
            if occupied:
                errors.append(f"{allocation['allocationId']}: reserved range already occupied {occupied}")

        for row in payload["peopleCommonFoundation"]:
            blob = str(git(repo, "rev-parse", f"{commit}:{row['path']}"))
            content = bytes(git(repo, "show", f"{commit}:{row['path']}", binary=True))
            if blob != row["blobOid"] or hashlib.sha256(content).hexdigest() != row["sha256"] or len(content) != row["byteLength"]:
                errors.append(f"{row['path']}: People common-foundation blob drift")

        for row in payload["exactRenameLineage"]:
            old_path = row["predecessorPath"]
            new_path = row["successorPath"]
            old_blob = str(git(repo, "rev-parse", f"{predecessor}:{old_path}"))
            new_blob = str(git(repo, "rev-parse", f"{commit}:{new_path}"))
            new_content = bytes(git(repo, "show", f"{commit}:{new_path}", binary=True))
            if old_blob != new_blob or new_blob != row["blobOid"]:
                errors.append(f"{old_path} -> {new_path}: exact Git blob lineage mismatch")
            if hashlib.sha256(new_content).hexdigest() != row["sha256"] or len(new_content) != row["byteLength"]:
                errors.append(f"{old_path} -> {new_path}: exact byte digest/length mismatch")
            old_at_successor = subprocess.run(
                ["git", "-C", str(repo), "cat-file", "-e", f"{commit}:{old_path}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            ).returncode == 0
            new_at_predecessor = subprocess.run(
                ["git", "-C", str(repo), "cat-file", "-e", f"{predecessor}:{new_path}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            ).returncode == 0
            if old_at_successor or new_at_predecessor:
                errors.append(f"{old_path} -> {new_path}: rename presence boundary drift")
    except (OSError, RuntimeError) as error:
        errors.append(f"git inventory failure: {error}")
    return errors


def self_test(payload: dict[str, Any]) -> dict[str, list[str]]:
    cases: dict[str, list[str]] = {}

    def reject(name: str, mutate: Any) -> None:
        changed = copy.deepcopy(payload)
        mutate(changed)
        cases[name] = validate_payload(changed)

    reject("duplicate-allocation", lambda p: p["allocations"].append(copy.deepcopy(p["allocations"][0])))
    reject("overlap", lambda p: p["allocations"][1].update({
        "allocationId": "MIG-PER-PERFORMANCE-51-63",
        "migrationDir": p["allocations"][0]["migrationDir"],
        "baselineHighWater": 50,
        "start": 51,
    }))
    reject("stale-high-water", lambda p: p["allocations"][0].update({"baselineHighWater": 49}))
    reject("private-to-public-leakage", lambda p: p["allocations"][1].update({
        "migrationDir": "dwp-people-server/src/main/resources/db/migration",
        "schema": "public",
        "historyTable": "flyway_schema_history",
    }))
    reject("lineage-byte-mutation", lambda p: p["exactRenameLineage"][0].update({"sha256": "0" * 64}))
    reject("lineage-path-mutation", lambda p: p["exactRenameLineage"][0].update({"successorPath": "tampered.sql"}))
    reject("stale-source-pin", lambda p: p["source"].update({"commit": "0" * 40}))
    reject("gate-open-bypass", lambda p: p.update({"effectiveGate": "OPEN_G3_CODE"}))
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-live", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()

    payload = json.loads(REGISTER.read_text(encoding="utf-8"))
    errors = validate_payload(payload)
    errors.extend(validate_csv_authorities(payload))
    errors.extend(validate_git(payload, args.check_live))
    mutations: dict[str, list[str]] = {}
    if args.self_test:
        mutations = self_test(payload)
        for name, case_errors in mutations.items():
            if not case_errors:
                errors.append(f"self-test mutation accepted: {name}")

    result = {
        "schema": "dwp.hris.migration-successor-c1.validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "gate": "CLOSED_FAIL_SAFE",
        "moduleStartAuthorization": "NONE",
        "sourceCommit": payload.get("source", {}).get("commit"),
        "sourceTree": payload.get("source", {}).get("tree"),
        "allocationCount": len(payload.get("allocations", [])),
        "streamCount": len(payload.get("baselineStreams", [])),
        "exactRenameCount": len(payload.get("exactRenameLineage", [])),
        "peopleFoundationCount": len(payload.get("peopleCommonFoundation", [])),
        "selfTest": {
            "executed": args.self_test,
            "caseCount": len(mutations),
            "rejectedCount": sum(bool(case_errors) for case_errors in mutations.values()),
            "cases": {name: "REJECTED" if case_errors else "ACCEPTED_UNEXPECTED" for name, case_errors in mutations.items()},
        },
        "errors": errors,
    }
    text = json.dumps(result, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2)
    print(text)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
