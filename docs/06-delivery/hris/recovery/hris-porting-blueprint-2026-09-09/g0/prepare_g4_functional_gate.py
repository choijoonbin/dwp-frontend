#!/usr/bin/env python3
"""Typed Control builder for one module's immutable G4 evidence batch.

Module sessions supply only the exact backend/frontend checkpoint IDs and a
real operational runbook per active slice.  This builder derives every PASS
assertion from the Control-owned final-head receipts, constructs all typed
JSON and the aggregate, and publishes the complete set in one append-only G4
shard batch.  It accepts neither arbitrary JSON evidence nor free-form test
commands.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CODING = ROOT / "coding-readiness"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))
if str(CODING) not in sys.path:
    sys.path.insert(0, str(CODING))

from central_transaction_fence import assert_all_central_transactions_committed  # noqa: E402
from gate_authority import assert_authoritative_gate_open  # noqa: E402
from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)
from write_module_evidence_shard import append_new_bytes, read_stable_source  # noqa: E402
from validate_g4_functional_gate import (  # noqa: E402
    CHECKPOINTS,
    CHECKPOINT_HEADER,
    COMMAND_CATALOG,
    CONTROL_GATES,
    CONTROL_HEADER,
    SLICES,
    active_slices,
    checkpoint_evidence_valid,
    command_authority,
    csv_prefix_sha256,
    default_repositories,
    final_head_receipt_index,
    load_contract,
    read_csv,
    safe_file,
    sha256,
    validate_aggregate_data,
    validate_final_head_evidence,
)


SELECTION_HEADER = [
    "slice_id",
    "backend_checkpoint_id",
    "frontend_checkpoint_id",
    "runbook_source_path",
]
GATE_ID = re.compile(r"^G4-[A-Z0-9-]{6,120}$")


def json_bytes(payload: object) -> bytes:
    return (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def content_sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def module_relative(session: str, canonical_ref: str) -> str:
    slug = session.removeprefix("HRIS-").lower()
    prefix = f"../session-evidence/{slug}/g4/"
    if not canonical_ref.startswith(prefix):
        raise ValueError("slice G4 evidence reference is outside its module shard")
    relative = canonical_ref.removeprefix(prefix)
    if not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise ValueError("slice G4 evidence reference is not canonical")
    return relative


def load_selection(path: Path, module_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if path.is_symlink() or not path.is_file():
        raise ValueError("G4 selection must be a regular non-symlink CSV")
    raw = read_stable_source(path)
    with io.StringIO(raw.decode("utf-8-sig"), newline="") as handle:
        reader = csv.DictReader(handle)
        if list(reader.fieldnames or []) != SELECTION_HEADER:
            raise ValueError("G4 selection CSV header drift")
        rows = list(reader)
    expected = [row["slice_id"] for row in module_rows]
    observed = [row.get("slice_id", "") for row in rows]
    if observed != expected or len(observed) != len(set(observed)):
        raise ValueError("G4 selection is not the exact active slice sequence")
    for row in rows:
        if None in row or not all(row.get(field, "") for field in SELECTION_HEADER):
            raise ValueError(f"{row.get('slice_id', '')}: G4 selection contains a blank field")
    return rows


def final_head_bindings(
    contract: dict[str, Any], session: str, gate_id: str,
) -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    slug = session.removeprefix("HRIS-").lower()
    bindings: dict[str, dict[str, str]] = {}
    commits: dict[str, str] = {}
    for repository in contract["requiredRepositoriesPerSlice"]:
        relative = contract["finalHeadVerification"]["pathTemplates"][repository].format(
            module_slug=slug, gate_id=gate_id
        )
        path = safe_file(relative, ROOT)
        if path is None:
            raise ValueError(f"{repository}: Control final-head capture is absent")
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"{repository}: Control final-head capture unreadable") from error
        if not isinstance(payload, dict) or not (
            payload.get("gateId") == gate_id
            and payload.get("sessionId") == session
            and payload.get("repository") == repository
            and payload.get("overallStatus") == "PASS"
            and isinstance(payload.get("sourceCommit"), str)
        ):
            raise ValueError(f"{repository}: Control final-head capture identity drift")
        bindings[repository] = {
            "path": relative,
            "sha256": sha256(path),
            "status": "PASS",
        }
        commits[repository] = str(payload["sourceCommit"])
    return bindings, commits


def proof_rows(
    assertion: str,
    proof_policy: dict[str, Any],
    slice_receipts: dict[str, dict[str, dict[str, Any]]],
    bindings: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    policy = proof_policy["assertions"].get(assertion)
    if not isinstance(policy, dict):
        raise ValueError(f"no closed proof policy for assertion {assertion}")
    proofs: list[dict[str, str]] = []
    for repository in sorted(policy):
        repository_receipts = slice_receipts.get(repository, {})
        for suffix in policy[repository]:
            matches = [
                receipt
                for command_id, receipt in sorted(repository_receipts.items())
                if command_id.rsplit(":", 1)[-1].endswith(suffix)
            ]
            if not matches:
                raise ValueError(
                    f"{assertion}: final-head proof {repository}/{suffix} is absent"
                )
            for receipt in matches:
                proofs.append({
                    "repository": repository,
                    "commandId": str(receipt["commandId"]),
                    "commandSha256": str(receipt["commandSha256"]),
                    "outputSha256": str(receipt["outputSha256"]),
                    "reproducibleResultSha256": str(receipt["reproducibleResultSha256"]),
                    "finalHeadEvidenceRef": bindings[repository]["path"],
                    "finalHeadEvidenceSha256": bindings[repository]["sha256"],
                })
    return proofs


def typed_evidence(
    spec: dict[str, Any], session: str, slice_id: str,
    commits: dict[str, str], checkpoint_ids: list[str],
    proof_policy: dict[str, Any],
    slice_receipts: dict[str, dict[str, dict[str, Any]]],
    bindings: dict[str, dict[str, str]],
) -> dict[str, object]:
    assertions = [
        {
            "assertion": assertion,
            "result": "PASS",
            "proofKind": proof_policy["proofKind"],
            "commandReceipts": proof_rows(
                assertion, proof_policy, slice_receipts, bindings
            ),
        }
        for assertion in spec["requiredAssertions"]
    ]
    return {
        "schema": spec["schema"],
        "sessionId": session,
        "sliceId": slice_id,
        "sourceBackendCommit": commits["DWP_BACKEND"],
        "sourceFrontendCommit": commits["DWP_FRONTEND"],
        "checkpointIds": checkpoint_ids,
        "assertionEvidence": assertions,
        "syntheticOnly": True,
        "status": "PASS",
    }


def build_artifacts(
    session: str, gate_id: str, selection_path: Path,
) -> tuple[list[tuple[str, bytes]], str, dict[str, object]]:
    if not GATE_ID.fullmatch(gate_id):
        raise ValueError("gate-id is not canonical")
    contract = load_contract()
    slice_rows = read_csv(SLICES)
    module_rows = active_slices(slice_rows, session)
    if len(module_rows) != contract["moduleSliceCounts"].get(session):
        raise ValueError("module active slice count drift")
    selections = load_selection(selection_path, module_rows)
    checkpoints = read_csv(CHECKPOINTS, CHECKPOINT_HEADER)
    controls = read_csv(CONTROL_GATES, CONTROL_HEADER)
    checkpoint_by_id = {row.get("checkpoint_id", ""): row for row in checkpoints}
    bindings, commits = final_head_bindings(contract, session, gate_id)
    receipt_index = final_head_receipt_index(bindings, ROOT)
    if set(receipt_index) != {row["slice_id"] for row in module_rows}:
        raise ValueError("Control final-head capture active slice set drift")
    # Force executable catalog validation before deriving any assertion proof,
    # then independently validate the Control captures before publishing into
    # the irreversible append-only shard.
    (
        command_profiles, expected_bindings, canonical_argv_digest,
        reproducible_digest, typed_receipt_valid,
    ) = command_authority()
    repositories = default_repositories()
    preflight_errors: list[str] = []
    for repository, final_commit in commits.items():
        preflight_errors.extend(validate_final_head_evidence(
            repository,
            bindings[repository],
            contract,
            session,
            gate_id,
            final_commit,
            module_rows,
            command_profiles,
            expected_bindings,
            canonical_argv_digest,
            reproducible_digest,
            typed_receipt_valid,
            ROOT,
            True,
            repositories,
        ))
    if preflight_errors:
        raise ValueError("Control final-head preflight rejected: " + "; ".join(
            sorted(set(preflight_errors))
        ))
    artifacts: list[tuple[str, bytes]] = []
    aggregate_slices: list[dict[str, object]] = []
    used_checkpoints: set[str] = set()
    row_by_id = {row["slice_id"]: row for row in module_rows}
    for selection in selections:
        slice_id = selection["slice_id"]
        source = row_by_id[slice_id]
        backend_id = selection["backend_checkpoint_id"]
        frontend_id = selection["frontend_checkpoint_id"]
        if backend_id == frontend_id or {backend_id, frontend_id} & used_checkpoints:
            raise ValueError(f"{slice_id}: checkpoint IDs are equal or reused")
        used_checkpoints.update({backend_id, frontend_id})
        for repository, checkpoint_id in (
            ("DWP_BACKEND", backend_id), ("DWP_FRONTEND", frontend_id)
        ):
            checkpoint = checkpoint_by_id.get(checkpoint_id)
            if not checkpoint or not (
                checkpoint.get("checkpoint_kind") == "MODULE_COMMIT"
                and checkpoint.get("writer_session_id") == session
                and checkpoint.get("owner_session_id") == session
                and checkpoint.get("repository") == repository
                and checkpoint.get("slice_id") == slice_id
                and checkpoint.get("status") == "VERIFIED"
            ):
                raise ValueError(f"{slice_id}/{repository}: selected checkpoint identity drift")
            checkpoint_errors = checkpoint_evidence_valid(
                checkpoint,
                session,
                slice_id,
                repository,
                commits[repository],
                len(checkpoints),
                ROOT,
                True,
                repositories,
                command_profiles,
                expected_bindings,
                canonical_argv_digest,
                reproducible_digest,
                typed_receipt_valid,
                source.get("frontend_test_path", ""),
            )
            if checkpoint_errors:
                raise ValueError(
                    f"{slice_id}/{repository}: selected checkpoint preflight rejected: "
                    + "; ".join(checkpoint_errors)
                )
        runbook_path = Path(selection["runbook_source_path"])
        if not runbook_path.is_absolute():
            runbook_path = (ROOT / runbook_path).absolute()
        runbook_bytes = read_stable_source(runbook_path)
        runbook_text = runbook_bytes.decode("utf-8", errors="strict")
        runbook_spec = contract["evidenceTypes"]["runbook"]
        if any(marker not in runbook_text for marker in runbook_spec["requiredMarkers"]):
            raise ValueError(f"{slice_id}: operational runbook marker missing")
        evidence_bindings: dict[str, dict[str, str]] = {}
        for evidence_type, spec in contract["evidenceTypes"].items():
            canonical_ref = source[spec["sliceRegisterField"]]
            relative = module_relative(session, canonical_ref)
            if evidence_type == "runbook":
                data = runbook_bytes
            else:
                data = json_bytes(typed_evidence(
                    spec, session, slice_id, commits,
                    [backend_id, frontend_id], contract["assertionProofPolicy"],
                    receipt_index[slice_id], bindings,
                ))
            artifacts.append((relative, data))
            evidence_bindings[evidence_type] = {
                "path": canonical_ref,
                "sha256": content_sha(data),
                "status": "PASS",
            }
        aggregate_slices.append({
            "sliceId": slice_id,
            "status": "PASS",
            "backendCheckpointId": backend_id,
            "frontendCheckpointId": frontend_id,
            "evidence": evidence_bindings,
        })
    prefix = {
        "lastSequence": len(checkpoints),
        "sha256": csv_prefix_sha256(checkpoints, len(checkpoints)),
    }
    aggregate: dict[str, object] = {
        "schema": contract["aggregateSchema"],
        "gateId": gate_id,
        "sessionId": session,
        "status": "PASS",
        "sourceBackendCommit": commits["DWP_BACKEND"],
        "sourceFrontendCommit": commits["DWP_FRONTEND"],
        "sliceRegisterSha256": sha256(SLICES),
        "verificationCommandCatalogSha256": sha256(COMMAND_CATALOG),
        "checkpointPrefix": prefix,
        "syntheticOnly": True,
        "finalHeadVerification": bindings,
        "slices": aggregate_slices,
    }
    aggregate_relative = contract["aggregatePathTemplate"].format(
        module_slug=session.removeprefix("HRIS-").lower(), gate_id=gate_id
    ).split("/g4/", 1)[1]
    artifacts.append((aggregate_relative, json_bytes(aggregate)))
    if len({relative for relative, _data in artifacts}) != len(artifacts):
        raise ValueError("G4 builder produced duplicate artifact paths")
    if any(row.get("gate_id") == gate_id for row in controls):
        raise ValueError("G4 gate ID already exists in Control")
    return artifacts, aggregate_relative, aggregate


def prepare(session: str, gate_id: str, selection_path: Path) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_authoritative_gate_open()
        assert_all_central_transactions_committed()
        artifacts, aggregate_relative, aggregate = build_artifacts(
            session, gate_id, selection_path
        )
        assert_authoritative_gate_open()
        assert_all_central_transactions_committed()
        capability = active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE)
        if capability is None:
            raise ValueError("typed G4 builder lost its Control host capability")
        environment = {
            "DWP_HRIS_HOST_LOCK_NAME": HOST_VERIFICATION_SEMAPHORE,
            "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
        }
        append_new_bytes(
            session,
            artifacts,
            phase="g4",
            _host_lock_held_by_parent=True,
            _host_lock_capability=capability,
            _lock_environment=environment,
            _parent_pid=os.getpid(),
        )
        aggregate_path = ROOT / "session-evidence" / session.removeprefix(
            "HRIS-"
        ).lower() / "g4" / aggregate_relative
        errors = validate_aggregate_data(
            aggregate,
            load_contract(),
            read_csv(SLICES),
            read_csv(CHECKPOINTS, CHECKPOINT_HEADER),
            read_csv(CONTROL_GATES, CONTROL_HEADER),
            aggregate_path,
            require_anchor=False,
            repositories=default_repositories(),
        )
        if errors:
            raise ValueError("typed G4 batch post-validation failed: " + "; ".join(errors))
        assert_all_central_transactions_committed()
        assert_authoritative_gate_open()
    return {
        "schema": "dwp.hris.g4-functional-gate-typed-builder.v1",
        "status": "PASS",
        "sessionId": session,
        "gateId": gate_id,
        "artifactCount": len(artifacts),
        "aggregatePath": aggregate_path.relative_to(ROOT).as_posix(),
        "aggregateSha256": sha256(aggregate_path),
        "authorityState": "CANDIDATE_PENDING_INDEPENDENT_REPLAY_AND_CONTROL_APPEND",
    }


def self_test() -> dict[str, object]:
    import ast
    import inspect
    import tempfile

    source = Path(__file__).read_text(encoding="utf-8")
    tree = ast.parse(source)
    parser_flags = {
        argument.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "add_argument"
        for argument in node.args
        if isinstance(argument, ast.Constant) and isinstance(argument.value, str)
    }
    prepare_source = inspect.getsource(prepare)
    build_source = inspect.getsource(build_artifacts)
    cases = {
        "free-form-command-input-absent": "--command" not in parser_flags,
        "arbitrary-json-evidence-input-absent": not any(
            "evidence" in flag for flag in parser_flags
        ),
        "exact-selection-header": SELECTION_HEADER == [
            "slice_id", "backend_checkpoint_id", "frontend_checkpoint_id",
            "runbook_source_path",
        ],
        "exact-active-slice-order-required": "observed != expected" in inspect.getsource(load_selection),
        "pass-assertions-derived-only-from-final-head": (
            "proof_rows(" in inspect.getsource(typed_evidence)
            and "final_head_receipt_index" in build_source
        ),
        "runbook-markers-validated": "operational runbook marker missing" in build_source,
        "checkpoint-identity-validated": "selected checkpoint identity drift" in build_source,
        "single-batch-includes-aggregate": (
            "artifacts.append((aggregate_relative" in build_source
            and "append_new_bytes(" in prepare_source
        ),
        "typed-same-process-capability-required": all(
            marker in prepare_source
            for marker in (
                "active_host_semaphore_capability",
                "_host_lock_capability=capability",
                "_parent_pid=os.getpid()",
            )
        ),
        "authoritative-gate-and-central-fences-before-and-after": (
            prepare_source.count("assert_authoritative_gate_open()") == 3
            and prepare_source.count("assert_all_central_transactions_committed()") == 3
        ),
        "control-anchor-not-claimed": "PENDING_INDEPENDENT_REPLAY_AND_CONTROL_APPEND" in prepare_source,
        "post-publication-candidate-validation": "validate_aggregate_data(" in prepare_source,
    }
    with tempfile.TemporaryDirectory(prefix="dwp-g4-builder-selection-") as temporary:
        path = Path(temporary) / "selection.csv"
        fixture_rows = [
            {
                "slice_id": "SLICE-001",
                "backend_checkpoint_id": "BE-001",
                "frontend_checkpoint_id": "FE-001",
                "runbook_source_path": "/fixture/runbook-001.md",
            },
            {
                "slice_id": "SLICE-002",
                "backend_checkpoint_id": "BE-002",
                "frontend_checkpoint_id": "FE-002",
                "runbook_source_path": "/fixture/runbook-002.md",
            },
        ]

        def write_selection(rows: list[dict[str, str]]) -> None:
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=SELECTION_HEADER)
                writer.writeheader()
                writer.writerows(rows)

        module_rows = [{"slice_id": "SLICE-001"}, {"slice_id": "SLICE-002"}]
        write_selection(fixture_rows)
        cases["canonical-selection-fixture-accepted"] = (
            load_selection(path, module_rows) == fixture_rows
        )
        write_selection(list(reversed(fixture_rows)))
        try:
            load_selection(path, module_rows)
            cases["reordered-selection-fixture-rejected"] = False
        except ValueError:
            cases["reordered-selection-fixture-rejected"] = True
    proof_policy = {
        "assertions": {"tenant-isolation": {"DWP_BACKEND": ["slice-contract"]}}
    }
    receipt = {
        "commandId": "G3CMD-HRM-BE:SLICE-001:slice-contract",
        "commandSha256": "a" * 64,
        "outputSha256": "b" * 64,
        "reproducibleResultSha256": "c" * 64,
    }
    bindings = {
        "DWP_BACKEND": {
            "path": "g0/control-evidence-intake/hrm/g4/gates/test.json",
            "sha256": "d" * 64,
            "status": "PASS",
        }
    }
    derived = proof_rows(
        "tenant-isolation",
        proof_policy,
        {"DWP_BACKEND": {str(receipt["commandId"]): receipt}},
        bindings,
    )
    cases["proof-fixture-derived-exactly-from-control-receipt"] = (
        len(derived) == 1
        and derived[0]["outputSha256"] == receipt["outputSha256"]
        and derived[0]["finalHeadEvidenceSha256"] == bindings["DWP_BACKEND"]["sha256"]
    )
    try:
        proof_rows("tenant-isolation", proof_policy, {}, bindings)
        cases["missing-control-proof-fixture-rejected"] = False
    except ValueError:
        cases["missing-control-proof-fixture-rejected"] = True
    return {
        "schema": "dwp.hris.g4-functional-gate-typed-builder-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=sorted(
        {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"}
    ))
    parser.add_argument("--gate-id")
    parser.add_argument("--selection", type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            payload = self_test()
        elif not args.session or not args.gate_id or args.selection is None:
            raise ValueError("session, gate-id and selection are required")
        else:
            selection = args.selection
            if not selection.is_absolute():
                selection = (Path.cwd() / selection).absolute()
            payload = prepare(args.session, args.gate_id, selection)
    except (
        KeyError, OSError, UnicodeDecodeError, ValueError, csv.Error,
        json.JSONDecodeError, SemaphoreTimeoutError,
    ) as error:
        payload = {
            "schema": "dwp.hris.g4-functional-gate-typed-builder.v1",
            "status": "FAIL",
            "errors": [str(error)],
        }
    print(json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":") if args.compact else None,
        indent=None if args.compact else 2,
    ))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
