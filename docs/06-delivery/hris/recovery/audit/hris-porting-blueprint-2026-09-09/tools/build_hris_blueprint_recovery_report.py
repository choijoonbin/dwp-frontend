#!/usr/bin/env python3
"""Build an evidence-only inventory and verification report for HRIS recovery.

The input replay report is produced by replay_hris_blueprint_filechanges.py.
This script does not execute historical commands or infer missing artifact
contents.  It inventories the bytes that were recovered, extracts path-only
existence evidence from captured command output, and records limitations.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


HISTORICAL_ROOT = "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09"
RELATIVE_ROOT = "output/hris-porting-blueprint-2026-09-09"
REFERENCE_RE = re.compile(
    rf"^(?:/Users/a10697/Work/DWP/)?{re.escape(RELATIVE_ROOT)}/(.+)$"
)
OUTPUT_METADATA_FILES = {"RECOVERY_INVENTORY.md", "RECOVERY_MANIFEST.json"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_relative(value: str) -> str | None:
    value = value.strip().rstrip("/")
    if not value or value.startswith("/"):
        return None
    path = Path(value)
    if ".." in path.parts:
        return None
    return path.as_posix()


def collect_path_references(recovery_root: Path) -> dict[str, dict[str, Any]]:
    references: dict[str, dict[str, Any]] = {}
    for archive in sorted((recovery_root / "threads").glob("*/events.jsonl.gz")):
        with gzip.open(archive, "rt", encoding="utf-8") as handle:
            for raw in handle:
                event = json.loads(raw)
                data = event.get("data") or {}
                if event.get("item_type") != "commandExecution" and data.get("type") != "commandExecution":
                    continue
                output = str(data.get("aggregatedOutput") or "")
                for line in output.splitlines():
                    match = REFERENCE_RE.fullmatch(line.strip())
                    if not match:
                        continue
                    relative = safe_relative(match.group(1))
                    if relative is None:
                        continue
                    created_at = int(event.get("created_at_ms") or 0)
                    item_id = str(event.get("item_id") or "")
                    entry = references.setdefault(
                        relative,
                        {
                            "firstSeenMs": created_at,
                            "lastSeenMs": created_at,
                            "evidenceCount": 0,
                            "firstItemId": item_id,
                            "lastItemId": item_id,
                        },
                    )
                    entry["evidenceCount"] += 1
                    if created_at < entry["firstSeenMs"]:
                        entry["firstSeenMs"] = created_at
                        entry["firstItemId"] = item_id
                    if created_at >= entry["lastSeenMs"]:
                        entry["lastSeenMs"] = created_at
                        entry["lastItemId"] = item_id
    return references


def evidence_class(relative: str) -> str:
    path = Path(relative)
    parts = path.parts
    if path.name == ".DS_Store" or "__pycache__" in parts or path.suffix == ".pyc":
        return "CACHE_OR_OS_METADATA"
    if path.name.endswith(".tmp") or any(
        part.startswith(("modern-canonical-candidate.", "modern-physical-candidate."))
        for part in parts
    ) or "transient" in path.name:
        return "TEMP_OR_CANDIDATE"
    if "reports" in parts or "report" in path.name or "receipt" in path.name:
        return "REPORT_OR_RECEIPT"
    return "BLUEPRINT_ARTIFACT"


def validate_files(destination: Path) -> dict[str, Any]:
    checks: dict[str, Any] = {}

    json_failures: list[dict[str, str]] = []
    json_files = sorted(
        path
        for path in destination.rglob("*.json")
        if path.relative_to(destination).as_posix() not in OUTPUT_METADATA_FILES
    )
    for path in json_files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            json_failures.append(
                {"path": path.relative_to(destination).as_posix(), "error": str(error)}
            )
    checks["json"] = {
        "total": len(json_files),
        "passed": len(json_files) - len(json_failures),
        "failed": len(json_failures),
        "failures": json_failures,
    }

    jsonl_failures: list[dict[str, str]] = []
    jsonl_files = sorted(destination.rglob("*.jsonl"))
    for path in jsonl_files:
        line_number = 0
        try:
            for line_number, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                if line.strip():
                    json.loads(line)
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            jsonl_failures.append(
                {
                    "path": path.relative_to(destination).as_posix(),
                    "error": f"line {line_number}: {error}",
                }
            )
    checks["jsonl"] = {
        "total": len(jsonl_files),
        "passed": len(jsonl_files) - len(jsonl_failures),
        "failed": len(jsonl_failures),
        "failures": jsonl_failures,
    }

    csv_failures: list[dict[str, str]] = []
    csv_files = sorted(destination.rglob("*.csv"))
    for path in csv_files:
        try:
            with path.open(encoding="utf-8", newline="") as handle:
                list(csv.reader(handle))
        except (OSError, UnicodeError, csv.Error) as error:
            csv_failures.append(
                {"path": path.relative_to(destination).as_posix(), "error": str(error)}
            )
    checks["csv"] = {
        "total": len(csv_files),
        "passed": len(csv_files) - len(csv_failures),
        "failed": len(csv_failures),
        "failures": csv_failures,
    }

    python_failures: list[dict[str, str]] = []
    python_files = sorted(destination.rglob("*.py"))
    for path in python_files:
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except (OSError, UnicodeError, SyntaxError) as error:
            python_failures.append(
                {"path": path.relative_to(destination).as_posix(), "error": str(error)}
            )
    checks["pythonSyntax"] = {
        "total": len(python_files),
        "passed": len(python_files) - len(python_failures),
        "failed": len(python_failures),
        "failures": python_failures,
    }

    javascript_failures: list[dict[str, str]] = []
    javascript_files = sorted(
        path
        for path in destination.rglob("*")
        if path.is_file() and path.suffix in {".js", ".cjs"}
    )
    node = shutil.which("node")
    if node:
        for path in javascript_files:
            result = subprocess.run(
                [node, "--check", str(path)],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode:
                javascript_failures.append(
                    {
                        "path": path.relative_to(destination).as_posix(),
                        "error": (result.stderr or result.stdout).strip(),
                    }
                )
    checks["javascriptSyntax"] = {
        "available": bool(node),
        "total": len(javascript_files),
        "passed": len(javascript_files) - len(javascript_failures) if node else 0,
        "failed": len(javascript_failures),
        "failures": javascript_failures,
    }

    truncation_re = re.compile(
        rb"(?:^Warning: truncated output \(original token count:|"
        rb"^\.\.\. \d+ bytes omitted \.\.\.$)",
        re.MULTILINE,
    )
    marker_files = []
    for path in sorted(p for p in destination.rglob("*") if p.is_file()):
        if path.relative_to(destination).as_posix() in OUTPUT_METADATA_FILES:
            continue
        if truncation_re.search(path.read_bytes()):
            marker_files.append(path.relative_to(destination).as_posix())
    checks["embeddedTruncationMarkers"] = {
        "failed": len(marker_files),
        "paths": marker_files,
    }
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recovery-root", required=True, type=Path)
    parser.add_argument("--replay-report", required=True, type=Path)
    parser.add_argument("--destination-root", required=True, type=Path)
    parser.add_argument("--report-dir", required=True, type=Path)
    parser.add_argument("--reference-list", type=Path)
    parser.add_argument(
        "--supplemental-evidence-report", action="append", default=[], type=Path
    )
    parser.add_argument("--scoped-packets-dir", type=Path)
    parser.add_argument("--scoped-validator", type=Path)
    args = parser.parse_args()

    replay = json.loads(args.replay_report.read_text(encoding="utf-8"))
    destination = args.destination_root.resolve()
    report_dir = args.report_dir.resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.replay_report, report_dir / "staging-replay-report.json")

    if args.reference_list:
        reference_values = sorted(
            {
                value
                for raw in args.reference_list.read_text(encoding="utf-8").splitlines()
                if (value := safe_relative(raw)) is not None
            }
        )
        references = {
            value: {
                "firstSeenMs": "",
                "lastSeenMs": "",
                "evidenceCount": 1,
                "firstItemId": "PREEXTRACTED_COMMAND_OUTPUT_PATH_LIST",
                "lastItemId": "PREEXTRACTED_COMMAND_OUTPUT_PATH_LIST",
            }
            for value in reference_values
        }
        (report_dir / "referenced-paths-from-command-output.txt").write_text(
            "\n".join(reference_values) + "\n", encoding="utf-8"
        )
    else:
        references = collect_path_references(args.recovery_root)
    reference_set = set(references)
    directories: set[str] = set()
    for referenced_path in reference_set:
        parts = Path(referenced_path).parts
        for width in range(1, len(parts)):
            parent = Path(*parts[:width]).as_posix()
            if parent in reference_set:
                directories.add(parent)
    reference_files = set(references) - directories

    actual_manifest = []
    for path in sorted(p for p in destination.rglob("*") if p.is_file()):
        if path.relative_to(destination).as_posix() in OUTPUT_METADATA_FILES:
            continue
        actual_manifest.append(
            {
                "path": path.relative_to(destination).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    actual_by_path = {item["path"]: item for item in actual_manifest}
    replay_by_path = {item["path"]: item for item in replay["manifest"]}

    supplementals: dict[str, dict[str, Any]] = {}
    for evidence_path in args.supplemental_evidence_report:
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        relative = evidence.get("relativePath")
        if relative is None:
            historical = str(evidence.get("historicalPath") or "")
            marker = RELATIVE_ROOT + "/"
            if not historical.startswith(marker):
                raise ValueError(f"cannot resolve supplemental path: {evidence_path}")
            relative = historical[len(marker) :]
        actual = actual_by_path.get(relative)
        if not actual or actual["sha256"] != evidence["sha256"]:
            raise ValueError(f"supplemental evidence mismatch: {relative}")
        supplementals[relative] = evidence

    histories: dict[str, list[dict[str, Any]]] = {}
    prefix = replay["historicalRoot"].rstrip("/") + "/"
    for absolute, history in replay["pathHistory"].items():
        if not absolute.startswith(prefix):
            raise ValueError(f"history path outside root: {absolute}")
        histories[absolute[len(prefix) :]] = history

    inventory_rows = []
    status_counts: Counter[str] = Counter()
    event_missing = []
    all_paths = sorted(set(actual_by_path) | set(histories) | reference_files)
    for relative in all_paths:
        history = histories.get(relative, [])
        actual = actual_by_path.get(relative)
        reference = references.get(relative, {})
        last_seed = max(
            (
                index
                for index, item in enumerate(history)
                if item["status"] == "applied" and item["kind"] in {"add", "snapshot"}
            ),
            default=-1,
        )
        failures = sum(item["status"] == "failed" for item in history)
        failures_after_seed = (
            sum(item["status"] == "failed" for item in history[last_seed + 1 :])
            if last_seed >= 0
            else failures
        )
        if actual and relative in supplementals:
            status = "RECOVERED_HASH_VERIFIED_NUMBERED_EVIDENCE"
        elif actual:
            if last_seed >= 0 and failures_after_seed == 0:
                status = "RECOVERED_EVENT_CHAIN_COMPLETE"
            else:
                status = "RECOVERED_PARTIAL_EVENT_CHAIN"
        elif history and history[-1]["status"] == "applied" and history[-1]["kind"] == "delete":
            status = "HISTORICALLY_DELETED"
        elif relative in reference_files:
            status = "REFERENCE_ONLY"
            if history:
                event_missing.append(relative)
        else:
            status = "UNRECOVERED_EVENT_PATH"
            event_missing.append(relative)
        status_counts[status] += 1
        inventory_rows.append(
            {
                "path": relative,
                "status": status,
                "evidence_class": evidence_class(relative),
                "bytes": actual["bytes"] if actual else "",
                "sha256": actual["sha256"] if actual else "",
                "operation_count": len(history),
                "applied_operation_count": sum(
                    item["status"] == "applied" for item in history
                ),
                "failed_operation_count": failures,
                "failed_after_last_seed": failures_after_seed,
                "last_seed_kind": (
                    "numbered_evidence"
                    if relative in supplementals
                    else history[last_seed]["kind"] if last_seed >= 0 else ""
                ),
                "last_event_kind": history[-1]["kind"] if history else "",
                "reference_count": reference.get("evidenceCount", 0),
                "first_reference_ms": reference.get("firstSeenMs", ""),
                "last_reference_ms": reference.get("lastSeenMs", ""),
                "last_reference_item_id": reference.get("lastItemId", ""),
            }
        )

    fields = list(inventory_rows[0])
    with (report_dir / "recovery-inventory.csv").open(
        "w", encoding="utf-8", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(inventory_rows)

    reference_only = [row for row in inventory_rows if row["status"] == "REFERENCE_ONLY"]
    with (report_dir / "referenced-but-not-restored.csv").open(
        "w", encoding="utf-8", newline=""
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(reference_only)

    with (report_dir / "referenced-directories.csv").open(
        "w", encoding="utf-8", newline=""
    ) as handle:
        fields_dir = [
            "path",
            "reference_count",
            "first_reference_ms",
            "last_reference_ms",
            "last_reference_item_id",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields_dir)
        writer.writeheader()
        for relative in sorted(directories):
            ref = references[relative]
            writer.writerow(
                {
                    "path": relative,
                    "reference_count": ref["evidenceCount"],
                    "first_reference_ms": ref["firstSeenMs"],
                    "last_reference_ms": ref["lastSeenMs"],
                    "last_reference_item_id": ref["lastItemId"],
                }
            )

    validation = validate_files(destination)
    failure_paths = {item["path"] for item in replay["failures"]}
    expected_by_path = dict(replay_by_path)
    for relative in supplementals:
        expected_by_path[relative] = actual_by_path[relative]

    binding_rows: list[dict[str, Any]] = []
    binding_summary: dict[str, dict[str, int]] = {}
    if args.scoped_packets_dir:
        for packet_path in sorted(args.scoped_packets_dir.glob("*.v1.json")):
            packet = json.loads(packet_path.read_text(encoding="utf-8"))
            session = packet["sessionId"]
            passed = 0
            bindings = packet.get("contractBindings", [])
            for binding in bindings:
                path = Path("/Users/a10697/Work/DWP") / binding["path"]
                actual_sha = sha256_file(path) if path.is_file() else "MISSING"
                actual_bytes = path.stat().st_size if path.is_file() else -1
                ok = actual_sha == binding["sha256"] and actual_bytes == binding["byteLength"]
                passed += int(ok)
                binding_rows.append(
                    {
                        "session": session,
                        "status": "PASS" if ok else "FAIL",
                        "path": binding["path"],
                        "expected_sha256": binding["sha256"],
                        "actual_sha256": actual_sha,
                        "expected_bytes": binding["byteLength"],
                        "actual_bytes": actual_bytes,
                    }
                )
            binding_summary[session] = {
                "total": len(bindings),
                "passed": passed,
                "failed": len(bindings) - passed,
            }
        with (report_dir / "scoped-contract-bindings.csv").open(
            "w", encoding="utf-8", newline=""
        ) as handle:
            writer = csv.DictWriter(handle, fieldnames=list(binding_rows[0]))
            writer.writeheader()
            writer.writerows(binding_rows)

    scoped_validator = None
    if args.scoped_validator:
        result = subprocess.run(
            [sys.executable, str(args.scoped_validator), "--all", "--compact"],
            cwd=args.scoped_validator.parent.parent,
            capture_output=True,
            text=True,
            check=False,
        )
        scoped_validator = {
            "exitCode": result.returncode,
            "result": json.loads(result.stdout),
            "stderr": result.stderr,
        }
    verification = {
        "schema": "dwp.hris.blueprint.recovery-verification.v1",
        "evidencePolicy": {
            "skkfReanalysis": False,
            "historicalCommandsExecuted": False,
            "inventedMissingContent": False,
            "sources": ["fileChange events", "captured complete file readbacks", "captured path listings"],
        },
        "historicalRoot": HISTORICAL_ROOT,
        "destinationRoot": str(destination),
        "replay": {
            "operationCount": replay["operationCount"],
            "operationResults": replay["operationResults"],
            "failureCount": replay["failureCount"],
            "failurePathCount": len(failure_paths),
            "hunkResolutions": replay["hunkResolutions"],
        },
        "inventory": {
            "fileCount": len(actual_manifest),
            "statusCounts": dict(sorted(status_counts.items())),
            "pathReferenceCount": len(references),
            "referencedDirectoryCount": len(directories),
            "referencedFileOrLeafCount": len(reference_files),
            "referenceOnlyCount": len(reference_only),
            "referenceOnlyByEvidenceClass": dict(
                sorted(Counter(row["evidence_class"] for row in reference_only).items())
            ),
            "eventHistoryButNotRestoredCount": len(event_missing),
            "eventHistoryButNotRestored": sorted(event_missing),
            "supplementalHashVerifiedCount": len(supplementals),
            "supplementalEvidence": {
                relative: {
                    "sha256": evidence["sha256"],
                    "report": str(path),
                }
                for relative, evidence, path in (
                    (relative, supplementals[relative], next(
                        candidate for candidate in args.supplemental_evidence_report
                        if json.loads(candidate.read_text(encoding="utf-8")).get("sha256") == supplementals[relative]["sha256"]
                    ))
                    for relative in sorted(supplementals)
                )
            },
        },
        "manifest": {
            "actualFileCount": len(actual_manifest),
            "stagingFileCount": len(replay_by_path),
            "supplementalFileCount": len(supplementals),
            "expectedFileCount": len(expected_by_path),
            "exactMatch": actual_by_path == expected_by_path,
            "missingFromDestination": sorted(set(expected_by_path) - set(actual_by_path)),
            "unexpectedInDestination": sorted(set(actual_by_path) - set(expected_by_path)),
            "hashOrSizeMismatch": sorted(
                path
                for path in set(actual_by_path) & set(expected_by_path)
                if actual_by_path[path] != expected_by_path[path]
            ),
        },
        "formatChecks": validation,
        "scopedContractBindings": {
            "summary": binding_summary,
            "total": len(binding_rows),
            "passed": sum(row["status"] == "PASS" for row in binding_rows),
            "failed": sum(row["status"] == "FAIL" for row in binding_rows),
            "failures": [row for row in binding_rows if row["status"] == "FAIL"],
        },
        "scopedValidator": scoped_validator,
        "fullHistoricalValidatorRun": {
            "status": "NOT_RUN",
            "reason": "The recovered surface contains partial and reference-only artifacts; running historical generators or validators could mutate or misrepresent evidence.",
        },
    }
    (report_dir / "verification.json").write_text(
        json.dumps(verification, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    counts = verification["inventory"]["statusCounts"]
    format_lines = []
    for name in ("json", "jsonl", "csv", "pythonSyntax", "javascriptSyntax"):
        check = validation[name]
        availability = "" if check.get("available", True) else " (검사기 없음)"
        format_lines.append(
            f"| {name} | {check['total']} | {check['passed']} | {check['failed']} |{availability}"
        )
    missing_lines = "\n".join(f"- `{path}`" for path in sorted(event_missing)) or "- 없음"
    json_failure_lines = "\n".join(
        f"- `{item['path']}` — {item['error']}" for item in validation["json"]["failures"]
    ) or "- 없음"
    binding_table_lines = "\n".join(
        f"| {session} | {summary['passed']}/{summary['total']} | {summary['failed']} |"
        for session, summary in sorted(binding_summary.items())
    ) or "| 해당 없음 | 0/0 | 0 |"
    binding_failure_lines = "\n".join(
        f"- `{row['path']}` — expected `{row['expected_sha256']}`, actual `{row['actual_sha256']}`"
        for row in binding_rows
        if row["status"] == "FAIL"
    ) or "- 없음"
    scoped_status = (
        scoped_validator["result"].get("status", "UNKNOWN")
        if scoped_validator
        else "NOT_RUN"
    )
    report = f"""# HRIS blueprint evidence recovery report

