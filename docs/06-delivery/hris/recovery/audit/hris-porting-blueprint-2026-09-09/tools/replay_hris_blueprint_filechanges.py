#!/usr/bin/env python3
"""Replay recovered Codex fileChange evidence for the HRIS blueprint.

This tool is intentionally narrow: it only accepts changes whose historical
absolute path is under the pinned blueprint root.  It does not interpret SKKF
source or execute historical shell commands.  Adds are treated as authoritative
full-file snapshots; updates are strict unified-diff hunks; deletes and moves
are replayed explicitly.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import shlex
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


HISTORICAL_ROOT = Path(
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09"
)
HUNK_RE = re.compile(
    r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$"
)
NL_RE = re.compile(r"\bnl\s+-ba\s+(?:\"([^\"]+)\"|'([^']+)'|([^\s;&|]+))")
NUMBERED_RE = re.compile(r"^\s*(\d+)\t(.*)$")
TRUNCATED_OUTPUT_RE = re.compile(
    r"(?:^Warning: truncated output \(original token count:|"
    r"^\.\.\. \d+ bytes omitted \.\.\.$)",
    re.MULTILINE,
)


@dataclass(frozen=True)
class Operation:
    created_at_ms: int
    thread_id: str
    turn_id: str
    item_id: str
    rollout_ordinal: int
    change_index: int
    path: str
    kind: str
    move_path: str | None
    diff: str

    @property
    def order_key(self) -> tuple[int, str, int, str, int]:
        return (
            self.created_at_ms,
            self.thread_id,
            self.rollout_ordinal,
            self.item_id,
            self.change_index,
        )


def is_historical_target(value: str) -> bool:
    try:
        Path(value).relative_to(HISTORICAL_ROOT)
    except ValueError:
        return False
    return Path(value) != HISTORICAL_ROOT


def resolve_historical_command_path(value: str, cwd: str) -> str | None:
    value = value.strip().strip("'\"")
    if any(marker in value for marker in ("$", "*", "?", "[", "]", "{", "}")):
        return None
    path = Path(value)
    if not path.is_absolute():
        path = Path(cwd) / path
    normalized = str(path.resolve())
    return normalized if is_historical_target(normalized) else None


def numbered_runs(output: str) -> list[list[tuple[int, str]]]:
    runs: list[list[tuple[int, str]]] = []
    run: list[tuple[int, str]] = []
    previous: int | None = None
    for line in output.splitlines():
        match = NUMBERED_RE.match(line)
        if match:
            number = int(match.group(1))
            if run and previous is not None and number != previous + 1:
                runs.append(run)
                run = []
            run.append((number, match.group(2)))
            previous = number
        elif run:
            runs.append(run)
            run = []
            previous = None
    if run:
        runs.append(run)
    return runs


def full_nl_snapshot(segment: str, run: list[tuple[int, str]]) -> bool:
    if not run or run[0][0] != 1:
        return False
    if "|" not in segment:
        return True
    sed = re.search(r"sed\s+-n\s+['\"]1,(\d+)p['\"]", segment)
    if sed:
        return run[-1][0] < int(sed.group(1))
    head = re.search(r"head\s+(?:-n\s+|-)(\d+)", segment)
    if head:
        return run[-1][0] < int(head.group(1))
    return False


def command_snapshots(event: dict[str, Any]) -> list[Operation]:
    data = event.get("data") or {}
    command = str(data.get("command") or "")
    output = str(data.get("aggregatedOutput") or "")
    # Unified exec may persist its presentation-level truncation markers in
    # aggregatedOutput.  Such stdout is not a whole-file readback and must
    # never overwrite a stronger fileChange snapshot.
    if TRUNCATED_OUTPUT_RE.search(output):
        return []
    matches = list(NL_RE.finditer(command))
    runs = numbered_runs(output)
    result: list[Operation] = []
    cwd = str(data.get("cwd") or "/Users/a10697/Work/DWP")
    if matches and len(matches) == len(runs):
        pairs = list(zip(matches, runs))
    else:
        pairs = []
    for index, (match, run) in enumerate(pairs):
        raw_path = next(group for group in match.groups() if group is not None)
        path = resolve_historical_command_path(raw_path, cwd)
        if path is None:
            continue
        command_end_candidates = [
            position
            for position in (command.find("\n", match.end()), command.find(";", match.end()))
            if position >= 0
        ]
        command_end = min(command_end_candidates) if command_end_candidates else len(command)
        segment = command[match.end() : command_end]
        if not full_nl_snapshot(segment, run):
            continue
        content = "\n".join(line for _number, line in run) + "\n"
        result.append(
            Operation(
                created_at_ms=int(event.get("created_at_ms") or 0),
                thread_id=str(event.get("thread_id", "")),
                turn_id=str(event.get("turn_id", "")),
                item_id=f"{event.get('item_id', '')}:nl-snapshot:{index}",
                rollout_ordinal=int(event.get("rollout_ordinal") or 0),
                change_index=index,
                path=path,
                kind="snapshot",
                move_path=None,
                diff=content,
            )
        )
    # A second conservative source is a command whose shell payload consists
    # solely of one whole-file reader.  No historical command is executed;
    # only its already-captured stdout is accepted as evidence.
    try:
        outer = shlex.split(command)
        command_index = next(
            index for index, token in enumerate(outer) if token in {"-c", "-lc"}
        )
        payload = outer[command_index + 1]
        unsafe_shell = any(token in payload for token in ("\n", ";", "&&", "||", "|", ">", "<"))
        inner = shlex.split(payload) if not unsafe_shell else []
    except (ValueError, IndexError):
        inner = []
    raw_path: str | None = None
    complete = False
    if len(inner) == 2 and inner[0] == "cat":
        raw_path = inner[1]
        complete = True
    elif len(inner) == 4 and inner[0:2] == ["sed", "-n"]:
        match = re.fullmatch(r"1,(\d+)p", inner[2])
        if match:
            raw_path = inner[3]
            complete = len(output.splitlines()) < int(match.group(1))
    elif len(inner) == 4 and inner[0:2] == ["head", "-n"] and inner[2].isdigit():
        raw_path = inner[3]
        complete = len(output.splitlines()) < int(inner[2])
    if raw_path and complete and str(data.get("status") or "") == "completed":
        path = resolve_historical_command_path(raw_path, cwd)
        if path is not None:
            result.append(
                Operation(
                    created_at_ms=int(event.get("created_at_ms") or 0),
                    thread_id=str(event.get("thread_id", "")),
                    turn_id=str(event.get("turn_id", "")),
                    item_id=f"{event.get('item_id', '')}:simple-snapshot",
                    rollout_ordinal=int(event.get("rollout_ordinal") or 0),
                    change_index=len(result),
                    path=path,
                    kind="snapshot",
                    move_path=None,
                    diff=output,
                )
            )
    return result


def load_operations(recovery_root: Path) -> list[Operation]:
    operations: list[Operation] = []
    seen_events: set[tuple[str, str, str]] = set()
    for archive in sorted((recovery_root / "threads").glob("*/events.jsonl.gz")):
        with gzip.open(archive, "rt", encoding="utf-8") as handle:
            for raw in handle:
                event = json.loads(raw)
                data = event.get("data") or {}
                if event.get("item_type") == "commandExecution" or data.get("type") == "commandExecution":
                    operations.extend(command_snapshots(event))
                    continue
                if event.get("item_type") != "fileChange" and data.get("type") != "fileChange":
                    continue
                event_key = (
                    str(event.get("thread_id", "")),
                    str(event.get("turn_id", "")),
                    str(event.get("item_id", "")),
                )
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)
                for index, change in enumerate(data.get("changes") or []):
                    path = str(change.get("path", ""))
                    move_path_value = (change.get("kind") or {}).get("move_path")
                    move_path = str(move_path_value) if move_path_value else None
                    if not is_historical_target(path):
                        continue
                    if move_path is not None and not is_historical_target(move_path):
                        raise ValueError(f"move escapes historical root: {path} -> {move_path}")
                    operations.append(
                        Operation(
                            created_at_ms=int(event.get("created_at_ms") or 0),
                            thread_id=event_key[0],
                            turn_id=event_key[1],
                            item_id=event_key[2],
                            rollout_ordinal=int(event.get("rollout_ordinal") or 0),
                            change_index=index,
                            path=path,
                            kind=str((change.get("kind") or {}).get("type", "")),
                            move_path=move_path,
                            diff=str(change.get("diff") or ""),
                        )
                    )
    return sorted(operations, key=lambda operation: operation.order_key)


def target_path(historical_path: str, destination_root: Path) -> Path:
    relative = Path(historical_path).relative_to(HISTORICAL_ROOT)
    result = destination_root / relative
    result.resolve().relative_to(destination_root.resolve())
    return result


def parse_hunks(diff: str) -> list[tuple[int, int, int, int, list[str]]]:
    lines = diff.splitlines()
    hunks: list[tuple[int, int, int, int, list[str]]] = []
    index = 0
    while index < len(lines):
        match = HUNK_RE.match(lines[index])
        if not match:
            index += 1
            continue
        old_start = int(match.group(1))
        old_count = int(match.group(2) or "1")
        new_start = int(match.group(3))
        new_count = int(match.group(4) or "1")
        index += 1
        body: list[str] = []
        while index < len(lines) and not HUNK_RE.match(lines[index]):
            line = lines[index]
            if line.startswith("\\ No newline at end of file"):
                index += 1
                continue
            if not line or line[0] not in " +-":
                raise ValueError(f"unsupported unified diff line: {line!r}")
            body.append(line)
            index += 1
        hunks.append((old_start, old_count, new_start, new_count, body))
    if diff and not hunks:
        raise ValueError("non-empty update contains no unified-diff hunk")
    return hunks


def _matching_offsets(lines: list[str], needle: list[str]) -> list[int]:
    if not needle:
        return list(range(len(lines) + 1))
    width = len(needle)
    return [
        index
        for index in range(0, len(lines) - width + 1)
        if lines[index : index + width] == needle
    ]


def apply_unified_diff(original: str, diff: str) -> tuple[str, Counter[str]]:
    if not diff:
        return original, Counter({"empty": 1})
    source = original.splitlines()
    resolutions: Counter[str] = Counter()
    for old_start, old_count, _new_start, new_count, body in parse_hunks(diff):
        old_lines: list[str] = []
        new_lines: list[str] = []
        for line in body:
            marker, value = line[0], line[1:]
            if marker in " -":
                old_lines.append(value)
                if marker == " ":
                    new_lines.append(value)
            elif marker == "+":
                new_lines.append(value)
        if len(old_lines) != old_count or len(new_lines) != new_count:
            raise ValueError(
                f"hunk width mismatch: declared old/new={old_count}/{new_count}, "
                f"observed={len(old_lines)}/{len(new_lines)}"
            )
        declared = max(0, min(old_start - 1, len(source)))
        if source[declared : declared + len(old_lines)] == old_lines:
            chosen = declared
            resolutions["declared"] += 1
        else:
            old_offsets = _matching_offsets(source, old_lines)
            if old_offsets:
                chosen = min(old_offsets, key=lambda offset: (abs(offset - declared), offset))
                resolutions["relocated"] += 1
            else:
                new_offsets = _matching_offsets(source, new_lines)
                if new_offsets:
                    # A concurrent/repeated event may describe a change whose
                    # post-image is already present.  Treat only the closest
                    # exact post-image as idempotently applied.
                    min(new_offsets, key=lambda offset: (abs(offset - declared), offset))
                    resolutions["already"] += 1
                    continue
                actual = source[declared] if declared < len(source) else "<EOF>"
                expected = old_lines[0] if old_lines else "<INSERTION>"
                raise ValueError(
                    f"hunk context not found near source line {old_start}: "
                    f"expected {expected!r}, got {actual!r}"
                )
        source[chosen : chosen + len(old_lines)] = new_lines
    # Historical text artifacts consistently used POSIX final newlines.  Add
    # snapshots preserve their bytes exactly; update events omit the marker,
    # so retain the input newline state and default non-empty files to newline.
    final_newline = original.endswith("\n") or bool(source)
    return "\n".join(source) + ("\n" if final_newline else ""), resolutions


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replay(operations: Iterable[Operation], destination_root: Path) -> dict[str, Any]:
    counters: Counter[str] = Counter()
    hunk_resolutions: Counter[str] = Counter()
    failures: list[dict[str, Any]] = []
    path_history: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    destination_root.mkdir(parents=True, exist_ok=True)
    for operation in operations:
        source = target_path(operation.path, destination_root)
        destination = (
            target_path(operation.move_path, destination_root)
            if operation.move_path
            else source
        )
        record = {
            "createdAtMs": operation.created_at_ms,
            "threadId": operation.thread_id,
            "turnId": operation.turn_id,
            "itemId": operation.item_id,
            "kind": operation.kind,
            "movePath": operation.move_path,
        }
        try:
            if operation.kind == "add":
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(operation.diff, encoding="utf-8")
                if operation.move_path and source != destination and source.exists():
                    source.unlink()
            elif operation.kind == "snapshot":
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(operation.diff, encoding="utf-8")
            elif operation.kind == "update":
                if not source.is_file():
                    raise FileNotFoundError("update base file is absent")
                updated, resolutions = apply_unified_diff(
                    source.read_text(encoding="utf-8"), operation.diff
                )
                hunk_resolutions.update(resolutions)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(updated, encoding="utf-8")
                if operation.move_path and source != destination:
                    source.unlink()
            elif operation.kind == "delete":
                if source.exists():
                    source.unlink()
            else:
                raise ValueError(f"unsupported change kind: {operation.kind!r}")
            counters[operation.kind] += 1
            record["status"] = "applied"
        except (OSError, UnicodeError, ValueError) as error:
            counters["failed"] += 1
            record["status"] = "failed"
            record["error"] = f"{type(error).__name__}: {error}"
            failures.append({"path": operation.path, **record})
        path_history[operation.path].append(record)

    files = sorted(path for path in destination_root.rglob("*") if path.is_file())
    manifest = [
        {
            "path": path.relative_to(destination_root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in files
    ]
    return {
        "schema": "dwp.hris.blueprint.filechange-replay.v1",
        "historicalRoot": str(HISTORICAL_ROOT),
        "destinationRoot": str(destination_root),
        "operationCount": sum(1 for _ in operations) if not isinstance(operations, list) else len(operations),
        "operationResults": dict(sorted(counters.items())),
        "hunkResolutions": dict(sorted(hunk_resolutions.items())),
        "failureCount": len(failures),
        "failures": failures,
        "fileCount": len(files),
        "manifest": manifest,
        "pathHistory": dict(sorted(path_history.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recovery-root", required=True, type=Path)
    parser.add_argument("--destination-root", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    operations = load_operations(args.recovery_root)
    report = replay(operations, args.destination_root)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "operations": report["operationCount"],
                "applied": sum(
                    value
                    for key, value in report["operationResults"].items()
                    if key != "failed"
                ),
                "failed": report["failureCount"],
                "files": report["fileCount"],
                "report": str(args.report),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0 if not report["failures"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
