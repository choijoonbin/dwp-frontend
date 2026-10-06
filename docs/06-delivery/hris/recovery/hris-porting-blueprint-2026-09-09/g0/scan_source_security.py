#!/usr/bin/env python3
"""Create redaction-safe SKKF source security evidence and analysis-only views.

The scanner never writes matched source text, matched values, commit messages, or
diff content to an evidence report. Historical findings are derived by scanning
Git blobs in memory and joining per-rule occurrence counts to raw object-id
transitions. Sanitized views are deliberately non-buildable: allowed text files
are renamed with an ``.analysis.txt`` suffix and all output is read-only.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.parse
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Iterable, Iterator, Sequence
from xml.etree import ElementTree


SCANNER_VERSION = "1.0.0"
POLICY_VERSION = "SKKF-SANITIZED-VIEW-1"
ZERO_SHA = "0" * 40

SCRIPT_PATH = Path(__file__).resolve()
G0_ROOT = SCRIPT_PATH.parent
EVIDENCE_ROOT = G0_ROOT / "source-security-evidence"
VIEW_ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source")
COVERAGE_REGISTER = G0_ROOT.parent / "five-session-source-coverage-register.csv"


@dataclass(frozen=True)
class Source:
    source_scope_id: str
    module: str
    key: str
    path: Path
    expected_head: str
    expected_tree: str


SOURCES: tuple[Source, ...] = (
    Source(
        "SRC-HRM",
        "HRM",
        "hrm",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/hrm"),
        "c8654c2132294cf79d2974cb727b31dae0eacc88",
        "0ed80487f0d5f6b733bfdf3cfced867a6f72bf4a",
    ),
    Source(
        "SRC-PER",
        "PER",
        "per",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/per"),
        "6f81384d766731204ac8b6ef9d55ebd91b22e5cb",
        "07540b24f0ca4b3eba2349919132a954864f6968",
    ),
    Source(
        "SRC-PAY",
        "PAY",
        "pay",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/pay"),
        "50459981288bb9d545b4432d970876de878909b4",
        "df4290a4b1dbc5666a6af437726d90760843131d",
    ),
    Source(
        "SRC-TIM",
        "TIM",
        "tim",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/tim"),
        "242aeb608c5d6bc2e00ef246d7e557c3def959a8",
        "f260d1fd1bdd4f4d368ce424c93cd8a0175524a5",
    ),
    Source(
        "SRC-SYS",
        "SYS",
        "sys",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/sys"),
        "c96a8920dd261ee3494109c575ecc7cafea6cd8c",
        "6e44416aa249130dbeadb9e63950ec0dc084c3aa",
    ),
    Source(
        "SRC-FRONT",
        "FRONT",
        "frontend",
        Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/source/frontend"),
        "e733eae1bc485be0f603f5b593c86321aaf844d2",
        "63b21abf8314de0a2134f87041fad526e6315091",
    ),
)


@dataclass(frozen=True)
class SecretRule:
    rule_id: str
    severity: str
    pattern_class: str
    expression: bytes
    disposition: str
    value_group: int | None = None

    @property
    def compiled(self) -> re.Pattern[bytes]:
        return re.compile(self.expression)

    @property
    def expression_digest(self) -> str:
        return sha256_bytes(self.expression)


SECRET_RULES: tuple[SecretRule, ...] = (
    SecretRule(
        "SEC-PRIVATE-KEY-BLOCK",
        "CRITICAL",
        "PRIVATE_KEY_HEADER",
        rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-AWS-ACCESS-KEY",
        "CRITICAL",
        "AWS_ACCESS_KEY_IDENTIFIER",
        rb"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-GITHUB-TOKEN",
        "CRITICAL",
        "GITHUB_TOKEN",
        rb"\bgh[pousr]_[A-Za-z0-9]{20,}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-GITLAB-TOKEN",
        "CRITICAL",
        "GITLAB_TOKEN",
        rb"\bglpat-[A-Za-z0-9_-]{20,}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-GOOGLE-API-KEY",
        "CRITICAL",
        "GOOGLE_API_KEY",
        rb"\bAIza[0-9A-Za-z_-]{35}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-SLACK-TOKEN",
        "CRITICAL",
        "SLACK_TOKEN",
        rb"\bxox[baprs]-[0-9A-Za-z-]{10,}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-STRIPE-LIVE-KEY",
        "CRITICAL",
        "STRIPE_LIVE_KEY",
        rb"\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
    ),
    SecretRule(
        "SEC-AZURE-ACCOUNT-KEY",
        "CRITICAL",
        "AZURE_CONNECTION_ACCOUNT_KEY",
        rb"(?i)\bAccountKey\s*=\s*([^;\s]{8,})",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
        1,
    ),
    SecretRule(
        "SEC-BASIC-AUTH-URL",
        "HIGH",
        "URI_USERINFO",
        rb"(?i)\b(?:https?|jdbc:[a-z0-9:+.-]+)://[^/@\s:]+:([^/@\s]+)@",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
        1,
    ),
    SecretRule(
        "SEC-BEARER-LITERAL",
        "HIGH",
        "BEARER_TOKEN_LITERAL",
        rb"(?i)\bBearer\s+([A-Za-z0-9._~+/-]{20,}={0,2})",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
        1,
    ),
    SecretRule(
        "SEC-JWT-COMPACT",
        "HIGH",
        "JWT_COMPACT_SERIALIZATION",
        rb"\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_LIVE",
        1,
    ),
    SecretRule(
        "SEC-GENERIC-QUOTED-ASSIGNMENT",
        "HIGH",
        "SECRET_KEYWORD_QUOTED_ASSIGNMENT",
        rb"(?i)\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*['\"]([^'\"\r\n]{4,})['\"]",
        "EXCLUDE_PENDING_FALSE_POSITIVE_OR_ROTATION_DISPOSITION",
        1,
    ),
    SecretRule(
        "SEC-GENERIC-CONFIG-ASSIGNMENT",
        "HIGH",
        "SECRET_KEYWORD_CONFIG_ASSIGNMENT",
        rb"(?i)^\s*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*([^\s#;,]{4,})",
        "EXCLUDE_PENDING_FALSE_POSITIVE_OR_ROTATION_DISPOSITION",
        1,
    ),
    SecretRule(
        "SEC-PRIVATE-KEY-PATH",
        "HIGH",
        "PATH_DERIVED_KEY_OR_CERTIFICATE_MATERIAL",
        rb"<PATH_RULE:DENY-KEY-MATERIAL>",
        "EXCLUDE_AND_SECURITY_REVIEW_REVOKE_ROTATE_IF_PRIVATE_KEY_IS_LIVE",
    ),
    SecretRule(
        "SEC-CREDENTIAL-NAMED-PATH",
        "HIGH",
        "PATH_DERIVED_CREDENTIAL_NAMED_FILE",
        rb"<PATH_RULE:DENY-CREDENTIAL-NAMED-FILE>",
        "EXCLUDE_PENDING_SECURITY_DISPOSITION",
    ),
    SecretRule(
        "PRIV-KR-RESIDENT-ID",
        "CRITICAL",
        "KOREAN_RESIDENT_REGISTRATION_NUMBER_CANDIDATE",
        rb"(?<![0-9])[0-9]{6}[- ]?[1-8][0-9]{6}(?![0-9])",
        "EXCLUDE_AND_PRIVACY_SECURITY_REVIEW_REQUIRED",
    ),
    SecretRule(
        "PRIV-EMAIL-ADDRESS",
        "HIGH",
        "EMAIL_ADDRESS_CANDIDATE",
        rb"(?i)(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}(?![A-Za-z0-9.-])",
        "EXCLUDE_AND_PRIVACY_REVIEW_REQUIRED",
    ),
    SecretRule(
        "DATA-INLINE-SQL",
        "HIGH",
        "INLINE_SQL_STATEMENT_CANDIDATE",
        rb"(?i)\b(?:select\s+[^\r\n;]{1,300}\s+from|insert\s+into|update\s+[A-Za-z0-9_.]+\s+set|delete\s+from|merge\s+into|create\s+table)\b",
        "EXCLUDE_SQL_EXPRESSION_FROM_SANITIZED_VIEW",
    ),
)


@dataclass(frozen=True)
class PathRule:
    rule_id: str
    match_scope: str
    expression: str
    reason: str

    @property
    def compiled(self) -> re.Pattern[str]:
        return re.compile(self.expression, re.IGNORECASE)


PATH_RULES: tuple[PathRule, ...] = (
    PathRule("DENY-GIT-METADATA", "PATH", r"(^|/)\.git($|/)", "Git metadata is never exported"),
    PathRule(
        "DENY-ENV-FILE",
        "PATH",
        r"(^|/)(?:\.env(?:\..*)?|[^/]+\.env|\.envrc)$",
        "Environment material may contain credentials",
    ),
    PathRule(
        "DENY-CREDENTIAL-NAMED-FILE",
        "PATH",
        r"(^|/)(?:secrets?|credentials?|passwords?|passwd|tokens?|authdata)(?:[._-][^/]*)?$",
        "Credential-named files are fail-closed",
    ),
    PathRule(
        "DENY-CONFIG-DIRECTORY",
        "PATH",
        r"(^|/)(?:config|configuration|conf)(?:/|$)",
        "Configuration directories are excluded",
    ),
    PathRule(
        "DENY-CONFIG-FILE",
        "PATH",
        r"(?:^|/)(?:application[^/]*|bootstrap[^/]*|gradle\.properties|settings\.xml|\.npmrc|\.yarnrc(?:\.yml)?|package\.json|yarn\.lock|package-lock\.json|pnpm-lock\.ya?ml|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradle-wrapper\.properties)$|\.(?:ya?ml|properties|toml|ini|cfg|conf)$",
        "Build and runtime configuration is excluded",
    ),
    PathRule(
        "DENY-DEPLOYMENT",
        "PATH",
        r"(^|/)(?:deploy(?:ment)?[^/]*|k8s|kubernetes|helm|terraform|ansible|docker)(?:/|$)|(^|/)(?:Dockerfile[^/]*|docker-compose[^/]*)$",
        "Deployment material is excluded",
    ),
    PathRule(
        "DENY-LOG",
        "PATH",
        r"(^|/)(?:log|logs)(?:/|$)|\.log(?:\.[0-9]+)?$",
        "Logs may contain personal or credential data",
    ),
    PathRule(
        "DENY-REST-SAMPLE",
        "PATH",
        r"(^|/)(?:rest|postman)(?:/|$)|\.(?:http|rest)$|(?:postman_(?:collection|environment)\.json)$",
        "REST samples frequently embed endpoints or credentials",
    ),
    PathRule(
        "DENY-KEY-MATERIAL",
        "PATH",
        r"(^|/)(?:id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|[^/]+\.(?:pem|key|p12|pfx|jks|keystore|crt|cer|der|pub))$",
        "Key and certificate material is excluded",
    ),
    PathRule(
        "DENY-BINARY-ARCHIVE-EXTENSION",
        "PATH",
        r"\.(?:jar|war|ear|zip|tar|tgz|gz|bz2|xz|7z|rar|whl|egg|class|pyc|so|dll|dylib|exe|bin|apk|ipa|deb|rpm|msi|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|png|jpe?g|gif|bmp|ico|webp|svgz|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|wav)$",
        "Binary, archive, office, media, and font files are excluded",
    ),
    PathRule(
        "DENY-DATABASE-SCRIPT",
        "PATH",
        r"\.(?:sql|ddl|dml)$|(^|/)(?:db|database)/(?:migration|seed|dump)(?:/|$)",
        "SQL, migrations, seeds, and dumps are excluded by source governance",
    ),
    PathRule(
        "DENY-DATA-EXPORT-BACKUP",
        "PATH",
        r"(^|/)(?:data|datasets?|exports?|backups?|dumps?)(?:/|$)|\.(?:csv|tsv|parquet|avro)$",
        "Data and export locations are excluded for privacy",
    ),
    PathRule(
        "DENY-EXECUTABLE-SCRIPT",
        "PATH",
        r"\.(?:sh|bash|zsh|fish|bat|cmd|ps1|psm1|vbs|exe)$",
        "Directly executable scripts are excluded",
    ),
    PathRule(
        "DENY-BENSK-ADDSK",
        "PATH",
        r"(^|/)(?:publ/ben|bensk|addsk)(?:/|$)",
        "BENSK and ADDSK are explicitly outside HRIS migration scope",
    ),
    PathRule(
        "DENY-QUERY-MAPPER",
        "PATH",
        r"(^|/)(?:mapper|mappers|query|queries|mybatis|ibatis)(?:/|$)|(?:Mapper|Query)\.xml$",
        "Query and mapper material can contain prohibited SQL expressions",
    ),
    PathRule(
        "DENY-TEST-DATA-RESOURCE",
        "PATH",
        r"(^|/)src/test/resources(?:/|$)|(^|/)(?:fixtures?|samples?|testdata|mockdata|mock-data)(?:/|$)",
        "Fixtures and test resources can contain personal or customer sample data",
    ),
    PathRule(
        "DENY-STRUCTURED-DATA-FILE",
        "PATH",
        r"\.(?:json|xml|csv|tsv|ndjson|jsonl|parquet|avro)$",
        "Structured data and XML are excluded unless separately reviewed",
    ),
    PathRule(
        "DENY-TEMPLATE-ASSET",
        "PATH",
        r"(^|/)(?:storage/)?(?:template|templates)(?:/|$)",
        "Templates may contain formulas, customer data, or import structures",
    ),
)

DYNAMIC_PATH_RULES: tuple[dict[str, str], ...] = (
    {
        "rule_id": "DENY-CREDENTIAL-FINDING-PATH",
        "match_scope": "DERIVED_CURRENT_TREE",
        "pattern_type": "EXACT_PATH_SET",
        "exact_pattern": "path present in current-findings.csv",
        "reason": "Any credential-pattern location excludes the whole file",
        "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
    },
    {
        "rule_id": "DENY-BINARY-CONTENT",
        "match_scope": "BLOB_CONTENT_CLASSIFICATION",
        "pattern_type": "DETERMINISTIC_HEURISTIC",
        "exact_pattern": "known binary magic OR NUL byte within first 8192 bytes",
        "reason": "Opaque binary content cannot be redaction-reviewed as text",
        "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
    },
    {
        "rule_id": "DENY-SYMLINK",
        "match_scope": "GIT_INDEX_MODE",
        "pattern_type": "EXACT_MODE",
        "exact_pattern": "git mode == 120000",
        "reason": "Symlinks can escape the controlled analysis tree",
        "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
    },
    {
        "rule_id": "DENY-SHEBANG-EXECUTABLE",
        "match_scope": "BLOB_PREFIX",
        "pattern_type": "EXACT_BYTES",
        "exact_pattern": "blob starts with ASCII #!",
        "reason": "Directly executable text is excluded",
        "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
    },
    {
        "rule_id": "DENY-NON-UTF8",
        "match_scope": "BLOB_DECODING",
        "pattern_type": "STRICT_UTF8",
        "exact_pattern": "strict UTF-8 decode fails",
        "reason": "Unreviewable text encoding is fail-closed",
        "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
    },
)


MANIFEST_NAMES = {
    "package.json",
    "yarn.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "pnpm-lock.yml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradle.properties",
    "gradle-wrapper.properties",
    "libs.versions.toml",
}

BINARY_ARCHIVE_EXTENSIONS = {
    ".jar",
    ".war",
    ".ear",
    ".zip",
    ".tar",
    ".tgz",
    ".gz",
    ".bz2",
    ".xz",
    ".7z",
    ".rar",
    ".whl",
    ".egg",
    ".class",
    ".pyc",
    ".so",
    ".dll",
    ".dylib",
    ".exe",
    ".bin",
    ".apk",
    ".ipa",
    ".deb",
    ".rpm",
    ".msi",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".webp",
    ".svgz",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp3",
    ".mp4",
    ".mov",
    ".avi",
    ".wav",
}

PLACEHOLDER_EXACT = {
    b"null",
    b"none",
    b"nil",
    b"true",
    b"false",
    b"changeme",
    b"change-me",
    b"placeholder",
    b"example",
    b"sample",
    b"dummy",
    b"test",
    b"testing",
    b"password",
    b"secret",
    b"token",
    b"xxxxx",
    b"******",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_fingerprint(*parts: object) -> str:
    normalized = "\x1f".join(str(part) for part in parts)
    return hashlib.sha256(normalized.encode("utf-8", "surrogateescape")).hexdigest()


def iso_utc(epoch: int | float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def validate_timestamp(value: str) -> str:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError("--captured-at must include a UTC offset")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def run_bytes(repo: Path | None, args: Sequence[str], *, input_bytes: bytes | None = None) -> tuple[bytes, bytes]:
    command = ["git", "-C", str(repo), *args] if repo is not None else list(args)
    completed = subprocess.run(
        command,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        # Do not include stderr because a failing tool can echo matched material.
        raise RuntimeError(
            f"command failed closed: executable={command[0]!r}, returncode={completed.returncode}, "
            f"stderr_sha256={sha256_bytes(completed.stderr)}"
        )
    return completed.stdout, completed.stderr


def git_text(repo: Path, args: Sequence[str]) -> tuple[str, bytes]:
    stdout, stderr = run_bytes(repo, args)
    return stdout.decode("utf-8", "surrogateescape").rstrip("\n"), stderr


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def current_index(repo: Path) -> list[dict[str, str]]:
    stdout, _ = run_bytes(repo, ["ls-files", "-s", "-z"])
    rows: list[dict[str, str]] = []
    for record in stdout.split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        mode, blob, stage = metadata.decode("ascii").split(" ")
        if stage != "0":
            raise RuntimeError("index contains a non-stage-zero entry; refusing to scan")
        path = raw_path.decode("utf-8", "surrogateescape")
        if any(ord(character) < 32 for character in path):
            raise RuntimeError("tracked path contains a control character; fail-closed")
        rows.append({"mode": mode, "blob": blob, "path": path})
    return sorted(rows, key=lambda row: row["path"].encode("utf-8", "surrogateescape"))


def read_cat_file_batch(repo: Path, object_ids: Iterable[str]) -> Iterator[tuple[str, str, bytes]]:
    process = subprocess.Popen(
        ["git", "-C", str(repo), "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    assert process.stderr is not None
    try:
        for object_id in object_ids:
            process.stdin.write(object_id.encode("ascii") + b"\n")
            process.stdin.flush()
            header = process.stdout.readline()
            if not header:
                raise RuntimeError("git cat-file ended before returning an object header")
            header_parts = header.rstrip(b"\n").split(b" ")
            if len(header_parts) != 3 or header_parts[1] == b"missing":
                raise RuntimeError("git cat-file returned a missing or malformed object header")
            returned_id = header_parts[0].decode("ascii")
            object_type = header_parts[1].decode("ascii")
            size = int(header_parts[2])
            data = process.stdout.read(size)
            terminator = process.stdout.read(1)
            if len(data) != size or terminator != b"\n":
                raise RuntimeError("git cat-file returned a truncated object")
            if returned_id != object_id:
                raise RuntimeError("git cat-file object order mismatch")
            yield object_id, object_type, data
        process.stdin.close()
        returncode = process.wait()
        stderr = process.stderr.read()
        if returncode != 0:
            raise RuntimeError(
                f"git cat-file failed closed: returncode={returncode}, stderr_sha256={sha256_bytes(stderr)}"
            )
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


def is_placeholder(raw_value: bytes) -> bool:
    value = raw_value.strip().strip(b"'\"").lower()
    if value in PLACEHOLDER_EXACT:
        return True
    placeholder_markers = (
        b"${",
        b"#{",
        b"{{",
        b"}}",
        b"process.env",
        b"system.getenv",
        b"getenv(",
        b"vault:",
        b"secretref",
    )
    return any(marker in value for marker in placeholder_markers)


COMPILED_SECRET_RULES = tuple((rule, rule.compiled) for rule in SECRET_RULES)


def scan_secret_rules(data: bytes, *, include_lines: bool) -> tuple[dict[str, int], dict[str, list[int]]]:
    counts: dict[str, int] = defaultdict(int)
    lines_by_rule: dict[str, list[int]] = defaultdict(list)
    # Line-local scanning bounds memory for matches and gives stable current-tree locations.
    for line_number, line in enumerate(data.splitlines(), start=1):
        for rule, compiled in COMPILED_SECRET_RULES:
            for match in compiled.finditer(line):
                if rule.value_group is not None and is_placeholder(match.group(rule.value_group)):
                    continue
                counts[rule.rule_id] += 1
                if include_lines:
                    lines_by_rule[rule.rule_id].append(line_number)
    return dict(counts), dict(lines_by_rule)


def binary_kind(path: str, data: bytes) -> tuple[bool, str, str]:
    suffix = PurePosixPath(path).suffix.lower()
    detections: list[str] = []
    kind = "BINARY_CONTENT"
    if suffix in BINARY_ARCHIVE_EXTENSIONS:
        detections.append("EXTENSION")
        kind = suffix[1:].upper() or "BINARY"
    magic = ""
    if data.startswith(b"PK\x03\x04"):
        magic = "ZIP_CONTAINER"
    elif data.startswith(b"%PDF-"):
        magic = "PDF"
    elif data.startswith(b"\x7fELF"):
        magic = "ELF"
    elif data.startswith(b"MZ"):
        magic = "PE"
    elif data.startswith(b"\x1f\x8b"):
        magic = "GZIP"
    elif data.startswith(b"\xca\xfe\xba\xbe"):
        magic = "JAVA_CLASS"
    if magic:
        detections.append("MAGIC")
        kind = magic
    if b"\x00" in data[:8192]:
        detections.append("NUL_BYTE")
    is_binary = bool(detections)
    return is_binary, kind if is_binary else "TEXT", "|".join(sorted(set(detections))) or "TEXT_HEURISTIC"


def license_kind(path: str) -> str | None:
    name = PurePosixPath(path).name.lower()
    if re.match(r"^(?:licen[cs]e|copying|copyright)(?:[._-].*)?$", name):
        return "LICENSE_OR_COPYING"
    if re.match(r"^(?:oss[_-]?notice|notice|third[_-]?party)(?:[._-].*)?$", name):
        return "NOTICE_OR_THIRD_PARTY"
    return None


def manifest_kind(path: str) -> str | None:
    name = PurePosixPath(path).name
    if name not in MANIFEST_NAMES:
        return None
    if name == "package.json":
        return "NPM_MANIFEST"
    if name in {"yarn.lock", "package-lock.json", "pnpm-lock.yaml", "pnpm-lock.yml"}:
        return "JS_LOCKFILE"
    if name == "pom.xml":
        return "MAVEN_MANIFEST"
    if name.startswith("build.gradle"):
        return "GRADLE_BUILD"
    if name.startswith("settings.gradle"):
        return "GRADLE_SETTINGS"
    if name == "gradle-wrapper.properties":
        return "GRADLE_WRAPPER"
    return "BUILD_CONFIGURATION"


def safe_package_name(value: object, ecosystem: str) -> str | None:
    if not isinstance(value, str) or not value or len(value) > 240:
        return None
    if ecosystem == "npm":
        pattern = r"^(?:@[a-z0-9._-]+/)?[a-z0-9._-]+$"
    else:
        pattern = r"^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?$"
    return value if re.fullmatch(pattern, value, re.IGNORECASE) else None


def safe_version(value: object) -> str:
    if not isinstance(value, str) or not value or len(value) > 160:
        return "UNRESOLVED_OR_REDACTED"
    lowered = value.lower()
    if "://" in value or "@http" in lowered or lowered.startswith(("git+", "git:", "file:", "link:", "portal:")):
        return "NON_REGISTRY_SPEC_REDACTED"
    if lowered.startswith("workspace:"):
        workspace_value = value.split(":", 1)[1]
        if re.fullmatch(r"(?:[~^*]|[0-9xX*]+(?:\.[0-9xX*]+){0,2}(?:[-+][A-Za-z0-9.-]+)?)", workspace_value):
            return value
        return "WORKSPACE_SPEC_REDACTED"
    safe_literals = {
        "latest",
        "next",
        "beta",
        "alpha",
        "canary",
        "MANAGED_UNRESOLVED",
        "CORE_OR_UNRESOLVED",
    }
    if value in safe_literals:
        return value
    if not re.fullmatch(
        r"(?:[vV])?(?:[~^<>=*|(), ]*)[0-9xX*]+(?:\.[0-9xX*]+){0,3}(?:[-+][A-Za-z0-9.*-]+)?(?:[~^<>=*|(), 0-9xX.vV+-]*)?",
        value,
    ):
        return "NONSTANDARD_SPEC_REDACTED"
    return value


def dependency_row(
    source: Source,
    path: str,
    line: int,
    ecosystem: str,
    scope: str,
    name: str,
    declared: str,
    resolved: str,
    directness: str,
) -> dict[str, object]:
    return {
        "source_scope_id": source.source_scope_id,
        "module": source.module,
        "ecosystem": ecosystem,
        "source_path": path,
        "line": line,
        "declaration_scope": scope,
        "name": name,
        "declared_version": declared,
        "resolved_version": resolved,
        "directness": directness,
        "record_status": "REFERENCE_ONLY_NOT_APPROVED_FOR_IMPORT",
        "location_fingerprint": stable_fingerprint(
            "dependency-v1", source.source_scope_id, path, line, ecosystem, scope, name
        ),
    }


def parse_package_json(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    try:
        payload = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return [], "PARSE_FAILED_HASH_ONLY"
    rows: list[dict[str, object]] = []
    sections = (
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
        "resolutions",
    )
    for section in sections:
        dependencies = payload.get(section, {})
        if not isinstance(dependencies, dict):
            continue
        for name_value in sorted(dependencies):
            name = safe_package_name(name_value, "npm")
            if name is None:
                continue
            declared = safe_version(dependencies[name_value])
            rows.append(
                dependency_row(source, path, 0, "npm", section, name, declared, "", "DIRECT_DECLARATION")
            )
    return rows, "PARSED_DIRECT_DECLARATIONS"


def parse_yarn_lock(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    rows: list[dict[str, object]] = []
    resolution_pattern = re.compile(rb'^\s{2}resolution:\s*["\']?([^"\'\r\n]+)["\']?\s*$')
    for line_number, line in enumerate(data.splitlines(), start=1):
        match = resolution_pattern.match(line)
        if not match:
            continue
        locator = match.group(1).decode("utf-8", "replace")
        if "@npm:" not in locator:
            continue
        name_value, version_value = locator.rsplit("@npm:", 1)
        name = safe_package_name(name_value, "npm")
        if name is None:
            continue
        version = safe_version(version_value)
        rows.append(
            dependency_row(
                source,
                path,
                line_number,
                "npm",
                "YARN_RESOLUTION",
                name,
                "",
                version,
                "TRANSITIVE_OR_DIRECT_RESOLUTION",
            )
        )
    return rows, "PARSED_RESOLUTIONS"


GRADLE_DEPENDENCY_PATTERN = re.compile(
    rb"^\s*(implementation|api|compile|compileOnly|runtime|runtimeOnly|testImplementation|testCompile|annotationProcessor|classpath)\s*(?:\(\s*)?['\"]([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)(?::([^'\"\s)]+))?['\"]"
)
GRADLE_PLUGIN_PATTERN = re.compile(
    rb"^\s*id\s+['\"]([A-Za-z0-9_.-]+)['\"](?:\s+version\s+['\"]([^'\"\s]+)['\"])?"
)


def parse_gradle(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    rows: list[dict[str, object]] = []
    for line_number, line in enumerate(data.splitlines(), start=1):
        dependency_match = GRADLE_DEPENDENCY_PATTERN.match(line)
        if dependency_match:
            scope = dependency_match.group(1).decode("ascii")
            group = dependency_match.group(2).decode("ascii")
            artifact = dependency_match.group(3).decode("ascii")
            raw_version = dependency_match.group(4)
            version = safe_version(raw_version.decode("utf-8", "replace")) if raw_version else "MANAGED_UNRESOLVED"
            rows.append(
                dependency_row(
                    source,
                    path,
                    line_number,
                    "maven",
                    scope,
                    f"{group}:{artifact}",
                    version,
                    "",
                    "DIRECT_DECLARATION",
                )
            )
            continue
        plugin_match = GRADLE_PLUGIN_PATTERN.match(line)
        if plugin_match:
            name = plugin_match.group(1).decode("ascii")
            raw_version = plugin_match.group(2)
            version = safe_version(raw_version.decode("utf-8", "replace")) if raw_version else "CORE_OR_UNRESOLVED"
            rows.append(
                dependency_row(
                    source,
                    path,
                    line_number,
                    "gradle-plugin",
                    "plugin",
                    name,
                    version,
                    "",
                    "DIRECT_PLUGIN_DECLARATION",
                )
            )
    return rows, "PARSED_LITERAL_DECLARATIONS_ONLY"


def parse_pom(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError:
        return [], "PARSE_FAILED_HASH_ONLY"
    rows: list[dict[str, object]] = []

    def local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    for element in root.iter():
        if local_name(element.tag) not in {"dependency", "plugin"}:
            continue
        children = {local_name(child.tag): (child.text or "").strip() for child in element}
        group = safe_package_name(children.get("groupId", ""), "maven")
        artifact = safe_package_name(children.get("artifactId", ""), "maven")
        if not group or not artifact:
            continue
        version = safe_version(children.get("version", "MANAGED_UNRESOLVED"))
        scope = children.get("scope", "plugin" if local_name(element.tag) == "plugin" else "compile")
        rows.append(
            dependency_row(
                source,
                path,
                0,
                "maven",
                safe_version(scope),
                f"{group}:{artifact}",
                version,
                "",
                "DIRECT_XML_DECLARATION",
            )
        )
    return rows, "PARSED_DIRECT_XML_DECLARATIONS"


def parse_gradle_wrapper(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    pattern = re.compile(rb"^distributionUrl=.*gradle-([0-9][A-Za-z0-9._+-]*)-(?:bin|all)\.zip\s*$")
    for line_number, line in enumerate(data.splitlines(), start=1):
        match = pattern.match(line)
        if match:
            version = safe_version(match.group(1).decode("ascii"))
            return [
                dependency_row(
                    source,
                    path,
                    line_number,
                    "gradle-distribution",
                    "wrapper",
                    "gradle",
                    version,
                    version,
                    "BUILD_TOOL_PIN",
                )
            ], "PARSED_WRAPPER_VERSION"
    return [], "VERSION_NOT_PARSED_HASH_ONLY"


def inspect_manifest(source: Source, path: str, data: bytes) -> tuple[list[dict[str, object]], str]:
    name = PurePosixPath(path).name
    if name == "package.json":
        return parse_package_json(source, path, data)
    if name == "yarn.lock":
        return parse_yarn_lock(source, path, data)
    if name.startswith("build.gradle"):
        return parse_gradle(source, path, data)
    if name == "pom.xml":
        return parse_pom(source, path, data)
    if name == "gradle-wrapper.properties":
        return parse_gradle_wrapper(source, path, data)
    return [], "HASHED_ONLY_NO_SAFE_PARSER"


def path_rule_matches(path: str) -> list[str]:
    return [rule.rule_id for rule in PATH_RULES if rule.compiled.search(path)]


def create_history_database(source: Source, database_path: Path) -> tuple[sqlite3.Connection, dict[str, object]]:
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        CREATE TABLE transitions (
          transition_id INTEGER PRIMARY KEY,
          commit_sha TEXT NOT NULL,
          committed_epoch INTEGER NOT NULL,
          parents TEXT NOT NULL,
          old_blob TEXT NOT NULL,
          new_blob TEXT NOT NULL,
          change_status TEXT NOT NULL,
          path TEXT NOT NULL,
          UNIQUE(commit_sha, old_blob, new_blob, change_status, path)
        );
        CREATE TABLE blobs (blob TEXT PRIMARY KEY);
        CREATE TABLE blob_rule (
          blob TEXT NOT NULL,
          rule_id TEXT NOT NULL,
          occurrence_count INTEGER NOT NULL,
          PRIMARY KEY(blob, rule_id)
        );
        """
    )
    command = [
        "git",
        "-C",
        str(source.path),
        "log",
        "--all",
        "--full-history",
        "--topo-order",
        "--reverse",
        "--format=@@COMMIT@@%x09%H%x09%ct%x09%P",
        "--raw",
        "--no-abbrev",
        "--no-renames",
        "--root",
        "-m",
        "--",
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="surrogateescape",
    )
    assert process.stdout is not None
    assert process.stderr is not None
    current_commit = ""
    committed_epoch = 0
    parents = ""
    commit_shas: set[str] = set()
    parsed_transitions = 0
    for raw_line in process.stdout:
        line = raw_line.rstrip("\n")
        if line.startswith("@@COMMIT@@\t"):
            parts = line.split("\t", 3)
            if len(parts) != 4:
                process.kill()
                raise RuntimeError("malformed Git history commit metadata; fail-closed")
            _, current_commit, epoch_text, parents = parts
            committed_epoch = int(epoch_text)
            commit_shas.add(current_commit)
            continue
        if not line.startswith(":"):
            continue
        if not current_commit:
            process.kill()
            raise RuntimeError("raw Git transition appeared before commit metadata")
        try:
            metadata, path = line.split("\t", 1)
            fields = metadata[1:].split(" ")
            old_blob, new_blob, change_status = fields[2], fields[3], fields[4]
        except (IndexError, ValueError):
            process.kill()
            raise RuntimeError("malformed raw Git transition; fail-closed") from None
        if any(ord(character) < 32 for character in path):
            process.kill()
            raise RuntimeError("historical path contains a control character; fail-closed")
        connection.execute(
            "INSERT OR IGNORE INTO transitions(commit_sha, committed_epoch, parents, old_blob, new_blob, change_status, path) VALUES(?,?,?,?,?,?,?)",
            (current_commit, committed_epoch, parents, old_blob, new_blob, change_status, path),
        )
        for blob in (old_blob, new_blob):
            if blob != ZERO_SHA:
                connection.execute("INSERT OR IGNORE INTO blobs(blob) VALUES(?)", (blob,))
        parsed_transitions += 1
        if parsed_transitions % 10000 == 0:
            connection.commit()
    returncode = process.wait()
    stderr = process.stderr.read().encode("utf-8", "surrogateescape")
    if returncode != 0:
        raise RuntimeError(
            f"full-history metadata extraction failed closed: returncode={returncode}, stderr_sha256={sha256_bytes(stderr)}"
        )
    connection.commit()
    unique_transitions = connection.execute("SELECT COUNT(*) FROM transitions").fetchone()[0]
    unique_blobs = connection.execute("SELECT COUNT(*) FROM blobs").fetchone()[0]
    return connection, {
        "commit_count": len(commit_shas),
        "raw_transition_records": parsed_transitions,
        "unique_transitions": unique_transitions,
        "unique_objects": unique_blobs,
        "history_command_warning_lines": len(stderr.splitlines()),
        "history_command_stderr_sha256": sha256_bytes(stderr),
    }


