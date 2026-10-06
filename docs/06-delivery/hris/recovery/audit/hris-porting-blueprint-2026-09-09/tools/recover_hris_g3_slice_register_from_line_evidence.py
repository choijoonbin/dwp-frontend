#!/usr/bin/env python3
"""Recover the G3 slice register from captured numbered lines and a pinned hash."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
from collections import defaultdict
from pathlib import Path


RELATIVE = "coding-readiness/g3-slice-code-go-register.csv"
HISTORICAL = f"output/hris-porting-blueprint-2026-09-09/{RELATIVE}"
NUMBERED = re.compile(r"^\s*(\d+)\t(.*)$")
RG_NUMBERED = re.compile(
    r"^.*g3-slice-code-go-register\.csv(?::|-)(\d+)(?::|-)(.*)$"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recovery-root", required=True, type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--evidence-report", required=True, type=Path)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--line-count", type=int, default=103)
    args = parser.parse_args()

    candidates: defaultdict[int, list[tuple[int, str, str]]] = defaultdict(list)
    hash_evidence: list[tuple[int, str, str]] = []
    for archive in sorted((args.recovery_root / "threads").glob("*/events.jsonl.gz")):
        with gzip.open(archive, "rt", encoding="utf-8") as handle:
            for raw in handle:
                if "g3-slice-code-go-register.csv" not in raw:
                    continue
                event = json.loads(raw)
                data = event.get("data") or {}
                if event.get("item_type") != "commandExecution" and data.get("type") != "commandExecution":
                    continue
                output = str(data.get("aggregatedOutput") or "")
                created_at = int(event.get("created_at_ms") or 0)
                item_id = str(event.get("item_id") or "")
                for line in output.splitlines():
                    if args.expected_sha256 in line and HISTORICAL in line:
                        hash_evidence.append((created_at, item_id, line))
                    match = NUMBERED.match(line) or RG_NUMBERED.match(line)
                    if not match:
                        continue
                    number = int(match.group(1))
                    content = match.group(2)
                    if number == 1 and not content.startswith("slice_id,"):
                        continue
                    if number > 1 and not content.startswith(("BASE-TFR-", "MOD-")):
                        continue
                    if 1 <= number <= args.line_count:
                        candidates[number].append((created_at, item_id, content))

    if not hash_evidence:
        raise SystemExit("expected SHA-256 evidence was not found")
    hash_time, hash_item, hash_line = max(hash_evidence)
    selected = []
    selected_evidence = []
    for number in range(1, args.line_count + 1):
        eligible = [entry for entry in candidates[number] if entry[0] <= hash_time]
        if not eligible:
            raise SystemExit(f"missing numbered line evidence: {number}")
        created_at, item_id, content = max(eligible, key=lambda item: (item[0], item[1]))
        selected.append(content)
        selected_evidence.append(
            {"line": number, "createdAtMs": created_at, "itemId": item_id}
        )

    raw = ("\n".join(selected) + "\n").encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != args.expected_sha256:
        raise SystemExit(f"reconstructed SHA-256 mismatch: {digest}")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8"))))
    widths = sorted({len(row) for row in rows})
    if len(rows) != args.line_count or widths != [48]:
        raise SystemExit(f"CSV shape mismatch: rows={len(rows)} widths={widths}")

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_bytes(raw)
    report = {
        "schema": "dwp.hris.blueprint.numbered-line-recovery.v1",
        "historicalPath": HISTORICAL,
        "destination": str(args.destination),
        "bytes": len(raw),
        "lineCount": len(rows),
        "columnCount": 48,
        "sha256": digest,
        "hashEvidence": {
            "createdAtMs": hash_time,
            "itemId": hash_item,
            "line": hash_line,
        },
        "selectedLineEvidence": selected_evidence,
        "inventedContent": False,
    }
    args.evidence_report.parent.mkdir(parents=True, exist_ok=True)
    args.evidence_report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"path": str(args.destination), "sha256": digest, "rows": len(rows)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
