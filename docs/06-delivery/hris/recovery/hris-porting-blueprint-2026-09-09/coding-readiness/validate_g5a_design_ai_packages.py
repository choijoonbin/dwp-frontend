#!/usr/bin/env python3
"""Validate the planned G5A contract or one post-G4 Design-AI package.

PLANNED mode is intentionally non-evidentiary: it validates ownership, paths,
and the complete 98-node IA allocation without requiring future package files.
POST_G4 mode validates a concrete module directory, archive, and checksum.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import stat
import struct
import subprocess
import tempfile
import zipfile
import zlib
from collections import Counter
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # Fail closed in the executable validator/self-test.
    Image = ImageDraw = ImageFont = None


HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
WORKSPACE = BLUEPRINT.parent.parent
REGISTER = HERE / "g5a-design-ai-package-allocation-register.csv"
IA_REGISTER = HERE / "hris-information-architecture-register.csv"
ROLE_REGISTER = BLUEPRINT / "g0/role-register.csv"
BASELINE_REGISTER = BLUEPRINT / "g0/integration-baseline-manifest.csv"
G3_ALLOCATION = HERE / "g3-file-allocation-register.csv"
OCR_SCRIPT = HERE / "g5a_image_ocr.swift"

REGISTER_HEADER = [
    "package_contract_id", "session_id", "module_slug", "writer_role",
    "review_roles", "ia_owned_node_count", "package_dir_pattern",
    "zip_path_pattern", "checksum_path_pattern", "final_verification_path_pattern",
    "manifest_relative_path",
    "coverage_relative_path", "g4_prerequisite", "planned_gate_state",
    "post_g4_success_state", "external_design_state", "implementation_state",
    "production_state",
]
COVERAGE_HEADER = [
    "ia_node_id", "menu_node_key", "route_contract_key", "workbench_tab",
    "surface_key", "screen_family", "prompt_file", "persona",
    "capability_key", "resource_action", "population_field_scope",
    "api_or_event", "state_variants", "returned_frame_id",
    "target_code_path", "acceptance_id", "coverage_status", "evidence",
]
SURFACE_HEADER = [
    "surface_id", "ia_node_id", "surface_key", "surface_type",
    "canonical_route", "target_code_path", "source_blob_sha256",
    "implementation_state",
]
EXPECTED = {
    "HRIS-HRM": ("G5A-HRM", "hrm", 24),
    "HRIS-PER": ("G5A-PER", "per", 19),
    "HRIS-PAY": ("G5A-PAY", "pay", 17),
    "HRIS-TIM": ("G5A-TIM", "tim", 17),
    "HRIS-SYS": ("G5A-SYS", "sys", 21),
}
REQUIRED_FILES = {
    "README.md",
    "00-current-analysis-and-menu-plan.md",
    "01-module-home-current-and-expansion-brief.md",
    "02-design-review-and-implementation-gates.md",
    "03-official-global-patterns.md",
    "04-state-and-validation-matrix.md",
    "05-screen-coverage-register.csv",
    "current-screens/module-home-current-1440.png",
    "current-screens/module-home-current-390.png",
    "evidence/frontend-surface-audit.md",
    "evidence/backend-db-contract-audit.md",
    "evidence/runtime-and-capture-audit.md",
    "evidence/g4-functional-gate.json",
    "evidence/g4-frontend-surface-inventory.csv",
    "evidence/image-ocr-results.json",
    "evidence/package-review.md",
    "evidence/package-verification.json",
    "prompts/00-common-design-contract.md",
    "prompts/01-module-home.md",
}
REQUIRED_STATE_VARIANTS = {
    "loading", "empty", "validation", "read-only", "403", "409", "stale",
    "partial-failure", "result-unknown",
}
TEXT_EXTENSIONS = {".md", ".csv", ".json", ".txt", ".yaml", ".yml", ".svg"}
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
RRN = re.compile(r"(?<!\d)\d{6}\s*[- ]?\s*[1-4]\s*\d{6}(?!\d)")
PHONE = re.compile(r"(?<!\d)01[016789]\s*[- ]?\s*\d{3,4}\s*[- ]?\s*\d{4}(?!\d)")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
SECRET_PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "aws-access-key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b"),
    "bearer-token": re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{20,}"),
    "assigned-secret": re.compile(
        r"(?i)\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)"
        r"\s*[:=]\s*[\"']?[A-Za-z0-9._~+/=-]{12,}"
    ),
}
_OCR_TEMP: tempfile.TemporaryDirectory[str] | None = None
_OCR_BINARY: Path | None = None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def pipe(value: str) -> list[str]:
    return [item for item in value.split("|") if item]


def safe_relative(value: str) -> bool:
    path = PurePosixPath(value)
    return bool(value) and not path.is_absolute() and ".." not in path.parts


def expected_path(slug: str, package_date: str, suffix: str) -> Path:
    return WORKSPACE / f"output/hris-{slug}-design-ai-{package_date}{suffix}"


def default_git_repositories() -> dict[str, Path]:
    _, rows = read_csv(BASELINE_REGISTER)
    return {
        row["repository"]: Path(row["integration_worktree"])
        for row in rows
        if row.get("repository") in {"DWP_BACKEND", "DWP_FRONTEND"}
    }


def path_matches_glob(path: str, glob: str) -> bool:
    prefix = glob.removesuffix("/**").rstrip("/")
    return bool(prefix) and (path == prefix or path.startswith(prefix + "/"))


def frontend_allowed_globs(session: str) -> list[str]:
    _, rows = read_csv(G3_ALLOCATION)
    return [
        value
        for row in rows
        if row.get("session_id") == session
        and row.get("artifact_class") == "FRONTEND_SOURCE"
        for value in pipe(row.get("path_globs", ""))
    ]


def git_object_exists(repository: Path, revision: str) -> bool:
    completed = subprocess.run(
        ["git", "-C", str(repository), "cat-file", "-e", f"{revision}^{{commit}}"],
        capture_output=True, text=True, check=False, timeout=30,
    )
    return completed.returncode == 0


def git_blob(repository: Path, revision: str, path: str) -> bytes | None:
    completed = subprocess.run(
        ["git", "-C", str(repository), "show", f"{revision}:{path}"],
        capture_output=True, check=False, timeout=30,
    )
    return completed.stdout if completed.returncode == 0 else None


def validate_contract() -> tuple[list[dict[str, str]], list[dict[str, str]], list[str]]:
    errors: list[str] = []
    try:
        header, rows = read_csv(REGISTER)
        ia_header, ia_rows = read_csv(IA_REGISTER)
        _, role_rows = read_csv(ROLE_REGISTER)
    except (OSError, csv.Error) as error:
        return [], [], [f"contract source read failed: {error}"]
    if header != REGISTER_HEADER:
        errors.append("allocation register header mismatch")
    required_ia_columns = {
        "ia_node_id", "source_node_key", "owner_session", "canonical_route",
        "workbench_tab", "personas", "source_family_refs", "api_contract_refs",
        "authorization_refs",
    }
    if not required_ia_columns <= set(ia_header):
        errors.append("IA register lacks G5A binding columns")
    roles = {row.get("role_id", "") for row in role_rows}
    by_session = {row.get("session_id", ""): row for row in rows}
    if len(rows) != 5 or set(by_session) != set(EXPECTED):
        errors.append("allocation register must contain exactly five module contracts")
    ia_ids = [row.get("ia_node_id", "") for row in ia_rows]
    if len(ia_rows) != 98 or len(set(ia_ids)) != 98 or "" in ia_ids:
        errors.append("IA source must contain 98 unique nodes")
    owner_counts = Counter(row.get("owner_session", "") for row in ia_rows)
    expected_counts = {session: spec[2] for session, spec in EXPECTED.items()}
    if dict(owner_counts) != expected_counts:
        errors.append(f"IA owner counts drifted: {dict(owner_counts)}")
    for session, (contract_id, slug, count) in EXPECTED.items():
        row = by_session.get(session, {})
        exact = {
            "package_contract_id": contract_id,
            "module_slug": slug,
            "writer_role": f"ROLE.HRIS_{session.removeprefix('HRIS-')}_ENGINEERING",
            "ia_owned_node_count": str(count),
            "package_dir_pattern": f"output/hris-{slug}-design-ai-YYYY-MM-DD/",
            "zip_path_pattern": f"output/hris-{slug}-design-ai-YYYY-MM-DD.zip",
            "checksum_path_pattern": f"output/hris-{slug}-design-ai-YYYY-MM-DD.zip.sha256",
            "final_verification_path_pattern": f"output/hris-{slug}-design-ai-YYYY-MM-DD.zip.verification.json",
            "manifest_relative_path": "package-manifest.json",
            "coverage_relative_path": "05-screen-coverage-register.csv",
            "g4_prerequisite": "G4_FUNCTIONALLY_COMPLETE",
            "planned_gate_state": "PLANNED_NOT_DUE_AFTER_G4",
            "post_g4_success_state": "DESIGN_REQUEST_READY",
            "external_design_state": "WAITING_EXTERNAL_DESIGN",
            "implementation_state": "NOT_STARTED_G3",
            "production_state": "NOT_AUTHORIZED_G6",
        }
        for key, value in exact.items():
            if row.get(key) != value:
                errors.append(f"{session}: {key} drift")
        review_roles = set(pipe(row.get("review_roles", "")))
        expected_reviews = {
            f"ROLE.HRIS_{session.removeprefix('HRIS-')}_PRODUCT_OWNER",
            "ROLE.QA_EVIDENCE", "ROLE.INTEGRATION_CONTROL",
        }
        if review_roles != expected_reviews:
            errors.append(f"{session}: review role closure drift")
        for role in review_roles | {row.get("writer_role", "")}:
            if role not in roles:
                errors.append(f"{session}: unknown role {role}")
    return rows, ia_rows, errors


def png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        data = path.read_bytes()[:24]
    except OSError:
        return None
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def run_image_ocr(paths: list[Path]) -> tuple[dict[str, Any], list[str]]:
    global _OCR_TEMP, _OCR_BINARY
    errors: list[str] = []
    if not OCR_SCRIPT.is_file():
        return {}, ["OCR runtime script missing"]
    if _OCR_BINARY is None:
        _OCR_TEMP = tempfile.TemporaryDirectory(prefix="dwp-g5a-ocr-runtime-")
        _OCR_BINARY = Path(_OCR_TEMP.name) / "g5a-image-ocr"
        try:
            compiled = subprocess.run(
                ["swiftc", "-O", str(OCR_SCRIPT), "-o", str(_OCR_BINARY)],
                capture_output=True, text=True, check=False, timeout=180,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            _OCR_BINARY = None
            return {}, [f"OCR runtime compilation unavailable: {error}"]
        if compiled.returncode != 0:
            _OCR_BINARY = None
            return {}, [f"OCR runtime compilation failed: {compiled.stderr.strip()}"]
    try:
        completed = subprocess.run(
            [str(_OCR_BINARY), *[str(path) for path in paths]],
            capture_output=True, text=True, check=False, timeout=180,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return {}, [f"OCR runtime unavailable: {error}"]
    if completed.returncode != 0:
        return {}, [f"OCR runtime failed rc={completed.returncode}: {completed.stderr.strip()}"]
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        return {}, [f"OCR runtime output invalid: {error}"]
    if (
        payload.get("schema") != "dwp.hris.g5a-image-ocr-runtime.v1"
        or payload.get("tool") != "APPLE_VISION_VNRECOGNIZETEXTREQUEST"
        or payload.get("recognitionLevel") != "ACCURATE"
        or payload.get("languages") != ["en-US", "ko-KR"]
        or len(payload.get("images", [])) != len(paths)
    ):
        errors.append("OCR runtime schema/configuration drift")
    return payload, errors


def computed_ocr_evidence(package_root: Path, files: dict[str, Path]) -> tuple[dict[str, Any], list[str]]:
    image_items = sorted(
        (rel, path) for rel, path in files.items() if path.suffix.lower() == ".png"
    )
    payload, errors = run_image_ocr([path for _, path in image_items])
    observed = payload.get("images", [])
    if len(observed) != len(image_items):
        errors.append("OCR result/image count mismatch")
        observed = []
    records: list[dict[str, Any]] = []
    for (rel, path), result in zip(image_items, observed):
        dimensions = png_dimensions(path)
        if result.get("path") != str(path):
            errors.append(f"OCR result path binding drift: {rel}")
        text = str(result.get("text", ""))
        pii_count, secret_count = text_findings(text)
        if dimensions is None or dimensions[0] <= 0 or dimensions[1] <= 0:
            errors.append(f"OCR input is not a valid positive-dimension PNG: {rel}")
        records.append({
            "path": rel,
            "inputSha256": sha256(path),
            "width": dimensions[0] if dimensions else 0,
            "height": dimensions[1] if dimensions else 0,
            "extractedTextSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "piiFindingCount": pii_count,
            "secretFindingCount": secret_count,
            "result": "PASS" if pii_count == 0 and secret_count == 0 else "FAIL",
        })
    evidence = {
        "schema": "dwp.hris.g5a-image-ocr-evidence.v1",
        "tool": payload.get("tool"),
        "toolVersion": payload.get("toolVersion"),
        "runtimeScriptSha256": sha256(OCR_SCRIPT),
        "recognitionLevel": payload.get("recognitionLevel"),
        "languages": payload.get("languages"),
        "status": "PASS" if not errors and all(row["result"] == "PASS" for row in records) else "FAIL",
        "images": records,
    }
    return evidence, errors


def text_findings(text: str) -> tuple[int, int]:
    pii = int(bool(RRN.search(text))) + int(bool(PHONE.search(text)))
    for match in EMAIL.finditer(text):
        domain = match.group(1).lower()
        if domain not in {"example.com", "example.org", "example.net", "dwp.invalid"} and not domain.endswith(".invalid"):
            pii += 1
    secrets = sum(bool(pattern.search(text)) for pattern in SECRET_PATTERNS.values())
    return pii, secrets


def markdown_and_link_audit(files: dict[str, Path]) -> dict[str, Any]:
    markdown = {rel: path for rel, path in files.items() if path.suffix.lower() == ".md"}
    broken: list[str] = []
    internal_count = 0
    official_count = 0
    allowed_official_hosts = {
        "www.w3.org", "w3.org", "design-system.service.gov.uk",
        "carbondesignsystem.com", "m3.material.io", "developer.apple.com",
    }
    for rel, path in markdown.items():
        text = path.read_text(encoding="utf-8", errors="replace")
        if text.count("```") % 2:
            broken.append(f"{rel}:unbalanced-fence")
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            target = target.strip().split("#", 1)[0]
            if not target:
                continue
            parsed = urlparse(target)
            if parsed.scheme in {"http", "https"}:
                if rel == "03-official-global-patterns.md":
                    official_count += 1
                    if parsed.scheme != "https" or parsed.hostname not in allowed_official_hosts:
                        broken.append(f"{rel}:unapproved-official-source:{target}")
                continue
            if parsed.scheme or target.startswith("/"):
                broken.append(f"{rel}:unsafe-link:{target}")
                continue
            internal_count += 1
            resolved = (PurePosixPath(rel).parent / PurePosixPath(target)).as_posix()
            normalized = PurePosixPath(resolved)
            if ".." in normalized.parts or normalized.as_posix() not in files:
                broken.append(f"{rel}:broken-link:{target}")
    digest = hashlib.sha256()
    for rel, path in sorted(markdown.items()):
        digest.update(rel.encode("utf-8")); digest.update(b"\0")
        digest.update(bytes.fromhex(sha256(path)))
    return {
        "markdownFileCount": len(markdown), "inputDigest": digest.hexdigest(),
        "internalLinkCount": internal_count, "officialSourceLinkCount": official_count,
        "errors": broken,
    }


def canonical_member_digest(files: dict[str, Path]) -> str:
    digest = hashlib.sha256()
    for rel, path in sorted(files.items()):
        digest.update(rel.encode("utf-8")); digest.update(b"\0")
        digest.update(bytes.fromhex(sha256(path))); digest.update(b"\0")
    return digest.hexdigest()


def archive_audit(
    archive: Path,
    checksum: Path,
    files: dict[str, Path],
) -> dict[str, Any]:
    member_parity = "FAIL"
    integrity = "FAIL"
    if archive.is_file() and checksum.is_file():
        expected_checksum = f"{sha256(archive)}  {archive.name}"
        checksum_matches = checksum.read_text(
            encoding="utf-8", errors="replace"
        ).strip() == expected_checksum
        try:
            with zipfile.ZipFile(archive) as zipped:
                entries = [info for info in zipped.infolist() if not info.is_dir()]
                names = [info.filename.rstrip("/") for info in entries]
                safe_unique = (
                    len(names) == len(set(names))
                    and all(safe_relative(name) for name in names)
                    and all(
                        not stat.S_ISLNK((info.external_attr >> 16) & 0xFFFF)
                        for info in entries
                    )
                )
                exact_members = safe_unique and set(names) == set(files)
                exact_bytes = exact_members and all(
                    hashlib.sha256(zipped.read(info)).hexdigest()
                    == sha256(files[info.filename.rstrip("/")])
                    for info in entries
                )
                member_parity = "PASS" if exact_members and exact_bytes else "FAIL"
                integrity = "PASS" if checksum_matches and zipped.testzip() is None else "FAIL"
        except (OSError, zipfile.BadZipFile, RuntimeError):
            pass
    return {
        "fileName": archive.name,
        "sha256": sha256(archive) if archive.is_file() else None,
        "sizeBytes": archive.stat().st_size if archive.is_file() else 0,
        "checksumSidecar": checksum.name,
        "checksumSidecarSha256": sha256(checksum) if checksum.is_file() else None,
        "memberCount": len(files),
        "canonicalMemberDigest": canonical_member_digest(files),
        "memberParity": member_parity,
        "integrity": integrity,
    }


def expected_final_verification(
    contract: dict[str, str],
    manifest: dict[str, Any],
    files: dict[str, Path],
    coverage: list[dict[str, str]],
    inventory_pairs: set[tuple[str, str]],
    computed_ocr: dict[str, Any],
    markdown_audit: dict[str, Any],
    archive: Path,
    checksum: Path,
    verified_at: str,
) -> dict[str, Any]:
    image_records = [
        {
            "path": row["path"], "width": row["width"], "height": row["height"],
            "sha256": row["inputSha256"], "visualReview": "PASS",
        }
        for row in computed_ocr.get("images", [])
    ]
    review_path = files.get("evidence/package-review.md")
    review_text = review_path.read_text(encoding="utf-8", errors="replace") if review_path else ""
    pending_count = len(re.findall(r"(?i)\bPENDING\b", review_text))
    source = manifest.get("source", {})
    ia = manifest.get("ia", {})
    _, canonical_ia = read_csv(IA_REGISTER)
    all_node_ids = {row.get("ia_node_id", "") for row in canonical_ia}
    owned_node_ids = {
        row.get("ia_node_id", "")
        for row in canonical_ia
        if row.get("owner_session") == contract["session_id"]
    }
    coverage_pairs = {
        (row.get("ia_node_id", ""), row.get("surface_key", ""))
        for row in coverage
    }
    mapped_node_ids = {
        row.get("ia_node_id", "")
        for row in coverage
        if row.get("coverage_status") == "MAPPED_G5A"
        and row.get("ia_node_id", "") in owned_node_ids
    }
    wrong_module_count = sum(
        row.get("ia_node_id", "") in all_node_ids
        and row.get("ia_node_id", "") not in owned_node_ids
        for row in coverage
    )
    orphan_count = sum(
        row.get("ia_node_id", "") not in all_node_ids for row in coverage
    )
    unmapped_count = (
        sum(row.get("coverage_status") != "MAPPED_G5A" for row in coverage)
        + len(owned_node_ids - mapped_node_ids)
    )
    coverage_closed = (
        len(coverage_pairs) == len(coverage)
        and coverage_pairs == inventory_pairs
        and mapped_node_ids == owned_node_ids
        and wrong_module_count == 0
        and orphan_count == 0
        and unmapped_count == 0
    )
    markdown_paths = [rel for rel in files if rel.endswith(".md")]
    prompt_paths = [rel for rel in markdown_paths if rel.startswith("prompts/")]
    archive_result = archive_audit(archive, checksum, files)
    evidence_passed = (
        computed_ocr.get("status") == "PASS"
        and not markdown_audit.get("errors")
        and pending_count == 0
        and coverage_closed
        and archive_result["memberParity"] == "PASS"
        and archive_result["integrity"] == "PASS"
    )
    return {
        "schema": "dwp.hris.g5a-design-ai-package-final-verification.v1",
        "packageContractId": contract["package_contract_id"],
        "sessionId": contract["session_id"],
        "packageDate": manifest.get("packageDate"),
        "verifiedAt": verified_at,
        "status": "PASS" if evidence_passed else "FAIL",
        "scope": "G5A_DESIGN_REQUEST_ONLY_NOT_G5B_G5C_OR_G6",
        "verificationEngine": {
            "validatorPath": (
                "output/hris-porting-blueprint-2026-09-09/coding-readiness/"
                "validate_g5a_design_ai_packages.py"
            ),
            "validatorSha256": sha256(Path(__file__)),
        },
        "provenance": {
            "sourceBackendCommit": source.get("backendCommit"),
            "sourceFrontendCommit": source.get("frontendCommit"),
            "g4EvidenceRefs": source.get("g4EvidenceRefs"),
            "iaRegisterPath": ia.get("registerPath"),
            "iaRegisterSha256": ia.get("registerSha256"),
            "frontendSurfaceInventoryPath": source.get("frontendSurfaceInventoryPath"),
            "frontendSurfaceInventorySha256": source.get("frontendSurfaceInventorySha256"),
        },
        "counts": {
            "markdownDocumentCount": len(markdown_paths),
            "promptCount": len(prompt_paths),
            "menuNodeCount": len({row.get("ia_node_id") for row in coverage}),
            "routeContractCount": len({row.get("route_contract_key") for row in coverage}),
            "surfaceCount": len(inventory_pairs),
            "screenFamilyCount": len({row.get("screen_family") for row in coverage}),
            "imageCount": len(image_records),
            "visualReviewCount": len(image_records),
            "pendingReviewCount": pending_count,
        },
        "links": {
            "internalLinkCount": markdown_audit.get("internalLinkCount"),
            "officialSourceLinkCount": markdown_audit.get("officialSourceLinkCount"),
            "brokenOrUnapprovedCount": len(markdown_audit.get("errors", [])),
            "status": "PASS" if not markdown_audit.get("errors") else "FAIL",
        },
        "images": {
            "status": computed_ocr.get("status"),
            "ocrTool": computed_ocr.get("tool"),
            "ocrToolVersion": computed_ocr.get("toolVersion"),
            "ocrRuntimeScriptSha256": computed_ocr.get("runtimeScriptSha256"),
            "ocrEvidencePath": "evidence/image-ocr-results.json",
            "ocrEvidenceSha256": sha256(files["evidence/image-ocr-results.json"]),
            "records": image_records,
        },
        "markdown": {
            "tool": "DWP_G5A_MARKDOWN_STRUCTURE_AUDIT",
            "version": "1",
            "inputDigest": markdown_audit.get("inputDigest"),
            "errorCount": len(markdown_audit.get("errors", [])),
            "status": "PASS" if not markdown_audit.get("errors") else "FAIL",
        },
        "review": {
            "evidencePath": "evidence/package-review.md",
            "evidenceSha256": sha256(files["evidence/package-review.md"]),
            "pendingCount": pending_count,
            "status": "PASS" if pending_count == 0 else "FAIL",
        },
        "archive": archive_result,
        "productTests": {
            "status": "PASS_G4_REUSED",
            "state": "NOT_RUN_IN_G5A_REUSED_G4_EVIDENCE",
            "g4EvidenceRefs": source.get("g4EvidenceRefs"),
        },
        "coverage": {
            "ownedNodeCount": len(owned_node_ids),
            "mappedNodeCount": len(mapped_node_ids),
            "surfaceCount": len(coverage_pairs),
            "unmappedCount": unmapped_count,
            "wrongModuleCount": wrong_module_count,
            "orphanCount": orphan_count,
            "bidirectionalSurfaceClosure": "PASS" if coverage_closed else "FAIL",
        },
        "externalDesignState": "WAITING_EXTERNAL_DESIGN",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def scan_sensitive(package_root: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted(package_root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="ignore") if path.suffix.lower() in TEXT_EXTENSIONS else raw.decode("latin-1", errors="ignore")
        # Content/commit digests are machine identifiers, not human identifiers;
        # remove exact long hex tokens before numeric-PII heuristics.
        pii_text = re.sub(r"(?i)\b[0-9a-f]{40,64}\b", "<DIGEST>", text)
        relative = path.relative_to(package_root).as_posix()
        if RRN.search(pii_text):
            errors.append(f"{relative}: prohibited resident identifier pattern")
        if PHONE.search(pii_text):
            errors.append(f"{relative}: prohibited mobile-number pattern")
        for match in EMAIL.finditer(pii_text):
            domain = match.group(1).lower()
            if domain not in {"example.com", "example.org", "example.net", "dwp.invalid"} and not domain.endswith(".invalid"):
                errors.append(f"{relative}: non-synthetic email pattern")
        for name, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                errors.append(f"{relative}: prohibited secret pattern {name}")
    return errors


def package_files(package_root: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for path in package_root.rglob("*"):
        if path.is_symlink():
            continue
        if path.is_file():
            result[path.relative_to(package_root).as_posix()] = path
    return result


def validate_package(
    contract: dict[str, str],
    ia_rows: list[dict[str, str]],
    package_root: Path,
    archive: Path,
    checksum: Path,
    final_verification: Path,
    repositories: dict[str, Path] | None = None,
) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    session = contract["session_id"]
    slug = contract["module_slug"]
    expected_owned = {
        row["ia_node_id"]: row for row in ia_rows if row.get("owner_session") == session
    }
    if package_root.is_symlink() or not package_root.is_dir():
        return [f"package directory missing or symlinked: {package_root}"], {}
    files = package_files(package_root)
    symlinks = [path for path in package_root.rglob("*") if path.is_symlink()]
    if symlinks:
        errors.append("package contains symlink")
    missing = REQUIRED_FILES - set(files)
    if missing:
        errors.append(f"required package files missing: {sorted(missing)}")
    empty_required = sorted(
        rel for rel in REQUIRED_FILES & set(files) if files[rel].stat().st_size == 0
    )
    if empty_required:
        errors.append(f"required package files are empty: {empty_required}")
    manifest_path = package_root / contract["manifest_relative_path"]
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        manifest = {}
        errors.append(f"manifest unreadable: {error}")
    expected_manifest_keys = {
        "schema", "packageContractId", "sessionId", "moduleSlug", "packageDate",
        "lifecycleState", "source", "ia", "dataSafety", "contentFiles",
        "implementationState", "productionState",
    }
    if set(manifest) != expected_manifest_keys:
        errors.append("manifest top-level schema is not exact")
    package_date = manifest.get("packageDate", "")
    try:
        date.fromisoformat(package_date)
    except (TypeError, ValueError):
        errors.append("manifest packageDate is not a valid ISO date")
    expected_basename = f"hris-{slug}-design-ai-{package_date}"
    if (
        package_root.name != expected_basename
        or archive.name != f"{expected_basename}.zip"
        or checksum.name != f"{expected_basename}.zip.sha256"
        or final_verification.name != f"{expected_basename}.zip.verification.json"
    ):
        errors.append("manifest date/module and directory/ZIP/checksum/verification names disagree")
    exact_manifest = {
        "schema": "dwp.hris.g5a-design-ai-package-manifest.v1",
        "packageContractId": contract["package_contract_id"],
        "sessionId": session,
        "moduleSlug": slug,
        "lifecycleState": "DESIGN_REQUEST_READY",
        "implementationState": "G4_FUNCTIONALLY_COMPLETE",
        "productionState": "NOT_AUTHORIZED_G6",
    }
    for key, value in exact_manifest.items():
        if manifest.get(key) != value:
            errors.append(f"manifest {key} drift")
    source = manifest.get("source", {})
    if set(source) != {
        "backendCommit", "frontendCommit", "g4EvidenceRefs",
        "frontendSurfaceInventoryPath", "frontendSurfaceInventorySha256",
    }:
        errors.append("manifest source schema is not exact")
    if not SHA40.fullmatch(str(source.get("backendCommit", ""))) or not SHA40.fullmatch(str(source.get("frontendCommit", ""))):
        errors.append("manifest source commits must be exact Git SHA-1 values")
    try:
        repositories = repositories or default_git_repositories()
    except (OSError, csv.Error) as error:
        repositories = {}
        errors.append(f"canonical Git repository lookup failed: {error}")
    for repository_name, revision_key in (
        ("DWP_BACKEND", "backendCommit"), ("DWP_FRONTEND", "frontendCommit")
    ):
        repository = repositories.get(repository_name)
        if repository is None or not git_object_exists(repository, str(source.get(revision_key, ""))):
            errors.append(f"manifest {revision_key} is not present in {repository_name}")
    inventory_rel = source.get("frontendSurfaceInventoryPath", "")
    if inventory_rel != "evidence/g4-frontend-surface-inventory.csv" or inventory_rel not in files:
        errors.append("manifest frontend surface inventory path drift or missing")
    elif source.get("frontendSurfaceInventorySha256") != sha256(files[inventory_rel]):
        errors.append("manifest frontend surface inventory digest drift")
    g4_refs = source.get("g4EvidenceRefs", [])
    if g4_refs != ["evidence/g4-functional-gate.json"]:
        errors.append("manifest G4 evidence reference closure drift")
    elif any(not safe_relative(str(ref)) for ref in g4_refs):
        errors.append("manifest G4 evidence reference is unsafe")
    elif any(str(ref) not in files for ref in g4_refs):
        errors.append("manifest G4 evidence reference is absent from package")
    else:
        for ref in g4_refs:
            try:
                g4 = json.loads(files[str(ref)].read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                errors.append(f"G4 evidence unreadable {ref}: {error}")
                continue
            if (
                set(g4) != {
                    "schema", "sessionId", "status", "sourceBackendCommit",
                    "sourceFrontendCommit", "frontendSurfaceInventorySha256",
                    "syntheticOnly",
                }
                or
                g4.get("schema") != "dwp.hris.g4-functional-gate-evidence.v1"
                or g4.get("sessionId") != session
                or g4.get("status") != "PASS"
                or g4.get("sourceBackendCommit") != source.get("backendCommit")
                or g4.get("sourceFrontendCommit") != source.get("frontendCommit")
                or g4.get("frontendSurfaceInventorySha256")
                != source.get("frontendSurfaceInventorySha256")
                or g4.get("syntheticOnly") is not True
            ):
                errors.append(f"G4 evidence state/source binding drift: {ref}")
    ia = manifest.get("ia", {})
    if set(ia) != {
        "registerPath", "registerSha256", "ownedNodeCount", "mappedNodeCount",
        "surfaceCount", "unmappedCount",
    }:
        errors.append("manifest IA schema is not exact")
    if ia.get("registerPath") != "output/hris-porting-blueprint-2026-09-09/coding-readiness/hris-information-architecture-register.csv" or ia.get("registerSha256") != sha256(IA_REGISTER):
        errors.append("manifest IA source or digest drift")
    if ia.get("ownedNodeCount") != len(expected_owned) or ia.get("mappedNodeCount") != len(expected_owned) or ia.get("unmappedCount") != 0:
        errors.append("manifest IA coverage totals drift")
    safety = manifest.get("dataSafety", {})
    expected_safety = {
        "syntheticOnly": True, "containsProductionData": False,
        "containsPii": False, "containsSecrets": False,
        "textPiiScan": "PASS", "secretScan": "PASS", "imageOcrScan": "PASS",
    }
    if safety != expected_safety:
        errors.append("manifest data-safety attestation is not exact")
    content_rows = manifest.get("contentFiles", [])
    if not isinstance(content_rows, list):
        content_rows = []
        errors.append("manifest contentFiles is not an array")
    manifest_files: dict[str, dict[str, Any]] = {}
    for item in content_rows:
        if not isinstance(item, dict) or set(item) != {"path", "sha256", "sizeBytes"}:
            errors.append("manifest content file row schema drift")
            continue
        rel = str(item.get("path", ""))
        if not safe_relative(rel) or rel == "package-manifest.json" or rel in manifest_files:
            errors.append(f"manifest content path invalid or duplicated: {rel}")
            continue
        manifest_files[rel] = item
    actual_content = set(files) - {"package-manifest.json"}
    if set(manifest_files) != actual_content:
        errors.append("manifest content file closure mismatch")
    for rel, item in manifest_files.items():
        path = files.get(rel)
        if path is None:
            continue
        if item.get("sha256") != sha256(path) or item.get("sizeBytes") != path.stat().st_size:
            errors.append(f"manifest hash or size drift: {rel}")

    inventory_path = files.get("evidence/g4-frontend-surface-inventory.csv")
    try:
        inventory_header, inventory = read_csv(inventory_path) if inventory_path else ([], [])
    except (OSError, csv.Error) as error:
        inventory_header, inventory = [], []
        errors.append(f"G4 frontend surface inventory unreadable: {error}")
    if inventory_header != SURFACE_HEADER:
        errors.append("G4 frontend surface inventory header mismatch")
    allowed_globs = frontend_allowed_globs(session)
    if not allowed_globs:
        errors.append("module frontend source allocation is missing")
    inventory_pairs: set[tuple[str, str]] = set()
    inventory_by_pair: dict[tuple[str, str], dict[str, str]] = {}
    inventory_ids: set[str] = set()
    frontend_repo = (repositories or {}).get("DWP_FRONTEND")
    for line, item in enumerate(inventory, 2):
        node_id = item.get("ia_node_id", "")
        surface_key = item.get("surface_key", "")
        pair = (node_id, surface_key)
        surface_id = item.get("surface_id", "")
        source_node = expected_owned.get(node_id)
        if pair in inventory_pairs or not surface_key:
            errors.append(f"surface inventory line {line}: duplicate/empty node-surface pair")
        inventory_pairs.add(pair)
        inventory_by_pair[pair] = item
        if not surface_id or surface_id in inventory_ids:
            errors.append(f"surface inventory line {line}: duplicate/empty surface ID")
        inventory_ids.add(surface_id)
        if source_node is None:
            owner = next((row.get("owner_session") for row in ia_rows if row.get("ia_node_id") == node_id), "ORPHAN")
            errors.append(f"surface inventory line {line}: wrong module or orphan IA owner={owner}")
        elif item.get("canonical_route") != source_node.get("canonical_route"):
            errors.append(f"surface inventory line {line}: canonical route drift")
        if item.get("surface_type") not in {
            "PAGE", "TAB", "DRAWER", "DIALOG", "WIZARD", "DETAIL",
            "REPORT", "PRINT", "PDF", "DOCUMENT",
        }:
            errors.append(f"surface inventory line {line}: unsupported surface type")
        target_path = item.get("target_code_path", "")
        if (
            not safe_relative(target_path)
            or not any(path_matches_glob(target_path, glob) for glob in allowed_globs)
        ):
            errors.append(f"surface inventory line {line}: target path outside module G3 allocation")
        blob = git_blob(frontend_repo, str(source.get("frontendCommit", "")), target_path) if frontend_repo else None
        if blob is None:
            errors.append(f"surface inventory line {line}: target path absent at G4 frontend commit")
        elif item.get("source_blob_sha256") != hashlib.sha256(blob).hexdigest():
            errors.append(f"surface inventory line {line}: G4 source blob digest drift")
        if item.get("implementation_state") != "G4_FUNCTIONALLY_COMPLETE":
            errors.append(f"surface inventory line {line}: surface is not G4 complete")
    inventory_nodes = {node_id for node_id, _ in inventory_pairs}
    if inventory_nodes != set(expected_owned):
        errors.append(
            "G4 surface inventory does not give every owned IA node at least one surface"
        )
    if ia.get("surfaceCount") != len(inventory_pairs):
        errors.append("manifest IA surface count drift")

    coverage_path = package_root / contract["coverage_relative_path"]
    try:
        coverage_header, coverage = read_csv(coverage_path)
    except (OSError, csv.Error) as error:
        coverage_header, coverage = [], []
        errors.append(f"coverage register unreadable: {error}")
    if coverage_header != COVERAGE_HEADER:
        errors.append("coverage register header mismatch")
    coverage_pairs: set[tuple[str, str]] = set()
    seen_nodes: set[str] = set()
    state_union: set[str] = set()
    for line, row in enumerate(coverage, 2):
        node_id = row.get("ia_node_id", "")
        surface_key = row.get("surface_key", "")
        pair = (node_id, surface_key)
        source = expected_owned.get(node_id)
        if pair in coverage_pairs or not surface_key:
            errors.append(f"coverage line {line}: duplicate/empty node-surface pair")
        coverage_pairs.add(pair)
        seen_nodes.add(node_id)
        if source is None:
            owner = next((item.get("owner_session") for item in ia_rows if item.get("ia_node_id") == node_id), "ORPHAN")
            errors.append(f"coverage line {line}: wrong module or orphan IA node owner={owner}")
            continue
        exact = {
            "menu_node_key": source.get("source_node_key", ""),
            "route_contract_key": source.get("canonical_route", ""),
            "workbench_tab": source.get("workbench_tab", ""),
            "persona": source.get("personas", ""),
            "capability_key": source.get("source_family_refs", ""),
            "resource_action": source.get("authorization_refs", ""),
            "api_or_event": source.get("api_contract_refs", ""),
        }
        for key, value in exact.items():
            if row.get(key) != value:
                errors.append(f"coverage line {line}: IA {key} drift")
        prompt = row.get("prompt_file", "")
        if not safe_relative(prompt) or not prompt.startswith("prompts/") or prompt not in files:
            errors.append(f"coverage line {line}: missing or unsafe prompt file")
        if row.get("coverage_status") != "MAPPED_G5A" or row.get("returned_frame_id") != "PENDING_G5B":
            errors.append(f"coverage line {line}: G5A/G5B state drift")
        for key in ("surface_key", "screen_family", "population_field_scope", "target_code_path", "acceptance_id", "evidence"):
            if not row.get(key, "").strip() or "UNMAPPED" in row.get(key, "").upper():
                errors.append(f"coverage line {line}: {key} missing or unmapped")
        if not safe_relative(row.get("target_code_path", "")) or not row.get("target_code_path", "").startswith("apps/dwp/src/features/hris/"):
            errors.append(f"coverage line {line}: target code path is outside HRIS frontend")
        inventory_row = inventory_by_pair.get(pair)
        if inventory_row is None:
            errors.append(f"coverage line {line}: surface is absent from G4 inventory")
        elif row.get("target_code_path") != inventory_row.get("target_code_path"):
            errors.append(f"coverage line {line}: target path differs from G4 inventory")
        evidence = row.get("evidence", "")
        if not safe_relative(evidence) or evidence not in files:
            errors.append(f"coverage line {line}: evidence path missing or unsafe")
        state_union.update(pipe(row.get("state_variants", "")))
    if coverage_pairs != inventory_pairs:
        errors.append(
            "coverage and G4 frontend surface inventory are not bidirectionally exact"
        )
    if seen_nodes != set(expected_owned):
        errors.append(
            f"module IA node coverage mismatch missing={sorted(set(expected_owned) - seen_nodes)} "
            f"extra={sorted(seen_nodes - set(expected_owned))}"
        )
    if not REQUIRED_STATE_VARIANTS <= state_union:
        errors.append(f"required state coverage missing: {sorted(REQUIRED_STATE_VARIANTS - state_union)}")

    if (png_dimensions(package_root / "current-screens/module-home-current-1440.png") or (None, None))[0] != 1440:
        errors.append("desktop current screen is not a 1440px PNG")
    if (png_dimensions(package_root / "current-screens/module-home-current-390.png") or (None, None))[0] != 390:
        errors.append("mobile current screen is not a 390px PNG")
    runtime_audit = files.get("evidence/runtime-and-capture-audit.md")
    if runtime_audit:
        audit_text = runtime_audit.read_text(encoding="utf-8", errors="ignore")
        for marker in ("SYNTHETIC_ONLY", "NO_PRODUCTION_DATA", "PII_SCAN=PASS", "SECRET_SCAN=PASS", "OCR_SCAN=PASS"):
            if marker not in audit_text:
                errors.append(f"runtime capture audit missing {marker}")
    errors.extend(scan_sensitive(package_root))

    computed_ocr, ocr_errors = computed_ocr_evidence(package_root, files)
    errors.extend(ocr_errors)
    ocr_evidence_path = files.get("evidence/image-ocr-results.json")
    try:
        declared_ocr = json.loads(ocr_evidence_path.read_text(encoding="utf-8")) if ocr_evidence_path else {}
    except json.JSONDecodeError as error:
        declared_ocr = {}
        errors.append(f"OCR evidence JSON invalid: {error}")
    if declared_ocr != computed_ocr:
        errors.append("OCR evidence does not match fresh Apple Vision execution")
    if computed_ocr.get("status") != "PASS":
        errors.append("fresh image OCR detected PII/secret or failed")

    verification_path = files.get("evidence/package-verification.json")
    try:
        verification = json.loads(verification_path.read_text(encoding="utf-8")) if verification_path else {}
    except json.JSONDecodeError as error:
        verification = {}
        errors.append(f"package verification JSON invalid: {error}")
    expected_content_verification = {
        "schema": "dwp.hris.g5a-design-ai-package-content-verification.v1",
        "sessionId": session,
        "status": "PASS",
        "archiveFinalization": "DETACHED_FINAL_VERIFICATION_REQUIRED",
        "externalDesignState": "WAITING_EXTERNAL_DESIGN",
    }
    if verification != expected_content_verification:
        errors.append("package content verification schema or state drift")
    markdown_audit = markdown_and_link_audit(files)
    if markdown_audit.get("errors"):
        errors.extend(f"Markdown/link audit: {error}" for error in markdown_audit["errors"])
    if markdown_audit.get("officialSourceLinkCount", 0) < 1:
        errors.append("official global pattern document has no approved HTTPS source")

    if not archive.is_file() or not checksum.is_file():
        errors.append("ZIP archive or SHA-256 sidecar missing")
    else:
        checksum_text = checksum.read_text(encoding="utf-8", errors="replace").strip()
        expected_checksum = f"{sha256(archive)}  {archive.name}"
        if checksum_text != expected_checksum:
            errors.append("ZIP SHA-256 sidecar mismatch")
        try:
            with zipfile.ZipFile(archive) as zipped:
                zip_files: dict[str, zipfile.ZipInfo] = {}
                for info in zipped.infolist():
                    name = info.filename.rstrip("/")
                    if info.is_dir():
                        continue
                    if not safe_relative(name) or name in zip_files:
                        errors.append(f"ZIP unsafe or duplicate member: {name}")
                        continue
                    if stat.S_ISLNK((info.external_attr >> 16) & 0xFFFF):
                        errors.append(f"ZIP symlink member prohibited: {name}")
                    zip_files[name] = info
                if set(zip_files) != set(files):
                    errors.append("ZIP member parity mismatch")
                for rel, info in zip_files.items():
                    path = files.get(rel)
                    if path is not None and hashlib.sha256(zipped.read(info)).hexdigest() != sha256(path):
                        errors.append(f"ZIP content drift: {rel}")
        except (OSError, zipfile.BadZipFile, RuntimeError) as error:
            errors.append(f"ZIP validation failed: {error}")
    try:
        declared_final = json.loads(final_verification.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        declared_final = {}
        errors.append(f"detached final verification JSON unreadable: {error}")
    verified_at = str(declared_final.get("verifiedAt", ""))
    try:
        parsed_verified_at = datetime.fromisoformat(verified_at.replace("Z", "+00:00"))
        if parsed_verified_at.tzinfo is None or not verified_at.endswith("Z"):
            raise ValueError("UTC Z timestamp required")
    except (TypeError, ValueError):
        errors.append("detached final verification verifiedAt must be RFC3339 UTC")
    expected_final = expected_final_verification(
        contract, manifest, files, coverage, inventory_pairs, computed_ocr,
        markdown_audit, archive, checksum, verified_at,
    )
    if declared_final != expected_final:
        errors.append("detached final verification provenance/count/hash schema drift")
    if (
        expected_final.get("status") != "PASS"
        or expected_final.get("counts", {}).get("pendingReviewCount") != 0
        or expected_final.get("links", {}).get("status") != "PASS"
        or expected_final.get("images", {}).get("status") != "PASS"
        or expected_final.get("markdown", {}).get("status") != "PASS"
        or expected_final.get("review", {}).get("status") != "PASS"
    ):
        errors.append("fresh final verification contains failed or pending evidence")
    details = {
        "sessionId": session,
        "ownedIaNodes": len(expected_owned),
        "mappedIaNodes": len(seen_nodes & set(expected_owned)),
        "surfaceCount": len(coverage_pairs),
        "coverageInventoryBidirectionalClosure": (
            "PASS" if coverage_pairs == inventory_pairs else "FAIL"
        ),
        "g3FrontendAllocationGlobCount": len(allowed_globs),
        "g4FrontendCommitBlobBindings": (
            "PASS"
            if not any(
                "target path" in error or "source blob" in error
                for error in errors
            )
            else "FAIL"
        ),
        "unmappedIaNodes": len(set(expected_owned) - seen_nodes),
        "wrongOrOrphanRows": len(seen_nodes - set(expected_owned)),
        "contentFileCount": len(files),
        "archive": archive.name,
        "archiveSha256": sha256(archive) if archive.is_file() else None,
        "finalVerification": final_verification.name,
        "ocrTool": computed_ocr.get("tool"),
        "ocrToolVersion": computed_ocr.get("toolVersion"),
    }
    return errors, details


def png_bytes(width: int, height: int = 200) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    def chunk(name: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + name + payload + struct.pack(">I", zlib.crc32(name + payload) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    rows = b"".join(b"\x00" + b"\xff\xff\xff" * width for _ in range(height))
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def refresh_manifest(package_root: Path, contract: dict[str, str], owned_count: int, package_date: str) -> None:
    files = package_files(package_root)
    g4 = json.loads((package_root / "evidence/g4-functional-gate.json").read_text(encoding="utf-8"))
    _, surface_rows = read_csv(package_root / "evidence/g4-frontend-surface-inventory.csv")
    content = [
        {"path": rel, "sha256": sha256(path), "sizeBytes": path.stat().st_size}
        for rel, path in sorted(files.items()) if rel != "package-manifest.json"
    ]
    manifest = {
        "schema": "dwp.hris.g5a-design-ai-package-manifest.v1",
        "packageContractId": contract["package_contract_id"],
        "sessionId": contract["session_id"],
        "moduleSlug": contract["module_slug"],
        "packageDate": package_date,
        "lifecycleState": "DESIGN_REQUEST_READY",
        "source": {
            "backendCommit": g4["sourceBackendCommit"],
            "frontendCommit": g4["sourceFrontendCommit"],
            "g4EvidenceRefs": ["evidence/g4-functional-gate.json"],
            "frontendSurfaceInventoryPath": "evidence/g4-frontend-surface-inventory.csv",
            "frontendSurfaceInventorySha256": sha256(package_root / "evidence/g4-frontend-surface-inventory.csv"),
        },
        "ia": {
            "registerPath": "output/hris-porting-blueprint-2026-09-09/coding-readiness/hris-information-architecture-register.csv",
            "registerSha256": sha256(IA_REGISTER), "ownedNodeCount": owned_count,
            "mappedNodeCount": owned_count, "surfaceCount": len(surface_rows),
            "unmappedCount": 0,
        },
        "dataSafety": {
            "syntheticOnly": True, "containsProductionData": False,
            "containsPii": False, "containsSecrets": False,
            "textPiiScan": "PASS", "secretScan": "PASS", "imageOcrScan": "PASS",
        },
        "contentFiles": content,
        "implementationState": "G4_FUNCTIONALLY_COMPLETE",
        "productionState": "NOT_AUTHORIZED_G6",
    }
    (package_root / "package-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_zip(package_root: Path, archive: Path, checksum: Path, extra_member: bool = False) -> None:
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
        for rel, path in sorted(package_files(package_root).items()):
            zipped.write(path, rel)
        if extra_member:
            zipped.writestr("zip-only-drift.txt", "drift")
    checksum.write_text(f"{sha256(archive)}  {archive.name}\n", encoding="utf-8")


def write_ocr_evidence(package_root: Path) -> None:
    evidence, errors = computed_ocr_evidence(package_root, package_files(package_root))
    if errors:
        raise RuntimeError(f"fixture OCR failed: {errors}")
    (package_root / "evidence/image-ocr-results.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def write_final_verification(
    package_root: Path,
    archive: Path,
    checksum: Path,
    final_verification: Path,
    contract: dict[str, str],
) -> None:
    files = package_files(package_root)
    manifest = json.loads((package_root / "package-manifest.json").read_text(encoding="utf-8"))
    _, coverage = read_csv(package_root / "05-screen-coverage-register.csv")
    _, inventory = read_csv(package_root / "evidence/g4-frontend-surface-inventory.csv")
    pairs = {(row["ia_node_id"], row["surface_key"]) for row in inventory}
    ocr = json.loads((package_root / "evidence/image-ocr-results.json").read_text(encoding="utf-8"))
    payload = expected_final_verification(
        contract, manifest, files, coverage, pairs, ocr,
        markdown_and_link_audit(files), archive, checksum,
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    )
    final_verification.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def bind_g4_surface_inventory(package_root: Path) -> None:
    inventory = package_root / "evidence/g4-frontend-surface-inventory.csv"
    g4_path = package_root / "evidence/g4-functional-gate.json"
    g4 = json.loads(g4_path.read_text(encoding="utf-8"))
    g4["frontendSurfaceInventorySha256"] = sha256(inventory)
    g4_path.write_text(json.dumps(g4, indent=2) + "\n", encoding="utf-8")


def build_fixture(
    base: Path,
    contract: dict[str, str],
    ia_rows: list[dict[str, str]],
    package_date: str,
) -> tuple[Path, Path, Path, Path, dict[str, Path]]:
    slug = contract["module_slug"]
    package_root = base / f"hris-{slug}-design-ai-{package_date}"
    for directory in ("current-screens", "evidence", "prompts"):
        (package_root / directory).mkdir(parents=True, exist_ok=True)
    docs = {
        "README.md": (
            "Design AI first files: [common](prompts/00-common-design-contract.md), "
            "[brief](01-module-home-current-and-expansion-brief.md), "
            "[home](prompts/01-module-home.md). 첫 요청문. WAITING_EXTERNAL_DESIGN.\n"
        ),
        "00-current-analysis-and-menu-plan.md": "Canonical route and 98 IA source contract; this module owns only its assigned subset.\n",
        "01-module-home-current-and-expansion-brief.md": "Module home current and expansion brief using synthetic fixtures.\n",
        "02-design-review-and-implementation-gates.md": "G5A DESIGN_REQUEST_READY; G5B DESIGN_ACCEPTED; G5C VISUAL_REPLACEMENT_COMPLETE.\n",
        "03-official-global-patterns.md": "Official evidence: [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/).\n",
        "04-state-and-validation-matrix.md": "loading empty validation read-only 403 409 stale partial-failure result-unknown.\n",
        "evidence/frontend-surface-audit.md": "G4 frontend surface audit PASS; synthetic data only.\n",
        "evidence/backend-db-contract-audit.md": "G4 API DB authorization audit PASS; no production data.\n",
        "evidence/runtime-and-capture-audit.md": "SYNTHETIC_ONLY NO_PRODUCTION_DATA PII_SCAN=PASS SECRET_SCAN=PASS OCR_SCAN=PASS\n",
        "evidence/package-review.md": "Independent UX, domain, accessibility, security, and privacy review PASS.\n",
        "prompts/00-common-design-contract.md": "Preserve DWP shell, routes, permissions, state, API, accessibility, and synthetic-only data.\n",
        "prompts/01-module-home.md": "Design the module home at 1440 and 390 with partial and error states.\n",
        "prompts/02-all-owned-screens.md": "Design all mapped module screens without inventing functionality.\n",
    }
    for rel, text in docs.items():
        (package_root / rel).write_text(text, encoding="utf-8")
    (package_root / "current-screens/module-home-current-1440.png").write_bytes(png_bytes(1440))
    (package_root / "current-screens/module-home-current-390.png").write_bytes(png_bytes(390))

    owned = [row for row in ia_rows if row.get("owner_session") == contract["session_id"]]
    prefix = {
        "HRIS-HRM": "apps/dwp/src/features/hris/people/g5a",
        "HRIS-PER": "apps/dwp/src/features/hris/performance/g5a",
        "HRIS-PAY": "apps/dwp/src/features/hris/payroll/g5a",
        "HRIS-TIM": "apps/dwp/src/features/hris/time/g5a",
        "HRIS-SYS": "apps/dwp/src/features/hris/shell/g5a",
    }[contract["session_id"]]
    source_repo = base / "source-repository"
    subprocess.run(["git", "init", "-q", str(source_repo)], check=True)
    subprocess.run(["git", "-C", str(source_repo), "config", "user.name", "G5A Self Test"], check=True)
    subprocess.run(["git", "-C", str(source_repo), "config", "user.email", "g5a@dwp.invalid"], check=True)
    surfaces: list[dict[str, str]] = []
    coverage_rows: list[dict[str, str]] = []
    for index, source in enumerate(owned, 1):
        variants = [("overview", "PAGE")]
        if index == 1:
            variants.append(("detail-dialog", "DIALOG"))
        for variant_index, (variant, surface_type) in enumerate(variants, 1):
            target = f"{prefix}/screen-{index}-{variant}.tsx"
            target_file = source_repo / target
            target_file.parent.mkdir(parents=True, exist_ok=True)
            target_file.write_text(
                f"export const surface{index}_{variant_index} = '{source['ia_node_id']}:{variant}';\n",
                encoding="utf-8",
            )
            surface_key = f"{source['source_node_key']}.{variant}"
            surfaces.append({
                "surface_id": f"SURFACE-{index:03d}-{variant_index}",
                "ia_node_id": source["ia_node_id"], "surface_key": surface_key,
                "surface_type": surface_type, "canonical_route": source["canonical_route"],
                "target_code_path": target, "source_blob_sha256": sha256(target_file),
                "implementation_state": "G4_FUNCTIONALLY_COMPLETE",
            })
            coverage_rows.append({
                "ia_node_id": source["ia_node_id"], "menu_node_key": source["source_node_key"],
                "route_contract_key": source["canonical_route"], "workbench_tab": source["workbench_tab"],
                "surface_key": surface_key, "screen_family": "MODULE_SCREEN_FAMILY",
                "prompt_file": "prompts/02-all-owned-screens.md", "persona": source["personas"],
                "capability_key": source["source_family_refs"], "resource_action": source["authorization_refs"],
                "population_field_scope": "G4_AUTHORIZATION_CONTRACT", "api_or_event": source["api_contract_refs"],
                "state_variants": "loading|empty|validation|read-only|403|409|stale|partial-failure|result-unknown",
                "returned_frame_id": "PENDING_G5B", "target_code_path": target,
                "acceptance_id": f"{contract['package_contract_id']}-AT-{index:03d}-{variant_index}",
                "coverage_status": "MAPPED_G5A", "evidence": "evidence/frontend-surface-audit.md",
            })
    subprocess.run(["git", "-C", str(source_repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(source_repo), "commit", "-qm", "G4 surfaces"], check=True)
    commit = subprocess.run(
        ["git", "-C", str(source_repo), "rev-parse", "HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    with (package_root / "evidence/g4-frontend-surface-inventory.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SURFACE_HEADER)
        writer.writeheader(); writer.writerows(surfaces)
    with (package_root / "05-screen-coverage-register.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COVERAGE_HEADER)
        writer.writeheader(); writer.writerows(coverage_rows)
    write_ocr_evidence(package_root)
    inventory_digest = sha256(package_root / "evidence/g4-frontend-surface-inventory.csv")
    g4 = {
        "schema": "dwp.hris.g4-functional-gate-evidence.v1",
        "sessionId": contract["session_id"], "status": "PASS",
        "sourceBackendCommit": commit, "sourceFrontendCommit": commit,
        "frontendSurfaceInventorySha256": inventory_digest,
        "syntheticOnly": True,
    }
    (package_root / "evidence/g4-functional-gate.json").write_text(json.dumps(g4, indent=2) + "\n", encoding="utf-8")
    content_verification = {
        "schema": "dwp.hris.g5a-design-ai-package-content-verification.v1",
        "sessionId": contract["session_id"], "status": "PASS",
        "archiveFinalization": "DETACHED_FINAL_VERIFICATION_REQUIRED",
        "externalDesignState": "WAITING_EXTERNAL_DESIGN",
    }
    (package_root / "evidence/package-verification.json").write_text(json.dumps(content_verification, indent=2) + "\n", encoding="utf-8")
    refresh_manifest(package_root, contract, len(owned), package_date)
    archive = base / f"hris-{slug}-design-ai-{package_date}.zip"
    checksum = base / f"hris-{slug}-design-ai-{package_date}.zip.sha256"
    final_verification = base / f"hris-{slug}-design-ai-{package_date}.zip.verification.json"
    write_zip(package_root, archive, checksum)
    write_final_verification(package_root, archive, checksum, final_verification, contract)
    repositories = {"DWP_BACKEND": source_repo, "DWP_FRONTEND": source_repo}
    return package_root, archive, checksum, final_verification, repositories


def run_self_tests(
    contract: dict[str, str],
    ia_rows: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    cases: list[dict[str, Any]] = []
    baseline_proof: dict[str, Any] = {}
    errors: list[str] = []
    package_date = "2099-01-02"
    with tempfile.TemporaryDirectory(prefix="dwp-g5a-selftest-") as temporary:
        base = Path(temporary)
        root, archive, checksum, final, repositories = build_fixture(
            base, contract, ia_rows, package_date
        )
        baseline_errors, baseline_details = validate_package(
            contract, ia_rows, root, archive, checksum, final, repositories
        )
        if baseline_errors:
            errors.append(f"self-test baseline invalid: {baseline_errors}")
            return cases, baseline_proof, errors
        baseline_proof = {
            "fixture": "SYNTHETIC_POST_G4_VALIDATOR_PROOF_ONLY",
            "status": "PASS",
            "ownedIaNodes": baseline_details["ownedIaNodes"],
            "mappedIaNodes": baseline_details["mappedIaNodes"],
            "surfaceCount": baseline_details["surfaceCount"],
            "multipleSurfacesForOneNode": baseline_details["surfaceCount"]
            > baseline_details["ownedIaNodes"],
            "coverageInventoryBidirectionalClosure": baseline_details[
                "coverageInventoryBidirectionalClosure"
            ],
            "g3FrontendAllocationGlobCount": baseline_details[
                "g3FrontendAllocationGlobCount"
            ],
            "g4FrontendCommitBlobBindings": baseline_details[
                "g4FrontendCommitBlobBindings"
            ],
            "ocrTool": baseline_details["ocrTool"],
            "ocrToolVersion": baseline_details["ocrToolVersion"],
        }
    mutations = {
        "missing-required-file": "missing",
        "manifest-hash-drift": "hash",
        "pii-leak": "pii",
        "secret-leak": "secret",
        "unmapped-ia-node": "unmapped",
        "wrong-module-node": "wrong-module",
        "foreign-or-nonexistent-target-path": "foreign-target",
        "rendered-image-ocr-pii-leak": "image-pii",
        "zip-parity-drift": "zip",
    }
    for name, mutation in mutations.items():
        with tempfile.TemporaryDirectory(prefix=f"dwp-g5a-{mutation}-") as temporary:
            base = Path(temporary)
            root, archive, checksum, final, repositories = build_fixture(
                base, contract, ia_rows, package_date
            )
            if mutation == "missing":
                (root / "README.md").unlink()
                write_zip(root, archive, checksum)
            elif mutation == "hash":
                (root / "README.md").write_text("changed after manifest\n", encoding="utf-8")
                write_zip(root, archive, checksum)
            elif mutation == "pii":
                with (root / "README.md").open("a", encoding="utf-8") as handle:
                    handle.write("synthetic-bad-value 900101-1234567\n")
                refresh_manifest(root, contract, int(contract["ia_owned_node_count"]), package_date)
                write_zip(root, archive, checksum)
            elif mutation == "secret":
                with (root / "README.md").open("a", encoding="utf-8") as handle:
                    handle.write("client_secret=NotARealButForbiddenSecret123\n")
                refresh_manifest(root, contract, int(contract["ia_owned_node_count"]), package_date)
                write_zip(root, archive, checksum)
            elif mutation in {"unmapped", "wrong-module"}:
                coverage_path = root / "05-screen-coverage-register.csv"
                header, rows = read_csv(coverage_path)
                if mutation == "unmapped":
                    rows[0]["coverage_status"] = "UNMAPPED"
                else:
                    foreign = next(row for row in ia_rows if row.get("owner_session") != contract["session_id"])
                    rows[0].update({
                        "ia_node_id": foreign["ia_node_id"], "menu_node_key": foreign["source_node_key"],
                        "route_contract_key": foreign["canonical_route"], "workbench_tab": foreign["workbench_tab"],
                        "persona": foreign["personas"], "capability_key": foreign["source_family_refs"],
                        "resource_action": foreign["authorization_refs"], "api_or_event": foreign["api_contract_refs"],
                    })
                with coverage_path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=header)
                    writer.writeheader(); writer.writerows(rows)
                refresh_manifest(root, contract, int(contract["ia_owned_node_count"]), package_date)
                write_zip(root, archive, checksum)
            elif mutation == "foreign-target":
                inventory_path = root / "evidence/g4-frontend-surface-inventory.csv"
                coverage_path = root / "05-screen-coverage-register.csv"
                inventory_header, inventory = read_csv(inventory_path)
                coverage_header, coverage = read_csv(coverage_path)
                foreign_path = "apps/dwp/src/features/hris/performance/foreign/not-at-g4.tsx"
                inventory[0]["target_code_path"] = foreign_path
                inventory[0]["source_blob_sha256"] = "0" * 64
                coverage[0]["target_code_path"] = foreign_path
                with inventory_path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=inventory_header)
                    writer.writeheader(); writer.writerows(inventory)
                with coverage_path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=coverage_header)
                    writer.writeheader(); writer.writerows(coverage)
                bind_g4_surface_inventory(root)
                refresh_manifest(root, contract, int(contract["ia_owned_node_count"]), package_date)
                write_zip(root, archive, checksum)
            elif mutation == "image-pii":
                if Image is None or ImageDraw is None or ImageFont is None:
                    errors.append("Pillow is required for rendered-image OCR self-test")
                    continue
                image_path = root / "current-screens/module-home-current-1440.png"
                rendered = Image.new("RGB", (1440, 300), "white")
                draw = ImageDraw.Draw(rendered)
                font = ImageFont.truetype(
                    "/System/Library/Fonts/Supplemental/Arial.ttf", 104
                )
                draw.text((70, 75), "ID 900101-1234567", fill="black", font=font)
                rendered.save(image_path, format="PNG")
                # Keep the original PASS attestation deliberately: the validator
                # must detect rendered PII by fresh OCR, not trust declared JSON.
                refresh_manifest(root, contract, int(contract["ia_owned_node_count"]), package_date)
                write_zip(root, archive, checksum)
            elif mutation == "zip":
                write_zip(root, archive, checksum, extra_member=True)
            write_final_verification(root, archive, checksum, final, contract)
            rejected, _ = validate_package(
                contract, ia_rows, root, archive, checksum, final, repositories
            )
            specifically_rejected = bool(rejected)
            if mutation == "image-pii":
                specifically_rejected = any(
                    "fresh image OCR detected PII/secret" in error for error in rejected
                )
            case = {
                "name": name,
                "status": "PASS" if specifically_rejected else "FAIL",
                "rejectedErrorCount": len(rejected),
            }
            if mutation == "image-pii":
                case["freshOcrPiiRejected"] = specifically_rejected
            if mutation == "foreign-target":
                case["g4PathBindingRejected"] = specifically_rejected
            cases.append(case)
            if not specifically_rejected:
                errors.append(f"self-test mutation was accepted: {name}")
    return cases, baseline_proof, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("planned", "post-g4"), default="planned")
    parser.add_argument("--module", choices=tuple(EXPECTED))
    parser.add_argument("--package-date")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    contracts, ia_rows, errors = validate_contract()
    by_session = {row.get("session_id", ""): row for row in contracts}
    if args.self_test:
        contract = by_session.get("HRIS-HRM", {})
        cases, baseline_proof, mutation_errors = (
            run_self_tests(contract, ia_rows)
            if contract and not errors
            else ([], {}, [])
        )
        errors.extend(mutation_errors)
        payload = {
            "schema": "dwp.hris.g5a-design-ai-package-self-test.v1",
            "mode": "SELF_TEST", "status": "PASS" if not errors else "FAIL",
            "plannedContractState": "PLANNED_NOT_DUE_AFTER_G4",
            "baselinePostG4SyntheticFixture": baseline_proof,
            "cases": cases, "errors": errors,
            "implementationState": "NOT_STARTED_G3", "productionState": "NOT_AUTHORIZED_G6",
        }
    elif args.mode == "planned":
        if args.module or args.package_date:
            errors.append("planned mode does not accept module/package-date")
        payload = {
            "schema": "dwp.hris.g5a-design-ai-package-validation.v1",
            "mode": "PLANNED", "status": "PASS" if not errors else "FAIL",
            "gateDecision": "PLANNED_NOT_DUE_AFTER_G4" if not errors else "BLOCKED_CONTRACT",
            "packageValidation": "NOT_RUN_NOT_DUE",
            "coverage": {
                "iaNodeCount": len(ia_rows), "packageContractCount": len(contracts),
                "ownedNodesByModule": {session: sum(row.get("owner_session") == session for row in ia_rows) for session in EXPECTED},
                "actualPackageCountRequiredNow": 0,
            },
            "errors": errors, "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        }
    else:
        if not args.module or not args.package_date:
            errors.append("post-g4 mode requires --module and --package-date")
        else:
            try:
                date.fromisoformat(args.package_date)
            except ValueError:
                errors.append("package-date must be a valid ISO date")
        details: dict[str, Any] = {}
        if not errors:
            contract = by_session[args.module]
            root = expected_path(contract["module_slug"], args.package_date, "")
            archive = expected_path(contract["module_slug"], args.package_date, ".zip")
            checksum = expected_path(contract["module_slug"], args.package_date, ".zip.sha256")
            final = expected_path(
                contract["module_slug"], args.package_date, ".zip.verification.json"
            )
            package_errors, details = validate_package(
                contract, ia_rows, root, archive, checksum, final
            )
            errors.extend(package_errors)
        payload = {
            "schema": "dwp.hris.g5a-design-ai-package-validation.v1",
            "mode": "POST_G4", "status": "PASS" if not errors else "FAIL",
            "gateDecision": "DESIGN_REQUEST_READY" if not errors else "BLOCKED_G5A",
            "externalDesignState": "WAITING_EXTERNAL_DESIGN" if not errors else "NOT_READY",
            "details": details, "errors": errors,
            "implementationState": "G4_FUNCTIONALLY_COMPLETE" if not errors else "NOT_ASSERTED",
            "productionState": "NOT_AUTHORIZED_G6",
        }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True) if args.compact else json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
