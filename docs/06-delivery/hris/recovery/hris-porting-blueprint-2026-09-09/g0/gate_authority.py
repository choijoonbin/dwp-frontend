#!/usr/bin/env python3
"""Pure, fail-closed authority check for the current HRIS G3 code Gate.

The decision JSON is necessary but deliberately not sufficient.  A process
that is killed between staging ``OPEN_G3_CODE`` and publishing the current
LIVE report must never authorize a module writer.  Operational writers call
this function while holding the common host semaphore and require the exact
decision plus the sealed LIVE JSON/Markdown/declaration publication.

This module never acquires a lock and never writes a file.  The caller owns the
``hris-verification`` semaphore for the complete read/use critical section.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CODING = ROOT / "coding-readiness"
DECISION = G0 / "current-g3-gate-decision.json"
REPORT_JSON = CODING / "reports/full-coding-readiness-latest.json"
REPORT_MD = CODING / "reports/full-coding-readiness-latest.md"
DECLARATION = ROOT / "README.md"
TRANSITIONS = G0 / "g3-gate-transition-register.csv"
CENTRAL_CLASSIFICATIONS = G0 / "central-artifact-classification-register.csv"
TRANSITION_HEADER = [
    "transition_seq",
    "transition_id",
    "target_gate",
    "decision_sha256",
    "report_json_sha256",
    "report_md_sha256",
    "declaration_sha256",
    "required_commands_sha256",
    "command_receipts_json",
    "command_receipts_sha256",
    "recorded_at",
    "status",
]
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
TRANSITION_ID = re.compile(r"^G3-GATE-[A-Z0-9-]{6,120}$")
RECEIPT_FIELDS = {
    "command",
    "commandSha256",
    "completedAt",
    "outputSha256",
    "returnCode",
    "status",
}
CENTRAL_CLASSIFICATION_HEADER = [
    "classification_id",
    "artifact_class",
    "repository",
    "path_globs",
    "allocation_ids",
    "producer_session",
    "allowed_consumers",
    "delivery_mode",
    "source_provenance_requirement",
    "consumer_receipt_required",
    "module_direct_touch_allowed",
    "state",
]
CENTRAL_CLASSIFICATION_IDS = {
    f"CENTRAL-CLASS-{index:03d}" for index in range(1, 9)
}
ENTRY_BOOTSTRAP_CLASS_IDS = {
    "CENTRAL-CLASS-001",
    "CENTRAL-CLASS-002",
    "CENTRAL-CLASS-008",
}
# These are the only two permitted byte generations.  The three Gate-coupled
# state cells are the sole difference; every header, row, field, ordering and
# line ending remains bound by the immutable authority code.
CENTRAL_CLASSIFICATION_SHA256 = {
    "CLOSED_FAIL_SAFE": "6f365ab700e92334513077df43100e4f751d4e56f1d4eabe70010f2e1bb8f506",
    "OPEN_G3_CODE": "fa86037541ac9cf0153af620350c1cfb622239ca4b897ca5dda1334e5663bc65",
}

REQUIRED_PASSES = [
    "python3 g0/validate_code_checkpoint.py --check-live",
    "python3 coding-readiness/validate_full_coding_readiness.py --check-live --write-report",
    "python3 coding-readiness/validate_published_gate_truth.py --compact",
    "python3 coding-readiness/validate_published_gate_truth.py --self-test",
]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_receipts_bytes(receipts: list[dict[str, Any]]) -> bytes:
    return json.dumps(
        receipts,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def required_commands_sha256() -> str:
    return sha256_bytes(("\n".join(REQUIRED_PASSES) + "\n").encode("utf-8"))

COMMON_FIELDS: dict[str, Any] = {
    "schema": "dwp.hris.current-g3-gate-decision.v1",
    "basisDate": "2026-09-11",
    "decisionAuthority": "AUTHORITATIVE_LIVE_VALIDATOR_AND_PUBLISHED_TRUTH_ONLY",
    "designEligibility": "G3_ENGINEERING_SCOPE_DEFINED",
    "requiredPasses": REQUIRED_PASSES,
    "atomicOpenCondition": "ALL_REQUIRED_PASSES_AND_LATEST_REPORT_LIVE_AUTHORITATIVE_OPEN",
    "registerOpenTokensMeaning": "DESIGN_TARGET_OR_HISTORICAL_ENTRY_SEAL_NOT_CURRENT_EFFECTIVE_GATE",
    "productionActivation": "NOT_AUTHORIZED_G6",
}


def canonical_gate_payload(open_gate: bool) -> dict[str, Any]:
    return {
        **COMMON_FIELDS,
        "effectiveGate": "OPEN_G3_CODE" if open_gate else "CLOSED_FAIL_SAFE",
        "currentState": (
            "OPEN_AUTHORITATIVE_LIVE"
            if open_gate
            else "VALIDATOR_CONTROLLED_BLOCKED"
        ),
    }


def gate_decision_errors(payload: object, *, require_open: bool) -> list[str]:
    expected = canonical_gate_payload(require_open)
    if not isinstance(payload, dict) or payload != expected:
        return [
            "current G3 Gate decision is not the exact "
            + ("authoritative-open" if require_open else "fail-safe-closed")
            + " payload"
        ]
    return []


def _central_classification_rows(data: bytes) -> tuple[list[str], list[dict[str, str]]]:
    """Parse one exact-width central-classification CSV generation."""
    try:
        records = list(csv.reader(io.StringIO(data.decode("utf-8-sig"))))
    except (UnicodeDecodeError, csv.Error) as error:
        raise ValueError(f"central artifact classification CSV unreadable: {error}") from error
    if not records or records[0] != CENTRAL_CLASSIFICATION_HEADER:
        raise ValueError("central artifact classification header drift")
    if any(len(record) != len(CENTRAL_CLASSIFICATION_HEADER) for record in records[1:]):
        raise ValueError("central artifact classification row width drift")
    rows = [dict(zip(CENTRAL_CLASSIFICATION_HEADER, record)) for record in records[1:]]
    return records[0], rows


def _central_classification_generation(data: bytes, *, gate_open: bool) -> bytes:
    """Render the other canonical state generation without changing other cells."""
    header, rows = _central_classification_rows(data)
    target = "ENTRY_BASELINE_VERIFIED" if gate_open else "CODE_ENTRY_BOOTSTRAP_PENDING"
    for row in rows:
        if row["classification_id"] in ENTRY_BOOTSTRAP_CLASS_IDS:
            row["state"] = target
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=header, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def central_classification_errors(
    decision: object,
    *,
    path: Path = CENTRAL_CLASSIFICATIONS,
) -> list[str]:
    """Require the exact central classification generation tied to the Gate."""
    if not gate_decision_errors(decision, require_open=True):
        gate = "OPEN_G3_CODE"
        target_state = "ENTRY_BASELINE_VERIFIED"
    elif not gate_decision_errors(decision, require_open=False):
        gate = "CLOSED_FAIL_SAFE"
        target_state = "CODE_ENTRY_BOOTSTRAP_PENDING"
    else:
        return ["central artifact classification cannot bind an invalid Gate decision"]
    if path.is_symlink() or not path.is_file():
        return ["central artifact classification register missing or unsafe"]
    try:
        data = path.read_bytes()
        _header, rows = _central_classification_rows(data)
    except (OSError, ValueError) as error:
        return [str(error)]
    errors: list[str] = []
    ids = [row["classification_id"] for row in rows]
    if len(rows) != len(CENTRAL_CLASSIFICATION_IDS) or set(ids) != CENTRAL_CLASSIFICATION_IDS:
        errors.append("central artifact classification exact row identity set drift")
    if len(ids) != len(set(ids)):
        errors.append("central artifact classification duplicate row identity")
    by_id = {row["classification_id"]: row for row in rows}
    for class_id in sorted(ENTRY_BOOTSTRAP_CLASS_IDS):
        if by_id.get(class_id, {}).get("state") != target_state:
            errors.append(f"{class_id}: central Gate-coupled state mismatch for {gate}")
    if sha256_bytes(data) != CENTRAL_CLASSIFICATION_SHA256[gate]:
        errors.append(
            "central artifact classification is not the exact canonical "
            f"{gate} generation"
        )
    return sorted(set(errors))


def transition_register_errors(
    *,
    decision_path: Path = DECISION,
    report_json_path: Path = REPORT_JSON,
    report_md_path: Path = REPORT_MD,
    declaration_path: Path = DECLARATION,
    transition_path: Path = TRANSITIONS,
    require_open: bool = True,
) -> list[str]:
    """Validate the append-only row that atomically commits Gate authority."""
    errors: list[str] = []
    try:
        with transition_path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if list(reader.fieldnames or []) != TRANSITION_HEADER:
                return ["G3 Gate transition register header drift"]
            rows = list(reader)
    except OSError as error:
        return [f"G3 Gate transition register unavailable: {error}"]
    seen: set[str] = set()
    prior_time = ""
    for index, row in enumerate(rows, 1):
        transition_id = row.get("transition_id", "")
        target = row.get("target_gate", "")
        status = row.get("status", "")
        recorded_at = row.get("recorded_at", "")
        if row.get("transition_seq") != str(index):
            errors.append(f"G3 Gate transition row {index} sequence drift")
        if not TRANSITION_ID.fullmatch(transition_id) or transition_id in seen:
            errors.append(f"G3 Gate transition row {index} ID drift")
        seen.add(transition_id)
        if not ISO_UTC.fullmatch(recorded_at) or (prior_time and recorded_at <= prior_time):
            errors.append(f"G3 Gate transition row {index} time drift")
        prior_time = recorded_at
        digest_fields = (
            "decision_sha256",
            "report_json_sha256",
            "report_md_sha256",
            "declaration_sha256",
            "required_commands_sha256",
            "command_receipts_sha256",
        )
        if target == "OPEN_G3_CODE":
            try:
                receipts = json.loads(row.get("command_receipts_json", ""))
            except json.JSONDecodeError:
                receipts = None
            if not (
                status == "COMMITTED_OPEN_AUTHORITATIVE_LIVE"
                and all(SHA256.fullmatch(row.get(field, "")) for field in digest_fields)
                and row.get("required_commands_sha256") == required_commands_sha256()
                and isinstance(receipts, list)
                and len(receipts) == len(REQUIRED_PASSES)
                and [item.get("command") for item in receipts if isinstance(item, dict)]
                == REQUIRED_PASSES
                and all(
                    isinstance(item, dict)
                    and set(item) == RECEIPT_FIELDS
                    and item.get("commandSha256")
                    == sha256_bytes((str(item.get("command", "")) + "\n").encode("utf-8"))
                    and item.get("returnCode") == 0
                    and item.get("status") == "PASS"
                    and SHA256.fullmatch(str(item.get("commandSha256", "")))
                    and SHA256.fullmatch(str(item.get("outputSha256", "")))
                    and ISO_UTC.fullmatch(str(item.get("completedAt", "")))
                    for item in receipts
                )
                and row.get("command_receipts_sha256")
                == sha256_bytes(canonical_receipts_bytes(receipts))
            ):
                errors.append(f"G3 Gate transition row {index} open receipt drift")
            if isinstance(receipts, list):
                receipt_times = [
                    str(item.get("completedAt", ""))
                    for item in receipts
                    if isinstance(item, dict)
                ]
                if (
                    len(receipt_times) != len(REQUIRED_PASSES)
                    or receipt_times != sorted(receipt_times)
                    or len(set(receipt_times)) != len(receipt_times)
                    or (receipt_times and recorded_at <= receipt_times[-1])
                ):
                    errors.append(f"G3 Gate transition row {index} receipt time/order drift")
        elif target == "CLOSED_FAIL_SAFE":
            if not (
                status == "COMMITTED_CLOSED_FAIL_SAFE"
                and SHA256.fullmatch(row.get("decision_sha256", ""))
                and all(not row.get(field, "") for field in digest_fields[1:])
                and not row.get("command_receipts_json", "")
            ):
                errors.append(f"G3 Gate transition row {index} close receipt drift")
        else:
            errors.append(f"G3 Gate transition row {index} target drift")

    if require_open:
        if not rows or rows[-1].get("target_gate") != "OPEN_G3_CODE":
            errors.append("latest G3 Gate transition is not committed OPEN")
        else:
            latest = rows[-1]
            try:
                exact = {
                    "decision_sha256": sha256_path(decision_path),
                    "report_json_sha256": sha256_path(report_json_path),
                    "report_md_sha256": sha256_path(report_md_path),
                    "declaration_sha256": sha256_path(declaration_path),
                }
            except OSError as error:
                errors.append(f"G3 Gate transition bound file unavailable: {error}")
            else:
                for field, digest in exact.items():
                    if latest.get(field) != digest:
                        errors.append(f"latest G3 Gate transition {field} is stale")
            try:
                report = json.loads(report_json_path.read_text(encoding="utf-8"))
                receipts = json.loads(latest.get("command_receipts_json", ""))
                generated_at = str(report.get("generatedAt", ""))
                full_completed_at = str(receipts[1].get("completedAt", ""))
            except (OSError, json.JSONDecodeError, AttributeError, IndexError, TypeError):
                errors.append("latest G3 Gate transition report-generation receipt is unreadable")
            else:
                if not ISO_UTC.fullmatch(generated_at) or full_completed_at < generated_at:
                    errors.append(
                        "latest G3 Gate transition predates its bound LIVE report generation"
                    )
    return sorted(set(errors))


def authoritative_gate_errors() -> list[str]:
    """Return errors unless decision and current publication form one seal."""
    errors: list[str] = []
    try:
        decision = json.loads(DECISION.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"current G3 Gate decision is unavailable: {error}"]
    errors.extend(gate_decision_errors(decision, require_open=True))
    errors.extend(central_classification_errors(decision))
    missing = [
        path for path in (REPORT_JSON, REPORT_MD, DECLARATION) if not path.is_file()
    ]
    if missing:
        errors.extend(f"authoritative Gate publication missing: {path}" for path in missing)
        return sorted(set(errors))
    try:
        report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
        markdown = REPORT_MD.read_text(encoding="utf-8")
        declaration = DECLARATION.read_text(encoding="utf-8")
        if not isinstance(report, dict):
            raise ValueError("LIVE report root is not an object")
        if str(CODING) not in sys.path:
            sys.path.insert(0, str(CODING))
        from validate_published_gate_truth import validate

        errors.extend(
            validate(
                report,
                markdown,
                declaration,
                verify_files=True,
                allow_runtime_successors=True,
            )
        )
    except (OSError, ValueError, json.JSONDecodeError, ImportError) as error:
        errors.append(f"authoritative Gate publication is unreadable: {error}")
    errors.extend(transition_register_errors(require_open=True))
    return sorted(set(errors))


def assert_authoritative_gate_open() -> None:
    errors = authoritative_gate_errors()
    if errors:
        raise ValueError("current authoritative G3 Gate is closed: " + "; ".join(errors))


def self_test() -> dict[str, object]:
    from unittest import mock

    closed = canonical_gate_payload(False)
    opened = canonical_gate_payload(True)
    cases = {
        "closed-payload-exact": not gate_decision_errors(closed, require_open=False),
        "open-payload-exact": not gate_decision_errors(opened, require_open=True),
        "closed-does-not-authorize": bool(gate_decision_errors(closed, require_open=True)),
        "open-does-not-validate-as-closed": bool(
            gate_decision_errors(opened, require_open=False)
        ),
        "extra-field-rejected": bool(
            gate_decision_errors({**opened, "bypass": True}, require_open=True)
        ),
        "required-command-set-is-closed": opened["requiredPasses"] == REQUIRED_PASSES,
        "production-remains-g6-closed": (
            opened["productionActivation"] == "NOT_AUTHORIZED_G6"
        ),
        "required-command-digest-stable": SHA256.fullmatch(required_commands_sha256())
        is not None,
    }
    classification_case_names = {
        "closed-classification-generation-exact",
        "open-state-mismatch-rejected",
        "open-classification-generation-exact",
        "closed-state-mismatch-rejected",
        "non-state-field-tamper-rejected",
        "missing-row-rejected",
        "extra-duplicate-row-rejected",
    }
    try:
        current_classification = CENTRAL_CLASSIFICATIONS.read_bytes()
        if sha256_bytes(current_classification) not in set(
            CENTRAL_CLASSIFICATION_SHA256.values()
        ):
            raise ValueError("live central classification is not one canonical generation")
        closed_classification = _central_classification_generation(
            current_classification, gate_open=False
        )
        open_classification = _central_classification_generation(
            current_classification, gate_open=True
        )
        with tempfile.TemporaryDirectory(prefix="hris-central-classification-") as temporary:
            fixture = Path(temporary) / "central-classification.csv"
            fixture.write_bytes(closed_classification)
            cases["closed-classification-generation-exact"] = not central_classification_errors(
                closed, path=fixture
            )
            cases["open-state-mismatch-rejected"] = bool(
                central_classification_errors(opened, path=fixture)
            )
            fixture.write_bytes(open_classification)
            cases["open-classification-generation-exact"] = not central_classification_errors(
                opened, path=fixture
            )
            cases["closed-state-mismatch-rejected"] = bool(
                central_classification_errors(closed, path=fixture)
            )
            fixture.write_bytes(
                open_classification.replace(b"DWP_BACKEND", b"DWP_BACKENX", 1)
            )
            cases["non-state-field-tamper-rejected"] = bool(
                central_classification_errors(opened, path=fixture)
            )
            records = open_classification.splitlines(keepends=True)
            fixture.write_bytes(b"".join([records[0], *records[2:]]))
            cases["missing-row-rejected"] = bool(
                central_classification_errors(opened, path=fixture)
            )
            fixture.write_bytes(open_classification + records[1])
            cases["extra-duplicate-row-rejected"] = bool(
                central_classification_errors(opened, path=fixture)
            )
    except (OSError, ValueError):
        cases.update({name: False for name in classification_case_names})
    cases["unsupported-prepared-transaction-rejected"] = bool(
        prepared_transaction_gate_seal_errors("UNREGISTERED", {})
    )
    with mock.patch.object(
        sys.modules[__name__],
        "active_host_semaphore_capability",
        return_value=None,
    ):
        cases["prepared-authority-without-opaque-host-lease-rejected"] = bool(
            prepared_transaction_gate_seal_errors(
                "G3_CONTROL_CHECKPOINT", {"priorState": {}}
            )
        )
    with tempfile.TemporaryDirectory(prefix="hris-prepared-gate-seal-") as temporary:
        fixture_root = Path(temporary)
        fixture_decision = fixture_root / "decision.json"
        fixture_report = fixture_root / "report.json"
        fixture_markdown = fixture_root / "report.md"
        fixture_declaration = fixture_root / "README.md"
        fixture_decision.write_text(
            json.dumps(opened, ensure_ascii=False), encoding="utf-8"
        )
        fixture_report.write_text("{}\n", encoding="utf-8")
        fixture_markdown.write_text("fixture\n", encoding="utf-8")
        fixture_declaration.write_text("fixture\n", encoding="utf-8")
        prior = {"schema": "fixture-prior", "transactionSeq": 7}
        expected_prepared = {"priorState": prior, "transactionSeq": 8}
        observed: dict[str, object] = {}

        def fixture_validate(
            _report: dict[str, object],
            _markdown: str,
            _declaration: str,
            **keywords: object,
        ) -> list[str]:
            observed.update(keywords)
            return []

        import central_transaction_fence as transaction_fence
        if str(CODING) not in sys.path:
            sys.path.insert(0, str(CODING))
        import validate_published_gate_truth as publication_validator

        module = sys.modules[__name__]
        with (
            mock.patch.object(module, "DECISION", fixture_decision),
            mock.patch.object(module, "REPORT_JSON", fixture_report),
            mock.patch.object(module, "REPORT_MD", fixture_markdown),
            mock.patch.object(module, "DECLARATION", fixture_declaration),
            mock.patch.object(
                module, "active_host_semaphore_capability", return_value=object()
            ),
            mock.patch.object(module, "central_classification_errors", return_value=[]),
            mock.patch.object(module, "transition_register_errors", return_value=[]),
            mock.patch.object(
                transaction_fence,
                "assert_retained_lock_recovery_exclusive",
                return_value=None,
            ),
            mock.patch.object(publication_validator, "validate", side_effect=fixture_validate),
        ):
            prepared_errors = prepared_transaction_gate_seal_errors(
                "G3_CONTROL_CHECKPOINT", expected_prepared
            )
        overrides = observed.get("runtime_successor_current_bytes")
        projected = (
            overrides.get(PREPARED_TRANSACTION_STATE_REFS["G3_CONTROL_CHECKPOINT"])
            if isinstance(overrides, dict)
            else None
        )
        cases["prepared-authority-projects-only-exact-prior-generation"] = (
            not prepared_errors
            and observed.get("verify_files") is True
            and observed.get("allow_runtime_successors") is True
            and isinstance(projected, bytes)
            and json.loads(projected.decode("utf-8")) == prior
            and set(overrides or {})
            == {PREPARED_TRANSACTION_STATE_REFS["G3_CONTROL_CHECKPOINT"]}
        )
    return {
        "schema": "dwp.hris.g3-gate-authority-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


if __name__ == "__main__":
    result = self_test()
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    raise SystemExit(0 if result["status"] == "PASS" else 1)
