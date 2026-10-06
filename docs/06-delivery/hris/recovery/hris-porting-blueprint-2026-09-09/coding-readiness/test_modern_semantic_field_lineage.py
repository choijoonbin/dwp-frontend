#!/usr/bin/env python3
"""Healthy independent fixtures plus fail-closed semantic graph mutations."""

from __future__ import annotations

import copy
from contextlib import redirect_stdout
import io
import json
import unittest
from unittest.mock import Mock, patch

import validate_modern_semantic_field_lineage as semantic_module

from validate_modern_semantic_field_lineage import (
    Identity, parse_sql_tables, validate_semantic_field_lineage,
)


def binding(entity: str, origin: str = "AGGREGATE_EXISTING", space: str = "PUBLIC_UUID") -> dict:
    return {"sourceKind": origin, "entityType": entity, "idSpace": space,
            "tenantBound": True, "ownerValidated": True}


def field(name: str, value_type: str, entity: str | None = None, **extra) -> dict:
    result = {"name": name, "type": value_type, "required": True}
    if entity:
        result["referenceContract"] = {"entityType": entity, "idSpace": "PUBLIC_UUID"}
    result.update(extra)
    return result


def source(target: str, value_type: str, ref: str, entity: str | None = None,
           origin: str = "AGGREGATE_EXISTING", physical: bool = False, space: str = "PUBLIC_UUID") -> dict:
    result = {"target": target, "sqlType" if physical else "type": value_type,
              "sourcePath" if physical else "source": ref}
    if entity:
        result["semanticBinding"] = binding(entity, origin, space)
    return result


