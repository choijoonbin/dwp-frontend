#!/usr/bin/env python3
"""Independently validate the executable Control contract-publication plan."""

from __future__ import annotations

import argparse
import copy
import csv
import json
from pathlib import Path


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CONTRACT = G0 / "contract-publication-bootstrap-contract.v1.json"
OWNERS = ROOT / "coding-readiness/g3-contract-primary-ownership-register.csv"
PUBLIC = ROOT / "coding-readiness/api-pep-binding-register.csv"
XCON = ROOT / "coding-readiness/cross-module-schema-binding-register.csv"
ALLOCATIONS = ROOT / "coding-readiness/g3-file-allocation-register.csv"
CATALOG = G0 / "g3-verification-command-catalog.v1.json"


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def errors_for(
    contract: dict[str, object],
    owner_rows: list[dict[str, str]],
    public_rows: list[dict[str, str]],
    xcon_rows: list[dict[str, str]],
    allocation_rows: list[dict[str, str]],
    catalog: dict[str, object],
) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    expected_fields = {
        "schema", "publicHttpOperationCount", "asyncPrimaryEventCount",
        "xconEventAliasCount", "xconSnapshotAliasCount", "eventAliasRule",
        "snapshotPublicationRule", "verifierAllocationId", "contractAllocationId",
        "verifierSourcePath", "verifierTestPath", "sourceIdentityRule",
        "requiredControlCommandKeys", "bootstrapOrder", "implementationState",
        "productionState",
    }
    require(
        set(contract) == expected_fields
        and contract.get("schema")
        == "dwp.hris.g3.contract-publication-bootstrap-contract.v1",
        "bootstrap contract schema drift",
    )
    public_ids = {row.get("binding_id", "") for row in public_rows}
    owner_public = {
        row.get("contract_id", "")
        for row in owner_rows
        if row.get("contract_kind") == "PUBLIC_PEP"
    }
    base_events = {
        row.get("source_semantic_ref", "")
        for row in owner_rows
        if row.get("contract_kind") == "BASE_EVENT"
    }
    modern_events = {
        row.get("contract_id", "")
        for row in owner_rows
        if row.get("contract_kind") == "MODERN_EVENT"
    }
    event_aliases = {
        row.get("contract_id", "")
        for row in xcon_rows
        if row.get("contract_kind") == "EVENT"
    }
    snapshot_aliases = {
        row.get("contract_id", "")
        for row in xcon_rows
        if row.get("contract_kind") == "SNAPSHOT"
    }
    require(len(public_rows) == len(public_ids) == 175, "public PEP source count/uniqueness drift")
    require(owner_public == public_ids, "public PEP source-to-primary closure drift")
    require(len(base_events) == 48, "base event source count drift")
    require(len(modern_events) == 86, "modern event source count drift")
    require(
        "EVT-PER:CompensationPlanApproved.v1" not in base_events,
        "superseded compensation predecessor remains an active base event",
    )
    require(not (base_events & modern_events), "base/modern primary event IDs overlap")
    require(len(event_aliases) == 13, "XCON event alias count drift")
    require(len(snapshot_aliases) == 8, "XCON snapshot alias count drift")
    require(contract.get("publicHttpOperationCount") == len(public_ids), "contract public operation count drift")
    require(
        contract.get("asyncPrimaryEventCount") == len(base_events | modern_events),
        "contract async primary event count drift",
    )
    require(contract.get("xconEventAliasCount") == len(event_aliases), "contract event alias count drift")
    require(contract.get("xconSnapshotAliasCount") == len(snapshot_aliases), "contract snapshot alias count drift")
    by_allocation = {row.get("allocation_id", ""): row for row in allocation_rows}
    verifier = by_allocation.get(str(contract.get("verifierAllocationId", "")), {})
    publication = by_allocation.get(str(contract.get("contractAllocationId", "")), {})
    require(
        verifier.get("path_globs")
        == f"{contract.get('verifierSourcePath')}|{contract.get('verifierTestPath')}",
        "contract verifier allocation/path drift",
    )
    require(
        publication.get("verification_globs")
        == "python3 scripts/verify-hris-contract-publication.py --check",
        "central contract allocation is not bound to source verifier",
    )
    control_profile = next(
        (
            item for item in catalog.get("profiles", [])
            if isinstance(item, dict)
            and item.get("ownerSessionId") == "CONTROL"
            and item.get("repository") == "DWP_BACKEND"
        ),
        {},
    )
    contract_allocation_ids = {
        str(contract.get("verifierAllocationId", "")),
        str(contract.get("contractAllocationId", "")),
        "G3-CTL-BE-GATEWAY",
        "G3-CTL-BE-RUNTIME",
    }
    command_keys = {
        item.get("commandKey", "")
        for item in control_profile.get("commands", [])
        if isinstance(item, dict)
        and (
            set(item.get("appliesToFileAllocationIds", [])) == {"*"}
            or bool(
                set(item.get("appliesToFileAllocationIds", []))
                & contract_allocation_ids
            )
        )
    }
    require(
        command_keys == set(contract.get("requiredControlCommandKeys", [])),
        "Control backend command set differs from bootstrap contract",
    )
    require(
        all(
            "contractTest" not in " ".join(item.get("argvTemplate", []))
            for item in control_profile.get("commands", [])
            if isinstance(item, dict)
        ),
        "nonexistent Gradle contractTest task remains executable authority",
    )
    require(
        contract.get("bootstrapOrder")
        == "VERIFIER_CHECKPOINT_BEFORE_ANY_CENTRAL_CONTRACT_TOUCH"
        and contract.get("implementationState") == "FIRST_CONTROL_DELIVERABLE_REQUIRED"
        and contract.get("productionState") == "NOT_AUTHORIZED_G6",
        "bootstrap order/state drift",
    )
    return errors


