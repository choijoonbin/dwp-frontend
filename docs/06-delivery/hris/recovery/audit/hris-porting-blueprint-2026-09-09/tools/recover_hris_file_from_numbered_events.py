#!/usr/bin/env python3
"""Recover one historical file from explicitly selected numbered-output events."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path


NUMBERED = re.compile(r"^\s*(\d+)\t(.*)$")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recovery-root", required=True, type=Path)
    parser.add_argument("--relative-path", required=True)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--evidence-report", required=True, type=Path)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--line-count", required=True, type=int)
    parser.add_argument("--item-id", action="append", required=True)
    parser.add_argument("--base-file", type=Path)
    args = parser.parse_args()

    selected_ids = set(args.item_id)
    line_candidates: dict[int, tuple[int, str, str]] = {}
    evidence: dict[int, str] = {}
    seen_ids: set[str] = set()
    for archive in sorted((args.recovery_root / "threads").glob("*/events.jsonl.gz")):
        with gzip.open(archive, "rt", encoding="utf-8") as handle:
            for raw in handle:
                if not any(item_id in raw for item_id in selected_ids):
                    continue
                event = json.loads(raw)
                item_id = str(event.get("item_id") or "")
                if item_id not in selected_ids:
                    continue
                seen_ids.add(item_id)
                output = str((event.get("data") or {}).get("aggregatedOutput") or "")
                created_at = int(event.get("created_at_ms") or 0)
                for output_line in output.splitlines():
                    match = NUMBERED.match(output_line)
                    if not match:
                        continue
                    number = int(match.group(1))
                    if 1 <= number <= args.line_count:
                        candidate = (created_at, item_id, match.group(2))
                        if number not in line_candidates or candidate[:2] > line_candidates[number][:2]:
                            line_candidates[number] = candidate
    lines = {number: candidate[2] for number, candidate in line_candidates.items()}
    evidence = {number: candidate[1] for number, candidate in line_candidates.items()}

    if args.base_file:
        base_lines = args.base_file.read_text(encoding="utf-8").splitlines()
        if len(base_lines) != args.line_count:
            raise SystemExit(
                f"base line count mismatch: expected {args.line_count}, got {len(base_lines)}"
            )
        for number, content in enumerate(base_lines, start=1):
            lines.setdefault(number, content)
            evidence.setdefault(number, "BASE_FILE")
    missing = [number for number in range(1, args.line_count + 1) if number not in lines]
    if missing:
        raise SystemExit(f"missing numbered evidence: {missing[:20]} (count={len(missing)})")
    raw = ("\n".join(lines[number] for number in range(1, args.line_count + 1)) + "\n").encode()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != args.expected_sha256:
        raise SystemExit(f"reconstructed SHA-256 mismatch: {digest}")

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_bytes(raw)
    report = {
        "schema": "dwp.hris.blueprint.numbered-event-recovery.v1",
        "relativePath": args.relative_path,
        "destination": str(args.destination),
        "bytes": len(raw),
        "lineCount": args.line_count,
        "sha256": digest,
        "selectedItemIds": sorted(selected_ids),
        "observedItemIds": sorted(seen_ids),
        "lineSourceCounts": {
            source: list(evidence.values()).count(source) for source in sorted(set(evidence.values()))
        },
        "baseFileUsed": str(args.base_file) if args.base_file else None,
        "inventedContent": False,
    }
    args.evidence_report.parent.mkdir(parents=True, exist_ok=True)
    args.evidence_report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"path": str(args.destination), "sha256": digest, "lines": args.line_count}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