## 결과

복구 대상은 `{HISTORICAL_ROOT}`이며, 복구 세션의 `fileChange`와 캡처된 완전 파일 readback만 재생했다. 과거 생성 명령은 실행하지 않았고 SKKF를 다시 해석하거나 누락 내용을 새로 작성하지 않았다.

| 구분 | 수 |
|---|---:|
| 실제 복원 파일 | {len(actual_manifest)} |
| 이벤트 체인 무충돌 복원 | {counts.get('RECOVERED_EVENT_CHAIN_COMPLETE', 0)} |
| 부분 복원 | {counts.get('RECOVERED_PARTIAL_EVENT_CHAIN', 0)} |
| 번호행+최종 SHA로 추가 복원 | {counts.get('RECOVERED_HASH_VERIFIED_NUMBERED_EVIDENCE', 0)} |
| 경로 참조만 있고 미복원 | {counts.get('REFERENCE_ONLY', 0)} |
| 이벤트상 삭제 | {counts.get('HISTORICALLY_DELETED', 0)} |
| 참조 디렉터리 | {len(directories)} |
| 재생 실패 operation | {replay['failureCount']} ({len(failure_paths)}개 경로) |

`RECOVERED_EVENT_CHAIN_COMPLETE`는 마지막 `add`/완전 readback 이후의 수집된 fileChange가 모두 적용됐다는 뜻이다. 수집되지 않은 과거 shell 기반 재생성까지 보장하는 표현은 아니다. `RECOVERED_PARTIAL_EVENT_CHAIN`은 파일은 있으나 마지막 기준점 이후 하나 이상의 diff를 적용하지 못했다. `REFERENCE_ONLY`는 과거 목록 출력에서 존재가 입증됐지만 바이트를 복구할 증거가 없었던 항목이다.

