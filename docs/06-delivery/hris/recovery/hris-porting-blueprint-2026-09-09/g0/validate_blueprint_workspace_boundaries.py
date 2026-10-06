#!/usr/bin/env python3
"""Independently validate the canonical snapshot and append-only evidence shards."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import stat
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G0 = ROOT / "g0"
MANIFEST = G0 / "blueprint-central-snapshot-manifest.v1.json"
REGISTER = G0 / "blueprint-workspace-boundary-register.csv"

HEADER = [
    "boundary_id", "session_id", "boundary_kind", "path_prefix",
    "allowed_operations", "writer_role", "control_intake_prefix",
    "canonical_snapshot_required", "state",
]
SESSIONS = {
    "HRIS-HRM": ("hrm", "ROLE.HRIS_HRM_ENGINEERING"),
    "HRIS-PER": ("per", "ROLE.HRIS_PER_ENGINEERING"),
    "HRIS-PAY": ("pay", "ROLE.HRIS_PAY_ENGINEERING"),
    "HRIS-TIM": ("tim", "ROLE.HRIS_TIM_ENGINEERING"),
    "HRIS-SYS": ("sys", "ROLE.HRIS_SYS_ENGINEERING"),
}
MUTABLE_FILES = {
    "g0/current-g3-gate-decision.json",
    "g0/g3-checkpoint-register.csv",
    "g0/g3-control-delivery-state.json",
    "g0/g3-control-proposal-register.csv",
    "g0/g3-control-release-register.csv",
    "g0/g3-control-sync-receipt-register.csv",
    "g0/session-environment-evidence.json",
    "g0/target-command-evidence-backend.json",
    "g0/target-command-evidence-frontend.json",
}
MUTABLE_PREFIXES = tuple(
    ["coding-readiness/reports/", "g0/control-evidence-intake/"]
    + [f"session-evidence/{slug}/g3/module-evidence/" for slug, _ in SESSIONS.values()]
)
SHARD_CONTRACT = ".shard-contract.json"
SHARD_MANIFEST = ".shard-manifest.json"
SHARD_ALLOWED_SUFFIXES = {".json", ".csv", ".md", ".sha256"}
SHARD_MANIFEST_HEADER = {
    "schema", "sessionId", "writableRoot", "writeMode", "hashAlgorithm",
    "entryCount", "chainHeadSha256", "entries", "state", "trustState",
    "integrityClaim",
}
SHARD_ENTRY_HEADER = {
    "sequence", "path", "sha256", "size", "mode", "priorChainSha256",
    "entryChainSha256",
}
UNTRUSTED_SHARD_STATE = "ACTIVE_UNTRUSTED_SUBMISSION_FAIL_CLOSED"
SHARD_TRUST_STATE = "UNTRUSTED_UNTIL_CONTROL_REPLAY_AND_CHECKPOINT_CAS_APPEND"
SHARD_INTEGRITY_CLAIM = "LOCAL_ACCIDENTAL_OR_UNCOORDINATED_MUTATION_DETECTION_ONLY"
INTAKE_CONTRACT = {
    "acceptedSources": sorted(SESSIONS),
    "appendMode": "CONTROL_INDEPENDENT_REPLAY_VALIDATE_THEN_CHECKPOINT_CAS_APPEND",
    "canonicalSnapshot": "g0/blueprint-central-snapshot-manifest.v1.json",
    "integrityClaim": "WORKFLOW_INTEGRITY_NOT_EXTERNAL_IDENTITY_ATTESTATION",
    "requiredAnchor": "G3_CHECKPOINT_REGISTER_TEST_TOUCH_DIGEST_CAS_APPEND",
    "requiredIndependentAction": "CONTROL_REPLAY_EXACT_COMMANDS_AND_VALIDATE_PATH_BYTES_MODE",
    "schema": "dwp.hris.control-evidence-intake.v2",
    "sourceTrust": "UNTRUSTED_SUBMISSION",
    "state": "ACTIVE_FAIL_CLOSED",
    "writerRole": "ROLE.INTEGRATION_CONTROL",
}


def is_excluded(relative: str) -> bool:
    return (
        relative == "g0/blueprint-central-snapshot-manifest.v1.json"
        or relative in MUTABLE_FILES
        or relative.endswith(".pyc")
        or "/__pycache__/" in f"/{relative}"
        or relative == ".DS_Store"
        or any(relative.startswith(prefix) for prefix in MUTABLE_PREFIXES)
    )


def disk_inventory() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if not is_excluded(relative):
            result[relative] = path
    return result


def read_rows() -> tuple[list[str], list[dict[str, str]]]:
    with REGISTER.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def exact_rows() -> list[dict[str, str]]:
    rows = []
    for session, (slug, role) in SESSIONS.items():
        rows.append({
            "boundary_id": f"BP-SHARD-{session.removeprefix('HRIS-')}",
            "session_id": session,
            "boundary_kind": "MODULE_EVIDENCE_SHARD",
            "path_prefix": f"session-evidence/{slug}/g3/module-evidence",
            "allowed_operations": "CREATE_NEW_ONLY",
            "writer_role": role,
            "control_intake_prefix": f"g0/control-evidence-intake/{slug}",
            "canonical_snapshot_required": "YES",
            "state": UNTRUSTED_SHARD_STATE,
        })
    rows.append({
        "boundary_id": "BP-INTAKE-CONTROL",
        "session_id": "CONTROL",
        "boundary_kind": "CONTROL_EVIDENCE_INTAKE",
        "path_prefix": "g0/control-evidence-intake",
        "allowed_operations": "VERIFY_AND_PROMOTE_ONLY",
        "writer_role": "ROLE.INTEGRATION_CONTROL",
        "control_intake_prefix": "NONE",
        "canonical_snapshot_required": "YES",
        "state": "ACTIVE_FAIL_CLOSED",
    })
    return rows


def content_sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_sha(payload: object) -> str:
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return content_sha(encoded)


def manifest_set_sha(entries: list[dict[str, object]]) -> str:
    return canonical_sha(entries)


def shard_writable_root(session: str) -> str:
    return f"session-evidence/{SESSIONS[session][0]}/g3/module-evidence"


def shard_contract_payload(session: str) -> dict[str, object]:
    slug, _ = SESSIONS[session]
    return {
        "appendOnlyManifest": f"{shard_writable_root(session)}/{SHARD_MANIFEST}",
        "canonicalSnapshot": "g0/blueprint-central-snapshot-manifest.v1.json",
        "contentAddressing": "SHA256_CHAINED_EXACT_PATH_BYTES_MODE",
        "controlIntake": f"g0/control-evidence-intake/{slug}",
        "integrityClaim": SHARD_INTEGRITY_CLAIM,
        "schema": "dwp.hris.module-evidence-shard.v3",
        "sessionId": session,
        "state": UNTRUSTED_SHARD_STATE,
        "trustState": SHARD_TRUST_STATE,
        "writableRoot": shard_writable_root(session),
        "writeMode": "CREATE_NEW_ONLY_APPEND_MANIFEST",
    }


def shard_seed(session: str) -> str:
    return canonical_sha({
        "schema": "dwp.hris.module-evidence-shard-chain-seed.v1",
        "sessionId": session,
        "writableRoot": shard_writable_root(session),
    })


def make_shard_entry(
    session: str,
    sequence: int,
    relative: str,
    data: bytes,
    mode: str,
    prior: str,
) -> dict[str, object]:
    base: dict[str, object] = {
        "sequence": sequence,
        "path": relative,
        "sha256": content_sha(data),
        "size": len(data),
        "mode": mode,
        "priorChainSha256": prior,
    }
    return {**base, "entryChainSha256": canonical_sha(base)}


def empty_shard_manifest(session: str) -> dict[str, object]:
    return {
        "schema": "dwp.hris.module-evidence-shard-manifest.v2",
        "sessionId": session,
        "writableRoot": shard_writable_root(session),
        "writeMode": "CREATE_NEW_ONLY_APPEND_MANIFEST",
        "hashAlgorithm": "SHA-256",
        "entryCount": 0,
        "chainHeadSha256": shard_seed(session),
        "entries": [],
        "state": UNTRUSTED_SHARD_STATE,
        "trustState": SHARD_TRUST_STATE,
        "integrityClaim": SHARD_INTEGRITY_CLAIM,
    }


def valid_shard_relative(relative: str) -> bool:
    candidate = Path(relative)
    return (
        bool(relative)
        and not candidate.is_absolute()
        and ".." not in candidate.parts
        and all(part and not part.startswith(".") for part in candidate.parts)
        and candidate.suffix in SHARD_ALLOWED_SUFFIXES
        and candidate.name not in {SHARD_CONTRACT, SHARD_MANIFEST}
    )


def live_shard_inventory(shard: Path) -> tuple[dict[str, tuple[bytes, str]], set[str]]:
    files: dict[str, tuple[bytes, str]] = {}
    symlinks: set[str] = set()
    if not shard.is_dir() or shard.is_symlink():
        return files, {"."}
    for path in shard.rglob("*"):
        relative = path.relative_to(shard).as_posix()
        try:
            metadata = path.lstat()
        except OSError:
            symlinks.add(relative)
            continue
        if stat.S_ISLNK(metadata.st_mode):
            symlinks.add(relative)
        elif stat.S_ISREG(metadata.st_mode) and relative not in {
            SHARD_CONTRACT, SHARD_MANIFEST,
        }:
            files[relative] = (
                path.read_bytes(), f"{stat.S_IMODE(metadata.st_mode):04o}"
            )
    return files, symlinks


def validate_shard(
    session: str,
    *,
    contract_payload: dict[str, object] | None = None,
    manifest_payload: dict[str, object] | None = None,
    virtual_files: dict[str, tuple[bytes, str]] | None = None,
    virtual_symlinks: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    shard = ROOT / shard_writable_root(session)
    contract_path = shard / SHARD_CONTRACT
    manifest_path = shard / SHARD_MANIFEST
    if contract_payload is None:
        try:
            contract = json.loads(contract_path.read_text())
        except (OSError, json.JSONDecodeError):
            errors.append(f"{session}: shard contract missing or invalid")
            contract = {}
    else:
        contract = contract_payload
    if contract != shard_contract_payload(session):
        errors.append(f"{session}: shard contract drift")
    if manifest_payload is None:
        try:
            manifest_payload = json.loads(manifest_path.read_text())
        except (OSError, json.JSONDecodeError):
            return errors + [f"{session}: shard append-only manifest missing or invalid"]
    manifest = manifest_payload
    if set(manifest) != SHARD_MANIFEST_HEADER:
        errors.append(f"{session}: shard manifest exact field set drift")
    expected_empty = empty_shard_manifest(session)
    for field in (
        "schema", "sessionId", "writableRoot", "writeMode", "hashAlgorithm", "state",
        "trustState", "integrityClaim",
    ):
        if manifest.get(field) != expected_empty[field]:
            errors.append(f"{session}: shard manifest {field} drift")
    entries = manifest.get("entries", [])
    if not isinstance(entries, list):
        return errors + [f"{session}: shard manifest entries must be a list"]
    if manifest.get("entryCount") != len(entries):
        errors.append(f"{session}: shard manifest entryCount drift")
    prior = shard_seed(session)
    paths: list[str] = []
    for position, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict) or set(entry) != SHARD_ENTRY_HEADER:
            errors.append(f"{session}: shard entry {position} exact field set drift")
            continue
        relative = str(entry.get("path", ""))
        paths.append(relative)
        if entry.get("sequence") != position:
            errors.append(f"{session}: shard entry sequence is not contiguous")
        if not valid_shard_relative(relative):
            errors.append(f"{session}: shard entry path is forbidden: {relative}")
        if entry.get("priorChainSha256") != prior:
            errors.append(f"{session}: shard entry prior-chain drift: {relative}")
        base = {
            key: entry.get(key)
            for key in SHARD_ENTRY_HEADER - {"entryChainSha256"}
        }
        expected_chain = canonical_sha(base)
        if entry.get("entryChainSha256") != expected_chain:
            errors.append(f"{session}: shard entry chain digest drift: {relative}")
        prior = expected_chain
    if len(paths) != len(set(paths)):
        errors.append(f"{session}: shard manifest contains duplicate paths")
    if manifest.get("chainHeadSha256") != prior:
        errors.append(f"{session}: shard manifest chain head drift")
    if virtual_files is None or virtual_symlinks is None:
        live_files, live_symlinks = live_shard_inventory(shard)
        files = live_files if virtual_files is None else virtual_files
        symlinks = live_symlinks if virtual_symlinks is None else virtual_symlinks
    else:
        files, symlinks = virtual_files, virtual_symlinks
    if symlinks:
        errors.append(f"{session}: shard contains symlink or unsafe root: {sorted(symlinks)}")
    if set(paths) != set(files):
        errors.append(f"{session}: shard inventory differs from append-only manifest")
    entry_by_path = {
        str(entry.get("path", "")): entry
        for entry in entries if isinstance(entry, dict)
    }
    for relative, (data, mode) in files.items():
        entry = entry_by_path.get(relative)
        if entry is None:
            continue
        if entry.get("sha256") != content_sha(data):
            errors.append(f"{session}: shard evidence byte digest drift: {relative}")
        if entry.get("size") != len(data):
            errors.append(f"{session}: shard evidence size drift: {relative}")
        if entry.get("mode") != mode:
            errors.append(f"{session}: shard evidence mode drift: {relative}")
    return errors


def validate(
    manifest: dict[str, object] | None = None,
    rows: list[dict[str, str]] | None = None,
    file_bytes: dict[str, bytes] | None = None,
    inventory_paths: set[str] | None = None,
    intake_contract: dict[str, object] | None = None,
) -> list[str]:
    errors: list[str] = []
    try:
        manifest = json.loads(MANIFEST.read_text()) if manifest is None else manifest
    except (OSError, json.JSONDecodeError):
        return ["canonical snapshot manifest missing or invalid JSON"]
    header, disk_rows = read_rows()
    rows = disk_rows if rows is None else rows
    if header != HEADER:
        errors.append("boundary register header drift")
    if rows != exact_rows():
        errors.append("boundary register must equal the exact session/shard matrix")
    if manifest.get("schema") != "dwp.hris.blueprint-central-snapshot.v1":
        errors.append("snapshot schema drift")
    if manifest.get("basisDate") != "2026-09-11" or manifest.get("state") != "CONTROL_SEALED_CANONICAL_INPUT":
        errors.append("snapshot basis/state drift")
    if manifest.get("mutableFiles") != sorted(MUTABLE_FILES):
        errors.append("snapshot mutable-file exclusion drift")
    if manifest.get("mutablePrefixes") != list(MUTABLE_PREFIXES):
        errors.append("snapshot mutable-prefix exclusion drift")
    entries = manifest.get("files", [])
    if not isinstance(entries, list):
        return errors + ["snapshot files must be a list"]
    paths = [entry.get("path") for entry in entries if isinstance(entry, dict)]
    if len(paths) != len(entries) or paths != sorted(set(paths)):
        errors.append("snapshot paths must be sorted and unique")
    inventory = disk_inventory()
    actual_paths = set(inventory) if inventory_paths is None else inventory_paths
    if set(paths) != actual_paths:
        errors.append("snapshot canonical path set differs from disk")
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        relative = str(entry.get("path", ""))
        if is_excluded(relative) or relative.startswith("/") or ".." in Path(relative).parts:
            errors.append(f"snapshot includes forbidden path: {relative}")
            continue
        path = inventory.get(relative)
        if file_bytes is not None and relative in file_bytes:
            data = file_bytes[relative]
            mode = entry.get("mode")
        elif path is not None:
            data = path.read_bytes()
            mode = f"{stat.S_IMODE(path.stat().st_mode):04o}"
        else:
            continue
        if entry != {
            "path": relative,
            "sha256": content_sha(data),
            "size": len(data),
            "mode": mode,
        }:
            errors.append(f"snapshot file digest/size/mode drift: {relative}")
    if manifest.get("fileCount") != len(entries):
        errors.append("snapshot fileCount drift")
    if manifest.get("canonicalSetSha256") != manifest_set_sha(entries):
        errors.append("snapshot canonicalSetSha256 drift")
    for session in SESSIONS:
        errors.extend(validate_shard(session))
    intake = G0 / "control-evidence-intake/.intake-contract.json"
    if not intake.is_file() or intake.is_symlink():
        errors.append("Control evidence intake contract missing or unsafe")
    else:
        if intake_contract is None:
            try:
                intake_contract = json.loads(intake.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                intake_contract = {}
        if intake_contract != INTAKE_CONTRACT:
            errors.append("Control evidence intake exact trust/replay/anchor contract drift")
    return errors


def shard_virtual_fixture(
    session: str,
) -> tuple[dict[str, object], dict[str, tuple[bytes, str]]]:
    data = b'{"status":"PASS"}\n'
    entry = make_shard_entry(
        session, 1, "checkpoints/receipt.json", data, "0600", shard_seed(session)
    )
    manifest = empty_shard_manifest(session)
    manifest.update({
        "entryCount": 1,
        "entries": [entry],
        "chainHeadSha256": entry["entryChainSha256"],
    })
    return manifest, {"checkpoints/receipt.json": (data, "0600")}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=sorted(SESSIONS))
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.is_file() else {}
    rows = read_rows()[1]
    errors = validate(manifest, rows)
    cases: dict[str, bool] = {}
    if args.self_test and not errors:
        gate_coupled_mutable = {
            "g0/central-artifact-classification-register.csv",
            "g0/g3-gate-transition-register.csv",
        }
        manifest_paths = {
            str(entry.get("path", ""))
            for entry in manifest.get("files", [])
            if isinstance(entry, dict)
        }
        cases["gate-coupled-runtime-files-excluded-from-immutable-snapshot"] = (
            gate_coupled_mutable.issubset(MUTABLE_FILES)
            and not gate_coupled_mutable.intersection(manifest_paths)
        )
        first = str(manifest["files"][0]["path"])
        bad = copy.deepcopy(manifest); bad["files"][0]["sha256"] = "0" * 64
        cases["canonical-byte-digest-tamper-rejected"] = bool(
            validate(bad, rows, shard_scope=shard_scope)
        )
        bad = copy.deepcopy(manifest); bad["files"] = bad["files"][1:]; bad["fileCount"] -= 1
        cases["canonical-path-omission-rejected"] = bool(
            validate(bad, rows, shard_scope=shard_scope)
        )
        bad_rows = copy.deepcopy(rows); bad_rows[0]["path_prefix"] = rows[1]["path_prefix"]
        cases["cross-session-shard-rehome-rejected"] = bool(
            validate(manifest, bad_rows, shard_scope=shard_scope)
        )
        cases["canonical-file-content-mutation-rejected"] = bool(
            validate(
                manifest,
                rows,
                {first: (ROOT / first).read_bytes() + b"tamper"},
                shard_scope=shard_scope,
            )
        )
        extra_paths = set(disk_inventory()) | {"unauthorized-central-file.txt"}
        cases["unmanifested-central-file-rejected"] = bool(
            validate(
                manifest,
                rows,
                inventory_paths=extra_paths,
                shard_scope=shard_scope,
            )
        )
        session = "HRIS-PER"
        good_shard, files = shard_virtual_fixture(session)
        cases["append-only-shard-fixture-valid"] = not validate_shard(
            session, manifest_payload=good_shard, virtual_files=files,
            virtual_symlinks=set(),
        )
        mutated = {path: (data + b"x", mode) for path, (data, mode) in files.items()}
        cases["existing-shard-byte-replacement-rejected"] = bool(validate_shard(
            session, manifest_payload=good_shard, virtual_files=mutated,
            virtual_symlinks=set(),
        ))
        cases["existing-shard-deletion-rejected"] = bool(validate_shard(
            session, manifest_payload=good_shard, virtual_files={},
            virtual_symlinks=set(),
        ))
        duplicate = copy.deepcopy(good_shard)
        duplicate["entries"].append(copy.deepcopy(duplicate["entries"][0]))
        duplicate["entryCount"] = 2
        cases["duplicate-shard-path-rejected"] = bool(validate_shard(
            session, manifest_payload=duplicate, virtual_files=files,
            virtual_symlinks=set(),
        ))
        cases["shard-symlink-rejected"] = bool(validate_shard(
            session, manifest_payload=good_shard, virtual_files=files,
            virtual_symlinks={"checkpoints/link.json"},
        ))
        chain = copy.deepcopy(good_shard)
        chain["entries"][0]["priorChainSha256"] = "0" * 64
        cases["shard-chain-rewrite-rejected"] = bool(validate_shard(
            session, manifest_payload=chain, virtual_files=files,
            virtual_symlinks=set(),
        ))
        trusted_contract = shard_contract_payload(session)
        trusted_contract["trustState"] = "CONTROL_TRUSTED"
        cases["self-hashed-shard-cannot-claim-control-trust"] = bool(validate_shard(
            session, contract_payload=trusted_contract,
            manifest_payload=good_shard, virtual_files=files,
            virtual_symlinks=set(),
        ))
        forged_intake = dict(INTAKE_CONTRACT)
        forged_intake["requiredIndependentAction"] = "TRUST_MODULE_HASH_CHAIN"
        cases["control-independent-replay-requirement-drift-rejected"] = bool(
            validate(
                manifest,
                rows,
                intake_contract=forged_intake,
                shard_scope=shard_scope,
            )
        )
        forged_anchor = dict(INTAKE_CONTRACT)
        forged_anchor["requiredAnchor"] = "SHARD_CHAIN_ONLY"
        cases["self-hash-without-central-cas-anchor-rejected"] = bool(
            validate(
                manifest,
                rows,
                intake_contract=forged_anchor,
                shard_scope=shard_scope,
            )
        )
        if not all(cases.values()):
            errors.append("workspace boundary mutation accepted")
    payload = {
        "schema": "dwp.hris.blueprint-workspace-boundary.v2",
        "status": "PASS" if not errors else "FAIL",
        "canonicalFileCount": manifest.get("fileCount", 0),
        "canonicalSetSha256": manifest.get("canonicalSetSha256", ""),
        "session": args.session or "GLOBAL",
        "allowedWritableRoot": (
            shard_writable_root(args.session) if args.session else "NONE_GLOBAL_READ_ONLY"
        ),
        "selfTests": len(cases),
        "cases": cases,
        "errors": errors,
    }
    print(json.dumps(
        payload, ensure_ascii=False, sort_keys=True,
        separators=(",", ":") if args.compact else None,
    ))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
