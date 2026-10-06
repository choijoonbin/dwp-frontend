#!/usr/bin/env python3
"""Independent validator for an explicit HRIS modern physical candidate.

Unlike the legacy validator, this tool has no hard-coded live canonical path or
106-table oracle.  It pins the caller-supplied canonical bytes, independently
derives the explicitly selected 132-table historical or 131-table successor
service/schema inventory, verifies sealed JSON contracts,
and can execute the five owner-local DDL units in disposable PostgreSQL 16/18.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any


HISTORICAL_CANONICAL_FILES = (
    "modern-capability-closed-set-manifest.v3.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-causal-state-contracts.v2.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-semantic-bindings.v1.json",
)
SUCCESSOR_CANONICAL_FILES = (
    "modern-capability-closed-set-manifest.v3.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-semantic-bindings.v1.json",
    "sys-listening-stream-authority-successor.v2.json",
)
# v4 remains a sealed seven-file regression profile.  New successor physical
# candidates must carry the causal publication as an eighth source of truth.
V5_SUCCESSOR_CANONICAL_FILES = (
    "modern-capability-closed-set-manifest.v3.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-causal-state-contracts.v2.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-semantic-bindings.v1.json",
    "sys-listening-stream-authority-successor.v2.json",
)
CANONICAL_FILES = HISTORICAL_CANONICAL_FILES
MANIFEST_NAME = CANONICAL_FILES[0]
OPERATION_NAME = CANONICAL_FILES[1]
EXACT_NAME = "modern-capability-exact-schema-contracts.v1.json"
LISTENING_AUTHORITY_NAME = "sys-listening-stream-authority-successor.v2.json"
CAUSAL_STATE_NAME = "modern-capability-causal-state-contracts.v2.json"
CAUSAL_CANONICAL_SOURCE_PIN_NAMES = (
    OPERATION_NAME,
    EXACT_NAME,
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-semantic-bindings.v1.json",
)
REMOVED_LISTENING_TABLE = "sys_hris_listening_export_receipts"
GLOBAL_OWNER_DEPENDENCY_IDS = frozenset({
    "configuration.resolveSignedParticipationOfferForEntitledSubject.v1",
    "compensation.resolveApprovedSnapshotForPayroll.v1",
})

SQL_FILES = {
    "hrm-modern-forward-ddl.v4.sql": ("dwp-people", "dwp-people-server"),
    "per-modern-forward-ddl.v4.sql": ("dwp-people", "dwp-people-server"),
    "tim-modern-forward-ddl.v4.sql": ("dwp-time", "dwp-time-server"),
    "sys-platform-modern-forward-ddl.v4.sql": ("dwp-platform", "dwp-platform-server"),
    "sys-auth-modern-forward-ddl.v4.sql": ("dwp-auth", "dwp-auth-server"),
}
SQL_ROLES = {
    "hrm-modern-forward-ddl.v4.sql": ("dwp_people_migration", "dwp_people_runtime"),
    "per-modern-forward-ddl.v4.sql": ("dwp_people_migration", "dwp_people_runtime"),
    "tim-modern-forward-ddl.v4.sql": ("dwp_time_migration", "dwp_time_runtime"),
    "sys-platform-modern-forward-ddl.v4.sql": ("dwp_platform_migration", "dwp_platform_runtime"),
    "sys-auth-modern-forward-ddl.v4.sql": ("dwp_auth_migration", "dwp_auth_runtime"),
}
HANDLER_FILE = "modern-owner-handler-physical-contracts.v4.json"
QUERY_FILE = "modern-query-projection-physical-contracts.v4.json"
REPORT_FILE = "physical-candidate-generation-report.v4.json"
EXPECTED_FILES = frozenset((*SQL_FILES, HANDLER_FILE, QUERY_FILE, REPORT_FILE))

SCOPE_PROFILES: dict[str, dict[str, Any]] = {
    "v3-132-historical": {
        "canonicalFiles": HISTORICAL_CANONICAL_FILES,
        "manifestPinnedFiles": tuple(
            name for name in HISTORICAL_CANONICAL_FILES if name != MANIFEST_NAME
        ),
        "requiredSelfSeals": frozenset({
            MANIFEST_NAME,
            "modern-capability-causal-state-contracts.v2.json",
            "modern-capability-public-identity-registry.v1.json",
            "modern-capability-semantic-bindings.v1.json",
        }),
        "counts": {
            "operations": 199,
            "commands": 133,
            "queries": 66,
            "handlers": 25,
            "events": 155,
            "tables": 132,
        },
        "policyFilename": "global-hcm-table-expansion-acceptance-policy.v3.json",
        "policyId": "DWP-HRIS-GLOBAL-HCM-NONREPLACEABLE-TABLE-EXPANSION-V3",
        "policySchemaVersion": 3,
        "policySha256": "02fe8f0e5aebf06bc2c8b3cbe09f0947138310f6c921056c8be2f43d222cbd57",
        "policySeal": "8041c142ac96be31a4e4bd67a088bda1075147ec8111b388d572d3f35259d78a",
        "removedTables": frozenset(),
        "netDelta": 17,
        "listeningTables": 24,
        "ownerPorts": 18,
        "manifestPolicyPinRequired": False,
    },
    "v4-131-successor": {
        "canonicalFiles": SUCCESSOR_CANONICAL_FILES,
        "manifestPinnedFiles": tuple(
            name
            for name in SUCCESSOR_CANONICAL_FILES
            if name not in {MANIFEST_NAME, LISTENING_AUTHORITY_NAME}
        ),
        "requiredSelfSeals": frozenset({
            MANIFEST_NAME,
            "modern-capability-public-identity-registry.v1.json",
            "modern-capability-semantic-bindings.v1.json",
            LISTENING_AUTHORITY_NAME,
        }),
        "counts": {
            "operations": 199,
            "commands": 133,
            "queries": 66,
            "handlers": 27,
            "events": 157,
            "tables": 131,
        },
        "policyFilename": "global-hcm-table-expansion-acceptance-policy.v4.json",
        "policyId": "DWP-HRIS-GLOBAL-HCM-NONREPLACEABLE-TABLE-EXPANSION-V4",
        "policySchemaVersion": 4,
        "policySha256": "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de",
        "policySeal": "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63",
        "removedTables": frozenset({REMOVED_LISTENING_TABLE}),
        "netDelta": 16,
        "listeningTables": 23,
        "ownerPorts": 18,
        "manifestPolicyPinRequired": True,
        "manifestAcceptancePolicyPin": {
            "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v4.json",
            "fileSha256": "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de",
            "sealedPayloadSha256": "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63",
            "predecessorPolicySha256": "02fe8f0e5aebf06bc2c8b3cbe09f0947138310f6c921056c8be2f43d222cbd57",
            "predecessorPolicySealedPayloadSha256": "8041c142ac96be31a4e4bd67a088bda1075147ec8111b388d572d3f35259d78a",
            "independentReviewSha256": "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075",
            "scopeReductionReviewSha256": "99e96abe87d7141f3d7ff6a0185db5f1820a8385e700d34d0df3b8e11a322604",
        },
    },
    "v5-131-successor": {
        "canonicalFiles": V5_SUCCESSOR_CANONICAL_FILES,
        "manifestPinnedFiles": tuple(
            name
            for name in V5_SUCCESSOR_CANONICAL_FILES
            if name not in {MANIFEST_NAME, LISTENING_AUTHORITY_NAME}
        ),
        "requiredSelfSeals": frozenset({
            MANIFEST_NAME,
            CAUSAL_STATE_NAME,
            "modern-capability-public-identity-registry.v1.json",
            "modern-capability-semantic-bindings.v1.json",
            LISTENING_AUTHORITY_NAME,
        }),
        "causalPublicationClosureRequired": True,
        "counts": {
            "operations": 199,
            "commands": 133,
            "queries": 66,
            "handlers": 27,
            "events": 157,
            "tables": 131,
        },
        "policyFilename": "global-hcm-table-expansion-acceptance-policy.v5.json",
        "policyId": "DWP-HRIS-GLOBAL-HCM-NONREPLACEABLE-TABLE-EXPANSION-V5",
        "policySchemaVersion": 5,
        "policySha256": "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b",
        "policySeal": "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2",
        "removedTables": frozenset({REMOVED_LISTENING_TABLE}),
        "netDelta": 16,
        "listeningTables": 23,
        "ownerPorts": 18,
        "manifestPolicyPinRequired": True,
        "manifestAcceptancePolicyPin": {
            "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json",
            "fileSha256": "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b",
            "sealedPayloadSha256": "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2",
            "predecessorPolicySha256": "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de",
            "predecessorPolicySealedPayloadSha256": "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63",
            "independentReviewSha256": "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075",
            "scopeReductionReviewSha256": "99e96abe87d7141f3d7ff6a0185db5f1820a8385e700d34d0df3b8e11a322604",
        },
    },
}

SCOPE_PROFILES["v6-131-owner-dependency-successor"] = copy.deepcopy(
    SCOPE_PROFILES["v5-131-successor"]
)
SCOPE_PROFILES["v6-131-owner-dependency-successor"].update({
    "ownerDependencies": 2,
    "predecessorScopeProfile": "v5-131-successor",
})

SUPPORTED_TEMPORAL_ARBITRATION = "APPEND_ONLY_PREDECESSOR_CHAIN"
TEMPORAL_ARBITRATION_REQUIRED = {
    "strategy": SUPPORTED_TEMPORAL_ARBITRATION,
    "rawHistoryExclusion": "NONE",
    "rootCasRequired": True,
    "predecessorMutation": "FORBIDDEN",
    "correctionRule": "SAME_INTERVAL_APPEND_NEW_REVISION_NO_PREDECESSOR_MUTATION",
    "futureSupersedeRule": (
        "PREDECESSOR_WINS_BEFORE_NEW_EFFECTIVE_FROM;NEW_REVISION_WINS_AT_OR_AFTER"
    ),
    "businessAsOfWinner": "HIGHEST_CHAIN_REVISION_EFFECTIVE_AT_ASOF",
    "systemAsOfRule": "recorded_at<=systemAsOf",
    "concurrentSameExpectedVersion": "EXACTLY_ONE_SUCCESS",
}

STREAM_OWNER = {
    "platform-hris-configuration": ("dwp-platform-server", "hris_configuration", "HRIS-SYS-PLATFORM"),
    "platform-hris-listening-protected": ("dwp-platform-server", "hris_listening_protected", "HRIS-SYS-PLATFORM"),
    "platform-hris-insights": ("dwp-platform-server", "hris_insights", "HRIS-SYS-PLATFORM"),
    "auth-hris-participation-issuer": ("dwp-auth-server", "hris_participation_issuer", "HRIS-SYS-AUTH"),
}

SESSION_OWNER_BINDING = {
    "HRIS-HRM": "PFX-HRM-PEOPLE",
    "HRIS-PER": "PFX-PER-PERFORMANCE",
    "HRIS-TIM": "PFX-TIM-TIME",
}
SESSION_PREFIX = {
    "HRIS-HRM": "ppl_",
    "HRIS-PER": "prf_",
    "HRIS-TIM": "tme_",
    "HRIS-SYS": "sys_",
}
LISTENING_OWNER_BINDING = {
    "platform-hris-configuration": "PFX-SYS-LISTEN-CONFIGURATION",
    "platform-hris-listening-protected": "PFX-SYS-LISTEN-PROTECTED",
    "platform-hris-insights": "PFX-SYS-LISTEN-INSIGHTS",
    "auth-hris-participation-issuer": "PFX-SYS-LISTEN-ISSUER",
}

COMMON_COLUMN_PHYSICAL_SHAPE = [
    ("tenant_id", "BIGINT", False, None),
    ("__internal_id__", "BIGINT", False, "IDENTITY"),
    ("public_id", "UUID", False, "gen_random_uuid()"),
    ("aggregate_version", "BIGINT", False, "0"),
    ("created_at", "TIMESTAMPTZ", False, "CURRENT_TIMESTAMP"),
    ("created_by", "UUID", False, None),
    ("updated_at", "TIMESTAMPTZ", True, None),
    ("updated_by", "UUID", True, None),
    ("correlation_id", "UUID", False, None),
]

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?P<schema>[a-z][a-z0-9_]*)\.(?P<table>[a-z][a-z0-9_]*)\s*\((?P<body>.*?)\n\);",
    re.I | re.S,
)
RANGE_EXPR_RE = re.compile(
    r"^(?P<function>daterange|tstzrange)\("
    r"(?P<start>[a-z][a-z0-9_]*),(?P<end>[a-z][a-z0-9_]*),'\[\)'\)$"
)
SQL_TYPE_RE = re.compile(
    r"^(?:BIGINT|INTEGER|BOOLEAN|BYTEA|DATE|TIMESTAMPTZ|UUID|JSONB|TEXT|"
    r"CHAR\([1-9][0-9]*\)|VARCHAR\([1-9][0-9]*\)|NUMERIC\([1-9][0-9]*,[0-9]+\))$"
)
IDENT_RE = re.compile(r"^[a-z][a-z0-9_]*$")
DIRECT_PHYSICAL_SOURCE_RE = re.compile(
    r"^(?:(?:LOCKED_PRE|STATE_WINNER|CONTENT_WINNER):)?"
    r"(?P<table>[a-z][a-z0-9_]*)\.(?P<column>[a-z][a-z0-9_]*)$"
)
EMPTY_JSONB_ARRAY_CAST = "'[]'::jsonb"

_UNSAFE_SQL_KEYWORDS = frozenset({
    "ALTER", "CALL", "COPY", "CREATE", "DELETE", "DO", "DROP", "EXECUTE",
    "FROM", "GRANT", "INSERT", "JOIN", "MERGE", "PROGRAM", "RESET", "REVOKE",
    "SELECT", "SET", "SHOW", "TRUNCATE", "UNION", "UPDATE", "WITH",
})
_DEFAULT_RE = re.compile(
    r"^(?:IDENTITY|-?[0-9]+|TRUE|FALSE|CURRENT_TIMESTAMP|gen_random_uuid\(\)|"
    r"repeat\('[0-9A-Za-z_-]*',\s*[1-9][0-9]*\)|'[A-Z0-9_:-]+')$"
)


def absolute_lexical(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def secure_directory(path: Path) -> Path:
    path = absolute_lexical(path)
    fd = open_directory_nofollow(path)
    os.close(fd)
    return path


def open_directory_nofollow(path: Path) -> int:
    path = absolute_lexical(path)
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_DIRECTORY", 0)
    fd = os.open(os.sep, flags)
    try:
        for component in path.parts[1:]:
            next_fd = os.open(
                component,
                flags | getattr(os, "O_NOFOLLOW", 0),
                dir_fd=fd,
            )
            os.close(fd)
            fd = next_fd
        if not stat.S_ISDIR(os.fstat(fd).st_mode):
            raise ValueError(f"not a directory: {path}")
        return fd
    except Exception:
        os.close(fd)
        raise


def assert_directory_binding(path: Path, opened_fd: int) -> None:
    current_fd = open_directory_nofollow(path)
    try:
        opened = os.fstat(opened_fd)
        current = os.fstat(current_fd)
        if (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
            raise ValueError(f"directory changed while being read: {path}")
    finally:
        os.close(current_fd)


def read_regular_nofollow(path: Path) -> bytes:
    path = absolute_lexical(path)
    parent_fd = open_directory_nofollow(path.parent)
    try:
        raw = read_regular_at(parent_fd, path.name)
        assert_directory_binding(path.parent, parent_fd)
        return raw
    finally:
        os.close(parent_fd)


def read_regular_at(parent_fd: int, name: str) -> bytes:
    if Path(name).name != name or name in {"", ".", ".."}:
        raise ValueError(f"unsafe file basename: {name!r}")
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(name, flags, dir_fd=parent_fd)
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode):
            raise ValueError(f"input is not a regular file: {name}")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if stat.S_ISLNK(current.st_mode) or (current.st_dev, current.st_ino) != (
            opened.st_dev,
            opened.st_ino,
        ):
            raise ValueError(f"input changed while being read: {name}")
        return b"".join(chunks)
    finally:
        os.close(fd)


def write_json_exclusive(path: Path, value: dict[str, Any]) -> None:
    path = absolute_lexical(path)
    parent = secure_directory(path.parent)
    raw = (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    parent_fd = open_directory_nofollow(parent)
    try:
        fd = os.open(
            path.name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o644,
            dir_fd=parent_fd,
        )
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical_payload(value: dict[str, Any]) -> bytes:
    payload = {key: val for key, val in value.items() if key != "sealedPayloadSha256"}
    return json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def self_sealed(value: dict[str, Any]) -> bool:
    declared = value.get("sealedPayloadSha256")
    return isinstance(declared, str) and sha256(canonical_payload(value)) == declared


def sealed_copy(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256(canonical_payload(result))
    return result


def pretty_json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def physical_identifier(source: str) -> str:
    if len(source.encode("utf-8")) <= 63:
        return source
    return f"{source[:52]}_{sha256(source.encode('utf-8'))[:10]}"


def expected_owner(table: dict[str, Any]) -> tuple[str, str, str]:
    session = table.get("session")
    if session == "HRIS-HRM":
        return "dwp-people-server", "public", "HRIS-HRM"
    if session == "HRIS-PER":
        return "dwp-people-server", "hris_performance", "HRIS-PER"
    if session == "HRIS-TIM":
        return "dwp-time-server", "public", "HRIS-TIM"
    if session != "HRIS-SYS":
        raise ValueError(f"unsupported session {session}")
    capability = table.get("capabilityId")
    if capability == "HRIS.MODERN.GOVERNED_AI":
        return "dwp-platform-server", "hris_configuration", "HRIS-SYS-PLATFORM"
    if capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
        return "dwp-platform-server", "hris_insights", "HRIS-SYS-PLATFORM"
    if capability == "HRIS.MODERN.EMPLOYEE_LISTENING" and table.get("streamKey") in STREAM_OWNER:
        return STREAM_OWNER[table["streamKey"]]
    raise ValueError(f"unmapped SYS owner {table.get('tableName')} {capability}")


def expected_owner_binding(table: dict[str, Any]) -> str:
    session = table.get("session")
    if session in SESSION_OWNER_BINDING:
        return SESSION_OWNER_BINDING[session]
    capability = table.get("capabilityId")
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.GOVERNED_AI":
        return "PFX-SYS-CONFIGURATION"
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
        return "PFX-SYS-INSIGHTS"
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.EMPLOYEE_LISTENING":
        stream = table.get("streamKey")
        if stream in LISTENING_OWNER_BINDING:
            return LISTENING_OWNER_BINDING[stream]
    raise ValueError(
        f"unmapped owner binding {table.get('tableName')} "
        f"{session}/{capability}/{table.get('streamKey')}"
    )


def expected_bounded_context(table: dict[str, Any]) -> str:
    session = table.get("session")
    if session == "HRIS-HRM":
        return "PEOPLE_CORE"
    if session == "HRIS-PER":
        return "PERFORMANCE"
    if session == "HRIS-TIM":
        return "TIME"
    capability = table.get("capabilityId")
    if capability == "HRIS.MODERN.GOVERNED_AI":
        return "HRIS_CONFIGURATION"
    if capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
        return "HRIS_INSIGHTS"
    stream = table.get("streamKey")
    return {
        "platform-hris-configuration": "DWP_PLATFORM_HRIS_CONFIGURATION",
        "platform-hris-listening-protected": "DWP_PLATFORM_HRIS_LISTENING_PROTECTED",
        "platform-hris-insights": "DWP_PLATFORM_HRIS_INSIGHTS",
        "auth-hris-participation-issuer": "DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
    }.get(stream, "")


def expected_owner_dict(table: dict[str, Any]) -> dict[str, str]:
    service, schema, deployment = expected_owner(table)
    return {
        "ownerBindingId": expected_owner_binding(table),
        "deploymentKey": deployment,
        "service": service,
        "boundedContext": expected_bounded_context(table),
        "schema": schema,
    }


def expected_physical_ref(
    table_name: str, table_by_name: dict[str, dict[str, Any]]
) -> dict[str, str]:
    owner = expected_owner_dict(table_by_name[table_name])
    return {
        "tableId": table_name,
        "service": owner["service"],
        "boundedContext": owner["boundedContext"],
        "schema": owner["schema"],
        "qualifiedName": f"{owner['schema']}.{table_name}",
        "deploymentKey": owner["deploymentKey"],
    }


def expected_access_plan(
    table_names: Any,
    home_owner: dict[str, str] | None,
    table_by_name: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    home_unit = (
        (home_owner.get("service"), home_owner.get("schema")) if home_owner else None
    )
    for table_name in sorted(set(table_names)):
        reference = expected_physical_ref(table_name, table_by_name)
        local = home_unit == (reference["service"], reference["schema"])
        result.append({
            **reference,
            "accessMode": "OWNER_LOCAL_SQL" if local else "TYPED_OWNER_PORT_NO_CROSS_SCHEMA_SQL",
            "tenantPurposeVersionAsOfRequired": not local,
        })
    return result


def expected_home_owner(
    binding: dict[str, Any],
    causal: dict[str, Any],
    table_by_name: dict[str, dict[str, Any]],
) -> dict[str, str] | None:
    candidates = list(binding.get("writesTables", []))
    root = (causal.get("aggregateRoot") or {}).get("table")
    if root:
        candidates.append(root)
    if not candidates:
        entity = ((binding.get("responseProjection") or {}).get("entity") or "")
        if isinstance(entity, str) and entity.startswith("table:"):
            candidates.append(entity.removeprefix("table:"))
        candidates.extend(binding.get("readsTables", []))
    for table_name in candidates:
        if table_name in table_by_name:
            return expected_owner_dict(table_by_name[table_name])
    return None


def expected_sql_file(owner: tuple[str, str, str]) -> str:
    deployment = owner[2]
    return {
        "HRIS-HRM": "hrm-modern-forward-ddl.v4.sql",
        "HRIS-PER": "per-modern-forward-ddl.v4.sql",
        "HRIS-TIM": "tim-modern-forward-ddl.v4.sql",
        "HRIS-SYS-PLATFORM": "sys-platform-modern-forward-ddl.v4.sql",
        "HRIS-SYS-AUTH": "sys-auth-modern-forward-ddl.v4.sql",
    }[deployment]


def common_columns(table: dict[str, Any], common: dict[str, Any]) -> list[str]:
    names = []
    for column in common.get("columns", []):
        names.append(table["idColumn"]["name"] if column.get("name") == "__internal_id__" else column["name"])
    names.extend(column["name"] for column in table.get("columns", []))
    return names


def columns_by_name(
    table: dict[str, Any], common: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for column in common.get("columns", []):
        materialized = table["idColumn"] if column.get("name") == "__internal_id__" else column
        result[materialized["name"]] = materialized
    for column in table.get("columns", []):
        result[column["name"]] = column
    return result


def load_owner_register(path: Path) -> tuple[dict[str, dict[str, str]], bytes]:
    raw = read_regular_nofollow(path)
    reader = csv.DictReader(raw.decode("utf-8").splitlines())
    required = {
        "binding_id",
        "session",
        "owner_service",
        "bounded_context",
        "database_schema",
        "allowed_prefixes",
        "table_source_scope",
        "cross_boundary_rule",
        "status",
    }
    if reader.fieldnames is None or not required.issubset(reader.fieldnames):
        raise ValueError("owner register required columns are missing")
    rows = list(reader)
    ids = [row.get("binding_id", "") for row in rows]
    if any(not value for value in ids) or len(ids) != len(set(ids)):
        raise ValueError("owner register binding_id values must be non-empty and unique")
    return {row["binding_id"]: row for row in rows}, raw


def table_matches_allowed_prefix(table_name: str, declaration: str) -> bool:
    return any(table_name.startswith(token) for token in declaration.split("|") if token)


def expected_unique_column_sets(table: dict[str, Any]) -> set[tuple[str, ...]]:
    id_column = table["idColumn"]["name"]
    result = {
        (id_column,),
        ("tenant_id", "public_id"),
        ("tenant_id", id_column),
    }
    result.update(tuple(row.get("columns", [])) for row in table.get("uniqueKeys", []))
    return result


def sql_fragment_is_safe(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    if any(token in value for token in (";", "--", "/*", "*/", "\x00", "\n", "\r", '"', ".")):
        return False
    normalized = value.replace(EMPTY_JSONB_ARRAY_CAST, "'__EMPTY_JSONB_ARRAY__'")
    if "::" in normalized:
        return False
    without_literals = re.sub(r"'(?:''|[^'])*'", "''", normalized)
    if "'" in re.sub(r"''", "", without_literals):
        return False
    if not re.fullmatch(r"[A-Za-z0-9_\s(),'=<>~+-]+", without_literals):
        return False
    words = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", without_literals)
    if any(word.upper() in _UNSAFE_SQL_KEYWORDS for word in words):
        return False
    for function_name in re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(", without_literals):
        if function_name.upper() not in {"IN", "AND", "OR", "NOT"}:
            return False
    return True


def sql_default_is_safe(value: Any) -> bool:
    return isinstance(value, str) and _DEFAULT_RE.fullmatch(value.strip()) is not None


def direct_physical_lineage_bindings(
    lineage: list[dict[str, Any]],
    table_name: str,
    columns: set[str],
) -> list[tuple[str, str]]:
    """Count only anchored durable response selectors for a table.

    Derived paths, arbitrary qualifiers and duplicate target/column bindings
    cannot satisfy the expansion-reader minimum.
    """
    result: list[tuple[str, str]] = []
    seen_targets: set[str] = set()
    seen_columns: set[str] = set()
    for item in lineage:
        if item.get("sourceKind") != "PHYSICAL_POST_STATE":
            continue
        match = DIRECT_PHYSICAL_SOURCE_RE.fullmatch(str(item.get("sourcePath", "")))
        if match is None or match.group("table") != table_name:
            continue
        target = item.get("target")
        column = match.group("column")
        if not isinstance(target, str) or not target or column not in columns:
            continue
        if target in seen_targets or column in seen_columns:
            continue
        seen_targets.add(target)
        seen_columns.add(column)
        result.append((target, column))
    return result


def validate_revision_temporal_arbitration(
    table: dict[str, Any],
    common: dict[str, Any],
    causal_operations: list[dict[str, Any]],
    tables_by_id: dict[str, dict[str, Any]],
    errors: list[dict[str, Any]],
) -> None:
    """Independently prove the supported correction/supersession strategy."""
    revision_exclusions = [
        row
        for row in table.get("temporalExclusionConstraints", [])
        if row.get("revisionSemantics")
    ]
    if not revision_exclusions:
        return
    table_name = table["tableName"]
    subject = f"{table_name}.temporalArbitration"
    declared_arbitration = table.get("temporalArbitration")
    has_arbitration = isinstance(declared_arbitration, dict)
    arbitration = declared_arbitration if has_arbitration else {}
    if not has_arbitration:
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_ARBITRATION_MISSING",
            subject,
            required=TEMPORAL_ARBITRATION_REQUIRED,
        )
    else:
        for key, expected in TEMPORAL_ARBITRATION_REQUIRED.items():
            if arbitration.get(key) != expected:
                add(
                    errors,
                    "SOURCE_REVISION_TEMPORAL_ARBITRATION_DRIFT",
                    f"{subject}.{key}",
                    expected=expected,
                    actual=arbitration.get(key),
                )

    names = set(common_columns(table, common))
    parent_columns = arbitration.get("parentColumns")
    if has_arbitration and (
        not isinstance(parent_columns, list)
        or not parent_columns
        or any(not isinstance(value, str) for value in parent_columns)
        or "tenant_id" not in parent_columns
        or not set(parent_columns).issubset(names)
    ):
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_PARENT_COLUMNS_INVALID",
            subject,
            actual=parent_columns,
        )
    for key in (
        "revisionColumn",
        "predecessorColumn",
        "revisionModeColumn",
        "effectiveFromColumn",
        "effectiveToColumn",
        "recordedAtColumn",
    ):
        column = arbitration.get(key)
        if has_arbitration and (not isinstance(column, str) or column not in names):
            add(
                errors,
                "SOURCE_REVISION_TEMPORAL_COLUMN_INVALID",
                f"{subject}.{key}",
                actual=column,
            )
    if has_arbitration and arbitration.get("recordedAtColumn") != "created_at":
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_SYSTEM_TIME_NOT_IMMUTABLE",
            f"{subject}.recordedAtColumn",
            required="created_at",
            actual=arbitration.get("recordedAtColumn"),
        )
    root_table = arbitration.get("rootTable")
    root_version = arbitration.get("rootVersionColumn")
    if has_arbitration and root_table not in tables_by_id:
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_ROOT_TABLE_INVALID",
            subject,
            actual=root_table,
        )
    elif has_arbitration and root_version not in set(common_columns(tables_by_id[root_table], common)):
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_ROOT_VERSION_INVALID",
            subject,
            rootTable=root_table,
            actual=root_version,
        )
    for exclusion in revision_exclusions:
        if has_arbitration and str(exclusion.get("predicate", "")).strip():
            add(
                errors,
                "SOURCE_REVISION_RAW_EXCLUSION_CONTRADICTS_ARBITRATION",
                f"{table_name}.{exclusion.get('constraintId')}",
            )

    revision_semantics = ";".join(
        str(item.get("revisionSemantics", "")) for item in revision_exclusions
    )
    if "CORRECTION" in revision_semantics:
        required_columns = {
            "revision_mode",
            "predecessor_revision",
            "correction_reason_code",
            "changed_fields",
        }
        missing = required_columns - names
        if missing:
            add(
                errors,
                "SOURCE_REVISION_TEMPORAL_CORRECTION_COLUMNS_MISSING",
                table_name,
                missing=sorted(missing),
            )
    range_source = revision_exclusions[0].get("range", "")
    range_columns: list[str] = []
    if isinstance(range_source, str) and range_source.startswith("[") and range_source.endswith(")"):
        range_columns = [part.strip() for part in range_source[1:-1].split(",", 1)]
    range_start = range_columns[0] if len(range_columns) == 2 else None
    range_end = range_columns[1] if len(range_columns) == 2 else None
    column_map = columns_by_name(table, common)
    if range_start in column_map and column_map[range_start].get("nullable") is not False:
        add(
            errors,
            "SOURCE_REVISION_TEMPORAL_EFFECTIVE_START_NULLABLE",
            f"{table_name}.{range_start}",
        )
    for operation in causal_operations:
        for step in operation.get("orderedDml", []):
            if step.get("table") != table_name or step.get("action") not in {"INSERT", "APPEND"}:
                continue
            assignments = step.get("assignments") or {}
            missing_effective = {
                column for column in (range_start, range_end)
                if isinstance(column, str) and column not in assignments
            }
            if missing_effective:
                add(
                    errors,
                    "SOURCE_REVISION_TEMPORAL_INSERT_EFFECTIVE_ASSIGNMENT_MISSING",
                    str(operation.get("operationId")),
                    table=table_name,
                    missing=sorted(missing_effective),
                )

    revise_operations = []
    for operation in causal_operations:
        steps = [
            step for step in operation.get("orderedDml", [])
            if step.get("table") == table_name
        ]
        if (
            any(step.get("action") == "APPEND" for step in steps)
            and operation.get("operationId", "").endswith(".revise")
        ):
            revise_operations.append((operation, steps))
    if not revise_operations:
        add(errors, "SOURCE_REVISION_TEMPORAL_REVISE_COMMAND_MISSING", table_name)
    for operation, history_steps in revise_operations:
        operation_id = operation.get("operationId")
        append_steps = [step for step in history_steps if step.get("action") == "APPEND"]
        prior_mutations = [
            step for step in history_steps
            if step.get("action") in {"UPDATE", "UPDATE_CAS", "DELETE", "UPSERT"}
        ]
        if len(append_steps) != 1 or prior_mutations:
            add(
                errors,
                "SOURCE_REVISION_TEMPORAL_APPEND_ONLY_DML_VIOLATION",
                str(operation_id),
                historyActions=[step.get("action") for step in history_steps],
            )
        append_step_no = append_steps[0].get("step") if len(append_steps) == 1 else None
        all_preceding_root_cas = [
            step for step in operation.get("orderedDml", [])
            if step.get("action") == "UPDATE_CAS"
            and step.get("table") != table_name
            and (
                not isinstance(append_step_no, int)
                or not isinstance(step.get("step"), int)
                or step.get("step") < append_step_no
            )
        ]
        root_cas = (
            [step for step in all_preceding_root_cas if step.get("table") == root_table]
            if has_arbitration
            else all_preceding_root_cas
        )
        if len(root_cas) != 1:
            add(
                errors,
                "SOURCE_REVISION_TEMPORAL_ROOT_CAS_MISSING",
                str(operation_id),
                expectedRootTable=root_table,
                actualRootCasTables=[
                    step.get("table")
                    for step in operation.get("orderedDml", [])
                    if step.get("action") == "UPDATE_CAS"
                ],
            )
        elif (operation.get("aggregateRoot") or {}).get("table") != root_cas[0].get("table"):
            add(
                errors,
                "SOURCE_REVISION_TEMPORAL_CONCURRENCY_ROOT_AGGREGATE_DRIFT",
                str(operation_id),
                aggregateRoot=(operation.get("aggregateRoot") or {}).get("table"),
                actualCasRoot=root_cas[0].get("table"),
            )
        assignments = append_steps[0].get("assignments", {}) if append_steps else {}
        assignment_columns = (
            (
                arbitration.get("revisionColumn"),
                arbitration.get("predecessorColumn"),
                arbitration.get("revisionModeColumn"),
                arbitration.get("effectiveFromColumn"),
                arbitration.get("effectiveToColumn"),
            )
            if has_arbitration
            else tuple(
                column
                for column in (
                    "predecessor_revision",
                    "revision_mode",
                    range_start,
                    range_end,
                )
                if column in names
            )
        )
        for key in assignment_columns:
            if isinstance(key, str) and key not in assignments:
                add(
                    errors,
                    "SOURCE_REVISION_TEMPORAL_APPEND_ASSIGNMENT_MISSING",
                    f"{operation_id}:{key}",
                )


def materialize_temporal_exclusion(table: dict[str, Any], item: dict[str, Any]) -> bool:
    if not item.get("revisionSemantics"):
        return True
    arbitration = table.get("temporalArbitration") or {}
    return not (
        arbitration.get("strategy") == SUPPORTED_TEMPORAL_ARBITRATION
        and arbitration.get("rawHistoryExclusion") == "NONE"
    )


def validate_temporal_exclusion_shape(
    table: dict[str, Any], common: dict[str, Any], errors: list[dict[str, Any]]
) -> None:
    table_name = table["tableName"]
    columns = columns_by_name(table, common)
    for item in table.get("temporalExclusionConstraints", []):
        subject = f"{table_name}.{item.get('constraintId')}"
        if not IDENT_RE.fullmatch(str(item.get("constraintId", ""))):
            add(errors, "SOURCE_TEMPORAL_CONSTRAINT_ID_UNSAFE", subject)
        partitions = item.get("partitionColumns")
        if (
            not isinstance(partitions, list)
            or not partitions
            or any(column not in columns for column in partitions)
        ):
            add(
                errors,
                "SOURCE_TEMPORAL_PARTITION_COLUMNS_INVALID",
                subject,
                actual=partitions,
            )
        raw_range = item.get("range")
        start: str | None = None
        end: str | None = None
        declared_function: str | None = None
        if isinstance(raw_range, str) and raw_range.startswith("[") and raw_range.endswith(")"):
            parts = raw_range[1:-1].split(",")
            if len(parts) == 2:
                start, end = (part.strip() for part in parts)
        elif isinstance(raw_range, str):
            match = RANGE_EXPR_RE.fullmatch(raw_range)
            if match:
                start, end = match.group("start"), match.group("end")
                declared_function = match.group("function")
        if start not in columns or end not in columns:
            add(errors, "SOURCE_TEMPORAL_RANGE_INVALID", subject, actual=raw_range)
            continue
        start_type = columns[start].get("sqlType")
        end_type = columns[end].get("sqlType")
        expected_function = "daterange" if start_type == "DATE" else "tstzrange"
        if (
            start_type != end_type
            or start_type not in {"DATE", "TIMESTAMPTZ"}
            or (declared_function is not None and declared_function != expected_function)
        ):
            add(
                errors,
                "SOURCE_TEMPORAL_RANGE_TYPE_MISMATCH",
                subject,
                startType=start_type,
                endType=end_type,
                declaredFunction=declared_function,
            )
        if item.get("nullSemantics") != "NULL_END_IS_OPEN_ENDED_INFINITY":
            add(
                errors,
                "SOURCE_TEMPORAL_NULL_SEMANTICS_DRIFT",
                subject,
                actual=item.get("nullSemantics"),
            )
        if item.get("rule") != "NO_OVERLAP":
            add(errors, "SOURCE_TEMPORAL_RULE_DRIFT", subject, actual=item.get("rule"))
        if item.get("predicate") is not None and not sql_fragment_is_safe(item.get("predicate")):
            add(errors, "SOURCE_UNSAFE_TEMPORAL_PREDICATE", subject)


def validate_relation_namespace(
    tables_by_id: dict[str, dict[str, Any]],
    owner_by_table: dict[str, tuple[str, str, str]],
    errors: list[dict[str, Any]],
) -> None:
    relations: dict[tuple[str, str, str], list[str]] = {}

    def record(owner: tuple[str, str, str], name: str, source: str) -> None:
        key = (owner[0], owner[1], physical_identifier(name))
        relations.setdefault(key, []).append(source)

    for table_name, table in tables_by_id.items():
        owner = owner_by_table.get(table_name)
        if owner is None:
            continue
        record(owner, table_name, f"table:{table_name}")
        record(owner, f"pk_{table_name}_physical_v4", f"{table_name}:derived-pk")
        id_column = table["idColumn"]["name"]
        unique_rows = [
            (f"uk_{table_name}_tenant_public_physical_v4", ("tenant_id", "public_id")),
            (f"uk_{table_name}_tenant_internal_physical_v4", ("tenant_id", id_column)),
        ]
        seen = {columns for _name, columns in unique_rows}
        for item in table.get("uniqueKeys", []):
            columns = tuple(item.get("columns", []))
            if columns in seen:
                continue
            seen.add(columns)
            unique_rows.append((item["constraintId"], columns))
        for identifier, _columns in unique_rows:
            record(owner, identifier, f"{table_name}:{identifier}")
        for item in table.get("indexes", []):
            record(owner, item["indexId"], f"{table_name}:{item['indexId']}")
        for item in table.get("temporalExclusionConstraints", []):
            if materialize_temporal_exclusion(table, item):
                record(owner, item["constraintId"], f"{table_name}:{item['constraintId']}")
    for (service, schema, physical_name), sources in relations.items():
        if len(sources) > 1:
            add(
                errors,
                "SOURCE_PHYSICAL_RELATION_NAME_COLLISION",
                f"{service}:{schema}.{physical_name}",
                sources=sources,
            )


def parse_sql_tables(raw: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for match in CREATE_TABLE_RE.finditer(raw):
        table_name = match.group("table").lower()
        body = match.group("body")
        columns = []
        for line in body.splitlines():
            stripped = line.strip().rstrip(",")
            if not stripped or stripped.upper().startswith("CONSTRAINT "):
                continue
            token = stripped.split(None, 1)[0]
            if re.fullmatch(r"[a-z][a-z0-9_]*", token):
                columns.append(token)
        result[table_name] = {
            "schema": match.group("schema").lower(),
            "body": body,
            "columns": columns,
        }
    return result


def expected_render_column(column: dict[str, Any], *, identity: bool = False) -> str:
    result = f"    {column['name']} {column['sqlType']}"
    if identity or column.get("default") == "IDENTITY":
        result += " GENERATED BY DEFAULT AS IDENTITY"
    default = column.get("default")
    if default is not None and default != "IDENTITY":
        result += f" DEFAULT {default}"
    if not column.get("nullable", False):
        result += " NOT NULL"
    return result


def add(errors: list[dict[str, Any]], code: str, subject: str, **extra: Any) -> None:
    errors.append({"code": code, "subject": subject, **extra})


def validate_causal_publication_closure(
    canonical: dict[str, dict[str, Any]],
    canonical_raw: dict[str, bytes],
    errors: list[dict[str, Any]],
) -> None:
    """Require the causal self-sealed projection to pin this exact canonical five."""
    manifest = canonical.get(MANIFEST_NAME, {})
    causal = canonical.get(CAUSAL_STATE_NAME, {})
    reference = causal.get("closedSetManifest") or {}
    if reference.get("manifestId") != manifest.get("manifestId"):
        add(errors, "SOURCE_CAUSAL_MANIFEST_ID_PIN_MISMATCH", CAUSAL_STATE_NAME)
    if reference.get("sealedPayloadSha256") != manifest.get("sealedPayloadSha256"):
        add(errors, "SOURCE_CAUSAL_MANIFEST_SEAL_PIN_MISMATCH", CAUSAL_STATE_NAME)
    expected = {
        name: sha256(canonical_raw.get(name, b""))
        for name in CAUSAL_CANONICAL_SOURCE_PIN_NAMES
    }
    actual = causal.get("canonicalSourcePins")
    if not isinstance(actual, dict) or set(actual) != set(expected):
        add(
            errors,
            "SOURCE_CAUSAL_CANONICAL_SOURCE_PIN_SET_MISMATCH",
            CAUSAL_STATE_NAME,
            expected=sorted(expected),
            actual=sorted(actual) if isinstance(actual, dict) else actual,
        )
        return
    for name, expected_hash in expected.items():
        if actual.get(name) != expected_hash:
            add(
                errors,
                "SOURCE_CAUSAL_CANONICAL_SOURCE_PIN_HASH_MISMATCH",
                f"{CAUSAL_STATE_NAME}:{name}",
                expected=expected_hash,
                actual=actual.get(name),
            )


def validate_global_owner_dependency_closure(
    canonical: dict[str, dict[str, Any]],
    profile: dict[str, Any],
    errors: list[dict[str, Any]],
) -> None:
    expected_count = profile.get("ownerDependencies")
    if expected_count is None:
        return
    manifest = canonical.get(MANIFEST_NAME, {})
    operation = canonical.get(OPERATION_NAME, {})
    exact = canonical.get(EXACT_NAME, {})
    semantic = canonical.get(
        "modern-capability-semantic-bindings.v1.json", {}
    )
    rows = operation.get("ownerDependencyContracts", [])
    ids = [row.get("dependencyContractId") for row in rows]
    if (
        len(rows) != expected_count
        or len(ids) != len(set(ids))
        or set(ids) != GLOBAL_OWNER_DEPENDENCY_IDS
    ):
        add(
            errors, "SOURCE_GLOBAL_OWNER_DEPENDENCY_SET_MISMATCH",
            "operation.ownerDependencyContracts",
            expected=sorted(GLOBAL_OWNER_DEPENDENCY_IDS), actual=ids,
        )
    if (
        exact.get("ownerDependencyContracts") != rows
        or semantic.get("ownerDependencyContracts") != rows
    ):
        add(
            errors, "SOURCE_GLOBAL_OWNER_DEPENDENCY_PROJECTION_MISMATCH",
            "operation/exact/semantic.ownerDependencyContracts",
        )
    invalid_seals = [
        row.get("dependencyContractId") for row in rows
        if row.get("sealedPayloadSha256") != sha256(canonical_payload(row))
    ]
    if invalid_seals:
        add(
            errors, "SOURCE_GLOBAL_OWNER_DEPENDENCY_SEAL_MISMATCH",
            "operation.ownerDependencyContracts",
            dependencyContractIds=invalid_seals,
        )
    projected_pins = sorted(({
        "dependencyContractId": row.get("dependencyContractId"),
        "ownerSession": row.get("ownerSession"),
        "consumerSession": row.get("consumerSession"),
        "sealedPayloadSha256": row.get("sealedPayloadSha256"),
    } for row in rows), key=lambda row: str(row["dependencyContractId"]))
    if (
        manifest.get("scope", {}).get("ownerDependencyContracts")
        != expected_count
        or manifest.get("ownerDependencyContracts") != projected_pins
    ):
        add(
            errors, "SOURCE_GLOBAL_OWNER_DEPENDENCY_MANIFEST_PIN_MISMATCH",
            "closed-set-manifest.ownerDependencyContracts",
            expected=projected_pins,
            actual=manifest.get("ownerDependencyContracts"),
        )
    semantic_ids = [
        row.get("dependencyContractId")
        for row in semantic.get("ownerDependencySemanticBindings", [])
    ]
    if semantic_ids != ids:
        add(
            errors, "SOURCE_GLOBAL_OWNER_DEPENDENCY_SEMANTIC_IDENTITY_MISMATCH",
            "semantic.ownerDependencySemanticBindings",
        )
    listening_count = manifest.get("listeningStaticDesign", {}).get(
        "exactCounts", {}
    ).get("ownerDependencyContracts")
    authority_count = canonical.get(LISTENING_AUTHORITY_NAME, {}).get(
        "exactCounts", {}
    ).get("ownerDependencyContracts")
    if listening_count != 1 or authority_count != 1:
        add(
            errors, "SOURCE_LISTENING_LOCAL_OWNER_DEPENDENCY_COUNT_MISMATCH",
            "Listening.ownerDependencyContracts", expected=1,
            manifestActual=listening_count, authorityActual=authority_count,
        )


def _contains_exact_token(value: Any, token: str) -> bool:
    return re.search(
        rf"(?<![A-Za-z0-9_]){re.escape(token)}(?![A-Za-z0-9_])",
        json.dumps(value, ensure_ascii=False, sort_keys=True),
    ) is not None


def validate_scope_profile_authority(
    canonical: dict[str, dict[str, Any]],
    canonical_raw: dict[str, bytes],
    policy: dict[str, Any],
    policy_raw: bytes,
    policy_filename: str,
    profile_name: str,
    profile: dict[str, Any],
    errors: list[dict[str, Any]],
) -> None:
    actual_policy = {
        "filename": policy_filename,
        "policyId": policy.get("policyId"),
        "schemaVersion": policy.get("schemaVersion"),
        "sha256": sha256(policy_raw),
        "sealedPayloadSha256": policy.get("sealedPayloadSha256"),
    }
    expected_policy = {
        "filename": profile["policyFilename"],
        "policyId": profile["policyId"],
        "schemaVersion": profile["policySchemaVersion"],
        "sha256": profile["policySha256"],
        "sealedPayloadSha256": profile["policySeal"],
    }
    if actual_policy != expected_policy:
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_POLICY_IDENTITY_DRIFT",
            profile_name,
            expected=expected_policy,
            actual=actual_policy,
        )

    manifest = canonical.get(MANIFEST_NAME, {})
    scope = manifest.get("tableScopeChange") or {}
    successor = policy.get("successorScope") or {}
    expected_added = sorted(
        row.get("tableId") for row in successor.get("addedRows", [])
        if isinstance(row.get("tableId"), str)
    )
    actual_scope = {
        "previousTableSetSha256": scope.get("previousTableSetSha256"),
        "previousTableSpecifications": scope.get("previousTableSpecifications"),
        "activeTableSpecifications": scope.get("activeTableSpecifications"),
        "deltaCount": scope.get("deltaCount"),
        "netDelta": scope.get("netDelta", scope.get("deltaCount")),
        "addedTableIds": sorted(scope.get("addedTableIds", [])),
        "removedTableIds": sorted(scope.get("removedTableIds", [])),
    }
    expected_scope = {
        "previousTableSetSha256": policy.get("frozenBaseline", {}).get("tableSetSha256"),
        "previousTableSpecifications": 115,
        "activeTableSpecifications": profile["counts"]["tables"],
        "deltaCount": 17,
        "netDelta": profile["netDelta"],
        "addedTableIds": expected_added,
        "removedTableIds": sorted(profile["removedTables"]),
    }
    if profile_name != "v3-132-historical" and actual_scope != expected_scope:
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_MANIFEST_SCOPE_DRIFT",
            MANIFEST_NAME,
            expected=expected_scope,
            actual=actual_scope,
        )

    if not profile.get("manifestPolicyPinRequired"):
        return

    expected_pin = profile["manifestAcceptancePolicyPin"]
    if scope.get("acceptancePolicy") != expected_pin:
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_MANIFEST_POLICY_PIN_DRIFT",
            f"{MANIFEST_NAME}:tableScopeChange.acceptancePolicy",
            expected=expected_pin,
            actual=scope.get("acceptancePolicy"),
        )
    policy_rows = {
        row.get("tableId"): row for row in successor.get("addedRows", [])
    }
    if scope.get("rows") != policy_rows:
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_MANIFEST_POLICY_ROWS_DRIFT",
            f"{MANIFEST_NAME}:tableScopeChange.rows",
        )

    listening_counts = (manifest.get("listeningStaticDesign") or {}).get("exactCounts") or {}
    if (
        listening_counts.get("plannedTables") != profile["listeningTables"]
        or listening_counts.get("ownerPortOperations") != profile["ownerPorts"]
        or len(manifest.get("ownerPortOperationContracts", [])) != profile["ownerPorts"]
    ):
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_LISTENING_COUNT_DRIFT",
            f"{MANIFEST_NAME}:listeningStaticDesign",
        )

    authority = canonical.get(LISTENING_AUTHORITY_NAME, {})
    authority_counts = authority.get("exactCounts") or {}
    owner_ports = authority.get("ownerPortOperations", [])
    table_ownership = authority.get("tableOwnership", [])
    if (
        authority_counts.get("plannedTables") != profile["listeningTables"]
        or authority_counts.get("ownerPortOperations") != profile["ownerPorts"]
        or len(owner_ports) != profile["ownerPorts"]
        or len({row.get("ownerPortOperation") for row in owner_ports}) != profile["ownerPorts"]
        or len(table_ownership) != profile["listeningTables"]
    ):
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_LISTENING_AUTHORITY_COUNT_DRIFT",
            LISTENING_AUTHORITY_NAME,
        )
    authority_pin = (manifest.get("ownerBoundaryInputs") or {}).get("listeningStreamAuthority") or {}
    expected_authority_pin = {
        "contractId": authority.get("contractId"),
        "path": f"coding-readiness/{LISTENING_AUTHORITY_NAME}",
        "fileSha256": sha256(canonical_raw.get(LISTENING_AUTHORITY_NAME, b"")),
        "sealedPayloadSha256": authority.get("sealedPayloadSha256"),
    }
    if any(authority_pin.get(key) != value for key, value in expected_authority_pin.items()):
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_LISTENING_AUTHORITY_MANIFEST_PIN_DRIFT",
            f"{MANIFEST_NAME}:ownerBoundaryInputs.listeningStreamAuthority",
            expected=expected_authority_pin,
            actual=authority_pin,
        )

    removed = next(iter(profile["removedTables"]))
    sanitized = copy.deepcopy(canonical)
    sanitized_scope = sanitized.get(MANIFEST_NAME, {}).get("tableScopeChange", {})
    sanitized_scope.pop("removedTableIds", None)
    sanitized_scope.pop("removalDisposition", None)
    dangling_documents = sorted(
        name for name, value in sanitized.items()
        if _contains_exact_token(value, removed)
    )
    if removed in manifest.get("tableIds", []) or dangling_documents:
        add(
            errors,
            "SOURCE_SCOPE_PROFILE_REMOVED_TABLE_DANGLING_REFERENCE",
            removed,
            documents=dangling_documents,
        )


def validate_source_contracts(
    canonical: dict[str, dict[str, Any]],
    policy: dict[str, Any],
    owner_register: dict[str, dict[str, str]],
    errors: list[dict[str, Any]],
    canonical_raw: dict[str, bytes] | None = None,
    policy_raw: bytes = b"",
    policy_filename: str = "",
    profile_name: str = "v3-132-historical",
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    profile = profile or SCOPE_PROFILES[profile_name]
    manifest = canonical[MANIFEST_NAME]
    exact = canonical[EXACT_NAME]
    causal = canonical[OPERATION_NAME]
    for name in profile["requiredSelfSeals"]:
        value = canonical.get(name)
        if not isinstance(value, dict) or not self_sealed(value):
            add(errors, "SOURCE_SELF_SEAL_MISSING_OR_MISMATCH", name)
    if profile.get("causalPublicationClosureRequired"):
        validate_causal_publication_closure(canonical, canonical_raw or {}, errors)
    validate_global_owner_dependency_closure(canonical, profile, errors)
    manifest_hash = sha256((canonical_raw or {}).get(MANIFEST_NAME, b""))
    manifest_id = manifest.get("manifestId")
    manifest_seal = manifest.get("sealedPayloadSha256")
    for name in profile["manifestPinnedFiles"]:
        value = canonical.get(name, {})
        reference = value.get("closedSetManifest") or {}
        if reference.get("manifestId") != manifest_id:
            add(errors, "SOURCE_MANIFEST_ID_PIN_MISMATCH", name)
        if reference.get("sealedPayloadSha256") != manifest_seal:
            add(errors, "SOURCE_MANIFEST_SEAL_PIN_MISMATCH", name)
        if "fileSha256" in reference and reference.get("fileSha256") != manifest_hash:
            add(errors, "SOURCE_MANIFEST_FILE_PIN_MISMATCH", name)
        if "path" in reference and reference.get("path") != MANIFEST_NAME:
            add(errors, "SOURCE_MANIFEST_PATH_PIN_MISMATCH", name)
    operation_ids = [row.get("operationId") for row in manifest.get("operations", [])]
    handler_ids = manifest.get("handlerIds", [])
    table_ids = manifest.get("tableIds", [])
    event_ids = manifest.get("publicEventIds", [])
    counts = {
        "operations": len(operation_ids),
        "commands": sum(row.get("mode") == "COMMAND" for row in manifest.get("operations", [])),
        "queries": sum(row.get("mode") == "QUERY" for row in manifest.get("operations", [])),
        "handlers": len(handler_ids),
        "events": len(event_ids),
        "tables": len(table_ids),
    }
    expected_counts = profile["counts"]
    if counts != expected_counts:
        add(
            errors,
            "SOURCE_COUNT_MISMATCH",
            "canonical",
            expected=expected_counts,
            actual=counts,
        )
    declared_scope = manifest.get("scope") or {}
    declared_counts = {
        "operations": declared_scope.get("operations"),
        "commands": declared_scope.get("commands"),
        "queries": declared_scope.get("queries"),
        "handlers": declared_scope.get("handlers"),
        "events": declared_scope.get("publicEvents"),
        "tables": declared_scope.get("tableSpecifications"),
    }
    if declared_counts != counts:
        add(
            errors,
            "SOURCE_DECLARED_COUNT_SPOOF",
            "closed-set-manifest.scope",
            expected=counts,
            actual=declared_counts,
        )
    if profile_name != "v3-132-historical" and declared_scope.get(
        "ownerPortOperationContracts"
    ) != profile["ownerPorts"]:
        add(
            errors,
            "SOURCE_DECLARED_OWNER_PORT_COUNT_SPOOF",
            "closed-set-manifest.scope.ownerPortOperationContracts",
            expected=profile["ownerPorts"],
            actual=declared_scope.get("ownerPortOperationContracts"),
        )
    if any(len(values) != len(set(values)) for values in (operation_ids, handler_ids, table_ids, event_ids)):
        add(errors, "SOURCE_CLOSED_SET_NOT_UNIQUE", "canonical")

    specs = exact.get("tableSpecifications", [])
    spec_by_name = {row.get("tableName"): row for row in specs}
    if len(spec_by_name) != len(specs) or set(spec_by_name) != set(table_ids):
        add(errors, "SOURCE_TABLE_SPEC_SET_DRIFT", "exact.tableSpecifications")
    exact_handler_ids = [row.get("handlerId") for row in exact.get("internalConsumerHandlers", [])]
    causal_handler_ids = [row.get("handlerId") for row in causal.get("systemHandlers", [])]
    if (
        set(exact_handler_ids) != set(handler_ids)
        or set(causal_handler_ids) != set(handler_ids)
        or len(exact_handler_ids) != len(set(exact_handler_ids))
        or len(causal_handler_ids) != len(set(causal_handler_ids))
    ):
        add(errors, "SOURCE_HANDLER_SET_DRIFT", "manifest/exact/operation handlers")
    common = exact.get("commonTableContract", {})
    common_shape = [
        (
            row.get("name"),
            row.get("sqlType"),
            row.get("nullable"),
            row.get("default"),
        )
        for row in common.get("columns", [])
    ]
    if (
        common.get("contractId") != "DWP_MODERN_TENANT_TABLE_V1"
        or common_shape != COMMON_COLUMN_PHYSICAL_SHAPE
    ):
        add(
            errors,
            "SOURCE_COMMON_TABLE_PHYSICAL_SHAPE_DRIFT",
            "commonTableContract",
            expected=COMMON_COLUMN_PHYSICAL_SHAPE,
            actual=common_shape,
        )
    if common.get("rowSecurity") != (
        "ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY; "
        "current_setting('dwp.tenant_id',true)::bigint; application role NOBYPASSRLS"
    ):
        add(errors, "SOURCE_COMMON_TABLE_RLS_CONTRACT_DRIFT", "commonTableContract.rowSecurity")
    owner_by_table: dict[str, tuple[str, str, str]] = {}
    for table_name, table in spec_by_name.items():
        try:
            owner_by_table[table_name] = expected_owner(table)
        except ValueError as exc:
            add(errors, "SOURCE_OWNER_UNMAPPED", str(table_name), detail=str(exc))
    for table_name, table in spec_by_name.items():
        if table_name not in owner_by_table:
            continue
        if not IDENT_RE.fullmatch(str(table_name)):
            add(errors, "SOURCE_UNSAFE_TABLE_IDENTIFIER", str(table_name))
        session = table.get("session")
        if session not in SESSION_PREFIX or not str(table_name).startswith(
            SESSION_PREFIX.get(session, "!")
        ):
            add(errors, "SOURCE_TABLE_SESSION_PREFIX_MISMATCH", str(table_name))
        if table.get("commonColumnsRef") != common.get("contractId"):
            add(errors, "SOURCE_TABLE_COMMON_CONTRACT_REF_DRIFT", str(table_name))
        if table.get("rowSecurity") != "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS":
            add(errors, "SOURCE_TABLE_RLS_CONTRACT_DRIFT", str(table_name))
        expected_id = {
            "name": table.get("idColumn", {}).get("name"),
            "sqlType": "BIGINT",
            "nullable": False,
            "default": "IDENTITY",
            "exposure": "INTERNAL_ONLY",
        }
        if table.get("idColumn") != expected_id:
            add(
                errors,
                "SOURCE_TABLE_INTERNAL_ID_PHYSICAL_SHAPE_DRIFT",
                str(table_name),
                expected=expected_id,
                actual=table.get("idColumn"),
            )
        try:
            binding_id = expected_owner_binding(table)
        except ValueError as exc:
            add(errors, "SOURCE_OWNER_BINDING_UNMAPPED", str(table_name), detail=str(exc))
            binding_id = ""
        row = owner_register.get(binding_id)
        owner = owner_by_table[table_name]
        expected_binding = {
            "session": table.get("session"),
            "owner_service": owner[0],
            "bounded_context": expected_bounded_context(table),
            "database_schema": owner[1],
            "status": "READY_FOR_G3_CODE",
        }
        if row is None:
            add(errors, "SOURCE_OWNER_REGISTER_BINDING_MISSING", f"{table_name}:{binding_id}")
        else:
            actual_binding = {key: row.get(key) for key in expected_binding}
            if actual_binding != expected_binding:
                add(
                    errors,
                    "SOURCE_OWNER_REGISTER_BINDING_DRIFT",
                    f"{table_name}:{binding_id}",
                    expected=expected_binding,
                    actual=actual_binding,
                )
            if not table_matches_allowed_prefix(table_name, row.get("allowed_prefixes", "")):
                add(
                    errors,
                    "SOURCE_OWNER_REGISTER_PREFIX_REJECTED",
                    f"{table_name}:{binding_id}",
                )
            if not row.get("table_source_scope") or not row.get("cross_boundary_rule"):
                add(
                    errors,
                    "SOURCE_OWNER_REGISTER_BOUNDARY_CONTRACT_MISSING",
                    f"{table_name}:{binding_id}",
                )
        names = set(common_columns(table, common))
        column_map = columns_by_name(table, common)
        if len(column_map) != len(common_columns(table, common)):
            add(errors, "SOURCE_DUPLICATE_TABLE_COLUMN", str(table_name))
        for column_name, column in column_map.items():
            if not IDENT_RE.fullmatch(str(column_name)):
                add(errors, "SOURCE_UNSAFE_COLUMN_IDENTIFIER", f"{table_name}.{column_name}")
            if not SQL_TYPE_RE.fullmatch(str(column.get("sqlType", ""))):
                add(
                    errors,
                    "SOURCE_UNSUPPORTED_SQL_TYPE",
                    f"{table_name}.{column_name}",
                    actual=column.get("sqlType"),
                )
            if column.get("default") is not None and not sql_default_is_safe(
                str(column.get("default"))
            ):
                add(errors, "SOURCE_UNSAFE_COLUMN_DEFAULT", f"{table_name}.{column_name}")
        for group, key in (("uniqueKeys", "constraintId"), ("checks", "constraintId"), ("indexes", "indexId")):
            for item in table.get(group, []):
                identifier = item.get(key)
                if not IDENT_RE.fullmatch(str(identifier or "")):
                    add(errors, "SOURCE_UNSAFE_CONSTRAINT_IDENTIFIER", f"{table_name}.{identifier}")
                missing = set(item.get("columns", [])) - names
                if missing:
                    add(
                        errors,
                        "SOURCE_CONSTRAINT_COLUMN_MISSING",
                        f"{table_name}.{item.get(key)}",
                        missing=sorted(missing),
                    )
                if group == "checks" and not sql_fragment_is_safe(item.get("expression")):
                    add(errors, "SOURCE_UNSAFE_CHECK_EXPRESSION", f"{table_name}.{identifier}")
        for foreign_key in table.get("foreignKeys", []):
            if foreign_key.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            constraint_id = foreign_key.get("constraintId")
            if not IDENT_RE.fullmatch(str(constraint_id or "")):
                add(
                    errors,
                    "SOURCE_UNSAFE_FOREIGN_KEY_IDENTIFIER",
                    f"{table_name}.{constraint_id}",
                )
            target_name = foreign_key.get("target")
            if target_name not in spec_by_name:
                add(errors, "SOURCE_LOCAL_FK_TARGET_MISSING", f"{table_name}.{foreign_key.get('constraintId')}")
            elif owner_by_table.get(target_name) and owner_by_table.get(table_name):
                source_unit = owner_by_table[table_name][:2]
                target_unit = owner_by_table[target_name][:2]
                if source_unit != target_unit:
                    add(
                        errors,
                        "SOURCE_CROSS_OWNER_LOCAL_FK",
                        f"{table_name}.{foreign_key.get('constraintId')}",
                        target=target_name,
                    )
            if target_name in spec_by_name:
                target = spec_by_name[target_name]
                source_columns = columns_by_name(table, common)
                target_columns = columns_by_name(target, common)
                source_types = [
                    source_columns.get(column, {}).get("sqlType")
                    for column in foreign_key.get("columns", [])
                ]
                target_types = [
                    target_columns.get(column, {}).get("sqlType")
                    for column in foreign_key.get("targetColumns", [])
                ]
                if len(source_types) != len(target_types) or source_types != target_types:
                    add(
                        errors,
                        "SOURCE_FOREIGN_KEY_TYPE_MISMATCH",
                        f"{table_name}.{constraint_id}",
                        sourceTypes=source_types,
                        targetTypes=target_types,
                    )
                if tuple(foreign_key.get("targetColumns", [])) not in expected_unique_column_sets(target):
                    add(
                        errors,
                        "SOURCE_FOREIGN_KEY_TARGET_NOT_UNIQUE",
                        f"{table_name}.{constraint_id}",
                        target=target_name,
                        targetColumns=foreign_key.get("targetColumns", []),
                    )
        validate_revision_temporal_arbitration(
            table,
            common,
            causal.get("operations", []),
            spec_by_name,
            errors,
        )
        validate_temporal_exclusion_shape(table, common, errors)

    validate_relation_namespace(spec_by_name, owner_by_table, errors)

    causal_by_id = {
        row.get("operationId"): row for row in causal.get("operations", [])
    }
    for binding in exact.get("operationBindings", []):
        operation_id = binding.get("operationId")
        referenced = (
            set(binding.get("readsTables", []))
            | set(binding.get("writesTables", []))
            | set((binding.get("responseProjection") or {}).get("physicalSources", []))
        )
        unknown = referenced - set(spec_by_name)
        if unknown:
            add(
                errors,
                "SOURCE_OPERATION_PHYSICAL_TABLE_UNKNOWN",
                str(operation_id),
                tables=sorted(unknown),
            )
        if binding.get("mode") == "QUERY" and binding.get("writesTables"):
            add(
                errors,
                "SOURCE_QUERY_CANONICAL_WRITE_FORBIDDEN",
                str(operation_id),
                tables=binding.get("writesTables"),
            )
        binding_write_units = {
            owner_by_table[name][:2]
            for name in binding.get("writesTables", [])
            if name in owner_by_table
        }
        if len(binding_write_units) > 1:
            add(
                errors,
                "SOURCE_OPERATION_BINDING_CROSS_OWNER_WRITE",
                str(operation_id),
                owners=sorted([list(unit) for unit in binding_write_units]),
            )
        operation = causal_by_id.get(operation_id, {})
        aggregate = operation.get("aggregateRoot") or {}
        aggregate_table = aggregate.get("table")
        if binding.get("mode") == "COMMAND":
            if aggregate_table not in spec_by_name:
                add(
                    errors,
                    "SOURCE_COMMAND_AGGREGATE_ROOT_MISSING",
                    str(operation_id),
                    actual=aggregate_table,
                )
            else:
                aggregate_columns = set(common_columns(spec_by_name[aggregate_table], common))
                selector_columns = [
                    aggregate.get("publicIdColumn", "public_id"),
                    aggregate.get("versionColumn", "aggregate_version"),
                    aggregate.get("stateColumn"),
                    aggregate.get("tenantColumn", "tenant_id"),
                ]
                if any(
                    column is not None and column not in aggregate_columns
                    for column in selector_columns
                ):
                    add(
                        errors,
                        "SOURCE_COMMAND_AGGREGATE_SELECTOR_COLUMN_INVALID",
                        str(operation_id),
                        aggregateTable=aggregate_table,
                        selectorColumns=selector_columns,
                    )
                if (
                    binding_write_units
                    and owner_by_table[aggregate_table][:2] not in binding_write_units
                ):
                    add(
                        errors,
                        "SOURCE_COMMAND_AGGREGATE_OWNER_MISMATCH",
                        str(operation_id),
                    )
        mutating = [
            step
            for step in operation.get("orderedDml", [])
            if step.get("table") in spec_by_name
            and step.get("action") not in {"SELECT", "LOCK_FOR_UPDATE"}
        ]
        mutation_units = {
            owner_by_table[step["table"]][:2]
            for step in mutating
            if step.get("table") in owner_by_table
        }
        if len(mutation_units) > 1:
            add(
                errors,
                "SOURCE_COMMAND_CROSS_OWNER_DML",
                str(operation_id),
                owners=sorted([list(unit) for unit in mutation_units]),
            )
        home = next(iter(mutation_units or binding_write_units), None)
        for selector in operation.get("selectors", []):
            target = selector.get("targetTable")
            if (
                home is not None
                and selector.get("selectorType") == "LOCAL_TABLE"
                and target in owner_by_table
                and owner_by_table[target][:2] != home
            ):
                add(
                    errors,
                    "SOURCE_COMMAND_CROSS_OWNER_LOCAL_SELECTOR",
                    str(operation_id),
                    source=selector.get("source"),
                    target=target,
                )

    for handler in exact.get("internalConsumerHandlers", []):
        handler_id = handler.get("handlerId")
        reads = set(handler.get("readsTables", []))
        writes = {
            row.get("table") for row in handler.get("writes", []) if row.get("table")
        }
        controls = {
            handler.get(key)
            for key in ("ticketTable", "receiptTable", "outboxTable")
            if handler.get(key)
        }
        unknown = (reads | writes | controls) - set(spec_by_name)
        if unknown:
            add(
                errors,
                "SOURCE_HANDLER_PHYSICAL_TABLE_UNKNOWN",
                str(handler_id),
                tables=sorted(unknown),
            )
        write_units = {
            owner_by_table[name][:2]
            for name in writes | controls
            if name in owner_by_table
        }
        if len(write_units) != 1:
            add(
                errors,
                "SOURCE_HANDLER_OWNER_LOCAL_TRANSACTION_INVALID",
                str(handler_id),
                owners=sorted([list(unit) for unit in write_units]),
            )

    writer_map: dict[str, set[str]] = {name: set() for name in spec_by_name}
    reader_map: dict[str, set[str]] = {name: set() for name in spec_by_name}
    query_reader_map: dict[str, set[str]] = {name: set() for name in spec_by_name}
    for operation in exact.get("operationBindings", []):
        operation_id = operation.get("operationId")
        for table_name in operation.get("writesTables", []):
            writer_map.setdefault(table_name, set()).add(operation_id)
        for table_name in operation.get("readsTables", []):
            reader_map.setdefault(table_name, set()).add(operation_id)
        for table_name in (operation.get("responseProjection") or {}).get("physicalSources", []):
            reader_map.setdefault(table_name, set()).add(operation_id)
        if operation.get("mode") == "QUERY":
            query_sources = set(operation.get("readsTables", [])) | set(
                (operation.get("responseProjection") or {}).get("physicalSources", [])
            )
            for table_name in query_sources:
                query_reader_map.setdefault(table_name, set()).add(operation_id)
    for handler in exact.get("internalConsumerHandlers", []):
        handler_id = handler.get("handlerId")
        for write in handler.get("writes", []):
            writer_map.setdefault(write.get("table"), set()).add(handler_id)
        for table_name in handler.get("readsTables", []):
            reader_map.setdefault(table_name, set()).add(handler_id)

    added_rows = policy.get("successorScope", {}).get("addedRows", [])
    validate_scope_profile_authority(
        canonical,
        canonical_raw or {},
        policy,
        policy_raw,
        policy_filename,
        profile_name,
        profile,
        errors,
    )
    if (
        policy.get("successorScope", {}).get("tableCount") != expected_counts["tables"]
        or policy.get("successorScope", {}).get("deltaCount") != 17
        or set(policy.get("successorScope", {}).get("removedTableIds", [])) != set(profile["removedTables"])
        or policy.get("successorScope", {}).get("netDelta", profile["netDelta"]) != profile["netDelta"]
        or len(added_rows) != 17
    ):
        add(errors, "SOURCE_EXPANSION_POLICY_SCOPE_DRIFT", str(policy.get("policyId")))
    for row in added_rows:
        table_name = row.get("tableId")
        if set(row.get("producers", [])) != writer_map.get(table_name, set()):
            add(
                errors,
                "SOURCE_EXPANSION_PRODUCER_DRIFT",
                str(table_name),
                expected=sorted(row.get("producers", [])),
                actual=sorted(writer_map.get(table_name, set())),
            )
        declared_readers = set(row.get("readConsumers", []))
        if not declared_readers:
            add(errors, "SOURCE_EXPANSION_READER_MISSING", str(table_name))
        missing_readers = declared_readers - query_reader_map.get(table_name, set())
        if missing_readers:
            add(
                errors,
                "SOURCE_EXPANSION_DECLARED_READER_MISSING",
                str(table_name),
                missing=sorted(missing_readers),
            )
        lineage_by_operation = {
            lineage.get("operationId"): lineage
            for lineage in exact.get("operationFieldLineage", [])
        }
        binding_by_operation = {
            binding.get("operationId"): binding
            for binding in exact.get("operationBindings", [])
        }
        for reader in declared_readers:
            binding = binding_by_operation.get(reader, {})
            projection = binding.get("responseProjection") or {}
            if not projection.get("fieldPolicy") or (projection.get("pep") or {}).get("denyOnUnavailable") is not True:
                add(errors, "SOURCE_EXPANSION_READER_FIELD_POLICY_MISSING", f"{table_name}:{reader}")
            direct = direct_physical_lineage_bindings(
                lineage_by_operation.get(reader, {}).get("responseFieldSources", []),
                table_name,
                set(columns_by_name(spec_by_name[table_name], common)),
            )
            if len(direct) < 2:
                add(
                    errors,
                    "SOURCE_EXPANSION_READER_LINEAGE_INCOMPLETE",
                    f"{table_name}:{reader}",
                    required=2,
                    actual=len(direct),
                )
    return {
        "scopeProfile": profile_name,
        "counts": counts,
        "tableByName": spec_by_name,
        "ownerByTable": owner_by_table,
        "writerMap": writer_map,
        "readerMap": reader_map,
        "queryReaderMap": query_reader_map,
    }


def validate_candidate_data(
    canonical_raw: dict[str, bytes],
    canonical: dict[str, dict[str, Any]],
    policy_raw: bytes,
    policy: dict[str, Any],
    owner_register_raw: bytes,
    owner_register: dict[str, dict[str, str]],
    physical_raw: dict[str, bytes],
    physical_json: dict[str, dict[str, Any]],
    canonical_directory_name: str | None = None,
    policy_filename: str = "",
    profile_name: str = "v3-132-historical",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    profile = SCOPE_PROFILES[profile_name]
    source = validate_source_contracts(
        canonical,
        policy,
        owner_register,
        errors,
        canonical_raw=canonical_raw,
        policy_raw=policy_raw,
        policy_filename=policy_filename,
        profile_name=profile_name,
        profile=profile,
    )
    # Source-contract failures are sufficient rejection evidence.  Do not try
    # to synthesize a physical expected view from a hostile unknown table or
    # missing causal publication: that would turn a clean rejection into a
    # validator exception and hide the finding.
    if errors:
        return errors, source
    exact = canonical[EXACT_NAME]
    manifest = canonical[MANIFEST_NAME]

    handler = physical_json[HANDLER_FILE]
    query = physical_json[QUERY_FILE]
    report = physical_json[REPORT_FILE]
    for name, value in physical_json.items():
        if not self_sealed(value):
            add(errors, "OUTPUT_SELF_SEAL_MISMATCH", name)
    if errors:
        return errors, source
    if profile_name != "v3-132-historical":
        dangling_outputs = sorted(
            name
            for name, raw in physical_raw.items()
            if re.search(
                rb"(?<![A-Za-z0-9_])"
                + REMOVED_LISTENING_TABLE.encode("ascii")
                + rb"(?![A-Za-z0-9_])",
                raw,
            )
        )
        if dangling_outputs:
            add(
                errors,
                "OUTPUT_REMOVED_TABLE_DANGLING_REFERENCE",
                REMOVED_LISTENING_TABLE,
                files=dangling_outputs,
            )

    source_hashes = {name: sha256(raw) for name, raw in canonical_raw.items()}
    source_references = [
        physical_json[name].get("sourceCanonical", {})
        for name in (HANDLER_FILE, QUERY_FILE, REPORT_FILE)
    ]
    if not all(reference == source_references[0] for reference in source_references[1:]):
        add(errors, "OUTPUT_CANONICAL_REFERENCE_BYTE_DRIFT", "handler/query/report")
    for name, value in ((HANDLER_FILE, handler), (QUERY_FILE, query), (REPORT_FILE, report)):
        source_ref = value.get("sourceCanonical", {})
        if set(source_ref) != {
            "scopeProfile",
            "directory",
            "fileSha256",
            "manifestSealedPayloadSha256",
            "tableExpansionPolicy",
            "physicalOwnerPrefixRegister",
        }:
            add(errors, "OUTPUT_CANONICAL_REFERENCE_SHAPE_DRIFT", name)
        if source_ref.get("scopeProfile") != profile_name:
            add(errors, "OUTPUT_SCOPE_PROFILE_PIN_MISMATCH", name)
        if source_ref.get("fileSha256") != source_hashes:
            add(errors, "OUTPUT_CANONICAL_PIN_MISMATCH", name)
        if (
            canonical_directory_name is not None
            and source_ref.get("directory") != canonical_directory_name
        ):
            add(errors, "OUTPUT_CANONICAL_DIRECTORY_PIN_MISMATCH", name)
        if source_ref.get("manifestSealedPayloadSha256") != manifest.get("sealedPayloadSha256"):
            add(errors, "OUTPUT_MANIFEST_SEAL_PIN_MISMATCH", name)
        policy_ref = source_ref.get("tableExpansionPolicy", {})
        if set(policy_ref) != {
            "path",
            "policyId",
            "schemaVersion",
            "sha256",
            "sealedPayloadSha256",
        }:
            add(errors, "OUTPUT_EXPANSION_POLICY_REFERENCE_SHAPE_DRIFT", name)
        if policy_ref.get("path") != profile["policyFilename"]:
            add(errors, "OUTPUT_EXPANSION_POLICY_PATH_DRIFT", name)
        if policy_ref.get("policyId") != profile["policyId"]:
            add(errors, "OUTPUT_EXPANSION_POLICY_ID_DRIFT", name)
        if policy_ref.get("schemaVersion") != profile["policySchemaVersion"]:
            add(errors, "OUTPUT_EXPANSION_POLICY_SCHEMA_VERSION_DRIFT", name)
        if policy_ref.get("sha256") != sha256(policy_raw):
            add(errors, "OUTPUT_EXPANSION_POLICY_PIN_MISMATCH", name)
        if policy_ref.get("sealedPayloadSha256") != profile["policySeal"]:
            add(errors, "OUTPUT_EXPANSION_POLICY_SEAL_DRIFT", name)
        owner_ref = source_ref.get("physicalOwnerPrefixRegister", {})
        if set(owner_ref) != {"path", "sha256"}:
            add(errors, "OUTPUT_OWNER_REGISTER_REFERENCE_SHAPE_DRIFT", name)
        if owner_ref.get("path") != "physical-owner-prefix-register.csv":
            add(errors, "OUTPUT_OWNER_REGISTER_PATH_DRIFT", name)
        if owner_ref.get("sha256") != sha256(owner_register_raw):
            add(errors, "OUTPUT_OWNER_REGISTER_PIN_MISMATCH", name)

    inventory = report.get("outputFiles", {})
    inventory_expected = EXPECTED_FILES - {REPORT_FILE}
    if set(inventory) != inventory_expected:
        add(
            errors,
            "OUTPUT_INVENTORY_SET_MISMATCH",
            REPORT_FILE,
            expected=sorted(inventory_expected),
            actual=sorted(inventory),
        )
    for name, metadata in inventory.items():
        raw = physical_raw.get(name)
        if raw is None:
            continue
        if metadata != {"sha256": sha256(raw), "bytes": len(raw)}:
            add(errors, "OUTPUT_INVENTORY_HASH_MISMATCH", name)

    expected_operation_ids = {row["operationId"] for row in manifest.get("operations", [])}
    expected_handler_ids = set(manifest.get("handlerIds", []))
    expected_table_ids = set(manifest.get("tableIds", []))
    physical_operations = query.get("operationPhysicalContracts", [])
    physical_queries = query.get("queryProjectionPhysicalContracts", [])
    physical_tables = query.get("tablePhysicalContracts", [])
    physical_handlers = handler.get("handlers", [])
    if (
        {row.get("operationId") for row in physical_operations} != expected_operation_ids
        or len(physical_operations) != profile["counts"]["operations"]
    ):
        add(errors, "OUTPUT_OPERATION_SET_MISMATCH", QUERY_FILE)
    if {row.get("operationId") for row in physical_queries} != {
        row["operationId"] for row in manifest.get("operations", []) if row.get("mode") == "QUERY"
    } or len(physical_queries) != profile["counts"]["queries"]:
        add(errors, "OUTPUT_QUERY_PROJECTION_SET_MISMATCH", QUERY_FILE)
    if (
        {row.get("tableId") for row in physical_tables} != expected_table_ids
        or len(physical_tables) != profile["counts"]["tables"]
    ):
        add(errors, "OUTPUT_TABLE_CONTRACT_SET_MISMATCH", QUERY_FILE)
    if (
        {row.get("handlerId") for row in physical_handlers} != expected_handler_ids
        or len(physical_handlers) != len(expected_handler_ids)
    ):
        add(errors, "OUTPUT_HANDLER_SET_MISMATCH", HANDLER_FILE)

    # Reconstruct every generated JSON row independently from the canonical
    # documents.  Set equality alone is insufficient: a resealed method,
    # trigger, selector, owner, or projection drift must fail byte semantics.
    table_by_name = source["tableByName"]
    exact_binding_by_id = {
        row["operationId"]: row for row in exact.get("operationBindings", [])
    }
    causal_binding_by_id = {
        row["operationId"]: row
        for row in canonical[CANONICAL_FILES[1]].get("operations", [])
    }
    transaction_by_session = (
        canonical[CANONICAL_FILES[1]].get("transactionInfrastructure", {}).get("sessions", {})
    )
    expected_operation_rows: list[dict[str, Any]] = []
    expected_projection_rows: list[dict[str, Any]] = []
    for binding in sorted(exact_binding_by_id.values(), key=lambda row: row["operationId"]):
        causal_binding = causal_binding_by_id[binding["operationId"]]
        home = expected_home_owner(binding, causal_binding, table_by_name)
        projection = binding.get("responseProjection") or {}
        reads = set(binding.get("readsTables", [])) | set(projection.get("physicalSources", []))
        writes = sorted(set(binding.get("writesTables", [])))
        expected_operation_rows.append({
            "operationId": binding["operationId"],
            "capabilityId": binding.get("capabilityId"),
            "session": binding.get("session"),
            "mode": binding.get("mode"),
            "method": binding.get("method"),
            "path": binding.get("path"),
            "authorizationCapability": binding.get("authorizationCapability"),
            "homeOwner": home,
            "readPlan": expected_access_plan(reads, home, table_by_name),
            "writePlan": [
                {**expected_physical_ref(name, table_by_name), "accessMode": "OWNER_LOCAL_SQL"}
                for name in writes
            ],
            "orderedDml": causal_binding.get("orderedDml", []),
            "selectors": causal_binding.get("selectors", []),
            "aggregateRoot": causal_binding.get("aggregateRoot"),
            "transition": causal_binding.get("transition"),
            "eventIds": [event.get("eventName") for event in causal_binding.get("events", [])],
            "transactionInfrastructure": transaction_by_session.get(binding.get("session")),
            "responseSchemaRef": binding.get("responseSchemaRef"),
            "responseProjection": projection or None,
            "queryMutationPolicy": (
                "READ_ONLY_NO_RECEIPT_NO_OUTBOX" if binding.get("mode") == "QUERY" else None
            ),
            "crossOwnerReadPolicy": "TYPED_OWNER_PORT_NO_CROSS_SCHEMA_SQL",
            "productionState": "NOT_AUTHORIZED_G6",
        })
        if binding.get("mode") == "QUERY":
            expected_projection_rows.append({
                "projectionId": f"{binding['operationId']}.physical-projection.v4",
                "operationId": binding["operationId"],
                "session": binding.get("session"),
                "homeOwner": home,
                "responseSchemaRef": binding.get("responseSchemaRef"),
                "physicalSources": expected_access_plan(
                    projection.get("physicalSources", []), home, table_by_name
                ),
                "pep": projection.get("pep"),
                "tenantPep": projection.get("tenantPep"),
                "purpose": projection.get("purpose"),
                "population": projection.get("population"),
                "fieldPolicy": projection.get("fieldPolicy"),
                "asOf": projection.get("asOf"),
                "freshness": projection.get("freshness"),
                "pagination": projection.get("pagination"),
                "writesForbidden": projection.get("writesForbidden"),
                "receiptsForbidden": projection.get("receiptsForbidden"),
                "outboxForbidden": projection.get("outboxForbidden"),
                "directCrossOwnerSql": "FORBIDDEN",
            })
    if physical_operations != expected_operation_rows:
        add(errors, "OUTPUT_OPERATION_EXACT_CONTRACT_DRIFT", QUERY_FILE)
    if physical_queries != expected_projection_rows:
        add(errors, "OUTPUT_QUERY_PROJECTION_EXACT_CONTRACT_DRIFT", QUERY_FILE)

    expected_handler_rows: list[dict[str, Any]] = []
    for canonical_handler in sorted(
        exact.get("internalConsumerHandlers", []), key=lambda row: row["handlerId"]
    ):
        touched = set(canonical_handler.get("readsTables", []))
        touched.update(
            write.get("table") for write in canonical_handler.get("writes", []) if write.get("table")
        )
        touched.update(
            canonical_handler.get(key)
            for key in ("ticketTable", "receiptTable", "outboxTable")
            if canonical_handler.get(key)
        )
        stream = canonical_handler.get("streamKey")
        if touched:
            owner = expected_owner_dict(table_by_name[next(iter(sorted(touched)))])
        else:
            service, schema, deployment = STREAM_OWNER[stream]
            owner = {
                "deploymentKey": deployment,
                "service": service,
                "boundedContext": {
                    "platform-hris-configuration": "DWP_PLATFORM_HRIS_CONFIGURATION",
                    "platform-hris-listening-protected": "DWP_PLATFORM_HRIS_LISTENING_PROTECTED",
                    "platform-hris-insights": "DWP_PLATFORM_HRIS_INSIGHTS",
                    "auth-hris-participation-issuer": "DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
                }[stream],
                "schema": schema,
            }
        read_tables = set(canonical_handler.get("readsTables", []))
        write_tables = {
            write.get("table") for write in canonical_handler.get("writes", [])
        }
        expected_handler_rows.append({
            "handlerId": canonical_handler["handlerId"],
            "capabilityId": canonical_handler.get("capabilityId"),
            "session": canonical_handler.get("session"),
            "owner": owner,
            "trigger": canonical_handler.get("trigger"),
            "aggregateRoot": canonical_handler.get("aggregateRoot"),
            "readPlan": expected_access_plan(read_tables, owner, table_by_name),
            "writePlan": [
                {**write, "physicalTable": expected_physical_ref(write["table"], table_by_name)}
                for write in canonical_handler.get("writes", [])
            ],
            "specialPhysicalTables": expected_access_plan(
                [name for name in touched if name not in read_tables and name not in write_tables],
                owner,
                table_by_name,
            ),
            "transactionInfrastructure": transaction_by_session.get(canonical_handler.get("session")),
            "idempotency": canonical_handler.get("idempotency") or canonical_handler.get("idempotencyRule"),
            "orderedDml": canonical_handler.get("orderedDml") or canonical_handler.get("structuredTransaction"),
            "rollback": canonical_handler.get("rollback") or (canonical_handler.get("structuredTransaction") or {}).get("faultInjection"),
            "handlerContract": canonical_handler.get("handlerContract"),
            "event": canonical_handler.get("event"),
            "directCrossOwnerSql": "FORBIDDEN",
            "productionState": "NOT_AUTHORIZED_G6",
        })
    if physical_handlers != expected_handler_rows:
        add(errors, "OUTPUT_HANDLER_EXACT_CONTRACT_DRIFT", HANDLER_FILE)

    expected_source_ref = handler.get("sourceCanonical")
    expected_handler_document = sealed_copy({
        "contractId": "dwp.hris.modern.owner-handler-physical-contracts.v4.candidate",
        "schemaVersion": 4,
        "status": "CANDIDATE_NOT_G3_AUTHORITY",
        "sourceCanonical": expected_source_ref,
        "handlerCount": len(expected_handler_rows),
        "handlers": expected_handler_rows,
        "invariants": {
            "transactionBoundary": "ONE_OWNER_LOCAL_DATABASE_TRANSACTION",
            "claimOrder": "CLAIM_OR_SEALED_REPLAY_BEFORE_DOMAIN_MUTATION",
            "differentDigestReplay": "CONFLICT_OR_QUARANTINE_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "faultInjection": "ANY_STAGE_FAILURE_ROLLS_BACK_OWNER_LOCAL_TRANSACTION",
            "externalCallInsideTransaction": False,
            "crossOwnerReference": "SIGNED_OR_VERSIONED_PURPOSE_BOUND_PORT_ONLY",
        },
        "productionState": "NOT_AUTHORIZED_G6",
    })
    expected_query_document = sealed_copy({
        "contractId": "dwp.hris.modern.query-projection-physical-contracts.v4.candidate",
        "schemaVersion": 4,
        "status": "CANDIDATE_NOT_G3_AUTHORITY",
        "sourceCanonical": expected_source_ref,
        "scope": {
            "operationCount": len(expected_operation_rows),
            "commandCount": sum(row["mode"] == "COMMAND" for row in expected_operation_rows),
            "queryCount": sum(row["mode"] == "QUERY" for row in expected_operation_rows),
            "queryProjectionCount": len(expected_projection_rows),
            "tableCount": len(physical_tables),
            "payModernOwnerTableCount": sum(
                row.get("session") == "HRIS-PAY" for row in table_by_name.values()
            ),
        },
        "operationPhysicalContracts": expected_operation_rows,
        "queryProjectionPhysicalContracts": expected_projection_rows,
        # Exact table rows are checked below after complete reconstruction.
        "tablePhysicalContracts": physical_tables,
        "invariants": {
            "queryMutation": "FORBIDDEN",
            "crossOwnerSql": "FORBIDDEN",
            "crossOwnerReference": "PUBLIC_ID_PLUS_EXACT_VERSION_ASOF_PURPOSE_BOUND_OWNER_PORT",
            "tenantRls": (
                "ENABLE_AND_FORCE_RLS_ON_ALL_"
                f"{profile['counts']['tables']}_TABLES"
            ),
            "revisionHistory": (
                "APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS;RAW_HISTORY_EXCLUSION_NONE;"
                "CORRECTION_AND_FUTURE_SUPERSEDE_SYSTEM_BUSINESS_ASOF"
            ),
            "pay": "NO_MODERN_PRODUCER_TABLES;CONSUMER_MATERIALIZATION_IS_SEPARATE",
        },
        "productionState": "NOT_AUTHORIZED_G6",
    })
    if handler != expected_handler_document or physical_raw[HANDLER_FILE] != pretty_json_bytes(expected_handler_document):
        add(errors, "OUTPUT_HANDLER_EXACT_BYTE_MISMATCH", HANDLER_FILE)
    if query != expected_query_document or physical_raw[QUERY_FILE] != pretty_json_bytes(expected_query_document):
        add(errors, "OUTPUT_QUERY_EXACT_BYTE_MISMATCH", QUERY_FILE)

    if handler.get("status") != "CANDIDATE_NOT_G3_AUTHORITY":
        add(errors, "OUTPUT_AUTHORITY_STATUS_DRIFT", HANDLER_FILE)
    if query.get("status") != "CANDIDATE_NOT_G3_AUTHORITY":
        add(errors, "OUTPUT_AUTHORITY_STATUS_DRIFT", QUERY_FILE)
    if (query.get("invariants") or {}).get("revisionHistory") != (
        "APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS;RAW_HISTORY_EXCLUSION_NONE;"
        "CORRECTION_AND_FUTURE_SUPERSEDE_SYSTEM_BUSINESS_ASOF"
    ):
        add(errors, "OUTPUT_REVISION_HISTORY_INVARIANT_MISSING", QUERY_FILE)
    if report.get("status") != "PASS_CANDIDATE_NOT_G3_AUTHORITY":
        add(errors, "OUTPUT_AUTHORITY_STATUS_DRIFT", REPORT_FILE)

    for row in physical_operations:
        operation_id = row.get("operationId")
        exact_binding = exact_binding_by_id.get(operation_id, {})
        causal_binding = causal_binding_by_id.get(operation_id, {})
        expected_reads = set(exact_binding.get("readsTables", [])) | set(
            (exact_binding.get("responseProjection") or {}).get("physicalSources", [])
        )
        actual_reads = {source.get("tableId") for source in row.get("readPlan", [])}
        expected_writes = set(exact_binding.get("writesTables", []))
        actual_writes = {source.get("tableId") for source in row.get("writePlan", [])}
        expected_events = {
            event.get("eventName") for event in causal_binding.get("events", [])
        }
        if row.get("mode") != exact_binding.get("mode") or row.get("session") != exact_binding.get("session"):
            add(errors, "OUTPUT_OPERATION_MODE_SESSION_DRIFT", str(operation_id))
        if actual_reads != expected_reads:
            add(
                errors,
                "OUTPUT_OPERATION_READ_SET_DRIFT",
                str(operation_id),
                expected=sorted(expected_reads),
                actual=sorted(actual_reads),
            )
        if actual_writes != expected_writes:
            add(
                errors,
                "OUTPUT_OPERATION_WRITE_SET_DRIFT",
                str(operation_id),
                expected=sorted(expected_writes),
                actual=sorted(actual_writes),
            )
        if set(row.get("eventIds", [])) != expected_events:
            add(errors, "OUTPUT_OPERATION_EVENT_SET_DRIFT", str(operation_id))

    exact_handler_by_id = {
        row["handlerId"]: row for row in exact.get("internalConsumerHandlers", [])
    }
    for row in physical_handlers:
        handler_id = row.get("handlerId")
        exact_handler = exact_handler_by_id.get(handler_id, {})
        expected_reads = set(exact_handler.get("readsTables", []))
        actual_reads = {source.get("tableId") for source in row.get("readPlan", [])}
        expected_writes = {
            write.get("table") for write in exact_handler.get("writes", [])
        }
        actual_writes = {
            write.get("physicalTable", {}).get("tableId") for write in row.get("writePlan", [])
        }
        if expected_reads != actual_reads:
            add(errors, "OUTPUT_HANDLER_READ_SET_DRIFT", str(handler_id))
        if expected_writes != actual_writes:
            add(errors, "OUTPUT_HANDLER_WRITE_SET_DRIFT", str(handler_id))
        if row.get("directCrossOwnerSql") != "FORBIDDEN":
            add(errors, "OUTPUT_HANDLER_CROSS_OWNER_GUARD_MISSING", str(handler_id))

    table_contract_by_name = {row.get("tableId"): row for row in physical_tables}
    sql_tables_all: dict[str, tuple[str, str, dict[str, Any]]] = {}
    for filename in SQL_FILES:
        raw = physical_raw[filename].decode("utf-8")
        migration_role, runtime_role = SQL_ROLES[filename]
        if not raw.startswith("-- DWP HRIS modern physical candidate v4"):
            add(errors, "SQL_HEADER_MISSING", filename)
        for marker in (
            "CANDIDATE_NOT_G3_AUTHORITY",
            "NOT_AUTHORIZED_G6",
            source_hashes[MANIFEST_NAME],
            str(manifest.get("sealedPayloadSha256")),
            "PostgreSQL 16 or newer is required",
            "ENABLE ROW LEVEL SECURITY",
            "FORCE ROW LEVEL SECURITY",
            "current_setting('dwp.tenant_id', true)",
            "Cross-owner UUID/revision/as-of references intentionally have no SQL FK",
            "BEGIN;",
            "COMMIT;",
            f"REQUIRED_MIGRATION_ROLE: {migration_role}",
            f"REQUIRED_RUNTIME_ROLE: {runtime_role}",
            f"current_user <> '{migration_role}'",
            f"rolname = '{runtime_role}' AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication",
        ):
            if marker not in raw:
                add(errors, "SQL_REQUIRED_MARKER_MISSING", filename, marker=marker)
        parsed = parse_sql_tables(raw)
        for schema in sorted({details["schema"] for details in parsed.values()}):
            schema_markers = [
                f"REVOKE ALL ON SCHEMA {schema} FROM PUBLIC;",
                f"REVOKE CREATE ON SCHEMA {schema} FROM {runtime_role};",
                f"GRANT USAGE ON SCHEMA {schema} TO {runtime_role};",
            ]
            if schema != "public":
                schema_markers.append(f"ALTER SCHEMA {schema} OWNER TO {migration_role};")
            for marker in schema_markers:
                if marker not in raw:
                    add(errors, "SQL_SCHEMA_ROLE_MARKER_MISSING", filename, marker=marker)
        for table_name, details in parsed.items():
            if table_name in sql_tables_all:
                add(errors, "SQL_DUPLICATE_TABLE", table_name)
            sql_tables_all[table_name] = (filename, details["schema"], details)
    if set(sql_tables_all) != expected_table_ids:
        add(
            errors,
            "SQL_TABLE_SET_MISMATCH",
            "all-ddl",
            missing=sorted(expected_table_ids - set(sql_tables_all)),
            extra=sorted(set(sql_tables_all) - expected_table_ids),
        )

    common = exact.get("commonTableContract", {})
    for table_name, table in source["tableByName"].items():
        if table_name not in sql_tables_all:
            continue
        filename, schema, details = sql_tables_all[table_name]
        owner = source["ownerByTable"].get(table_name)
        if owner is None:
            continue
        expected_file = expected_sql_file(owner)
        if filename != expected_file or schema != owner[1]:
            add(
                errors,
                "SQL_OWNER_PLACEMENT_MISMATCH",
                table_name,
                expected={"file": expected_file, "schema": owner[1]},
                actual={"file": filename, "schema": schema},
            )
        expected_columns = set(common_columns(table, common))
        actual_columns = set(details["columns"])
        if expected_columns != actual_columns or len(details["columns"]) != len(actual_columns):
            add(
                errors,
                "SQL_COLUMN_SET_MISMATCH",
                table_name,
                missing=sorted(expected_columns - actual_columns),
                extra=sorted(actual_columns - expected_columns),
            )
        expected_column_specs: list[dict[str, Any]] = []
        for common_column in common.get("columns", []):
            expected_column_specs.append(
                table["idColumn"]
                if common_column.get("name") == "__internal_id__"
                else common_column
            )
        expected_column_specs.extend(table.get("columns", []))
        actual_definition_lines = {
            line.rstrip(",") for line in details["body"].splitlines()
        }
        for column in expected_column_specs:
            expected_line = expected_render_column(
                column, identity=column is table["idColumn"]
            )
            if expected_line not in actual_definition_lines:
                add(
                    errors,
                    "SQL_COLUMN_PHYSICAL_SHAPE_MISMATCH",
                    f"{table_name}.{column['name']}",
                    expected=expected_line.strip(),
                )
        raw = physical_raw[filename].decode("utf-8")
        qualified = f"{schema}.{table_name}"
        for marker in (
            f"ALTER TABLE {qualified} ENABLE ROW LEVEL SECURITY;",
            f"ALTER TABLE {qualified} FORCE ROW LEVEL SECURITY;",
            f"REVOKE ALL ON TABLE {qualified} FROM PUBLIC;",
            f"ALTER TABLE {qualified} OWNER TO {SQL_ROLES[filename][0]};",
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {qualified} TO {SQL_ROLES[filename][1]};",
            f"REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE {qualified} FROM {SQL_ROLES[filename][1]};",
            f"sequence_name := pg_get_serial_sequence('{qualified}', '{table['idColumn']['name']}');",
            f"GRANT USAGE, SELECT ON SEQUENCE %s TO {SQL_ROLES[filename][1]}",
        ):
            if marker not in raw:
                add(errors, "SQL_TABLE_SECURITY_MARKER_MISSING", table_name, marker=marker)

        id_column = table["idColumn"]["name"]
        derived_constraints = (
            physical_identifier(f"pk_{table_name}_physical_v4"),
            physical_identifier(f"uk_{table_name}_tenant_public_physical_v4"),
            physical_identifier(f"uk_{table_name}_tenant_internal_physical_v4"),
        )
        for identifier in derived_constraints:
            if f"CONSTRAINT {identifier}" not in raw:
                add(errors, "SQL_DERIVED_IDENTITY_CONSTRAINT_MISSING", table_name, constraint=identifier)
        for check in table.get("checks", []):
            identifier = physical_identifier(check["constraintId"])
            if f"CONSTRAINT {identifier} CHECK ({check['expression']})" not in raw:
                add(errors, "SQL_CHECK_CONSTRAINT_MISSING", table_name, constraint=identifier)
        explicit_unique_columns = set()
        for unique in table.get("uniqueKeys", []):
            column_tuple = tuple(unique["columns"])
            if column_tuple in {("tenant_id", "public_id"), ("tenant_id", id_column)}:
                continue
            explicit_unique_columns.add(column_tuple)
            identifier = physical_identifier(unique["constraintId"])
            marker = f"CONSTRAINT {identifier} UNIQUE ({', '.join(unique['columns'])})"
            if marker not in raw:
                add(errors, "SQL_UNIQUE_CONSTRAINT_MISSING", table_name, constraint=identifier)
        for index in table.get("indexes", []):
            identifier = physical_identifier(index["indexId"])
            unique_keyword = "UNIQUE " if index.get("unique") else ""
            marker = (
                f"CREATE {unique_keyword}INDEX {identifier} ON {qualified} "
                f"({', '.join(index['columns'])});"
            )
            if marker not in raw:
                add(errors, "SQL_INDEX_MISSING", table_name, index=identifier)
        for foreign_key in table.get("foreignKeys", []):
            identifier = physical_identifier(foreign_key["constraintId"])
            marker = f"ALTER TABLE {qualified} ADD CONSTRAINT {identifier}"
            if foreign_key.get("mode") == "LOCAL_COMPOSITE_FK":
                target = foreign_key["target"]
                target_owner = source["ownerByTable"].get(target)
                expected_reference = (
                    f"REFERENCES {target_owner[1]}.{target} "
                    f"({', '.join(foreign_key['targetColumns'])})"
                    if target_owner
                    else ""
                )
                if marker not in raw or expected_reference not in raw:
                    add(errors, "SQL_LOCAL_FOREIGN_KEY_MISSING", table_name, constraint=identifier)
            elif marker in raw:
                add(errors, "SQL_OPAQUE_REFERENCE_MATERIALIZED_AS_FK", table_name, constraint=identifier)
        for exclusion in table.get("temporalExclusionConstraints", []):
            identifier = physical_identifier(exclusion["constraintId"])
            marker = f"ALTER TABLE {qualified} ADD CONSTRAINT {identifier}"
            if materialize_temporal_exclusion(table, exclusion):
                if marker not in raw or "EXCLUDE USING gist" not in raw:
                    add(errors, "SQL_TEMPORAL_EXCLUSION_MISSING", table_name, constraint=identifier)
                predicate = str(exclusion.get("predicate", "")).strip()
                if predicate and f"WHERE ({predicate})" not in raw:
                    add(errors, "SQL_TEMPORAL_EXCLUSION_PREDICATE_MISSING", table_name, constraint=identifier)
            else:
                if marker in raw:
                    add(
                        errors,
                        "SQL_APPEND_HISTORY_EXCLUSION_FORBIDDEN",
                        table_name,
                        constraint=identifier,
                    )
                comment = (
                    f"-- TEMPORAL_ARBITRATION {qualified} {identifier}: "
                    "RAW_HISTORY_EXCLUSION_NOT_MATERIALIZED; "
                    "APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS"
                )
                if comment not in raw:
                    add(
                        errors,
                        "SQL_TEMPORAL_ARBITRATION_MARKER_MISSING",
                        table_name,
                        constraint=identifier,
                    )

        contract = table_contract_by_name.get(table_name, {})
        contract_owner = contract.get("owner", {})
        if (
            contract_owner.get("service") != owner[0]
            or contract_owner.get("schema") != owner[1]
            or contract_owner.get("deploymentKey") != owner[2]
            or contract_owner.get("ownerBindingId") != expected_owner_binding(table)
            or contract_owner.get("boundedContext") != expected_bounded_context(table)
            or contract.get("ddlFile") != expected_file
        ):
            add(errors, "OUTPUT_TABLE_OWNER_MISMATCH", table_name)
        if set(contract.get("readers", [])) != source["readerMap"].get(table_name, set()):
            add(errors, "OUTPUT_TABLE_READER_DRIFT", table_name)
        if set(contract.get("producers", [])) != source["writerMap"].get(table_name, set()):
            add(errors, "OUTPUT_TABLE_PRODUCER_DRIFT", table_name)
        if contract.get("temporalArbitration") != table.get("temporalArbitration"):
            add(errors, "OUTPUT_TABLE_TEMPORAL_ARBITRATION_DRIFT", table_name)
        expected_temporal = [
            {
                **item,
                "physicalId": (
                    physical_identifier(item["constraintId"])
                    if materialize_temporal_exclusion(table, item)
                    else None
                ),
                "physicalization": (
                    "DATABASE_GIST_EXCLUSION"
                    if materialize_temporal_exclusion(table, item)
                    else "NOT_MATERIALIZED_APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS"
                ),
            }
            for item in table.get("temporalExclusionConstraints", [])
        ]
        if (contract.get("constraints") or {}).get("temporalExclusions") != expected_temporal:
            add(errors, "OUTPUT_TABLE_TEMPORAL_PHYSICALIZATION_DRIFT", table_name)

        unique_rows: list[tuple[str, list[str], str]] = [
            (
                f"uk_{table_name}_tenant_public_physical_v4",
                ["tenant_id", "public_id"],
                "DERIVED_COMMON_PUBLIC_ID",
            ),
            (
                f"uk_{table_name}_tenant_internal_physical_v4",
                ["tenant_id", id_column],
                "DERIVED_COMMON_INTERNAL_ID",
            ),
        ]
        seen_unique = {tuple(columns) for _name, columns, _source in unique_rows}
        for unique in table.get("uniqueKeys", []):
            columns = list(unique["columns"])
            if tuple(columns) not in seen_unique:
                seen_unique.add(tuple(columns))
                unique_rows.append((unique["constraintId"], columns, "CANONICAL_EXACT_SCHEMA"))
        expected_contract = {
            "tableId": table_name,
            "session": table.get("session"),
            "capabilityId": table.get("capabilityId"),
            "kind": table.get("kind"),
            "owner": expected_owner_dict(table),
            "qualifiedName": f"{owner[1]}.{table_name}",
            "ddlFile": expected_file,
            "idColumn": table.get("idColumn"),
            "commonColumnsRef": table.get("commonColumnsRef"),
            "columns": table.get("columns", []),
            "constraints": {
                "primaryKey": {
                    "source": "DERIVED_INTERNAL_ID",
                    "columns": [id_column],
                    "physicalId": physical_identifier(f"pk_{table_name}_physical_v4"),
                },
                "uniqueKeys": [
                    {
                        "sourceId": source_id,
                        "physicalId": physical_identifier(source_id),
                        "columns": columns,
                        "source": unique_source,
                    }
                    for source_id, columns, unique_source in unique_rows
                ],
                "checks": [
                    {**check, "physicalId": physical_identifier(check["constraintId"])}
                    for check in table.get("checks", [])
                ],
                "foreignKeys": [
                    {
                        **foreign_key,
                        "physicalId": (
                            physical_identifier(foreign_key["constraintId"])
                            if foreign_key.get("mode") == "LOCAL_COMPOSITE_FK"
                            else None
                        ),
                        "physicalization": (
                            "DATABASE_FOREIGN_KEY"
                            if foreign_key.get("mode") == "LOCAL_COMPOSITE_FK"
                            else "TYPED_OWNER_PORT_NO_DATABASE_FOREIGN_KEY"
                        ),
                    }
                    for foreign_key in table.get("foreignKeys", [])
                ],
                "indexes": [
                    {**index, "physicalId": physical_identifier(index["indexId"])}
                    for index in table.get("indexes", [])
                ],
                "temporalExclusions": expected_temporal,
            },
            "rowSecurity": table.get("rowSecurity"),
            "retentionPolicyRef": table.get("retentionPolicyRef"),
            "immutability": table.get("immutability"),
            "effectiveTime": table.get("effectiveTime"),
            "temporalArbitration": table.get("temporalArbitration"),
            "readers": sorted(source["readerMap"].get(table_name, set())),
            "producers": sorted(source["writerMap"].get(table_name, set())),
            "productionState": "NOT_AUTHORIZED_G6",
        }
        if contract != expected_contract:
            add(errors, "OUTPUT_TABLE_EXACT_CONTRACT_DRIFT", table_name)

    for row in physical_operations:
        mode = row.get("mode")
        if mode == "QUERY" and row.get("writePlan"):
            add(errors, "OUTPUT_QUERY_HAS_WRITE_PLAN", str(row.get("operationId")))
        home = row.get("homeOwner") or {}
        home_unit = (home.get("service"), home.get("schema"))
        for write in row.get("writePlan", []):
            if write.get("accessMode") != "OWNER_LOCAL_SQL" or (
                write.get("service"), write.get("schema")
            ) != home_unit:
                add(errors, "OUTPUT_CROSS_OWNER_WRITE", str(row.get("operationId")))
        for read in row.get("readPlan", []):
            local = (read.get("service"), read.get("schema")) == home_unit
            expected_mode = "OWNER_LOCAL_SQL" if local else "TYPED_OWNER_PORT_NO_CROSS_SCHEMA_SQL"
            if read.get("accessMode") != expected_mode:
                add(errors, "OUTPUT_READ_ACCESS_MODE_DRIFT", str(row.get("operationId")), table=read.get("tableId"))
    for row in physical_queries:
        if row.get("writesForbidden") is not True or row.get("receiptsForbidden") is not True or row.get("outboxForbidden") is not True:
            add(errors, "OUTPUT_QUERY_SIDE_EFFECT_GUARD_MISSING", str(row.get("operationId")))
        if row.get("directCrossOwnerSql") != "FORBIDDEN":
            add(errors, "OUTPUT_QUERY_CROSS_OWNER_GUARD_MISSING", str(row.get("operationId")))

    summary = {
        "canonicalFileSha256": {name: sha256(raw) for name, raw in canonical_raw.items()},
        "expansionPolicySha256": sha256(policy_raw),
        "physicalOwnerPrefixRegisterSha256": sha256(owner_register_raw),
        "physicalFileSha256": {name: sha256(raw) for name, raw in physical_raw.items()},
        "counts": source.get("counts", {}),
        "sqlTables": len(sql_tables_all),
        "operations": len(physical_operations),
        "queryProjections": len(physical_queries),
        "handlers": len(physical_handlers),
        "payModernOwnerTables": sum(
            table.get("session") == "HRIS-PAY" for table in source["tableByName"].values()
        ),
    }
    return errors, summary


def run_command(command: list[str], *, input_bytes: bytes | None = None, timeout: int = 180) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(
            command,
            input=input_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        captured = exc.stdout or b""
        if isinstance(captured, str):
            captured = captured.encode("utf-8", "replace")
        return subprocess.CompletedProcess(command, 124, captured + b"\nTIMEOUT")
    except OSError as exc:
        return subprocess.CompletedProcess(
            command, 127, f"OS_ERROR: {exc}".encode("utf-8", "replace")
        )


TEMPORAL_FIXTURE_SETUP_SQL = r"""
DROP SCHEMA IF EXISTS physical_temporal_fixture CASCADE;
CREATE SCHEMA physical_temporal_fixture;
CREATE TABLE physical_temporal_fixture.aggregate_root (
    tenant_id BIGINT NOT NULL,
    aggregate_id UUID NOT NULL,
    aggregate_version BIGINT NOT NULL,
    PRIMARY KEY (tenant_id, aggregate_id)
);
CREATE TABLE physical_temporal_fixture.revision_history (
    tenant_id BIGINT NOT NULL,
    aggregate_id UUID NOT NULL,
    fact_revision BIGINT NOT NULL,
    predecessor_revision BIGINT NULL,
    revision_mode VARCHAR(40) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    payload_digest CHAR(64) NOT NULL,
    PRIMARY KEY (tenant_id, aggregate_id, fact_revision),
    CHECK (effective_to IS NULL OR effective_to > effective_from),
    CHECK (
        (fact_revision = 1 AND predecessor_revision IS NULL)
        OR (fact_revision > 1 AND predecessor_revision = fact_revision - 1)
    )
);
INSERT INTO physical_temporal_fixture.aggregate_root
    (tenant_id, aggregate_id, aggregate_version)
