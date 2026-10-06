#!/usr/bin/env python3
"""Generate a sealed, owner-local HRIS modern physical *candidate*.

This program is deliberately not a migration publisher.  It accepts an explicit
canonical candidate directory, validates its physical ownership closure, and
writes a new output directory atomically.  It never reads or writes the live
canonical or ``modern-physical-successor`` directories implicitly.

The generated SQL is a forward-DDL design executable in disposable PostgreSQL
16/18 databases.  Allocation into service Flyway chains and production grants
remain Integration Control responsibilities after G3.
"""
from __future__ import annotations

import argparse
import copy
import ctypes
import csv
import errno
import hashlib
import json
import os
import re
import stat
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


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

# v4 is retained as the sealed seven-file regression profile.  Current
# successor candidates are an eight-file publication: the causal projection is
# both consumed below and independently proves the five canonical source bytes
# from which it was derived.  Do not turn this into an optional projection.
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

# Compatibility alias used by source-contract code whose semantic inputs have
# stable filenames in both profiles.  Directory membership itself is always
# taken from the explicit profile below.
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

# Version the global PER→PAY dependency expansion rather than changing the
# already reviewed v5 profile in place.  The canonical file set and v5 table
# policy are unchanged; only the global owner-dependency closure grows from
# Listening-local one to global exact two.
SCOPE_PROFILES["v6-131-owner-dependency-successor"] = copy.deepcopy(
    SCOPE_PROFILES["v5-131-successor"]
)
SCOPE_PROFILES["v6-131-owner-dependency-successor"].update({
    "ownerDependencies": 2,
    "predecessorScopeProfile": "v5-131-successor",
})

# Revision history is deliberately not protected by a raw interval exclusion.
# Corrections legitimately share the predecessor's business interval, while a
# future superseding revision overlaps it until the future activation boundary.
# The owner aggregate CAS and immutable predecessor chain arbitrate the winner.
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

SESSION_PREFIX = {
    "HRIS-HRM": "ppl_",
    "HRIS-PER": "prf_",
    "HRIS-TIM": "tme_",
    "HRIS-SYS": "sys_",
}

SESSION_OWNER_BINDING = {
    "HRIS-HRM": "PFX-HRM-PEOPLE",
    "HRIS-PER": "PFX-PER-PERFORMANCE",
    "HRIS-TIM": "PFX-TIM-TIME",
}

LISTENING_OWNER_BINDING = {
    "platform-hris-configuration": "PFX-SYS-LISTEN-CONFIGURATION",
    "platform-hris-listening-protected": "PFX-SYS-LISTEN-PROTECTED",
    "platform-hris-insights": "PFX-SYS-LISTEN-INSIGHTS",
    "auth-hris-participation-issuer": "PFX-SYS-LISTEN-ISSUER",
}

LISTENING_STREAM_OWNER = {
    "platform-hris-configuration": {
        "deploymentKey": "HRIS-SYS-PLATFORM",
        "service": "dwp-platform-server",
        "boundedContext": "DWP_PLATFORM_HRIS_CONFIGURATION",
        "schema": "hris_configuration",
    },
    "platform-hris-listening-protected": {
        "deploymentKey": "HRIS-SYS-PLATFORM",
        "service": "dwp-platform-server",
        "boundedContext": "DWP_PLATFORM_HRIS_LISTENING_PROTECTED",
        "schema": "hris_listening_protected",
    },
    "platform-hris-insights": {
        "deploymentKey": "HRIS-SYS-PLATFORM",
        "service": "dwp-platform-server",
        "boundedContext": "DWP_PLATFORM_HRIS_INSIGHTS",
        "schema": "hris_insights",
    },
    "auth-hris-participation-issuer": {
        "deploymentKey": "HRIS-SYS-AUTH",
        "service": "dwp-auth-server",
        "boundedContext": "DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
        "schema": "hris_participation_issuer",
    },
}

DEPLOYMENTS = {
    "HRIS-HRM": {
        "session": "HRIS-HRM",
        "service": "dwp-people-server",
        "boundedContext": "PEOPLE_CORE",
        "defaultSchema": "public",
        "file": "hrm-modern-forward-ddl.v4.sql",
    },
    "HRIS-PER": {
        "session": "HRIS-PER",
        "service": "dwp-people-server",
        "boundedContext": "PERFORMANCE",
        "defaultSchema": "hris_performance",
        "file": "per-modern-forward-ddl.v4.sql",
    },
    "HRIS-TIM": {
        "session": "HRIS-TIM",
        "service": "dwp-time-server",
        "boundedContext": "TIME",
        "defaultSchema": "public",
        "file": "tim-modern-forward-ddl.v4.sql",
    },
    "HRIS-SYS-PLATFORM": {
        "session": "HRIS-SYS",
        "service": "dwp-platform-server",
        "boundedContext": "HRIS_PLATFORM_MULTI_OWNER",
        "defaultSchema": None,
        "file": "sys-platform-modern-forward-ddl.v4.sql",
    },
    "HRIS-SYS-AUTH": {
        "session": "HRIS-SYS",
        "service": "dwp-auth-server",
        "boundedContext": "DWP_AUTH_HRIS_PARTICIPATION_ISSUER",
        "defaultSchema": "hris_participation_issuer",
        "file": "sys-auth-modern-forward-ddl.v4.sql",
    },
}

DEPLOYMENT_ROLES = {
    "HRIS-HRM": ("dwp_people_migration", "dwp_people_runtime"),
    "HRIS-PER": ("dwp_people_migration", "dwp_people_runtime"),
    "HRIS-TIM": ("dwp_time_migration", "dwp_time_runtime"),
    "HRIS-SYS-PLATFORM": ("dwp_platform_migration", "dwp_platform_runtime"),
    "HRIS-SYS-AUTH": ("dwp_auth_migration", "dwp_auth_runtime"),
}

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
RANGE_EXPR_RE = re.compile(
    r"^(?P<function>daterange|tstzrange)\("
    r"(?P<start>[a-z][a-z0-9_]*),(?P<end>[a-z][a-z0-9_]*),'\[\)'\)$"
)

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
    """Return an absolute path without following a symlink component."""
    return Path(os.path.abspath(os.fspath(path)))


def secure_directory(path: Path) -> Path:
    path = absolute_lexical(path)
    fd = open_directory_nofollow(path)
    os.close(fd)
    return path


def open_directory_nofollow(path: Path) -> int:
    """Open an absolute directory one component at a time without links."""
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
    """Read once through a no-follow descriptor and bind the opened inode."""
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


def publish_directory_noreplace(source: Path, destination: Path) -> None:
    """Atomically publish a sibling directory without replacement."""
    if source.parent != destination.parent:
        raise ValueError("exclusive publication requires sibling directories")
    parent_fd = open_directory_nofollow(source.parent)
    try:
        libc = ctypes.CDLL(None, use_errno=True)
        old_name = os.fsencode(source.name)
        new_name = os.fsencode(destination.name)
        if sys.platform == "darwin" and hasattr(libc, "renameatx_np"):
            # RENAME_EXCL from Darwin <sys/stdio.h>.
            libc.renameatx_np.argtypes = [
                ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint,
            ]
            libc.renameatx_np.restype = ctypes.c_int
            rc = libc.renameatx_np(parent_fd, old_name, parent_fd, new_name, 0x00000004)
        elif hasattr(libc, "renameat2"):
            # RENAME_NOREPLACE from Linux <linux/fs.h>.
            libc.renameat2.argtypes = [
                ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint,
            ]
            libc.renameat2.restype = ctypes.c_int
            rc = libc.renameat2(parent_fd, old_name, parent_fd, new_name, 0x1)
        else:
            raise OSError(errno.ENOTSUP, "kernel exclusive rename is unavailable")
        if rc != 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number), destination)
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical_bytes(value: dict[str, Any]) -> bytes:
    payload = {key: val for key, val in value.items() if key != "sealedPayloadSha256"}
    return json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def seal(value: dict[str, Any]) -> dict[str, Any]:
    sealed = copy.deepcopy(value)
    sealed.pop("sealedPayloadSha256", None)
    sealed["sealedPayloadSha256"] = sha256(canonical_bytes(sealed))
    return sealed


def write_json(path: Path, value: dict[str, Any]) -> None:
    path = absolute_lexical(path)
    parent = secure_directory(path.parent)
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    parent_fd = open_directory_nofollow(parent)
    try:
        fd = os.open(
            path.name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o644,
            dir_fd=parent_fd,
        )
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw.encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)


def load_sources(
    canonical_dir: Path,
    canonical_files: tuple[str, ...],
) -> tuple[dict[str, Any], dict[str, bytes], dict[str, str]]:
    canonical_dir = absolute_lexical(canonical_dir)
    root_fd = open_directory_nofollow(canonical_dir)
    documents: dict[str, Any] = {}
    raw_by_name: dict[str, bytes] = {}
    hashes: dict[str, str] = {}
    try:
        actual = set(os.listdir(root_fd))
        if actual != set(canonical_files):
            raise ValueError(
                "canonical directory file set mismatch: "
                f"expected={sorted(canonical_files)} actual={sorted(actual)}"
            )
        for name in canonical_files:
            raw = read_regular_at(root_fd, name)
            raw_by_name[name] = raw
            hashes[name] = sha256(raw)
            documents[name] = json.loads(raw)
        assert_directory_binding(canonical_dir, root_fd)
        return documents, raw_by_name, hashes
    finally:
        os.close(root_fd)


def load_owner_register(path: Path) -> tuple[dict[str, dict[str, str]], bytes, str]:
    raw = read_regular_nofollow(path)
    text = raw.decode("utf-8")
    reader = csv.DictReader(text.splitlines())
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
    return {row["binding_id"]: row for row in rows}, raw, sha256(raw)


def table_matches_allowed_prefix(table_name: str, declaration: str) -> bool:
    return any(table_name.startswith(token) for token in declaration.split("|") if token)


def validate_owner_register(
    owner_by_table: dict[str, dict[str, str]],
    tables_by_id: dict[str, dict[str, Any]],
    register: dict[str, dict[str, str]],
    errors: list[dict[str, Any]],
) -> None:
    for table_name, owner in owner_by_table.items():
        binding_id = owner["ownerBindingId"]
        row = register.get(binding_id)
        if row is None:
            errors.append({
                "code": "OWNER_REGISTER_BINDING_MISSING",
                "subject": f"{table_name}:{binding_id}",
            })
            continue
        expected = {
            "session": tables_by_id[table_name].get("session"),
            "owner_service": owner["service"],
            "bounded_context": owner["boundedContext"],
            "database_schema": owner["schema"],
            "status": "READY_FOR_G3_CODE",
        }
        actual = {key: row.get(key) for key in expected}
        if actual != expected:
            errors.append({
                "code": "OWNER_REGISTER_BINDING_DRIFT",
                "subject": f"{table_name}:{binding_id}",
                "expected": expected,
                "actual": actual,
            })
        if not table_matches_allowed_prefix(table_name, row.get("allowed_prefixes", "")):
            errors.append({
                "code": "OWNER_REGISTER_PREFIX_REJECTED",
                "subject": f"{table_name}:{binding_id}",
                "allowedPrefixes": row.get("allowed_prefixes"),
            })
        if not row.get("table_source_scope") or not row.get("cross_boundary_rule"):
            errors.append({
                "code": "OWNER_REGISTER_BOUNDARY_CONTRACT_MISSING",
                "subject": f"{table_name}:{binding_id}",
            })


def verify_self_seal(
    name: str,
    value: dict[str, Any],
    errors: list[dict[str, Any]],
    required_self_seals: frozenset[str] | None = None,
) -> None:
    required = required_self_seals or frozenset()
    declared = value.get("sealedPayloadSha256")
    if not isinstance(declared, str):
        if name not in required and "policy" not in name.lower():
            return
        errors.append({
            "code": "SOURCE_SELF_SEAL_MISSING",
            "subject": name,
            "detail": "sealedPayloadSha256 is mandatory on every canonical document",
        })
        return
    if sha256(canonical_bytes(value)) != declared:
        errors.append({
            "code": "SOURCE_SELF_SEAL_MISMATCH",
            "subject": name,
            "detail": "declared sealedPayloadSha256 does not match canonical payload",
        })


def validate_causal_publication_closure(
    documents: dict[str, Any],
    hashes: dict[str, str],
    errors: list[dict[str, Any]],
) -> None:
    """Prove the v5 causal artifact belongs to these exact five source bytes."""
    manifest = documents.get(MANIFEST_NAME, {})
    causal = documents.get(CAUSAL_STATE_NAME, {})
    manifest_ref = causal.get("closedSetManifest") or {}
    if manifest_ref.get("manifestId") != manifest.get("manifestId"):
        errors.append({
            "code": "CAUSAL_MANIFEST_ID_PIN_DRIFT",
            "subject": CAUSAL_STATE_NAME,
        })
    if manifest_ref.get("sealedPayloadSha256") != manifest.get("sealedPayloadSha256"):
        errors.append({
            "code": "CAUSAL_MANIFEST_SEAL_PIN_DRIFT",
            "subject": CAUSAL_STATE_NAME,
        })
    expected_pins = {
        name: hashes.get(name) for name in CAUSAL_CANONICAL_SOURCE_PIN_NAMES
    }
    actual_pins = causal.get("canonicalSourcePins")
    if not isinstance(actual_pins, dict) or set(actual_pins) != set(expected_pins):
        errors.append({
            "code": "CAUSAL_CANONICAL_SOURCE_PIN_SET_DRIFT",
            "subject": CAUSAL_STATE_NAME,
            "expected": sorted(expected_pins),
            "actual": sorted(actual_pins) if isinstance(actual_pins, dict) else actual_pins,
        })
        return
    for name, expected in expected_pins.items():
        if actual_pins.get(name) != expected:
            errors.append({
                "code": "CAUSAL_CANONICAL_SOURCE_PIN_HASH_DRIFT",
                "subject": f"{CAUSAL_STATE_NAME}:{name}",
                "expected": expected,
                "actual": actual_pins.get(name),
            })