## 검증

스테이징 replay + SHA 검증 추가복원 manifest와 정본 복사본의 파일 경로·크기·SHA-256 일치: **{str(verification['manifest']['exactMatch']).lower()}**

| 검사 | 대상 | 통과 | 실패 |
|---|---:|---:|---:|
{chr(10).join(format_lines)}

전체 역사 validator는 실행하지 않았다. 부분/미복원 artifact가 있는 상태에서 실행하면 증거 복원과 새 결과 생성을 혼동할 수 있기 때문이다.

## Scoped authoring control

`validate_scoped_authoring_control.py --all --compact` 결과는 **{scoped_status}**다. 역사 worktree 절대경로가 없으므로 backend/frontend exact-clean 검사는 모두 fail-closed다. 계약 binding은 별도로 다음과 같다.

| 세션 | contractBindings PASS | FAIL |
|---|---:|---:|
{binding_table_lines}

### contractBindings 실패

{binding_failure_lines}

위 HRM 계약 파일은 경로와 부분 바이트는 복원됐지만 packet의 최종 크기·SHA-256과 일치하는 완전 원문 증거를 확보하지 못한 **critical recovery blocker**다. 임의로 보완하지 않았다.

### JSON 구문 실패

{json_failure_lines}

### fileChange 이력도 있으나 복원하지 못한 파일