def scan_history_blobs(
    source: Source,
    connection: sqlite3.Connection,
    current_blob_ids: set[str],
) -> tuple[dict[str, dict[str, object]], dict[str, object]]:
    current_metadata: dict[str, dict[str, object]] = {}
    object_ids = [row[0] for row in connection.execute("SELECT blob FROM blobs ORDER BY blob")]
    scanned_blobs = 0
    scanned_text_blobs = 0
    scanned_binary_blobs = 0
    non_blob_objects = 0
    total_bytes = 0
    largest_blob_bytes = 0
    batch: list[tuple[str, str, int]] = []
    for object_id, object_type, data in read_cat_file_batch(source.path, object_ids):
        if object_type != "blob":
            non_blob_objects += 1
            continue
        scanned_blobs += 1
        total_bytes += len(data)
        largest_blob_bytes = max(largest_blob_bytes, len(data))
        is_binary, kind, detection = binary_kind("", data)
        if is_binary:
            scanned_binary_blobs += 1
        else:
            scanned_text_blobs += 1
        counts, lines = scan_secret_rules(data, include_lines=object_id in current_blob_ids)
        for rule_id, occurrence_count in counts.items():
            batch.append((object_id, rule_id, occurrence_count))
        if len(batch) >= 5000:
            connection.executemany("INSERT INTO blob_rule(blob, rule_id, occurrence_count) VALUES(?,?,?)", batch)
            batch.clear()
            connection.commit()
        if object_id in current_blob_ids:
            current_metadata[object_id] = {
                "data": data,
                "sha256": sha256_bytes(data),
                "size": len(data),
                "is_binary": is_binary,
                "binary_kind": kind,
                "binary_detection": detection,
                "rule_counts": counts,
                "rule_lines": lines,
            }
    if batch:
        connection.executemany("INSERT INTO blob_rule(blob, rule_id, occurrence_count) VALUES(?,?,?)", batch)
    connection.commit()
    missing_current = sorted(current_blob_ids - current_metadata.keys())
    if missing_current:
        raise RuntimeError(
            "current-tree object was not scanned as a blob; fail-closed: "
            + stable_fingerprint("missing-current", *missing_current)
        )
    return current_metadata, {
        "scanned_blob_count": scanned_blobs,
        "scanned_text_blob_count": scanned_text_blobs,
        "scanned_binary_blob_count": scanned_binary_blobs,
        "non_blob_object_count": non_blob_objects,
        "scanned_uncompressed_bytes": total_bytes,
        "largest_blob_bytes": largest_blob_bytes,
    }


