#!/usr/bin/env python3
"""Fail-closed validation for all 175 public HRIS transport schemas."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from collections import Counter
from typing import Any, Dict, Iterable, List, Optional, Tuple


HERE = pathlib.Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
REGISTER = HERE / "transport-schema-resolution-register.csv"
PEP_REGISTER = HERE / "api-pep-binding-register.csv"
PEP_VALIDATOR = HERE / "validate_api_pep_bindings.py"
BASELINE_MANIFEST = BLUEPRINT / "g0/integration-baseline-manifest.csv"
BASELINE_LINEAGE = BLUEPRINT / "g0/code-entry-baseline-lineage.csv"
DECIMAL_CONTRACT = HERE / "decimal-value-types.v1.json"
SHELL_NAVIGATION = HERE / "hris-shell-navigation-register.csv"
HOME_BROWSER_PEP_MATRIX = HERE / "home-browser-pep-matrix.csv"

FILES = {
    "HRM": HERE / "hrm-transport-schema-supplement.v1.json",
    "TIM": BLUEPRINT / "session-evidence/tim/g2-transport-schemas.v1.json",
    "PAY": BLUEPRINT / "session-evidence/pay/g2-transport-schemas.v1.json",
    "SYS": BLUEPRINT / "session-evidence/sys/g2-transport-schemas.v1.json",
}
SOURCE_FILES = {
    "HRM": BLUEPRINT / "session-evidence/hrm/g2-readiness/api-event-contracts.v1.json",
    "PER": BLUEPRINT / "session-evidence/per/g2-readiness/api-event-contracts.yaml",
    "TIM": BLUEPRINT / "session-evidence/tim/g2-api-event-contracts.json",
    "PAY": BLUEPRINT / "session-evidence/pay/g2-api-event-contracts.json",
    "SYS": BLUEPRINT / "session-evidence/sys/g2-contract-catalog.csv",
}
EXPECTED_BY_MODULE = {"HRM": 16, "PER": 21, "TIM": 28, "PAY": 33, "SYS": 77}
EXPECTED_PUBLIC_COUNT = 175
EXPECTED_RECEIPT_QUERIES = {"HRM": 1, "PER": 1, "TIM": 1, "PAY": 1, "SYS": 2}
DECIMAL_SHA256 = "8597640fa5cf5051cccc14fe4b83a4f179d54dfe36f0ffdaa319dc1149b5c6a6"
EXPECTED_IMPLEMENTATION = "NOT_STARTED_G3"
EXPECTED_PRODUCTION = "NOT_AUTHORIZED_G6"
EXPECTED_STATUS = "RESOLVED_EXACT"
BASELINE_SHA = "5670877de7a39e94e75021c7e23cbbb553296c90"
BASELINE_OPENAPI_SHA256 = "bd28185de73fa6018c4293b0d2a48353b78dcf789123be7e67216fa45f7999e0"
HOME_PATH = "/api/platform/v1/home-preferences/surfaces/{surfaceKey}"
HOME_DIGESTS = {
    "getOperation": "08610203c1ad6633aa483d5bc13a2a6da6029df9aa3328a30d288ae56e5f67bb",
    "putOperation": "732183110f512eb7d147eabae596cd4daed4aaf093bb9c10c12b9c94c50ce234",
    "request": "4064920532f47c0a40186995e129eeb35956b9741a67efef04b9e5450a6fd396",
    "response": "24f2b60a8930593bd1bf52bbdc601b5923b5ab1a59e17b0b8f529478d21fa83e",
}
HEADER = [
    "resolution_id", "module", "binding_id", "source_operation_id",
    "runtime_operation_id", "method", "path", "authorization_alias",
    "authorization_binding_ref", "source_contract", "source_operation_ref",
    "schema_mode", "transport_contract_ref", "path_schema_ref",
    "query_schema_ref", "request_schema_ref", "response_schema_ref",
    "error_schema_ref", "header_schema_ref", "validation_ref",
    "negative_test_ref", "implementation", "production", "status",
    "transport_shape_sha256",
]
ALLOWED_TYPES = {"object", "array", "string", "integer", "number", "boolean", "null"}
_DOCUMENT_CACHE: Dict[pathlib.Path, Any] = {}


class ValidationFailure(Exception):
    pass


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def read_csv(path: pathlib.Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_yaml(path: pathlib.Path) -> Any:
    try:
        import yaml  # type: ignore
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except ImportError:
        proc = subprocess.run(
            ["ruby", "-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.load_file(ARGV[0]))", str(path)],
            check=False, capture_output=True, text=True,
        )
        if proc.returncode != 0:
            raise ValidationFailure(f"cannot parse YAML {path}: {proc.stderr.strip()}")
        return json.loads(proc.stdout)


def load_document(path: pathlib.Path) -> Any:
    path = path.resolve()
    if path in _DOCUMENT_CACHE:
        return _DOCUMENT_CACHE[path]
    if path.suffix.lower() == ".json":
        with path.open(encoding="utf-8") as fh:
            value = json.load(fh)
    elif path.suffix.lower() in {".yaml", ".yml"}:
        value = load_yaml(path)
    elif path.suffix.lower() == ".csv":
        value = read_csv(path)
    elif path.suffix.lower() == ".md":
        value = path.read_text(encoding="utf-8")
    else:
        raise ValidationFailure(f"unsupported reference document: {path}")
    _DOCUMENT_CACHE[path] = value
    return value


def pointer_get(document: Any, fragment: str) -> Any:
    if fragment in {"", "#"}:
        return document
    if not fragment.startswith("#/"):
        raise ValidationFailure(f"not a JSON pointer: {fragment}")
    node = document
    for raw in fragment[2:].split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        try:
            node = node[int(token)] if isinstance(node, list) else node[token]
        except (KeyError, IndexError, ValueError, TypeError):
            raise ValidationFailure(f"unknown JSON pointer {fragment} at {token}")
    return node


def baseline_context() -> Tuple[pathlib.Path, Dict[str, str]]:
    rows = read_csv(BASELINE_MANIFEST)
    row = next((r for r in rows if r["repository"] == "DWP_BACKEND"), None)
    if row is None:
        raise ValidationFailure("DWP_BACKEND missing from integration baseline manifest")
    lineage_rows = read_csv(BASELINE_LINEAGE)
    lineage = next(
        (r for r in lineage_rows if r["repository"] == "DWP_BACKEND"), None
    )
    if lineage is None:
        raise ValidationFailure("DWP_BACKEND code-entry lineage missing")
    if (
        lineage["characterization_head_sha"] != BASELINE_SHA
        or lineage["code_entry_head_sha"] != row["integration_head_sha"]
        or lineage["lineage_state"] != "VERIFIED_CODE_ENTRY_SEAL"
    ):
        raise ValidationFailure("backend characterization/code-entry lineage drift")
    root = pathlib.Path(row["integration_worktree"])
    proc = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True)
    if proc.returncode != 0 or proc.stdout.strip() != lineage["code_entry_head_sha"]:
        raise ValidationFailure("code-entry backend worktree HEAD drift")
    ancestry = subprocess.run(
        ["git", "-C", str(root), "merge-base", "--is-ancestor", BASELINE_SHA, lineage["code_entry_head_sha"]],
        capture_output=True,
        text=True,
    )
    if ancestry.returncode != 0:
        raise ValidationFailure("characterization predecessor is not an ancestor of code entry")
    transport_unchanged = subprocess.run(
        [
            "git", "-C", str(root), "diff", "--quiet",
            BASELINE_SHA, lineage["code_entry_head_sha"], "--",
            "contracts/openapi/gateway-public.json",
        ],
        capture_output=True,
        text=True,
    )
    if transport_unchanged.returncode != 0:
        raise ValidationFailure("pinned characterization transport changed in successor baseline")
    return root, row


def split_ref(ref: str) -> Tuple[str, str]:
    if "#" not in ref:
        return ref, ""
    file_part, fragment = ref.split("#", 1)
    return file_part, "#" + fragment


def resolve_reference(
    ref: str,
    current_path: pathlib.Path,
    current_document: Any,
    baseline_root: pathlib.Path,
) -> Tuple[Any, pathlib.Path, Any]:
    if ref == "NONE":
        return None, current_path, current_document
    file_part, fragment = split_ref(ref)
    if file_part.startswith("DWP_BACKEND@"):
        prefix, repo_path = file_part.split(":", 1)
        sha = prefix.split("@", 1)[1]
        if sha != BASELINE_SHA:
            raise ValidationFailure(f"wrong baseline SHA in ref: {ref}")
        path = (baseline_root / repo_path).resolve()
        if baseline_root.resolve() not in path.parents:
            raise ValidationFailure(f"baseline ref escapes worktree: {ref}")
    elif file_part.startswith("contracts/"):
        path = (baseline_root / file_part).resolve()
    elif file_part:
        path = (current_path.parent / file_part).resolve()
    else:
        path = current_path
    if not path.is_file():
        raise ValidationFailure(f"reference file missing: {ref} -> {path}")
    doc = current_document if path == current_path else load_document(path)
    if path.suffix.lower() == ".md":
        return doc, path, doc
    if path.suffix.lower() == ".csv" and fragment and not fragment.startswith("#/"):
        terms = dict(x.split("=", 1) for x in fragment[1:].split("&"))
        matches = []
        for row in doc:
            if row.get("contract_id") != terms.get("contract_id"):
                continue
            method = terms.get("method")
            if method and method not in row.get("operation_or_version", "").split("|"):
                continue
            matches.append(row)
        if len(matches) != 1:
            raise ValidationFailure(f"CSV selector must resolve once: {ref} ({len(matches)})")
        return matches[0], path, doc
    return pointer_get(doc, fragment), path, doc


def chase_schema(
    value: Any,
    path: pathlib.Path,
    document: Any,
    baseline_root: pathlib.Path,
    seen: Optional[set] = None,
) -> Tuple[Any, pathlib.Path, Any]:
    seen = seen or set()
    while isinstance(value, dict) and set(value) == {"$ref"}:
        key = (str(path), value["$ref"])
        if key in seen:
            raise ValidationFailure(f"cyclic schema ref: {key}")
        seen.add(key)
        value, path, document = resolve_reference(value["$ref"], path, document, baseline_root)
    return value, path, document


def materialize(value: Any, path: pathlib.Path, document: Any, baseline_root: pathlib.Path, seen: Optional[set] = None) -> Any:
    """Dereference a schema/operation into a canonical finite value for digesting."""
    seen = set() if seen is None else set(seen)
    if isinstance(value, dict) and set(value) == {"$ref"}:
        key = (str(path), value["$ref"])
        if key in seen:
            return {"$recursiveRef": value["$ref"]}
        target, target_path, target_doc = resolve_reference(value["$ref"], path, document, baseline_root)
        seen.add(key)
        return materialize(target, target_path, target_doc, baseline_root, seen)
    if isinstance(value, dict):
        return {key: materialize(child, path, document, baseline_root, seen) for key, child in sorted(value.items())}
    if isinstance(value, list):
        return [materialize(child, path, document, baseline_root, seen) for child in value]
    return value


def walk_schema_refs(value: Any, path: pathlib.Path, document: Any, baseline_root: pathlib.Path) -> None:
    if isinstance(value, dict):
        if "$ref" in value:
            target, target_path, target_doc = resolve_reference(value["$ref"], path, document, baseline_root)
            if target is None:
                raise ValidationFailure(f"schema $ref resolves null: {value['$ref']}")
            # Resolution is sufficient here; recursive cycles are legal in JSON Schema.
        for child in value.values():
            walk_schema_refs(child, path, document, baseline_root)
    elif isinstance(value, list):
        for child in value:
            walk_schema_refs(child, path, document, baseline_root)


def validate_schema_shape(value: Any, where: str, errors: List[str]) -> None:
    if isinstance(value, dict):
        if "allOf" in value:
            errors.append(f"{where}: allOf forbidden in local transport schemas (closed-object unsatisfiability risk)")
        if "type" in value and isinstance(value["type"], (str, list)):
            types = value["type"] if isinstance(value["type"], list) else [value["type"]]
            if not types or any(t not in ALLOWED_TYPES for t in types):
                errors.append(f"{where}: unknown schema type {value['type']!r}")
        if value.get("type") == "object":
            props = value.get("properties")
            required = value.get("required")
            if not isinstance(props, dict) or not isinstance(required, list):
                errors.append(f"{where}: object must declare properties and required")
            elif not set(required).issubset(props):
                errors.append(f"{where}: required fields are not a subset of properties")
            if value.get("additionalProperties") is not False:
                errors.append(f"{where}: local object must be closed with additionalProperties=false")
        for key, child in value.items():
            validate_schema_shape(child, f"{where}/{key}", errors)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            validate_schema_shape(child, f"{where}/{i}", errors)


def mini_validate(instance: Any, schema: Any, path: pathlib.Path, document: Any, baseline_root: pathlib.Path, at: str = "$") -> None:
    schema, path, document = chase_schema(schema, path, document, baseline_root)
    if not isinstance(schema, dict):
        raise ValidationFailure(f"{at}: schema is not an object")
    if "oneOf" in schema:
        accepted = 0
        for branch in schema["oneOf"]:
            try:
                mini_validate(instance, branch, path, document, baseline_root, at)
                accepted += 1
            except ValidationFailure:
                pass
        if accepted != 1:
            raise ValidationFailure(f"{at}: oneOf accepted {accepted} branches")
    types = schema.get("type")
    if types is not None:
        types = types if isinstance(types, list) else [types]
        ok = any(
            (t == "null" and instance is None) or
            (t == "object" and isinstance(instance, dict)) or
            (t == "array" and isinstance(instance, list)) or
            (t == "string" and isinstance(instance, str)) or
            (t == "integer" and isinstance(instance, int) and not isinstance(instance, bool)) or
            (t == "number" and isinstance(instance, (int, float)) and not isinstance(instance, bool)) or
            (t == "boolean" and isinstance(instance, bool))
            for t in types
        )
        if not ok:
            raise ValidationFailure(f"{at}: instance type rejected by {types}")
    if "enum" in schema and instance not in schema["enum"]:
        raise ValidationFailure(f"{at}: value outside enum")
    if "const" in schema and instance != schema["const"]:
        raise ValidationFailure(f"{at}: value differs from const")
    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0) or len(instance) > schema.get("maxLength", 10**9):
            raise ValidationFailure(f"{at}: string length rejected")
        if "pattern" in schema and re.fullmatch(schema["pattern"], instance) is None:
            raise ValidationFailure(f"{at}: string pattern rejected")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if instance < schema.get("minimum", instance) or instance > schema.get("maximum", instance):
            raise ValidationFailure(f"{at}: numeric range rejected")
    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0) or len(instance) > schema.get("maxItems", 10**9):
            raise ValidationFailure(f"{at}: array length rejected")
        for i, child in enumerate(instance):
            mini_validate(child, schema.get("items", {}), path, document, baseline_root, f"{at}/{i}")
    if isinstance(instance, dict):
        props = schema.get("properties", {})
        missing = set(schema.get("required", [])) - set(instance)
        if missing:
            raise ValidationFailure(f"{at}: missing required {sorted(missing)}")
        if schema.get("additionalProperties") is False and not set(instance).issubset(props):
            raise ValidationFailure(f"{at}: additional properties {sorted(set(instance)-set(props))}")
        for key, child in instance.items():
            if key in props:
                mini_validate(child, props[key], path, document, baseline_root, f"{at}/{key}")
    if "if" in schema:
        condition_matches = True
        try:
            mini_validate(instance, schema["if"], path, document, baseline_root, at)
        except ValidationFailure:
            condition_matches = False
        if condition_matches and "then" in schema:
            mini_validate(instance, schema["then"], path, document, baseline_root, at)
        if not condition_matches and "else" in schema:
            mini_validate(instance, schema["else"], path, document, baseline_root, at)


def local_operation(bundle: Dict[str, Any], module: str, oid: str, method: str) -> Dict[str, Any]:
    key = oid
    if module == "SYS" and oid in {"SYS-API-017", "SYS-API-021"}:
        key = f"{oid}.{method}"
    try:
        return bundle["operations"][key]
    except KeyError:
        raise ValidationFailure(f"{module} local operation missing: {oid}/{method}")


def source_operation(module: str, oid: str, method: str, sources: Dict[str, Any]) -> Dict[str, Any]:
    if module == "HRM":
        matches = [o for o in sources[module]["endpoints"] if o["operationId"] == oid and o["method"] == method]
    elif module in {"TIM", "PAY"}:
        matches = [o for o in sources[module]["operations"] if o["id"] == oid and o["method"] == method]
    elif module == "PER":
        matches = []
        for path, item in sources[module]["paths"].items():
            op = item.get(method.lower())
            if op and op.get("operationId") == oid:
                matches.append(dict(op, _path=path))
    else:
        matches = [r for r in sources[module] if r["contract_id"] == oid and method in r["operation_or_version"].split("|")]
    if len(matches) != 1:
        raise ValidationFailure(f"source operation must resolve once: {module}/{oid}/{method} ({len(matches)})")
    return matches[0]


def resolved_schema(row: Dict[str, str], field: str, baseline_root: pathlib.Path) -> Tuple[Any, pathlib.Path, Any]:
    value, path, doc = resolve_reference(row[field], HERE / "_register_anchor", {}, baseline_root)
    return chase_schema(value, path, doc, baseline_root)


def operation_shape_digest(
    row: Dict[str, str],
    bundles: Dict[str, Dict[str, Any]],
    baseline_root: pathlib.Path,
) -> str:
    fields = ["path_schema_ref", "query_schema_ref", "request_schema_ref", "response_schema_ref", "error_schema_ref", "header_schema_ref"]
    shape: Dict[str, Any] = {
        "module": row["module"],
        "operationId": row["source_operation_id"],
        "runtimeOperationId": row["runtime_operation_id"],
        "method": row["method"],
        "path": row["path"],
        "authorizationAlias": row["authorization_alias"],
        "schemaMode": row["schema_mode"],
    }
    is_local = row["module"] in bundles and row["source_operation_id"] not in {"SYS-API-031", "SYS-API-032"}
    if is_local:
        bundle = bundles[row["module"]]
        op = local_operation(bundle, row["module"], row["source_operation_id"], row["method"])
        local_names = {
            "path_schema_ref": "pathSchema",
            "query_schema_ref": "querySchema",
            "request_schema_ref": "requestBodySchema",
            "response_schema_ref": "responseSchema",
            "error_schema_ref": "errorSchema",
            "header_schema_ref": "headerSchema",
        }
        for field in fields:
            shape[field] = materialize(op.get(local_names[field]), FILES[row["module"]], bundle, baseline_root)
    else:
        for field in fields:
            value, path, doc = resolve_reference(row[field], HERE / "_register_anchor", {}, baseline_root)
            shape[field] = materialize(value, path, doc, baseline_root)
        if row["module"] == "SYS":
            bundle = bundles["SYS"]
            op = local_operation(bundle, "SYS", row["source_operation_id"], row["method"])
            shape["error_schema_ref"] = materialize(op.get("errorSchema"), FILES["SYS"], bundle, baseline_root)
            shape["fixedSurfaceKey"] = op.get("fixedSurfaceKey")
            shape["exceptionType"] = op.get("exceptionType")
    return canonical_digest(shape)


def run_pep_validator(errors: List[str]) -> bool:
    proc = subprocess.run([sys.executable, str(PEP_VALIDATOR)], cwd=str(BLUEPRINT), capture_output=True, text=True)
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        payload = {}
    passed = proc.returncode == 0 and payload.get("status") == "PASS"
    if not passed:
        errors.append("standalone API PEP validator did not PASS")
    return passed


def validate(
    rows: Optional[List[Dict[str, str]]] = None,
    bundles: Optional[Dict[str, Dict[str, Any]]] = None,
    check_pep: bool = True,
) -> Dict[str, Any]:
    errors: List[str] = []
    try:
        baseline_root, _ = baseline_context()
    except ValidationFailure as exc:
        baseline_root = pathlib.Path("/__invalid_baseline__")
        errors.append(str(exc))
    rows = copy.deepcopy(rows if rows is not None else read_csv(REGISTER))
    pep = read_csv(PEP_REGISTER)
    bundles = copy.deepcopy(bundles if bundles is not None else {m: load_document(p) for m, p in FILES.items()})
    sources = {m: load_document(p) for m, p in SOURCE_FILES.items()}
    if check_pep:
        pep_pass = run_pep_validator(errors)
    else:
        pep_pass = True

    if rows and list(rows[0]) != HEADER:
        errors.append("register header drift")
    if len(rows) != EXPECTED_PUBLIC_COUNT:
        errors.append(f"register count {len(rows)} != {EXPECTED_PUBLIC_COUNT}")
    by_module = Counter(r.get("module", "") for r in rows)
    if dict(by_module) != EXPECTED_BY_MODULE:
        errors.append(f"module counts drift: {dict(by_module)}")
    for fields, label in [(["resolution_id"], "resolution id"), (["binding_id"], "binding id"), (["module", "source_operation_id", "method", "path"], "operation")]:
        keys = [tuple(r.get(f, "") for f in fields) for r in rows]
        if len(keys) != len(set(keys)):
            errors.append(f"duplicate {label}")

    pep_by_id = {r["binding_id"]: r for r in pep}
    if len(pep_by_id) != EXPECTED_PUBLIC_COUNT:
        errors.append("API PEP binding count/uniqueness drift")
    for row in rows:
        bid = row.get("binding_id", "")
        pr = pep_by_id.get(bid)
        if pr is None:
            errors.append(f"{bid}: orphan transport row")
            continue
        for left, right in [("module", "module"), ("source_operation_id", "source_operation_id"), ("method", "method"), ("path", "contract_path"), ("authorization_alias", "source_authorization_alias")]:
            if row.get(left) != pr.get(right):
                errors.append(f"{bid}: {left} differs from API PEP")
        if row.get("authorization_binding_ref") != f"api-pep-binding-register.csv#binding_id={bid}":
            errors.append(f"{bid}: authorization binding ref drift")
        if row.get("implementation") != EXPECTED_IMPLEMENTATION or row.get("production") != EXPECTED_PRODUCTION or row.get("status") != EXPECTED_STATUS:
            errors.append(f"{bid}: readiness state drift")
        try:
            actual_shape_digest = operation_shape_digest(row, bundles, baseline_root)
            if row.get("transport_shape_sha256") != actual_shape_digest:
                errors.append(f"{bid}: transport shape digest drift")
        except ValidationFailure as exc:
            errors.append(f"{bid}: transport shape digest resolution failed: {exc}")
        for field in ["source_operation_ref", "path_schema_ref", "query_schema_ref", "request_schema_ref", "response_schema_ref", "error_schema_ref", "header_schema_ref", "validation_ref", "negative_test_ref"]:
            if not row.get(field):
                errors.append(f"{bid}: empty {field}")
                continue
            try:
                value, _, _ = resolve_reference(row[field], HERE / "_register_anchor", {}, baseline_root)
                if field not in {"query_schema_ref", "request_schema_ref"} and value is None:
                    errors.append(f"{bid}: {field} resolves null")
            except (ValidationFailure, OSError, json.JSONDecodeError) as exc:
                errors.append(f"{bid}: {field}: {exc}")
        try:
            sop = source_operation(row["module"], row["source_operation_id"], row["method"], sources)
            resolved, _, _ = resolve_reference(row["source_operation_ref"], HERE / "_register_anchor", {}, baseline_root)
            if row["module"] == "SYS":
                if resolved.get("contract_id") != row["source_operation_id"] or row["method"] not in resolved.get("operation_or_version", "").split("|"):
                    errors.append(f"{bid}: SYS source selector mismatch")
            elif row["module"] == "PER":
                if resolved.get("operationId") != row["source_operation_id"]:
                    errors.append(f"{bid}: PER source operation pointer mismatch")
            elif resolved is not sop and resolved != sop:
                errors.append(f"{bid}: source operation pointer mismatch")
        except ValidationFailure as exc:
            errors.append(f"{bid}: {exc}")

        if row["module"] in bundles:
            bundle = bundles[row["module"]]
            try:
                op = local_operation(bundle, row["module"], row["source_operation_id"], row["method"])
                if op.get("method") != row["method"] or op.get("path") != row["path"] or op.get("authorization") != row["authorization_alias"]:
                    errors.append(f"{bid}: local operation method/path/authorization mismatch")
                if row["source_operation_id"] not in {"SYS-API-031", "SYS-API-032"}:
                    p_schema, p_path, p_doc = chase_schema(op.get("pathSchema"), FILES[row["module"]], bundle, baseline_root)
                    placeholders = set(re.findall(r"{([^}]+)}", op["path"]))
                    if not isinstance(p_schema, dict) or placeholders != set(p_schema.get("required", [])) or placeholders != set(p_schema.get("properties", {})):
                        errors.append(f"{bid}: path placeholder/property/required exact-set mismatch")
                    if op.get("mode") == "query":
                        q_schema, _, _ = chase_schema(op.get("querySchema"), FILES[row["module"]], bundle, baseline_root)
                        source_has_no_query = row["module"] == "HRM" and not source_operation("HRM", row["source_operation_id"], row["method"], sources).get("query", [])
                        if q_schema is None and source_has_no_query:
                            pass
                        elif not isinstance(q_schema, dict) or q_schema.get("type") != "object":
                            errors.append(f"{bid}: query schema not exact object")
                        if isinstance(op.get("querySchema"), dict) and op["querySchema"].get("$ref") == "#/$defs/Query":
                            errors.append(f"{bid}: generic shared Query ref forbidden")
                    if op.get("mode") == "command":
                        h_schema, _, _ = chase_schema(op.get("headerSchema"), FILES[row["module"]], bundle, baseline_root)
                        required = set(h_schema.get("required", [])) if isinstance(h_schema, dict) else set()
                        if "Idempotency-Key" not in required:
                            errors.append(f"{bid}: local command lacks required Idempotency-Key")
                        receipt, _, _ = chase_schema(op.get("responseSchema"), FILES[row["module"]], bundle, baseline_root)
                        rr = set(receipt.get("required", [])) if isinstance(receipt, dict) else set()
                        direct_validation_response = row["module"] == "HRM" and row["source_operation_id"] == "validateAssignmentEvent"
                        if not direct_validation_response and (not {"receiptId", "status"}.issubset(rr) or not ({"requestDigest", "requestHash"} & rr) or not ({"createdAt", "receivedAt"} & rr)):
                            errors.append(f"{bid}: command response is not a durable receipt")
            except ValidationFailure as exc:
                errors.append(f"{bid}: {exc}")

    # No API PEP row may be missing from the transport register.
    if set(pep_by_id) != {r.get("binding_id") for r in rows}:
        errors.append("API PEP/transport orphan set mismatch")

    # Local schema structural and reference closure.
    for module, bundle in bundles.items():
        path = FILES[module]
        if bundle.get("implementation") != EXPECTED_IMPLEMENTATION or bundle.get("production") != EXPECTED_PRODUCTION:
            errors.append(f"{module}: bundle readiness state drift")
        validate_schema_shape(bundle.get("$defs", {}), f"{module}#/$defs", errors)
        try:
            walk_schema_refs(bundle, path, bundle, baseline_root)
        except ValidationFailure as exc:
            errors.append(f"{module}: {exc}")
        problem = bundle.get("$defs", {}).get("Problem", {})
        expected_problem_required = {"type", "title", "status", "code", "correlationId", "retryable"}
        if set(problem.get("required", [])) != expected_problem_required:
            errors.append(f"{module}: Problem required-field contract drift")
        if problem.get("properties", {}).get("status", {}).get("type") != "integer":
            errors.append(f"{module}: Problem.status type contract drift")
        query_refs = []
        for key, op in bundle.get("operations", {}).items():
            if op.get("mode") == "query" and isinstance(op.get("querySchema"), dict):
                query_refs.append(op["querySchema"].get("$ref"))
        if len(query_refs) != len(set(query_refs)):
            errors.append(f"{module}: operation-specific query schema ref reused")

    # HRM source-query exactness and source-required preservation.
    hrm_bundle = bundles["HRM"]
    for row in [r for r in rows if r["module"] == "HRM"]:
        src = source_operation("HRM", row["source_operation_id"], row["method"], sources)
        op = local_operation(hrm_bundle, "HRM", row["source_operation_id"], row["method"])
        expected_query = set(src.get("query", []))
        if op.get("querySchema") is None:
            actual_query = set()
        else:
            q, _, _ = chase_schema(op["querySchema"], FILES["HRM"], hrm_bundle, baseline_root)
            actual_query = set(q.get("properties", {})) if isinstance(q, dict) else set()
        if actual_query != expected_query:
            errors.append(f"{row['binding_id']}: HRM source/local query field exact-set mismatch")
        request_name = src.get("request")
        if request_name in sources["HRM"].get("schemas", {}):
            local, _, _ = chase_schema(op.get("requestBodySchema"), FILES["HRM"], hrm_bundle, baseline_root)
            if set(local.get("required", [])) != set(sources["HRM"]["schemas"][request_name].get("required", [])):
                errors.append(f"{row['binding_id']}: HRM source required-field drift for {request_name}")

    # PER actual OpenAPI schema roots must resolve to typed schemas with explicit required sets.
    per_doc = sources["PER"]
    for row in [r for r in rows if r["module"] == "PER"]:
        for field in ["request_schema_ref", "response_schema_ref", "error_schema_ref"]:
            if row[field] == "NONE":
                continue
            try:
                schema, _, _ = resolved_schema(row, field, baseline_root)
                if not isinstance(schema, dict) or not ({"type", "allOf", "oneOf", "anyOf"} & set(schema)):
                    errors.append(f"{row['binding_id']}: PER {field} lacks exact type")
                if schema.get("type") == "object" and "properties" not in schema:
                    errors.append(f"{row['binding_id']}: PER {field} lacks properties")
            except ValidationFailure as exc:
                errors.append(f"{row['binding_id']}: PER {field}: {exc}")

    # Pinned HomePreference baseline and the single named exception.
    sys_bundle = bundles["SYS"]
    try:
        openapi_path = baseline_root / sys_bundle["baseline"]["openapi"]
        if sys_bundle["baseline"].get("sourceHeadSha") != BASELINE_SHA:
            errors.append("SYS baseline sourceHeadSha drift")
        if sha256_file(openapi_path) != BASELINE_OPENAPI_SHA256 or sys_bundle["baseline"].get("openapiSha256") != BASELINE_OPENAPI_SHA256:
            errors.append("SYS baseline OpenAPI file digest drift")
        openapi = load_document(openapi_path)
        get_op = openapi["paths"][HOME_PATH]["get"]
        put_op = openapi["paths"][HOME_PATH]["put"]
        req = openapi["components"]["schemas"]["platform_UpdateHomePreferenceRequest"]
        resp = openapi["components"]["schemas"]["platform_ApiResponseHomePreferenceResponse"]
        if canonical_digest(get_op) != HOME_DIGESTS["getOperation"] or canonical_digest(put_op) != HOME_DIGESTS["putOperation"] or canonical_digest(req) != HOME_DIGESTS["request"] or canonical_digest(resp) != HOME_DIGESTS["response"]:
            errors.append("HomePreference pinned operation/request/response digest drift")
        if get_op.get("operationId") != "platform_getSurface" or put_op.get("operationId") != "platform_updateSurface":
            errors.append("HomePreference runtime operationId drift")
        put_params = {p.get("name") for p in put_op.get("parameters", [])}
        if {"Idempotency-Key", "If-Match"} & put_params:
            errors.append("SYS-API-032 baseline exception invented forbidden headers")
        if set(req.get("required", [])) != {"layout", "version"} or req.get("properties", {}).get("version", {}).get("type") != "integer" or req.get("properties", {}).get("version", {}).get("minimum") != 0:
            errors.append("SYS-API-032 body version CAS schema drift")
        exceptions = sys_bundle.get("acceptedExceptions", {})
        if set(exceptions) != {"SYS-API-032"}:
            errors.append("named baseline exception set must be exactly SYS-API-032")
        exc = exceptions.get("SYS-API-032", {})
        if exc.get("exceptionType") != "BASELINE_BODY_VERSION_CAS" or exc.get("status") != "ACCEPTED_BASELINE_REUSE_EXCEPTION" or "PENDING" in exc.get("status", ""):
            errors.append("SYS-API-032 named baseline exception state/type drift")
        for oid in ["SYS-API-031", "SYS-API-032"]:
            op = local_operation(sys_bundle, "SYS", oid, "GET" if oid.endswith("031") else "PUT")
            if op.get("fixedSurfaceKey") != "hcm-home" or op.get("newTable") is not False or op.get("newDuty") is not False:
                errors.append(f"{oid}: fixed hcm-home/no-new-table/no-new-duty drift")
        op32 = local_operation(sys_bundle, "SYS", "SYS-API-032", "PUT")
        if op32.get("exceptionType") != "BASELINE_BODY_VERSION_CAS" or op32.get("exceptionStatus") != "ACCEPTED_BASELINE_REUSE_EXCEPTION" or "PENDING" in op32.get("exceptionStatus", ""):
            errors.append("SYS-API-032 operation exception drift")
        rows32 = [r for r in rows if r.get("source_operation_id") == "SYS-API-032" and r.get("method") == "PUT"]
        if len(rows32) != 1 or rows32[0].get("schema_mode") != "BASELINE_BODY_VERSION_CAS" or f"DWP_BACKEND@{BASELINE_SHA}:" not in rows32[0].get("request_schema_ref", ""):
            errors.append("SYS-API-032 register baseline-body-version-CAS drift")
        if any(r.get("schema_mode") == "BASELINE_BODY_VERSION_CAS" and r.get("source_operation_id") != "SYS-API-032" for r in rows):
            errors.append("SYS-API-032 exception spread to another operation")
        transfer = sys_bundle["$defs"]["FileTransferCommand"]
        expected_transfer = {"ownerModule","transferKind","recipientPolicyRef","egressPolicyRevision","objectRef","objectVersion","objectDigest","byteSize","mediaType","malwareScanSnapshot","toctouBinding","classification","purposeCode","expiresAt"}
        expected_required = expected_transfer - {"recipientPolicyRef", "egressPolicyRevision"}
        if set(transfer.get("properties", {})) != expected_transfer or set(transfer.get("required", [])) != expected_required or "direction" in transfer.get("properties", {}) or "transferIntent" in transfer.get("properties", {}):
            errors.append("SYS FileTransferCommand exact field contract drift")
        if transfer.get("properties", {}).get("transferKind", {}).get("enum") != ["INGEST","EXPORT","DELIVERY","EXCHANGE"]:
            errors.append("SYS FileTransferCommand transferKind enum drift")
        if transfer.get("x-directionByTransferKind") != {"INGEST":"INBOUND","EXPORT":"OUTBOUND","DELIVERY":"OUTBOUND","EXCHANGE":"OUTBOUND"}:
            errors.append("SYS FileTransferCommand derived direction map drift")
        if set(transfer.get("then", {}).get("required", [])) != {"recipientPolicyRef", "egressPolicyRevision"} or transfer.get("if", {}).get("properties", {}).get("transferKind", {}).get("enum") != ["EXPORT", "DELIVERY", "EXCHANGE"]:
            errors.append("SYS FileTransferCommand outbound policy condition drift")
        scan = transfer.get("properties", {}).get("malwareScanSnapshot", {})
        if scan.get("properties", {}).get("verdict", {}).get("const") != "CLEAN":
            errors.append("SYS FileTransferCommand malware CLEAN gate drift")
        if set(scan.get("required", [])) != {"scannerKey","scannerVersion","verdict","scannedAt","objectDigest","byteSize"}:
            errors.append("SYS FileTransferCommand malware snapshot required-field drift")
        toctou = transfer.get("properties", {}).get("toctouBinding", {})
        if set(toctou.get("required", [])) != {"uploadSessionId","storageETag","boundObjectVersion","boundDigest","boundByteSize","snapshotDigest"}:
            errors.append("SYS FileTransferCommand TOCTOU binding drift")
    except (KeyError, OSError, ValidationFailure) as exc:
        errors.append(f"HomePreference baseline resolution failed: {exc}")

    # HRIS Home is a typed, field-authorized composition contract.  It must
    # never regress to a payloadRef/digest catalog or allow module/widget/data
    # discriminator cross-combinations.  Browser audiences and owner
    # population scopes are independent dimensions with an exact mapping.
    try:
        defs = sys_bundle["$defs"]
        home_response = defs["HomeResponse"]
        home_widget = defs["HomeWidget"]
        expected_home_response_fields = {
            "asOf", "generatedAt", "browserAudience", "scopeRevision",
            "populationScopeDigest", "fieldPolicyRevision", "authorizationRevision",
            "compositionRevision", "purposeCode", "widgets", "partialFailures",
        }
        expected_widget_fields = {
            "module", "widgetKey", "widgetType", "browserAudience",
            "ownerPopulationScope", "scopeRevision", "populationScopeDigest",
            "fieldPolicyRevision", "purposeCode", "state", "generatedAt",
            "freshUntil", "staleAfter", "deepLink", "sourceVersion",
            "payloadDigest", "fieldDecisions", "data", "error",
        }
        if set(home_response.get("properties", {})) != expected_home_response_fields or set(home_response.get("required", [])) != expected_home_response_fields:
            errors.append("SYS HomeResponse exact typed field set drift")
        if "payloadRef" in home_response.get("properties", {}) or home_response.get("properties", {}).get("widgets") != {"type":"array","maxItems":20,"items":{"$ref":"#/$defs/HomeWidget"}}:
            errors.append("SYS HomeResponse regressed to digest-only/untyped widget projection")
        if home_response.get("properties", {}).get("partialFailures", {}).get("items") != {"$ref":"#/$defs/HomeWidgetFailure"}:
            errors.append("SYS HomeResponse partialFailures must be typed objects")
        if set(home_widget.get("properties", {})) != expected_widget_fields or set(home_widget.get("required", [])) != expected_widget_fields:
            errors.append("SYS HomeWidget exact field set drift")
        if home_widget.get("x-fieldDecisionInvariant") != "EXACTLY_ONE_DECISION_PER_DATA_FIELD;EMBEDDED_DECISION_EQUALS_FIELD_DECISION;OMIT_HAS_NO_VALUE":
            errors.append("SYS HomeWidget per-field decision invariant drift")
        expected_discriminator = {
            "PEOPLE_SUMMARY":{"module":"HRM","dataRef":"#/$defs/PeopleHomeData"},
            "TIME_LEAVE_SUMMARY":{"module":"TIM","dataRef":"#/$defs/TimeLeaveHomeData"},
            "PAYROLL_SUMMARY":{"module":"PAY","dataRef":"#/$defs/PayrollHomeData"},
            "PERFORMANCE_SUMMARY":{"module":"PER","dataRef":"#/$defs/PerformanceHomeData"},
            "ACTION_ITEMS":{"module":"SYS","dataRef":"#/$defs/ActionItemsHomeData"},
        }
        discriminator = home_widget.get("x-discriminator", {})
        if discriminator.get("propertyName") != "widgetType" or discriminator.get("dataPropertyName") != "kind" or discriminator.get("mapping") != expected_discriminator:
            errors.append("SYS HomeWidget module/widgetType/data.kind discriminator drift")
        expected_scope_pairs = {
            "HRM": {("SELF","SELF"), ("TEAM","TEAM"), ("OPERATIONS","NAMED_POPULATION"), ("EXECUTIVE","NAMED_POPULATION")},
            "TIM": {("SELF","SELF"), ("TEAM","TEAM"), ("OPERATIONS","TIME_GROUP"), ("EXECUTIVE","TIME_GROUP")},
            "PAY": {("SELF","SELF"), ("OPERATIONS","PAY_GROUP"), ("EXECUTIVE","LEGAL_ENTITY")},
            "PER": {("SELF","SELF"), ("TEAM","TEAM"), ("OPERATIONS","NAMED_POPULATION"), ("EXECUTIVE","NAMED_POPULATION")},
        }
        branches = home_widget.get("oneOf", [])
        if len(branches) != 5:
            errors.append("SYS HomeWidget must have exactly five discriminated branches")
        branch_by_module = {
            branch.get("properties", {}).get("module", {}).get("const"): branch
            for branch in branches
        }
        if set(branch_by_module) != {"HRM", "TIM", "PAY", "PER", "SYS"}:
            errors.append("SYS HomeWidget module branch set drift")
        for widget_type, discriminator_entry in expected_discriminator.items():
            branch = branch_by_module.get(discriminator_entry["module"], {})
            if (
                branch.get("properties", {}).get("widgetType", {}).get("const") != widget_type
                or branch.get("properties", {}).get("data") != {"$ref": discriminator_entry["dataRef"]}
            ):
                errors.append(f"SYS HomeWidget {discriminator_entry['module']} branch discriminator drift")
        for module, pairs in expected_scope_pairs.items():
            branch = branch_by_module.get(module, {})
            actual_pairs = {
                (
                    pair.get("properties", {}).get("browserAudience", {}).get("const"),
                    pair.get("properties", {}).get("ownerPopulationScope", {}).get("const"),
                )
                for pair in branch.get("oneOf", [])
            }
            if actual_pairs != pairs:
                errors.append(f"SYS HomeWidget {module} audience/owner-scope mapping drift")
        sys_branch = branch_by_module.get("SYS", {})
        if sys_branch.get("properties", {}).get("ownerPopulationScope", {}).get("const") != "AUTHORIZED_PACKAGE_SCOPE" or "oneOf" in sys_branch:
            errors.append("SYS ACTION_ITEMS owner scope must be package-derived and audience-independent")
        expected_data_refs = [
            {"$ref":"#/$defs/PeopleHomeData"}, {"$ref":"#/$defs/TimeLeaveHomeData"},
            {"$ref":"#/$defs/PayrollHomeData"}, {"$ref":"#/$defs/PerformanceHomeData"},
            {"$ref":"#/$defs/ActionItemsHomeData"},
        ]
        if defs.get("HomeWidgetData", {}).get("oneOf") != expected_data_refs:
            errors.append("SYS HomeWidgetData closed union drift")
        expected_data_field_refs = {
            "PeopleHomeData": {"employmentStatus":"ProjectedEmploymentStatus", "organizationLabel":"ProtectedText", "pendingActionCount":"ProjectedCount"},
            "TimeLeaveHomeData": {"clockState":"ProjectedClockState", "leaveBalanceMinutes":"ProjectedLeaveBalanceMinutes", "openTimecardCount":"ProjectedCount", "pendingApprovalCount":"ProjectedCount"},
            "PayrollHomeData": {"payPeriodLabel":"ProtectedText", "grossPay":"ProtectedMoney", "netPay":"ProtectedMoney", "payslipAvailable":"ProjectedBoolean"},
            "PerformanceHomeData": {"goalProgress":"ProjectedGoalProgress", "reviewStatus":"ProjectedReviewStatus", "pendingActionCount":"ProjectedCount"},
            "ActionItemsHomeData": {"items":"ProjectedActionItems"},
        }
        for data_name, field_refs in expected_data_field_refs.items():
            schema = defs.get(data_name, {})
            if schema.get("additionalProperties") is not False or set(schema.get("properties", {})) != {"kind", *field_refs} or set(schema.get("required", [])) != {"kind", *field_refs}:
                errors.append(f"SYS {data_name} closed exact data profile drift")
                continue
            for field, ref_name in field_refs.items():
                if schema["properties"].get(field) != {"$ref":f"#/$defs/{ref_name}"}:
                    errors.append(f"SYS {data_name}.{field} is not a protected typed projection")
        field_decision_enum = defs.get("HomeFieldDecision", {}).get("properties", {}).get("fieldKey", {}).get("enum", [])
        expected_field_keys = {
            field for fields in expected_data_field_refs.values() for field in fields
        }
        if set(field_decision_enum) != expected_field_keys or len(field_decision_enum) != len(expected_field_keys):
            errors.append("SYS Home fieldDecision field-key exact set drift")

        materialized_home = materialize(home_response, FILES["SYS"], sys_bundle, baseline_root)
        forbidden_home_keys = {"payloadRef", "bankAccount", "bankAccountNumber", "nationalId", "taxIdentifier", "documentBytes", "rawPayload", "sourcePayload"}
        def collect_object_keys(value: Any) -> set[str]:
            found: set[str] = set()
            if isinstance(value, dict):
                found.update(value.get("properties", {}).keys())
                for child in value.values():
                    found.update(collect_object_keys(child))
            elif isinstance(value, list):
                for child in value:
                    found.update(collect_object_keys(child))
            return found
        if collect_object_keys(materialized_home) & forbidden_home_keys:
            errors.append("SYS Home browser contract exposes payload reference or sensitive source field")

        instant = "2026-09-10T00:00:00Z"
        digest = "a" * 64
        def widget(module: str, widget_type: str, audience: str, scope: str, data: dict[str, Any]) -> dict[str, Any]:
            fields = [key for key in data if key != "kind"]
            return {
                "module":module, "widgetKey":widget_type.lower().replace("_", "-"),
                "widgetType":widget_type, "browserAudience":audience,
                "ownerPopulationScope":scope, "scopeRevision":1,
                "populationScopeDigest":digest, "fieldPolicyRevision":1,
                "purposeCode":"HRIS_HOME_VIEW", "state":"EMPTY", "generatedAt":instant,
                "freshUntil":instant, "staleAfter":instant, "deepLink":"/hr",
                "sourceVersion":1, "payloadDigest":digest,
                "fieldDecisions":[{"fieldKey":field,"decision":"OMIT"} for field in fields],
                "data":data, "error":None,
            }
        omit = {"decision":"OMIT"}
        valid_widgets = [
            widget("HRM","PEOPLE_SUMMARY","SELF","SELF",{"kind":"PEOPLE_SUMMARY","employmentStatus":omit,"organizationLabel":omit,"pendingActionCount":omit}),
            widget("TIM","TIME_LEAVE_SUMMARY","TEAM","TEAM",{"kind":"TIME_LEAVE_SUMMARY","clockState":omit,"leaveBalanceMinutes":omit,"openTimecardCount":omit,"pendingApprovalCount":omit}),
            widget("PAY","PAYROLL_SUMMARY","OPERATIONS","PAY_GROUP",{"kind":"PAYROLL_SUMMARY","payPeriodLabel":omit,"grossPay":omit,"netPay":omit,"payslipAvailable":omit}),
            widget("PER","PERFORMANCE_SUMMARY","EXECUTIVE","NAMED_POPULATION",{"kind":"PERFORMANCE_SUMMARY","goalProgress":omit,"reviewStatus":omit,"pendingActionCount":omit}),
            widget("SYS","ACTION_ITEMS","TEAM","AUTHORIZED_PACKAGE_SCOPE",{"kind":"ACTION_ITEMS","items":omit}),
        ]
        for candidate in valid_widgets:
            mini_validate(candidate, home_widget, FILES["SYS"], sys_bundle, baseline_root)
        invalid_home_widgets = []
        cross = copy.deepcopy(valid_widgets[2]); cross["module"] = "HRM"; invalid_home_widgets.append(("cross discriminator", cross))
        manager_pay = copy.deepcopy(valid_widgets[2]); manager_pay.update(browserAudience="TEAM", ownerPopulationScope="PAY_GROUP"); invalid_home_widgets.append(("manager payroll escalation", manager_pay))
        ops_scope = copy.deepcopy(valid_widgets[0]); ops_scope.update(browserAudience="OPERATIONS", ownerPopulationScope="TEAM"); invalid_home_widgets.append(("operations owner-scope escalation", ops_scope))
        digest_only = copy.deepcopy(valid_widgets[0]); digest_only.pop("data"); invalid_home_widgets.append(("digest-only widget", digest_only))
        sensitive = copy.deepcopy(valid_widgets[0]); sensitive["data"]["organizationLabel"] = {"decision":"VIEW","value":"People","bankAccountNumber":"123"}; invalid_home_widgets.append(("sensitive field leak", sensitive))
        for label, candidate in invalid_home_widgets:
            try:
                mini_validate(candidate, home_widget, FILES["SYS"], sys_bundle, baseline_root)
                errors.append(f"SYS HomeWidget accepted {label}")
            except ValidationFailure:
                pass
        home_envelope = {
            "asOf":instant, "generatedAt":instant, "browserAudience":"SELF",
            "scopeRevision":1, "populationScopeDigest":digest, "fieldPolicyRevision":1,
            "authorizationRevision":1, "compositionRevision":1,
            "purposeCode":"HRIS_HOME_VIEW", "widgets":[], "partialFailures":[],
        }
        mini_validate(home_envelope, home_response, FILES["SYS"], sys_bundle, baseline_root)
        try:
            bad_failures = copy.deepcopy(home_envelope); bad_failures["partialFailures"] = ["timeout"]
            mini_validate(bad_failures, home_response, FILES["SYS"], sys_bundle, baseline_root)
            errors.append("SYS HomeResponse accepted string partial failure")
        except ValidationFailure:
            pass
    except (KeyError, TypeError, ValidationFailure) as exc:
        errors.append(f"SYS typed Home browser contract resolution failed: {exc}")

    # Explorer search/favorites/recents/activity is a principal-private,
    # server-owned projection over the exact seven shell workbenches.
    try:
        defs = sys_bundle["$defs"]
        exact_workbenches = ["MY_HR", "TEAM", "HR_OPERATIONS", "TIME", "PAYROLL", "PERFORMANCE", "SETTINGS"]
        shell_rows = read_csv(SHELL_NAVIGATION)
        shell_workbenches = [
            row["member_inventory_groups"].split("|", 1)[0]
            for row in shell_rows if row.get("entry_kind") == "WORKBENCH"
        ]
        if shell_workbenches != exact_workbenches:
            errors.append("SYS Explorer workbench enum differs from shell register")
        for schema_name in ("ExplorerRouteProjection", "ExplorerFavoriteProjection", "ExplorerRecentProjection"):
            schema = defs.get(schema_name, {})
            if schema.get("additionalProperties") is not False or schema.get("properties", {}).get("workbench", {}).get("enum") != exact_workbenches:
                errors.append(f"SYS {schema_name} exact seven-workbench contract drift")
        policy = defs.get("ExplorerPolicy", {})
        expected_policy = {
            "maxFavorites":20, "maxRecents":20, "recentTtlDays":30,
            "maxInProgress":20, "entitlementRefilter":True,
            "cleanupMode":"READ_AND_WRITE_THROUGH_PURGE",
        }
        for field, value in expected_policy.items():
            if policy.get("properties", {}).get(field, {}).get("const") != value:
                errors.append(f"SYS Explorer policy {field} drift")
        explorer_response = defs.get("ExplorerResponse", {})
        expected_explorer_fields = {
            "asOf", "projectionRevision", "entitlementRevision",
            "favoritePreferenceRevision", "routes", "favorites", "recents",
            "inProgress", "policy",
        }
        if set(explorer_response.get("properties", {})) != expected_explorer_fields or set(explorer_response.get("required", [])) != expected_explorer_fields:
            errors.append("SYS ExplorerResponse exact field set drift")
        if explorer_response.get("x-isolation") != "VERIFIED_TENANT_AND_AUTHENTICATED_PRINCIPAL" or explorer_response.get("x-readPolicy") != "ENTITLEMENT_REFILTER_THEN_PURGE_RETIRED_OR_DENIED_ROUTES":
            errors.append("SYS Explorer read isolation/refilter/cleanup contract drift")
        caps = {"routes":100, "favorites":20, "recents":20, "inProgress":20}
        for field, cap in caps.items():
            if explorer_response.get("properties", {}).get(field, {}).get("maxItems") != cap:
                errors.append(f"SYS ExplorerResponse {field} cap drift")
        activity = defs.get("ExplorerActivityProjection", {})
        expected_activity_fields = {"activityId","sourceKind","module","state","sourceRevision","updatedAt","deepLink"}
        if set(activity.get("properties", {})) != expected_activity_fields or set(activity.get("required", [])) != expected_activity_fields or activity.get("x-sourceProjection") != "AUTHORIZED_RECEIPT_OR_CASE_FIELDS_ONLY;NO_SOURCE_PAYLOAD_PERSISTENCE":
            errors.append("SYS Explorer in-progress authorized receipt/case projection drift")
        preference = defs.get("ExplorerPreferenceCommand", {})
        recent = defs.get("ExplorerRecentCommand", {})
        if set(preference.get("properties", {})) != {"orderedFavoriteRouteKeys"} or preference.get("properties", {}).get("orderedFavoriteRouteKeys", {}).get("maxItems") != 20 or "SERVER_OWNS_TENANT_AND_USER" not in preference.get("x-writePolicy", ""):
            errors.append("SYS Explorer favorite mutation/order/isolation contract drift")
        if set(recent.get("properties", {})) != {"routeKey"} or "MAX_20_LRU;TTL_30_DAYS" not in recent.get("x-writePolicy", "") or "SERVER_OWNS_TENANT_USER_AND_VISITED_AT" not in recent.get("x-writePolicy", ""):
            errors.append("SYS Explorer recent mutation/TTL/isolation contract drift")
        for name, schema in (("HrisExplorerQuery", defs.get("HrisExplorerQuery", {})), ("ExplorerPreferenceCommand", preference), ("ExplorerRecentCommand", recent)):
            if {"tenantId", "userId", "principalId", "visitedAt"} & set(schema.get("properties", {})):
                errors.append(f"SYS {name} permits caller-owned tenant/user/time")
        for operation_id, method in (("SYS-API-039","PUT"), ("SYS-API-040","POST")):
            operation = local_operation(sys_bundle, "SYS", operation_id, method)
            if operation.get("subjectBinding") != "AUTHENTICATED_PRINCIPAL_ONLY" or operation.get("tenantBinding") != "VERIFIED_TENANT_CONTEXT_ONLY" or operation.get("successStatus") != 202:
                errors.append(f"SYS {operation_id} explorer mutation binding drift")
        if local_operation(sys_bundle, "SYS", "SYS-API-040", "POST").get("serverDerivedVisitedAt") is not True:
            errors.append("SYS Explorer recent visitedAt is not server-derived")
        instant = "2026-09-10T00:00:00Z"
        explorer_instance = {
            "asOf":instant, "projectionRevision":1, "entitlementRevision":1,
            "favoritePreferenceRevision":1, "routes":[], "favorites":[],
            "recents":[], "inProgress":[], "policy":expected_policy,
        }
        mini_validate(explorer_instance, explorer_response, FILES["SYS"], sys_bundle, baseline_root)
    except (KeyError, TypeError, ValidationFailure) as exc:
        errors.append(f"SYS Explorer persistence transport contract resolution failed: {exc}")

    # Representative satisfiable instances for every closed-object pattern that had prior allOf risk.
    uuid = "123e4567-e89b-12d3-a456-426614174000"
    for module in ["TIM", "PAY", "SYS"]:
        bundle = bundles[module]
        try:
            mini_validate({"Authorization":"Bearer token","Idempotency-Key":"1234567890abcdef","X-Correlation-Id":uuid,"X-Purpose-Code":"TEST","If-Match":"\"v1\""}, bundle["$defs"]["CasCommandHeaders"], FILES[module], bundle, baseline_root)
        except ValidationFailure as exc:
            errors.append(f"{module}: representative CasCommandHeaders is unsatisfiable: {exc}")
    try:
        mini_validate({"principalPublicId":uuid,"packageId":uuid,"populationType":"SELF","populationKey":"self","validFrom":"2026-09-10T00:00:00Z","justification":"test"}, sys_bundle["$defs"]["AssignmentCommand"], FILES["SYS"], sys_bundle, baseline_root)
    except ValidationFailure as exc:
        errors.append(f"SYS: representative AssignmentCommand is unsatisfiable: {exc}")
    transfer_instance = {
        "ownerModule":"PAY", "transferKind":"DELIVERY", "recipientPolicyRef":uuid,
        "egressPolicyRevision":1, "objectRef":"obj_1234567890abcdef", "objectVersion":"v1",
        "objectDigest":"a"*64, "byteSize":1, "mediaType":"text/csv",
        "malwareScanSnapshot":{"scannerKey":"scanner","scannerVersion":"1","verdict":"CLEAN","scannedAt":"2026-09-10T00:00:00Z","objectDigest":"a"*64,"byteSize":1},
        "toctouBinding":{"uploadSessionId":uuid,"storageETag":"etag","boundObjectVersion":"v1","boundDigest":"a"*64,"boundByteSize":1,"snapshotDigest":"b"*64},
        "classification":"RESTRICTED", "purposeCode":"PAY_DELIVERY", "expiresAt":"2026-09-11T00:00:00Z",
    }
    try:
        mini_validate(transfer_instance, sys_bundle["$defs"]["FileTransferCommand"], FILES["SYS"], sys_bundle, baseline_root)
    except ValidationFailure as exc:
        errors.append(f"SYS: representative DELIVERY FileTransferCommand is unsatisfiable: {exc}")
    try:
        invalid_transfer = dict(transfer_instance)
        invalid_transfer.pop("recipientPolicyRef")
        invalid_transfer.pop("egressPolicyRevision")
        mini_validate(invalid_transfer, sys_bundle["$defs"]["FileTransferCommand"], FILES["SYS"], sys_bundle, baseline_root)
        errors.append("SYS: DELIVERY FileTransferCommand accepted without egress policy binding")
    except ValidationFailure:
        pass

    # TIM clock transport is the canonical instant plus source-civil/DST provenance contract.
    clock = bundles["TIM"].get("$defs", {}).get("ClockCommand", {})
    clock_required = {
        "workerId", "occurredAt", "sourceLocalDateTime", "timeZone", "sourceUtcOffsetMinutes",
        "dstResolution", "instantAuthority", "tzdbVersion", "timeZoneRuleVersion",
        "sourceProvenanceDigest", "eventType", "source",
    }
    clock_props = clock.get("properties", {})
    if not clock_required.issubset(set(clock.get("required", []))):
        errors.append("TIM ClockCommand required instant/DST provenance drift")
    if clock_props.get("eventType", {}).get("enum") != ["IN", "OUT", "BREAK_START", "BREAK_END"]:
        errors.append("TIM ClockCommand eventType enum drift")
    if clock_props.get("source", {}).get("enum") != ["WEB", "MOBILE", "KIOSK", "DEVICE", "IMPORT", "API"]:
        errors.append("TIM ClockCommand source enum drift")
    offset = clock_props.get("sourceUtcOffsetMinutes", {})
    if offset.get("minimum") != -840 or offset.get("maximum") != 840:
        errors.append("TIM ClockCommand source UTC offset range drift")
    tim_quantity = bundles["TIM"].get("$defs", {}).get("QuantityDecimal", {})
    ssot_quantity = load_document(DECIMAL_CONTRACT).get("valueTypes", {}).get("QuantityDecimal", {})
    leave_available = bundles["TIM"]["$defs"]["LeaveBalancePage"]["properties"]["items"]["items"]["properties"]["available"]
    if tim_quantity.get("type") != "string" or tim_quantity.get("pattern") != ssot_quantity.get("jsonPattern") or tim_quantity.get("x-authoritativePointer") != "../../coding-readiness/decimal-value-types.v1.json#/valueTypes/QuantityDecimal" or leave_available != {"$ref":"#/$defs/QuantityDecimal"}:
        errors.append("TIM LeaveBalance available QuantityDecimal SSOT drift")

    # PAY transport pins and exactly mirrors the central decimal-value SSOT.
    try:
        decimal_path = DECIMAL_CONTRACT
        decimal_contract = load_document(decimal_path)
        pay_bundle = bundles["PAY"]
        decimal_pin = pay_bundle.get("decimalValueContract", {})
        if sha256_file(decimal_path) != DECIMAL_SHA256 or decimal_pin.get("sha256") != DECIMAL_SHA256:
            errors.append("PAY decimal-value SSOT digest drift")
        if decimal_pin.get("ref") != "../../coding-readiness/decimal-value-types.v1.json" or decimal_pin.get("contractId") != "dwp.hris.decimal-value-types.v1":
            errors.append("PAY decimal-value SSOT reference drift")
        expected_serialization = {"wireType":"STRING", "exponentNotation":"FORBIDDEN", "floatingPoint":"FORBIDDEN", "databaseRounding":"FORBIDDEN"}
        if any(decimal_pin.get(k) != v for k, v in expected_serialization.items()):
            errors.append("PAY decimal serialization/no-implicit-rounding policy drift")
        local_names = {"CalculationDecimal":"CalculationDecimal", "InputAmount":"InputAmount", "RateDecimal":"RateDecimal", "QuantityDecimal":"QuantityDecimal", "PostedMoney":"PostedAmount"}
        for ssot_name, local_name in local_names.items():
            ssot = decimal_contract["valueTypes"][ssot_name]
            local = pay_bundle["$defs"][local_name]
            expected_pointer = f"../../coding-readiness/decimal-value-types.v1.json#/valueTypes/{ssot_name}"
            if local.get("type") != "string" or local.get("pattern") != ssot.get("jsonPattern") or local.get("x-sqlType") != ssot.get("sqlType") or local.get("x-authoritativePointer") != expected_pointer:
                errors.append(f"PAY {ssot_name} exact SSOT schema drift")
        formula = pay_bundle["$defs"]["FormulaCommand"].get("properties", {})
        if formula.get("scale", {}).get("minimum") != 0 or formula.get("scale", {}).get("maximum") != 8 or formula.get("rounding", {}).get("enum") != decimal_contract.get("requiredRoundingModes"):
            errors.append("PAY formula scale/rounding-mode contract drift")
        worker_entry = pay_bundle["$defs"]["WorkerEntryCommand"]
        expected_entry_refs = [
            {"$ref":"#/$defs/MoneyWorkerEntryCommand"}, {"$ref":"#/$defs/RateWorkerEntryCommand"},
            {"$ref":"#/$defs/HoursWorkerEntryCommand"}, {"$ref":"#/$defs/NumberWorkerEntryCommand"},
        ]
        expected_entry_binding = {
            "MONEY":{"valueType":"InputAmount","unit":"CURRENCY","currency":"REQUIRED_ISO_4217"},
            "RATE":{"valueType":"RateDecimal","unit":"RATIO","currency":"FORBIDDEN_NULL"},
            "HOURS":{"valueType":"QuantityDecimal","unit":"HOUR","currency":"FORBIDDEN_NULL"},
            "NUMBER":{"valueType":"CalculationDecimal","unit":"UNITLESS","currency":"FORBIDDEN_NULL"},
        }
        if worker_entry.get("oneOf") != expected_entry_refs or worker_entry.get("x-valueTypeBinding") != expected_entry_binding:
            errors.append("PAY worker input discriminated decimal/unit/currency contract drift")
        uuid = "123e4567-e89b-12d3-a456-426614174000"
        base_entry = {"workerId":uuid,"assignmentId":uuid,"elementCode":"BASE_PAY","effectiveDate":"2026-09-10","reasonCode":"ENTRY"}
        valid_entries = [
            dict(base_entry,valueType="MONEY",value="10.00",unit="CURRENCY",currency="USD"),
            dict(base_entry,valueType="RATE",value="0.125",unit="RATIO",currency=None),
            dict(base_entry,valueType="HOURS",value="8.5",unit="HOUR",currency=None),
            dict(base_entry,valueType="NUMBER",value="42.125",unit="UNITLESS",currency=None),
        ]
        for entry in valid_entries:
            mini_validate(entry, worker_entry, FILES["PAY"], pay_bundle, baseline_root)
        try:
            mini_validate(dict(base_entry,valueType="RATE",value="0.125",unit="RATIO",currency="USD"), worker_entry, FILES["PAY"], pay_bundle, baseline_root)
            errors.append("PAY worker non-money entry accepted currency")
        except ValidationFailure:
            pass
        trace_items = pay_bundle["$defs"]["TraceResponse"]["properties"]["steps"]["items"]
        expected_trace = {"sequence", "formulaCode", "before", "after", "stage", "scale", "mode", "policyDigest"}
        if set(trace_items.get("properties", {})) != expected_trace or set(trace_items.get("required", [])) != expected_trace:
            errors.append("PAY calculation trace before/after/rounding evidence drift")
        if trace_items.get("properties", {}).get("before") != {"$ref":"#/$defs/CalculationDecimal"} or trace_items.get("properties", {}).get("after") != {"$ref":"#/$defs/CalculationDecimal"}:
            errors.append("PAY calculation trace decimal type drift")
    except (OSError, KeyError, ValidationFailure) as exc:
        errors.append(f"PAY decimal-value SSOT resolution failed: {exc}")

    # Every asynchronous 202 command converges to an authorized, sealed-context receipt query.
    receipt_ids = {
        "HRM": {"getCommandReceipt"}, "PER": {"getCommandReceipt"},
        "TIM": {"command.receipt.query"}, "PAY": {"command.receipt.query"},
        "SYS": {"SYS-API-037", "SYS-API-038"},
    }
    receipt_rows = [r for r in rows if r.get("source_operation_id") in receipt_ids.get(r.get("module", ""), set())]
    receipt_by_module = Counter(r["module"] for r in receipt_rows)
    if {m: receipt_by_module.get(m, 0) for m in EXPECTED_BY_MODULE} != EXPECTED_RECEIPT_QUERIES:
        errors.append("authorized receipt-query module count drift")
    receipt_by_binding = {r["binding_id"]: r for r in receipt_rows}
    pep_rows = {r["binding_id"]: r for r in pep}
    for row in receipt_rows:
        pep_row = pep_rows.get(row["binding_id"], {})
        if pep_row.get("canonical_population_types") != "ORIGINATING_COMMAND_SCOPE":
            errors.append(f"{row['binding_id']}: receipt query lacks sealed originating-command scope")
        if row["module"] == "PER":
            op = source_operation("PER", row["source_operation_id"], row["method"], sources)
            auth_context = op.get("x-dwp-authorization-context")
            auth_rule = op.get("x-dwp-authorization-rule")
            opaque_not_found = op.get("x-dwp-opaque-not-found-on-context-mismatch")
            receipt_schema = sources["PER"]["components"]["schemas"]["CommandReceipt"]
        else:
            op = local_operation(bundles[row["module"]], row["module"], row["source_operation_id"], row["method"])
            auth_context = op.get("authorizationContext")
            auth_rule = op.get("authorizationRule")
            opaque_not_found = op.get("opaqueNotFoundOnContextMismatch")
            receipt_schema, _, _ = chase_schema(
                op.get("responseSchema"), FILES[row["module"]], bundles[row["module"]], baseline_root
            )
        if auth_context != "SEALED_ORIGINATING_COMMAND_CONTEXT" or auth_rule != "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING" or opaque_not_found is not True:
            errors.append(f"{row['binding_id']}: receipt sealed-context reevaluation drift")
        sealed_fields = {"originatingAction", "subjectPrincipalPublicId", "populationScopeDigest", "fieldPolicyRevision", "purposeCode", "authorizationRevision"}
        if not sealed_fields.issubset(set(receipt_schema.get("required", []))):
            errors.append(f"{row['binding_id']}: receipt sealed-origin fields drift")

    async_rows: List[Dict[str, str]] = []
    async_resolved = 0
    for row in rows:
        is_async = False
        if row["module"] in bundles and row["source_operation_id"] not in {"SYS-API-031", "SYS-API-032"}:
            is_async = local_operation(bundles[row["module"]], row["module"], row["source_operation_id"], row["method"]).get("successStatus") == 202
        elif row["module"] == "PER":
            src = source_operation("PER", row["source_operation_id"], row["method"], sources)
            is_async = "202" in {str(k) for k in src.get("responses", {})}
        if not is_async:
            continue
        async_rows.append(row)
        if row["module"] == "HRM":
            target = "PEP-HRM-014"
        elif row["module"] == "PER":
            target = "PEP-PER-021"
        elif row["module"] == "TIM":
            target = "PEP-TIM-028"
        elif row["module"] == "PAY":
            target = "PEP-PAY-033"
        else:
            target = "PEP-SYS-039" if row["path"].startswith("/api/auth/") else "PEP-SYS-040"
        target_row = receipt_by_binding.get(target)
        target_pep = pep_rows.get(target, {})
        if target_row and target_pep.get("canonical_population_types") == "ORIGINATING_COMMAND_SCOPE" and target_row.get("method") == "GET":
            async_resolved += 1
        else:
            errors.append(f"{row['binding_id']}: async 202 lacks authorized owner receipt convergence")
    receipt_convergence_ok = async_resolved == len(async_rows)

    coverage = {
        "sourcePublicOperationCount": len(pep),
        "resolvedOperationCount": len(rows),
        "byModule": {m: by_module.get(m, 0) for m in EXPECTED_BY_MODULE},
        "duplicateOperationCount": sum(
            count - 1
            for count in Counter((r.get("module"), r.get("source_operation_id"), r.get("method"), r.get("path")) for r in rows).values()
            if count > 1
        ),
        "orphanOperationCount": len(set(pep_by_id) ^ {r.get("binding_id") for r in rows}),
        "async202OperationCount": len(async_rows),
        "receiptQueryOperationCount": len(receipt_rows),
        "async202ResolvedToAuthorizedReceiptCount": async_resolved,
        "receiptQueriesByModule": {m: receipt_by_module.get(m, 0) for m in EXPECTED_BY_MODULE},
    }
    checks = {
        "standaloneApiPepValidatorPass": pep_pass,
        "exactOperationParity": not any("API PEP" in e or "operation" in e and "mismatch" in e for e in errors),
        "allSchemaReferencesResolve": not any("reference" in e or "pointer" in e for e in errors),
        "pathPlaceholderExactSets": not any("path placeholder" in e for e in errors),
        "fieldTypeRequiredClosure": not any(
            marker in e
            for e in errors
            for marker in ["transport shape digest drift", "required-field", "type contract drift", "required fields", "unknown schema type"]
        ),
        "async202AuthorizedReceiptConvergence": receipt_convergence_ok,
        "namedBaselineExceptions": {"SYS-API-032": "BASELINE_BODY_VERSION_CAS"},
        "states": {"implementation": EXPECTED_IMPLEMENTATION, "production": EXPECTED_PRODUCTION},
    }
    return {
        "schema": "dwp.hris.transport-schema-resolution.v1",
        "status": "PASS" if not errors else "FAIL",
        "coverage": coverage,
        "states": checks["states"],
        "namedBaselineExceptions": checks["namedBaselineExceptions"],
        "checks": checks,
        "digests": {str(p.relative_to(BLUEPRINT)): sha256_file(p) for p in [REGISTER, *FILES.values(), DECIMAL_CONTRACT]},
        "errors": errors,
    }


def self_test() -> Dict[str, Any]:
    rows = read_csv(REGISTER)
    bundles = {m: load_document(p) for m, p in FILES.items()}
    cases = []

    def rejected(name: str, mutate) -> None:
        rr = copy.deepcopy(rows)
        bb = copy.deepcopy(bundles)
        mutate(rr, bb)
        result = validate(rr, bb, check_pep=False)
        cases.append({"name": name, "status": "PASS" if result["status"] == "FAIL" else "FAIL", "rejectedErrorCount": len(result["errors"])})

    def home_branch(bundle: Dict[str, Any], module: str) -> Dict[str, Any]:
        return next(
            branch for branch in bundle["SYS"]["$defs"]["HomeWidget"]["oneOf"]
            if branch["properties"]["module"]["const"] == module
        )

    rejected("unknown-ref", lambda r, b: b["TIM"]["operations"]["schedule.query"].update(responseSchema={"$ref":"#/$defs/Unknown"}))
    rejected("field-required-drift", lambda r, b: b["TIM"]["$defs"]["Problem"]["required"].remove("status"))
    rejected("field-type-drift", lambda r, b: b["PAY"]["$defs"]["Problem"]["properties"]["status"].update(type="string"))
    rejected("operation-path-mismatch", lambda r, b: r[0].update(path="/tampered"))
    rejected("operation-authorization-mismatch", lambda r, b: r[0].update(authorization_alias="tampered"))
    rejected("path-placeholder-mismatch", lambda r, b: b["TIM"]["operations"]["timecard.query"].update(path="/v1/timecards/{wrongId}"))
    rejected("baseline-sha-mismatch", lambda r, b: b["SYS"]["baseline"].update(sourceHeadSha="0"*40))
    rejected("baseline-body-version-type-drift", lambda r, b: b["SYS"].update(acceptedExceptions={"SYS-API-032":dict(b["SYS"]["acceptedExceptions"]["SYS-API-032"], exceptionType="WRONG")}))
    rejected("baseline-exception-spread", lambda r, b: r[0].update(schema_mode="BASELINE_BODY_VERSION_CAS"))
    rejected("pending-state-rejected", lambda r, b: b["SYS"]["acceptedExceptions"]["SYS-API-032"].update(status="ACCEPTED_BASELINE_REUSE_EXCEPTION_PENDING_SOURCE_DOC_SYNC"))
    rejected("file-transfer-client-direction-rejected", lambda r, b: b["SYS"]["$defs"]["FileTransferCommand"]["properties"].update(direction={"type":"string"}))
    rejected("file-transfer-transfer-kind-drift", lambda r, b: b["SYS"]["$defs"]["FileTransferCommand"]["properties"]["transferKind"].update(enum=["IMPORT","EXPORT"]))
    rejected("file-transfer-egress-policy-condition-drift", lambda r, b: b["SYS"]["$defs"]["FileTransferCommand"]["then"].update(required=["recipientPolicyRef"]))
    rejected("receipt-status-route-drift", lambda r, b: b["TIM"]["operations"]["command.receipt.query"].update(path="/v1/receipts/{receiptId}"))
    rejected("receipt-sealed-context-drift", lambda r, b: b["SYS"]["operations"]["SYS-API-038"].update(authorizationContext="CURRENT_CONTEXT_ONLY"))
    rejected("clock-event-enum-drift", lambda r, b: b["TIM"]["$defs"]["ClockCommand"]["properties"]["eventType"].update(enum=["IN", "OUT", "BREAK"]))
    rejected("decimal-ssot-pattern-drift", lambda r, b: b["PAY"]["$defs"]["InputAmount"].update(pattern="^-?[0-9.eE]+$"))
    rejected("decimal-trace-required-drift", lambda r, b: b["PAY"]["$defs"]["TraceResponse"]["properties"]["steps"]["items"]["required"].remove("policyDigest"))
    rejected("home-digest-only-reference-drift", lambda r, b: b["SYS"]["$defs"]["HomeWidget"]["required"].remove("data"))
    rejected("home-widget-discriminator-cross-combination", lambda r, b: home_branch(b, "PAY")["properties"].update(data={"$ref":"#/$defs/PeopleHomeData"}))
    rejected("home-string-partial-failure-drift", lambda r, b: b["SYS"]["$defs"]["HomeResponse"]["properties"]["partialFailures"].update(items={"type":"string"}))
    rejected("home-field-policy-context-drift", lambda r, b: b["SYS"]["$defs"]["HomeWidget"]["required"].remove("fieldPolicyRevision"))
    rejected("home-manager-payroll-escalation", lambda r, b: home_branch(b, "PAY")["oneOf"].append({"properties":{"browserAudience":{"const":"TEAM"},"ownerPopulationScope":{"const":"PAY_GROUP"}}}))
    rejected("home-freeform-data-drift", lambda r, b: b["SYS"]["$defs"]["PeopleHomeData"].update(additionalProperties=True))
    rejected("explorer-workbench-enum-drift", lambda r, b: b["SYS"]["$defs"]["ExplorerRouteProjection"]["properties"]["workbench"]["enum"].append("ADMIN"))
    rejected("explorer-preference-cap-drift", lambda r, b: b["SYS"]["$defs"]["ExplorerPreferenceCommand"]["properties"]["orderedFavoriteRouteKeys"].update(maxItems=21))
    rejected("explorer-recent-ttl-drift", lambda r, b: b["SYS"]["$defs"]["ExplorerPolicy"]["properties"]["recentTtlDays"].update(const=31))
    rejected("explorer-activity-raw-payload-drift", lambda r, b: b["SYS"]["$defs"]["ExplorerActivityProjection"]["properties"].update(rawPayload={"type":"object","additionalProperties":True}))
    status = "PASS" if all(c["status"] == "PASS" for c in cases) else "FAIL"
    return {
        "schema": "dwp.hris.transport-schema-resolution-self-test.v1",
        "status": status,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    result = self_test() if args.self_test else validate()
    if args.compact:
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
