#!/usr/bin/env python3
"""Read-only RFC6902 TIM author-draft checks; never a canonical/G3 approval.

The pinned original is loaded and deep-copied in memory only. No SQL, server,
credentials, materialized file export, canonical mutation, or domain execution.
Ajv is the installed standards engine, not the historical subset checker.
"""
import argparse
import copy
import dataclasses
import hashlib
import importlib.util
import json
import math
import re
import subprocess
import sys
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent.parent
PROPOSAL = HERE / "tim-base-review-remediation.proposal.v1.json"
PINS = {
    "json": "5fbb5b1ae3fd92795939e4ecea85877035fae85cf1c32189db22e91037cc3933",
    "md": "32fa6514408faf690de707ca7c585fb957df8b3cfc1145b035f87a3079d5ddbb",
    "reviewJson": "7cc282ca4e116524cace6576e2b29b08f9c5c21ffd38f55b942f175abf8dcda5",
    "reviewMd": "9840eb1082d3db4afc8657dd07e4133c4aabc68b7f41238730ef64e5d52e174e",
}
BOUNDED = {
    "tim.rule.create", "tim.leave.entitlement.run",
    "tim.leave.enrollment.cancel", "tim.leave.entitlement.input.get",
}
STATUSES = ["ACCEPTED", "RUNNING", "SUCCEEDED", "REJECTED", "FAILED", "RESULT_UNKNOWN"]
OUTCOME_STATES = {"CALCULATED", "POSTED", "BLOCKED", "FAILED", "CANCELLED"}
DECIMAL = re.compile(r"^-?(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,6})?$")
COMPAT = {
    str(BASE / "coding-readiness/decimal-value-types.v1.json"): "8597640fa5cf5051cccc14fe4b83a4f179d54dfe36f0ffdaa319dc1149b5c6a6",
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/generated/CanonicalDecimalJson.java": "02b77fe14956aee0e07642d4ac68c97d7a1059f18ade6d910a8e8856d73cd78c",
}


def strict_loads(raw):
    def pairs(items):
        obj = {}
        for key, value in items:
            if key in obj:
                raise ValueError("duplicate JSON key: " + key)
            obj[key] = value
        return obj
    def nonfinite(value):
        raise ValueError("nonfinite JSON token: " + value)
    def finite_float(raw):
        value = float(raw)
        if not math.isfinite(value):
            raise ValueError("overflowed JSON numeric token")
        exact = Decimal(raw)
        if exact != exact.to_integral_value() or abs(exact) > 9007199254740991:
            raise ValueError("author numeric policy: integer JSON values only; quantities/rates are strings")
        return int(exact)
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite, parse_float=finite_float)


ENVELOPE_KEYS = set(["$schema","contractId","schemaVersion","createdDate","status","CURRENT_PUBLISHED","G3Gate","independentPass","originalPins","compatibilityPins","application","patch","sourceRepairScope","runContract","fixtureDefinitions","schemaProbeCases","decimalCompatibility","remainingOpen","authorChecks","additionalFindingSources","countInterpretation"])