def history_change_rows(source: Source, connection: sqlite3.Connection) -> Iterator[dict[str, object]]:
    query = """
        WITH transition_rules AS (
          SELECT t.transition_id, br.rule_id
            FROM transitions t JOIN blob_rule br ON br.blob = t.old_blob
          UNION
          SELECT t.transition_id, br.rule_id
            FROM transitions t JOIN blob_rule br ON br.blob = t.new_blob
        )
        SELECT t.commit_sha, t.committed_epoch, t.parents, t.path, t.change_status,
               t.old_blob, t.new_blob, tr.rule_id,
               COALESCE(old_rule.occurrence_count, 0),
               COALESCE(new_rule.occurrence_count, 0)
          FROM transition_rules tr
          JOIN transitions t ON t.transition_id = tr.transition_id
          LEFT JOIN blob_rule old_rule ON old_rule.blob = t.old_blob AND old_rule.rule_id = tr.rule_id
          LEFT JOIN blob_rule new_rule ON new_rule.blob = t.new_blob AND new_rule.rule_id = tr.rule_id
         WHERE COALESCE(old_rule.occurrence_count, 0) <> COALESCE(new_rule.occurrence_count, 0)
         ORDER BY t.committed_epoch, t.commit_sha, t.path, tr.rule_id, t.old_blob, t.new_blob
    """
    for (
        commit_sha,
        committed_epoch,
        parents,
        path,
        change_status,
        old_blob,
        new_blob,
        rule_id,
        old_count,
        new_count,
    ) in connection.execute(query):
        if old_count == 0 and new_count > 0:
            direction = "INTRODUCED"
        elif new_count == 0 and old_count > 0:
            direction = "REMOVED"
        elif new_count > old_count:
            direction = "INCREASED"
        else:
            direction = "DECREASED"
        yield {
            "source_scope_id": source.source_scope_id,
            "module": source.module,
            "commit_sha": commit_sha,
            "committed_at_utc": iso_utc(committed_epoch),
            "parent_count": len(parents.split()) if parents else 0,
            "path": path,
            "change_status": change_status,
            "rule_id": rule_id,
            "old_occurrence_count": old_count,
            "new_occurrence_count": new_count,
            "direction": direction,
            "transition_fingerprint": stable_fingerprint(
                "history-transition-v1",
                source.source_scope_id,
                commit_sha,
                path,
                rule_id,
                old_blob,
                new_blob,
                old_count,
                new_count,
            ),
            "disposition": "HISTORY_REVIEW_ROTATE_REVOKE_IF_CREDENTIAL_WAS_LIVE",
        }


