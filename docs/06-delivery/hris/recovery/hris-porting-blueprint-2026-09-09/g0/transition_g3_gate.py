#!/usr/bin/env python3
"""The only writer for fail-safe close and verified atomic G3 Gate opening."""

from __future__ import annotations

import argparse
import csv
import hashlib
import inspect
import io
import json
import os
import subprocess
import sys
import tempfile
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from gate_authority import (
    DECISION,
    REPORT_JSON,
    REPORT_MD,
    REQUIRED_PASSES,
    TRANSITIONS,
    TRANSITION_HEADER,
    assert_authoritative_gate_open,
    canonical_receipts_bytes,
    canonical_gate_payload,
    gate_decision_errors,
    required_commands_sha256,
    sha256_path,
    transition_register_errors,
)
from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
GATE_TRANSITION_SEMAPHORE = "hris-gate-transition"
CENTRAL_CLASSIFICATIONS = G0 / "central-artifact-classification-register.csv"
ENTRY_BOOTSTRAP_CLASS_IDS = {
    "CENTRAL-CLASS-001",
    "CENTRAL-CLASS-002",
    "CENTRAL-CLASS-008",
}


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def canonical_bytes(open_gate: bool) -> bytes:
    return (
        json.dumps(
            canonical_gate_payload(open_gate),
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def utc_after(prior: str = "") -> str:
    now = datetime.now(timezone.utc)
    if prior:
        try:
            previous = datetime.fromisoformat(prior.replace("Z", "+00:00"))
            if now <= previous:
                now = previous + timedelta(microseconds=1)
        except ValueError:
            pass
    return now.isoformat(timespec="microseconds").replace("+00:00", "Z")


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=TRANSITION_HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def central_classification_bytes(path: Path, *, gate_open: bool) -> bytes:
    """Return the exact Gate-coupled central-class state generation."""
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = list(reader.fieldnames or [])
        rows = list(reader)
    if not fields or "classification_id" not in fields or "state" not in fields:
        raise ValueError("central artifact classification schema drift")
    by_id = {row.get("classification_id", ""): row for row in rows}
    if not ENTRY_BOOTSTRAP_CLASS_IDS.issubset(by_id):
        raise ValueError("central entry-bootstrap classification set drift")
    target = "ENTRY_BASELINE_VERIFIED" if gate_open else "CODE_ENTRY_BOOTSTRAP_PENDING"
    allowed = {"ENTRY_BASELINE_VERIFIED", "CODE_ENTRY_BOOTSTRAP_PENDING"}
    for class_id in ENTRY_BOOTSTRAP_CLASS_IDS:
        if by_id[class_id].get("state") not in allowed:
            raise ValueError(f"{class_id}: central Gate state drift")
        by_id[class_id]["state"] = target
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def append_transition(
    row: dict[str, str], path: Path = TRANSITIONS
) -> dict[str, str]:
    errors = transition_register_errors(transition_path=path, require_open=False)
    if errors:
        raise ValueError("G3 Gate transition register invalid: " + "; ".join(errors))
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    next_sequence = len(rows) + 1
    if set(row) != set(TRANSITION_HEADER):
        raise ValueError("G3 Gate transition candidate row schema drift")
    candidate = dict(row)
    candidate["transition_seq"] = str(next_sequence)
    prior_time = rows[-1]["recorded_at"] if rows else ""
    candidate["recorded_at"] = utc_after(prior_time)
    atomic_write(path, csv_bytes([*rows, candidate]))
    post_errors = transition_register_errors(transition_path=path, require_open=False)
    if post_errors:
        atomic_write(path, csv_bytes(rows))
        raise ValueError("G3 Gate transition post-append invalid: " + "; ".join(post_errors))
    return candidate


def read_exact_decision(path: Path, *, require_open: bool) -> bytes:
    try:
        data = path.read_bytes()
        payload = json.loads(data)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"current G3 Gate decision is unreadable: {error}") from error
    errors = gate_decision_errors(payload, require_open=require_open)
    if errors:
        raise ValueError("; ".join(errors))
    return data


def command_argvs() -> list[list[str]]:
    return [
        [
            sys.executable,
            str(G0 / "validate_code_checkpoint.py"),
            "--check-live",
        ],
        [
            sys.executable,
            str(ROOT / "coding-readiness/validate_full_coding_readiness.py"),
            "--check-live",
            "--write-report",
        ],
        [
            sys.executable,
            str(ROOT / "coding-readiness/validate_published_gate_truth.py"),
            "--compact",
        ],
        [
            sys.executable,
            str(ROOT / "coding-readiness/validate_published_gate_truth.py"),
            "--self-test",
        ],
    ]


def command_display(command: list[str]) -> str:
    """Render the exact, independently locking public validation command."""
    if len(command) < 4 or command[0] != sys.executable:
        return ""
    try:
        script = Path(command[1]).resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return ""
    return " ".join(["python3", script, *command[2:]])


def run_required(command: list[str]) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            env=dict(os.environ),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=7200,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return 1, str(error)
    return completed.returncode, completed.stdout


def restore_optional(path: Path, prior: bytes | None) -> None:
    if prior is None:
        if path.exists() and path.is_file() and not path.is_symlink():
            path.unlink()
            fsync_directory(path.parent)
        return
    atomic_write(path, prior)


def _verification_guard():
    return exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE,
        timeout_seconds=300.0,
    )


