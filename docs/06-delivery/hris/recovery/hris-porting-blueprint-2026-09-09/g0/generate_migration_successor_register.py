#!/usr/bin/env python3
"""Deterministically materialize the current migration C1 successor projection."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from validate_migration_successor import (
    REGISTER,
    load_pre_g3_context,
    render_expected_payload,
    validate_git,
    validate_payload,
)


def rendered_bytes(payload: dict[str, object]) -> bytes:
    return (
        json.dumps(payload, ensure_ascii=False, indent=2)
        + "\n"
    ).encode("utf-8")


def replace_generated_file(path: Path, data: bytes) -> None:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("migration successor output or parent is a symlink")
    if path.exists() and not path.is_file():
        raise ValueError("migration successor output is not a regular file")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            temporary.unlink()
        except OSError:
            pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    parser.add_argument("--compact", action="store_true")
    arguments = parser.parse_args()

    try:
        context = load_pre_g3_context()
        payload = render_expected_payload(context)
        errors = validate_payload(payload, payload)
        errors.extend(validate_git(payload, check_live=True))
        if errors:
            raise ValueError("generated successor invalid: " + ";".join(errors))
        expected = rendered_bytes(payload)
        if arguments.check:
            if REGISTER.is_symlink() or not REGISTER.is_file():
                raise ValueError("checked-in migration successor is missing or unsafe")
            if REGISTER.read_bytes() != expected:
                raise ValueError("checked-in migration successor is stale")
            action = "CHECKED"
        else:
            replace_generated_file(REGISTER, expected)
            action = "WRITTEN"
        result = {
            "schema": "dwp.hris.migration-successor-generation.v1",
            "status": "PASS",
            "action": action,
            "sourceCommit": payload["source"]["commit"],
            "sourceTree": payload["source"]["tree"],
            "allocationCount": len(payload["allocations"]),
            "preG3Lineage": payload["preG3FoundationLineage"]["contractId"],
        }
    except Exception as exc:  # fail closed at the CLI boundary
        result = {
            "schema": "dwp.hris.migration-successor-generation.v1",
            "status": "FAIL",
            "action": "NONE",
            "error": f"{type(exc).__name__}:{exc}",
        }
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if arguments.compact else None,
            indent=None if arguments.compact else 2,
        )
    )
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