VALUES
    (7, '00000000-0000-7000-8000-000000000001', 1);
INSERT INTO physical_temporal_fixture.revision_history
    (tenant_id, aggregate_id, fact_revision, predecessor_revision,
     revision_mode, effective_from, effective_to, recorded_at, payload_digest)
VALUES
    (7, '00000000-0000-7000-8000-000000000001', 1, NULL,
     'CREATE', DATE '2025-01-01', NULL, TIMESTAMPTZ '2026-01-01 00:00:00+00',
     repeat('a', 64));

DO $fixture$
DECLARE changed INTEGER;
BEGIN
    UPDATE physical_temporal_fixture.aggregate_root
       SET aggregate_version = 2
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND aggregate_version = 1;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
        RAISE EXCEPTION 'correction CAS expected exactly one row, got %', changed;
    END IF;
END
$fixture$;
INSERT INTO physical_temporal_fixture.revision_history
    (tenant_id, aggregate_id, fact_revision, predecessor_revision,
     revision_mode, effective_from, effective_to, recorded_at, payload_digest)
VALUES
    (7, '00000000-0000-7000-8000-000000000001', 2, 1,
     'CORRECTION', DATE '2025-01-01', NULL,
     TIMESTAMPTZ '2026-02-01 00:00:00+00', repeat('b', 64));

