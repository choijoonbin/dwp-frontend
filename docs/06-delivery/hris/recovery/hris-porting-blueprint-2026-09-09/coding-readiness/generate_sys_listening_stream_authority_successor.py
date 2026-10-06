#!/usr/bin/env python3
"""Build the sealed, product-complete SYS Listening v2 stream authority."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from sys_listening_canonical_design import build_stream_authority_successor_v2


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUTPUT = HERE / "sys-listening-stream-authority-successor.v2.json"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def render(contract: dict) -> bytes:
    return (
        json.dumps(contract, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    try:
        expected = render(build_stream_authority_successor_v2(ROOT))
    except Exception as exc:
        result = {
            "generator": "SYS_LISTENING_STREAM_AUTHORITY_SUCCESSOR_V2",
            "status": "FAIL",
            "byteStable": False,
            "dependencyDirection": (
                "IMMUTABLE_V1_AND_STATIC_DESIGN_TO_SEALED_V2_AUTHORITY"
            ),
            "error": f"{type(exc).__name__}:{exc}",
        }
        print(json.dumps(
            result,
            ensure_ascii=False,
            separators=(",", ":") if args.compact else None,
        ))
        return 1
    if args.check:
        ok = (
            output.is_file()
            and not output.is_symlink()
            and output.read_bytes() == expected
        )
        result = {
            "generator": "SYS_LISTENING_STREAM_AUTHORITY_SUCCESSOR_V2",
            "status": "PASS" if ok else "FAIL",
            "byteStable": ok,
            "dependencyDirection": (
                "IMMUTABLE_V1_AND_STATIC_DESIGN_TO_SEALED_V2_AUTHORITY"
            ),
        }
        print(json.dumps(
            result,
            ensure_ascii=False,
            separators=(",", ":") if args.compact else None,
        ))
        return 0 if ok else 1
    if output.is_symlink():
        raise ValueError("Listening v2 authority target may not be a symlink")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    if temporary.exists():
        raise ValueError("stale temporary Listening summary exists")
    temporary.write_bytes(expected)
    temporary.replace(output)
    result = {
        "generator": "SYS_LISTENING_STREAM_AUTHORITY_SUCCESSOR_V2",
        "status": "WROTE_ATOMIC_REFRESH",
        "path": str(output),
        "sha256": sha256_bytes(expected),
        "dependencyDirection": (
            "IMMUTABLE_V1_AND_STATIC_DESIGN_TO_SEALED_V2_AUTHORITY"
        ),
    }
    print(json.dumps(
        result,
        ensure_ascii=False,
        separators=(",", ":") if args.compact else None,
    ))
    return 0


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