def classify_binary_context(path: str) -> str:
    lowered = path.lower()
    if "/libs/" in f"/{lowered}" or lowered.startswith("libs/"):
        return "VENDORED_LIBRARY"
    if "gradle/wrapper/" in lowered:
        return "BUILD_WRAPPER"
    if re.search(r"(^|/)deploy(?:ment)?", lowered):
        return "DEPLOYMENT_AGENT_OR_ARTIFACT"
    if "/storage/" in f"/{lowered}" or "/template/" in f"/{lowered}":
        return "DATA_OR_TEMPLATE_ARTIFACT"
    return "OTHER_TRACKED_BINARY_OR_ARCHIVE"


def component_bom_ref(*parts: object) -> str:
    return "urn:dwp:skkf-reference:" + stable_fingerprint("bom-ref-v1", *parts)


def encode_purl_name(name: str) -> str:
    if name.startswith("@") and "/" in name:
        scope, package = name[1:].split("/", 1)
        return f"{urllib.parse.quote(scope, safe='')}%2F{urllib.parse.quote(package, safe='')}"
    return urllib.parse.quote(name, safe="._-")


def create_reference_sbom(
    captured_at: str,
    dependencies: list[dict[str, object]],
    binaries: list[dict[str, object]],
) -> dict[str, object]:
    source_seed = "|".join(f"{source.source_scope_id}:{source.expected_head}" for source in SOURCES)
    serial = uuid.uuid5(uuid.NAMESPACE_URL, f"dwp:skkf-reference-sbom:{SCANNER_VERSION}:{source_seed}")
    components: list[dict[str, object]] = []
    source_refs: dict[str, str] = {}
    dependency_refs_by_source: dict[str, set[str]] = defaultdict(set)
    for source in SOURCES:
        bom_ref = component_bom_ref("source", source.source_scope_id, source.expected_head)
        source_refs[source.source_scope_id] = bom_ref
        components.append(
            {
                "type": "application",
                "bom-ref": bom_ref,
                "name": f"SKKF-reference-{source.key}",
                "version": source.expected_head,
                "properties": [
                    {"name": "dwp:source-scope-id", "value": source.source_scope_id},
                    {"name": "dwp:git-tree", "value": source.expected_tree},
                    {"name": "dwp:usage", "value": "REFERENCE_ONLY"},
                    {"name": "dwp:import-approval", "value": "NOT_APPROVED"},
                ],
            }
        )
    seen_dependency_components: set[tuple[str, str, str, str]] = set()
    for row in dependencies:
        ecosystem = str(row["ecosystem"])
        name = str(row["name"])
        version = str(row["resolved_version"] or row["declared_version"] or "UNRESOLVED")
        key = (str(row["source_scope_id"]), ecosystem, name, version)
        bom_ref = component_bom_ref("dependency", *key)
        dependency_refs_by_source[key[0]].add(bom_ref)
        if key in seen_dependency_components:
            continue
        seen_dependency_components.add(key)
        component: dict[str, object] = {
            "type": "library",
            "bom-ref": bom_ref,
            "name": name,
            "version": version,
            "properties": [
                {"name": "dwp:source-scope-id", "value": key[0]},
                {"name": "dwp:ecosystem", "value": ecosystem},
                {"name": "dwp:usage", "value": "REFERENCE_ONLY"},
                {"name": "dwp:import-approval", "value": "NOT_APPROVED"},
            ],
        }
        if ecosystem == "npm" and not version.endswith("REDACTED") and version != "UNRESOLVED":
            component["purl"] = f"pkg:npm/{encode_purl_name(name)}@{urllib.parse.quote(version, safe='._+-')}"
        elif ecosystem == "maven" and ":" in name and not version.endswith("REDACTED") and "UNRESOLVED" not in version:
            group, artifact = name.split(":", 1)
            component["group"] = group
            component["name"] = artifact
            component["purl"] = (
                f"pkg:maven/{urllib.parse.quote(group, safe='._-')}/{urllib.parse.quote(artifact, safe='._-')}"
                f"@{urllib.parse.quote(version, safe='._+-')}"
            )
        components.append(component)
    for row in binaries:
        source_scope_id = str(row["source_scope_id"])
        path = str(row["path"])
        digest = str(row["sha256"])
        bom_ref = component_bom_ref("binary", source_scope_id, path, digest)
        dependency_refs_by_source[source_scope_id].add(bom_ref)
        components.append(
            {
                "type": "file",
                "bom-ref": bom_ref,
                "name": PurePosixPath(path).name,
                "version": "TRACKED-SNAPSHOT",
                "hashes": [{"alg": "SHA-256", "content": digest}],
                "properties": [
                    {"name": "dwp:source-scope-id", "value": source_scope_id},
                    {"name": "dwp:source-path", "value": path},
                    {"name": "dwp:binary-kind", "value": str(row["binary_kind"])},
                    {"name": "dwp:usage", "value": "REFERENCE_ONLY"},
                    {"name": "dwp:import-approval", "value": "NOT_APPROVED"},
                ],
            }
        )
    components.sort(key=lambda component: str(component["bom-ref"]))
    dependency_edges = [
        {"ref": source_refs[source.source_scope_id], "dependsOn": sorted(dependency_refs_by_source[source.source_scope_id])}
        for source in SOURCES
    ]
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": f"urn:uuid:{serial}",
        "version": 1,
        "metadata": {
            "timestamp": captured_at,
            "tools": {
                "components": [
                    {
                        "type": "application",
                        "name": "DWP redaction-safe SKKF source scanner",
                        "version": SCANNER_VERSION,
                    }
                ]
            },
            "properties": [
                {"name": "dwp:document-status", "value": "REFERENCE_ONLY_NOT_APPROVED_FOR_IMPORT"},
                {"name": "dwp:code-reuse", "value": "PROHIBITED"},
                {"name": "dwp:dependency-import", "value": "PROHIBITED"},
                {"name": "dwp:resolution-limit", "value": "STATIC_MANIFEST_AND_LOCKFILE_PARSE_NO_BUILD_EXECUTION"},
            ],
        },
        "components": components,
        "dependencies": dependency_edges,
    }