DO $fixture$
DECLARE before_correction CHAR(64); after_correction CHAR(64); predecessor CHAR(64);
BEGIN
    SELECT payload_digest INTO before_correction
      FROM physical_temporal_fixture.revision_history
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND effective_from <= DATE '2026-01-01'
       AND (effective_to IS NULL OR effective_to > DATE '2026-01-01')
       AND recorded_at <= TIMESTAMPTZ '2026-01-15 00:00:00+00'
     ORDER BY fact_revision DESC LIMIT 1;
    SELECT payload_digest INTO after_correction
      FROM physical_temporal_fixture.revision_history
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND effective_from <= DATE '2026-01-01'
       AND (effective_to IS NULL OR effective_to > DATE '2026-01-01')
       AND recorded_at <= TIMESTAMPTZ '2026-02-15 00:00:00+00'
     ORDER BY fact_revision DESC LIMIT 1;
    SELECT payload_digest INTO predecessor
      FROM physical_temporal_fixture.revision_history
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND fact_revision = 1;
    IF before_correction <> repeat('a', 64)
       OR after_correction <> repeat('b', 64)
       OR predecessor <> repeat('a', 64)
       OR (SELECT count(*) FROM physical_temporal_fixture.revision_history) <> 2 THEN
        RAISE EXCEPTION 'same-interval correction/system-as-of/predecessor immutability failed';
    END IF;