def json_equal(left, right):
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return set(left) == set(right) and all(json_equal(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(json_equal(a, b) for a, b in zip(left, right))
    return left == right


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tokens(pointer):
    if not isinstance(pointer, str) or not pointer.startswith("/"):
        raise ValueError("non-root RFC6901 pointer required")
    raw = pointer[1:].split("/")
    if any(part in {"__proto__", "constructor", "prototype"} for part in raw):
        raise ValueError("unsafe authored-delta member name")
    if any(re.search(r"~(?![01])", value) for value in raw):
        raise ValueError("invalid RFC6901 escape")
    return [value.replace("~1", "/").replace("~0", "~") for value in raw]


def index(token, size, append=False):
    if append and token == "-":
        return size
    if not re.fullmatch(r"0|[1-9][0-9]*", token):
        raise ValueError("noncanonical array index")
    value = int(token)
    if value > size or (not append and value == size):
        raise ValueError("array index out of bounds")
    return value


def apply_patch_in_memory(original, operations):
    draft = copy.deepcopy(original)
    if not isinstance(operations, list) or not operations:
        raise ValueError("nonempty RFC6902 operations required")
    for change in operations:
        op = change.get("op")
        if op not in {"test", "add", "replace", "remove"}:
            raise ValueError("unsupported RFC6902 operation")
        expected_keys = {"op", "path"} | ({"value"} if op != "remove" else set())
        if set(change) != expected_keys:
            raise ValueError("RFC6902 field closure")
        parts = tokens(change["path"])
        parent = draft
        for part in parts[:-1]:
            parent = parent[index(part, len(parent))] if isinstance(parent, list) else parent[part]
        last = parts[-1]
        if isinstance(parent, list):
            position = index(last, len(parent), op == "add")
            current = None if position == len(parent) else parent[position]
            if op == "add":
                parent.insert(position, copy.deepcopy(change["value"]))
            elif op == "remove":
                parent.pop(position)
            elif op == "replace":
                parent[position] = copy.deepcopy(change["value"])
            elif not json_equal(current, change["value"]):
                raise ValueError("RFC6902 test failed at " + change["path"])
        elif isinstance(parent, dict):
            if op != "add" and last not in parent:
                raise ValueError("missing RFC6902 target")
            if op == "test" and not json_equal(parent[last], change["value"]):
                raise ValueError("RFC6902 test failed at " + change["path"])
            if op in {"add", "replace"}:
                parent[last] = copy.deepcopy(change["value"])
            elif op == "remove":
                del parent[last]
        else:
            raise ValueError("scalar RFC6902 parent")
    return draft


def verify_pins(proposal):
    if set(proposal["originalPins"]) != set(PINS):
        raise ValueError("original/review pin closure")
    for key, pin in proposal["originalPins"].items():
        if pin["sha256"] != PINS[key]:
            raise ValueError("immutable expected pin changed")
        path = (BASE / pin["path"]).resolve()
        if BASE.resolve() not in path.parents or not path.is_file() or path.is_symlink():
            raise ValueError("pin must be regular in-blueprint file")
        if sha(path.read_bytes()) != PINS[key]:
            raise ValueError("original/review bytes changed: " + key)
    if {pin["path"]: pin["sha256"] for pin in proposal["compatibilityPins"]} != COMPAT or len(proposal["compatibilityPins"]) != 2:
        raise ValueError("actual compatibility trust-anchor closure")
    for pin in proposal["compatibilityPins"]:
        path = Path(pin["path"])
        if not path.is_file() or path.is_symlink() or sha(path.read_bytes()) != pin["sha256"]:
            raise ValueError("actual decimal compatibility pin changed")


def load_draft(path=PROPOSAL):
    proposal = strict_loads(Path(path).read_text())
    if set(proposal) != ENVELOPE_KEYS:
        raise ValueError("author envelope exact key closure")
    verify_pins(proposal)
    original = strict_loads((BASE / proposal["originalPins"]["json"]["path"]).read_text())
    draft = apply_patch_in_memory(original, proposal["patch"])
    if json_equal(original, draft):
        raise ValueError("author remediation must change original in memory, not test-only/no-op")
    return proposal, original, draft


def canonical_decimal(raw):
    if not isinstance(raw, str) or not DECIMAL.fullmatch(raw):
        raise ValueError("QuantityDecimal wire grammar")
    value = Decimal(raw)
    if value == 0:
        return "0"
    result = format(value, "f")
    if "." in result:
        result = result.rstrip("0").rstrip(".")
    return result


def canonical_hash(value, excluded=None):
    if excluded:
        value = {key: item for key, item in value.items() if key != excluded}
    return sha(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())


def public_uuid(raw):
    if not isinstance(raw, str) or str(uuid.UUID(raw)) != raw:
        raise ValueError("canonical lowercase public UUID")
    return raw


def input_guard(document, run=None, selected_rows=None):
    rows = document["selectedItems"]
    public_uuid(document["inputVersionPublicId"])
    public_uuid(document["runPublicId"])
    for row in rows:
        for raw in [row["selectedItemPublicId"], row["inputVersionPublicId"], row["enrollment"]["enrollmentPublicId"],
                    row["enrollment"]["workerPublicId"], row["enrollment"]["assignmentPublicId"]]:
            public_uuid(raw)
    if len(rows) != document["selectedCount"] or not rows:
        raise ValueError("selected cardinality")
    ids = [row["selectedItemPublicId"] for row in rows]
    enrollments = [row["enrollment"]["enrollmentPublicId"] for row in rows]
    if len(set(ids)) != len(ids) or len(set(enrollments)) != len(enrollments):
        raise ValueError("selected identity uniqueness")
    if enrollments != sorted(enrollments) or [row["ordinal"] for row in rows] != list(range(1, len(rows) + 1)):
        raise ValueError("canonical selected order")
    if any(row["inputVersionPublicId"] != document["inputVersionPublicId"] for row in rows):
        raise ValueError("selected parent")
    if canonical_hash(rows) != document["selectionDigest"]:
        raise ValueError("selection fingerprint")
    if canonical_hash(document, "contentSha256") != document["contentSha256"]:
        raise ValueError("input fingerprint")
    if run is not None and (
            document["runPublicId"] != run["publicId"]
            or document["inputVersionPublicId"] != run["inputVersionPublicId"]
            or document["selectedCount"] != run["selectedCount"]
            or document["contentSha256"] != run["inputSha256"]):
        raise ValueError("actual run parent/fingerprint")
    if selected_rows is not None and not json_equal(rows, selected_rows):
        raise ValueError("actual selected-row payload/cardinality")


def outcome_guard(outcome, document):
    input_guard(document)
    if outcome["inputSha256"] != document["contentSha256"]:
        raise ValueError("outcome input")
    selected = {row["selectedItemPublicId"] for row in document["selectedItems"]}
    if outcome["selectedItemPublicId"] not in selected:
        raise ValueError("outcome selected identity")
    row = next(row for row in document["selectedItems"] if row["selectedItemPublicId"] == outcome["selectedItemPublicId"])
    if outcome["kind"] in {"CALCULATED", "POSTED"} and outcome["unit"] != row["unit"]:
        raise ValueError("selected unit")
    if outcome["kind"] in {"CALCULATED", "POSTED"} and Decimal(outcome["denominator"]) <= 0:
        raise ValueError("computed denominator")
    if outcome["kind"] in {"CALCULATED", "POSTED"}:
        quantity, suppressed = Decimal(outcome["quantity"]), Decimal(outcome["suppressedQuantity"])
        if quantity < 0 or suppressed < 0:
            raise ValueError("new grant/suppressed quantity nonnegative; reversal is separate ledger effect")
        if outcome["kind"] == "CALCULATED" and outcome["ledgerPublicIds"]:
            raise ValueError("dry-run ledger effect")
        if outcome["kind"] == "POSTED" and bool(outcome["ledgerPublicIds"]) != (quantity != 0):
            raise ValueError("zero/nonzero posted ledger projection")
    if outcome["kind"] not in OUTCOME_STATES:
        raise ValueError("outcome state")


def completion_guard(document, outcomes, cancel_requested=False):
    input_guard(document)
    for outcome in outcomes:
        outcome_guard(outcome, document)
        expected = "POSTED" if document["mode"] == "POST" else "CALCULATED"
        if outcome["kind"] in {"POSTED", "CALCULATED"} and outcome["kind"] != expected:
            raise ValueError("mode outcome")
        if outcome["kind"] == "CANCELLED" and not cancel_requested:
            raise ValueError("cancellation authority")
    keys = [outcome["selectedItemPublicId"] for outcome in outcomes]
    if len(keys) != len(set(keys)):
        raise ValueError("duplicate outcome")
    if set(keys) != {row["selectedItemPublicId"] for row in document["selectedItems"]}:
        raise ValueError("terminal cardinality")


def finalize_decision(document, outcomes, cancel_requested=False):
    completion_guard(document, outcomes, cancel_requested)
    successes = sum(outcome["kind"] in {"POSTED", "CALCULATED"} for outcome in outcomes)
    if cancel_requested:
        return "CANCELLED_PARTIAL" if successes else "CANCELLED"
    if successes == len(outcomes):
        return "SUCCEEDED"
    return "PARTIAL" if successes else "FAILED"


def expired_unknown_fence(lease_expires_at, owner_clock, observed, current):
    parse = lambda raw: datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if observed != current or parse(owner_clock) < parse(lease_expires_at):
        raise ValueError("unknown requires exact expired fence")
    return {"status": "RESULT_UNKNOWN", "leaseVersion": current + 1}


def unused_enrollment_guard(status, effective_from, owner_local_date, effect_counts, observed, current):
    if status != "ACTIVE" or owner_local_date >= effective_from or observed != current or any(effect_counts):
        raise ValueError("unused future enrollment/CAS guard")
    return {"status": "CANCELLED", "rowVersion": current + 1}


def writer_fence_guard(submitted, current, expires_at, owner_clock, lease_owner, caller, cancel_requested):
    parse = lambda raw: datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if submitted != current or parse(owner_clock) >= parse(expires_at) or lease_owner != caller or cancel_requested:
        raise ValueError("prospective writer fence/expiry/owner/cancellation")
    return True


def event_guard(event, persisted_after, persisted_before, same_registered_entity=True):
    if event["stateAfter"] != persisted_after or event["stateBefore"] != persisted_before:
        raise ValueError("event persisted CAS equality")
    if same_registered_entity and "resultRecord" in event and event["resultRecord"].get("status", persisted_after) != persisted_after:
        raise ValueError("event result equality")


def subset_checks(proposal, draft):
    errors = []
    def require(condition, message):
        if not condition:
            errors.append(message)
    require(proposal["status"].startswith("DESIGN_PROPOSED") and proposal["G3Gate"].startswith("CLOSED"),
            "author proposal must remain DESIGN_PROPOSED/G3 CLOSED")
    require(proposal["independentPass"] is False and proposal["authorChecks"]["independentPass"] is False,
            "self approval forbidden")
    require(proposal["CURRENT_PUBLISHED"] is False, "unpublished author proposal")
    require(proposal["contractId"] == "TIM.BASE.ReviewRemediation.proposal.v1" and proposal["schemaVersion"] == 1
            and proposal["application"]["format"] == "RFC6902", "author identity/version/delta dialect")
    require(not ({"operationBindings", "operationDeltas", "internalOperations"} & set(proposal)),
            "top-level author envelope must not mix executable dialects")
    scope = proposal["sourceRepairScope"]
    operations = draft["operationDeltas"]
    historical = strict_loads((BASE / proposal["originalPins"]["json"]["path"]).read_text())
    ids = [op["operationId"] for op in operations]
    require(len(ids) == 116 and len(ids) == len(set(ids)), "operation exact closure 116")
    require(set(ids) == {op["operationId"] for op in historical["operationDeltas"]} | {"tim.leave.entitlement.input.get", "tim.leave.termination.reconcile"},
            "immutable114 plus approved new2 exact operation ID scope")
    require(set(scope["boundedDetailedOperationIds"]) == BOUNDED, "bounded source exact set")
    require(scope["allGenericDerivationsClosed"] is False and scope["sourceActualCanonicalPass"] is False,
            "generic/canonical source overclaim")
    remaining = scope["unfixedExactOperationIds"]
    require(len(remaining) == len(set(remaining)) == 112 and set(remaining) == set(ids) - BOUNDED,
            "exact unfixed source operation complement")
    routes = [(op["transport"], op["method"], re.sub(r"\{[^}]+\}", "{id}", op["path"])) for op in operations]
    require(len(routes) == len(set(routes)), "transport/method/normalized route collision")
    cancel = next(op for op in operations if op["operationId"] == "tim.leave.enrollment.cancel")
    require(cancel["path"].endswith("/cancellations"), "cancel route")
    require(not re.search(r"termination|settlement|PRORATE", " ".join(cancel["rules"]), re.I),
            "copied termination cancel rules")
    for op in operations:
        declared = {write["table"] for write in op["businessWriteSet"]}
        transitive = declared | {write["table"] for write in op.get("infrastructureWriteSet", [])}
        require(declared == set(op["writesTables"]), "business write closure: " + op["operationId"])
        require(transitive == set(op.get("transitiveWritesTables", [])), "transitive write closure: " + op["operationId"])
    tables = {table["tableName"]: table for table in draft["tableSpecifications"]}
    require(len(tables) == 47, "table closure 47")
    selected = tables["abs_entitlement_selected_items"]
    require(["tenant_id", "input_version_id", "enrollment_id", "selected_item_id"] in selected["uniqueKeys"],
            "selected exact parent uniqueness")
    fk_tests = [
        ("tme_scheduled_segments", ["tenant_id", "schedule_period_id", "schedule_assignment_id"]),
        ("tme_schedule_approval_bindings", ["tenant_id", "schedule_period_id", "evaluation_id"]),
        ("abs_entitlement_ledger_entries", ["tenant_id", "enrollment_id", "source_run_item_id"]),
        ("abs_leave_grant_lots", ["tenant_id", "enrollment_id", "grant_entry_id"]),
    ]
    for table, cols in fk_tests:
        require(any(fk["columns"] == cols for fk in tables[table]["foreignKeys"]), "sibling FK: " + table)
    plan = draft["twoPhaseDdlPlan"]
    require(len(plan["phase1"]) == 47, "two-phase table scope")
    require(all("FOREIGN KEY" not in item["sql"] and not re.search(r"\bAND[0-9]", item["sql"])
                for item in plan["phase1"]), "two-phase/no AND50400")
    require(sum(len(table["foreignKeys"]) for table in tables.values()) == len(plan["phase2ForeignKeys"]),
            "two-phase FK exact count")
    require(len({row["table"] for row in plan["phase1"]}) == 47, "unique phase1 table set")
    for row in plan["phase1"]:
        table = tables.get(row["table"])
        require(table is not None and row["sql"] == table["plannedCreateSql"], "phase1 exact table SQL correspondence")
    expected_fks = []
    for table in tables.values():
        for pos, fk in enumerate(table["foreignKeys"]):
            sql = ("ALTER TABLE public." + table["tableName"] + " ADD CONSTRAINT "
                   + table["tableName"] + "_f" + str(pos) + " FOREIGN KEY ("
                   + ", ".join(fk["columns"]) + ") REFERENCES public." + fk["targetTable"]
                   + " (" + ", ".join(fk["targetColumns"]) + ") ON DELETE " + fk["onDelete"]
                   + (" DEFERRABLE INITIALLY DEFERRED" if fk["deferrable"] else "") + ";")
            expected_fks.append({"table": table["tableName"], "targetTable": fk["targetTable"], "sql": sql})
    require(json_equal(expected_fks, plan["phase2ForeignKeys"]), "phase2 exact FK/SQL correspondence, not count-only")
    unresolved_fks = []
    for table in tables.values():
        for fk in table["foreignKeys"]:
            local_columns = {col["name"] for col in [table["idColumn"]] + table["columns"]}
            require(set(fk["columns"]) <= local_columns, "FK actual local columns: " + table["tableName"])
            require(len(fk["columns"]) == len(fk["targetColumns"]) and len(set(fk["columns"])) == len(fk["columns"]),
                    "FK arity/column closure: " + table["tableName"])
            if fk["targetTable"] in tables:
                target = tables[fk["targetTable"]]
                target_columns = {col["name"] for col in [target["idColumn"]] + target["columns"]}
                require(set(fk["targetColumns"]) <= target_columns, "FK actual target columns: " + table["tableName"])
                require(fk["targetColumns"] in target["uniqueKeys"] or fk["targetColumns"] == [target["idColumn"]["name"]],
                        "FK referenced unique key: " + table["tableName"])
            if fk["targetTable"] not in tables:
                unresolved_fks.append({"table": table["tableName"], "target": fk["targetTable"]})
    for op_id in BOUNDED:
        graph = next(row for row in draft["operationFieldLineage"] if row["operationId"] == op_id)
        leaves = {row["source"] for row in graph["sourceLeaves"]}
        nodes = {row["source"]: row for row in graph["typedSources"]}
        require(len(nodes) == len(graph["typedSources"]), "bounded unique derived sources")
        for node in nodes.values():
            require(node["kind"] == "EXPLICIT_OWNER_TRANSACTION_BINDING" and bool(node["expression"]),
                    "bounded actual expression")
            require(bool(node["inputs"]), "bounded nonempty dependencies")
            require(set(node["inputs"]) <= leaves | set(nodes), "bounded input dependency closure")
            require(set(node["inputs"]) != {"principal.tenantId", "principal.publicId"},
                    "actor tenant alone is not business derivation")
        for binding in graph["requiredColumnSources"]:
            require(binding["source"] in nodes, "bounded column source closure")
            if binding["source"] in nodes:
                node = nodes[binding["source"]]
                require(node["target"] == binding["table"] + "." + binding["column"] and node["type"] == binding["sqlType"],
                        "bounded target-specific source/type binding")
        if op_id != "tim.leave.entitlement.input.get":
            require(bool(graph["requiredColumnSources"]), "bounded nonempty command column bindings")
            original_graph = next(row for row in historical["operationFieldLineage"] if row["operationId"] == op_id)
            expected = {(row["table"], row["column"]): row["sqlType"] for row in original_graph["requiredColumnSources"]}
            if op_id == "tim.leave.entitlement.run":
                changed = {"abs_entitlement_runs", "abs_entitlement_input_versions", "abs_entitlement_selected_items", "tme_owner_artifact_snapshots"}
                expected = {key: value for key, value in expected.items() if key[0] not in changed}
                for name in changed:
                    for col in [tables[name]["idColumn"]] + tables[name]["columns"]:
                        expected[(name, col["name"])] = col["sqlType"]
            bound = {(row["table"], row["column"]): row["sqlType"] for row in graph["requiredColumnSources"]}
            require(bound == expected and len(bound) == len(graph["requiredColumnSources"]), "bounded actual target/type exact closure")
            require({row["target"] for row in nodes.values()} == {table + "." + col for table, col in expected}, "bounded node target closure")
        else:
            require({row["target"] for row in graph["responseFieldSources"]} == set(draft["$defs"]["TIM.EntitlementInputDocument.v2"]["properties"]),
                    "bounded full input query projection")
            require(all(row["source"] == "loaded.input.input_payload." + row["target"] for row in graph["responseFieldSources"]),
                    "bounded query exact actual field source")
        visiting, visited = set(), set()
        def walk(key):
            if key in visiting:
                require(False, "bounded derived cycle")
                return
            if key in visited:
                return
            visiting.add(key)
            for child in nodes[key]["inputs"]:
                if child in nodes:
                    walk(child)
            visiting.remove(key)
            visited.add(key)
        for key in nodes:
            walk(key)
    cross = proposal["additionalFindingSources"][0]
    require(cross["canonicalPolicyChanged"] is False and len(cross["originalPointers"]) == 13,
            "root cross-context finding/policy preservation")
    require(proposal["authorChecks"]["crossContextPolicyPass"] is False,
            "cross-context FK not authorized by author")
    require(any(row["id"] == "TIM-REVIEW-OPEN-CROSS-CONTEXT" for row in proposal["remainingOpen"]),
            "cross-context P0 must remain OPEN")
    require(len(proposal["fixtureDefinitions"]) == 24 and len(proposal["schemaProbeCases"]) == 12,
            "concrete fixture exact scope")
    for name in ["fixtureDefinitions", "schemaProbeCases"]:
        require(len({case["caseId"] for case in proposal[name]}) == len(proposal[name]), "unique concrete case identity: " + name)
    return {"errors": errors, "counts": {
        "operations": len(operations), "publicOperations": sum(op["transport"] == "GATEWAY_AUTHENTICATED" for op in operations),
        "plannedTables": len(tables), "plannedColumns": sum(len(t["columns"]) + 1 for t in tables.values()),
        "schemas": len(draft["$defs"]), "events": len(draft["eventSchemas"]),
        "typedSources": sum(len(row["typedSources"]) for row in draft["operationFieldLineage"]),
        "boundedDetailedSourceOperations": 4, "unfixedSourceOperations": len(remaining),
        "phase2ForeignKeys": len(plan["phase2ForeignKeys"]),
    }, "outsideTableFkDependencies": unresolved_fks, "crossContextPolicyPass": False}


AJV = r"""
const fs = require('fs');
const {createRequire} = require('module');
const req = createRequire('/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/package.json');
const Ajv = req('ajv');
const version = req('ajv/package.json').version;
const input = JSON.parse(fs.readFileSync(0,'utf8'));
const ajv = new Ajv({allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false,unknownFormats:'fail'});
const root = {$id:'urn:tim:review-remediation', $defs:input.draft.$defs};
ajv.addSchema(root); const defs = input.draft.$defs, failures=[];
const supported=new Set(['$ref','additionalProperties','allOf','anyOf','const','else','enum','format','if','items','maxItems','maxLength','maximum','minItems','minLength','minimum','oneOf','pattern','properties','referenceContract','required','then','type','uniqueItems']);
let schemaObjects=0, annotationKeywords=0;
function keywords(s) {
 if(!s||typeof s!=='object'||Array.isArray(s))return;
 for(const key of Object.keys(s)){if(key.startsWith('x-'))annotationKeywords++;else if(!supported.has(key))failures.push({unsupportedValidationKeyword:key});}
 if(s.type==='object'){schemaObjects++;if(s.additionalProperties!==false)failures.push({objectNotClosed:true});}
 for(const child of Object.values(s.properties||{}))keywords(child);
 for(const key of ['items','additionalProperties','if','then','else'])keywords(s[key]);
 for(const key of ['allOf','anyOf','oneOf'])for(const child of s[key]||[])keywords(child);
}
for(const s of Object.values(defs))keywords(s);
let compiled=0, cases=0, controls=0;
const get = name => ajv.getSchema('urn:tim:review-remediation#/$defs/'+name);
for (const name of Object.keys(defs)) { try { if(!get(name))throw Error('missing');compiled++;}catch(e){failures.push({name,error:e.message});} }
for (const test of input.proposal.schemaProbeCases) {
  const validate=get(test.schemaRef), accepted=validate(test.payload); cases++;
  if(accepted!==test.expectedSchemaAccept) failures.push({caseId:test.caseId,accepted,errors:validate.errors});
  if(test.expectedSchemaAccept) {
    for(const mode of ['extra','missing','numeric']) {
      const clone=JSON.parse(JSON.stringify(test.payload));
      if(mode==='extra')clone.__unexpected=true;
      if(mode==='missing')delete clone[Object.keys(clone)[0]];
      if(mode==='numeric') {
        const key=Object.keys(clone).find(k=>typeof clone[k]==='string');
        clone[key]=99;
      }
      controls++; if(validate(clone))failures.push({caseId:test.caseId,mode});
    }
  }
}
const base = input.proposal.schemaProbeCases.find(t=>t.schemaRef==='TIM.EntitlementOutcome.v2'&&t.payload.kind==='POSTED').payload;
for(const mode of ['blockedFakeNumbers','cancelFakeNumbers','computedMissing','extraNested','numericQuantity','exponentQuantity','signedZero']) {
  let test=JSON.parse(JSON.stringify(base)), expected=false;
  if(mode==='blockedFakeNumbers'){test.kind='BLOCKED';test.errorCode='ZERO_DENOMINATOR';}
  if(mode==='cancelFakeNumbers'){test.kind='CANCELLED';test.cancelFence=2;}
  if(mode==='computedMissing')delete test.denominator;
  if(mode==='extraNested')test.roundingTrace[0].extra=1;
  if(mode==='numericQuantity')test.quantity=1;
  if(mode==='exponentQuantity')test.quantity='1e-6';
  if(mode==='signedZero'){test.quantity='-0.000000';test.ledgerPublicIds=[];expected=true;}
  controls++;const v=get('TIM.EntitlementOutcome.v2');if(v(test)!==expected)failures.push({mode,errors:v.errors});
}
for(const name of ['TIM.AccrualMonthly.v1','TIM.AccrualWeekly.v1','TIM.AccrualDaily.v1','TIM.AccrualAnnual.v1']) {
 const d=defs[name]; if(!d)continue;const v=get(name);
 for(const value of ['24:00:00','99:99:99','12:60:00']) {
  const props=d.properties, payload={};for(const [key,s]of Object.entries(props)){
   if(s.const!==undefined)payload[key]=s.const;else if(s.enum)payload[key]=s.enum[0];
   else if(s.type==='integer')payload[key]=s.minimum===undefined?1:s.minimum;
   else if(s.type==='string')payload[key]='00:00:00';
  } payload.localPeriodBoundaryTime=value;controls++;if(v(payload))failures.push({name,value});
 }
}
console.log(JSON.stringify({engine:'Ajv',version,engineDialect:'DRAFT_07_COMPATIBLE_VALIDATION_KEYWORDS_ONLY; holder $defs is ref storage; whole declared2020-12 author envelope NOT_VALIDATED',compiled,closedObjectSchemas:schemaObjects,annotationKeywords,typedSchemaCases:cases,negativeAndCompatibilityControls:controls,failures,domainExecuted:false,independentPass:false}));
if(failures.length)process.exitCode=1;
"""


def standard_schema_checks(proposal, draft):
    result = subprocess.run(["node", "-e", AJV], input=json.dumps({"proposal": proposal, "draft": draft}),
                            text=True, capture_output=True, timeout=60, check=False)
    if not result.stdout.strip():
        raise ValueError("Ajv did not run: " + result.stderr[-1000:])
    report = strict_loads(result.stdout)
    report["processExitCode"] = result.returncode
    return report


def canonical_oracle(draft):
    path = BASE / "coding-readiness/validate_modern_semantic_field_lineage.py"
    spec = importlib.util.spec_from_file_location("tim_review_canonical_oracle", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    verdict = module.validate_semantic_field_lineage(draft, {}, module.load_base_tables())
    return {"validationStatus": verdict.validation_status, "readinessPass": verdict.readiness_pass,
            "counts": verdict.counts, "errors": [dataclasses.asdict(error) for error in verdict.errors],
            "interpretation": "UNSUPPORTED proposal dialect is FAIL, not zero-operation PASS"}


def fixture_hash_checks(proposal):
    count = 0
    for case in proposal["fixtureDefinitions"]:
        document = case["before"].get("storedInput")
        if document:
            input_guard(document, case["before"].get("run"))
            count += 1
        outcome = case["before"].get("terminalOutcome")
        if outcome and Decimal(outcome["denominator"]) <= 0:
            raise ValueError("fixture fake computed outcome")
        if case["caseId"].endswith("DECIMAL_EQUIVALENT_HASH"):
            actual = [canonical_decimal(raw) for raw in case["request"]["rawValues"]]
            if actual != case["expected"]["canonicalValues"]:
                raise ValueError("actual XCON canonical decimal fixture expectation")
            if canonical_hash(actual[0]) != canonical_hash(actual[1]) or canonical_hash(actual[2]) != canonical_hash(actual[3]):
                raise ValueError("decimal byte equivalence")
    return {"immutableInputFingerprintChecks": count, "decimalCompatibilityConfigurations": 2,
            "nativeApiOrDomainFixtureExecutions": 0, "fixtureDefinitionsOnly": 24}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proposal", type=Path, default=PROPOSAL)
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--require-g3", action="store_true", help="always fail; author subset cannot authorize G3")
    args = parser.parse_args()
    proposal, original, draft = load_draft(args.proposal)
    structural = subset_checks(proposal, draft)
    schemas = standard_schema_checks(proposal, draft)
    hashes = fixture_hash_checks(proposal)
    oracle = canonical_oracle(draft)
    report = {"status": "AUTHOR_DRAFT_CHECKS_ONLY_NOT_APPROVED", "readinessPass": False, "G3Gate": "CLOSED",
              "independentPass": False, "structural": structural, "standardsSchema": schemas,
              "fixtureSubset": hashes, "canonicalOracle": oracle, "remainingOpen": proposal["remainingOpen"],
              "originalMutated": False, "materializedFileWritten": False, "domainExecuted": False}
    print(json.dumps(report, ensure_ascii=False, separators=(",", ":") if args.compact else None,
                     indent=None if args.compact else 2))
    return int(bool(structural["errors"] or schemas["failures"] or args.require_g3))


if __name__ == "__main__":
    sys.exit(main())