def validate_global_owner_dependency_closure(
    documents: dict[str, Any],
    profile: dict[str, Any],
    errors: list[dict[str, Any]],
) -> None:
    expected_count = profile.get("ownerDependencies")
    if expected_count is None:
        return
    manifest = documents.get(MANIFEST_NAME, {})
    operation = documents.get(OPERATION_NAME, {})
    exact = documents.get(EXACT_NAME, {})
    semantic = documents.get(
        "modern-capability-semantic-bindings.v1.json", {}
    )
    rows = operation.get("ownerDependencyContracts", [])
    exact_rows = exact.get("ownerDependencyContracts", [])
    semantic_rows = semantic.get("ownerDependencyContracts", [])
    ids = [row.get("dependencyContractId") for row in rows]
    if (
        len(rows) != expected_count
        or len(ids) != len(set(ids))
        or set(ids) != GLOBAL_OWNER_DEPENDENCY_IDS
    ):
        errors.append({
            "code": "GLOBAL_OWNER_DEPENDENCY_SET_DRIFT",
            "subject": "operation.ownerDependencyContracts",
            "expected": sorted(GLOBAL_OWNER_DEPENDENCY_IDS),
            "actual": ids,
        })
    if exact_rows != rows or semantic_rows != rows:
        errors.append({
            "code": "GLOBAL_OWNER_DEPENDENCY_PROJECTION_DRIFT",
            "subject": "operation/exact/semantic.ownerDependencyContracts",
        })
    invalid_seals = [
        row.get("dependencyContractId") for row in rows
        if row.get("sealedPayloadSha256") != sha256(canonical_bytes(row))
    ]
    if invalid_seals:
        errors.append({
            "code": "GLOBAL_OWNER_DEPENDENCY_SEAL_DRIFT",
            "subject": "operation.ownerDependencyContracts",
            "dependencyContractIds": invalid_seals,
        })
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
        errors.append({
            "code": "GLOBAL_OWNER_DEPENDENCY_MANIFEST_PIN_DRIFT",
            "subject": "closed-set-manifest.ownerDependencyContracts",
            "expected": projected_pins,
            "actual": manifest.get("ownerDependencyContracts"),
        })
    semantic_bindings = semantic.get("ownerDependencySemanticBindings", [])
    if [row.get("dependencyContractId") for row in semantic_bindings] != ids:
        errors.append({
            "code": "GLOBAL_OWNER_DEPENDENCY_SEMANTIC_IDENTITY_DRIFT",
            "subject": "semantic.ownerDependencySemanticBindings",
        })
    listening_count = manifest.get("listeningStaticDesign", {}).get(
        "exactCounts", {}
    ).get("ownerDependencyContracts")
    authority_count = documents.get(LISTENING_AUTHORITY_NAME, {}).get(
        "exactCounts", {}
    ).get("ownerDependencyContracts")
    if listening_count != 1 or authority_count != 1:
        errors.append({
            "code": "LISTENING_LOCAL_OWNER_DEPENDENCY_COUNT_DRIFT",
            "subject": "Listening.ownerDependencyContracts",
            "expected": 1,
            "manifestActual": listening_count,
            "authorityActual": authority_count,
        })


def direct_physical_lineage_bindings(
    lineage: list[dict[str, Any]],
    table_name: str,
    columns: set[str],
) -> list[tuple[str, str]]:
    """Return only closed, durable response selectors for one physical table.

    A sourcePath is never interpreted with a prefix/substring rule.  The only
    accepted temporal forms are bare, LOCKED_PRE, STATE_WINNER and
    CONTENT_WINNER selectors; a target and physical column each count once.
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
        column = match.group("column")
        target = item.get("target")
        if not isinstance(target, str) or not target or column not in columns:
            continue
        if target in seen_targets or column in seen_columns:
            continue
        seen_targets.add(target)
        seen_columns.add(column)
        result.append((target, column))
    return result


def _contains_exact_token(value: Any, token: str) -> bool:
    return re.search(
        rf"(?<![A-Za-z0-9_]){re.escape(token)}(?![A-Za-z0-9_])",
        json.dumps(value, ensure_ascii=False, sort_keys=True),
    ) is not None


def validate_scope_profile_authority(
    documents: dict[str, Any],
    hashes: dict[str, str],
    expansion_policy: dict[str, Any],
    expansion_policy_hash: str,
    expansion_policy_filename: str,
    profile_name: str,
    profile: dict[str, Any],
    errors: list[dict[str, Any]],
) -> None:
    """Bind profile, policy, manifest and the v4 scope reduction fail-closed."""
    policy_actual = {
        "filename": expansion_policy_filename,
        "policyId": expansion_policy.get("policyId"),
        "schemaVersion": expansion_policy.get("schemaVersion"),
        "sha256": expansion_policy_hash,
        "sealedPayloadSha256": expansion_policy.get("sealedPayloadSha256"),
    }
    policy_expected = {
        "filename": profile["policyFilename"],
        "policyId": profile["policyId"],
        "schemaVersion": profile["policySchemaVersion"],
        "sha256": profile["policySha256"],
        "sealedPayloadSha256": profile["policySeal"],
    }
    if policy_actual != policy_expected:
        errors.append({
            "code": "SCOPE_PROFILE_POLICY_IDENTITY_DRIFT",
            "subject": profile_name,
            "expected": policy_expected,
            "actual": policy_actual,
        })

    manifest = documents.get(MANIFEST_NAME, {})
    scope = manifest.get("tableScopeChange") or {}
    successor = expansion_policy.get("successorScope") or {}
    expected_added = sorted(
        row.get("tableId") for row in successor.get("addedRows", [])
        if isinstance(row.get("tableId"), str)
    )
    expected_removed = sorted(profile["removedTables"])
    scope_projection = {
        "previousTableSetSha256": scope.get("previousTableSetSha256"),
        "previousTableSpecifications": scope.get("previousTableSpecifications"),
        "activeTableSpecifications": scope.get("activeTableSpecifications"),
        "deltaCount": scope.get("deltaCount"),
        "netDelta": scope.get("netDelta", scope.get("deltaCount")),
        "addedTableIds": sorted(scope.get("addedTableIds", [])),
        "removedTableIds": sorted(scope.get("removedTableIds", [])),
    }
    expected_scope = {
        "previousTableSetSha256": expansion_policy.get("frozenBaseline", {}).get("tableSetSha256"),
        "previousTableSpecifications": 115,
        "activeTableSpecifications": profile["counts"]["tables"],
        "deltaCount": 17,
        "netDelta": profile["netDelta"],
        "addedTableIds": expected_added,
        "removedTableIds": expected_removed,
    }
    # q0 predates a manifest netDelta member.  Treat its explicit deltaCount as
    # the historical net delta without changing any of its 38 source findings.
    if profile_name != "v3-132-historical" and scope_projection != expected_scope:
        errors.append({
            "code": "SCOPE_PROFILE_MANIFEST_SCOPE_DRIFT",
            "subject": MANIFEST_NAME,
            "expected": expected_scope,
            "actual": scope_projection,
        })

    if profile.get("manifestPolicyPinRequired"):
        expected_pin = profile["manifestAcceptancePolicyPin"]
        if scope.get("acceptancePolicy") != expected_pin:
            errors.append({
                "code": "SCOPE_PROFILE_MANIFEST_POLICY_PIN_DRIFT",
                "subject": f"{MANIFEST_NAME}:tableScopeChange.acceptancePolicy",
                "expected": expected_pin,
                "actual": scope.get("acceptancePolicy"),
            })
        policy_rows = {
            row.get("tableId"): row for row in successor.get("addedRows", [])
        }
        if scope.get("rows") != policy_rows:
            errors.append({
                "code": "SCOPE_PROFILE_MANIFEST_POLICY_ROWS_DRIFT",
                "subject": f"{MANIFEST_NAME}:tableScopeChange.rows",
            })

        listening_counts = (manifest.get("listeningStaticDesign") or {}).get("exactCounts") or {}
        if (
            listening_counts.get("plannedTables") != profile["listeningTables"]
            or listening_counts.get("ownerPortOperations") != profile["ownerPorts"]
            or len(manifest.get("ownerPortOperationContracts", [])) != profile["ownerPorts"]
        ):
            errors.append({
                "code": "SCOPE_PROFILE_LISTENING_COUNT_DRIFT",
                "subject": f"{MANIFEST_NAME}:listeningStaticDesign",
                "expected": {
                    "plannedTables": profile["listeningTables"],
                    "ownerPortOperations": profile["ownerPorts"],
                },
                "actual": listening_counts,
            })

        authority = documents.get(LISTENING_AUTHORITY_NAME, {})
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
            errors.append({
                "code": "SCOPE_PROFILE_LISTENING_AUTHORITY_COUNT_DRIFT",
                "subject": LISTENING_AUTHORITY_NAME,
            })
        authority_pin = (manifest.get("ownerBoundaryInputs") or {}).get("listeningStreamAuthority") or {}
        expected_authority_pin = {
            "contractId": authority.get("contractId"),
            "path": f"coding-readiness/{LISTENING_AUTHORITY_NAME}",
            "fileSha256": hashes.get(LISTENING_AUTHORITY_NAME),
            "sealedPayloadSha256": authority.get("sealedPayloadSha256"),
        }
        if any(authority_pin.get(key) != value for key, value in expected_authority_pin.items()):
            errors.append({
                "code": "SCOPE_PROFILE_LISTENING_AUTHORITY_MANIFEST_PIN_DRIFT",
                "subject": f"{MANIFEST_NAME}:ownerBoundaryInputs.listeningStreamAuthority",
                "expected": expected_authority_pin,
                "actual": authority_pin,
            })

        removed = next(iter(profile["removedTables"]))
        sanitized = copy.deepcopy(documents)
        sanitized_scope = sanitized.get(MANIFEST_NAME, {}).get("tableScopeChange", {})
        sanitized_scope.pop("removedTableIds", None)
        sanitized_scope.pop("removalDisposition", None)
        dangling_documents = sorted(
            name for name, value in sanitized.items()
            if _contains_exact_token(value, removed)
        )
        if removed in manifest.get("tableIds", []) or dangling_documents:
            errors.append({
                "code": "SCOPE_PROFILE_REMOVED_TABLE_DANGLING_REFERENCE",
                "subject": removed,
                "documents": dangling_documents,
            })


def owner_binding_for_table(table: dict[str, Any]) -> str:
    session = table.get("session")
    if session in SESSION_OWNER_BINDING:
        return SESSION_OWNER_BINDING[session]
    capability = table.get("capabilityId")
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.GOVERNED_AI":
        return "PFX-SYS-CONFIGURATION"
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
        return "PFX-SYS-INSIGHTS"
    if session == "HRIS-SYS" and capability == "HRIS.MODERN.EMPLOYEE_LISTENING":
        stream_key = table.get("streamKey")
        if stream_key in LISTENING_OWNER_BINDING:
            return LISTENING_OWNER_BINDING[stream_key]
    raise ValueError(
        f"unmapped physical owner binding for {table.get('tableName')}: "
        f"{session}/{capability}/{table.get('streamKey')}"
    )


def owner_for_table(table: dict[str, Any]) -> dict[str, str]:
    session = table.get("session")
    if session == "HRIS-HRM":
        return {
            "ownerBindingId": owner_binding_for_table(table),
            "deploymentKey": "HRIS-HRM",
            "service": "dwp-people-server",
            "boundedContext": "PEOPLE_CORE",
            "schema": "public",
        }
    if session == "HRIS-PER":
        return {
            "ownerBindingId": owner_binding_for_table(table),
            "deploymentKey": "HRIS-PER",
            "service": "dwp-people-server",
            "boundedContext": "PERFORMANCE",
            "schema": "hris_performance",
        }
    if session == "HRIS-TIM":
        return {
            "ownerBindingId": owner_binding_for_table(table),
            "deploymentKey": "HRIS-TIM",
            "service": "dwp-time-server",
            "boundedContext": "TIME",
            "schema": "public",
        }
    if session != "HRIS-SYS":
        raise ValueError(f"unsupported table session: {session}")
    capability = table.get("capabilityId")
    if capability == "HRIS.MODERN.GOVERNED_AI":
        return {
            "ownerBindingId": owner_binding_for_table(table),
            "deploymentKey": "HRIS-SYS-PLATFORM",
            "service": "dwp-platform-server",
            "boundedContext": "HRIS_CONFIGURATION",
            "schema": "hris_configuration",
        }
    if capability == "HRIS.MODERN.PEOPLE_ANALYTICS":
        return {
            "ownerBindingId": owner_binding_for_table(table),
            "deploymentKey": "HRIS-SYS-PLATFORM",
            "service": "dwp-platform-server",
            "boundedContext": "HRIS_INSIGHTS",
            "schema": "hris_insights",
        }
    if capability == "HRIS.MODERN.EMPLOYEE_LISTENING":
        stream_key = table.get("streamKey")
        if stream_key not in LISTENING_STREAM_OWNER:
            raise ValueError(
                f"unmapped employee-listening stream for {table.get('tableName')}: {stream_key}"
            )
        return {
            "ownerBindingId": owner_binding_for_table(table),
            **LISTENING_STREAM_OWNER[stream_key],
        }
    raise ValueError(
        f"unmapped HRIS-SYS capability for {table.get('tableName')}: {capability}"
    )


def physical_unit(owner: dict[str, str]) -> tuple[str, str]:
    return owner["service"], owner["schema"]


def physical_identifier(source: str) -> str:
    """Map a canonical identifier to PostgreSQL's 63-byte namespace deterministically."""
    if len(source.encode("utf-8")) <= 63:
        return source
    suffix = sha256(source.encode("utf-8"))[:10]
    # All accepted identifiers are ASCII; byte and character lengths are equal.
    return f"{source[:52]}_{suffix}"