def make_view(
    source: Source,
    current_rows: list[dict[str, str]],
    current_metadata: dict[str, dict[str, object]],
    finding_paths: set[str],
    staging_root: Path,
    captured_at_epoch: int,
) -> tuple[dict[str, object], dict[str, dict[str, object]]]:
    view = staging_root / source.key
    content_root = view / "content"
    content_root.mkdir(parents=True, exist_ok=True)
    included: list[dict[str, object]] = []
    excluded: list[dict[str, object]] = []
    access_by_path: dict[str, dict[str, object]] = {}
    for index_row in current_rows:
        path = index_row["path"]
        mode = index_row["mode"]
        blob = index_row["blob"]
        metadata = current_metadata[blob]
        reasons = path_rule_matches(path)
        if path in finding_paths:
            reasons.append("DENY-CREDENTIAL-FINDING-PATH")
        if mode == "120000":
            reasons.append("DENY-SYMLINK")
        if bool(metadata["is_binary"]):
            reasons.append("DENY-BINARY-CONTENT")
        data = metadata["data"]
        if data.startswith(b"#!"):
            reasons.append("DENY-SHEBANG-EXECUTABLE")
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            reasons.append("DENY-NON-UTF8")
        reasons = sorted(set(reasons))
        if reasons:
            excluded.append(
                {
                    "original_path": path,
                    "git_blob_sha": blob,
                    "sha256": metadata["sha256"],
                    "size_bytes": metadata["size"],
                    "deny_rule_ids": "|".join(reasons),
                    "disposition": "NOT_EXPORTED",
                }
            )
            access_by_path[path] = {
                "status": "BLOCKED_WHOLE_PATH_EXCLUDED",
                "export_path": "",
                "deny_rule_ids": "|".join(reasons),
                "line_count": len(data.splitlines()),
            }
            continue
        export_relative = f"content/{path}.analysis.txt"
        destination = view / export_relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        os.utime(destination, (captured_at_epoch, captured_at_epoch), follow_symlinks=False)
        included.append(
            {
                "original_path": path,
                "export_path": export_relative,
                "git_blob_sha": blob,
                "sha256": metadata["sha256"],
                "size_bytes": metadata["size"],
                "export_mode": "0444_NON_EXECUTABLE_ANALYSIS_TEXT",
                "import_status": "PROHIBITED",
            }
        )
        access_by_path[path] = {
            "status": "AVAILABLE_SANITIZED_TEXT",
            "export_path": str(VIEW_ROOT / source.key / export_relative),
            "deny_rule_ids": "",
            "line_count": len(data.splitlines()),
        }
    write_csv(
        view / "manifest.csv",
        [
            "original_path",
            "export_path",
            "git_blob_sha",
            "sha256",
            "size_bytes",
            "export_mode",
            "import_status",
        ],
        included,
    )
    write_csv(
        view / "excluded-paths.csv",
        ["original_path", "git_blob_sha", "sha256", "size_bytes", "deny_rule_ids", "disposition"],
        excluded,
    )
    readme = f"""# SKKF {source.module} analysis-only sanitized view

**REFERENCE ONLY — COPYING INTO DWP, COMPILING, EXECUTING, OR IMPORTING IS PROHIBITED.**

- Policy: `{POLICY_VERSION}` / `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`
- Source scope: `{source.source_scope_id}`
- Source commit: `{source.expected_head}`
- Source tree: `{source.expected_tree}`
- Captured at: `{iso_utc(captured_at_epoch)}`
- Included files: `{len(included)}`
- Excluded files: `{len(excluded)}`

All included source bytes are read-only and renamed with `.analysis.txt`, so this
directory is not a buildable checkout. `.git`, configuration, environment,
deployment, log, REST sample, key, database/data, executable script, binary,
archive, non-UTF-8, symlink, and credential-finding paths are absent. Use this
view only to derive non-expressive behavior specifications and synthetic tests.
Do not quote or copy implementation text into DWP artifacts.
"""
    (view / "README.md").write_text(readme, encoding="utf-8")
    for generated in (view / "manifest.csv", view / "excluded-paths.csv", view / "README.md"):
        os.utime(generated, (captured_at_epoch, captured_at_epoch), follow_symlinks=False)
    digest_entries: list[tuple[str, str]] = []
    for file_path in sorted((item for item in view.rglob("*") if item.is_file()), key=lambda item: item.as_posix()):
        digest_entries.append((file_path.relative_to(view).as_posix(), sha256_file(file_path)))
    root_digest = stable_fingerprint(
        "sanitized-view-v1",
        source.source_scope_id,
        source.expected_head,
        source.expected_tree,
        *(f"{path}:{digest}" for path, digest in digest_entries),
    )
    digest_path = view / "VIEW_DIGEST.sha256"
    digest_path.write_text(f"{root_digest}  view:{source.key}\n", encoding="ascii")
    os.utime(digest_path, (captured_at_epoch, captured_at_epoch), follow_symlinks=False)
    for file_path in sorted((item for item in view.rglob("*") if item.is_file()), reverse=True):
        file_path.chmod(0o444)
    for directory in sorted((item for item in view.rglob("*") if item.is_dir()), key=lambda item: len(item.parts), reverse=True):
        directory.chmod(0o555)
    view.chmod(0o555)
    return {
        "source_scope_id": source.source_scope_id,
        "module": source.module,
        "view_path": str(VIEW_ROOT / source.key),
        "source_head_sha": source.expected_head,
        "source_tree_sha": source.expected_tree,
        "included_text_files": len(included),
        "excluded_files": len(excluded),
        "included_bytes": sum(int(row["size_bytes"]) for row in included),
        "view_digest_sha256": root_digest,
        "filesystem_mode": "FILES_0444_DIRECTORIES_0555",
        "content_mode": "ORIGINAL_TEXT_RENAMED_DOT_ANALYSIS_DOT_TXT",
        "git_metadata_present": "NO",
        "build_execute_import_status": "PROHIBITED",
    }, access_by_path


