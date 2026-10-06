#!/usr/bin/env python3
"""Validate immutable G2 predecessors and explicit current blueprint successors."""

from __future__ import annotations

import argparse
import copy
import csv
import difflib
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G0 = ROOT / "g0"
LINEAGE_PATH = G0 / "blueprint-artifact-successor-lineage.csv"
POINTER_PATH = G0 / "current-blueprint-artifact-pointer.csv"
SEALED_PATH = G0 / "g1-g2-sealed-artifact-register.csv"
MODERN_EXACT_PATH = ROOT / "coding-readiness/modern-capability-exact-schema-contracts.v1.json"
MODERN_EVENTS_PATH = ROOT / "coding-readiness/modern-capability-event-payload-contracts.v1.json"

LINEAGE_HEADER = [
    "lineage_id", "artifact_id", "owner_session_id", "predecessor_path",
    "predecessor_sha256", "successor_path", "successor_sha256", "change_reason",
    "authority_role", "basis_date", "state",
]
POINTER_HEADER = ["artifact_id", "lineage_id", "current_path", "current_sha256", "pointer_state"]

EXPECTED = {
    "PER_MODERN_CAPABILITY_CONTRACT": {
        "lineage_id": "BLUEPRINT-LINEAGE-PER-MODERN-V2",
        "owner_session_id": "HRIS-PER",
        "predecessor_path": "session-evidence/per/g3-modern-capability-contracts.v1.json",
        "predecessor_sha256": "871e0cc20d74e81848d9c773bbc1d74ff2edb200aae3f7679b7adaf38de4efea",
        "successor_path": "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "successor_sha256": "e4b221549aa80f34944a352e7466221dfb0ba4969ce5a2ddc24d8c4dd75bd92f",
        "change_reason": "PER separate Flyway stream rebase from shared People V84..V89 to performance V17..V22",
        "authority_role": "ROLE.ARCHITECTURE_AUTHORITY",
        "basis_date": "2026-09-11",
    },
    "SYS_READINESS_VALIDATOR": {
        "lineage_id": "BLUEPRINT-LINEAGE-SYS-VALIDATOR-V2",
        "owner_session_id": "HRIS-SYS",
        "predecessor_path": "session-evidence/sys/validate_sys_readiness.py",
        "predecessor_sha256": "030fd2eb4189846da9385b47606468aaf545091032b4b134f902be52662fc823",
        "successor_path": "session-evidence/sys/validate_sys_readiness.v2.py",
        "successor_sha256": "9774ac9c91dd6f853ad8aa0822adfd023967a85154f571ddd37ace98c4fc4299",
        "change_reason": "128-duty and PDX-012..016 closure plus exact six-stream C1 and Listening migration authority validation without rewriting sealed G2 validator",
        "authority_role": "ROLE.INTEGRATION_CONTROL",
        "basis_date": "2026-09-15",
    },
    "SYS_IMPLEMENTATION_CONTRACT": {
        "lineage_id": "BLUEPRINT-LINEAGE-SYS-IMPLEMENTATION-V2",
        "owner_session_id": "HRIS-SYS",
        "predecessor_path": "session-evidence/sys/g2-implementation-contract.md",
        "predecessor_sha256": "2dbabebfc52c2175193821f72a3b9bf5b33b83110ed871f88e35ab07c8e0f871",
        "successor_path": "session-evidence/sys/g2-implementation-contract.v2.md",
        "successor_sha256": "8e5a97efc4cd4cf5ade1422976a9300b3dba7590014a5d2173a11eb66da74f30",
        "change_reason": "Current six-stream SYS migration authority including four isolated Listening databases while preserving sealed G2 evidence",
        "authority_role": "ROLE.ARCHITECTURE_AUTHORITY",
        "basis_date": "2026-09-15",
    },
}