def _publication_snapshot(
    report_json_path: Path,
    report_md_path: Path,
    declaration_path: Path,
) -> dict[Path, bytes | None]:
    return {
        path: path.read_bytes() if path.is_file() and not path.is_symlink() else None
        for path in (report_json_path, report_md_path, declaration_path)
    }


def _restore_if_unchanged(
    prior: dict[Path, bytes | None],
    observed: dict[Path, bytes | None],
) -> None:
    """CAS rollback: never overwrite a concurrently advanced publication."""
    for path, prior_bytes in prior.items():
        current = path.read_bytes() if path.is_file() and not path.is_symlink() else None
        if current == observed.get(path):
            restore_optional(path, prior_bytes)


def open_transition(
    *,
    decision_path: Path = DECISION,
    report_json_path: Path = REPORT_JSON,
    report_md_path: Path = REPORT_MD,
    declaration_path: Path = ROOT / "README.md",
    transition_path: Path = TRANSITIONS,
    classification_path: Path = CENTRAL_CLASSIFICATIONS,
    runner: Callable[[list[str]], tuple[int, str]] = run_required,
    authority_check: Callable[[], None] = assert_authoritative_gate_open,
    commands: list[list[str]] | None = None,
    verification_guard: Callable[[], object] = _verification_guard,
) -> dict[str, object]:
    """Stage, independently verify, then durably commit canonical OPEN.

    An asynchronous kill after staging is still fail-closed to every writer:
    ``gate_authority`` requires the final matching append-only transition row,
    not the staged decision token.  The caller serializes open/close operations
    with ``GATE_TRANSITION_SEMAPHORE``; each public validator obtains the common
    verification semaphore itself, so there is no parent-lock bypass.
    """
    guard = verification_guard
    with guard():
        try:
            current = json.loads(decision_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"current G3 Gate decision is unreadable: {error}") from error
        if not gate_decision_errors(current, require_open=True):
            try:
                authority_check()
            except ValueError:
                # Recover an interrupted PREPARED generation.  It never had
                # operational authority because no committed OPEN row matched.
                atomic_write(decision_path, canonical_bytes(False))
                atomic_write(
                    classification_path,
                    central_classification_bytes(classification_path, gate_open=False),
                )
                current = canonical_gate_payload(False)
            else:
                return {
                    "status": "PASS",
                    "transition": "ALREADY_OPEN_VERIFIED",
                    "checks": 0,
                }
        if gate_decision_errors(current, require_open=False):
            raise ValueError("Gate can open only from the exact fail-safe closed state")
        prior_decision = decision_path.read_bytes()
        prior_classification = classification_path.read_bytes()
        prior_publication = _publication_snapshot(
            report_json_path, report_md_path, declaration_path
        )
        transition_prefix = transition_path.read_bytes()
        atomic_write(decision_path, canonical_bytes(True))
        staged_classification = central_classification_bytes(
            classification_path, gate_open=True
        )
        atomic_write(classification_path, staged_classification)

    executed: list[dict[str, object]] = []
    last_observed = dict(prior_publication)
    open_row_appended = False
    try:
        for command in commands if commands is not None else command_argvs():
            with guard():
                read_exact_decision(decision_path, require_open=True)
                if transition_path.read_bytes() != transition_prefix:
                    raise ValueError("G3 Gate transition prefix changed during verification")
            returncode, output = runner(command)
            label = command_display(command)
            completed_at = utc_after(
                str(executed[-1]["completedAt"]) if executed else ""
            )
            executed.append({
                "command": label,
                "commandSha256": hashlib.sha256((label + "\n").encode()).hexdigest(),
                "completedAt": completed_at,
                "outputSha256": hashlib.sha256(output.encode()).hexdigest(),
                "returnCode": returncode,
                "status": "PASS" if returncode == 0 else "FAIL",
            })
            if returncode != 0:
                raise ValueError(f"required Gate command failed rc={returncode}")
            with guard():
                read_exact_decision(decision_path, require_open=True)
                if transition_path.read_bytes() != transition_prefix:
                    raise ValueError("G3 Gate transition prefix changed during verification")
                last_observed = _publication_snapshot(
                    report_json_path, report_md_path, declaration_path
                )
        with guard():
            read_exact_decision(decision_path, require_open=True)
            if transition_path.read_bytes() != transition_prefix:
                raise ValueError("G3 Gate transition prefix changed before commit")
            if _publication_snapshot(
                report_json_path, report_md_path, declaration_path
            ) != last_observed:
                raise ValueError("Gate publication changed after final validation")
            if [item["command"] for item in executed] != REQUIRED_PASSES:
                raise ValueError("executed Gate command set/order drift")
            receipts = [dict(item) for item in executed]
            transition_id = (
                "G3-GATE-OPEN-"
                + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            )
            append_transition(
                {
                    "transition_seq": "",
                    "transition_id": transition_id,
                    "target_gate": "OPEN_G3_CODE",
                    "decision_sha256": sha256_path(decision_path),
                    "report_json_sha256": sha256_path(report_json_path),
                    "report_md_sha256": sha256_path(report_md_path),
                    "declaration_sha256": sha256_path(declaration_path),
                    "required_commands_sha256": required_commands_sha256(),
                    "command_receipts_json": canonical_receipts_bytes(receipts).decode("utf-8"),
                    "command_receipts_sha256": hashlib.sha256(
                        canonical_receipts_bytes(receipts)
                    ).hexdigest(),
                    "recorded_at": "",
                    "status": "COMMITTED_OPEN_AUTHORITATIVE_LIVE",
                },
                transition_path,
            )
            open_row_appended = True
            authority_check()
    except Exception:
        with guard():
            # The dedicated transition semaphore excludes another legitimate
            # opener/closer.  Preserve a separately advanced publication with
            # byte-CAS, but always remove this generation's staged authority.
            atomic_write(decision_path, prior_decision)
            if classification_path.read_bytes() == staged_classification:
                atomic_write(classification_path, prior_classification)
            _restore_if_unchanged(prior_publication, last_observed)
            if open_row_appended:
                append_transition(
                    {
                        "transition_seq": "",
                        "transition_id": (
                            "G3-GATE-CLOSE-"
                            + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
                        ),
                        "target_gate": "CLOSED_FAIL_SAFE",
                        "decision_sha256": sha256_path(decision_path),
                        "report_json_sha256": "",
                        "report_md_sha256": "",
                        "declaration_sha256": "",
                        "required_commands_sha256": "",
                        "command_receipts_json": "",
                        "command_receipts_sha256": "",
                        "recorded_at": "",
                        "status": "COMMITTED_CLOSED_FAIL_SAFE",
                    },
                    transition_path,
                )
        raise
    return {
        "status": "PASS",
        "transition": "CLOSED_TO_OPEN_AUTHORITATIVE_LIVE",
        "checks": len(executed),
        "commandReceipts": executed,
    }