END
$fixture$;

DO $fixture$
DECLARE changed INTEGER;
BEGIN
    UPDATE physical_temporal_fixture.aggregate_root
       SET aggregate_version = 3
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND aggregate_version = 2;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
        RAISE EXCEPTION 'future supersede CAS expected exactly one row, got %', changed;
    END IF;
END
$fixture$;
INSERT INTO physical_temporal_fixture.revision_history
    (tenant_id, aggregate_id, fact_revision, predecessor_revision,
     revision_mode, effective_from, effective_to, recorded_at, payload_digest)
VALUES
    (7, '00000000-0000-7000-8000-000000000001', 3, 2,
     'SUPERSEDE', DATE '2030-01-01', NULL,
     TIMESTAMPTZ '2026-03-01 00:00:00+00', repeat('c', 64));

DO $fixture$
DECLARE current_payload CHAR(64); future_payload CHAR(64);
BEGIN
    SELECT payload_digest INTO current_payload
      FROM physical_temporal_fixture.revision_history
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND effective_from <= DATE '2029-12-31'
       AND (effective_to IS NULL OR effective_to > DATE '2029-12-31')
       AND recorded_at <= TIMESTAMPTZ '2026-04-01 00:00:00+00'
     ORDER BY fact_revision DESC LIMIT 1;
    SELECT payload_digest INTO future_payload
      FROM physical_temporal_fixture.revision_history
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND effective_from <= DATE '2030-01-01'
       AND (effective_to IS NULL OR effective_to > DATE '2030-01-01')
       AND recorded_at <= TIMESTAMPTZ '2026-04-01 00:00:00+00'
     ORDER BY fact_revision DESC LIMIT 1;
    IF current_payload <> repeat('b', 64) OR future_payload <> repeat('c', 64) THEN
        RAISE EXCEPTION 'future supersede business-as-of arbitration failed';
    END IF;
