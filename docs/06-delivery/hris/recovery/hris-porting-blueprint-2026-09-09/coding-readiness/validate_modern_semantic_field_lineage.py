#!/usr/bin/env python3
"""Validate semantic, rather than merely non-empty, modern HRIS field lineage.

This is a G3 contract check, not an assertion that the contracts are implemented.
An unknown ``table.column`` is never a derived projection. Non-column sources
must resolve to request fields, fixed authenticated context, or an operation's
``typedSources``. A typed source declares ``source: derived.<name>``, ``type``,
``kind``, a concrete ``ruleId``, and ``inputs`` that recursively resolve to real
sources. ARRAY/OBJECT projections additionally declare ``itemSchemaRef`` or
``schemaRef`` and complete ``fieldSources`` (target, type, source).

Business ID mappings require ``semanticBinding`` with sourceKind, entityType,
idSpace, tenantBound=true and ownerValidated=true. Business request fields have
``referenceContract: {entityType, idSpace: PUBLIC_UUID}``. A UUID's shape does not
prove that it identifies the requested entity. FK targets are the independent
entity oracle; local table identity is named ``table:<table_name>``. Conversion
to an internal FK needs an exact ``resolution`` binding to a tenant-local table's
real public and internal columns. Correlation IDs are tracing metadata only,
including when hidden behind a registered derived source.

Shared G2 receipt tables are read from their authoritative SQL, not invented in
modern table specifications. Use operation-lineage ``receiptContracts`` entries
with receiptId, table, idColumn, tenantColumn, idempotencyColumn,
requestDigestColumn and callerColumn. A COMMAND_RECEIPT typed source identifies
its receiptRef and has actual receipt-column dependencies.

The healthy standalone unittest fixtures prove the validator can pass legitimate
contracts. The current real contracts must still fail until their defects are
repaired; --self-test never substitutes fixtures for that real validation.

READINESS is the default: canonical operationBindings/operationFieldLineage
must explicitly cover a nonempty, unique operation scope. Caller-supplied
expected_operation_ids/count are independent scope oracles, not silently applied
filters; a module-only check must supply its exact module document and oracle.
DIAGNOSTIC_ONLY permits explicit canonical []/[] inspection, never missing or
unsupported proposal keys, and can never produce readiness_pass or CLI PASS.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import unittest
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
EXACT_SCHEMA = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENT_PAYLOAD = HERE / "modern-capability-event-payload-contracts.v1.json"
SEMANTIC_BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
PUBLIC_IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
SEALED_REGISTRY_PAYLOAD_PINS = {
    "dwp.hris.modern.operation-semantic-bindings.v1": "a3d44a190d2bc481481ff3a66e0ea7654d4a680619eecd315b2312ef26fdff0a",
    "dwp.hris.modern.public-identities.v1": "7ff8469456d0d680d1eaaae8a997efcd05b1e42307faeff523dc5132f10910c5",
}
BASE_SCHEMA_FILES = {
    "HRIS-HRM": ROOT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
    "HRIS-PER": ROOT / "session-evidence/per/g2-readiness/physical-schema.sql",
    "HRIS-TIM": ROOT / "session-evidence/tim/g2-physical-schema.sql",
    "HRIS-PAY": ROOT / "session-evidence/pay/g2-physical-schema.sql",
    "HRIS-SYS": ROOT / "session-evidence/sys/g2-physical-schema.sql",
}
BUSINESS_SOURCE_KINDS = {
    "AUTHENTICATED_PRINCIPAL", "VALIDATED_REQUEST", "REFETCHED_SNAPSHOT",
    "AGGREGATE_EXISTING", "GENERATED_BUSINESS_ID",
}
TYPED_SOURCE_KINDS = {
    "QUERY_RESULT", "PAGE_CURSOR", "PAGE_HAS_MORE", "OWNER_AS_OF",
    "AUTHORIZATION_SCOPE_REVISION", "COMMAND_RECEIPT", "AGGREGATE_SNAPSHOT",
    "DOMAIN_DERIVATION", "GENERATED_BUSINESS_ID", "TRANSITION_STATE",
    "CANONICAL_DIGEST", "VERSION_COUNTER", "OWNER_CLOCK_VALUE",
    "AGGREGATE_COMPUTATION", "DOMAIN_TRANSFORM", "COLLECTION_CARDINALITY",
    "ARRAY_ORDINAL", "COLLECTION_AGGREGATE", "OWNER_ENGINE_RESULT",
    "OWNER_REFETCH_RESULT",
    "DOMAIN_CONSTANT",
}
CONTEXT_TYPES = {
    "principal.tenantId": "BIGINT",
    "principal.publicId": "UUID",
    "authorization.scopeRevision": "BIGINT",
    "ownerClock.now": "TIMESTAMPTZ",
    "ownerClock.localDate": "DATE",
    "context.ownerClock.transactionNow": "TIMESTAMPTZ",
    "context.correlationId": "UUID",
}
REF_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z_][A-Za-z0-9_-]*$")
DERIVED_RE = re.compile(r"^derived\.[A-Za-z_][A-Za-z0-9_]*$")
RULE_RE = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")
TRACE_NAMES = {"correlationid", "correlation_id", "x-correlation-id", "traceid", "trace_id", "traceparent", "tracestate"}
GENERIC_RULES = {
    "DIRECT_OR_EXPLICIT_DOMAIN_DERIVATION", "FIELD_POLICY_PROJECT_THEN_CANONICALIZE",
    "TYPED_DOMAIN_RULE_NO_UNBOUNDED_PAYLOAD", "CANONICAL_TYPED_EVENT_PROJECTION",
}


@dataclass(frozen=True)
class Identity:
    entity_type: str
    id_space: str


@dataclass(frozen=True)
class Value:
    value_type: str
    identity: Identity | None = None
    trace: bool = False
    origin: str = ""
    table: str | None = None
    column: str | None = None


@dataclass(frozen=True)
class Issue:
    code: str
    where: str
    message: str

    def __str__(self) -> str:
        return f"semantic lineage [{self.code}] {self.where}: {self.message}"


def normalize_type(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).upper().strip())


def types_compatible(source: str, target: str) -> bool:
    """Only lossless wire/SQL aliases; UUID/BIGINT are deliberately not aliases."""
    source, target = normalize_type(source), normalize_type(target)
    if source == target:
        return True
    text_type = lambda value: value in {"STRING", "TEXT"} or re.fullmatch(r"(?:VAR)?CHAR\(\d+\)", value) is not None
    if text_type(source) and text_type(target):
        return True
    if {source, target} <= {"CHAR(64)", "SHA256"}:
        return True
    if source.replace("DECIMAL(", "NUMERIC(") == target.replace("DECIMAL(", "NUMERIC("):
        return True
    if (source.endswith("[]") and target in {"ARRAY", "ARRAY<UUID>"}
            and (target != "ARRAY<UUID>" or source == "UUID[]")):
        return True
    if (target.endswith("[]") and source in {"ARRAY", "ARRAY<UUID>"}
            and (source != "ARRAY<UUID>" or target == "UUID[]")):
        return True
    return False


def is_trace(ref: str) -> bool:
    return ref.rsplit(".", 1)[-1].lower() in TRACE_NAMES


def expand_request_contract(operation: dict[str, Any],
                            schemas: dict[str, dict[str, Any]] | None = None) -> dict[str, dict[str, Any]]:
    """Expand closed request value objects without trusting the generator.

    Container fields remain part of the contract and every schema member gets
    its own canonical path.  Arrays use ``[]`` so a collection input cannot be
    confused with one scalar line.  Cycles and missing schema references are
    rejected by returning an impossible marker that downstream exact-set
    validation will fail rather than silently dropping members.
    """
    schemas = schemas or {}
    result: dict[str, dict[str, Any]] = {}

    def visit(prefix: str, field: dict[str, Any], stack: tuple[str, ...]) -> None:
        result[prefix] = field
        schema_ref = field.get("itemSchemaRef") or field.get("schemaRef")
        if not isinstance(schema_ref, str):
            return
        schema = schemas.get(schema_ref)
        if not isinstance(schema, dict) or schema_ref in stack:
            result[prefix + ".__INVALID_SCHEMA_REF__"] = {
                "name": "__INVALID_SCHEMA_REF__", "type": "INVALID", "required": True,
            }
            return
        child_prefix = prefix + ("[]." if field.get("itemSchemaRef") else ".")
        for member in schema.get("fields", []):
            if isinstance(member, dict) and isinstance(member.get("name"), str):
                visit(child_prefix + member["name"], member, stack + (schema_ref,))

    for section in ("pathParameters", "queryParameters", "headers", "body"):
        for field in operation.get("requestSchema", {}).get(section, []):
            if isinstance(field, dict) and isinstance(field.get("name"), str):
                visit(f"{section}.{field['name']}", field, ())
    return result


def semantic_binding_view(operation: dict[str, Any], lineage: dict[str, Any],
                          schemas: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """Canonical, review-sized operation source/sink decision surface."""
    request_contract = []
    for source, field in expand_request_contract(operation, schemas).items():
            request_contract.append({
                key: value for key, value in {
                    "source": source,
                    "type": field.get("type"), "required": field.get("required"),
                    "referenceContract": field.get("referenceContract"),
                }.items() if value is not None
            })
    keep = {
        "source", "sourcePath", "target", "type", "sqlType", "sourceKind", "kind",
        "ruleId", "inputs", "semanticBinding", "resolution", "receiptRef", "generation",
        "transitionId", "phase", "state", "digestPurpose", "initialValue", "clock",
        "computation", "transformId", "itemSchemaRef", "schemaRef", "itemType",
        "callerAssertion", "bounds", "engineOutput", "maximum",
        "transitionRootTable", "transitionStateColumn", "states",
        "ownerEntity", "ownerField", "purpose",
        "fieldSources", "objectReferenceMode", "sinks", "required",
        "receiptId", "table", "idColumn", "tenantColumn", "idempotencyColumn",
        "requestDigestColumn", "callerColumn",
        "disposition", "strategy",
    }
    def rows(key: str) -> list[dict[str, Any]]:
        return [
            {name: copy_value for name, copy_value in row.items() if name in keep}
            for row in lineage.get(key, []) if isinstance(row, dict)
        ]
    return {
        "operationId": operation.get("operationId"),
        "capabilityId": operation.get("capabilityId"),
        "session": operation.get("session"),
        "mode": operation.get("mode"),
        "readsTables": operation.get("readsTables", []),
        "writesTables": operation.get("writesTables", []),
        "responseSchemaRef": operation.get("responseSchemaRef"),
        "stateTransitionIds": operation.get("stateTransitionIds", []),
        "eventNames": operation.get("eventNames", []),
        "requestContract": request_contract,
        "inputMappings": rows("inputMappings"),
        "typedSources": rows("typedSources"),
        "receiptContracts": rows("receiptContracts"),
        "writeSet": rows("writeSet"),
        "mutationFieldSources": rows("mutationFieldSources"),
        "requiredColumnSources": rows("requiredColumnSources"),
        "responseFieldSources": rows("responseFieldSources"),
        "eventFieldSources": rows("eventFieldSources"),
        "mutationEvidence": lineage.get("mutationEvidence", {}),
    }


def business_type(field: dict[str, Any], *, physical: bool = False) -> bool:
    name = str(field.get("name", ""))
    if is_trace(name):
        return False
    value_type = normalize_type(field.get("sqlType" if physical else "type", ""))
    return value_type in {"UUID", "UUID[]", "ARRAY<UUID>"} or (
        value_type == "ARRAY" and normalize_type(field.get("itemType", "")) == "UUID"
    )


def declared_identity(field: dict[str, Any], operation_id: str | None = None) -> Identity | None:
    """Return only a directly declared identity for the requested public use.

    ``referenceContractByOperation`` is intentionally visible only when an
    exact operation is supplied by the public response/event validation path.
    Request, typed-source and physical-column validation continue to require a
    single ``referenceContract`` and cannot inherit a convenient variant.
    """
    variants = field.get("referenceContractByOperation")
    contract = variants.get(operation_id) if operation_id is not None and isinstance(variants, dict) else None
    if contract is None:
        contract = field.get("referenceContract")
    if not isinstance(contract, dict):
        return None
    entity = contract.get("entityType")
    space = contract.get("idSpace")
    if not isinstance(entity, str) or not entity.strip() or space not in {"PUBLIC_UUID", "INTERNAL_BIGINT"}:
        return None
    return Identity(entity, space)


def sql_segments(text: str, *, split: bool = False) -> tuple[str, list[str]]:
    """Lex balanced SQL; strings/comments never introduce columns or delimiters."""
    result: list[str] = []
    parts: list[str] = []
    level, quote, block, index = 0, "", 0, 0
    while index < len(text):
        char = text[index]
        pair = text[index:index + 2]
        if block:
            if pair == "/*":
                block += 1
                index += 2
            elif pair == "*/":
                block -= 1
                index += 2
            else:
                result.append("\n" if char == "\n" else " ")
                index += 1
            continue
        if quote:
            result.append(char)
            if char == quote:
                if index + 1 < len(text) and text[index + 1] == quote:
                    result.append(quote)
                    index += 1
                else:
                    quote = ""
            index += 1
            continue
        if pair == "/*":
            block = 1
            index += 2
            continue
        if pair == "--":
            end = text.find("\n", index)
            if end < 0:
                break
            result.append("\n")
            index = end + 1
            continue
        if char in {"'", '"'}:
            quote = char
        elif char == "(":
            level += 1
        elif char == ")":
            level -= 1
        elif char == "," and split and level == 0:
            parts.append("".join(result).strip())
            result = []
            index += 1
            continue
        result.append(char)
        index += 1
    if quote or block or level != 0:
        raise ValueError("unbalanced SQL segment")
    rendered = "".join(result)
    if split:
        parts.append(rendered.strip())
    return rendered, parts


def parse_sql_tables(sql: str, owner: str) -> dict[str, dict[str, Any]]:
    """Read CREATE TABLE columns conservatively from the checked-in G2 DDL."""
    # Whole SQL includes function bodies, so comment masking is performed without
    # requiring global parenthesis balance. The table's own body is lexed below.
    clean = re.sub(r"/\*[\s\S]*?\*/|--[^\n]*", lambda m: "\n" * m.group().count("\n"), sql)
    create = re.compile(r"(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(")
    tables: dict[str, dict[str, Any]] = {}
    for match in create.finditer(clean):
        pos, depth, quote = match.end(), 1, ""
        start = pos
        while pos < len(clean) and depth:
            char = clean[pos]
            if quote:
                if char == quote:
                    if pos + 1 < len(clean) and clean[pos + 1] == quote:
                        pos += 1
                    else:
                        quote = ""
            elif char in {"'", '"'}:
                quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            pos += 1
        if depth or quote:
            raise ValueError(f"unterminated CREATE TABLE {match.group(1)}")
        _, parts = sql_segments(clean[start:pos - 1], split=True)
        columns: dict[str, dict[str, Any]] = {}
        primary_keys: list[list[str]] = []
        unique_keys: list[list[str]] = []
        for part in parts:
            constraint = re.sub(r"(?is)^CONSTRAINT\s+[a-z_][a-z0-9_]*\s+", "", part).strip()
            key = re.match(r"(?is)^(PRIMARY\s+KEY|UNIQUE)\s*\(([^)]*)\)", constraint)
            if key:
                names = [name.strip().strip('"') for name in key.group(2).split(",")]
                if not names or any(re.fullmatch(r"[a-z_][a-z0-9_]*", name) is None for name in names):
                    raise ValueError(f"unparsed key constraint in {match.group(1)}: {part[:80]}")
                (primary_keys if key.group(1).upper().startswith("PRIMARY") else unique_keys).append(names)
                continue
            if re.match(r"(?i)^(?:CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE)\b", part):
                continue
            col = re.match(r"(?is)^([a-z_][a-z0-9_]*)\s+([a-z_][a-z0-9_]*(?:\s*\([^)]*\))?(?:\[\])?)(.*)$", part)
            if not col:
                raise ValueError(f"unparsed column in {match.group(1)}: {part[:80]}")
            name, value_type, tail = col.groups()
            value_type = normalize_type(value_type)
            ident = None
            if name == "public_id" or (value_type == "UUID" and re.search(r"\bPRIMARY\s+KEY\b", tail, re.I)):
                ident = Identity("table:" + match.group(1), "PUBLIC_UUID")
            elif value_type == "BIGINT" and re.search(r"\bPRIMARY\s+KEY\b", tail, re.I):
                ident = Identity("table:" + match.group(1), "INTERNAL_BIGINT")
            elif name in {"actor_public_id", "subject_principal_public_id", "created_by", "updated_by"}:
                ident = Identity("Auth.Principal", "PUBLIC_UUID")
            columns[name] = {"name": name, "sqlType": value_type, "_identity": ident}
            if re.search(r"\bPRIMARY\s+KEY\b", tail, re.I):
                primary_keys.append([name])
            if re.search(r"\bUNIQUE\b", tail, re.I):
                unique_keys.append([name])
        for key_columns in primary_keys + unique_keys:
            if any(name not in columns for name in key_columns):
                raise ValueError(
                    f"key constraint references undeclared column in {match.group(1)}: {key_columns}"
                )
        tables[match.group(1)] = {
            "owner": owner,
            "columns": columns,
            "base": True,
            "primaryKeys": primary_keys,
            "uniqueKeys": unique_keys,
        }
    return tables


def load_base_tables() -> dict[str, dict[str, Any]]:
    tables: dict[str, dict[str, Any]] = {}
    for owner, path in BASE_SCHEMA_FILES.items():
        parsed = parse_sql_tables(path.read_text(encoding="utf-8"), owner)
        overlap = tables.keys() & parsed.keys()
        if overlap:
            raise ValueError(f"G2 table owner collision: {sorted(overlap)}")
        tables.update(parsed)
    return tables


class SemanticValidator:
    def __init__(self, doc: dict[str, Any], events: dict[str, Any] | None = None,
                 base_tables: dict[str, dict[str, Any]] | None = None, *,
                 validation_mode: str = "READINESS",
                 expected_operation_ids: tuple[str, ...] | None = None,
                 expected_operation_count: int | None = None,
                 capability_oracle: dict[str, Any] | None = None,
                 semantic_registry: dict[str, Any] | None = None,
                 identity_registry: dict[str, Any] | None = None) -> None:
        self.doc = doc
        self.validation_mode = validation_mode
        self.expected_operation_ids = expected_operation_ids
        self.expected_operation_count = expected_operation_count
        self.capability_oracle = capability_oracle or {}
        self.semantic_registry = semantic_registry or {}
        self.identity_registry = identity_registry or {}
        self.event_doc = events or {}
        self.errors: list[Issue] = []
        self._seen_issues: set[Issue] = set()
        self.counts: Counter[str] = Counter()
        self.receipt_public_ids: set[tuple[str, str]] = set()
        self.tables = dict(base_tables or {})
        self.schemas = {
            schema.get("schemaId", ""): schema
            for group in ("recordSchemas", "responseSchemas")
            for schema in doc.get(group, []) if isinstance(schema, dict)
        }
        self.events = {schema.get("eventName", ""): schema for schema in (events or {}).get("eventPayloadSchemas", [])}
        common = {col.get("name", ""): col for col in doc.get("commonTableContract", {}).get("columns", [])
                  if isinstance(col, dict) and col.get("name") != "__internal_id__"}
        for spec in doc.get("tableSpecifications", []):
            name = spec.get("tableName", "")
            columns = dict(common)
            ident = spec.get("idColumn", {})
            if ident.get("name"):
                columns[ident["name"]] = ident
            columns.update({col.get("name", ""): col for col in spec.get("columns", []) if isinstance(col, dict)})
            self.tables[name] = {"owner": spec.get("session"), "columns": columns, "spec": spec, "base": False}

    def validate_capability_oracle(self, operations: dict[str, dict[str, Any]]) -> None:
        """Apply independent capability/session/table/transition ownership."""
        if not self.capability_oracle:
            return
        oracle_ops = self.capability_oracle.get("operations", {})
        oracle_tables = self.capability_oracle.get("tables", {})
        if set(operations) != set(oracle_ops):
            self.issue("CAPABILITY_OPERATION_CLOSURE", "operationBindings",
                       "operations must exactly equal the independent capability registry")
        for operation_id, operation in operations.items():
            expected = oracle_ops.get(operation_id)
            if not isinstance(expected, dict):
                continue
            for key in ("capabilityId", "session", "mode", "stateTransitionIds", "eventNames"):
                if operation.get(key) != expected.get(key):
                    self.issue("CAPABILITY_OPERATION_RELABEL", operation_id + "." + key,
                               "operation metadata differs from the independent capability registry")
            for table_name in operation.get("readsTables", []) + operation.get("writesTables", []):
                if oracle_tables.get(table_name) != operation.get("capabilityId"):
                    self.issue("CAPABILITY_TABLE_OWNERSHIP", operation_id + "." + table_name,
                               "same-session access is insufficient; table must belong to this exact capability")

    @staticmethod
    def registry_digest(registry: dict[str, Any]) -> str:
        payload = {key: value for key, value in registry.items() if key != "sealedPayloadSha256"}
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def registry_core_digest(registry: dict[str, Any]) -> str:
        payload = {
            key: value for key, value in registry.items()
            if key not in {"sealedPayloadSha256", "canonicalContractPins"}
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def validate_sealed_registries(self, operations: dict[str, dict[str, Any]],
                                   lineages: list[dict[str, Any]]) -> None:
        if not self.semantic_registry or not self.identity_registry:
            if self.doc.get("contractId") == "dwp.hris.modern.exact-schema.v1":
                self.issue("SEALED_REGISTRY_REQUIRED", "document",
                           "canonical readiness requires independent semantic and public-identity registries")
            return
        expected_contract_pins = {
            EXACT_SCHEMA.name: hashlib.sha256(
                (json.dumps(self.doc, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            ).hexdigest(),
            EVENT_PAYLOAD.name: hashlib.sha256(
                (json.dumps(self.event_doc, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            ).hexdigest(),
        }
        expected_reciprocal_pins = {
            SEMANTIC_BINDINGS.name: self.registry_core_digest(self.semantic_registry),
            PUBLIC_IDENTITIES.name: self.registry_core_digest(self.identity_registry),
        }
        for label, canonical in (("schema", self.doc), ("events", self.event_doc)):
            if canonical.get("independentRegistryCorePins") != expected_reciprocal_pins:
                self.issue("RECIPROCAL_REGISTRY_PIN_MISMATCH", label,
                           "canonical contract must pin both independent registry review cores")
        for label, registry, registry_id in (
            ("semantic", self.semantic_registry, "dwp.hris.modern.operation-semantic-bindings.v1"),
            ("identity", self.identity_registry, "dwp.hris.modern.public-identities.v1"),
        ):
            if (registry.get("registryId") != registry_id or registry.get("schemaVersion") != 1
                    or registry.get("status") != "SEALED_G3_DESIGN_NOT_IMPLEMENTED"
                    or registry.get("sealedPayloadSha256") != self.registry_digest(registry)):
                self.issue("SEALED_REGISTRY_INVALID", label,
                           "registry identity/version/status/digest must be exact and internally sealed")
            if registry.get("sealedPayloadSha256") != SEALED_REGISTRY_PAYLOAD_PINS.get(registry_id):
                self.issue("SEALED_REGISTRY_PIN_MISMATCH", label,
                           "registry payload differs from the independently code-reviewed seal")
            if registry.get("canonicalContractPins") != expected_contract_pins:
                self.issue("CANONICAL_CONTRACT_PIN_MISMATCH", label,
                           "sealed registry must pin the exact canonical schema and event JSON bytes")
        marker_pairs = (
            ("semanticBindingRegistry", self.semantic_registry, SEMANTIC_BINDINGS.name),
            ("publicIdentityRegistry", self.identity_registry, PUBLIC_IDENTITIES.name),
        )
        for marker_name, registry, path in marker_pairs:
            marker = self.doc.get(marker_name)
            if not isinstance(marker, dict) or marker != {
                    "registryId": registry.get("registryId"), "schemaVersion": 1,
                    "path": path, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED"}:
                self.issue("SEALED_REGISTRY_MARKER_DRIFT", marker_name,
                           "canonical document must name the exact sealed registry")

        raw_rows = self.semantic_registry.get("operations")
        if not isinstance(raw_rows, list):
            self.issue("SEALED_BINDING_REGISTRY_INVALID", "semantic.operations",
                       "sealed operation bindings must be an array")
            return
        registry_ids = [row.get("operationId") for row in raw_rows if isinstance(row, dict)]
        if (len(registry_ids) != len(raw_rows) or len(registry_ids) != len(set(registry_ids))
                or set(registry_ids) != set(operations)):
            self.issue("SEALED_BINDING_OPERATION_CLOSURE", "semantic.operations",
                       "sealed binding operations must exactly close the canonical scope")
        registry_rows = {row.get("operationId"): row for row in raw_rows if isinstance(row, dict)}
        lineage_rows = {row.get("operationId"): row for row in lineages if isinstance(row, dict)}
        for operation_id, operation in operations.items():
            sealed = registry_rows.get(operation_id, {})
            actual = semantic_binding_view(operation, lineage_rows.get(operation_id, {}), self.schemas)
            if sealed != actual:
                operation_keys = {
                    "capabilityId", "session", "mode", "readsTables", "writesTables",
                    "responseSchemaRef", "stateTransitionIds", "eventNames", "requestContract",
                }
                if any(sealed.get(key) != actual.get(key) for key in operation_keys):
                    self.issue("SEALED_OPERATION_CONTRACT_DRIFT", operation_id,
                               "operation surface differs from its reviewed versioned binding")
                if any(sealed.get(key) != actual.get(key) for key in set(actual) - operation_keys - {"operationId"}):
                    self.issue("SEALED_LINEAGE_DRIFT", operation_id,
                               "source/sink graph differs from its reviewed versioned binding")

    def registry_identity(self, scope: str, operation_id: str, target: str) -> Identity | None:
        group_name = {
            "request": "requestFieldsByOperation",
            "response": "responseFieldsByOperation",
            "event": "eventFieldsByOperation",
        }[scope]
        raw = self.identity_registry.get(group_name, {}).get(operation_id, {}).get(target)
        return declared_identity({"referenceContract": raw}) if isinstance(raw, dict) else None

    def validate_identity_registry_closure(self, operations: dict[str, dict[str, Any]]) -> None:
        if not self.identity_registry:
            return
        physical = self.identity_registry.get("physicalColumns")
        if not isinstance(physical, dict):
            self.issue("PUBLIC_IDENTITY_REGISTRY_INVALID", "physicalColumns",
                       "physical identity oracle must be an exact object")
            physical = {}
        for target, raw in physical.items():
            if not isinstance(target, str) or not REF_RE.fullmatch(target):
                self.issue("PUBLIC_IDENTITY_PHYSICAL_INVALID", str(target), "physical oracle target must be table.column")
                continue
            table_name, column = target.split(".", 1)
            table = self.tables.get(table_name)
            identity = declared_identity({"referenceContract": raw}) if isinstance(raw, dict) else None
            if (table is None or column not in table["columns"] or identity is None
                    or identity.id_space != "PUBLIC_UUID"
                    or normalize_type(table["columns"][column].get("sqlType", "")) not in {"UUID", "UUID[]"}):
                self.issue("PUBLIC_IDENTITY_PHYSICAL_INVALID", target,
                           "physical oracle needs an actual UUID/UUID[] column and PUBLIC_UUID entity")
        for group_name in ("requestFieldsByOperation", "responseFieldsByOperation", "eventFieldsByOperation"):
            group = self.identity_registry.get(group_name)
            if not isinstance(group, dict) or not set(group) <= set(operations):
                self.issue("PUBLIC_IDENTITY_OPERATION_CLOSURE", group_name,
                           "identity operation keys must be known canonical operations")
                continue
            for operation_id, fields in group.items():
                if not isinstance(fields, dict):
                    self.issue("PUBLIC_IDENTITY_REGISTRY_INVALID", f"{group_name}.{operation_id}",
                               "operation identity fields must be an exact object")
                    continue
                for target, raw in fields.items():
                    identity = declared_identity({"referenceContract": raw}) if isinstance(raw, dict) else None
                    if identity is None or identity.id_space != "PUBLIC_UUID":
                        self.issue("PUBLIC_IDENTITY_REGISTRY_INVALID", f"{operation_id}.{target}",
                                   "every sealed public identity needs entityType and PUBLIC_UUID")
        for operation_id, operation in operations.items():
            expected_request = {
                source for source, field in expand_request_contract(operation, self.schemas).items()
                if not source.startswith("headers.") and business_type(field)
            }
            actual_request = set(self.identity_registry.get("requestFieldsByOperation", {}).get(operation_id, {}))
            if expected_request != actual_request:
                self.issue("PUBLIC_IDENTITY_REQUEST_CLOSURE", operation_id,
                           "sealed request identities must exactly equal business request fields")

            expected_response: set[str] = set()
            seen: set[str] = set()
            def visit(schema_id: str) -> None:
                if schema_id in seen:
                    return
                seen.add(schema_id)
                for field in self.schemas.get(schema_id, {}).get("fields", []):
                    if business_type(field):
                        expected_response.add(f"{schema_id}.{field.get('name')}")
                    nested = field.get("itemSchemaRef") or field.get("schemaRef")
                    if isinstance(nested, str):
                        visit(nested)
            response_ref = operation.get("responseSchemaRef")
            if isinstance(response_ref, str):
                visit(response_ref)
            actual_response = set(self.identity_registry.get("responseFieldsByOperation", {}).get(operation_id, {}))
            if expected_response != actual_response:
                self.issue("PUBLIC_IDENTITY_RESPONSE_CLOSURE", operation_id,
                           "sealed response identities must exactly equal all public schema uses")

            expected_event = {
                f"{event_name}.{field.get('name')}"
                for event_name in operation.get("eventNames", [])
                for field in self.events.get(event_name, {}).get("fields", [])
                if business_type(field)
            }
            actual_event = set(self.identity_registry.get("eventFieldsByOperation", {}).get(operation_id, {}))
            if expected_event != actual_event:
                self.issue("PUBLIC_IDENTITY_EVENT_CLOSURE", operation_id,
                           "sealed event identities must exactly equal all emitted business fields")

    def issue(self, code: str, where: str, message: str) -> None:
        issue = Issue(code, where, message)
        if issue not in self._seen_issues:
            self._seen_issues.add(issue)
            self.errors.append(issue)

    @property
    def readiness_pass(self) -> bool:
        return self.validation_mode == "READINESS" and not self.errors and self.counts["operations"] > 0

    @property
    def validation_status(self) -> str:
        if self.errors:
            return "FAIL"
        return "DIAGNOSTIC_ONLY" if self.validation_mode == "DIAGNOSTIC_ONLY" else ("PASS" if self.readiness_pass else "FAIL")

    def operation_scope(self) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]] | None:
        """Reject absent/ambiguous graphs before any field check can become a noop."""
        if not isinstance(self.validation_mode, str) or self.validation_mode not in {"READINESS", "DIAGNOSTIC_ONLY"}:
            self.issue("VALIDATION_MODE_INVALID", "validation_mode", "only READINESS or explicit DIAGNOSTIC_ONLY is supported")
            return None
        keys = ("operationBindings", "operationFieldLineage")
        proposal_graph = any(key in self.doc for key in ("operationDeltas", "internalOperations", "operations"))
        if proposal_graph:
            self.issue("UNSUPPORTED_PROPOSAL_DIALECT", "document", "proposal or mixed operation graphs require an explicit canonical successor adapter")
        if any(key not in self.doc for key in keys):
            self.issue("OPERATION_GRAPH_REQUIRED", "document", "operationBindings and operationFieldLineage must both be explicitly present")
            return None
        if proposal_graph:
            return None  # Appended bindings cannot silently hide proposal jobs.
        raw_ops, raw_lineages = (self.doc[key] for key in keys)
        if not isinstance(raw_ops, list) or not isinstance(raw_lineages, list):
            self.issue("OPERATION_GRAPH_INVALID", "document", "canonical operation bindings and lineages must be arrays")
            return None
        if any(not isinstance(row, dict) or not isinstance(row.get("operationId"), str)
               or not row["operationId"].strip() or row["operationId"] != row["operationId"].strip()
               for row in raw_ops + raw_lineages):
            self.issue("OPERATION_ID_INVALID", "document", "every binding/lineage must be an object with an exact nonempty operationId")
            return None
        if any(not isinstance(row.get("mode"), str) or row["mode"] not in {"COMMAND", "QUERY"}
               for row in raw_ops):
            self.issue("OPERATION_MODE_INVALID", "operationBindings", "every canonical operation mode must be exactly COMMAND or QUERY")
            return None
        op_ids = [row["operationId"] for row in raw_ops]
        lineage_ids = [row["operationId"] for row in raw_lineages]
        if not op_ids and self.validation_mode == "READINESS":
            self.issue("EMPTY_OPERATION_SCOPE", "operationBindings", "readiness cannot validate zero operations")
        if len(op_ids) != len(set(op_ids)):
            self.issue("OPERATION_BINDING_DUPLICATE", "operationBindings", "operation IDs must be unique; dictionary overwrite cannot hide a duplicate")
        if len(lineage_ids) != len(set(lineage_ids)):
            self.issue("OPERATION_LINEAGE_DUPLICATE", "operationFieldLineage", "lineage operation IDs must be unique")
        if set(lineage_ids) != set(op_ids):
            self.issue("OPERATION_LINEAGE_CLOSURE", "operationFieldLineage", "must cover actual operations exactly once")
        if self.expected_operation_ids is not None:
            expected = self.expected_operation_ids
            if (not isinstance(expected, (tuple, list, set, frozenset))
                    or any(not isinstance(value, str) or not value.strip() or value != value.strip() for value in expected)
                    or len(expected) != len(set(expected))
                    or (not expected and self.validation_mode == "READINESS")):
                self.issue("EXPECTED_OPERATION_SCOPE_INVALID", "expected_operation_ids", "independent expected scope must contain unique exact operation IDs")
            elif set(expected) != set(op_ids):
                self.issue("EXPECTED_OPERATION_SCOPE_MISMATCH", "operationBindings", "document operation IDs differ from the independently supplied exact audit scope")
        if self.expected_operation_count is not None:
            count = self.expected_operation_count
            if type(count) is not int or count < 0 or (count == 0 and self.validation_mode == "READINESS"):
                self.issue("EXPECTED_OPERATION_COUNT_INVALID", "expected_operation_count", "readiness count must be a positive integer, never a boolean/coerced value")
            elif count != len(op_ids):
                self.issue("EXPECTED_OPERATION_COUNT_MISMATCH", "operationBindings", "operation count differs from the independently supplied audit scope")
        actual_counts = {"operations": len(op_ids), "commands": sum(row.get("mode") == "COMMAND" for row in raw_ops),
                         "queries": sum(row.get("mode") == "QUERY" for row in raw_ops)}
        for scope_key, count_keys in (("scope", ("operations",)), ("fieldLineageScope", ("operations", "commands", "queries"))):
            if scope_key not in self.doc:
                continue  # Small/module witnesses need not claim global counts.
            scope = self.doc[scope_key]
            if not isinstance(scope, dict):
                self.issue("DECLARED_OPERATION_SCOPE_INVALID", scope_key, "declared operation scope must be an object")
                continue
            for key in count_keys:
                if key in scope and (type(scope[key]) is not int or scope[key] != actual_counts[key]):
                    self.issue("DECLARED_OPERATION_COUNT_MISMATCH", scope_key + "." + key, "declared count must equal the exact canonical graph, without hardcoded totals")
        if self.errors:
            return None
        return {row["operationId"]: row for row in raw_ops}, raw_lineages

    def physical_identity(self, table_name: str, column: str) -> Identity | None:
        table = self.tables[table_name]
        field = table["columns"][column]
        if is_trace(column) or column == "tenant_id":
            return None
        sealed_raw = self.identity_registry.get("physicalColumns", {}).get(f"{table_name}.{column}")
        sealed = declared_identity({"referenceContract": sealed_raw}) if isinstance(sealed_raw, dict) else None
        structural: Identity | None = None
        if (table_name, column) in self.receipt_public_ids:
            structural = Identity("table:" + table_name, "PUBLIC_UUID")
        if table.get("base"):
            structural = structural or field.get("_identity")
        else:
            spec = table.get("spec", {})
            if column == "public_id":
                structural = Identity("table:" + table_name, "PUBLIC_UUID")
            elif column == spec.get("idColumn", {}).get("name"):
                structural = Identity("table:" + table_name, "INTERNAL_BIGINT")
            elif column in {"created_by", "updated_by"}:
                structural = Identity("Auth.Principal", "PUBLIC_UUID")
            matches = [fk for fk in spec.get("foreignKeys", []) if column in fk.get("columns", [])]
            identities = set()
            for fk in matches:
                mode, target = fk.get("mode"), fk.get("target", "")
                if mode == "LOCAL_COMPOSITE_FK":
                    positions = [index for index, name in enumerate(fk.get("columns", []))
                                 if name == column]
                    target_columns = fk.get("targetColumns", [])
                    target_column = (target_columns[positions[0]]
                                     if len(positions) == 1 and positions[0] < len(target_columns)
                                     else None)
                    identities.add(Identity(
                        "table:" + target,
                        "PUBLIC_UUID" if target_column == "public_id" else "INTERNAL_BIGINT",
                    ))
                elif mode == "OPAQUE_CROSS_BOUNDARY_REFERENCE":
                    identities.add(Identity(target, "PUBLIC_UUID"))
            if len(identities) == 1:
                structural = next(iter(identities))
        declared = declared_identity(field)
        if sealed is not None:
            if ((structural is not None and structural.id_space == "PUBLIC_UUID" and structural != sealed)
                    or (declared is not None and declared != sealed)):
                self.issue("PUBLIC_IDENTITY_ORACLE_CONFLICT", table_name + "." + column,
                           "physical declaration/FK differs from the sealed public identity oracle")
            return sealed
        if self.identity_registry and business_type(field, physical=True):
            self.issue("PUBLIC_IDENTITY_PHYSICAL_CLOSURE", table_name + "." + column,
                       "business UUID physical column is absent from the sealed identity oracle")
            return None
        if declared is not None and structural is not None and declared != structural:
            self.issue("FK_ENTITY_DECLARATION_CONFLICT", table_name + "." + column,
                       "referenceContract disagrees with independent FK target")
        return structural or declared

    def validate_identity_variants(self, operations: dict[str, dict[str, Any]]) -> None:
        """Fail closed on operation-specific public response/event identities."""
        response_users: dict[str, set[str]] = {}

        def add_schema_user(schema_id: str, operation_id: str, seen: set[str]) -> None:
            if schema_id in seen:
                return
            seen.add(schema_id)
            response_users.setdefault(schema_id, set()).add(operation_id)
            schema = self.schemas.get(schema_id, {})
            for field in schema.get("fields", []):
                nested = field.get("itemSchemaRef") or field.get("schemaRef")
                if isinstance(nested, str):
                    add_schema_user(nested, operation_id, seen)

        event_users: dict[str, set[str]] = {}
        for operation_id, operation in operations.items():
            response_ref = operation.get("responseSchemaRef")
            if isinstance(response_ref, str):
                add_schema_user(response_ref, operation_id, set())
            for event_name in operation.get("eventNames", []):
                if isinstance(event_name, str):
                    event_users.setdefault(event_name, set()).add(operation_id)

        def validate_fields(scope: str, name: str, fields: list[Any], users: set[str]) -> None:
            for field in fields:
                if not isinstance(field, dict) or "referenceContractByOperation" not in field:
                    continue
                where = f"{scope}.{name}.{field.get('name', '')}"
                variants = field.get("referenceContractByOperation")
                if "referenceContract" in field:
                    self.issue("IDENTITY_VARIANT_AMBIGUOUS", where,
                               "a public field cannot declare both global and operation-specific identities")
                if not isinstance(variants, dict):
                    self.issue("IDENTITY_VARIANT_INVALID", where,
                               "referenceContractByOperation must be an exact operation-keyed object")
                    continue
                if set(variants) != users:
                    self.issue("IDENTITY_VARIANT_USER_MISMATCH", where,
                               "operation-specific identity keys must exactly equal all public schema users")
                for operation_id, variant in variants.items():
                    identity = declared_identity({"referenceContract": variant}) if isinstance(variant, dict) else None
                    if (not isinstance(operation_id, str) or operation_id not in users or identity is None
                            or identity.id_space != "PUBLIC_UUID"):
                        self.issue("IDENTITY_VARIANT_INVALID", where + "." + str(operation_id),
                                   "every public variant needs an exact user operation, entity and PUBLIC_UUID idSpace")

        for schema_id, schema in self.schemas.items():
            validate_fields("responseSchema", schema_id, schema.get("fields", []), response_users.get(schema_id, set()))
        for event_name, schema in self.events.items():
            validate_fields("eventSchema", event_name, schema.get("fields", []), event_users.get(event_name, set()))

    def validate(self) -> "SemanticValidator":
        scope = self.operation_scope()
        if scope is None:
            return self
        operations, lineages = scope
        self.validate_capability_oracle(operations)
        self.validate_sealed_registries(operations, lineages)
        self.validate_identity_registry_closure(operations)
        self.validate_identity_variants(operations)
        for lineage in lineages:
            operation = operations.get(lineage.get("operationId", ""))
            if operation is None:
                continue
            OperationValidator(self, operation, lineage).validate()
            self.counts["operations"] += 1
        return self


class OperationValidator:
    def __init__(self, parent: SemanticValidator, operation: dict[str, Any], lineage: dict[str, Any]) -> None:
        self.parent, self.operation, self.lineage = parent, operation, lineage
        self.where = operation.get("operationId", "")
        self.request = expand_request_contract(operation, parent.schemas)
        raw_sources = lineage.get("typedSources", [])
        self.typed = {source.get("source", ""): source for source in raw_sources if isinstance(source, dict)}
        if len(self.typed) != len(raw_sources):
            self.error("TYPED_SOURCE_DUPLICATE", "typedSources", "duplicate or non-object typed source")
        self.receipts: dict[str, dict[str, Any]] = {}
        self.cache: dict[str, Value | None] = {}
        self.stack: list[str] = []
        self.allowed_tables = set(operation.get("readsTables", [])) | set(operation.get("writesTables", []))

    def error(self, code: str, ref: str, message: str) -> None:
        self.parent.issue(code, self.where + "." + ref, message)

    def resolve(self, ref: str) -> Value | None:
        if not isinstance(ref, str) or not ref:
            self.error("SOURCE_UNRESOLVED", str(ref), "source must be an exact non-empty reference")
            return None
        if ref in self.request:
            field = self.request[ref]
            trace = is_trace(ref)
            identity = None if ref.startswith("headers.") or trace else declared_identity(field)
            if business_type(field) and not ref.startswith("headers.") and self.parent.identity_registry:
                sealed = self.parent.registry_identity("request", self.where, ref)
                if sealed is None:
                    self.error("PUBLIC_IDENTITY_REQUEST_CLOSURE", ref,
                               "business request field is absent from the sealed identity oracle")
                elif identity != sealed:
                    self.error("PUBLIC_IDENTITY_REQUEST_CONFLICT", ref,
                               "request referenceContract differs from the sealed identity oracle")
                identity = sealed
            if business_type(field) and not ref.startswith("headers.") and identity is None:
                self.error("REQUEST_ENTITY_UNDECLARED", ref, "business UUID request needs referenceContract entityType and PUBLIC_UUID idSpace")
            if identity is not None and identity.id_space != "PUBLIC_UUID":
                self.error("REQUEST_INTERNAL_ID", ref, "public request cannot supply an INTERNAL_BIGINT reference")
            return Value(field.get("type", ""), identity, trace, "VALIDATED_REQUEST")
        if ref in CONTEXT_TYPES:
            identity = Identity("Auth.Principal", "PUBLIC_UUID") if ref == "principal.publicId" else None
            return Value(CONTEXT_TYPES[ref], identity, is_trace(ref),
                         "AUTHENTICATED_PRINCIPAL" if identity else "CONTEXT")
        if ref in self.typed:
            return self.resolve_typed(ref)
        if ref.startswith("derived."):
            self.error("TYPED_SOURCE_UNREGISTERED", ref, "derived source is not registered in this operation's typedSources")
            return None
        if REF_RE.fullmatch(ref):
            table_name, column = ref.split(".", 1)
            table = self.parent.tables.get(table_name)
            if table is None:
                self.error("SOURCE_UNRESOLVED", ref, "neither an actual table nor a fixed context/request/typed source")
                return None
            field = table["columns"].get(column)
            if field is None:
                self.error("SOURCE_COLUMN_MISSING", ref, "column does not exist in authoritative table specifications/G2 SQL")
                return None
            if table_name not in self.allowed_tables:
                self.error("SOURCE_TABLE_UNDECLARED", ref, "table is outside exact operation access or a validated receipt contract")
            if table.get("owner") != self.operation.get("session"):
                self.error("SOURCE_OWNER_BOUNDARY", ref, "cross-owner SQL references are forbidden; use a typed owner contract")
            return Value(field.get("sqlType", ""), self.parent.physical_identity(table_name, column),
                         is_trace(column), "AGGREGATE_EXISTING", table_name, column)
        self.error("SOURCE_UNRESOLVED", ref, "string aliases such as projection.foo/aggregate.foo are not typed definitions")
        return None

    def resolve_typed(self, ref: str) -> Value | None:
        if ref in self.cache:
            return self.cache[ref]
        if ref in self.stack:
            self.error("TYPED_SOURCE_CYCLE", ref, "cyclic derived source dependency: " + " -> ".join(self.stack + [ref]))
            return None
        self.stack.append(ref)
        source = self.typed[ref]
        kind, rule, value_type = source.get("kind"), source.get("ruleId", ""), source.get("type", "")
        if not DERIVED_RE.fullmatch(ref) or kind not in TYPED_SOURCE_KINDS or not isinstance(value_type, str) or not value_type:
            self.error("TYPED_SOURCE_CONTRACT", ref, "requires derived.<name>, exact type, and registered kind")
        if not isinstance(rule, str) or not RULE_RE.fullmatch(rule) or rule in GENERIC_RULES:
            self.error("DERIVATION_RULE_UNSPECIFIED", ref, "specific ruleId is required; generic lineage slogans are not derivations")
        inputs = source.get("inputs")
        if not isinstance(inputs, list) or len(inputs) != len(set(item for item in inputs if isinstance(item, str))):
            self.error("DERIVATION_INPUTS_INVALID", ref, "inputs must be a duplicate-free list of exact source refs")
            inputs = []
        no_input_kinds = {"GENERATED_BUSINESS_ID", "VERSION_COUNTER", "DOMAIN_CONSTANT"}
        if (kind == "TRANSITION_STATE" and source.get("phase") == "PRE" and source.get("state") == "NONE"):
            no_input_kinds.add("TRANSITION_STATE")
        if not inputs and kind not in no_input_kinds:
            self.error("DERIVATION_INPUTS_MISSING", ref, "a declared type/rule alone cannot invent a source")
        values = [self.resolve(item) for item in inputs]
        trace = any(value.trace for value in values if value is not None)
        self.check_typed_kind(ref, source, values)
        identity = declared_identity(source)
        binding = source.get("semanticBinding")
        if isinstance(binding, dict):
            identity = Identity(binding.get("entityType", ""), binding.get("idSpace", ""))
            self.check_binding(ref, source, identity, values, kind)
        elif business_type(source):
            self.error("SEMANTIC_BINDING_MISSING", ref, "derived business UUID needs exact provenance and entity binding")
        # Non-business sources cannot be labelled with an identity to launder a
        # number, cursor or correlation value into a public business identifier.
        if identity is not None and not business_type(source) and not (normalize_type(value_type) == "BIGINT" and identity.id_space == "INTERNAL_BIGINT"):
            self.error("IDENTITY_TYPE_MISMATCH", ref, "entity identity is incompatible with declared derived type")
        if normalize_type(value_type) in {"ARRAY", "OBJECT"}:
            self.check_projection(ref, source)
        result = Value(value_type, identity, trace, binding.get("sourceKind", "") if isinstance(binding, dict) else "DERIVED")
        self.stack.pop()
        self.cache[ref] = result
        self.parent.counts["typed_sources"] += 1
        return result

    def check_typed_kind(self, ref: str, source: dict[str, Any], values: list[Value | None]) -> None:
        kind, value_type = source.get("kind"), normalize_type(source.get("type", ""))
        inputs = source.get("inputs", [])
        if kind == "COMMAND_RECEIPT":
            receipt = self.receipts.get(source.get("receiptRef"))
            if receipt is None or not any(value is not None and value.table == receipt.get("table") for value in values):
                self.error("RECEIPT_SOURCE_UNREGISTERED", ref, "COMMAND_RECEIPT needs receiptRef and real registered receipt-column dependencies")
        if kind == "QUERY_RESULT" and (self.operation.get("mode") != "QUERY" or value_type not in {"ARRAY", "OBJECT"}):
            self.error("QUERY_PROJECTION_KIND", ref, "QUERY_RESULT must be a query ARRAY/OBJECT projection")
        as_of_bound = any(item in self.request and item.endswith(".asOf") for item in inputs) or any(
            self.typed.get(item, {}).get("kind") == "OWNER_AS_OF" for item in inputs
        )
        if kind == "PAGE_CURSOR" and (value_type != "STRING" or not {"principal.tenantId", "principal.publicId", "authorization.scopeRevision"} <= set(inputs) or not as_of_bound):
            self.error("CURSOR_BINDING_INCOMPLETE", ref, "cursor must bind authenticated tenant, caller, authorization scope and exact asOf")
        if kind == "PAGE_HAS_MORE" and (value_type != "BOOLEAN" or not any(item in self.request and item.endswith(".limit") for item in inputs)):
            self.error("PAGE_HAS_MORE_UNBOUND", ref, "hasMore needs BOOLEAN output and exact validated limit dependency")
        if kind == "OWNER_AS_OF" and (value_type not in {"TIMESTAMPTZ", "DATE"} or not any(item.startswith("ownerClock.") for item in inputs)):
            self.error("AS_OF_CLOCK_UNBOUND", ref, "owner-default asOf requires a real typed owner clock input")
        if kind == "AUTHORIZATION_SCOPE_REVISION" and (value_type != "BIGINT" or "authorization.scopeRevision" not in inputs):
            self.error("SCOPE_REVISION_UNBOUND", ref, "scope revision must originate in authenticated owner authorization context")
        if kind == "AGGREGATE_SNAPSHOT" and not any(value is not None and value.table is not None for value in values):
            self.error("SNAPSHOT_WITHOUT_SOURCE", ref, "snapshot must be re-fetched/projected from actual aggregate columns")
        if kind == "TRANSITION_STATE":
            transition_id = source.get("transitionId")
            phase = source.get("phase")
            state = source.get("state")
            expected = self.parent.capability_oracle.get("operations", {}).get(
                self.operation.get("operationId"), {}
            ).get("transition")
            if (phase not in {"PRE", "POST"} or not isinstance(transition_id, str)
                    or transition_id not in self.operation.get("stateTransitionIds", [])):
                self.error("TRANSITION_STATE_UNREGISTERED", ref,
                           "state source needs the exact operation transition and PRE/POST phase")
            if expected is not None:
                expected_state = expected.get("from" if phase == "PRE" else "to")
                if transition_id != expected.get("transitionId") or state != expected_state:
                    self.error("TRANSITION_STATE_RELABEL", ref,
                               "state value must equal the independent transition registry")
            if state != "NONE" and not any(
                    value is not None and value.table is not None
                    and value.column in {"status", "state", "stage"} for value in values):
                self.error("TRANSITION_STATE_WITHOUT_AGGREGATE", ref,
                           "non-NONE transition state requires an actual owner state column")
        if kind == "CANONICAL_DIGEST":
            if value_type not in {"SHA256", "CHAR(64)"} or not source.get("digestPurpose"):
                self.error("CANONICAL_DIGEST_INVALID", ref,
                           "digest needs SHA-256 type and an exact persisted/event purpose")
            if not any(value is not None and value.origin in {"VALIDATED_REQUEST", "AGGREGATE_EXISTING"}
                       for value in values):
                self.error("CANONICAL_DIGEST_WITHOUT_PAYLOAD", ref,
                           "digest must cover actual validated request or aggregate fields")
        if kind == "VERSION_COUNTER":
            if value_type not in {"BIGINT", "INTEGER"}:
                self.error("VERSION_COUNTER_TYPE", ref, "version counter must be an integer")
            if not values and source.get("initialValue") != 1:
                self.error("VERSION_COUNTER_UNSEEDED", ref, "new version counter must explicitly start at one")
            if values and not any(value is not None and value.table is not None for value in values):
                self.error("VERSION_COUNTER_WITHOUT_CAS", ref, "next version must depend on persisted owner state")
        if kind == "OWNER_CLOCK_VALUE":
            if value_type not in {"TIMESTAMPTZ", "DATE"} or not any(
                    item in {"ownerClock.now", "ownerClock.localDate"} for item in inputs):
                self.error("OWNER_CLOCK_VALUE_INVALID", ref,
                           "owner clock projection needs an exact typed clock source")
        if kind == "DOMAIN_CONSTANT":
            constant = source.get("constantValue", source.get("value"))
            if (inputs or not isinstance(constant, str) or not constant
                    or re.fullmatch(r"[A-Z][A-Z0-9_]{1,79}", constant) is None
                    or not (value_type == "STRING"
                            or re.fullmatch(r"(?:VAR)?CHAR\(\d+\)", value_type))):
                self.error("DOMAIN_CONSTANT_INVALID", ref,
                           "domain constant must be a reviewed nonempty text code with no inputs")
        if kind == "AGGREGATE_COMPUTATION":
            computation = source.get("computation")
            if (not isinstance(computation, dict)
                    or computation.get("function") not in {
                        "COUNT_COMPLETED_TASKS", "COUNT_ACTIVE_NOMINATIONS",
                        "COUNT_REVOKED_GRANTS", "COUNT_UNRECONCILED_GRANTS",
                    }
                    or computation.get("table") not in self.allowed_tables
                    or computation.get("tenantSource") != "principal.tenantId"
                    or not any(value is not None and value.table == computation.get("table") for value in values)):
                self.error("AGGREGATE_COMPUTATION_INVALID", ref,
                           "aggregate computation needs reviewed function, exact owner table and tenant binding")
        if kind == "COLLECTION_CARDINALITY":
            bounds = source.get("bounds")
            if (value_type not in {"INTEGER", "BIGINT"} or len(inputs) != 1
                    or inputs[0] not in self.request
                    or normalize_type(self.request[inputs[0]].get("type", "")) != "ARRAY"
                    or not isinstance(bounds, dict) or bounds.get("minimum") != 1
                    or not isinstance(bounds.get("maximum"), int)):
                self.error("COLLECTION_CARDINALITY_INVALID", ref,
                           "collection count must derive from one validated bounded request array")
        if kind == "ARRAY_ORDINAL":
            request_array = (len(inputs) == 1 and inputs[0] in self.request
                             and normalize_type(self.request[inputs[0]].get("type", "")).startswith("ARRAY"))
            owner_array = (isinstance(source.get("ownerEntity"), str)
                           and isinstance(source.get("ownerField"), str)
                           and isinstance(source.get("purpose"), str)
                           and "principal.tenantId" in inputs
                           and any(item in self.request for item in inputs))
            if (value_type not in {"INTEGER", "BIGINT"}
                    or not (request_array or owner_array)
                    or source.get("initialValue") != 1
                    or not isinstance(source.get("maximum"), int)):
                self.error("ARRAY_ORDINAL_INVALID", ref,
                           "server line ordinal must be contiguous and bounded by a validated request/owner array")
        if kind == "COLLECTION_AGGREGATE":
            if not inputs or not all(item in self.request and "[]" in item for item in inputs):
                self.error("COLLECTION_AGGREGATE_INVALID", ref,
                           "collection aggregate must use exact expanded array-member paths")
        if kind == "OWNER_ENGINE_RESULT":
            engine_output = source.get("engineOutput")
            if (not isinstance(engine_output, str) or not engine_output
                    or not any(value is not None and value.table is not None for value in values)
                    or not any(value is not None and value.origin == "VALIDATED_REQUEST" for value in values)):
                self.error("OWNER_ENGINE_RESULT_INVALID", ref,
                           "engine output needs named result plus persisted owner input and validated request inputs")
        if kind == "OWNER_REFETCH_RESULT":
            if (not isinstance(source.get("ownerEntity"), str)
                    or not isinstance(source.get("ownerField"), str)
                    or not isinstance(source.get("purpose"), str)
                    or "principal.tenantId" not in inputs
                    or not any(value is not None and value.origin == "VALIDATED_REQUEST"
                               for value in values)):
                self.error("OWNER_REFETCH_RESULT_INVALID", ref,
                           "owner refetch needs exact entity/field/purpose, tenant and validated selector")
        if kind == "DOMAIN_TRANSFORM":
            if source.get("transformId") not in {
                    "TIMESTAMPTZ_TO_TENANT_LOCAL_DATE_V1", "TIMESTAMPTZ_TO_RFC3339_V1",
                    "DATE_TO_TENANT_START_INSTANT_V1"}:
                self.error("DOMAIN_TRANSFORM_UNREGISTERED", ref,
                           "only reviewed lossless/domain-explicit transforms are accepted")
        if kind == "GENERATED_BUSINESS_ID":
            generation = source.get("generation", {})
            persistence = generation.get("persistedAt", "") if isinstance(generation, dict) else ""
            persisted = self.resolve(persistence) if persistence else None
            if not (isinstance(generation, dict) and generation.get("algorithm") in {"UUID_V4", "UUID_V7"}
                    and generation.get("issuer") == "OWNER" and generation.get("lifecycle") == "CREATED_ONCE_REPLAY_STABLE"
                    and persisted is not None and normalize_type(persisted.value_type) == "UUID"
                    and persisted.table in set(self.operation.get("writesTables", [])) | {receipt.get("table") for receipt in self.receipts.values()}):
                self.error("GENERATED_ID_NOT_REPLAY_STABLE", ref, "owner-generated UUID needs exact existing persistence column and create-once/replay-stable lifecycle")
            binding = source.get("semanticBinding", {})
            identity = Identity(binding.get("entityType", ""), binding.get("idSpace", "")) if isinstance(binding, dict) else None
            if persisted is not None and persisted.identity != identity:
                self.error("GENERATED_ID_ENTITY_MISMATCH", ref, "generated business identity must match the actual persisted UUID column's entity")

    def check_projection(self, ref: str, source: dict[str, Any]) -> None:
        value_type = normalize_type(source.get("type", ""))
        if value_type == "ARRAY" and normalize_type(source.get("itemType", "")) == "UUID":
            return  # A canonical scalar UUID array is not an object projection.
        schema_ref = source.get("itemSchemaRef" if value_type == "ARRAY" else "schemaRef")
        schema = self.parent.schemas.get(schema_ref)
        if schema is None:
            self.error("PROJECTION_SCHEMA_UNRESOLVED", ref, "ARRAY/OBJECT needs an actual itemSchemaRef/schemaRef")
            return
        expected = {f"{schema_ref}.{field.get('name')}": field for field in schema.get("fields", [])}
        rows = source.get("fieldSources", [])
        actual = {row.get("target", ""): row for row in rows if isinstance(row, dict)}
        if len(actual) != len(rows) or set(actual) != set(expected):
            self.error("RECORD_PROJECTION_CLOSURE", ref, "nested/list record fields require complete, unique explicit source projection")
        inputs = set(source.get("inputs", []))
        for target, row in actual.items():
            field = expected.get(target)
            if field is None:
                continue
            if row.get("source") not in inputs:
                self.error("PROJECTION_INPUT_UNDECLARED", ref + "." + target, "field source must be an exact declared derivation input")
            self.check_row(target, row, field, "source")

    def check_binding(self, ref: str, row: dict[str, Any], target: Identity | None,
                      values: list[Value | None], typed_kind: str | None = None) -> None:
        valid_values = [value for value in values if value is not None]
        if any(value.trace for value in valid_values):
            # Detect the P0 even if the contract is also missing binding metadata.
            self.error("CORRELATION_AS_BUSINESS_ID", ref, "correlation/tracing metadata cannot originate or derive any business reference")
        binding = row.get("semanticBinding")
        if not isinstance(binding, dict):
            self.error("SEMANTIC_BINDING_MISSING", ref, "business reference requires explicit semanticBinding")
            return
        declared = Identity(binding.get("entityType", ""), binding.get("idSpace", ""))
        origin = binding.get("sourceKind")
        if (origin not in BUSINESS_SOURCE_KINDS or not declared.entity_type or declared.id_space not in {"PUBLIC_UUID", "INTERNAL_BIGINT"}
                or binding.get("tenantBound") is not True or binding.get("ownerValidated") is not True):
            self.error("SEMANTIC_BINDING_INVALID", ref, "requires exact business origin/entity/idSpace and true owner/tenant validation")
        if target is None:
            self.error("TARGET_ENTITY_UNDECLARED", ref, "target business reference needs independent FK/schema referenceContract identity")
        elif declared != target:
            self.error("TARGET_ENTITY_MISMATCH", ref, f"declared {declared} differs from independent target {target}")
        if origin == "GENERATED_BUSINESS_ID":
            if typed_kind != "GENERATED_BUSINESS_ID":
                self.error("GENERATED_ID_UNREGISTERED", ref, "generated business identity must resolve to a registered generated source")
            return
        identities = [value.identity for value in valid_values if value.identity is not None]
        resolution = row.get("resolution")
        owner_refetch = (
            typed_kind == "OWNER_REFETCH_RESULT"
            and origin == "REFETCHED_SNAPSHOT"
            and row.get("ownerEntity") == declared.entity_type
            and isinstance(row.get("ownerField"), str) and bool(row.get("ownerField"))
            and isinstance(row.get("purpose"), str) and bool(row.get("purpose"))
            and "principal.tenantId" in row.get("inputs", [])
        )
        if declared.id_space == "INTERNAL_BIGINT" and any(identity.entity_type == declared.entity_type and identity.id_space == "PUBLIC_UUID" for identity in identities):
            if not self.check_resolution(ref, resolution, declared):
                self.error("LOCAL_ID_RESOLUTION_MISSING", ref, "public UUID to internal FK needs exact tenant-bound public/internal column resolution")
        elif declared not in identities and not owner_refetch:
            self.error("SOURCE_ENTITY_MISMATCH", ref, "no exact resolved input identifies the declared target entity/idSpace; rule labels cannot change identity")
        if origin == "AUTHENTICATED_PRINCIPAL" and not any(value.origin == "AUTHENTICATED_PRINCIPAL" and value.identity == declared for value in valid_values):
            self.error("PRINCIPAL_PROVENANCE_MISMATCH", ref, "principal identity must originate in authenticated principal context")
        if origin == "VALIDATED_REQUEST" and not any(value.origin == "VALIDATED_REQUEST" and value.identity is not None and value.identity.entity_type == declared.entity_type for value in valid_values):
            self.error("REQUEST_PROVENANCE_MISMATCH", ref, "validated request identity must resolve to the same request business entity")
        if (origin in {"AGGREGATE_EXISTING", "REFETCHED_SNAPSHOT"}
                and not owner_refetch
                and not any(value.identity is not None and value.identity.entity_type == declared.entity_type
                            and value.origin in {"AGGREGATE_EXISTING", "REFETCHED_SNAPSHOT"}
                            for value in valid_values)):
            self.error("AGGREGATE_PROVENANCE_MISMATCH", ref, "existing/refetched identity needs actual tenant-owned aggregate source columns")

    def check_resolution(self, ref: str, resolution: Any, identity: Identity) -> bool:
        if not isinstance(resolution, dict) or resolution.get("kind") != "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL":
            return False
        name = resolution.get("table")
        table = self.parent.tables.get(name)
        if table is None or name not in self.allowed_tables or table.get("owner") != self.operation.get("session"):
            return False
        public = resolution.get("publicColumn")
        internal = resolution.get("internalColumn")
        if public not in table["columns"] or internal not in table["columns"]:
            return False
        return (identity == Identity("table:" + name, "INTERNAL_BIGINT")
                and self.parent.physical_identity(name, public) == Identity("table:" + name, "PUBLIC_UUID")
                and self.parent.physical_identity(name, internal) == identity
                and "tenant_id" in table["columns"] and resolution.get("tenantSource") == "principal.tenantId")

    def check_row(self, target: str, row: dict[str, Any], field: dict[str, Any], source_key: str,
                  target_identity: Identity | None = None, *, physical: bool = False) -> None:
        source = self.resolve(row.get(source_key, ""))
        expected_type = field.get("sqlType" if physical else "type", "")
        if normalize_type(row.get("sqlType" if physical else "type", "")) != normalize_type(expected_type):
            self.error("TARGET_TYPE_MISMATCH", target, "mapping type differs from actual target schema/column")
        business = business_type(field, physical=physical) or (target_identity is not None)
        if not physical:
            operation_id = self.operation.get("operationId", "")
            declared = declared_identity(field, operation_id)
            if self.parent.identity_registry and business:
                sealed = (self.parent.registry_identity("response", operation_id, target)
                          or self.parent.registry_identity("event", operation_id, target))
                if sealed is None:
                    self.error("PUBLIC_IDENTITY_TARGET_CLOSURE", target,
                               "public business target is absent from the sealed identity oracle")
                elif declared != sealed:
                    self.error("PUBLIC_IDENTITY_TARGET_CONFLICT", target,
                               "schema referenceContract differs from the sealed identity oracle")
                target_identity = target_identity or sealed
            else:
                target_identity = target_identity or declared
            shape_key = "itemSchemaRef" if normalize_type(expected_type) == "ARRAY" else "schemaRef"
            if normalize_type(expected_type) in {"ARRAY", "OBJECT"} and field.get(shape_key):
                definition = self.typed.get(row.get(source_key), {})
                if definition.get(shape_key) != field.get(shape_key):
                    self.error("PROJECTION_SOURCE_SHAPE_MISMATCH", target,
                               "object/list source must be an explicitly projected typed source for the exact target schema")
        if source is not None:
            resolution = row.get("resolution")
            can_resolve = target_identity is not None and target_identity.id_space == "INTERNAL_BIGINT" and self.check_resolution(target, resolution, target_identity)
            if not types_compatible(source.value_type, expected_type) and not (can_resolve and normalize_type(source.value_type) == "UUID"):
                self.error("SOURCE_TYPE_MISMATCH", target, f"source {source.value_type} is not losslessly compatible with target {expected_type}")
            if business:
                typed_kind = self.typed.get(row.get(source_key), {}).get("kind")
                self.check_binding(target, row, target_identity, [source], typed_kind)
            elif source.trace and not is_trace(target):
                self.error("CORRELATION_NON_METADATA_SINK", target, "tracing metadata may only populate tracing metadata")
            if source.identity is not None and source.identity.id_space == "INTERNAL_BIGINT" and not physical:
                self.error("INTERNAL_ID_EXPOSED", target, "public response/event cannot expose a local internal BIGINT identity")
        self.parent.counts["field_sources"] += 1

    def validate_exact_sets(self) -> None:
        """Close every public and physical field set before validating edges."""
        if self.lineage.get("mode") not in {None, self.operation.get("mode")}:
            self.error("LINEAGE_MODE_RELABEL", "mode", "lineage mode must equal its operation mode")

        def exact_rows(key: str, row_key: str, expected: set[str], code: str) -> None:
            rows = self.lineage.get(key)
            if not isinstance(rows, list):
                self.error(code, key, "mapping collection must be an explicit array")
                return
            actual = [row.get(row_key) for row in rows if isinstance(row, dict)]
            if len(actual) != len(rows) or len(actual) != len(set(actual)) or set(actual) != expected:
                self.error(code, key, "mapping targets must be unique and exactly close the authoritative field set")

        exact_rows("inputMappings", "source", set(self.request), "INPUT_MAPPING_CLOSURE")
        write_rows = self.lineage.get("writeSet", [])
        write_tables = set(self.operation.get("writesTables", []))
        if not isinstance(write_rows, list):
            self.error("WRITE_DISPOSITION_CLOSURE", "writeSet", "writeSet must be an explicit array")
            write_rows = []
        dispositions = {
            row.get("table"): row.get("disposition") for row in write_rows if isinstance(row, dict)
        }
        if (len(dispositions) != len(write_rows) or set(dispositions) != write_tables
                or any(value not in {"INSERT", "UPDATE", "APPEND", "APPEND_MANY", "UPSERT_CAS"}
                       for value in dispositions.values())):
            self.error("WRITE_DISPOSITION_CLOSURE", "writeSet",
                       "every writesTable needs one exact INSERT/UPDATE/APPEND/APPEND_MANY/UPSERT_CAS disposition")
        self.write_dispositions = dispositions
        required: set[str] = set()
        if self.operation.get("mode") == "COMMAND":
            for table_name in self.operation.get("writesTables", []):
                table = self.parent.tables.get(table_name)
                if table is None:
                    continue
                for column, field in table["columns"].items():
                    if field.get("nullable") is False and field.get("default") is None:
                        required.add(f"{table_name}.{column}")
        exact_rows("requiredColumnSources", "target", required, "REQUIRED_COLUMN_CLOSURE")

        response_ref = self.operation.get("responseSchemaRef")
        response_schema = self.parent.schemas.get(response_ref, {})
        response = {f"{response_ref}.{field.get('name')}" for field in response_schema.get("fields", [])}
        exact_rows("responseFieldSources", "target", response, "RESPONSE_FIELD_CLOSURE")

        event = {
            f"{event_name}.{field.get('name')}"
            for event_name in self.operation.get("eventNames", [])
            for field in self.parent.events.get(event_name, {}).get("fields", [])
        }
        exact_rows("eventFieldSources", "target", event, "EVENT_FIELD_CLOSURE")

        operation_capability = self.operation.get("capabilityId")
        for table_name in self.allowed_tables:
            table = self.parent.tables.get(table_name)
            if table is None or table.get("base"):
                continue
            capability = table.get("spec", {}).get("capabilityId")
            if operation_capability is not None and capability != operation_capability:
                self.error("CAPABILITY_TABLE_OWNERSHIP", table_name,
                           "table access must remain inside the exact capability, not merely its session")

    def validate_receipts(self) -> None:
        required = {"idColumn": "UUID", "tenantColumn": "BIGINT", "idempotencyColumn": "STRING", "requestDigestColumn": "SHA256", "callerColumn": "UUID"}
        for receipt in self.lineage.get("receiptContracts", []):
            if not isinstance(receipt, dict):
                self.error("RECEIPT_CONTRACT_INVALID", "receiptContracts", "receipt must be an object")
                continue
            ref, name = receipt.get("receiptId", ""), receipt.get("table")
            table = self.parent.tables.get(name)
            if not re.fullmatch(r"receipt\.[A-Za-z_][A-Za-z0-9_]*", str(ref)) or ref in self.receipts or table is None or self.operation.get("mode") != "COMMAND":
                self.error("RECEIPT_CONTRACT_INVALID", str(ref), "requires unique receipt.id, actual table and COMMAND operation")
                continue
            if table.get("owner") != self.operation.get("session"):
                self.error("RECEIPT_OWNER_MISMATCH", ref, "receipt table is outside the exact module owner")
            for key, value_type in required.items():
                col = table["columns"].get(receipt.get(key))
                if col is None or not types_compatible(col.get("sqlType", ""), value_type):
                    self.error("RECEIPT_COLUMN_INVALID", ref + "." + key, "must bind a real, correctly typed receipt column")
            id_column = receipt.get("idColumn")
            tenant_column = receipt.get("tenantColumn")
            primary_keys = {tuple(key) for key in table.get("primaryKeys", [])}
            unique_keys = {tuple(key) for key in table.get("uniqueKeys", [])}
            public_key_proven = (
                id_column in table["columns"]
                and tenant_column == "tenant_id"
                and normalize_type(table["columns"][id_column].get("sqlType", "")) == "UUID"
                and ((tenant_column, id_column) in unique_keys
                     or (tenant_column, id_column) in primary_keys)
            )
            if not public_key_proven:
                self.error("RECEIPT_PUBLIC_ID_INVALID", ref,
                           "receipt identity requires an exact ordered (tenant_id,id) UNIQUE/PK over the UUID")
            else:
                self.parent.receipt_public_ids.add((name, id_column))
            self.receipts[ref] = receipt
            self.allowed_tables.add(name)

    def validate(self) -> None:
        self.validate_exact_sets()
        self.validate_receipts()
        # Resolve every definition, including unused definitions. Dead source
        # declarations cannot conceal undefined columns, cycles or laundering.
        for ref in self.typed:
            self.resolve(ref)
        for ref, field in self.request.items():
            if business_type(field) and not ref.startswith("headers."):
                self.resolve(ref)
        for mapping in self.lineage.get("inputMappings", []):
            source_ref = mapping.get("source", "")
            value = self.resolve(source_ref)
            if value is None:
                continue
            if value.trace and mapping.get("objectReferenceMode") not in {"NONE", "TRACE_METADATA"}:
                self.error("CORRELATION_OBJECT_REFERENCE", source_ref, "correlation header is metadata, not an OPAQUE_PUBLIC_UUID business reference")
            for sink in mapping.get("sinks", []):
                target = sink.get("target", "")
                if sink.get("kind") == "TABLE_COLUMN":
                    if not isinstance(target, str) or not REF_RE.fullmatch(target):
                        self.error("SINK_COLUMN_MISSING", str(target), "TABLE_COLUMN sink needs actual table.column")
                        continue
                    table_name, column = target.split(".", 1)
                    table = self.parent.tables.get(table_name)
                    if table is None or column not in table["columns"]:
                        self.error("SINK_COLUMN_MISSING", target, "sink column does not exist")
                    elif table_name not in self.operation.get("writesTables", []):
                        self.error("SINK_TABLE_NOT_WRITTEN", target, "input sink is outside exact command writesTables")
                    else:
                        sink_value = value
                        value_source = sink.get("valueSource")
                        if value_source is not None:
                            transformed = self.resolve(value_source) if isinstance(value_source, str) else None
                            typed = self.typed.get(value_source, {}) if isinstance(value_source, str) else {}
                            if (transformed is None
                                    or typed.get("kind") != "DOMAIN_DERIVATION"
                                    or source_ref not in typed.get("inputs", [])
                                    or sink.get("transformationRuleId") != typed.get("ruleId")):
                                self.error(
                                    "PERSISTED_TRANSFORM_INVALID", target,
                                    "request-to-column transform needs one registered typed source, exact input and rule",
                                )
                            else:
                                sink_value = transformed
                        target_identity = self.parent.physical_identity(table_name, column)
                        # inputMappings and requiredColumnSources are separate
                        # graph edges. A correct column-source row cannot excuse
                        # a conflicting request->sink edge for the same column.
                        if target_identity is not None or business_type(table["columns"][column], physical=True):
                            self.check_binding(target, sink, target_identity, [sink_value], self.typed.get(value_source or source_ref, {}).get("kind"))
                        expected_type = table["columns"][column].get("sqlType", "")
                        can_resolve = target_identity is not None and self.check_resolution(target, sink.get("resolution"), target_identity)
                        if (sink_value is not None
                                and not types_compatible(sink_value.value_type, expected_type)
                                and not (can_resolve and normalize_type(sink_value.value_type) == "UUID")):
                            self.error("SOURCE_TYPE_MISMATCH", target, "request->sink edge is not type-compatible with the actual column")
                if value.trace and not (sink.get("kind") == "COMMAND_CONTROL" and is_trace(target)):
                    self.error("CORRELATION_NON_METADATA_SINK", str(target), "correlation input may only bind tracing command-control metadata")
        for row in self.lineage.get("requiredColumnSources", []):
            target = row.get("target", "")
            if not isinstance(target, str) or not REF_RE.fullmatch(target):
                self.error("SINK_COLUMN_MISSING", str(target), "column source needs actual table.column target")
                continue
            name, column = target.split(".", 1)
            table = self.parent.tables.get(name)
            if table is None or column not in table["columns"]:
                self.error("SINK_COLUMN_MISSING", target, "target column does not exist")
                continue
            if name not in self.operation.get("writesTables", []):
                self.error("SINK_TABLE_NOT_WRITTEN", target, "physical target is outside exact command writesTables")
            if self.write_dispositions.get(name) in {"INSERT", "APPEND"}:
                source_ref = row.get("sourcePath", "")
                typed = self.typed.get(source_ref, {})
                if (source_ref == target
                        or (typed.get("kind") == "AGGREGATE_SNAPSHOT"
                            and target in typed.get("inputs", []))):
                    self.error("INSERT_FROM_NONEXISTENT_PRESTATE", target,
                               "insert/append fields cannot be sourced from the row being created")
            self.check_row(target, row, table["columns"][column], "sourcePath", self.parent.physical_identity(name, column), physical=True)
        response_ref = self.operation.get("responseSchemaRef")
        schema = self.parent.schemas.get(response_ref, {})
        fields = {f"{response_ref}.{field.get('name')}": field for field in schema.get("fields", [])}
        for row in self.lineage.get("responseFieldSources", []):
            target = row.get("target", "")
            if target in fields:
                self.check_row(target, row, fields[target], "source")
        event_fields = {f"{event_name}.{field.get('name')}": field for event_name in self.operation.get("eventNames", [])
                        for field in self.parent.events.get(event_name, {}).get("fields", [])}
        for row in self.lineage.get("eventFieldSources", []):
            target = row.get("target", "")
            if target in event_fields:
                field_name = event_fields[target].get("name")
                if field_name in {"fromState", "toState", "fromStage", "toStage"}:
                    typed = self.typed.get(row.get("sourcePath"), {})
                    conditional_root = event_fields[target].get("sourceTransitionRootTable")
                    conditional_ok = (
                        isinstance(conditional_root, str)
                        and conditional_root in self.allowed_tables
                        and typed.get("kind") == "AGGREGATE_SNAPSHOT"
                        and typed.get("inputs") == [
                            conditional_root + "." + next(
                                (name for name in ("status", "state", "stage")
                                 if name in self.parent.tables[conditional_root]["columns"]),
                                "__missing_state__",
                            )
                        ]
                    )
                    event_name = target.rsplit(".", 1)[0]
                    event_schema = self.parent.events.get(event_name, {})
                    aggregate_field = next(
                        (item for item in event_schema.get("fields", [])
                         if item.get("name") == "aggregateId"),
                        {},
                    )
                    aggregate_source = aggregate_field.get("sourcePhysicalField", "")
                    physical_state_source = event_fields[target].get("sourcePhysicalField", "")
                    physical_post_ok = (
                        field_name in {"toState", "toStage"}
                        and event_fields[target].get("sourceKind") == "PHYSICAL_POST_STATE"
                        and typed.get("kind") == "AGGREGATE_SNAPSHOT"
                        and physical_state_source in typed.get("inputs", [])
                        and isinstance(aggregate_source, str)
                        and isinstance(physical_state_source, str)
                        and aggregate_source.endswith(".public_id")
                        and aggregate_source.split(".", 1)[0]
                            == physical_state_source.split(".", 1)[0]
                        and physical_state_source.rsplit(".", 1)[-1]
                            in {"status", "state", "stage"}
                    )
                    reviewed_none_ok = (
                        field_name in {"fromState", "fromStage"}
                        and event_fields[target].get("sourceOwnerContext") == "CONSTANT:NONE"
                        and typed.get("kind") == "DOMAIN_CONSTANT"
                        and typed.get("constantValue") == "NONE"
                    )
                    if (typed.get("kind") != "TRANSITION_STATE" and not conditional_ok
                            and not physical_post_ok and not reviewed_none_ok):
                        self.error("EVENT_STATE_WITHOUT_TRANSITION", target,
                                   "event state fields need an exact transition, event-root post state, or reviewed NONE pre-state")
                self.check_row(target, row, event_fields[target], "sourcePath")


def load_modern_capability_oracle() -> dict[str, Any]:
    """Read the independent G3 capability catalogue, never the exact schema."""
    from validate_modern_capability_contracts import (
        Validation, canonical_operation_and_table_maps, validate_contracts,
    )
    validation = Validation()
    capabilities, _ = validate_contracts(validation)
    operations, tables = canonical_operation_and_table_maps(capabilities)
    if validation.errors:
        raise ValueError("independent capability registry failed validation")
    operation_oracle: dict[str, dict[str, Any]] = {}
    transition_by_operation = {
        transition["operationId"]: transition
        for capability in capabilities.values()
        for machine in capability["stateMachines"]
        for transition in machine["transitions"]
    }
    for operation_id, (capability_id, operation) in operations.items():
        capability = capabilities[capability_id]
        operation_oracle[operation_id] = {
            "capabilityId": capability_id,
            "session": capability["session"],
            "mode": operation["mode"],
            "stateTransitionIds": operation["transitionIds"],
            "eventNames": operation["emits"],
            "transition": transition_by_operation.get(operation_id),
        }
    return {
        "operations": operation_oracle,
        "tables": {name: capability_id for name, (capability_id, _) in tables.items()},
    }


def validate_semantic_field_lineage(doc: dict[str, Any], events: dict[str, Any] | None = None,
                                    base_tables: dict[str, dict[str, Any]] | None = None, *,
                                    validation_mode: str = "READINESS",
                                    expected_operation_ids: tuple[str, ...] | None = None,
                                    expected_operation_count: int | None = None,
                                    capability_oracle: dict[str, Any] | None = None,
                                    semantic_registry: dict[str, Any] | None = None,
                                    identity_registry: dict[str, Any] | None = None) -> SemanticValidator:
    if not isinstance(doc, dict):
        result = SemanticValidator({}, validation_mode=validation_mode)
        result.issue("DOCUMENT_DIALECT_INVALID", "document", "canonical document must be an object")
        return result
    if capability_oracle is None and doc.get("contractId") == "dwp.hris.modern.exact-schema.v1":
        capability_oracle = load_modern_capability_oracle()
    if doc.get("contractId") == "dwp.hris.modern.exact-schema.v1":
        if semantic_registry is None:
            semantic_registry = json.loads(SEMANTIC_BINDINGS.read_text(encoding="utf-8"))
        if identity_registry is None:
            identity_registry = json.loads(PUBLIC_IDENTITIES.read_text(encoding="utf-8"))
    return SemanticValidator(doc, events, base_tables, validation_mode=validation_mode,
                             expected_operation_ids=expected_operation_ids,
                             expected_operation_count=expected_operation_count,
                             capability_oracle=capability_oracle,
                             semantic_registry=semantic_registry,
                             identity_registry=identity_registry).validate()


def run_semantic_self_tests() -> tuple[int, bool]:
    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_modern_semantic_field_lineage.py")
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    return result.testsRun, result.wasSuccessful()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_test_exit = 0
    if args.self_test:
        result = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", str(HERE),
                                 "-p", "test_modern_semantic_field_lineage.py", "-v"], check=False)
        self_test_exit = result.returncode
        print("MODERN_SEMANTIC_LINEAGE_SELF_TESTS=" + ("PASS" if self_test_exit == 0 else "FAIL"), flush=True)
    try:
        # This CLI audits the fixed canonical catalogue, not an arbitrary module
        # witness. Its expected IDs must come from the independent capability
        # registry rather than a clone of the document being checked.
        from validate_modern_capability_contracts import (
            Validation, canonical_operation_and_table_maps, validate_contracts,
        )
        registry = Validation()
        capabilities, _ = validate_contracts(registry)
        expected_operations, _ = canonical_operation_and_table_maps(capabilities)
        doc = json.loads(EXACT_SCHEMA.read_text(encoding="utf-8"))
        events = json.loads(EVENT_PAYLOAD.read_text(encoding="utf-8"))
        result = validate_semantic_field_lineage(
            doc, events, load_base_tables(), validation_mode="READINESS",
            expected_operation_ids=tuple(sorted(expected_operations)),
            expected_operation_count=len(expected_operations),
        )
        if registry.errors:
            result.issue("INDEPENDENT_OPERATION_REGISTRY_INVALID", "capabilityRegistry", "independent capability operation registry failed validation")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("MODERN_SEMANTIC_FIELD_LINEAGE=FAIL validator exception: " + str(exc))
        return 1
    status = "FAIL" if not result.readiness_pass or self_test_exit else "PASS"
    counts = Counter(issue.code for issue in result.errors)
    print(f"MODERN_SEMANTIC_FIELD_LINEAGE={status} errors={len(result.errors)} operations={result.counts['operations']} field_sources={result.counts['field_sources']} typed_sources={result.counts['typed_sources']}")
    if result.errors:
        print("ISSUE_COUNTS=" + json.dumps(dict(sorted(counts.items())), sort_keys=True))
        for issue in result.errors[:20] if args.compact else result.errors:
            print("- " + str(issue))
    return 1 if not result.readiness_pass or self_test_exit else 0


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