def validate() -> list[str]:
    return errors_for(
        json.loads(CONTRACT.read_text(encoding="utf-8")),
        rows(OWNERS), rows(PUBLIC), rows(XCON), rows(ALLOCATIONS),
        json.loads(CATALOG.read_text(encoding="utf-8")),
    )


def self_test() -> dict[str, object]:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    inputs = (rows(OWNERS), rows(PUBLIC), rows(XCON), rows(ALLOCATIONS), json.loads(CATALOG.read_text(encoding="utf-8")))
    cases: dict[str, bool] = {}
    mutated = copy.deepcopy(contract)
    mutated["asyncPrimaryEventCount"] = 121
    cases["http-202-count-cannot-masquerade-as-event-count"] = bool(errors_for(mutated, *inputs))
    mutated = copy.deepcopy(contract)
    mutated["xconSnapshotAliasCount"] = 0
    cases["snapshot-alias-publication-confusion-rejected"] = bool(errors_for(mutated, *inputs))
    allocation_mutation = copy.deepcopy(inputs[3])
    allocation_mutation[:] = [row for row in allocation_mutation if row.get("allocation_id") != "G3-CTL-BE-CONTRACT-VERIFIER"]
    cases["missing-verifier-allocation-rejected"] = bool(errors_for(contract, inputs[0], inputs[1], inputs[2], allocation_mutation, inputs[4]))
    catalog_mutation = copy.deepcopy(inputs[4])
    control = next(item for item in catalog_mutation["profiles"] if item["ownerSessionId"] == "CONTROL" and item["repository"] == "DWP_BACKEND")
    control["commands"] = [item for item in control["commands"] if item["commandKey"] != "contract-publication-source-bound"]
    cases["source-bound-publication-command-omission-rejected"] = bool(errors_for(contract, inputs[0], inputs[1], inputs[2], inputs[3], catalog_mutation))
    return {
        "schema": "dwp.hris.g3.contract-publication-bootstrap-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    errors = validate()
    if errors:
        print(json.dumps({"status": "FAIL", "errors": errors}, ensure_ascii=False, sort_keys=True))
        return 1
    print("G3_CONTRACT_PUBLICATION_BOOTSTRAP=PASS public=175 events=134 xconEventAliases=13 xconSnapshotsExcluded=8 state=FIRST_CONTROL_DELIVERABLE_REQUIRED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