END
$fixture$;
""".encode("utf-8")


TEMPORAL_RACE_WINNER_SQL = r"""
BEGIN;
DO $fixture$
DECLARE changed INTEGER;
BEGIN
    UPDATE physical_temporal_fixture.aggregate_root
       SET aggregate_version = 4
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND aggregate_version = 3;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
        RAISE EXCEPTION 'winner CAS expected exactly one row, got %', changed;
    END IF;
    INSERT INTO physical_temporal_fixture.revision_history
        (tenant_id, aggregate_id, fact_revision, predecessor_revision,
         revision_mode, effective_from, effective_to, recorded_at, payload_digest)
    VALUES
        (7, '00000000-0000-7000-8000-000000000001', 4, 3,
         'SUPERSEDE', DATE '2040-01-01', NULL,
         TIMESTAMPTZ '2026-04-01 00:00:00+00', repeat('d', 64));
    PERFORM pg_sleep(2);
END
$fixture$;
COMMIT;
""".encode("utf-8")


TEMPORAL_RACE_LOSER_SQL = r"""
BEGIN;
DO $fixture$
DECLARE changed INTEGER;
BEGIN
    UPDATE physical_temporal_fixture.aggregate_root
       SET aggregate_version = 4
     WHERE tenant_id = 7
       AND aggregate_id = '00000000-0000-7000-8000-000000000001'
       AND aggregate_version = 3;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN
        RAISE EXCEPTION 'loser CAS mutated %, expected zero', changed;
    END IF;
