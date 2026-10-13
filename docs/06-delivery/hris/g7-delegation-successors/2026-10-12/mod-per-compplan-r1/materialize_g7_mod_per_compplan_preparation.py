#!/usr/bin/env python3
"""Deterministically materialize the MOD-PER-COMPPLAN R1 preparation bundle.

Preparation is deliberately non-executable authority.  This program writes five
sealed control artifacts and never emits a start token, worktree registration,
migration admission, activation, integration, promotion, or release authority.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any


HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[5]
BACKEND = FRONTEND.parent / "backend"
ROOT_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "mod-per-compplan-r1"
)
PREPARED_AT = "2026-10-12T23:41:00+09:00"
MODULE_ID = "MOD-PER-COMPPLAN"
STATE = "PACKET_PREPARED_START_WITHHELD"

FRONTEND_BRANCH = "codex/hris-g1-integration-frontend-20261006"
FRONTEND_UPSTREAM = "origin/codex/hris-g1-integration-frontend-20261006"
FRONTEND_COMMIT = "259fae159d35586da2fa79a1fd2947a2e0fb39fd"
FRONTEND_TREE = "7c43a34966557eeb0e2af4982c507f690aabb136"
BACKEND_BRANCH = "codex/hris-g1-integration-backend-20261006"
BACKEND_UPSTREAM = "origin/codex/hris-g1-integration-backend-20261006"
BACKEND_COMMIT = "deb39a02634826d40ae5de5e30f54223c31b5851"
BACKEND_TREE = "79d31fe261be481a3427c2a12a456a785b7eafaa"
AGENT_COMMIT = "1d46fc4ab49c604efb7464574c49d13ee453e059"
AGENT_TREE = "0b9a8dbfd828478ee825452e5aca8688c83e37ab"

CLOSURE_PATH = (
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
    "integrated-closure.v3.json"
)
CLOSURE_SHA256 = "0a6cbc3a4e0ac756e632333e1c9b6b9131139b7f914725f8716933439f79d3e1"
CLOSURE_RECEIPT_ID = "HRIS-G7-SYS-HRM-INTEGRATED-CLOSURE-SYS-HRM-R3-20261012-R3"
CLOSURE_SEAL = "c7ba2854238119b59f28fa14f184ba69b4cfce6a55e3aef9ff26afe5a653d69b"

RECOVERY = "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness"
G3 = "docs/06-delivery/hris/g3-successors/2026-10-07"
SOURCE_PINS = {
    "g3Manifest": (f"{G3}/manifest.v1.json", "af5238d3610e96aeb12ce6376d37175d77ef65372be135369b9a5faeabe2de8e"),
    "g3ExactSchemas": (f"{G3}/modern-capability-exact-schema-contracts.v1.json", "e29ffb7e7770c2733c900bb943402b30a860683d81325be6ffce933982ba81db"),
    "g3EventPayloads": (f"{G3}/modern-capability-event-payload-contracts.v1.json", "c573363a700bfa2f601ceeaad14003f44d83abf23d51c88efb0fcc6f03c9d45b"),
    "g3SemanticBindings": (f"{G3}/modern-capability-semantic-bindings.v1.json", "8a5ded16230ee20f1227dbedc745e27a5d432e1f067a7a17189e3ead92bf64b7"),
    "g3PublicIdentities": (f"{G3}/modern-capability-public-identity-registry.v1.json", "f4da062d5469fba50a4994e17f964534737e6e4f603755f60e79b5ca57fa7f1c"),
    "g3Ownership": (f"{G3}/g3-contract-primary-ownership-register.csv", "2ef33aaf3534859b92a5d68267ddadf3aab1fe94c8dab4fe321992740b3c3629"),
    "canonicalSchemas": (f"{RECOVERY}/cross-module-canonical-schemas.v1.json", "f6fb63f52e2b6043b62f8afdd87b7acdbd89fe9db3330d8a2818be9e5c8326c4"),
    "crossModuleRegister": (f"{RECOVERY}/cross-module-contract-register.csv", "783bd3f6c6fdcf5d35da73020b2cc01f0c59cfd6e9fe9d56ffa75a3cd380f725"),
    "schemaBindings": (f"{RECOVERY}/cross-module-schema-binding-register.csv", "b78fbae31c9cd48c4eadc37ea689d4f6987642ee8562700205f3c14bad0c6334"),
    "serviceBindings": (f"{RECOVERY}/service-api-auth-binding-register.csv", "a54272429e70d0e2494e082b214615a4befe2354d5ab72bf7619500e2b0fdcaa"),
    "dependencies": (f"{RECOVERY}/module-dependency-register.csv", "b8f1a11d1a32cf6f5a9a99ff73066b7e65787319ac18cf0d2b4891d22587c348"),
    "authorization": (f"{RECOVERY}/modern-capability-authorization-register.csv", "c6e44f59f1ac258ddcb9e54a89fdbd5c5495aa8bb2f68f2029056ee6a9f15cac"),
    "perRemediation": (f"{RECOVERY}/semantic-remediation/per-modern-remediation.v1.json", "c84b1206a2ba2af4d2f3cf583c48b30a2d679d8755b89b4f25145b7cb92b3785"),
    "perApiSource": ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g2-readiness/api-event-contracts.yaml", "559c345053d205902613f502be18dcbc22577e9286686827ad6383a5d2211f5a"),
    "g7SuccessorOverlay": ("docs/06-delivery/hris/g7-delegation/2026-10-12/successor-slice-overlay.v1.csv", "dc0249b33af6194ff832d8f4e8348b519a489130cde8b0a01b364ebf8ea2f147"),
    "payConsumerContract": ("docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json", "d14360270f071c35a98cc144798a1d87d9b260fe127e7765c80d54474c7df30c"),
    "historicalCodingRegister": (f"{RECOVERY}/modern-capability-coding-contract-register.csv", "5bce5bbc5946695c79f121964c80c76f8bec306fdf39d5fa974f511f7362c95c"),
    "g7ControlRequests": ("docs/06-delivery/hris/g7-delegation/2026-10-12/control-requests.v1.json", "1e96cacc713837cfd81313b13f26d0c25205138f215b24ba22f667653d8ae858"),
    "per006PredecessorPacket": ("docs/06-delivery/hris/g7-delegation/2026-10-12/packets/per-006.v1.json", "0b1f08f90ee1e7b1fffc69448a1341a4ccc1143ec06e0ad058ba71c3090777c8"),
    "compplanMenuNode": (f"{RECOVERY}/modern-menu-node-register.csv", "75b58edcac568667e914f9649fe89e39cee1d677e728c85ee1b4122d45daf5d9"),
    "compplanIaAccess": (f"{RECOVERY}/ia-node-access-contract-register.csv", "3fc33ce63642c337c9cf8dc6cfbd3b9287d9b1202c5b709e137744c7b28494bf"),
    "compplanWorkbench": (f"{RECOVERY}/hris-workbench-task-group-register.csv", "f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b"),
}
BACKEND_SOURCE_PINS = {
    "performanceV1Migration": ("dwp-people-server/src/main/resources/db/performance-migration/V1__per_create_evaluation_cycle_foundation.sql", "2d2eea050731bbc580d7002adec8aacc64020ea2f8edd319955ac96d35630aba"),
    "runtimeCanonicalSchemas": ("contracts/hris/canonical/schemas/cross-module-canonical-schemas.v1.json", "8109568c1cfafa5021b5e831ac17c5dbbfeaaf2b3a7472fc4ff488eacb0bc866"),
    "xcon020Java": ("dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/Xcon020ApprovedCompensationPlanSnapshotV1.java", "ac0806b33b674d6abf93d12d33749bafc969cbe6a1f7e8a5c8dd4fd10542a1f4"),
    "xcon021Java": ("dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/Xcon021ApprovedCompensationPlanSnapshotPublishedV2.java", "24db6f02e0be9ea6f24b8d39e87d99cb22b948a076743b33aefd0a2bd228dfe1"),
    "xcon021PlatformTest": ("dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Xcon021CompensationSnapshotPublicationV2Test.java", "292fa7b5e302981abfef501a909b95cf1c777f0cb8673839653dee67ad7393d7"),
    "workforceSnapshotSchema": ("contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json", "848d526cf6789350bbc6a85648b265be3de85c545c50643516c28bd9c659d178"),
    "workforceSnapshotGuardedPort": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/GuardedWorkforceSnapshotQueryPort.java", "22b5cfe571a7cab7cd56a4435cc4b57b4f3aaca1fae298ec110a107e8e885d4d"),
    "workforceSnapshotVerifiedCursor": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/VerifiedWorkforceSnapshotCursor.java", "e805eb6c9cdf11864118782af5423c9e55a42548dc26466ef8aa7016fbd23a3e"),
    "workforceSnapshotVerifiedRequest": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/VerifiedWorkforceSnapshotRequest.java", "1885f914e860ccf26575ffac4147d62d93cbe66e5344973e68b7c66cc6e0a675"),
    "workforceSnapshotContract": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotContract.java", "5656fd330831822759148eeec93e1aacf7bf7c7be1ffde2e6e835ace2167521a"),
    "workforceSnapshotPage": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotPage.java", "a2d20e725e789025b2ee6b945cdba2913fcbb527d478e81927f6ca3f11916f7c"),
    "workforceSnapshotProjection": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotProjection.java", "3f0a2ea1f8cfd4ee1d3ea63c7c0083f1fc59a6539893870af46853bf956b20a5"),
    "workforceSnapshotProviderInterface": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotProvider.java", "5372ba69a979b494f9f1c2c0e6a94dc921715444beb957dbead0cd967eed8f5e"),
    "workforceSnapshotQuery": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotQuery.java", "eeb37c8b186a6a1cf44ea4f88ccf5c1297fb78f0b0102ec89006df737eaae970"),
    "workforceSnapshotQueryPort": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotQueryPort.java", "6c5600a7259676d15332dfb9d69c6efa1f24f1f51d5e2511e011c181976da788"),
    "workforceSnapshotQueryPorts": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotQueryPorts.java", "00b5dda2b2a42a189527f0a9300d9c883b6fd105469cda0259f1737af21321a6"),
    "workforceSnapshotRequestVerifier": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotRequestVerifier.java", "d0164528206d9286441d14578914304b51d0dfbcfaf0ef50105eb0979ba82f67"),
    "workforceSnapshotV1": ("dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotV1.java", "70a82081c4490eaf14c87c283069efba0a4fd0edbd0d389ebb808b3d7ddaae16"),
    "workforceSnapshotContractTest": ("dwp-people-server/src/test/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotContractTest.java", "7f8f4dd662f73cf89c9c9f1cc3e77609b49a3eed1c15ad4e9d4968ba3c81afa4"),
    "workforceSnapshotPaginationTest": ("dwp-people-server/src/test/java/com/dwp/services/people/hris/contracts/workforce/v1/WorkforceSnapshotPaginationContractTest.java", "2b073dce5c4f243be56b9863fa720eca05da952f57ceefaa91f035ff6053f9e9"),
}
SOURCE_SELECTOR_SHA256 = {
    "g3ExactSchemas": [
        ("#/operationBindings[primarySliceId=MOD-PER-COMPPLAN]", "1436f07a399842bb60e41a27c010aced6c3bfd69b14e82c0f890ecedbfc783ef")
    ],
    "g3EventPayloads": [
        ("#/eventPayloadSchemas[primarySliceId=MOD-PER-COMPPLAN]", "989147d9cfa716b3b395b961956c950fca77c5940e0aa1bfe0072e9b01cd6b7b")
    ],
    "g3SemanticBindings": [
        ("#/operationSemanticBindings[primarySliceId=MOD-PER-COMPPLAN]", "0abea41e9b47c79e428cd77f77f745851c2e7b352fd88d8a8cdefbb617a4a163"),
        ("#/eventSemanticBindings[primarySliceId=MOD-PER-COMPPLAN]", "205a1703335271f042c7eae8a5ad578fbfe183e01c64db363190281dd596daba"),
    ],
    "g3PublicIdentities": [
        ("#/operationPublicIdentities[primarySliceId=MOD-PER-COMPPLAN]", "4edd11bbdc31faf7f6aa5a9536fed98ee80e4baed09c9be22e1b8dc04eab90e4"),
        ("#/eventPublicIdentities[primarySliceId=MOD-PER-COMPPLAN]", "0d0bada24bdfdf651ee1f2ebf0c70eb83646afe28a57dc325f9c89f89a5360cc"),
    ],
    "canonicalSchemas": [
        ("#/$defs/XCON_020", "0ef1cf5761e666d1b47c5dae6c7b95a37228af7fc7aeaf79ccaf1482891f4ad8"),
        ("#/$defs/XCON_021", "ba6b361e3dd65a13b566b6b8cb6f009dac3fd68068db1129d5a67b4cd6731c8a"),
    ],
    "serviceBindings": [
        ("csv:binding_id=SVC-PEP-PER-001", "896fccbd60db109c91993481acfba3ea63cc5f039d91dc9e4ab36576ce4997c5")
    ],
    "perRemediation": [
        ("#/capabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]/tableSpecifications", "db0dcedb135ef9add3c289c49cab0649a3b339a8036e87c92e352669d016b2e3"),
        ("#/artifactStore", "040df85ac1ff8ec4e5e4cffb6d81704b2b86ccbe3f9802ac183931058da101a0"),
        ("#/schemas[schemaId=CompensationGuidelinesContent.v1]", "54aa8bca1fec0a6ae76c312608b4f4eb3f852f9c764334898bf210aaccd0cdcc"),
        ("#/schemas[schemaId=CompensationPopulationContent.v1]", "d1920189b6d04eacd47139f385bfea70c1b3c133c5a876ad74472bdb337ce2aa"),
        ("#/schemas[schemaId=CompensationPopulationLine.v1]", "7dbd79fd072a71ec23cdb5157f667f6663765b9ba7458c3b857986c4e41aa7bd"),
        ("#/schemas[schemaId=HRMSourceSnapshotRef.v1]", "d4f7bbef3441df2b56d0d8ff9db9733688c570d98204a1eb3c4dc7448ff9d2aa"),
        ("#/schemas[schemaId=CompensationProposalContent.v1]", "7278c7fb2415a4ad9e0dc93fb8134de73f94e98dfab5d001d62a2430ccc328ba"),
        ("#/capabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]/operations[operationId=per.remediation.createCompensationCycle]/requestSchema/body", "a6e0b5a9e9460c443e1802a6da205c258f3b2e4295a46b4c38e0884f49eb3779")
    ],
    "g7SuccessorOverlay": [
        ("csv:slice_id=MOD-PER-COMPPLAN", "3219a766ff3897bb907a3b2e65b9389ad081b1b8ae86f6067aaa9f4858539a75")
    ],
    "payConsumerContract": [
        ("#/consumedModernCapabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]", "c7de7ec9d81c2bf251728e4c380c7be94f6d66a9a8f9851c8e8c6332ee1ee4a8")
    ],
    "per006PredecessorPacket": [
        ("#/dependencies", "c985183adb748fca02559695cf293fd4da96602099523da3d871d115612ecfb9")
    ],
    "compplanMenuNode": [
        ("csv:menu_node_key=hcm.operations.compensation-planning", "e0fae6263933ddbaef852bf60fae7334c9948db18ef3ffaa18c6fc14f0493680")
    ],
    "compplanIaAccess": [
        ("csv:ia_node_id=MODERN:hcm.operations.compensation-planning", "441700b9c4c9e4bf6f666aedad87c898ea8bc530b4d41986640c00ca383fb4e0")
    ],
    "compplanWorkbench": [
        ("csv:task_group_id=PERF-07", "241fd002c33ca56abc4d42f8f0cde8c9b5ad7355f00f7144740e841db29c55c6")
    ],
    "workforceSnapshotSchema": [
        ("#/x-port", "c14e230ac872b5fff9dae33cd2f90e895088dd3d495df7c24d8d9af000d64952"),
        ("#/$defs/WorkforceSnapshotQuery", "214c45298cd5984c42b84c747d03090bee0761ec22eb7d49a325a969240c80e3"),
        ("#/$defs/WorkforceSnapshotPage", "b058ca270429a3435e6ab7abdf5bae69c4241a5972a5dfdb97b8832d6cc6357d"),
    ],
}

TABLES = [
    "prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_proposals",
    "prf_cmp_proposal_revisions", "prf_cmp_approved_snapshots",
    "prf_cmp_approved_snapshot_lines",
]
FORBIDDEN_TABLES = [
    "prf_cmp_plans", "prf_cmp_proposal_versions", "prf_cmp_plan_proposal_refs"
]
COMMON_COLUMNS = [
    "tenant_id", "public_id", "aggregate_version", "created_at", "created_by",
    "updated_at", "correlation_id",
]
TABLE_COLUMNS = {
    "prf_cmp_cycles": ["prf_cmp_cycles_internal_id", *COMMON_COLUMNS, "cycle_code", "guideline_artifact_public_id", "population_artifact_public_id", "effective_from", "effective_to", "status"],
    "prf_cmp_budget_ledger": ["prf_cmp_budget_ledger_internal_id", *COMMON_COLUMNS, "compensation_cycle_id", "org_public_id", "currency_code", "amount", "entry_sequence", "entry_type", "source_entry_public_id"],
    "prf_cmp_proposals": ["prf_cmp_proposals_internal_id", *COMMON_COLUMNS, "compensation_cycle_id", "worker_public_id", "assignment_public_id", "component_code", "currency_code", "amount", "effective_from", "effective_to", "current_revision", "status", "supersedes_proposal_public_id"],
    "prf_cmp_proposal_revisions": ["prf_cmp_proposal_revisions_internal_id", *COMMON_COLUMNS, "compensation_proposal_id", "revision_no", "typed_content_artifact_public_id", "content_digest", "exception_approval_receipt_public_id"],
    "prf_cmp_approved_snapshots": ["prf_cmp_approved_snapshots_internal_id", *COMMON_COLUMNS, "compensation_cycle_id", "approval_receipt_public_id", "snapshot_revision", "source_version", "effective_from", "effective_to", "line_count", "payload_digest"],
    "prf_cmp_approved_snapshot_lines": ["prf_cmp_approved_snapshot_lines_internal_id", *COMMON_COLUMNS, "approved_compensation_snapshot_id", "line_sequence", "worker_public_id", "assignment_public_id", "component_code", "currency_code", "approved_amount", "effective_from", "effective_to", "line_digest"],
}

OPERATION_ROWS = [
    ("modern.compplan.budget.allocate", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/budget-allocations", "hcm.compensation.plan.propose", ["prf_cmp_cycles", "prf_cmp_budget_ledger"], ["prf_cmp_budget_ledger", "prf_cmp_cycles"]),
    ("modern.compplan.cycle.cancel", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/cancel", "hcm.compensation.plan.propose", ["prf_cmp_cycles", "prf_cmp_proposals"], ["prf_cmp_cycles", "prf_cmp_proposals"]),
    ("modern.compplan.cycle.create", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles", "hcm.compensation.plan.propose", [], ["prf_cmp_cycles"]),
    ("modern.compplan.cycle.query", "GET", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}", "hcm.compensation.plan.view", TABLES, []),
    ("modern.compplan.cycle.revise", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/revisions", "hcm.compensation.plan.propose", ["prf_cmp_cycles"], ["prf_cmp_cycles"]),
    ("modern.compplan.cycles.query", "GET", "/api/people/v1/hris/performance/compensation-planning/cycles", "hcm.compensation.plan.view", ["prf_cmp_cycles", "prf_cmp_budget_ledger"], []),
    ("modern.compplan.plan.approve", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/approve", "hcm.compensation.plan.approve", ["prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_proposals", "prf_cmp_proposal_revisions"], ["prf_cmp_cycles", "prf_cmp_proposals"]),
    ("modern.compplan.proposal.query", "GET", "/api/people/v1/hris/performance/compensation-planning/proposals/{proposalId}", "hcm.compensation.plan.view", ["prf_cmp_proposals", "prf_cmp_proposal_revisions"], []),
    ("modern.compplan.proposal.submit", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/proposals/{proposalId}/submit", "hcm.compensation.plan.propose", ["prf_cmp_proposals", "prf_cmp_proposal_revisions", "prf_cmp_cycles", "prf_cmp_budget_ledger"], ["prf_cmp_proposals", "prf_cmp_cycles"]),
    ("modern.compplan.proposal.upsert", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/proposals/{proposalId}", "hcm.compensation.plan.propose", ["prf_cmp_proposals", "prf_cmp_cycles", "prf_cmp_budget_ledger"], ["prf_cmp_proposals", "prf_cmp_proposal_revisions"]),
    ("modern.compplan.proposals.query", "GET", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/proposals", "hcm.compensation.plan.view", ["prf_cmp_proposals", "prf_cmp_proposal_revisions"], []),
    ("modern.compplan.snapshot.publish", "POST", "/api/people/v1/hris/performance/compensation-planning/cycles/{cycleId}/approved-snapshots", "hcm.compensation.plan.approve", ["prf_cmp_cycles", "prf_cmp_budget_ledger", "prf_cmp_proposals", "prf_cmp_proposal_revisions"], ["prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines", "prf_cmp_cycles"]),
]
def operation_contract(row: tuple[Any, ...]) -> dict[str, Any]:
    operation_id, method, path, capability, reads, writes = row
    if capability.endswith(".view"):
        mode, action, binding, idempotency, expected = (
            "QUERY", "VIEW", "MOD-AUTH-025", "READ_SAFE", "NOT_APPLICABLE"
        )
    elif capability.endswith(".approve"):
        mode, action, binding, idempotency, expected = (
            "COMMAND", "APPROVE", "MOD-AUTH-027", "REQUIRED", "REQUIRED"
        )
    else:
        mode, action, binding, idempotency = (
            "COMMAND", "UPDATE", "MOD-AUTH-026", "REQUIRED"
        )
        expected = "NOT_APPLICABLE" if operation_id.endswith("cycle.create") else "REQUIRED"
    typed_reads = {
        "modern.compplan.cycle.query": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"],
        "modern.compplan.proposal.query": ["CompensationProposalContent.v1"],
        "modern.compplan.proposal.upsert": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"],
        "modern.compplan.proposal.submit": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1", "CompensationProposalContent.v1"],
        "modern.compplan.plan.approve": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1", "CompensationProposalContent.v1"],
    }.get(operation_id, [])
    typed_writes = {
        "modern.compplan.cycle.create": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"],
        "modern.compplan.cycle.revise": ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"],
        "modern.compplan.proposal.upsert": ["CompensationProposalContent.v1"],
    }.get(operation_id, [])
    return {
        "operationId": operation_id, "method": method, "path": path,
        "mode": mode, "authorizationAction": action,
        "authorizationBindingId": binding,
        "authorizationCapability": capability,
        "idempotencyKey": idempotency, "expectedVersion": expected,
        "readTables": reads, "writeTables": writes,
        "sharedFoundationEffect": {
            "readTables": ["prf_per_artifact_versions"] if typed_reads else [],
            "writeTables": ["prf_per_artifact_versions"] if typed_writes else [],
            "typedSchemasRead": typed_reads,
            "typedSchemasAppended": typed_writes,
            "ownerPort": "PerTypedArtifactQueryPort.v1" if typed_reads else "NONE",
            "readCondition": (
                "AUTHORIZED_DETAIL_PROJECTION_REQUESTED_AND_OWNER_PEP_ALLOWS_FIELDS"
                if operation_id in {"modern.compplan.cycle.query", "modern.compplan.proposal.query"}
                else "COMMAND_GUARD_EVALUATION"
                if typed_reads else "NONE"
            ),
            "transactionRule": (
                "ARTIFACT_APPEND_AND_DOMAIN_REFERENCE_WRITE_SAME_OWNER_TRANSACTION"
                if typed_writes else
                "AUTHORIZED_OWNER_PORT_STRICT_DECODE_ONLY_REFERENCED_CONTENT"
                if typed_reads else "NONE"
            ),
        },
    }


OPERATIONS = [operation_contract(row) for row in OPERATION_ROWS]

STANDARD_EVENT_FIELDS = [
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId",
]
PAY_EVENT_FIELDS = [
    "aggregateId", "aggregateVersion", "approvalReceiptId", "approvalRevision",
    "correlationId", "cycleId", "effectiveDate", "fromState", "lineCount",
    "occurredAt", "payloadDigest", "planId", "snapshotId", "snapshotRevision",
    "sourceVersion", "toState",
]
EVENT_ROWS = [
    ("ApprovedCompensationPlanSnapshotPublished.v2", "modern.compplan.snapshot.publish", "dwp.hris.modern.approved-compensation-plan-snapshot-published.v2", PAY_EVENT_FIELDS, ["HRIS-PAY"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationBudgetAllocated.v2", "modern.compplan.budget.allocate", "dwp.hris.modern.compensation-budget-allocated.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationCycleCancelled.v2", "modern.compplan.cycle.cancel", "dwp.hris.modern.compensation-cycle-cancelled.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationCycleCreated.v2", "modern.compplan.cycle.create", "dwp.hris.modern.compensation-cycle-created.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationCycleRevised.v2", "modern.compplan.cycle.revise", "dwp.hris.modern.compensation-cycle-revised.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationPlanApprovalRecorded.v2", "modern.compplan.plan.approve", "dwp.hris.modern.compensation-plan-approval-recorded.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_cycles", "prf_cmp_cycles.public_id"),
    ("CompensationProposalDrafted.v2", "modern.compplan.proposal.upsert", "dwp.hris.modern.compensation-proposal-drafted.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_proposals", "prf_cmp_proposals.public_id"),
    ("CompensationProposalSubmitted.v2", "modern.compplan.proposal.submit", "dwp.hris.modern.compensation-proposal-submitted.v2", STANDARD_EVENT_FIELDS, ["HRIS-PER"], "table:prf_cmp_proposals", "prf_cmp_proposals.public_id"),
]
EVENTS = [
    {"eventName": row[0], "producerOperationId": row[1], "topic": row[2],
     "requiredFields": row[3], "allowedConsumerSessions": row[4],
     "aggregateEntityType": row[5], "aggregateIdSource": row[6],
     "aggregateVersionSource": f"post-transition {row[5].removeprefix('table:')}.aggregate_version",
     "transitionFieldSources": {
         "fromState": "locked durable pre-state selecting one sealed stateTransitionContract branch",
         "toState": "locked durable post-state from the selected branch; sentinel values are forbidden on wire",
         "occurredAt": "same-transaction hris_performance.prf_outbox_events.created_at after domain DML and closed receipt",
         "correlationId": (
             "same-transaction prf_cmp_approved_snapshots.correlation_id copied from validated X-Correlation-ID and equal to the updated cycle correlation_id"
             if row[0] == "ApprovedCompensationPlanSnapshotPublished.v2" else
             f"post-transition {row[5].removeprefix('table:')}.correlation_id copied from validated X-Correlation-ID"
         ),
     },
     "refetchPolicy": (
         "SVC-PEP-PER-001_IMMUTABLE_XCON_020_SNAPSHOT_REFETCH"
         if row[0] == "ApprovedCompensationPlanSnapshotPublished.v2"
         else "PAYLOAD_COMPLETE_NO_REFETCH"
     ),
     "latestOrHistoricalAggregateFallbackAllowed": False,
     "payloadCompleteness": (
         "XCON_021_NOTIFICATION_PLUS_IMMUTABLE_XCON_020_REFETCH"
         if row[0] == "ApprovedCompensationPlanSnapshotPublished.v2"
         else "EXACT_SIX_FIELD_TRANSITION_FACT_IS_COMPLETE"
     ),
     "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_CLOSED_RECEIPT",
     "brokerPublish": "AFTER_COMMIT_ONLY"}
    for row in EVENT_ROWS
]

STATE_TRANSITION_CONTRACTS = [
    {
        "transitionId": "MOD-PER-COMPPLAN-TR-001",
        "operationId": "modern.compplan.cycle.create",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["NONE"], "toState": "DRAFT", "cascade": [],
        "guards": [
            "cycleCode is tenant-unique",
            "guidelines and population validate against the sealed typed schemas",
            "guidelines.budgetMode is exactly HARD_CAP; EXCEPTION_APPROVAL is R1_WITHHELD_NOT_IMPLEMENTED",
            "populationSourceRef refetches an owner-valid tenant-bound HRM snapshot",
            "guideline and population artifacts append in the same owner transaction",
        ],
        "provenance": "G3_TRANSITION_ID_PLUS_PER_REMEDIATION_NONE_TO_DRAFT_RESEAL",
    },
    {
        "transitionId": "MOD-PER-COMPPLAN-TR-002",
        "operationId": "modern.compplan.budget.allocate",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["DRAFT", "OPEN"], "toState": "OPEN",
        "branches": [
            {"fromState": "DRAFT", "toState": "OPEN", "condition": "first committed allocation"},
            {"fromState": "OPEN", "toState": "OPEN", "condition": "subsequent allocation or reversal"},
        ],
        "cascade": [],
        "guards": [
            "If-Match equals cycle aggregate_version",
            "ALLOCATE amount is positive and source_entry_public_id is NULL",
            "REVERSE amount is positive and reversesEntryPublicId names an unreversed positive ALLOCATE with NULL source in the same tenant and locked cycle; organization, currency and amount match exactly and the appended entry is its exact inverse",
            "a source ALLOCATE is reversed at most once; budget committed to frozen or approved proposals or a published snapshot cannot be reduced",
            "post-entry available budget for every organization and currency remains nonnegative; totals treat ALLOCATE as plus and REVERSE as minus",
        ],
        "provenance": "G3_TRANSITION_ID_PLUS_PER_REMEDIATION_BUDGET_UNCHANGED_RESEAL",
    },
    {
        "transitionId": "MOD-PER-COMPPLAN-TR-003",
        "operationId": "modern.compplan.proposal.submit",
        "aggregateEntityType": "table:prf_cmp_proposals",
        "fromStates": ["DRAFT"], "toState": "SUBMITTED",
        "branches": [{"fromState": "DRAFT", "toState": "SUBMITTED", "condition": "proposal submit guards pass"}],
        "cascade": [{
            "entityType": "table:prf_cmp_cycles", "fromStates": ["OPEN", "PROPOSAL_REVIEW"],
            "toState": "PROPOSAL_REVIEW",
            "branches": [
                {"fromState": "OPEN", "toState": "PROPOSAL_REVIEW", "condition": "first submitted proposal"},
                {"fromState": "PROPOSAL_REVIEW", "toState": "PROPOSAL_REVIEW", "condition": "subsequent submitted proposal"},
            ],
        }],
        "guards": [
            "If-Match equals proposal aggregate_version",
            "parent cycle is OPEN or PROPOSAL_REVIEW and proposal belongs to that exact cycle",
            "proposal content digest, eligibility, guideline, currency and budget guards pass",
            "no exception approval path exists in R1 and exception_approval_receipt_public_id remains NULL",
        ],
        "provenance": "G3_TRANSITION_ID_PLUS_PER_REMEDIATION_DRAFT_TO_SUBMITTED_RESEAL",
    },
    {
        "transitionId": "MOD-PER-COMPPLAN-TR-004",
        "operationId": "modern.compplan.plan.approve",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["PROPOSAL_REVIEW"], "toState": "APPROVED",
        "cascade": [{"entityType": "table:prf_cmp_proposals", "fromStates": ["SUBMITTED"], "toState": "FROZEN"}],
        "guards": [
            "If-Match equals cycle aggregate_version",
            "maker cannot approve own plan and required step-up is satisfied",
            "the successful existing prf_command_receipts.command_receipt_id becomes approvalReceiptId and applied_aggregate_version becomes approvalRevision",
            "every in-scope proposal is SUBMITTED",
            "the complete noncancelled in-scope frozen proposal set has cardinality 1..100000 and each proposal maps to exactly one valid snapshot line",
            "duplicate worker-assignment-component-effective identity, invalid interval, or non-deterministic line identity fails approval; approved proposal set and content become immutable",
            "budget, guideline, population, maker-checker and step-up guards pass",
        ],
        "provenance": "G3_TRANSITION_ID_PLUS_PER_REMEDIATION_APPROVAL_RESEAL",
    },
    {
        "transitionId": "MOD-PER-COMPPLAN-TR-005",
        "operationId": "modern.compplan.snapshot.publish",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["APPROVED"], "toState": "PUBLISHED", "cascade": [],
        "guards": [
            "If-Match equals the pre-publish approved cycle aggregate_version",
            "body.approvalReceiptId resolves a same-tenant SUCCEEDED modern.compplan.plan.approve prf_command_receipts row whose originating_action is hcm.compensation.plan.approve, aggregate_id and result_ref equal cycleId, applied_aggregate_version >= 1, and maker-checker/authorization evidence remains sealed",
            "immutable header and 1..100000 ordered lines commit atomically",
            "line count, sequence and canonical header-plus-lines digest validate before outbox append",
        ],
        "provenance": "G3_TRANSITION_ID_PLUS_CANONICAL_XCON_020_021_PUBLISH_RESEAL",
    },
    {
        "transitionId": "TR-MODERN-COMPPLAN-CYCLE-CANCEL-V3",
        "operationId": "modern.compplan.cycle.cancel",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["DRAFT", "OPEN", "PROPOSAL_REVIEW"], "toState": "CANCELLED",
        "cascade": [{"entityType": "table:prf_cmp_proposals", "fromStates": ["DRAFT", "SUBMITTED"], "toState": "CANCELLED"}],
        "guards": ["If-Match equals cycle aggregate_version", "APPROVED and PUBLISHED cycles cannot be cancelled"],
        "provenance": "G3_V3_ID_PLUS_PER_REMEDIATION_CANCEL_RESEAL",
    },
    {
        "transitionId": "TR-MODERN-COMPPLAN-CYCLE-REVISE-V3",
        "operationId": "modern.compplan.cycle.revise",
        "aggregateEntityType": "table:prf_cmp_cycles",
        "fromStates": ["DRAFT", "OPEN"], "toStates": ["DRAFT", "OPEN"],
        "branches": [
            {"fromState": "DRAFT", "toState": "DRAFT", "condition": "pre-open revision"},
            {"fromState": "OPEN", "toState": "OPEN", "condition": "opened-cycle typed-content revision before proposal review"},
        ],
        "cascade": [],
        "guards": [
            "If-Match equals cycle aggregate_version",
            "replacement guidelines and population validate and append as typed artifacts",
            "replacement guidelines.budgetMode is exactly HARD_CAP; EXCEPTION_APPROVAL fails closed",
            "effective interval contains typed guideline interval and population as-of is owner-valid",
        ],
        "provenance": "G3_V3_ID_PLUS_TYPED_CONTENT_RESEAL",
    },
    {
        "transitionId": "TR-MODERN-COMPPLAN-PROPOSAL-UPSERT-V3",
        "operationId": "modern.compplan.proposal.upsert",
        "aggregateEntityType": "table:prf_cmp_proposals",
        "fromStates": ["NONE", "DRAFT"], "toState": "DRAFT", "cascade": [],
        "guards": [
            "If-Match is always required: exact 0 for NONE to DRAFT, current aggregate_version for DRAFT to DRAFT",
            "content.cyclePublicId equals route cycleId",
            "parent cycle is OPEN or PROPOSAL_REVIEW",
            "typed proposal validates population, guideline, currency, amount and effective interval",
        ],
        "provenance": "G3_V3_ID_PLUS_COMPENSATION_PROPOSAL_CONTENT_RESEAL",
    },
]

XCON_020_HEADER = [
    "approvalReceiptId", "cycleId", "effectiveFrom", "effectiveTo", "lineCount",
    "lines", "payloadDigest", "planId", "snapshotId", "snapshotRevision",
    "sourceVersion",
]
XCON_020_LINE = [
    "approvedAmount", "assignmentId", "componentCode", "currency",
    "effectiveFrom", "effectiveTo", "lineDigest", "lineId", "lineSequence",
    "workerId",
]

BACKEND_ROOT = "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/compensationplanning/**"
BACKEND_TEST_ROOT = "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/compensationplanning/**"
TYPED_ARTIFACT_ROOT = "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact/**"
TYPED_ARTIFACT_TEST_ROOT = "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/typedartifact/**"
WORKFORCE_SNAPSHOT_SCHEMA_PATH = "contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json"
WORKFORCE_SNAPSHOT_MAIN_ROOT = "dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/**"
WORKFORCE_SNAPSHOT_TEST_ROOT = "dwp-people-server/src/test/java/com/dwp/services/people/hris/contracts/workforce/v1/**"
FRONTEND_ROOT = "apps/dwp/src/features/hris/performance/compensation-planning/**"
PROVIDER_ROOT = "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/contracts/xcon"
MIGRATION_PATH = "dwp-people-server/src/main/resources/db/performance-migration/V4__per_modern_compensation_planning.sql"
HISTORICAL_PATH = "dwp-people-server/src/main/resources/db/performance-migration/V22__per_modern_compensation_planning.sql"
PROVIDER_TESTS = [
    f"{PROVIDER_ROOT}/Xcon020ApprovedCompensationPlanSnapshotV1ProviderContractTest.java",
    f"{PROVIDER_ROOT}/Xcon021ApprovedCompensationPlanSnapshotPublishedV2ProviderContractTest.java",
]
BACKEND_TESTS = [
    "CompensationPlanningMigrationContractTest",
    "CompensationPlanningBudgetInvariantPostgresTest",
    "CompensationPlanningAuthorizationTest",
    "ApprovedCompensationPlanSnapshotProviderContractTest",
    "ApprovedCompensationPlanSnapshotPublicationPostgresTest",
]
FRONTEND_TESTS = [
    "apps/dwp/src/features/hris/performance/compensation-planning/__tests__/compensation-planning-contract.test.ts",
    "apps/dwp/src/features/hris/performance/compensation-planning/__tests__/compensation-planning-api.test.ts",
    "apps/dwp/src/features/hris/performance/compensation-planning/__tests__/compensation-planning-workspace.test.tsx",
    "apps/dwp/src/features/hris/performance/compensation-planning/__tests__/compensation-planning-command-runtime.test.tsx",
]
PLATFORM_TEST = "dwp-platform-contracts/src/test/java/com/dwp/platform/contract/Xcon021CompensationSnapshotPublicationV2Test.java"

COMMON_CONTROL_SELECTORS = [
    ("backend", "contracts/hris/**"),
    ("backend", WORKFORCE_SNAPSHOT_SCHEMA_PATH),
    ("backend", "contracts/openapi/**"),
    ("backend", "contracts/asyncapi/**"),
    ("backend", "contracts/product-authorization/**"),
    ("backend", "dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/**"),
    ("backend", "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/generated/**"),
    ("backend", "dwp-people-server/src/main/resources/pep/**"),
    ("backend", "dwp-people-server/src/main/resources/security/**"),
    ("backend", WORKFORCE_SNAPSHOT_MAIN_ROOT),
    ("backend", WORKFORCE_SNAPSHOT_TEST_ROOT),
    ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/security/HcmV3PepRegistry.java"),
    ("backend", "dwp-people-server/src/main/java/com/dwp/services/people/security/HrisEmployeeChangeSecurityBridge.java"),
    ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmV3PepRegistryTest.java"),
    ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HrisEmployeeChangeSecurityBridgeTest.java"),
    ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmOwnerPepExecutionTest.java"),
    ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmPepBindingConstraintsTest.java"),
    ("backend", "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmProductSurfacePepFilterTest.java"),
    ("backend", "scripts/generate-hris-contracts.py"),
    ("backend", "dwp-approval-server/src/main/resources/product-authorization/**"),
    ("backend", "dwp-auth-server/src/main/resources/product-authorization/**"),
    ("backend", "dwp-meeting-server/src/main/resources/product-authorization/**"),
    ("backend", "dwp-people-server/src/main/resources/product-authorization/**"),
    ("backend", "dwp-platform-server/src/main/resources/product-authorization/**"),
    ("backend", "dwp-space-server/src/main/resources/product-authorization/**"),
    ("backend", "scripts/export-openapi-contracts.py"),
    ("backend", "scripts/generate-product-authorization-contracts.py"),
    ("backend", "scripts/generate-product-authorization-fixtures.py"),
    ("backend", "scripts/generate-approval-document-projection-contracts.py"),
    ("backend", "scripts/generate-approval-extension-projection-contracts.py"),
    ("backend", "scripts/generate-approval-recovery11-projection-contracts.py"),
    ("backend", "scripts/generate-approval-release10-projection-contracts.py"),
    ("backend", "scripts/generate-approval-work-projection-contracts.py"),
    ("backend", "dwp-gateway/**"),
    ("backend", "dwp-migration-control/**"),
    ("backend", "build.gradle.kts"),
    ("backend", "settings.gradle.kts"),
    ("backend", "gradle/**"),
    ("backend", ".github/workflows/**"),
    ("frontend", "apps/dwp/src/routes/**"),
    ("frontend", "apps/dwp/src/features/hcm/hcm-navigation*.ts*"),
    ("frontend", "apps/dwp/src/features/hcm/hcm-product-manifest*.ts*"),
    ("frontend", "apps/dwp/src/features/hris/shell/**"),
    ("frontend", "apps/dwp/src/pages/hcm.tsx"),
    ("frontend", "apps/dwp/src/routes/product-surface-authorization.generated.ts"),
    ("frontend", "architecture/**"),
    ("frontend", "libs/api-contracts/**"),
    ("frontend", "libs/shared-utils/src/auth/**"),
    ("frontend", "libs/shared-utils/src/test-utils/pilot-authorization-fixtures.generated.ts"),
    ("frontend", "libs/shared-i18n/**"),
    ("frontend", "scripts/sync-openapi-contract.mjs"),
    ("frontend", "scripts/sync-agent-openapi-contract.mjs"),
    ("frontend", "scripts/sync-product-surface-authorization.mjs"),
    ("frontend", "scripts/sync-product-authorization-fixtures.mjs"),
    ("frontend", "scripts/sync-product-surface-internal-closure.mjs"),
    ("frontend", "scripts/generate-route-composition.mjs"),
    ("frontend", "scripts/product-authorization-fixture-versions.mjs"),
    ("frontend", "scripts/check-official-backend-contracts.mjs"),
    ("frontend", "scripts/check-official-backend-contracts.test.mjs"),
    ("frontend", "scripts/check-product-surface-production-readiness.mjs"),
    ("frontend", "scripts/check-product-surface-production-readiness.test.mjs"),
    ("frontend", "scripts/product-surface-readiness-authorization.mjs"),
    ("frontend", "scripts/sync-product-surface-internal-closure.test.mjs"),
    ("frontend", "deploy/nginx/dwp-product-routes.conf"),
    ("frontend", "package.json"),
    ("frontend", "yarn.lock"),
    ("frontend", "nx.json"),
    ("frontend", "tsconfig*.json"),
]

TOOL_PATHS = [
    "README.md", "contracts/mod-per-compplan-preparation.schema.v1.json",
    "materialize_g7_mod_per_compplan_preparation.py",
    "validate_g7_mod_per_compplan_preparation.py",
    "test_g7_mod_per_compplan_preparation.py",
]
ARTIFACT_PATHS = [
    "contract-reseal-authority.v1.json", "packet.v1.json",
    "migration-leases.delta.v1.json", "state/preparation.v1.json",
    "manifest.v1.json",
]


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def pretty(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256(canonical_bytes(result))
    return result


def authorities() -> dict[str, bool]:
    return {
        "sourceChangeAuthority": False,
        "startTokenAuthority": False,
        "migrationAdmissionAuthority": False,
        "worktreeRegistrationAuthority": False,
        "activationAuthority": False,
        "integrationAuthority": False,
        "promotionAuthority": False,
        "releaseAuthority": False,
        "payConsumptionAuthority": False,
    }


def safe_repo_path(path: str) -> str:
    candidate = PurePosixPath(path)
    if candidate.is_absolute() or ".." in candidate.parts or path != candidate.as_posix():
        raise RuntimeError(f"unsafe or non-normalized repository path: {path}")
    return path


def committed_file(repo: Path, commit: str, path: str) -> tuple[bytes, str]:
    path = safe_repo_path(path)
    entry = run_git(repo, "ls-tree", "-z", commit, "--", path)
    if not entry:
        raise RuntimeError(f"missing pinned Git object: {commit}:{path}")
    prefix, actual = entry.rstrip("\0").split("\t", 1)
    mode, kind, blob = prefix.split()
    if actual != path or kind != "blob" or mode not in {"100644", "100755"}:
        raise RuntimeError(f"unsafe pinned Git entry: {commit}:{path}")
    result = subprocess.run(
        ["git", "show", f"{commit}:{path}"], cwd=repo, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise RuntimeError(f"cannot read pinned Git object: {commit}:{path}")
    git_blob = git_blob_sha1(result.stdout)
    if git_blob != blob:
        raise RuntimeError(f"pinned Git blob mismatch: {commit}:{path}")
    return result.stdout, blob


def source_pin_rows() -> list[dict[str, Any]]:
    rows = []
    for repo_id, repo, commit, pins in (
        ("frontend", FRONTEND, FRONTEND_COMMIT, SOURCE_PINS),
        ("backend", BACKEND, BACKEND_COMMIT, BACKEND_SOURCE_PINS),
    ):
        for source_id, (path, expected_sha) in pins.items():
            data, blob = committed_file(repo, commit, path)
            if sha256(data) != expected_sha:
                raise RuntimeError(f"pinned source digest drift: {repo_id}:{path}")
            rows.append({
                "sourceId": source_id, "repo": repo_id, "path": path,
                "gitBlobSha1": blob, "bytes": len(data), "sha256": expected_sha,
                "selectors": [
                    {"selector": selector, "selectorSha256": digest}
                    for selector, digest in SOURCE_SELECTOR_SHA256.get(source_id, [])
                ],
            })
    return rows


def selector_value(data: bytes, selector: str) -> Any:
    if selector.startswith("csv:"):
        key, value = selector.removeprefix("csv:").split("=", 1)
        rows = list(csv.DictReader(io.StringIO(data.decode())))
        matched = [row for row in rows if row.get(key) == value]
        if len(matched) != 1:
            raise RuntimeError(f"selector cardinality drift: {selector}")
        return matched[0]
    document = json.loads(data)
    if selector == "#/dependencies":
        return document["dependencies"]
    if selector == "#/artifactStore":
        return document["artifactStore"]
    if selector == "#/x-port":
        return document["x-port"]
    if selector.startswith("#/$defs/"):
        return document["$defs"][selector.removeprefix("#/$defs/")]
    if selector == "#/$defs/XCON_020":
        return document["$defs"]["XCON_020"]
    if selector == "#/$defs/XCON_021":
        return document["$defs"]["XCON_021"]
    if selector.endswith("[primarySliceId=MOD-PER-COMPPLAN]"):
        key = selector[2:].split("[", 1)[0]
        return [row for row in document[key] if row.get("primarySliceId") == MODULE_ID]
    if selector.endswith("/tableSpecifications"):
        capability = next(
            row for row in document["capabilities"]
            if row.get("capabilityId") == "HRIS.MODERN.COMPENSATION_PLANNING"
        )
        return capability["tableSpecifications"]
    if selector.startswith("#/schemas[schemaId="):
        schema_id = selector.removeprefix("#/schemas[schemaId=").removesuffix("]")
        return next(row for row in document["schemas"] if row.get("schemaId") == schema_id)
    if selector.endswith("/requestSchema/body"):
        capability = next(
            row for row in document["capabilities"]
            if row.get("capabilityId") == "HRIS.MODERN.COMPENSATION_PLANNING"
        )
        operation = next(
            row for row in capability["operations"]
            if row.get("operationId") == "per.remediation.createCompensationCycle"
        )
        return operation["requestSchema"]["body"]
    if selector.startswith("#/consumedModernCapabilities"):
        return next(
            row for row in document["consumedModernCapabilities"]
            if row.get("capabilityId") == "HRIS.MODERN.COMPENSATION_PLANNING"
        )
    raise RuntimeError(f"unsupported selector: {selector}")


def projection_field(name: str, type_name: str, source: str, *, required: bool = True) -> dict[str, Any]:
    return {"name": name, "type": type_name, "required": required, "source": source}


def request_physical_mappings(operation_id: str) -> list[str]:
    mappings = {
        "modern.compplan.budget.allocate": [
            "path.cycleId -> prf_cmp_cycles.public_id owner lookup",
            "body.organizationPublicId -> prf_cmp_budget_ledger.org_public_id",
            "body.currency -> prf_cmp_budget_ledger.currency_code",
            "body.amount -> prf_cmp_budget_ledger.amount canonical NUMERIC(19,4)",
            "body.ledgerEntryType -> prf_cmp_budget_ledger.entry_type",
            "body.reversesEntryPublicId -> prf_cmp_budget_ledger.source_entry_public_id iff REVERSE",
        ],
        "modern.compplan.cycle.cancel": [
            "path.cycleId -> prf_cmp_cycles.public_id owner lookup",
            "If-Match -> prf_cmp_cycles.aggregate_version CAS",
            "transition -> prf_cmp_cycles.status and nonterminal prf_cmp_proposals.status",
        ],
        "modern.compplan.cycle.create": [
            "body.cycleCode -> prf_cmp_cycles.cycle_code",
            "body.guidelines -> append CompensationGuidelinesContent.v1 then prf_cmp_cycles.guideline_artifact_public_id",
            "body.population -> append CompensationPopulationContent.v1 then prf_cmp_cycles.population_artifact_public_id",
            "body.populationSourceRef -> owner HRM refetch guard only, never persisted as an opaque blob",
            "body.effectiveFrom/effectiveTo -> prf_cmp_cycles.effective_from/effective_to",
        ],
        "modern.compplan.cycle.query": ["path.cycleId -> six-table authorized projection plus referenced typed content only"],
        "modern.compplan.cycle.revise": [
            "path.cycleId -> prf_cmp_cycles.public_id owner lookup",
            "body.guidelines/population -> immutable new typed artifact versions",
            "new artifact public IDs -> prf_cmp_cycles guideline/population artifact references",
            "body.effectiveFrom/effectiveTo -> prf_cmp_cycles effective interval",
        ],
        "modern.compplan.cycles.query": ["query asOf/cursor/limit -> authorized prf_cmp_cycles page and budget summary"],
        "modern.compplan.plan.approve": [
            "path.cycleId -> prf_cmp_cycles.public_id owner lookup",
            "decision=APPROVE and reasonCode -> closed prf_command_receipts evidence; no opaque domain JSON",
            "successful prf_command_receipts.command_receipt_id -> approvalReceiptId and applied_aggregate_version -> approvalRevision for later publish",
        ],
        "modern.compplan.proposal.query": ["path.proposalId -> prf_cmp_proposals plus current prf_cmp_proposal_revisions and referenced typed content"],
        "modern.compplan.proposal.submit": [
            "path.cycleId/proposalId -> owner-bound cycle and proposal public IDs",
            "body.submissionDigest -> current prf_cmp_proposal_revisions.content_digest equality guard",
            "body.effectiveDate -> proposal/cycle effective interval guard",
        ],
        "modern.compplan.proposal.upsert": [
            "body.content -> CompensationProposalContent.v1 immutable artifact version",
            "typed scalar fields -> prf_cmp_proposals columns",
            "artifact public ID and digest -> prf_cmp_proposal_revisions typed_content_artifact_public_id/content_digest",
        ],
        "modern.compplan.proposals.query": ["path.cycleId plus referenceEffectiveAt/cursor/limit -> authorized summary-only prf_cmp_proposals page plus current revision digest; no typed content read"],
        "modern.compplan.snapshot.publish": [
            "path.cycleId -> approved prf_cmp_cycles.public_id",
            "body.approvalReceiptId -> prf_cmp_approved_snapshots.approval_receipt_public_id",
            "body.approvalReceiptId -> same-tenant prf_command_receipts.command_receipt_id; require receipt_state=SUCCEEDED, command_type=modern.compplan.plan.approve, originating_action=hcm.compensation.plan.approve, aggregate_id=result_ref=cycleId, applied_aggregate_version>=1 and sealed maker-checker/authorization evidence",
            "approved cycle effective_from/effective_to -> snapshot effective interval; caller override is forbidden",
            "server-assigned snapshot/line identities and committed ordered lines -> canonical lineDigest and payloadDigest; caller digest is forbidden",
            "frozen proposals -> one snapshot header plus 1..100000 ordered immutable lines",
        ],
    }
    return mappings[operation_id]


def child_results_contract(operation_id: str) -> dict[str, Any] | None:
    contracts = {
        "modern.compplan.cycle.cancel": {
            "cardinality": "0..100000",
            "ordering": "prf_cmp_proposals.public_id canonical UUID byte order ascending",
            "closedEntityTypes": ["COMPENSATION_PROPOSAL"],
            "entries": [{
                "entityType": "COMPENSATION_PROPOSAL",
                "publicIdSource": "cancelled nonterminal prf_cmp_proposals.public_id",
                "aggregateVersionSource": "post-cancel prf_cmp_proposals.aggregate_version",
                "ordinalSource": "1-based canonical public_id byte-order position",
                "resultDigestInputs": ["entityType", "publicId", "aggregateVersion", "ordinal", "postStatus=CANCELLED"],
            }],
            "emptyWhen": "no nonterminal proposal is cascaded",
            "rawEncryptedBytesExposed": False,
        },
        "modern.compplan.cycle.revise": {
            "cardinality": "exactly 2",
            "ordering": "fixed entity-type ordinal",
            "closedEntityTypes": [
                "COMPENSATION_GUIDELINES_ARTIFACT_VERSION",
                "COMPENSATION_POPULATION_ARTIFACT_VERSION",
            ],
            "entries": [
                {
                    "entityType": "COMPENSATION_GUIDELINES_ARTIFACT_VERSION",
                    "ordinal": 1,
                    "publicIdSource": "appended guideline prf_per_artifact_versions.public_id",
                    "aggregateVersionSource": "appended guideline prf_per_artifact_versions.artifact_revision",
                    "resultDigestInputs": ["entityType", "publicId", "artifactRevision", "ordinal", "artifactType", "schemaVersion", "ownerAggregateType", "ownerAggregatePublicId", "canonicalContentDigest", "effectiveFrom", "effectiveTo"],
                },
                {
                    "entityType": "COMPENSATION_POPULATION_ARTIFACT_VERSION",
                    "ordinal": 2,
                    "publicIdSource": "appended population prf_per_artifact_versions.public_id",
                    "aggregateVersionSource": "appended population prf_per_artifact_versions.artifact_revision",
                    "resultDigestInputs": ["entityType", "publicId", "artifactRevision", "ordinal", "artifactType", "schemaVersion", "ownerAggregateType", "ownerAggregatePublicId", "canonicalContentDigest", "effectiveFrom", "effectiveTo"],
                },
            ],
            "emptyWhen": "NEVER_ON_SUCCESS",
            "rawEncryptedBytesExposed": False,
        },
        "modern.compplan.proposal.upsert": {
            "cardinality": "exactly 2",
            "ordering": "fixed entity-type ordinal",
            "closedEntityTypes": [
                "COMPENSATION_PROPOSAL_ARTIFACT_VERSION",
                "COMPENSATION_PROPOSAL_REVISION",
            ],
            "entries": [
                {
                    "entityType": "COMPENSATION_PROPOSAL_ARTIFACT_VERSION",
                    "ordinal": 1,
                    "publicIdSource": "appended proposal prf_per_artifact_versions.public_id",
                    "aggregateVersionSource": "appended proposal prf_per_artifact_versions.artifact_revision",
                    "resultDigestInputs": ["entityType", "publicId", "artifactRevision", "ordinal", "artifactType", "schemaVersion", "ownerAggregateType", "ownerAggregatePublicId", "canonicalContentDigest", "effectiveFrom", "effectiveTo"],
                },
                {
                    "entityType": "COMPENSATION_PROPOSAL_REVISION",
                    "ordinal": 2,
                    "publicIdSource": "appended prf_cmp_proposal_revisions.public_id",
                    "aggregateVersionSource": "appended prf_cmp_proposal_revisions.aggregate_version",
                    "resultDigestInputs": ["entityType", "publicId", "aggregateVersion", "ordinal", "proposalPublicId", "revisionNo", "typedContentArtifactPublicId", "contentDigest", "exceptionApprovalReceiptPublicId=NULL"],
                },
            ],
            "emptyWhen": "NEVER_ON_SUCCESS",
            "rawEncryptedBytesExposed": False,
        },
    }
    return copy.deepcopy(contracts.get(operation_id))


def final_response_schema(operation_id: str, binding: dict[str, Any], exact: dict[str, Any], canonical: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    response_by_id = {row["schemaId"]: row for row in exact["responseSchemas"]}
    if operation_id == "modern.compplan.snapshot.publish":
        return (
            "modern.compplan.snapshot.publish.Response.v2",
            {
                "schemaId": "modern.compplan.snapshot.publish.Response.v2",
                "kind": "OBJECT",
                "additionalProperties": False,
                "fields": [
                    projection_field("approvalReceiptId", "UUID", "prf_cmp_approved_snapshots.approval_receipt_public_id"),
                    projection_field("cycleId", "UUID", "prf_cmp_cycles.public_id"),
                    projection_field("snapshotId", "UUID", "prf_cmp_approved_snapshots.public_id"),
                    projection_field("snapshotRevision", "BIGINT", "prf_cmp_approved_snapshots.snapshot_revision"),
                    projection_field("sourceVersion", "BIGINT", "prf_cmp_approved_snapshots.source_version"),
                    projection_field("aggregateVersion", "BIGINT", "post-publish prf_cmp_cycles.aggregate_version"),
                    projection_field("lineCount", "INTEGER", "prf_cmp_approved_snapshots.line_count"),
                    projection_field("payloadDigest", "SHA256", "prf_cmp_approved_snapshots.payload_digest"),
                    projection_field("correlationId", "UUID", "prf_cmp_approved_snapshots.correlation_id copied from validated X-Correlation-ID"),
                    projection_field("publishedAt", "TIMESTAMPTZ", "same-transaction hris_performance.prf_outbox_events.created_at"),
                ],
                "forbiddenPublicFields": ["lines", "workerId", "assignmentId", "approvedAmount"],
                "internalSnapshotRefetch": "full XCON-020 is available only through SVC-PEP-PER-001 to HRIS-PAY",
            },
            "BOUNDED_PUBLIC_PUBLISH_SUMMARY_XCON_020_SERVICE_ONLY",
        )
    cycle_summary_fields = [
        projection_field("cycleId", "UUID", "prf_cmp_cycles.public_id"),
        projection_field("aggregateVersion", "BIGINT", "prf_cmp_cycles.aggregate_version"),
        projection_field("cycleCode", "STRING", "prf_cmp_cycles.cycle_code"),
        projection_field("effectiveFrom", "DATE", "prf_cmp_cycles.effective_from"),
        projection_field("effectiveTo", "NULLABLE_DATE", "prf_cmp_cycles.effective_to"),
        projection_field("status", "STRING", "prf_cmp_cycles.status"),
        {"name": "budgetMasked", "type": "BOOLEAN", "required": True, "source": "owner field-policy decision; always true for view-only projection"},
    ]
    cycle_detail_conditional_fields = [
        {"name": "guidelines", "type": "CompensationGuidelinesContent.v1", "required": False, "source": "PerTypedArtifactQueryPort.v1(guideline_artifact_public_id)", "fieldVisibility": "OPTIONAL_ONLY_WITH_PROPOSE_OR_APPROVE_DUTY_AND_PURPOSE_POPULATION_FIELD_POLICY_ALLOW; OTHERWISE OMIT"},
        {"name": "population", "type": "CompensationPopulationContent.v1", "required": False, "source": "PerTypedArtifactQueryPort.v1(population_artifact_public_id)", "fieldVisibility": "OPTIONAL_ONLY_WITH_PROPOSE_OR_APPROVE_DUTY_AND_PURPOSE_POPULATION_FIELD_POLICY_ALLOW; OTHERWISE OMIT"},
        {"name": "budgetEntries", "type": "ARRAY", "required": False, "source": "prf_cmp_budget_ledger ordered by entry_sequence", "fieldVisibility": "OPTIONAL_ONLY_WITH_PROPOSE_OR_APPROVE_DUTY_AND BUDGET_DETAIL PURPOSE FIELD_POLICY_ALLOW; VIEW_ONLY MUST OMIT"},
    ]
    proposal_summary_fields = [
        projection_field("proposalId", "UUID", "prf_cmp_proposals.public_id"),
        projection_field("aggregateVersion", "BIGINT", "prf_cmp_proposals.aggregate_version"),
        projection_field("cycleId", "UUID", "prf_cmp_proposals.compensation_cycle_id -> prf_cmp_cycles.public_id"),
        projection_field("workerId", "UUID", "prf_cmp_proposals.worker_public_id"),
        projection_field("assignmentId", "UUID", "prf_cmp_proposals.assignment_public_id"),
        projection_field("componentCode", "STRING", "prf_cmp_proposals.component_code"),
        projection_field("currency", "ISO4217", "prf_cmp_proposals.currency_code"),
        projection_field("effectiveFrom", "DATE", "prf_cmp_proposals.effective_from"),
        projection_field("effectiveTo", "NULLABLE_DATE", "prf_cmp_proposals.effective_to"),
        projection_field("currentRevision", "BIGINT", "prf_cmp_proposals.current_revision"),
        projection_field("status", "STRING", "prf_cmp_proposals.status"),
        projection_field("contentDigest", "SHA256", "prf_cmp_proposal_revisions.content_digest"),
        {"name": "amountMasked", "type": "BOOLEAN", "required": True, "source": "owner field-policy decision; true when amount omitted"},
    ]
    proposal_detail_conditional_fields = [
        {"name": "amount", "type": "DECIMAL_STRING", "required": False, "source": "canonical prf_cmp_proposals.amount", "fieldVisibility": "OPTIONAL_ONLY_WITH_PROPOSE_OR_APPROVE_DUTY_AND_PURPOSE_POPULATION_FIELD_POLICY_ALLOW; OTHERWISE OMIT"},
        {"name": "content", "type": "CompensationProposalContent.v1", "required": False, "source": "PerTypedArtifactQueryPort.v1(prf_cmp_proposal_revisions.typed_content_artifact_public_id)", "fieldVisibility": "OPTIONAL_ONLY_WITH_PROPOSE_OR_APPROVE_DUTY_AND_PURPOSE_POPULATION_FIELD_POLICY_ALLOW; OTHERWISE OMIT"},
    ]
    if operation_id in {"modern.compplan.cycle.query", "modern.compplan.cycles.query"}:
        collection = operation_id.endswith("cycles.query")
        ref = "modern.compplan.cycles.query.Response.v4" if collection else "modern.compplan.cycle.query.Response.v4"
        item_schema = {
            "schemaId": "modern.compplan.cycle.Projection.v4",
            "kind": "OBJECT", "additionalProperties": False,
            "fields": cycle_summary_fields if collection else [*cycle_summary_fields, *cycle_detail_conditional_fields],
            "authorizationRule": "OWNER_PEP_REEVALUATES_DUTY_PURPOSE_POPULATION_AND_FIELD_POLICY_EVERY_CALL; POLICY_UNAVAILABLE_DENIES; LIST_IS_SUMMARY_ONLY",
        }
        page_fields = ([
            projection_field("nextCursor", "NULLABLE_STRING", "signed tenant/caller/purpose/asOf/ownerRevision cursor"),
            projection_field("hasMore", "BOOLEAN", "owner query result"),
            projection_field("asOf", "TIMESTAMPTZ", "owner query clock"),
            projection_field("scopeRevision", "BIGINT", "authorization scope revision"),
            projection_field("fieldPolicyRevision", "BIGINT", "field policy revision"),
        ] if collection else [
            projection_field("referenceEffectiveAt", "TIMESTAMPTZ", "owner query clock"),
            projection_field("freshnessWatermark", "TIMESTAMPTZ", "owner projection watermark"),
            projection_field("fieldPolicyRevision", "BIGINT", "field policy revision"),
        ])
        schema = {
            "schemaId": ref, "kind": "OBJECT", "additionalProperties": False,
            "fields": [{
                "name": "items" if collection else "item",
                "type": "ARRAY" if collection else "OBJECT",
                "required": True,
                "itemSchemaRef" if collection else "schemaRef": item_schema["schemaId"],
                "inlineItemSchema": item_schema,
                "source": "authorized cycle projection rows",
            }, *page_fields],
            "forbiddenPhysicalSources": ["display_name", "budget_total", "budget_currency", "guideline_policy_version_id", "population_snapshot_id", "prf_cmp_plans", "prf_cmp_plan_proposal_refs"],
        }
        return ref, schema, "SIX_TABLE_PLUS_TYPED_ARTIFACT_RESEALED_PROJECTION"
    if operation_id in {"modern.compplan.proposal.query", "modern.compplan.proposals.query"}:
        collection = operation_id.endswith("proposals.query")
        ref = "modern.compplan.proposals.query.Response.v4" if collection else "modern.compplan.proposal.query.Response.v4"
        item_schema = {
            "schemaId": "modern.compplan.proposal.Projection.v4",
            "kind": "OBJECT", "additionalProperties": False,
            "fields": proposal_summary_fields if collection else [*proposal_summary_fields, *proposal_detail_conditional_fields],
            "authorizationRule": "OWNER_PEP_REEVALUATES_DUTY_PURPOSE_POPULATION_AND_FIELD_POLICY_EVERY_CALL; POLICY_UNAVAILABLE_DENIES; LIST_IS_SUMMARY_ONLY",
        }
        page_fields = ([
            projection_field("nextCursor", "NULLABLE_STRING", "signed tenant/caller/purpose/asOf/ownerRevision cursor"),
            projection_field("hasMore", "BOOLEAN", "owner query result"),
            projection_field("referenceEffectiveAt", "TIMESTAMPTZ", "owner query clock"),
            projection_field("freshnessWatermark", "TIMESTAMPTZ", "owner projection watermark"),
            projection_field("fieldPolicyRevision", "BIGINT", "field policy revision"),
        ] if collection else [
            projection_field("referenceEffectiveAt", "TIMESTAMPTZ", "owner query clock"),
            projection_field("freshnessWatermark", "TIMESTAMPTZ", "owner projection watermark"),
            projection_field("fieldPolicyRevision", "BIGINT", "field policy revision"),
        ])
        schema = {
            "schemaId": ref, "kind": "OBJECT", "additionalProperties": False,
            "fields": [{
                "name": "items" if collection else "item",
                "type": "ARRAY" if collection else "OBJECT",
                "required": True,
                "itemSchemaRef" if collection else "schemaRef": item_schema["schemaId"],
                "inlineItemSchema": item_schema,
                "source": "authorized proposal projection rows",
            }, *page_fields],
            "forbiddenPhysicalSources": ["effective_date", "reason_code", "proposal_version", "component_code_set_version_id", "prf_cmp_proposal_versions", "prf_cmp_plan_proposal_refs"],
        }
        if collection:
            schema["paginationContract"] = {
                "requestSchemaRef": "modern.compplan.proposals.query.Request.v4",
                "limit": "1..200; default 50",
                "cursor": "nullable opaque authenticated cursor bound to tenant, caller, purpose, cycle filter, referenceEffectiveAt, ownerRevision, and last canonical proposal position",
                "ordering": ["prf_cmp_proposals.public_id:ASC"],
                "consistency": "nextCursor is non-null iff hasMore=true; null iff hasMore=false; first item on continuation is strictly after authenticated last position",
            }
        return ref, schema, "SIX_TABLE_PLUS_TYPED_ARTIFACT_RESEALED_PROJECTION"
    response_ref = binding["responseSchemaRef"]
    schema = copy.deepcopy(response_by_id[response_ref])
    schema["fieldLineage"] = {
        "receipt": "prf_command_receipts closed in the command transaction",
        "aggregate": "operation stateTransitionContract.aggregateEntityType owner row",
        "childResults": "operation-specific childResultsContract; [] only when its explicit emptyWhen permits",
    }
    child_contract = child_results_contract(operation_id)
    if child_contract is not None:
        schema["childResultsContract"] = child_contract
        return response_ref, schema, "G3_RESPONSE_SHAPE_WITH_RESEALED_CHILD_RESULT_LINEAGE"
    return response_ref, schema, "G3_EXACT_RESPONSE_WITH_RESEALED_PHYSICAL_LINEAGE"


def normative_wire_contracts() -> list[dict[str, Any]]:
    path, _ = SOURCE_PINS["g3ExactSchemas"]
    data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, path)
    exact = json.loads(data)
    bindings = selector_value(data, "#/operationBindings[primarySliceId=MOD-PER-COMPPLAN]")
    remediation_path, _ = SOURCE_PINS["perRemediation"]
    remediation_data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, remediation_path)
    create_body = copy.deepcopy(selector_value(
        remediation_data,
        "#/capabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]/operations[operationId=per.remediation.createCompensationCycle]/requestSchema/body",
    ))
    create_guidelines = next(field for field in create_body if field["name"] == "guidelines")
    create_guidelines["r1Validation"] = "guidelines.budgetMode MUST equal HARD_CAP; EXCEPTION_APPROVAL fails closed"
    canonical_path, _ = SOURCE_PINS["canonicalSchemas"]
    canonical_data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, canonical_path)
    canonical = json.loads(canonical_data)
    content_schema_by_id = {
        schema_id: selector_value(remediation_data, f"#/schemas[schemaId={schema_id}]")
        for schema_id in (
            "CompensationGuidelinesContent.v1",
            "CompensationPopulationContent.v1",
            "CompensationProposalContent.v1",
        )
    }
    errors_by_id = {row["schemaId"]: row for row in exact["commonErrorSchemas"]}
    projected = []
    for index, binding in enumerate(bindings):
        request_schema = copy.deepcopy(binding["requestSchema"])
        request_schema_ref = binding["requestSchemaRef"]
        body_authority = "G3_EXACT_SCHEMA"
        if binding["operationId"] == "modern.compplan.cycle.create":
            request_schema["body"] = create_body
            request_schema["schemaId"] = "modern.compplan.cycle.create.Request.v2"
            request_schema_ref = "modern.compplan.cycle.create.Request.v2"
            body_authority = "PER_REMEDIATION_TYPED_CONTENT_OVERRIDE"
        elif binding["operationId"] == "modern.compplan.budget.allocate":
            request_schema["body"] = copy.deepcopy(request_schema["body"]) + [{
                "name": "reversesEntryPublicId", "type": "UUID", "required": False,
                "nullable": True, "validation": "required iff ledgerEntryType=REVERSE; same tenant/cycle/currency and not already reversed",
                "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
                "sourceMapping": "prf_cmp_budget_ledger.source_entry_public_id",
            }]
            request_schema["schemaId"] = "modern.compplan.budget.allocate.Request.v2"
            request_schema_ref = "modern.compplan.budget.allocate.Request.v2"
            body_authority = "G3_BODY_PLUS_REVERSE_SOURCE_REFERENCE_RESEAL"
        elif binding["operationId"] == "modern.compplan.cycle.revise":
            request_schema["body"] = [
                {"name": "guidelines", "type": "OBJECT", "required": True, "nullable": False, "schemaRef": "CompensationGuidelinesContent.v1", "r1Validation": "guidelines.budgetMode MUST equal HARD_CAP; EXCEPTION_APPROVAL fails closed"},
                {"name": "population", "type": "OBJECT", "required": True, "nullable": False, "schemaRef": "CompensationPopulationContent.v1"},
                {"name": "populationSourceRef", "type": "OBJECT", "required": True, "nullable": False, "schemaRef": "HRMSourceSnapshotRef.v1"},
                {"name": "effectiveFrom", "type": "DATE", "required": True, "nullable": False},
                {"name": "effectiveTo", "type": "DATE", "required": True, "nullable": True},
            ]
            request_schema["schemaId"] = "modern.compplan.cycle.revise.Request.v4"
            request_schema_ref = "modern.compplan.cycle.revise.Request.v4"
            body_authority = "PER_REMEDIATION_TYPED_CONTENT_RESEAL"
        elif binding["operationId"] == "modern.compplan.proposals.query":
            request_schema["queryParameters"] = copy.deepcopy(request_schema["queryParameters"]) + [
                {
                    "name": "cursor", "type": "STRING", "required": False,
                    "validation": "opaque authenticated tenant/caller/purpose/cycleId/referenceEffectiveAt/ownerRevision/lastProposalPublicId cursor; max 2048 UTF-8 bytes",
                    "sensitivity": "INTERNAL", "tokenization": "NONE",
                },
                {
                    "name": "limit", "type": "INTEGER", "required": False,
                    "validation": "1..200; default 50",
                    "sensitivity": "INTERNAL", "tokenization": "NONE",
                },
            ]
            request_schema["validationRules"] = copy.deepcopy(request_schema["validationRules"]) + [
                "cursor signature and all bound claims are owner-verified before query",
                "continuation ownerRevision/filter drift fails closed; no latest fallback",
            ]
            request_schema["schemaId"] = "modern.compplan.proposals.query.Request.v4"
            request_schema_ref = "modern.compplan.proposals.query.Request.v4"
            body_authority = "G3_QUERY_PLUS_BOUNDED_SIGNED_CURSOR_RESEAL"
        elif binding["operationId"] == "modern.compplan.proposal.upsert":
            request_schema["body"] = [{
                "name": "content", "type": "OBJECT", "required": True, "nullable": False,
                "schemaRef": "CompensationProposalContent.v1",
                "routeInvariant": "content.cyclePublicId equals path cycleId",
            }]
            request_schema["schemaId"] = "modern.compplan.proposal.upsert.Request.v4"
            request_schema_ref = "modern.compplan.proposal.upsert.Request.v4"
            body_authority = "PER_REMEDIATION_COMPENSATION_PROPOSAL_CONTENT_RESEAL"
        elif binding["operationId"] == "modern.compplan.plan.approve":
            request_schema["body"] = [
                copy.deepcopy(field) for field in request_schema["body"]
                if field["name"] in {"decision", "reasonCode"}
            ]
            decision = next(field for field in request_schema["body"] if field["name"] == "decision")
            decision["validation"] = "exact enum value APPROVE; no reject branch exists in this 12-operation closed set"
            decision["values"] = ["APPROVE"]
            request_schema["schemaId"] = "modern.compplan.plan.approve.Request.v2"
            request_schema_ref = "modern.compplan.plan.approve.Request.v2"
            body_authority = "G3_APPROVAL_BODY_NARROWED_TO_REACHABLE_APPROVE_ONLY"
        elif binding["operationId"] == "modern.compplan.snapshot.publish":
            request_schema["body"] = [
                copy.deepcopy(field) for field in request_schema["body"]
                if field["name"] == "approvalReceiptId"
            ]
            request_schema["schemaId"] = "modern.compplan.snapshot.publish.Request.v2"
            request_schema_ref = "modern.compplan.snapshot.publish.Request.v2"
            body_authority = "RESEALED_APPROVAL_RECEIPT_ONLY_OWNER_COMPUTES_EFFECTIVE_INTERVAL_AND_DIGESTS"
        response_ref, response_schema, response_authority = final_response_schema(
            binding["operationId"], binding, exact, canonical
        )
        transition_contracts = [
            row for row in STATE_TRANSITION_CONTRACTS
            if row["transitionId"] in binding["stateTransitionIds"]
        ]
        projected.append({
            "operationId": binding["operationId"],
            "exactSchemaRef": f"modern-capability-exact-schema-contracts.v1.json#/operationBindings/{47 + index}",
            "method": binding["method"],
            "path": binding["path"],
            "mode": binding["mode"],
            "action": binding["action"],
            "authorizationCapability": binding["authorizationCapability"],
            "authorizationBinding": binding["authorizationBinding"],
            "idempotency": binding["idempotency"],
            "expectedVersion": binding["expectedVersion"],
            "scope": binding["scope"],
            "requestSchemaRef": request_schema_ref,
            "responseSchemaRef": response_ref,
            "errorSchemaRefs": binding["errorSchemaRefs"],
            "requestSchema": request_schema,
            "requestPhysicalMappings": request_physical_mappings(binding["operationId"]),
            "responseSchema": response_schema,
            "responseAuthority": response_authority,
            "errorSchemas": [copy.deepcopy(errors_by_id[ref]) for ref in binding["errorSchemaRefs"]],
            "stateTransitionIds": binding["stateTransitionIds"],
            "stateTransitionContracts": transition_contracts,
            "eventNames": binding["eventNames"],
            "normativeFields": [
                "method", "path", "mode", "action", "authorizationCapability",
                "authorizationBinding", "idempotency", "expectedVersion", "scope",
                "requestSchemaRef", "requestSchema", "responseSchemaRef",
                "requestPhysicalMappings",
                "responseSchema", "errorSchemaRefs", "errorSchemas",
                "stateTransitionIds", "stateTransitionContracts", "eventNames",
            ],
            "resealedNonAuthorityFields": [
                "readsTables", "writesTables", "predecessorEventNames",
            ],
            "fieldProvenance": {
                "publicIdentityMethodPathModeAuthorization": "G3_PUBLIC_AND_EXACT_SCHEMA",
                "requestPathQueryHeaders": "G3_EXACT_SCHEMA",
                "requestBody": body_authority,
                "response": response_authority,
                "errorsIdempotencyExpectedVersion": "G3_EXACT_SCHEMA",
                "g3RequestSchemaSuperseded": body_authority != "G3_EXACT_SCHEMA",
                "g3ResponseSchemaSuperseded": response_authority != "G3_EXACT_RESPONSE_WITH_RESEALED_PHYSICAL_LINEAGE",
                "finalRequestResponseAuthority": "THIS_NORMATIVE_WIRE_CONTRACT_ONLY",
                "tableReadWriteSelectors": "RECONCILED_SIX_TABLE_OPERATION_SELECTOR",
                "eventBinding": "G3_V2_EVENT_BINDING_WITH_XCON021_PAY_RESEAL",
            },
        })
    return projected


def normative_table_specifications() -> list[dict[str, Any]]:
    path, _ = SOURCE_PINS["perRemediation"]
    data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, path)
    return selector_value(
        data,
        "#/capabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]/tableSpecifications",
    )


def shared_foundation_contract() -> dict[str, Any]:
    path, _ = SOURCE_PINS["perRemediation"]
    data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, path)
    artifact_store = selector_value(data, "#/artifactStore")
    schema_ids = [
        "CompensationGuidelinesContent.v1",
        "CompensationPopulationContent.v1",
        "CompensationProposalContent.v1",
    ]
    schemas = [
        selector_value(data, f"#/schemas[schemaId={schema_id}]")
        for schema_id in schema_ids
    ]
    registry = [
        row for row in artifact_store["artifactRegistry"]
        if row["schemaId"] in schema_ids
    ]
    source_refetch = artifact_store["refetchContract"]
    active_refetch = {
        "contractId": source_refetch["contractId"],
        "status": "CONTROL_ALLOCATED_MODULE_LOCAL_OWNER_PORT_REQUIRED",
        "inProcessConsumers": "PER compensation-planning owner package only",
        "exposure": "MODULE_LOCAL_OWNER_PORT_ONLY",
        "publicEndpoint": "NONE_FORBIDDEN",
        "parameters": [{
            "name": "artifactPublicId", "type": "UUID", "required": True,
            "nullable": False, "identity": "immutable tenant+public_id version-row identity",
        }],
        "requestFields": [
            {"name": "expectedArtifactType", "type": "ENUM", "required": True, "nullable": False, "registryRef": "active sumTypeDiscriminator mapping"},
            {"name": "expectedOwnerAggregateType", "type": "STRING", "required": True, "nullable": False},
            {"name": "expectedOwnerAggregatePublicId", "type": "UUID", "required": True, "nullable": False},
            {"name": "purposeCode", "type": "STRING", "required": True, "nullable": False, "validation": "operation-specific exact read purpose"},
        ],
        "authorization": source_refetch["authorization"],
        "response": {
            "immutableRefMetadata": ["artifactPublicId", "artifactRevision", "schemaVersion", "sha256"],
            "typedContent": "strict closed sum-type instance only",
            "internalVerification": ["tenant", "ownerAggregateType", "ownerAggregatePublicId", "artifactType", "artifactRevision", "schemaVersion", "canonicalContentDigest", "encryptionKeyVersion", "decryption", "recomputedCanonicalDigest"],
        },
        "rules": copy.deepcopy(source_refetch["rules"]),
        "sumTypeDiscriminator": {
            "field": "artifactType",
            "mapping": {
                "COMPENSATION_GUIDELINES": "CompensationGuidelinesContent.v1",
                "COMPENSATION_POPULATION": "CompensationPopulationContent.v1",
                "COMPENSATION_PROPOSAL": "CompensationProposalContent.v1",
            },
        },
        "sourceContractRole": "EVIDENCE_ONLY_ACTIVE_EXPOSURE_RESEALED",
        "supersededSourceSignature": {
            "status": "SUPERSEDED_FORBIDDEN_FOR_ACTIVE_R1_MODULE_LOCAL_PORT",
            "forbiddenCallerInputs": ["artifactRevision", "expectedSha256"],
            "reason": "aggregate references identify one immutable artifact version row; revision and digest are owner-verified metadata, not caller authority",
        },
    }
    return {
        "allocationState": "CONTROL_PRE_START_ALLOCATION_REQUIRED",
        "controlRequestId": "G7-CR-MOD-PER-COMPPLAN-TYPED-ARTIFACT-BOOTSTRAP-R1",
        "tableCount": 1,
        "table": artifact_store["table"],
        "refetchContract": active_refetch,
        "activeArtifactRegistry": registry,
        "activeContentSchemas": schemas,
        "activeSchemaIds": schema_ids,
        "security": {
            "encryptedContentRequired": True,
            "canonicalDigestRequired": True,
            "appendOnly": True,
            "rowSecurityEnabledAndForced": True,
            "unknownTypeSchemaFieldDigestOrOwnerFailsOpaque": True,
        },
        "frontendDirectTypedArtifactEndpointAllowed": False,
        "moduleLocalOwnerPortOnly": True,
        "r1BudgetModePolicy": {
            "activeModes": ["HARD_CAP"],
            "withheldModes": ["EXCEPTION_APPROVAL"],
            "withheldState": "R1_WITHHELD_NOT_IMPLEMENTED",
            "validation": "cycle.create and cycle.revise reject EXCEPTION_APPROVAL before artifact append",
            "proposalRevisionExceptionApprovalReceiptRule": "prf_cmp_proposal_revisions.exception_approval_receipt_public_id MUST remain NULL in R1",
            "proposalSubmitExceptionPathAllowed": False,
            "futureActivationRule": "REQUIRES_VERSIONED_WIRE_AND_VERIFICATION_DEPENDENCY_BEFORE_ANY_USE",
        },
    }


def workforce_snapshot_compensation_projection_contract() -> dict[str, Any]:
    remediation_path, _ = SOURCE_PINS["perRemediation"]
    remediation_data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, remediation_path)
    population_line = selector_value(
        remediation_data, "#/schemas[schemaId=CompensationPopulationLine.v1]"
    )
    population_content = selector_value(
        remediation_data, "#/schemas[schemaId=CompensationPopulationContent.v1]"
    )
    source_ref = selector_value(
        remediation_data, "#/schemas[schemaId=HRMSourceSnapshotRef.v1]"
    )
    query_fields = [
        {"name": "snapshotPublicId", "type": "UUID", "required": True, "nullable": False},
        {"name": "ownerRevision", "type": "BIGINT", "required": True, "nullable": False, "minimum": 1},
        {"name": "asOf", "type": "TIMESTAMPTZ", "required": True, "nullable": False},
        {"name": "projection", "type": "STRING", "required": True, "nullable": False, "const": "COMPENSATION_POPULATION_V1"},
        {"name": "purposeCode", "type": "STRING", "required": True, "nullable": False, "const": "HRIS_PER_COMPENSATION_POPULATION"},
        {"name": "limit", "type": "INTEGER", "required": True, "nullable": False, "minimum": 1, "maximum": 500},
        {"name": "cursorToken", "type": "STRING", "required": True, "nullable": True, "maxUtf8Bytes": 2048},
    ]
    result_header_fields = [
        {"name": "snapshotPublicId", "type": "UUID", "required": True, "nullable": False},
        {"name": "ownerRevision", "type": "BIGINT", "required": True, "nullable": False, "minimum": 1},
        {"name": "asOf", "type": "TIMESTAMPTZ", "required": True, "nullable": False},
        {"name": "projection", "type": "STRING", "required": True, "nullable": False, "const": "COMPENSATION_POPULATION_V1"},
        {"name": "purposeCode", "type": "STRING", "required": True, "nullable": False, "const": "HRIS_PER_COMPENSATION_POPULATION"},
        {"name": "fullPopulationDigest", "type": "SHA256", "required": True, "nullable": False},
    ]
    return {
        "contractId": "WorkforceSnapshotQueryPort.v1",
        "amendmentId": "WorkforceSnapshotQueryPort.v1::COMPENSATION_POPULATION_V1-R1",
        "allocationState": "CONTROL_PRE_START_ALLOCATION_REQUIRED",
        "controlRequestId": "G7-CR-MOD-PER-COMPPLAN-WORKFORCE-SNAPSHOT-COMPENSATION-R1",
        "compatibility": {
            "strategy": "ADDITIVE_CLOSED_OVERLOAD",
            "existingMethodPreserved": "query(WorkforceSnapshotQuery)->WorkforceSnapshotPage",
            "existingPurposePreserved": "HRIS_WORKFORCE_SNAPSHOT_BOOTSTRAP",
            "existingProjectionPreserved": "PERFORMANCE_V1",
            "newMethod": "queryCompensationPopulation(CompensationPopulationSnapshotQuery)->CompensationPopulationSnapshotPage",
            "existingBootstrapBehaviorMayChange": False,
        },
        "pinnedCurrentAbi": {
            "schemaSourceId": "workforceSnapshotSchema",
            "schemaPath": WORKFORCE_SNAPSHOT_SCHEMA_PATH,
            "mainPath": WORKFORCE_SNAPSHOT_MAIN_ROOT,
            "testPath": WORKFORCE_SNAPSHOT_TEST_ROOT,
            "currentVariantSelectors": [
                {"selector": "#/x-port", "selectorSha256": "c14e230ac872b5fff9dae33cd2f90e895088dd3d495df7c24d8d9af000d64952"},
                {"selector": "#/$defs/WorkforceSnapshotQuery", "selectorSha256": "214c45298cd5984c42b84c747d03090bee0761ec22eb7d49a325a969240c80e3"},
                {"selector": "#/$defs/WorkforceSnapshotPage", "selectorSha256": "b058ca270429a3435e6ab7abdf5bae69c4241a5972a5dfdb97b8832d6cc6357d"},
            ],
        },
        "activeVariant": {
            "purposeCode": "HRIS_PER_COMPENSATION_POPULATION",
            "projection": "COMPENSATION_POPULATION_V1",
            "transport": "IN_PROCESS_OWNER_PORT_ONLY_NO_SELF_HTTP_NO_BROWSER_ROUTE",
            "requestSchema": {
                "schemaId": "CompensationPopulationSnapshotQuery.v1",
                "kind": "OBJECT",
                "additionalProperties": False,
                "fields": query_fields,
            },
            "ownerVerifiedRequest": {
                "consumerSuppliedTenantOrCallerAllowed": False,
                "resolvedFields": [
                    {"name": "tenantId", "type": "BIGINT", "minimum": 1, "source": "trusted owner tenant context"},
                    {"name": "tenantGrantRevision", "type": "BIGINT", "minimum": 1, "source": "owner grant revalidation"},
                    {"name": "policyRevision", "type": "BIGINT", "minimum": 1, "source": "owner PEP decision"},
                    {"name": "callerModule", "type": "STRING", "const": "HRIS-PER", "source": "trusted module identity"},
                    {"name": "correlationId", "type": "UUID", "source": "trusted request context"},
                ],
                "mustBindFromConsumerQuery": [
                    "snapshotPublicId", "ownerRevision", "asOf", "projection",
                    "purposeCode", "limit", "cursorTokenDigest",
                ],
                "authorization": "OWNER_REVALIDATES_TENANT_CALLER_PURPOSE_TARGET_POPULATION_AND_FIELD_POLICY_EVERY_PAGE; UNAVAILABLE_OR_DENIED_FAILS_CLOSED",
            },
            "resultPageSchema": {
                "schemaId": "CompensationPopulationSnapshotPage.v1",
                "kind": "OBJECT",
                "additionalProperties": False,
                "headerFields": result_header_fields,
                "fields": [
                    *result_header_fields,
                    {"name": "pageDigest", "type": "SHA256", "required": True, "nullable": False},
                    {"name": "lines", "type": "ARRAY", "required": True, "nullable": False, "itemSchemaRef": "CompensationPopulationLine.v1", "minItems": 0, "maxItems": 500},
                    {"name": "nextCursor", "type": "STRING", "required": True, "nullable": True, "maxUtf8Bytes": 2048},
                ],
                "lineSchema": population_line,
                "ordering": ["assignmentPublicId:ASC", "workerPublicId:ASC"],
                "cursorBinding": [
                    "tenantId", "callerModule", "snapshotPublicId", "ownerRevision",
                    "asOf", "projection", "purposeCode", "fullPopulationDigest",
                    "lastEmittedAssignmentPublicId", "lastEmittedWorkerPublicId",
                ],
                "pageDigestRule": "SHA256_CANONICAL_PAGE_HEADER_PLUS_ORDERED_LINES_PLUS_NEXT_CURSOR",
            },
        },
        "reconciliation": {
            "populationContentSchema": population_content,
            "sourceReferenceSchema": source_ref,
            "fieldMappings": {
                "CompensationPopulationContent.v1.asOf": "result.asOf",
                "CompensationPopulationContent.v1.hrmOwnerRevision": "result.ownerRevision",
                "CompensationPopulationContent.v1.lines": "exact concatenation of every result page lines in canonical order",
                "HRMSourceSnapshotRef.v1.snapshotPublicId": "result.snapshotPublicId",
                "HRMSourceSnapshotRef.v1.ownerRevision": "result.ownerRevision",
                "HRMSourceSnapshotRef.v1.projectionSchemaId": "CompensationPopulationContent.v1",
                "HRMSourceSnapshotRef.v1.asOf": "result.asOf",
                "HRMSourceSnapshotRef.v1.sha256": "result.fullPopulationDigest",
                "HRMSourceSnapshotRef.v1.purposeCode": "result.purposeCode",
            },
            "fullPopulationDigestRule": "SHA256_OF_CANONICAL_COMPENSATION_POPULATION_CONTENT_V1_BYTES",
            "completionRule": "BEGIN_WITH_NULL_CURSOR_AND_FOLLOW_EVERY_AUTHENTICATED_CURSOR_UNTIL_NEXT_CURSOR_NULL; 1_TO_100000_TOTAL_LINES",
            "exactMatchRule": "CALLER_SUPPLIED_POPULATION_CONTENT_AND_SOURCE_REF_MUST_BYTE_FIELD_RECONCILE_WITH_COMPLETE_OWNER_RESULT",
            "failClosed": [
                "partial pagination or early stop", "snapshotPublicId mismatch",
                "ownerRevision change or mismatch", "asOf projection purpose or digest mismatch",
                "missing duplicate or non-canonically-ordered line", "unknown or extra line field",
                "cursor authentication or page digest failure", "owner authorization unavailable or denied",
            ],
        },
        "moduleMayImplement": False,
        "grantRequiredBeforeStartToken": True,
    }


def xcon020_digest_contract() -> dict[str, Any]:
    def vector(
        vector_id: str, lines_without_digest: list[dict[str, Any]],
        snapshot_without_lines_or_digest: dict[str, Any],
    ) -> dict[str, Any]:
        completed_lines = []
        line_vectors = []
        for line in lines_without_digest:
            preimage = canonical_bytes(line)
            digest = sha256(preimage)
            completed_lines.append({**line, "lineDigest": digest})
            line_vectors.append({
                "preimageUtf8": preimage.decode(),
                "expectedSha256": digest,
            })
        snapshot = {**snapshot_without_lines_or_digest, "lines": completed_lines}
        payload_preimage = canonical_bytes(snapshot)
        return {
            "vectorId": vector_id,
            "lineVectors": line_vectors,
            "payloadPreimageUtf8": payload_preimage.decode(),
            "expectedPayloadSha256": sha256(payload_preimage),
        }

    vectors = [
        vector(
            "ONE_LINE_NULL_EFFECTIVE_TO",
            [{
                "approvedAmount": "1234.5",
                "assignmentId": "00000000-0000-4000-8000-000000000002",
                "componentCode": "BASE",
                "currency": "USD",
                "effectiveFrom": "2026-01-01",
                "effectiveTo": None,
                "lineId": "00000000-0000-4000-8000-000000000003",
                "lineSequence": 1,
                "workerId": "00000000-0000-4000-8000-000000000001",
            }],
            {
                "approvalReceiptId": "00000000-0000-4000-8000-000000000010",
                "cycleId": "00000000-0000-4000-8000-000000000011",
                "effectiveFrom": "2026-01-01",
                "effectiveTo": None,
                "lineCount": 1,
                "planId": "00000000-0000-4000-8000-000000000011",
                "snapshotId": "00000000-0000-4000-8000-000000000012",
                "snapshotRevision": 1,
                "sourceVersion": 7,
            },
        ),
        vector(
            "TWO_LINES_NON_NULL_MIXED_DECIMALS",
            [
                {
                    "approvedAmount": "1000",
                    "assignmentId": "10000000-0000-4000-8000-000000000002",
                    "componentCode": "BASE",
                    "currency": "KRW",
                    "effectiveFrom": "2026-02-01",
                    "effectiveTo": "2026-12-31",
                    "lineId": "10000000-0000-4000-8000-000000000003",
                    "lineSequence": 1,
                    "workerId": "10000000-0000-4000-8000-000000000001",
                },
                {
                    "approvedAmount": "12.34",
                    "assignmentId": "20000000-0000-4000-8000-000000000002",
                    "componentCode": "BONUS",
                    "currency": "USD",
                    "effectiveFrom": "2026-03-01",
                    "effectiveTo": "2026-09-30",
                    "lineId": "20000000-0000-4000-8000-000000000003",
                    "lineSequence": 2,
                    "workerId": "20000000-0000-4000-8000-000000000001",
                },
            ],
            {
                "approvalReceiptId": "30000000-0000-4000-8000-000000000010",
                "cycleId": "30000000-0000-4000-8000-000000000011",
                "effectiveFrom": "2026-02-01",
                "effectiveTo": "2026-12-31",
                "lineCount": 2,
                "planId": "30000000-0000-4000-8000-000000000011",
                "snapshotId": "30000000-0000-4000-8000-000000000012",
                "snapshotRevision": 2,
                "sourceVersion": 19,
            },
        ),
    ]
    return {
        "algorithm": "SHA-256",
        "output": "64 lowercase hexadecimal characters",
        "encoding": "UTF-8",
        "canonicalJson": "RFC8785_JCS",
        "scalarLexicalRules": {
            "uuid": "lowercase RFC4122 canonical hyphen form",
            "date": "YYYY-MM-DD",
            "nullableDate": "JSON null",
            "integer": "JSON integer",
            "money": "JSON string using PostedMoney canonical lexical form: no plus sign exponent or whitespace; negative zero normalizes to 0; scale at most 4; trailing fractional zeros stripped; integer has no decimal point",
            "componentCode": "Unicode NFC before UTF-8 encoding",
        },
        "lineDigest": {
            "preimageMemberOrder": ["approvedAmount", "assignmentId", "componentCode", "currency", "effectiveFrom", "effectiveTo", "lineId", "lineSequence", "workerId"],
            "excludedMembers": ["lineDigest"],
            "additionalProperties": False,
        },
        "payloadDigest": {
            "preimageMemberOrder": ["approvalReceiptId", "cycleId", "effectiveFrom", "effectiveTo", "lineCount", "lines", "planId", "snapshotId", "snapshotRevision", "sourceVersion"],
            "excludedMembers": ["payloadDigest"],
            "linesRule": "include each complete ordered line including its already-validated lineDigest",
            "additionalProperties": False,
        },
        "lineMaterialization": {
            "proposalToLineCardinality": "exactly 1:1",
            "totalOrderKey": ["workerPublicId RFC4122 unsigned 16-byte lexicographic", "assignmentPublicId RFC4122 unsigned 16-byte lexicographic", "componentCode NFC UTF-8 byte lexicographic", "effectiveFrom ISO date chronological", "proposalPublicId RFC4122 unsigned 16-byte lexicographic"],
            "lineSequence": "1-based contiguous position in totalOrderKey",
            "overlapCollision": "same worker+assignment+component with overlapping effective intervals is rejected; non-overlapping intervals are permitted",
            "lineId": "UUIDv4 generated once on the first successful attempt and persisted with the snapshot line and closed receipt result",
            "replay": "reuse persisted lineId, lineDigest, payloadDigest, response and outbox; never regenerate identities or digests",
        },
        "knownAnswerVectors": vectors,
    }


def ui_work_contract() -> dict[str, Any]:
    return {
        "route": "/hr/operations/performance/compensation-planning",
        "menuNode": "hcm.operations.compensation-planning",
        "primaryUser": "compensation planning operations lead",
        "operationalQuestion": "Are budgets, eligible proposals, maker-checker approval, and the payroll-ready immutable snapshot complete and safe to publish?",
        "primaryAction": "create or revise a cycle, allocate or reverse budget, draft and submit proposals, approve, and publish the immutable snapshot",
        "pageArchetype": "studio",
        "authorizationCapabilities": [
            "hcm.compensation.plan.view",
            "hcm.compensation.plan.propose",
            "hcm.compensation.plan.approve",
        ],
        "journey": [
            "create typed guideline and population cycle in DRAFT",
            "first budget allocation opens the cycle; later allocations or reversals preserve OPEN",
            "draft typed proposals and submit them into PROPOSAL_REVIEW",
            "independent approver records approval after budget and eligibility guards",
            "publish one immutable XCON-020 snapshot and XCON-021 event after atomic commit",
        ],
        "materialStates": [
            "LOADING", "EMPTY", "DRAFT", "OPEN", "PROPOSAL_REVIEW", "APPROVED",
            "PUBLISHED", "CANCELLED", "DENIED", "STEP_UP_REQUIRED", "STALE_VERSION",
            "RESULT_UNKNOWN",
        ],
        "forbiddenR1Actions": [
            "select or submit EXCEPTION_APPROVAL budget mode",
            "enter or display an exception approval receipt",
        ],
        "sourceSelectors": [
            {"sourceId": "compplanMenuNode", "selector": "csv:menu_node_key=hcm.operations.compensation-planning", "selectorSha256": "e0fae6263933ddbaef852bf60fae7334c9948db18ef3ffaa18c6fc14f0493680"},
            {"sourceId": "compplanIaAccess", "selector": "csv:ia_node_id=MODERN:hcm.operations.compensation-planning", "selectorSha256": "441700b9c4c9e4bf6f666aedad87c898ea8bc530b4d41986640c00ca383fb4e0"},
            {"sourceId": "compplanWorkbench", "selector": "csv:task_group_id=PERF-07", "selectorSha256": "241fd002c33ca56abc4d42f8f0cde8c9b5ad7355f00f7144740e841db29c55c6"},
        ],
        "shellRegistration": "CENTRAL_CONTROL_REQUEST_ONLY_AFTER_PUSHED_MODULE_RESULT",
    }


def contract_document() -> dict[str, Any]:
    return sealed({
        "schemaVersion": "HRIS-G7-MOD-PER-COMPPLAN-CONTRACT-RESEAL-V1",
        "authorityId": "HRIS-G7-MOD-PER-COMPPLAN-R1-CONTRACT-RESEAL",
        "moduleId": MODULE_ID,
        "preparedAt": PREPARED_AT,
        "predecessor": {
            "closureCarrierCommit": FRONTEND_COMMIT,
            "closureCarrierTree": FRONTEND_TREE,
            "closureReceiptPath": CLOSURE_PATH,
            "closureReceiptSha256": CLOSURE_SHA256,
            "closureReceiptId": CLOSURE_RECEIPT_ID,
            "closureReceiptSealedPayloadSha256": CLOSURE_SEAL,
        },
        "sourcePins": source_pin_rows(),
        "ownership": {
            "ownerSession": "HRIS-PER",
            "capabilityId": "HRIS.MODERN.COMPENSATION_PLANNING",
            "operationCount": 12,
            "operations": OPERATIONS,
            "eventCount": 8,
            "events": EVENTS,
            "supersededEventClauses": [{
                "clauseId": "G3_STANDARD_EVENT_EXACT_HISTORICAL_VERSION_REFETCH",
                "scope": [row[0] for row in EVENT_ROWS if row[0] != "ApprovedCompensationPlanSnapshotPublished.v2"],
                "status": "SUPERSEDED_FORBIDDEN",
                "replacement": "PAYLOAD_COMPLETE_NO_REFETCH",
                "reason": "six-table R1 has no aggregate history and the exact six-field immutable outbox transition fact is complete; latest fallback is also forbidden",
            }],
            "normativeWireContractSelector": {
                "sourceId": "g3ExactSchemas",
                "selector": "#/operationBindings[primarySliceId=MOD-PER-COMPPLAN]",
                "selectorSha256": "1436f07a399842bb60e41a27c010aced6c3bfd69b14e82c0f890ecedbfc783ef",
                "authorityBoundary": "PUBLIC_IDENTITY_METHOD_PATH_MODE_AUTH_IDEMPOTENCY_ERROR_WITH_EXPLICIT_RESEALED_REQUEST_RESPONSE_OVERRIDES_TABLE_SELECTORS_EXCLUDED",
            },
            "normativeWireContracts": normative_wire_contracts(),
            "stateTransitionContracts": STATE_TRANSITION_CONTRACTS,
            "lifecycleReachability": {
                "cycleHappyPath": ["NONE", "DRAFT", "OPEN", "PROPOSAL_REVIEW", "APPROVED", "PUBLISHED"],
                "proposalHappyPath": ["NONE", "DRAFT", "SUBMITTED", "FROZEN"],
                "cycleCancellationOrigins": ["DRAFT", "OPEN", "PROPOSAL_REVIEW"],
                "terminalStates": ["PUBLISHED", "CANCELLED"],
                "unreachableOrForbiddenStates": ["PENDING_APPROVAL"],
            },
            "supersededWireSchemas": [
                {"schemaId": "modern.compplan.cycle.create.Request.v1", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.cycle.create.Request.v2", "reason": "businessKey/displayName cannot populate mandatory typed guideline and population artifacts"},
                {"schemaId": "modern.compplan.budget.allocate.Request.v1", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.budget.allocate.Request.v2", "reason": "REVERSE lacked reversesEntryPublicId required for source_entry_public_id"},
                {"schemaId": "modern.compplan.cycle.revise.Request.v3", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.cycle.revise.Request.v4", "reason": "stale external policy/snapshot references replaced by typed content"},
                {"schemaId": "modern.compplan.proposal.upsert.Request.v3", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.proposal.upsert.Request.v4", "reason": "proposal fields must be one sealed CompensationProposalContent.v1"},
                {"schemaId": "modern.compplan.plan.approve.Request.v1", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.plan.approve.Request.v2", "reason": "closed state graph permits APPROVE only; the successful command receipt itself is the approval receipt, so caller-supplied approvalReceiptId is forbidden"},
                {"schemaId": "modern.compplan.proposals.query.Request.v3", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.proposals.query.Request.v4", "reason": "collection response pagination requires bounded limit and signed continuation cursor"},
                {"schemaId": "modern.compplan.snapshot.publish.Request.v1", "status": "SUPERSEDED_FORBIDDEN", "replacement": "modern.compplan.snapshot.publish.Request.v2", "reason": "caller cannot precompute final snapshot digest or override the approved cycle effective interval; body is approvalReceiptId only"},
                {"schemaId": "ApprovedCompensationPlanSnapshot.v1@G3_FLATTENED_LINE", "status": "REVOKED_FORBIDDEN", "replacement": "modern.compplan.snapshot.publish.Response.v2", "reason": "public publish returns a bounded summary; canonical XCON-020 lines are internal PAY refetch only"},
                {"schemaId": "XCON-020::ApprovedCompensationPlanSnapshot.v1@PUBLIC_PUBLISH_RESPONSE", "status": "REVOKED_FORBIDDEN", "replacement": "modern.compplan.snapshot.publish.Response.v2", "reason": "full worker/assignment/amount lines exceed MOD-AUTH-027 field projection and are service-only through SVC-PEP-PER-001"},
                {"schemaId": "HRIS.MODERN.COMPENSATION_PLANNING.Record.v1@G3_STALE_PHYSICAL", "status": "REVOKED_FORBIDDEN", "replacement": "operation-specific v4 projections", "reason": "contains absent columns and forbidden table lineage"},
            ],
            "commandSemantics": {
                "allCommandHeaders": ["Idempotency-Key", "X-Correlation-ID"],
                "versionedCommandHeaders": ["If-Match"],
                "ifMatchNotApplicableOperations": ["modern.compplan.cycle.create"],
                "canonicalRequestDigestIncludes": [
                    "method", "path", "validatedPathSelectors", "validatedQuerySelectors",
                    "body", "If-Match when present",
                ],
                "canonicalRequestDigestExcludes": [
                    "Idempotency-Key", "X-Correlation-ID", "traceContext",
                    "authenticationContext",
                ],
                "sameKeySameDigest": "REPLAY_CLOSED_RECEIPT",
                "sameKeyDifferentDigest": "REJECT_IDEMPOTENCY_KEY_REUSE",
                "writeRule": "IDEMPOTENCY_RECEIPT_CAS_AND_OUTBOX_REQUIRED",
            },
        },
        "crossModuleContracts": {
            "xcon020": {
                "contractId": "XCON-020",
                "schemaPointer": "#/$defs/XCON_020",
                "normalizedSchemaSha256": "d7b73b84c93e60fa8ff114f16625eab31bd2aa9095423120585039066e02ca20",
                "requiredFieldsSha256": "46b861794e318b6e3150f0b28807597c7bfcf448ddf7d8938b0e49dec49e5de5",
                "nestedFieldsSha256": "86fc82d68b8bd4b0fa7f268f428fcdfe9b6bafccc2671dd7e00d1e9d5229a674",
                "bindingSha256": "cb9c5f0014167b3125f529711ad10ce58c31e30b9bf0e12139fdc86ccd27b32a",
                "headerFields": XCON_020_HEADER,
                "lineFields": XCON_020_LINE,
                "lineCardinality": {"minimum": 1, "maximum": 100000},
                "digestContract": xcon020_digest_contract(),
                "invariants": [
                    "lineCount equals ordered line cardinality",
                    "lineSequence is contiguous from 1",
                    "lineId is unique within snapshot",
                    "payloadDigest covers canonical header plus ordered lines",
                    "PAY consumes the complete atomic N-to-N snapshot only",
                ],
            },
            "xcon021": {
                "contractId": "XCON-021",
                "schemaPointer": "#/$defs/XCON_021",
                "normalizedSchemaSha256": "a1189eeda37bd3874e1dc20b2e2d291c9bfb897cc1d7ddbb793923cdbc59d1cb",
                "requiredFieldsSha256": "9d86a14b30c958ab9dacb98fe6b8e2fea38e7cbfd9a9d29fd2d0ddc388ab90a7",
                "bindingSha256": "30674cae19eb781fdc32b96f03463a8bf5a875f43fb9f9d0962acba02269f3af",
                "requiredFields": PAY_EVENT_FIELDS,
                "publicationRule": "AFTER_IMMUTABLE_HEADER_AND_ALL_ORDERED_LINES_COMMIT_ONLY",
                "allowedConsumerSessions": ["HRIS-PAY"],
                "forbiddenEvents": ["CompensationPlanApproved.v1"],
                "dualPublishAllowed": False,
            },
            "servicePep": {
                "contractId": "SVC-PEP-PER-001",
                "operationId": "getApprovedCompensationPlanSnapshot",
                "method": "GET",
                "path": "/internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}",
                "ownerService": "dwp-people-server",
                "consumerService": "dwp-payroll-server",
                "authentication": "MTLS_SPIFFE_WORKLOAD_IDENTITY|OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_PEOPLE",
                "tenantControls": "SIGNED_TENANT_CLAIM|OWNER_TENANT_GRANT_REVALIDATION|TARGET_TENANT_MATCH|NO_CALLER_TENANT_OVERRIDE",
                "purposeCode": "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH",
                "transportControls": "NO_BROWSER_ROUTE|TLS_1_3|MTLS_REQUIRED|AUDIENCE_PINNED|RATE_LIMITED",
                "fieldProjection": {"headerFields": XCON_020_HEADER, "lineFields": XCON_020_LINE},
                "auditEnvelope": "AuditEventEnvelope.v1:callerWorkloadId+tenantId+operationId+purposeCode+projectionId+policyRevision+correlationId+outcome+rowCount+payloadDigest",
                "replayControls": "READ_IDEMPOTENT|NO_APPLICATION_CURSOR_OR_PAGING|FULL_ATOMIC_STREAMED_XCON_020|HEADER_AND_ORDERED_LINE_DIGEST_VERIFIED",
                "implementationState": "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED",
            },
            "workforceSnapshotCompensationProjection": workforce_snapshot_compensation_projection_contract(),
        },
        "physicalContract": {
            "tables": [{"table": name, "columns": TABLE_COLUMNS[name]} for name in TABLES],
            "moduleOwnedCompensationTables": TABLES,
            "controlAllocatedSharedFoundationTables": ["prf_per_artifact_versions"],
            "totalNewTablesInV4": 7,
            "columnSummaryRole": "READABILITY_ONLY_NORMATIVE_SELECTOR_CONTROLS",
            "normativeTableSpecifications": {
                "sourceId": "perRemediation",
                "selector": "#/capabilities[capabilityId=HRIS.MODERN.COMPENSATION_PLANNING]/tableSpecifications",
                "selectorSha256": "db0dcedb135ef9add3c289c49cab0649a3b339a8036e87c92e352669d016b2e3",
                "tableCount": 6,
                "authority": "NORMATIVE_FOR_V4_DDL_COLUMNS_TYPES_NULLABILITY_DEFAULTS_SENSITIVITY_CONSTRAINTS_FOREIGN_KEYS_IMMUTABILITY",
                "specifications": normative_table_specifications(),
            },
            "v4DdlContract": {
                "exactPath": MIGRATION_PATH,
                "moduleOwnedTableClosedSet": TABLES,
                "sharedFoundationTableClosedSet": ["prf_per_artifact_versions"],
                "allV4NewTableClosedSet": [*TABLES, "prf_per_artifact_versions"],
                "columnAndTypeAuthority": "normativeTableSpecifications.specifications",
                "primaryAndUniqueKeys": "EACH_TABLE_INTERNAL_PRIMARY_KEY_AND_TENANT_SCOPED_PUBLIC_ID_UNIQUE; ADDITIONAL_UNIQUES_FROM_SPECIFICATIONS",
                "foreignKeys": "LOCAL_OWNER_FOREIGN_KEYS_FROM_SPECIFICATIONS; NO_CROSS_RUNTIME_DATABASE_FOREIGN_KEYS",
                "rowSecurity": {
                    "enabled": True,
                    "forced": True,
                    "tenantPredicate": "tenant_id = current_setting('dwp.tenant_id', true)::bigint",
                    "applicationRoleBypassRls": False,
                },
                "immutability": {
                    "appendOnlyTables": [
                        "prf_cmp_budget_ledger", "prf_cmp_proposal_revisions",
                        "prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines",
                    ],
                    "versionedCasTables": ["prf_cmp_cycles", "prf_cmp_proposals"],
                    "approvedSnapshotMutationAllowed": False,
                },
                "checks": [
                    "money values use exact NUMERIC(19,4) semantics and non-negative domain rules",
                    "currency_code is uppercase ISO-style three-character code",
                    "effective_to is null or strictly after effective_from",
                    "line_count is 1..100000 and equals committed ordered line count",
                    "line_sequence is positive, unique per snapshot, and contiguous from 1",
                    "snapshot and line digests are non-empty and immutable",
                    "status and entry_type values are constrained to sealed workflow enums",
                    "prf_cmp_proposal_revisions.exception_approval_receipt_public_id is NULL-only in R1; EXCEPTION_APPROVAL is not active",
                    "budget ledger enforces positive ALLOCATE with null source and exact-inverse REVERSE of one same-tenant-cycle-organization-currency-amount source at most once; frozen/approved/published commitments cannot be reduced and availability stays nonnegative",
                    "approval requires an immutable collision-free 1..100000 proposal set with exactly one deterministic snapshot line per proposal; publish line_count equals that frozen set",
                ],
                "logicalUniquenessAndLinks": [
                    "prf_cmp_cycles UNIQUE(tenant_id, cycle_code)",
                    "prf_cmp_budget_ledger UNIQUE(tenant_id, compensation_cycle_id, entry_sequence)",
                    "a prf_cmp_budget_ledger source entry may be reversed at most once within the same tenant and cycle",
                    "prf_cmp_proposal_revisions UNIQUE(tenant_id, compensation_proposal_id, revision_no) and prf_cmp_proposals.current_revision resolves exactly one same-proposal revision",
                    "prf_cmp_approved_snapshots UNIQUE(tenant_id, compensation_cycle_id, snapshot_revision) and UNIQUE(tenant_id, compensation_cycle_id, source_version)",
                    "prf_cmp_approved_snapshot_lines UNIQUE(tenant_id, approved_compensation_snapshot_id, line_sequence)",
                ],
                "grants": "LEAST_PRIVILEGE_OWNER_APPLICATION_ROLE_THROUGH_RLS; NO_PUBLIC_OR_PAY_DATABASE_GRANT",
                "upgradeAcceptance": [
                    "clean V1 to V4 Flyway upgrade succeeds with outOfOrder=false",
                    "V1 V2 V3 checksums remain unchanged",
                    "new tables are empty on upgrade; no synthetic or destructive backfill",
                    "RLS is enabled and forced before application access",
                    "append-only and CAS constraints reject mutation/replay violations",
                    "rollback is forward-correction only; applied V4 is never edited or deleted",
                ],
            },
            "sharedBootstrapAllocation": shared_foundation_contract(),
            "forbiddenTables": FORBIDDEN_TABLES,
            "sharedInfrastructureRule": "USE_EXISTING_CONTROL_RECEIPT_OUTBOX_AND_AUDIT_TABLES_ONLY",
            "typedArtifactRule": "CONTROL_APPROVED_BOOTSTRAP_REQUIRED_BEFORE_START_TOKEN",
        },
        "lineage": {
            "identityInvariantScope": "modern.compplan.snapshot.publish plus XCON-020 and XCON-021 only",
            "identityInvariant": "for the publish contract only: planId == cycleId == aggregateId == prf_cmp_cycles.public_id",
            "proposalEventIdentityInvariant": "CompensationProposalDrafted.v2 and CompensationProposalSubmitted.v2 aggregateId == prf_cmp_proposals.public_id; never cycleId",
            "sourceVersion": "snapshot.source_version is the pre-publish approved cycle version",
            "approvalRevision": "the validated plan.approve prf_command_receipts.applied_aggregate_version selected by same-tenant command_receipt_id; captured in the first publish closed receipt and same-transaction XCON-021 outbox, then replayed without requery; independent from sourceVersion",
            "aggregateVersion": "post-publish cycle version",
            "snapshotMapping": "approvalReceiptId,snapshotId,snapshotRevision,effectiveDate,lineCount,payloadDigest come from the immutable committed snapshot",
            "transition": "fromState=APPROVED,toState=PUBLISHED; occurredAt is same-transaction hris_performance.prf_outbox_events.created_at; correlationId is prf_cmp_approved_snapshots.correlation_id copied from validated X-Correlation-ID and equal to the updated cycle correlation_id",
            "xcon020HeaderFieldMappings": {
                "approvalReceiptId": "prf_cmp_approved_snapshots.approval_receipt_public_id",
                "cycleId": "prf_cmp_cycles.public_id",
                "effectiveFrom": "prf_cmp_approved_snapshots.effective_from",
                "effectiveTo": "prf_cmp_approved_snapshots.effective_to",
                "lineCount": "prf_cmp_approved_snapshots.line_count",
                "lines": "prf_cmp_approved_snapshot_lines ordered by line_sequence",
                "payloadDigest": "prf_cmp_approved_snapshots.payload_digest",
                "planId": "prf_cmp_cycles.public_id",
                "snapshotId": "prf_cmp_approved_snapshots.public_id",
                "snapshotRevision": "prf_cmp_approved_snapshots.snapshot_revision",
                "sourceVersion": "prf_cmp_approved_snapshots.source_version",
            },
            "xcon020LineFieldMappings": {
                "approvedAmount": "prf_cmp_approved_snapshot_lines.approved_amount",
                "assignmentId": "prf_cmp_approved_snapshot_lines.assignment_public_id",
                "componentCode": "prf_cmp_approved_snapshot_lines.component_code",
                "currency": "prf_cmp_approved_snapshot_lines.currency_code",
                "effectiveFrom": "prf_cmp_approved_snapshot_lines.effective_from",
                "effectiveTo": "prf_cmp_approved_snapshot_lines.effective_to",
                "lineDigest": "prf_cmp_approved_snapshot_lines.line_digest",
                "lineId": "prf_cmp_approved_snapshot_lines.public_id",
                "lineSequence": "prf_cmp_approved_snapshot_lines.line_sequence",
                "workerId": "prf_cmp_approved_snapshot_lines.worker_public_id",
            },
            "xcon021FieldMappings": {
                "aggregateId": "prf_cmp_cycles.public_id",
                "aggregateVersion": "post-publish prf_cmp_cycles.aggregate_version",
                "approvalReceiptId": "prf_cmp_approved_snapshots.approval_receipt_public_id",
                "approvalRevision": "validated plan.approve prf_command_receipts.applied_aggregate_version captured with its command_receipt_id in the first closed publish receipt and same-transaction outbox; replay reuses the sealed value; never inferred from sourceVersion",
                "correlationId": "prf_cmp_approved_snapshots.correlation_id copied from validated X-Correlation-ID; must equal the same-transaction updated prf_cmp_cycles.correlation_id",
                "cycleId": "prf_cmp_cycles.public_id",
                "effectiveDate": "prf_cmp_approved_snapshots.effective_from",
                "fromState": "APPROVED",
                "lineCount": "prf_cmp_approved_snapshots.line_count",
                "occurredAt": "same-transaction hris_performance.prf_outbox_events.created_at after snapshot commit",
                "payloadDigest": "prf_cmp_approved_snapshots.payload_digest",
                "planId": "prf_cmp_cycles.public_id",
                "snapshotId": "prf_cmp_approved_snapshots.public_id",
                "snapshotRevision": "prf_cmp_approved_snapshots.snapshot_revision",
                "sourceVersion": "pre-publish approved cycle aggregate version stored in prf_cmp_approved_snapshots.source_version",
                "toState": "PUBLISHED",
            },
        },
        "uiWorkContract": ui_work_contract(),
        "resealDecision": {
            "incompleteGeneratedCompensationPayloadsAreAuthority": False,
            "canonicalXcon020And021OverrideGeneratedPayloads": True,
            "g3CompplanTableAndReadWriteSelectorsAreAuthority": False,
            "g3PublicIdentityMethodPathAuthorizationAreAuthority": True,
            "g3ExactIdempotencyAndErrorSchemasAreAuthority": True,
            "g3RequestAndResponseBodiesAreAuthority": False,
            "reconciledWireOverridesAreAuthority": True,
            "g3ExactOperationTableAndEventPayloadPortionsAreAuthority": False,
            "semanticRemediationSixTableClosureIsAuthority": True,
            "reconciledSixTableOperationSelectorsOverrideConflictingInputs": True,
            "operationSelectorProvenance": "G3_PUBLIC_SURFACE + SEMANTIC_REMEDIATION_SIX_TABLE_CLOSURE + REQUIRED_AGGREGATE_TOUCHES",
            "historicalV22ReservationIsRuntimeAuthority": False,
            "historicalHrisCompplanRootIsRuntimeAuthority": False,
            "currentHrCompplanRootIsRuntimeAuthority": True,
            "hrisContractsXconExceptionsAreExactFilesOnly": True,
            "payIsSoleCrossModuleConsumer": True,
            "ownerRefetchRequired": True,
        },
        "authorities": authorities(),
    })


def named_commands() -> list[dict[str, Any]]:
    people_classes = BACKEND_TESTS + [Path(path).stem for path in PROVIDER_TESTS]
    people_argv = ["./gradlew", ":dwp-people-server:test"]
    for name in people_classes:
        people_argv += ["--tests", f"*{name}"]
    people_argv += ["-PhrisSlice=MOD-PER-COMPPLAN", "--no-daemon"]
    return [
        {"commandId": "PER_COMPPLAN_BACKEND_CLOSED", "cwd": "backend", "argv": people_argv},
        {"commandId": "PER_COMPPLAN_PLATFORM_XCON021_CLOSED", "cwd": "backend", "argv": ["./gradlew", ":dwp-platform-contracts:test", "--tests", "*Xcon021CompensationSnapshotPublicationV2Test", "--no-daemon"]},
        {"commandId": "PER_COMPPLAN_FRONTEND_CLOSED", "cwd": "frontend", "argv": ["yarn", "vitest", "run", *FRONTEND_TESTS]},
    ]


def dependency_contract() -> dict[str, Any]:
    authority = "b8f1a11d1a32cf6f5a9a99ff73066b7e65787319ac18cf0d2b4891d22587c348"
    dependencies = [
        {"dependencyId": "DEP-001", "state": "READY_AT_FROZEN_BASE", "authoritySha256": authority, "resultPin": "AUTHORIZATION_V34:852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b", "payStatus": "NOT_APPLICABLE"},
        {"dependencyId": "DEP-002", "state": "READY_AT_FROZEN_BASE", "authoritySha256": authority, "resultPin": "AUTHORIZATION_V34:852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b", "payStatus": "NOT_APPLICABLE"},
        {"dependencyId": "DEP-003", "state": "READY_AT_FROZEN_BASE", "authoritySha256": authority, "resultPin": "BACKEND_G5:c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329|G6:w1-20261012t005606z-dd1c1db1", "payStatus": "NOT_APPLICABLE"},
        {"dependencyId": "DEP-016", "state": "READY_AT_FROZEN_BASE", "authoritySha256": authority, "resultPin": "BACKEND_G5:c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329|G6:w1-20261012t005606z-dd1c1db1", "payStatus": "NOT_APPLICABLE"},
        {"dependencyId": "DEP-019", "state": "PRODUCER_OBLIGATION_TO_SATISFY_BY_RESULT", "authoritySha256": authority, "resultPin": "MOD-PER-COMPPLAN_RESULT_COMMIT_ABSENT", "payStatus": "WITHHELD"},
    ]
    return {
        "dependencies": dependencies,
        "dependencyPinsSha256": sha256(canonical_bytes(dependencies)),
        "readyDependencySource": "per006PredecessorPacket#/dependencies",
        "producerObligation": "DEP-019 is not ready input; this module must satisfy it before PAY preparation",
    }


def path_policy() -> dict[str, Any]:
    def selector(repo: str, path: str) -> dict[str, str]:
        kind = "PREFIX_GLOB" if path.endswith("/**") else (
            "PATTERN_GLOB" if "*" in path else "EXACT_FILE"
        )
        return {"repo": repo, "selector": path, "kind": kind}

    policy = {
        "allowedPaths": [
            {"repo": "backend", "selector": BACKEND_ROOT, "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": BACKEND_TEST_ROOT, "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": TYPED_ARTIFACT_ROOT, "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": TYPED_ARTIFACT_TEST_ROOT, "kind": "PREFIX_GLOB"},
            *[
                {"repo": "backend", "selector": path, "kind": "EXACT_FILE"}
                for path in PROVIDER_TESTS
            ],
            {"repo": "frontend", "selector": FRONTEND_ROOT, "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": MIGRATION_PATH, "kind": "EXACT_FILE"},
        ],
        "protectedPaths": [
            {"repo": "frontend", "selector": "apps/dwp/src/shared/**", "kind": "PREFIX_GLOB"},
            {"repo": "frontend", "selector": "apps/dwp/src/generated/**", "kind": "PREFIX_GLOB"},
            {"repo": "frontend", "selector": "apps/dwp/src/routes/**", "kind": "PREFIX_GLOB"},
            {"repo": "frontend", "selector": "apps/dwp/src/features/hris/shell/**", "kind": "PREFIX_GLOB"},
            {"repo": "frontend", "selector": "apps/dwp/src/root/**", "kind": "PREFIX_GLOB"},
            {"repo": "frontend", "selector": "apps/dwp/src/features/hris/performance/common/**", "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/shared/**", "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/generated/**", "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/hr/common/**", "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/common/**", "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/resources/db/performance-migration/V1__per_create_evaluation_cycle_foundation.sql", "kind": "EXACT_FILE"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/resources/db/performance-migration/V2__per_create_population_freeze.sql", "kind": "EXACT_FILE"},
            {"repo": "backend", "selector": "dwp-people-server/src/main/resources/db/performance-migration/V3__per_harden_review_operation_capture.sql", "kind": "EXACT_FILE"},
        ],
        "commonControlOnlyPaths": [
            selector(repo, path) for repo, path in COMMON_CONTROL_SELECTORS
        ],
        "existingBridgeFilesAllocatedToModule": [
            {"repo": "backend", "selector": TYPED_ARTIFACT_ROOT, "kind": "PREFIX_GLOB"},
            {"repo": "backend", "selector": TYPED_ARTIFACT_TEST_ROOT, "kind": "PREFIX_GLOB"},
        ],
        "sharedBootstrapAllocation": {
            "controlRequestId": "G7-CR-MOD-PER-COMPPLAN-TYPED-ARTIFACT-BOOTSTRAP-R1",
            "state": "PRE_START_ALLOCATION_NOT_REGISTERED",
            "paths": [TYPED_ARTIFACT_ROOT, TYPED_ARTIFACT_TEST_ROOT],
            "table": "prf_per_artifact_versions",
            "grantRequiredBeforeStartToken": True,
        },
        "controlAllocatedSharedAbiAmendment": {
            "controlRequestId": "G7-CR-MOD-PER-COMPPLAN-WORKFORCE-SNAPSHOT-COMPENSATION-R1",
            "state": "PRE_START_ALLOCATION_NOT_REGISTERED",
            "schemaPath": WORKFORCE_SNAPSHOT_SCHEMA_PATH,
            "mainPath": WORKFORCE_SNAPSHOT_MAIN_ROOT,
            "testPath": WORKFORCE_SNAPSHOT_TEST_ROOT,
            "additiveMethod": "queryCompensationPopulation",
            "purposeCode": "HRIS_PER_COMPENSATION_POPULATION",
            "projection": "COMPENSATION_POPULATION_V1",
            "moduleMayImplement": False,
            "grantRequiredBeforeStartToken": True,
        },
        "enforcement": "DENY_ALL_OUTSIDE_ALLOWLIST",
        "outsideAllowedPathAction": "STOP_AND_RAISE_CONTROL_REQUEST",
    }
    return {**policy, "pathPolicySha256": sha256(canonical_bytes(policy))}


def packet_document(contract: dict[str, Any]) -> dict[str, Any]:
    dependency = dependency_contract()
    return sealed({
        "schemaVersion": "HRIS-G7-MOD-PER-COMPPLAN-PACKET-V1",
        "packetId": "HRIS-G7-PACKET-MOD-PER-COMPPLAN-R1-PREPARED",
        "moduleId": MODULE_ID,
        "preparedAt": PREPARED_AT,
        "state": STATE,
        "contractReseal": {
            "authorityId": contract["authorityId"],
            "path": f"{ROOT_REL.as_posix()}/contract-reseal-authority.v1.json",
            "sealedPayloadSha256": contract["sealedPayloadSha256"],
        },
        "repositoryPins": {
            "frontend": {"branch": FRONTEND_BRANCH, "upstream": FRONTEND_UPSTREAM, "commit": FRONTEND_COMMIT, "tree": FRONTEND_TREE},
            "backend": {"branch": BACKEND_BRANCH, "upstream": BACKEND_UPSTREAM, "commit": BACKEND_COMMIT, "tree": BACKEND_TREE},
            "agent": {"branch": "dwp-dev", "upstream": "origin/dwp-dev", "commit": AGENT_COMMIT, "tree": AGENT_TREE, "validationMode": "STATIC_PIN_NO_LOCAL_CHECKOUT"},
        },
        "dependencyContract": dependency,
        "implementationPaths": {
            "backendRuntime": BACKEND_ROOT,
            "backendTests": BACKEND_TEST_ROOT,
            "typedArtifactRuntime": TYPED_ARTIFACT_ROOT,
            "typedArtifactTests": TYPED_ARTIFACT_TEST_ROOT,
            "providerTestsExact": PROVIDER_TESTS,
            "frontendFeature": FRONTEND_ROOT,
            "migrationExact": MIGRATION_PATH,
        },
        "uiWorkContract": contract["uiWorkContract"],
        "pathPolicy": path_policy(),
        "migration": {
            "location": "classpath:db/performance-migration",
            "schema": "hris_performance",
            "historyTable": "flyway_performance_schema_history",
            "baselineVersion": "0",
            "outOfOrder": False,
            "currentHighWater": "V3",
            "reservedPath": MIGRATION_PATH,
            "moduleOwnedTableCount": 6,
            "sharedFoundationTableCount": 1,
            "totalNewTableCount": 7,
            "status": "RESERVED_CONTROL_ONLY",
            "admission": False,
        },
        "verification": {
            "backendTests": BACKEND_TESTS,
            "providerTestsExact": PROVIDER_TESTS,
            "platformTestsExact": [PLATFORM_TEST],
            "frontendTestsExact": FRONTEND_TESTS,
            "acceptanceInvariants": [
                "AT-001 currency rounding and append-only budget ledger totals",
                "AT-002 maker cannot approve or publish; cross-tenant and field-purpose denials",
                "AT-003 PAY receives exact immutable approved revision and digest",
                "idempotency and optimistic CAS",
                "atomic snapshot header, ordered lines, receipt, and outbox",
                "XCON-021 exact 16 fields after commit only; no v1 or dual publish",
                "SVC-PEP mTLS, audience, tenant, and purpose rejection cases",
                "line count, contiguous order, unique line id, and canonical digest",
                "worker crash and replay safety",
                "clean V1 through V4 upgrade, RLS, and append-only enforcement",
                "HARD_CAP-only enforcement rejects EXCEPTION_APPROVAL and keeps exception approval receipt NULL",
                "budget reverse hostile cases and approve zero/overflow/collision/invalid-line cases fail closed before transition",
            ],
            "namedCommands": named_commands(),
            "executionPolicy": {
                "order": "CHANGED_CLUSTER_FIRST_THEN_ONE_CLOSED_MODULE_BATCH",
                "failureHandling": "COLLECT_ALL_FAILURES_BEFORE_REPAIR",
                "broadSuitePerFixAllowed": False,
            },
        },
        "centralControlRequests": {
            "registrationState": "PREPARED_NOT_REGISTERED",
            "startTokenGate": "ALL_CONTROL_REQUESTS_REGISTERED_AND_BOTH_PRE_START_ALLOCATIONS_GRANTED_BEFORE_START_TOKEN",
            "processingRule": "ALL_REQUESTS_REGISTERED_BEFORE_START_TOKEN; TYPED_ARTIFACT_AND_WORKFORCE_COMPENSATION_PROJECTION_GRANTED_PRE_START; OTHER_FULFILLMENT_AFTER_PUSHED_MODULE_RESULT",
            "moduleMayImplement": False,
            "preparedControlRequests": [
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-AUTH-PEP-R1", "category": "AUTH-PEP", "scope": "register MOD-AUTH-025/026/027 capability, population, field, purpose, SoD, step-up, and deny-precedence bindings", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "AFTER_PUSHED_MODULE_RESULT", "grantRequiredBeforeStartToken": False, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-CONTRACT-GATEWAY-R1", "category": "CONTRACT-GATEWAY", "scope": "publish OpenAPI, AsyncAPI, XCON-020/021 wiring, generated contracts, and Gateway exposure", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "AFTER_PUSHED_MODULE_RESULT", "grantRequiredBeforeStartToken": False, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-SHELL-ROUTE-R1", "category": "SHELL-ROUTE", "scope": "register HCM route, navigation, product manifest, shell permission, and page host", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "AFTER_PUSHED_MODULE_RESULT", "grantRequiredBeforeStartToken": False, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-SVC-PEP-SECURITY-R1", "category": "SVC-PEP-SECURITY", "scope": "register SVC-PEP-PER-001 mTLS workload, JWT audience, tenant, purpose, projection, audit, replay, and negative security bindings", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "AFTER_PUSHED_MODULE_RESULT", "grantRequiredBeforeStartToken": False, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-INTEGRATION-VERIFY-R1", "category": "INTEGRATION-VERIFY", "scope": "run central contract, route, authorization, generated sync, integration, and PAY-withheld verification", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "AFTER_PUSHED_MODULE_RESULT", "grantRequiredBeforeStartToken": False, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-TYPED-ARTIFACT-BOOTSTRAP-R1", "category": "TYPED-ARTIFACT-BOOTSTRAP", "scope": "allocate the shared prf_per_artifact_versions foundation and exact typedartifact main/test roots to this first PER modern slice", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "PRE_START_ALLOCATION", "grantRequiredBeforeStartToken": True, "moduleMayImplement": False},
                {"requestId": "G7-CR-MOD-PER-COMPPLAN-WORKFORCE-SNAPSHOT-COMPENSATION-R1", "category": "WORKFORCE-SNAPSHOT-COMPENSATION-PROJECTION", "scope": "add and test the exact queryCompensationPopulation additive closed variant in the Control-owned WorkforceSnapshotQueryPort v1 schema/main/test paths without changing PERFORMANCE_V1 bootstrap behavior", "owner": "CENTRAL_CONTROL", "registrationPhase": "BEFORE_START_TOKEN", "fulfillmentPhase": "PRE_START_ALLOCATION", "grantRequiredBeforeStartToken": True, "moduleMayImplement": False},
            ],
        },
        "activationSequence": {
            "preparationCarrier": "REQUIRE_VALIDATOR_PASS_CLEAN_AND_PUSHED",
            "preWorktreeV4VacancyCheck": True,
            "frontendWorktreeBase": "PREPARATION_CARRIER_COMMIT",
            "backendWorktreeBase": BACKEND_COMMIT,
            "preActivationBundleV4VacancyRecheck": True,
            "typedArtifactBootstrapRegistrationAndGrantRequired": True,
            "workforceSnapshotCompensationProjectionRegistrationAndGrantRequired": True,
            "startTokenInitialState": "ISSUED_PENDING_PROMOTION_RECEIPT",
            "sourceEditsBeforePromotionReceiptAllowed": False,
        },
        "stopConditions": [
            "base pin, clean state, worktree branch, or upstream diverges",
            "an edit outside the allowed path set is required",
            "a common-control-only path would be edited by the module",
            "typed-artifact bootstrap allocation is not registered and granted by Control",
            "WorkforceSnapshotQueryPort compensation projection amendment is not implemented, tested, registered, and granted by Control",
            "a frontend implementation attempts direct typed-artifact endpoint access instead of module-owned projections",
            "the V4 migration path is occupied, expired, or changed",
            "a tenant, SoR, dependency, contract, lineage, or rollback invariant is ambiguous",
        ],
        "deliverables": [
            "separate frontend and backend result commits on later token-bound branches",
            "exact changed-file manifests proving path-policy compliance",
            "named targeted command results and evidence locators",
            "V4 lease used-or-unused status with clean-upgrade evidence",
            "Control request handoff after module result without direct common-path edits",
            "typed-artifact bootstrap registration/grant receipt before activation",
            "WorkforceSnapshotQueryPort compensation projection amendment test and registration/grant receipt before activation",
        ],
        "payHandoff": {
            "consumerSession": "HRIS-PAY",
            "status": "WITHHELD",
            "event": "ApprovedCompensationPlanSnapshotPublished.v2",
            "refetchContract": "SVC-PEP-PER-001",
            "requiresPushedProducerResult": True,
            "requiresControlAdmission": True,
        },
        "authorities": authorities(),
    })


def lease_document() -> dict[str, Any]:
    return sealed({
        "schemaVersion": "HRIS-G7-MOD-PER-COMPPLAN-MIGRATION-LEASE-DELTA-V1",
        "leaseDeltaId": "HRIS-G7-MIGRATION-LEASE-DELTA-MOD-PER-COMPPLAN-R1-PREP",
        "moduleId": MODULE_ID,
        "preparedAt": PREPARED_AT,
        "repository": "backend",
        "migrationRoot": "dwp-people-server/src/main/resources/db/performance-migration",
        "currentHighWater": "V3",
        "reservedVersion": "V4",
        "exactPath": MIGRATION_PATH,
        "status": "RESERVED_CONTROL_ONLY",
        "admission": False,
        "ownerStartTokenIssued": False,
        "vacancyMustBeRecheckedAtTokenIssue": True,
        "leaseExpiresAt": "2026-10-19T23:41:00+09:00",
        "historicalLineage": {
            "previousTentativePath": HISTORICAL_PATH,
            "authority": "SUPERSEDED_NON_RUNTIME_PLANNING_REFERENCE",
            "runtimePathExists": False,
        },
        "protectedPredecessors": ["V1", "V2", "V3"],
        "moduleOwnedTableCount": 6,
        "sharedFoundationTableCount": 1,
        "totalNewTableCount": 7,
        "authorities": authorities(),
    })


def state_document(contract: dict[str, Any], packet: dict[str, Any], lease: dict[str, Any]) -> dict[str, Any]:
    return sealed({
        "schemaVersion": "HRIS-G7-MOD-PER-COMPPLAN-PREPARATION-STATE-V1",
        "stateId": "HRIS-G7-STATE-MOD-PER-COMPPLAN-R1-PREPARATION",
        "moduleId": MODULE_ID,
        "preparedAt": PREPARED_AT,
        "state": STATE,
        "artifactSeals": {
            "contractReseal": contract["sealedPayloadSha256"],
            "packet": packet["sealedPayloadSha256"],
            "migrationLeaseDelta": lease["sealedPayloadSha256"],
        },
        "counts": {"operations": 12, "events": 8, "moduleOwnedTables": 6, "sharedFoundationTables": 1, "totalNewTables": 7, "namedCommands": 3},
        "controlGates": {
            "predecessorClosureVerified": True,
            "canonicalContractConflictResealed": True,
            "packetPrepared": True,
            "migrationOnlyReserved": True,
            "typedArtifactBootstrapAllocated": False,
            "workforceSnapshotCompensationProjectionAllocated": False,
            "moduleWorktreesCreated": False,
            "startIssued": False,
            "sourceChangesAllowed": False,
            "integrationAllowed": False,
            "releaseAllowed": False,
            "payAllowed": False,
        },
        "nextRequiredAuthority": "CONTROL_TYPED_ARTIFACT_AND_WORKFORCE_COMPENSATION_PROJECTION_REGISTRATION_TEST_AND_GRANT_THEN_APPEND_ONLY_START_TOKEN_AND_WORKTREE_BINDING_AFTER_CARRIER_VALIDATION_AND_V4_VACANCY_RECHECK",
        "authorities": authorities(),
    })


def build_non_manifest() -> dict[str, bytes]:
    contract = contract_document()
    packet = packet_document(contract)
    lease = lease_document()
    state = state_document(contract, packet, lease)
    return {
        "contract-reseal-authority.v1.json": pretty(contract),
        "packet.v1.json": pretty(packet),
        "migration-leases.delta.v1.json": pretty(lease),
        "state/preparation.v1.json": pretty(state),
    }


def build_bundle_bytes() -> dict[str, bytes]:
    outputs = build_non_manifest()
    pins = [
        {"path": path, "gitMode": "100644", "gitBlobSha1": git_blob_sha1(data),
         "bytes": len(data), "sha256": sha256(data)}
        for path, data in sorted(outputs.items())
    ]
    tool_pins = []
    for path in TOOL_PATHS:
        data = (HERE / path).read_bytes()
        tool_pins.append({
            "path": path, "gitMode": "100644", "gitBlobSha1": git_blob_sha1(data),
            "bytes": len(data), "sha256": sha256(data),
        })
    manifest = sealed({
        "schemaVersion": "HRIS-G7-MOD-PER-COMPPLAN-PREPARATION-MANIFEST-V1",
        "manifestId": "HRIS-G7-MANIFEST-MOD-PER-COMPPLAN-R1-PREPARATION",
        "moduleId": MODULE_ID,
        "preparedAt": PREPARED_AT,
        "state": STATE,
        "predecessor": {"commit": FRONTEND_COMMIT, "tree": FRONTEND_TREE},
        "repositoryPins": {
            "backend": {"commit": BACKEND_COMMIT, "tree": BACKEND_TREE},
            "agent": {"commit": AGENT_COMMIT, "tree": AGENT_TREE},
        },
        "artifactPins": pins,
        "toolPins": tool_pins,
        "exactCarrierInventory": sorted(TOOL_PATHS + ARTIFACT_PATHS),
        "counts": {"tools": 5, "artifacts": 5, "operations": 12, "events": 8, "moduleOwnedTables": 6, "sharedFoundationTables": 1, "totalNewTables": 7},
        "authorities": authorities(),
    })
    outputs["manifest.v1.json"] = pretty(manifest)
    return outputs


def run_git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=repo, text=True, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise RuntimeError(f"git {' '.join(args)} failed in {repo}: {result.stderr.strip()}")
    return result.stdout.strip()


def verify_repo(repo: Path, branch: str, upstream: str, commit: str, tree: str, allow_root: bool) -> None:
    if run_git(repo, "branch", "--show-current") != branch:
        raise RuntimeError(f"wrong branch: {repo}")
    if run_git(repo, "rev-parse", "HEAD") != commit:
        raise RuntimeError(f"wrong commit: {repo}")
    if run_git(repo, "rev-parse", "HEAD^{tree}") != tree:
        raise RuntimeError(f"wrong tree: {repo}")
    if run_git(repo, "rev-parse", "@{upstream}") != run_git(repo, "rev-parse", upstream):
        raise RuntimeError(f"wrong upstream: {repo}")
    if run_git(repo, "rev-list", "--left-right", "--count", f"HEAD...{upstream}") != "0\t0":
        raise RuntimeError(f"repository is not exactly pushed: {repo}")
    status = run_git(repo, "status", "--porcelain=v1", "--untracked-files=all")
    if not status:
        return
    if not allow_root:
        raise RuntimeError(f"repository is dirty: {repo}")
    prefix = f"?? {ROOT_REL.as_posix()}/"
    bad = [line for line in status.splitlines() if not line.startswith(prefix)]
    if bad:
        raise RuntimeError(f"frontend has changes outside preparation root: {bad}")


def verify_source_pins() -> None:
    closure_bytes, _ = committed_file(FRONTEND, FRONTEND_COMMIT, CLOSURE_PATH)
    if sha256(closure_bytes) != CLOSURE_SHA256:
        raise RuntimeError("predecessor closure receipt hash drift")
    closure_value = json.loads(closure_bytes)
    if closure_value.get("receiptId") != CLOSURE_RECEIPT_ID:
        raise RuntimeError("predecessor closure receipt identity drift")
    if closure_value.get("sealedPayloadSha256") != CLOSURE_SEAL:
        raise RuntimeError("predecessor closure receipt seal drift")
    for source_id, (path, expected) in SOURCE_PINS.items():
        data, _ = committed_file(FRONTEND, FRONTEND_COMMIT, path)
        if sha256(data) != expected:
            raise RuntimeError(f"frontend canonical source drift: {path}")
        for selector, selector_digest in SOURCE_SELECTOR_SHA256.get(source_id, []):
            if sha256(canonical_bytes(selector_value(data, selector))) != selector_digest:
                raise RuntimeError(f"frontend selector drift: {source_id}:{selector}")
    for path, expected in BACKEND_SOURCE_PINS.values():
        data, _ = committed_file(BACKEND, BACKEND_COMMIT, path)
        if sha256(data) != expected:
            raise RuntimeError(f"backend canonical source drift: {path}")
    migration_root = "dwp-people-server/src/main/resources/db/performance-migration"
    actual = run_git(BACKEND, "ls-tree", "-r", "--name-only", BACKEND_COMMIT, "--", migration_root).splitlines()
    expected = [
        f"{migration_root}/README.md",
        f"{migration_root}/V1__per_create_evaluation_cycle_foundation.sql",
        f"{migration_root}/V2__per_create_population_freeze.sql",
        f"{migration_root}/V3__per_harden_review_operation_capture.sql",
    ]
    if actual != expected or MIGRATION_PATH in actual:
        raise RuntimeError(f"performance migration high-water/vacancy drift: {actual}")


def write_append_only(outputs: dict[str, bytes]) -> None:
    for relative, data in outputs.items():
        target = HERE / relative
        if target.exists():
            if target.read_bytes() != data:
                raise RuntimeError(f"append-only artifact drift: {relative}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def check_outputs(outputs: dict[str, bytes]) -> None:
    missing, drift = [], []
    for relative, expected in outputs.items():
        target = HERE / relative
        if not target.exists():
            missing.append(relative)
        elif target.read_bytes() != expected:
            drift.append(relative)
    if missing or drift:
        raise RuntimeError(f"bundle mismatch missing={missing} drift={drift}")
    actual = sorted(
        path.relative_to(HERE).as_posix()
        for path in HERE.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    )
    expected = sorted(TOOL_PATHS + ARTIFACT_PATHS)
    if actual != expected:
        raise RuntimeError(f"bundle inventory drift expected={expected} actual={actual}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "check"])
    args = parser.parse_args()
    verify_repo(FRONTEND, FRONTEND_BRANCH, FRONTEND_UPSTREAM, FRONTEND_COMMIT, FRONTEND_TREE, True)
    verify_repo(BACKEND, BACKEND_BRANCH, BACKEND_UPSTREAM, BACKEND_COMMIT, BACKEND_TREE, False)
    verify_source_pins()
    outputs = build_bundle_bytes()
    if args.phase == "prepare":
        write_append_only(outputs)
    check_outputs(outputs)
    print(f"PASS {MODULE_ID} {STATE}: {len(outputs)} deterministic preparation artifacts")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
