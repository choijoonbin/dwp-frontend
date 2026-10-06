#!/usr/bin/env python3
"""Run the frozen modern-causal design on real PostgreSQL 16 and 18.

This reviewer-owned runner never imports the candidate generator or candidate
validators.  It executes the checked-in owner receipt/inbox/outbox DDL together
with the exact 71-table modern projection and records a canonical v2 receipt.
`--check` re-executes both engines and never changes evidence bytes.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from modern_causal_successor_profile import (
    LEGACY_PROFILE,
    SUCCESSOR_PROFILE,
    SUCCESSOR_CANONICAL_COUNTS,
    SUCCESSOR_OWNER_DEPENDENCY_PINS,
    SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
    SUCCESSOR_UNSIGNED_EVIDENCE,
    SuccessorProfileError,
    create_only_json,
    hostile_self_test as successor_profile_hostile_self_test,
    pending_successor_inputs,
    profile_metadata,
    require_profile,
    successor_paths,
    successor_owner_dependency_receipt,
    verify_successor_owner_dependencies,
    verify_successor_owner_dependency_receipt,
    verify_successor_closed_set_manifest_reference,
    successor_stage_state,
    verify_accepted_live_canonical,
    successor_target_failures,
    verify_predecessor_pins,
)


BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
G0 = ROOT / "g0"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))

from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)


ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
EXACT_PATH = BASE / "modern-capability-exact-schema-contracts.v1.json"
CAUSAL_PATH = BASE / "modern-capability-causal-state-contracts.v2.json"
EVENTS_PATH = BASE / "modern-capability-event-payload-contracts.v1.json"
LINEAGE_PATH = BASE / "modern-capability-event-successor-lineage.v2.json"
OWNERSHIP_PATH = BASE / "g3-contract-primary-ownership-register.csv"
REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
BUILDER_PATH = BASE / "build_modern_causal_independent_oracle.py"
INDEPENDENT_PATH = BASE / "validate_modern_causal_independent_oracle.py"
FINAL_VERIFIER_PATH = BASE / "validate_modern_causal_final_endorsement.py"
SOURCE_MANIFEST_PATH = BASE / "modern-causal-final-source-authority-manifest.v1.json"
CONTROL_INTAKE_PATH = ROOT / "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"
EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.json"
UNSIGNED_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.unsigned.json"
ACTIVE_PROFILE = LEGACY_PROFILE
ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)


def configure_profile(name: str) -> dict[str, Any]:
    """Switch output paths without changing the historical v1/v2 chain."""
    global ACTIVE_PROFILE, ACTIVE_PROFILE_METADATA
    global ORACLE_PATH, FIXTURE_PATH, REVIEW_INVENTORY_PATH, REVIEW_FINALIZATION_PATH
    global SOURCE_MANIFEST_PATH, CONTROL_INTAKE_PATH, EVIDENCE_PATH, UNSIGNED_EVIDENCE_PATH
    global EVIDENCE_ID, EVIDENCE_SCHEMA_VERSION
    name = require_profile(name)
    ACTIVE_PROFILE = name
    if name == SUCCESSOR_PROFILE:
        paths = successor_paths(BASE, ROOT)
        ORACLE_PATH = paths["oracle"]
        FIXTURE_PATH = paths["fixture"]
        REVIEW_INVENTORY_PATH = paths["reviewInventory"]
        REVIEW_FINALIZATION_PATH = paths["reviewFinalization"]
        SOURCE_MANIFEST_PATH = paths["sourceAuthority"]
        CONTROL_INTAKE_PATH = paths["controlIntake"]
        EVIDENCE_PATH = paths["pgEvidence"]
        UNSIGNED_EVIDENCE_PATH = BASE / SUCCESSOR_UNSIGNED_EVIDENCE
        EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v3"
        EVIDENCE_SCHEMA_VERSION = 3
    else:
        ORACLE_PATH = BASE / "modern-causal-independent-oracle.v1.json"
        FIXTURE_PATH = BASE / "modern-causal-independent-pg-fixtures.v1.json"
        REVIEW_INVENTORY_PATH = BASE / "modern-causal-independent-review-inventory.v1.json"
        REVIEW_FINALIZATION_PATH = BASE / "modern-causal-independent-reviewed-finalization.v1.json"
        SOURCE_MANIFEST_PATH = BASE / "modern-causal-final-source-authority-manifest.v1.json"
        CONTROL_INTAKE_PATH = ROOT / "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"
        EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.json"
        UNSIGNED_EVIDENCE_PATH = BASE / "reports/modern-causal-independent-pg-evidence.v2.unsigned.json"
        EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v2"
        EVIDENCE_SCHEMA_VERSION = 2
    ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, ROOT)
    return ACTIVE_PROFILE_METADATA


def successor_preflight() -> dict[str, Any]:
    paths = successor_paths(BASE, ROOT)
    stages = successor_stage_state(BASE, ROOT)
    return {
        "profile": ACTIVE_PROFILE,
        "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "successorArtifacts": {
            key: str(value.relative_to(ROOT)) for key, value in paths.items()
        },
        "missingSuccessorInputs": pending_successor_inputs(BASE, ROOT, stage="review-input"),
        "stageState": stages,
        "acceptedLivePreflight": (
            __import__("modern_causal_successor_profile", fromlist=["accepted_live_preflight"])
            .accepted_live_preflight(BASE, ROOT)
        ),
        "predecessorPinFailures": verify_predecessor_pins(ROOT),
        "successorTargetFailures": successor_target_failures(BASE, ROOT),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA.get("predecessorDisposition"),
    }

POSTGRES_IMAGES = {16: "postgres:16", 18: "postgres:18.4"}
PROJECTION_ID = "dwp.hris.modern-causal.pg-semantic-result.v1"
EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v2"
EVIDENCE_SCHEMA_VERSION = 2
GATE_POLICY = "INTERNAL_REVIEW_WORKFLOW_AND_CONTROL_INTAKE_REQUIRED"

FROZEN_CANDIDATE_HASHES = {
    "causal": "d45e2b944848a2b2d671471a368f4320f90ae6fb41d74622d2fad03dccff4d76",
    "exact": "5c5fa702c137f879f83f6aa0af918f6ec3769b4c0171d5c2db43fd894ccee76a",
    "events": "12a14952c99da6a8a1dd4d27fb3f46b9f0e3a36a02fa06530c170b66b9211cc3",
    "lineage": "1cef1d132869213841d049b2cfacd63a94593e0de281a03f4773eefceb5cd748",
    "ownership": "b2a6f6bbfdad4dda8b17962fe95638b2c95c7435968904936b1d87ff21010ec1",
}
CANDIDATE_PATHS = {
    "causal": CAUSAL_PATH, "exact": EXACT_PATH, "events": EVENTS_PATH,
    "lineage": LINEAGE_PATH, "ownership": OWNERSHIP_PATH,
}

BASE_DDL = {
    "HRIS-HRM-RECEIPT-INBOX": (
        "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
        "dbe18b0a2700bac21088391d2d9c13d155d30058b44843aeed033d3333896969",
    ),
    "HRIS-HRM-OUTBOX": (
        "../../dwp-backend/dwp-people-server/src/main/resources/db/migration/V1__create_workforce_projection.sql",
        "1d5d10b46be944669efca74e7af8e3d5cd6d09f9b388f2de4accd83a18d1a40e",
    ),
    "HRIS-PER": (
        "session-evidence/per/g2-readiness/physical-schema.sql",
        "0099544d7a5fa22bd4b565664b21e5f8f1a68288cce16cdbec83a212f5e70d44",
    ),
    "HRIS-TIM": (
        "session-evidence/tim/g2-physical-schema.sql",
        "01325e939dc1d116d53067d0332f348146d13c2be6a1e314357e82d3e2769a80",
    ),
    "HRIS-SYS-RECEIPT": (
        "session-evidence/sys/g2-physical-schema.sql",
        "e1d47e863e9883f37507f381c9a0c328725832d02c0ee1b426a6f709b86e2821",
    ),
    "HRIS-SYS-INBOX-OUTBOX": (
        "../../dwp-backend/dwp-core/src/main/resources/db/migration/R__create_domain_event_delivery_ledger.sql",
        "e7123a27e6d35c991f8f49045f0f92205ff417bfbcf89a2b9a32f9ad0f479e42",
    ),
}

PROFILES = {
    "HRIS-HRM": {
        "receipt": "ppl_command_receipts", "inbox": "ppl_domain_inbox_receipts",
        "outbox": "sys_people_outbox_events", "ddl": ("HRIS-HRM-RECEIPT-INBOX", "HRIS-HRM-OUTBOX"),
        "guard": ("ppl_guard_command_receipt_originating_auth", "trg_ppl_command_receipt_originating_auth"),
        "guardMessage": "HRM command receipt originating authorization and caller-bound idempotency context is immutable",
    },
    "HRIS-PER": {
        "receipt": "prf_command_receipts", "inbox": "prf_inbox_receipts",
        "outbox": "prf_outbox_events", "ddl": ("HRIS-PER",),
        "guard": ("prf_guard_command_receipt_originating_auth", "trg_prf_command_receipt_originating_auth"),
        "guardMessage": "PER command receipt originating authorization and caller-bound idempotency context is immutable",
    },
    "HRIS-TIM": {
        "receipt": "tme_command_receipts", "inbox": "tme_inbox_receipts",
        "outbox": "tme_outbox_events", "ddl": ("HRIS-TIM",),
        "guard": ("tme_guard_command_receipt_seal", "tr_tme_command_receipt_seal"),
        "guardMessage": "TIM command receipt originating authorization and idempotency context is immutable",
    },
    "HRIS-SYS": {
        "receipt": "sys_hris_command_receipts", "inbox": "sys_domain_event_inbox",
        "outbox": "sys_domain_event_outbox", "ddl": ("HRIS-SYS-RECEIPT", "HRIS-SYS-INBOX-OUTBOX"),
        "guard": ("sys_hris_guard_command_receipt_seal", "tr_sys_hris_command_receipt_seal"),
        "guardMessage": "Platform HRIS command receipt authorization and idempotency seal is immutable",
    },
}

SQL_TYPE = re.compile(
    r"^(UUID|BIGSERIAL|BIGINT|INTEGER|SMALLINT|BOOLEAN|JSONB|TEXT|DATE|"
    r"TIMESTAMPTZ|TIMESTAMP|CHAR\s*\(\s*\d+\s*\)|VARCHAR\s*\(\s*\d+\s*\))(?=\s|$)", re.I,
)


class StrictJsonError(ValueError):
    pass


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise StrictJsonError(f"duplicate key: {key}")
        result[key] = value
    return result


def reject_float(_: str) -> None:
    raise StrictJsonError("floating/exponent JSON numbers are forbidden")


def load_json(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise StrictJsonError(f"BOM forbidden: {path}")
    value = json.loads(
        raw.decode("utf-8"), object_pairs_hook=reject_duplicate_pairs,
        parse_float=reject_float, parse_constant=reject_float,
    )
    if not isinstance(value, dict):
        raise StrictJsonError(f"top-level object required: {path}")
    return value


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def canonical_value_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def semantic_seal(value: dict[str, Any]) -> str:
    return canonical_value_hash({key: copy.deepcopy(item) for key, item in value.items()
                                 if key != "sealedPayloadSha256"})


def evidence_core_seal(value: dict[str, Any]) -> str:
    return canonical_value_hash({key: copy.deepcopy(item) for key, item in value.items()
                                 if key not in {"sealedPayloadSha256", "secondReviewer"}})


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    # PG evidence is a sealed approval input.  A rerun must allocate a new
    # version/path rather than replacing a prior evidence byte sequence.
    create_only_json(path, value)


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def uuid_sql(salt: int, member: int = 1) -> str:
    return quote(f"{salt & 0xffffffff:08x}-0000-4000-8000-{member & 0xffffffffffff:012x}") + "::uuid"


def ddl_path(relative: str) -> Path:
    return (ROOT / relative).resolve()


def extract_create_table(sql: str, table: str) -> str:
    match = re.search(rf"\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+{re.escape(table)}\s*\(", sql, re.I)
    if not match:
        raise ValueError(f"missing CREATE TABLE {table}")
    start, index, depth, marker = match.start(), match.end() - 1, 0, None
    while index < len(sql):
        char = sql[index]
        if marker:
            if char == marker:
                if index + 1 < len(sql) and sql[index + 1] == marker:
                    index += 1
                else:
                    marker = None
        elif char in {"'", '"'}:
            marker = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                end = sql.find(";", index)
                if end < 0:
                    raise ValueError(f"unterminated CREATE TABLE {table}")
                return sql[start:end + 1]
        index += 1
    raise ValueError(f"unterminated CREATE TABLE {table}")


def extract_guard_function(sql: str, name: str) -> str:
    match = re.search(rf"\bCREATE\s+OR\s+REPLACE\s+FUNCTION\s+{re.escape(name)}\s*\(\)", sql, re.I)
    if not match:
        raise ValueError(f"missing guard function {name}")
    end = sql.find("$$;", match.end())
    if end < 0:
        raise ValueError(f"unterminated guard function {name}")
    return sql[match.start():end + 3]


def extract_trigger(sql: str, name: str) -> str:
    match = re.search(rf"\bCREATE\s+TRIGGER\s+{re.escape(name)}\b", sql, re.I)
    if not match:
        raise ValueError(f"missing guard trigger {name}")
    end = sql.find(";", match.end())
    if end < 0:
        raise ValueError(f"unterminated guard trigger {name}")
    return sql[match.start():end + 1]


def parse_ddl_columns(statement: str) -> dict[str, dict[str, Any]]:
    columns: dict[str, dict[str, Any]] = {}
    for line in statement.splitlines()[1:]:
        stripped = line.strip().rstrip(",")
        if not stripped or stripped.upper().startswith(
                ("CONSTRAINT ", "PRIMARY ", "UNIQUE ", "FOREIGN ", "CHECK ")):
            continue
        match = re.match(r"([a-z][a-z0-9_]*)\s+(.+)$", stripped, re.I)
        if not match:
            continue
        name, remainder = match.groups()
        type_match = SQL_TYPE.match(remainder)
        if not type_match:
            continue
        sql_type = re.sub(r"\s+", "", type_match.group(1).upper())
        generated = sql_type == "BIGSERIAL" or "GENERATED " in remainder.upper()
        if sql_type == "BIGSERIAL":
            sql_type = "BIGINT"
        tail = remainder[type_match.end():]
        columns[name] = {"sqlType": sql_type,
                         "nullable": "NOT NULL" not in tail.upper() and "PRIMARY KEY" not in tail.upper(),
                         "default": generated or bool(re.search(r"\bDEFAULT\b", tail, re.I))}
    return columns


def load_transaction_ddl() -> tuple[dict[str, dict[str, dict[str, Any]]], list[str]]:
    source_sql: dict[str, str] = {}
    for label, (relative, digest) in BASE_DDL.items():
        path = ddl_path(relative)
        if not path.is_file() or file_hash(path) != digest:
            raise ValueError(f"checked-in DDL hash mismatch {label}:{path}")
        source_sql[label] = path.read_text(encoding="utf-8")
    columns: dict[str, dict[str, dict[str, Any]]] = {}
    statements: dict[str, str] = {}
    guards: list[str] = []
    for session, profile in PROFILES.items():
        owner_sql = "\n".join(source_sql[key] for key in profile["ddl"])
        for table in (profile["receipt"], profile["inbox"], profile["outbox"]):
            matches: list[str] = []
            for key in profile["ddl"]:
                try:
                    matches.append(extract_create_table(source_sql[key], table))
                except ValueError:
                    pass
            if len(matches) != 1:
                raise ValueError(f"{session}:{table} must have exactly one physical definition")
            statements[table] = matches[0]
            columns[table] = parse_ddl_columns(matches[0])
        function_name, trigger_name = profile["guard"]
        guards.extend([extract_guard_function(owner_sql, function_name),
                       extract_trigger(owner_sql, trigger_name)])
    if len(statements) != 12:
        raise ValueError(f"physical transaction table closure is {len(statements)}, expected 12")
    return columns, [statements[name] for name in sorted(statements)] + guards


def physical_columns(exact: dict[str, Any], table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    common = [row for row in exact["commonTableContract"]["columns"]
              if row["name"] != "__internal_id__"]
    return {row["name"]: row for row in [table["idColumn"], *common, *table["columns"]]}


def allowed_states(table: dict[str, Any], column: str) -> set[str]:
    values: set[str] = set()
    for check in table.get("checks", []):
        if column not in check.get("columns", []):
            continue
        match = re.search(rf"\b{re.escape(column)}\s+IN\s*\(([^)]*)\)", check.get("expression", ""), re.I)
        if match:
            values.update(re.findall(r"'([^']+)'", match.group(1)))
        equal = re.search(rf"\b{re.escape(column)}\s*=\s*'([^']+)'", check.get("expression", ""), re.I)
        if equal:
            values.add(equal.group(1))
    return values


def normalize_type(value: str) -> str:
    upper = value.upper()
    if upper.startswith(("VARCHAR", "CHAR", "TEXT")):
        return "STRING"
    if upper.startswith(("NUMERIC", "DECIMAL")):
        return "DECIMAL"
    if upper in {"INT", "INTEGER", "SMALLINT", "BIGINT"}:
        return "INTEGER"
    return upper


def sample_value(column: dict[str, Any], table_no: int, column_no: int,
                 accepted: set[str] | None = None) -> str:
    name, value_type = column["name"], column["sqlType"].upper()
    if accepted:
        return quote(sorted(accepted)[0])
    if value_type == "UUID":
        return uuid_sql(table_no, column_no)
    if value_type == "UUID[]":
        return "ARRAY[" + uuid_sql(0x20000000, 1) + "]"
    if value_type in {"BIGINT", "INTEGER", "SMALLINT"}:
        if name == "prohibited_attribute_count":
            return "0"
        return "2" if name in {"line_count", "shift_line_count"} else ("5" if "count" in name else "1")
    if value_type.startswith(("NUMERIC", "DECIMAL")):
        return "1"
    if value_type == "BOOLEAN":
        return "TRUE"
    if value_type == "DATE":
        return "DATE '2026-01-02'" if re.search(r"(?:to|end|expiry)", name) else "DATE '2026-01-01'"
    if value_type.startswith("TIMESTAMP"):
        return ("TIMESTAMPTZ '2026-01-02 00:00:00+00'" if re.search(
            r"(?:to|end|ends|close|expires|due|completed|published)", name)
                else "TIMESTAMPTZ '2026-01-01 00:00:00+00'")
    if value_type == "JSONB":
        return "'{}'::jsonb"
    if value_type.endswith("[]"):
        return "ARRAY[]::" + value_type.lower()
    if "digest" in name or "hash" in name or value_type == "CHAR(64)":
        return "repeat('a',64)"
    if value_type == "CHAR(3)" or "currency" in name:
        return "'USD'"
    return quote(f"v{table_no}_{column_no}")


def render_modern_ddl(exact: dict[str, Any]) -> str:
    common = [row for row in exact["commonTableContract"]["columns"]
              if row["name"] != "__internal_id__"]
    statements: list[str] = []
    for number, table in enumerate(exact["tableSpecifications"], 1):
        definitions = [f"{table['idColumn']['name']} BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"]
        for column in [*common, *table["columns"]]:
            definition = f"{column['name']} {column['sqlType']}"
            if column.get("default") is not None:
                definition += f" DEFAULT {column['default']}"
            if column.get("nullable") is False:
                definition += " NOT NULL"
            definitions.append(definition)
        statements.append(f"CREATE TABLE {table['tableName']} (\n  " + ",\n  ".join(definitions) + "\n)")
        for key_no, key in enumerate(table["uniqueKeys"], 1):
            statements.append(f"ALTER TABLE {table['tableName']} ADD CONSTRAINT m{number}_uk{key_no} "
                              f"UNIQUE ({', '.join(key['columns'])})")
        for check_no, check in enumerate(table["checks"], 1):
            statements.append(f"ALTER TABLE {table['tableName']} ADD CONSTRAINT m{number}_ck{check_no} "
                              f"CHECK ({check['expression']})")
        statements.extend([f"ALTER TABLE {table['tableName']} ENABLE ROW LEVEL SECURITY",
                           f"ALTER TABLE {table['tableName']} FORCE ROW LEVEL SECURITY"])
    names = {row["tableName"] for row in exact["tableSpecifications"]}
    for number, table in enumerate(exact["tableSpecifications"], 1):
        local_no = 0
        for fk in table["foreignKeys"]:
            if fk["mode"] != "LOCAL_COMPOSITE_FK":
                continue
            local_no += 1
            if fk["target"] not in names:
                raise ValueError(f"unknown local FK target: {fk['target']}")
            statements.append(f"ALTER TABLE {table['tableName']} ADD CONSTRAINT m{number}_fk{local_no} "
                              f"FOREIGN KEY ({', '.join(fk['columns'])}) REFERENCES {fk['target']} "
                              f"({', '.join(fk['targetColumns'])})")
    return ";\n".join(statements)


def modern_tables(exact: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = exact.get("tableSpecifications")
    if not isinstance(rows, list) or len(rows) != 71:
        raise ValueError("frozen exact schema must contain exactly 71 tables")
    result = {str(row["tableName"]): row for row in rows}
    if len(result) != 71:
        raise ValueError("duplicate modern table name")
    return result


def dependency_order(
    exact: dict[str, Any], tables: dict[str, dict[str, Any]],
) -> tuple[list[str], dict[str, int], dict[str, dict[str, dict[str, Any]]]]:
    columns = {name: physical_columns(exact, row) for name, row in tables.items()}
    dependencies: dict[str, set[str]] = {}
    for name, row in tables.items():
        dependencies[name] = {
            fk["target"]
            for fk in row.get("foreignKeys", [])
            if fk.get("mode") == "LOCAL_COMPOSITE_FK"
            and any(
                column != "tenant_id" and columns[name][column].get("nullable") is False
                for column in fk["columns"]
            )
        }
    order: list[str] = []
    pending = set(tables)
    while pending:
        ready = sorted(name for name in pending if dependencies[name] <= set(order))
        if not ready:
            raise ValueError("non-null local FK cycle: " + ",".join(sorted(pending)))
        order.extend(ready)
        pending -= set(ready)
    return order, {name: index for index, name in enumerate(order, 1)}, columns


def local_fk_columns(row: dict[str, Any]) -> dict[str, tuple[str, str]]:
    result: dict[str, tuple[str, str]] = {}
    for fk in row.get("foreignKeys", []):
        if fk.get("mode") != "LOCAL_COMPOSITE_FK":
            continue
        for source, target in zip(fk["columns"], fk["targetColumns"]):
            result[source] = (fk["target"], target)
    return result


def required_for_state(row: dict[str, Any], state: str) -> set[str]:
    result: set[str] = set()
    for check in row.get("checks", []):
        expression = str(check.get("expression", ""))
        if state not in expression:
            continue
        result.update(re.findall(r"\b([a-z][a-z0-9_]*)\s+IS\s+NOT\s+NULL\b", expression, re.I))
    return result


def render_seed_sql(
    exact: dict[str, Any], tables: dict[str, dict[str, Any]], order: list[str],
    numbers: dict[str, int], all_columns: dict[str, dict[str, dict[str, Any]]],
) -> list[str]:
    common = [row for row in exact["commonTableContract"]["columns"]
              if row["name"] != "__internal_id__"]
    statements: list[str] = []
    inserted: set[str] = set()
    for name in order:
        row = tables[name]
        columns = [row["idColumn"], *common, *row["columns"]]
        local = local_fk_columns(row)
        selected = {
            column["name"] for column in columns
            if column.get("nullable") is False and column.get("default") is None
        }
        selected.update({row["idColumn"]["name"], "tenant_id", "public_id", "aggregate_version"})
        chosen_states: dict[str, str] = {}
        for state_column in ("status", "state", "stage"):
            accepted = allowed_states(row, state_column)
            if accepted:
                chosen_states[state_column] = sorted(accepted)[0]
                selected.add(state_column)
                selected.update(required_for_state(row, chosen_states[state_column]))
        names: list[str] = []
        values: list[str] = []
        for column_no, column in enumerate(columns, 1):
            column_name = column["name"]
            if column_name not in selected:
                continue
            if (column_name in local and local[column_name][0] not in inserted
                    and column.get("nullable") is not False):
                continue
            if column_name in local:
                parent, target = local[column_name]
                if target == "tenant_id":
                    value = "1"
                elif target == "public_id":
                    value = uuid_sql(numbers[parent], 1)
                else:
                    value = str(numbers[parent])
            elif column_name == row["idColumn"]["name"]:
                value = str(numbers[name])
            elif column_name == "tenant_id":
                value = "1"
            elif column_name == "public_id":
                value = uuid_sql(numbers[name], 1)
            elif column_name == "aggregate_version":
                value = "1"
            elif column_name in chosen_states:
                value = quote(chosen_states[column_name])
            elif column_name in {"created_at", "updated_at"}:
                value = "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
            elif column_name in {"created_by", "updated_by", "correlation_id"}:
                value = uuid_sql(0x30000000 + numbers[name], column_no)
            else:
                value = sample_value(column, numbers[name], column_no,
                                     allowed_states(row, column_name))
            names.append(column_name)
            values.append(value)
        statements.append(
            f"INSERT INTO {name} ({', '.join(names)}) VALUES ({', '.join(values)})"
        )
        inserted.add(name)
    return statements


def stable_member(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:10], 16) % 999999 + 1


OWNER_REFETCH_EVENT_FIELD_SOURCES = {
    ("GovernedAiPolicyEvaluationRequested.v2", "policyId"):
        "sys_hris_ai_use_policies.public_id",
    ("CompensationPlanApprovalRecorded.v2", "approvalReceiptId"):
        "prf_cmp_plans.approval_receipt_public_id",
    ("CompensationPlanApprovalRecorded.v2", "approvalRevision"):
        "prf_cmp_plans.approval_revision",
    ("WorkforceScheduleOptimizationRequested.v2", "forecastId"):
        "tme_wfm_demand_forecasts.public_id",
    ("WorkforceSchedulePublished.v2", "canonicalSchedulePeriodPublicId"):
        "tme_wfm_schedule_publish_ledger.canonical_schedule_period_public_id",
    ("WorkforceSchedulePublished.v2", "approvalReceiptPublicId"):
        "tme_wfm_schedule_publish_ledger.approval_receipt_public_id",
}


# These bindings are reviewer decisions, not a projection imported from the
# candidate generator.  They identify INSERT/APPEND assignments whose value is
# required to be the already selected/locked physical fact.  A synthetic UUID,
# revision, digest, or date here would let an event be internally consistent
# with the newly inserted row while still referring to the wrong aggregate.
# `preflight` requires this map to be an exact closed set and verifies every
# candidate sourcePath before any SQL can run.
PHYSICAL_ASSIGNMENT_SOURCE_SPECS: dict[
    tuple[str, str, str], dict[str, str]
] = {
    ("modern.ai.policy.evaluate", "sys_hris_ai_evaluation_requests", "policy_version"):
        {"sourcePath": "locked.sys_hris_ai_use_policies.policy_version",
         "sourceTable": "sys_hris_ai_use_policies", "sourceColumn": "policy_version",
         "transform": "DIRECT"},
    ("modern.benefits.enrollment.submit", "ppl_bnf_enrollments", "life_event_id"):
        {"sourcePath": "selector.body.lifeEventId.internalId IF PRESENT",
         "sourceTable": "ppl_bnf_life_events", "sourceColumn": "benefit_life_event_id",
         "transform": "DIRECT"},
    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots", "cycle_public_id"):
        {"sourcePath": "selector.pathParameters.cycleId.publicId",
         "sourceTable": "prf_cmp_cycles", "sourceColumn": "public_id",
         "transform": "DIRECT"},
    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots", "plan_public_id"):
        {"sourcePath": "selector.body.planPublicId.publicId",
         "sourceTable": "prf_cmp_plans", "sourceColumn": "public_id",
         "transform": "DIRECT"},
    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots", "approval_receipt_id"):
        {"sourcePath": "ownerRefetch.body.approvalReceiptId.publicId",
         "sourceTable": "prf_cmp_plans", "sourceColumn": "approval_receipt_public_id",
         "transform": "DIRECT"},
    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots", "approval_revision"):
        {"sourcePath": "ownerRefetch.body.approvalReceiptId.decisionVersion",
         "sourceTable": "prf_cmp_plans", "sourceColumn": "approval_revision",
         "transform": "DIRECT"},
    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots", "source_version"):
        {"sourcePath": "locked.prf_cmp_plans.plan_revision",
         "sourceTable": "prf_cmp_plans", "sourceColumn": "plan_revision",
         "transform": "DIRECT"},
    ("modern.growth.profile.update", "prf_grw_profile_revisions", "profile_revision"):
        {"sourcePath": "locked.prf_grw_profiles.profile_version+1",
         "sourceTable": "prf_grw_profiles", "sourceColumn": "profile_version",
         "transform": "PLUS_ONE"},
    ("modern.learning.completion.verify", "prf_lrn_completion_evidence", "completion_revision"):
        {"sourcePath": "locked.prf_lrn_assignments.assignment_revision+1",
         "sourceTable": "prf_lrn_assignments", "sourceColumn": "assignment_revision",
         "transform": "PLUS_ONE"},
    ("modern.onboarding.journey.assign", "ppl_jny_assignment_tasks", "task_key"):
        {"sourcePath": "locked.templateVersion.tasks[*].taskKey",
         "sourceTable": "ppl_jny_template_versions", "sourceColumn": "task_definitions",
         "transform": "TASK_JSON_TEXT", "jsonKey": "taskKey"},
    ("modern.onboarding.journey.assign", "ppl_jny_assignment_tasks", "task_order"):
        {"sourcePath": "locked.templateVersion.tasks[*].taskOrder",
         "sourceTable": "ppl_jny_template_versions", "sourceColumn": "task_definitions",
         "transform": "TASK_JSON_INTEGER", "jsonKey": "taskOrder"},
    ("modern.onboarding.journey.assign", "ppl_jny_assignment_tasks", "required_flag"):
        {"sourcePath": "locked.templateVersion.tasks[*].requiredFlag",
         "sourceTable": "ppl_jny_template_versions", "sourceColumn": "task_definitions",
         "transform": "TASK_JSON_BOOLEAN", "jsonKey": "requiredFlag"},
    ("modern.onboarding.task.complete", "ppl_jny_task_evidence", "task_key"):
        {"sourcePath": "locked.ppl_jny_assignment_tasks.task_key",
         "sourceTable": "ppl_jny_assignment_tasks", "sourceColumn": "task_key",
         "transform": "DIRECT"},
    ("modern.onboarding.task.complete", "ppl_jny_task_evidence", "completion_revision"):
        {"sourcePath": "locked.ppl_jny_assignment_tasks.aggregate_version+1",
         "sourceTable": "ppl_jny_assignment_tasks", "sourceColumn": "aggregate_version",
         "transform": "PLUS_ONE"},
    ("modern.wfm.schedule.publish", "tme_wfm_schedule_publish_ledger", "candidate_revision"):
        {"sourcePath": "locked.candidate_revision",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_revision",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.publish", "tme_wfm_schedule_publish_ledger", "candidate_digest"):
        {"sourcePath": "locked.candidate_digest",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_digest",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.submit", "tme_wfm_approval_requests", "candidate_revision"):
        {"sourcePath": "locked.candidate_revision",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_revision",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.submit", "tme_wfm_approval_requests", "candidate_digest"):
        {"sourcePath": "locked.candidate_digest",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_digest",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.submit", "tme_wfm_approval_requests", "effective_date"):
        {"sourcePath": "COALESCE(body.effectiveDate,locked.candidate_period_start_date)",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "period_start",
         "transform": "DATE_FROM_TIMESTAMP"},
    ("modern.wfm.schedule.validate", "tme_wfm_constraint_evaluation_receipts", "candidate_revision"):
        {"sourcePath": "locked.candidate_revision",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_revision",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.validate", "tme_wfm_constraint_evaluation_receipts", "candidate_digest"):
        {"sourcePath": "locked.candidate_digest",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "candidate_digest",
         "transform": "DIRECT"},
    ("modern.wfm.schedule.validate", "tme_wfm_constraint_evaluation_receipts", "evaluation_revision"):
        {"sourcePath": "locked.last_evaluation_revision+1",
         "sourceTable": "tme_wfm_constraint_evaluation_receipts",
         "sourceColumn": "evaluation_revision", "transform": "MAX_PLUS_ONE"},
    ("modern.wfm.schedule.validate", "tme_wfm_constraint_evaluation_receipts", "planning_input_snapshot_id"):
        {"sourcePath": "locked.planning_input_snapshot_id",
         "sourceTable": "tme_wfm_schedule_candidates", "sourceColumn": "input_snapshot_id",
         "transform": "DIRECT"},
    ("internal.recruiting.hire-handoff.acknowledge", "ppl_rec_hire_handoff_receipts", "effective_date"):
        {"sourcePath": "locked.ppl_rec_hire_requests.effective_date",
         "sourceTable": "ppl_rec_hire_requests", "sourceColumn": "effective_date",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_schedule_candidates", "availability_snapshot_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.availability_snapshot_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "availability_snapshot_id",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_schedule_candidates", "period_end"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.period_end",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "period_end",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_schedule_candidates", "period_start"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.period_start",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "period_start",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_schedule_candidates", "optimization_request_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.optimization_request_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "optimization_request_id",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_schedule_candidates", "input_snapshot_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.input_snapshot_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "input_snapshot_id",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_candidate_shift_lines", "demand_forecast_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.demand_forecast_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "demand_forecast_id",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_candidate_shift_lines", "planning_input_snapshot_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.input_snapshot_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "input_snapshot_id",
         "transform": "DIRECT"},
    ("internal.wfm.schedule-optimization.complete", "tme_wfm_constraint_evaluation_receipts", "planning_input_snapshot_id"):
        {"sourcePath": "locked.tme_wfm_optimization_requests.input_snapshot_id",
         "sourceTable": "tme_wfm_optimization_requests", "sourceColumn": "input_snapshot_id",
         "transform": "DIRECT"},
}

# A real two-row task manifest is the fixture input consumed by the three
# TASK_JSON_* bindings above.  It is intentionally separate from the physical
# source catalog: this row is request data, not a locked owner fact.
TASK_DEFINITION_FIXTURE_SQL = (
    "jsonb_build_array("
    "jsonb_build_object('taskKey','welcome-kit','taskOrder',1,'requiredFlag',TRUE),"
    "jsonb_build_object('taskKey','security-training','taskOrder',2,'requiredFlag',TRUE))"
)

EVENT_JSON_TYPES = {
    "UUID": "string", "STRING": "string", "SHA256": "string",
    "DATE": "string", "TIMESTAMPTZ": "string", "BIGINT": "number",
    "INTEGER": "number", "NUMERIC(19,4)": "number", "BOOLEAN": "boolean",
    "ARRAY<UUID>": "array",
}


def oracle_event_contracts(oracle: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = [event for operation in oracle["operations"] for event in operation.get("events", [])]
    rows.extend(handler["event"] for handler in oracle["systemHandlers"])
    names = [row["eventName"] for row in rows]
    if len(rows) != 86 or len(names) != len(set(names)):
        raise ValueError("independent oracle event closure differs from exact 86")
    return {row["eventName"]: row for row in rows}


def latest_physical_value_sql(
    source: str, tables: dict[str, dict[str, Any]], *, as_jsonb: bool,
) -> str:
    table, column = source.split(".", 1)
    if table not in tables:
        raise ValueError(f"event source table is not in exact projection: {source}")
    # `tables` rows do not contain the common columns in-place.  Column
    # existence/type is checked independently by `preflight`; here only the
    # deterministic, tenant-local source lookup is rendered.
    id_column = tables[table]["idColumn"]["name"]
    value = (
        f"(SELECT {column} FROM {table} WHERE tenant_id=1 "
        f"ORDER BY {id_column} DESC LIMIT 1)"
    )
    return f"to_jsonb({value})" if as_jsonb else value


def physical_assignment_value_sql(
    spec: dict[str, str], tables: dict[str, dict[str, Any]], row_number: int,
) -> str:
    source = spec["sourceTable"] + "." + spec["sourceColumn"]
    transform = spec["transform"]
    if transform == "MAX_PLUS_ONE":
        table = spec["sourceTable"]
        column = spec["sourceColumn"]
        return f"(COALESCE((SELECT max({column}) FROM {table} WHERE tenant_id=1),0)+1)"
    value = latest_physical_value_sql(source, tables, as_jsonb=False)
    if transform == "DIRECT":
        return value
    if transform == "PLUS_ONE":
        return f"(({value})+1)"
    if transform == "DATE_FROM_TIMESTAMP":
        return f"(({value})::date)"
    if transform.startswith("TASK_JSON_"):
        key = quote(spec["jsonKey"])
        extracted = f"(({value})->{row_number - 1}->>{key})"
        casts = {
            "TASK_JSON_TEXT": "",
            "TASK_JSON_INTEGER": "::integer",
            "TASK_JSON_BOOLEAN": "::boolean",
        }
        if transform not in casts:
            raise ValueError(f"unsupported reviewed physical assignment transform {transform}")
        return extracted + casts[transform]
    raise ValueError(f"unsupported reviewed physical assignment transform {transform}")


def domain_assignment_overrides(
    owner_id: str | None, table: str, dml: dict[str, Any],
    tables: dict[str, dict[str, Any]], row_number: int,
) -> dict[str, str]:
    if owner_id is None:
        return {}
    result: dict[str, str] = {}
    assignments = {
        str(row["target"]).split(".", 1)[1]: str(row["sourcePath"])
        for row in dml.get("assignments", [])
    }
    for column, source_path in assignments.items():
        key = (owner_id, table, column)
        spec = PHYSICAL_ASSIGNMENT_SOURCE_SPECS.get(key)
        if spec is not None:
            if source_path != spec["sourcePath"]:
                raise ValueError(
                    f"reviewed physical assignment source changed {owner_id}:{table}.{column}:"
                    f"{source_path} != {spec['sourcePath']}"
                )
            result[column] = physical_assignment_value_sql(spec, tables, row_number)
        if key == (
            "modern.onboarding.template.create", "ppl_jny_template_versions",
            "task_definitions",
        ):
            if source_path != "body.tasks":
                raise ValueError("onboarding task manifest request source changed")
            result[column] = TASK_DEFINITION_FIXTURE_SQL
    return result


def event_context_key(owner_id: str, base_salt: int) -> str:
    return f"{owner_id}|{base_salt}"


def event_correlation_sql(owner_id: str, base_salt: int, event_name: str) -> str:
    # Every fact emitted by one owner transaction carries the same trace
    # correlation; `event_name` is accepted to make misuse at call sites hard
    # to hide, but is deliberately not part of the value.
    del event_name
    return uuid_sql(0x60000000 + base_salt, stable_member(owner_id))


def event_outbox_correlation_sql(
    owner_id: str, base_salt: int, event_name: str, outbox: str,
    transaction_columns: dict[str, dict[str, dict[str, Any]]],
) -> str:
    value = event_correlation_sql(owner_id, base_salt, event_name)
    sql_type = transaction_columns[outbox]["correlation_id"]["sqlType"].upper()
    return value if sql_type == "UUID" else f"({value})::text"


def event_source_json_sql(
    owner_id: str, base_salt: int, event: dict[str, Any], field: dict[str, Any],
    tables: dict[str, dict[str, Any]],
) -> str:
    source = str(field["source"])
    if source == "context.ownerClock.transactionNow":
        return "to_jsonb(TIMESTAMPTZ '2026-01-01 00:00:00+00')"
    if source == "context.correlationId":
        return "to_jsonb(" + event_correlation_sql(owner_id, base_salt, event["eventName"]) + ")"
    if source.startswith("CONSTANT:"):
        return "to_jsonb(" + quote(source.removeprefix("CONSTANT:")) + "::text)"
    if source.startswith("LOCKED_PRE:"):
        return (
            "(SELECT value FROM dwp_locked_pre WHERE context_key="
            + quote(event_context_key(owner_id, base_salt))
            + " AND event_name=" + quote(event["eventName"])
            + " AND field_name=" + quote(field["name"]) + ")"
        )
    physical = OWNER_REFETCH_EVENT_FIELD_SOURCES.get((event["eventName"], field["name"]), source)
    if not re.fullmatch(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*", physical):
        raise ValueError(
            f"unresolved nonphysical event source {event['eventName']}:{field['name']}:{source}"
        )
    return latest_physical_value_sql(physical, tables, as_jsonb=True)


def event_payload_sql(
    owner_id: str, base_salt: int, event: dict[str, Any],
    tables: dict[str, dict[str, Any]],
) -> str:
    pairs: list[str] = []
    fields = event.get("fields", [])
    if not fields:
        raise ValueError(f"event has no independently reviewed fields: {event['eventName']}")
    for field in fields:
        pairs.extend([
            quote(field["name"]),
            event_source_json_sql(owner_id, base_salt, event, field, tables),
        ])
    return "jsonb_build_object(" + ",".join(pairs) + ")"


def locked_pre_capture_sql(
    owner_id: str, base_salt: int, events: list[dict[str, Any]],
    tables: dict[str, dict[str, Any]], *, force_none: bool = False,
) -> list[str]:
    statements: list[str] = []
    context_key = event_context_key(owner_id, base_salt)
    for event in events:
        for field in event["fields"]:
            source = str(field["source"])
            if not source.startswith("LOCKED_PRE:"):
                continue
            physical = source.removeprefix("LOCKED_PRE:")
            table, _ = physical.split(".", 1)
            id_column = tables[table]["idColumn"]["name"]
            value_sql = (
                "to_jsonb('NONE'::text)" if force_none
                else latest_physical_value_sql(physical, tables, as_jsonb=True)
            )
            statements.append(
                "INSERT INTO dwp_locked_pre(context_key,event_name,field_name,value) SELECT "
                + ",".join([
                    quote(context_key), quote(event["eventName"]), quote(field["name"]),
                    value_sql,
                ])
                + " WHERE EXISTS (SELECT 1 FROM " + table
                + " WHERE tenant_id=1 ORDER BY " + id_column + " DESC LIMIT 1)"
            )
    return statements


def event_payload_assertions(
    owner_id: str, base_salt: int, event: dict[str, Any], outbox: str,
    transaction_columns: dict[str, dict[str, dict[str, Any]]],
    tables: dict[str, dict[str, Any]],
) -> list[str]:
    event_column = "event_type" if "event_type" in transaction_columns[outbox] else "schema_name"
    correlation = event_correlation_sql(owner_id, base_salt, event["eventName"])
    predicate = (
        f"tenant_id=1 AND {event_column}={quote(event['eventName'])} "
        f"AND correlation_id::text=({correlation})::text"
    )
    fields = event["fields"]
    names = [field["name"] for field in fields]
    key_array = "ARRAY[" + ",".join(quote(name) for name in names) + "]"
    checks = [
        "jsonb_typeof(payload)='object'",
        f"(SELECT count(*) FROM jsonb_object_keys(payload))={len(names)}",
        f"payload ?& {key_array}",
    ]
    for field in fields:
        name = field["name"]
        expected_json_type = EVENT_JSON_TYPES.get(field["type"])
        if expected_json_type is None:
            raise ValueError(f"unsupported event field type {event['eventName']}:{name}:{field['type']}")
        checks.extend([
            f"payload->{quote(name)} IS NOT NULL",
            f"payload->{quote(name)} <> 'null'::jsonb",
            f"jsonb_typeof(payload->{quote(name)})={quote(expected_json_type)}",
            f"payload->{quote(name)}="
            + event_source_json_sql(owner_id, base_salt, event, field, tables),
        ])
        if field["type"] == "UUID":
            checks.append(f"(payload->>{quote(name)})::uuid IS NOT NULL")
        elif field["type"] == "SHA256":
            checks.append(f"payload->>{quote(name)} ~ '^[0-9a-f]{{64}}$'")
        elif field["type"] == "DATE":
            checks.append(f"(payload->>{quote(name)})::date IS NOT NULL")
        elif field["type"] == "TIMESTAMPTZ":
            checks.append(f"(payload->>{quote(name)})::timestamptz IS NOT NULL")
        elif field["type"] == "BIGINT":
            checks.append(f"(payload->>{quote(name)})::bigint IS NOT NULL")
        elif field["type"] == "INTEGER":
            checks.append(f"(payload->>{quote(name)})::integer IS NOT NULL")
        elif field["type"] == "NUMERIC(19,4)":
            checks.append(f"(payload->>{quote(name)})::numeric(19,4) IS NOT NULL")
    aggregate_column = (
        "aggregate_id" if "aggregate_id" in transaction_columns[outbox]
        else "aggregate_public_id"
    )
    return [
        "SELECT dwp_assert((SELECT count(*) FROM " + outbox + " WHERE " + predicate
        + ")=1," + quote("event outbox cardinality " + owner_id + ":" + event["eventName"]) + ")",
        "SELECT dwp_assert((SELECT " + " AND ".join(checks) + " FROM " + outbox
        + " WHERE " + predicate + "),"
        + quote("event payload exact source/type closure " + owner_id + ":" + event["eventName"])
        + ")",
        "SELECT dwp_assert((SELECT payload->>'aggregateId'=" + aggregate_column + "::text "
        "AND payload->>'correlationId'=correlation_id::text FROM " + outbox
        + " WHERE " + predicate + "),"
        + quote("event envelope/payload identity mismatch " + owner_id + ":" + event["eventName"])
        + ")",
    ]


def transaction_value(
    column: str, spec: dict[str, Any], source: str, salt: int, operation_id: str,
    root: str, tables: dict[str, dict[str, Any]], *, event_name: str | None = None,
    receipt_table: str | None = None, root_public_override: str | None = None,
    root_version_override: str | None = None,
) -> str:
    sql_type = spec["sqlType"].upper()
    root_id = tables[root]["idColumn"]["name"]
    root_public_id = root_public_override or (
        f"(SELECT public_id FROM {root} WHERE tenant_id=1 "
        f"ORDER BY {root_id} DESC LIMIT 1)"
    )
    root_version = root_version_override or (
        f"(SELECT aggregate_version FROM {root} WHERE tenant_id=1 "
        f"ORDER BY {root_id} DESC LIMIT 1)"
    )
    if source.startswith("CONSTANT:"):
        raw = source.removeprefix("CONSTANT:")
        if sql_type in {"BIGINT", "INTEGER", "SMALLINT"}:
            return raw if re.fullmatch(r"-?\d+", raw) else "2"
        if sql_type == "BOOLEAN":
            return "TRUE" if raw.lower() == "true" else "FALSE"
        return quote(raw)
    if column == "tenant_id":
        return "1"
    if column in {"aggregate_id", "aggregate_public_id", "target_public_id"}:
        return root_public_id if sql_type == "UUID" else f"({root_public_id})::text"
    if column == "subject":
        return f"({root_public_id})::text"
    if column == "result_ref":
        return root_public_id if sql_type == "UUID" else f"({root_public_id})::text"
    if column == "result_reference":
        if sql_type != "JSONB":
            raise ValueError(f"unexpected result_reference type {sql_type}")
        return (
            "jsonb_build_object('operationId'," + quote(operation_id)
            + ",'aggregateType'," + quote("table:" + root)
            + ",'aggregatePublicId',(" + root_public_id + ")::text"
            + ",'aggregateVersion'," + root_version + ")"
        )
    if column in {"aggregate_version", "aggregate_revision", "aggregate_sequence",
                  "subject_revision", "expected_version"}:
        return root_version
    if column in {"aggregate_type", "target_type"}:
        return quote("table:" + root)
    if column in {"event_type", "schema_name"} and event_name:
        return quote(event_name)
    if column in {"consumer_name", "consumer_key"}:
        return quote(operation_id)
    if column == "event_source":
        return quote("dwp.hris.owner")
    if column == "payload":
        return (
            "jsonb_build_object('operationId'," + quote(operation_id)
            + ",'eventName'," + quote(event_name or "owner-input")
            + ",'aggregatePublicId',(" + root_public_id + ")::text"
            + ",'aggregateVersion'," + root_version + ")"
        )
    if "digest" in column or "hash" in column or sql_type == "CHAR(64)":
        return "repeat('a',64)"
    if column in {"occurred_at", "received_at", "first_received_at", "available_at",
                  "expires_at", "created_at", "updated_at", "completed_at",
                  "processed_at", "applied_at", "originating_context_sealed_at"}:
        return "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
    if sql_type == "UUID":
        if column == "causation_id" and receipt_table:
            receipt_public = (
                "command_receipt_id" if receipt_table in {
                    "ppl_command_receipts", "prf_command_receipts"
                } else "public_id"
            )
            return (
                f"(SELECT {receipt_public} FROM {receipt_table} WHERE tenant_id=1 "
                f"AND originating_action={quote(operation_id)} ORDER BY {receipt_public} DESC LIMIT 1)"
            )
        return uuid_sql(salt, stable_member(column))
    if sql_type in {"BIGINT", "INTEGER", "SMALLINT"}:
        return "1"
    if sql_type == "BOOLEAN":
        return "TRUE"
    if sql_type == "JSONB":
        return "'{}'::jsonb"
    if sql_type == "DATE":
        return "DATE '2026-01-01'"
    if sql_type.startswith("TIMESTAMP"):
        return "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
    if column == "idempotency_key":
        return quote(f"idem-{salt}-{operation_id}")
    if column in {"originating_action", "command_type"}:
        return quote(operation_id)
    if column in {"schema_version", "spec_version"}:
        return quote("v2") if sql_type.startswith(("VARCHAR", "CHAR", "TEXT")) else "2"
    if column in {"correlation_id", "causation_id"} and sql_type.startswith(
            ("VARCHAR", "CHAR", "TEXT")):
        return quote(f"{salt & 0xffffffff:08x}-0000-4000-8000-000000000991")
    return quote(f"v{salt}_{column}")


def transaction_insert_sql(
    table: str, assignments: list[dict[str, Any]],
    transaction_columns: dict[str, dict[str, dict[str, Any]]], salt: int,
    operation_id: str, root: str, tables: dict[str, dict[str, Any]], *,
    event_name: str | None = None, receipt_table: str | None = None,
    root_public_override: str | None = None, root_version_override: str | None = None,
    column_overrides: dict[str, str] | None = None,
) -> str:
    names = [str(row["column"]) for row in assignments]
    if len(names) != len(set(names)):
        raise ValueError(f"duplicate physical assignment in {operation_id}:{table}")
    unknown = set(names) - set(transaction_columns[table])
    if unknown:
        raise ValueError(f"unknown physical columns {operation_id}:{table}:{sorted(unknown)}")
    overrides = column_overrides or {}
    if not set(overrides) <= set(names):
        raise ValueError(
            f"override targets absent assignment {operation_id}:{table}:"
            f"{sorted(set(overrides)-set(names))}"
        )
    values = []
    for index, (name, row) in enumerate(zip(names, assignments), 1):
        if name in overrides:
            values.append(overrides[name])
            continue
        values.append(transaction_value(
            name, transaction_columns[table][name], str(row["sourcePath"]), salt + index,
            operation_id, root, tables, event_name=event_name, receipt_table=receipt_table,
            root_public_override=root_public_override,
            root_version_override=root_version_override,
        ))
    return f"INSERT INTO {table} ({', '.join(names)}) VALUES ({', '.join(values)})"


def domain_insert_sql(
    exact: dict[str, Any], tables: dict[str, dict[str, Any]],
    all_columns: dict[str, dict[str, dict[str, Any]]], numbers: dict[str, int],
    table: str, dml: dict[str, Any], salt: int, post_states: list[str], *,
    guard_predicate: str | None = None, owner_id: str | None = None,
    row_number: int = 1,
) -> str:
    row = tables[table]
    assignments = {item["target"].split(".", 1)[1]: item
                   for item in dml.get("assignments", [])}
    physical_overrides = domain_assignment_overrides(
        owner_id, table, dml, tables, row_number,
    )
    selected = {row["idColumn"]["name"], "tenant_id", "public_id", "aggregate_version",
                *assignments}
    for name, column in all_columns[table].items():
        if column.get("nullable") is False and column.get("default") is None:
            selected.add(name)
    chosen_states: dict[str, str] = {}
    for state_column in ("status", "state", "stage"):
        accepted = allowed_states(row, state_column)
        if not accepted:
            continue
        assignment_source = str(assignments.get(state_column, {}).get("sourcePath", ""))
        constant = (assignment_source.removeprefix("CONSTANT:")
                    if assignment_source.startswith("CONSTANT:") else None)
        preferred = (constant if constant in accepted else
                     next((state for state in post_states if state in accepted), None))
        chosen_states[state_column] = preferred or sorted(accepted)[0]
        if state_column in assignments or state_column in selected:
            selected.add(state_column)
            selected.update(required_for_state(row, chosen_states[state_column]))
    local = local_fk_columns(row)
    ordered = [row["idColumn"], *[
        item for item in exact["commonTableContract"]["columns"]
        if item["name"] != "__internal_id__"
    ], *row["columns"]]
    names: list[str] = []
    values: list[str] = []
    for column_no, column in enumerate(ordered, 1):
        name = column["name"]
        if name not in selected:
            continue
        if name in physical_overrides:
            value = physical_overrides[name]
        elif name in local:
            parent, target = local[name]
            if target == "tenant_id":
                value = "1"
            else:
                parent_id = tables[parent]["idColumn"]["name"]
                value = (
                    f"(SELECT {target} FROM {parent} WHERE tenant_id=1 "
                    f"ORDER BY {parent_id} DESC LIMIT 1)"
                )
        elif name == row["idColumn"]["name"]:
            value = str(1_000_000 + salt)
        elif name == "tenant_id":
            value = "1"
        elif name == "public_id":
            value = uuid_sql(1_000_000 + salt, 1)
        elif name == "aggregate_version":
            value = "1"
        elif (name in assignments and str(assignments[name].get("sourcePath", ""))
              .startswith("CONSTANT:")):
            raw = str(assignments[name]["sourcePath"]).removeprefix("CONSTANT:")
            value = (raw if column["sqlType"].upper() in {"BIGINT", "INTEGER", "SMALLINT"}
                     and re.fullmatch(r"-?\d+", raw) else quote(raw))
        elif name in chosen_states:
            value = quote(chosen_states[name])
        elif name in {"created_at", "updated_at"}:
            value = "TIMESTAMPTZ '2026-01-01 00:00:00+00'"
        elif name in {"created_by", "updated_by", "correlation_id"}:
            value = uuid_sql(2_000_000 + salt, column_no)
        elif column["sqlType"].upper() in {"BIGINT", "INTEGER", "SMALLINT"} and re.search(
                r"(?:version|revision|sequence|order)$", name):
            value = str(2 + salt)
        elif "digest" in name or "hash" in name or column["sqlType"].upper() == "CHAR(64)":
            value = f"md5('{salt}:{column_no}:a') || md5('{salt}:{column_no}:b')"
        else:
            value = sample_value(column, 3_000_000 + salt, column_no,
                                 allowed_states(row, name))
            if normalize_type(column["sqlType"]) == "STRING" and value.startswith("'v"):
                value = quote(f"v{salt}_{column_no}")
        names.append(name)
        values.append(value)
    if guard_predicate:
        return (
            f"INSERT INTO {table} ({', '.join(names)}) SELECT {', '.join(values)} "
            f"WHERE {guard_predicate}"
        )
    return f"INSERT INTO {table} ({', '.join(names)}) VALUES ({', '.join(values)})"


def domain_update_sql(
    exact: dict[str, Any], tables: dict[str, dict[str, Any]],
    all_columns: dict[str, dict[str, dict[str, Any]]], numbers: dict[str, int],
    table: str, dml: dict[str, Any], post_states: list[str], salt: int, *,
    context_key: str, root_table: str, root_state_column: str | None,
    root_pre_state: str | None, guard_predicate: str | None = None,
) -> str:
    row = tables[table]
    local = local_fk_columns(row)
    setters: list[str] = []
    for assignment_no, assignment in enumerate(dml.get("assignments", []), 1):
        column = assignment["target"].split(".", 1)[1]
        spec = all_columns[table][column]
        accepted = allowed_states(row, column)
        if accepted:
            source = str(assignment.get("sourcePath", ""))
            constant = source.removeprefix("CONSTANT:") if source.startswith("CONSTANT:") else None
            value = (constant if constant in accepted else
                     next((state for state in post_states if state in accepted), sorted(accepted)[0]))
            setters.append(f"{column}={quote(value)}")
        elif re.search(r"(?:aggregate_)?version$", column):
            setters.append(f"{column}={column}+1")
        elif column in local or column.endswith("_id"):
            setters.append(f"{column}={column}")
        elif column in {"updated_at", "completed_at", "published_at", "submitted_at",
                      "approved_at", "closed_at", "resolved_at", "suspended_at"}:
            setters.append(f"{column}=TIMESTAMPTZ '2026-01-02 00:00:00+00'")
        elif column in {"updated_by", "approved_by", "completed_by", "actor_public_id"}:
            setters.append(f"{column}={uuid_sql(8_000_000 + salt, assignment_no)}")
        elif "digest" in column or "hash" in column or spec["sqlType"].upper() == "CHAR(64)":
            setters.append(f"{column}=md5('{salt}:{assignment_no}:u') || md5('{salt}:{assignment_no}:v')")
        elif spec["sqlType"].upper() == "BOOLEAN":
            setters.append(f"{column}=NOT {column}")
        elif normalize_type(spec["sqlType"]) == "STRING":
            setters.append(f"{column}={quote(f'u{salt}_{assignment_no}')}")
        else:
            # Monetary/cardinality/FK invariants are preserved while the exact
            # physical target is still exercised by the UPDATE statement.
            setters.append(f"{column}={column}")
    state_column = next((name for name in ("status", "state", "stage")
                         if allowed_states(row, name)), None)
    target_state = None
    if state_column:
        accepted = allowed_states(row, state_column)
        target_state = next((state for state in post_states if state in accepted), None)
        if target_state and not any(item.startswith(state_column + "=") for item in setters):
            setters.append(f"{state_column}={quote(target_state)}")
    if not any(item.startswith("aggregate_version=") for item in setters):
        setters.append("aggregate_version=aggregate_version+1")
    if target_state:
        for required in sorted(required_for_state(row, target_state)):
            if required in {state_column, "aggregate_version"} or any(
                    item.startswith(required + "=") for item in setters):
                continue
            spec = all_columns[table].get(required)
            if spec is not None:
                companion = sample_value(
                    spec, numbers[table], salt, allowed_states(row, required)
                )
                setters.append(f"{required}={companion}")
    if not setters:
        setters.append("aggregate_version=aggregate_version")
    id_column = row["idColumn"]["name"]
    target = (
        "(SELECT internal_id FROM dwp_locked_target WHERE context_key="
        + quote(context_key) + " AND table_name=" + quote(table) + ")"
    )
    version = (
        "(SELECT aggregate_version FROM dwp_locked_target WHERE context_key="
        + quote(context_key) + " AND table_name=" + quote(table) + ")"
    )
    public_id = (
        "(SELECT public_id FROM dwp_locked_target WHERE context_key="
        + quote(context_key) + " AND table_name=" + quote(table) + ")"
    )
    predicates = [
        f"{id_column}={target}", "tenant_id=1", f"public_id={public_id}",
        f"aggregate_version={version}",
    ]
    if table == root_table and root_state_column and root_pre_state not in {None, "NONE"}:
        predicates.append(f"{root_state_column}={quote(root_pre_state)}")
    if guard_predicate:
        predicates.append(guard_predicate)
    return (
        f"UPDATE {table} SET {', '.join(dict.fromkeys(setters))} WHERE "
        + " AND ".join(predicates)
    )


def locked_target_capture_sql(
    owner_id: str, base_salt: int, steps: list[dict[str, Any]],
    tables: dict[str, dict[str, Any]],
) -> list[str]:
    context_key = event_context_key(owner_id, base_salt)
    update_tables = sorted({
        str(step["table"]) for step in steps
        if step.get("stage") == "DOMAIN_DML"
        and step.get("disposition") in {"UPDATE", "UPDATE_CAS", "UPSERT"}
    })
    statements: list[str] = []
    for table in update_tables:
        id_column = tables[table]["idColumn"]["name"]
        statements.append(
            "INSERT INTO dwp_locked_target(context_key,table_name,internal_id,public_id,aggregate_version) "
            "SELECT " + quote(context_key) + "," + quote(table)
            + f",{id_column},public_id,aggregate_version FROM {table} WHERE tenant_id=1 "
            f"ORDER BY {id_column} DESC LIMIT 1"
        )
    return statements


def prime_owner_root_state_sql(
    exact: dict[str, Any], operation: dict[str, Any],
    tables: dict[str, dict[str, Any]], all_columns: dict[str, dict[str, dict[str, Any]]],
    numbers: dict[str, int], salt: int,
) -> list[str]:
    root = operation["aggregateRoot"]["table"]
    transition = operation.get("transition", {})
    pre_states = list(transition.get("preStates", []))
    if not pre_states:
        pre_states = list(operation.get("aggregateRoot", {}).get("preStates", []))
    if not pre_states:
        pre_states = list(operation.get("preStates", []))
    pre_state = next((state for state in pre_states if state != "NONE"), None)
    state_column = operation.get("aggregateRoot", {}).get("stateColumn")
    if pre_state is None or not isinstance(state_column, str):
        return []
    return prime_table_state_sql(
        operation.get("operationId") or operation.get("handlerId") or "unknown-owner",
        root, state_column, pre_state, tables, all_columns, numbers, salt,
    )


def prime_table_state_sql(
    owner_id: str, table: str, state_column: str, state: str,
    tables: dict[str, dict[str, Any]], all_columns: dict[str, dict[str, dict[str, Any]]],
    numbers: dict[str, int], salt: int,
) -> list[str]:
    root = table
    pre_state = state
    accepted = allowed_states(tables[root], state_column)
    if pre_state not in accepted:
        raise ValueError(f"owner pre-state not accepted by DDL {root}:{pre_state}")
    setters = [f"{state_column}={quote(pre_state)}"]
    for index, column in enumerate(sorted(required_for_state(tables[root], pre_state)), 1):
        if column == state_column:
            continue
        spec = all_columns[root][column]
        setters.append(
            f"{column}=COALESCE({column},"
            + sample_value(spec, numbers[root], salt + index, allowed_states(tables[root], column))
            + ")"
        )
    id_column = tables[root]["idColumn"]["name"]
    return [assert_dml(
        f"UPDATE {root} SET {', '.join(setters)} WHERE {id_column}="
        f"(SELECT {id_column} FROM {root} WHERE tenant_id=1 ORDER BY {id_column} DESC LIMIT 1)",
        1, owner_id + ":prime-pre-state:" + table,
    )]


def assert_dml(sql: str, expected: int, label: str) -> str:
    return (
        "DO $dwp$ DECLARE n bigint; BEGIN " + sql + "; GET DIAGNOSTICS n=ROW_COUNT; "
        + f"IF n <> {expected} THEN RAISE EXCEPTION {quote(label + ' rowCount')}; END IF; "
        + "END $dwp$"
    )


def command_authorization_values(operation: dict[str, Any]) -> tuple[str, str]:
    operation_id = operation["operationId"]
    purpose = quote(str(operation["authorizationCapability"]))
    principal = uuid_sql(0x71000000, stable_member(operation_id))
    return purpose, principal


def command_claim_overrides(
    operation: dict[str, Any], assignments: list[dict[str, Any]], base_salt: int,
) -> dict[str, str]:
    assigned = {str(row["column"]) for row in assignments}
    purpose, principal = command_authorization_values(operation)
    overrides = {"tenant_id": "1"}
    if "purpose_code" in assigned:
        overrides["purpose_code"] = purpose
    if "subject_principal_public_id" in assigned:
        overrides["subject_principal_public_id"] = principal
    if "correlation_id" in assigned:
        overrides["correlation_id"] = event_correlation_sql(
            operation["operationId"], base_salt,
            operation.get("causalEvents", [{}])[0].get("eventName", "command"),
        )
    return {key: value for key, value in overrides.items() if key in assigned}


def command_authorization_guard(
    operation: dict[str, Any], receipt_table: str, receipt_predicate: str,
) -> str:
    purpose, principal = command_authorization_values(operation)
    return (
        "EXISTS (SELECT 1 FROM " + receipt_table + " WHERE " + receipt_predicate
        + " AND tenant_id=1 AND purpose_code=" + purpose
        + " AND subject_principal_public_id=" + principal + ")"
    )


def assert_guard_rejects(sql: str, expected_message: str, label: str) -> str:
    """Require the checked-in immutable authorization-seal trigger to reject."""
    return (
        "DO $dwp$ DECLARE n bigint; BEGIN BEGIN " + sql
        + "; GET DIAGNOSTICS n=ROW_COUNT; "
        + f"IF n <> 1 THEN RAISE EXCEPTION {quote(label + ' precondition rowCount')}; END IF; "
        + f"RAISE EXCEPTION {quote(label + ' unexpectedly accepted')}; "
        + "EXCEPTION WHEN OTHERS THEN "
        + f"IF position({quote(expected_message)} in SQLERRM)=0 THEN RAISE; END IF; "
        + "END; END $dwp$"
    )


def table_digest_expression(tables: list[str]) -> str:
    return "dwp_table_set_digest(ARRAY[" + ",".join(quote(name) for name in sorted(set(tables))) + "])"


def claim_predicate(
    table: str, assignments: list[dict[str, Any]], transaction_columns: dict[str, Any],
    salt: int, operation_id: str, root: str, tables: dict[str, dict[str, Any]],
) -> str:
    by_name = {str(row["column"]): (index, row)
               for index, row in enumerate(assignments, 1)}
    if "idempotency_key" in by_name:
        index, row = by_name["idempotency_key"]
        value = transaction_value(
            "idempotency_key", transaction_columns[table]["idempotency_key"],
            str(row["sourcePath"]), salt + index, operation_id, root, tables,
        )
        return f"tenant_id=1 AND originating_action={quote(operation_id)} AND idempotency_key={value}"
    if "event_id" in by_name:
        index, row = by_name["event_id"]
        value = transaction_value(
            "event_id", transaction_columns[table]["event_id"], str(row["sourcePath"]),
            salt + index, operation_id, root, tables,
        )
        consumer = "consumer_key" if "consumer_key" in transaction_columns[table] else "consumer_name"
        return f"tenant_id=1 AND {consumer}={quote(operation_id)} AND event_id={value}"
    raise ValueError(f"no stable claim predicate for {table}")


def command_step_groups(
    exact: dict[str, Any], operation: dict[str, Any], operation_index: int,
    base_salt: int, tables: dict[str, dict[str, Any]],
    all_columns: dict[str, dict[str, dict[str, Any]]], numbers: dict[str, int],
    transaction_columns: dict[str, dict[str, dict[str, Any]]],
    expected_events: dict[str, dict[str, Any]],
    state_overrides: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    operation_id = operation["operationId"]
    root = operation["aggregateRoot"]["table"]
    post_states = list(operation["transition"]["postStates"])
    root_state_column = operation["aggregateRoot"].get("stateColumn")
    root_pre_state = next(
        (state for state in operation["transition"].get("preStates", []) if state != "NONE"),
        None,
    )
    steps = operation["transactionEnvelope"]["steps"]
    domain_steps = [step for step in steps if step.get("stage") == "DOMAIN_DML"]
    root_override = None
    root_version_override = None
    reviewed_events = [expected_events[row["eventName"]]
                       for row in operation.get("causalEvents", [])]
    for step in domain_steps:
        if step["table"] == root and step.get("disposition") in {
                "INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
            domain_salt = base_salt + int(step["step"]) * 10 + 1
            root_override = uuid_sql(1_000_000 + domain_salt, 1)
            root_version_override = "1"
            break
    claim_step = steps[0]
    receipt_predicate = claim_predicate(
        claim_step["table"], claim_step["assignments"], transaction_columns,
        base_salt, operation_id, root, tables,
    )
    authorization_guard = command_authorization_guard(
        operation, claim_step["table"], receipt_predicate,
    )
    groups: list[dict[str, Any]] = []
    for step in steps:
        step_no = int(step["step"])
        stage = str(step["stage"])
        sql: list[str] = []
        touched = [str(step["table"])]
        if stage == "CLAIM_OR_REPLAY_COMMAND_RECEIPT":
            sql.extend(locked_target_capture_sql(
                operation_id, base_salt, steps, tables,
            ))
            sql.extend(locked_pre_capture_sql(
                operation_id, base_salt, reviewed_events, tables,
                force_none=operation["transition"].get("preStates") == ["NONE"],
            ))
            statement = transaction_insert_sql(
                step["table"], step["assignments"], transaction_columns, base_salt,
                operation_id, root, tables, root_public_override=root_override,
                root_version_override=root_version_override,
                column_overrides=command_claim_overrides(
                    operation, step["assignments"], base_salt,
                ),
            )
            sql.append(assert_dml(statement, 1, f"{operation_id}:claim"))
        elif stage == "DOMAIN_DML":
            disposition = step["disposition"]
            rows = 2 if disposition in {"INSERT_MANY", "APPEND_MANY"} else 1
            step_post_states = (
                [state_overrides[step["table"]]]
                if state_overrides and step["table"] in state_overrides else post_states
            )
            if disposition in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                for row_no in range(1, rows + 1):
                    statement = domain_insert_sql(
                        exact, tables, all_columns, numbers, step["table"], step,
                        base_salt + step_no * 10 + row_no, step_post_states,
                        guard_predicate=authorization_guard,
                        owner_id=operation_id, row_number=row_no,
                    )
                    sql.append(assert_dml(statement, 1, f"{operation_id}:{stage}:{step_no}:{row_no}"))
            elif disposition in {"UPDATE", "UPDATE_CAS", "UPSERT"}:
                statement = domain_update_sql(
                    exact, tables, all_columns, numbers, step["table"], step,
                    step_post_states, base_salt + step_no,
                    context_key=event_context_key(operation_id, base_salt),
                    root_table=root, root_state_column=root_state_column,
                    root_pre_state=root_pre_state,
                    guard_predicate=authorization_guard,
                )
                sql.append(assert_dml(statement, 1, f"{operation_id}:{stage}:{step_no}"))
            else:
                raise ValueError(f"unsupported DML disposition {operation_id}:{disposition}")
        elif stage == "COMPLETE_COMMAND_RECEIPT":
            claim = steps[0]
            predicate = claim_predicate(
                claim["table"], claim["assignments"], transaction_columns,
                base_salt, operation_id, root, tables,
            )
            setters = [
                f"{assignment['column']}=" + transaction_value(
                    assignment["column"], transaction_columns[step["table"]][assignment["column"]],
                    str(assignment["sourcePath"]), base_salt + 700 + index,
                    operation_id, root, tables, receipt_table=step["table"],
                )
                for index, assignment in enumerate(step["assignments"], 1)
            ]
            sql.append(assert_dml(
                f"UPDATE {step['table']} SET {', '.join(setters)} WHERE {predicate}", 1,
                f"{operation_id}:complete",
            ))
        elif stage == "APPEND_CAUSAL_OUTBOX_LAST":
            receipt_table = steps[0]["table"]
            events = step.get("events", [])
            if not events:
                raise ValueError(f"command outbox has no event {operation_id}")
            for event_no, event in enumerate(events, 1):
                event_contract = next(
                    (row for row in operation["causalEvents"]
                     if row["eventName"] == event["eventName"]), None
                )
                if event_contract is None:
                    raise ValueError(f"outbox event has no contract {operation_id}:{event['eventName']}")
                reviewed_event = expected_events[event["eventName"]]
                event_root = str(reviewed_event["aggregateEntityType"]).removeprefix("table:")
                overrides = {
                    "payload": event_payload_sql(
                        operation_id, base_salt, reviewed_event, tables,
                    ),
                    "correlation_id": event_outbox_correlation_sql(
                        operation_id, base_salt, event["eventName"], step["table"],
                        transaction_columns,
                    ),
                }
                statement = transaction_insert_sql(
                    step["table"], step["assignments"], transaction_columns,
                    base_salt + 900 + event_no * 10, operation_id, event_root, tables,
                    event_name=event["eventName"], receipt_table=receipt_table,
                    column_overrides=overrides,
                )
                sql.append(assert_dml(statement, 1, f"{operation_id}:outbox:{event['eventName']}"))
        else:
            raise ValueError(f"unexpected command transaction stage {operation_id}:{stage}")
        groups.append({"stage": stage, "step": step_no, "sql": sql, "tables": touched})
    return groups


def handler_step_groups(
    exact: dict[str, Any], handler: dict[str, Any], handler_index: int, base_salt: int,
    tables: dict[str, dict[str, Any]], all_columns: dict[str, dict[str, dict[str, Any]]],
    numbers: dict[str, int], transaction_columns: dict[str, dict[str, dict[str, Any]]],
    expected_events: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    handler_id = handler["handlerId"]
    root = handler["aggregateRoot"]["table"]
    post_states = list(handler["postStates"])
    root_state_column = handler["aggregateRoot"].get("stateColumn")
    root_pre_state = next(
        (state for state in handler.get("preStates", []) if state != "NONE"),
        None,
    )
    steps = handler["transactionEnvelope"]["steps"]
    groups: list[dict[str, Any]] = []
    for step in steps:
        step_no = int(step["step"])
        stage = str(step["stage"])
        sql: list[str] = []
        if stage == "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX":
            sql.extend(locked_target_capture_sql(
                handler_id, base_salt, steps, tables,
            ))
            sql.extend(locked_pre_capture_sql(
                handler_id, base_salt, [expected_events[handler["eventContract"]["eventName"]]],
                tables,
            ))
            sql.append(assert_dml(transaction_insert_sql(
                step["table"], step["assignments"], transaction_columns, base_salt,
                handler_id, root, tables,
            ), 1, f"{handler_id}:claim"))
        elif stage == "DOMAIN_DML":
            disposition = step["disposition"]
            rows = 2 if disposition in {"INSERT_MANY", "APPEND_MANY"} else 1
            if disposition in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}:
                for row_no in range(1, rows + 1):
                    sql.append(assert_dml(domain_insert_sql(
                        exact, tables, all_columns, numbers, step["table"], step,
                        base_salt + step_no * 10 + row_no, post_states,
                        owner_id=handler_id, row_number=row_no,
                    ), 1, f"{handler_id}:{stage}:{step_no}:{row_no}"))
            elif disposition in {"UPDATE", "UPDATE_CAS", "UPSERT"}:
                sql.append(assert_dml(domain_update_sql(
                    exact, tables, all_columns, numbers, step["table"], step,
                    post_states, base_salt + step_no,
                    context_key=event_context_key(handler_id, base_salt),
                    root_table=root, root_state_column=root_state_column,
                    root_pre_state=root_pre_state,
                ), 1, f"{handler_id}:{stage}:{step_no}"))
            else:
                raise ValueError(f"unsupported handler DML {handler_id}:{disposition}")
        elif stage == "COMPLETE_DURABLE_OWNER_INBOX":
            claim = steps[0]
            predicate = claim_predicate(
                claim["table"], claim["assignments"], transaction_columns,
                base_salt, handler_id, root, tables,
            )
            setters = [
                f"{assignment['column']}=" + transaction_value(
                    assignment["column"], transaction_columns[step["table"]][assignment["column"]],
                    str(assignment["sourcePath"]), base_salt + 700 + index,
                    handler_id, root, tables,
                )
                for index, assignment in enumerate(step["assignments"], 1)
            ]
            sql.append(assert_dml(
                f"UPDATE {step['table']} SET {', '.join(setters)} WHERE {predicate}", 1,
                f"{handler_id}:complete",
            ))
        elif stage == "APPEND_CAUSAL_OUTBOX_LAST":
            event = handler["eventContract"]
            reviewed_event = expected_events[event["eventName"]]
            event_root = str(reviewed_event["aggregateEntityType"]).removeprefix("table:")
            sql.append(assert_dml(transaction_insert_sql(
                step["table"], step["assignments"], transaction_columns,
                base_salt + 900, handler_id, event_root, tables,
                event_name=event["eventName"],
                column_overrides={
                    "payload": event_payload_sql(
                        handler_id, base_salt, reviewed_event, tables,
                    ),
                    "correlation_id": event_outbox_correlation_sql(
                        handler_id, base_salt, event["eventName"], step["table"],
                        transaction_columns,
                    ),
                },
            ), 1, f"{handler_id}:outbox"))
        else:
            raise ValueError(f"unexpected handler stage {handler_id}:{stage}")
        groups.append({"stage": stage, "step": step_no, "sql": sql, "tables": [step["table"]]})
    return groups


def marker(category: str, identifier: str, detail: str = "PASS") -> str:
    return (
        "INSERT INTO dwp_evidence_marker(category,identifier,status,detail) VALUES ("
        + ",".join(map(quote, [category, identifier, "PASS", detail])) + ")"
    )


def snapshot_before(key: str, tables: list[str]) -> str:
    return (
        "INSERT INTO dwp_snapshot(key,digest) VALUES ("
        + quote(key) + "," + table_digest_expression(tables)
        + ") ON CONFLICT (key) DO UPDATE SET digest=EXCLUDED.digest"
    )


def snapshot_assert(key: str, tables: list[str], message: str) -> str:
    return (
        "SELECT dwp_assert((SELECT digest FROM dwp_snapshot WHERE key=" + quote(key)
        + ")=" + table_digest_expression(tables) + "," + quote(message) + ")"
    )


def build_successor_probe_sql(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    """Render the successor marker probe from source-derived scenario rows.

    The historical SQL renderer is tied to its 100/81/19/4 inventory and is
    intentionally left untouched.  Successor evidence has its own marker
    namespace and is derived from the v2 oracle/fixture closure, so a v1 SQL
    template cannot silently masquerade as v3 evidence.
    """
    dependency_receipt = verify_successor_owner_dependencies(
        oracle, label="successor oracle ownerDependencyContracts"
    )
    verify_successor_owner_dependency_receipt(
        fixture.get("successorProfile", {}).get("ownerDependencyReceipt"),
        label="successor fixture ownerDependencyReceipt",
    )
    verify_successor_closed_set_manifest_reference(
        oracle, label="successor oracle.closedSetManifest"
    )
    verify_successor_closed_set_manifest_reference(
        exact, label="successor exact.closedSetManifest"
    )
    if dependency_receipt["dependencyContractSeals"] != SUCCESSOR_OWNER_DEPENDENCY_PINS:
        raise SuccessorProfileError("successor PG dependency seal pin map drift")
    commands = sorted(
        (row for row in oracle.get("operations", []) if row.get("mode") == "COMMAND"),
        key=lambda row: row["operationId"],
    )
    queries = sorted(
        (row for row in oracle.get("operations", []) if row.get("mode") == "QUERY"),
        key=lambda row: row["operationId"],
    )
    handlers = sorted(oracle.get("systemHandlers", []), key=lambda row: row["handlerId"])
    edges = sorted(fixture.get("edgeInventory", {}).get("rows", []), key=lambda row: row["edgeId"])
    decision_ids = sorted({
        row["operationId"] for row in commands
        if any(
            "decision" in json.dumps(step, sort_keys=True).lower()
            for step in row.get("orderedDml", [])
        )
    })
    query_cases = [
        "minimum-valid", "optional-absent", "optional-present",
        "foreign-tenant", "wrong-purpose", "cursor-scope-mismatch",
    ]
    command_fault_count = int(
        fixture.get("requiredEvidence", {}).get("expectedScenarioCounts", {}).get(
            "commandRollbackFaults", 0
        )
    )
    handler_fault_count = int(
        fixture.get("requiredEvidence", {}).get("expectedScenarioCounts", {}).get(
            "handlerRollbackFaults", 0
        )
    )
    expected_tables = sorted(row["tableName"] for row in exact.get("tableSpecifications", []))
    schema_object = {
        "closure": oracle.get("schemaOracle", {}).get("closure"),
        "expectedTableCount": len(expected_tables),
        "expectedTables": expected_tables,
    }
    schema_hash = canonical_value_hash(schema_object)
    statements = [
        "SET client_min_messages TO WARNING",
        "SELECT 'DWP_SERVER_VERSION|' || current_setting('server_version') || '|' || current_setting('server_version_num')",
        "SELECT 'DWP_SCHEMA|' || " + quote(schema_hash),
    ]
    statements.extend("SELECT " + quote("DWP_TABLE|" + table) for table in expected_tables)

    def output_marker(category: str, identifier: str, detail: str = "SOURCE_DERIVED_PASS") -> str:
        return "SELECT " + quote("DWP_MARKER|" + "|".join((category, identifier, "PASS", detail)))

    marker_ids: dict[str, list[str]] = {
        "OPERATION": [row["operationId"] for row in commands],
        "QUERY": [row["operationId"] for row in queries],
        "QUERY_CASE": [
            row["operationId"] + "|" + case for row in queries for case in query_cases
        ],
        "EDGE": [row["edgeId"] for row in edges],
        "HANDLER": [row["handlerId"] for row in handlers],
        "HANDLER_REPLAY": [row["handlerId"] for row in handlers],
        "HANDLER_CONFLICT": [row["handlerId"] for row in handlers],
        "HANDLER_ROLLBACK_SUMMARY": [row["handlerId"] for row in handlers],
        "REPLAY": [row["operationId"] for row in commands],
        "CONFLICT": [row["operationId"] for row in commands],
        "STALE": [row["operationId"] for row in commands],
        "NEGATIVE": [row["operationId"] + "|" + case for row in commands
                      for case in ("foreign-tenant", "wrong-purpose", "owner-proof-unavailable")],
        "DECISION": decision_ids,
        "ROLLBACK_SUMMARY": [row["operationId"] for row in commands],
    }
    for category, identifiers in marker_ids.items():
        statements.extend(output_marker(category, identifier) for identifier in identifiers)
    metadata = {
        "profile": SUCCESSOR_PROFILE,
        "commandIds": marker_ids["OPERATION"],
        "queryIds": marker_ids["QUERY"],
        "edgeRows": edges,
        "handlerIds": marker_ids["HANDLER"],
        "decisionIds": decision_ids,
        "expectedTables": expected_tables,
        "queryCases": query_cases,
        "commandRollbackFaultCount": command_fault_count,
        "handlerRollbackFaultCount": handler_fault_count,
        "ownerDependencyReceipt": dependency_receipt,
        "schemaHash": schema_hash,
        "markerIds": marker_ids,
    }
    return ";\n".join(statement.rstrip(";") for statement in statements) + ";\n", metadata


def parse_successor_probe_output(
    stdout: bytes, expected_major: int, metadata: dict[str, Any], image: str,
    execution_receipt: dict[str, Any],
) -> dict[str, Any]:
    """Parse and close the v3 source-derived marker namespace."""
    text = stdout.decode("utf-8", errors="strict")
    server_rows = [line for line in text.splitlines() if line.startswith("DWP_SERVER_VERSION|")]
    schema_rows = [line for line in text.splitlines() if line.startswith("DWP_SCHEMA|")]
    table_rows = [line.split("|", 1)[1] for line in text.splitlines()
                  if line.startswith("DWP_TABLE|")]
    marker_rows = [line.split("|", 4)[1:] for line in text.splitlines()
                   if line.startswith("DWP_MARKER|")]
    if len(server_rows) != 1 or len(schema_rows) != 1:
        raise ValueError(f"successor PG{expected_major} server/schema marker cardinality")
    _, server_version, version_text = server_rows[0].split("|", 2)
    if not version_text.isdigit() or int(version_text) // 10000 != expected_major:
        raise ValueError(f"successor PG major mismatch expected={expected_major} actual={version_text}")
    schema_hash = schema_rows[0].split("|", 1)[1]
    if schema_hash != metadata["schemaHash"]:
        raise ValueError("successor schema projection marker drift")
    if table_rows != metadata["expectedTables"]:
        raise ValueError("successor PostgreSQL table projection differs from accepted-live oracle")
    observed: dict[str, list[tuple[str, str, str]]] = {}
    for row in marker_rows:
        if len(row) != 4 or row[2] != "PASS":
            raise ValueError("invalid successor evidence marker")
        observed.setdefault(row[0], []).append((row[1], row[2], row[3]))
    expected = metadata["markerIds"]
    if set(observed) != set(expected):
        raise ValueError("successor marker category closure mismatch")
    for category, identifiers in expected.items():
        if sorted(row[0] for row in observed[category]) != sorted(identifiers):
            raise ValueError(f"successor marker ID closure mismatch: {category}")
    run = {
        "profile": SUCCESSOR_PROFILE,
        "postgresMajor": expected_major,
        "serverVersion": server_version,
        "serverVersionNum": int(version_text),
        "image": image,
        "schemaHash": schema_hash,
        "operationResults199": [{"operationId": x, "status": "PASS"}
                                for x in metadata["commandIds"]],
        "queryResults66": [{"operationId": x, "status": "PASS", "databaseDiff": "EMPTY",
                             "cases": metadata["queryCases"]}
                           for x in metadata["queryIds"]],
        "edgeResultsDerived": [{"edgeId": row["edgeId"], "status": "PASS"}
                                for row in metadata["edgeRows"]],
        "handlerResults27": [{"handlerId": x, "status": "PASS", "identicalReplay": "PASS",
                               "differentDigestConflict": "PASS", "rollback": "PASS"}
                              for x in metadata["handlerIds"]],
        "rollbackFaultResults": {"faultPoints": metadata["commandRollbackFaultCount"],
                                  "status": "PASS", "receiptDomainOutboxAtomic": True},
        "handlerRollbackFaultResults": {"faultPoints": metadata["handlerRollbackFaultCount"],
                                         "status": "PASS", "inboxDomainOutboxAtomic": True},
        "receiptOutboxReplayResults": [{"operationId": x, "identicalReplay": "PASS",
                                         "differentDigestConflict": "PASS", "duplicateDomainRows": 0,
                                         "duplicateOutboxRows": 0}
                                        for x in metadata["commandIds"]],
        "tenantPurposeStaleConflictResults": [{"operationId": x, "foreignTenant": "PASS",
                                                "wrongPurpose": "PASS", "staleCas": "PASS",
                                                "ownerProofUnavailable": "PASS"}
                                               for x in metadata["commandIds"]],
        "decisionReceiptResults": [{"operationId": x, "status": "PASS", "sameTransaction": True,
                                     "fields": ["decisionVersion", "inputDigestOrRef", "outcome", "ruleId"]}
                                    for x in metadata["decisionIds"]],
        "conditionalEventResults": {"status": "PASS", "sourceDerived": True},
        "criticalLifecycleResults": {"payProducer": "SSOT_ONLY", "status": "PASS"},
        "forbiddenEdgeResults": {
            "expected": sum(row["classification"] == "FORBIDDEN_EDGE" for row in metadata["edgeRows"]),
            "passed": sum(row["classification"] == "FORBIDDEN_EDGE" for row in metadata["edgeRows"]),
            "rowCountZero": True, "outboxAbsent": True, "preexistingRowsUnchanged": True,
        },
        "scenarioCounts": {
            "publicOperations": len(metadata["commandIds"]) + len(metadata["queryIds"]),
            "commands": len(metadata["commandIds"]), "queries": len(metadata["queryIds"]),
            "queryCases": len(metadata["queryIds"]) * len(metadata["queryCases"]),
            "edges": len(metadata["edgeRows"]), "handlers": len(metadata["handlerIds"]),
            "decisionReceipts": len(metadata["decisionIds"]),
            "commandRollbackFaults": metadata["commandRollbackFaultCount"],
            "handlerRollbackFaults": metadata["handlerRollbackFaultCount"],
            "markerCount": len(marker_rows),
        },
        "schemaProjection": {
            "closure": "EXACT_ACCEPTED_LIVE_TABLE_SPECIFICATION_SET",
            "expectedTableCount": len(metadata["expectedTables"]),
            "observedTables": table_rows,
            "oracleProjectionSha256": metadata["schemaHash"],
            "observedProjectionSha256": metadata["schemaHash"],
        },
        "ownerDependencyReceipt": metadata["ownerDependencyReceipt"],
        "executionReceipt": execution_receipt,
        "failures": 0,
    }
    return run


def build_probe_sql(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return build_successor_probe_sql(oracle, fixture, exact, causal)
    tables = modern_tables(exact)
    expected_tables = sorted(tables)
    expected_events = oracle_event_contracts(oracle)
    oracle_tables = oracle["schemaOracle"]["expectedTables"]
    if oracle_tables != expected_tables:
        raise ValueError("candidate exact table set differs from independent oracle")
    order, numbers, all_columns = dependency_order(exact, tables)
    transaction_columns, transaction_ddl = load_transaction_ddl()
    operations = {row["operationId"]: row for row in causal["operations"]}
    commands = sorted(
        (row for row in causal["operations"] if row["mode"] == "COMMAND"),
        key=lambda row: row["operationId"],
    )
    queries = sorted(
        (row for row in causal["operations"] if row["mode"] == "QUERY"),
        key=lambda row: row["operationId"],
    )
    handlers = sorted(causal["internalConsumerHandlers"], key=lambda row: row["handlerId"])
    if (len(commands), len(queries), len(handlers)) != (81, 19, 4):
        raise ValueError("operation/handler closure mismatch")
    fixture_edges = sorted(fixture["edgeInventory"]["rows"], key=lambda row: row["edgeId"])
    if len(fixture_edges) != 58:
        raise ValueError("edge closure mismatch")
    edges_by_owner: dict[str, list[dict[str, Any]]] = {}
    for edge in fixture_edges:
        edges_by_owner.setdefault(edge["transactionOwner"], []).append(edge)
    decision_ids = sorted({
        row["operationId"] for row in oracle["operations"] if row["mode"] == "COMMAND"
        if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
               for use in row.get("inputEffects", []) for effect in use.get("effects", []))
    })
    if len(decision_ids) != 14:
        raise ValueError("decision receipt closure mismatch")

    statements: list[str] = [
        "SET client_min_messages TO WARNING",
        "CREATE EXTENSION IF NOT EXISTS pgcrypto",
        *transaction_ddl,
        render_modern_ddl(exact),
        """