def healthy_fixture() -> tuple[dict, dict, dict]:
    """Intentionally small and not copied from the defective real contracts."""
    worker, case, receipt = "table:ppl_workers", "table:ppl_cases", "table:ppl_command_receipts"
    common = [{"name": "tenant_id", "sqlType": "BIGINT", "nullable": False, "default": None},
              {"name": "public_id", "sqlType": "UUID", "nullable": False, "default": "gen_random_uuid()"},
              {"name": "correlation_id", "sqlType": "UUID", "nullable": False, "default": None}]
    tables = [
        {"tableName": "ppl_workers", "session": "HRIS-HRM", "idColumn": {"name": "worker_id", "sqlType": "BIGINT", "nullable": False, "default": "IDENTITY"},
         "columns": [{"name": "display_name", "sqlType": "VARCHAR(100)"}]},
        {"tableName": "ppl_cases", "session": "HRIS-HRM", "idColumn": {"name": "case_id", "sqlType": "BIGINT", "nullable": False, "default": "IDENTITY"},
         "columns": [{"name": "worker_id", "sqlType": "BIGINT", "nullable": False, "default": None},
                     {"name": "actor_public_id", "sqlType": "UUID", "nullable": False, "default": None}],
         "foreignKeys": [{"mode": "LOCAL_COMPOSITE_FK", "columns": ["tenant_id", "worker_id"], "target": "ppl_workers"},
                         {"mode": "OPAQUE_CROSS_BOUNDARY_REFERENCE", "columns": ["actor_public_id"], "target": "Auth.Principal"}]},
    ]
    row_schema = {"schemaId": "Worker.v1", "fields": [field("publicId", "UUID", worker), field("displayName", "STRING")]}
    page_schema = {"schemaId": "WorkerPage.v1", "fields": [field("items", "ARRAY", itemSchemaRef="Worker.v1"),
                   field("hasMore", "BOOLEAN"), field("nextCursor", "STRING"), field("asOf", "TIMESTAMPTZ"), field("scopeRevision", "BIGINT")]}
    case_schema = {"schemaId": "Case.v1", "fields": [field("publicId", "UUID", case), field("workerId", "UUID", worker), field("correlationId", "UUID")]}
    receipt_schema = {"schemaId": "Receipt.v1", "fields": [field("receiptId", "UUID", receipt), field("aggregateId", "UUID", case)]}
    request = {"pathParameters": [], "queryParameters": [], "headers": [field("X-Correlation-ID", "UUID")], "body": []}
    query_request = copy.deepcopy(request)
    query_request["queryParameters"] = [field("limit", "INTEGER"), field("asOf", "TIMESTAMPTZ")]
    command_request = copy.deepcopy(request)
    command_request["body"] = [field("workerPublicId", "UUID", worker)]
    operations = [
        {"operationId": "workers.query", "session": "HRIS-HRM", "mode": "QUERY", "readsTables": ["ppl_workers"], "writesTables": [],
         "requestSchema": query_request, "responseSchemaRef": "WorkerPage.v1", "eventNames": []},
        {"operationId": "case.create", "session": "HRIS-HRM", "mode": "COMMAND", "readsTables": ["ppl_workers"], "writesTables": ["ppl_cases"],
         "requestSchema": command_request, "responseSchemaRef": "Case.v1", "eventNames": ["CaseCreated.v1"]},
        {"operationId": "case.receipt", "session": "HRIS-HRM", "mode": "COMMAND", "readsTables": ["ppl_cases"], "writesTables": [],
         "requestSchema": request, "responseSchemaRef": "Receipt.v1", "eventNames": []},
    ]
    query_lineage = {
        "operationId": "workers.query", "inputMappings": [
            {"source": "headers.X-Correlation-ID", "objectReferenceMode": "TRACE_METADATA",
             "sinks": [{"kind": "COMMAND_CONTROL", "target": "control.X-Correlation-ID"}]},
            {"source": "queryParameters.limit", "objectReferenceMode": "NONE",
             "sinks": [{"kind": "READ_FILTER", "target": "queryFilter.limit"}]},
            {"source": "queryParameters.asOf", "objectReferenceMode": "NONE",
             "sinks": [{"kind": "READ_FILTER", "target": "queryFilter.asOf"}]},
        ],
        "typedSources": [
            {"source": "derived.rows", "type": "ARRAY", "kind": "QUERY_RESULT", "ruleId": "QUERY_PROJECT_AUTHORIZED_WORKER_ROWS",
             "inputs": ["ppl_workers.public_id", "ppl_workers.display_name"], "itemSchemaRef": "Worker.v1",
             "fieldSources": [source("Worker.v1.publicId", "UUID", "ppl_workers.public_id", worker), source("Worker.v1.displayName", "STRING", "ppl_workers.display_name")]},
            {"source": "derived.hasMore", "type": "BOOLEAN", "kind": "PAGE_HAS_MORE", "ruleId": "COMPARE_FETCH_COUNT_TO_VALIDATED_LIMIT",
             "inputs": ["queryParameters.limit", "ppl_workers.public_id"]},
            {"source": "derived.asOf", "type": "TIMESTAMPTZ", "kind": "OWNER_AS_OF", "ruleId": "REQUEST_ASOF_ELSE_OWNER_CLOCK",
             "inputs": ["queryParameters.asOf", "ownerClock.now"]},
            {"source": "derived.cursor", "type": "STRING", "kind": "PAGE_CURSOR", "ruleId": "SIGN_TENANT_CALLER_SCOPE_ASOF_CURSOR",
             "inputs": ["principal.tenantId", "principal.publicId", "authorization.scopeRevision", "derived.asOf", "ppl_workers.public_id"]},
            {"source": "derived.scope", "type": "BIGINT", "kind": "AUTHORIZATION_SCOPE_REVISION", "ruleId": "PROJECT_CURRENT_OWNER_AUTHORIZATION_REVISION",
             "inputs": ["authorization.scopeRevision"]},
        ],
        "writeSet": [], "requiredColumnSources": [], "eventFieldSources": [],
        "responseFieldSources": [source("WorkerPage.v1.items", "ARRAY", "derived.rows"), source("WorkerPage.v1.hasMore", "BOOLEAN", "derived.hasMore"),
                                source("WorkerPage.v1.nextCursor", "STRING", "derived.cursor"), source("WorkerPage.v1.asOf", "TIMESTAMPTZ", "derived.asOf"),
                                source("WorkerPage.v1.scopeRevision", "BIGINT", "derived.scope")],
    }
    local_source = source("ppl_cases.worker_id", "BIGINT", "body.workerPublicId", worker, "VALIDATED_REQUEST", True, "INTERNAL_BIGINT")
    local_source["resolution"] = {"kind": "TENANT_BOUND_PUBLIC_TO_LOCAL_INTERNAL", "table": "ppl_workers", "publicColumn": "public_id",
                                  "internalColumn": "worker_id", "tenantSource": "principal.tenantId"}
    command_lineage = {
        "operationId": "case.create", "inputMappings": [
            {"source": "headers.X-Correlation-ID", "objectReferenceMode": "TRACE_METADATA",
             "sinks": [{"kind": "COMMAND_CONTROL", "target": "control.X-Correlation-ID"}]},
            {"source": "body.workerPublicId", "objectReferenceMode": "OPAQUE_PUBLIC_UUID",
             "sinks": [{"kind": "TABLE_COLUMN", "target": "ppl_cases.worker_id",
                        "semanticBinding": binding(worker, "VALIDATED_REQUEST", "INTERNAL_BIGINT"),
                        "resolution": copy.deepcopy(local_source["resolution"])}]},
        ],
        "typedSources": [{"source": "derived.caseId", "type": "UUID", "kind": "GENERATED_BUSINESS_ID", "ruleId": "GENERATE_CASE_UUID_ONCE",
                          "inputs": [], "semanticBinding": binding(case, "GENERATED_BUSINESS_ID"),
                          "generation": {"algorithm": "UUID_V4", "issuer": "OWNER", "lifecycle": "CREATED_ONCE_REPLAY_STABLE", "persistedAt": "ppl_cases.public_id"}}],
        "writeSet": [{"table": "ppl_cases", "disposition": "INSERT"}],
        "requiredColumnSources": [local_source,
                                  source("ppl_cases.actor_public_id", "UUID", "principal.publicId", "Auth.Principal", "AUTHENTICATED_PRINCIPAL", True),
                                  source("ppl_cases.correlation_id", "UUID", "headers.X-Correlation-ID", physical=True),
                                  source("ppl_cases.tenant_id", "BIGINT", "principal.tenantId", physical=True)],
        "responseFieldSources": [source("Case.v1.publicId", "UUID", "derived.caseId", case, "GENERATED_BUSINESS_ID"),
                                source("Case.v1.workerId", "UUID", "ppl_workers.public_id", worker), source("Case.v1.correlationId", "UUID", "ppl_cases.correlation_id")],
        "eventFieldSources": [{"target": "CaseCreated.v1.workerId", "type": "UUID", "sourcePath": "body.workerPublicId", "semanticBinding": binding(worker, "VALIDATED_REQUEST")}],
    }
    receipt_lineage = {
        "operationId": "case.receipt", "inputMappings": [
            {"source": "headers.X-Correlation-ID", "objectReferenceMode": "TRACE_METADATA",
             "sinks": [{"kind": "COMMAND_CONTROL", "target": "control.X-Correlation-ID"}]},
        ], "writeSet": [], "requiredColumnSources": [], "eventFieldSources": [],
        "receiptContracts": [{"receiptId": "receipt.case", "table": "ppl_command_receipts", "idColumn": "command_receipt_id", "tenantColumn": "tenant_id",
                              "idempotencyColumn": "idempotency_key", "requestDigestColumn": "request_digest", "callerColumn": "subject_principal_public_id"}],
        "typedSources": [{"source": "derived.receiptId", "type": "UUID", "kind": "COMMAND_RECEIPT", "ruleId": "PROJECT_CALLER_BOUND_REGISTERED_RECEIPT_ID",
                          "receiptRef": "receipt.case", "inputs": ["ppl_command_receipts.command_receipt_id"], "semanticBinding": binding(receipt)}],
        "responseFieldSources": [source("Receipt.v1.receiptId", "UUID", "derived.receiptId", receipt), source("Receipt.v1.aggregateId", "UUID", "ppl_cases.public_id", case)],
    }
    receipt_sql = """CREATE TABLE ppl_command_receipts (
        command_receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id BIGINT NOT NULL,
        idempotency_key VARCHAR(160) NOT NULL,
        request_digest CHAR(64) NOT NULL,
        subject_principal_public_id UUID NOT NULL,
        UNIQUE (tenant_id, command_receipt_id)
    );"""
    doc = {"commonTableContract": {"columns": common}, "tableSpecifications": tables,
           "recordSchemas": [row_schema], "responseSchemas": [page_schema, case_schema, receipt_schema], "operationBindings": operations,
           "operationFieldLineage": [query_lineage, command_lineage, receipt_lineage]}
    events = {"eventPayloadSchemas": [{"eventName": "CaseCreated.v1", "fields": [field("workerId", "UUID", worker)]}]}
    return doc, events, parse_sql_tables(receipt_sql, "HRIS-HRM")


class SemanticDialectScopeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.doc, self.events, self.base = healthy_fixture()
        self.oracle = tuple(row["operationId"] for row in self.doc["operationBindings"])

    def check(self, doc=None, **options):
        return validate_semantic_field_lineage(self.doc if doc is None else doc, self.events, self.base, **options)

    def rejected(self, code: str, doc=None, **options) -> None:
        result = self.check(doc, **options)
        self.assertIn(code, {issue.code for issue in result.errors})
        self.assertFalse(result.readiness_pass)
        self.assertEqual("FAIL", result.validation_status)

    def test_minimum_real_query_witness_needs_no_write(self) -> None:
        self.doc["operationBindings"] = self.doc["operationBindings"][:1]
        self.doc["operationFieldLineage"] = self.doc["operationFieldLineage"][:1]
        self.doc["scope"] = {"operations": 1}
        self.doc["fieldLineageScope"] = {"operations": 1, "commands": 0, "queries": 1}
        result = self.check(expected_operation_ids=("workers.query",), expected_operation_count=1)
        self.assertEqual([], result.errors)
        self.assertTrue(result.readiness_pass)
        self.assertEqual("PASS", result.validation_status)
        self.assertEqual(1, result.counts["operations"])
        self.assertGreater(result.counts["field_sources"], 0)
        self.assertEqual([], self.doc["operationBindings"][0]["writesTables"])

    def test_command_mode_requires_exact_string_even_with_independent_scope(self) -> None:
        for mode in ("BOGUS", None, " COMMAND", "COMMAND ", "command", {}, [], True, False, 1):
            with self.subTest(mode=mode):
                doc = copy.deepcopy(self.doc)
                doc["operationBindings"] = doc["operationBindings"][1:2]
                doc["operationFieldLineage"] = doc["operationFieldLineage"][1:2]
                doc["operationBindings"][0]["mode"] = mode
                self.rejected("OPERATION_MODE_INVALID", doc, expected_operation_ids=("case.create",),
                              expected_operation_count=1)
                self.assertEqual(0, self.check(doc, expected_operation_ids=("case.create",),
                                              expected_operation_count=1).counts["operations"])
        doc = copy.deepcopy(self.doc)
        doc["operationBindings"] = doc["operationBindings"][1:2]
        doc["operationFieldLineage"] = doc["operationFieldLineage"][1:2]
        doc["operationBindings"][0].pop("mode")
        self.rejected("OPERATION_MODE_INVALID", doc, expected_operation_ids=("case.create",),
                      expected_operation_count=1)

    def test_invalid_query_mode_is_not_accepted_in_diagnostic_mode(self) -> None:
        for validation_mode in ("READINESS", "DIAGNOSTIC_ONLY"):
            with self.subTest(validation_mode=validation_mode):
                doc = copy.deepcopy(self.doc)
                doc["operationBindings"] = doc["operationBindings"][:1]
                doc["operationFieldLineage"] = doc["operationFieldLineage"][:1]
                doc["operationBindings"][0]["mode"] = " QUERY"
                self.rejected("OPERATION_MODE_INVALID", doc, validation_mode=validation_mode,
                              expected_operation_ids=("workers.query",), expected_operation_count=1)

    def test_exact_command_and_query_modes_keep_existing_source_witnesses(self) -> None:
        for index, mode in ((0, "QUERY"), (1, "COMMAND")):
            with self.subTest(mode=mode):
                doc = copy.deepcopy(self.doc)
                doc["operationBindings"] = doc["operationBindings"][index:index + 1]
                doc["operationFieldLineage"] = doc["operationFieldLineage"][index:index + 1]
                operation = doc["operationBindings"][0]
                self.assertEqual(mode, operation["mode"])
                result = self.check(doc, expected_operation_ids=(operation["operationId"],),
                                    expected_operation_count=1)
                self.assertEqual([], result.errors)
                self.assertTrue(result.readiness_pass)
                self.assertEqual("PASS", result.validation_status)
                self.assertEqual(1, result.counts["operations"])
                self.assertGreater(result.counts["field_sources"], 0)

    def test_unsupported_wfm_22_public_and_6_internal_is_not_zero_op_pass(self) -> None:
        proposal = {"contractId": "dwp.hris.tim.wfm.exact-remediation.proposal.v1", "schemaVersion": "1.0",
                    "operationDeltas": [{"operationId": f"wfm.public.{index}"} for index in range(22)],
                    "internalOperations": [{"operationId": f"wfm.owner.{index}"} for index in range(6)]}
        self.rejected("UNSUPPORTED_PROPOSAL_DIALECT", proposal)
        self.assertEqual(0, self.check(proposal).counts["operations"])

    def test_proposal_jobs_cannot_hide_behind_appended_canonical_graph(self) -> None:
        self.doc["operationDeltas"] = [{"operationId": "unvalidated.proposal.command"}]
        self.doc["internalOperations"] = [{"operationId": "unvalidated.owner.callback"}]
        self.rejected("UNSUPPORTED_PROPOSAL_DIALECT")

    def test_missing_either_canonical_graph_is_rejected(self) -> None:
        for key in ("operationBindings", "operationFieldLineage"):
            with self.subTest(key=key):
                doc = copy.deepcopy(self.doc)
                doc.pop(key)
                self.rejected("OPERATION_GRAPH_REQUIRED", doc)

    def test_empty_canonical_scope_is_not_readiness(self) -> None:
        self.rejected("EMPTY_OPERATION_SCOPE", {"operationBindings": [], "operationFieldLineage": []})

    def test_empty_lineage_cannot_cover_nonempty_operations(self) -> None:
        self.doc["operationFieldLineage"] = []
        self.rejected("OPERATION_LINEAGE_CLOSURE")

    def test_canonical_graphs_require_array_not_null_object_or_string(self) -> None:
        for key in ("operationBindings", "operationFieldLineage"):
            for value in (None, {}, ""):
                with self.subTest(key=key, value=value):
                    doc = copy.deepcopy(self.doc)
                    doc[key] = value
                    self.rejected("OPERATION_GRAPH_INVALID", doc)

    def test_duplicate_binding_cannot_be_dictionary_overwritten(self) -> None:
        self.doc["operationBindings"].append(copy.deepcopy(self.doc["operationBindings"][0]))
        self.rejected("OPERATION_BINDING_DUPLICATE")

    def test_duplicate_lineage_is_rejected(self) -> None:
        self.doc["operationFieldLineage"].append(copy.deepcopy(self.doc["operationFieldLineage"][0]))
        self.rejected("OPERATION_LINEAGE_DUPLICATE")

    def test_unknown_lineage_and_missing_operation_lineage_are_rejected(self) -> None:
        self.doc["operationFieldLineage"][0]["operationId"] = "undeclared.query"
        self.rejected("OPERATION_LINEAGE_CLOSURE")

    def test_operation_ids_require_exact_nonempty_string_and_object(self) -> None:
        for graph in ("operationBindings", "operationFieldLineage"):
            for value in ("", " ", " workers.query", 7, None, {}):
                with self.subTest(graph=graph, value=value):
                    doc = copy.deepcopy(self.doc)
                    doc[graph][0]["operationId"] = value
                    self.rejected("OPERATION_ID_INVALID", doc)
            doc = copy.deepcopy(self.doc)
            doc[graph][0] = None
            self.rejected("OPERATION_ID_INVALID", doc)

    def test_document_count_mismatch_and_noncanonical_numbers_are_rejected(self) -> None:
        for scope, key in (("scope", "operations"), ("fieldLineageScope", "operations"),
                           ("fieldLineageScope", "commands"), ("fieldLineageScope", "queries")):
            for value in (0, 99, True, "3", None):
                with self.subTest(scope=scope, key=key, value=value):
                    doc = copy.deepcopy(self.doc)
                    doc[scope] = {key: value}
                    self.rejected("DECLARED_OPERATION_COUNT_MISMATCH", doc)

    def test_declared_scope_must_be_object(self) -> None:
        self.doc["fieldLineageScope"] = []
        self.rejected("DECLARED_OPERATION_SCOPE_INVALID")

    def test_independent_count_mismatch_cannot_be_supplied_by_document(self) -> None:
        self.rejected("EXPECTED_OPERATION_COUNT_MISMATCH", expected_operation_count=len(self.oracle) + 1)

    def test_invalid_independent_count_boolean_zero_string_negative(self) -> None:
        for value in (True, 0, "3", -1):
            with self.subTest(value=value):
                self.rejected("EXPECTED_OPERATION_COUNT_INVALID", expected_operation_count=value)

    def test_both_graphs_and_counts_shortened_are_caught_by_independent_scope(self) -> None:
        self.doc["operationBindings"] = self.doc["operationBindings"][:1]
        self.doc["operationFieldLineage"] = self.doc["operationFieldLineage"][:1]
        self.doc["scope"] = {"operations": 1}
        self.doc["fieldLineageScope"] = {"operations": 1, "commands": 0, "queries": 1}
        self.rejected("EXPECTED_OPERATION_SCOPE_MISMATCH", expected_operation_ids=self.oracle,
                      expected_operation_count=len(self.oracle))

    def test_both_graph_ids_relabelled_with_same_count_are_caught(self) -> None:
        self.doc["operationBindings"][0]["operationId"] = "attacker.query"
        self.doc["operationFieldLineage"][0]["operationId"] = "attacker.query"
        self.rejected("EXPECTED_OPERATION_SCOPE_MISMATCH", expected_operation_ids=self.oracle)

    def test_canonical_cli_uses_independent_registry_not_cloned_doc_ids(self) -> None:
        self.doc["operationBindings"][0]["operationId"] = "attacker.query"
        self.doc["operationFieldLineage"][0]["operationId"] = "attacker.query"
        output = io.StringIO()
        expected = {operation_id: ("independent.capability", {}) for operation_id in self.oracle}
        with patch.object(semantic_module, "EXACT_SCHEMA", Mock(read_text=Mock(return_value=json.dumps(self.doc)))), \
                patch.object(semantic_module, "EVENT_PAYLOAD", Mock(read_text=Mock(return_value=json.dumps(self.events)))), \
                patch.object(semantic_module, "load_base_tables", return_value=self.base), \
                patch("validate_modern_capability_contracts.validate_contracts", return_value=({}, {})), \
                patch("validate_modern_capability_contracts.canonical_operation_and_table_maps", return_value=(expected, {})), \
                patch("sys.argv", ["semantic-validator", "--compact"]), redirect_stdout(output):
            exit_code = semantic_module.main()
        self.assertEqual(1, exit_code)
        self.assertIn("EXPECTED_OPERATION_SCOPE_MISMATCH", output.getvalue())
        self.assertIn("MODERN_SEMANTIC_FIELD_LINEAGE=FAIL", output.getvalue())

    def test_independent_scope_requires_unique_exact_ids_not_filter(self) -> None:
        for value in ((), ("workers.query", "workers.query"), "workers.query", (" workers.query",), (None,)):
            with self.subTest(value=value):
                self.rejected("EXPECTED_OPERATION_SCOPE_INVALID", expected_operation_ids=value)
        self.rejected("EXPECTED_OPERATION_SCOPE_MISMATCH", expected_operation_ids=("workers.query",))

    def test_legitimate_scope_counts_can_grow_without_hardcoded_total(self) -> None:
        op = copy.deepcopy(self.doc["operationBindings"][0])
        lineage = copy.deepcopy(self.doc["operationFieldLineage"][0])
        op["operationId"] = lineage["operationId"] = "workers.second-query"
        self.doc["operationBindings"].append(op)
        self.doc["operationFieldLineage"].append(lineage)
        count = len(self.doc["operationBindings"])
        self.doc["scope"] = {"operations": count}
        self.doc["fieldLineageScope"] = {"operations": count, "commands": 2, "queries": 2}
        result = self.check(expected_operation_ids=tuple(x["operationId"] for x in self.doc["operationBindings"]),
                            expected_operation_count=count)
        self.assertTrue(result.readiness_pass, result.errors)
        self.assertEqual(count, result.counts["operations"])

    def test_explicit_empty_diagnostic_is_never_readiness_pass(self) -> None:
        result = self.check({"operationBindings": [], "operationFieldLineage": []}, validation_mode="DIAGNOSTIC_ONLY")
        self.assertEqual([], result.errors)
        self.assertEqual("DIAGNOSTIC_ONLY", result.validation_status)
        self.assertFalse(result.readiness_pass)
        self.assertEqual(0, result.counts["operations"])

    def test_diagnostic_cannot_accept_unsupported_or_missing_graph(self) -> None:
        self.rejected("UNSUPPORTED_PROPOSAL_DIALECT", {"operationDeltas": []}, validation_mode="DIAGNOSTIC_ONLY")
        self.rejected("OPERATION_GRAPH_REQUIRED", {}, validation_mode="DIAGNOSTIC_ONLY")

    def test_diagnostic_still_validates_real_nonempty_sources(self) -> None:
        self.doc["operationFieldLineage"][0]["responseFieldSources"][0]["source"] = "ppl_workers.fake_column"
        self.rejected("SOURCE_COLUMN_MISSING", validation_mode="DIAGNOSTIC_ONLY")

    def test_unknown_validation_mode_is_not_diagnostic_fallback(self) -> None:
        for value in ("diagnostic", "", None, {}):
            with self.subTest(value=value):
                self.rejected("VALIDATION_MODE_INVALID", validation_mode=value)

    def test_nonobject_document_is_failclosed(self) -> None:
        result = validate_semantic_field_lineage([])
        self.assertFalse(result.readiness_pass)
        self.assertIn("DOCUMENT_DIALECT_INVALID", {x.code for x in result.errors})


class SemanticLineageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.doc, self.events, self.base = healthy_fixture()
        clean = validate_semantic_field_lineage(copy.deepcopy(self.doc), self.events, self.base)
        self.assertEqual([], clean.errors, "healthy control fixture must pass before each negative mutation")

    def rejected(self, expected: str) -> None:
        result = validate_semantic_field_lineage(self.doc, self.events, self.base)
        self.assertIn(expected, {issue.code for issue in result.errors}, [str(issue) for issue in result.errors])

    def test_healthy_request_principal_local_fk_query_receipt_generated_id(self) -> None:
        self.assertFalse(validate_semantic_field_lineage(self.doc, self.events, self.base).errors)

    def test_correlation_header_is_not_a_business_object(self) -> None:
        self.doc["operationFieldLineage"][0]["inputMappings"][0]["objectReferenceMode"] = "OPAQUE_PUBLIC_UUID"
        self.rejected("CORRELATION_OBJECT_REFERENCE")

    def test_correlation_cannot_originate_worker_uuid(self) -> None:
        self.doc["operationFieldLineage"][1]["requiredColumnSources"][0]["sourcePath"] = "headers.X-Correlation-ID"
        self.rejected("CORRELATION_AS_BUSINESS_ID")

    def test_correlation_cannot_hide_inside_registered_derived_source(self) -> None:
        lineage = self.doc["operationFieldLineage"][1]
        lineage["typedSources"].append({"source": "derived.badWorker", "type": "UUID", "kind": "DOMAIN_DERIVATION", "ruleId": "RESOLVE_WORKER_FROM_CORRELATION",
                                       "inputs": ["headers.X-Correlation-ID"], "semanticBinding": binding("table:ppl_workers", "VALIDATED_REQUEST")})
        lineage["responseFieldSources"][1]["source"] = "derived.badWorker"
        self.rejected("CORRELATION_AS_BUSINESS_ID")

    def test_trace_cannot_populate_non_metadata_scalar(self) -> None:
        self.doc["operationFieldLineage"][0]["responseFieldSources"][4]["source"] = "headers.X-Correlation-ID"
        self.rejected("CORRELATION_NON_METADATA_SINK")

    def test_policy_id_cannot_be_relabelled_as_principal(self) -> None:
        self.doc["operationBindings"][1]["requestSchema"]["body"].append(field("policyId", "UUID", "SYS.Policy"))
        row = self.doc["operationFieldLineage"][1]["requiredColumnSources"][1]
        row["sourcePath"] = "body.policyId"
        row["semanticBinding"] = binding("Auth.Principal", "VALIDATED_REQUEST")
        self.rejected("SOURCE_ENTITY_MISMATCH")

    def test_wrong_request_sink_is_not_excused_by_correct_column_source(self) -> None:
        self.doc["operationFieldLineage"][1]["inputMappings"].append({
            "source": "body.workerPublicId", "objectReferenceMode": "OPAQUE_PUBLIC_UUID",
            "sinks": [{"kind": "TABLE_COLUMN", "target": "ppl_cases.actor_public_id",
                       "semanticBinding": binding("Auth.Principal", "VALIDATED_REQUEST")}],
        })
        self.rejected("SOURCE_ENTITY_MISMATCH")

    def test_request_uuid_needs_independent_entity_declaration(self) -> None:
        self.doc["operationBindings"][1]["requestSchema"]["body"][0].pop("referenceContract")
        self.rejected("REQUEST_ENTITY_UNDECLARED")

    def test_request_cannot_expose_internal_id_space(self) -> None:
        self.doc["operationBindings"][1]["requestSchema"]["body"][0]["referenceContract"]["idSpace"] = "INTERNAL_BIGINT"
        self.rejected("REQUEST_INTERNAL_ID")

    def test_business_source_requires_provenance(self) -> None:
        self.doc["operationFieldLineage"][1]["requiredColumnSources"][1].pop("semanticBinding")
        self.rejected("SEMANTIC_BINDING_MISSING")

    def test_owner_validation_cannot_be_false(self) -> None:
        self.doc["operationFieldLineage"][1]["requiredColumnSources"][1]["semanticBinding"]["ownerValidated"] = False
        self.rejected("SEMANTIC_BINDING_INVALID")

    def test_schema_entity_cannot_disagree_with_independent_fk(self) -> None:
        self.doc["tableSpecifications"][1]["columns"][1]["referenceContract"] = {"entityType": "SYS.Policy", "idSpace": "PUBLIC_UUID"}
        self.rejected("FK_ENTITY_DECLARATION_CONFLICT")

    def test_local_uuid_to_bigint_needs_exact_resolution(self) -> None:
        self.doc["operationFieldLineage"][1]["requiredColumnSources"][0].pop("resolution")
        self.rejected("LOCAL_ID_RESOLUTION_MISSING")

    def test_local_resolution_must_bind_real_internal_column(self) -> None:
        self.doc["operationFieldLineage"][1]["requiredColumnSources"][0]["resolution"]["internalColumn"] = "imaginary_id"
        self.rejected("LOCAL_ID_RESOLUTION_MISSING")

    def test_response_cannot_expose_internal_bigint_as_uuid(self) -> None:
        self.doc["operationFieldLineage"][1]["responseFieldSources"][1]["source"] = "ppl_workers.worker_id"
        self.rejected("INTERNAL_ID_EXPOSED")

    def test_nonexistent_column_is_not_a_projection(self) -> None:
        self.doc["operationFieldLineage"][0]["responseFieldSources"][0]["source"] = "ppl_workers.items"
        self.rejected("SOURCE_COLUMN_MISSING")

    def test_real_scalar_uuid_array_cannot_masquerade_as_record_page_items(self) -> None:
        self.doc["tableSpecifications"][0]["columns"].append({"name": "worker_refs", "sqlType": "UUID[]"})
        self.doc["operationFieldLineage"][0]["responseFieldSources"][0]["source"] = "ppl_workers.worker_refs"
        self.rejected("PROJECTION_SOURCE_SHAPE_MISMATCH")

    def test_projection_string_cannot_bypass_source_registration(self) -> None:
        self.doc["operationFieldLineage"][0]["responseFieldSources"][0]["source"] = "projection.items"
        self.rejected("SOURCE_UNRESOLVED")

    def test_aggregate_string_cannot_bypass_source_registration(self) -> None:
        self.doc["operationFieldLineage"][1]["eventFieldSources"][0]["sourcePath"] = "aggregateAfterTransition.workerId"
        self.rejected("SOURCE_UNRESOLVED")

    def test_derived_string_requires_registered_definition(self) -> None:
        self.doc["operationFieldLineage"][0]["responseFieldSources"][0]["source"] = "derived.unregistered"
        self.rejected("TYPED_SOURCE_UNREGISTERED")

    def test_typed_definition_cannot_omit_dependencies(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][0]["inputs"] = []
        self.rejected("DERIVATION_INPUTS_MISSING")

    def test_typed_definition_dependencies_must_be_real(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][0]["inputs"].append("ppl_workers.fake_column")
        self.rejected("SOURCE_COLUMN_MISSING")

    def test_typed_definitions_are_acyclic(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][2]["inputs"].append("derived.cursor")
        self.rejected("TYPED_SOURCE_CYCLE")

    def test_unused_typed_definitions_are_still_checked(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"].append({"source": "derived.unused", "kind": "DOMAIN_DERIVATION", "type": "STRING", "ruleId": "PROJECT_BAD_UNUSED_SOURCE", "inputs": ["unknown.field"]})
        self.rejected("SOURCE_UNRESOLVED")

    def test_nested_record_projection_requires_all_fields(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][0]["fieldSources"].pop()
        self.rejected("RECORD_PROJECTION_CLOSURE")

    def test_projection_must_use_declared_inputs(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][0]["inputs"].remove("ppl_workers.display_name")
        self.rejected("PROJECTION_INPUT_UNDECLARED")

    def test_generic_derivation_slogan_is_not_executable_contract(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][2]["ruleId"] = "FIELD_POLICY_PROJECT_THEN_CANONICALIZE"
        self.rejected("DERIVATION_RULE_UNSPECIFIED")

    def test_cursor_requires_asof_binding(self) -> None:
        self.doc["operationFieldLineage"][0]["typedSources"][3]["inputs"].remove("derived.asOf")
        self.rejected("CURSOR_BINDING_INCOMPLETE")

    def test_receipt_cannot_use_unregistered_or_phantom_table(self) -> None:
        self.doc["operationFieldLineage"][2]["receiptContracts"] = []
        self.rejected("RECEIPT_SOURCE_UNREGISTERED")

    def test_receipt_registration_needs_actual_columns(self) -> None:
        self.doc["operationFieldLineage"][2]["receiptContracts"][0]["idColumn"] = "receipt_id"
        self.rejected("RECEIPT_COLUMN_INVALID")

    def test_operation_specific_response_identity_is_resolved_for_exact_user(self) -> None:
        response = self.doc["responseSchemas"][1]["fields"][0]
        identity = response.pop("referenceContract")
        response["referenceContractByOperation"] = {"case.create": identity}
        self.assertFalse(validate_semantic_field_lineage(self.doc, self.events, self.base).errors)

    def test_operation_specific_identity_rejects_missing_user(self) -> None:
        response = self.doc["responseSchemas"][1]["fields"][0]
        response.pop("referenceContract")
        response["referenceContractByOperation"] = {}
        self.rejected("IDENTITY_VARIANT_USER_MISMATCH")

    def test_operation_specific_identity_rejects_extra_user(self) -> None:
        response = self.doc["responseSchemas"][1]["fields"][0]
        identity = response.pop("referenceContract")
        response["referenceContractByOperation"] = {
            "case.create": identity,
            "ghost.operation": identity,
        }
        self.rejected("IDENTITY_VARIANT_USER_MISMATCH")

    def test_operation_specific_identity_rejects_wrong_entity(self) -> None:
        response = self.doc["responseSchemas"][1]["fields"][0]
        response.pop("referenceContract")
        response["referenceContractByOperation"] = {
            "case.create": {"entityType": "SYS.Policy", "idSpace": "PUBLIC_UUID"},
        }
        self.rejected("TARGET_ENTITY_MISMATCH")

    def test_operation_specific_identity_cannot_coexist_with_global_identity(self) -> None:
        response = self.doc["responseSchemas"][1]["fields"][0]
        response["referenceContractByOperation"] = {
            "case.create": copy.deepcopy(response["referenceContract"]),
        }
        self.rejected("IDENTITY_VARIANT_AMBIGUOUS")

    def test_operation_specific_identity_does_not_leak_into_request_contracts(self) -> None:
        request = self.doc["operationBindings"][1]["requestSchema"]["body"][0]
        identity = request.pop("referenceContract")
        request["referenceContractByOperation"] = {"case.create": identity}
        self.rejected("REQUEST_ENTITY_UNDECLARED")

    def alternate_receipt_sql(self, key: str, id_type: str = "UUID") -> None:
        sql = f"""CREATE TABLE ppl_command_receipts (
            internal_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            command_receipt_id {id_type} NOT NULL,
            tenant_id BIGINT NOT NULL,
            idempotency_key VARCHAR(160) NOT NULL,
            request_digest CHAR(64) NOT NULL,
            subject_principal_public_id UUID NOT NULL,
            {key}
        );"""
        self.base["ppl_command_receipts"] = parse_sql_tables(sql, "HRIS-HRM")["ppl_command_receipts"]

    def test_receipt_uuid_alternate_key_requires_exact_tenant_pair(self) -> None:
        self.alternate_receipt_sql("CONSTRAINT uq_receipt_public UNIQUE (tenant_id, command_receipt_id)")
        parsed = self.base["ppl_command_receipts"]
        self.assertIn(["tenant_id", "command_receipt_id"], parsed["uniqueKeys"])
        self.assertFalse(validate_semantic_field_lineage(self.doc, self.events, self.base).errors)

    def test_receipt_uuid_alternate_key_rejects_missing_unique_constraint(self) -> None:
        self.alternate_receipt_sql("CHECK (internal_id > 0)")
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_receipt_uuid_alternate_key_rejects_tenant_omission(self) -> None:
        self.alternate_receipt_sql("CONSTRAINT uq_receipt_public UNIQUE (command_receipt_id)")
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_receipt_uuid_alternate_key_rejects_different_unique_column(self) -> None:
        self.alternate_receipt_sql("CONSTRAINT uq_receipt_other UNIQUE (tenant_id, subject_principal_public_id)")
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_receipt_uuid_alternate_key_rejects_non_uuid_id(self) -> None:
        self.alternate_receipt_sql(
            "CONSTRAINT uq_receipt_public UNIQUE (tenant_id, command_receipt_id)",
            id_type="VARCHAR(80)",
        )
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_receipt_public_identity_rejects_non_tenant_contract_column(self) -> None:
        self.doc["operationFieldLineage"][2]["receiptContracts"][0]["tenantColumn"] = "internal_id"
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_generated_id_must_be_persisted_for_replay(self) -> None:
        self.doc["operationFieldLineage"][1]["typedSources"][0]["generation"]["persistedAt"] = "ppl_cases.fake_uuid"
        self.rejected("GENERATED_ID_NOT_REPLAY_STABLE")

    def test_generated_id_must_match_persisted_entity(self) -> None:
        self.doc["operationFieldLineage"][1]["typedSources"][0]["semanticBinding"] = binding("HRM.Worker", "GENERATED_BUSINESS_ID")
        self.rejected("GENERATED_ID_ENTITY_MISMATCH")

    def test_source_table_must_be_in_exact_operation_access(self) -> None:
        self.doc["operationBindings"][0]["readsTables"] = []
        self.rejected("SOURCE_TABLE_UNDECLARED")

    def test_cross_owner_sql_reference_is_forbidden(self) -> None:
        self.doc["tableSpecifications"][0]["session"] = "HRIS-PER"
        self.rejected("SOURCE_OWNER_BOUNDARY")

    def test_sql_parser_handles_nested_comma_defaults_and_constraints(self) -> None:
        sql = """CREATE TABLE example_receipt (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            public_id UUID NOT NULL,
            amount NUMERIC(19,4) DEFAULT round(1.001, 4),
            label VARCHAR(40) DEFAULT 'a,b',
            -- fake_uuid UUID is not a column
            CONSTRAINT ck_example CHECK (label IN ('a,b','c'))
        );"""
        parsed = parse_sql_tables(sql, "HRIS-HRM")
        self.assertEqual({"id", "public_id", "amount", "label"}, set(parsed["example_receipt"]["columns"]))
        self.assertEqual("NUMERIC(19,4)", parsed["example_receipt"]["columns"]["amount"]["sqlType"])
        self.assertEqual(Identity("table:example_receipt", "PUBLIC_UUID"), parsed["example_receipt"]["columns"]["public_id"]["_identity"])


class CanonicalSealedRegistryMutationTests(unittest.TestCase):
    """Mutate the real 100-operation graph; sealed and local closure both fail closed."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.clean_doc = json.loads(semantic_module.EXACT_SCHEMA.read_text(encoding="utf-8"))
        cls.clean_events = json.loads(semantic_module.EVENT_PAYLOAD.read_text(encoding="utf-8"))
        cls.clean_base = semantic_module.load_base_tables()
        cls.clean_semantic_registry = json.loads(semantic_module.SEMANTIC_BINDINGS.read_text(encoding="utf-8"))
        cls.clean_identity_registry = json.loads(semantic_module.PUBLIC_IDENTITIES.read_text(encoding="utf-8"))
        result = validate_semantic_field_lineage(cls.clean_doc, cls.clean_events, cls.clean_base)
        if result.errors:
            raise AssertionError("canonical control must pass: " + "; ".join(map(str, result.errors[:5])))

    def setUp(self) -> None:
        self.doc = copy.deepcopy(self.clean_doc)
        self.events = copy.deepcopy(self.clean_events)
        self.base = copy.deepcopy(self.clean_base)

    def result(self, **options):
        return validate_semantic_field_lineage(self.doc, self.events, self.base, **options)

    def rejected(self, code: str, **options) -> None:
        result = self.result(**options)
        self.assertIn(code, {issue.code for issue in result.errors}, [str(issue) for issue in result.errors])
        self.assertFalse(result.readiness_pass)

    def operation(self, operation_id: str) -> dict:
        return next(row for row in self.doc["operationBindings"] if row["operationId"] == operation_id)

    def lineage(self, operation_id: str) -> dict:
        return next(row for row in self.doc["operationFieldLineage"] if row["operationId"] == operation_id)

    def test_remove_request_mapping_fails_exact_closure(self) -> None:
        self.lineage("modern.recruiting.requisition.create")["inputMappings"].pop()
        self.rejected("INPUT_MAPPING_CLOSURE")

    def test_duplicate_request_mapping_fails_exact_closure(self) -> None:
        rows = self.lineage("modern.recruiting.requisition.create")["inputMappings"]
        rows.append(copy.deepcopy(rows[0]))
        self.rejected("INPUT_MAPPING_CLOSURE")

    def test_remove_required_column_fails_exact_closure(self) -> None:
        self.lineage("modern.recruiting.requisition.create")["requiredColumnSources"].pop()
        self.rejected("REQUIRED_COLUMN_CLOSURE")

    def test_duplicate_response_field_fails_exact_closure(self) -> None:
        rows = self.lineage("modern.recruiting.requisitions.query")["responseFieldSources"]
        rows.append(copy.deepcopy(rows[0]))
        self.rejected("RESPONSE_FIELD_CLOSURE")

    def test_unknown_event_target_fails_exact_closure(self) -> None:
        rows = self.lineage("modern.recruiting.candidate.stage")["eventFieldSources"]
        unknown = copy.deepcopy(rows[0])
        unknown["target"] = "CandidateStageChanged.v1.unknownField"
        rows.append(unknown)
        self.rejected("EVENT_FIELD_CLOSURE")

    def test_simultaneous_request_and_mapping_omission_fails_sealed_oracle(self) -> None:
        operation = self.operation("modern.recruiting.requisition.create")
        operation["requestSchema"]["body"] = [
            field for field in operation["requestSchema"]["body"] if field["name"] != "title"
        ]
        lineage = self.lineage(operation["operationId"])
        lineage["inputMappings"] = [
            row for row in lineage["inputMappings"] if row["source"] != "body.title"
        ]
        self.rejected("SEALED_OPERATION_CONTRACT_DRIFT")

    def test_whole_operation_omission_with_rewritten_counts_fails_independent_scope(self) -> None:
        removed = self.doc["operationBindings"].pop()
        self.doc["operationFieldLineage"] = [
            row for row in self.doc["operationFieldLineage"] if row["operationId"] != removed["operationId"]
        ]
        self.doc["scope"]["operations"] -= 1
        self.doc["fieldLineageScope"]["operations"] -= 1
        self.doc["fieldLineageScope"]["commands" if removed["mode"] == "COMMAND" else "queries"] -= 1
        self.rejected("CAPABILITY_OPERATION_CLOSURE")

    def test_operation_relabel_fails_independent_capability_oracle(self) -> None:
        operation = self.doc["operationBindings"][0]
        old = operation["operationId"]
        operation["operationId"] = old + ".relabelled"
        self.doc["operationFieldLineage"][0]["operationId"] = operation["operationId"]
        self.rejected("CAPABILITY_OPERATION_CLOSURE")

    def test_same_session_cross_capability_sql_is_forbidden(self) -> None:
        operation = self.operation("modern.recruiting.requisitions.query")
        operation["readsTables"].append("ppl_jny_templates")
        self.rejected("CAPABILITY_TABLE_OWNERSHIP")

    def test_type_only_request_rebinding_fails_reviewed_binding(self) -> None:
        lineage = self.lineage("modern.recruiting.requisition.create")
        row = next(item for item in lineage["requiredColumnSources"]
                   if item["target"] == "ppl_rec_requisitions.requisition_code")
        self.assertEqual("body.requisitionCode", row["sourcePath"])
        row["sourcePath"] = "body.title"  # same STRING type, different business meaning
        self.rejected("SEALED_LINEAGE_DRIFT")

    def test_event_state_without_registered_transition_is_forbidden(self) -> None:
        lineage = self.lineage("modern.recruiting.candidate.stage")
        row = next(item for item in lineage["eventFieldSources"]
                   if item["target"].rsplit(".", 1)[-1] in {"fromState", "fromStage"})
        row["sourcePath"] = "ppl_rec_candidate_cases.stage"
        self.rejected("EVENT_STATE_WITHOUT_TRANSITION")

    def test_event_link_relabel_fails_independent_capability_oracle(self) -> None:
        operation = self.operation("modern.recruiting.candidate.stage")
        operation["eventNames"] = ["CandidateHired.v1"]
        self.rejected("CAPABILITY_OPERATION_RELABEL")

    def test_receipt_unique_pair_order_is_exact(self) -> None:
        table = self.base["ppl_command_receipts"]
        table["uniqueKeys"] = [
            (["command_receipt_id", "tenant_id"] if key == ["tenant_id", "command_receipt_id"] else key)
            for key in table["uniqueKeys"]
        ]
        self.rejected("RECEIPT_PUBLIC_ID_INVALID")

    def test_public_identity_relabel_with_resealed_json_fails_code_pin_and_schema(self) -> None:
        registry = copy.deepcopy(self.clean_identity_registry)
        operation_id = "modern.recruiting.requisition.create"
        registry["requestFieldsByOperation"][operation_id]["body.organizationPublicId"]["entityType"] = "SYS.Policy"
        registry["sealedPayloadSha256"] = semantic_module.SemanticValidator.registry_digest(registry)
        result = self.result(identity_registry=registry)
        codes = {issue.code for issue in result.errors}
        self.assertIn("SEALED_REGISTRY_PIN_MISMATCH", codes)
        self.assertIn("PUBLIC_IDENTITY_REQUEST_CONFLICT", codes)

    def test_semantic_registry_rewrite_cannot_approve_type_only_binding(self) -> None:
        operation_id = "modern.recruiting.requisition.create"
        lineage = self.lineage(operation_id)
        row = next(item for item in lineage["requiredColumnSources"]
                   if item["target"] == "ppl_rec_requisitions.requisition_code")
        row["sourcePath"] = "body.title"
        registry = copy.deepcopy(self.clean_semantic_registry)
        sealed = next(item for item in registry["operations"] if item["operationId"] == operation_id)
        sealed_row = next(item for item in sealed["requiredColumnSources"]
                          if item["target"] == row["target"])
        sealed_row["sourcePath"] = "body.title"
        registry["sealedPayloadSha256"] = semantic_module.SemanticValidator.registry_digest(registry)
        self.rejected("SEALED_REGISTRY_PIN_MISMATCH", semantic_registry=registry)

    def test_insert_cannot_source_required_value_from_nonexistent_prestate(self) -> None:
        lineage = self.lineage("modern.recruiting.offer.issue")
        row = next(item for item in lineage["requiredColumnSources"]
                   if item["target"] == "ppl_rec_offers.valid_from")
        row["sourcePath"] = "ppl_rec_offers.valid_from"
        self.rejected("INSERT_FROM_NONEXISTENT_PRESTATE")

    def test_write_disposition_omission_fails_exact_closure(self) -> None:
        self.lineage("modern.recruiting.offer.issue")["writeSet"].pop()
        self.rejected("WRITE_DISPOSITION_CLOSURE")

    def test_canonical_reciprocal_registry_pin_cannot_be_removed(self) -> None:
        self.doc.pop("independentRegistryCorePins")
        self.rejected("RECIPROCAL_REGISTRY_PIN_MISMATCH")


if __name__ == "__main__":
    unittest.main()