{missing_lines}

## 산출물

- `recovery-inventory.csv`: 복원/부분복원/참조만 존재/삭제 전체 분류
- `referenced-but-not-restored.csv`: 경로 참조만 확인된 파일 또는 leaf 경로
- `referenced-directories.csv`: 파일 수에서 제외한 디렉터리 참조
- `verification.json`: 해시 비교, 재생 통계, 형식 검증 결과
- `staging-replay-report.json`: 원시 재생 이력과 모든 실패 operation

## 제한

- 재생 실패 operation 수는 누락 파일 수가 아니다. 동일 파일에 대한 병렬/후속 diff 실패가 반복 집계된다.
- 경로 목록은 파일 바이트 증거가 아니므로 해당 항목을 임의 생성하지 않았다.
- 복원 파일 안에 남은 truncation marker는 `{', '.join(validation['embeddedTruncationMarkers']['paths']) or '없음'}`이다. 이는 readback 스냅샷에서 새로 유입한 것이 아니라 fileChange 증거 자체에 포함된 상태로 보존했다.
"""
    (report_dir / "RECOVERY_REPORT.md").write_text(report, encoding="utf-8")

    # These two files are recovery metadata, not recovered historical
    # artifacts.  They are intentionally written only after the historical
    # manifest comparison and excluded from recovered-file counts.
    output_manifest = {
        "schema": "dwp.hris.blueprint.recovery-metadata.v1",
        "metadataOnly": True,
        "historicalArtifactCount": len(actual_manifest),
        "historicalArtifacts": actual_manifest,
        "statusCounts": dict(sorted(status_counts.items())),
        "referenceOnlyCount": len(reference_only),
        "manifestVerifiedAgainstStagingReplay": verification["manifest"]["exactMatch"],
        "recoveryReport": str(report_dir / "RECOVERY_REPORT.md"),
        "recoveryVerification": str(report_dir / "verification.json"),
    }
    (destination / "RECOVERY_MANIFEST.json").write_text(
        json.dumps(output_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    output_inventory = f"""# Recovery metadata — HRIS blueprint

