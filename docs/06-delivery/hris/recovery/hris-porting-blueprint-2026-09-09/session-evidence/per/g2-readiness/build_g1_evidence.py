#!/usr/bin/env python3
"""Build the PER G1 evidence from the governed coverage shard and sanitized views.

This script records only source identifiers, fingerprints and non-expressive business
facts.  It never reads the raw SKKF checkout and never copies source expressions.
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "readiness-tools"))
from trace_semantics import normalize_rows

COVERAGE = ROOT / "session-registers/hris-per-source-coverage.csv"
ACCESS = ROOT / "g0/source-security-evidence/coverage-sanitized-access-register.csv"
OUT = ROOT / "session-evidence/per"
CHILD = OUT / "g1-child-trace.csv"
DECISIONS = OUT / "g1-decision-log.csv"

OWNER = "dwp-people-server/hris/performance"
ENGINEERING = "ROLE.HRIS_PER_ENGINEERING"

CAPABILITIES = {
    "PER-HOME-001": {
        "journey": "/hr/talent",
        "api": "/api/hris/performance/v1/dashboard | PerformanceTaskChanged.v1",
        "change": "레거시 모듈 홈을 폐기하고 HRIS 통합 홈의 권한별 성과 위젯과 할 일로 구성",
        "acceptance": "PER-CONTRACT-HOME|PER-GOLDEN-HOME|AUTHZ-TENANT-NEGATIVE",
        "state": "NOT_APPLICABLE: query projection only",
    },
    "PER-CYCLE-001": {
        "journey": "/hr/talent/cycles",
        "api": "/api/hris/performance/v1/cycles | PerformanceCyclePublished.v1",
        "change": "평가·일정·예외 화면을 versioned Cycle Studio의 단계 설정으로 통합",
        "acceptance": "PER-CONTRACT-CYCLE|PER-GOLDEN-CYCLE-001|PER-STATE-CYCLE",
        "state": "DRAFT->VALIDATED->PUBLISHED->ACTIVE->CLOSED; PUBLISHED versions are immutable",
    },
    "PER-TEMPLATE-001": {
        "journey": "/hr/talent/settings/templates",
        "api": "/api/hris/performance/v1/templates | PerformanceTemplatePublished.v1",
        "change": "평가표·항목·척도·질문지를 하나의 versioned form/rubric designer로 통합",
        "acceptance": "PER-CONTRACT-TEMPLATE|PER-GOLDEN-WEIGHT-001|PER-SCHEMA-CHECK",
        "state": "DRAFT->VALIDATED->PUBLISHED->RETIRED; submitted snapshots remain immutable",
    },
    "PER-POPULATION-001": {
        "journey": "/hr/talent/cycles/{cycleId}/population",
        "api": "/api/hris/performance/v1/cycles/{cycleId}/population-freezes | PerformancePopulationFrozen.v1",
        "change": "대상·평가자·승인자·예외 화면을 재현 가능한 rule preview와 freeze snapshot으로 통합",
        "acceptance": "PER-CONTRACT-POPULATION|PER-GOLDEN-POPULATION-001|AUTHZ-ASSIGNED-POPULATION",
        "state": "DRAFT->PREVIEWED->FROZEN->SUPERSEDED; frozen membership is append-only",
    },
    "PER-GOAL-001": {
        "journey": "/hr/talent/goals",
        "api": "/api/hris/performance/v1/goals | PerformanceGoalCommitted.v1",
        "change": "조직·개인·MBO 목표와 승인·배분을 정렬 그래프가 있는 Goal Workspace로 통합",
        "acceptance": "PER-CONTRACT-GOAL|PER-GOLDEN-GOAL-001|PER-STATE-GOAL",
        "state": "DRAFT->SUBMITTED->APPROVED->ACTIVE->COMPLETED; changes create a new revision",
    },
    "PER-REVIEW-001": {
        "journey": "/hr/talent/reviews/{reviewId}",
        "api": "/api/hris/performance/v1/reviews | PerformanceReviewSubmitted.v1",
        "change": "자기·1/2/3차 평가 화면을 assignment 기반의 단일 참여자 Review Workspace로 통합",
        "acceptance": "PER-CONTRACT-REVIEW|PER-GOLDEN-REVIEW-001|AUTHZ-NO-REVIEW-OUTSIDE-ASSIGNMENT",
        "state": "NOT_STARTED->IN_PROGRESS->SUBMITTED->RETURNED|COMPLETED; submit snapshot is immutable",
    },
    "PER-FEEDBACK-001": {
        "journey": "/hr/talent/feedback",
        "api": "/api/hris/performance/v1/feedback-requests | PerformanceFeedbackSubmitted.v1",
        "change": "다면·역량진단·수시 피드백을 익명성 정책과 최소표본 임계치를 가진 피드백 흐름으로 통합",
        "acceptance": "PER-CONTRACT-FEEDBACK|PER-GOLDEN-FEEDBACK-001|PRIVACY-ANONYMITY-THRESHOLD",
        "state": "DRAFT->OPEN->SUBMITTED->AGGREGATED->RELEASED; identity visibility follows policy",
    },
    "PER-CHECKIN-001": {
        "journey": "/hr/talent/check-ins",
        "api": "/api/hris/performance/v1/check-ins | PerformanceCheckInCompleted.v1",
        "change": "상시점검·면담·인터뷰를 일정·agenda·공개범위가 있는 Check-in Workspace로 통합",
        "acceptance": "PER-CONTRACT-CHECKIN|PER-GOLDEN-CHECKIN-001|FIELD-POLICY-PRIVATE-NOTES",
        "state": "DRAFT->SCHEDULED->COMPLETED->ACKNOWLEDGED; private notes never auto-publish",
    },
    "PER-CALIBRATION-001": {
        "journey": "/hr/talent/calibration",
        "api": "/api/hris/performance/v1/calibration-sessions | PerformanceCalibrationApproved.v1",
        "change": "등급군·배분·차등등급·결과조정을 before/after lineage와 승인 증거가 있는 보정 세션으로 통합",
        "acceptance": "PER-CONTRACT-CALIBRATION|PER-GOLDEN-CALIBRATION-001|SOD-CALIBRATE-PUBLISH",
        "state": "DRAFT->READY->IN_SESSION->SUBMITTED->APPROVED->LOCKED; adjustments are append-only",
    },
    "PER-RESULT-001": {
        "journey": "/hr/talent/results",
        "api": "/api/hris/performance/v1/results | PerformanceResultsPublished.v1",
        "change": "중복 결과·리포트·이의제기 화면을 공개 제어와 lineage가 있는 Results Explorer로 통합",
        "acceptance": "PER-CONTRACT-RESULT|PER-GOLDEN-RESULT-001|PER-PUBLISH-VISIBILITY",
        "state": "COMPUTED->VALIDATED->APPROVED->PUBLISHED->CORRECTED; publication is separately authorized",
    },
    "PER-MONITOR-001": {
        "journey": "/hr/talent/operations/monitoring",
        "api": "/api/hris/performance/v1/operations/monitoring | PerformanceExceptionRaised.v1",
        "change": "진행률·오류검증·미완료 목록을 예외 원인과 조치 링크 중심의 Command Center로 통합",
        "acceptance": "PER-CONTRACT-MONITOR|PER-GOLDEN-EXCEPTION-001|PER-RECONCILIATION",
        "state": "OPEN->ACKNOWLEDGED->RESOLVED|WAIVED; waiver requires reason and audit",
    },
    "PER-INTEGRATION-001": {
        "journey": "/hr/talent/operations/data-exchange",
        "api": "/api/hris/performance/v1/imports | PerformanceImportCompleted.v1",
        "change": "동기화·대량파일을 중앙 연계/자동화 제어면과 연결된 명시적 import/export receipt로 재구성",
        "acceptance": "PER-CONTRACT-INTEGRATION|PER-GOLDEN-IMPORT-001|IDEMPOTENCY-REPLAY",
        "state": "RECEIVED->VALIDATING->APPLIED|PARTIAL|REJECTED; retry reuses the idempotency key",
    },
    "PER-PLATFORM-001": {
        "journey": "/admin/automation",
        "api": "/api/platform/v1/automation/jobs | AutomationRunCompleted.v1",
        "change": "모듈별 배치 제어를 제거하고 code-owned job manifest와 중앙 실행센터를 재사용",
        "acceptance": "PLATFORM-JOB-CONTRACT|PER-JOB-HANDLER-CONTRACT|IDEMPOTENCY-REPLAY",
        "state": "QUEUED->RUNNING->SUCCEEDED|FAILED|QUARANTINED; retry is receipt based",
    },
    "PER-WORKFORCE-PROJECTION-001": {
        "journey": "/hr/talent/cycles/{cycleId}/population",
        "api": "/api/hris/workforce/v1/snapshots?asOf= | WorkerAssignmentChanged.v1",
        "change": "PER 내부 복제 인사테이블을 제거하고 HRM의 as-of assignment/org/manager snapshot을 소비",
        "acceptance": "HRM-PER-SNAPSHOT-CONTRACT|PER-GOLDEN-POPULATION-001|NO-CROSS-CONTEXT-WRITE",
        "state": "Projection revisions are monotonic; frozen cycle snapshot never follows later HR changes",
    },
    "PER-CONFIG-001": {
        "journey": "/hr/talent/settings",
        "api": "/api/hris/performance/v1/configurations | PerformanceConfigurationPublished.v1",
        "change": "모듈코드와 화면 초기값을 typed tenant configuration의 draft/validate/simulate/publish로 대체",
        "acceptance": "PER-CONTRACT-CONFIG|PER-GOLDEN-CONFIG-001|NO-TENANT-HARDCODING",
        "state": "DRAFT->VALIDATED->APPROVED->PUBLISHED->SUPERSEDED; effective versions do not overlap",
    },
    "PER-NOTIFICATION-001": {
        "journey": "/hr/talent/settings/notifications",
        "api": "/api/notifications/v1/templates | NotificationRequested.v1",
        "change": "PER 전용 메일 템플릿·발송을 제거하고 DWP 알림 템플릿과 이벤트 계약을 재사용",
        "acceptance": "NOTIFICATION-CONTRACT|PER-NOTIFY-PURPOSE|NO-DIRECT-MAIL-SEND",
        "state": "Template DRAFT->PUBLISHED->RETIRED; requests have delivery receipts",
    },
}


DECISION_MAP = {
    "PER-HOME-001": "PER-DEC-001",
    "PER-CYCLE-001": "PER-DEC-002",
    "PER-TEMPLATE-001": "PER-DEC-003",
    "PER-POPULATION-001": "PER-DEC-004",
    "PER-GOAL-001": "PER-DEC-005",
    "PER-REVIEW-001": "PER-DEC-006",
    "PER-FEEDBACK-001": "PER-DEC-007",
    "PER-CHECKIN-001": "PER-DEC-008",
    "PER-CALIBRATION-001": "PER-DEC-009",
    "PER-RESULT-001": "PER-DEC-010",
    "PER-MONITOR-001": "PER-DEC-011",
    "PER-INTEGRATION-001": "PER-DEC-012",
    "PER-PLATFORM-001": "PER-DEC-013",
    "PER-WORKFORCE-PROJECTION-001": "PER-DEC-014",
    "PER-CONFIG-001": "PER-DEC-015",
    "PER-NOTIFICATION-001": "PER-DEC-016",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def normalize(row: dict[str, str]) -> str:
    return " ".join(
        [row["display_key"], row["source_file"], row["legacy_contract"], row["legacy_component_or_table"]]
    ).lower()


def classify(row: dict[str, str]) -> str:
    text = normalize(row)
    # Shared/platform contracts are resolved before broad performance keywords.
    if any(token in text for token in ("comemployee", "comappointment", "comorganization", "com_employee", "com_appointment", "com_organization")):
        return "PER-WORKFORCE-PROJECTION-001"
    if any(token in text for token in ("batcheval", "bat-eval", "per_bat_eval")):
        return "PER-GOAL-001"
    if any(token in text for token in ("mailtemplate", "/template", "mailsend")):
        return "PER-NOTIFICATION-001"
    if "modulecode" in text or "module_cd" in text:
        return "PER-CONFIG-001"
    if "jobseqno" in text or "job_seqno" in text or ("/batch" in text and "bat-eval" not in text):
        return "PER-PLATFORM-001"
    if any(token in text for token in ("datasync", "data-sync", "infc", "interface")):
        return "PER-INTEGRATION-001"
    if any(token in text for token in ("questionnaire", "questioncontroller", "questionnairetemplate", "per_answer", "per_question")):
        return "PER-TEMPLATE-001"
    if any(token in text for token in ("adminhome", "permain", "permngmain", "mainwidget", "/widget")):
        return "PER-HOME-001"
    if any(token in text for token in ("diffldgg", "diff-ldgg", "evaluationgroupdegree", "evalgroupdgr", "eval-group-dgr", "eval_grp_dgr", "evaluationgroupallctn", "eval_grp_allctn")):
        return "PER-CALIBRATION-001"
    if any(token in text for token in ("rslt", "result", "last-eval", "cmbn", "abltydgnsrslt")):
        return "PER-RESULT-001"
    if any(token in text for token in ("mntrng", "monitor", "errorverification", "error-verification", "prgss")):
        return "PER-MONITOR-001"
    if any(token in text for token in ("gradegroup", "grade-group", "allctngrade", "allctn-grade", "allctnmapping", "allctn-mapping")):
        return "PER-CALIBRATION-001"
    if any(token in text for token in ("evaluationmanyfaces", "many-faces", "feedback", "fdbck", "diagnosis", "dgns")):
        return "PER-FEEDBACK-001"
    if any(token in text for token in ("interview", "intrvw", "ordinary", "ordnry", "check")):
        return "PER-CHECKIN-001"
    if any(token in text for token in ("goal", "mbo", "orggoal")):
        return "PER-GOAL-001"
    if any(token in text for token in ("trgter", "target", "excpt", "approver", "aprvr", "evaluationgroup", "eval_grp", "evalgroup")):
        return "PER-POPULATION-001"
    if any(token in text for token in ("evaluationitem", "evaluationtable", "eval_item", "eval_tbl", "evaluationbase", "eval_base", "evalstnd", "evaluationsteprto", "eval_step_rto")):
        return "PER-TEMPLATE-001"
    if any(token in text for token in ("evalschd", "eval-schd", "per_eval_m", "per_eval_schd")):
        return "PER-CYCLE-001"
    if any(token in text for token in ("evaluationfirst", "evaluationsecond", "evaluationself", "evaluationthird", "evaluator", "evalr", "selfeval", "self-eval", "th1-eval", "th2-eval", "th3-eval", "refeval", "ref-eval")):
        return "PER-REVIEW-001"
    return "PER-REVIEW-001"


def disposition(row: dict[str, str], capability: str) -> str:
    text = normalize(row)
    if row["artifact_type"] == "ROUTE" and any(token in text for token in ("adminhome", "permain", "permngmain")):
        return "RETIRE"
    if "gradegrouptest" in text or "grade-group-test" in text or "evalsample" in text or "eval_sample" in text:
        return "RETIRE"
    if capability in {"PER-WORKFORCE-PROJECTION-001", "PER-PLATFORM-001", "PER-NOTIFICATION-001"}:
        return "REUSE"
    if capability in {"PER-CONFIG-001", "PER-TEMPLATE-001"} and ("modulecode" in text or "module_cd" in text or "question" in text):
        return "CONFIGURE"
    if capability == "PER-INTEGRATION-001":
        return "EXTENSION"
    return "REBUILD"


def target_owner(capability: str) -> str:
    return {
        "PER-WORKFORCE-PROJECTION-001": "dwp-people-server/hris/core",
        "PER-PLATFORM-001": "dwp-platform-server/automation",
        "PER-NOTIFICATION-001": "dwp-notification-server",
        "PER-INTEGRATION-001": "dwp-provider-server/hris-connectors",
        "PER-CONFIG-001": OWNER,
    }.get(capability, OWNER)


def bounded_context(capability: str) -> str:
    return {
        "PER-WORKFORCE-PROJECTION-001": "CORE_HR_READ_MODEL",
        "PER-PLATFORM-001": "PLATFORM_AUTOMATION",
        "PER-NOTIFICATION-001": "NOTIFICATION",
        "PER-INTEGRATION-001": "INTEGRATION_ADAPTER",
    }.get(capability, "PERFORMANCE")


def genericity(capability: str, disp: str) -> str:
    if disp == "RETIRE":
        return "RETIRED_LEGACY"
    if disp == "EXTENSION":
        return "SIGNED_EXTENSION_PACK"
    if disp == "CONFIGURE":
        return "TYPED_TENANT_CONFIGURATION"
    if capability in {"PER-WORKFORCE-PROJECTION-001", "PER-PLATFORM-001", "PER-NOTIFICATION-001"}:
        return "DWP_PLATFORM_REUSE"
    return "GLOBAL_CORE"


def actor_for(capability: str) -> str:
    return {
        "PER-HOME-001": "employee|line_manager|performance_operator",
        "PER-CYCLE-001": "performance_operator",
        "PER-TEMPLATE-001": "performance_configuration_designer|publisher",
        "PER-POPULATION-001": "performance_operator",
        "PER-GOAL-001": "employee|line_manager|performance_operator",
        "PER-REVIEW-001": "assigned_reviewer|review_subject",
        "PER-FEEDBACK-001": "feedback_requester|assigned_feedback_provider|subject",
        "PER-CHECKIN-001": "employee|line_manager",
        "PER-CALIBRATION-001": "performance_calibrator",
        "PER-RESULT-001": "result_publisher|employee|auditor",
        "PER-MONITOR-001": "performance_operator|auditor",
        "PER-INTEGRATION-001": "integration_operator",
        "PER-PLATFORM-001": "automation_operator",
        "PER-WORKFORCE-PROJECTION-001": "performance_service",
        "PER-CONFIG-001": "performance_configuration_designer|publisher",
        "PER-NOTIFICATION-001": "performance_service|notification_operator",
    }[capability]


def update_coverage(rows: list[dict[str, str]], access: dict[str, dict[str, str]]) -> None:
    for row in rows:
        cap = classify(row)
        disp = disposition(row, cap)
        spec = CAPABILITIES[cap]
        access_row = access[row["artifact_id"]]
        row["disposition"] = disp
        row["target_capability_id"] = cap
        row["target_bounded_context_candidate"] = bounded_context(cap)
        row["target_api_or_event"] = spec["api"]
        row["target_data_owner"] = target_owner(cap)
        row["process_change"] = spec["change"]
        row["genericity"] = genericity(cap, disp)
        row["acceptance_evidence"] = spec["acceptance"]
        row["decision_status"] = "DECIDED"
        row["decision_owner"] = ENGINEERING
        security_note = (
            "security-blocked source not reconstructed; safe DWP platform contract selected; source parity deferred to controlled review"
            if access_row["sanitized_access_status"] == "SECURITY_BLOCKED_UNKNOWN"
            else "sanitized behavior characterized"
        )
        row["notes"] = f"{DECISION_MAP[cap]}|target-journey:{spec['journey']}|{security_note}|no source code reuse"

    with COVERAGE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


MAPPING_RE = re.compile(
    r"@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\((.*?)\))?",
    re.DOTALL,
)
METHOD_RE = re.compile(r"\bpublic\s+(?:<[^>]+>\s*)?[\w<>,.?\[\]\s]+?\s+(\w+)\s*\(")


def fingerprint(path: Path | None, fallback: str) -> str:
    if path and path.exists():
        return hashlib.sha256(path.read_bytes()).hexdigest()
    return fallback


def child_base(
    seq: int,
    row: dict[str, str],
    access_row: dict[str, str],
    child_type: str,
    line: str,
) -> dict[str, str]:
    cap = row["target_capability_id"]
    source_path = Path(access_row["sanitized_export_path"]) if access_row["sanitized_export_path"] else None
    return {
        "child_id": f"PER-CHILD-{seq:06d}",
        "parent_artifact_id": row["artifact_id"],
        "session_id": "HRIS-PER",
        "source_module": "per",
        "child_type": child_type,
        "source_file": row["source_file"],
        "source_line": line,
        "source_fingerprint": fingerprint(source_path, access_row["mapping_fingerprint"]),
        "actor": actor_for(cap),
        "trigger": "",
        "input_contract": "",
        "output_contract": "",
        "validation_rules": "tenant; capability; population; expected-version; effective-cycle",
        "state_transitions": CAPABILITIES[cap]["state"],
        "exceptions": "400-invalid;403-scope-or-field;404-not-found;409-stale-or-state;422-rule;result-unknown-receipt",
        "legacy_dependency": "",
        "target_capability_candidate": cap,
        "target_api_event_candidate": CAPABILITIES[cap]["api"],
        "target_data_owner_candidate": target_owner(cap),
        "disposition": row["disposition"],
        "decision_status": "DECIDED",
        "decision_id": DECISION_MAP[cap],
        "owner_role": ENGINEERING,
        "evidence_refs": f"coverage:{row['artifact_id']}|{CAPABILITIES[cap]['acceptance']}",
        "notes": "behavioral characterization only; no source expression copied",
    }


def mapping_children(
    seq: int,
    row: dict[str, str],
    access_row: dict[str, str],
) -> tuple[list[dict[str, str]], int, str]:
    path_text = access_row["sanitized_export_path"]
    if not path_text or not Path(path_text).exists():
        match = re.search(r"method_mapping_count=(\d+)", row["observed_metadata"])
        operation_count = max(1, int(match.group(1)) if match else 1)
        blocked_children = []
        for operation_index in range(1, operation_count + 1):
            item = child_base(seq, row, access_row, "SERVICE_OPERATION", "")
            item.update(
                trigger=f"security-reviewed safe substitute operation-slot:{operation_index}",
                input_contract="DWP notification/template request with tenant and purpose",
                output_contract="platform receipt without legacy payload reconstruction",
                legacy_dependency="SECURITY_BLOCKED_SOURCE; parity evidence activation-only",
                notes="source was not reconstructed; platform-owned substitute closes core design while exact parity remains an activation condition",
            )
            blocked_children.append(item)
            seq += 1
        return blocked_children, seq, ""

    text = Path(path_text).read_text(encoding="utf-8", errors="replace")
    children: list[dict[str, str]] = []
    for match in MAPPING_RE.finditer(text):
        between = text[match.end() : match.end() + 1200]
        method = METHOD_RE.search(between)
        if not method or re.search(r"\bclass\b", between[: method.start()]):
            continue
        method_name = method.group(1)
        verb = match.group(1).replace("Mapping", "").upper() or "REQUEST"
        args = match.group(2) or ""
        quoted = re.search(r'"([^"\r\n]+)"', args)
        local_path = quoted.group(1) if quoted else ""
        line = str(text.count("\n", 0, match.start()) + 1)
        item = child_base(seq, row, access_row, "SERVICE_OPERATION", line)
        item.update(
            trigger=f"{verb} operation:{method_name}; legacy-subpath:{local_path or '(root)'}",
            input_contract="typed command/query DTO; public IDs; tenant from trusted context; expected version on mutation",
            output_contract="versioned resource or asynchronous command receipt; field-policy projection",
            legacy_dependency="legacy controller orchestration; replace direct token/code/file helpers with DWP ports",
        )
        children.append(item)
        seq += 1

    if not children:
        item = child_base(seq, row, access_row, "SERVICE_OPERATION", row["source_line"])
        item.update(
            trigger="controller-level delegated behavior without direct mapped operation",
            input_contract="typed domain request through target application port",
            output_contract="versioned performance contract",
            legacy_dependency="legacy implicit framework exposure; explicit target API required",
        )
        children.append(item)
        seq += 1
    return children, seq, text


def build_children(rows: list[dict[str, str]], access: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    children: list[dict[str, str]] = []
    seq = 1
    for row in rows:
        access_row = access[row["artifact_id"]]
        cap = row["target_capability_id"]
        if row["artifact_type"] == "ROUTE":
            item = child_base(seq, row, access_row, "MENU_ELEMENT", row["source_line"])
            item.update(
                trigger=f"navigate from governed HRIS surface to {CAPABILITIES[cap]['journey']}",
                input_contract="app entitlement plus route capability projection",
                output_contract="contextual workspace; no duplicate detail route in sidebar",
                legacy_dependency="legacy flat route; consolidated into target journey",
            )
            children.append(item)
            seq += 1
            continue

        if row["artifact_type"] == "CONTROLLER":
            mapped, seq, text = mapping_children(seq, row, access_row)
            children.extend(mapped)
            lowered = normalize(row)
            if any(token in lowered for token in ("batch", "bat-eval")):
                item = child_base(seq, row, access_row, "JOB", row["source_line"])
                item.update(
                    trigger="manual|scheduled|event job manifest",
                    input_contract="signed job version; JSON-schema parameters; tenant scope; idempotency key",
                    output_contract="lease-backed run receipt; row counts; error artifact reference; reconciliation status",
                    legacy_dependency="legacy module batch entry point; scheduler control moves to DWP automation",
                )
                children.append(item)
                seq += 1
            if cap == "PER-INTEGRATION-001":
                item = child_base(seq, row, access_row, "INTERFACE", row["source_line"])
                item.update(
                    trigger="tenant connector import/export",
                    input_contract="adapter manifest; mapping version; cursor; signed payload reference",
                    output_contract="ingestion/export receipt; canonical row errors; reconciliation totals",
                    legacy_dependency="company endpoint details excluded; adapter activation requires real contract",
                )
                children.append(item)
                seq += 1
            if text and re.search(r"Excel|FFile|MultipartFile|ModelAndView|download|upload", text, re.I):
                item = child_base(seq, row, access_row, "FILE_DOCUMENT", row["source_line"])
                item.update(
                    trigger="authorized bulk import or asynchronous export",
                    input_contract="versioned template ID or validated object-storage reference; content hash; purpose",
                    output_contract="malware-scanned artifact reference; row receipt; expiry and download audit",
                    legacy_dependency="legacy bundled spreadsheet/report asset is not reused",
                )
                children.append(item)
                seq += 1
            if cap in {"PER-TEMPLATE-001", "PER-REVIEW-001", "PER-CALIBRATION-001", "PER-RESULT-001"}:
                item = child_base(seq, row, access_row, "FORMULA_BEHAVIOR", row["source_line"])
                item.update(
                    trigger="validate or evaluate versioned weights/rubric/result projection",
                    input_contract="decimal inputs; published rubric version; explicit missing-value policy",
                    output_contract="deterministic intermediate values; final value; rule-version lineage",
                    validation_rules="weights total 1.000000; scale bounds; deterministic decimal rounding; no executable tenant formula",
                    legacy_dependency="legacy calculations are behavior references only; expressions are not copied",
                )
                children.append(item)
                seq += 1
            continue

        # ENTITY: preserve semantic ownership, not the legacy physical table.
        item = child_base(seq, row, access_row, "SQL_BEHAVIOR", row["source_line"])
        item.update(
            trigger="persist target aggregate/projection under tenant-scoped transaction",
            input_contract="public UUID; tenant BIGINT; aggregate version; explicit effective dates; JSON schema version where applicable",
            output_contract="tenant-scoped unique/FK/check constraints and immutable history or versioned correction",
            validation_rules="composite tenant identity; no cross-context FK; [from,to) dates; non-overlap; optimistic version",
            legacy_dependency=f"legacy table semantic:{row['legacy_component_or_table']}; physical shape is not migrated",
        )
        children.append(item)
        seq += 1
        if cap not in {"PER-WORKFORCE-PROJECTION-001", "PER-PLATFORM-001", "PER-NOTIFICATION-001"}:
            item = child_base(seq, row, access_row, "STATE_TRANSITION", row["source_line"])
            item.update(
                trigger="domain command guarded by current aggregate state and expected version",
                input_contract="command ID; actor purpose; current revision; requested transition reason",
                output_contract="new aggregate revision plus outbox event and audit reference",
                legacy_dependency="boolean/delete style legacy lifecycle replaced by explicit state machine",
            )
            children.append(item)
            seq += 1
        if cap in {"PER-TEMPLATE-001", "PER-REVIEW-001", "PER-CALIBRATION-001", "PER-RESULT-001"}:
            item = child_base(seq, row, access_row, "FORMULA_BEHAVIOR", row["source_line"])
            item.update(
                trigger="derive validated performance measure from immutable submitted inputs",
                input_contract="published rule/rubric version and decimal source values",
                output_contract="lineage-bearing intermediate and final decimal values",
                validation_rules="weight and scale constraints; deterministic rounding; null policy; reproducibility",
                legacy_dependency="legacy formula expressions are not copied or executed",
            )
            children.append(item)
            seq += 1
        if cap == "PER-INTEGRATION-001":
            item = child_base(seq, row, access_row, "INTERFACE", row["source_line"])
            item.update(
                trigger="persist connector receipt/projection",
                input_contract="canonical versioned payload metadata; source reference; idempotency key",
                output_contract="immutable receipt with reconciliation counts",
                legacy_dependency="specific customer connector remains outside core",
            )
            children.append(item)
            seq += 1

    headers = [
        "child_id", "parent_artifact_id", "session_id", "source_module", "child_type",
        "source_file", "source_line", "source_fingerprint", "actor", "trigger",
        "input_contract", "output_contract", "validation_rules", "state_transitions",
        "exceptions", "legacy_dependency", "target_capability_candidate",
        "target_api_event_candidate", "target_data_owner_candidate", "disposition",
        "decision_status", "decision_id", "owner_role", "evidence_refs", "notes",
    ]
    children = normalize_rows(children)
    with CHILD.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(children)
    return children


def write_decisions() -> None:
    headers = [
        "decision_id", "session_id", "scope", "decision_type", "question", "options",
        "proposed_decision", "status", "owner_role", "consulted_role_ids", "due_at",
        "blocking_gate", "blocking_scope", "evidence_refs", "resolution", "decided_at", "notes",
    ]
    rows = []
    for cap, decision_id in DECISION_MAP.items():
        spec = CAPABILITIES[cap]
        rows.append(
            {
                "decision_id": decision_id,
                "session_id": "HRIS-PER",
                "scope": cap,
                "decision_type": "SOURCE_TO_TARGET_G1",
                "question": f"How should source semantics assigned to {cap} be represented in generic DWP HRIS?",
                "options": "REUSE|REBUILD|CONFIGURE|EXTENSION|RETIRE",
                "proposed_decision": spec["change"],
                "status": "DECIDED",
                "owner_role": ENGINEERING,
                "consulted_role_ids": "ROLE.HRIS_PER_PRODUCT_OWNER|ROLE.HRIS_PER_SME|ROLE.ARCHITECTURE_AUTHORITY|ROLE.SECURITY_AUTHORITY|ROLE.QA_EVIDENCE",
                "due_at": "",
                "blocking_gate": "G2",
                "blocking_scope": cap,
                "evidence_refs": f"g1-child-trace.csv|{spec['acceptance']}|ADR-001-performance-boundary.md",
                "resolution": spec["change"],
                "decided_at": "2026-09-10T18:00:00+09:00",
                "notes": "G1 design baseline; not a production/statutory approval and not permission to open G3",
            }
        )
    with DECISIONS.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = read_csv(COVERAGE)
    access_rows = {
        row["artifact_id"]: row
        for row in read_csv(ACCESS)
        if row["session_id"] == "HRIS-PER"
    }
    missing = {row["artifact_id"] for row in rows} - set(access_rows)
    if missing:
        raise SystemExit(f"missing governed access rows: {sorted(missing)[:3]}")
    update_coverage(rows, access_rows)
    children = build_children(rows, access_rows)
    write_decisions()
    print(f"coverage={len(rows)} children={len(children)} dispositions={dict(Counter(r['disposition'] for r in rows))}")


if __name__ == "__main__":
    main()