def load_coverage_register() -> tuple[list[dict[str, str]], str]:
    raw = COVERAGE_REGISTER.read_bytes()
    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise RuntimeError("coverage register is not UTF-8; fail-closed") from error
    rows = list(csv.DictReader(decoded.splitlines()))
    required = {
        "session_id",
        "source_module",
        "artifact_type",
        "artifact_id",
        "source_file",
        "source_line",
        "disposition",
        "genericity",
    }
    if not rows or not required.issubset(rows[0]):
        raise RuntimeError("coverage register schema mismatch; fail-closed")
    if len(rows) != 2269:
        raise RuntimeError("coverage register is not the pinned 2,269-row floor; fail-closed")
    return rows, sha256_bytes(raw)


def coverage_snapshot_location(row: dict[str, str]) -> tuple[str, str]:
    source_module = row["source_module"].lower()
    artifact_type = row["artifact_type"].upper()
    source_file = row["source_file"]
    if artifact_type == "ROUTE":
        if source_module not in {"hrm", "per", "pay", "tim", "sys", "yea"}:
            raise RuntimeError("coverage route has an unmapped frontend module; fail-closed")
        return "SRC-FRONT", f"packages/{source_file}"
    if source_module not in {"hrm", "per", "pay", "tim", "sys"}:
        raise RuntimeError("coverage backend artifact has an unmapped source module; fail-closed")
    expected_prefix = f"cloudhr-{source_module}/"
    if not source_file.startswith(expected_prefix):
        raise RuntimeError("coverage backend path does not have its pinned repository prefix; fail-closed")
    return f"SRC-{source_module.upper()}", source_file[len(expected_prefix) :]


def build_coverage_access_rows(
    coverage_rows: list[dict[str, str]],
    access_by_scope_path: dict[tuple[str, str], dict[str, object]],
) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for row in coverage_rows:
        source_scope_id, snapshot_path = coverage_snapshot_location(row)
        access = access_by_scope_path.get((source_scope_id, snapshot_path))
        is_bensk = row["genericity"] == "EXCLUDED_BENSK" or (
            row["disposition"] == "RETIRE" and "publ/ben/" in snapshot_path
        )
        if is_bensk:
            status = "EXCLUDED_BENSK_RETIRE"
            export_path = ""
            deny_rules = "DENY-BENSK-ADDSK"
            required_disposition = "RETIRE_NO_G1_SOURCE_ACCESS"
            line_status = "NOT_APPLICABLE_RETIRED"
        elif access is None:
            status = "MISSING_FAIL_CLOSED"
            export_path = ""
            deny_rules = "SOURCE_PATH_NOT_PRESENT_AT_PINNED_SNAPSHOT"
            required_disposition = "UNKNOWN_SOURCE_RECOVERY_REQUIRED"
            line_status = "UNKNOWN"
        elif access["status"] == "AVAILABLE_SANITIZED_TEXT":
            status = "AVAILABLE_SANITIZED_TEXT"
            export_path = str(access["export_path"])
            deny_rules = ""
            required_disposition = "G1_ALLOWED_SANITIZED_VIEW_ONLY_RAW_SNAPSHOT_FORBIDDEN"
            if row["artifact_type"].upper() == "ROUTE":
                try:
                    source_line = int(row["source_line"])
                except ValueError:
                    source_line = 0
                line_count = int(access["line_count"])
                line_status = "IN_RANGE" if 1 <= source_line <= line_count else "OUT_OF_RANGE_REVIEW_REQUIRED"
                if line_status != "IN_RANGE":
                    status = "BLOCKED_SOURCE_LINE_OUT_OF_RANGE"
                    export_path = ""
                    required_disposition = "UNKNOWN_TRACE_RECONCILIATION_REQUIRED"
            else:
                line_status = "FILE_LEVEL_PROVENANCE"
        else:
            status = "SECURITY_BLOCKED_UNKNOWN"
            export_path = ""
            deny_rules = str(access["deny_rule_ids"])
            required_disposition = "UNKNOWN_SECURITY_REVIEW_OR_SAFE_BEHAVIORAL_SUBSTITUTE_REQUIRED"
            line_status = "NOT_READABLE_BY_G1"
        output.append(
            {
                "session_id": row["session_id"],
                "artifact_id": row["artifact_id"],
                "artifact_type": row["artifact_type"],
                "source_module": row["source_module"],
                "source_scope_id": source_scope_id,
                "coverage_source_file": row["source_file"],
                "source_line": row["source_line"],
                "snapshot_relative_path": snapshot_path,
                "sanitized_access_status": status,
                "sanitized_export_path": export_path,
                "source_line_status": line_status,
                "deny_rule_ids": deny_rules,
                "required_disposition": required_disposition,
                "raw_snapshot_access": "FORBIDDEN_FOR_G1_SESSION",
                "value_recorded": "NO",
                "mapping_fingerprint": stable_fingerprint(
                    "coverage-sanitized-map-v1",
                    row["session_id"],
                    row["artifact_id"],
                    source_scope_id,
                    snapshot_path,
                    row["source_line"],
                    status,
                    deny_rules,
                ),
            }
        )
    if len(output) != 2269:
        raise RuntimeError("coverage sanitized mapping is incomplete; fail-closed")
    return output


def safe_replace_generated_directory(staging: Path, target: Path) -> None:
    expected_parent = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris")
    resolved_target = target.resolve(strict=False)
    if expected_parent not in resolved_target.parents:
        raise RuntimeError("refusing to replace a generated directory outside the approved HRIS worktree root")
    if target.exists():
        if target.is_symlink():
            raise RuntimeError("refusing to replace a symlinked generated directory")
        for item in target.rglob("*"):
            if item.is_dir():
                item.chmod(0o755)
            else:
                item.chmod(0o644)
        target.chmod(0o755)
        shutil.rmtree(target)
    staging.rename(target)