END
$fixture$;
COMMIT;
""".encode("utf-8")


TEMPORAL_RACE_ASSERT_SQL = r"""
DO $fixture$
BEGIN
    IF (SELECT aggregate_version
          FROM physical_temporal_fixture.aggregate_root
         WHERE tenant_id = 7
           AND aggregate_id = '00000000-0000-7000-8000-000000000001') <> 4
       OR (SELECT count(*)
             FROM physical_temporal_fixture.revision_history
            WHERE tenant_id = 7
              AND aggregate_id = '00000000-0000-7000-8000-000000000001'
              AND fact_revision = 4) <> 1 THEN
        RAISE EXCEPTION 'same expected-version race did not produce exactly one revision';
    END IF;
END
$fixture$;
""".encode("utf-8")


def docker_psql(name: str, database: str, *, application_name: str | None = None) -> list[str]:
    command = ["docker", "exec"]
    if application_name:
        command.extend(["-e", f"PGAPPNAME={application_name}"])
    command.extend([
        "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1",
        "-U", "postgres", "-d", database,
    ])
    return command


def docker_temporal_arbitration_fixture(name: str, database: str) -> dict[str, Any]:
    result: dict[str, Any] = {
        "strategy": SUPPORTED_TEMPORAL_ARBITRATION,
        "status": "FAIL",
        "cases": {
            "sameIntervalCorrectionAndSystemAsOf": "NOT_RUN",
            "futureSupersedeBusinessAsOf": "NOT_RUN",
            "concurrentSameExpectedVersion": "NOT_RUN",
        },
    }
    setup = run_command(
        docker_psql(name, database), input_bytes=TEMPORAL_FIXTURE_SETUP_SQL, timeout=60
    )
    result["setupOutputTail"] = setup.stdout.decode("utf-8", "replace")[-4000:]
    if setup.returncode != 0:
        return result
    result["cases"]["sameIntervalCorrectionAndSystemAsOf"] = "PASS"
    result["cases"]["futureSupersedeBusinessAsOf"] = "PASS"

    winner = subprocess.Popen(
        docker_psql(name, database, application_name="dwp-hris-temporal-cas-winner"),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    assert winner.stdin is not None
    winner.stdin.write(TEMPORAL_RACE_WINNER_SQL)
    winner.stdin.close()
    winner_sleeping = False
    for _ in range(40):
        probe = run_command(
            docker_psql(name, database),
            input_bytes=(
                b"SELECT count(*) FROM pg_stat_activity "
                b"WHERE application_name='dwp-hris-temporal-cas-winner' "
                b"AND wait_event='PgSleep';\n"
            ),
            timeout=10,
        )
        if probe.returncode == 0 and re.search(rb"\n\s*1\s*\n", probe.stdout):
            winner_sleeping = True
            break
        time.sleep(0.1)
    if not winner_sleeping:
        winner.kill()
        winner.wait(timeout=10)
        result["raceError"] = "winner transaction never reached locked PgSleep barrier"
        if winner.stdout is not None:
            result["winnerOutputTail"] = winner.stdout.read().decode("utf-8", "replace")[-4000:]
        return result

    loser = run_command(
        docker_psql(name, database, application_name="dwp-hris-temporal-cas-loser"),
        input_bytes=TEMPORAL_RACE_LOSER_SQL,
        timeout=60,
    )
    try:
        winner_code = winner.wait(timeout=60)
    except subprocess.TimeoutExpired:
        winner.kill()
        winner_code = winner.wait(timeout=10)
    winner_output = (
        winner.stdout.read().decode("utf-8", "replace")[-4000:]
        if winner.stdout is not None
        else ""
    )
    result["winnerOutputTail"] = winner_output
    result["loserOutputTail"] = loser.stdout.decode("utf-8", "replace")[-4000:]
    if winner_code != 0 or loser.returncode != 0:
        return result
    assertion = run_command(
        docker_psql(name, database), input_bytes=TEMPORAL_RACE_ASSERT_SQL, timeout=30
    )
    result["assertOutputTail"] = assertion.stdout.decode("utf-8", "replace")[-4000:]
    if assertion.returncode != 0:
        return result
    result["cases"]["concurrentSameExpectedVersion"] = "PASS"
    result["status"] = "PASS"
    return result


def docker_postgres_check(physical_raw: dict[str, bytes], tag: str) -> dict[str, Any]:
    name = f"dwp-hris-physical-{tag.replace('.', '-')}-{uuid.uuid4().hex[:10]}"
    image = f"postgres:{tag}"
    result: dict[str, Any] = {
        "requestedImage": image,
        "status": "FAIL",
        "databases": {},
        "container": name,
        "inputFileSha256": {key: sha256(value) for key, value in sorted(physical_raw.items())},
        "temporalFixtureSha256": {
            "setup": sha256(TEMPORAL_FIXTURE_SETUP_SQL),
            "raceWinner": sha256(TEMPORAL_RACE_WINNER_SQL),
            "raceLoser": sha256(TEMPORAL_RACE_LOSER_SQL),
            "raceAssert": sha256(TEMPORAL_RACE_ASSERT_SQL),
        },
    }
    pulled = run_command(["docker", "pull", image], timeout=300)
    result["pullOutputTail"] = pulled.stdout.decode("utf-8", "replace")[-4000:]
    if pulled.returncode != 0:
        result["error"] = "image pull failed"
        return sealed_copy(result)
    inspected = run_command(["docker", "image", "inspect", image], timeout=60)
    if inspected.returncode != 0:
        result["error"] = inspected.stdout.decode("utf-8", "replace")[-4000:]
        return sealed_copy(result)
    try:
        image_metadata = json.loads(inspected.stdout)[0]
        image_id = image_metadata["Id"]
        repository_digests = sorted(image_metadata.get("RepoDigests") or [])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        result["error"] = f"image metadata parse failure: {exc}"
        return sealed_copy(result)
    if not isinstance(image_id, str) or not image_id.startswith("sha256:"):
        result["error"] = "resolved image ID is not immutable"
        return sealed_copy(result)
    if not repository_digests or any("@sha256:" not in item for item in repository_digests):
        result["error"] = "repository digest binding is unavailable"
        return sealed_copy(result)
    result["imageId"] = image_id
    result["repositoryDigests"] = repository_digests
    started = run_command([
        "docker", "run", "--detach", "--name", name,
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image_id,
    ], timeout=180)
    if started.returncode != 0:
        result["error"] = started.stdout.decode("utf-8", "replace")[-4000:]
        return sealed_copy(result)
    try:
        container_inspect = run_command(
            ["docker", "inspect", "--format", "{{.Image}}", name], timeout=30
        )
        container_image_id = container_inspect.stdout.decode("utf-8", "replace").strip()
        result["containerImageId"] = container_image_id
        if container_inspect.returncode != 0 or container_image_id != image_id:
            result["error"] = "running container image does not match resolved immutable image ID"
            return result
        ready = False
        for _ in range(90):
            probe = run_command(["docker", "exec", name, "pg_isready", "-U", "postgres"], timeout=15)
            if probe.returncode == 0:
                ready = True
                break
            time.sleep(1)
        if not ready:
            result["error"] = "container did not become ready"
            return result
        db_files: dict[str, list[str]] = {}
        for filename, (database, _service) in SQL_FILES.items():
            db_files.setdefault(database, []).append(filename)
        for database, filenames in db_files.items():
            create = run_command(
                ["docker", "exec", name, "createdb", "-U", "postgres", database], timeout=30
            )
            if create.returncode != 0:
                result["databases"][database] = {
                    "status": "FAIL_CREATE_DB",
                    "output": create.stdout.decode("utf-8", "replace")[-4000:],
                }
                continue
            extension_sql = b"CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS btree_gist;\n"
            extension = run_command(
                docker_psql(name, database),
                input_bytes=extension_sql,
                timeout=60,
            )
            db_result: dict[str, Any] = {"status": "PASS", "files": []}
            if extension.returncode != 0:
                db_result = {
                    "status": "FAIL_EXTENSION",
                    "output": extension.stdout.decode("utf-8", "replace")[-4000:],
                }
                result["databases"][database] = db_result
                continue
            # Preserve deterministic HRM-before-PER ordering in the shared People DB.
            filenames.sort(key=lambda value: list(SQL_FILES).index(value))
            role_pairs = sorted({SQL_ROLES[filename] for filename in filenames})
            role_sql = "".join(
                f"CREATE ROLE {migration} NOLOGIN NOINHERIT NOBYPASSRLS; "
                f"CREATE ROLE {runtime} NOLOGIN NOINHERIT NOBYPASSRLS; "
                f"GRANT {migration} TO postgres; "
                f"GRANT CREATE ON DATABASE \"{database}\" TO {migration}; "
                f"GRANT USAGE, CREATE ON SCHEMA public TO {migration}; "
                for migration, runtime in role_pairs
            ).encode("utf-8")
            roles = run_command(
                docker_psql(name, database), input_bytes=role_sql, timeout=30
            )
            db_result["roleProvisioning"] = {
                "status": "PASS" if roles.returncode == 0 else "FAIL",
                "outputTail": roles.stdout.decode("utf-8", "replace")[-4000:],
            }
            if roles.returncode != 0:
                db_result["status"] = "FAIL_ROLE_PROVISIONING"
                result["databases"][database] = db_result
                continue
            for filename in filenames:
                migration_role, _runtime_role = SQL_ROLES[filename]
                execution = run_command(
                    docker_psql(name, database),
                    input_bytes=(f"SET ROLE {migration_role};\n".encode("utf-8") + physical_raw[filename]),
                    timeout=180,
                )
                entry = {
                    "file": filename,
                    "status": "PASS" if execution.returncode == 0 else "FAIL",
                    "outputTail": execution.stdout.decode("utf-8", "replace")[-4000:],
                }
                db_result["files"].append(entry)
                if execution.returncode != 0:
                    db_result["status"] = "FAIL"
                    break
            if db_result["status"] == "PASS":
                assertions: list[str] = []
                runtime_rls_tables: dict[str, list[str]] = {}
                for filename in filenames:
                    migration_role, runtime_role = SQL_ROLES[filename]
                    for table_name, details in parse_sql_tables(
                        physical_raw[filename].decode("utf-8")
                    ).items():
                        qualified = f"{details['schema']}.{table_name}"
                        runtime_rls_tables.setdefault(runtime_role, []).append(qualified)
                        identity_columns = [
                            line.strip().split()[0]
                            for line in details["body"].splitlines()
                            if "GENERATED BY DEFAULT AS IDENTITY" in line
                        ]
                        if len(identity_columns) != 1:
                            raise ValueError(
                                f"expected exactly one identity column for {qualified}"
                            )
                        identity_column = identity_columns[0]
                        assertions.extend([
                            f"IF (SELECT tableowner <> '{migration_role}' FROM pg_tables WHERE schemaname='{details['schema']}' AND tablename='{table_name}') THEN RAISE EXCEPTION 'owner:{qualified}'; END IF;",
                            f"IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='{details['schema']}' AND c.relname='{table_name}') THEN RAISE EXCEPTION 'rls:{qualified}'; END IF;",
                            f"IF NOT (has_table_privilege('{runtime_role}','{qualified}','SELECT') AND has_table_privilege('{runtime_role}','{qualified}','INSERT') AND has_table_privilege('{runtime_role}','{qualified}','UPDATE') AND has_table_privilege('{runtime_role}','{qualified}','DELETE')) THEN RAISE EXCEPTION 'positive_acl:{qualified}'; END IF;",
                            f"IF has_table_privilege('{runtime_role}','{qualified}','TRUNCATE,REFERENCES,TRIGGER') THEN RAISE EXCEPTION 'excess_acl:{qualified}'; END IF;",
                            f"IF has_schema_privilege('{runtime_role}','{details['schema']}','CREATE') OR NOT has_schema_privilege('{runtime_role}','{details['schema']}','USAGE') THEN RAISE EXCEPTION 'schema_acl:{qualified}'; END IF;",
                            f"IF NOT (has_sequence_privilege('{runtime_role}',pg_get_serial_sequence('{qualified}','{identity_column}'),'USAGE') AND has_sequence_privilege('{runtime_role}',pg_get_serial_sequence('{qualified}','{identity_column}'),'SELECT')) OR has_sequence_privilege('{runtime_role}',pg_get_serial_sequence('{qualified}','{identity_column}'),'UPDATE') THEN RAISE EXCEPTION 'sequence_acl:{qualified}'; END IF;",
                            f"IF (SELECT pg_get_userbyid(relowner) <> '{migration_role}' FROM pg_class WHERE oid=pg_get_serial_sequence('{qualified}','{identity_column}')::regclass) THEN RAISE EXCEPTION 'sequence_owner:{qualified}'; END IF;",
                        ])
                        if details["schema"] != "public":
                            assertions.append(
                                f"IF (SELECT pg_get_userbyid(nspowner) <> '{migration_role}' FROM pg_namespace WHERE nspname='{details['schema']}') THEN RAISE EXCEPTION 'schema_owner:{details['schema']}'; END IF;"
                            )
                rls_blocks = []
                for runtime_role, qualified_tables in sorted(runtime_rls_tables.items()):
                    checks = " ".join(
                        f"IF NOT row_security_active('{qualified}') THEN RAISE EXCEPTION 'runtime_rls:{qualified}'; END IF;"
                        for qualified in sorted(qualified_tables)
                    )
                    rls_blocks.append(
                        f"SET ROLE {runtime_role}; DO $runtime_rls$ BEGIN {checks} END $runtime_rls$; RESET ROLE;"
                    )
                acl_sql = (
                    "DO $acl_assert$ BEGIN "
                    + " ".join(assertions)
                    + " END $acl_assert$;\n"
                    + "\n".join(rls_blocks)
                    + "\n"
                ).encode("utf-8")
                acl = run_command(
                    docker_psql(name, database), input_bytes=acl_sql, timeout=60
                )
                db_result["roleRlsAclAssertions"] = {
                    "status": "PASS" if acl.returncode == 0 else "FAIL",
                    "outputTail": acl.stdout.decode("utf-8", "replace")[-4000:],
                }
                if acl.returncode != 0:
                    db_result["status"] = "FAIL_ROLE_RLS_ACL"
            result["databases"][database] = db_result
        ddl_passed = (
            len(result["databases"]) == 4
            and all(row.get("status") == "PASS" for row in result["databases"].values())
        )
        if ddl_passed:
            result["temporalArbitration"] = docker_temporal_arbitration_fixture(
                name, "dwp-people"
            )
        else:
            result["temporalArbitration"] = {"status": "NOT_RUN_DDL_FAILED"}
        temporal = result["temporalArbitration"]
        expected_temporal_cases = {
            "sameIntervalCorrectionAndSystemAsOf",
            "futureSupersedeBusinessAsOf",
            "concurrentSameExpectedVersion",
        }
        temporal_cases = temporal.get("cases") or {}
        temporal_passed = (
            temporal.get("status") == "PASS"
            and set(temporal_cases) == expected_temporal_cases
            and all(value == "PASS" for value in temporal_cases.values())
        )
        result["status"] = (
            "PASS"
            if ddl_passed
            and temporal_passed
            else "FAIL"
        )
        return result
    finally:
        try:
            cleanup = run_command(["docker", "rm", "--force", name], timeout=60)
            result["cleanup"] = "PASS" if cleanup.returncode == 0 else "FAIL"
            if cleanup.returncode != 0:
                result["cleanupOutputTail"] = cleanup.stdout.decode("utf-8", "replace")[-4000:]
        finally:
            result.pop("sealedPayloadSha256", None)
            result["sealedPayloadSha256"] = sha256(canonical_payload(result))


def load_regular_files(root: Path, expected: set[str] | frozenset[str]) -> tuple[dict[str, bytes], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    try:
        root = absolute_lexical(root)
        root_fd = open_directory_nofollow(root)
    except (OSError, ValueError) as exc:
        add(errors, "DIRECTORY_NOT_SECURE", str(root), detail=str(exc))
        return {}, errors
    result = {}
    try:
        actual = set(os.listdir(root_fd))
        if actual != set(expected):
            add(errors, "FILE_SET_MISMATCH", str(root), expected=sorted(expected), actual=sorted(actual))
        for name in expected:
            try:
                result[name] = read_regular_at(root_fd, name)
            except (OSError, ValueError) as exc:
                add(errors, "FILE_NOT_REGULAR", str(root / name), detail=str(exc))
        try:
            assert_directory_binding(root, root_fd)
        except (OSError, ValueError) as exc:
            add(errors, "DIRECTORY_CHANGED_DURING_READ", str(root), detail=str(exc))
        return result, errors
    finally:
        os.close(root_fd)


def normalized_postgres_observation(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": result.get("status"),
        "cleanup": result.get("cleanup"),
        "inputFileSha256": result.get("inputFileSha256"),
        "databases": {
            name: {
                "status": row.get("status"),
                "files": [
                    {"file": item.get("file"), "status": item.get("status")}
                    for item in row.get("files", [])
                ],
                "roleProvisioning": (row.get("roleProvisioning") or {}).get("status"),
                "roleRlsAclAssertions": (row.get("roleRlsAclAssertions") or {}).get("status"),
            }
            for name, row in sorted((result.get("databases") or {}).items())
        },
        "temporalCases": (result.get("temporalArbitration") or {}).get("cases"),
        "temporalStatus": (result.get("temporalArbitration") or {}).get("status"),
    }


def self_test(
    canonical_raw: dict[str, bytes],
    canonical: dict[str, dict[str, Any]],
    policy_raw: bytes,
    policy: dict[str, Any],
    owner_register_raw: bytes,
    owner_register: dict[str, dict[str, str]],
    physical_raw: dict[str, bytes],
    physical_json: dict[str, dict[str, Any]],
    canonical_directory_name: str | None = None,
    policy_filename: str = "",
    profile_name: str = "v3-132-historical",
) -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    baseline_findings, _baseline_summary = validate_candidate_data(
        canonical_raw,
        canonical,
        policy_raw,
        policy,
        owner_register_raw,
        owner_register,
        physical_raw,
        physical_json,
        canonical_directory_name,
        policy_filename,
        profile_name,
    )
    baseline_signatures = {
        (row.get("code"), row.get("subject")) for row in baseline_findings
    }

    def reseal_output(
        name: str,
        physical_bytes: dict[str, bytes],
        physical_documents: dict[str, dict[str, Any]],
    ) -> None:
        if name in physical_documents:
            physical_documents[name] = sealed_copy(physical_documents[name])
            physical_bytes[name] = pretty_json_bytes(physical_documents[name])
        generation = physical_documents[REPORT_FILE]
        if name != REPORT_FILE:
            generation["outputFiles"][name] = {
                "sha256": sha256(physical_bytes[name]),
                "bytes": len(physical_bytes[name]),
            }
        physical_documents[REPORT_FILE] = sealed_copy(generation)
        physical_bytes[REPORT_FILE] = pretty_json_bytes(physical_documents[REPORT_FILE])

    def mutation(name: str, mutate: Any) -> None:
        c_raw = copy.deepcopy(canonical_raw)
        c_doc = copy.deepcopy(canonical)
        p_raw = copy.deepcopy(physical_raw)
        p_doc = copy.deepcopy(physical_json)
        mutate(c_raw, c_doc, p_raw, p_doc)
        findings, _ = validate_candidate_data(
            c_raw,
            c_doc,
            policy_raw,
            policy,
            owner_register_raw,
            owner_register,
            p_raw,
            p_doc,
            canonical_directory_name,
            policy_filename,
            profile_name,
        )
        new_signatures = {
            (row.get("code"), row.get("subject")) for row in findings
        } - baseline_signatures
        cases.append({
            "testId": name,
            "status": "PASS" if new_signatures else "FAIL",
            "newFindings": [
                {"code": code, "subject": subject}
                for code, subject in sorted(new_signatures)
            ],
        })

    if profile_name in {
        "v5-131-successor", "v6-131-owner-dependency-successor",
    }:
        cases.append({
            "testId": "v5-full-exact-eight-baseline-accepted",
            "status": "PASS" if not baseline_findings else "FAIL",
            "newFindings": [],
        })

        def remove_causal_publication(
            cr: dict[str, bytes],
            cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes],
            _pd: dict[str, dict[str, Any]],
        ) -> None:
            cr.pop(CAUSAL_STATE_NAME, None)
            cd.pop(CAUSAL_STATE_NAME, None)

        mutation("v5-missing-causal-publication-rejected", remove_causal_publication)

        def mutate_causal_self_seal(
            cr: dict[str, bytes],
            cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes],
            _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[CAUSAL_STATE_NAME]["policies"]["commandOrder"] = "HOSTILE"
            cr[CAUSAL_STATE_NAME] = pretty_json_bytes(cd[CAUSAL_STATE_NAME])

        mutation("v5-causal-self-seal-mutation-rejected", mutate_causal_self_seal)

        def reseal_causal_wrong_source_pin(
            cr: dict[str, bytes],
            cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes],
            _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[CAUSAL_STATE_NAME]["canonicalSourcePins"][EXACT_NAME] = "0" * 64
            cd[CAUSAL_STATE_NAME] = sealed_copy(cd[CAUSAL_STATE_NAME])
            cr[CAUSAL_STATE_NAME] = pretty_json_bytes(cd[CAUSAL_STATE_NAME])

        mutation("v5-resealed-causal-wrong-source-pin-rejected", reseal_causal_wrong_source_pin)

        def reseal_causal_manifest_link_drift(
            cr: dict[str, bytes],
            cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes],
            _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[CAUSAL_STATE_NAME]["closedSetManifest"]["sealedPayloadSha256"] = "0" * 64
            cd[CAUSAL_STATE_NAME] = sealed_copy(cd[CAUSAL_STATE_NAME])
            cr[CAUSAL_STATE_NAME] = pretty_json_bytes(cd[CAUSAL_STATE_NAME])

        mutation("v5-resealed-causal-manifest-link-drift-rejected", reseal_causal_manifest_link_drift)

    if profile_name == "v6-131-owner-dependency-successor":
        cases.append({
            "testId": "v6-global-owner-dependency-baseline-accepted",
            "status": "PASS" if not baseline_findings else "FAIL",
            "newFindings": [],
        })

        def mutate_dependency_manifest_count(
            cr: dict[str, bytes], cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes], _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[MANIFEST_NAME]["scope"]["ownerDependencyContracts"] = 1
            cd[MANIFEST_NAME] = sealed_copy(cd[MANIFEST_NAME])
            cr[MANIFEST_NAME] = pretty_json_bytes(cd[MANIFEST_NAME])

        mutation("v6-owner-dependency-count-drift-rejected", mutate_dependency_manifest_count)

        def mutate_dependency_seal(
            cr: dict[str, bytes], cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes], _pd: dict[str, dict[str, Any]],
        ) -> None:
            row = next(
                item for item in cd[OPERATION_NAME]["ownerDependencyContracts"]
                if item.get("dependencyContractId")
                == "compensation.resolveApprovedSnapshotForPayroll.v1"
            )
            row["sealedPayloadSha256"] = "0" * 64
            cr[OPERATION_NAME] = pretty_json_bytes(cd[OPERATION_NAME])

        mutation("v6-owner-dependency-seal-drift-rejected", mutate_dependency_seal)

        def mutate_dependency_projection(
            cr: dict[str, bytes], cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes], _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[EXACT_NAME]["ownerDependencyContracts"] = cd[EXACT_NAME][
                "ownerDependencyContracts"
            ][:-1]
            cr[EXACT_NAME] = pretty_json_bytes(cd[EXACT_NAME])

        mutation("v6-owner-dependency-projection-drift-rejected", mutate_dependency_projection)

        def mutate_listening_local_count(
            cr: dict[str, bytes], cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes], _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[LISTENING_AUTHORITY_NAME]["exactCounts"][
                "ownerDependencyContracts"
            ] = 2
            cd[LISTENING_AUTHORITY_NAME] = sealed_copy(
                cd[LISTENING_AUTHORITY_NAME]
            )
            cr[LISTENING_AUTHORITY_NAME] = pretty_json_bytes(
                cd[LISTENING_AUTHORITY_NAME]
            )

        mutation("v6-listening-local-dependency-count-drift-rejected", mutate_listening_local_count)

    mutation(
        "mutate-handler-contract-seal",
        lambda _cr, _cd, pr, pd: (
            pd[HANDLER_FILE].__setitem__("handlerCount", 24),
            pr.__setitem__(HANDLER_FILE, json.dumps(pd[HANDLER_FILE]).encode()),
        ),
    )
    mutation(
        "remove-handler",
        lambda _cr, _cd, pr, pd: (
            pd[HANDLER_FILE].__setitem__("handlers", pd[HANDLER_FILE]["handlers"][:-1]),
            pr.__setitem__(HANDLER_FILE, json.dumps(pd[HANDLER_FILE]).encode()),
        ),
    )
    mutation(
        "remove-sql-table",
        lambda _cr, _cd, pr, _pd: pr.__setitem__(
            "hrm-modern-forward-ddl.v4.sql",
            re.sub(
                rb"CREATE TABLE .*?\n\);",
                b"",
                pr["hrm-modern-forward-ddl.v4.sql"],
                count=1,
                flags=re.S,
            ),
        ),
    )
    mutation(
        "remove-force-rls",
        lambda _cr, _cd, pr, _pd: pr.__setitem__(
            "per-modern-forward-ddl.v4.sql",
            pr["per-modern-forward-ddl.v4.sql"].replace(b" FORCE ROW LEVEL SECURITY;", b";", 1),
        ),
    )
    def tamper_query_read_access_mode(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        # A candidate can legitimately contain only owner-local reads.  Tamper
        # any concrete read plan rather than assuming an optional cross-owner
        # row exists, so this remains a closed regression in either topology.
        read = next(
            read
            for operation in pd[QUERY_FILE]["operationPhysicalContracts"]
            for read in operation["readPlan"]
        )
        read["accessMode"] = "HOSTILE_ACCESS_MODE"
        pr[QUERY_FILE] = json.dumps(pd[QUERY_FILE]).encode()

    mutation("query-read-access-mode-tamper-rejected", tamper_query_read_access_mode)
    mutation(
        "canonical-source-byte-pin",
        lambda cr, _cd, _pr, _pd: cr.__setitem__(MANIFEST_NAME, cr[MANIFEST_NAME] + b" "),
    )
    def remove_required_canonical_seal(
        cr: dict[str, bytes],
        cd: dict[str, dict[str, Any]],
        _pr: dict[str, bytes],
        _pd: dict[str, dict[str, Any]],
    ) -> None:
        cd[MANIFEST_NAME].pop("sealedPayloadSha256", None)
        cr[MANIFEST_NAME] = pretty_json_bytes(cd[MANIFEST_NAME])

    mutation("required-canonical-self-seal-removed", remove_required_canonical_seal)

    def mutate_manifest_reference(
        cr: dict[str, bytes],
        cd: dict[str, dict[str, Any]],
        _pr: dict[str, bytes],
        _pd: dict[str, dict[str, Any]],
    ) -> None:
        target = CANONICAL_FILES[1]
        cd[target]["closedSetManifest"]["sealedPayloadSha256"] = "0" * 64
        cr[target] = pretty_json_bytes(cd[target])

    mutation("canonical-manifest-reference-drift", mutate_manifest_reference)
    mutation(
        "table-owner-schema-drift",
        lambda _cr, _cd, pr, pd: (
            pd[QUERY_FILE]["tablePhysicalContracts"][0]["owner"].__setitem__("schema", "wrong"),
            pr.__setitem__(QUERY_FILE, json.dumps(pd[QUERY_FILE]).encode()),
        ),
    )
    mutation(
        "query-side-effect-guard-removed",
        lambda _cr, _cd, pr, pd: (
            pd[QUERY_FILE]["queryProjectionPhysicalContracts"][0].__setitem__("writesForbidden", False),
            pr.__setitem__(QUERY_FILE, json.dumps(pd[QUERY_FILE]).encode()),
        ),
    )
    def mutate_query_method(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        pd[QUERY_FILE]["operationPhysicalContracts"][0]["method"] = "TRACE"
        reseal_output(QUERY_FILE, pr, pd)

    mutation("resealed-query-method-drift", mutate_query_method)

    def mutate_handler_trigger(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        pd[HANDLER_FILE]["handlers"][0]["trigger"] = "ATTACKER_TRIGGER"
        reseal_output(HANDLER_FILE, pr, pd)

    mutation("resealed-handler-trigger-drift", mutate_handler_trigger)

    def mutate_sql_type(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        name = "hrm-modern-forward-ddl.v4.sql"
        pr[name] = pr[name].replace(b"    tenant_id BIGINT NOT NULL", b"    tenant_id INTEGER NOT NULL", 1)
        reseal_output(name, pr, pd)

    mutation("resealed-sql-column-type-drift", mutate_sql_type)

    def mutate_runtime_grant(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        name = "hrm-modern-forward-ddl.v4.sql"
        pr[name] = pr[name].replace(
            b"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE",
            b"GRANT SELECT ON TABLE",
            1,
        )
        reseal_output(name, pr, pd)

    mutation("resealed-runtime-grant-drift", mutate_runtime_grant)

    def mutate_scope_profile_pin(
        _cr: dict[str, bytes],
        _cd: dict[str, dict[str, Any]],
        pr: dict[str, bytes],
        pd: dict[str, dict[str, Any]],
    ) -> None:
        hostile = (
            "v4-131-successor"
            if profile_name == "v3-132-historical"
            else "v3-132-historical"
        )
        for name in (HANDLER_FILE, QUERY_FILE, REPORT_FILE):
            pd[name]["sourceCanonical"]["scopeProfile"] = hostile
            reseal_output(name, pr, pd)

    mutation("v3-v4-scope-profile-confusion", mutate_scope_profile_pin)

    def mutate_count_spoof(
        cr: dict[str, bytes],
        cd: dict[str, dict[str, Any]],
        _pr: dict[str, bytes],
        _pd: dict[str, dict[str, Any]],
    ) -> None:
        cd[MANIFEST_NAME]["handlerIds"].append("hostile.count-spoof")
        cd[MANIFEST_NAME] = sealed_copy(cd[MANIFEST_NAME])
        cr[MANIFEST_NAME] = pretty_json_bytes(cd[MANIFEST_NAME])

    mutation("canonical-count-spoof", mutate_count_spoof)

    if profile_name != "v3-132-historical":
        def mutate_removed_table_dangling(
            cr: dict[str, bytes],
            cd: dict[str, dict[str, Any]],
            _pr: dict[str, bytes],
            _pd: dict[str, dict[str, Any]],
        ) -> None:
            cd[EXACT_NAME]["operationBindings"][0].setdefault("readsTables", []).append(
                REMOVED_LISTENING_TABLE
            )
            cr[EXACT_NAME] = pretty_json_bytes(cd[EXACT_NAME])

        mutation("removed-table-dangling-reference", mutate_removed_table_dangling)

    drifted_policy = copy.deepcopy(policy)
    drifted_policy["policyId"] = str(drifted_policy.get("policyId")) + "-HOSTILE"
    drifted_policy = sealed_copy(drifted_policy)
    drifted_policy_raw = pretty_json_bytes(drifted_policy)
    policy_findings, _ = validate_candidate_data(
        canonical_raw,
        canonical,
        drifted_policy_raw,
        drifted_policy,
        owner_register_raw,
        owner_register,
        physical_raw,
        physical_json,
        canonical_directory_name,
        policy_filename,
        profile_name,
    )
    policy_new = {
        (row.get("code"), row.get("subject")) for row in policy_findings
    } - baseline_signatures
    cases.append({
        "testId": "resealed-policy-identity-drift",
        "status": "PASS" if policy_new else "FAIL",
        "newFindings": [
            {"code": code, "subject": subject}
            for code, subject in sorted(policy_new)
        ],
    })
    passed = sum(row["status"] == "PASS" for row in cases)
    return sealed_copy({
        "reportId": "dwp.hris.modern.physical-candidate-validator-hostile-self-test.v1",
        "status": "PASS" if passed == len(cases) else "FAIL",
        "cases": cases,
        "passed": passed,
        "total": len(cases),
    })


def tool_hostile_self_test() -> dict[str, Any]:
    cases: list[dict[str, Any]] = []

    def check(test_id: str, passed: bool) -> None:
        cases.append({"testId": test_id, "status": "PASS" if passed else "FAIL"})

    check("missing-self-seal-rejected", not self_sealed({"value": 1}))
    check("unsafe-check-function-rejected", not sql_fragment_is_safe("pg_read_file('/etc/passwd') IS NOT NULL"))
    check("unsafe-default-function-rejected", not sql_default_is_safe("nextval('attacker.sequence')"))
    check("canonical-check-grammar-accepted", sql_fragment_is_safe("status IN ('ACTIVE','RETIRED')"))
    check("canonical-default-grammar-accepted", sql_default_is_safe("repeat('0', 64)"))
    empty_jsonb_cases = {
        "empty-jsonb-static-array-accepted": ("measure_values='[]'::jsonb", True),
        "empty-jsonb-suppression-accepted": (
            "subject_count>=0 AND (measure_values IS NULL OR measure_values='[]'::jsonb)",
            True,
        ),
        "empty-jsonb-object-rejected": ("measure_values='{}'::jsonb", False),
        "empty-jsonb-nonempty-array-rejected": ("measure_values='[1]'::jsonb", False),
        "empty-jsonb-different-cast-rejected": ("measure_values='[]'::text", False),
        "empty-jsonb-identifier-cast-rejected": ("measure_values=payload::jsonb", False),
        "empty-jsonb-statement-rejected": ("measure_values='[]'::jsonb;SELECT 1", False),
        "empty-jsonb-function-rejected": ("pg_read_file('x')='[]'::jsonb", False),
        "empty-jsonb-line-comment-rejected": ("measure_values='[]'::jsonb--x", False),
        "empty-jsonb-block-comment-rejected": ("measure_values='[]'::jsonb/*x*/", False),
        "empty-jsonb-union-rejected": ("measure_values='[]'::jsonb UNION SELECT 1", False),
        "empty-jsonb-case-variant-rejected": ("measure_values='[]'::JSONB", False),
    }
    for test_id, (expression, expected) in empty_jsonb_cases.items():
        check(test_id, sql_fragment_is_safe(expression) is expected)
    sql_type_cases = {
        "sql-type-text-accepted": ("TEXT", True),
        "sql-type-varchar-accepted": ("VARCHAR(512)", True),
        "sql-type-jsonb-accepted": ("JSONB", True),
        "sql-type-lowercase-rejected": ("text", False),
        "sql-type-array-rejected": ("TEXT[]", False),
        "sql-type-statement-rejected": ("TEXT;DROP TABLE x", False),
        "sql-type-collation-rejected": ("TEXT COLLATE x", False),
        "sql-type-constraint-rejected": ("TEXT NOT NULL", False),
        "sql-type-zero-varchar-rejected": ("VARCHAR(0)", False),
        "sql-type-suffixed-varchar-rejected": ("VARCHAR(1);SELECT", False),
    }
    for test_id, (sql_type, expected) in sql_type_cases.items():
        check(test_id, (SQL_TYPE_RE.fullmatch(sql_type) is not None) is expected)
    lineage_columns = {"task_key", "required_flag"}
    for qualifier in ("", "LOCKED_PRE:", "STATE_WINNER:", "CONTENT_WINNER:"):
        bindings = direct_physical_lineage_bindings(
            [{
                "target": "response.taskKey",
                "sourcePath": qualifier + "ppl_jny_template_task_definitions.task_key",
                "sourceKind": "PHYSICAL_POST_STATE",
            }],
            "ppl_jny_template_task_definitions",
            lineage_columns,
        )
        check(
            "direct-lineage-" + (qualifier[:-1].lower() if qualifier else "bare") + "-accepted",
            bindings == [("response.taskKey", "task_key")],
        )
    hostile_lineages = {
        "direct-lineage-arbitrary-prefix-rejected": "UNTRUSTED:ppl_jny_template_task_definitions.task_key",
        "direct-lineage-derived-rejected": "DERIVED:ppl_jny_template_task_definitions.task_key",
        "direct-lineage-statement-rejected": "ppl_jny_template_task_definitions.task_key;SELECT",
        "direct-lineage-missing-column-rejected": "ppl_jny_template_task_definitions.missing_column",
        "direct-lineage-extra-segment-rejected": "ppl_jny_template_task_definitions.task_key.extra",
        "direct-lineage-uppercase-rejected": "PPL_JNY_TEMPLATE_TASK_DEFINITIONS.task_key",
    }
    for test_id, source_path in hostile_lineages.items():
        check(
            test_id,
            not direct_physical_lineage_bindings(
                [{
                    "target": "response.taskKey",
                    "sourcePath": source_path,
                    "sourceKind": "PHYSICAL_POST_STATE",
                }],
                "ppl_jny_template_task_definitions",
                lineage_columns,
            ),
        )
    historical = SCOPE_PROFILES["v3-132-historical"]
    successor = SCOPE_PROFILES["v4-131-successor"]
    check(
        "v3-v4-profile-confusion-rejected",
        historical["policySha256"] != successor["policySha256"]
        and historical["policySeal"] != successor["policySeal"]
        and historical["canonicalFiles"] != successor["canonicalFiles"],
    )
    spoofed = dict(successor["counts"])
    spoofed["handlers"] = 26
    check("v4-count-spoof-rejected", spoofed != successor["counts"])
    check(
        "v4-removed-table-orphan-detected",
        _contains_exact_token(
            {"foreignKeys": [{"targetTable": REMOVED_LISTENING_TABLE}]},
            REMOVED_LISTENING_TABLE,
        ),
    )
    check(
        "v4-policy-byte-drift-rejected",
        sha256(b"hostile-policy-byte-drift") != successor["policySha256"],
    )
    sample = sealed_copy({"evidence": "sample"})
    check("evidence-seal-round-trip", self_sealed(sample))
    captured_commands: list[list[str]] = []
    immutable_id = "sha256:" + ("a" * 64)

    def fake_docker(
        command: list[str], *, input_bytes: bytes | None = None, timeout: int = 180
    ) -> subprocess.CompletedProcess[bytes]:
        del input_bytes, timeout
        captured_commands.append(command)
        if command[:2] == ["docker", "pull"]:
            return subprocess.CompletedProcess(command, 0, b"pulled")
        if command[:3] == ["docker", "image", "inspect"]:
            payload = [{"Id": immutable_id, "RepoDigests": ["postgres@sha256:" + ("b" * 64)]}]
            return subprocess.CompletedProcess(command, 0, json.dumps(payload).encode("utf-8"))
        if command[:2] == ["docker", "run"]:
            return subprocess.CompletedProcess(command, 1, b"bounded mock stop")
        return subprocess.CompletedProcess(command, 1, b"unexpected mock command")

    original_run_command = globals()["run_command"]
    try:
        globals()["run_command"] = fake_docker
        evidence = docker_postgres_check({"candidate.sql": b"SELECT 1;"}, "16")
    finally:
        globals()["run_command"] = original_run_command
    run_commands = [command for command in captured_commands if command[:2] == ["docker", "run"]]
    check(
        "postgres-image-id-run-binding",
        evidence.get("imageId") == immutable_id
        and len(run_commands) == 1
        and run_commands[0][-1] == immutable_id,
    )
    check(
        "postgres-evidence-row-self-sealed",
        self_sealed(evidence)
        and evidence.get("inputFileSha256") == {"candidate.sql": sha256(b"SELECT 1;")},
    )
    with tempfile.TemporaryDirectory(
        prefix=".dwp-hris-validator-hostile-", dir=Path.cwd()
    ) as temp:
        root = Path(temp)
        real = root / "real"
        real.mkdir()
        linked = root / "linked"
        linked.symlink_to(real, target_is_directory=True)
        rejected = False
        try:
            secure_directory(linked)
        except (OSError, ValueError):
            rejected = True
        check("symlink-directory-rejected", rejected)
    passed = sum(case["status"] == "PASS" for case in cases)
    return sealed_copy({
        "reportId": "dwp.hris.modern.physical-candidate-validator-tool-self-test.v1",
        "status": "PASS" if passed == len(cases) else "FAIL",
        "cases": cases,
        "passed": passed,
        "total": len(cases),
    })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scope-profile",
        choices=tuple(SCOPE_PROFILES),
        default="v3-132-historical",
        help=(
            "explicit canonical/policy scope; v4/131 successor validation must "
            "be selected explicitly"
        ),
    )
    parser.add_argument("--canonical-dir", type=Path)
    parser.add_argument("--physical-dir", type=Path)
    parser.add_argument("--expansion-policy", type=Path)
    parser.add_argument("--owner-prefix-register", type=Path)
    parser.add_argument("--docker-postgres", choices=("none", "16", "18", "all"), default="none")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--tool-self-test", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    if args.tool_self_test:
        result = tool_hostile_self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    missing_arguments = [
        flag
        for flag, value in (
            ("--canonical-dir", args.canonical_dir),
            ("--physical-dir", args.physical_dir),
            ("--expansion-policy", args.expansion_policy),
            ("--owner-prefix-register", args.owner_prefix_register),
        )
        if value is None
    ]
    if missing_arguments:
        parser.error("the following arguments are required: " + ", ".join(missing_arguments))

    errors: list[dict[str, Any]] = []
    inputs_loaded = False
    profile_name = args.scope_profile
    profile = SCOPE_PROFILES[profile_name]
    canonical_dir = absolute_lexical(args.canonical_dir)
    physical_dir = absolute_lexical(args.physical_dir)
    canonical_raw, file_errors = load_regular_files(
        canonical_dir, frozenset(profile["canonicalFiles"])
    )
    errors.extend(file_errors)
    physical_raw, file_errors = load_regular_files(physical_dir, EXPECTED_FILES)
    errors.extend(file_errors)
    try:
        policy_path = absolute_lexical(args.expansion_policy)
        policy_raw = read_regular_nofollow(policy_path)
        policy = json.loads(policy_raw)
        if not self_sealed(policy):
            add(errors, "EXPANSION_POLICY_SELF_SEAL_MISMATCH", str(policy_path))
        owner_register_path = absolute_lexical(args.owner_prefix_register)
        owner_register, owner_register_raw = load_owner_register(owner_register_path)
        canonical = {name: json.loads(raw) for name, raw in canonical_raw.items()}
        physical_json = {
            name: json.loads(physical_raw[name]) for name in (HANDLER_FILE, QUERY_FILE, REPORT_FILE)
        }
        inputs_loaded = True
    except Exception as exc:
        add(errors, "INPUT_PARSE_FAILURE", "inputs", detail=str(exc))
        policy_raw, policy, owner_register_raw, owner_register, canonical, physical_json = (
            b"", {}, b"", {}, {}, {}
        )

    summary: dict[str, Any] = {}
    hostile = {"status": "NOT_RUN", "tool": None, "candidate": None}
    postgres_results: list[dict[str, Any]] = []
    if not errors:
        findings, summary = validate_candidate_data(
            canonical_raw,
            canonical,
            policy_raw,
            policy,
            owner_register_raw,
            owner_register,
            physical_raw,
            physical_json,
            canonical_dir.name,
            policy_path.name,
            profile_name,
        )
        errors.extend(findings)
    if args.self_test:
        tool_result = tool_hostile_self_test()
        candidate_result: dict[str, Any] | None = None
        if inputs_loaded:
            candidate_result = self_test(
                canonical_raw,
                canonical,
                policy_raw,
                policy,
                owner_register_raw,
                owner_register,
                physical_raw,
                physical_json,
                canonical_dir.name,
                policy_path.name,
                profile_name,
            )
        hostile = {
            "status": (
                "PASS"
                if tool_result["status"] == "PASS"
                and (candidate_result is None or candidate_result["status"] == "PASS")
                else "FAIL"
            ),
            "tool": tool_result,
            "candidate": candidate_result or {"status": "NOT_RUN_INPUT_FINDINGS"},
        }
        if hostile["status"] != "PASS":
            add(errors, "HOSTILE_SELF_TEST_FAILURE", "validator", actual=hostile)
    if args.docker_postgres != "none" and not errors:
        tags = [args.docker_postgres] if args.docker_postgres != "all" else ["16", "18"]
        for tag in tags:
            try:
                result = docker_postgres_check(physical_raw, tag)
            except Exception as exc:
                result = sealed_copy({
                    "requestedImage": f"postgres:{tag}",
                    "status": "FAIL",
                    "cleanup": "UNKNOWN_EXCEPTION",
                    "error": f"{type(exc).__name__}: {exc}",
                    "inputFileSha256": {
                        key: sha256(value) for key, value in sorted(physical_raw.items())
                    },
                })
            postgres_results.append(result)
            if not self_sealed(result):
                add(errors, "POSTGRES_EVIDENCE_SELF_SEAL_MISMATCH", f"postgres:{tag}")
            if result.get("inputFileSha256") != summary.get("physicalFileSha256"):
                add(errors, "POSTGRES_EVIDENCE_INPUT_PIN_MISMATCH", f"postgres:{tag}")
            if result.get("status") != "PASS" or result.get("cleanup") != "PASS":
                add(errors, "POSTGRES_EXECUTION_FAILURE", f"postgres:{tag}", actual=result)

    postgres_cross_version: dict[str, Any] = {"status": "NOT_APPLICABLE"}
    if len(postgres_results) == 2:
        observations = [normalized_postgres_observation(row) for row in postgres_results]
        postgres_cross_version = {
            "status": "PASS" if observations[0] == observations[1] else "FAIL",
            "observations": observations,
            "caseSetEquality": (
                set((observations[0].get("temporalCases") or {}).keys())
                == set((observations[1].get("temporalCases") or {}).keys())
            ),
            "observationEquality": observations[0] == observations[1],
        }
        if postgres_cross_version["status"] != "PASS":
            add(errors, "POSTGRES_CROSS_VERSION_OBSERVATION_DRIFT", "postgres:16/18")

    report = {
        "reportId": "dwp.hris.modern.physical-candidate-independent-validation.v4",
        "schemaVersion": 4,
        "status": "PASS_CANDIDATE_NOT_G3_AUTHORITY" if not errors else "FAIL",
        "scopeProfile": profile_name,
        "canonicalDirectory": canonical_dir.name,
        "physicalDirectory": physical_dir.name,
        "summary": summary,
        "hostileSelfTest": hostile,
        "postgresExecution": postgres_results,
        "postgresCrossVersion": postgres_cross_version,
        "errors": errors,
        "authority": "INDEPENDENT_CANDIDATE_VALIDATION_ONLY",
        "productionState": "NOT_AUTHORIZED_G6",
    }
    report = sealed_copy(report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    if args.report:
        path = absolute_lexical(args.report)
        if os.path.lexists(path):
            print(f"ERROR refusing to overwrite report: {path}", file=sys.stderr)
            return 2
        write_json_exclusive(path, report)
    return 0 if not errors else 1


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