# Backward-compatible internal name used by the hostile self-test.  Contrary to
# the historical implementation it does not hold the verification semaphore
# while spawning public validators.
open_under_lock = open_transition


def close_under_lock(
    path: Path = DECISION,
    transition_path: Path = TRANSITIONS,
    classification_path: Path = CENTRAL_CLASSIFICATIONS,
) -> dict[str, object]:
    prior = "UNKNOWN"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not gate_decision_errors(payload, require_open=True):
            prior = "OPEN_G3_CODE"
        elif not gate_decision_errors(payload, require_open=False):
            prior = "CLOSED_FAIL_SAFE"
    except (OSError, json.JSONDecodeError):
        pass
    atomic_write(path, canonical_bytes(False))
    atomic_write(
        classification_path,
        central_classification_bytes(classification_path, gate_open=False),
    )
    read_exact_decision(path, require_open=False)
    append_transition(
        {
            "transition_seq": "",
            "transition_id": (
                "G3-GATE-CLOSE-"
                + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            ),
            "target_gate": "CLOSED_FAIL_SAFE",
            "decision_sha256": sha256_path(path),
            "report_json_sha256": "",
            "report_md_sha256": "",
            "declaration_sha256": "",
            "required_commands_sha256": "",
            "command_receipts_json": "",
            "command_receipts_sha256": "",
            "recorded_at": "",
            "status": "COMMITTED_CLOSED_FAIL_SAFE",
        },
        transition_path,
    )
    return {"status": "PASS", "transition": f"{prior}_TO_CLOSED_FAIL_SAFE"}