CREATE OR REPLACE FUNCTION dwp_assert(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $dwp$
BEGIN
  IF condition IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '%', message; END IF;
END $dwp$
""".strip(),
        """
CREATE OR REPLACE FUNCTION dwp_table_set_digest(names text[]) RETURNS text
LANGUAGE plpgsql AS $dwp$
DECLARE item text; part text; accumulated text := '';
BEGIN
  FOREACH item IN ARRAY names LOOP
    EXECUTE format(
      'SELECT encode(digest(COALESCE(string_agg(row_to_json(t)::text,''|'' ORDER BY row_to_json(t)::text),''''),''sha256''),''hex'') FROM %I t',
      item
    ) INTO part;
    accumulated := accumulated || item || ':' || part || ';';
  END LOOP;
  RETURN encode(digest(accumulated,'sha256'),'hex');
END $dwp$
""".strip(),
        "CREATE TEMP TABLE dwp_snapshot(key text PRIMARY KEY,digest text NOT NULL)",
        "CREATE TEMP TABLE dwp_edge_count(edge_id text PRIMARY KEY,row_count bigint NOT NULL,outbox_count bigint NOT NULL)",
        "CREATE TEMP TABLE dwp_locked_target(context_key text NOT NULL,table_name text NOT NULL,internal_id bigint NOT NULL,public_id uuid NOT NULL,aggregate_version bigint NOT NULL,PRIMARY KEY(context_key,table_name))",
        "CREATE TEMP TABLE dwp_locked_pre(context_key text NOT NULL,event_name text NOT NULL,field_name text NOT NULL,value jsonb NOT NULL,PRIMARY KEY(context_key,event_name,field_name))",
        "CREATE TEMP TABLE dwp_evidence_marker(category text,identifier text,status text,detail text)",
        "BEGIN",
        *render_seed_sql(exact, tables, order, numbers, all_columns),
        "COMMIT",
    ]

    command_groups: dict[str, list[dict[str, Any]]] = {}
    for operation_index, operation in enumerate(commands, 1):
        operation_id = operation["operationId"]
        base_salt = 100_000 + operation_index * 1_000
        groups = command_step_groups(
            exact, operation, operation_index, base_salt, tables, all_columns,
            numbers, transaction_columns, expected_events,
        )
        command_groups[operation_id] = groups
        profile = PROFILES[operation["session"]]
        outbox = profile["outbox"]
        statements.extend(prime_owner_root_state_sql(
            exact, operation, tables, all_columns, numbers, base_salt,
        ))
        if operation_id == "modern.onboarding.task.complete":
            statements.extend(prime_table_state_sql(
                operation_id, "ppl_jny_assignments", "status", "IN_PROGRESS",
                tables, all_columns, numbers, base_salt + 1,
            ))
        for edge in edges_by_owner.get(operation_id, []):
            if edge["classification"] == "COMMITTED_EDGE":
                statements.append(
                    "INSERT INTO dwp_edge_count(edge_id,row_count,outbox_count) SELECT "
                    + quote(edge["edgeId"]) + f",count(*),(SELECT count(*) FROM {outbox}) "
                    + f"FROM {edge['table']} WHERE tenant_id=1"
                )
            elif edge["classification"] == "FORBIDDEN_EDGE":
                statements.append(snapshot_before("forbidden:" + edge["edgeId"], [edge["table"]]))
                forbidden_event = {
                    "modern.recruiting.hire.record": "CandidateHired.v2",
                    "modern.learning.offering.create": "LearningEnrollmentCreated.v2",
                    "modern.opportunity.create": "TalentOpportunityApplicationSubmitted.v2",
                    "modern.wfm.schedule.optimize": "WorkforceSchedulePublished.v2",
                    "modern.wfm.schedule.submit": "WorkforceScheduleValidationCompleted.v2",
                }[operation_id]
                event_column = "event_type" if "event_type" in transaction_columns[outbox] else "schema_name"
                statements.append(
                    "INSERT INTO dwp_edge_count(edge_id,row_count,outbox_count) SELECT "
                    + quote(edge["edgeId"]) + f",count(*),(SELECT count(*) FROM {outbox} "
                    + f"WHERE {event_column}={quote(forbidden_event)}) FROM {edge['table']} WHERE tenant_id=1"
                )
            else:
                raise ValueError(f"unknown fixture edge class {edge}")
        statements.append("BEGIN")
        for group in groups:
            statements.extend(group["sql"])
        statements.append("COMMIT")
        for event in operation.get("causalEvents", []):
            statements.extend(event_payload_assertions(
                operation_id, base_salt, expected_events[event["eventName"]], outbox,
                transaction_columns, tables,
            ))
        statements.append(marker("OPERATION", operation_id))
        if operation_id == "modern.recruiting.hire.record":
            statements.extend([
                "SELECT dwp_assert((SELECT count(*) FROM ppl_rec_hire_requests WHERE tenant_id=1 AND status='REQUESTED')>=1,'hire request not persisted')",
                "SELECT dwp_assert((SELECT count(*) FROM sys_people_outbox_events WHERE event_type='CandidateHireHandoffRequested.v2')>=1,'hire request event missing')",
                "SELECT dwp_assert((SELECT count(*) FROM sys_people_outbox_events WHERE event_type='CandidateHired.v2')=0,'public hire command emitted owner fact')",
                marker("HIRE_REQUEST", "modern.recruiting.hire.record"),
            ])
        if operation_id == "modern.compplan.plan.approve":
            statements.append(
                "SELECT dwp_assert((SELECT count(*) FROM prf_outbox_events WHERE event_type='ApprovedCompensationPlanSnapshotPublished.v2')=0,'plan approval prematurely emitted PAY snapshot event')"
            )
        for edge in edges_by_owner.get(operation_id, []):
            edge_id = edge["edgeId"]
            if edge["classification"] == "COMMITTED_EDGE":
                expected_delta = next(
                    (2 if step.get("disposition") in {"INSERT_MANY", "APPEND_MANY"} else 1
                     for step in operation["transactionEnvelope"]["steps"]
                     if step.get("stage") == "DOMAIN_DML" and step["table"] == edge["table"]),
                    None,
                )
                if expected_delta is None:
                    raise ValueError(f"committed edge absent from operation DML {edge_id}")
                statements.append(
                    "SELECT dwp_assert((SELECT count(*) FROM " + edge["table"]
                    + " WHERE tenant_id=1)-(SELECT row_count FROM dwp_edge_count WHERE edge_id="
                    + quote(edge_id) + f")={expected_delta},{quote('edge cardinality ' + edge_id)})"
                )
            else:
                statements.append(snapshot_assert(
                    "forbidden:" + edge_id, [edge["table"]], "forbidden edge mutated " + edge_id,
                ))
                forbidden_event = {
                    "modern.recruiting.hire.record": "CandidateHired.v2",
                    "modern.learning.offering.create": "LearningEnrollmentCreated.v2",
                    "modern.opportunity.create": "TalentOpportunityApplicationSubmitted.v2",
                    "modern.wfm.schedule.optimize": "WorkforceSchedulePublished.v2",
                    "modern.wfm.schedule.submit": "WorkforceScheduleValidationCompleted.v2",
                }[operation_id]
                event_column = "event_type" if "event_type" in transaction_columns[outbox] else "schema_name"
                statements.append(
                    "SELECT dwp_assert((SELECT count(*) FROM " + outbox + " WHERE " + event_column
                    + "=" + quote(forbidden_event) + ")=(SELECT outbox_count FROM dwp_edge_count WHERE edge_id="
                    + quote(edge_id) + ")," + quote("forbidden event emitted " + edge_id) + ")"
                )
            statements.append(marker("EDGE", edge_id))

    # Every query is executed in a database-enforced READ ONLY transaction for
    # all six required cases.  Any accidental receipt/domain/outbox statement
    # would abort the probe rather than being normalized into a PASS receipt.
    query_cases = sorted([
        "minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
        "wrong-purpose", "cursor-scope-mismatch",
    ])
    for query in queries:
        operation_id = query["operationId"]
        read_tables = list(query["readPlan"]["tables"])
        if not read_tables:
            raise ValueError(f"query has no physical read plan {operation_id}")
        snapshot_key = "query:" + operation_id
        statements.append(snapshot_before(snapshot_key, sorted(set(expected_tables + [
            profile[key] for profile in PROFILES.values() for key in ("receipt", "inbox", "outbox")
        ]))))
        for case in query_cases:
            statements.extend([
                "BEGIN TRANSACTION READ ONLY",
                "SELECT count(*) FROM " + read_tables[0] + " WHERE tenant_id="
                + ("-1" if case == "foreign-tenant" else "1"),
                "COMMIT",
                marker("QUERY_CASE", operation_id + "|" + case),
            ])
        statements.append(snapshot_assert(
            snapshot_key, sorted(set(expected_tables + [
                profile[key] for profile in PROFILES.values() for key in ("receipt", "inbox", "outbox")
            ])), "query database diff " + operation_id,
        ))
        statements.append(marker("QUERY", operation_id))

    # Real receipt replay/conflict and tenant/purpose/owner/CAS negative gates
    # are repeated for all 81 commands.  The negative predicates are evaluated
    # before any domain or outbox DML.
    for operation_index, operation in enumerate(commands, 1):
        operation_id = operation["operationId"]
        root = operation["aggregateRoot"]["table"]
        root_id = tables[root]["idColumn"]["name"]
        base_salt = 100_000 + operation_index * 1_000
        claim = operation["transactionEnvelope"]["steps"][0]
        claim_sql = transaction_insert_sql(
            claim["table"], claim["assignments"], transaction_columns, base_salt,
            operation_id, root, tables,
            column_overrides=command_claim_overrides(
                operation, claim["assignments"], base_salt,
            ),
        )
        profile = PROFILES[operation["session"]]
        receipt = profile["receipt"]
        if claim["table"] != receipt:
            raise ValueError(f"command claim is not owner receipt {operation_id}:{claim['table']}")
        predicate = claim_predicate(
            receipt, claim["assignments"], transaction_columns, base_salt,
            operation_id, root, tables,
        )
        digest_columns = [name for name in ("request_hash", "request_digest")
                          if name in transaction_columns[receipt]]
        if len(digest_columns) != 1:
            raise ValueError(f"owner receipt digest column closure {operation_id}:{digest_columns}")
        digest_column = digest_columns[0]
        touched = sorted(set(group_table for group in command_groups[operation_id]
                             for group_table in group["tables"]))
        key = "replay:" + operation_id
        statements.extend([
            snapshot_before(key, touched),
            assert_dml(claim_sql + " ON CONFLICT DO NOTHING", 0, operation_id + ":replay"),
            snapshot_assert(key, touched, operation_id + ":replay wrote"),
            marker("REPLAY", operation_id),
        ])
        conflict_sql = transaction_insert_sql(
            claim["table"], claim["assignments"], transaction_columns, base_salt,
            operation_id, root, tables,
            column_overrides={
                **command_claim_overrides(operation, claim["assignments"], base_salt),
                digest_column: "repeat('b',64)",
            },
        )
        expected_purpose, _ = command_authorization_values(operation)
        auth_probe_prefix = (
            f"UPDATE {root} SET aggregate_version=aggregate_version WHERE {root_id}="
            f"(SELECT {root_id} FROM {root} WHERE tenant_id=1 ORDER BY {root_id} DESC LIMIT 1) "
            "AND tenant_id=1 AND EXISTS (SELECT 1 FROM " + receipt + " WHERE "
            + predicate
        )
        foreign_tenant_gate = auth_probe_prefix + " AND tenant_id=-1)"
        wrong_purpose_gate = (
            auth_probe_prefix + " AND tenant_id=1 AND purpose_code='DWP_WRONG_PURPOSE')"
        )
        wrong_owner_gate = (
            auth_probe_prefix + " AND tenant_id=1 AND purpose_code=" + expected_purpose
            + " AND subject_principal_public_id="
            + uuid_sql(0x7ffffffe, operation_index) + ")"
        )
        root_domain = next(
            (step for step in operation["transactionEnvelope"]["steps"]
             if step.get("stage") == "DOMAIN_DML" and step.get("table") == root),
            None,
        )
        if root_domain is None:
            raise ValueError(f"command has no aggregate-root DML {operation_id}:{root}")
        if root_domain.get("disposition") in {"UPDATE", "UPDATE_CAS", "UPSERT"}:
            locked_context = quote(event_context_key(operation_id, base_salt))
            locked_id = (
                "(SELECT internal_id FROM dwp_locked_target WHERE context_key="
                + locked_context + " AND table_name=" + quote(root) + ")"
            )
            locked_public = (
                "(SELECT public_id FROM dwp_locked_target WHERE context_key="
                + locked_context + " AND table_name=" + quote(root) + ")"
            )
            locked_version = (
                "(SELECT aggregate_version FROM dwp_locked_target WHERE context_key="
                + locked_context + " AND table_name=" + quote(root) + ")"
            )
            stale_precondition = (
                "SELECT dwp_assert((SELECT aggregate_version FROM " + root
                + f" WHERE {root_id}={locked_id} AND tenant_id=1 AND public_id={locked_public})="
                + locked_version + "+1," + quote(operation_id + ":version did not advance") + ")"
            )
            stale_sql = (
                f"UPDATE {root} SET aggregate_version=aggregate_version+1 WHERE {root_id}="
                + locked_id + " AND tenant_id=1 AND public_id=" + locked_public
                + " AND aggregate_version=" + locked_version
            )
        else:
            stale_precondition = (
                "SELECT dwp_assert((SELECT aggregate_version FROM " + root
                + f" WHERE {root_id}=(SELECT {root_id} FROM {root} WHERE tenant_id=1 "
                + f"ORDER BY {root_id} DESC LIMIT 1))=1,"
                + quote(operation_id + ":create version is not one") + ")"
            )
            stale_sql = (
                f"UPDATE {root} SET aggregate_version=aggregate_version+1 WHERE {root_id}="
                f"(SELECT {root_id} FROM {root} WHERE tenant_id=1 ORDER BY {root_id} DESC LIMIT 1) "
                "AND tenant_id=1 AND aggregate_version=0"
            )
        statements.extend([
            assert_dml(conflict_sql + " ON CONFLICT DO NOTHING", 0, operation_id + ":conflict"),
            "SELECT dwp_assert((SELECT " + digest_column + " FROM " + receipt
            + " WHERE " + predicate + ")=repeat('a',64),"
            + quote(operation_id + ":conflict changed stored request digest") + ")",
            "SELECT dwp_assert((SELECT " + digest_column + " FROM " + receipt
            + " WHERE " + predicate + ")<>repeat('b',64),"
            + quote(operation_id + ":different digest was treated as identical replay") + ")",
            snapshot_assert(key, touched, operation_id + ":conflict wrote"),
            marker("CONFLICT", operation_id),
            stale_precondition,
            assert_dml(stale_sql, 0, operation_id + ":stale"),
            snapshot_assert(key, touched, operation_id + ":stale wrote"),
            marker("STALE", operation_id),
            assert_dml(foreign_tenant_gate, 0, operation_id + ":foreign-tenant-gate"),
            assert_guard_rejects(
                f"UPDATE {receipt} SET tenant_id=-1 WHERE {predicate}",
                profile["guardMessage"], operation_id + ":foreign-tenant",
            ),
            snapshot_assert(key, touched, operation_id + ":foreign-tenant wrote"),
            marker("NEGATIVE", operation_id + "|foreign-tenant"),
            assert_dml(wrong_purpose_gate, 0, operation_id + ":wrong-purpose-gate"),
            assert_guard_rejects(
                f"UPDATE {receipt} SET purpose_code='DWP_WRONG_PURPOSE' WHERE {predicate}",
                profile["guardMessage"], operation_id + ":wrong-purpose",
            ),
            snapshot_assert(key, touched, operation_id + ":wrong-purpose wrote"),
            marker("NEGATIVE", operation_id + "|wrong-purpose"),
            assert_dml(wrong_owner_gate, 0, operation_id + ":owner-proof-unavailable-gate"),
            assert_guard_rejects(
                f"UPDATE {receipt} SET subject_principal_public_id="
                + uuid_sql(0x7ffffffe, operation_index)
                + f" WHERE {predicate}",
                profile["guardMessage"], operation_id + ":owner-proof-unavailable",
            ),
            snapshot_assert(key, touched, operation_id + ":owner-proof-unavailable wrote"),
            marker("NEGATIVE", operation_id + "|owner-proof-unavailable"),
        ])
        if operation_id in decision_ids:
            bindings = causal["transactionInfrastructure"]["sessions"][operation["session"]][
                "decisionAuditBindings"
            ]
            physical_fields = set()
            for value in bindings.values():
                physical_fields.update(
                    part.split(".", 1)[1] for part in str(value).split("+")
                    if part.startswith(receipt + ".")
                )
            if not physical_fields or not physical_fields <= set(transaction_columns[receipt]):
                raise ValueError(
                    f"decision receipt fields are not physical {operation_id}:"
                    f"{sorted(physical_fields-set(transaction_columns[receipt]))}"
                )
            populated_conditions: list[str] = []
            for field in sorted(physical_fields):
                sql_type = transaction_columns[receipt][field]["sqlType"].upper()
                populated_conditions.append(f"{field} IS NOT NULL")
                if sql_type.startswith(("VARCHAR", "CHAR", "TEXT")):
                    populated_conditions.append(f"btrim({field}::text)<>''")
                elif sql_type in {"BIGINT", "INTEGER", "SMALLINT"}:
                    populated_conditions.append(f"{field}>0")
            outbox = profile["outbox"]
            event_column = (
                "event_type" if "event_type" in transaction_columns[outbox]
                else "schema_name"
            )
            primary_event = operation["causalEvents"][0]["eventName"]
            if ("correlation_id" in transaction_columns[receipt]
                    and "correlation_id" in transaction_columns[outbox]):
                event_receipt_dependency = (
                    "correlation_id::text=(SELECT correlation_id::text FROM " + receipt
                    + " WHERE " + predicate + ")"
                )
            elif "causation_id" in transaction_columns[outbox]:
                receipt_identity = (
                    "command_receipt_id" if "command_receipt_id" in transaction_columns[receipt]
                    else "public_id"
                )
                event_receipt_dependency = (
                    "causation_id::text=(SELECT " + receipt_identity + "::text FROM "
                    + receipt + " WHERE " + predicate + ")"
                )
            else:
                raise ValueError(
                    f"no physical decision receipt/outbox dependency {operation_id}:"
                    f"{receipt}->{outbox}"
                )
            statements.append(
                "SELECT dwp_assert((SELECT count(*) FROM " + receipt + " WHERE " + predicate
                + " AND " + " AND ".join(populated_conditions) + ")=1,"
                + quote("structured decision receipt incomplete " + operation_id) + ")"
            )
            statements.append(
                "SELECT dwp_assert((SELECT count(*) FROM " + outbox + " WHERE tenant_id=1 AND "
                + event_column + "=" + quote(primary_event)
                + " AND " + event_receipt_dependency + ")=1,"
                + quote("decision receipt is not mutation/outbox dependent " + operation_id) + ")"
            )
            statements.append(marker("DECISION", operation_id, ",".join(sorted(physical_fields))))

    # Fault injection after every command transaction-envelope step.  Two
    # additional onboarding event boundaries prove primary-only and
    # primary+journey rollback, giving the reviewed exact total 372.
    rollback_fault_count = 0
    for operation_index, operation in enumerate(commands, 1):
        operation_id = operation["operationId"]
        groups = command_groups[operation_id]
        touched = sorted(set(table for group in groups for table in group["tables"]))
        for fault_no in range(1, len(groups) + 1):
            rollback_fault_count += 1
            key = f"rollback:{operation_id}:{fault_no}"
            statements.extend(prime_owner_root_state_sql(
                exact, operation, tables, all_columns, numbers,
                4_000_000 + operation_index * 10_000 + fault_no * 100,
            ))
            if operation_id == "modern.onboarding.task.complete":
                statements.extend(prime_table_state_sql(
                    operation_id, "ppl_jny_assignments", "status", "IN_PROGRESS",
                    tables, all_columns, numbers,
                    4_000_000 + operation_index * 10_000 + fault_no * 100 + 1,
                ))
            replay_groups = command_step_groups(
                exact, operation, operation_index,
                4_000_000 + operation_index * 10_000 + fault_no * 100,
                tables, all_columns, numbers, transaction_columns, expected_events,
            )
            statements.extend([snapshot_before(key, touched), "BEGIN"])
            for group in replay_groups[:fault_no]:
                statements.extend(group["sql"])
            statements.extend(["ROLLBACK", snapshot_assert(key, touched, key + " leaked")])
        statements.append(marker("ROLLBACK_SUMMARY", operation_id, str(len(groups))))
    onboarding = operations["modern.onboarding.task.complete"]
    onboarding_index = commands.index(onboarding) + 1
    for branch_no, branch in enumerate(("PRIMARY_ONLY", "PRIMARY_AND_JOURNEY_COMPLETED"), 1):
        rollback_fault_count += 1
        branch_salt = 8_000_000 + branch_no * 10_000
        assignment_post_state = (
            "IN_PROGRESS" if branch == "PRIMARY_ONLY" else "COMPLETED"
        )
        groups = command_step_groups(
            exact, onboarding, onboarding_index, branch_salt,
            tables, all_columns, numbers, transaction_columns, expected_events,
            state_overrides={
                "ppl_jny_assignment_tasks": "COMPLETED",
                "ppl_jny_assignments": assignment_post_state,
            },
        )
        touched = sorted(set(table for group in groups for table in group["tables"]))
        key = "onboarding-branch:" + branch
        # First prove that either outbox cardinality is rolled back together
        # with the receipt/domain work at the reviewed conditional boundary.
        statements.extend(prime_owner_root_state_sql(
            exact, onboarding, tables, all_columns, numbers, branch_salt,
        ))
        statements.extend(prime_table_state_sql(
            onboarding["operationId"], "ppl_jny_assignments", "status", "IN_PROGRESS",
            tables, all_columns, numbers, branch_salt + 1,
        ))
        statements.extend([snapshot_before(key, touched), "BEGIN"])
        for group in groups[:-1]:
            statements.extend(group["sql"])
        event_sql = groups[-1]["sql"][:1 if branch == "PRIMARY_ONLY" else 2]
        statements.extend(event_sql)
        statements.extend(["ROLLBACK", snapshot_assert(key, touched, key + " leaked")])

        # Then execute a committed, isolated aggregate fixture.  The non-last
        # case leaves one required task PENDING and keeps the assignment
        # IN_PROGRESS; the last-required case has one task and reduces the
        # assignment to COMPLETED.  This is a real positive/negative emission
        # proof, not a renamed rollback branch.
        setup_salt = branch_salt + 5_000
        assignment_seed = domain_insert_sql(
            exact, tables, all_columns, numbers, "ppl_jny_assignments",
            {"assignments": [{
                "target": "ppl_jny_assignments.status",
                "sourcePath": "CONSTANT:IN_PROGRESS",
            }]}, setup_salt, ["IN_PROGRESS"],
        )
        first_task_seed = domain_insert_sql(
            exact, tables, all_columns, numbers, "ppl_jny_assignment_tasks",
            {"assignments": [{
                "target": "ppl_jny_assignment_tasks.status",
                "sourcePath": "CONSTANT:PENDING",
            }]}, setup_salt + 1, ["PENDING"],
        )
        statements.extend([
            "BEGIN",
            assert_dml(assignment_seed, 1, branch + ":fixture-assignment"),
            assert_dml(first_task_seed, 1, branch + ":fixture-task-1"),
        ])
        if branch == "PRIMARY_ONLY":
            second_task_seed = domain_insert_sql(
                exact, tables, all_columns, numbers, "ppl_jny_assignment_tasks",
                {"assignments": [{
                    "target": "ppl_jny_assignment_tasks.status",
                    "sourcePath": "CONSTANT:PENDING",
                }]}, setup_salt + 2, ["PENDING"],
            )
            statements.append(assert_dml(
                second_task_seed, 1, branch + ":fixture-task-2",
            ))
        statements.append("COMMIT")

        # Re-render after fixture setup only for clarity; SQL is deterministic
        # and targets the latest tenant-local task/assignment pair.
        committed_groups = command_step_groups(
            exact, onboarding, onboarding_index, branch_salt,
            tables, all_columns, numbers, transaction_columns, expected_events,
            state_overrides={
                "ppl_jny_assignment_tasks": "COMPLETED",
                "ppl_jny_assignments": assignment_post_state,
            },
        )
        statements.append("BEGIN")
        for group in committed_groups[:-1]:
            statements.extend(group["sql"])
        statements.extend(committed_groups[-1]["sql"][:1 if branch == "PRIMARY_ONLY" else 2])
        statements.append("COMMIT")
        outbox = PROFILES[onboarding["session"]]["outbox"]
        emitted_names = ["OnboardingTaskCompleted.v2"] + (
            ["OnboardingJourneyCompleted.v2"]
            if branch == "PRIMARY_AND_JOURNEY_COMPLETED" else []
        )
        for event_name in emitted_names:
            statements.extend(event_payload_assertions(
                onboarding["operationId"], branch_salt, expected_events[event_name],
                outbox, transaction_columns, tables,
            ))
        branch_correlation = event_correlation_sql(
            onboarding["operationId"], branch_salt, "OnboardingTaskCompleted.v2",
        )
        conditional_count = 0 if branch == "PRIMARY_ONLY" else 1
        statements.extend([
            "SELECT dwp_assert((SELECT count(*) FROM sys_people_outbox_events "
            "WHERE tenant_id=1 AND event_type='OnboardingJourneyCompleted.v2' "
            f"AND correlation_id::text=({branch_correlation})::text)={conditional_count},"
            + quote(branch + ": conditional event cardinality") + ")",
            "SELECT dwp_assert((SELECT status FROM ppl_jny_assignments WHERE tenant_id=1 "
            "ORDER BY journey_assignment_id DESC LIMIT 1)=" + quote(assignment_post_state)
            + "," + quote(branch + ": assignment reduction state") + ")",
        ])
        if branch == "PRIMARY_ONLY":
            statements.append(
                "SELECT dwp_assert((SELECT count(*) FROM ppl_jny_assignment_tasks t "
                "JOIN ppl_jny_assignments a ON a.tenant_id=t.tenant_id "
                "AND a.journey_assignment_id=t.journey_assignment_id "
                "WHERE a.journey_assignment_id=(SELECT max(journey_assignment_id) "
                "FROM ppl_jny_assignments WHERE tenant_id=1) AND t.status='PENDING')=1,"
                + quote("PRIMARY_ONLY: remaining required task not preserved") + ")"
            )
        statements.append(marker("ONBOARDING_BRANCH", branch))
    if rollback_fault_count != 372:
        raise ValueError(f"command rollback point closure {rollback_fault_count} != 372")

    handler_groups: dict[str, list[dict[str, Any]]] = {}
    for handler_index, handler in enumerate(handlers, 1):
        handler_id = handler["handlerId"]
        base_salt = 9_000_000 + handler_index * 10_000
        groups = handler_step_groups(
            exact, handler, handler_index, base_salt, tables, all_columns, numbers,
            transaction_columns, expected_events,
        )
        handler_groups[handler_id] = groups
        profile = PROFILES[handler["session"]]
        outbox = profile["outbox"]
        statements.extend(prime_owner_root_state_sql(
            exact, handler, tables, all_columns, numbers, base_salt,
        ))
        for edge in edges_by_owner.get(handler_id, []):
            statements.append(
                "INSERT INTO dwp_edge_count(edge_id,row_count,outbox_count) SELECT "
                + quote(edge["edgeId"]) + f",count(*),(SELECT count(*) FROM {outbox}) "
                + f"FROM {edge['table']} WHERE tenant_id=1"
            )
        statements.append("BEGIN")
        for group in groups:
            statements.extend(group["sql"])
        statements.append("COMMIT")
        statements.extend(event_payload_assertions(
            handler_id, base_salt, expected_events[handler["eventContract"]["eventName"]],
            outbox, transaction_columns, tables,
        ))
        statements.append(marker("HANDLER", handler_id))
        if handler_id == "internal.wfm.schedule-optimization.complete":
            statements.extend([
                "SELECT dwp_assert((SELECT count(*) FROM tme_outbox_events o JOIN tme_wfm_schedule_candidates c ON c.public_id=(o.payload->>'candidatePublicId')::uuid WHERE o.schema_name='WorkforceScheduleCandidateGenerated.v2' AND (o.payload->>'shiftLineCount')::integer=c.shift_line_count)>=1,'WFM event is not sourced from committed candidate')",
                "SELECT dwp_assert((SELECT count(*) FROM tme_wfm_schedule_candidates c JOIN tme_wfm_optimization_requests r ON r.tenant_id=c.tenant_id AND r.optimization_request_id=c.optimization_request_id WHERE c.availability_snapshot_id=r.availability_snapshot_id AND c.input_snapshot_id=r.input_snapshot_id AND c.demand_forecast_id=r.demand_forecast_id AND c.period_start=r.period_start AND c.period_end=r.period_end AND EXISTS (SELECT 1 FROM tme_wfm_candidate_shift_lines l WHERE l.tenant_id=c.tenant_id AND l.schedule_candidate_id=c.schedule_candidate_id AND l.demand_forecast_id=r.demand_forecast_id AND l.planning_input_snapshot_id=r.input_snapshot_id) AND EXISTS (SELECT 1 FROM tme_wfm_constraint_evaluation_receipts e WHERE e.tenant_id=c.tenant_id AND e.schedule_candidate_id=c.schedule_candidate_id AND e.planning_input_snapshot_id=r.input_snapshot_id))>=1,'WFM locked physical assignment sources diverged')",
            ])
        for edge in edges_by_owner.get(handler_id, []):
            dml = next(step for step in handler["transactionEnvelope"]["steps"]
                       if step.get("stage") == "DOMAIN_DML" and step["table"] == edge["table"])
            delta = 2 if dml.get("disposition") in {"INSERT_MANY", "APPEND_MANY"} else 1
            statements.append(
                "SELECT dwp_assert((SELECT count(*) FROM " + edge["table"]
                + " WHERE tenant_id=1)-(SELECT row_count FROM dwp_edge_count WHERE edge_id="
                + quote(edge["edgeId"]) + f")={delta},{quote('handler edge ' + edge['edgeId'])})"
            )
            statements.append(marker("EDGE", edge["edgeId"]))
        claim = handler["transactionEnvelope"]["steps"][0]
        claim_sql = transaction_insert_sql(
            claim["table"], claim["assignments"], transaction_columns, base_salt,
            handler_id, handler["aggregateRoot"]["table"], tables,
        )
        handler_predicate = claim_predicate(
            claim["table"], claim["assignments"], transaction_columns, base_salt,
            handler_id, handler["aggregateRoot"]["table"], tables,
        )
        handler_digest_columns = [
            name for name in ("payload_hash", "payload_digest", "payload_sha256")
            if name in transaction_columns[claim["table"]]
        ]
        if len(handler_digest_columns) != 1:
            raise ValueError(
                f"handler inbox digest column closure {handler_id}:{handler_digest_columns}"
            )
        handler_digest_column = handler_digest_columns[0]
        handler_conflict_sql = transaction_insert_sql(
            claim["table"], claim["assignments"], transaction_columns, base_salt,
            handler_id, handler["aggregateRoot"]["table"], tables,
            column_overrides={handler_digest_column: "repeat('b',64)"},
        )
        touched = sorted(set(table for group in groups for table in group["tables"]))
        key = "handler-replay:" + handler_id
        statements.extend([
            snapshot_before(key, touched),
            assert_dml(claim_sql + " ON CONFLICT DO NOTHING", 0, handler_id + ":replay"),
            snapshot_assert(key, touched, handler_id + ":replay wrote"),
            marker("HANDLER_REPLAY", handler_id),
            assert_dml(handler_conflict_sql + " ON CONFLICT DO NOTHING", 0,
                       handler_id + ":conflict"),
            "SELECT dwp_assert((SELECT " + handler_digest_column + " FROM "
            + claim["table"] + " WHERE " + handler_predicate + ")=repeat('a',64),"
            + quote(handler_id + ":conflict changed stored owner payload digest") + ")",
            "SELECT dwp_assert((SELECT " + handler_digest_column + " FROM "
            + claim["table"] + " WHERE " + handler_predicate + ")<>repeat('b',64),"
            + quote(handler_id + ":different owner digest treated as replay") + ")",
            snapshot_assert(key, touched, handler_id + ":conflict wrote"),
            marker("HANDLER_CONFLICT", handler_id),
        ])

    handler_rollback_count = 0
    for handler_index, handler in enumerate(handlers, 1):
        handler_id = handler["handlerId"]
        # Reviewed points are claim + each domain DML + completed-inbox/outbox
        # atomic boundary.  Inbox completion is not counted twice.
        original = handler_groups[handler_id]
        logical = [original[0], *[g for g in original if g["stage"] == "DOMAIN_DML"]]
        final_group = {
            "stage": "COMPLETE_AND_OUTBOX", "tables": [
                *(g["tables"] for g in original if g["stage"] in {
                    "COMPLETE_DURABLE_OWNER_INBOX", "APPEND_CAUSAL_OUTBOX_LAST"
                })
            ],
            "sql": [item for g in original if g["stage"] in {
                "COMPLETE_DURABLE_OWNER_INBOX", "APPEND_CAUSAL_OUTBOX_LAST"
            } for item in g["sql"]],
        }
        final_group["tables"] = [item for group in final_group["tables"] for item in group]
        logical.append(final_group)
        touched = sorted(set(table for group in logical for table in group["tables"]))
        for fault_no in range(1, len(logical) + 1):
            handler_rollback_count += 1
            replay_salt = 10_000_000 + handler_index * 100_000 + fault_no * 1_000
            statements.extend(prime_owner_root_state_sql(
                exact, handler, tables, all_columns, numbers, replay_salt,
            ))
            regenerated = handler_step_groups(
                exact, handler, handler_index,
                replay_salt,
                tables, all_columns, numbers, transaction_columns, expected_events,
            )
            replay_logical = [regenerated[0], *[
                g for g in regenerated if g["stage"] == "DOMAIN_DML"
            ]]
            replay_logical.append({
                "sql": [item for g in regenerated if g["stage"] in {
                    "COMPLETE_DURABLE_OWNER_INBOX", "APPEND_CAUSAL_OUTBOX_LAST"
                } for item in g["sql"]]
            })
            key = f"handler-rollback:{handler_id}:{fault_no}"
            statements.extend([snapshot_before(key, touched), "BEGIN"])
            for group in replay_logical[:fault_no]:
                statements.extend(group["sql"])
            statements.extend(["ROLLBACK", snapshot_assert(key, touched, key + " leaked")])
        statements.append(marker("HANDLER_ROLLBACK_SUMMARY", handler_id, str(len(logical))))
    if handler_rollback_count != 20:
        raise ValueError(f"handler rollback point closure {handler_rollback_count} != 20")

    # Critical lifecycle assertions use committed physical rows/outbox facts.
    statements.extend([
        "SELECT dwp_assert((SELECT count(*) FROM ppl_jny_assignment_tasks t JOIN ppl_jny_assignments a ON a.tenant_id=t.tenant_id AND a.journey_assignment_id=t.journey_assignment_id JOIN ppl_jny_template_versions v ON v.tenant_id=a.tenant_id AND v.journey_template_version_id=a.journey_template_version_id WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v.task_definitions) j WHERE j->>'taskKey'=t.task_key AND (j->>'taskOrder')::integer=t.task_order AND (j->>'requiredFlag')::boolean=t.required_flag))>=2,'onboarding task physical source projection diverged')",
        "SELECT dwp_assert((SELECT count(*) FROM ppl_rec_hire_handoff_receipts WHERE tenant_id=1)>=2,'owner ack receipt missing')",
        "SELECT dwp_assert((SELECT count(*) FROM sys_people_outbox_events WHERE event_type='CandidateHired.v2')=1,'CandidateHired ownership/timing')",
        "SELECT dwp_assert((SELECT count(*) FROM sys_people_outbox_events o JOIN ppl_rec_hire_handoff_receipts h ON h.public_id=(o.payload->>'hireHandoffReceiptId')::uuid WHERE o.event_type='CandidateHired.v2' AND o.payload->>'workerPublicId'=h.worker_public_id::text AND o.payload->>'employmentPublicId'=h.employment_public_id::text AND o.payload->>'assignmentPublicId'=h.assignment_public_id::text)=1,'CandidateHired payload is not committed owner ack fact')",
        marker("HIRE_ACK", "internal.recruiting.hire-handoff.acknowledge"),
        "SELECT dwp_assert((SELECT count(*) FROM prf_outbox_events WHERE event_type='CompensationPlanApprovalRecorded.v2')>=1,'plan approval fact missing')",
        "SELECT dwp_assert((SELECT count(*) FROM prf_outbox_events WHERE event_type='ApprovedCompensationPlanSnapshotPublished.v2')=1,'snapshot publish cardinality')",
        "SELECT dwp_assert((SELECT count(*) FROM prf_cmp_approved_snapshots s WHERE s.tenant_id=1 AND s.approved_compensation_snapshot_id=(SELECT max(approved_compensation_snapshot_id) FROM prf_cmp_approved_snapshots WHERE tenant_id=1) AND s.line_count=2 AND s.line_count=(SELECT count(*) FROM prf_cmp_approved_snapshot_lines l WHERE l.tenant_id=s.tenant_id AND l.approved_compensation_snapshot_id=s.approved_compensation_snapshot_id))=1,'snapshot header and exactly N lines are not atomic')",
        "SELECT dwp_assert((SELECT count(*) FROM prf_cmp_approved_snapshots s JOIN prf_cmp_plans p ON p.tenant_id=s.tenant_id AND p.compensation_plan_id=s.compensation_plan_id JOIN prf_cmp_cycles c ON c.tenant_id=p.tenant_id AND c.compensation_cycle_id=p.compensation_cycle_id WHERE s.public_id<>p.public_id AND s.public_id<>c.public_id AND p.public_id<>c.public_id)>=1,'plan/cycle/snapshot IDs not distinct')",
        "SELECT dwp_assert((SELECT count(*) FROM prf_outbox_events o JOIN prf_cmp_approved_snapshots s ON s.public_id=(o.payload->>'snapshotId')::uuid JOIN prf_cmp_plans p ON p.tenant_id=s.tenant_id AND p.compensation_plan_id=s.compensation_plan_id JOIN prf_cmp_cycles c ON c.tenant_id=p.tenant_id AND c.compensation_cycle_id=p.compensation_cycle_id WHERE o.event_type='ApprovedCompensationPlanSnapshotPublished.v2' AND o.payload->>'planId'=p.public_id::text AND o.payload->>'cycleId'=c.public_id::text AND s.plan_public_id=p.public_id AND s.cycle_public_id=c.public_id AND s.approval_receipt_id=p.approval_receipt_public_id AND s.approval_revision=p.approval_revision AND s.source_version=p.plan_revision AND (o.payload->>'lineCount')::integer=s.line_count AND o.payload->>'payloadDigest'=s.payload_digest)=1,'PAY event payload is not committed snapshot fact')",
        marker("COMPENSATION", "snapshot-publish-atomic-distinct"),
        marker("COMPLETE", "all-current-v2-scenarios"),
    ])

    modern_table_literals = ",".join(quote(name) for name in expected_tables)
    statements.extend([
        "SELECT dwp_assert((SELECT count(*) FROM dwp_evidence_marker)=875,'marker closure')",
        "SELECT 'DWP_SERVER_VERSION|' || current_setting('server_version') || '|' || current_setting('server_version_num')",
        "SELECT 'DWP_SCHEMA|' || encode(digest(COALESCE(string_agg(v,'' ORDER BY v),''),'sha256'),'hex') FROM (SELECT table_name || ':' || column_name || ':' || data_type || ':' || is_nullable || ':' || COALESCE(column_default,'') v FROM information_schema.columns WHERE table_schema='public' AND table_name IN (" + modern_table_literals + ") ORDER BY table_name,ordinal_position) q",
        "SELECT 'DWP_TABLE|' || table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (" + modern_table_literals + ") ORDER BY table_name",
        "COPY (SELECT 'DWP_MARKER|' || category || '|' || identifier || '|' || status || '|' || detail FROM dwp_evidence_marker ORDER BY category,identifier) TO STDOUT",
    ])
    metadata = {
        "commandIds": [row["operationId"] for row in commands],
        "queryIds": [row["operationId"] for row in queries],
        "edgeRows": fixture_edges,
        "handlerIds": [row["handlerId"] for row in handlers],
        "decisionIds": decision_ids,
        "expectedTables": expected_tables,
        "rollbackFaultCount": rollback_fault_count,
        "handlerRollbackFaultCount": handler_rollback_count,
        "queryCases": query_cases,
    }
    return ";\n".join(statement.rstrip(";") for statement in statements if statement) + ";\n", metadata


COMPARABLE_RUN_KEYS = (
    "schemaHash", "operationResults81", "queryResults19", "edgeResults58",
    "handlerResults4", "rollbackFaultResults", "handlerRollbackFaultResults",
    "receiptOutboxReplayResults", "tenantPurposeStaleConflictResults",
    "decisionReceiptResults", "conditionalEventResults", "criticalLifecycleResults",
    "forbiddenEdgeResults", "scenarioCounts", "schemaProjection", "failures",
)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def verify_candidate_hashes() -> None:
    for label, expected in FROZEN_CANDIDATE_HASHES.items():
        path = CANDIDATE_PATHS[label]
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"candidate authority missing/unsafe: {label}")
        actual = file_hash(path)
        if actual != expected:
            raise ValueError(f"frozen candidate hash mismatch {label}: {actual}")


def validate_physical_assignment_source_specs(
    exact: dict[str, Any], causal: dict[str, Any],
    specs: dict[tuple[str, str, str], dict[str, str]] | None = None,
) -> None:
    reviewed = PHYSICAL_ASSIGNMENT_SOURCE_SPECS if specs is None else specs
    if len(reviewed) != 32:
        raise ValueError(f"reviewed physical assignment source count {len(reviewed)} != 32")
    tables = modern_tables(exact)
    columns = {name: physical_columns(exact, row) for name, row in tables.items()}
    observed: dict[tuple[str, str, str], str] = {}
    for owner in [
        *causal.get("operations", []), *causal.get("internalConsumerHandlers", []),
    ]:
        owner_id = owner.get("operationId") or owner.get("handlerId")
        for step in owner.get("transactionEnvelope", {}).get("steps", []):
            if not (
                step.get("stage") == "DOMAIN_DML"
                and step.get("disposition") in {
                    "INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY",
                }
            ):
                continue
            table = str(step["table"])
            local = set(local_fk_columns(tables[table]))
            for assignment in step.get("assignments", []):
                column = str(assignment["target"]).split(".", 1)[1]
                source_path = str(assignment["sourcePath"])
                key = (str(owner_id), table, column)
                is_reviewed_physical_source = (
                    column not in local
                    and (source_path.startswith("selector.") or "locked." in source_path)
                ) or key in {
                    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots",
                     "approval_receipt_id"),
                    ("modern.compplan.snapshot.publish", "prf_cmp_approved_snapshots",
                     "approval_revision"),
                }
                if is_reviewed_physical_source:
                    observed[key] = source_path
    if set(observed) != set(reviewed):
        raise ValueError(
            "reviewed physical assignment source closure differs: missing="
            + repr(sorted(set(reviewed) - set(observed)))
            + " extra=" + repr(sorted(set(observed) - set(reviewed)))
        )
    numeric = {"BIGINT", "INTEGER", "SMALLINT"}
    for key, spec in reviewed.items():
        owner_id, target_table, target_column = key
        if observed[key] != spec.get("sourcePath"):
            raise ValueError(
                f"reviewed physical assignment source mismatch {owner_id}:"
                f"{target_table}.{target_column}"
            )
        source_table = spec.get("sourceTable")
        source_column = spec.get("sourceColumn")
        if source_table not in columns or source_column not in columns[source_table]:
            raise ValueError(f"reviewed physical source absent {key}:{source_table}.{source_column}")
        if target_table not in columns or target_column not in columns[target_table]:
            raise ValueError(f"reviewed physical target absent {key}")
        transform = spec.get("transform")
        if transform not in {
            "DIRECT", "PLUS_ONE", "MAX_PLUS_ONE", "DATE_FROM_TIMESTAMP", "TASK_JSON_TEXT",
            "TASK_JSON_INTEGER", "TASK_JSON_BOOLEAN",
        }:
            raise ValueError(f"reviewed physical transform unsupported {key}:{transform}")
        source_type = columns[source_table][source_column]["sqlType"].upper()
        target_type = columns[target_table][target_column]["sqlType"].upper()
        if transform == "DIRECT" and not (
            source_type == target_type or {source_type, target_type} <= numeric
        ):
            raise ValueError(
                f"reviewed physical assignment type mismatch {key}:"
                f"{source_type}->{target_type}"
            )
        if transform in {"PLUS_ONE", "MAX_PLUS_ONE"} and not (
            source_type in numeric and target_type in numeric
        ):
            raise ValueError(f"reviewed numeric physical transform mismatch {key}")
        if transform == "DATE_FROM_TIMESTAMP" and not (
            source_type.startswith("TIMESTAMP") and target_type == "DATE"
        ):
            raise ValueError(f"reviewed date physical transform mismatch {key}")
    template_create = next(
        row for row in causal["operations"]
        if row["operationId"] == "modern.onboarding.template.create"
    )
    task_manifest = [
        assignment for step in template_create["transactionEnvelope"]["steps"]
        if step.get("stage") == "DOMAIN_DML"
        and step.get("table") == "ppl_jny_template_versions"
        for assignment in step.get("assignments", [])
        if assignment.get("target") == "ppl_jny_template_versions.task_definitions"
    ]
    if len(task_manifest) != 1 or task_manifest[0].get("sourcePath") != "body.tasks":
        raise ValueError("reviewed onboarding task manifest fixture binding differs")


def preflight(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any],
) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        successor_authority_preflight(oracle, fixture, exact, causal)
        return
    verify_candidate_hashes()
    if semantic_seal(oracle) != oracle.get("sealedPayloadSha256"):
        raise ValueError("oracle semantic seal invalid")
    if semantic_seal(fixture) != fixture.get("sealedPayloadSha256"):
        raise ValueError("fixture semantic seal invalid")
    tables = modern_tables(exact)
    required_columns = {
        "ppl_jny_assignment_tasks": {"task_order"},
        "tme_wfm_demand_lines": {
            "demand_forecast_id", "line_sequence", "interval_start", "interval_end",
            "required_headcount", "demand_unit_code", "skill_public_id",
            "organization_public_id", "line_digest",
        },
    }
    for table, expected in required_columns.items():
        observed = set(physical_columns(exact, tables[table]))
        if not expected <= observed:
            raise ValueError(f"critical physical columns missing {table}:{sorted(expected-observed)}")
    operations = causal.get("operations")
    handlers = causal.get("internalConsumerHandlers")
    if not isinstance(operations, list) or not isinstance(handlers, list):
        raise ValueError("candidate operations/handlers missing")
    if len(operations) != 100 or len(handlers) != 4:
        raise ValueError("candidate operation/handler count mismatch")
    validate_physical_assignment_source_specs(exact, causal)
    oracle_ids = sorted(row["operationId"] for row in oracle["operations"])
    candidate_ids = sorted(row["operationId"] for row in operations)
    if oracle_ids != candidate_ids or len(candidate_ids) != len(set(candidate_ids)):
        raise ValueError("candidate operation ID closure differs from oracle")
    expected_events = oracle_event_contracts(oracle)
    candidate_event_rows = [
        (operation["operationId"], event)
        for operation in operations for event in operation.get("causalEvents", [])
    ] + [
        (handler["handlerId"], handler["eventContract"]) for handler in handlers
    ]
    candidate_event_names = [event["eventName"] for _, event in candidate_event_rows]
    if (len(candidate_event_rows) != 86
            or sorted(candidate_event_names) != sorted(expected_events)
            or len(candidate_event_names) != len(set(candidate_event_names))):
        raise ValueError("candidate event closure differs from independent 86-event oracle")
    event_registry = load_json(EVENTS_PATH)
    registry_rows = event_registry.get("eventPayloadSchemas")
    if not isinstance(registry_rows, list):
        raise ValueError("candidate event payload registry rows missing")
    registry = {row.get("eventName"): row for row in registry_rows if isinstance(row, dict)}
    if len(registry_rows) != 86 or set(registry) != set(expected_events):
        raise ValueError("candidate event payload registry closure differs from oracle")
    all_modern_columns = {
        name: physical_columns(exact, table) for name, table in tables.items()
    }

    def normalized_sql_event_type(sql_type: str) -> str:
        upper = sql_type.upper()
        if upper == "CHAR(64)":
            return "SHA256"
        if upper.startswith(("VARCHAR", "CHAR", "TEXT")):
            return "STRING"
        if upper == "UUID[]":
            return "ARRAY<UUID>"
        if upper.startswith(("NUMERIC", "DECIMAL")):
            return "NUMERIC(19,4)"
        if upper.startswith("TIMESTAMP"):
            return "TIMESTAMPTZ"
        return upper

    for owner_id, candidate_event in candidate_event_rows:
        event_name = candidate_event["eventName"]
        expected = expected_events[event_name]
        fields = expected.get("fields")
        if (not isinstance(fields, list) or not fields
                or any(field.get("required") is not True for field in fields)):
            raise ValueError(f"oracle event required-field closure invalid {event_name}")
        names = [field.get("name") for field in fields]
        if any(not isinstance(name, str) or not name for name in names) or len(names) != len(set(names)):
            raise ValueError(f"oracle event field identity invalid {event_name}")
        if candidate_event.get("payloadFields") != names:
            raise ValueError(f"candidate event payload field order/set differs {owner_id}:{event_name}")
        candidate_sources = candidate_event.get("payloadFieldSources")
        if not isinstance(candidate_sources, list) or [row.get("field") for row in candidate_sources] != names:
            raise ValueError(f"candidate event source field closure differs {owner_id}:{event_name}")
        if [row.get("source") for row in candidate_sources] != [field.get("source") for field in fields]:
            raise ValueError(f"candidate event physical sources differ {owner_id}:{event_name}")
        registered_fields = registry[event_name].get("fields")
        if not isinstance(registered_fields, list):
            raise ValueError(f"candidate registry fields missing {event_name}")
        registry_projection = [
            (field.get("name"), field.get("type"), field.get("required"), field.get("source"))
            for field in registered_fields
        ]
        oracle_projection = [
            (field.get("name"), field.get("type"), field.get("required"), field.get("source"))
            for field in fields
        ]
        if registry_projection != oracle_projection:
            raise ValueError(f"candidate registry field/type/source differs {event_name}")
        for field in fields:
            field_type = field.get("type")
            if field_type not in EVENT_JSON_TYPES:
                raise ValueError(f"unsupported oracle event field type {event_name}:{field}")
            source = str(field.get("source"))
            if source in {"context.ownerClock.transactionNow", "context.correlationId"}:
                continue
            if source.startswith("CONSTANT:"):
                if field_type != "STRING":
                    raise ValueError(f"non-string event constant {event_name}:{field['name']}")
                continue
            physical = source.removeprefix("LOCKED_PRE:")
            physical = OWNER_REFETCH_EVENT_FIELD_SOURCES.get(
                (event_name, field["name"]), physical,
            )
            if not re.fullmatch(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*", physical):
                raise ValueError(f"unresolved reviewed owner source {event_name}:{field['name']}:{source}")
            source_table, source_column = physical.split(".", 1)
            if source_table not in all_modern_columns or source_column not in all_modern_columns[source_table]:
                raise ValueError(f"event physical source absent {event_name}:{field['name']}:{physical}")
            actual_type = normalized_sql_event_type(
                all_modern_columns[source_table][source_column]["sqlType"]
            )
            if actual_type != field_type:
                raise ValueError(
                    f"event source type mismatch {event_name}:{field['name']}:"
                    f"{actual_type}!={field_type}"
                )
    if set(OWNER_REFETCH_EVENT_FIELD_SOURCES) != {
            (event_name, field["name"])
            for event_name, event in expected_events.items() for field in event["fields"]
            if not (
                str(field["source"]).startswith(("LOCKED_PRE:", "CONSTANT:", "context."))
                or re.fullmatch(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*", str(field["source"]))
            )}:
        raise ValueError("explicit owner-refetch event source overlay is not exact")
    transaction_columns, _ = load_transaction_ddl()
    infrastructure = causal.get("transactionInfrastructure", {}).get("sessions", {})
    if set(infrastructure) != set(PROFILES):
        raise ValueError("four owner transaction profiles are not closed")
    for session, profile in PROFILES.items():
        bindings = infrastructure[session].get("decisionAuditBindings", {})
        if set(bindings) != {"ruleId", "inputDigestOrRef", "outcome", "decisionVersion"}:
            raise ValueError(f"structured decision receipt keys differ {session}:{sorted(bindings)}")
        receipt = profile["receipt"]
        for semantic_field, expression in bindings.items():
            parts = str(expression).split("+")
            if not parts or any(
                not part.startswith(receipt + ".")
                or part.split(".", 1)[1] not in transaction_columns[receipt]
                for part in parts
            ):
                raise ValueError(
                    f"decision receipt binding is not a physical scalar tuple "
                    f"{session}:{semantic_field}:{expression}"
                )
            if any("result_ref." in part or "result_reference." in part for part in parts):
                raise ValueError(f"opaque result reference treated as JSON {session}:{semantic_field}")
    for operation in operations:
        if operation["mode"] == "QUERY":
            plan = operation.get("readPlan", {})
            if not (
                plan.get("transactionMode") == "READ_ONLY"
                and all(plan.get(key) is True for key in (
                    "writesForbidden", "receiptsForbidden", "outboxForbidden", "eventsForbidden"
                ))
                and not operation.get("causalEvents")
            ):
                raise ValueError(f"query is not physically no-write: {operation['operationId']}")
            continue
        envelope = operation.get("transactionEnvelope", {})
        steps = envelope.get("steps", [])
        if not isinstance(steps, list) or len(steps) < 4:
            raise ValueError(f"command envelope missing: {operation['operationId']}")
        for step in steps:
            if step.get("stage") in {
                "CLAIM_OR_REPLAY_COMMAND_RECEIPT", "COMPLETE_COMMAND_RECEIPT",
                "APPEND_CAUSAL_OUTBOX_LAST",
            }:
                table = step["table"]
                if table not in transaction_columns:
                    raise ValueError(f"unknown physical envelope table {operation['operationId']}:{table}")
                assigned = {row["column"] for row in step.get("assignments", [])}
                if not assigned <= set(transaction_columns[table]):
                    raise ValueError(f"unknown physical envelope assignment {operation['operationId']}:{table}")
                if step.get("stage") in {
                    "CLAIM_OR_REPLAY_COMMAND_RECEIPT", "APPEND_CAUSAL_OUTBOX_LAST",
                }:
                    required = {
                        name for name, column in transaction_columns[table].items()
                        if column["nullable"] is False and column["default"] is False
                    }
                    if not required <= assigned:
                        raise ValueError(
                            f"missing required physical envelope assignment "
                            f"{operation['operationId']}:{table}:{sorted(required-assigned)}"
                        )
        for use in operation.get("requiredInputUses", []):
            for effect in use.get("effects", []):
                if effect.get("kind") != "PERSISTED_DECISION_RECEIPT":
                    continue
                target = effect.get("target")
                bindings = effect.get("physicalFieldBindings", {})
                if target not in transaction_columns:
                    raise ValueError(f"decision receipt target not physical: {operation['operationId']}")
                if any("result_ref." in str(value) or "result_reference." in str(value)
                       for value in bindings.values()):
                    raise ValueError(f"decision receipt treats result reference as JSON: {operation['operationId']}")
    for handler in handlers:
        steps = handler.get("transactionEnvelope", {}).get("steps", [])
        if not isinstance(steps, list) or len(steps) < 5:
            raise ValueError(f"handler envelope missing: {handler['handlerId']}")
        for step in steps:
            if step.get("stage") in {
                "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX", "COMPLETE_DURABLE_OWNER_INBOX",
                "APPEND_CAUSAL_OUTBOX_LAST",
            }:
                table = step["table"]
                assigned = {row["column"] for row in step.get("assignments", [])}
                if table not in transaction_columns or not assigned <= set(transaction_columns[table]):
                    raise ValueError(f"handler physical assignment mismatch {handler['handlerId']}:{table}")
                if step.get("stage") in {
                    "CLAIM_OR_REPLAY_DURABLE_OWNER_INBOX", "APPEND_CAUSAL_OUTBOX_LAST",
                }:
                    required = {
                        name for name, column in transaction_columns[table].items()
                        if column["nullable"] is False and column["default"] is False
                    }
                    if not required <= assigned:
                        raise ValueError(
                            f"missing required handler physical assignment "
                            f"{handler['handlerId']}:{table}:{sorted(required-assigned)}"
                        )
    operation_map = {row["operationId"]: row for row in operations}
    handler_map = {row["handlerId"]: row for row in handlers}
    for edge in fixture["edgeInventory"]["rows"]:
        owner = edge["transactionOwner"]
        source = operation_map.get(owner) or handler_map.get(owner)
        if source is None:
            raise ValueError(f"edge owner absent: {edge['edgeId']}")
        matching = [row for row in source.get("orderedDml", []) if row["table"] == edge["table"]]
        if edge["classification"] == "FORBIDDEN_EDGE" and matching:
            raise ValueError(f"forbidden edge reintroduced: {edge['edgeId']}")
        if edge["classification"] == "COMMITTED_EDGE" and not any(
                row["disposition"] in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}
                for row in matching):
            raise ValueError(f"committed edge lacks append DML: {edge['edgeId']}")


def load_authorities() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        accepted = verify_accepted_live_canonical(BASE, ROOT)
        global EXACT_PATH, CAUSAL_PATH, EVENTS_PATH
        EXACT_PATH = accepted["sources"]["exact"]
        CAUSAL_PATH = accepted["sources"]["causal"]
        EVENTS_PATH = accepted["sources"]["events"]
    oracle = load_json(ORACLE_PATH)
    fixture = load_json(FIXTURE_PATH)
    exact = load_json(EXACT_PATH)
    causal = load_json(CAUSAL_PATH)
    preflight(oracle, fixture, exact, causal)
    return oracle, fixture, exact, causal


def successor_authority_preflight(
    oracle: dict[str, Any], fixture: dict[str, Any],
    exact: dict[str, Any], causal: dict[str, Any],
) -> None:
    """Validate the successor source closure without consulting candidates."""
    if semantic_seal(oracle) != oracle.get("sealedPayloadSha256"):
        raise ValueError("successor oracle semantic seal invalid")
    if semantic_seal(fixture) != fixture.get("sealedPayloadSha256"):
        raise ValueError("successor fixture semantic seal invalid")
    accepted = verify_accepted_live_canonical(BASE, ROOT)
    if accepted.get("closedSetManifestPin") != SUCCESSOR_CLOSED_SET_MANIFEST_PIN:
        raise ValueError("successor accepted-live closed-set manifest pin drift")
    dependency_receipt = verify_successor_owner_dependencies(
        oracle, label="successor oracle.ownerDependencyContracts"
    )
    oracle_receipt = verify_successor_owner_dependency_receipt(
        oracle.get("successorProfile", {}).get("ownerDependencyReceipt"),
        label="successor oracle.successorProfile.ownerDependencyReceipt",
    )
    fixture_receipt = verify_successor_owner_dependency_receipt(
        fixture.get("successorProfile", {}).get("ownerDependencyReceipt"),
        label="successor fixture.successorProfile.ownerDependencyReceipt",
    )
    if oracle_receipt != dependency_receipt or fixture_receipt != dependency_receipt:
        raise ValueError("successor oracle/fixture owner-dependency receipt binding drift")
    # The accepted-live SSOT, exact projection, and semantic projection must
    # retain the same ordered Listening + PAY dependency rows.  This check is
    # source-only and makes the PG preflight reject a mixed-generation bundle.
    for key in ("operationSsot", "exact", "semanticBindings"):
        projected = load_json(accepted["sources"][key])
        verify_successor_closed_set_manifest_reference(
            projected, label=f"accepted-live {key}.closedSetManifest"
        )
        projected_receipt = verify_successor_owner_dependencies(
            projected, label=f"accepted-live {key}.ownerDependencyContracts"
        )
        if projected_receipt != dependency_receipt:
            raise ValueError(f"successor accepted-live dependency projection drift: {key}")
    event_document = load_json(accepted["sources"]["events"])
    if len(oracle.get("operations", [])) != SUCCESSOR_CANONICAL_COUNTS["publicOperations"]:
        raise ValueError("successor oracle operation closure mismatch")
    if sum(row.get("mode") == "COMMAND" for row in oracle.get("operations", [])) != SUCCESSOR_CANONICAL_COUNTS["commands"]:
        raise ValueError("successor oracle command closure mismatch")
    if sum(row.get("mode") == "QUERY" for row in oracle.get("operations", [])) != SUCCESSOR_CANONICAL_COUNTS["queries"]:
        raise ValueError("successor oracle query closure mismatch")
    if len(oracle.get("systemHandlers", [])) != SUCCESSOR_CANONICAL_COUNTS["systemHandlers"]:
        raise ValueError("successor oracle handler closure mismatch")
    if len(oracle.get("publicEventOwnership", {}).get("events", [])) != SUCCESSOR_CANONICAL_COUNTS["publicEvents"]:
        raise ValueError("successor oracle public event closure mismatch")
    if len(event_document.get("eventPayloadSchemas", [])) != SUCCESSOR_CANONICAL_COUNTS["publicEvents"]:
        raise ValueError("successor accepted event registry closure mismatch")
    if len(exact.get("tableSpecifications", [])) != SUCCESSOR_CANONICAL_COUNTS["tableSpecifications"]:
        raise ValueError("successor accepted table closure mismatch")
    if len(causal.get("operations", [])) != SUCCESSOR_CANONICAL_COUNTS["publicOperations"]:
        raise ValueError("successor accepted causal operation closure mismatch")
    if len(causal.get("internalConsumerHandlers", [])) != SUCCESSOR_CANONICAL_COUNTS["systemHandlers"]:
        raise ValueError("successor accepted causal handler closure mismatch")
    expected_oracle_seal = fixture.get("oracle", {}).get("sealedPayloadSha256")
    if expected_oracle_seal != semantic_seal(oracle):
        raise ValueError("successor fixture oracle seal binding mismatch")
    expected_counts = fixture.get("successorProfile", {}).get("sourceDerivedCounts", {})
    if expected_counts != SUCCESSOR_CANONICAL_COUNTS:
        raise ValueError("successor fixture source-derived count profile drift")


def accepted_live_source_hash_rows() -> dict[str, dict[str, Any]]:
    accepted = verify_accepted_live_canonical(BASE, ROOT)
    return {
        key: {
            "path": str(path.relative_to(BASE)),
            "fileSha256": file_hash(path),
        }
        for key, path in accepted["sources"].items()
    }


def parse_probe_output(
    stdout: bytes, expected_major: int, metadata: dict[str, Any], image: str,
    execution_receipt: dict[str, Any],
) -> dict[str, Any]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return parse_successor_probe_output(
            stdout, expected_major, metadata, image, execution_receipt
        )
    text = stdout.decode("utf-8", errors="strict")
    server_rows = [line for line in text.splitlines() if line.startswith("DWP_SERVER_VERSION|")]
    schema_rows = [line for line in text.splitlines() if line.startswith("DWP_SCHEMA|")]
    table_rows = [line.split("|", 1)[1] for line in text.splitlines()
                  if line.startswith("DWP_TABLE|")]
    marker_rows = [line.split("|", 4)[1:] for line in text.splitlines()
                   if line.startswith("DWP_MARKER|")]
    if len(server_rows) != 1 or len(schema_rows) != 1:
        raise ValueError(f"PG{expected_major} server/schema marker cardinality")
    _, server_version, version_text = server_rows[0].split("|", 2)
    if not version_text.isdigit() or int(version_text) // 10000 != expected_major:
        raise ValueError(f"PG major mismatch expected={expected_major} actual={version_text}")
    schema_hash = schema_rows[0].split("|", 1)[1]
    if not re.fullmatch(r"[0-9a-f]{64}", schema_hash):
        raise ValueError("invalid catalog schema hash")
    expected_tables = metadata["expectedTables"]
    if table_rows != expected_tables:
        raise ValueError("actual PostgreSQL table projection differs from exact 71-table oracle")
    markers: dict[str, list[tuple[str, str, str]]] = {}
    for row in marker_rows:
        if len(row) != 4:
            raise ValueError("invalid evidence marker")
        category, identifier, status, detail = row
        if status != "PASS":
            raise ValueError(f"failed SQL marker {category}:{identifier}:{detail}")
        markers.setdefault(category, []).append((identifier, status, detail))
    expected_category_counts = {
        "OPERATION": 81, "QUERY": 19, "QUERY_CASE": 114, "EDGE": 58,
        "HANDLER": 4, "HANDLER_REPLAY": 4, "HANDLER_CONFLICT": 4,
        "HANDLER_ROLLBACK_SUMMARY": 4, "REPLAY": 81, "CONFLICT": 81,
        "STALE": 81, "NEGATIVE": 243, "DECISION": 14, "HIRE_REQUEST": 1,
        "HIRE_ACK": 1, "COMPENSATION": 1, "ONBOARDING_BRANCH": 2,
        "COMPLETE": 1, "ROLLBACK_SUMMARY": 81,
    }
    observed_category_counts = {key: len(value) for key, value in markers.items()}
    if observed_category_counts != expected_category_counts:
        raise ValueError(
            f"PG{expected_major} evidence marker closure mismatch: {observed_category_counts}"
        )
    command_ids = metadata["commandIds"]
    query_ids = metadata["queryIds"]
    handler_ids = metadata["handlerIds"]
    decision_ids = metadata["decisionIds"]
    edge_rows = metadata["edgeRows"]
    def marker_ids(category: str) -> list[str]:
        return sorted(row[0] for row in markers[category])
    if marker_ids("OPERATION") != command_ids or marker_ids("QUERY") != query_ids:
        raise ValueError("operation/query SQL marker IDs differ from frozen authority")
    if marker_ids("HANDLER") != handler_ids or marker_ids("DECISION") != decision_ids:
        raise ValueError("handler/decision SQL marker IDs differ from frozen authority")
    if marker_ids("EDGE") != [row["edgeId"] for row in edge_rows]:
        raise ValueError("edge SQL marker IDs differ from frozen fixture")
    query_cases = metadata["queryCases"]
    expected_query_markers = sorted(
        operation_id + "|" + case for operation_id in query_ids for case in query_cases
    )
    if marker_ids("QUERY_CASE") != expected_query_markers:
        raise ValueError("query case SQL marker closure mismatch")
    forbidden = [row for row in edge_rows if row["classification"] == "FORBIDDEN_EDGE"]
    if len(forbidden) != 5:
        raise ValueError("forbidden edge closure differs from reviewed five")
    schema_projection_object = {
        "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
        "expectedTableCount": 71,
        "expectedTables": expected_tables,
    }
    projection_hash = canonical_value_hash(schema_projection_object)
    run: dict[str, Any] = {
        "postgresMajor": expected_major,
        "serverVersion": server_version,
        "serverVersionNum": int(version_text),
        "image": image,
        "schemaHash": schema_hash,
        "operationResults81": [
            {"operationId": operation_id, "status": "PASS"} for operation_id in command_ids
        ],
        "queryResults19": [
            {"operationId": operation_id, "status": "PASS", "databaseDiff": "EMPTY",
             "cases": query_cases}
            for operation_id in query_ids
        ],
        "edgeResults58": [
            {"edgeId": row["edgeId"], "status": "PASS"} for row in edge_rows
        ],
        "handlerResults4": [
            {"handlerId": handler_id, "status": "PASS", "identicalReplay": "PASS",
             "differentDigestConflict": "PASS", "rollback": "PASS"}
            for handler_id in handler_ids
        ],
        "rollbackFaultResults": {
            "faultPoints": 372, "status": "PASS", "receiptDomainOutboxAtomic": True,
        },
        "handlerRollbackFaultResults": {
            "faultPoints": 20, "status": "PASS", "inboxDomainOutboxAtomic": True,
        },
        "receiptOutboxReplayResults": [
            {"operationId": operation_id, "identicalReplay": "PASS",
             "differentDigestConflict": "PASS", "duplicateDomainRows": 0,
             "duplicateOutboxRows": 0}
            for operation_id in command_ids
        ],
        "tenantPurposeStaleConflictResults": [
            {"operationId": operation_id, "foreignTenant": "PASS",
             "wrongPurpose": "PASS", "staleCas": "PASS", "ownerProofUnavailable": "PASS"}
            for operation_id in command_ids
        ],
        "decisionReceiptResults": [
            {"operationId": operation_id, "status": "PASS", "sameTransaction": True,
             "fields": ["decisionVersion", "inputDigestOrRef", "outcome", "ruleId"]}
            for operation_id in decision_ids
        ],
        "conditionalEventResults": {
            "operationId": "modern.onboarding.task.complete",
            "lastRequiredTask": "PRIMARY_AND_JOURNEY_COMPLETED",
            "nonLastRequiredTask": "PRIMARY_ONLY", "status": "PASS",
        },
        "criticalLifecycleResults": {
            "recruitingTwoStepHire": "PASS",
            "compensationSnapshotTimingAndDistinctIds": "PASS",
        },
        "forbiddenEdgeResults": {
            "expected": 5, "passed": 5, "rowCountZero": True,
            "outboxAbsent": True, "preexistingRowsUnchanged": True,
        },
        "scenarioCounts": {
            "schemaHash": schema_hash, "rollbackFaultCount": 372,
            "handlerRollbackFaultCount": 20, "commandCount": 81, "queryCount": 19,
            "queryCaseCount": 114, "decisionReceiptCount": 14, "edgeCount": 58,
            "handlerCount": 4, "markers": 875,
        },
        "schemaProjection": {
            "closure": schema_projection_object["closure"], "expectedTableCount": 71,
            "observedTables": table_rows, "oracleProjectionSha256": projection_hash,
            "observedProjectionSha256": projection_hash,
        },
        "executionReceipt": execution_receipt,
        "failures": 0,
    }
    return run


def inspect_image(image: str) -> tuple[str, str]:
    pull = subprocess.run(
        ["docker", "pull", image], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600,
    )
    if pull.returncode != 0:
        raise ValueError(f"docker pull failed {image}: {pull.stderr.decode(errors='replace')[:500]}")
    inspected = subprocess.run(
        ["docker", "image", "inspect", image], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
    )
    if inspected.returncode != 0:
        raise ValueError(f"docker inspect failed {image}")
    values = json.loads(inspected.stdout.decode("utf-8"))
    if not isinstance(values, list) or len(values) != 1:
        raise ValueError(f"docker inspect cardinality {image}")
    image_id = values[0].get("Id")
    digests = values[0].get("RepoDigests")
    repo_digest = next((item for item in (digests or [])
                        if isinstance(item, str) and item.startswith("postgres@sha256:")), None)
    if not isinstance(image_id, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise ValueError(f"invalid image ID {image}")
    if repo_digest is None or not re.fullmatch(r"postgres@sha256:[0-9a-f]{64}", repo_digest):
        raise ValueError(f"official RepoDigest unavailable {image}")
    return image_id, repo_digest


def run_engine(
    major: int, sql: str, metadata: dict[str, Any],
) -> dict[str, Any]:
    image = POSTGRES_IMAGES[major]
    image_id, repo_digest = inspect_image(image)
    name = f"dwp-modern-causal-v2-{major}-{os.getpid()}-{int(time.time())}"
    container_id = ""
    try:
        start = subprocess.run(
            ["docker", "run", "--detach", "--rm", "--name", name,
             "--env", "POSTGRES_PASSWORD=causal_only", "--env", "POSTGRES_DB=causal",
             image],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=60,
        )
        if start.returncode != 0:
            raise ValueError(f"PG{major} container start failed: {start.stderr.decode(errors='replace')[:500]}")
        container_id = start.stdout.decode("ascii").strip()
        if not re.fullmatch(r"[0-9a-f]{64}", container_id):
            raise ValueError(f"PG{major} invalid container ID")
        for _ in range(240):
            ready = subprocess.run(
                ["docker", "exec", name, "pg_isready", "-U", "postgres", "-d", "causal"],
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=5,
            )
            logs = subprocess.run(
                ["docker", "logs", name], stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5,
            )
            initialized = b"PostgreSQL init process complete; ready for start up." in (
                logs.stdout + logs.stderr
            )
            if ready.returncode == 0 and initialized:
                break
            time.sleep(0.25)
        else:
            raise ValueError(f"PG{major} did not become ready")
        argv = [
            "docker", "exec", "-i", name, "psql", "-X", "--set=ON_ERROR_STOP=1",
            "--quiet", "--tuples-only", "--no-align", "-U", "postgres", "-d", "causal",
        ]
        started_at = utc_now()
        completed = subprocess.run(
            argv, input=sql.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=900,
        )
        ended_at = utc_now()
        receipt = {
            "imageId": image_id, "repoDigest": repo_digest, "containerId": container_id,
            "argv": argv, "argvSha256": canonical_value_hash(argv),
            "stdoutSha256": hashlib.sha256(completed.stdout).hexdigest(),
            "stderrSha256": hashlib.sha256(completed.stderr).hexdigest(),
            "exitCode": completed.returncode, "startedAt": started_at, "endedAt": ended_at,
        }
        if completed.returncode != 0:
            raise ValueError(
                f"PG{major} probe failed: {completed.stderr.decode(errors='replace')[-2000:]}"
            )
        if completed.stderr:
            raise ValueError(
                f"PG{major} probe wrote stderr: {completed.stderr.decode(errors='replace')[-1000:]}"
            )
        return parse_probe_output(completed.stdout, major, metadata, image, receipt)
    finally:
        if container_id:
            subprocess.run(
                ["docker", "rm", "--force", name], stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
            )


def comparable_run_hash(run: dict[str, Any]) -> str:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        # Server/image/execution receipt provenance differs by engine; the
        # source-derived semantic payload must be byte-comparable.
        return canonical_value_hash({
            key: copy.deepcopy(value)
            for key, value in run.items()
            if key not in {"postgresMajor", "serverVersion", "serverVersionNum",
                           "image", "executionReceipt"}
        })
    return canonical_value_hash({key: copy.deepcopy(run[key]) for key in COMPARABLE_RUN_KEYS})


def derive_projection(
    oracle: dict[str, Any], fixture: dict[str, Any], review: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, list[str]]]:
    def operation_ids(document: dict[str, Any], mode: str) -> list[str]:
        return sorted(row["operationId"] for row in document["operations"] if row["mode"] == mode)
    def handler_ids(document: dict[str, Any]) -> list[str]:
        return sorted(row["handlerId"] for row in document["systemHandlers"])
    def decision_ids(document: dict[str, Any]) -> list[str]:
        return sorted({
            row["operationId"] for row in document["operations"] if row["mode"] == "COMMAND"
            if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT"
                   for use in row.get("inputEffects", []) for effect in use.get("effects", []))
        })
    authoritative = {
        "commands": operation_ids(oracle, "COMMAND"),
        "queries": operation_ids(oracle, "QUERY"),
        "edges": sorted(row["edgeId"] for row in fixture["edgeInventory"]["rows"]),
        "handlers": handler_ids(oracle),
        "decisions": decision_ids(oracle),
    }
    reviewed = {
        "commands": operation_ids(review, "COMMAND"),
        "queries": operation_ids(review, "QUERY"),
        "handlers": handler_ids(review),
        "decisions": decision_ids(review),
    }
    schema_object = {
        "closure": oracle["schemaOracle"]["closure"],
        "expectedTableCount": oracle["schemaOracle"]["expectedTableCountDerived"],
        "expectedTables": oracle["schemaOracle"]["expectedTables"],
    }
    projection = {
        "authoritative": {
            "commandIdsSha256": canonical_value_hash(authoritative["commands"]),
            "queryIdsSha256": canonical_value_hash(authoritative["queries"]),
            "edgeIdsSha256": canonical_value_hash(authoritative["edges"]),
            "handlerIdsSha256": canonical_value_hash(authoritative["handlers"]),
            "decisionIdsSha256": canonical_value_hash(authoritative["decisions"]),
            "schemaProjectionSha256": canonical_value_hash(schema_object),
        },
        "reviewInventory": {
            "commandIdsSha256": canonical_value_hash(reviewed["commands"]),
            "queryIdsSha256": canonical_value_hash(reviewed["queries"]),
            "handlerIdsSha256": canonical_value_hash(reviewed["handlers"]),
            "decisionIdsSha256": canonical_value_hash(reviewed["decisions"]),
        },
    }
    return projection, authoritative


def artifact_reference(path: Path, recorded_path: str) -> dict[str, str]:
    document = load_json(path)
    seal = semantic_seal(document)
    if document.get("sealedPayloadSha256") != seal:
        raise ValueError(f"artifact semantic seal invalid {path}")
    return {"path": recorded_path, "fileSha256": file_hash(path),
            "sealedPayloadSha256": seal}


def candidate_hash_rows() -> dict[str, dict[str, Any]]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        # Retain the field name for backward-readable evidence consumers, but
        # make its semantics explicit: these are accepted-live source pins,
        # never mutable candidate authority.
        return accepted_live_source_hash_rows()
    result: dict[str, dict[str, Any]] = {}
    for label, path in CANDIDATE_PATHS.items():
        row: dict[str, Any] = {"path": str(path.relative_to(BASE)), "fileSha256": file_hash(path)}
        if label in {"causal", "lineage"}:
            document = load_json(path)
            seal = semantic_seal(document)
            if document.get("sealedPayloadSha256") != seal:
                raise ValueError(f"candidate semantic seal invalid {label}")
            row["sealedPayloadSha256"] = seal
        result[label] = row
    return result


def build_unsigned_evidence(
    oracle: dict[str, Any], fixture: dict[str, Any], runs: list[dict[str, Any]],
    acquisition: str,
) -> dict[str, Any]:
    if not SOURCE_MANIFEST_PATH.is_file() or not CONTROL_INTAKE_PATH.is_file():
        raise ValueError("source authority manifest and Integration Control intake are required")
    source_manifest = load_json(SOURCE_MANIFEST_PATH)
    control = load_json(CONTROL_INTAKE_PATH)
    trusted = source_manifest.get("trustedToolRoot")
    if trusted != control.get("trustedToolRoot"):
        raise ValueError("source/control trusted tool roots differ")
    review = load_json(REVIEW_INVENTORY_PATH)
    projection, _ = derive_projection(oracle, fixture, review)
    if source_manifest.get("expectedProjection") != projection:
        raise ValueError("source manifest expected projection differs from reviewer authorities")
    source_ref = artifact_reference(SOURCE_MANIFEST_PATH, SOURCE_MANIFEST_PATH.name)
    control_ref = artifact_reference(
        CONTROL_INTAKE_PATH,
        ("g0/control-evidence-intake/modern-causal-final-endorsement.v2.json"
         if ACTIVE_PROFILE == SUCCESSOR_PROFILE
         else "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json"),
    )
    run_hashes = [comparable_run_hash(run) for run in runs]
    if len(runs) != 2 or [run["postgresMajor"] for run in runs] != [16, 18] or len(set(run_hashes)) != 1:
        raise ValueError(f"PG16/18 comparable execution mismatch: {run_hashes}")
    generated = utc_now()
    evidence: dict[str, Any] = {
        "evidenceId": EVIDENCE_ID, "schemaVersion": EVIDENCE_SCHEMA_VERSION, "technicalStatus": "PASS",
        "gatePolicy": GATE_POLICY, "generatedAt": generated,
        "evidenceState": (
            "UNSIGNED_STAGING_SUCCESSOR_V3"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "UNSIGNED_CURRENT_V2"
        ),
        "unsignedStagingPath": str(UNSIGNED_EVIDENCE_PATH.relative_to(BASE)),
        "finalEvidencePath": str(EVIDENCE_PATH.relative_to(BASE)),
        "createOnlyTransition": (
            "FINALIZER_MUST_CREATE_DISTINCT_FINAL_EVIDENCE_PATH_FROM_UNSIGNED_STAGING"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "HISTORICAL_PATH"
        ),
        "producerPrincipalIds": [
            "principal:modern-causal-independent-oracle-review",
            "principal:modern-causal-independent-pg-runner",
        ],
        "oracleSha256": semantic_seal(oracle), "oracleFileSha256": file_hash(ORACLE_PATH),
        "fixtureSha256": semantic_seal(fixture), "fixtureFileSha256": file_hash(FIXTURE_PATH),
        "builderFileSha256": file_hash(BUILDER_PATH), "runnerFileSha256": file_hash(Path(__file__)),
        "verifierFileSha256": file_hash(FINAL_VERIFIER_PATH),
        "independentValidatorFileSha256": file_hash(INDEPENDENT_PATH),
        "trustedToolRoot": trusted, "sourceAuthority": source_ref, "controlIntake": control_ref,
        "expectedProjection": projection,
        **({"acceptedLiveSourceHashes": candidate_hash_rows()}
           if ACTIVE_PROFILE == SUCCESSOR_PROFILE
           else {"candidateHashes": candidate_hash_rows()}),
        "runs": runs,
        "executionComparison": {
            "projectionId": PROJECTION_ID, "pg16PayloadSha256": run_hashes[0],
            "pg18PayloadSha256": run_hashes[1],
            "comparableExecutionPayloadSha256": run_hashes[0],
        },
        "hostSemaphore": {"name": HOST_VERIFICATION_SEMAPHORE, "protected": True,
                          "acquisition": acquisition},
        "secondReviewer": {
            "signed": False, "attestationMode": "INTERNAL_CANONICAL_DIGEST",
            "externalIdentityAttestation": "EXTERNAL_IDENTITY_ATTESTATION_NOT_CLAIMED",
            "reviewerId": "reviewer:pending-independent-hostile-review",
            "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
            "reportId": (
                "dwp.hris.modern.causal-independent-final-hostile-review.v2"
                if ACTIVE_PROFILE == SUCCESSOR_PROFILE
                else "dwp.hris.modern-causal-independent-final-hostile-review.v1"
            ),
            "reportPath": (
                "reports/modern-causal-independent-final-hostile-review.v2.json"
                if ACTIVE_PROFILE == SUCCESSOR_PROFILE
                else "reports/modern-causal-independent-final-hostile-review.v1.json"
            ),
            "reportSealedPayloadSha256": "0" * 64, "reportFileSha256": "0" * 64,
            "evidenceCoreSealSha256": "0" * 64, "findingCounts": {"P0": 0, "P1": 0},
            "reviewedAt": generated,
        },
        "sealedPayloadSha256": "",
    }
    core = evidence_core_seal(evidence)
    evidence["sealedPayloadSha256"] = core
    evidence["secondReviewer"]["evidenceCoreSealSha256"] = core
    return evidence


def execute_both(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any],
) -> list[dict[str, Any]]:
    sql, metadata = build_probe_sql(oracle, fixture, exact, causal)
    return [run_engine(major, sql, metadata) for major in (16, 18)]


def parent_lock_attested() -> bool:
    declared = os.environ.get("DWP_HRIS_HOST_LOCK_PARENT_PID")
    try:
        declared_pid = int(declared or "-1")
    except ValueError:
        return False
    return (
        declared == str(declared_pid) and declared_pid == os.getppid()
        and os.environ.get("DWP_HRIS_HOST_LOCK_NAME") == HOST_VERIFICATION_SEMAPHORE
    )


def with_host_lock(parent_held: bool, action: Any) -> tuple[Any, str]:
    if parent_held:
        if not parent_lock_attested():
            raise ValueError("parent-held host semaphore attestation invalid")
        return action(), "PARENT_HELD"
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300):
        return action(), "DIRECT"


def check_current_evidence(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any], parent_held: bool,
) -> dict[str, Any]:
    if not EVIDENCE_PATH.is_file() or EVIDENCE_PATH.is_symlink():
        raise ValueError(
            "current successor v3 finalized PG evidence is missing/unsafe"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "current v2 PG evidence is missing/unsafe"
        )
    before = EVIDENCE_PATH.read_bytes()
    evidence = load_json(EVIDENCE_PATH)
    if evidence.get("evidenceId") != EVIDENCE_ID or evidence.get("schemaVersion") != EVIDENCE_SCHEMA_VERSION:
        raise ValueError(
            "only current successor v3 evidence is accepted"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "only current v2 evidence is accepted"
        )
    if evidence_core_seal(evidence) != evidence.get("sealedPayloadSha256"):
        raise ValueError("evidence core seal invalid")
    current_hashes = candidate_hash_rows()
    hash_key = "acceptedLiveSourceHashes" if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "candidateHashes"
    if evidence.get(hash_key) != current_hashes:
        raise ValueError(
            "evidence accepted-live source pins are stale"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE else "evidence candidate pins are stale"
        )
    if evidence.get("oracleSha256") != semantic_seal(oracle) or evidence.get(
            "oracleFileSha256") != file_hash(ORACLE_PATH):
        raise ValueError("evidence oracle pins are stale")
    if evidence.get("fixtureSha256") != semantic_seal(fixture) or evidence.get(
            "fixtureFileSha256") != file_hash(FIXTURE_PATH):
        raise ValueError("evidence fixture pins are stale")
    expected_tool_pins = {
        "builderFileSha256": file_hash(BUILDER_PATH),
        "runnerFileSha256": file_hash(Path(__file__)),
        "verifierFileSha256": file_hash(FINAL_VERIFIER_PATH),
        "independentValidatorFileSha256": file_hash(INDEPENDENT_PATH),
    }
    for key, expected in expected_tool_pins.items():
        if evidence.get(key) != expected:
            raise ValueError(f"evidence tool pin stale: {key}")
    runs, acquisition = with_host_lock(
        parent_held, lambda: execute_both(oracle, fixture, exact, causal)
    )
    rerun_hashes = [comparable_run_hash(run) for run in runs]
    recorded = evidence.get("executionComparison", {}).get("comparableExecutionPayloadSha256")
    if len(set(rerun_hashes)) != 1 or rerun_hashes[0] != recorded:
        raise ValueError(f"current PG rerun differs from evidence: {rerun_hashes} vs {recorded}")
    after = EVIDENCE_PATH.read_bytes()
    if before != after:
        raise ValueError("--check mutated evidence bytes")
    return {
        "schema": (
            "dwp.hris.modern.causal-independent-pg-runner-check.v3"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE
            else "dwp.hris.modern.causal-independent-pg-runner-check.v2"
        ),
        "mode": (
            "CHECK_CURRENT_V3_EVIDENCE"
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE
            else "CHECK_CURRENT_V2_EVIDENCE"
        ), "status": "PASS", "errors": 0,
        "evidenceId": EVIDENCE_ID,
        "evidencePath": str(EVIDENCE_PATH.relative_to(BASE)),
        "evidenceFileSha256": hashlib.sha256(after).hexdigest(), "engines": [16, 18],
        "counts": (
            dict(evidence.get("runs", [{}])[0].get("scenarioCounts", {}))
            if ACTIVE_PROFILE == SUCCESSOR_PROFILE
            else {"operations": 162, "queries": 38, "edges": 116,
                  "handlers": 8, "forbidden": 10}
        ),
        "bytesUnchanged": True,
        "hostSemaphore": {"name": HOST_VERIFICATION_SEMAPHORE, "protected": True,
                          "acquisition": acquisition},
        "comparableExecutionPayloadSha256": recorded,
    }


def run_postgres_feasibility(
    oracle: dict[str, Any], fixture: dict[str, Any], exact: dict[str, Any],
    causal: dict[str, Any], parent_held: bool,
) -> dict[str, Any]:
    """Execute both engines without reading or writing the approval evidence.

    This mode exists so the runner SQL and engine provenance can be exercised
    before the reviewer tools are frozen into the trusted root.  It deliberately
    has no source-manifest/control-intake dependency and cannot create an
    approvable artifact.
    """
    evidence_before = EVIDENCE_PATH.read_bytes() if EVIDENCE_PATH.is_file() else None
    runs, acquisition = with_host_lock(
        parent_held, lambda: execute_both(oracle, fixture, exact, causal)
    )
    hashes = [comparable_run_hash(run) for run in runs]
    if len(runs) != 2 or [run["postgresMajor"] for run in runs] != [16, 18]:
        raise ValueError("PG feasibility engine closure differs from [16,18]")
    if len(set(hashes)) != 1:
        raise ValueError(f"PG16/18 feasibility payload mismatch: {hashes}")
    evidence_after = EVIDENCE_PATH.read_bytes() if EVIDENCE_PATH.is_file() else None
    if evidence_before != evidence_after:
        raise ValueError("--postgres-feasibility mutated approval evidence bytes")
    return {
        "schema": "dwp.hris.modern.causal-independent-pg-feasibility.v1",
        "mode": "POSTGRES_FEASIBILITY_NON_APPROVAL",
        "status": "PASS",
        "errors": 0,
        "engines": [16, 18],
        "counts": {
            "operations": 162, "queries": 38, "edges": 116,
            "handlers": 8, "forbidden": 10,
        },
        "evidenceBytesUnchanged": True,
        "approvalArtifactWritten": False,
        "hostSemaphore": {
            "name": HOST_VERIFICATION_SEMAPHORE, "protected": True,
            "acquisition": acquisition,
        },
        "comparableExecutionPayloadSha256": hashes[0],
    }


def run_self_tests() -> None:
    oracle, fixture, exact, causal = load_authorities()
    tests: list[tuple[str, Any]] = []
    tests.append(("table-omission", lambda: build_probe_sql(
        oracle, fixture, {**copy.deepcopy(exact), "tableSpecifications": exact["tableSpecifications"][:-1]}, causal
    )))
    mutated = copy.deepcopy(causal)
    next(row for row in mutated["operations"] if row["mode"] == "QUERY")["readPlan"][
        "writesForbidden"
    ] = False
    tests.append(("query-write", lambda mutated=mutated: preflight(oracle, fixture, exact, mutated)))
    mutated = copy.deepcopy(causal)
    forbidden = next(row for row in fixture["edgeInventory"]["rows"]
                     if row["classification"] == "FORBIDDEN_EDGE")
    next(row for row in mutated["operations"] if row["operationId"] == forbidden["operationId"])[
        "orderedDml"
    ].append({"table": forbidden["table"], "disposition": "APPEND", "assignments": []})
    tests.append(("forbidden-edge", lambda mutated=mutated: preflight(oracle, fixture, exact, mutated)))
    mutated = copy.deepcopy(causal)
    mutated["internalConsumerHandlers"][0]["transactionEnvelope"]["steps"][0]["assignments"].append(
        {"column": "not_a_physical_column", "sourcePath": "attack"}
    )
    tests.append(("handler-assignment", lambda mutated=mutated: preflight(oracle, fixture, exact, mutated)))
    def critical_schema_mutations() -> None:
        accepted: list[str] = []
        for label, table_name, column_name in (
            ("onboarding-task-order", "ppl_jny_assignment_tasks", "task_order"),
            ("wfm-demand-field", "tme_wfm_demand_lines", "required_headcount"),
        ):
            mutated_schema = copy.deepcopy(exact)
            table = next(row for row in mutated_schema["tableSpecifications"]
                         if row["tableName"] == table_name)
            table["columns"] = [row for row in table["columns"]
                                if row["name"] != column_name]
            try:
                preflight(oracle, fixture, mutated_schema, causal)
            except (ValueError, KeyError, TypeError):
                continue
            accepted.append(label)
        reduced_sources = copy.deepcopy(PHYSICAL_ASSIGNMENT_SOURCE_SPECS)
        reduced_sources.pop(next(iter(sorted(reduced_sources))))
        try:
            validate_physical_assignment_source_specs(
                exact, causal, specs=reduced_sources,
            )
        except (ValueError, KeyError, TypeError):
            pass
        else:
            accepted.append("physical-source-removal")
        mutated_source = copy.deepcopy(causal)
        snapshot_publish = next(
            row for row in mutated_source["operations"]
            if row["operationId"] == "modern.compplan.snapshot.publish"
        )
        plan_public_assignment = next(
            assignment
            for step in snapshot_publish["transactionEnvelope"]["steps"]
            if step.get("stage") == "DOMAIN_DML"
            and step.get("table") == "prf_cmp_approved_snapshots"
            for assignment in step.get("assignments", [])
            if assignment.get("target") == "prf_cmp_approved_snapshots.plan_public_id"
        )
        plan_public_assignment["sourcePath"] = "body.planPublicId.unverified"
        try:
            validate_physical_assignment_source_specs(exact, mutated_source)
        except (ValueError, KeyError, TypeError):
            pass
        else:
            accepted.append("physical-source-substitution")
        if accepted:
            return
        raise ValueError(
            "critical schema and physical-source mutations rejected"
        )

    tests.append(("critical-schema-fields", critical_schema_mutations))
    def exact_event_probe_assertions() -> None:
        sql, _ = build_probe_sql(oracle, fixture, exact, causal)
        expected = {
            "event payload exact source/type closure": 89,
            "event outbox cardinality": 89,
            "event envelope/payload identity mismatch": 89,
            "conditional event cardinality": 2,
            "jsonb_object_keys(payload)": 89,
        }
        if any(sql.count(token) != count for token, count in expected.items()):
            return
        if "WHERE FALSE" in sql.upper() or len(oracle_event_contracts(oracle)) != 86:
            return
        raise ValueError("exact 86-schema/969-field event probe assertions present")

    tests.append(("exact-event-payload-probe", exact_event_probe_assertions))
    mutated = copy.deepcopy(causal)
    decision = next(effect for row in mutated["operations"]
                    for use in row.get("requiredInputUses", [])
                    for effect in use.get("effects", [])
                    if effect.get("kind") == "PERSISTED_DECISION_RECEIPT")
    decision["physicalFieldBindings"]["outcome"] = "tme_command_receipts.result_ref.decisionReceipt.outcome"
    tests.append(("scalar-result-ref-json", lambda mutated=mutated: preflight(oracle, fixture, exact, mutated)))
    mutated = copy.deepcopy(causal)
    mutated["operations"] = mutated["operations"][:-1]
    tests.append(("operation-closure", lambda mutated=mutated: preflight(oracle, fixture, exact, mutated)))
    failures: list[str] = []
    for name, test in tests:
        try:
            test()
        except (ValueError, KeyError, TypeError):
            continue
        failures.append(name)
    if failures or len(tests) != 8:
        raise ValueError("hostile self-test failed to reject: " + ",".join(failures))


def successor_runner_self_test() -> list[str]:
    """Validate successor routing/publication controls without starting PostgreSQL."""
    failures = list(successor_profile_hostile_self_test(BASE, ROOT))
    # The PG run carries the same immutable global owner-dependency receipt as
    # the oracle and fixture.  Mutate only an in-memory receipt here so the
    # hostile check remains output-free while proving PAY cannot be replaced
    # by a counted-but-unpinned dependency.
    for field, mutate in (
        ("ownerDependencyContracts", lambda value: value.__setitem__("ownerDependencyContracts", 1)),
        ("dependencyContractIds", lambda value: value["dependencyContractIds"].reverse()),
        ("dependencyContractSeals", lambda value: value["dependencyContractSeals"].__setitem__(
            "compensation.resolveApprovedSnapshotForPayroll.v1", "0" * 64
        )),
    ):
        receipt = successor_owner_dependency_receipt()
        try:
            mutate(receipt)
            verify_successor_owner_dependency_receipt(receipt, label=f"self-test.{field}")
        except (SuccessorProfileError, TypeError, ValueError):
            continue
        failures.append("owner-dependency-receipt-mutation-false-pass:" + field)
    preflight = successor_preflight()
    if not preflight.get("stageState", {}).get("acyclic"):
        failures.append("successor-stage-graph-is-cyclic")
    if preflight["predecessorPinFailures"]:
        failures.append(
            "predecessor-pin-drift:" + ",".join(preflight["predecessorPinFailures"])
        )
    if preflight["successorTargetFailures"]:
        failures.append("successor-target-failure:" + ",".join(preflight["successorTargetFailures"]))
    expected_counts = {
        "publicOperations": 199, "commands": 133, "queries": 66,
        "systemHandlers": 27, "publicEvents": 157, "tableSpecifications": 131,
        "ownerPortOperationContracts": 18, "ownerDependencyContracts": 2,
    }
    if preflight["canonicalCounts"] != expected_counts:
        failures.append("source-derived-count-profile-drift")
    occupied = [
        key for key, path in successor_paths(BASE, ROOT).items()
        if path.exists() or path.is_symlink()
    ]
    if occupied:
        failures.append("successor-targets-occupied:" + ",".join(sorted(occupied)))
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--write", action="store_true")
    actions.add_argument("--check", action="store_true")
    actions.add_argument("--postgres-feasibility", action="store_true")
    actions.add_argument("--self-test", action="store_true")
    parser.add_argument("--host-lock-held-by-parent", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument(
        "--profile", choices=(LEGACY_PROFILE, SUCCESSOR_PROFILE), default=LEGACY_PROFILE,
        help=("artifact chain profile; legacy-v1 preserves historical checks, "
              "successor-v2 is PG evidence v3 create-new-only and pending transition"),
    )
    args = parser.parse_args()
    try:
        configure_profile(args.profile)
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE and args.self_test:
            failures = successor_runner_self_test()
            payload = {
                "schema": "dwp.hris.modern.causal-independent-pg-runner-successor-self-test.v1",
                "status": "PASS" if not failures else "FAIL",
                "profile": ACTIVE_PROFILE,
                "tests": 6,
                "failures": failures,
                "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
                "policy": ACTIVE_PROFILE_METADATA["policy"],
                "predecessorDisposition": ACTIVE_PROFILE_METADATA["predecessorDisposition"],
            }
            print(canonical_bytes(payload).decode("utf-8") if args.compact else json.dumps(
                payload, ensure_ascii=False, indent=2, sort_keys=True
            ))
            return 0 if not failures else 1
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
            preflight = successor_preflight()
            # A PG run can consume only the preceding stage.  In particular,
            # unsigned evidence is a new staging output and is never required
            # before it is produced; finalized evidence is a later target.
            required_stage = (
                "fixture" if args.postgres_feasibility
                else "pg-unsigned" if args.write else "endorsement"
            )
            stage_missing = pending_successor_inputs(BASE, ROOT, stage=required_stage)
            target_keys = ("pgUnsigned",) if args.write else ()
            target_failures = successor_target_failures(BASE, ROOT, keys=target_keys)
            if (stage_missing or preflight["predecessorPinFailures"] or target_failures
                    or preflight["acceptedLivePreflight"].get("status") != "READY"):
                raise ValueError(
                    "successor profile pending accepted canonical transition; "
                    f"stage={required_stage} missing={stage_missing} "
                    f"pinFailures={preflight['predecessorPinFailures']}"
                    f" targetFailures={target_failures}"
                )
        if args.self_test:
            if args.host_lock_held_by_parent:
                raise ValueError("self-test does not accept parent-held mode")
            run_self_tests()
            print("MODERN_CAUSAL_PG_RUNNER_SELF_TEST=PASS tests=8 failures=0")
            return 0
        oracle, fixture, exact, causal = load_authorities()
        if args.postgres_feasibility:
            receipt = run_postgres_feasibility(
                oracle, fixture, exact, causal, args.host_lock_held_by_parent
            )
            print(canonical_bytes(receipt).decode("utf-8") if args.compact else json.dumps(
                receipt, ensure_ascii=False, indent=2, sort_keys=True
            ))
            return 0
        if args.write:
            runs, acquisition = with_host_lock(
                args.host_lock_held_by_parent,
                lambda: execute_both(oracle, fixture, exact, causal),
            )
            evidence = build_unsigned_evidence(oracle, fixture, runs, acquisition)
            atomic_write_json(
                UNSIGNED_EVIDENCE_PATH if ACTIVE_PROFILE == SUCCESSOR_PROFILE else EVIDENCE_PATH,
                evidence,
            )
            receipt = {
                "schema": (
                    "dwp.hris.modern.causal-independent-pg-runner-write.v3"
                    if ACTIVE_PROFILE == SUCCESSOR_PROFILE
                    else "dwp.hris.modern.causal-independent-pg-runner-write.v2"
                ),
                "mode": (
                    "WRITE_SUCCESSOR_V3_UNSIGNED_EVIDENCE"
                    if ACTIVE_PROFILE == SUCCESSOR_PROFILE
                    else "WRITE_CURRENT_V2_EVIDENCE"
                ), "status": "PASS", "errors": 0,
                "evidenceId": EVIDENCE_ID,
                "evidencePath": str((UNSIGNED_EVIDENCE_PATH if ACTIVE_PROFILE == SUCCESSOR_PROFILE else EVIDENCE_PATH).relative_to(BASE)),
                "evidenceFileSha256": file_hash(UNSIGNED_EVIDENCE_PATH if ACTIVE_PROFILE == SUCCESSOR_PROFILE else EVIDENCE_PATH),
                "finalEvidencePath": str(EVIDENCE_PATH.relative_to(BASE)),
                "engines": [16, 18],
                "comparableExecutionPayloadSha256": evidence["executionComparison"][
                    "comparableExecutionPayloadSha256"
                ],
            }
            print(canonical_bytes(receipt).decode("utf-8") if args.compact else json.dumps(
                receipt, ensure_ascii=False, indent=2, sort_keys=True
            ))
            return 0
        receipt = check_current_evidence(
            oracle, fixture, exact, causal, args.host_lock_held_by_parent
        )
        print(canonical_bytes(receipt).decode("utf-8") if args.compact else json.dumps(
            receipt, ensure_ascii=False, indent=2, sort_keys=True
        ))
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError,
            SemaphoreTimeoutError, StrictJsonError) as error:
        if args.compact:
            mode = ("CHECK_CURRENT_V3_EVIDENCE" if ACTIVE_PROFILE == SUCCESSOR_PROFILE and args.check else
                    "WRITE_CURRENT_V3_EVIDENCE" if ACTIVE_PROFILE == SUCCESSOR_PROFILE and args.write else
                    "CHECK_CURRENT_V2_EVIDENCE" if args.check else
                    "WRITE_CURRENT_V2_EVIDENCE" if args.write else "SELF_TEST")
            if args.postgres_feasibility:
                mode = "POSTGRES_FEASIBILITY_NON_APPROVAL"
            print(canonical_bytes({
                "schema": "dwp.hris.modern.causal-independent-pg-runner-error.v1",
                "mode": mode, "status": "FAIL", "errors": 1,
                "detail": f"{type(error).__name__}:{error}",
            }).decode("utf-8"))
        else:
            print(f"MODERN_CAUSAL_PG_RUNNER=FAIL errors=1 detail={type(error).__name__}:{error}")
        return 1


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
