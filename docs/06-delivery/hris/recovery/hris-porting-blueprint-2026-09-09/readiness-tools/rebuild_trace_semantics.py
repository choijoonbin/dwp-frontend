#!/usr/bin/env python3
"""Rewrite child trace target-design fields using the shared semantic policy."""

from __future__ import annotations

import csv
from pathlib import Path

from trace_semantics import IDENTITY_FIELDS, normalize_rows


ROOT = Path(__file__).resolve().parents[1]
MODULES = ("hrm", "per", "tim", "pay", "sys")


def main() -> int:
    total = 0
    changed = 0
    for module in MODULES:
        path = ROOT / "session-evidence" / module / "g1-child-trace.csv"
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            fieldnames = list(reader.fieldnames or ())
            rows = list(reader)
        before_identity = [tuple(row[field] for field in IDENTITY_FIELDS) for row in rows]
        normalized = normalize_rows(rows)
        after_identity = [tuple(row[field] for field in IDENTITY_FIELDS) for row in normalized]
        if before_identity != after_identity:
            raise AssertionError(f"{module}: source identity changed")
        module_changed = sum(left != right for left, right in zip(rows, normalized))
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(normalized)
        total += len(rows)
        changed += module_changed
        print(f"{module}: rows={len(rows)} changed={module_changed} identity_preserved=true")
    if total != 10001:
        raise AssertionError(f"complete trace population changed: {total}")
    print(f"TRACE_SEMANTICS_REBUILD=PASS rows={total} changed={changed} identity_preserved=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


ROOT = Path(__file__).resolve().parents[1]
MODULES = ("hrm", "per", "tim", "pay", "sys")


def main() -> int:
    total = 0
    for module in MODULES:
        path = ROOT / "session-evidence" / module / "g1-child-trace.csv"
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            fieldnames = list(reader.fieldnames or ())
            rows = list(reader)
        before_identity = [tuple(row[field] for field in IDENTITY_FIELDS) for row in rows]
        normalized = normalize_rows(rows)
        after_identity = [tuple(row[field] for field in IDENTITY_FIELDS) for row in normalized]
        if before_identity != after_identity:
            raise AssertionError(f"{module}: source identity or decision linkage changed")
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(normalized)
        total += len(normalized)
        print(f"{module.upper()}_TRACE_SEMANTICS_REBUILT rows={len(normalized)} identity_preserved=true")
    print(f"TRACE_SEMANTICS_REBUILT total={total} modules={len(MODULES)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