def write_report_readme(path: Path, captured_at: str, summary: dict[str, int]) -> None:
    path.write_text(
        f"""# SKKF source security evidence

Status: **REFERENCE ONLY — NOT APPROVED FOR CODE OR DEPENDENCY IMPORT**  
Captured at: `{captured_at}`  
Scanner: `scan_source_security.py` `{SCANNER_VERSION}`

This package records six immutable detached snapshots, current-tree credential
pattern locations, full-reachable-history pattern-count transitions, build and
dependency manifests, license/notice hashes, and every tracked binary/archive
identified by extension, magic, or NUL-byte inspection. No matched value, source
line, diff, commit message, author identity, environment value, or credential
hash is written to these reports.

The CycloneDX document is a static reference inventory only. It does not assert
license compatibility, vulnerability status, provenance, transitive completeness
for Gradle, or approval to import anything into DWP.

## Counts

- Current tracked files: `{summary['tracked_files']}`
- Current credential-like location/rule findings: `{summary['current_findings']}`
- Full-history pattern-count transitions: `{summary['history_changes']}`
- Manifest files: `{summary['manifests']}`
- Dependency records: `{summary['dependencies']}`
- License/notice candidates: `{summary['licenses']}`
- Tracked binary/archive records: `{summary['binaries']}`
- Master coverage rows mapped: `{summary['coverage_rows']}`
- G1 sanitized-view-accessible coverage rows: `{summary['coverage_available']}`
- Explicitly blocked or retired coverage rows: `{summary['coverage_blocked_or_retired']}`

## Fail-closed limits

- Pattern matching is deterministic, not proof that a credential is live or that
  no unrecognized secret exists. Every finding remains quarantined until a human
  Security disposition; live credentials require revoke/rotate evidence.
- Archive members and compressed payloads are not unpacked or executed. Their
  containers are hashed and prohibited from import.
- Gradle inventory contains literal static declarations only; no Gradle task or
  dependency resolution was executed. Yarn lock resolutions are parsed statically.
- History scope is every commit reachable from `--all` refs at the recorded Git
  object database state. Reflog-only, unreachable, pruned, or external history is
  outside evidence scope.
- Sanitized views exclude whole files on any deny rule or credential finding.
  Included text remains proprietary reference material and cannot be copied into
  DWP. Renaming to `.analysis.txt` plus read-only permissions prevents the views
  from being normal build inputs; OS-level isolation is still not a legal strict
  clean room.
""",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--captured-at",
        required=True,
        help="Evidence timestamp with offset; rerun with the same timestamp for byte-identical reports.",
    )
    args = parser.parse_args()
    captured_at = validate_timestamp(args.captured_at)
    captured_datetime = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    captured_epoch = int(captured_datetime.timestamp())

    script_digest = sha256_file(SCRIPT_PATH)
    python_version = ".".join(str(part) for part in sys.version_info[:3])
    git_version_stdout, git_version_stderr = run_bytes(None, ["git", "--version"])
    git_version = git_version_stdout.decode("ascii", "replace").strip()

    evidence_parent = EVIDENCE_ROOT.parent
    evidence_stage = Path(tempfile.mkdtemp(prefix=".source-security-evidence-", dir=evidence_parent))
    view_parent = VIEW_ROOT.parent
    view_parent.mkdir(parents=True, exist_ok=True)
    view_stage = Path(tempfile.mkdtemp(prefix=".sanitized-source-", dir=view_parent))

    all_current_findings: list[dict[str, object]] = []
    all_history_changes: list[dict[str, object]] = []
    all_manifest_rows: list[dict[str, object]] = []
    all_dependencies: list[dict[str, object]] = []
    all_license_rows: list[dict[str, object]] = []
    all_binary_rows: list[dict[str, object]] = []
    history_summaries: list[dict[str, object]] = []
    source_metadata: list[dict[str, object]] = []
    view_register: list[dict[str, object]] = []
    access_by_scope_path: dict[tuple[str, str], dict[str, object]] = {}

    try:
        coverage_rows, coverage_register_sha256 = load_coverage_register()
        for source in SOURCES:
            status, _ = git_text(source.path, ["status", "--porcelain=v1"])
            head, _ = git_text(source.path, ["rev-parse", "HEAD"])
            tree, _ = git_text(source.path, ["rev-parse", "HEAD^{tree}"])
            # symbolic-ref is expected to return 1 for detached HEAD; avoid the generic success-only helper.
            symbolic = subprocess.run(
                ["git", "-C", str(source.path), "symbolic-ref", "-q", "HEAD"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if status or head != source.expected_head or tree != source.expected_tree or symbolic.returncode != 1:
                raise RuntimeError(
                    f"snapshot validation failed closed for {source.source_scope_id}; "
                    f"status_fingerprint={stable_fingerprint(status)}, head_match={head == source.expected_head}, "
                    f"tree_match={tree == source.expected_tree}, detached={symbolic.returncode == 1}"
                )
            current_rows = current_index(source.path)
            current_blob_ids = {row["blob"] for row in current_rows}
            refs, refs_stderr = git_text(source.path, ["for-each-ref", "--format=%(refname):%(objectname)"])
            commit_count_text, commit_count_stderr = git_text(source.path, ["rev-list", "--all", "--count"])
            commit_time, commit_time_stderr = git_text(source.path, ["show", "-s", "--format=%cI", "HEAD"])

            with tempfile.TemporaryDirectory(prefix=f"skkf-history-{source.key}-") as temp_directory:
                database_path = Path(temp_directory) / "history.sqlite3"
                connection, history_summary = create_history_database(source, database_path)
                current_metadata, blob_summary = scan_history_blobs(source, connection, current_blob_ids)
                module_history_rows = list(history_change_rows(source, connection))
                connection.close()
            all_history_changes.extend(module_history_rows)
            history_summaries.append(
                {
                    "source_scope_id": source.source_scope_id,
                    "module": source.module,
                    "snapshot_head_sha": head,
                    "snapshot_tree_sha": tree,
                    "head_committed_at": commit_time,
                    "ref_scope": "ALL_REACHABLE_REFS",
                    "ref_count": len(refs.splitlines()) if refs else 0,
                    "refs_metadata_sha256": sha256_bytes(refs.encode("utf-8", "surrogateescape")),
                    "rev_list_commit_count": int(commit_count_text),
                    **history_summary,
                    **blob_summary,
                    "pattern_change_rows": len(module_history_rows),
                    "scan_status": "PASS_FULL_REACHABLE_HISTORY_METADATA_ONLY",
                    "auxiliary_git_stderr_sha256": sha256_bytes(
                        refs_stderr + commit_count_stderr + commit_time_stderr + git_version_stderr
                    ),
                }
            )

            finding_paths: set[str] = set()
            for index_row in current_rows:
                path = index_row["path"]
                blob = index_row["blob"]
                mode = index_row["mode"]
                metadata = current_metadata[blob]
                path_rules = set(path_rule_matches(path))
                derived_path_findings: list[tuple[str, str]] = []
                if "DENY-KEY-MATERIAL" in path_rules:
                    derived_path_findings.append(("SEC-PRIVATE-KEY-PATH", "DENY-KEY-MATERIAL"))
                if "DENY-CREDENTIAL-NAMED-FILE" in path_rules:
                    derived_path_findings.append(("SEC-CREDENTIAL-NAMED-PATH", "DENY-CREDENTIAL-NAMED-FILE"))
                for rule_id, path_rule_id in derived_path_findings:
                    rule = next(item for item in SECRET_RULES if item.rule_id == rule_id)
                    finding_paths.add(path)
                    all_current_findings.append(
                        {
                            "source_scope_id": source.source_scope_id,
                            "module": source.module,
                            "snapshot_head_sha": head,
                            "path": path,
                            "line": 0,
                            "match_ordinal_on_line": 1,
                            "rule_id": rule_id,
                            "severity": rule.severity,
                            "location_rule_fingerprint": stable_fingerprint(
                                "current-path-finding-v1",
                                source.source_scope_id,
                                head,
                                path,
                                path_rule_id,
                                rule_id,
                            ),
                            "value_recorded": "NO",
                            "liveness": "UNKNOWN_NOT_TESTED",
                            "disposition": rule.disposition,
                        }
                    )
                for rule_id, line_numbers in sorted(metadata["rule_lines"].items()):
                    rule = next(item for item in SECRET_RULES if item.rule_id == rule_id)
                    finding_paths.add(path)
                    line_ordinals: dict[int, int] = defaultdict(int)
                    for line_number in line_numbers:
                        line_ordinals[line_number] += 1
                        ordinal = line_ordinals[line_number]
                        all_current_findings.append(
                            {
                                "source_scope_id": source.source_scope_id,
                                "module": source.module,
                                "snapshot_head_sha": head,
                                "path": path,
                                "line": line_number,
                                "match_ordinal_on_line": ordinal,
                                "rule_id": rule_id,
                                "severity": rule.severity,
                                "location_rule_fingerprint": stable_fingerprint(
                                    "current-finding-v1",
                                    source.source_scope_id,
                                    head,
                                    path,
                                    line_number,
                                    ordinal,
                                    rule_id,
                                ),
                                "value_recorded": "NO",
                                "liveness": "UNKNOWN_NOT_TESTED",
                                "disposition": rule.disposition,
                            }
                        )
                kind = manifest_kind(path)
                if kind:
                    dependency_rows, parse_status = inspect_manifest(source, path, metadata["data"])
                    all_dependencies.extend(dependency_rows)
                    all_manifest_rows.append(
                        {
                            "source_scope_id": source.source_scope_id,
                            "module": source.module,
                            "snapshot_head_sha": head,
                            "path": path,
                            "manifest_kind": kind,
                            "git_blob_sha": blob,
                            "sha256": metadata["sha256"],
                            "size_bytes": metadata["size"],
                            "dependency_parse_status": parse_status,
                            "execution_status": "NOT_EXECUTED_STATIC_PARSE_ONLY",
                            "import_status": "NOT_APPROVED",
                        }
                    )
                notice_kind = license_kind(path)
                if notice_kind:
                    all_license_rows.append(
                        {
                            "source_scope_id": source.source_scope_id,
                            "module": source.module,
                            "snapshot_head_sha": head,
                            "path": path,
                            "document_kind": notice_kind,
                            "git_blob_sha": blob,
                            "sha256": metadata["sha256"],
                            "size_bytes": metadata["size"],
                            "content_review_status": "NOT_REVIEWED_HASH_ONLY",
                            "rights_evidence_status": "NOT_SUFFICIENT_FOR_REUSE",
                        }
                    )
                suffix_binary = PurePosixPath(path).suffix.lower() in BINARY_ARCHIVE_EXTENSIONS
                if bool(metadata["is_binary"]) or suffix_binary:
                    _, detected_kind, detected_by = binary_kind(path, metadata["data"])
                    all_binary_rows.append(
                        {
                            "source_scope_id": source.source_scope_id,
                            "module": source.module,
                            "snapshot_head_sha": head,
                            "path": path,
                            "artifact_context": classify_binary_context(path),
                            "binary_kind": detected_kind,
                            "detected_by": detected_by,
                            "git_mode": mode,
                            "git_blob_sha": blob,
                            "sha256": metadata["sha256"],
                            "size_bytes": metadata["size"],
                            "inspection_status": "OPAQUE_CONTAINER_NOT_UNPACKED_NOT_EXECUTED",
                            "import_status": "PROHIBITED",
                        }
                    )

            view_summary, module_access = make_view(
                source,
                current_rows,
                current_metadata,
                finding_paths,
                view_stage,
                captured_epoch,
            )
            view_register.append(view_summary)
            for relative_path, access in module_access.items():
                access_by_scope_path[(source.source_scope_id, relative_path)] = access
            source_metadata.append(
                {
                    "source_scope_id": source.source_scope_id,
                    "module": source.module,
                    "snapshot_path": str(source.path),
                    "head_sha": head,
                    "tree_sha": tree,
                    "head_committed_at": commit_time,
                    "snapshot_state": "CLEAN_DETACHED_VERIFIED",
                    "tracked_files": len(current_rows),
                    "tracked_tree_manifest_digest": stable_fingerprint(
                        "tree-manifest-v1",
                        source.source_scope_id,
                        *(f"{row['mode']}:{row['blob']}:{row['path']}" for row in current_rows),
                    ),
                }
            )

        coverage_access_rows = build_coverage_access_rows(coverage_rows, access_by_scope_path)
        all_current_findings.sort(
            key=lambda row: (
                str(row["source_scope_id"]),
                str(row["path"]),
                int(row["line"]),
                str(row["rule_id"]),
                int(row["match_ordinal_on_line"]),
            )
        )
        all_history_changes.sort(
            key=lambda row: (
                str(row["committed_at_utc"]),
                str(row["source_scope_id"]),
                str(row["commit_sha"]),
                str(row["path"]),
                str(row["rule_id"]),
                str(row["transition_fingerprint"]),
            )
        )
        all_manifest_rows.sort(key=lambda row: (str(row["source_scope_id"]), str(row["path"])))
        all_dependencies.sort(
            key=lambda row: (
                str(row["source_scope_id"]),
                str(row["ecosystem"]),
                str(row["name"]),
                str(row["resolved_version"]),
                str(row["declared_version"]),
                str(row["source_path"]),
                int(row["line"]),
            )
        )
        all_license_rows.sort(key=lambda row: (str(row["source_scope_id"]), str(row["path"])))
        all_binary_rows.sort(key=lambda row: (str(row["source_scope_id"]), str(row["path"])))
        history_summaries.sort(key=lambda row: str(row["source_scope_id"]))
        source_metadata.sort(key=lambda row: str(row["source_scope_id"]))
        view_register.sort(key=lambda row: str(row["source_scope_id"]))
        coverage_access_rows.sort(
            key=lambda row: (
                str(row["session_id"]),
                str(row["artifact_type"]),
                str(row["artifact_id"]),
            )
        )

        write_csv(
            evidence_stage / "scan-rule-register.csv",
            ["rule_id", "severity", "pattern_class", "expression_sha256", "value_persistence", "default_disposition"],
            (
                {
                    "rule_id": rule.rule_id,
                    "severity": rule.severity,
                    "pattern_class": rule.pattern_class,
                    "expression_sha256": rule.expression_digest,
                    "value_persistence": "NEVER",
                    "default_disposition": rule.disposition,
                }
                for rule in SECRET_RULES
            ),
        )
        write_csv(
            evidence_stage / "sensitive-path-denylist.csv",
            ["rule_id", "match_scope", "pattern_type", "exact_pattern", "reason", "action"],
            [
                {
                    "rule_id": rule.rule_id,
                    "match_scope": rule.match_scope,
                    "pattern_type": "PYTHON_REGEX_IGNORECASE",
                    "exact_pattern": rule.expression,
                    "reason": rule.reason,
                    "action": "EXCLUDE_WHOLE_PATH_FROM_SANITIZED_VIEW",
                }
                for rule in PATH_RULES
            ]
            + list(DYNAMIC_PATH_RULES),
        )
        write_csv(
            evidence_stage / "current-findings.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_head_sha",
                "path",
                "line",
                "match_ordinal_on_line",
                "rule_id",
                "severity",
                "location_rule_fingerprint",
                "value_recorded",
                "liveness",
                "disposition",
            ],
            all_current_findings,
        )
        write_csv(
            evidence_stage / "history-pattern-changes.csv",
            [
                "source_scope_id",
                "module",
                "commit_sha",
                "committed_at_utc",
                "parent_count",
                "path",
                "change_status",
                "rule_id",
                "old_occurrence_count",
                "new_occurrence_count",
                "direction",
                "transition_fingerprint",
                "disposition",
            ],
            all_history_changes,
        )
        write_csv(
            evidence_stage / "history-scan-summary.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_head_sha",
                "snapshot_tree_sha",
                "head_committed_at",
                "ref_scope",
                "ref_count",
                "refs_metadata_sha256",
                "rev_list_commit_count",
                "commit_count",
                "raw_transition_records",
                "unique_transitions",
                "unique_objects",
                "scanned_blob_count",
                "scanned_text_blob_count",
                "scanned_binary_blob_count",
                "non_blob_object_count",
                "scanned_uncompressed_bytes",
                "largest_blob_bytes",
                "pattern_change_rows",
                "history_command_warning_lines",
                "history_command_stderr_sha256",
                "auxiliary_git_stderr_sha256",
                "scan_status",
            ],
            history_summaries,
        )
        write_csv(
            evidence_stage / "source-tree-register.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_path",
                "head_sha",
                "tree_sha",
                "head_committed_at",
                "snapshot_state",
                "tracked_files",
                "tracked_tree_manifest_digest",
            ],
            source_metadata,
        )
        write_csv(
            evidence_stage / "manifest-inventory.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_head_sha",
                "path",
                "manifest_kind",
                "git_blob_sha",
                "sha256",
                "size_bytes",
                "dependency_parse_status",
                "execution_status",
                "import_status",
            ],
            all_manifest_rows,
        )
        write_csv(
            evidence_stage / "dependency-inventory.csv",
            [
                "source_scope_id",
                "module",
                "ecosystem",
                "source_path",
                "line",
                "declaration_scope",
                "name",
                "declared_version",
                "resolved_version",
                "directness",
                "record_status",
                "location_fingerprint",
            ],
            all_dependencies,
        )
        write_csv(
            evidence_stage / "license-notice-inventory.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_head_sha",
                "path",
                "document_kind",
                "git_blob_sha",
                "sha256",
                "size_bytes",
                "content_review_status",
                "rights_evidence_status",
            ],
            all_license_rows,
        )
        write_csv(
            evidence_stage / "vendored-binary-inventory.csv",
            [
                "source_scope_id",
                "module",
                "snapshot_head_sha",
                "path",
                "artifact_context",
                "binary_kind",
                "detected_by",
                "git_mode",
                "git_blob_sha",
                "sha256",
                "size_bytes",
                "inspection_status",
                "import_status",
            ],
            all_binary_rows,
        )
        write_csv(
            evidence_stage / "sanitized-view-register.csv",
            [
                "source_scope_id",
                "module",
                "view_path",
                "source_head_sha",
                "source_tree_sha",
                "included_text_files",
                "excluded_files",
                "included_bytes",
                "view_digest_sha256",
                "filesystem_mode",
                "content_mode",
                "git_metadata_present",
                "build_execute_import_status",
            ],
            view_register,
        )
        write_csv(
            evidence_stage / "coverage-sanitized-access-register.csv",
            [
                "session_id",
                "artifact_id",
                "artifact_type",
                "source_module",
                "source_scope_id",
                "coverage_source_file",
                "source_line",
                "snapshot_relative_path",
                "sanitized_access_status",
                "sanitized_export_path",
                "source_line_status",
                "deny_rule_ids",
                "required_disposition",
                "raw_snapshot_access",
                "value_recorded",
                "mapping_fingerprint",
            ],
            coverage_access_rows,
        )
        write_json(
            evidence_stage / "reference-only-sbom.cdx.json",
            create_reference_sbom(captured_at, all_dependencies, all_binary_rows),
        )
        counts = {
            "tracked_files": sum(int(row["tracked_files"]) for row in source_metadata),
            "current_findings": len(all_current_findings),
            "history_changes": len(all_history_changes),
            "manifests": len(all_manifest_rows),
            "dependencies": len(all_dependencies),
            "licenses": len(all_license_rows),
            "binaries": len(all_binary_rows),
            "coverage_rows": len(coverage_access_rows),
            "coverage_available": sum(
                row["sanitized_access_status"] == "AVAILABLE_SANITIZED_TEXT"
                for row in coverage_access_rows
            ),
            "coverage_blocked_or_retired": sum(
                row["sanitized_access_status"] != "AVAILABLE_SANITIZED_TEXT"
                for row in coverage_access_rows
            ),
        }
        write_report_readme(evidence_stage / "README.md", captured_at, counts)
        write_json(
            evidence_stage / "scan-metadata.json",
            {
                "schema_version": 1,
                "scanner": {
                    "name": "DWP redaction-safe SKKF source scanner",
                    "version": SCANNER_VERSION,
                    "script_sha256": script_digest,
                    "python_version": python_version,
                    "git_version": git_version,
                },
                "timestamps": {
                    "captured_at_utc": captured_at,
                    "determinism": "BYTE_IDENTICAL_WHEN_INPUTS_SCANNER_AND_CAPTURED_AT_ARE_IDENTICAL",
                },
                "method": {
                    "current_tree": "GIT_INDEX_BLOB_SCAN_NO_WORKTREE_SYMLINK_FOLLOW",
                    "history": "ALL_REACHABLE_REFS_RAW_BLOB_TRANSITIONS_AND_IN_MEMORY_PATTERN_COUNTS_NO_DIFF_PERSISTENCE",
                    "dependency_inventory": "STATIC_MANIFEST_AND_LOCKFILE_PARSE_NO_BUILD_EXECUTION",
                    "binary_inventory": "TRACKED_BLOB_EXTENSION_MAGIC_AND_NUL_DETECTION_HASH_ONLY_NO_UNPACK",
                    "sanitized_views": "FAIL_CLOSED_WHOLE_FILE_EXCLUSION_RENAMED_ANALYSIS_TEXT_READ_ONLY",
                    "coverage_mapping": "ALL_2269_MASTER_ROWS_RESOLVE_TO_SANITIZED_PATH_OR_EXPLICIT_BLOCKED_UNKNOWN_OR_RETIRE",
                    "secret_value_persistence": "NEVER",
                },
                "decision": {
                    "source_use": "BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE",
                    "sbom_status": "REFERENCE_ONLY_NOT_APPROVED_FOR_IMPORT",
                    "source_import": "PROHIBITED",
                    "dependency_import": "PROHIBITED",
                    "production_authority": "NONE",
                },
                "counts": counts,
                "coverage_register": {
                    "path": str(COVERAGE_REGISTER),
                    "sha256": coverage_register_sha256,
                    "raw_row_floor": 2269,
                    "g1_access_rule": "SANITIZED_AVAILABLE_ROWS_ONLY_RAW_SNAPSHOT_ACCESS_FORBIDDEN",
                },
                "source_snapshots": source_metadata,
            },
        )

        digest_rows: list[dict[str, object]] = []
        for report_path in sorted(item for item in evidence_stage.iterdir() if item.is_file()):
            digest_rows.append(
                {
                    "path": report_path.name,
                    "sha256": sha256_file(report_path),
                    "size_bytes": report_path.stat().st_size,
                }
            )
        write_csv(evidence_stage / "evidence-file-digests.csv", ["path", "sha256", "size_bytes"], digest_rows)
        evidence_digest = stable_fingerprint(
            "source-security-evidence-v1",
            *(f"{row['path']}:{row['sha256']}:{row['size_bytes']}" for row in digest_rows),
        )
        (evidence_stage / "EVIDENCE_DIGEST.sha256").write_text(
            f"{evidence_digest}  source-security-evidence\n", encoding="ascii"
        )
        for generated in evidence_stage.iterdir():
            if generated.is_file():
                os.utime(generated, (captured_epoch, captured_epoch), follow_symlinks=False)

        if EVIDENCE_ROOT.exists():
            if EVIDENCE_ROOT.is_symlink():
                raise RuntimeError("refusing to replace symlinked evidence directory")
            shutil.rmtree(EVIDENCE_ROOT)
        evidence_stage.rename(EVIDENCE_ROOT)
        safe_replace_generated_directory(view_stage, VIEW_ROOT)
        for directory in sorted((item for item in VIEW_ROOT.rglob("*") if item.is_dir()), key=lambda item: len(item.parts), reverse=True):
            directory.chmod(0o555)
        VIEW_ROOT.chmod(0o555)

        print(
            json.dumps(
                {
                    "status": "PASS",
                    "captured_at": captured_at,
                    "evidence_root": str(EVIDENCE_ROOT),
                    "evidence_digest_sha256": evidence_digest,
                    "sanitized_view_root": str(VIEW_ROOT),
                    "counts": counts,
                },
                sort_keys=True,
            )
        )
        return 0
    except Exception:
        # Remove incomplete generated data. The caller gets a generic error so no
        # captured source value can be surfaced by an exception representation.
        if evidence_stage.exists():
            shutil.rmtree(evidence_stage, ignore_errors=True)
        if view_stage.exists():
            shutil.rmtree(view_stage, ignore_errors=True)
        print("FAIL_CLOSED: source security evidence was not published", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
