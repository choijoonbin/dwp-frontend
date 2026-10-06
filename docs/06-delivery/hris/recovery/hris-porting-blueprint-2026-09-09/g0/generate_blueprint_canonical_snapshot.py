#!/usr/bin/env python3
"""Generate the immutable-input manifest for the shared non-Git blueprint."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "g0/blueprint-central-snapshot-manifest.v1.json"

MUTABLE_FILES = {
    "g0/central-artifact-classification-register.csv",
    "g0/current-g3-gate-decision.json",
    "g0/g3-checkpoint-register.csv",
    "g0/g3-control-checkpoint-transaction-state.json",
    "g0/g3-control-delivery-state.json",
    "g0/g3-control-proposal-register.csv",
    "g0/g3-control-release-register.csv",
    "g0/g3-control-sync-receipt-register.csv",
    "g0/g3-cross-repo-dependency-register.csv",
    "g0/g3-gate-transition-register.csv",
    "g0/g4-functional-gate-register.csv",
    "g0/g4-functional-gate-state.json",
    "g0/session-environment-evidence.json",
    "g0/target-command-evidence-backend.json",
    "g0/target-command-evidence-frontend.json",
}
MUTABLE_PREFIXES = (
    "coding-readiness/reports/",
    "g0/control-evidence-intake/",
    "session-evidence/hrm/g3/module-evidence/",
    "session-evidence/per/g3/module-evidence/",
    "session-evidence/pay/g3/module-evidence/",
    "session-evidence/tim/g3/module-evidence/",
    "session-evidence/sys/g3/module-evidence/",
    "session-evidence/hrm/g4/",
    "session-evidence/per/g4/",
    "session-evidence/pay/g4/",
    "session-evidence/tim/g4/",
    "session-evidence/sys/g4/",
)


def excluded(relative: str) -> bool:
    return (
        relative == OUTPUT.relative_to(ROOT).as_posix()
        or relative in MUTABLE_FILES
        or relative.endswith(".pyc")
        or "/__pycache__/" in f"/{relative}"
        or relative == ".DS_Store"
        or any(relative.startswith(prefix) for prefix in MUTABLE_PREFIXES)
    )


def canonical_entries() -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if excluded(relative):
            continue
        data = path.read_bytes()
        entries.append({
            "path": relative,
            "sha256": hashlib.sha256(data).hexdigest(),
            "size": len(data),
            "mode": f"{stat.S_IMODE(path.stat().st_mode):04o}",
        })
    return entries


def canonical_set_sha(entries: list[dict[str, object]]) -> str:
    encoded = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def build_payload() -> dict[str, object]:
    entries = canonical_entries()
    return {
        "schema": "dwp.hris.blueprint-central-snapshot.v1",
        "basisDate": "2026-09-11",
        "state": "CONTROL_SEALED_CANONICAL_INPUT",
        "fileCount": len(entries),
        "canonicalSetSha256": canonical_set_sha(entries),
        "mutableFiles": sorted(MUTABLE_FILES),
        "mutablePrefixes": list(MUTABLE_PREFIXES),
        "files": entries,
    }


def render(payload: dict[str, object]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()


def write_atomic(data: bytes) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=OUTPUT.name + ".", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.write == args.check:
        parser.error("choose exactly one of --write or --check")
    expected = render(build_payload())
    if args.write:
        write_atomic(expected)
        print(f"BLUEPRINT_CANONICAL_SNAPSHOT=WRITTEN files={json.loads(expected)['fileCount']}")
        return 0
    if not OUTPUT.is_file() or OUTPUT.read_bytes() != expected:
        print("BLUEPRINT_CANONICAL_SNAPSHOT=FAIL reason=manifest-or-canonical-input-drift")
        return 1
    print(f"BLUEPRINT_CANONICAL_SNAPSHOT=PASS files={json.loads(expected)['fileCount']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