def self_test() -> dict[str, object]:
    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-g3-gate-transition-") as temporary:
        root = Path(temporary)
        decision = root / "decision.json"
        report_json = root / "report.json"
        report_md = root / "report.md"
        declaration = root / "README.md"
        transitions = root / "transitions.csv"
        atomic_write(decision, canonical_bytes(False))
        atomic_write(report_json, b"old-json\n")
        atomic_write(report_md, b"old-md\n")
        atomic_write(declaration, b"declaration\n")
        atomic_write(transitions, csv_bytes([]))
        calls: list[list[str]] = []

        def passing(command: list[str]) -> tuple[int, str]:
            calls.append(command)
            return 0, "PASS"

        result = open_under_lock(
            decision_path=decision,
            report_json_path=report_json,
            report_md_path=report_md,
            declaration_path=declaration,
            transition_path=transitions,
            runner=passing,
            authority_check=lambda: None,
            commands=command_argvs(),
        )
        cases["closed-to-open-runs-exact-four"] = (
            result["checks"] == 4 and calls == command_argvs()
        )
        cases["successful-open-is-exact"] = not gate_decision_errors(
            json.loads(decision.read_text()), require_open=True
        )
        cases["open-commit-row-binds-four-receipts"] = not transition_register_errors(
            decision_path=decision,
            report_json_path=report_json,
            report_md_path=report_md,
            declaration_path=declaration,
            transition_path=transitions,
            require_open=True,
        )
        close_under_lock(decision, transitions)
        cases["close-is-exact-and-idempotent"] = (
            close_under_lock(decision, transitions)["status"] == "PASS"
            and not gate_decision_errors(json.loads(decision.read_text()), require_open=False)
        )
        prior_decision = decision.read_bytes()
        prior_json = report_json.read_bytes()
        prior_md = report_md.read_bytes()

        actual_commands = command_argvs()

        def failing(command: list[str]) -> tuple[int, str]:
            if command == actual_commands[1]:
                atomic_write(report_json, b"partial-json\n")
                atomic_write(report_md, b"partial-md\n")
                return 1, "FAIL"
            return 0, "PASS"

        try:
            open_under_lock(
                decision_path=decision,
                report_json_path=report_json,
                report_md_path=report_md,
                declaration_path=declaration,
                transition_path=transitions,
                runner=failing,
                authority_check=lambda: None,
                commands=actual_commands,
            )
            cases["command-failure-rolls-back"] = False
        except ValueError:
            cases["command-failure-rolls-back"] = (
                decision.read_bytes() == prior_decision
                and report_json.read_bytes() == prior_json
                and report_md.read_bytes() == prior_md
            )
        try:
            open_under_lock(
                decision_path=decision,
                report_json_path=report_json,
                report_md_path=report_md,
                declaration_path=declaration,
                transition_path=transitions,
                runner=passing,
                authority_check=lambda: (_ for _ in ()).throw(ValueError("seal")),
                commands=actual_commands,
            )
            cases["authority-failure-rolls-back"] = False
        except ValueError:
            cases["authority-failure-rolls-back"] = decision.read_bytes() == prior_decision
        malformed = root / "malformed.json"
        atomic_write(malformed, b'{}\n')
        try:
            open_under_lock(
                decision_path=malformed,
                report_json_path=report_json,
                report_md_path=report_md,
                declaration_path=declaration,
                transition_path=transitions,
                runner=passing,
                authority_check=lambda: None,
                commands=actual_commands,
            )
            cases["malformed-state-rejected"] = False
        except ValueError:
            cases["malformed-state-rejected"] = True

        class InjectedKill(BaseException):
            pass

        kill_rejected = 0
        for kill_after in range(4):
            atomic_write(decision, canonical_bytes(False))
            atomic_write(transitions, csv_bytes([]))
            calls_seen = 0

            def killed(command: list[str]) -> tuple[int, str]:
                nonlocal calls_seen
                current = calls_seen
                calls_seen += 1
                if current == kill_after:
                    raise InjectedKill()
                return 0, "PASS"

            try:
                open_under_lock(
                    decision_path=decision,
                    report_json_path=report_json,
                    report_md_path=report_md,
                    declaration_path=declaration,
                    transition_path=transitions,
                    runner=killed,
                    authority_check=lambda: None,
                    commands=actual_commands,
                )
            except InjectedKill:
                if transition_register_errors(
                    decision_path=decision,
                    report_json_path=report_json,
                    report_md_path=report_md,
                    declaration_path=declaration,
                    transition_path=transitions,
                    require_open=True,
                ):
                    kill_rejected += 1
        cases["kill-after-each-required-command-never-commits-open"] = kill_rejected == 4
    source = inspect.getsource(open_transition)
    cases["open-requires-publication-authority"] = "authority_check()" in source
    cases["open-failure-restores-decision-and-reports"] = all(
        marker in source
        for marker in (
            "atomic_write(decision_path, prior_decision)",
            "_restore_if_unchanged(prior_publication, last_observed)",
        )
    )
    cases["open-authority-is-last-append-only-commit-row"] = (
        source.find("append_transition(") < source.rfind("authority_check()")
        and "COMMITTED_OPEN_AUTHORITATIVE_LIVE" in source
    )
    cases["gate-command-display-contract-closed"] = [
        command_display(command) for command in command_argvs()
    ] == REQUIRED_PASSES
    cases["public-gate-commands-have-no-parent-lock-bypass"] = all(
        "--host-lock-held-by-parent" not in command for command in command_argvs()
    )
    return {
        "schema": "dwp.hris.g3-gate-transition-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--open", action="store_true")
    mode.add_argument("--close", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            result = self_test()
        else:
            with exclusive_host_semaphore(
                GATE_TRANSITION_SEMAPHORE, timeout_seconds=300.0
            ):
                if args.open:
                    result = open_transition()
                else:
                    with _verification_guard():
                        result = close_under_lock()
    except (OSError, ValueError, SemaphoreTimeoutError) as error:
        result = {
            "schema": "dwp.hris.g3-gate-transition-result.v1",
            "status": "FAIL",
            "transition": "NONE_FAIL_CLOSED",
            "errors": [str(error)],
        }
    else:
        result = {
            "schema": "dwp.hris.g3-gate-transition-result.v1",
            **result,
            "effectiveGate": (
                "OPEN_G3_CODE" if args.open else "CLOSED_FAIL_SAFE"
                if args.close else None
            ),
            "productionState": "NOT_AUTHORIZED_G6",
        }
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if args.compact else None,
            indent=None if args.compact else 2,
        )
    )
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