def all_column_names(table: dict[str, Any], common: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for column in common.get("columns", []):
        if column.get("name") == "__internal_id__":
            result.append(table["idColumn"]["name"])
        else:
            result.append(column["name"])
    result.extend(column["name"] for column in table.get("columns", []))
    return result


def all_columns_by_name(
    table: dict[str, Any], common: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for column in common.get("columns", []):
        materialized = table["idColumn"] if column.get("name") == "__internal_id__" else column
        result[materialized["name"]] = materialized
    for column in table.get("columns", []):
        result[column["name"]] = column
    return result


def sql_fragment_is_safe(value: Any) -> bool:
    """Validate a CHECK/predicate expression with a closed scalar grammar."""
    if not isinstance(value, str) or not value.strip():
        return False
    if any(token in value for token in (";", "--", "/*", "*/", "\x00", "\n", "\r", '"', ".")):
        return False
    # PostgreSQL casts are otherwise forbidden.  This exact byte token is the
    # one reviewed representation of a suppressed JSONB measure array; replace
    # it before scalar inspection so a broader cast grammar never emerges.
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


def validate_temporal_exclusion_shape(
    table: dict[str, Any], common: dict[str, Any], errors: list[dict[str, Any]]
) -> None:
    table_name = table["tableName"]
    columns = all_columns_by_name(table, common)
    for item in table.get("temporalExclusionConstraints", []):
        subject = f"{table_name}.{item.get('constraintId')}"
        if not IDENT_RE.fullmatch(str(item.get("constraintId", ""))):
            errors.append({"code": "TEMPORAL_CONSTRAINT_ID_UNSAFE", "subject": subject})
        partitions = item.get("partitionColumns")
        if (
            not isinstance(partitions, list)
            or not partitions
            or any(column not in columns for column in partitions)
        ):
            errors.append({
                "code": "TEMPORAL_PARTITION_COLUMNS_INVALID",
                "subject": subject,
                "actual": partitions,
            })
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
            errors.append({
                "code": "TEMPORAL_RANGE_INVALID",
                "subject": subject,
                "actual": raw_range,
            })
            continue
        start_type = columns[start].get("sqlType")
        end_type = columns[end].get("sqlType")
        expected_function = "daterange" if start_type == "DATE" else "tstzrange"
        if (
            start_type != end_type
            or start_type not in {"DATE", "TIMESTAMPTZ"}
            or (declared_function is not None and declared_function != expected_function)
        ):
            errors.append({
                "code": "TEMPORAL_RANGE_TYPE_MISMATCH",
                "subject": subject,
                "startType": start_type,
                "endType": end_type,
                "declaredFunction": declared_function,
            })
        if item.get("nullSemantics") != "NULL_END_IS_OPEN_ENDED_INFINITY":
            errors.append({
                "code": "TEMPORAL_NULL_SEMANTICS_DRIFT",
                "subject": subject,
                "actual": item.get("nullSemantics"),
            })
        if item.get("rule") != "NO_OVERLAP":
            errors.append({
                "code": "TEMPORAL_RULE_DRIFT",
                "subject": subject,
                "actual": item.get("rule"),
            })
        if item.get("predicate") is not None and not sql_fragment_is_safe(
            item.get("predicate")
        ):
            errors.append({
                "code": "UNSAFE_TEMPORAL_PREDICATE",
                "subject": subject,
            })


def validate_relation_namespace(
    tables_by_id: dict[str, dict[str, Any]],
    owner_by_table: dict[str, dict[str, str]],
    errors: list[dict[str, Any]],
) -> None:
    relation_sources: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for table_name, table in tables_by_id.items():
        owner = owner_by_table.get(table_name)
        if owner is None:
            continue
        unit = (owner["service"], owner["schema"])
        relation_sources[(*unit, physical_identifier(table_name))].append(
            f"table:{table_name}"
        )
        relation_ids = [
            f"pk_{table_name}_physical_v4",
            *[source_id for source_id, _columns, _source in unique_specs(table)],
            *[item["indexId"] for item in table.get("indexes", [])],
            *[
                item["constraintId"]
                for item in table.get("temporalExclusionConstraints", [])
                if materialize_temporal_exclusion(table, item)
            ],
        ]
        for relation_id in relation_ids:
            relation_sources[(*unit, physical_identifier(relation_id))].append(
                f"{table_name}:{relation_id}"
            )
    for (service, schema, physical_name), sources in relation_sources.items():
        if len(sources) > 1:
            errors.append({
                "code": "PHYSICAL_RELATION_NAME_COLLISION",
                "subject": f"{service}:{schema}.{physical_name}",
                "sources": sources,
            })


def validate_revision_temporal_arbitration(
    table: dict[str, Any],
    common: dict[str, Any],
    causal_operations: list[dict[str, Any]],
    tables_by_id: dict[str, dict[str, Any]],
    errors: list[dict[str, Any]],
) -> None:
    """Fail closed on ambiguous correction/supersession history semantics.

    An unconditional GiST exclusion is not compatible with an immutable
    correction chain.  This candidate generator supports one auditable model:
    keep every revision, serialize appends by CAS on the owner root, and choose
    the highest eligible chain revision for business/system as-of reads.
    """
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
        errors.append({
            "code": "REVISION_TEMPORAL_ARBITRATION_MISSING",
            "subject": subject,
            "required": TEMPORAL_ARBITRATION_REQUIRED,
        })
    else:
        for key, expected in TEMPORAL_ARBITRATION_REQUIRED.items():
            if arbitration.get(key) != expected:
                errors.append({
                    "code": "REVISION_TEMPORAL_ARBITRATION_DRIFT",
                    "subject": f"{subject}.{key}",
                    "expected": expected,
                    "actual": arbitration.get(key),
                })

    names = set(all_column_names(table, common))
    parent_columns = arbitration.get("parentColumns")
    if has_arbitration and (
        not isinstance(parent_columns, list)
        or not parent_columns
        or any(not isinstance(value, str) for value in parent_columns)
        or "tenant_id" not in parent_columns
        or not set(parent_columns).issubset(names)
    ):
        errors.append({
            "code": "REVISION_TEMPORAL_PARENT_COLUMNS_INVALID",
            "subject": subject,
            "actual": parent_columns,
        })
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
            errors.append({
                "code": "REVISION_TEMPORAL_COLUMN_INVALID",
                "subject": f"{subject}.{key}",
                "actual": column,
            })
    if has_arbitration and arbitration.get("recordedAtColumn") != "created_at":
        errors.append({
            "code": "REVISION_TEMPORAL_SYSTEM_TIME_NOT_IMMUTABLE",
            "subject": f"{subject}.recordedAtColumn",
            "required": "created_at",
            "actual": arbitration.get("recordedAtColumn"),
        })
    root_table = arbitration.get("rootTable")
    root_version = arbitration.get("rootVersionColumn")
    if has_arbitration and root_table not in tables_by_id:
        errors.append({
            "code": "REVISION_TEMPORAL_ROOT_TABLE_INVALID",
            "subject": subject,
            "actual": root_table,
        })
    elif has_arbitration and root_version not in set(all_column_names(tables_by_id[root_table], common)):
        errors.append({
            "code": "REVISION_TEMPORAL_ROOT_VERSION_INVALID",
            "subject": subject,
            "rootTable": root_table,
            "actual": root_version,
        })

    # Keeping a predicate beside rawHistoryExclusion=NONE is contradictory and
    # risks a future generator accidentally materializing it.
    for exclusion in revision_exclusions:
        if has_arbitration and str(exclusion.get("predicate", "")).strip():
            errors.append({
                "code": "REVISION_RAW_EXCLUSION_CONTRADICTS_ARBITRATION",
                "subject": f"{table_name}.{exclusion.get('constraintId')}",
            })

    # Even before an arbitration object exists, surface latent contradictions so
    # one repair batch can close them rather than discovering them serially.
    revision_semantics = ";".join(
        str(item.get("revisionSemantics", "")) for item in revision_exclusions
    )
    if "CORRECTION" in revision_semantics:
        required_correction_columns = {
            "revision_mode",
            "predecessor_revision",
            "correction_reason_code",
            "changed_fields",
        }
        missing = required_correction_columns - names
        if missing:
            errors.append({
                "code": "REVISION_TEMPORAL_CORRECTION_COLUMNS_MISSING",
                "subject": table_name,
                "missing": sorted(missing),
            })
    range_source = revision_exclusions[0].get("range", "")
    range_columns: list[str] = []
    if isinstance(range_source, str) and range_source.startswith("[") and range_source.endswith(")"):
        range_columns = [part.strip() for part in range_source[1:-1].split(",", 1)]
    range_start = range_columns[0] if len(range_columns) == 2 else None
    range_end = range_columns[1] if len(range_columns) == 2 else None
    column_by_name = all_columns_by_name(table, common)
    if range_start in column_by_name and column_by_name[range_start].get("nullable") is not False:
        errors.append({
            "code": "REVISION_TEMPORAL_EFFECTIVE_START_NULLABLE",
            "subject": f"{table_name}.{range_start}",
        })
    insertion_operations = []
    for operation in causal_operations:
        for step in operation.get("orderedDml", []):
            if step.get("table") == table_name and step.get("action") in {"INSERT", "APPEND"}:
                insertion_operations.append((operation.get("operationId"), step))
    for operation_id, step in insertion_operations:
        assignments = step.get("assignments") or {}
        missing_effective = {
            column for column in (range_start, range_end)
            if isinstance(column, str) and column not in assignments
        }
        if missing_effective:
            errors.append({
                "code": "REVISION_TEMPORAL_INSERT_EFFECTIVE_ASSIGNMENT_MISSING",
                "subject": str(operation_id),
                "table": table_name,
                "missing": sorted(missing_effective),
            })

    # Every revise command must append exactly one new history row, serialize on
    # exactly one owner root first, and never UPDATE/DELETE the predecessor row.
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
        errors.append({
            "code": "REVISION_TEMPORAL_REVISE_COMMAND_MISSING",
            "subject": table_name,
        })
    for operation, history_steps in revise_operations:
        operation_id = operation.get("operationId")
        append_steps = [step for step in history_steps if step.get("action") == "APPEND"]
        mutating_predecessor_steps = [
            step for step in history_steps
            if step.get("action") in {"UPDATE", "UPDATE_CAS", "DELETE", "UPSERT"}
        ]
        if len(append_steps) != 1 or mutating_predecessor_steps:
            errors.append({
                "code": "REVISION_TEMPORAL_APPEND_ONLY_DML_VIOLATION",
                "subject": str(operation_id),
                "historyActions": [step.get("action") for step in history_steps],
            })
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
            errors.append({
                "code": "REVISION_TEMPORAL_ROOT_CAS_MISSING",
                "subject": str(operation_id),
                "expectedRootTable": root_table,
                "actualRootCasTables": [
                    step.get("table")
                    for step in operation.get("orderedDml", [])
                    if step.get("action") == "UPDATE_CAS"
                ],
            })
        elif (operation.get("aggregateRoot") or {}).get("table") != root_cas[0].get("table"):
            errors.append({
                "code": "REVISION_TEMPORAL_CONCURRENCY_ROOT_AGGREGATE_DRIFT",
                "subject": str(operation_id),
                "aggregateRoot": (operation.get("aggregateRoot") or {}).get("table"),
                "actualCasRoot": root_cas[0].get("table"),
            })
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
                errors.append({
                    "code": "REVISION_TEMPORAL_APPEND_ASSIGNMENT_MISSING",
                    "subject": f"{operation_id}:{key}",
                })


def validate_canonical(
    documents: dict[str, Any],
    hashes: dict[str, str],
    expansion_policy: dict[str, Any] | None,
    expansion_policy_hash: str | None,
    expansion_policy_filename: str,
    owner_register: dict[str, dict[str, str]],
    owner_register_hash: str,
    profile_name: str,
    profile: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    for name, value in documents.items():
        verify_self_seal(name, value, errors, profile["requiredSelfSeals"])
    if profile.get("causalPublicationClosureRequired"):
        validate_causal_publication_closure(documents, hashes, errors)
    validate_global_owner_dependency_closure(documents, profile, errors)

    manifest = documents[MANIFEST_NAME]
    operation = documents[OPERATION_NAME]
    exact = documents[EXACT_NAME]

    manifest_operations = manifest.get("operations", [])
    exact_operations = exact.get("operationBindings", [])
    causal_operations = operation.get("operations", [])
    exact_handlers = exact.get("internalConsumerHandlers", [])
    causal_handlers = operation.get("systemHandlers", [])
    table_specs = exact.get("tableSpecifications", [])
    public_events = manifest.get("publicEventIds", [])

    observed = {
        "operations": len(manifest_operations),
        "commands": sum(row.get("mode") == "COMMAND" for row in manifest_operations),
        "queries": sum(row.get("mode") == "QUERY" for row in manifest_operations),
        "handlers": len(manifest.get("handlerIds", [])),
        "events": len(public_events),
        "tables": len(manifest.get("tableIds", [])),
    }
    expected_counts = profile["counts"]
    if observed != expected_counts:
        errors.append({
            "code": "CANONICAL_COUNT_MISMATCH",
            "subject": "closed-set-manifest",
            "expected": expected_counts,
            "actual": observed,
        })
    declared_scope = manifest.get("scope") or {}
    declared_counts = {
        "operations": declared_scope.get("operations"),
        "commands": declared_scope.get("commands"),
        "queries": declared_scope.get("queries"),
        "handlers": declared_scope.get("handlers"),
        "events": declared_scope.get("publicEvents"),
        "tables": declared_scope.get("tableSpecifications"),
    }
    if declared_counts != observed:
        errors.append({
            "code": "CANONICAL_DECLARED_COUNT_SPOOF",
            "subject": "closed-set-manifest.scope",
            "expected": observed,
            "actual": declared_counts,
        })
    if profile_name != "v3-132-historical" and declared_scope.get(
        "ownerPortOperationContracts"
    ) != profile["ownerPorts"]:
        errors.append({
            "code": "CANONICAL_DECLARED_OWNER_PORT_COUNT_SPOOF",
            "subject": "closed-set-manifest.scope.ownerPortOperationContracts",
            "expected": profile["ownerPorts"],
            "actual": declared_scope.get("ownerPortOperationContracts"),
        })

    def keyed(rows: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
        ids = [row.get(key) for row in rows]
        if any(not isinstance(value, str) or not value for value in ids) or len(ids) != len(set(ids)):
            errors.append({
                "code": "CANONICAL_ID_SET_NOT_UNIQUE",
                "subject": label,
                "detail": key,
            })
        return {str(row.get(key)): row for row in rows}

    manifest_by_id = keyed(manifest_operations, "operationId", "manifest.operations")
    exact_by_id = keyed(exact_operations, "operationId", "exact.operationBindings")
    causal_by_id = keyed(causal_operations, "operationId", "operation.operations")
    handler_by_id = keyed(exact_handlers, "handlerId", "exact.internalConsumerHandlers")
    causal_handler_by_id = keyed(causal_handlers, "handlerId", "operation.systemHandlers")
    tables_by_id = keyed(table_specs, "tableName", "exact.tableSpecifications")

    if set(manifest_by_id) != set(exact_by_id) or set(manifest_by_id) != set(causal_by_id):
        errors.append({
            "code": "OPERATION_CLOSED_SET_DRIFT",
            "subject": "canonical-three-way-operation-set",
            "manifestOnly": sorted(set(manifest_by_id) - set(exact_by_id) - set(causal_by_id)),
            "exactOnly": sorted(set(exact_by_id) - set(manifest_by_id)),
            "causalOnly": sorted(set(causal_by_id) - set(manifest_by_id)),
        })
    if (
        set(manifest.get("handlerIds", [])) != set(handler_by_id)
        or set(manifest.get("handlerIds", [])) != set(causal_handler_by_id)
    ):
        errors.append({
            "code": "HANDLER_CLOSED_SET_DRIFT",
            "subject": "manifest/exact/operation handlers",
        })
    if set(manifest.get("tableIds", [])) != set(tables_by_id):
        errors.append({"code": "TABLE_CLOSED_SET_DRIFT", "subject": "tableIds"})
    manifest_hash = hashes[MANIFEST_NAME]
    manifest_seal = manifest.get("sealedPayloadSha256")
    for name in profile["manifestPinnedFiles"]:
        value = documents[name]
        manifest_ref = value.get("closedSetManifest") or {}
        if manifest_ref.get("manifestId") != manifest.get("manifestId"):
            errors.append({
                "code": "CANONICAL_MANIFEST_ID_PIN_DRIFT",
                "subject": name,
            })
        if manifest_ref.get("sealedPayloadSha256") != manifest_seal:
            errors.append({
                "code": "CANONICAL_MANIFEST_SEAL_PIN_DRIFT",
                "subject": name,
            })
        if "fileSha256" in manifest_ref and manifest_ref.get("fileSha256") != manifest_hash:
            errors.append({
                "code": "CANONICAL_MANIFEST_FILE_PIN_DRIFT",
                "subject": name,
            })
    for operation_id in sorted(set(manifest_by_id) & set(exact_by_id) & set(causal_by_id)):
        triplet = (
            manifest_by_id[operation_id], exact_by_id[operation_id], causal_by_id[operation_id]
        )
        signatures = {(row.get("session"), row.get("mode")) for row in triplet}
        if len(signatures) != 1:
            errors.append({
                "code": "OPERATION_SESSION_MODE_DRIFT",
                "subject": operation_id,
                "actual": sorted([list(value) for value in signatures]),
            })

    common = exact.get("commonTableContract", {})
    if common.get("contractId") != "DWP_MODERN_TENANT_TABLE_V1":
        errors.append({"code": "COMMON_TABLE_CONTRACT_DRIFT", "subject": "commonTableContract"})
    common_shape = [
        (
            row.get("name"),
            row.get("sqlType"),
            row.get("nullable"),
            row.get("default"),
        )
        for row in common.get("columns", [])
    ]
    if common_shape != COMMON_COLUMN_PHYSICAL_SHAPE:
        errors.append({
            "code": "COMMON_TABLE_PHYSICAL_SHAPE_DRIFT",
            "subject": "commonTableContract.columns",
            "expected": COMMON_COLUMN_PHYSICAL_SHAPE,
            "actual": common_shape,
        })
    if common.get("rowSecurity") != (
        "ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY; "
        "current_setting('dwp.tenant_id',true)::bigint; application role NOBYPASSRLS"
    ):
        errors.append({
            "code": "COMMON_TABLE_RLS_CONTRACT_DRIFT",
            "subject": "commonTableContract.rowSecurity",
        })

    owner_by_table: dict[str, dict[str, str]] = {}
    for table_name, table in tables_by_id.items():
        session = table.get("session")
        if not IDENT_RE.fullmatch(table_name):
            errors.append({"code": "UNSAFE_TABLE_IDENTIFIER", "subject": table_name})
        if session not in SESSION_PREFIX or not table_name.startswith(SESSION_PREFIX.get(session, "!")):
            errors.append({
                "code": "TABLE_SESSION_PREFIX_MISMATCH",
                "subject": table_name,
                "session": session,
            })
        try:
            owner_by_table[table_name] = owner_for_table(table)
        except ValueError as exc:
            errors.append({"code": "UNMAPPED_PHYSICAL_OWNER", "subject": table_name, "detail": str(exc)})
            continue
        names = all_column_names(table, common)
        if table.get("commonColumnsRef") != common.get("contractId"):
            errors.append({
                "code": "TABLE_COMMON_CONTRACT_REF_DRIFT",
                "subject": table_name,
                "expected": common.get("contractId"),
                "actual": table.get("commonColumnsRef"),
            })
        if table.get("rowSecurity") != "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS":
            errors.append({
                "code": "TABLE_RLS_CONTRACT_DRIFT",
                "subject": table_name,
                "actual": table.get("rowSecurity"),
            })
        expected_id_shape = {
            "name": table.get("idColumn", {}).get("name"),
            "sqlType": "BIGINT",
            "nullable": False,
            "default": "IDENTITY",
            "exposure": "INTERNAL_ONLY",
        }
        if table.get("idColumn") != expected_id_shape:
            errors.append({
                "code": "TABLE_INTERNAL_ID_PHYSICAL_SHAPE_DRIFT",
                "subject": table_name,
                "expected": expected_id_shape,
                "actual": table.get("idColumn"),
            })
        if len(names) != len(set(names)):
            errors.append({"code": "DUPLICATE_TABLE_COLUMN", "subject": table_name})
        column_specs: list[dict[str, Any]] = []
        for column in common.get("columns", []):
            column_specs.append(table["idColumn"] if column.get("name") == "__internal_id__" else column)
        column_specs.extend(table.get("columns", []))
        for column in column_specs:
            if not IDENT_RE.fullmatch(str(column.get("name", ""))):
                errors.append({
                    "code": "UNSAFE_COLUMN_IDENTIFIER", "subject": f"{table_name}.{column.get('name')}"
                })
            if not SQL_TYPE_RE.fullmatch(str(column.get("sqlType", ""))):
                errors.append({
                    "code": "UNSUPPORTED_SQL_TYPE",
                    "subject": f"{table_name}.{column.get('name')}",
                    "actual": column.get("sqlType"),
                })
            if column.get("default") is not None and not sql_default_is_safe(
                str(column.get("default"))
            ):
                errors.append({
                    "code": "UNSAFE_COLUMN_DEFAULT",
                    "subject": f"{table_name}.{column.get('name')}",
                })
        name_set = set(names)
        for group_name, id_key in (
            ("uniqueKeys", "constraintId"),
            ("checks", "constraintId"),
            ("indexes", "indexId"),
        ):
            for item in table.get(group_name, []):
                identifier = item.get(id_key)
                if not IDENT_RE.fullmatch(str(identifier or "")):
                    errors.append({
                        "code": "UNSAFE_CONSTRAINT_IDENTIFIER",
                        "subject": f"{table_name}.{identifier}",
                    })
                missing = set(item.get("columns", [])) - name_set
                if missing:
                    errors.append({
                        "code": "CONSTRAINT_COLUMN_MISSING",
                        "subject": f"{table_name}.{item.get(id_key)}",
                        "missing": sorted(missing),
                    })
                if group_name == "checks" and not sql_fragment_is_safe(
                    item.get("expression")
                ):
                    errors.append({
                        "code": "UNSAFE_CHECK_EXPRESSION",
                        "subject": f"{table_name}.{identifier}",
                    })
        if table.get("crossSchemaForeignKeys") not in (None, []):
            errors.append({
                "code": "CROSS_SCHEMA_FOREIGN_KEY_DECLARED",
                "subject": table_name,
                "actual": table.get("crossSchemaForeignKeys"),
            })
        validate_revision_temporal_arbitration(
            table, common, causal_operations, tables_by_id, errors
        )
        validate_temporal_exclusion_shape(table, common, errors)

    validate_owner_register(owner_by_table, tables_by_id, owner_register, errors)
    validate_relation_namespace(tables_by_id, owner_by_table, errors)

    # Local FKs are only legal inside one service/schema owner.  All other
    # references remain typed UUID/revision/as-of ports and never become SQL FKs.
    for table_name, table in tables_by_id.items():
        source_owner = owner_by_table.get(table_name)
        names = set(all_column_names(table, common))
        for foreign_key in table.get("foreignKeys", []):
            mode = foreign_key.get("mode")
            constraint_id = foreign_key.get("constraintId")
            if not IDENT_RE.fullmatch(str(constraint_id or "")):
                errors.append({
                    "code": "UNSAFE_FOREIGN_KEY_IDENTIFIER",
                    "subject": f"{table_name}.{constraint_id}",
                })
            missing = set(foreign_key.get("columns", [])) - names
            if missing:
                errors.append({
                    "code": "FOREIGN_KEY_SOURCE_COLUMN_MISSING",
                    "subject": f"{table_name}.{foreign_key.get('constraintId')}",
                    "missing": sorted(missing),
                })
            if mode == "OPAQUE_CROSS_BOUNDARY_REFERENCE":
                continue
            if mode != "LOCAL_COMPOSITE_FK":
                errors.append({
                    "code": "UNKNOWN_FOREIGN_KEY_MODE",
                    "subject": f"{table_name}.{foreign_key.get('constraintId')}",
                    "actual": mode,
                })
                continue
            target_name = foreign_key.get("target")
            target = tables_by_id.get(target_name)
            target_owner = owner_by_table.get(str(target_name))
            if target is None:
                errors.append({
                    "code": "LOCAL_FOREIGN_KEY_TARGET_MISSING",
                    "subject": f"{table_name}.{foreign_key.get('constraintId')}",
                    "target": target_name,
                })
                continue
            target_names = set(all_column_names(target, common))
            missing_target = set(foreign_key.get("targetColumns", [])) - target_names
            if missing_target:
                errors.append({
                    "code": "FOREIGN_KEY_TARGET_COLUMN_MISSING",
                    "subject": f"{table_name}.{foreign_key.get('constraintId')}",
                    "missing": sorted(missing_target),
                })
            source_columns = all_columns_by_name(table, common)
            target_columns = all_columns_by_name(target, common)
            source_types = [
                source_columns.get(column, {}).get("sqlType")
                for column in foreign_key.get("columns", [])
            ]
            target_types = [
                target_columns.get(column, {}).get("sqlType")
                for column in foreign_key.get("targetColumns", [])
            ]
            if len(source_types) != len(target_types) or source_types != target_types:
                errors.append({
                    "code": "FOREIGN_KEY_TYPE_MISMATCH",
                    "subject": f"{table_name}.{constraint_id}",
                    "sourceTypes": source_types,
                    "targetTypes": target_types,
                })
            target_unique = {
                tuple(columns)
                for _identifier, columns, _source in unique_specs(target)
            }
            target_unique.add((target["idColumn"]["name"],))
            if tuple(foreign_key.get("targetColumns", [])) not in target_unique:
                errors.append({
                    "code": "FOREIGN_KEY_TARGET_NOT_UNIQUE",
                    "subject": f"{table_name}.{constraint_id}",
                    "target": target_name,
                    "targetColumns": foreign_key.get("targetColumns", []),
                })
            if source_owner and target_owner and physical_unit(source_owner) != physical_unit(target_owner):
                errors.append({
                    "code": "CROSS_DEPLOYMENT_LOCAL_FOREIGN_KEY",
                    "subject": f"{table_name}.{foreign_key.get('constraintId')}",
                    "sourceOwner": source_owner,
                    "target": target_name,
                    "targetOwner": target_owner,
                    "required": "OPAQUE_CROSS_BOUNDARY_REFERENCE_WITH_VERSION_ASOF_OWNER_PORT",
                })

    # A command may not label a foreign-owner selector LOCAL_TABLE.  Query
    # composition is represented later as owner-port reads rather than joins.
    for causal in causal_by_id.values():
        if causal.get("mode") != "COMMAND":
            continue
        writes = [
            step.get("table")
            for step in causal.get("orderedDml", [])
            if step.get("table") in tables_by_id
            and step.get("action") not in {"SELECT", "LOCK_FOR_UPDATE"}
        ]
        write_units = {
            physical_unit(owner_by_table[name]) for name in writes if name in owner_by_table
        }
        if len(write_units) > 1:
            errors.append({
                "code": "COMMAND_CROSS_OWNER_DML",
                "subject": causal.get("operationId"),
                "owners": sorted([list(value) for value in write_units]),
            })
            continue
        home = next(iter(write_units), None)
        if home is None:
            binding = exact_by_id.get(str(causal.get("operationId")), {})
            binding_writes = binding.get("writesTables", [])
            binding_units = {
                physical_unit(owner_by_table[name])
                for name in binding_writes
                if name in owner_by_table
            }
            home = next(iter(binding_units), None) if len(binding_units) == 1 else None
        for selector in causal.get("selectors", []):
            target_name = selector.get("targetTable")
            if (
                home is not None
                and selector.get("selectorType") == "LOCAL_TABLE"
                and target_name in owner_by_table
                and physical_unit(owner_by_table[target_name]) != home
            ):
                errors.append({
                    "code": "COMMAND_CROSS_DEPLOYMENT_LOCAL_SELECTOR",
                    "subject": causal.get("operationId"),
                    "selectorSource": selector.get("source"),
                    "target": target_name,
                    "commandOwner": {"service": home[0], "schema": home[1]},
                    "targetOwner": owner_by_table[target_name],
                    "required": "SIGNED_OR_VERSIONED_OWNER_PORT_OR_OWNER_LOCAL_PROOF",
                })

    # Prove that the exact operation binding and its aggregate selector can be
    # implemented inside one owner database.  Unknown physical names must not be
    # silently dropped by the contract projection.
    for binding in exact_operations:
        operation_id = binding.get("operationId")
        referenced = (
            set(binding.get("readsTables", []))
            | set(binding.get("writesTables", []))
            | set((binding.get("responseProjection") or {}).get("physicalSources", []))
        )
        unknown = referenced - set(tables_by_id)
        if unknown:
            errors.append({
                "code": "OPERATION_PHYSICAL_TABLE_UNKNOWN",
                "subject": str(operation_id),
                "tables": sorted(unknown),
            })
        if binding.get("mode") == "QUERY" and binding.get("writesTables"):
            errors.append({
                "code": "QUERY_CANONICAL_WRITE_FORBIDDEN",
                "subject": str(operation_id),
                "tables": binding.get("writesTables"),
            })
        write_units = {
            physical_unit(owner_by_table[name])
            for name in binding.get("writesTables", [])
            if name in owner_by_table
        }
        if len(write_units) > 1:
            errors.append({
                "code": "OPERATION_BINDING_CROSS_OWNER_WRITE",
                "subject": str(operation_id),
                "owners": sorted([list(unit) for unit in write_units]),
            })
        causal = causal_by_id.get(str(operation_id), {})
        aggregate = causal.get("aggregateRoot") or {}
        aggregate_table = aggregate.get("table")
        if binding.get("mode") == "COMMAND":
            if aggregate_table not in tables_by_id:
                errors.append({
                    "code": "COMMAND_AGGREGATE_ROOT_MISSING",
                    "subject": str(operation_id),
                    "actual": aggregate_table,
                })
            else:
                aggregate_columns = set(all_column_names(tables_by_id[aggregate_table], common))
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
                    errors.append({
                        "code": "COMMAND_AGGREGATE_SELECTOR_COLUMN_INVALID",
                        "subject": str(operation_id),
                        "aggregateTable": aggregate_table,
                        "selectorColumns": selector_columns,
                    })
                aggregate_unit = physical_unit(owner_by_table[aggregate_table])
                if write_units and aggregate_unit not in write_units:
                    errors.append({
                        "code": "COMMAND_AGGREGATE_OWNER_MISMATCH",
                        "subject": str(operation_id),
                        "aggregateOwner": list(aggregate_unit),
                        "writeOwners": sorted([list(unit) for unit in write_units]),
                    })

    for handler in exact_handlers:
        handler_id = handler.get("handlerId")
        reads = set(handler.get("readsTables", []))
        writes = {
            write.get("table")
            for write in handler.get("writes", [])
            if write.get("table")
        }
        controls = {
            handler.get(key)
            for key in ("ticketTable", "receiptTable", "outboxTable")
            if handler.get(key)
        }
        unknown = (reads | writes | controls) - set(tables_by_id)
        if unknown:
            errors.append({
                "code": "HANDLER_PHYSICAL_TABLE_UNKNOWN",
                "subject": str(handler_id),
                "tables": sorted(unknown),
            })
        write_units = {
            physical_unit(owner_by_table[name])
            for name in writes | controls
            if name in owner_by_table
        }
        if len(write_units) != 1:
            errors.append({
                "code": "HANDLER_OWNER_LOCAL_TRANSACTION_INVALID",
                "subject": str(handler_id),
                "owners": sorted([list(unit) for unit in write_units]),
                "writeAndControlTables": sorted(writes | controls),
            })

    writer_map: dict[str, set[str]] = defaultdict(set)
    reader_map: dict[str, set[str]] = defaultdict(set)
    query_reader_map: dict[str, set[str]] = defaultdict(set)
    for binding in exact_operations:
        operation_id = binding.get("operationId")
        for table_name in binding.get("writesTables", []):
            writer_map[table_name].add(operation_id)
        for table_name in binding.get("readsTables", []):
            reader_map[table_name].add(operation_id)
        projection = binding.get("responseProjection") or {}
        for table_name in projection.get("physicalSources", []):
            reader_map[table_name].add(operation_id)
        if binding.get("mode") == "QUERY":
            for table_name in set(binding.get("readsTables", [])) | set(projection.get("physicalSources", [])):
                query_reader_map[table_name].add(operation_id)
    for handler in exact_handlers:
        handler_id = handler.get("handlerId")
        for write in handler.get("writes", []):
            writer_map[write.get("table")].add(handler_id)
        for table_name in handler.get("readsTables", []):
            reader_map[table_name].add(handler_id)

    policy_summary: dict[str, Any] = {
        "scopeProfile": profile_name,
        "pathRequired": expansion_policy is not None,
        "sha256": expansion_policy_hash,
        "policyId": expansion_policy.get("policyId") if expansion_policy else None,
        "schemaVersion": expansion_policy.get("schemaVersion") if expansion_policy else None,
        "addedTables": [],
    }
    if expansion_policy is not None:
        verify_self_seal(expansion_policy_filename, expansion_policy, errors)
        assert expansion_policy_hash is not None
        validate_scope_profile_authority(
            documents,
            hashes,
            expansion_policy,
            expansion_policy_hash,
            expansion_policy_filename,
            profile_name,
            profile,
            errors,
        )
        successor = expansion_policy.get("successorScope", {})
        added_rows = successor.get("addedRows", [])
        added_ids = [row.get("tableId") for row in added_rows]
        policy_summary["addedTables"] = added_ids
        if (
            successor.get("tableCount") != expected_counts["tables"]
            or successor.get("deltaCount") != 17
            or set(successor.get("removedTableIds", [])) != set(profile["removedTables"])
            or successor.get("netDelta", profile["netDelta"]) != profile["netDelta"]
            or len(added_ids) != 17
            or len(set(added_ids)) != 17
        ):
            errors.append({
                "code": "TABLE_EXPANSION_POLICY_SCOPE_DRIFT",
                "subject": expansion_policy.get("policyId"),
            })
        for row in added_rows:
            table_name = row.get("tableId")
            table = tables_by_id.get(table_name)
            if table is None:
                errors.append({"code": "EXPANSION_TABLE_MISSING", "subject": table_name})
                continue
            if table.get("session") != row.get("ownerSession"):
                errors.append({
                    "code": "EXPANSION_OWNER_SESSION_DRIFT",
                    "subject": table_name,
                    "expected": row.get("ownerSession"),
                    "actual": table.get("session"),
                })
            expected_producers = set(row.get("producers", []))
            actual_producers = writer_map.get(table_name, set())
            if expected_producers != actual_producers:
                errors.append({
                    "code": "EXPANSION_PRODUCER_CLOSURE_MISMATCH",
                    "subject": table_name,
                    "expected": sorted(expected_producers),
                    "actual": sorted(actual_producers),
                })
            declared_readers = set(row.get("readConsumers", []))
            actual_query_readers = query_reader_map.get(table_name, set())
            if not declared_readers:
                errors.append({
                    "code": "EXPANSION_READER_CLOSURE_MISSING",
                    "subject": table_name,
                    "required": "AT_LEAST_ONE_DECLARED_FIELD_POLICY_SAFE_READER",
                })
            missing_readers = declared_readers - actual_query_readers
            if missing_readers:
                errors.append({
                    "code": "EXPANSION_DECLARED_READER_NOT_PHYSICAL",
                    "subject": table_name,
                    "expected": sorted(declared_readers),
                    "actual": sorted(actual_query_readers),
                    "missing": sorted(missing_readers),
                })
            lineage_by_operation = {
                row.get("operationId"): row
                for row in exact.get("operationFieldLineage", [])
            }
            for reader in sorted(declared_readers):
                binding = exact_by_id.get(reader, {})
                projection = binding.get("responseProjection") or {}
                pep = projection.get("pep") or {}
                if not projection.get("fieldPolicy") or pep.get("denyOnUnavailable") is not True:
                    errors.append({
                        "code": "EXPANSION_READER_FIELD_POLICY_GUARD_MISSING",
                        "subject": f"{table_name}:{reader}",
                    })
                lineage = lineage_by_operation.get(reader, {}).get("responseFieldSources", [])
                direct = direct_physical_lineage_bindings(
                    lineage,
                    table_name,
                    set(all_column_names(tables_by_id[table_name], common)),
                )
                if len(direct) < 2:
                    errors.append({
                        "code": "EXPANSION_READER_DIRECT_LINEAGE_INCOMPLETE",
                        "subject": f"{table_name}:{reader}",
                        "required": 2,
                        "actual": len(direct),
                    })

    # q0's v3 preflight is a sealed historical oracle.  Keep its rendered
    # payload byte-identical while newer explicit profiles carry their profile
    # identity in this diagnostic summary.
    if profile_name == "v3-132-historical":
        policy_summary.pop("scopeProfile", None)

    # PAY owns no modern producer table in this canonical closed set.  Consumer
    # materializations remain separate and are not synthesized here.
    pay_tables = sorted(
        table_name for table_name, table in tables_by_id.items() if table.get("session") == "HRIS-PAY"
    )
    if pay_tables:
        errors.append({
            "code": "UNEXPECTED_PAY_MODERN_OWNER_TABLES",
            "subject": "HRIS-PAY",
            "tables": pay_tables,
        })

    context = {
        "manifest": manifest,
        "operation": operation,
        "exact": exact,
        "manifestById": manifest_by_id,
        "exactById": exact_by_id,
        "causalById": causal_by_id,
        "handlerById": handler_by_id,
        "tablesById": tables_by_id,
        "ownerByTable": owner_by_table,
        "writerMap": writer_map,
        "readerMap": reader_map,
        "queryReaderMap": query_reader_map,
        "sourceHashes": hashes,
        "observedCounts": observed,
        "scopeProfile": profile_name,
        "expansionPolicy": policy_summary,
        "ownerRegister": {
            "sha256": owner_register_hash,
            "bindingIds": sorted({
                owner["ownerBindingId"] for owner in owner_by_table.values()
            }),
        },
        "payModernOwnerTables": pay_tables,
    }
    return errors, context


def render_default(default: Any) -> str | None:
    if default is None:
        return None
    value = str(default)
    if value == "IDENTITY":
        return None
    return value


def render_column(column: dict[str, Any], *, identity: bool = False) -> str:
    result = f"    {column['name']} {column['sqlType']}"
    if identity or column.get("default") == "IDENTITY":
        result += " GENERATED BY DEFAULT AS IDENTITY"
    default = render_default(column.get("default"))
    if default is not None:
        result += f" DEFAULT {default}"
    if not column.get("nullable", False):
        result += " NOT NULL"
    return result


def unique_specs(table: dict[str, Any]) -> list[tuple[str, list[str], str]]:
    table_name = table["tableName"]
    id_column = table["idColumn"]["name"]
    rows: list[tuple[str, list[str], str]] = [
        (f"uk_{table_name}_tenant_public_physical_v4", ["tenant_id", "public_id"], "DERIVED_COMMON_PUBLIC_ID"),
        (f"uk_{table_name}_tenant_internal_physical_v4", ["tenant_id", id_column], "DERIVED_COMMON_INTERNAL_ID"),
    ]
    seen = {tuple(columns) for _, columns, _ in rows}
    for item in table.get("uniqueKeys", []):
        columns = list(item["columns"])
        if tuple(columns) in seen:
            continue
        seen.add(tuple(columns))
        rows.append((item["constraintId"], columns, "CANONICAL_EXACT_SCHEMA"))
    return rows


def render_temporal_exclusion(
    schema: str, table: dict[str, Any], item: dict[str, Any]
) -> str:
    columns_by_name = {
        column["name"]: column
        for column in table.get("columns", [])
    }
    range_source = item["range"]
    if range_source.startswith("[") and range_source.endswith(")"):
        start, end = [part.strip() for part in range_source[1:-1].split(",", 1)]
        start_type = columns_by_name[start]["sqlType"]
        function = "daterange" if start_type == "DATE" else "tstzrange"
        range_sql = f"{function}({start}, {end}, '[)')"
    else:
        range_sql = range_source
    members = [f"{column} WITH =" for column in item.get("partitionColumns", [])]
    members.append(f"{range_sql} WITH &&")
    constraint = physical_identifier(item["constraintId"])
    predicate = str(item.get("predicate", "")).strip()
    suffix = f" WHERE ({predicate})" if predicate else ""
    return (
        f"ALTER TABLE {schema}.{table['tableName']} ADD CONSTRAINT {constraint}\n"
        f"    EXCLUDE USING gist ({', '.join(members)}){suffix};"
    )


def materialize_temporal_exclusion(table: dict[str, Any], item: dict[str, Any]) -> bool:
    """Return whether the canonical exclusion becomes a database constraint."""
    if not item.get("revisionSemantics"):
        return True
    arbitration = table.get("temporalArbitration") or {}
    return not (
        arbitration.get("strategy") == SUPPORTED_TEMPORAL_ARBITRATION
        and arbitration.get("rawHistoryExclusion") == "NONE"
    )


def render_deployment_sql(
    deployment_key: str,
    tables: list[dict[str, Any]],
    owner_by_table: dict[str, dict[str, str]],
    source_hashes: dict[str, str],
    manifest_seal: str,
) -> str:
    deployment = DEPLOYMENTS[deployment_key]
    migration_role, runtime_role = DEPLOYMENT_ROLES[deployment_key]
    table_names = {table["tableName"] for table in tables}
    schemas = sorted({owner_by_table[name]["schema"] for name in table_names})
    lines = [
        f"-- DWP HRIS modern physical candidate v4 / {deployment_key}",
        "-- STATUS: CANDIDATE_NOT_G3_AUTHORITY; PRODUCTION: NOT_AUTHORIZED_G6",
        f"-- TARGET_SERVICE: {deployment['service']}",
        f"-- REQUIRED_MIGRATION_ROLE: {migration_role}",
        f"-- REQUIRED_RUNTIME_ROLE: {runtime_role}",
        "-- REQUIRED_RUNTIME_ATTRIBUTES: NOINHERIT; NOBYPASSRLS; NO_SCHEMA_CREATE",
        f"-- SOURCE_MANIFEST_FILE_SHA256: {source_hashes[MANIFEST_NAME]}",
        f"-- SOURCE_MANIFEST_SEALED_PAYLOAD_SHA256: {manifest_seal}",
        "-- Integration Control must allocate a new forward-only Flyway version; never edit historical SQL.",
        "BEGIN;",
        "DO $physical_preflight$",
        "BEGIN",
        "  IF current_setting('server_version_num')::INTEGER < 160000 THEN",
        "    RAISE EXCEPTION 'PostgreSQL 16 or newer is required';",
        "  END IF;",
        "  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN",
        "    RAISE EXCEPTION 'pgcrypto must be provisioned before this migration';",
        "  END IF;",
        "  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN",
        "    RAISE EXCEPTION 'btree_gist must be provisioned before this migration';",
        "  END IF;",
        f"  IF current_user <> '{migration_role}' THEN",
        f"    RAISE EXCEPTION 'migration must execute as {migration_role}';",
        "  END IF;",
        f"  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{runtime_role}' AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN",
        f"    RAISE EXCEPTION 'runtime role {runtime_role} must be NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION';",
        "  END IF;",
        "END",
        "$physical_preflight$;",
    ]
    for schema in schemas:
        if schema != "public":
            lines.append(f"CREATE SCHEMA IF NOT EXISTS {schema};")
            lines.append(f"ALTER SCHEMA {schema} OWNER TO {migration_role};")
        lines.append(f"REVOKE ALL ON SCHEMA {schema} FROM PUBLIC;")
        lines.append(f"REVOKE CREATE ON SCHEMA {schema} FROM {runtime_role};")
        lines.append(f"GRANT USAGE ON SCHEMA {schema} TO {runtime_role};")
    lines.append("")

    common = None
    # All table dictionaries are accompanied by a private helper-injected common
    # contract during generation; it is removed from emitted JSON.
    if tables:
        common = tables[0]["__commonTableContract"]

    for table in sorted(tables, key=lambda row: row["tableName"]):
        table_name = table["tableName"]
        schema = owner_by_table[table_name]["schema"]
        id_column = table["idColumn"]
        columns: list[dict[str, Any]] = []
        for column in common.get("columns", []):
            columns.append(id_column if column.get("name") == "__internal_id__" else column)
        columns.extend(table.get("columns", []))
        definitions = [render_column(column, identity=column is id_column) for column in columns]
        definitions.append(
            f"    CONSTRAINT {physical_identifier(f'pk_{table_name}_physical_v4')} PRIMARY KEY ({id_column['name']})"
        )
        for source_id, key_columns, _source in unique_specs(table):
            definitions.append(
                f"    CONSTRAINT {physical_identifier(source_id)} UNIQUE ({', '.join(key_columns)})"
            )
        for check in table.get("checks", []):
            definitions.append(
                f"    CONSTRAINT {physical_identifier(check['constraintId'])} CHECK ({check['expression']})"
            )
        lines.extend([
            f"CREATE TABLE {schema}.{table_name} (",
            ",\n".join(definitions),
            ");",
            f"COMMENT ON TABLE {schema}.{table_name} IS 'DWP HRIS modern physical candidate v4; {table['kind']}; NOT_AUTHORIZED_G6';",
            f"ALTER TABLE {schema}.{table_name} ENABLE ROW LEVEL SECURITY;",
            f"ALTER TABLE {schema}.{table_name} FORCE ROW LEVEL SECURITY;",
            f"CREATE POLICY {physical_identifier(f'tenant_isolation_{table_name}_v4')} ON {schema}.{table_name}",
            "    USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT)",
            "    WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::BIGINT);",
            f"REVOKE ALL ON TABLE {schema}.{table_name} FROM PUBLIC;",
            f"ALTER TABLE {schema}.{table_name} OWNER TO {migration_role};",
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {schema}.{table_name} TO {runtime_role};",
            f"REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE {schema}.{table_name} FROM {runtime_role};",
            "DO $candidate_sequence_acl$",
            "DECLARE sequence_name TEXT;",
            "BEGIN",
            f"  sequence_name := pg_get_serial_sequence('{schema}.{table_name}', '{id_column['name']}');",
            "  IF sequence_name IS NULL THEN",
            f"    RAISE EXCEPTION 'identity sequence missing for {schema}.{table_name}.{id_column['name']}';",
            "  END IF;",
            f"  EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO {runtime_role}', sequence_name);",
            "END",
            "$candidate_sequence_acl$;",
        ])
        for index in table.get("indexes", []):
            unique = "UNIQUE " if index.get("unique") else ""
            lines.append(
                f"CREATE {unique}INDEX {physical_identifier(index['indexId'])} "
                f"ON {schema}.{table_name} ({', '.join(index['columns'])});"
            )
        lines.append("")

    # Add local foreign keys only after the complete table set exists.  This
    # supports causal cycles without weakening referential integrity.
    for table in sorted(tables, key=lambda row: row["tableName"]):
        table_name = table["tableName"]
        schema = owner_by_table[table_name]["schema"]
        for foreign_key in table.get("foreignKeys", []):
            if foreign_key.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            target_name = foreign_key["target"]
            if target_name not in table_names:
                # Preflight guarantees this cannot be a local cross deployment.
                raise ValueError(
                    f"local FK target absent from deployment: {table_name}.{foreign_key['constraintId']}"
                )
            target_schema = owner_by_table[target_name]["schema"]
            lines.extend([
                f"ALTER TABLE {schema}.{table_name} ADD CONSTRAINT {physical_identifier(foreign_key['constraintId'])}",
                f"    FOREIGN KEY ({', '.join(foreign_key['columns'])})",
                f"    REFERENCES {target_schema}.{target_name} ({', '.join(foreign_key['targetColumns'])})",
                "    DEFERRABLE INITIALLY IMMEDIATE;",
            ])
        for exclusion in table.get("temporalExclusionConstraints", []):
            if materialize_temporal_exclusion(table, exclusion):
                lines.append(render_temporal_exclusion(schema, table, exclusion))
            else:
                lines.append(
                    f"-- TEMPORAL_ARBITRATION {schema}.{table_name} "
                    f"{physical_identifier(exclusion['constraintId'])}: "
                    "RAW_HISTORY_EXCLUSION_NOT_MATERIALIZED; "
                    "APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS"
                )
    lines.extend([
        "",
        "-- Cross-owner UUID/revision/as-of references intentionally have no SQL FK.",
        "-- Application owners must resolve them through authenticated, purpose-bound owner ports.",
        "COMMIT;",
        "",
    ])
    return "\n".join(lines)


def physical_table_ref(table_name: str, owner_by_table: dict[str, dict[str, str]]) -> dict[str, str]:
    owner = owner_by_table[table_name]
    return {
        "tableId": table_name,
        "service": owner["service"],
        "boundedContext": owner["boundedContext"],
        "schema": owner["schema"],
        "qualifiedName": f"{owner['schema']}.{table_name}",
        "deploymentKey": owner["deploymentKey"],
    }


def source_access_plan(
    table_names: Iterable[str],
    home_owner: dict[str, str] | None,
    owner_by_table: dict[str, dict[str, str]],
) -> list[dict[str, Any]]:
    result = []
    home_unit = physical_unit(home_owner) if home_owner else None
    for table_name in sorted(set(table_names)):
        owner = owner_by_table[table_name]
        local = home_unit is not None and physical_unit(owner) == home_unit
        result.append({
            **physical_table_ref(table_name, owner_by_table),
            "accessMode": "OWNER_LOCAL_SQL" if local else "TYPED_OWNER_PORT_NO_CROSS_SCHEMA_SQL",
            "tenantPurposeVersionAsOfRequired": not local,
        })
    return result


def infer_home_owner(
    binding: dict[str, Any], causal: dict[str, Any], owner_by_table: dict[str, dict[str, str]]
) -> dict[str, str] | None:
    candidates = list(binding.get("writesTables", []))
    root = (causal.get("aggregateRoot") or {}).get("table")
    if root:
        candidates.append(root)
    if not candidates:
        projection = binding.get("responseProjection") or {}
        entity = projection.get("entity", "")
        if isinstance(entity, str) and entity.startswith("table:"):
            candidates.append(entity.removeprefix("table:"))
        candidates.extend(binding.get("readsTables", []))
    owners = [owner_by_table[name] for name in candidates if name in owner_by_table]
    if not owners:
        return None
    # The command preflight guarantees one write owner.  A query's first
    # canonical entity owner is the API composition home.
    return owners[0]


def build_handler_contract(context: dict[str, Any], source_ref: dict[str, Any]) -> dict[str, Any]:
    exact = context["exact"]
    owner_by_table = context["ownerByTable"]
    transaction_by_session = context["operation"].get("transactionInfrastructure", {}).get("sessions", {})
    handlers = []
    for handler in sorted(exact.get("internalConsumerHandlers", []), key=lambda row: row["handlerId"]):
        touched = set(handler.get("readsTables", []))
        touched.update(write.get("table") for write in handler.get("writes", []) if write.get("table"))
        touched.update(
            handler.get(key)
            for key in ("ticketTable", "receiptTable", "outboxTable")
            if handler.get(key)
        )
        stream_key = handler.get("streamKey")
        if touched:
            first = next(iter(sorted(touched)))
            owner = owner_by_table[first]
        elif stream_key in LISTENING_STREAM_OWNER:
            owner = LISTENING_STREAM_OWNER[stream_key]
        else:
            raise ValueError(f"handler owner cannot be derived: {handler['handlerId']}")
        row = {
            "handlerId": handler["handlerId"],
            "capabilityId": handler.get("capabilityId"),
            "session": handler.get("session"),
            "owner": owner,
            "trigger": handler.get("trigger"),
            "aggregateRoot": handler.get("aggregateRoot"),
            "readPlan": source_access_plan(handler.get("readsTables", []), owner, owner_by_table),
            "writePlan": [
                {
                    **write,
                    "physicalTable": physical_table_ref(write["table"], owner_by_table),
                }
                for write in handler.get("writes", [])
            ],
            "specialPhysicalTables": source_access_plan(
                [name for name in touched if name not in set(handler.get("readsTables", [])) and name not in {write.get("table") for write in handler.get("writes", [])}],
                owner,
                owner_by_table,
            ),
            "transactionInfrastructure": transaction_by_session.get(handler.get("session")),
            "idempotency": handler.get("idempotency") or handler.get("idempotencyRule"),
            "orderedDml": handler.get("orderedDml") or handler.get("structuredTransaction"),
            "rollback": handler.get("rollback") or handler.get("structuredTransaction", {}).get("faultInjection"),
            "handlerContract": handler.get("handlerContract"),
            "event": handler.get("event"),
            "directCrossOwnerSql": "FORBIDDEN",
            "productionState": "NOT_AUTHORIZED_G6",
        }
        handlers.append(row)
    payload = {
        "contractId": "dwp.hris.modern.owner-handler-physical-contracts.v4.candidate",
        "schemaVersion": 4,
        "status": "CANDIDATE_NOT_G3_AUTHORITY",
        "sourceCanonical": source_ref,
        "handlerCount": len(handlers),
        "handlers": handlers,
        "invariants": {
            "transactionBoundary": "ONE_OWNER_LOCAL_DATABASE_TRANSACTION",
            "claimOrder": "CLAIM_OR_SEALED_REPLAY_BEFORE_DOMAIN_MUTATION",
            "differentDigestReplay": "CONFLICT_OR_QUARANTINE_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "faultInjection": "ANY_STAGE_FAILURE_ROLLS_BACK_OWNER_LOCAL_TRANSACTION",
            "externalCallInsideTransaction": False,
            "crossOwnerReference": "SIGNED_OR_VERSIONED_PURPOSE_BOUND_PORT_ONLY",
        },
        "productionState": "NOT_AUTHORIZED_G6",
    }
    return seal(payload)


def build_query_contract(context: dict[str, Any], source_ref: dict[str, Any]) -> dict[str, Any]:
    exact = context["exact"]
    owner_by_table = context["ownerByTable"]
    transaction_by_session = context["operation"].get("transactionInfrastructure", {}).get("sessions", {})
    operations = []
    projections = []
    for binding in sorted(exact.get("operationBindings", []), key=lambda row: row["operationId"]):
        causal = context["causalById"][binding["operationId"]]
        home = infer_home_owner(binding, causal, owner_by_table)
        reads = set(binding.get("readsTables", []))
        projection = binding.get("responseProjection") or {}
        reads.update(projection.get("physicalSources", []))
        writes = set(binding.get("writesTables", []))
        row = {
            "operationId": binding["operationId"],
            "capabilityId": binding.get("capabilityId"),
            "session": binding.get("session"),
            "mode": binding.get("mode"),
            "method": binding.get("method"),
            "path": binding.get("path"),
            "authorizationCapability": binding.get("authorizationCapability"),
            "homeOwner": home,
            "readPlan": source_access_plan(reads, home, owner_by_table),
            "writePlan": [
                {
                    **physical_table_ref(table_name, owner_by_table),
                    "accessMode": "OWNER_LOCAL_SQL",
                }
                for table_name in sorted(writes)
            ],
            "orderedDml": causal.get("orderedDml", []),
            "selectors": causal.get("selectors", []),
            "aggregateRoot": causal.get("aggregateRoot"),
            "transition": causal.get("transition"),
            "eventIds": [event.get("eventName") for event in causal.get("events", [])],
            "transactionInfrastructure": transaction_by_session.get(binding.get("session")),
            "responseSchemaRef": binding.get("responseSchemaRef"),
            "responseProjection": projection or None,
            "queryMutationPolicy": (
                "READ_ONLY_NO_RECEIPT_NO_OUTBOX" if binding.get("mode") == "QUERY" else None
            ),
            "crossOwnerReadPolicy": "TYPED_OWNER_PORT_NO_CROSS_SCHEMA_SQL",
            "productionState": "NOT_AUTHORIZED_G6",
        }
        operations.append(row)
        if binding.get("mode") == "QUERY":
            projections.append({
                "projectionId": f"{binding['operationId']}.physical-projection.v4",
                "operationId": binding["operationId"],
                "session": binding.get("session"),
                "homeOwner": home,
                "responseSchemaRef": binding.get("responseSchemaRef"),
                "physicalSources": source_access_plan(
                    projection.get("physicalSources", []), home, owner_by_table
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

    table_contracts = []
    for table_name, table in sorted(context["tablesById"].items()):
        owner = owner_by_table[table_name]
        constraints = {
            "primaryKey": {
                "source": "DERIVED_INTERNAL_ID",
                "columns": [table["idColumn"]["name"]],
                "physicalId": physical_identifier(f"pk_{table_name}_physical_v4"),
            },
            "uniqueKeys": [
                {
                    "sourceId": source_id,
                    "physicalId": physical_identifier(source_id),
                    "columns": columns,
                    "source": source,
                }
                for source_id, columns, source in unique_specs(table)
            ],
            "checks": [
                {
                    **check,
                    "physicalId": physical_identifier(check["constraintId"]),
                }
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
            "temporalExclusions": [
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
            ],
        }
        table_contracts.append({
            "tableId": table_name,
            "session": table.get("session"),
            "capabilityId": table.get("capabilityId"),
            "kind": table.get("kind"),
            "owner": owner,
            "qualifiedName": f"{owner['schema']}.{table_name}",
            "ddlFile": DEPLOYMENTS[owner["deploymentKey"]]["file"],
            "idColumn": table.get("idColumn"),
            "commonColumnsRef": table.get("commonColumnsRef"),
            "columns": table.get("columns", []),
            "constraints": constraints,
            "rowSecurity": table.get("rowSecurity"),
            "retentionPolicyRef": table.get("retentionPolicyRef"),
            "immutability": table.get("immutability"),
            "effectiveTime": table.get("effectiveTime"),
            "temporalArbitration": table.get("temporalArbitration"),
            "readers": sorted(context["readerMap"].get(table_name, set())),
            "producers": sorted(context["writerMap"].get(table_name, set())),
            "productionState": "NOT_AUTHORIZED_G6",
        })

    payload = {
        "contractId": "dwp.hris.modern.query-projection-physical-contracts.v4.candidate",
        "schemaVersion": 4,
        "status": "CANDIDATE_NOT_G3_AUTHORITY",
        "sourceCanonical": source_ref,
        "scope": {
            "operationCount": len(operations),
            "commandCount": sum(row["mode"] == "COMMAND" for row in operations),
            "queryCount": sum(row["mode"] == "QUERY" for row in operations),
            "queryProjectionCount": len(projections),
            "tableCount": len(table_contracts),
            "payModernOwnerTableCount": len(context["payModernOwnerTables"]),
        },
        "operationPhysicalContracts": operations,
        "queryProjectionPhysicalContracts": projections,
        "tablePhysicalContracts": table_contracts,
        "invariants": {
            "queryMutation": "FORBIDDEN",
            "crossOwnerSql": "FORBIDDEN",
            "crossOwnerReference": "PUBLIC_ID_PLUS_EXACT_VERSION_ASOF_PURPOSE_BOUND_OWNER_PORT",
            "tenantRls": (
                "ENABLE_AND_FORCE_RLS_ON_ALL_"
                f"{context['observedCounts']['tables']}_TABLES"
            ),
            "revisionHistory": (
                "APPEND_ONLY_PREDECESSOR_CHAIN_ROOT_CAS;RAW_HISTORY_EXCLUSION_NONE;"
                "CORRECTION_AND_FUTURE_SUPERSEDE_SYSTEM_BUSINESS_ASOF"
            ),
            "pay": "NO_MODERN_PRODUCER_TABLES;CONSUMER_MATERIALIZATION_IS_SEPARATE",
        },
        "productionState": "NOT_AUTHORIZED_G6",
    }
    return seal(payload)


def build_candidate(
    output_dir: Path,
    canonical_dir: Path,
    context: dict[str, Any],
    source_ref: dict[str, Any],
) -> dict[str, Any]:
    exact = context["exact"]
    owner_by_table = context["ownerByTable"]
    tables_by_deployment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for table in exact.get("tableSpecifications", []):
        materialized = copy.deepcopy(table)
        materialized["__commonTableContract"] = copy.deepcopy(exact["commonTableContract"])
        tables_by_deployment[owner_by_table[table["tableName"]]["deploymentKey"]].append(materialized)

    handler_contract = build_handler_contract(context, source_ref)
    query_contract = build_query_contract(context, source_ref)
    files: dict[str, bytes] = {}
    manifest_seal = context["manifest"].get("sealedPayloadSha256", "")
    for deployment_key in DEPLOYMENTS:
        tables = tables_by_deployment.get(deployment_key, [])
        if not tables:
            continue
        sql = render_deployment_sql(
            deployment_key,
            tables,
            owner_by_table,
            context["sourceHashes"],
            manifest_seal,
        )
        files[DEPLOYMENTS[deployment_key]["file"]] = sql.encode("utf-8")
    files["modern-owner-handler-physical-contracts.v4.json"] = (
        json.dumps(handler_contract, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    files["modern-query-projection-physical-contracts.v4.json"] = (
        json.dumps(query_contract, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")

    inventory = {
        name: {"sha256": sha256(raw), "bytes": len(raw)}
        for name, raw in sorted(files.items())
    }
    generation = seal({
        "reportId": "dwp.hris.modern.physical-candidate-generation.v4",
        "schemaVersion": 4,
        "status": "PASS_CANDIDATE_NOT_G3_AUTHORITY",
        "canonicalDirectory": canonical_dir.name,
        "sourceCanonical": source_ref,
        "counts": {
            **context["observedCounts"],
            "queryProjections": 66,
            "ddlDeploymentUnits": len([name for name in files if name.endswith(".sql")]),
            "payModernOwnerTables": len(context["payModernOwnerTables"]),
        },
        "tableExpansionPolicy": context["expansionPolicy"],
        "outputFiles": inventory,
        "authority": "TEMPORARY_PHYSICAL_CANDIDATE_ONLY",
        "productionState": "NOT_AUTHORIZED_G6",
    })
    generation_raw = (
        json.dumps(generation, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    files["physical-candidate-generation-report.v4.json"] = generation_raw

    output_dir = absolute_lexical(output_dir)
    parent = secure_directory(output_dir.parent)
    if os.path.lexists(output_dir):
        raise FileExistsError(f"refusing to overwrite candidate output: {output_dir}")
    temp_dir = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp.", dir=parent))
    temp_fd = open_directory_nofollow(temp_dir)
    try:
        for name, raw in files.items():
            fd = os.open(
                name,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                0o644,
                dir_fd=temp_fd,
            )
            with os.fdopen(fd, "wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
        os.fsync(temp_fd)
        publish_directory_noreplace(temp_dir, output_dir)
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    finally:
        os.close(temp_fd)
    return generation


FINDING_REQUIRED_CLOSURE = {
    "CONSTRAINT_COLUMN_MISSING": "RENAME_CONSTRAINT_COLUMNS_TO_EXISTING_EXACT_COLUMNS_OR_ADD_THE_DECLARED_TYPED_COLUMNS",
    "CROSS_DEPLOYMENT_LOCAL_FOREIGN_KEY": "REPLACE_WITH_VERSIONED_PUBLIC_REFERENCE_AND_OWNER_PORT;NO_CROSS_SCHEMA_FK",
    "COMMAND_CROSS_DEPLOYMENT_LOCAL_SELECTOR": "REPLACE_LOCAL_TABLE_SELECTOR_WITH_SIGNED_VERSIONED_PURPOSE_BOUND_OWNER_PORT_PROOF",
    "EXPANSION_PRODUCER_CLOSURE_MISMATCH": "MAKE_POLICY_PRODUCERS_EQUAL_THE_COMPLETE_CANONICAL_WRITER_SET",
    "EXPANSION_DECLARED_READER_NOT_PHYSICAL": "ADD_DECLARED_QUERY_TABLE_READ_AND_RESPONSE_PHYSICAL_SOURCE",
    "EXPANSION_READER_DIRECT_LINEAGE_INCOMPLETE": "ADD_AT_LEAST_TWO_DIRECT_DURABLE_TABLE_COLUMN_RESPONSE_LINEAGE_BINDINGS",
    "HANDLER_OWNER_LOCAL_TRANSACTION_INVALID": "DECLARE_EXACT_OWNER_LOCAL_ERASURE_DOMAIN_RECEIPT_TOMBSTONE_OUTBOX_WRITES_OR_A_SEALED_NON_SQL_OWNER_ACTION_CONTRACT",
    # Retained byte-for-byte because q0 is a sealed historical regression
    # oracle; do not normalize this legacy remediation label.
    "REVISION_TEMPORAL_ARBITRATION_MISSING": "ADD_THE_EXACT_APPEND_ONLY_predecessor_chain_ROOT_CAS_BUSINESS_AND_SYSTEM_ASOF_CONTRACT",
    "REVISION_TEMPORAL_CONCURRENCY_ROOT_AGGREGATE_DRIFT": "ALIGN_AGGREGATE_ROOT_AND_TRANSITION_WITH_THE_PRE_APPEND_OWNER_ROOT_UPDATE_CAS",
    "REVISION_TEMPORAL_CORRECTION_COLUMNS_MISSING": "ADD_TYPED_REVISION_MODE_PREDECESSOR_REASON_AND_CHANGED_FIELD_COLUMNS_PLUS_CAUSAL_BINDINGS_OR_REMOVE_CORRECTION_SUPPORT",
    "REVISION_TEMPORAL_EFFECTIVE_START_NULLABLE": "MAKE_EFFECTIVE_START_NOT_NULL_FOR_BUSINESS_ASOF_ARBITRATION",
    "REVISION_TEMPORAL_INSERT_EFFECTIVE_ASSIGNMENT_MISSING": "PERSIST_BOTH_BUSINESS_EFFECTIVE_BOUNDARIES_ON_INITIAL_AND_REVISED_HISTORY_INSERTS",
    "TEMPORAL_NULL_SEMANTICS_DRIFT": "DECLARE_NULL_END_AS_OPEN_ENDED_INFINITY_EXPLICITLY",
}


def finding_category(code: str) -> str:
    if code.startswith("EXPANSION_"):
        return "TABLE_EXPANSION_PRODUCER_READER_CLOSURE"
    if "TEMPORAL" in code or "REVISION_" in code:
        return "TEMPORAL_REVISION_ARBITRATION"
    if code in {
        "CROSS_DEPLOYMENT_LOCAL_FOREIGN_KEY",
        "COMMAND_CROSS_DEPLOYMENT_LOCAL_SELECTOR",
        "HANDLER_OWNER_LOCAL_TRANSACTION_INVALID",
    }:
        return "PHYSICAL_OWNER_BOUNDARY"
    if "CONSTRAINT" in code or "COLUMN" in code or "FOREIGN_KEY" in code:
        return "PHYSICAL_SCHEMA_DDL"
    if "AGGREGATE" in code or "COMMAND" in code or "HANDLER" in code:
        return "AGGREGATE_TRANSACTION"
    if "OWNER" in code:
        return "PHYSICAL_OWNER_BOUNDARY"
    return "SOURCE_INTEGRITY"


def enrich_findings(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = []
    for finding in errors:
        row = copy.deepcopy(finding)
        code = str(row.get("code", "UNKNOWN"))
        row.setdefault("category", finding_category(code))
        row.setdefault(
            "requiredClosure",
            FINDING_REQUIRED_CLOSURE.get(code, "REPAIR_SOURCE_AND_REACH_ZERO_FINDINGS"),
        )
        enriched.append(row)
    return enriched


def generator_tool_self_test() -> dict[str, Any]:
    cases: list[dict[str, Any]] = []

    def check(test_id: str, passed: bool) -> None:
        cases.append({"testId": test_id, "status": "PASS" if passed else "FAIL"})

    v6_profile = SCOPE_PROFILES["v6-131-owner-dependency-successor"]
    check(
        "v6-global-owner-dependency-profile-versioned",
        v6_profile.get("ownerDependencies") == 2
        and v6_profile.get("predecessorScopeProfile") == "v5-131-successor"
        and "ownerDependencies" not in SCOPE_PROFILES["v5-131-successor"],
    )

    missing: list[dict[str, Any]] = []
    verify_self_seal(
        MANIFEST_NAME,
        {"value": 1},
        missing,
        SCOPE_PROFILES["v3-132-historical"]["requiredSelfSeals"],
    )
    check("missing-canonical-seal-rejected", any(row["code"] == "SOURCE_SELF_SEAL_MISSING" for row in missing))
    check("unsafe-check-function-rejected", not sql_fragment_is_safe("pg_read_file('/etc/passwd') IS NOT NULL"))
    check("unsafe-default-function-rejected", not sql_default_is_safe("nextval('attacker.sequence')"))
    check("canonical-check-grammar-accepted", sql_fragment_is_safe("status IN ('ACTIVE','RETIRED')"))
    check("canonical-default-grammar-accepted", sql_default_is_safe("repeat('0', 64)"))
    empty_jsonb_cases = {
        "empty-jsonb-packages-accepted": (
            "subject_count>=0 AND anonymity_threshold>=5 AND ((state='READY' AND "
            "adequacy_category='ADEQUATE' AND subject_count>=anonymity_threshold "
            "AND measure_values IS NOT NULL) OR (state='SUPPRESSED' AND "
            "adequacy_category='SUPPRESSED' AND subject_count<anonymity_threshold "
            "AND (measure_values IS NULL OR measure_values='[]'::jsonb)))",
            True,
        ),
        "empty-jsonb-projections-accepted": (
            "anonymity_threshold>=5 AND ((adequacy_category='ADEQUATE' AND "
            "subject_count IS NOT NULL AND subject_count>=anonymity_threshold AND "
            "measure_values IS NOT NULL) OR (adequacy_category='SUPPRESSED' AND "
            "subject_count IS NULL AND (measure_values IS NULL OR measure_values='[]'::jsonb)))",
            True,
        ),
        "empty-jsonb-lineage-receipts-accepted": (
            "anonymity_threshold>=5 AND ((adequacy_category='ADEQUATE' AND "
            "subject_count IS NOT NULL AND subject_count>=anonymity_threshold AND "
            "measure_values IS NOT NULL) OR (adequacy_category='SUPPRESSED' AND "
            "subject_count IS NULL AND (measure_values IS NULL OR measure_values='[]'::jsonb)))",
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
        result = direct_physical_lineage_bindings(
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
            result == [("response.taskKey", "task_key")],
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
        and historical["policyFilename"] != successor["policyFilename"],
    )
    spoofed_counts = dict(successor["counts"])
    spoofed_counts["tables"] = 132
    check("v4-count-spoof-rejected", spoofed_counts != successor["counts"])
    check(
        "v4-removed-table-orphan-detected",
        _contains_exact_token(
            {"readsTables": [REMOVED_LISTENING_TABLE]}, REMOVED_LISTENING_TABLE
        ),
    )
    check(
        "v4-policy-byte-drift-rejected",
        sha256(b"hostile-policy-byte-drift") != successor["policySha256"],
    )
    with tempfile.TemporaryDirectory(
        prefix=".dwp-hris-generator-hostile-", dir=Path.cwd()
    ) as temp:
        parent = Path(temp)
        source = parent / "source"
        destination = parent / "destination"
        source.mkdir()
        destination.mkdir()
        sentinel = destination / "attacker-owned"
        sentinel.write_text("preserve", encoding="utf-8")
        rejected = False
        try:
            publish_directory_noreplace(source, destination)
        except OSError as exc:
            rejected = exc.errno in {errno.EEXIST, errno.ENOTEMPTY}
        check(
            "exclusive-publish-refuses-existing-destination",
            rejected and source.is_dir() and sentinel.read_text(encoding="utf-8") == "preserve",
        )
        real = parent / "real"
        real.mkdir()
        source_for_link = parent / "source-for-link"
        source_for_link.mkdir()
        destination_link = parent / "destination-link"
        destination_link.symlink_to(real, target_is_directory=True)
        link_rejected = False
        try:
            publish_directory_noreplace(source_for_link, destination_link)
        except OSError as exc:
            link_rejected = exc.errno in {errno.EEXIST, errno.ENOTEMPTY}
        check(
            "exclusive-publish-refuses-symlink-destination",
            link_rejected and destination_link.is_symlink() and source_for_link.is_dir(),
        )
        linked = parent / "linked"
        linked.symlink_to(real, target_is_directory=True)
        symlink_rejected = False
        try:
            secure_directory(linked)
        except (OSError, ValueError):
            symlink_rejected = True
        check("symlink-directory-rejected", symlink_rejected)
    passed = sum(case["status"] == "PASS" for case in cases)
    return seal({
        "reportId": "dwp.hris.modern.physical-candidate-generator-tool-self-test.v1",
        "status": "PASS" if passed == len(cases) else "FAIL",
        "passed": passed,
        "total": len(cases),
        "cases": cases,
    })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scope-profile",
        choices=tuple(SCOPE_PROFILES),
        default="v3-132-historical",
        help=(
            "explicit canonical/policy scope; the historical default preserves the "
            "sealed q0/v3 reproduction, while v4/131 must be selected explicitly"
        ),
    )
    parser.add_argument("--canonical-dir", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--expansion-policy", type=Path)
    parser.add_argument("--owner-prefix-register", type=Path)
    parser.add_argument("--preflight-report", type=Path)
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--tool-self-test", action="store_true")
    args = parser.parse_args()

    if args.tool_self_test:
        result = generator_tool_self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    missing_arguments = [
        flag
        for flag, value in (
            ("--canonical-dir", args.canonical_dir),
            ("--expansion-policy", args.expansion_policy),
            ("--owner-prefix-register", args.owner_prefix_register),
        )
        if value is None
    ]
    if missing_arguments:
        parser.error("the following arguments are required: " + ", ".join(missing_arguments))

    profile_name = args.scope_profile
    profile = SCOPE_PROFILES[profile_name]
    canonical_dir = absolute_lexical(args.canonical_dir)
    try:
        documents, _raw, hashes = load_sources(
            canonical_dir, profile["canonicalFiles"]
        )
        policy_path = absolute_lexical(args.expansion_policy)
        policy_raw = read_regular_nofollow(policy_path)
        policy = json.loads(policy_raw)
        owner_register_path = absolute_lexical(args.owner_prefix_register)
        owner_register, owner_register_raw, owner_register_hash = load_owner_register(
            owner_register_path
        )
        errors, context = validate_canonical(
            documents,
            hashes,
            policy,
            sha256(policy_raw),
            policy_path.name,
            owner_register,
            owner_register_hash,
            profile_name,
            profile,
        )
    except Exception as exc:
        errors = [{"code": "SOURCE_LOAD_FAILURE", "subject": str(canonical_dir), "detail": str(exc)}]
        context = {
            "scopeProfile": profile_name,
            "observedCounts": {},
            "sourceHashes": {},
            "expansionPolicy": {},
            "ownerRegister": {},
            "payModernOwnerTables": [],
        }

    errors = enrich_findings(errors)
    category_counts: dict[str, int] = defaultdict(int)
    code_counts: dict[str, int] = defaultdict(int)
    for finding in errors:
        category_counts[finding["category"]] += 1
        code_counts[finding["code"]] += 1
    preflight_payload = {
        "reportId": "dwp.hris.modern.physical-candidate-preflight-batch-baseline.v5",
        "schemaVersion": 5,
        "status": "PASS" if not errors else "FAIL_BLOCKED_SOURCE",
        "canonicalDirectory": canonical_dir.name,
        "canonicalFileSha256": context.get("sourceHashes", {}),
        "observedCounts": context.get("observedCounts", {}),
        "tableExpansionPolicy": context.get("expansionPolicy", {}),
        "physicalOwnerPrefixRegister": context.get("ownerRegister", {}),
        "payModernOwnerTables": context.get("payModernOwnerTables", []),
        "findingSummary": {
            "total": len(errors),
            "categoryCount": len(category_counts),
            "categories": dict(sorted(category_counts.items())),
            "codes": dict(sorted(code_counts.items())),
        },
        "errors": errors,
        "analysisScope": "STATIC_SCHEMA_DDL_OWNER_AGGREGATE_TEMPORAL_EXPANSION_CLOSURE",
        "analysisScopeFrozenForCanonicalBytes": True,
        "postgresPolicy": "DO_NOT_RUN_UNTIL_STATIC_ZERO_ON_A_NEW_CANONICAL_CANDIDATE",
        "authority": "PREFLIGHT_ONLY_NOT_G3_AUTHORITY",
    }
    if profile_name != "v3-132-historical":
        preflight_payload["scopeProfile"] = profile_name
    preflight = seal(preflight_payload)
    if args.preflight_report:
        report_path = absolute_lexical(args.preflight_report)
        if os.path.lexists(report_path):
            print(f"ERROR refusing to overwrite preflight report: {report_path}", file=sys.stderr)
            return 2
        write_json(report_path, preflight)
    print(json.dumps(preflight, ensure_ascii=False, sort_keys=True))
    if errors:
        return 3
    if args.preflight_only:
        return 0
    if args.output_dir is None:
        print("ERROR --output-dir is required unless --preflight-only is used", file=sys.stderr)
        return 2

    source_ref = {
        "scopeProfile": profile_name,
        "directory": canonical_dir.name,
        "fileSha256": hashes,
        "manifestSealedPayloadSha256": documents[MANIFEST_NAME].get("sealedPayloadSha256"),
        "tableExpansionPolicy": {
            "path": args.expansion_policy.name,
            "policyId": policy.get("policyId"),
            "schemaVersion": policy.get("schemaVersion"),
            "sha256": sha256(policy_raw),
            "sealedPayloadSha256": policy.get("sealedPayloadSha256"),
        },
        "physicalOwnerPrefixRegister": {
            "path": args.owner_prefix_register.name,
            "sha256": owner_register_hash,
        },
    }
    try:
        generation = build_candidate(absolute_lexical(args.output_dir), canonical_dir, context, source_ref)
    except Exception as exc:
        print(f"ERROR candidate generation failed: {exc}", file=sys.stderr)
        return 4
    print(json.dumps(generation, ensure_ascii=False, sort_keys=True))
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