이 문서는 복구된 역사 산출물 자체가 아니라 **recovery metadata**다. 원본과 혼동하지 않는다.

- 복구한 역사 파일: {len(actual_manifest)}개
- 수집된 이벤트 체인 무충돌: {counts.get('RECOVERED_EVENT_CHAIN_COMPLETE', 0)}개
- 부분 복구: {counts.get('RECOVERED_PARTIAL_EVENT_CHAIN', 0)}개
- 번호행+최종 SHA로 추가 복구: {counts.get('RECOVERED_HASH_VERIFIED_NUMBERED_EVIDENCE', 0)}개
- 경로 참조만 있고 바이트 미복원: {counts.get('REFERENCE_ONLY', 0)}개
- 이벤트상 삭제: {counts.get('HISTORICALLY_DELETED', 0)}개
- 스테이징 대비 경로·크기·SHA-256 일치: {str(verification['manifest']['exactMatch']).lower()}

복구에는 `fileChange`와 캡처된 완전 파일 readback만 사용했다. 과거 생성 명령 실행, SKKF 재해석, 누락 내용의 임의 생성은 하지 않았다.

Scoped authoring validator 전체 결과는 `{scoped_status}`다. contractBindings는 {sum(row['status'] == 'PASS' for row in binding_rows)}/{len(binding_rows)} PASS이며 현재 실패는 다음과 같다:

{binding_failure_lines}

동일 디렉터리의 `RECOVERY_MANIFEST.json`은 복구된 {len(actual_manifest)}개 역사 파일의 상대경로·크기·SHA-256과 상태 요약을 담는다. 상세 inventory와 실패 이력은 `{report_dir}`에 있다.
"""
    (destination / "RECOVERY_INVENTORY.md").write_text(
        output_inventory, encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "files": len(actual_manifest),
                "statuses": dict(sorted(status_counts.items())),
                "references": len(references),
                "referenceOnly": len(reference_only),
                "manifestMatch": verification["manifest"]["exactMatch"],
                "reportDir": str(report_dir),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