CURRENT_CONSUMERS = {
    "PER_MODERN_CAPABILITY_CONTRACT": {
        "coding-readiness/modern-capability-coding-contract-register.csv",
        "coding-readiness/validate_modern_capability_contracts.py",
        "coding-readiness/validate_modern_capability_authorization.py",
        "coding-readiness/generate_information_architecture_register.py",
        "coding-readiness/generate_ia_entry_query_projection_schemas.py",
        "coding-readiness/validate_ia_node_access_contracts.py",
        "coding-readiness/generate_modern_causal_successor.py",
        "coding-readiness/validate_modern_causal_state_contracts.py",
        "coding-readiness/validate_compensation_snapshot_v2_authority.py",
        "coding-readiness/validate_cross_module_schema_contracts.py",
        "coding-readiness/validate_modern_causal_independent_oracle.py",
        "coding-readiness/validate_full_coding_readiness.py",
    },
    "SYS_READINESS_VALIDATOR": {
        "coding-readiness/module-code-gate-register.csv",
        "coding-readiness/generate_g3_slice_code_go_register.py",
        "coding-readiness/validate_g3_slice_code_go.py",
        "coding-readiness/validate_full_coding_readiness.py",
        "g0/validate_code_checkpoint.py",
    },
    "SYS_IMPLEMENTATION_CONTRACT": {
        "coding-readiness/module-code-gate-register.csv",
        "coding-readiness/validate_full_coding_readiness.py",
    },
}

# The aggregate validator intentionally seals both immutable predecessors and
# their current successors in its artifact digest set.  Those exact hash-list
# literals are historical provenance, not executable current pointers.
HISTORICAL_HASH_CONSUMERS = {
    "coding-readiness/validate_full_coding_readiness.py",
}

# These are hashes of the fully reviewed predecessor -> successor unified
# deltas, not blind file re-pins.  The structural checks below explain and
# constrain what each exact delta is allowed to do.
SYS_VALIDATOR_ALLOWED_DIFF_SHA256 = (
    "cb73ab322513ae22a699d9fe9f37decf6c2417c04d12c74c79e84af5c9bbb881"
)
SYS_IMPLEMENTATION_ALLOWED_DIFF_SHA256 = (
    "58f308573a927ce124fbfa892b14c6f5610c7422030d9a51b8ce62bd27ca0ed9"
)

PER_CAPABILITY_IDS = [
    "HRIS.MODERN.SKILLS_ONTOLOGY",
    "HRIS.MODERN.GROWTH_PROFILE",
    "HRIS.MODERN.LEARNING",
    "HRIS.MODERN.INTERNAL_MARKETPLACE",
    "HRIS.MODERN.SUCCESSION",
    "HRIS.MODERN.COMPENSATION_PLANNING",
]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expected_per_successor(predecessor: dict[str, object]) -> dict[str, object]:
    """Derive the only allowed PER v2 body from immutable v1 and reviewed SSOTs.

    The historical v1 first receives only its six reserved Flyway stream
    substitutions.  Every other current field must then be the deterministic
    modern causal/event projection.  This rejects a digest that was merely
    re-pinned after an arbitrary manual edit.
    """
    capability_rows = predecessor.get("capabilities")
    if not isinstance(capability_rows, list):
        raise ValueError("PER predecessor capabilities must be a list")
    capabilities = [row for row in capability_rows if isinstance(row, dict)]
    if [row.get("capabilityId") for row in capabilities] != PER_CAPABILITY_IDS:
        raise ValueError("PER predecessor capability order/set drift")
    projected = copy.deepcopy(predecessor)
    projected_capabilities = projected["capabilities"]
    for index, capability in enumerate(projected_capabilities):
        old_prefix = f"dwp-people-server/src/main/resources/db/migration/V{84 + index}__"
        new_prefix = (
            "dwp-people-server/src/main/resources/db/performance-migration/"
            f"V{17 + index}__"
        )
        migration = capability.get("migrationFile", "")
        if not isinstance(migration, str) or not migration.startswith(old_prefix):
            raise ValueError(f"PER predecessor migration path drift at index {index}")
        capability["migrationFile"] = new_prefix + migration.removeprefix(old_prefix)

    modern_path = ROOT / "coding-readiness"
    modern_path_text = str(modern_path)
    if modern_path_text not in sys.path:
        sys.path.insert(0, modern_path_text)
    from modern_causal_successor import (  # pylint: disable=import-outside-toplevel
        apply_exact_source_successor,
        apply_module_successor,
    )

    exact = json.loads(MODERN_EXACT_PATH.read_text(encoding="utf-8"))
    events = json.loads(MODERN_EVENTS_PATH.read_text(encoding="utf-8"))
    apply_exact_source_successor(exact, events)
    exact["_causalEventSchemas"] = events["eventPayloadSchemas"]
    apply_module_successor(projected, exact)
    return projected


