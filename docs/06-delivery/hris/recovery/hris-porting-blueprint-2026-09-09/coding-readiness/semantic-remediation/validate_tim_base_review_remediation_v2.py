#!/usr/bin/env python3
"""Strict, read-only TIM author-subset successor. Never a G3/source approval.

The immutable v1 draft is a compatibility/topology witness, not canonical SQL or
an approved domain design. New dialects need explicit successor integration.
SQL below is parsed as data only. No file export, SQL execution, DB or servers.
Actual owner projection/assembler, source4+112, PEP and context policy stay OPEN.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BASE = HERE.parent.parent
FROZEN = {
    "tim-base-review-remediation.proposal.v1.json": "04a4785e199b9babc92ae71c0a35df282194bb97adccc7eb31579a602d2cc448",
    "tim-base-review-remediation.proposal.v1.md": "8289dea17e2d593882973768ea999374ef85f62d52f3cca485091b5a3274c600",
    "validate_tim_base_review_remediation.py": "76d2c5b45098062def03ceaa3ad71dfa271a9160cdfc8deebc5d688f87dbc3e4",
    "test_tim_base_review_remediation.py": "3c000aafa4f6b3d8d6f85cceb0f611ea0f2473d4fd395588262bd54435cfd218",
}
CANONICAL_SHA = "30e3fe74498ba265945970b4b68ab008bbce6108fc74169edd356e8d70f3bf81"
GRAPH_DIALECT = "TIM_REVIEW_OWNER_TRANSACTION_GRAPH_V2_NOT_CANONICAL"
APPLICATION_DIALECT = "UNSUPPORTED_BY_CANONICAL_ORACLE_UNTIL_ACTUAL_ADAPTER"
IDENT = r"[a-z][a-z0-9_]*"
SQL_TYPE = r"(?:BIGINT|INTEGER|BOOLEAN|UUID|TIMESTAMPTZ|DATE|JSONB|(?:VARCHAR|CHAR)\([1-9][0-9]*\)|NUMERIC\([1-9][0-9]*,[0-9]+\))"
MAX_INPUT_BYTES = 2 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verified_module(path, expected, name):
    if path.is_symlink() or not path.is_file() or sha(path.read_bytes()) != expected:
        raise ValueError("IMMUTABLE_WITNESS_CHANGED: " + path.name)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@lru_cache(maxsize=1)
def _cached_witnesses():
    for name, expected in FROZEN.items():
        path = HERE / name
        if path.is_symlink() or sha(path.read_bytes()) != expected:
            raise ValueError("IMMUTABLE_WITNESS_CHANGED: " + name)
    v1 = verified_module(HERE / "validate_tim_base_review_remediation.py",
                         FROZEN["validate_tim_base_review_remediation.py"], "tim_readonly_v1_witness")
    proposal, _, draft = v1.load_draft()
    canonical = verified_module(BASE / "coding-readiness/validate_modern_semantic_field_lineage.py",
                                CANONICAL_SHA, "tim_readonly_canonical_witness")
    return v1, proposal, draft, canonical.load_base_tables()


def witnesses():
    # Recheck bytes on every validation and do not hand out mutable cached
    # authority records. A previous caller cannot relabel the next oracle.
    for name, expected in FROZEN.items():
        path = HERE / name
        if path.is_symlink() or not path.is_file() or sha(path.read_bytes()) != expected:
            raise ValueError("IMMUTABLE_WITNESS_CHANGED: " + name)
    canonical_path = BASE / "coding-readiness/validate_modern_semantic_field_lineage.py"
    if canonical_path.is_symlink() or not canonical_path.is_file() or sha(canonical_path.read_bytes()) != CANONICAL_SHA:
        raise ValueError("IMMUTABLE_CANONICAL_WITNESS_CHANGED")
    module, proposal, draft, tables = _cached_witnesses()
    return module, copy.deepcopy(proposal), copy.deepcopy(draft), copy.deepcopy(tables)


def validate_envelope(proposal, reference, v1):
    if not isinstance(proposal, dict) or set(proposal) != v1.ENVELOPE_KEYS:
        raise ValueError("UNSUPPORTED_PROPOSAL_DIALECT: exact TIM author envelope required")
    for key in ("$schema", "contractId", "status", "G3Gate"):
        if proposal.get(key) != reference[key]:
            raise ValueError("ENVELOPE_IDENTITY_INVALID: " + key)
    if type(proposal.get("schemaVersion")) is not int or proposal["schemaVersion"] != reference["schemaVersion"]:
        raise ValueError("ENVELOPE_VERSION_INVALID")
    if proposal.get("CURRENT_PUBLISHED") is not False or proposal.get("independentPass") is not False:
        raise ValueError("SELF_APPROVAL_FORBIDDEN")
    if not isinstance(proposal.get("application"), dict) or not v1.json_equal(proposal["application"], reference["application"]):
        raise ValueError("APPLICATION_DIALECT_INVALID")
    if proposal["application"]["fieldGraphDialect"] != APPLICATION_DIALECT:
        raise ValueError("UNSUPPORTED_PROPOSAL_DIALECT")
    # Exact regular paths are checked before resolve; a symlink cannot disappear.
    if not v1.json_equal(proposal.get("originalPins"), reference["originalPins"]):
        raise ValueError("ORIGINAL_PIN_IDENTITY_INVALID")


def load_draft(path=None):
    v1, reference, _, _ = witnesses()
    source = Path(path) if path is not None else HERE / "tim-base-review-remediation.proposal.v1.json"
    raw = source.read_bytes()
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("INPUT_TOO_LARGE")
    proposal = v1.strict_loads(raw)
    validate_envelope(proposal, reference, v1)
    for pin in proposal["originalPins"].values():
        candidate = BASE / pin["path"]
        if candidate.is_symlink():
            raise ValueError("ORIGINAL_PIN_SYMLINK_FORBIDDEN")
    v1.verify_pins(proposal)
    original = v1.strict_loads((BASE / proposal["originalPins"]["json"]["path"]).read_bytes())
    changes = proposal["patch"]
    if isinstance(changes, list) and any(not isinstance(row, dict) for row in changes):
        raise ValueError("PATCH_OPERATION_OBJECT_REQUIRED")
    draft = v1.apply_patch_in_memory(original, changes)
    if v1.json_equal(original, draft):
        raise ValueError("PATCH_NO_EFFECT")
    return proposal, original, draft


def split_sql_items(text):
    """Balanced authored CREATE body; quotes preserved, no generic SQL parser."""
    items, start, depth, quoted, pos = [], 0, 0, False, 0
    while pos < len(text):
        char = text[pos]
        if quoted:
            if char == "'":
                if pos + 1 < len(text) and text[pos + 1] == "'":
                    pos += 1
                else:
                    quoted = False
        elif char == "'":
            quoted = True
        elif text[pos:pos + 2] in {"--", "/*", "*/"} or char in {';', '"', '$'}:
            raise ValueError("DDL_UNSUPPORTED_TOKEN")
        elif char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
            if depth < 0:
                raise ValueError("DDL_UNBALANCED")
        elif char == ',' and depth == 0:
            items.append(text[start:pos].strip())
            start = pos + 1
        pos += 1
    if depth or quoted:
        raise ValueError("DDL_UNBALANCED")
    items.append(text[start:].strip())
    if any(not item for item in items):
        raise ValueError("DDL_EMPTY_ITEM")
    return items


def normalized_sql(text):
    # Whitespace outside literals only; a different quoted value stays different.
    pieces = re.split(r"('(?:''|[^'])*')", text)
    return ''.join(piece if pos % 2 else re.sub(r"\s+", " ", piece).strip()
                   for pos, piece in enumerate(pieces))


def column_inventory(text):
    pattern = rf"({IDENT})\s+({SQL_TYPE})(?:\s+(.*))?"
    match = re.fullmatch(pattern, text)
    if not match:
        raise ValueError("DDL_COLUMN_SYNTAX_UNSUPPORTED")
    name, sql_type, tail = match.groups()
    tail = (tail or "").strip()
    primary = tail == "GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
    generated = primary
    nullable = not primary and not tail.startswith("NOT NULL")
    default = None
    if tail in {"", "NOT NULL", "GENERATED ALWAYS AS IDENTITY PRIMARY KEY"}:
        pass
    elif re.fullmatch(r"(?:NOT NULL )?DEFAULT (?:0|CURRENT_TIMESTAMP|pg_catalog\.gen_random_uuid\(\)|'(?:''|[^'])*')", tail):
        before, default = tail.split("DEFAULT ", 1)
        tail = before.strip()
    else:
        raise ValueError("DDL_COLUMN_CLAUSE_UNSUPPORTED")
    return name, {"sqlType": sql_type, "nullable": nullable, "generatedIdentity": generated,
                  "primaryKey": primary, "default": default}


def parse_create_table(sql):
    if not isinstance(sql, str):
        raise ValueError("DDL_STRING_REQUIRED")
    match = re.fullmatch(rf"\s*CREATE TABLE public\.({IDENT})\s*\((.*)\)\s*;\s*", sql, re.S)
    if not match:
        raise ValueError("DDL_CREATE_TABLE_REQUIRED")
    table, body = match.groups()
    columns, unique, checks, constraints = {}, [], [], set()
    for item in split_sql_items(body):
        if item.startswith("CONSTRAINT "):
            constraint = re.fullmatch(rf"CONSTRAINT ({IDENT}) (UNIQUE|CHECK)\s*\((.*)\)", item, re.S)
            if not constraint:
                raise ValueError("DDL_CONSTRAINT_UNSUPPORTED")
            name, kind, value = constraint.groups()
            if name in constraints:
                raise ValueError("DDL_DUPLICATE_CONSTRAINT")
            constraints.add(name)
            if kind == "UNIQUE":
                cols = [part.strip() for part in value.split(',')]
                if len(cols) != len(set(cols)) or not all(re.fullmatch(IDENT, col) for col in cols):
                    raise ValueError("DDL_UNIQUE_INVALID")
                unique.append(cols)
            else:
                checks.append(normalized_sql(value))
        else:
            name, inventory = column_inventory(item)
            if name in columns:
                raise ValueError("DDL_DUPLICATE_COLUMN")
            columns[name] = inventory
    if sum(row["primaryKey"] for row in columns.values()) != 1:
        raise ValueError("DDL_SINGLE_IDENTITY_PRIMARY_KEY_REQUIRED")
    if any(not set(cols) <= set(columns) for cols in unique):
        raise ValueError("DDL_UNIQUE_COLUMN_UNKNOWN")
    return {"table": table, "columns": columns, "uniqueKeys": unique, "checks": checks}


def unique_records(rows, key, label, errors):
    if not isinstance(rows, list) or not rows:
        errors.append({"code": label + "_REQUIRED", "where": key})
        return {}
    result = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get(key), str) or not row[key]:
            errors.append({"code": label + "_ID_INVALID", "where": key})
        elif row[key] in result:
            errors.append({"code": label + "_DUPLICATE", "where": row[key]})
        else:
            result[row[key]] = row
    return result


def sql_type(raw):
    return "BIGINT" if raw == "BIGSERIAL" else raw


def strict_checks(proposal, draft):
    v1, reference, oracle, base_tables = witnesses()
    errors = []
    def require(condition, code, where):
        if not condition:
            errors.append({"code": code, "where": where})
    try:
        validate_envelope(proposal, reference, v1)
    except (ValueError, TypeError, KeyError) as error:
        return {"errors": [{"code": str(error).split(':')[0], "where": "proposal"}], "counts": {},
                "wholeSourceClosure": False, "canonicalSqlApproved": False}
    if not isinstance(draft, dict):
        return {"errors": [{"code": "DRAFT_OBJECT_REQUIRED", "where": "draft"}]}
    require(set(draft) == set(oracle), "UNSUPPORTED_OR_MIXED_DRAFT_DIALECT", "draft.keys")
    tables = unique_records(draft.get("tableSpecifications"), "tableName", "TABLE", errors)
    expected_tables = {row["tableName"]: row for row in oracle["tableSpecifications"]}
    require(set(tables) == set(expected_tables), "TABLE_SCOPE_MISMATCH", "tableSpecifications")
    operations = unique_records(draft.get("operationDeltas"), "operationId", "OPERATION", errors)
    expected_ops = {row["operationId"] for row in oracle["operationDeltas"]}
    require(set(operations) == expected_ops, "OPERATION_SCOPE_MISMATCH", "operationDeltas")
    graphs = unique_records(draft.get("operationFieldLineage"), "operationId", "LINEAGE_OPERATION", errors)
    require(set(graphs) == expected_ops, "LINEAGE_SCOPE_MISMATCH", "operationFieldLineage")
    require(v1.json_equal(proposal.get("sourceRepairScope"), reference["sourceRepairScope"]),
            "SOURCE_OPEN_SCOPE_CHANGED", "sourceRepairScope")
    physical_columns = {name: row["columns"] for name, row in base_tables.items()}
    for name, table in tables.items():
        expected = expected_tables.get(name)
        if expected is None:
            continue
        columns = [table.get("idColumn")] + table.get("columns", [])
        indexed = unique_records(columns, "name", "COLUMN", errors)
        # Source ID-space is read from the immutable witness, never relabelled
        # by the same candidate metadata whose SQL is under inspection.
        physical_columns[name] = {col["name"]: col for col in [expected["idColumn"]] + expected["columns"]}
        try:
            parsed = parse_create_table(table["plannedCreateSql"])
            frozen = parse_create_table(expected["plannedCreateSql"])
            require(parsed["table"] == name, "DDL_TABLE_IDENTITY_MISMATCH", name)
            require(parsed == frozen, "DDL_PHYSICAL_INVENTORY_MISMATCH", name)
            require(set(parsed["columns"]) == set(indexed), "DDL_COLUMN_SCOPE_MISMATCH", name)
            require(parsed["uniqueKeys"] == table.get("uniqueKeys"), "DDL_UNIQUE_METADATA_MISMATCH", name)
            for col, value in indexed.items():
                actual = parsed["columns"].get(col)
                if actual is not None:
                    require(type(value.get("nullable")) is bool and actual["sqlType"] == value.get("sqlType")
                            and actual["nullable"] == value.get("nullable"),
                            "DDL_COLUMN_TYPE_NULLABILITY_MISMATCH", name + "." + col)
        except (ValueError, KeyError, TypeError) as error:
            errors.append({"code": "DDL_INVALID", "where": name, "message": str(error)})
        def relations(rows):
            return [{key: row.get(key) for key in ("columns", "targetTable", "targetColumns", "kind", "onDelete", "deferrable")}
                    for row in rows]
        require(v1.json_equal(relations(table.get("foreignKeys", [])), relations(expected["foreignKeys"])),
                "FK_SEMANTIC_PARENT_OR_POLICY_MISMATCH", name)
    for op_id, graph in graphs.items():
        is_detailed = op_id in v1.BOUNDED
        require(graph.get("dialect") == (GRAPH_DIALECT if is_detailed else None),
                "UNSUPPORTED_FIELD_GRAPH_DIALECT", op_id)
        if not is_detailed:
            continue  # Explicitly112 unresolved designs; no invented closure.
        leaves = unique_records(graph.get("sourceLeaves"), "source", "SOURCE_LEAF", errors)
        nodes = unique_records(graph.get("typedSources"), "source", "DERIVED_SOURCE", errors) if graph.get("typedSources") else {}
        for source, leaf in leaves.items():
            binding = leaf.get("binding")
            if not isinstance(binding, dict):
                continue
            table_name = binding.get("table")
            if table_name is not None:
                known = physical_columns.get(table_name)
                require(known is not None, "SOURCE_TABLE_UNKNOWN", op_id + ":" + source)
                columns = binding.get("columns", [binding["column"]] if "column" in binding else [])
                require(isinstance(columns, list) and len(columns) == len(set(columns)), "SOURCE_COLUMNS_INVALID", source)
                for col in columns if isinstance(columns, list) else []:
                    require(known is not None and col in known, "SOURCE_COLUMN_UNKNOWN", op_id + ":" + source + ":" + str(col))
                if source.startswith("returning.") and "column" in binding:
                    require(source == "returning." + str(table_name) + "." + str(binding["column"]),
                            "SOURCE_RETURNING_IDENTITY_MISMATCH", source)
                    if known and binding["column"] in known:
                        require(sql_type(leaf.get("type")) == sql_type(known[binding["column"]].get("sqlType")),
                                "SOURCE_SQL_TYPE_MISMATCH", source)
            target = binding.get("persistedTarget")
            if source.startswith("allocator."):
                parts = target.split('.') if isinstance(target, str) else []
                actual = physical_columns.get(parts[0], {}).get(parts[1]) if len(parts) == 2 else None
                require(actual is not None and actual.get("sqlType") == "UUID" and leaf.get("type") == "UUID",
                        "ALLOCATOR_PUBLIC_ID_TYPE_INVALID", source)
                require(source == "allocator." + str(target) and binding.get("issuer") == "TIM_OWNER"
                        and binding.get("algorithm") == "UUID_V7" and binding.get("tenantBound") is True
                        and binding.get("createdOnceReplayStable") is True, "ALLOCATOR_IDENTITY_INVALID", source)
        def ancestors(source, visiting=None):
            visiting = set() if visiting is None else visiting
            if source in visiting:
                return set()
            if source in leaves:
                return {source}
            node = nodes.get(source)
            if not node:
                return set()
            visiting = visiting | {source}
            return set().union(*(ancestors(child, visiting) for child in node.get("inputs", [])))
        for source, node in nodes.items():
            target = node.get("target", "")
            parts = target.split('.')
            actual = physical_columns.get(parts[0], {}).get(parts[1]) if len(parts) == 2 else None
            require(actual is not None, "NODE_TARGET_COLUMN_UNKNOWN", op_id + ":" + target)
            if actual:
                require(sql_type(node.get("type")) == sql_type(actual.get("sqlType")), "NODE_SQL_TYPE_MISMATCH", target)
            lineage = ancestors(source)
            if "headers.X-Correlation-ID" in lineage:
                require(len(parts) == 2 and parts[1] == "correlation_id", "TRACE_USED_AS_BUSINESS_SOURCE", target)
            if len(parts) == 2 and parts[1] in {"public_id", "event_id"}:
                require("allocator." + target in lineage, "BUSINESS_PUBLIC_ALLOCATOR_MISSING", target)
            if len(parts) == 2 and actual and actual.get("exposure") == "INTERNAL_ONLY":
                require("returning." + target in lineage, "INTERNAL_ID_RETURNING_MISMATCH", target)
    try:
        inherited = v1.subset_checks(proposal, draft)
        errors.extend({"code": "V1_STRUCTURAL_REJECT", "where": message} for message in inherited["errors"])
    except (ValueError, KeyError, TypeError, StopIteration, AttributeError) as error:
        errors.append({"code": "V1_STRUCTURAL_INPUT_INVALID", "where": type(error).__name__})
        inherited = {"counts": {}}
    return {"errors": errors, "counts": inherited.get("counts", {}), "declaredLocalColumnAndIdSpaceChecksOnly": True,
            "wholeSourceClosure": False, "canonicalSqlApproved": False}


def standard_schema_checks(proposal, draft):
    v1, _, _, _ = witnesses()
    program = v1.AJV.replace("new Ajv({allErrors:true", "new Ajv({format:'full',allErrors:true")
    program = program.replace("engine:'Ajv',version,engineDialect", "engine:'Ajv',version,nodeVersion:process.version,formatProfile:'full',engineDialect")
    result = subprocess.run(["node", "-e", program], input=json.dumps({"proposal": proposal, "draft": draft}),
                            text=True, capture_output=True, timeout=60, check=False)
    if not result.stdout.strip():
        raise ValueError("AJV_EXECUTION_FAILED")
    report = v1.strict_loads(result.stdout)
    report["processExitCode"] = result.returncode
    if result.returncode and not report.get("failures"):
        report.setdefault("failures", []).append({"processFailedWithoutSchemaDiagnostic": result.returncode})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proposal", type=Path)
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--require-g3", action="store_true")
    args = parser.parse_args()
    try:
        proposal, _, draft = load_draft(args.proposal)
        structural = strict_checks(proposal, draft)
        schemas = standard_schema_checks(proposal, draft)
        v1, _, _, _ = witnesses()
        hashes, oracle = v1.fixture_hash_checks(proposal), v1.canonical_oracle(draft)
        subset_pass = not structural["errors"] and not schemas["failures"]
        report = {"status": "AUTHOR_V2_STRICT_SUBSET_ONLY_NOT_APPROVED", "strictSubsetPass": subset_pass,
                  "readinessPass": False, "G3Gate": "CLOSED", "independentPass": False,
                  "structural": structural, "standardsSchema": schemas, "fixtureSubset": hashes,
                  "canonicalOracle": oracle, "remainingOpen": proposal["remainingOpen"],
                  "actualSource4And112Closure": False, "nativeDomainExecuted": False,
                  "materializedFileWritten": False, "SQLExecuted": False}
    except (ValueError, KeyError, TypeError, StopIteration, AttributeError, OSError,
            RecursionError, subprocess.TimeoutExpired) as error:
        subset_pass = False
        report = {"status": "FAIL_CLOSED", "strictSubsetPass": False, "readinessPass": False,
                  "G3Gate": "CLOSED", "errors": [{"code": str(error), "exceptionType": type(error).__name__}]}
    print(json.dumps(report, ensure_ascii=False, separators=(",", ":") if args.compact else None,
                     indent=None if args.compact else 2))
    return int(not subset_pass or args.require_g3)


if __name__ == "__main__":
    sys.exit(main())
