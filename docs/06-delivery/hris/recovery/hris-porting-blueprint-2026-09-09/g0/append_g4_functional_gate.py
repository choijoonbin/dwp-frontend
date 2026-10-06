#!/usr/bin/env python3
"""Control-only, fail-closed append for a verified module G4 aggregate."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import stat
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CODING = ROOT / "coding-readiness"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))
if str(CODING) not in sys.path:
    sys.path.insert(0, str(CODING))

from host_semaphore import HOST_VERIFICATION_SEMAPHORE, exclusive_host_semaphore  # noqa: E402
from central_transaction_fence import (  # noqa: E402
    assert_all_central_transactions_committed,
    assert_recovery_exclusive,
)
from gate_authority import assert_authoritative_gate_open  # noqa: E402
from capture_g4_final_head_evidence import replay_under_active_control_lock  # noqa: E402
from validate_g4_functional_gate import (  # noqa: E402
    CHECKPOINTS, CHECKPOINT_HEADER, COMMAND_CATALOG, CONTROL_GATES, CONTROL_HEADER,
    CONTROL_STATE, CONTROL_STATE_FIELDS, SLICES, active_slices,
    control_csv_sha256, load_contract, read_csv, sha256,
    reference_has_symlink, validate_aggregate_data, validate_plan,
)


STATE_SCHEMA = "dwp.hris.g4-functional-gate-control-state.v2"


def replace_bytes(path: Path, value: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists():
            temporary.unlink()


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CONTROL_HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def json_bytes(payload: dict[str, object]) -> bytes:
    return (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def later_timestamp(previous: str) -> str:
    now = datetime.now(timezone.utc)
    if previous:
        try:
            prior = datetime.fromisoformat(previous.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("prior G4 Control timestamp is invalid") from error
        if now <= prior:
            now = prior + timedelta(microseconds=1)
    return now.isoformat(timespec="microseconds").replace("+00:00", "Z")


def safe_aggregate(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    if reference_has_symlink(str(candidate), ROOT):
        raise ValueError("aggregate symlink is forbidden")
    resolved = candidate.resolve(strict=False)
    if ROOT.resolve() not in resolved.parents or not resolved.is_file():
        raise ValueError("aggregate is missing, symlinked, or outside the blueprint")
    metadata = resolved.lstat()
    if (
        not stat.S_ISREG(metadata.st_mode)
        or stat.S_ISLNK(metadata.st_mode)
        or stat.S_IMODE(metadata.st_mode) != 0o600
        or metadata.st_nlink != 1
    ):
        raise ValueError("aggregate file mode/link integrity drift")
    return resolved


def state(rows: list[dict[str, str]]) -> dict[str, object]:
    try:
        payload = json.loads(CONTROL_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"G4 Control state unreadable: {error}") from error
    errors = validate_plan(
        load_contract(), read_csv(SLICES), read_csv(CHECKPOINTS, CHECKPOINT_HEADER),
        rows, payload,
    )
    state_errors = [error for error in errors if "Control" in error]
    if state_errors:
        raise ValueError("; ".join(state_errors))
    return payload


def load_prepared_state() -> dict[str, object]:
    try:
        payload = json.loads(CONTROL_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"G4 Control state unreadable: {error}") from error
    if not isinstance(payload, dict) or set(payload) != CONTROL_STATE_FIELDS or not (
        payload.get("schema") == STATE_SCHEMA
        and payload.get("phase") == "PREPARED"
        and payload.get("status") == "CONTROL_REGISTER_PREPARED"
        and isinstance(payload.get("transactionSeq"), int)
        and int(payload.get("transactionSeq", 0)) > 0
        and isinstance(payload.get("priorState"), dict)
    ):
        raise ValueError("G4 Control transaction is not a recoverable PREPARED state")
    return payload


def build_candidate(
    aggregate_path: Path,
    rows: list[dict[str, str]],
    *,
    recorded_at: str | None = None,
) -> tuple[
    dict[str, object], dict[str, object], list[dict[str, str]],
    list[dict[str, str]], dict[str, str], list[dict[str, str]],
]:
    contract = load_contract()
    slices = read_csv(SLICES)
    checkpoints = read_csv(CHECKPOINTS, CHECKPOINT_HEADER)
    try:
        aggregate = json.loads(aggregate_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"aggregate unreadable: {error}") from error
    if not isinstance(aggregate, dict):
        raise ValueError("aggregate root must be an object")
    errors = validate_aggregate_data(
        aggregate, contract, slices, checkpoints, rows, aggregate_path,
        require_anchor=False,
    )
    if errors:
        raise ValueError("G4 candidate rejected: " + "; ".join(errors))
    session = str(aggregate["sessionId"])
    gate_id = str(aggregate["gateId"])
    if any(row.get("gate_id") == gate_id for row in rows):
        raise ValueError("G4 gate ID already exists")
    assigned_at = recorded_at or later_timestamp(
        rows[-1].get("recorded_at", "") if rows else ""
    )
    if rows and assigned_at <= rows[-1].get("recorded_at", ""):
        raise ValueError("G4 recovered timestamp is not append-monotonic")
    prefix = aggregate["checkpointPrefix"]
    relative = str(aggregate_path.relative_to(ROOT.resolve()))
    row = {
        "gate_seq": str(len(rows) + 1), "gate_id": gate_id,
        "session_id": session,
        "backend_commit": aggregate["sourceBackendCommit"],
        "frontend_commit": aggregate["sourceFrontendCommit"],
        "active_slice_count": str(len(active_slices(slices, session))),
        "aggregate_ref": relative, "aggregate_sha256": sha256(aggregate_path),
        "checkpoint_prefix_sequence": str(prefix["lastSequence"]),
        "checkpoint_prefix_sha256": prefix["sha256"],
        "slice_register_sha256": sha256(SLICES),
        "command_catalog_sha256": sha256(COMMAND_CATALOG),
        "recorded_at": assigned_at, "status": "VERIFIED_G4_FUNCTIONAL_GATE",
    }
    return contract, aggregate, slices, checkpoints, row, [*rows, row]


def prepared_state(
    prior: dict[str, object], row: dict[str, str], candidate_rows: list[dict[str, str]]
) -> dict[str, object]:
    prior_digest = sha256(CONTROL_GATES)
    candidate_digest = control_csv_sha256(candidate_rows)
    return {
        "schema": STATE_SCHEMA,
        "transactionSeq": int(prior["transactionSeq"]) + 1,
        "phase": "PREPARED",
        "priorRegisterSha256": prior_digest,
        "candidateRegisterSha256": candidate_digest,
        "gateId": row["gate_id"],
        "aggregateRef": row["aggregate_ref"],
        "aggregateSha256": row["aggregate_sha256"],
        "recordedAt": row["recorded_at"],
        "preparedAt": row["recorded_at"],
        "committedAt": None,
        "priorState": prior,
        "status": "CONTROL_REGISTER_PREPARED",
    }


def committed_state(prepared: dict[str, object]) -> dict[str, object]:
    payload = dict(prepared)
    payload.update(
        {
            "phase": "COMMITTED",
            "committedAt": later_timestamp(str(prepared["recordedAt"])),
            "priorState": None,
            "status": "CONTROL_REGISTER_COMMITTED",
        }
    )
    return payload


def restore_transaction(register_bytes: bytes, state_bytes: bytes) -> None:
    failures: list[str] = []
    for path, content in (
        (CONTROL_GATES, register_bytes), (CONTROL_STATE, state_bytes)
    ):
        try:
            replace_bytes(path, content)
        except Exception as error:  # pragma: no cover - host I/O failure
            failures.append(f"{path.name}: {error}")
    if failures:
        raise RuntimeError(
            "G4 Control transaction rollback incomplete: " + "; ".join(failures)
        )


def independent_final_head_replay(aggregate: dict[str, object]) -> str:
    """Re-run, do not trust, the two stored final-head PASS receipts.

    Output bytes may legitimately differ between clean runs (for example a
    build cache banner), so the Control proof is the fresh successful execution
    of the exact closed argv set, commit/tree identity and typed frontend
    result.  The candidate validator separately seals the submitted receipts.
    """
    session = str(aggregate["sessionId"])
    gate_id = str(aggregate["gateId"])
    payloads: list[dict[str, object]] = []
    for repository, commit_field in (
        ("DWP_BACKEND", "sourceBackendCommit"),
        ("DWP_FRONTEND", "sourceFrontendCommit"),
    ):
        payload, target = replay_under_active_control_lock(
            session,
            repository,
            gate_id,
            str(aggregate[commit_field]),
            publish=False,
        )
        if target is not None or payload.get("overallStatus") != "PASS":
            raise ValueError("independent G4 replay did not produce an unpersisted PASS")
        payloads.append(payload)
    return hashlib.sha256(json_bytes({"replays": payloads})).hexdigest()


def _append_under_active_lock(
    aggregate_path: Path,
    *,
    recorded_at: str | None = None,
    expected_journal: dict[str, object] | None = None,
) -> dict[str, object]:
    # Gate authority includes the committed transition row and published LIVE
    # seal, not merely the staged decision JSON.  All upstream central journals
    # must also be committed before the expensive independent replay starts.
    assert_authoritative_gate_open()
    assert_all_central_transactions_committed()
    rows = read_csv(CONTROL_GATES, CONTROL_HEADER)
    marker = state(rows)
    (
        contract, aggregate, slices, checkpoints, row, candidate_rows,
    ) = build_candidate(aggregate_path, rows, recorded_at=recorded_at)
    session = str(aggregate["sessionId"])
    gate_id = str(aggregate["gateId"])
    replay_sha256 = independent_final_head_replay(aggregate)
    # Re-read every candidate input after the long replay.  This closes a
    # non-cooperating writer changing the aggregate/register/catalog bytes
    # while tests are running, even though all supported writers share the
    # host semaphore.
    (
        replay_contract, replay_aggregate, replay_slices, replay_checkpoints,
        replay_row, replay_candidate_rows,
    ) = build_candidate(
        aggregate_path,
        rows,
        recorded_at=row["recorded_at"],
    )
    if not (
        replay_contract == contract
        and replay_aggregate == aggregate
        and replay_slices == slices
        and replay_checkpoints == checkpoints
        and replay_row == row
        and replay_candidate_rows == candidate_rows
    ):
        raise ValueError("G4 candidate inputs changed during independent replay")
    # Re-check before the PREPARED point.  After PREPARED, ordinary Gate
    # authority deliberately fails closed and only this transaction/recovery
    # may proceed while retaining the same host lease.
    assert_authoritative_gate_open()
    assert_all_central_transactions_committed()
    candidate_bytes = csv_bytes(candidate_rows)
    old_register = CONTROL_GATES.read_bytes()
    old_state = CONTROL_STATE.read_bytes()
    journal = prepared_state(marker, row, candidate_rows)
    if expected_journal is not None and any(
        journal.get(field) != expected_journal.get(field)
        for field in (
            "transactionSeq", "priorRegisterSha256", "candidateRegisterSha256",
            "gateId", "aggregateRef", "aggregateSha256", "recordedAt",
        )
    ):
        raise ValueError("G4 recovered journal identity drift before PREPARED")
    try:
        # Persist the exact preimage/candidate digests before either view
        # changes.  A process death after this point is deterministic to
        # recover because the immutable aggregate recreates the candidate.
        replace_bytes(CONTROL_STATE, json_bytes(journal))
        assert_recovery_exclusive("G4_FUNCTIONAL_GATE")
        replace_bytes(CONTROL_GATES, candidate_bytes)
        marker = committed_state(journal)
        replace_bytes(CONTROL_STATE, json_bytes(marker))
        assert_all_central_transactions_committed()
        assert_authoritative_gate_open()
        final_errors = validate_plan(
            contract, slices, checkpoints, candidate_rows, marker
        )
        if final_errors:
            raise ValueError("post-append G4 Control validation failed: " + "; ".join(final_errors))
    except Exception as error:
        try:
            restore_transaction(old_register, old_state)
        except RuntimeError as rollback_error:
            raise rollback_error from error
        raise
    return {
        "schema": "dwp.hris.g4-functional-gate-control-append.v1",
        "status": "PASS", "gateId": gate_id, "sessionId": session,
        "gateSequence": len(candidate_rows), "aggregateSha256": row["aggregate_sha256"],
        "independentReplaySha256": replay_sha256,
    }


def append(aggregate_path: Path) -> dict[str, object]:
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        return _append_under_active_lock(aggregate_path)


def recover_prepared(action: str) -> dict[str, object]:
    if action not in {"commit", "rollback"}:
        raise ValueError("G4 recovery action must be commit or rollback")
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0):
        assert_recovery_exclusive("G4_FUNCTIONAL_GATE")
        journal = load_prepared_state()
        prior_state = journal.get("priorState")
        if not isinstance(prior_state, dict) or set(prior_state) != CONTROL_STATE_FIELDS or not (
            prior_state.get("schema") == STATE_SCHEMA
            and prior_state.get("phase") == "COMMITTED"
            and prior_state.get("priorState") is None
            and int(prior_state.get("transactionSeq", -1)) + 1
            == int(journal["transactionSeq"])
        ):
            raise ValueError("G4 PREPARED journal lacks an exact prior committed state")
        current_digest = sha256(CONTROL_GATES)
        allowed_digests = {
            str(journal.get("priorRegisterSha256", "")),
            str(journal.get("candidateRegisterSha256", "")),
        }
        if current_digest not in allowed_digests:
            raise ValueError("G4 register is neither PREPARED preimage nor candidate")
        current_rows = read_csv(CONTROL_GATES, CONTROL_HEADER)
        base_rows = list(current_rows)
        if current_digest == journal.get("candidateRegisterSha256"):
            if not base_rows or base_rows[-1].get("gate_id") != journal.get("gateId"):
                raise ValueError("G4 candidate register tail identity drift")
            base_rows.pop()
        base_bytes = csv_bytes(base_rows)
        if hashlib.sha256(base_bytes).hexdigest() != journal.get("priorRegisterSha256"):
            raise ValueError("G4 PREPARED preimage reconstruction drift")
        if action == "rollback":
            replace_bytes(CONTROL_GATES, base_bytes)
            replace_bytes(CONTROL_STATE, json_bytes(prior_state))
            return {
                "schema": "dwp.hris.g4-functional-gate-control-recovery.v1",
                "status": "PASS", "action": "ROLLBACK",
                "transactionSeq": prior_state.get("transactionSeq"),
            }
        aggregate_path = safe_aggregate(str(journal.get("aggregateRef", "")))
        if sha256(aggregate_path) != journal.get("aggregateSha256"):
            raise ValueError("G4 PREPARED aggregate digest drift")
        (
            contract, _aggregate, slices, checkpoints, row, candidate_rows,
        ) = build_candidate(
            aggregate_path,
            base_rows,
            recorded_at=str(journal.get("recordedAt", "")),
        )
        candidate_bytes = csv_bytes(candidate_rows)
        if not (
            row.get("gate_id") == journal.get("gateId")
            and row.get("aggregate_ref") == journal.get("aggregateRef")
            and row.get("aggregate_sha256") == journal.get("aggregateSha256")
            and hashlib.sha256(candidate_bytes).hexdigest()
            == journal.get("candidateRegisterSha256")
        ):
            raise ValueError("G4 PREPARED deterministic candidate reconstruction drift")
        # Restore the exact committed preimage first.  A crash here is a safe
        # rollback.  Then run the normal authority/fence/candidate validation
        # and independent command replay again before creating a fresh
        # PREPARED journal and CAS.  This avoids any recovery-only PASS bypass.
        replace_bytes(CONTROL_GATES, base_bytes)
        replace_bytes(CONTROL_STATE, json_bytes(prior_state))
        result = _append_under_active_lock(
            aggregate_path,
            recorded_at=str(journal.get("recordedAt", "")),
            expected_journal=journal,
        )
        return {
            "schema": "dwp.hris.g4-functional-gate-control-recovery.v1",
            "status": "PASS", "action": "COMMIT",
            "transactionSeq": journal.get("transactionSeq"),
            "gateId": journal.get("gateId"),
            "independentReplaySha256": result["independentReplaySha256"],
        }


def self_test() -> dict[str, object]:
    import ast
    import inspect
    from gate_authority import TRANSITION_HEADER, transition_register_errors

    source = Path(__file__).read_text(encoding="utf-8")
    append_source = inspect.getsource(_append_under_active_lock)
    wrapper_source = inspect.getsource(append)
    replay_source = inspect.getsource(independent_final_head_replay)
    tree = ast.parse(source)
    subprocess_calls = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    ]
    recovery_source = inspect.getsource(recover_prepared)
    replacement_source = inspect.getsource(replace_bytes)
    restore_source = inspect.getsource(restore_transaction)
    cases = {
        "free-form-shell-execution-absent": not subprocess_calls,
        "authoritative-open-gate-required": "assert_authoritative_gate_open()" in append_source,
        "host-semaphore-required": "exclusive_host_semaphore" in source,
        "gate-check-occurs-inside-semaphore": (
            wrapper_source.index("with exclusive_host_semaphore")
            < wrapper_source.index("_append_under_active_lock(")
        ),
        "gate-rechecked-before-prepared-and-after-commit": (
            append_source.count("assert_authoritative_gate_open()") == 3
            and append_source.rindex("assert_authoritative_gate_open()")
            > append_source.index("replace_bytes(CONTROL_STATE, json_bytes(marker))")
        ),
        "central-transactions-fenced-before-replay-before-prepared-and-after": (
            append_source.count("assert_all_central_transactions_committed()") == 3
        ),
        "g4-prepared-allows-only-own-recovery": (
            'assert_recovery_exclusive("G4_FUNCTIONAL_GATE")' in append_source
        ),
        "monotonic-control-time": "later_timestamp(" in source,
        "candidate-validated-before-append": append_source.index("build_candidate(") < append_source.index("replace_bytes(CONTROL_GATES"),
        "independent-final-head-replay-before-prepared-and-cas": (
            append_source.index("independent_final_head_replay(")
            < append_source.index("G4 candidate inputs changed during independent replay")
            < append_source.index("replace_bytes(CONTROL_STATE, json_bytes(journal))")
            < append_source.index("replace_bytes(CONTROL_GATES")
            and replay_source.count("replay_under_active_control_lock(") == 1
            and 'for repository, commit_field in (' in replay_source
            and 'publish=False' in replay_source
        ),
        "prepared-journal-before-register": append_source.index("replace_bytes(CONTROL_STATE, json_bytes(journal))") < append_source.index("replace_bytes(CONTROL_GATES"),
        "register-before-committed-marker": append_source.index("replace_bytes(CONTROL_GATES") < append_source.index("marker = committed_state(journal)"),
        "post-validation-inside-transaction": append_source.index("final_errors = validate_plan") < append_source.index("except Exception as error"),
        "register-and-state-rollback-required": all(
            marker in restore_source for marker in ("CONTROL_GATES", "CONTROL_STATE")
        ),
        "file-and-parent-fsync-required": all(
            marker in replacement_source
            for marker in ("os.fsync(handle.fileno())", "os.replace(temporary, path)", "os.fsync(directory)")
        ),
        "prepared-recovery-digest-fence": all(
            marker in recovery_source
            for marker in (
                "neither PREPARED preimage nor candidate",
                "PREPARED preimage reconstruction drift",
                "deterministic candidate reconstruction drift",
            )
        ),
        "prepared-recovery-explicit-actions": all(
            marker in recovery_source
            for marker in ('action == "rollback"', "action\": \"COMMIT\"")
        ),
        "recovery-exclusive-before-any-action": (
            recovery_source.index('assert_recovery_exclusive("G4_FUNCTIONAL_GATE")')
            < recovery_source.index("load_prepared_state()")
        ),
        "recovery-commit-replays-normal-path": (
            "_append_under_active_lock(" in recovery_source
            and "expected_journal=journal" in recovery_source
            and recovery_source.index("replace_bytes(CONTROL_STATE, json_bytes(prior_state))")
            < recovery_source.index("_append_under_active_lock(")
        ),
        "duplicate-gate-rejected": "G4 gate ID already exists" in source,
    }
    with tempfile.TemporaryDirectory(prefix="dwp-g4-transition-empty-") as temporary:
        transition = Path(temporary) / "transitions.csv"
        output = io.StringIO(newline="")
        csv.DictWriter(output, fieldnames=TRANSITION_HEADER, lineterminator="\n").writeheader()
        transition.write_text(output.getvalue(), encoding="utf-8")
        cases["staged-open-without-committed-transition-rejected"] = any(
            "latest G3 Gate transition is not committed OPEN" in error
            for error in transition_register_errors(
                transition_path=transition,
                require_open=True,
            )
        )
    original_replay = globals()["replay_under_active_control_lock"]
    replay_calls: list[str] = []

    def hostile_replay(
        _session: str, repository: str, _gate_id: str, _head: str, *, publish: bool
    ) -> tuple[dict[str, object], None]:
        replay_calls.append(repository)
        return {
            "overallStatus": "PASS" if repository == "DWP_BACKEND" else "FAIL",
            "repository": repository,
        }, None

    try:
        globals()["replay_under_active_control_lock"] = hostile_replay
        try:
            independent_final_head_replay({
                "sessionId": "HRIS-HRM",
                "gateId": "G4-HRM-HOSTILE-001",
                "sourceBackendCommit": "1" * 40,
                "sourceFrontendCommit": "2" * 40,
            })
            rejected_failed_replay = False
        except ValueError:
            rejected_failed_replay = True
    finally:
        globals()["replay_under_active_control_lock"] = original_replay
    cases["shape-valid-stored-pass-cannot-bypass-failed-fresh-replay"] = (
        rejected_failed_replay
        and replay_calls == ["DWP_BACKEND", "DWP_FRONTEND"]
    )
    future = "2999-01-01T00:00:00.000000Z"
    cases["clock-regression-remains-monotonic"] = later_timestamp(future) > future
    try:
        later_timestamp("not-a-time")
        cases["invalid-prior-time-rejected"] = False
    except ValueError:
        cases["invalid-prior-time-rejected"] = True
    prior = json.loads(CONTROL_STATE.read_text(encoding="utf-8"))
    fixture_row = {field: "" for field in CONTROL_HEADER}
    fixture_row.update(
        {
            "gate_seq": "1", "gate_id": "G4-SELF-TEST-001",
            "session_id": "HRIS-HRM", "aggregate_ref": "fixture.json",
            "aggregate_sha256": "a" * 64,
            "recorded_at": "2099-01-01T00:00:00.000000Z",
            "status": "VERIFIED_G4_FUNCTIONAL_GATE",
        }
    )
    journal = prepared_state(prior, fixture_row, [fixture_row])
    cases["prepared-state-seals-preimage-and-candidate"] = (
        journal.get("schema") == STATE_SCHEMA
        and journal.get("phase") == "PREPARED"
        and journal.get("priorRegisterSha256") == sha256(CONTROL_GATES)
        and journal.get("candidateRegisterSha256")
        == control_csv_sha256([fixture_row])
        and journal.get("priorState") == prior
    )
    committed = committed_state(journal)
    cases["committed-state-clears-prior-and-advances-time"] = (
        committed.get("phase") == "COMMITTED"
        and committed.get("priorState") is None
        and str(committed.get("committedAt")) > str(journal.get("recordedAt"))
    )
    return {
        "schema": "dwp.hris.g4-functional-gate-control-append-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aggregate")
    parser.add_argument("--recover", choices=("commit", "rollback"))
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        selected = sum((bool(args.aggregate), bool(args.recover), args.self_test))
        if selected != 1:
            raise ValueError("choose exactly one of --aggregate, --recover, or --self-test")
        if args.self_test:
            payload = self_test()
        elif args.recover:
            payload = recover_prepared(args.recover)
        else:
            payload = append(safe_aggregate(str(args.aggregate)))
    except (
        KeyError, OSError, TypeError, ValueError, RuntimeError,
        csv.Error, json.JSONDecodeError,
    ) as error:
        payload = {
            "schema": "dwp.hris.g4-functional-gate-control-append.v1",
            "status": "FAIL", "errors": [str(error)],
        }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