def validate_per_semantic_successor(
    predecessor: dict[str, object], successor: dict[str, object]
) -> list[str]:
    errors: list[str] = []
    try:
        expected = expected_per_successor(predecessor)
    except (ImportError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return [f"PER deterministic successor derivation failed: {exc}"]
    if successor != expected:
        errors.append(
            "PER successor must be exactly immutable v1 plus six-file rebase and "
            "the reviewed modern causal/event projection"
        )
    if successor.get("session") != "HRIS-PER" or successor.get("status") != (
        "G3_CONTRACT_READY_NOT_IMPLEMENTED"
    ):
        errors.append("PER successor session/implementation boundary drift")
    if any(
        token in json.dumps(successor, ensure_ascii=False).upper()
        for token in ("BENSK", "ADDSK")
    ):
        errors.append("PER successor imported an explicitly excluded company extension")
    return errors


def unified_delta_sha(
    predecessor: str, successor: str, predecessor_name: str, successor_name: str
) -> str:
    delta = "".join(
        difflib.unified_diff(
            predecessor.splitlines(keepends=True),
            successor.splitlines(keepends=True),
            fromfile=predecessor_name,
            tofile=successor_name,
            n=3,
        )
    ).encode("utf-8")
    return hashlib.sha256(delta).hexdigest()


def validate_sys_validator_delta(predecessor: str, successor: str) -> list[str]:
    errors: list[str] = []
    if unified_delta_sha(
        predecessor,
        successor,
        "validate_sys_readiness.py",
        "validate_sys_readiness.v2.py",
    ) != SYS_VALIDATOR_ALLOWED_DIFF_SHA256:
        errors.append("SYS validator successor diff is outside the reviewed semantic closure")
    required_markers = (
        'MODULE / "g2-implementation-contract.v2.md"',
        "validate_sys_migration_authority",
        "MIG-SYS-AUTH-217-245",
        "MIG-SYS-PLATFORM-262-290",
        "MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40",
        "MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40",
        "MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40",
        "MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40",
        "expected exactly 128 atomic duties",
        "dependencyCount\") == 6",
        "schemaCount\") == 14",
        "consumerTestAllocationCount\") == 64",
        "migrationAuthoritySelfTests",
    )
    for marker in required_markers:
        if marker not in successor:
            errors.append(f"SYS validator successor lacks reviewed marker: {marker}")
    return errors


def validate_sys_implementation_delta(predecessor: str, successor: str) -> list[str]:
    errors: list[str] = []
    if unified_delta_sha(
        predecessor,
        successor,
        "g2-implementation-contract.md",
        "g2-implementation-contract.v2.md",
    ) != SYS_IMPLEMENTATION_ALLOWED_DIFF_SHA256:
        errors.append("SYS implementation successor diff is outside the reviewed semantic closure")
    required_markers = (
        "SUPERSEDED_IMMUTABLE",
        "g0/migration-allocation-register.csv",
        "coding-readiness/sys-listening-stream-authority-successor.v1.json",
        "MIG-SYS-AUTH-217-245",
        "MIG-SYS-PLATFORM-262-290",
        "MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40",
        "MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40",
        "MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40",
        "MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40",
        "flyway_hris_configuration_history",
        "flyway_hris_listening_protected_history",
        "flyway_hris_insights_history",
        "flyway_hris_participation_issuer_history",
        "runtime-only startup seal",
        "NOT_STARTED_G3",
        "DEP-015",
        "DEP-016",
        "64개 consumer test",
    )
    for marker in required_markers:
        if marker not in successor:
            errors.append(f"SYS implementation successor lacks reviewed marker: {marker}")
    for stale in ("Auth V211–V239", "Platform V231–V259", "V211..V239", "V231..V259"):
        if stale in successor:
            errors.append(f"SYS implementation successor retains stale authority: {stale}")
    return errors


def validate(
    lineage_rows: list[dict[str, str]] | None = None,
    pointer_rows: list[dict[str, str]] | None = None,
    file_bytes: dict[str, bytes] | None = None,
    consumer_text: dict[str, str] | None = None,
) -> list[str]:
    errors: list[str] = []
    lineage_header, disk_lineage = read_csv(LINEAGE_PATH)
    pointer_header, disk_pointers = read_csv(POINTER_PATH)
    lineage_rows = disk_lineage if lineage_rows is None else lineage_rows
    pointer_rows = disk_pointers if pointer_rows is None else pointer_rows
    if lineage_header != LINEAGE_HEADER:
        errors.append("lineage header drift")
    if pointer_header != POINTER_HEADER:
        errors.append("pointer header drift")
    lineage = {row.get("artifact_id", ""): row for row in lineage_rows}
    pointers = {row.get("artifact_id", ""): row for row in pointer_rows}
    if len(lineage_rows) != len(lineage) or set(lineage) != set(EXPECTED):
        errors.append("lineage artifact set must be exact and unique")
    if len(pointer_rows) != len(pointers) or set(pointers) != set(EXPECTED):
        errors.append("current pointer set must be exact and unique")

    def content(path: str) -> bytes:
        if file_bytes is not None and path in file_bytes:
            return file_bytes[path]
        return (ROOT / path).read_bytes()

    for artifact_id, expected in EXPECTED.items():
        row = lineage.get(artifact_id, {})
        pointer = pointers.get(artifact_id, {})
        for key, value in expected.items():
            if row.get(key) != value:
                errors.append(f"{artifact_id}: {key} drift")
        if row.get("state") != "CURRENT_SUCCESSOR":
            errors.append(f"{artifact_id}: basis/state drift")
        if not row.get("change_reason"):
            errors.append(f"{artifact_id}: change reason missing")
        if pointer != {
            "artifact_id": artifact_id,
            "lineage_id": expected["lineage_id"],
            "current_path": expected["successor_path"],
            "current_sha256": expected["successor_sha256"],
            "pointer_state": "CURRENT_EXACT",
        }:
            errors.append(f"{artifact_id}: current pointer drift")
        for path_key, digest_key in (("predecessor_path", "predecessor_sha256"), ("successor_path", "successor_sha256")):
            path = row.get(path_key, "")
            try:
                data = content(path)
            except OSError:
                errors.append(f"{artifact_id}: {path_key} missing")
                continue
            if hashlib.sha256(data).hexdigest() != row.get(digest_key):
                errors.append(f"{artifact_id}: {path_key} digest drift")

    try:
        old_per = json.loads(content(EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["predecessor_path"]))
        new_per = json.loads(content(EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["successor_path"]))
        errors.extend(validate_per_semantic_successor(old_per, new_per))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        errors.append("PER predecessor/successor semantic comparison failed")

    old_sys = content(
        EXPECTED["SYS_READINESS_VALIDATOR"]["predecessor_path"]
    ).decode("utf-8")
    new_sys = content(
        EXPECTED["SYS_READINESS_VALIDATOR"]["successor_path"]
    ).decode("utf-8")
    errors.extend(validate_sys_validator_delta(old_sys, new_sys))

    old_sys_contract = content(
        EXPECTED["SYS_IMPLEMENTATION_CONTRACT"]["predecessor_path"]
    ).decode("utf-8")
    new_sys_contract = content(
        EXPECTED["SYS_IMPLEMENTATION_CONTRACT"]["successor_path"]
    ).decode("utf-8")
    errors.extend(validate_sys_implementation_delta(old_sys_contract, new_sys_contract))

    _, sealed = read_csv(SEALED_PATH)
    sealed_pairs = {(r.get("session_id"), r.get("relative_path")) for r in sealed}
    if (
        ("HRIS-PER", "g3-modern-capability-contracts.v1.json") not in sealed_pairs
        or ("HRIS-SYS", "validate_sys_readiness.py") not in sealed_pairs
        or ("HRIS-SYS", "g2-implementation-contract.md") not in sealed_pairs
    ):
        errors.append("historical predecessors are not sealed under their original logical paths")
    if any("v2" in relative for _, relative in sealed_pairs):
        errors.append("current successors must not be relabeled as historical G2 artifacts")

    for artifact_id, consumers in CURRENT_CONSUMERS.items():
        successor = EXPECTED[artifact_id]["successor_path"]
        predecessor = EXPECTED[artifact_id]["predecessor_path"]
        for consumer in consumers:
            text = (
                consumer_text[consumer]
                if consumer_text is not None and consumer in consumer_text
                else (ROOT / consumer).read_text(encoding="utf-8")
            )
            if successor not in text and ("../" + successor) not in text:
                errors.append(f"{artifact_id}: current consumer does not point to successor: {consumer}")
            current_text = text
            if consumer in HISTORICAL_HASH_CONSUMERS:
                historical_literal = f'ROOT / "{predecessor}",'
                if current_text.count(historical_literal) != 1:
                    errors.append(
                        f"{artifact_id}: aggregate historical hash literal must occur exactly once: {consumer}"
                    )
                current_text = current_text.replace(historical_literal, "", 1)
            if predecessor in current_text or ("../" + predecessor) in current_text:
                errors.append(f"{artifact_id}: current consumer still points to predecessor: {consumer}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    lineage = read_csv(LINEAGE_PATH)[1]
    pointers = read_csv(POINTER_PATH)[1]
    errors = validate(lineage, pointers)
    cases: list[dict[str, object]] = []
    if args.self_test and not errors:
        mutations = []
        bad = copy.deepcopy(lineage); bad[0]["predecessor_sha256"] = "0" * 64; mutations.append(("predecessor-digest", bad, pointers, None))
        bad = copy.deepcopy(lineage); bad[0]["successor_path"] = "session-evidence/per/missing-v2.json"; mutations.append(("orphan-successor", bad, pointers, None))
        badp = copy.deepcopy(pointers); badp[0]["current_path"] = EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["predecessor_path"]; mutations.append(("wrong-current-pointer", lineage, badp, None))
        bad = copy.deepcopy(lineage); bad[1]["authority_role"] = "ROLE.HRIS_SYS_ENGINEERING"; mutations.append(("wrong-authority", bad, pointers, None))
        per_path = EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["successor_path"]
        bad_bytes = {per_path: (ROOT / per_path).read_bytes().replace(b"V17__", b"V18__", 1)}
        mutations.append(("semantic-rebase-drift", lineage, pointers, bad_bytes))
        sys_path = EXPECTED["SYS_READINESS_VALIDATOR"]["predecessor_path"]
        bad_bytes = {sys_path: (ROOT / sys_path).read_bytes() + b"\n# tamper\n"}
        mutations.append(("predecessor-byte-tamper", lineage, pointers, bad_bytes, None))
        normalized_mutations = [
            (*mutation, None) if len(mutation) == 4 else mutation
            for mutation in mutations
        ]
        full_consumer = "coding-readiness/validate_full_coding_readiness.py"
        full_text = (ROOT / full_consumer).read_text(encoding="utf-8")
        current_marker = '"validator": "../session-evidence/sys/validate_sys_readiness.v2.py"'
        predecessor_marker = '"validator": "../session-evidence/sys/validate_sys_readiness.py"'
        mutated_full = full_text.replace(current_marker, predecessor_marker, 1)
        normalized_mutations.append(
            ("executable-pointer-regressed-to-predecessor", lineage, pointers, None, {full_consumer: mutated_full})
        )
        normalized_mutations.append(
            (
                "historical-hash-predecessor-omitted",
                lineage,
                pointers,
                None,
                {full_consumer: full_text.replace(
                    'ROOT / "session-evidence/sys/validate_sys_readiness.py",', "", 1
                )},
            )
        )
        for case_id, lrows, prows, bytes_override, consumer_override in normalized_mutations:
            rejected = bool(validate(lrows, prows, bytes_override, consumer_override))
            cases.append({"case": case_id, "status": "PASS" if rejected else "FAIL"})
            if not rejected:
                errors.append(f"self-test mutation accepted: {case_id}")

        # Exercise the semantic closed-set checks directly so these tests
        # cannot pass merely because the outer CSV still contains an older
        # digest.  A hypothetical reviewer re-pin of each mutation must remain
        # rejected.
        old_per = json.loads(
            (ROOT / EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["predecessor_path"])
            .read_text(encoding="utf-8")
        )
        bad_per = json.loads(
            (ROOT / EXPECTED["PER_MODERN_CAPABILITY_CONTRACT"]["successor_path"])
            .read_text(encoding="utf-8")
        )
        bad_per["capabilities"][0]["operations"][0].setdefault("readsTables", []).append(
            "prf_unowned_repin_probe"
        )
        rejected = bool(validate_per_semantic_successor(old_per, bad_per))
        cases.append({
            "case": "semantic-repin-per-unowned-table",
            "status": "PASS" if rejected else "FAIL",
        })
        if not rejected:
            errors.append("self-test semantic re-pin accepted: PER unowned table")

        sys_predecessor = (
            ROOT / EXPECTED["SYS_READINESS_VALIDATOR"]["predecessor_path"]
        ).read_text(encoding="utf-8")
        sys_successor = (
            ROOT / EXPECTED["SYS_READINESS_VALIDATOR"]["successor_path"]
        ).read_text(encoding="utf-8")
        rejected = bool(validate_sys_validator_delta(
            sys_predecessor, sys_successor + "\n# unreviewed re-pin probe\n"
        ))
        cases.append({
            "case": "semantic-repin-sys-validator-extra-code",
            "status": "PASS" if rejected else "FAIL",
        })
        if not rejected:
            errors.append("self-test semantic re-pin accepted: SYS validator extra code")

        contract_predecessor = (
            ROOT / EXPECTED["SYS_IMPLEMENTATION_CONTRACT"]["predecessor_path"]
        ).read_text(encoding="utf-8")
        contract_successor = (
            ROOT / EXPECTED["SYS_IMPLEMENTATION_CONTRACT"]["successor_path"]
        ).read_text(encoding="utf-8")
        rejected = bool(validate_sys_implementation_delta(
            contract_predecessor,
            contract_successor.replace(
                "MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40",
                "MIG-SYS-PLATFORM-HRIS-INSIGHTS-41-80",
            ),
        ))
        cases.append({
            "case": "semantic-repin-sys-listening-range",
            "status": "PASS" if rejected else "FAIL",
        })
        if not rejected:
            errors.append("self-test semantic re-pin accepted: SYS Listening range")
    payload = {
        "schema": "dwp.hris.blueprint-artifact-lineage.v1",
        "status": "PASS" if not errors else "FAIL",
        "lineageCount": len(lineage),
        "pointerCount": len(pointers),
        "selfTests": len(cases),
        "cases": cases,
        "errors": errors,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (
        (_guard_dir / "modern_successor_reader_guard.py").is_file()
        or (_guard_dir / "coding-readiness/modern_successor_reader_guard.py").is_file()
    ):
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    if not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        _guard_dir = _guard_dir / "coding-readiness"
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
