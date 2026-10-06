"""Concrete synthetic fixtures/replay; native Auth/DB/DML/transport execution zero."""
import base64
import copy
import gzip
import hashlib
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("tim_v4", Path(__file__).with_name("tim_cross_context_successor_v4.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ZERO = "0" * 64
UID = "b0000000-0000-4000-8000-000000000001"


def concrete_fixtures():
    delta = json.loads((m.HERE / "tim-base-review-remediation.proposal.v1.json").read_text())
    inputs = [copy.deepcopy(f["before"]["storedInput"]) for f in delta["fixtureDefinitions"]
              if f["caseId"].endswith("RESTART_NO_CALLER_PAYLOAD")]
    instructions = []
    for document in inputs:
        selected = document["selectedItems"][0]
        employment = {"snapshotPublicId": UID, "employmentPublicId": UID,
                      "workerPublicId": selected["enrollment"]["workerPublicId"],
                      "assignmentPublicIds": [selected["enrollment"]["assignmentPublicId"]],
                      "employmentState": "SEPARATED", "employmentEndedOn": "2026-10-24",
                      "revision": 1, "asOf": document["asOf"], "validUntil": "2026-12-31T00:00:00Z",
                      "contentSha256": ZERO, "sourceRefs": copy.deepcopy(document["policyContent"]["sourceRefs"])}
        ledger = {"enrollmentPublicId": selected["enrollment"]["enrollmentPublicId"],
                  "ledgerRevision": 0, "reservationRevision": 0, "unit": selected["unit"],
                  "postedBalance": "1", "reservedQuantity": "0", "originalGrantPublicIds": [],
                  "closedPeriodPublicIds": [], "summarySha256": ZERO}
        instructions.append({"workflowPublicId": "b0000000-0000-4000-8000-000000000070", "enrollment": selected["enrollment"],
                             "employmentTermination": employment, "policyRef": document["policyRef"],
                             "policyContent": copy.deepcopy(document["policyContent"]), "ledgerSummary": ledger,
                             "treatment": "PRORATE_FINAL_PERIOD", "instructionSha256": ZERO})
    row = {"segmentPublicId": "b0000000-0000-4000-8000-000000000050", "periodPublicId": "b0000000-0000-4000-8000-000000000040", "workerPublicId": inputs[0]["selectedItems"][0]["enrollment"]["workerPublicId"],
           "assignmentPublicId": inputs[0]["selectedItems"][0]["enrollment"]["assignmentPublicId"],
           "lineKey": "native-line-1", "localWorkDate": "2026-10-24", "startsAt": "2026-10-24T09:00:00Z",
           "endsAt": "2026-10-24T10:00:00Z", "timeZone": "Etc/UTC", "startOffsetSeconds": 0,
           "endOffsetSeconds": 0, "tzdbVersion": "synthetic-2026a", "zoneRuleVersion": "synthetic-owner1",
           "startDstResolution": "UNIQUE", "endDstResolution": "UNIQUE", "provenanceSha256": ZERO,
           "kind": "WORK", "paid": True, "workRuleContentSha256": ZERO}
    authority = {"actorPrincipalPublicId": "b0000000-0000-4000-8000-000000000010", "actorUserRowVersion": 0, "actorAccessRevision": 0,
                 "authRevision": "auth-" + ZERO, "policyRevision": "policy-synthetic-v1",
                 "contextKey": "psc-" + ZERO, "decisionRevision": "psr-" + ZERO}
    owner = {"ownerContractId": "TIME.PublishedScheduleSnapshot.proposal.v4", "sourceStreamKey": "time-schedule",
             "header": {"tenantId": 7, "snapshotPublicId": "b0000000-0000-4000-8000-000000000020", "businessRevision": 1,
                        "asOf": "2026-10-24T08:00:00Z", "validUntil": "2026-10-24T12:00:00Z",
                        "purposeCode": "ABS_LEAVE_SEGMENT", "populationScopeDigest": ZERO,
                        "contentSha256": ZERO, "actorAuthority": authority},
             "payload": {"publicationPublicId": "b0000000-0000-4000-8000-000000000030", "publicationRevision": 1, "segments": [row]}}
    owner["header"]["contentSha256"] = m.digest(owner["payload"])
    local = {"tenantId": 7, "purposeCode": "ABS_LEAVE_SEGMENT", "scopeDigest": ZERO,
             "now": "2026-10-24T08:30:00Z", "workerPublicId": row["workerPublicId"],
             "assignmentPublicId": row["assignmentPublicId"], "actorPrincipalPublicId": authority["actorPrincipalPublicId"],
             "projectionPublicId": "b0000000-0000-4000-8000-000000000060", "returningInternalId": 123}
    return {"fixtureGrade": "API_SHAPE_VALID_SYNTHETIC_OWNER_AND_DB_RETURNING_NOT_NATIVE",
            "inputsAB": inputs, "instructionsAB": instructions, "scheduleOwner": owner, "scheduleLocal": local}




def import_environment(fixtures):
    owner=copy.deepcopy(fixtures["scheduleOwner"])
    calendar={"calendarVersionPublicId":UID,"revision":1,"timeZone":"Etc/UTC","effectiveFrom":"2026-10-01","effectiveTo":"2026-11-01",
              "entries":[{"localDate":"2026-10-24","workingDay":True,"scheduledMinutes":60,"holidayCode":None}]}
    owner.update(ownerContractId="SYS.TimeCalendarSnapshot.proposal.v4",sourceStreamKey="configuration-calendar",payload=calendar)
    owner["header"]["contentSha256"]=m.digest(calendar)
    report={"artifactKind":"LeavePolicy","subjectPublicId":UID,"subjectRowVersion":0,"subjectContentSha256":ZERO,
            "reportKind":"VALIDATION","ruleVersion":"synthetic-local1","findings":[],"measures":[]}
    gov=copy.deepcopy(owner)
    gov.update(ownerContractId="SYS.AbsGovernanceDecision.proposal.v4",sourceStreamKey="configuration-leave-governance",
               payload={"governanceRequestPublicId":UID,"subjectPublicId":UID,"subjectRowVersion":0,"subjectContentSha256":ZERO,"decision":"PENDING"})
    gov["header"]["contentSha256"]=m.digest(gov["payload"])
    environment={"invocation":{"tenantId":7,"actorPrincipalPublicId":owner["header"]["actorAuthority"]["actorPrincipalPublicId"],"purposeCode":"ABS_LEAVE_SEGMENT","scopeDigest":ZERO},
        "clock":{"transactionTime":"2026-10-24T08:30:00Z"},"allocator":{"persistedPublicUuid":UID},
        "transaction":{"insert":{name:{identifier:123} for name,identifier in
            [("abs_owner_artifact_snapshots","owner_artifact_snapshot_id"),("abs_calendar_version_snapshots","calendar_snapshot_id"),
             ("abs_policy_evaluation_reports","policy_evaluation_report_id"),("abs_policy_governance_bindings","policy_governance_binding_id")]}},
        "owner":{"response":owner,"calendar":owner},"registered":{"ownerSchemaByContractId":"V4.CalendarPayload"},
        "loaded":{"abs_leave_plan_versions":{"leave_plan_version_id":42,"public_id":UID,"row_version":0,"content_digest":ZERO}},
        "evaluator":{"report":report},"constructor":{"reportDigest":m.digest(report),"governanceStatus":"PENDING"}}
    return environment,gov


class TimV4Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan, cls.defs = m.build()
        cls.fixtures = concrete_fixtures()

    def mutated_plan(self, change, error):
        p = copy.deepcopy(self.plan)
        change(p)
        with self.assertRaisesRegex(ValueError, error):m.validate(p)

    def test_catalog116_and_remaining112_from_frozen_oracle(self):
        self.assertEqual(len(self.plan["independentExpectedCatalog"]), 116)
        self.assertEqual(len(self.plan["unclosedOperationIds"]), 112)
        self.assertEqual(len(self.plan["scopedOperationContracts"]), 4)

    def test_exact_termination_treatments_all_three_A_B(self):
        for original in self.fixtures["instructionsAB"]:
            for treatment in m.TREATMENTS:
                x = copy.deepcopy(original);x["treatment"] = treatment;x["policyContent"]["terminationTreatment"] = treatment
                result = m.termination_instruction(x, self.defs)
                self.assertEqual(result["enrollmentEffectiveToExclusive"], "2026-10-25")
                self.assertEqual(result["newCorrectiveRunRequired"], treatment == "PRORATE_FINAL_PERIOD")
                self.assertFalse(result["DML"])

    def test_stop_only_invalid_owner_schema_and_constructor(self):
        x = copy.deepcopy(self.fixtures["instructionsAB"][0]);x["treatment"] = "STOP_ONLY";x["policyContent"]["terminationTreatment"] = "STOP_ONLY"
        with self.assertRaisesRegex(ValueError, "TREATMENT_OWNER_SOURCE"):m.termination_instruction(x, self.defs)

    def test_prorate_alias_and_settlement_alias_denied(self):
        for treatment in ["PRORATE", "ownerSettlement"]:
            x = copy.deepcopy(self.fixtures["instructionsAB"][0]);x["treatment"] = treatment
            with self.assertRaises(ValueError):m.termination_instruction(x, self.defs)

    def test_owner_treatment_cannot_be_request_override(self):
        x = copy.deepcopy(self.fixtures["instructionsAB"][0]);x["treatment"] = "STOP_FUTURE_ONLY"
        with self.assertRaisesRegex(ValueError, "TREATMENT_OWNER_SOURCE"):m.termination_instruction(x, self.defs)

    def test_target_assignment_not_actor_or_sibling(self):
        x = copy.deepcopy(self.fixtures["instructionsAB"][0]);x["employmentTermination"]["assignmentPublicIds"] = [UID]
        with self.assertRaisesRegex(ValueError, "TERMINATION_SUBJECT_PARENT"):m.termination_instruction(x, self.defs)

    def test_actual_external_parent_public_and_proposal_internal_keys(self):
        p = self.plan["externalParents"]
        self.assertIn(["tenant_id", "public_id"], p["tme_command_receipts"]["uniqueKeys"])
        self.assertNotIn(["tenant_id", "command_receipt_id"], p["tme_command_receipts"]["uniqueKeys"])
        self.assertIn(["tenant_id", "public_id"], p["tme_close_periods"]["uniqueKeys"])
        self.assertIn(["tenant_id", "schedule_candidate_id"], p["tme_wfm_schedule_candidates"]["uniqueKeys"])
        self.assertFalse(p["tme_wfm_schedule_candidates"]["CURRENT_PUBLISHED"])

    def change_external(self, plan, **change):
        next(f for t in plan["structuralTables"] for f in t["foreignKeys"] if f["targetTable"] == "tme_command_receipts").update(change)

    def test_known_external_missing_child_fatal(self):
        self.mutated_plan(lambda p:self.change_external(p, columns=["tenant_id", "fiction"]), "FK_COLUMN_OR_TYPE")

    def test_known_external_empty_target_arity_fatal(self):
        self.mutated_plan(lambda p:self.change_external(p, targetColumns=[]), "FK_ARITY")

    def test_known_external_non_tenant_first_fatal(self):
        self.mutated_plan(lambda p:self.change_external(p, columns=["native_command_receipt_public_id", "tenant_id"]), "FK_TENANT_PREFIX")

    def test_external_source_provenance_edit_fatal(self):
        self.mutated_plan(lambda p:p["externalParents"]["tme_command_receipts"]["columns"].update(public_id="BIGINT"), "EXTERNAL_PARENT_PROVENANCE")

    def test_no_new_internal_receipt_unique_fabrication(self):
        self.mutated_plan(lambda p:p["externalParents"]["tme_command_receipts"]["uniqueKeys"].append(["tenant_id","command_receipt_id"]), "EXTERNAL_PARENT_PROVENANCE")

    def test_AB_inputs_schema_and_restart_full_bytes(self):
        for f in self.fixtures["inputsAB"]:
            value = m.assemble_input(f, self.defs)
            self.assertEqual(m.refetch_input(value,value["selectedItems"],value["runPublicId"],value["contentSha256"],self.defs),value)

    def test_input_digest_ownslot_excluded_only(self):
        f = m.assemble_input(self.fixtures["inputsAB"][0],self.defs)
        self.assertEqual(f["contentSha256"],m.digest(f,"contentSha256"))
        changed = copy.deepcopy(f);changed["contentSha256"] = "f"*64
        self.assertEqual(m.digest(f,"contentSha256"),m.digest(changed,"contentSha256"))
        changed["selectedCount"] += 1;self.assertNotEqual(m.digest(f,"contentSha256"),m.digest(changed,"contentSha256"))

    def test_decimal_alias_schema_guided_hash_equality(self):
        f = copy.deepcopy(self.fixtures["inputsAB"][0]);x = copy.deepcopy(f)
        x["policyContent"]["accrualAmount"]["value"] = f["policyContent"]["accrualAmount"]["value"] + ".000000"
        self.assertEqual(m.assemble_input(f,self.defs)["contentSha256"],m.assemble_input(x,self.defs)["contentSha256"])

    def test_numerator_float_not_decimal_wire(self):
        with self.assertRaises(ValueError):m.normalize_decimal(1.5)

    def test_document_count_revision_date_unit_negatives(self):
        for field,value in [("selectedCount",2),("revision",2),("periodEnd","2026-09-01")]:
            x=copy.deepcopy(self.fixtures["inputsAB"][0]);x[field]=value
            with self.assertRaises(ValueError):m.assemble_input(x,self.defs)
        x=copy.deepcopy(self.fixtures["inputsAB"][0]);x["selectedItems"][0]["unit"]="DAY"
        with self.assertRaisesRegex(ValueError,"INPUT_UNIT"):m.assemble_input(x,self.defs)

    def test_duplicate_and_sibling_selected_parent(self):
        x=copy.deepcopy(self.fixtures["inputsAB"][0]);x["selectedItems"].append(copy.deepcopy(x["selectedItems"][0]));x["selectedCount"]=2
        with self.assertRaises(ValueError):m.assemble_input(x,self.defs)
        x=copy.deepcopy(self.fixtures["inputsAB"][0]);x["selectedItems"][0]["inputVersionPublicId"]=UID
        with self.assertRaisesRegex(ValueError,"SELECTED_PARENT"):m.assemble_input(x,self.defs)

    def test_correction_requires_original_grant_run(self):
        x=copy.deepcopy(self.fixtures["inputsAB"][0]);x["selectedItems"][0]["correctionMode"]="REVERSE_AND_REGRANT"
        with self.assertRaises(ValueError):m.assemble_input(x,self.defs)

    def test_immutable_local_refetch_tamper(self):
        f=m.assemble_input(self.fixtures["inputsAB"][0],self.defs);changed=copy.deepcopy(f);changed["policyContent"]["balanceCap"]["value"]="19"
        with self.assertRaisesRegex(ValueError,"IMMUTABLE_INPUT_REFETCH"):m.refetch_input(changed,changed["selectedItems"],f["runPublicId"],f["contentSha256"],self.defs)

    def test_schedule_all29_columns_owner_header_row_local_provenance(self):
        value=m.project_schedule(self.fixtures["scheduleOwner"],0,self.fixtures["scheduleLocal"],self.defs)
        self.assertEqual(len(value),29);self.assertEqual(value["scheduled_segment_id"],123)
        self.assertEqual(value["source_segment_public_id"],self.fixtures["scheduleOwner"]["payload"]["segments"][0]["segmentPublicId"])
        self.assertNotEqual(value["source_segment_public_id"],value["source_snapshot_public_id"])
        self.assertNotEqual(value["public_id"],value["source_segment_public_id"])
        self.assertNotEqual(value["created_by"],value["source_segment_public_id"])
        self.assertEqual(value["rule_digest"],self.fixtures["scheduleOwner"]["payload"]["segments"][0]["workRuleContentSha256"])

    def test_schedule_missing_unknown_fields_schema_denied(self):
        for field in ["paid","workRuleContentSha256"]:
            x=copy.deepcopy(self.fixtures["scheduleOwner"]);x["payload"]["segments"][0].pop(field)
            with self.assertRaisesRegex(ValueError,"SCHEMA_ENGINE"):m.project_schedule(x,0,self.fixtures["scheduleLocal"],self.defs)

    def test_schedule_body_time_internal_key_schema_denied(self):
        x=copy.deepcopy(self.fixtures["scheduleOwner"]);x["payload"]["segments"][0]["schedule_period_id"]=42
        with self.assertRaisesRegex(ValueError,"SCHEMA_ENGINE"):m.project_schedule(x,0,self.fixtures["scheduleLocal"],self.defs)

    def test_schedule_tenant_scope_purpose_stale_denied(self):
        for field,value in [("tenantId",8),("purposeCode","OTHER"),("scopeDigest","f"*64),("now","2027-01-01T00:00:00Z")]:
            x=copy.deepcopy(self.fixtures["scheduleLocal"]);x[field]=value
            with self.assertRaises(ValueError):m.project_schedule(self.fixtures["scheduleOwner"],0,x,self.defs)

    def test_schedule_content_and_target_membership_denied(self):
        x=copy.deepcopy(self.fixtures["scheduleOwner"]);x["payload"]["segments"][0]["paid"]=False
        with self.assertRaisesRegex(ValueError,"OWNER_CONTENT_DIGEST"):m.project_schedule(x,0,self.fixtures["scheduleLocal"],self.defs)
        x=copy.deepcopy(self.fixtures["scheduleLocal"]);x["workerPublicId"]=UID
        with self.assertRaisesRegex(ValueError,"SCHEDULE_POPULATION"):m.project_schedule(self.fixtures["scheduleOwner"],0,x,self.defs)

    def test_optional_disabled_calls_zero_enabled_missing_denies(self):
        calls=[];self.assertIsNone(m.optional_owner(False,lambda:calls.append(1)))
        self.assertEqual(calls,[])
        with self.assertRaisesRegex(ValueError,"REQUIRED_OWNER_ADAPTER_MISSING"):m.optional_owner(True,None)

    def test_source_177_six95_no_TIME_body(self):
        self.assertEqual(sum(map(len,self.plan["sourceGraphs"].values())),177)
        six=m.load_frozen()[0].SOURCE_SUCCESSORS
        self.assertEqual(sum(len(v) for k,v in self.plan["sourceGraphs"].items() if k in six),95)

    def test_filler_source_simultaneous_type_or_input_edits_fatal(self):
        self.mutated_plan(lambda p:p["sourceGraphs"]["abs_entitlement_input_versions"]["input_payload"].update(inputs=["invocation.tenantId","invocation.actorPrincipalPublicId"]),"EXACT_SOURCE_GRAPH")
        self.mutated_plan(lambda p:p["sourceGraphs"]["abs_time_schedule_segment_snapshots"]["rule_digest"].update(inputs=["loaded.tme_work_rule_set_versions.content_digest"]),"EXACT_SOURCE_GRAPH")

    def test_ABS_otherTIME_readwrite_fatal(self):
        for key in ["readsTables","writesTables"]:
            self.mutated_plan(lambda p:p["scopedOperationContracts"][1][key].append("tme_time_cards"),"ABS_TIME_BUSINESS_ACCESS")

    def test_physical_child_type_and_binding_same_edit_fatal(self):
        def edit(p):
            t=next(t for t in p["structuralTables"] if t["tableName"]=="abs_entitlement_runs")
            next(c for c in t["columns"] if c["name"]=="input_version_id")["sqlType"]="TEXT"
            p["sourceGraphs"]["abs_entitlement_runs"]["input_version_id"]["sqlType"]="TEXT"
        self.mutated_plan(edit,"FROZEN_PHYSICAL_COLUMN_TYPE")

    def test_106guards_no_loss_and_typed_sql_vs_semantic(self):
        self.assertEqual(len(self.plan["guardDispositions"]),106)
        self.assertTrue(any(g["kind"]=="SQL_CHECK_AST" for g in self.plan["guardDispositions"]))
        self.assertTrue(any(g["kind"]=="OWNER_SEMANTIC_REQUIRED_OPEN" for g in self.plan["guardDispositions"]))
        self.mutated_plan(lambda p:p["guardDispositions"].pop(),"GUARD_DISPOSITION_LOSS")

    def test_guard_unknown_column_or_sql_injection_denied(self):
        for text in ["tenant_id=1;DROP TABLE x","fiction=1","status IN ('a') OR 1=1--"]:
            with self.assertRaises(ValueError):m.parse_guard(text,{"tenant_id":"BIGINT","status":"VARCHAR(10)"})

    def test_native_flag_open_hide_fatal(self):
        self.mutated_plan(lambda p:p.update(nativeExecution=True),"NO_AUTHORIZATION")
        self.mutated_plan(lambda p:p.update(remainingOpen=["NOTHING"]),"OPEN_REGISTRY_HIDE")

    def test_synchronized_candidate_catalog_drop_fatal(self):
        def edit(p):
            p["independentExpectedCatalog"].pop();p["unclosedOperationIds"].pop()
        self.mutated_plan(edit,"INDEPENDENT_CATALOG_DRIFT")

    def test_boundary_count_same_fake_disposition_fatal(self):
        self.mutated_plan(lambda p:p.update(boundaryDispositions=[{"table":"fake"}]*15),"BOUNDARY_INVENTORY")

    def test_opaque_actor_authority_not_numeric(self):
        x=copy.deepcopy(self.fixtures["scheduleOwner"]);x["header"]["actorAuthority"]["authRevision"]=17
        with self.assertRaisesRegex(ValueError,"SCHEMA_ENGINE"):m.project_schedule(x,0,self.fixtures["scheduleLocal"],self.defs)

    def test_sql_still_denied_no_native_wfm_and_semantic_handlers(self):
        result=subprocess.run([sys.executable,"-B",str(m.HERE/"tim_cross_context_successor_v4.py"),"--sql"],capture_output=True,text=True)
        self.assertEqual(result.returncode,1);self.assertEqual(result.stdout,"")
        self.assertIn("SQL export refused",result.stderr)

    def test_full_owner_and_local_evaluator_rows_schema_82fields(self):
        owner = copy.deepcopy(self.fixtures["scheduleOwner"])
        calendar = {"calendarVersionPublicId": UID, "revision": 1, "timeZone": "Etc/UTC",
                    "effectiveFrom": "2026-10-01", "effectiveTo": "2026-11-01",
                    "entries": [{"localDate": "2026-10-24", "workingDay": True, "scheduledMinutes": 60, "holidayCode": None}]}
        owner.update(ownerContractId="SYS.TimeCalendarSnapshot.proposal.v4", sourceStreamKey="configuration-calendar", payload=calendar)
        owner["header"]["contentSha256"] = m.digest(calendar)
        policy = {"leave_plan_version_id": 42, "public_id": UID, "row_version": 0, "content_digest": ZERO}
        report = {"artifactKind": "LeavePolicy", "subjectPublicId": UID, "subjectRowVersion": 0,
                  "subjectContentSha256": ZERO, "reportKind": "VALIDATION", "ruleVersion": "synthetic-local1", "findings": [], "measures": []}
        local = {"invocation": {"tenantId": 7,"actorPrincipalPublicId":owner["header"]["actorAuthority"]["actorPrincipalPublicId"],"purposeCode":"ABS_LEAVE_SEGMENT","scopeDigest":ZERO},
                 "clock": {"transactionTime":"2026-10-24T08:30:00Z"}, "allocator":{"persistedPublicUuid":UID},
                 "transaction":{"insert":{name:{g_id:123} for name,g_id in
                       [("abs_owner_artifact_snapshots","owner_artifact_snapshot_id"),("abs_calendar_version_snapshots","calendar_snapshot_id"),
                        ("abs_policy_evaluation_reports","policy_evaluation_report_id"),("abs_policy_governance_bindings","policy_governance_binding_id")]}},
                 "owner":{"response":owner,"calendar":owner}, "registered":{"ownerSchemaByContractId":"V4.CalendarPayload"},
                 "loaded":{"abs_leave_plan_versions":policy}, "evaluator":{"report":report},
                 "constructor":{"reportDigest":m.digest(report),"governanceStatus":"PENDING"}}
        rows = {name:m.project_abs_import(name,local,self.defs) for name in
                    ["abs_owner_artifact_snapshots","abs_calendar_version_snapshots","abs_policy_evaluation_reports"]}
        governance = copy.deepcopy(owner)
        governance.update(ownerContractId="SYS.AbsGovernanceDecision.proposal.v4",sourceStreamKey="configuration-leave-governance",
              payload={"governanceRequestPublicId":UID,"subjectPublicId":UID,"subjectRowVersion":0,"subjectContentSha256":ZERO,"decision":"PENDING"})
        governance["header"]["contentSha256"]=m.digest(governance["payload"])
        local["owner"]={"governance":governance}
        rows["abs_policy_governance_bindings"]=m.project_abs_import("abs_policy_governance_bindings",local,self.defs)
        rows["abs_time_schedule_segment_snapshots"]=m.project_schedule(self.fixtures["scheduleOwner"],0,self.fixtures["scheduleLocal"],self.defs)
        schemas=m.sql_bind_schemas(self.plan)
        cases=[{"id":"row_"+name,"schema":"V4.SqlBind."+name,"value":row,"valid":True} for name,row in rows.items()]
        result=m.schema_engine(self.defs,schemas,cases)
        self.assertEqual(result["cases"],5)
        self.assertEqual(sum(len(row) for row in rows.values()),82)
        for name,row in rows.items():
            changed=copy.deepcopy(row);changed["tenant_id"]="7"
            result=m.schema_engine(self.defs,{"ROW":schemas["V4.SqlBind."+name]},[{"id":"wrong_sql_type","schema":"ROW","value":changed,"valid":False}])
            self.assertEqual(result["errors"],[])

    def test_actual_OUTCOME_kind_not_phantom_status_branches_and_SQLguard(self):
        delta=json.loads((m.HERE/"tim-base-review-remediation.proposal.v1.json").read_text())
        for c in delta["schemaProbeCases"]:
            if not c["caseId"].endswith(("POSTED_HAPPY","ERROR_NO_FAKE_NUMBERS","CANCELLED_TERMINAL")):continue
            outcome=c["payload"];index=0 if "CONFIG_A" in c["caseId"] else 1
            selected=self.fixtures["inputsAB"][index]["selectedItems"][0]
            run={"inputSha256":outcome["inputSha256"],"leaseVersion":1,"cancelFence":2,"mode":"POST"}
            row=m.project_outcome(outcome,selected,run,self.defs)
            self.assertEqual(row["status"],outcome["kind"])
            for g in self.plan["guardDispositions"]:
                if g["table"]=="abs_entitlement_run_items" and g["kind"]=="SQL_CHECK_AST":self.assertTrue(m.eval_guard(g["ast"],row))
            if outcome["kind"] in {"BLOCKED","FAILED","CANCELLED"}:self.assertIsNone(row["denominator"])
            wrong=copy.deepcopy(run);wrong["leaseVersion"]=2;wrong["cancelFence"]=3
            with self.assertRaises(ValueError):m.project_outcome(outcome,selected,wrong,self.defs)

    def test_API_request_no_full_payload_and_required_policy_refetch(self):
        f=self.fixtures["inputsAB"][0]
        request={"periodStart":f["periodStart"],"periodEnd":f["periodEnd"],"asOf":f["asOf"],"mode":f["mode"]}
        calls=[]
        def adapter():
            calls.append(1);return {"policyRef":f["policyRef"],"policyContent":f["policyContent"]}
        value=m.prepare_input(request,f,adapter,self.defs)
        self.assertEqual(calls,[1]);self.assertEqual(value["policyContent"],f["policyContent"])
        with self.assertRaisesRegex(ValueError,"POLICY_REFETCH_MISSING"):m.prepare_input(request,f,None,self.defs)
        request["policyContent"]=f["policyContent"]
        with self.assertRaisesRegex(ValueError,"SCHEMA_ENGINE"):m.prepare_input(request,f,adapter,self.defs)

    def test_actual_closed_schema_STOP_ONLY_negative(self):
        x=copy.deepcopy(self.fixtures["instructionsAB"][0]);x["treatment"]="STOP_ONLY";x["policyContent"]["terminationTreatment"]="STOP_ONLY"
        r=m.schema_engine(self.defs,{"INSTRUCTION":m.ref("V4.TerminationInstruction")},[{"id":"wrong_stop_literal","schema":"INSTRUCTION","value":x,"valid":False}])
        self.assertEqual(r["errors"],[])

    def test_ABS_nested_time_repository_source_fatal(self):
        self.mutated_plan(lambda p:p["scopedOperationContracts"][1].update(extraSource={"source":"loaded.tme_time_cards.time_card_id"}),"ABS_NESTED_TIME")

    def test_neutral_infra_cannot_hide_TIME_business_repository(self):
        self.mutated_plan(lambda p:p["neutralInfrastructurePlan"]["tables"].append("tme_time_cards"),"NEUTRAL_INFRASTRUCTURE")

    def test_column_and_source_nullable_together_cannot_hide(self):
        def edit(p):
            t=next(t for t in p["structuralTables"] if t["tableName"]=="abs_entitlement_input_versions")
            next(c for c in t["columns"] if c["name"]=="public_id")["nullable"]=True
            p["sourceGraphs"][t["tableName"]]["public_id"]["nullable"]=True
        self.mutated_plan(edit,"FROZEN_PHYSICAL_NULLABILITY")


if __name__=="__main__":
    unittest.main(verbosity=2)
