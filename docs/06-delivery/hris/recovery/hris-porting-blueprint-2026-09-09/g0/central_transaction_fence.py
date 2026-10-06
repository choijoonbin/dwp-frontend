#!/usr/bin/env python3
"""Fail-closed dependency fence for the three mutable Control journals.

Every central writer holds ``hris-verification`` before calling these helpers.
A PREPARED journal is exclusively recoverable by its own recovery command; no
other checkpoint, delivery, proposal, or G4 append may consume its candidate
prefix because that prefix can still be rolled back.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    active_host_semaphore_capability,
)


G0 = Path(__file__).resolve().parent
MODERN_SUCCESSOR_PROMOTION_JOURNAL = (
    G0 / "modern-successor-promotion-transaction-state.json"
)
MODERN_SUCCESSOR_PROMOTION_SCHEMA = (
    "dwp.hris.modern-successor-promotion-transaction-state.v1"
)
MODERN_SUCCESSOR_PROMOTION_FIELDS = {
    "schema", "transactionId", "specPath", "specSha256", "phase", "status",
    "transactionDirectory", "promotionReportPath", "preparedAt", "updatedAt",
    "nextDestination", "installedDestinations", "receiptSha256",
    "priorJournalSha256",
}
TRANSACTIONS = {
    "G3_CONTROL_CHECKPOINT": {
        "path": G0 / "g3-control-checkpoint-transaction-state.json",
        "schema": "dwp.hris.g3.control-checkpoint-transaction-state.v1",
        "committedStatuses": {"CONTROL_CHECKPOINT_TRANSACTION_COMMITTED"},
        "preparedStatus": "CONTROL_CHECKPOINT_TRANSACTION_PREPARED",
        "fields": {
            "schema", "transactionSeq", "phase",
            "priorCheckpointRegisterSha256", "priorDependencyRegisterSha256",
            "candidateCheckpointRegisterSha256", "candidateDependencyRegisterSha256",
            "controlCheckpointProjectionSha256", "dependencyRegisterSha256",
            "checkpointId", "dependencyId", "lastDependencyId",
            "checkpointSeq", "dependencySeq", "bundleRef", "bundleSha256",
            "checkpointRecordedAt", "preparedAt", "committedAt", "priorState",
            "status",
        },
    },
    "G3_CONTROL_DELIVERY": {
        "path": G0 / "g3-control-delivery-state.json",
        "schema": "dwp.hris.g3.control-delivery-transaction-state.v1",
        "committedStatuses": {
            "HEADER_ONLY_CLOSED_GATE",
            "CONTROL_DELIVERY_TRANSACTION_COMMITTED",
        },
        "preparedStatus": "CONTROL_DELIVERY_TRANSACTION_PREPARED",
        "fields": {
            "schema", "transactionSeq", "phase",
            "priorReleaseRegisterSha256", "priorReceiptRegisterSha256",
            "candidateReleaseRegisterSha256", "candidateReceiptRegisterSha256",
            "releaseRegisterSha256", "receiptRegisterSha256",
            "releaseId", "receiptIds", "releaseSeq", "receiptSeq",
            "bundleRef", "bundleSha256", "preparedAt", "committedAt",
            "priorState", "status",
        },
    },
    "G4_FUNCTIONAL_GATE": {
        "path": G0 / "g4-functional-gate-state.json",
        "schema": "dwp.hris.g4-functional-gate-control-state.v2",
        "committedStatuses": {
            "CONTROL_REGISTER_INITIALIZED",
            "CONTROL_REGISTER_COMMITTED",
        },
        "preparedStatus": "CONTROL_REGISTER_PREPARED",
        "fields": {
            "schema", "transactionSeq", "phase", "priorRegisterSha256",
            "candidateRegisterSha256", "gateId", "aggregateRef",
            "aggregateSha256", "recordedAt", "preparedAt", "committedAt",
            "priorState", "status",
        },
    },
}


def transaction_phase_errors(
    payloads: dict[str, object],
    *,
    recovering: str | None = None,
) -> list[str]:
    errors: list[str] = []
    if recovering is not None and recovering not in TRANSACTIONS:
        return [f"unknown recovering transaction: {recovering}"]
    for name, contract in TRANSACTIONS.items():
        payload = payloads.get(name)
        if not isinstance(payload, dict):
            errors.append(f"{name}: transaction journal root is not an object")
            continue
        if payload.get("schema") != contract["schema"]:
            errors.append(f"{name}: transaction journal schema drift")
            continue
        phase = payload.get("phase")
        status = payload.get("status")
        if name == recovering:
            if phase != "PREPARED" or status != contract["preparedStatus"]:
                errors.append(f"{name}: recovery requires its exact PREPARED journal")
        elif phase != "COMMITTED" or status not in contract["committedStatuses"]:
            errors.append(
                f"{name}: central transaction is not COMMITTED; run only its own recovery"
            )
    return errors


def load_transaction_payloads() -> dict[str, object]:
    payloads: dict[str, object] = {}
    for name, contract in TRANSACTIONS.items():
        path = contract["path"]
        try:
            payloads[name] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"{name}: transaction journal unreadable: {error}") from error
    return payloads


def modern_successor_promotion_errors(
    path: Path = MODERN_SUCCESSOR_PROMOTION_JOURNAL,
) -> list[str]:
    """Fence the optional sixteen-file successor promotion transaction.

    Absence means no promotion has ever started.  Once created, only an exact
    terminal COMMITTED or ROLLED_BACK phase permits another central operation.
    PREPARED, COMMITTING and FINALIZING intentionally make Gate/readiness
    consumers fail closed while the common host semaphore excludes cooperating
    readers from the multi-path rename window.
    """
    try:
        path.lstat()
    except FileNotFoundError:
        return []
    except OSError as error:
        return [f"MODERN_SUCCESSOR_PROMOTION: journal unavailable: {error}"]
    if path.is_symlink() or not path.is_file():
        return ["MODERN_SUCCESSOR_PROMOTION: journal path is unsafe"]
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"MODERN_SUCCESSOR_PROMOTION: journal unreadable: {error}"]
    if not isinstance(payload, dict):
        return ["MODERN_SUCCESSOR_PROMOTION: journal root is not an object"]
    errors: list[str] = []
    if set(payload) != MODERN_SUCCESSOR_PROMOTION_FIELDS:
        errors.append("MODERN_SUCCESSOR_PROMOTION: journal field-set drift")
    if payload.get("schema") != MODERN_SUCCESSOR_PROMOTION_SCHEMA:
        errors.append("MODERN_SUCCESSOR_PROMOTION: journal schema drift")
    terminal = {
        "COMMITTED": "PROMOTION_TRANSACTION_COMMITTED",
        "ROLLED_BACK": "PROMOTION_TRANSACTION_ROLLED_BACK",
    }
    phase = payload.get("phase")
    status = payload.get("status")
    if terminal.get(phase) != status:
        errors.append(
            "MODERN_SUCCESSOR_PROMOTION: transaction is not terminal; "
            "run only promote_modern_successor_bundle.py --recover"
        )
    receipt = payload.get("receiptSha256")
    if phase == "COMMITTED" and not (
        isinstance(receipt, str)
        and len(receipt) == 64
        and all(character in "0123456789abcdef" for character in receipt)
    ):
        errors.append("MODERN_SUCCESSOR_PROMOTION: committed receipt hash drift")
    if phase == "ROLLED_BACK" and receipt is not None:
        errors.append("MODERN_SUCCESSOR_PROMOTION: rolled-back journal has a receipt")
    if not isinstance(payload.get("transactionId"), str):
        errors.append("MODERN_SUCCESSOR_PROMOTION: transaction identity drift")
    if not isinstance(payload.get("specSha256"), str):
        errors.append("MODERN_SUCCESSOR_PROMOTION: spec hash drift")
    return sorted(set(errors))


def assert_all_central_transactions_committed() -> None:
    errors = transaction_phase_errors(load_transaction_payloads())
    errors.extend(modern_successor_promotion_errors())
    if errors:
        raise ValueError("central transaction dependency fence: " + "; ".join(errors))


def assert_recovery_exclusive(recovering: str) -> None:
    errors = transaction_phase_errors(
        load_transaction_payloads(),
        recovering=recovering,
    )
    errors.extend(modern_successor_promotion_errors())
    if errors:
        raise ValueError("central transaction recovery fence: " + "; ".join(errors))


def retained_lock_recovery_errors(
    payloads: dict[str, object],
    recovering: str,
    expected_prepared: object,
) -> list[str]:
    """Validate one exact PREPARED generation and committed peers.

    This is the narrow state projection needed after a writer has durably
    installed its own PREPARED marker.  The ordinary all-COMMITTED authority
    check must fail at that point by design.  A retained-lock writer may keep
    going only when the on-disk journal is byte-semantically identical to the
    journal it just prepared, has the exact closed schema, advances one exact
    committed predecessor, and every *other* central journal remains committed.
    """
    errors = transaction_phase_errors(payloads, recovering=recovering)
    contract = TRANSACTIONS.get(recovering)
    observed = payloads.get(recovering)
    if contract is None:
        return sorted(set(errors))
    if not isinstance(expected_prepared, dict):
        errors.append(f"{recovering}: expected PREPARED journal is not an object")
        return sorted(set(errors))
    if observed != expected_prepared:
        errors.append(f"{recovering}: on-disk PREPARED journal differs from retained writer journal")
        return sorted(set(errors))
    if not isinstance(observed, dict) or set(observed) != contract["fields"]:
        errors.append(f"{recovering}: PREPARED journal field set drift")
        return sorted(set(errors))
    prior = observed.get("priorState")
    sequence = observed.get("transactionSeq")
    prior_sequence = prior.get("transactionSeq") if isinstance(prior, dict) else None
    if not (
        isinstance(sequence, int)
        and not isinstance(sequence, bool)
        and isinstance(prior_sequence, int)
        and not isinstance(prior_sequence, bool)
        and sequence == prior_sequence + 1
        and isinstance(prior, dict)
        and set(prior) == contract["fields"]
        and prior.get("schema") == contract["schema"]
        and prior.get("phase") == "COMMITTED"
        and prior.get("status") in contract["committedStatuses"]
        and prior.get("priorState") is None
    ):
        errors.append(f"{recovering}: PREPARED journal lacks one exact committed predecessor")
    return sorted(set(errors))


def exact_prepared_journal_bytes_errors(
    observed: bytes,
    expected_prepared: dict[str, object],
) -> list[str]:
    canonical = (
        json.dumps(
            expected_prepared,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")
    return [] if observed == canonical else [
        "on-disk PREPARED journal bytes are not the exact canonical retained journal"
    ]


def assert_retained_lock_recovery_exclusive(
    recovering: str,
    expected_prepared: dict[str, object],
) -> None:
    """Require the same-thread opaque host lease plus the exact PREPARED view."""
    if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
        raise ValueError(
            "central transaction retained-lock fence requires the active host semaphore"
        )
    errors = retained_lock_recovery_errors(
        load_transaction_payloads(), recovering, expected_prepared
    )
    contract = TRANSACTIONS.get(recovering)
    if contract is not None:
        path = contract["path"]
        try:
            if path.is_symlink() or not path.is_file():
                errors.append(f"{recovering}: PREPARED journal path is unsafe")
            else:
                errors.extend(
                    f"{recovering}: {error}"
                    for error in exact_prepared_journal_bytes_errors(
                        path.read_bytes(), expected_prepared
                    )
                )
        except OSError as error:
            errors.append(f"{recovering}: PREPARED journal bytes unreadable: {error}")
    if errors:
        raise ValueError(
            "central transaction retained-lock recovery fence: " + "; ".join(errors)
        )


def self_test() -> dict[str, object]:
    import sys
    import tempfile
    from unittest import mock

    from host_semaphore import exclusive_host_semaphore

    committed = {
        name: {
            "schema": contract["schema"],
            "phase": "COMMITTED",
            "status": sorted(contract["committedStatuses"])[0],
        }
        for name, contract in TRANSACTIONS.items()
    }
    cases: dict[str, bool] = {
        "all-committed-accepted": not transaction_phase_errors(committed),
    }
    for name, contract in TRANSACTIONS.items():
        prepared = {key: dict(value) for key, value in committed.items()}
        prepared[name].update(
            phase="PREPARED",
            status=contract["preparedStatus"],
        )
        cases[f"{name.lower()}-prepared-blocks-downstream"] = bool(
            transaction_phase_errors(prepared)
        )
        cases[f"{name.lower()}-prepared-allows-only-own-recovery"] = (
            not transaction_phase_errors(prepared, recovering=name)
            and all(
                transaction_phase_errors(prepared, recovering=other)
                for other in TRANSACTIONS
                if other != name
            )
        )
    wrong_schema = {key: dict(value) for key, value in committed.items()}
    wrong_schema["G3_CONTROL_DELIVERY"]["schema"] = "forged"
    cases["wrong-schema-rejected"] = bool(transaction_phase_errors(wrong_schema))
    recovering = "G3_CONTROL_CHECKPOINT"
    contract = TRANSACTIONS[recovering]
    prior = {field: None for field in contract["fields"]}
    prior.update(
        schema=contract["schema"],
        transactionSeq=4,
        phase="COMMITTED",
        priorState=None,
        status=sorted(contract["committedStatuses"])[0],
    )
    exact = {field: None for field in contract["fields"]}
    exact.update(
        schema=contract["schema"],
        transactionSeq=5,
        phase="PREPARED",
        priorState=prior,
        status=contract["preparedStatus"],
    )
    retained_payloads = {key: dict(value) for key, value in committed.items()}
    retained_payloads[recovering] = exact
    cases["retained-lock-exact-prepared-and-committed-peers-accepted"] = not (
        retained_lock_recovery_errors(retained_payloads, recovering, exact)
    )
    cases["retained-lock-different-writer-journal-rejected"] = bool(
        retained_lock_recovery_errors(
            retained_payloads,
            recovering,
            dict(exact, transactionSeq=6),
        )
    )
    bad_predecessor = dict(exact, priorState=dict(prior, phase="PREPARED"))
    bad_payloads = dict(retained_payloads, **{recovering: bad_predecessor})
    cases["retained-lock-nested-prepared-predecessor-rejected"] = bool(
        retained_lock_recovery_errors(bad_payloads, recovering, bad_predecessor)
    )
    foreign_prepared = {key: dict(value) for key, value in retained_payloads.items()}
    foreign = "G3_CONTROL_DELIVERY"
    foreign_prepared[foreign].update(
        phase="PREPARED", status=TRANSACTIONS[foreign]["preparedStatus"]
    )
    cases["retained-lock-foreign-prepared-journal-rejected"] = bool(
        retained_lock_recovery_errors(foreign_prepared, recovering, exact)
    )
    canonical_exact = (
        json.dumps(exact, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    cases["retained-lock-canonical-prepared-bytes-accepted"] = not (
        exact_prepared_journal_bytes_errors(canonical_exact, exact)
    )
    cases["retained-lock-semantically-equal-noncanonical-bytes-rejected"] = bool(
        exact_prepared_journal_bytes_errors(
            json.dumps(exact, ensure_ascii=False, sort_keys=True).encode("utf-8"),
            exact,
        )
    )
    with tempfile.TemporaryDirectory(prefix="hris-central-fence-") as temporary:
        fixture_root = Path(temporary)
        promotion_journal = fixture_root / "promotion.json"
        cases["absent-modern-promotion-journal-is-idle"] = not (
            modern_successor_promotion_errors(promotion_journal)
        )
        promotion_base = {
            "schema": MODERN_SUCCESSOR_PROMOTION_SCHEMA,
            "transactionId": "MODERN-SUCCESSOR-SELFTEST-0001",
            "specPath": "coding-readiness/reports/selftest-spec.json",
            "specSha256": "0" * 64,
            "transactionDirectory": "coding-readiness/.modern-successor-promotion/selftest",
            "promotionReportPath": "coding-readiness/reports/selftest-receipt.json",
            "preparedAt": "2026-09-16T00:00:00Z",
            "updatedAt": "2026-09-16T00:00:01Z",
            "nextDestination": None,
            "installedDestinations": [],
            "receiptSha256": None,
            "priorJournalSha256": None,
        }
        promotion_journal.write_text(
            json.dumps(
                {
                    **promotion_base,
                    "phase": "PREPARED",
                    "status": "PROMOTION_TRANSACTION_PREPARED",
                }
            ),
            encoding="utf-8",
        )
        cases["prepared-modern-promotion-blocks-central-readers"] = bool(
            modern_successor_promotion_errors(promotion_journal)
        )
        promotion_journal.write_text(
            json.dumps(
                {
                    **promotion_base,
                    "phase": "COMMITTED",
                    "status": "PROMOTION_TRANSACTION_COMMITTED",
                    "receiptSha256": "1" * 64,
                }
            ),
            encoding="utf-8",
        )
        cases["committed-modern-promotion-allows-central-readers"] = not (
            modern_successor_promotion_errors(promotion_journal)
        )
        promotion_journal.write_text("{}\n", encoding="utf-8")
        cases["malformed-modern-promotion-journal-blocks-central-readers"] = bool(
            modern_successor_promotion_errors(promotion_journal)
        )
        fixture_transactions = {
            name: {**contract, "path": fixture_root / f"{name}.json"}
            for name, contract in TRANSACTIONS.items()
        }
        for name, payload in retained_payloads.items():
            value = exact if name == recovering else payload
            fixture_transactions[name]["path"].write_bytes(
                (
                    json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
                    + "\n"
                ).encode("utf-8")
            )
        with mock.patch.object(
            sys.modules[__name__], "TRANSACTIONS", fixture_transactions
        ):
            with exclusive_host_semaphore(
                HOST_VERIFICATION_SEMAPHORE,
                lock_root=fixture_root / "locks",
            ):
                try:
                    assert_retained_lock_recovery_exclusive(recovering, exact)
                    cases["opaque-lock-exact-durable-prepared-journal-accepted"] = True
                except ValueError:
                    cases["opaque-lock-exact-durable-prepared-journal-accepted"] = False
                fixture_transactions[recovering]["path"].write_bytes(
                    json.dumps(exact, ensure_ascii=False, sort_keys=True).encode("utf-8")
                )
                try:
                    assert_retained_lock_recovery_exclusive(recovering, exact)
                    cases["opaque-lock-noncanonical-durable-journal-rejected"] = False
                except ValueError:
                    cases["opaque-lock-noncanonical-durable-journal-rejected"] = True
    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.central-transaction-fence-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "failedCases": failed,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    else:
        errors = transaction_phase_errors(load_transaction_payloads())
        errors.extend(modern_successor_promotion_errors())
        result = {
            "schema": "dwp.hris.central-transaction-fence.v1",
            "status": "PASS" if not errors else "FAIL",
            "errors": errors,
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
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
