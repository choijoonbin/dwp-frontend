#!/usr/bin/env python3
"""Fail-closed verifier for the modern-causal final G3 endorsement.

This verifier intentionally makes no external identity or PKI claim.  It proves
only internal workflow integrity: current-input pins, two-engine semantic
equivalence, a non-circular evidence/report digest DAG, and a distinct declared
reviewer role.  External identity attestation is a separate G6 concern.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from typing import Any, Callable

from modern_causal_successor_profile import (
    LEGACY_PROFILE,
    SUCCESSOR_PROFILE,
    SuccessorProfileError,
    create_only_bytes,
    hostile_self_test as successor_profile_hostile_self_test,
    pending_successor_inputs,
    profile_metadata,
    require_profile,
    stage_prerequisites,
    successor_paths,
    verify_predecessor_pins,
)


BASE = Path(__file__).resolve().parent
BLUEPRINT_ROOT = BASE.parent
G0 = BLUEPRINT_ROOT / "g0"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))

from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)

REPORTS_DIR = "reports"
EVIDENCE_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-pg-evidence.v2.json"
REPORT_RELATIVE_PATH = (
    f"{REPORTS_DIR}/modern-causal-independent-final-hostile-review.v1.json"
)
LEGACY_EVIDENCE_RELATIVE_PATH = (
    f"{REPORTS_DIR}/modern-causal-independent-pg-evidence.v1.json"
)
DESIGN_REPORT_RELATIVE_PATH = (
    f"{REPORTS_DIR}/modern-causal-independent-design-findings.v1.json"
)

ORACLE_NAME = "modern-causal-independent-oracle.v1.json"
FIXTURE_NAME = "modern-causal-independent-pg-fixtures.v1.json"
RUNNER_NAME = "run_modern_causal_independent_pg_fixtures.py"
BUILDER_NAME = "build_modern_causal_independent_oracle.py"
INDEPENDENT_VALIDATOR_NAME = "validate_modern_causal_independent_oracle.py"
VERIFIER_NAME = Path(__file__).name
REVIEW_INVENTORY_NAME = "modern-causal-independent-review-inventory.v1.json"
REVIEW_FINALIZATION_NAME = "modern-causal-independent-reviewed-finalization.v1.json"
SOURCE_AUTHORITY_MANIFEST_NAME = "modern-causal-final-source-authority-manifest.v1.json"
CONTROL_INTAKE_RELATIVE_PATH = (
    "control-evidence-intake/modern-causal-final-endorsement.v1.json"
)
CONTROL_INTAKE_RECORDED_PATH = f"g0/{CONTROL_INTAKE_RELATIVE_PATH}"

CANDIDATE_FILES = {
    "causal": "modern-capability-causal-state-contracts.v2.json",
    "exact": "modern-capability-exact-schema-contracts.v1.json",
    "events": "modern-capability-event-payload-contracts.v1.json",
    "lineage": "modern-capability-event-successor-lineage.v2.json",
    "ownership": "g3-contract-primary-ownership-register.csv",
}
CANDIDATES_WITH_SEMANTIC_SEALS = {"causal", "lineage"}

EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v2"
REPORT_ID = "dwp.hris.modern.causal-independent-final-hostile-review.v1"
EVIDENCE_TECHNICAL_STATUS = "PASS"
GATE_POLICY = "INTERNAL_REVIEW_WORKFLOW_AND_CONTROL_INTAKE_REQUIRED"
REVIEW_SCOPE = "G3_INTERNAL_WORKFLOW_INTEGRITY"
NO_EXTERNAL_IDENTITY = "EXTERNAL_IDENTITY_ATTESTATION_NOT_CLAIMED"
ATTESTATION_MODE = "INTERNAL_CANONICAL_DIGEST"
ALLOWED_REVIEWER_ROLES = frozenset({"INDEPENDENT_HOSTILE_REVIEWER"})
PROJECTION_ID = "dwp.hris.modern-causal.pg-semantic-result.v1"
SOURCE_AUTHORITY_ID = "dwp.hris.modern-causal-final-source-authority.v1"
CONTROL_INTAKE_ID = "dwp.hris.modern-causal-final-control-intake.v1"
MAX_FRESHNESS = dt.timedelta(hours=24)
MAX_FUTURE_SKEW = dt.timedelta(minutes=5)

SOURCE_AUTHORITY_FILES = {
    "operationSsot": ("modern-capability-operation-causal-contract-ssot.v2.json", False),
    "exact": ("modern-capability-exact-schema-contracts.v1.json", False),
    "events": ("modern-capability-event-payload-contracts.v1.json", False),
    "semanticBindings": ("modern-capability-semantic-bindings.v1.json", True),
    "publicIdentity": ("modern-capability-public-identity-registry.v1.json", True),
    "listeningSuccessorAuthority": ("sys-listening-stream-authority-successor.v1.json", True),
    "reviewInventory": (REVIEW_INVENTORY_NAME, True),
    "reviewFinalization": (REVIEW_FINALIZATION_NAME, True),
}
CAUSAL_PIN_SOURCE_LABELS = {
    "exact": "modern-capability-exact-schema-contracts.v1.json",
    "events": "modern-capability-event-payload-contracts.v1.json",
    "semanticBindings": "modern-capability-semantic-bindings.v1.json",
    "publicIdentity": "modern-capability-public-identity-registry.v1.json",
    "listeningSuccessorAuthority": "sys-listening-stream-authority-successor.v1.json",
}

ACTIVE_PROFILE = LEGACY_PROFILE
ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, BLUEPRINT_ROOT)
EVIDENCE_SCHEMA_VERSION = 2
REPORT_SCHEMA_VERSION = 1
SOURCE_AUTHORITY_SCHEMA_VERSION = 1
CONTROL_INTAKE_SCHEMA_VERSION = 1


def configure_profile(name: str) -> dict[str, Any]:
    """Select the active endorsement chain without aliasing predecessor files."""
    global ACTIVE_PROFILE, ACTIVE_PROFILE_METADATA
    global EVIDENCE_RELATIVE_PATH, REPORT_RELATIVE_PATH, LEGACY_EVIDENCE_RELATIVE_PATH
    global UNSIGNED_EVIDENCE_RELATIVE_PATH
    global DESIGN_REPORT_RELATIVE_PATH, ORACLE_NAME, FIXTURE_NAME
    global REVIEW_INVENTORY_NAME, REVIEW_FINALIZATION_NAME
    global SOURCE_AUTHORITY_MANIFEST_NAME, CONTROL_INTAKE_RELATIVE_PATH
    global CONTROL_INTAKE_RECORDED_PATH, EVIDENCE_ID, REPORT_ID
    global SOURCE_AUTHORITY_ID, CONTROL_INTAKE_ID, SOURCE_AUTHORITY_FILES
    global CAUSAL_PIN_SOURCE_LABELS, EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION
    global SOURCE_AUTHORITY_SCHEMA_VERSION, CONTROL_INTAKE_SCHEMA_VERSION
    global TRUSTED_TOOL_ROOT_SPEC, TRUSTED_TOOL_ROOT_DIGEST
    name = require_profile(name)
    ACTIVE_PROFILE = name
    if name == SUCCESSOR_PROFILE:
        paths = successor_paths(BASE, BLUEPRINT_ROOT)
        EVIDENCE_RELATIVE_PATH = str(paths["pgEvidence"].relative_to(BASE))
        UNSIGNED_EVIDENCE_RELATIVE_PATH = SUCCESSOR_UNSIGNED_EVIDENCE
        REPORT_RELATIVE_PATH = str(paths["finalReview"].relative_to(BASE))
        LEGACY_EVIDENCE_RELATIVE_PATH = "reports/modern-causal-independent-pg-evidence.v2.json"
        DESIGN_REPORT_RELATIVE_PATH = str(paths["designFindings"].relative_to(BASE))
        ORACLE_NAME = paths["oracle"].name
        FIXTURE_NAME = paths["fixture"].name
        REVIEW_INVENTORY_NAME = paths["reviewInventory"].name
        REVIEW_FINALIZATION_NAME = paths["reviewFinalization"].name
        SOURCE_AUTHORITY_MANIFEST_NAME = paths["sourceAuthority"].name
        CONTROL_INTAKE_RELATIVE_PATH = str(paths["controlIntake"].relative_to(BLUEPRINT_ROOT / "g0"))
        CONTROL_INTAKE_RECORDED_PATH = f"g0/{CONTROL_INTAKE_RELATIVE_PATH}"
        EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v3"
        REPORT_ID = "dwp.hris.modern.causal-independent-final-hostile-review.v2"
        SOURCE_AUTHORITY_ID = "dwp.hris.modern-causal-final-source-authority.v2"
        CONTROL_INTAKE_ID = "dwp.hris.modern-causal-final-control-intake.v2"
        EVIDENCE_SCHEMA_VERSION = 3
        REPORT_SCHEMA_VERSION = 2
        SOURCE_AUTHORITY_SCHEMA_VERSION = 2
        CONTROL_INTAKE_SCHEMA_VERSION = 2
        TRUSTED_TOOL_ROOT_SPEC = copy.deepcopy(SUCCESSOR_TRUSTED_TOOL_ROOT_SPEC)
        TRUSTED_TOOL_ROOT_DIGEST = SUCCESSOR_TRUSTED_TOOL_ROOT_DIGEST
        CAUSAL_PIN_SOURCE_LABELS = {
            "exact": "modern-capability-exact-schema-contracts.v1.json",
            "events": "modern-capability-event-payload-contracts.v1.json",
            "semanticBindings": "modern-capability-semantic-bindings.v1.json",
            "publicIdentity": "modern-capability-public-identity-registry.v1.json",
            "listeningSuccessorAuthority": "sys-listening-stream-authority-successor.v2.json",
        }
        SOURCE_AUTHORITY_FILES = {
            "operationSsot": ("modern-capability-operation-causal-contract-ssot.v2.json", False),
            "exact": ("modern-capability-exact-schema-contracts.v1.json", False),
            "events": ("modern-capability-event-payload-contracts.v1.json", False),
            "semanticBindings": ("modern-capability-semantic-bindings.v1.json", True),
            "publicIdentity": ("modern-capability-public-identity-registry.v1.json", True),
            "listeningSuccessorAuthority": ("sys-listening-stream-authority-successor.v2.json", True),
            "reviewInventory": (REVIEW_INVENTORY_NAME, True),
            "reviewFinalization": (REVIEW_FINALIZATION_NAME, True),
        }
    else:
        EVIDENCE_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-pg-evidence.v2.json"
        UNSIGNED_EVIDENCE_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-pg-evidence.v2.unsigned.json"
        REPORT_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-final-hostile-review.v1.json"
        LEGACY_EVIDENCE_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-pg-evidence.v1.json"
        DESIGN_REPORT_RELATIVE_PATH = f"{REPORTS_DIR}/modern-causal-independent-design-findings.v1.json"
        ORACLE_NAME = "modern-causal-independent-oracle.v1.json"
        FIXTURE_NAME = "modern-causal-independent-pg-fixtures.v1.json"
        REVIEW_INVENTORY_NAME = "modern-causal-independent-review-inventory.v1.json"
        REVIEW_FINALIZATION_NAME = "modern-causal-independent-reviewed-finalization.v1.json"
        SOURCE_AUTHORITY_MANIFEST_NAME = "modern-causal-final-source-authority-manifest.v1.json"
        CONTROL_INTAKE_RELATIVE_PATH = "control-evidence-intake/modern-causal-final-endorsement.v1.json"
        CONTROL_INTAKE_RECORDED_PATH = f"g0/{CONTROL_INTAKE_RELATIVE_PATH}"
        EVIDENCE_ID = "dwp.hris.modern.causal-independent-pg-evidence.v2"
        REPORT_ID = "dwp.hris.modern.causal-independent-final-hostile-review.v1"
        SOURCE_AUTHORITY_ID = "dwp.hris.modern-causal-final-source-authority.v1"
        CONTROL_INTAKE_ID = "dwp.hris.modern-causal-final-control-intake.v1"
        EVIDENCE_SCHEMA_VERSION = 2
        REPORT_SCHEMA_VERSION = 1
        SOURCE_AUTHORITY_SCHEMA_VERSION = 1
        CONTROL_INTAKE_SCHEMA_VERSION = 1
        TRUSTED_TOOL_ROOT_SPEC = copy.deepcopy(LEGACY_TRUSTED_TOOL_ROOT_SPEC)
        TRUSTED_TOOL_ROOT_DIGEST = LEGACY_TRUSTED_TOOL_ROOT_DIGEST
        CAUSAL_PIN_SOURCE_LABELS = {
            "exact": "modern-capability-exact-schema-contracts.v1.json",
            "events": "modern-capability-event-payload-contracts.v1.json",
            "semanticBindings": "modern-capability-semantic-bindings.v1.json",
            "publicIdentity": "modern-capability-public-identity-registry.v1.json",
            "listeningSuccessorAuthority": "sys-listening-stream-authority-successor.v1.json",
        }
        SOURCE_AUTHORITY_FILES = {
            "operationSsot": ("modern-capability-operation-causal-contract-ssot.v2.json", False),
            "exact": ("modern-capability-exact-schema-contracts.v1.json", False),
            "events": ("modern-capability-event-payload-contracts.v1.json", False),
            "semanticBindings": ("modern-capability-semantic-bindings.v1.json", True),
            "publicIdentity": ("modern-capability-public-identity-registry.v1.json", True),
            "listeningSuccessorAuthority": ("sys-listening-stream-authority-successor.v1.json", True),
            "reviewInventory": (REVIEW_INVENTORY_NAME, True),
            "reviewFinalization": (REVIEW_FINALIZATION_NAME, True),
        }
    ACTIVE_PROFILE_METADATA = profile_metadata(ACTIVE_PROFILE, BASE, BLUEPRINT_ROOT)
    return ACTIVE_PROFILE_METADATA


def successor_preflight() -> dict[str, Any]:
    paths = successor_paths(BASE, BLUEPRINT_ROOT)
    stages = successor_stage_state(BASE, BLUEPRINT_ROOT)
    accepted_live = importlib.import_module("modern_causal_successor_profile").accepted_live_preflight(
        BASE, BLUEPRINT_ROOT
    )
    return {
        "profile": ACTIVE_PROFILE,
        "activeGateChain": ACTIVE_PROFILE_METADATA["activeGateChain"],
        "canonicalCounts": ACTIVE_PROFILE_METADATA["canonicalCounts"],
        "policy": ACTIVE_PROFILE_METADATA["policy"],
        "successorArtifacts": {
            key: str(value.relative_to(BLUEPRINT_ROOT)) for key, value in paths.items()
        },
        "missingSuccessorInputs": pending_successor_inputs(BASE, BLUEPRINT_ROOT, stage="review-input"),
        "stageState": stages,
        "acceptedLivePreflight": accepted_live,
        "predecessorPinFailures": verify_predecessor_pins(BLUEPRINT_ROOT),
        "predecessorDisposition": ACTIVE_PROFILE_METADATA.get("predecessorDisposition"),
    }


def successor_staged_workflow_self_test() -> list[str]:
    """Run every successor stage against an isolated, create-only fake root.

    The real successor roots deliberately remain pending in this workspace, so
    this harness supplies only opaque accepted-live input placeholders and then
    executes the stage state machine in its declared order.  It is intentionally
    an orchestration test rather than a source generator: every write still
    uses the production no-replace primitive, an early/future stage is rejected
    before it can create a target, and the terminal endorsement stage is a
    read-only completion marker.  No path below ``BASE`` or ``BLUEPRINT_ROOT``
    is touched.
    """
    failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="modern-causal-successor-staged-e2e-") as temporary:
        fake_root = Path(temporary)
        fake_base = fake_root / "coding-readiness"
        fake_base.mkdir(mode=0o700)
        os.chmod(fake_base, 0o700)

        state = successor_stage_state(fake_base, fake_root)
        stages = state.get("stages", [])
        if not state.get("acyclic"):
            failures.append("staged-workflow-graph-not-acyclic")
        if [row.get("stage") for row in stages] != list(
            successor_stage_state(fake_base, fake_root).get("stageOrder", [])
        ):
            failures.append("staged-workflow-stage-order-not-declared")
        if any(
            row.get("selfDependency") or row.get("downstreamOutputDependency")
            for row in stages
        ):
            failures.append("staged-workflow-self-or-future-dependency")

        # Accepted-live manifest and independent acceptance are external inputs;
        # the output stages may consume them but may never manufacture them.
        if not stages:
            return failures + ["staged-workflow-stage-list-empty"]
        for key in stages[0].get("prerequisites", []):
            path = Path(stages[0]["paths"][key])
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(path.parent, 0o700)
            path.write_bytes(f"external:{key}\n".encode("utf-8"))
            os.chmod(path, 0o600)

        def execute_stage(stage: str) -> None:
            row = stage_prerequisites(stage, fake_base, fake_root)
            if row["missing"]:
                raise SuccessorProfileError(
                    f"{stage} missing prerequisites: {row['missing']}"
                )
            if row["targetFailures"]:
                raise SuccessorProfileError(
                    f"{stage} occupied targets: {row['targetFailures']}"
                )
            for key in row["outputs"]:
                target = Path(row["paths"][key])
                raw = json.dumps(
                    {
                        "stage": stage,
                        "output": key,
                        "profile": SUCCESSOR_PROFILE,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8") + b"\n"
                create_only_bytes(target, raw)
                if target.read_bytes() != raw:
                    raise SuccessorProfileError(
                        f"{stage}/{key} bytes changed after create-only commit"
                    )
                try:
                    create_only_bytes(target, b"hostile-replacement\n")
                except (FileExistsError, SuccessorProfileError):
                    pass
                else:
                    raise SuccessorProfileError(
                        f"{stage}/{key} occupied target accepted a replacement"
                    )
                if target.read_bytes() != raw:
                    raise SuccessorProfileError(
                        f"{stage}/{key} hostile replacement mutated bytes"
                    )

        # A downstream producer cannot bypass its missing upstream review
        # inputs.  This is the specific regression that the old global
        # preflight never exercised.
        try:
            execute_stage("oracle")
        except (SuccessorProfileError, FileExistsError):
            pass
        else:
            failures.append("staged-workflow-future-stage-ran-before-input")
        oracle_path = Path(
            next(row for row in stages if row["stage"] == "oracle")["paths"]["oracle"]
        )
        if oracle_path.exists():
            failures.append("staged-workflow-early-oracle-target-created")

        for row in stages:
            stage = row["stage"]
            if stage == "final-review":
                # ``designFindings`` is an independently produced review
                # input, not a final-review output.  Seed that external
                # acceptance only after the PG staging stage has completed;
                # the stage graph therefore remains explicit about its
                # authority without inventing a producer in this verifier.
                design_target = Path(row["paths"]["designFindings"])
                design_target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                os.chmod(design_target.parent, 0o700)
                design_target.write_bytes(b"external-design-review:PASS\n")
                os.chmod(design_target, 0o600)
            try:
                execute_stage(stage)
            except (OSError, SuccessorProfileError, KeyError, TypeError) as exc:
                failures.append(f"staged-workflow-{stage}:{type(exc).__name__}:{exc}")

        final_state = successor_stage_state(fake_base, fake_root)
        if any(row.get("missing") for row in final_state.get("stages", [])):
            failures.append("staged-workflow-final-prerequisites-missing")
        stage_paths = next(
            row for row in final_state["stages"] if row["stage"] == "final-review"
        )["paths"]
        if stage_paths["pgUnsigned"] == stage_paths["finalEvidence"]:
            failures.append("staged-workflow-unsigned-final-path-collision")

        # Endorsement has no publication output: it consumes the complete
        # chain.  Keep its marker outside the successor artifact namespace.
        marker = fake_root / ".successor-staged-e2e" / "endorsement.complete"
        try:
            create_only_bytes(marker, b"ENDORSEMENT_STAGE_COMPLETE\n")
        except (OSError, SuccessorProfileError) as exc:
            failures.append(f"staged-workflow-endorsement:{type(exc).__name__}:{exc}")
        if not marker.is_file() or marker.read_bytes() != b"ENDORSEMENT_STAGE_COMPLETE\n":
            failures.append("staged-workflow-endorsement-marker-missing")
    return failures


def successor_endorsement_self_test() -> list[str]:
    """Hostile successor publication/routing tests; no artifact is published."""
    failures = list(successor_profile_hostile_self_test(BASE, BLUEPRINT_ROOT))
    # Exercise the successor global owner-dependency receipt in memory.  This
    # never creates a real successor artifact and keeps Listening/PAY pin
    # mutations fail-closed before any endorsement workflow is available.
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
    failures.extend(successor_staged_workflow_self_test())
    preflight = successor_preflight()
    if not preflight.get("stageState", {}).get("acyclic"):
        failures.append("successor-stage-graph-is-cyclic")
    if preflight["predecessorPinFailures"]:
        failures.append(
            "predecessor-pin-drift:" + ",".join(preflight["predecessorPinFailures"])
        )
    if not preflight["missingSuccessorInputs"]:
        failures.append("successor-inputs-are-unexpectedly-published")
    expected_counts = {
        "publicOperations": 199, "commands": 133, "queries": 66,
        "systemHandlers": 27, "publicEvents": 157, "tableSpecifications": 131,
        "ownerPortOperationContracts": 18, "ownerDependencyContracts": 2,
    }
    if preflight["canonicalCounts"] != expected_counts:
        failures.append("source-derived-count-profile-drift")
    if ACTIVE_PROFILE_METADATA.get("activeGateChain") == "historical-v1":
        failures.append("successor-profile-uses-historical-gate-chain")
    return failures

HASH_RE = re.compile(r"^[0-9a-f]{64}$")
PRINCIPAL_RE = re.compile(r"^(?:principal|reviewer):[a-z0-9][a-z0-9._-]{1,63}$")

EVIDENCE_KEYS = {
    "evidenceId", "schemaVersion", "technicalStatus", "gatePolicy", "generatedAt",
    "producerPrincipalIds", "oracleSha256", "oracleFileSha256", "fixtureSha256",
    "fixtureFileSha256", "builderFileSha256", "runnerFileSha256",
    "verifierFileSha256", "independentValidatorFileSha256",
    "trustedToolRoot", "sourceAuthority", "controlIntake", "expectedProjection",
    "candidateHashes", "runs", "executionComparison", "hostSemaphore",
    "secondReviewer", "sealedPayloadSha256",
}
EXECUTION_COMPARISON_KEYS = {
    "projectionId", "pg16PayloadSha256", "pg18PayloadSha256",
    "comparableExecutionPayloadSha256",
}
HOST_SEMAPHORE_KEYS = {"name", "protected", "acquisition"}
SECOND_REVIEWER_KEYS = {
    "signed", "attestationMode", "externalIdentityAttestation", "reviewerId",
    "reviewerRole", "reportId", "reportPath", "reportSealedPayloadSha256",
    "reportFileSha256", "evidenceCoreSealSha256", "findingCounts", "reviewedAt",
}
FINDING_COUNT_KEYS = {"P0", "P1"}

REPORT_KEYS = {
    "reportId", "schemaVersion", "status", "scope", "externalIdentityAttestation",
    "reviewer", "subject", "findings", "assertions", "reviewedAt",
    "sealedPayloadSha256",
}
REPORT_REVIEWER_KEYS = {
    "reviewerId", "reviewerRole", "independenceAssertion",
    "producerPrincipalIdsReviewed",
}
REPORT_SUBJECT_KEYS = {
    "evidenceId", "evidenceCoreSealSha256", "oracleSha256", "oracleFileSha256",
    "fixtureSha256", "fixtureFileSha256", "builderFileSha256", "runnerFileSha256",
    "verifierFileSha256", "independentValidatorFileSha256", "sourceAuthority",
    "controlIntake", "trustedToolRoot", "expectedProjection",
    "candidateHashes", "pgComparableExecutionPayloadSha256", "pgRunPayloadSha256",
}
PG_RUN_HASH_KEYS = {"16", "18"}
REPORT_FINDINGS_KEYS = {"counts", "P0", "P1"}
REPORT_ASSERTIONS = [
    "CURRENT_INPUT_HASHES_EXACT",
    "VERIFIER_EMBEDDED_TRUSTED_TOOL_ROOT_ENFORCED",
    "DIRECT_SOURCE_AUTHORITY_CURRENT",
    "CONTROL_INTAKE_PINNED",
    "PG16_PG18_SEMANTIC_PAYLOAD_EQUAL",
    "PG_EXECUTION_PROVENANCE_COMPLETE",
    "PRODUCTION_CONTROL_RECEIPTS_REQUIRED",
    "NO_BLOCKING_FINDINGS",
    "REVIEWER_DISTINCT_FROM_PRODUCERS",
    NO_EXTERNAL_IDENTITY,
]

# Successor evidence is deliberately split into a runner-owned unsigned
# staging file and a finalizer-owned finalized file.  These names are kept as
# independent constants so a future writer cannot accidentally turn a
# create-only operation into an in-place replacement.
SUCCESSOR_REPORT_ASSERTIONS = [
    *REPORT_ASSERTIONS,
    "SUCCESSOR_ACCEPTED_LIVE_CANONICAL_INDEPENDENTLY_ACCEPTED",
    "SUCCESSOR_UNSIGNED_AND_FINAL_EVIDENCE_PATHS_DISTINCT_CREATE_ONLY",
    "SUCCESSOR_SOURCE_DERIVED_COUNTS_AND_DERIVED_SCENARIOS",
]
SUCCESSOR_EVIDENCE_KEYS = {
    "evidenceId", "schemaVersion", "technicalStatus", "gatePolicy", "generatedAt",
    "evidenceState", "unsignedStagingPath", "finalEvidencePath", "createOnlyTransition",
    "producerPrincipalIds", "oracleSha256", "oracleFileSha256", "fixtureSha256",
    "fixtureFileSha256", "builderFileSha256", "runnerFileSha256",
    "verifierFileSha256", "independentValidatorFileSha256", "trustedToolRoot",
    "sourceAuthority", "controlIntake", "expectedProjection", "acceptedLiveSourceHashes",
    "runs", "executionComparison", "hostSemaphore", "secondReviewer",
    "sealedPayloadSha256",
}
SUCCESSOR_REPORT_SUBJECT_KEYS = {
    "evidenceId", "evidenceCoreSealSha256", "oracleSha256", "oracleFileSha256",
    "fixtureSha256", "fixtureFileSha256", "builderFileSha256", "runnerFileSha256",
    "verifierFileSha256", "independentValidatorFileSha256", "sourceAuthority",
    "controlIntake", "trustedToolRoot", "expectedProjection",
    "acceptedLiveSourceHashes", "pgComparableExecutionPayloadSha256", "pgRunPayloadSha256",
}
SUCCESSOR_RUN_KEYS = {
    "profile", "postgresMajor", "serverVersion", "serverVersionNum", "image", "schemaHash",
    "operationResults199", "queryResults66", "edgeResultsDerived", "handlerResults27",
    "rollbackFaultResults", "handlerRollbackFaultResults", "receiptOutboxReplayResults",
    "tenantPurposeStaleConflictResults", "decisionReceiptResults", "conditionalEventResults",
    "criticalLifecycleResults", "forbiddenEdgeResults", "scenarioCounts", "schemaProjection",
    "ownerDependencyReceipt", "executionReceipt", "failures",
}
SUCCESSOR_INDEPENDENT_ORACLE_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-successor-oracle-check.v2"
)
SUCCESSOR_INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-evidence-check.v3"
)
SUCCESSOR_RUNNER_CHECK_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-pg-runner-check.v3"
)

RUN_KEYS = {
    "postgresMajor", "serverVersion", "serverVersionNum", "image", "schemaHash",
    "operationResults81", "queryResults19", "edgeResults58", "handlerResults4",
    "rollbackFaultResults", "handlerRollbackFaultResults",
    "receiptOutboxReplayResults", "tenantPurposeStaleConflictResults",
    "decisionReceiptResults", "conditionalEventResults", "criticalLifecycleResults",
    "forbiddenEdgeResults", "scenarioCounts", "schemaProjection",
    "executionReceipt", "failures",
}
COMPARABLE_RUN_KEYS = (
    "schemaHash", "operationResults81", "queryResults19", "edgeResults58",
    "handlerResults4", "rollbackFaultResults", "handlerRollbackFaultResults",
    "receiptOutboxReplayResults", "tenantPurposeStaleConflictResults",
    "decisionReceiptResults", "conditionalEventResults", "criticalLifecycleResults",
    "forbiddenEdgeResults", "scenarioCounts", "schemaProjection", "failures",
)
SCENARIO_COUNT_KEYS = {
    "schemaHash", "rollbackFaultCount", "handlerRollbackFaultCount", "commandCount",
    "queryCount", "queryCaseCount", "decisionReceiptCount", "edgeCount",
    "handlerCount", "markers",
}

ARTIFACT_REFERENCE_KEYS = {"path", "fileSha256", "sealedPayloadSha256"}
EXPECTED_PROJECTION_KEYS = {"authoritative", "reviewInventory"}
AUTHORITATIVE_PROJECTION_KEYS = {
    "commandIdsSha256", "queryIdsSha256", "edgeIdsSha256", "handlerIdsSha256",
    "decisionIdsSha256", "schemaProjectionSha256",
}
REVIEW_PROJECTION_KEYS = {
    "commandIdsSha256", "queryIdsSha256", "handlerIdsSha256", "decisionIdsSha256",
}
SOURCE_AUTHORITY_MANIFEST_KEYS = {
    "manifestId", "schemaVersion", "status", "scope", "generatedAt", "sources",
    "causalCanonicalSourcePins", "trustedToolRoot", "expectedProjection",
    "sealedPayloadSha256",
}
SOURCE_AUTHORITY_SOURCE_KEYS = {"path", "fileSha256", "sealedPayloadSha256"}
SOURCE_AUTHORITY_SOURCE_KEYS_WITHOUT_SEAL = {"path", "fileSha256"}
CONTROL_INTAKE_KEYS = {
    "intakeId", "schemaVersion", "status", "gatePolicy", "controlRole", "scope",
    "externalIdentityAttestation", "acceptedAt", "sourceAuthorityManifest",
    "trustedToolRoot", "toolPins", "sealedPayloadSha256",
}
CONTROL_TOOL_LABELS = {"builder", "independentValidator", "runner", "finalVerifier"}
CONTROL_TOOL_PIN_KEYS = {"path", "fileSha256"}
SCHEMA_PROJECTION_KEYS = {
    "closure", "expectedTableCount", "observedTables", "oracleProjectionSha256",
    "observedProjectionSha256",
}
EXECUTION_RECEIPT_KEYS = {
    "imageId", "repoDigest", "containerId", "argv", "argvSha256", "stdoutSha256",
    "stderrSha256", "exitCode", "startedAt", "endedAt",
}
IMAGE_ID_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
REPO_DIGEST_RE = re.compile(r"^postgres@sha256:[0-9a-f]{64}$")
CONTAINER_ID_RE = re.compile(r"^[0-9a-f]{64}$")
INDEPENDENT_ORACLE_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-oracle-check.v1"
)
INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-evidence-check.v2"
)
RUNNER_CHECK_RECEIPT_SCHEMA = (
    "dwp.hris.modern.causal-independent-pg-runner-check.v2"
)

# This is the only structure that is repinned when reviewer-owned tools are
# frozen.  It is deliberately embedded in verifier code, outside the writable
# evidence/control/report digest graph.  The current pins are provisional; a
# production Gate must fail until status is changed to TOOLS_FROZEN after the
# reviewer publishes final tool bytes.  This protects the internal workflow
# threat model where evidence producers cannot modify this verifier.  It does
# not claim OS immutability, external identity, PKI, or protection from a fully
# privileged local actor who can also replace the verifier itself.
TRUSTED_TOOL_ROOT_SPEC: dict[str, Any] = {
    "rootId": "dwp.hris.modern-causal.trusted-tool-root.v1",
    "schemaVersion": 1,
    "status": "TRUST_ANCHOR_STRUCTURE_READY_WAITING_TOOL_FREEZE",
    "threatModel": "VERIFIER_CODE_OUTSIDE_REVIEWER_WRITABLE_BUNDLE",
    "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
    "tools": {
        "builder": {
            "path": BUILDER_NAME,
            "fileSha256": "32c0b005609d95b8e2e2895ed2afbd01d4716140b5b3c045f4158e0892af1162",
            "invocations": {
                "check": {
                    "argvSuffix": ["--check"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_ORACLE_CHECK=PASS operations=100 edges=58 failures=0",
                    },
                },
                "selfTest": {
                    "argvSuffix": ["--self-test"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_ORACLE_SELF_TEST=PASS tests=3 failures=0",
                    },
                },
            },
        },
        "independentValidator": {
            "path": INDEPENDENT_VALIDATOR_NAME,
            "fileSha256": "3e2456479fe8b421cd734847afa3f39a6a3c6db38462ba9910a45c7b5d1342f9",
            "invocations": {
                "oracleOnly": {
                    "argvSuffix": ["--oracle-only", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": INDEPENDENT_ORACLE_RECEIPT_SCHEMA,
                        "mode": "ORACLE_ONLY",
                        "exactKeys": ["byCode", "errors", "mode", "schema", "status"],
                    },
                },
                "verifyDesignReport": {
                    "argvSuffix": ["--verify-design-report", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": "dwp.hris.modern.causal-independent-design-report-check.v1",
                        "exactKeys": [
                            "candidateHashes", "errors", "reportSha256", "schema", "status",
                        ],
                    },
                },
                "currentV2Evidence": {
                    "argvSuffix": ["--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA,
                        "mode": "CURRENT_V2_EVIDENCE",
                        "exactKeys": [
                            "byCode", "errors", "evidenceFileSha256", "evidenceId",
                            "evidencePath", "mode", "schema", "status",
                        ],
                    },
                },
            },
        },
        "runner": {
            "path": RUNNER_NAME,
            "fileSha256": "31bc6090d79bbb7095ab3d17189672825642daa5dde2305ee22bceb94a337fc6",
            "invocations": {
                "selfTest": {
                    "argvSuffix": ["--self-test"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_PG_RUNNER_SELF_TEST=PASS tests=8 failures=0",
                    },
                },
                "checkCurrentV2Evidence": {
                    "argvSuffix": ["--check", "--host-lock-held-by-parent", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": RUNNER_CHECK_RECEIPT_SCHEMA,
                        "mode": "CHECK_CURRENT_V2_EVIDENCE",
                        "exactKeys": [
                            "bytesUnchanged", "comparableExecutionPayloadSha256", "counts",
                            "engines", "errors", "evidenceFileSha256", "evidenceId",
                            "evidencePath", "hostSemaphore", "mode", "schema", "status",
                        ],
                    },
                },
            },
        },
    },
}
TRUSTED_TOOL_ROOT_DIGEST = hashlib.sha256(json.dumps(
    TRUSTED_TOOL_ROOT_SPEC,
    ensure_ascii=False,
    sort_keys=True,
    separators=(",", ":"),
    allow_nan=False,
).encode("utf-8")).hexdigest()
LEGACY_TRUSTED_TOOL_ROOT_SPEC = copy.deepcopy(TRUSTED_TOOL_ROOT_SPEC)
LEGACY_TRUSTED_TOOL_ROOT_DIGEST = TRUSTED_TOOL_ROOT_DIGEST

# The successor chain has an independent trust root and receipt vocabulary.
# It is not a mutable alias of the historical root: source hashes are repinned
# only when this verifier's reviewer-owned bytes are frozen, and the successor
# invocation markers intentionally carry the 199/281 source-derived closure.
SUCCESSOR_TRUSTED_TOOL_ROOT_SPEC: dict[str, Any] = {
    "rootId": "dwp.hris.modern-causal.trusted-tool-root.v2",
    "schemaVersion": 2,
    "status": "TOOLS_FROZEN_SUCCESSOR",
    "threatModel": "VERIFIER_CODE_OUTSIDE_REVIEWER_WRITABLE_BUNDLE",
    "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
    "tools": {
        "builder": {
            "path": BUILDER_NAME,
            "fileSha256": "24ae179d472fbb56a7d014831ec505d1ecd6cdd2957cd5ee111bedb5ec73859e",
            "invocations": {
                "check": {
                    "argvSuffix": ["--check"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_ORACLE_CHECK=PASS operations=199 edges=281 failures=0",
                    },
                },
                "selfTest": {
                    "argvSuffix": ["--self-test"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_ORACLE_SUCCESSOR_SELF_TEST=PASS tests=6 failures=0",
                    },
                },
            },
        },
        "independentValidator": {
            "path": INDEPENDENT_VALIDATOR_NAME,
            "fileSha256": "5c4de0b85f00838045e86513af9a3d23c8c473eebe3003815caafbfbe4614bee",
            "invocations": {
                "oracleOnly": {
                    "argvSuffix": ["--oracle-only", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": SUCCESSOR_INDEPENDENT_ORACLE_RECEIPT_SCHEMA,
                        "mode": "SUCCESSOR_V2_ORACLE",
                        "exactKeys": [
                            "byCode", "canonicalCounts", "errors", "mode", "profile",
                            "schema", "status",
                        ],
                    },
                },
                "verifyDesignReport": {
                    "argvSuffix": ["--verify-design-report", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": "dwp.hris.modern.causal-independent-design-report-check.v2",
                        "exactKeys": [
                            "acceptedLiveSourceHashes", "errors", "reportSha256", "schema", "status",
                        ],
                    },
                },
                "currentV3Evidence": {
                    "argvSuffix": ["--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": SUCCESSOR_INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA,
                        "mode": "CURRENT_V3_EVIDENCE",
                        "exactKeys": [
                            "byCode", "errors", "evidenceFileSha256", "evidenceId",
                            "evidencePath", "mode", "schema", "status",
                        ],
                    },
                },
            },
        },
        "runner": {
            "path": RUNNER_NAME,
            "fileSha256": "9624198ff995aab47a0b54d14c449020f0c6a6f392d7148d62a622c1be09a1b3",
            "invocations": {
                "selfTest": {
                    "argvSuffix": ["--self-test"],
                    "receipt": {
                        "kind": "EXACT_MARKER",
                        "value": "MODERN_CAUSAL_PG_RUNNER_SUCCESSOR_SELF_TEST=PASS tests=6 failures=0",
                    },
                },
                "checkCurrentV3Evidence": {
                    "argvSuffix": ["--check", "--compact"],
                    "receipt": {
                        "kind": "CANONICAL_JSON",
                        "schema": SUCCESSOR_RUNNER_CHECK_RECEIPT_SCHEMA,
                        "mode": "CHECK_CURRENT_V3_EVIDENCE",
                        "exactKeys": [
                            "bytesUnchanged", "comparableExecutionPayloadSha256", "counts",
                            "engines", "errors", "evidenceFileSha256", "evidenceId",
                            "evidencePath", "hostSemaphore", "mode", "schema", "status",
                        ],
                    },
                },
            },
        },
    },
}
SUCCESSOR_TRUSTED_TOOL_ROOT_DIGEST = hashlib.sha256(json.dumps(
    SUCCESSOR_TRUSTED_TOOL_ROOT_SPEC,
    ensure_ascii=False,
    sort_keys=True,
    separators=(",", ":"),
    allow_nan=False,
).encode("utf-8")).hexdigest()
TRUSTED_TOOL_ROOT_REFERENCE_KEYS = {"rootId", "rootDigest"}


class StrictJsonError(ValueError):
    """Raised when an input is not strict JSON."""


class Findings:
    def __init__(self) -> None:
        self.rows: list[dict[str, str]] = []
        self.receipts: list[dict[str, Any]] = []

    def add(self, code: str, subject: str, detail: str) -> None:
        if len(self.rows) < 250:
            self.rows.append({"code": code, "subject": subject, "detail": detail})

    def extend(self, rows: list[dict[str, str]]) -> None:
        for row in rows:
            self.add(row["code"], row["subject"], row["detail"])

    def require(self, condition: bool, code: str, subject: str, detail: str) -> bool:
        if not condition:
            self.add(code, subject, detail)
            return False
        return True


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_bytes(document: dict[str, Any], excluded: set[str] | frozenset[str]) -> bytes:
    value = copy.deepcopy(document)
    for key in excluded:
        value.pop(key, None)
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_hash(document: dict[str, Any], excluded: set[str] | frozenset[str]) -> str:
    return sha256_bytes(canonical_bytes(document, excluded))


def canonical_value_hash(value: Any) -> str:
    return sha256_bytes(json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8"))


def semantic_seal(document: dict[str, Any]) -> str:
    return canonical_hash(document, {"sealedPayloadSha256"})


def evidence_core_seal(document: dict[str, Any]) -> str:
    return canonical_hash(document, {"sealedPayloadSha256", "secondReviewer"})


def report_seal(document: dict[str, Any]) -> str:
    return canonical_hash(document, {"sealedPayloadSha256"})


def _reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise StrictJsonError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _reject_constant(value: str) -> Any:
    raise StrictJsonError(f"non-finite JSON number: {value}")


def _reject_float(value: str) -> Any:
    raise StrictJsonError(f"floating-point/exponent JSON number is forbidden: {value}")


def strict_json_bytes(raw: bytes, subject: str) -> dict[str, Any]:
    if raw.startswith(b"\xef\xbb\xbf"):
        raise StrictJsonError(f"{subject}: UTF-8 BOM is forbidden")
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise StrictJsonError(f"{subject}: invalid UTF-8: {exc}") from exc
    try:
        value = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_pairs,
            parse_constant=_reject_constant,
            parse_float=_reject_float,
        )
    except (json.JSONDecodeError, StrictJsonError) as exc:
        raise StrictJsonError(f"{subject}: {exc}") from exc
    if not isinstance(value, dict):
        raise StrictJsonError(f"{subject}: JSON root must be an object")
    return value


def strict_json_file(path: Path) -> dict[str, Any]:
    return strict_json_bytes(path.read_bytes(), path.name)


def canonical_file_bytes(document: dict[str, Any]) -> bytes:
    return canonical_bytes(document, set()) + b"\n"


def require_canonical_json_file(
    path: Path, document: dict[str, Any], subject: str, findings: Findings
) -> None:
    try:
        actual = path.read_bytes()
        expected = canonical_file_bytes(document)
    except (OSError, TypeError, ValueError) as exc:
        findings.add("P0-CANONICAL-FILE", subject, str(exc))
        return
    findings.require(actual == expected, "P0-CANONICAL-FILE", subject,
                     "file bytes are not canonical compact JSON plus one LF")


def exact_keys(value: Any, expected: set[str], subject: str, findings: Findings) -> bool:
    if not isinstance(value, dict):
        findings.add("P0-SHAPE-TYPE", subject, "expected object")
        return False
    actual = set(value)
    if actual != expected:
        findings.add(
            "P0-SHAPE-KEYS",
            subject,
            f"missing={sorted(expected - actual)} extra={sorted(actual - expected)}",
        )
        return False
    return True


def is_sha256(value: Any) -> bool:
    return isinstance(value, str) and HASH_RE.fullmatch(value) is not None


def valid_utc_timestamp(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None and parsed.utcoffset() == dt.timedelta(0)


def parse_utc_timestamp(value: Any) -> dt.datetime | None:
    if not valid_utc_timestamp(value):
        return None
    assert isinstance(value, str)
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)


def exact_int(value: Any, expected: int | None = None) -> bool:
    if not isinstance(value, int) or isinstance(value, bool):
        return False
    return expected is None or value == expected


def check_timestamp_freshness(
    value: Any,
    now: dt.datetime,
    subject: str,
    findings: Findings,
) -> dt.datetime | None:
    parsed = parse_utc_timestamp(value)
    if parsed is None:
        findings.add("P0-TIMESTAMP-SHAPE", subject, str(value))
        return None
    if parsed > now + MAX_FUTURE_SKEW:
        findings.add("P0-TIMESTAMP-FUTURE", subject, f"timestamp={parsed.isoformat()} now={now.isoformat()}")
    if now - parsed > MAX_FRESHNESS:
        findings.add("P0-TIMESTAMP-STALE", subject, f"timestamp={parsed.isoformat()} now={now.isoformat()}")
    return parsed


def check_safe_regular_file(
    root: Path,
    relative_name: str,
    findings: Findings,
    code: str,
) -> Path | None:
    if not isinstance(relative_name, str) or not relative_name:
        findings.add(code, str(relative_name), "path must be a non-empty relative string")
        return None
    relative = Path(relative_name)
    if relative.is_absolute() or ".." in relative.parts or "." in relative.parts:
        findings.add(code, relative_name, "absolute/dot/traversal path is forbidden")
        return None
    path = root.joinpath(*relative.parts)
    cursor = root
    try:
        for part in relative.parts:
            cursor = cursor / part
            component_stat = cursor.lstat()
            mode = component_stat.st_mode
            if stat.S_ISLNK(mode):
                findings.add(code, relative_name, f"symlink component forbidden: {part}")
                return None
        target_stat = path.lstat()
        if not stat.S_ISREG(target_stat.st_mode):
            findings.add(code, relative_name, "target is not a regular file")
            return None
        if target_stat.st_nlink != 1:
            findings.add(code, relative_name, f"link count must be 1, got {target_stat.st_nlink}")
            return None
        if stat.S_IMODE(target_stat.st_mode) & 0o022:
            findings.add(code, relative_name,
                         f"group/world writable mode forbidden: {oct(stat.S_IMODE(target_stat.st_mode))}")
            return None
    except FileNotFoundError:
        findings.add(code, relative_name, "required file is missing")
        return None
    except OSError as exc:
        findings.add(code, relative_name, str(exc))
        return None
    return path


def check_hash(value: Any, subject: str, findings: Findings) -> None:
    findings.require(is_sha256(value), "P0-HASH-SHAPE", subject, str(value))


def trusted_tool_root_reference() -> dict[str, str]:
    return {
        "rootId": TRUSTED_TOOL_ROOT_SPEC["rootId"],
        "rootDigest": TRUSTED_TOOL_ROOT_DIGEST,
    }


def validate_trusted_tool_root_reference(
    value: Any,
    subject: str,
    findings: Findings,
) -> bool:
    if not exact_keys(value, TRUSTED_TOOL_ROOT_REFERENCE_KEYS, subject, findings):
        return False
    expected = trusted_tool_root_reference()
    findings.require(value == expected, "P0-TRUSTED-TOOL-ROOT-REFERENCE", subject,
                     f"expected={expected} actual={value}")
    return value == expected


def validate_internal_trusted_tool_root(
    root: Path,
    findings: Findings,
    *,
    require_frozen: bool,
) -> None:
    """Validate tool bytes against the verifier-embedded, non-writable root."""
    successor_root = ACTIVE_PROFILE == SUCCESSOR_PROFILE
    expected_root_id = (
        "dwp.hris.modern-causal.trusted-tool-root.v2"
        if successor_root else "dwp.hris.modern-causal.trusted-tool-root.v1"
    )
    expected_schema_version = 2 if successor_root else 1
    expected_statuses = (
        {"TOOLS_FROZEN_SUCCESSOR"} if successor_root
        else {"TRUST_ANCHOR_STRUCTURE_READY_WAITING_TOOL_FREEZE", "TOOLS_FROZEN"}
    )
    findings.require(
        canonical_value_hash(TRUSTED_TOOL_ROOT_SPEC) == TRUSTED_TOOL_ROOT_DIGEST,
        "P0-TRUSTED-TOOL-ROOT-RUNTIME-MUTATION",
        "trustedToolRoot",
        "embedded structure changed after module initialization",
    )
    findings.require(
        TRUSTED_TOOL_ROOT_SPEC.get("rootId")
        == expected_root_id,
        "P0-TRUSTED-TOOL-ROOT-ID", "trustedToolRoot",
        str(TRUSTED_TOOL_ROOT_SPEC.get("rootId")),
    )
    findings.require(exact_int(TRUSTED_TOOL_ROOT_SPEC.get("schemaVersion"), expected_schema_version),
                     "P0-TRUSTED-TOOL-ROOT-VERSION", "trustedToolRoot",
                     str(TRUSTED_TOOL_ROOT_SPEC.get("schemaVersion")))
    findings.require(
        TRUSTED_TOOL_ROOT_SPEC.get("threatModel")
        == "VERIFIER_CODE_OUTSIDE_REVIEWER_WRITABLE_BUNDLE",
        "P0-TRUSTED-TOOL-ROOT-THREAT-MODEL", "trustedToolRoot",
        str(TRUSTED_TOOL_ROOT_SPEC.get("threatModel")),
    )
    findings.require(
        TRUSTED_TOOL_ROOT_SPEC.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
        "P0-TRUSTED-TOOL-ROOT-IDENTITY-SCOPE", "trustedToolRoot",
        str(TRUSTED_TOOL_ROOT_SPEC.get("externalIdentityAttestation")),
    )
    status_value = TRUSTED_TOOL_ROOT_SPEC.get("status")
    findings.require(
        status_value in expected_statuses,
        "P0-TRUSTED-TOOL-ROOT-STATUS", "trustedToolRoot", str(status_value),
    )
    if require_frozen:
        findings.require(status_value in expected_statuses and (
            status_value == "TOOLS_FROZEN" if not successor_root
            else status_value == "TOOLS_FROZEN_SUCCESSOR"
        ),
                         "P0-TRUSTED-TOOL-ROOT-NOT-FROZEN", "trustedToolRoot",
                         str(status_value))

    tools = TRUSTED_TOOL_ROOT_SPEC.get("tools")
    expected_invocations = (
        {
            "builder": {"check", "selfTest"},
            "independentValidator": {
                "oracleOnly", "verifyDesignReport", "currentV3Evidence"
            },
            "runner": {"selfTest", "checkCurrentV3Evidence"},
        }
        if successor_root else {
            "builder": {"check", "selfTest"},
            "independentValidator": {
                "oracleOnly", "verifyDesignReport", "currentV2Evidence"
            },
            "runner": {"selfTest", "checkCurrentV2Evidence"},
        }
    )
    if not exact_keys(tools, set(expected_invocations), "trustedToolRoot.tools", findings):
        return
    assert isinstance(tools, dict)
    expected_paths = {
        "builder": BUILDER_NAME,
        "independentValidator": INDEPENDENT_VALIDATOR_NAME,
        "runner": RUNNER_NAME,
    }
    for label, expected_path in expected_paths.items():
        row = tools.get(label)
        if not exact_keys(row, {"path", "fileSha256", "invocations"},
                          f"trustedToolRoot.tools.{label}", findings):
            continue
        assert isinstance(row, dict)
        findings.require(row.get("path") == expected_path, "P0-TRUSTED-TOOL-PATH",
                         label, str(row.get("path")))
        check_hash(row.get("fileSha256"), f"trustedToolRoot.tools.{label}.fileSha256",
                   findings)
        invocations = row.get("invocations")
        findings.require(
            isinstance(invocations, dict)
            and set(invocations) == expected_invocations[label],
            "P0-TRUSTED-TOOL-INVOCATIONS", label, str(invocations),
        )
        tool_path = check_safe_regular_file(root, expected_path, findings,
                                            "P0-TRUSTED-TOOL-FILE")
        if tool_path is None:
            continue
        current = file_hash(tool_path)
        findings.require(row.get("fileSha256") == current,
                         "P0-TRUSTED-TOOL-HASH", label,
                         f"trusted={row.get('fileSha256')} current={current}")


def validate_candidate_hashes(value: Any, subject: str, findings: Findings) -> bool:
    if not exact_keys(value, set(CANDIDATE_FILES), subject, findings):
        return False
    valid = True
    assert isinstance(value, dict)
    for label, expected_path in CANDIDATE_FILES.items():
        row = value.get(label)
        expected_keys = {"path", "fileSha256"}
        if label in CANDIDATES_WITH_SEMANTIC_SEALS:
            expected_keys.add("sealedPayloadSha256")
        if not exact_keys(row, expected_keys, f"{subject}.{label}", findings):
            valid = False
            continue
        assert isinstance(row, dict)
        if row.get("path") != expected_path:
            findings.add(
                "P0-CANDIDATE-PATH",
                label,
                f"expected={expected_path} actual={row.get('path')}",
            )
            valid = False
        check_hash(row.get("fileSha256"), f"{subject}.{label}.fileSha256", findings)
        if label in CANDIDATES_WITH_SEMANTIC_SEALS:
            check_hash(
                row.get("sealedPayloadSha256"),
                f"{subject}.{label}.sealedPayloadSha256",
                findings,
            )
    return valid


def validate_row_list(
    rows: Any,
    expected_count: int,
    row_keys: set[str],
    id_key: str,
    subject: str,
    findings: Findings,
) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        findings.add("P0-PG-ROW-LIST", subject, "expected array")
        return []
    if len(rows) != expected_count:
        findings.add("P0-PG-ROW-COUNT", subject, f"expected={expected_count} actual={len(rows)}")
    valid_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        if exact_keys(row, row_keys, f"{subject}[{index}]", findings):
            valid_rows.append(row)
    identifiers = [row.get(id_key) for row in valid_rows]
    if any(not isinstance(item, str) or not item for item in identifiers):
        findings.add("P0-PG-ROW-ID", subject, "IDs must be non-empty strings")
    elif identifiers != sorted(identifiers) or len(identifiers) != len(set(identifiers)):
        findings.add("P0-PG-ROW-ORDER", subject, "IDs must be unique and sorted")
    return valid_rows


def _successor_recorded_source_path(path: Path) -> str:
    """Return the only path spelling accepted in successor evidence pins."""
    try:
        return path.relative_to(BASE).as_posix()
    except ValueError as exc:
        raise SuccessorProfileError(
            f"accepted-live source escapes coding-readiness root: {path}"
        ) from exc


def validate_accepted_live_source_hashes(
    value: Any,
    subject: str,
    root: Path,
    findings: Findings,
) -> bool:
    """Validate source pins against the accepted-live manifest, never candidates."""
    expected_keys = set(SUCCESSOR_LIVE_SOURCE_FILES)
    if not exact_keys(value, expected_keys, subject, findings):
        return False
    try:
        accepted = verify_accepted_live_canonical(root, root.parent)
    except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
        findings.add("P0-ACCEPTED-LIVE-SOURCE", subject, f"{type(exc).__name__}:{exc}")
        return False
    valid = True
    assert isinstance(value, dict)
    for key, source in accepted["sources"].items():
        row = value.get(key)
        if not exact_keys(row, {"path", "fileSha256"}, f"{subject}.{key}", findings):
            valid = False
            continue
        assert isinstance(row, dict)
        try:
            expected_path = _successor_recorded_source_path(source)
        except SuccessorProfileError as exc:
            findings.add("P0-ACCEPTED-LIVE-SOURCE-PATH", key, str(exc))
            valid = False
            continue
        actual_hash = file_hash(source)
        if row.get("path") != expected_path:
            findings.add(
                "P0-ACCEPTED-LIVE-SOURCE-PATH", key,
                f"expected={expected_path} actual={row.get('path')}",
            )
            valid = False
        if row.get("fileSha256") != actual_hash:
            findings.add(
                "P0-ACCEPTED-LIVE-SOURCE-HASH", key,
                f"expected={actual_hash} actual={row.get('fileSha256')}",
            )
            valid = False
        check_hash(row.get("fileSha256"), f"{subject}.{key}.fileSha256", findings)
    return valid


def _validate_successor_execution_receipt(
    receipt: Any,
    subject: str,
    findings: Findings,
    now: dt.datetime | None,
) -> None:
    if not exact_keys(receipt, EXECUTION_RECEIPT_KEYS, f"{subject}.executionReceipt", findings):
        return
    assert isinstance(receipt, dict)
    findings.require(
        isinstance(receipt.get("imageId"), str)
        and IMAGE_ID_RE.fullmatch(receipt["imageId"]) is not None,
        "P0-PG-IMAGE-ID", subject, str(receipt.get("imageId")),
    )
    findings.require(
        isinstance(receipt.get("repoDigest"), str)
        and REPO_DIGEST_RE.fullmatch(receipt["repoDigest"]) is not None,
        "P0-PG-REPO-DIGEST", subject, str(receipt.get("repoDigest")),
    )
    findings.require(
        isinstance(receipt.get("containerId"), str)
        and CONTAINER_ID_RE.fullmatch(receipt["containerId"]) is not None,
        "P0-PG-CONTAINER-ID", subject, str(receipt.get("containerId")),
    )
    argv = receipt.get("argv")
    findings.require(
        isinstance(argv, list) and bool(argv)
        and all(isinstance(item, str) and bool(item) for item in argv),
        "P0-PG-ARGV", subject, str(argv),
    )
    check_hash(receipt.get("argvSha256"), f"{subject}.executionReceipt.argvSha256", findings)
    if isinstance(argv, list):
        findings.require(
            receipt.get("argvSha256") == canonical_value_hash(argv),
            "P0-PG-ARGV-HASH", subject, "argv digest differs",
        )
    check_hash(receipt.get("stdoutSha256"), f"{subject}.executionReceipt.stdoutSha256", findings)
    check_hash(receipt.get("stderrSha256"), f"{subject}.executionReceipt.stderrSha256", findings)
    findings.require(exact_int(receipt.get("exitCode"), 0), "P0-PG-EXIT", subject,
                     str(receipt.get("exitCode")))
    check_now = now or dt.datetime.now(dt.timezone.utc)
    started = check_timestamp_freshness(receipt.get("startedAt"), check_now,
                                        f"{subject}.startedAt", findings)
    ended = check_timestamp_freshness(receipt.get("endedAt"), check_now,
                                      f"{subject}.endedAt", findings)
    if started is not None and ended is not None:
        findings.require(started <= ended, "P0-PG-TIME-ORDER", subject,
                         f"started={started.isoformat()} ended={ended.isoformat()}")


def validate_successor_pg_run(
    run: Any,
    expected_major: int,
    findings: Findings,
    expected_sets: dict[str, Any] | None,
    expected_tables: list[str] | None,
    now: dt.datetime | None,
) -> bool:
    """Validate source-derived v3 PG evidence without legacy cardinalities."""
    subject = f"PG{expected_major}"
    if not exact_keys(run, SUCCESSOR_RUN_KEYS, subject, findings):
        return False
    assert isinstance(run, dict)
    findings.require(run.get("profile") == SUCCESSOR_PROFILE, "P0-PG-PROFILE", subject,
                     str(run.get("profile")))
    try:
        verify_successor_owner_dependency_receipt(
            run.get("ownerDependencyReceipt"),
            label=f"{subject}.ownerDependencyReceipt",
        )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-PG-OWNER-DEPENDENCY",
            f"{subject}.ownerDependencyReceipt",
            str(exc),
        )
    findings.require(run.get("postgresMajor") == expected_major, "P0-PG-MAJOR", subject,
                     str(run.get("postgresMajor")))
    version_num = run.get("serverVersionNum")
    findings.require(
        isinstance(version_num, int) and not isinstance(version_num, bool)
        and version_num // 10000 == expected_major,
        "P0-PG-VERSION", subject, str(version_num),
    )
    findings.require(
        isinstance(run.get("serverVersion"), str) and bool(run.get("serverVersion")),
        "P0-PG-VERSION-TEXT", subject, str(run.get("serverVersion")),
    )
    expected_image = {16: "postgres:16", 18: "postgres:18.4"}[expected_major]
    findings.require(run.get("image") == expected_image, "P0-PG-IMAGE", subject,
                     f"expected={expected_image} actual={run.get('image')}")
    check_hash(run.get("schemaHash"), f"{subject}.schemaHash", findings)

    command_ids = expected_sets.get("commands", []) if expected_sets else []
    query_ids = expected_sets.get("queries", []) if expected_sets else []
    edge_ids = expected_sets.get("edges", []) if expected_sets else []
    handler_ids = expected_sets.get("handlers", []) if expected_sets else []
    decision_ids = expected_sets.get("decisions", []) if expected_sets else []
    operations = validate_row_list(
        run.get("operationResults199"), len(command_ids), {"operationId", "status"},
        "operationId", f"{subject}.operationResults199", findings,
    )
    findings.require(
        [row.get("operationId") for row in operations] == command_ids
        and all(row.get("status") == "PASS" for row in operations),
        "P0-PG-OPERATION-CLOSURE", subject, "command IDs/status differ",
    )
    query_rows = validate_row_list(
        run.get("queryResults66"), len(query_ids),
        {"operationId", "status", "databaseDiff", "cases"}, "operationId",
        f"{subject}.queryResults66", findings,
    )
    query_cases = sorted([
        "minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
        "wrong-purpose", "cursor-scope-mismatch",
    ])
    findings.require(
        [row.get("operationId") for row in query_rows] == query_ids
        and all(row.get("status") == "PASS" and row.get("databaseDiff") == "EMPTY"
                and row.get("cases") == query_cases for row in query_rows),
        "P0-PG-QUERY-CLOSURE", subject, "query IDs/cases/status differ",
    )
    edge_rows = validate_row_list(
        run.get("edgeResultsDerived"), len(edge_ids), {"edgeId", "status"}, "edgeId",
        f"{subject}.edgeResultsDerived", findings,
    )
    findings.require(
        [row.get("edgeId") for row in edge_rows] == edge_ids
        and all(row.get("status") == "PASS" for row in edge_rows),
        "P0-PG-EDGE-CLOSURE", subject, "derived edge IDs/status differ",
    )
    handler_rows = validate_row_list(
        run.get("handlerResults27"), len(handler_ids),
        {"handlerId", "status", "identicalReplay", "differentDigestConflict", "rollback"},
        "handlerId", f"{subject}.handlerResults27", findings,
    )
    findings.require(
        [row.get("handlerId") for row in handler_rows] == handler_ids
        and all(all(row.get(key) == "PASS" for key in
                    ("status", "identicalReplay", "differentDigestConflict", "rollback"))
                for row in handler_rows),
        "P0-PG-HANDLER-CLOSURE", subject, "handler IDs/status differ",
    )
    replay = validate_row_list(
        run.get("receiptOutboxReplayResults"), len(command_ids),
        {"operationId", "identicalReplay", "differentDigestConflict",
         "duplicateDomainRows", "duplicateOutboxRows"}, "operationId",
        f"{subject}.receiptOutboxReplayResults", findings,
    )
    negatives = validate_row_list(
        run.get("tenantPurposeStaleConflictResults"), len(command_ids),
        {"operationId", "foreignTenant", "wrongPurpose", "staleCas", "ownerProofUnavailable"},
        "operationId", f"{subject}.tenantPurposeStaleConflictResults", findings,
    )
    findings.require([row.get("operationId") for row in replay] == command_ids,
                     "P0-PG-REPLAY-CLOSURE", subject, "command IDs differ")
    findings.require([row.get("operationId") for row in negatives] == command_ids,
                     "P0-PG-NEGATIVE-CLOSURE", subject, "command IDs differ")
    for row in replay:
        findings.require(
            row.get("identicalReplay") == "PASS"
            and row.get("differentDigestConflict") == "PASS"
            and exact_int(row.get("duplicateDomainRows"), 0)
            and exact_int(row.get("duplicateOutboxRows"), 0),
            "P0-PG-REPLAY", subject, str(row),
        )
    for row in negatives:
        findings.require(all(row.get(key) == "PASS" for key in
                             ("foreignTenant", "wrongPurpose", "staleCas", "ownerProofUnavailable")),
                         "P0-PG-NEGATIVE", subject, str(row))
    decisions = validate_row_list(
        run.get("decisionReceiptResults"), len(decision_ids),
        {"operationId", "status", "sameTransaction", "fields"}, "operationId",
        f"{subject}.decisionReceiptResults", findings,
    )
    findings.require(
        [row.get("operationId") for row in decisions] == decision_ids
        and all(row.get("status") == "PASS" and row.get("sameTransaction") is True
                and sorted(row.get("fields", [])) ==
                ["decisionVersion", "inputDigestOrRef", "outcome", "ruleId"]
                for row in decisions),
        "P0-PG-DECISION-CLOSURE", subject, "decision receipt closure differs",
    )
    rollback = run.get("rollbackFaultResults")
    handler_rollback = run.get("handlerRollbackFaultResults")
    scenario = run.get("scenarioCounts")
    expected_scenario_keys = {
        "publicOperations", "commands", "queries", "queryCases", "edges", "handlers",
        "decisionReceipts", "commandRollbackFaults", "handlerRollbackFaults", "markerCount",
    }
    if exact_keys(scenario, expected_scenario_keys, f"{subject}.scenarioCounts", findings):
        assert isinstance(scenario, dict)
        derived_counts = (
            expected_sets.get("_successorDerivedScenarioCounts")
            if isinstance(expected_sets, dict) else None
        )
        if not isinstance(derived_counts, dict):
            findings.add(
                "P0-PG-SCENARIO-AUTHORITY",
                subject,
                "source-derived scenario counts are missing from the independent fixture projection",
            )
            derived_counts = {}
        expected_scenario = {
            "publicOperations": derived_counts.get("publicOperations", -1),
            "commands": derived_counts.get("commands", -1),
            "queries": derived_counts.get("queries", -1),
            "queryCases": derived_counts.get("queryCases", -1),
            "edges": derived_counts.get("edges", -1),
            "handlers": derived_counts.get("handlers", -1),
            "decisionReceipts": derived_counts.get("decisionReceipts", -1),
            "commandRollbackFaults": derived_counts.get("commandRollbackFaults", -1),
            "handlerRollbackFaults": derived_counts.get("handlerRollbackFaults", -1),
            "markerCount": derived_counts.get("markerCount", -1),
        }
        for key in (
            "publicOperations", "commands", "queries", "queryCases", "edges",
            "handlers", "decisionReceipts", "commandRollbackFaults",
            "handlerRollbackFaults", "markerCount",
        ):
            findings.require(exact_int(scenario.get(key), expected_scenario[key]),
                             "P0-PG-SCENARIO-COUNT", f"{subject}.{key}", str(scenario.get(key)))
        findings.require(exact_int(scenario.get("commandRollbackFaults"))
                         and exact_int(scenario.get("handlerRollbackFaults"))
                         and exact_int(scenario.get("markerCount")),
                         "P0-PG-SCENARIO-DERIVED", subject, str(scenario))
    if exact_keys(rollback, {"faultPoints", "status", "receiptDomainOutboxAtomic"},
                  f"{subject}.rollbackFaultResults", findings):
        findings.require(
            exact_int(rollback.get("faultPoints"), scenario.get("commandRollbackFaults") if isinstance(scenario, dict) else -1)
            and rollback.get("status") == "PASS"
            and rollback.get("receiptDomainOutboxAtomic") is True,
            "P0-PG-ROLLBACK", subject, str(rollback),
        )
    if exact_keys(handler_rollback, {"faultPoints", "status", "inboxDomainOutboxAtomic"},
                  f"{subject}.handlerRollbackFaultResults", findings):
        findings.require(
            exact_int(handler_rollback.get("faultPoints"), scenario.get("handlerRollbackFaults") if isinstance(scenario, dict) else -1)
            and handler_rollback.get("status") == "PASS"
            and handler_rollback.get("inboxDomainOutboxAtomic") is True,
            "P0-PG-HANDLER-ROLLBACK", subject, str(handler_rollback),
        )
    conditional = run.get("conditionalEventResults")
    findings.require(isinstance(conditional, dict) and conditional.get("status") == "PASS"
                     and conditional.get("sourceDerived") is True,
                     "P0-PG-CONDITIONAL", subject, str(conditional))
    critical = run.get("criticalLifecycleResults")
    findings.require(isinstance(critical, dict) and critical.get("status") == "PASS"
                     and critical.get("payProducer") == "SSOT_ONLY",
                     "P0-PG-CRITICAL", subject, str(critical))
    forbidden = run.get("forbiddenEdgeResults")
    derived_counts = (
        expected_sets.get("_successorDerivedScenarioCounts")
        if isinstance(expected_sets, dict) else None
    )
    expected_forbidden = (
        derived_counts.get("forbiddenEdges", -1)
        if isinstance(derived_counts, dict) else -1
    )
    if exact_keys(forbidden, {"expected", "passed", "rowCountZero", "outboxAbsent",
                              "preexistingRowsUnchanged"}, f"{subject}.forbiddenEdgeResults", findings):
        findings.require(
            exact_int(forbidden.get("expected"), expected_forbidden)
            and exact_int(forbidden.get("passed"), expected_forbidden)
            and forbidden.get("rowCountZero") is True
            and forbidden.get("outboxAbsent") is True
            and forbidden.get("preexistingRowsUnchanged") is True,
            "P0-PG-FORBIDDEN", subject, str(forbidden),
        )
    if expected_tables is not None:
        schema_projection = run.get("schemaProjection")
        if exact_keys(schema_projection, SCHEMA_PROJECTION_KEYS,
                      f"{subject}.schemaProjection", findings):
            assert isinstance(schema_projection, dict)
            expected_object = {
                "closure": "EXACT_ACCEPTED_LIVE_TABLE_SPECIFICATION_SET",
                "expectedTableCount": len(expected_tables),
                "expectedTables": expected_tables,
            }
            findings.require(schema_projection.get("closure") == expected_object["closure"],
                             "P0-PG-SCHEMA-PROJECTION-CLOSURE", subject,
                             str(schema_projection.get("closure")))
            findings.require(schema_projection.get("expectedTableCount") == len(expected_tables),
                             "P0-PG-SCHEMA-PROJECTION-COUNT", subject,
                             str(schema_projection.get("expectedTableCount")))
            observed = schema_projection.get("observedTables")
            findings.require(observed == expected_tables,
                             "P0-PG-SCHEMA-EXACT-EQUALITY", subject, "observed tables differ")
            findings.require(schema_projection.get("oracleProjectionSha256")
                             == canonical_value_hash(expected_object),
                             "P0-PG-SCHEMA-ORACLE-HASH", subject, "oracle projection differs")
            findings.require(schema_projection.get("observedProjectionSha256")
                             == canonical_value_hash(expected_object),
                             "P0-PG-SCHEMA-OBSERVED-HASH", subject, "observed projection differs")
    _validate_successor_execution_receipt(run.get("executionReceipt"), subject, findings, now)
    findings.require(exact_int(run.get("failures"), 0), "P0-PG-FAILURES", subject,
                     str(run.get("failures")))
    return True


def validate_pg_run(
    run: Any,
    expected_major: int,
    findings: Findings,
    expected_tables: list[str] | None = None,
    now: dt.datetime | None = None,
) -> bool:
    subject = f"PG{expected_major}"
    if not exact_keys(run, RUN_KEYS, subject, findings):
        return False
    assert isinstance(run, dict)
    findings.require(run.get("postgresMajor") == expected_major, "P0-PG-MAJOR", subject,
                     str(run.get("postgresMajor")))
    version_num = run.get("serverVersionNum")
    findings.require(
        isinstance(version_num, int) and not isinstance(version_num, bool)
        and version_num // 10000 == expected_major,
        "P0-PG-VERSION",
        subject,
        str(version_num),
    )
    findings.require(isinstance(run.get("serverVersion"), str) and bool(run.get("serverVersion")),
                     "P0-PG-VERSION-TEXT", subject, str(run.get("serverVersion")))
    expected_image = {16: "postgres:16", 18: "postgres:18.4"}[expected_major]
    findings.require(run.get("image") == expected_image,
                     "P0-PG-IMAGE", subject,
                     f"expected={expected_image} actual={run.get('image')}")
    check_hash(run.get("schemaHash"), f"{subject}.schemaHash", findings)

    operations = validate_row_list(
        run.get("operationResults81"), 81, {"operationId", "status"}, "operationId",
        f"{subject}.operationResults81", findings,
    )
    for row in operations:
        findings.require(row.get("status") == "PASS", "P0-PG-OPERATION", subject, str(row))

    queries = validate_row_list(
        run.get("queryResults19"), 19,
        {"operationId", "status", "databaseDiff", "cases"}, "operationId",
        f"{subject}.queryResults19", findings,
    )
    expected_query_cases = sorted([
        "minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
        "wrong-purpose", "cursor-scope-mismatch",
    ])
    for row in queries:
        findings.require(
            row.get("status") == "PASS" and row.get("databaseDiff") == "EMPTY"
            and row.get("cases") == expected_query_cases,
            "P0-PG-QUERY",
            subject,
            str(row),
        )

    edges = validate_row_list(
        run.get("edgeResults58"), 58, {"edgeId", "status"}, "edgeId",
        f"{subject}.edgeResults58", findings,
    )
    for row in edges:
        findings.require(row.get("status") == "PASS", "P0-PG-EDGE", subject, str(row))

    handlers = validate_row_list(
        run.get("handlerResults4"), 4,
        {"handlerId", "status", "identicalReplay", "differentDigestConflict", "rollback"},
        "handlerId", f"{subject}.handlerResults4", findings,
    )
    for row in handlers:
        findings.require(
            all(row.get(key) == "PASS" for key in
                ("status", "identicalReplay", "differentDigestConflict", "rollback")),
            "P0-PG-HANDLER", subject, str(row),
        )

    rollback = run.get("rollbackFaultResults")
    if exact_keys(rollback, {"faultPoints", "status", "receiptDomainOutboxAtomic"},
                  f"{subject}.rollbackFaultResults", findings):
        findings.require(
            rollback == {"faultPoints": 372, "status": "PASS", "receiptDomainOutboxAtomic": True},
            "P0-PG-ROLLBACK", subject, str(rollback),
        )
    handler_rollback = run.get("handlerRollbackFaultResults")
    if exact_keys(handler_rollback, {"faultPoints", "status", "inboxDomainOutboxAtomic"},
                  f"{subject}.handlerRollbackFaultResults", findings):
        findings.require(
            handler_rollback == {"faultPoints": 20, "status": "PASS",
                                  "inboxDomainOutboxAtomic": True},
            "P0-PG-HANDLER-ROLLBACK", subject, str(handler_rollback),
        )

    replay = validate_row_list(
        run.get("receiptOutboxReplayResults"), 81,
        {"operationId", "identicalReplay", "differentDigestConflict",
         "duplicateDomainRows", "duplicateOutboxRows"},
        "operationId", f"{subject}.receiptOutboxReplayResults", findings,
    )
    operation_ids = [row.get("operationId") for row in operations]
    findings.require([row.get("operationId") for row in replay] == operation_ids,
                     "P0-PG-REPLAY-CLOSURE", subject, "operation IDs differ")
    for row in replay:
        findings.require(
            row.get("identicalReplay") == "PASS"
            and row.get("differentDigestConflict") == "PASS"
            and exact_int(row.get("duplicateDomainRows"), 0)
            and exact_int(row.get("duplicateOutboxRows"), 0),
            "P0-PG-REPLAY", subject, str(row),
        )

    negatives = validate_row_list(
        run.get("tenantPurposeStaleConflictResults"), 81,
        {"operationId", "foreignTenant", "wrongPurpose", "staleCas", "ownerProofUnavailable"},
        "operationId", f"{subject}.tenantPurposeStaleConflictResults", findings,
    )
    findings.require([row.get("operationId") for row in negatives] == operation_ids,
                     "P0-PG-NEGATIVE-CLOSURE", subject, "operation IDs differ")
    for row in negatives:
        findings.require(
            all(row.get(key) == "PASS" for key in
                ("foreignTenant", "wrongPurpose", "staleCas", "ownerProofUnavailable")),
            "P0-PG-NEGATIVE", subject, str(row),
        )

    decisions = validate_row_list(
        run.get("decisionReceiptResults"), 14,
        {"operationId", "status", "sameTransaction", "fields"},
        "operationId", f"{subject}.decisionReceiptResults", findings,
    )
    expected_fields = ["decisionVersion", "inputDigestOrRef", "outcome", "ruleId"]
    for row in decisions:
        fields = row.get("fields")
        findings.require(
            row.get("status") == "PASS" and row.get("sameTransaction") is True
            and isinstance(fields, list) and sorted(fields) == expected_fields
            and len(fields) == len(set(fields)),
            "P0-PG-DECISION", subject, str(row),
        )

    conditional = run.get("conditionalEventResults")
    if exact_keys(conditional,
                  {"operationId", "lastRequiredTask", "nonLastRequiredTask", "status"},
                  f"{subject}.conditionalEventResults", findings):
        findings.require(
            conditional == {
                "operationId": "modern.onboarding.task.complete",
                "lastRequiredTask": "PRIMARY_AND_JOURNEY_COMPLETED",
                "nonLastRequiredTask": "PRIMARY_ONLY",
                "status": "PASS",
            },
            "P0-PG-CONDITIONAL", subject, str(conditional),
        )
    critical = run.get("criticalLifecycleResults")
    if exact_keys(critical,
                  {"recruitingTwoStepHire", "compensationSnapshotTimingAndDistinctIds"},
                  f"{subject}.criticalLifecycleResults", findings):
        findings.require(
            critical == {
                "recruitingTwoStepHire": "PASS",
                "compensationSnapshotTimingAndDistinctIds": "PASS",
            },
            "P0-PG-CRITICAL", subject, str(critical),
        )
    forbidden = run.get("forbiddenEdgeResults")
    if exact_keys(forbidden,
                  {"expected", "passed", "rowCountZero", "outboxAbsent",
                   "preexistingRowsUnchanged"},
                  f"{subject}.forbiddenEdgeResults", findings):
        findings.require(
            forbidden == {"expected": 5, "passed": 5, "rowCountZero": True,
                          "outboxAbsent": True, "preexistingRowsUnchanged": True},
            "P0-PG-FORBIDDEN", subject, str(forbidden),
        )

    counts = run.get("scenarioCounts")
    if exact_keys(counts, SCENARIO_COUNT_KEYS, f"{subject}.scenarioCounts", findings):
        expected_counts = {
            "rollbackFaultCount": 372,
            "handlerRollbackFaultCount": 20,
            "commandCount": 81,
            "queryCount": 19,
            "queryCaseCount": 114,
            "decisionReceiptCount": 14,
            "edgeCount": 58,
            "handlerCount": 4,
            "markers": 875,
        }
        findings.require(counts.get("schemaHash") == run.get("schemaHash"),
                         "P0-PG-SCHEMA-CLOSURE", subject, str(counts.get("schemaHash")))
        for key, expected in expected_counts.items():
            findings.require(exact_int(counts.get(key), expected), "P0-PG-SCENARIO-COUNT",
                             f"{subject}.{key}", str(counts.get(key)))
    findings.require(exact_int(run.get("failures"), 0), "P0-PG-FAILURES", subject,
                     str(run.get("failures")))

    schema_projection = run.get("schemaProjection")
    if exact_keys(schema_projection, SCHEMA_PROJECTION_KEYS,
                  f"{subject}.schemaProjection", findings):
        assert isinstance(schema_projection, dict)
        findings.require(
            schema_projection.get("closure")
            == "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
            "P0-PG-SCHEMA-PROJECTION-CLOSURE", subject,
            str(schema_projection.get("closure")),
        )
        observed = schema_projection.get("observedTables")
        findings.require(
            isinstance(observed, list)
            and all(isinstance(item, str) for item in observed)
            and observed == sorted(set(observed)),
            "P0-PG-SCHEMA-PROJECTION-TABLES", subject, str(observed),
        )
        findings.require(exact_int(schema_projection.get("expectedTableCount"), 71),
                         "P0-PG-SCHEMA-PROJECTION-COUNT", subject,
                         str(schema_projection.get("expectedTableCount")))
        check_hash(schema_projection.get("oracleProjectionSha256"),
                   f"{subject}.schemaProjection.oracleProjectionSha256", findings)
        check_hash(schema_projection.get("observedProjectionSha256"),
                   f"{subject}.schemaProjection.observedProjectionSha256", findings)
        if expected_tables is not None:
            expected_object = {
                "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
                "expectedTableCount": 71,
                "expectedTables": expected_tables,
            }
            expected_hash = canonical_value_hash(expected_object)
            observed_object = {
                "closure": schema_projection.get("closure"),
                "expectedTableCount": schema_projection.get("expectedTableCount"),
                "expectedTables": observed,
            }
            findings.require(observed == expected_tables, "P0-PG-SCHEMA-EXACT-EQUALITY",
                             subject, "observed tables differ from oracle")
            findings.require(schema_projection.get("oracleProjectionSha256") == expected_hash,
                             "P0-PG-SCHEMA-ORACLE-HASH", subject, "oracle projection hash differs")
            findings.require(
                schema_projection.get("observedProjectionSha256")
                == canonical_value_hash(observed_object) == expected_hash,
                "P0-PG-SCHEMA-OBSERVED-HASH", subject, "observed projection hash differs",
            )

    receipt = run.get("executionReceipt")
    if exact_keys(receipt, EXECUTION_RECEIPT_KEYS, f"{subject}.executionReceipt", findings):
        assert isinstance(receipt, dict)
        findings.require(isinstance(receipt.get("imageId"), str)
                         and IMAGE_ID_RE.fullmatch(receipt["imageId"]) is not None,
                         "P0-PG-IMAGE-ID", subject, str(receipt.get("imageId")))
        findings.require(isinstance(receipt.get("repoDigest"), str)
                         and REPO_DIGEST_RE.fullmatch(receipt["repoDigest"]) is not None,
                         "P0-PG-REPO-DIGEST", subject, str(receipt.get("repoDigest")))
        findings.require(isinstance(receipt.get("containerId"), str)
                         and CONTAINER_ID_RE.fullmatch(receipt["containerId"]) is not None,
                         "P0-PG-CONTAINER-ID", subject, str(receipt.get("containerId")))
        argv = receipt.get("argv")
        findings.require(
            isinstance(argv, list) and bool(argv)
            and all(isinstance(item, str) and bool(item) for item in argv),
            "P0-PG-ARGV", subject, str(argv),
        )
        check_hash(receipt.get("argvSha256"), f"{subject}.executionReceipt.argvSha256", findings)
        if isinstance(argv, list):
            findings.require(receipt.get("argvSha256") == canonical_value_hash(argv),
                             "P0-PG-ARGV-HASH", subject, "argv digest differs")
        check_hash(receipt.get("stdoutSha256"), f"{subject}.executionReceipt.stdoutSha256", findings)
        check_hash(receipt.get("stderrSha256"), f"{subject}.executionReceipt.stderrSha256", findings)
        findings.require(exact_int(receipt.get("exitCode"), 0), "P0-PG-EXIT", subject,
                         str(receipt.get("exitCode")))
        check_now = now or dt.datetime.now(dt.timezone.utc)
        started = check_timestamp_freshness(receipt.get("startedAt"), check_now,
                                            f"{subject}.startedAt", findings)
        ended = check_timestamp_freshness(receipt.get("endedAt"), check_now,
                                          f"{subject}.endedAt", findings)
        if started is not None and ended is not None:
            findings.require(started <= ended, "P0-PG-TIME-ORDER", subject,
                             f"started={started.isoformat()} ended={ended.isoformat()}")
    return True


def comparable_run_hash(run: dict[str, Any]) -> str:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return canonical_value_hash({
            key: copy.deepcopy(value)
            for key, value in run.items()
            if key not in {
                "profile", "postgresMajor", "serverVersion", "serverVersionNum",
                "image", "executionReceipt",
            }
        })
    projection = {key: copy.deepcopy(run[key]) for key in COMPARABLE_RUN_KEYS}
    return canonical_hash(projection, set())


def validate_artifact_reference(
    value: Any,
    subject: str,
    expected_path: str,
    findings: Findings,
) -> bool:
    if not exact_keys(value, ARTIFACT_REFERENCE_KEYS, subject, findings):
        return False
    assert isinstance(value, dict)
    findings.require(value.get("path") == expected_path, "P0-ARTIFACT-REFERENCE-PATH",
                     subject, f"expected={expected_path} actual={value.get('path')}")
    check_hash(value.get("fileSha256"), f"{subject}.fileSha256", findings)
    check_hash(value.get("sealedPayloadSha256"), f"{subject}.sealedPayloadSha256", findings)
    return True


def validate_expected_projection(value: Any, subject: str, findings: Findings) -> bool:
    if not exact_keys(value, EXPECTED_PROJECTION_KEYS, subject, findings):
        return False
    assert isinstance(value, dict)
    authoritative = value.get("authoritative")
    review = value.get("reviewInventory")
    ok = True
    if exact_keys(authoritative, AUTHORITATIVE_PROJECTION_KEYS,
                  f"{subject}.authoritative", findings):
        for key in AUTHORITATIVE_PROJECTION_KEYS:
            check_hash(authoritative.get(key), f"{subject}.authoritative.{key}", findings)
    else:
        ok = False
    if exact_keys(review, REVIEW_PROJECTION_KEYS, f"{subject}.reviewInventory", findings):
        for key in REVIEW_PROJECTION_KEYS:
            check_hash(review.get(key), f"{subject}.reviewInventory.{key}", findings)
    else:
        ok = False
    return ok


def _validate_successor_evidence_schema(
    evidence: dict[str, Any],
    findings: Findings,
    root: Path = BASE,
) -> bool:
    if not exact_keys(evidence, SUCCESSOR_EVIDENCE_KEYS, "successor.evidence", findings):
        return False
    findings.require(evidence.get("evidenceId") == EVIDENCE_ID, "P0-SUCCESSOR-EVIDENCE-ID",
                     "evidence", str(evidence.get("evidenceId")))
    findings.require(exact_int(evidence.get("schemaVersion"), EVIDENCE_SCHEMA_VERSION),
                     "P0-SUCCESSOR-EVIDENCE-SCHEMA-VERSION", "evidence",
                     str(evidence.get("schemaVersion")))
    findings.require(evidence.get("technicalStatus") == EVIDENCE_TECHNICAL_STATUS,
                     "P0-SUCCESSOR-EVIDENCE-STATUS", "evidence",
                     str(evidence.get("technicalStatus")))
    findings.require(evidence.get("gatePolicy") == GATE_POLICY,
                     "P0-SUCCESSOR-EVIDENCE-GATE-POLICY", "evidence",
                     str(evidence.get("gatePolicy")))
    findings.require(valid_utc_timestamp(evidence.get("generatedAt")),
                     "P0-SUCCESSOR-EVIDENCE-TIMESTAMP", "evidence",
                     str(evidence.get("generatedAt")))
    findings.require(
        evidence.get("evidenceState") in {
            "UNSIGNED_STAGING_SUCCESSOR_V3", "FINALIZED_SUCCESSOR_V3",
        },
        "P0-SUCCESSOR-EVIDENCE-STATE", "evidence", str(evidence.get("evidenceState")),
    )
    findings.require(
        isinstance(evidence.get("unsignedStagingPath"), str)
        and evidence.get("unsignedStagingPath") == UNSIGNED_EVIDENCE_RELATIVE_PATH,
        "P0-SUCCESSOR-UNSIGNED-PATH", "evidence",
        f"expected={UNSIGNED_EVIDENCE_RELATIVE_PATH} actual={evidence.get('unsignedStagingPath')}",
    )
    findings.require(
        isinstance(evidence.get("finalEvidencePath"), str)
        and evidence.get("finalEvidencePath") == EVIDENCE_RELATIVE_PATH
        and evidence.get("finalEvidencePath") != evidence.get("unsignedStagingPath"),
        "P0-SUCCESSOR-FINAL-PATH", "evidence",
        f"expected={EVIDENCE_RELATIVE_PATH} actual={evidence.get('finalEvidencePath')}",
    )
    findings.require(
        evidence.get("createOnlyTransition")
        == "FINALIZER_MUST_CREATE_DISTINCT_FINAL_EVIDENCE_PATH_FROM_UNSIGNED_STAGING",
        "P0-SUCCESSOR-CREATE-ONLY-TRANSITION", "evidence",
        str(evidence.get("createOnlyTransition")),
    )
    producers = evidence.get("producerPrincipalIds")
    findings.require(
        isinstance(producers, list) and bool(producers)
        and all(isinstance(item, str) and PRINCIPAL_RE.fullmatch(item) for item in producers)
        and producers == sorted(set(producers)),
        "P0-SUCCESSOR-PRODUCER-IDS", "evidence", str(producers),
    )
    for key in (
        "oracleSha256", "oracleFileSha256", "fixtureSha256", "fixtureFileSha256",
        "builderFileSha256", "runnerFileSha256", "independentValidatorFileSha256",
        "verifierFileSha256", "sealedPayloadSha256",
    ):
        check_hash(evidence.get(key), f"evidence.{key}", findings)
    validate_accepted_live_source_hashes(
        evidence.get("acceptedLiveSourceHashes"), "evidence.acceptedLiveSourceHashes",
        root, findings,
    )
    validate_trusted_tool_root_reference(evidence.get("trustedToolRoot"),
                                         "evidence.trustedToolRoot", findings)
    validate_artifact_reference(evidence.get("sourceAuthority"),
                                "evidence.sourceAuthority",
                                SOURCE_AUTHORITY_MANIFEST_NAME, findings)
    validate_artifact_reference(evidence.get("controlIntake"),
                                "evidence.controlIntake",
                                CONTROL_INTAKE_RECORDED_PATH, findings)
    validate_expected_projection(evidence.get("expectedProjection"),
                                 "evidence.expectedProjection", findings)
    comparison = evidence.get("executionComparison")
    if exact_keys(comparison, EXECUTION_COMPARISON_KEYS, "executionComparison", findings):
        assert isinstance(comparison, dict)
        findings.require(comparison.get("projectionId") == PROJECTION_ID,
                         "P0-SUCCESSOR-PG-PROJECTION-ID", "executionComparison",
                         str(comparison.get("projectionId")))
        for key in ("pg16PayloadSha256", "pg18PayloadSha256",
                    "comparableExecutionPayloadSha256"):
            check_hash(comparison.get(key), f"executionComparison.{key}", findings)
    semaphore = evidence.get("hostSemaphore")
    if exact_keys(semaphore, HOST_SEMAPHORE_KEYS, "hostSemaphore", findings):
        assert isinstance(semaphore, dict)
        findings.require(
            semaphore.get("name") == "hris-verification"
            and semaphore.get("protected") is True
            and semaphore.get("acquisition") in {"DIRECT", "PARENT_HELD", "IN_PROCESS_OPAQUE"},
            "P0-SUCCESSOR-HOST-SEMAPHORE", "evidence", str(semaphore),
        )
    reviewer = evidence.get("secondReviewer")
    if exact_keys(reviewer, SECOND_REVIEWER_KEYS, "secondReviewer", findings):
        assert isinstance(reviewer, dict)
        signed = reviewer.get("signed") is True
        findings.require(
            reviewer.get("signed") is True,
            "P0-SUCCESSOR-REVIEWER-SIGNED", "secondReviewer", str(reviewer.get("signed")),
        )
        findings.require(reviewer.get("attestationMode") == ATTESTATION_MODE,
                         "P0-SUCCESSOR-REVIEWER-MODE", "secondReviewer",
                         str(reviewer.get("attestationMode")))
        findings.require(reviewer.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
                         "P0-SUCCESSOR-REVIEWER-IDENTITY", "secondReviewer",
                         str(reviewer.get("externalIdentityAttestation")))
        reviewer_id = reviewer.get("reviewerId")
        findings.require(isinstance(reviewer_id, str)
                         and PRINCIPAL_RE.fullmatch(reviewer_id) is not None,
                         "P0-SUCCESSOR-REVIEWER-ID", "secondReviewer", str(reviewer_id))
        findings.require(reviewer.get("reviewerRole") in ALLOWED_REVIEWER_ROLES,
                         "P0-SUCCESSOR-REVIEWER-ROLE", "secondReviewer",
                         str(reviewer.get("reviewerRole")))
        findings.require(reviewer.get("reportId") == REPORT_ID,
                         "P0-SUCCESSOR-REVIEWER-REPORT-ID", "secondReviewer",
                         str(reviewer.get("reportId")))
        findings.require(reviewer.get("reportPath") == REPORT_RELATIVE_PATH,
                         "P0-SUCCESSOR-REVIEWER-REPORT-PATH", "secondReviewer",
                         str(reviewer.get("reportPath")))
        findings.require(isinstance(producers, list) and reviewer_id not in producers,
                         "P0-SUCCESSOR-REVIEWER-INDEPENDENCE", "secondReviewer",
                         str(reviewer_id))
        for key in ("reportSealedPayloadSha256", "reportFileSha256", "evidenceCoreSealSha256"):
            check_hash(reviewer.get(key), f"secondReviewer.{key}", findings)
        counts = reviewer.get("findingCounts")
        if exact_keys(counts, FINDING_COUNT_KEYS, "secondReviewer.findingCounts", findings):
            findings.require(exact_int(counts.get("P0"), 0)
                             and exact_int(counts.get("P1"), 0),
                             "P0-SUCCESSOR-REVIEWER-FINDINGS", "secondReviewer", str(counts))
        findings.require(valid_utc_timestamp(reviewer.get("reviewedAt")),
                         "P0-SUCCESSOR-REVIEWER-TIMESTAMP", "secondReviewer",
                         str(reviewer.get("reviewedAt")))
        if not signed:
            findings.add("P0-SUCCESSOR-REVIEWER-UNSIGNED", "secondReviewer", "signed reviewer required")
    runs = evidence.get("runs")
    if not isinstance(runs, list) or len(runs) != 2:
        findings.add("P0-SUCCESSOR-PG-RUNS", "evidence", "exactly two PG runs are required")
    return True


def validate_evidence_schema(
    evidence: dict[str, Any], findings: Findings, *, root: Path | None = None,
) -> bool:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return _validate_successor_evidence_schema(evidence, findings, root or BASE)
    if not exact_keys(evidence, EVIDENCE_KEYS, "evidence", findings):
        return False
    findings.require(evidence.get("evidenceId") == EVIDENCE_ID, "P0-EVIDENCE-ID",
                     "evidence", str(evidence.get("evidenceId")))
    findings.require(exact_int(evidence.get("schemaVersion"), EVIDENCE_SCHEMA_VERSION), "P0-EVIDENCE-SCHEMA-VERSION",
                     "evidence", str(evidence.get("schemaVersion")))
    findings.require(evidence.get("technicalStatus") == EVIDENCE_TECHNICAL_STATUS,
                     "P0-EVIDENCE-STATUS", "evidence", str(evidence.get("technicalStatus")))
    findings.require(evidence.get("gatePolicy") == GATE_POLICY, "P0-EVIDENCE-GATE-POLICY",
                     "evidence", str(evidence.get("gatePolicy")))
    findings.require(valid_utc_timestamp(evidence.get("generatedAt")),
                     "P0-EVIDENCE-TIMESTAMP", "generatedAt", str(evidence.get("generatedAt")))
    producers = evidence.get("producerPrincipalIds")
    findings.require(
        isinstance(producers, list) and bool(producers)
        and all(isinstance(item, str) and PRINCIPAL_RE.fullmatch(item) for item in producers)
        and producers == sorted(set(producers)),
        "P0-PRODUCER-IDS", "evidence", str(producers),
    )
    for key in (
        "oracleSha256", "oracleFileSha256", "fixtureSha256", "fixtureFileSha256",
        "builderFileSha256", "runnerFileSha256", "independentValidatorFileSha256",
        "verifierFileSha256",
        "sealedPayloadSha256",
    ):
        check_hash(evidence.get(key), f"evidence.{key}", findings)
    validate_candidate_hashes(evidence.get("candidateHashes"), "evidence.candidateHashes", findings)
    validate_trusted_tool_root_reference(
        evidence.get("trustedToolRoot"), "evidence.trustedToolRoot", findings,
    )
    validate_artifact_reference(
        evidence.get("sourceAuthority"), "evidence.sourceAuthority",
        SOURCE_AUTHORITY_MANIFEST_NAME, findings,
    )
    validate_artifact_reference(
        evidence.get("controlIntake"), "evidence.controlIntake",
        CONTROL_INTAKE_RECORDED_PATH, findings,
    )
    validate_expected_projection(evidence.get("expectedProjection"),
                                 "evidence.expectedProjection", findings)

    comparison = evidence.get("executionComparison")
    if exact_keys(comparison, EXECUTION_COMPARISON_KEYS, "executionComparison", findings):
        findings.require(comparison.get("projectionId") == PROJECTION_ID,
                         "P0-PG-PROJECTION-ID", "executionComparison",
                         str(comparison.get("projectionId")))
        for key in ("pg16PayloadSha256", "pg18PayloadSha256",
                    "comparableExecutionPayloadSha256"):
            check_hash(comparison.get(key), f"executionComparison.{key}", findings)

    semaphore = evidence.get("hostSemaphore")
    if exact_keys(semaphore, HOST_SEMAPHORE_KEYS, "hostSemaphore", findings):
        findings.require(
            semaphore.get("name") == "hris-verification"
            and semaphore.get("protected") is True
            and semaphore.get("acquisition") in {"DIRECT", "PARENT_HELD"},
            "P0-HOST-SEMAPHORE", "evidence", str(semaphore),
        )

    reviewer = evidence.get("secondReviewer")
    if exact_keys(reviewer, SECOND_REVIEWER_KEYS, "secondReviewer", findings):
        findings.require(reviewer.get("signed") is True, "P0-REVIEWER-SIGNED",
                         "secondReviewer", str(reviewer.get("signed")))
        findings.require(reviewer.get("attestationMode") == ATTESTATION_MODE,
                         "P0-REVIEWER-MODE", "secondReviewer",
                         str(reviewer.get("attestationMode")))
        findings.require(reviewer.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
                         "P0-REVIEWER-IDENTITY-SCOPE", "secondReviewer",
                         str(reviewer.get("externalIdentityAttestation")))
        reviewer_id = reviewer.get("reviewerId")
        findings.require(isinstance(reviewer_id, str) and PRINCIPAL_RE.fullmatch(reviewer_id) is not None,
                         "P0-REVIEWER-ID", "secondReviewer", str(reviewer_id))
        findings.require(reviewer.get("reviewerRole") in ALLOWED_REVIEWER_ROLES,
                         "P0-REVIEWER-ROLE", "secondReviewer",
                         str(reviewer.get("reviewerRole")))
        findings.require(reviewer.get("reportId") == REPORT_ID, "P0-REVIEWER-REPORT-ID",
                         "secondReviewer", str(reviewer.get("reportId")))
        findings.require(reviewer.get("reportPath") == REPORT_RELATIVE_PATH,
                         "P0-REVIEWER-REPORT-PATH", "secondReviewer",
                         str(reviewer.get("reportPath")))
        findings.require(reviewer_id != reviewer.get("reportId"), "P0-REVIEWER-ID-COLLISION",
                         "secondReviewer", str(reviewer_id))
        findings.require(isinstance(producers, list) and reviewer_id not in producers,
                         "P0-REVIEWER-NOT-INDEPENDENT", "secondReviewer", str(reviewer_id))
        for key in ("reportSealedPayloadSha256", "reportFileSha256",
                    "evidenceCoreSealSha256"):
            check_hash(reviewer.get(key), f"secondReviewer.{key}", findings)
        counts = reviewer.get("findingCounts")
        if exact_keys(counts, FINDING_COUNT_KEYS, "secondReviewer.findingCounts", findings):
            findings.require(
                exact_int(counts.get("P0"), 0) and exact_int(counts.get("P1"), 0),
                "P0-REVIEWER-FINDINGS",
                             "secondReviewer", str(counts))
        findings.require(valid_utc_timestamp(reviewer.get("reviewedAt")),
                         "P0-REVIEWER-TIMESTAMP", "secondReviewer",
                         str(reviewer.get("reviewedAt")))
    return True


def _validate_successor_report_schema(
    report: dict[str, Any], findings: Findings, root: Path = BASE,
) -> bool:
    if not exact_keys(report, REPORT_KEYS, "successor.report", findings):
        return False
    findings.require(report.get("reportId") == REPORT_ID, "P0-SUCCESSOR-REPORT-ID", "report",
                     str(report.get("reportId")))
    findings.require(exact_int(report.get("schemaVersion"), REPORT_SCHEMA_VERSION),
                     "P0-SUCCESSOR-REPORT-SCHEMA-VERSION", "report",
                     str(report.get("schemaVersion")))
    findings.require(report.get("status") == "PASS", "P0-SUCCESSOR-REPORT-STATUS", "report",
                     str(report.get("status")))
    findings.require(report.get("scope") == REVIEW_SCOPE, "P0-SUCCESSOR-REPORT-SCOPE", "report",
                     str(report.get("scope")))
    findings.require(report.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
                     "P0-SUCCESSOR-REPORT-IDENTITY", "report",
                     str(report.get("externalIdentityAttestation")))
    findings.require(valid_utc_timestamp(report.get("reviewedAt")),
                     "P0-SUCCESSOR-REPORT-TIMESTAMP", "report", str(report.get("reviewedAt")))
    check_hash(report.get("sealedPayloadSha256"), "report.sealedPayloadSha256", findings)
    reviewer = report.get("reviewer")
    if exact_keys(reviewer, REPORT_REVIEWER_KEYS, "report.reviewer", findings):
        assert isinstance(reviewer, dict)
        reviewer_id = reviewer.get("reviewerId")
        findings.require(isinstance(reviewer_id, str)
                         and PRINCIPAL_RE.fullmatch(reviewer_id) is not None,
                         "P0-SUCCESSOR-REPORT-REVIEWER-ID", "report", str(reviewer_id))
        findings.require(reviewer.get("reviewerRole") in ALLOWED_REVIEWER_ROLES,
                         "P0-SUCCESSOR-REPORT-REVIEWER-ROLE", "report",
                         str(reviewer.get("reviewerRole")))
        findings.require(reviewer.get("independenceAssertion") == "DISTINCT_FROM_ALL_PRODUCERS",
                         "P0-SUCCESSOR-REPORT-INDEPENDENCE", "report",
                         str(reviewer.get("independenceAssertion")))
        producers = reviewer.get("producerPrincipalIdsReviewed")
        findings.require(
            isinstance(producers, list) and bool(producers)
            and producers == sorted(set(producers))
            and all(isinstance(item, str) and PRINCIPAL_RE.fullmatch(item) for item in producers)
            and reviewer_id not in producers,
            "P0-SUCCESSOR-REPORT-PRODUCERS", "report", str(producers),
        )
    subject = report.get("subject")
    if exact_keys(subject, SUCCESSOR_REPORT_SUBJECT_KEYS, "report.subject", findings):
        assert isinstance(subject, dict)
        findings.require(subject.get("evidenceId") == EVIDENCE_ID,
                         "P0-SUCCESSOR-REPORT-EVIDENCE-ID", "report.subject",
                         str(subject.get("evidenceId")))
        for key in (
            "evidenceCoreSealSha256", "oracleSha256", "oracleFileSha256", "fixtureSha256",
            "fixtureFileSha256", "builderFileSha256", "runnerFileSha256", "verifierFileSha256",
            "independentValidatorFileSha256", "pgComparableExecutionPayloadSha256",
        ):
            check_hash(subject.get(key), f"report.subject.{key}", findings)
        validate_accepted_live_source_hashes(
            subject.get("acceptedLiveSourceHashes"), "report.subject.acceptedLiveSourceHashes",
            root, findings,
        )
        validate_trusted_tool_root_reference(subject.get("trustedToolRoot"),
                                             "report.subject.trustedToolRoot", findings)
        validate_artifact_reference(subject.get("sourceAuthority"),
                                    "report.subject.sourceAuthority",
                                    SOURCE_AUTHORITY_MANIFEST_NAME, findings)
        validate_artifact_reference(subject.get("controlIntake"),
                                    "report.subject.controlIntake",
                                    CONTROL_INTAKE_RECORDED_PATH, findings)
        validate_expected_projection(subject.get("expectedProjection"),
                                     "report.subject.expectedProjection", findings)
        run_hashes = subject.get("pgRunPayloadSha256")
        if exact_keys(run_hashes, PG_RUN_HASH_KEYS, "report.subject.pgRunPayloadSha256", findings):
            check_hash(run_hashes.get("16"), "report.subject.pgRunPayloadSha256.16", findings)
            check_hash(run_hashes.get("18"), "report.subject.pgRunPayloadSha256.18", findings)
    finding_block = report.get("findings")
    if exact_keys(finding_block, REPORT_FINDINGS_KEYS, "report.findings", findings):
        assert isinstance(finding_block, dict)
        counts = finding_block.get("counts")
        if exact_keys(counts, FINDING_COUNT_KEYS, "report.findings.counts", findings):
            findings.require(exact_int(counts.get("P0"), 0)
                             and exact_int(counts.get("P1"), 0),
                             "P0-SUCCESSOR-REPORT-FINDINGS", "report", str(counts))
        findings.require(finding_block.get("P0") == [], "P0-SUCCESSOR-REPORT-P0-NONZERO",
                         "report", str(finding_block.get("P0")))
        findings.require(finding_block.get("P1") == [], "P0-SUCCESSOR-REPORT-P1-NONZERO",
                         "report", str(finding_block.get("P1")))
    findings.require(report.get("assertions") == SUCCESSOR_REPORT_ASSERTIONS,
                     "P0-SUCCESSOR-REPORT-ASSERTIONS", "report",
                     str(report.get("assertions")))
    return True


def validate_report_schema(
    report: dict[str, Any], findings: Findings, *, root: Path | None = None,
) -> bool:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return _validate_successor_report_schema(report, findings, root or BASE)
    if not exact_keys(report, REPORT_KEYS, "report", findings):
        return False
    findings.require(report.get("reportId") == REPORT_ID, "P0-REPORT-ID", "report",
                     str(report.get("reportId")))
    findings.require(exact_int(report.get("schemaVersion"), REPORT_SCHEMA_VERSION),
                     "P0-REPORT-SCHEMA-VERSION", "report",
                     str(report.get("schemaVersion")))
    findings.require(report.get("status") == "PASS", "P0-REPORT-STATUS", "report",
                     str(report.get("status")))
    findings.require(report.get("scope") == REVIEW_SCOPE, "P0-REPORT-SCOPE", "report",
                     str(report.get("scope")))
    findings.require(report.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
                     "P0-REPORT-IDENTITY-SCOPE", "report",
                     str(report.get("externalIdentityAttestation")))
    findings.require(valid_utc_timestamp(report.get("reviewedAt")), "P0-REPORT-TIMESTAMP",
                     "report", str(report.get("reviewedAt")))
    check_hash(report.get("sealedPayloadSha256"), "report.sealedPayloadSha256", findings)

    reviewer = report.get("reviewer")
    if exact_keys(reviewer, REPORT_REVIEWER_KEYS, "report.reviewer", findings):
        reviewer_id = reviewer.get("reviewerId")
        findings.require(isinstance(reviewer_id, str) and PRINCIPAL_RE.fullmatch(reviewer_id) is not None,
                         "P0-REPORT-REVIEWER-ID", "report", str(reviewer_id))
        findings.require(reviewer.get("reviewerRole") in ALLOWED_REVIEWER_ROLES,
                         "P0-REPORT-REVIEWER-ROLE", "report",
                         str(reviewer.get("reviewerRole")))
        findings.require(reviewer.get("independenceAssertion") == "DISTINCT_FROM_ALL_PRODUCERS",
                         "P0-REPORT-INDEPENDENCE", "report",
                         str(reviewer.get("independenceAssertion")))
        producers = reviewer.get("producerPrincipalIdsReviewed")
        findings.require(
            isinstance(producers, list) and bool(producers)
            and producers == sorted(set(producers))
            and all(isinstance(item, str) and PRINCIPAL_RE.fullmatch(item) for item in producers)
            and reviewer_id not in producers,
            "P0-REPORT-PRODUCERS", "report", str(producers),
        )

    subject = report.get("subject")
    if exact_keys(subject, REPORT_SUBJECT_KEYS, "report.subject", findings):
        findings.require(subject.get("evidenceId") == EVIDENCE_ID, "P0-REPORT-EVIDENCE-ID",
                         "report.subject", str(subject.get("evidenceId")))
        for key in (
            "evidenceCoreSealSha256", "oracleSha256", "oracleFileSha256", "fixtureSha256",
            "fixtureFileSha256", "builderFileSha256", "runnerFileSha256", "verifierFileSha256",
            "independentValidatorFileSha256",
            "pgComparableExecutionPayloadSha256",
        ):
            check_hash(subject.get(key), f"report.subject.{key}", findings)
        validate_candidate_hashes(subject.get("candidateHashes"),
                                  "report.subject.candidateHashes", findings)
        validate_trusted_tool_root_reference(
            subject.get("trustedToolRoot"), "report.subject.trustedToolRoot", findings,
        )
        validate_artifact_reference(
            subject.get("sourceAuthority"), "report.subject.sourceAuthority",
            SOURCE_AUTHORITY_MANIFEST_NAME, findings,
        )
        validate_artifact_reference(
            subject.get("controlIntake"), "report.subject.controlIntake",
            CONTROL_INTAKE_RECORDED_PATH, findings,
        )
        validate_expected_projection(subject.get("expectedProjection"),
                                     "report.subject.expectedProjection", findings)
        run_hashes = subject.get("pgRunPayloadSha256")
        if exact_keys(run_hashes, PG_RUN_HASH_KEYS, "report.subject.pgRunPayloadSha256", findings):
            check_hash(run_hashes.get("16"), "report.subject.pgRunPayloadSha256.16", findings)
            check_hash(run_hashes.get("18"), "report.subject.pgRunPayloadSha256.18", findings)

    finding_block = report.get("findings")
    if exact_keys(finding_block, REPORT_FINDINGS_KEYS, "report.findings", findings):
        counts = finding_block.get("counts")
        if exact_keys(counts, FINDING_COUNT_KEYS, "report.findings.counts", findings):
            findings.require(
                exact_int(counts.get("P0"), 0) and exact_int(counts.get("P1"), 0),
                "P0-REPORT-FINDING-COUNTS",
                             "report", str(counts))
        findings.require(finding_block.get("P0") == [], "P0-REPORT-P0-NONZERO", "report",
                         str(finding_block.get("P0")))
        findings.require(finding_block.get("P1") == [], "P0-REPORT-P1-NONZERO", "report",
                         str(finding_block.get("P1")))
    findings.require(report.get("assertions") == REPORT_ASSERTIONS,
                     "P0-REPORT-ASSERTIONS", "report", str(report.get("assertions")))
    return True


def _validate_successor_current_inputs(
    root: Path,
    evidence: dict[str, Any],
    findings: Findings,
) -> None:
    """Pin successor outputs/tools and accepted-live bytes without candidates."""
    paths = {
        "oracle": (ORACLE_NAME, evidence.get("oracleFileSha256")),
        "fixture": (FIXTURE_NAME, evidence.get("fixtureFileSha256")),
        "builder": (BUILDER_NAME, evidence.get("builderFileSha256")),
        "runner": (RUNNER_NAME, evidence.get("runnerFileSha256")),
        "independent-validator": (
            INDEPENDENT_VALIDATOR_NAME,
            evidence.get("independentValidatorFileSha256"),
        ),
    }
    loaded: dict[str, dict[str, Any]] = {}
    for label, (relative, expected_hash) in paths.items():
        path = check_safe_regular_file(root, relative, findings, "P0-SUCCESSOR-CURRENT-FILE")
        if path is None:
            continue
        actual = file_hash(path)
        findings.require(actual == expected_hash, "P0-SUCCESSOR-CURRENT-FILE-HASH", label,
                         f"expected={expected_hash} current={actual}")
        if label in {"oracle", "fixture"}:
            try:
                loaded[label] = strict_json_file(path)
            except (OSError, StrictJsonError) as exc:
                findings.add("P0-SUCCESSOR-CURRENT-JSON", label, str(exc))
    verifier_path = check_safe_regular_file(root, VERIFIER_NAME, findings,
                                            "P0-SUCCESSOR-VERIFIER-FILE")
    if verifier_path is not None:
        current = file_hash(verifier_path)
        findings.require(current == evidence.get("verifierFileSha256"),
                         "P0-SUCCESSOR-VERIFIER-FILE-HASH", VERIFIER_NAME,
                         f"expected={evidence.get('verifierFileSha256')} current={current}")
    oracle = loaded.get("oracle")
    fixture = loaded.get("fixture")
    dependency_receipt: dict[str, Any] | None = None
    if oracle is not None:
        seal = semantic_seal(oracle)
        findings.require(seal == oracle.get("sealedPayloadSha256"),
                         "P0-SUCCESSOR-ORACLE-SEMANTIC-SEAL", ORACLE_NAME,
                         f"stored={oracle.get('sealedPayloadSha256')} current={seal}")
        findings.require(seal == evidence.get("oracleSha256"),
                         "P0-SUCCESSOR-ORACLE-EVIDENCE-PIN", ORACLE_NAME,
                         f"expected={evidence.get('oracleSha256')} current={seal}")
        try:
            dependency_receipt = verify_successor_owner_dependencies(
                oracle, label="successor oracle.ownerDependencyContracts"
            )
            profile_receipt = verify_successor_owner_dependency_receipt(
                oracle.get("successorProfile", {}).get("ownerDependencyReceipt"),
                label="successor oracle.successorProfile.ownerDependencyReceipt",
            )
            findings.require(
                profile_receipt == dependency_receipt,
                "P0-SUCCESSOR-OWNER-RECEIPT-BINDING",
                ORACLE_NAME,
                "successor profile receipt differs from oracle dependency rows",
            )
        except (SuccessorProfileError, TypeError, ValueError) as exc:
            findings.add(
                "P0-SUCCESSOR-OWNER-DEPENDENCY",
                f"{ORACLE_NAME}.ownerDependencyContracts",
                str(exc),
            )
        try:
            verify_successor_closed_set_manifest_reference(
                oracle, label="successor oracle.closedSetManifest"
            )
            findings.require(
                oracle.get("successorProfile", {}).get("closedSetManifestPin")
                == SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
                "P0-SUCCESSOR-MANIFEST-PIN",
                ORACLE_NAME,
                "successor profile closed-set manifest pin drift",
            )
        except (SuccessorProfileError, TypeError, ValueError) as exc:
            findings.add(
                "P0-SUCCESSOR-MANIFEST-PIN",
                f"{ORACLE_NAME}.closedSetManifest",
                str(exc),
            )
    if fixture is not None:
        seal = semantic_seal(fixture)
        findings.require(seal == fixture.get("sealedPayloadSha256"),
                         "P0-SUCCESSOR-FIXTURE-SEMANTIC-SEAL", FIXTURE_NAME,
                         f"stored={fixture.get('sealedPayloadSha256')} current={seal}")
        findings.require(seal == evidence.get("fixtureSha256"),
                         "P0-SUCCESSOR-FIXTURE-EVIDENCE-PIN", FIXTURE_NAME,
                         f"expected={evidence.get('fixtureSha256')} current={seal}")
        fixture_ref = fixture.get("oracle")
        findings.require(isinstance(fixture_ref, dict)
                         and fixture_ref.get("sealedPayloadSha256")
                         == (oracle or {}).get("sealedPayloadSha256"),
                         "P0-SUCCESSOR-FIXTURE-ORACLE-PIN", FIXTURE_NAME,
                         str(fixture_ref))
        try:
            fixture_receipt = verify_successor_owner_dependency_receipt(
                fixture.get("successorProfile", {}).get("ownerDependencyReceipt"),
                label="successor fixture.successorProfile.ownerDependencyReceipt",
            )
            if dependency_receipt is not None:
                findings.require(
                    fixture_receipt == dependency_receipt,
                    "P0-SUCCESSOR-OWNER-RECEIPT-BINDING",
                    FIXTURE_NAME,
                    "fixture receipt differs from oracle dependency rows",
                )
        except (SuccessorProfileError, TypeError, ValueError) as exc:
            findings.add(
                "P0-SUCCESSOR-OWNER-DEPENDENCY",
                f"{FIXTURE_NAME}.ownerDependencyReceipt",
                str(exc),
            )
        findings.require(
            fixture.get("successorProfile", {}).get("closedSetManifestPin")
            == SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
            "P0-SUCCESSOR-MANIFEST-PIN",
            f"{FIXTURE_NAME}.successorProfile.closedSetManifestPin",
            "successor fixture closed-set manifest pin drift",
        )
    validate_accepted_live_source_hashes(
        evidence.get("acceptedLiveSourceHashes"), "evidence.acceptedLiveSourceHashes",
        root, findings,
    )


def validate_current_inputs(root: Path, evidence: dict[str, Any], findings: Findings) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        _validate_successor_current_inputs(root, evidence, findings)
        return
    paths = {
        "oracle": (ORACLE_NAME, evidence.get("oracleFileSha256")),
        "fixture": (FIXTURE_NAME, evidence.get("fixtureFileSha256")),
        "builder": (BUILDER_NAME, evidence.get("builderFileSha256")),
        "runner": (RUNNER_NAME, evidence.get("runnerFileSha256")),
        "independent-validator": (
            INDEPENDENT_VALIDATOR_NAME,
            evidence.get("independentValidatorFileSha256"),
        ),
    }
    loaded_json: dict[str, dict[str, Any]] = {}
    for label, (relative, expected_hash) in paths.items():
        path = check_safe_regular_file(root, relative, findings, f"P0-{label.upper()}-FILE")
        if path is None:
            continue
        actual = file_hash(path)
        findings.require(actual == expected_hash, f"P0-{label.upper()}-FILE-HASH", label,
                         f"evidence={expected_hash} current={actual}")
        if label in {"oracle", "fixture"}:
            try:
                loaded_json[label] = strict_json_file(path)
            except (OSError, StrictJsonError) as exc:
                findings.add(f"P0-{label.upper()}-JSON", label, str(exc))

    verifier_path = check_safe_regular_file(root, VERIFIER_NAME, findings, "P0-VERIFIER-FILE")
    if verifier_path is not None:
        actual_verifier = file_hash(verifier_path)
        findings.require(actual_verifier == evidence.get("verifierFileSha256"),
                         "P0-VERIFIER-FILE-HASH", VERIFIER_NAME,
                         f"evidence={evidence.get('verifierFileSha256')} current={actual_verifier}")

    oracle = loaded_json.get("oracle")
    fixture = loaded_json.get("fixture")
    if oracle is not None:
        actual = semantic_seal(oracle)
        findings.require(actual == oracle.get("sealedPayloadSha256"), "P0-ORACLE-SEMANTIC-SEAL",
                         ORACLE_NAME, f"stored={oracle.get('sealedPayloadSha256')} current={actual}")
        findings.require(actual == evidence.get("oracleSha256"), "P0-ORACLE-EVIDENCE-PIN",
                         ORACLE_NAME, f"evidence={evidence.get('oracleSha256')} current={actual}")
    if fixture is not None:
        actual = semantic_seal(fixture)
        findings.require(actual == fixture.get("sealedPayloadSha256"), "P0-FIXTURE-SEMANTIC-SEAL",
                         FIXTURE_NAME, f"stored={fixture.get('sealedPayloadSha256')} current={actual}")
        findings.require(actual == evidence.get("fixtureSha256"), "P0-FIXTURE-EVIDENCE-PIN",
                         FIXTURE_NAME, f"evidence={evidence.get('fixtureSha256')} current={actual}")
        if oracle is not None:
            oracle_ref = fixture.get("oracle")
            findings.require(
                isinstance(oracle_ref, dict)
                and oracle_ref.get("sealedPayloadSha256") == oracle.get("sealedPayloadSha256"),
                "P0-FIXTURE-ORACLE-PIN", FIXTURE_NAME, str(oracle_ref),
            )

    candidate_hashes = evidence.get("candidateHashes")
    if not isinstance(candidate_hashes, dict):
        return
    for label, expected_name in CANDIDATE_FILES.items():
        row = candidate_hashes.get(label)
        if not isinstance(row, dict):
            continue
        path = check_safe_regular_file(root, expected_name, findings, "P0-CANDIDATE-FILE")
        if path is None:
            continue
        actual_file_hash = file_hash(path)
        findings.require(actual_file_hash == row.get("fileSha256"), "P0-CANDIDATE-FILE-HASH",
                         label, f"evidence={row.get('fileSha256')} current={actual_file_hash}")
        if label in CANDIDATES_WITH_SEMANTIC_SEALS:
            try:
                document = strict_json_file(path)
            except (OSError, StrictJsonError) as exc:
                findings.add("P0-CANDIDATE-JSON", label, str(exc))
                continue
            actual_semantic = semantic_seal(document)
            findings.require(actual_semantic == document.get("sealedPayloadSha256"),
                             "P0-CANDIDATE-SEMANTIC-SEAL", label,
                             f"stored={document.get('sealedPayloadSha256')} current={actual_semantic}")
            findings.require(actual_semantic == row.get("sealedPayloadSha256"),
                             "P0-CANDIDATE-SEMANTIC-PIN", label,
                             f"evidence={row.get('sealedPayloadSha256')} current={actual_semantic}")


def _derive_successor_id_projection(
    root: Path,
    findings: Findings,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str] | None]:
    """Derive successor ID/table projections solely from v2 authorities."""
    documents: dict[str, dict[str, Any]] = {}
    for label, name in (
        ("oracle", ORACLE_NAME),
        ("fixture", FIXTURE_NAME),
        ("reviewInventory", REVIEW_INVENTORY_NAME),
    ):
        path = check_safe_regular_file(root, name, findings, "P0-SUCCESSOR-ID-AUTHORITY-FILE")
        if path is None:
            return None, None, None
        try:
            documents[label] = strict_json_file(path)
        except (OSError, StrictJsonError) as exc:
            findings.add("P0-SUCCESSOR-ID-AUTHORITY-JSON", label, str(exc))
            return None, None, None
    oracle = documents["oracle"]
    fixture = documents["fixture"]
    review = documents["reviewInventory"]

    # The successor ID projection is downstream of the same global SSOT owner
    # dependency closure as the oracle/fixture builders.  Validate the exact
    # ordered Listening + PAY rows and the receipts carried by each successor
    # authority before deriving any IDs or PG expectations.
    dependency_receipt: dict[str, Any] | None = None
    try:
        dependency_receipt = verify_successor_owner_dependencies(
            oracle, label="successor oracle.ownerDependencyContracts"
        )
        oracle_profile_receipt = verify_successor_owner_dependency_receipt(
            oracle.get("successorProfile", {}).get("ownerDependencyReceipt"),
            label="successor oracle.successorProfile.ownerDependencyReceipt",
        )
        findings.require(
            oracle_profile_receipt == dependency_receipt,
            "P0-SUCCESSOR-OWNER-RECEIPT-BINDING",
            "successor oracle",
            "profile receipt differs from oracle dependency rows",
        )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-SUCCESSOR-OWNER-DEPENDENCY",
            "successor oracle.ownerDependencyContracts",
            str(exc),
        )
    try:
        verify_successor_closed_set_manifest_reference(
            oracle, label="successor oracle.closedSetManifest"
        )
        findings.require(
            oracle.get("successorProfile", {}).get("closedSetManifestPin")
            == SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
            "P0-SUCCESSOR-MANIFEST-PIN",
            "successor oracle.closedSetManifest",
            "oracle profile closed-set manifest pin drift",
        )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-SUCCESSOR-MANIFEST-PIN",
            "successor oracle.closedSetManifest",
            str(exc),
        )
    try:
        review_receipt = verify_successor_owner_dependencies(
            review, label="successor reviewInventory.ownerDependencyContracts"
        )
        review_profile_receipt = verify_successor_owner_dependency_receipt(
            review.get("successorProfile", {}).get("ownerDependencyReceipt"),
            label="successor reviewInventory.successorProfile.ownerDependencyReceipt",
        )
        findings.require(
            review_profile_receipt == review_receipt,
            "P0-SUCCESSOR-OWNER-RECEIPT-BINDING",
            "successor reviewInventory",
            "profile receipt differs from review dependency rows",
        )
        if dependency_receipt is not None:
            findings.require(
                review_receipt == dependency_receipt,
                "P0-SUCCESSOR-OWNER-REVIEW-BINDING",
                "successor reviewInventory.ownerDependencyContracts",
                "review dependency rows differ from oracle",
            )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-SUCCESSOR-OWNER-REVIEW",
            "successor reviewInventory.ownerDependencyContracts",
            str(exc),
        )
    try:
        verify_successor_closed_set_manifest_reference(
            review, label="successor reviewInventory.closedSetManifest"
        )
        findings.require(
            review.get("successorProfile", {}).get("closedSetManifestPin")
            == SUCCESSOR_CLOSED_SET_MANIFEST_PIN,
            "P0-SUCCESSOR-MANIFEST-PIN",
            "successor reviewInventory.closedSetManifest",
            "review profile closed-set manifest pin drift",
        )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-SUCCESSOR-MANIFEST-PIN",
            "successor reviewInventory.closedSetManifest",
            str(exc),
        )
    try:
        fixture_receipt = verify_successor_owner_dependency_receipt(
            fixture.get("successorProfile", {}).get("ownerDependencyReceipt"),
            label="successor fixture.successorProfile.ownerDependencyReceipt",
        )
        if dependency_receipt is not None:
            findings.require(
                fixture_receipt == dependency_receipt,
                "P0-SUCCESSOR-OWNER-FIXTURE-BINDING",
                "successor fixture.successorProfile.ownerDependencyReceipt",
                "fixture receipt differs from oracle",
            )
    except (SuccessorProfileError, TypeError, ValueError) as exc:
        findings.add(
            "P0-SUCCESSOR-OWNER-FIXTURE",
            "successor fixture.successorProfile.ownerDependencyReceipt",
            str(exc),
        )

    def operation_ids(document: dict[str, Any], mode: str, subject: str) -> list[str]:
        rows = document.get("operations")
        if not isinstance(rows, list):
            findings.add("P0-SUCCESSOR-ID-OPERATIONS", subject, "operations must be an array")
            return []
        values = [row.get("operationId") for row in rows
                  if isinstance(row, dict) and row.get("mode") == mode]
        if any(not isinstance(item, str) or not item for item in values):
            findings.add("P0-SUCCESSOR-ID-SHAPE", subject, "operation IDs must be non-empty strings")
        result = sorted(str(item) for item in values if isinstance(item, str) and item)
        if len(result) != len(set(result)):
            findings.add("P0-SUCCESSOR-ID-DUPLICATE", subject, "duplicate operation ID")
        return result

    def handler_ids(document: dict[str, Any], subject: str) -> list[str]:
        rows = document.get("systemHandlers")
        if not isinstance(rows, list):
            findings.add("P0-SUCCESSOR-ID-HANDLERS", subject, "systemHandlers must be an array")
            return []
        values = [row.get("handlerId") for row in rows if isinstance(row, dict)]
        result = sorted(str(item) for item in values if isinstance(item, str) and item)
        if len(result) != len(values) or len(result) != len(set(result)):
            findings.add("P0-SUCCESSOR-ID-HANDLER-SHAPE", subject, "handler IDs are invalid or duplicate")
        return result

    def decision_ids(document: dict[str, Any], subject: str) -> list[str]:
        result: list[str] = []
        for row in document.get("operations", []) if isinstance(document.get("operations"), list) else []:
            if not isinstance(row, dict) or row.get("mode") != "COMMAND":
                continue
            ordered = row.get("orderedDml", [])
            if isinstance(ordered, list) and any(
                "decision" in json.dumps(step, sort_keys=True).lower()
                for step in ordered
            ):
                operation_id = row.get("operationId")
                if isinstance(operation_id, str) and operation_id:
                    result.append(operation_id)
        result.sort()
        if len(result) != len(set(result)):
            findings.add("P0-SUCCESSOR-ID-DUPLICATE", subject, "duplicate decision operation ID")
        return result

    edge_rows = fixture.get("edgeInventory", {}).get("rows") if isinstance(fixture.get("edgeInventory"), dict) else None
    if not isinstance(edge_rows, list):
        findings.add("P0-SUCCESSOR-ID-EDGES", "fixture", "edgeInventory.rows must be an array")
        return None, None, None
    edge_ids = sorted(str(row.get("edgeId")) for row in edge_rows
                      if isinstance(row, dict) and isinstance(row.get("edgeId"), str))
    if len(edge_ids) != len(edge_rows) or len(edge_ids) != len(set(edge_ids)):
        findings.add("P0-SUCCESSOR-ID-EDGE-SHAPE", "fixture.edges", "edge IDs invalid or duplicate")

    authoritative_sets = {
        "commands": operation_ids(oracle, "COMMAND", "oracle.commands"),
        "queries": operation_ids(oracle, "QUERY", "oracle.queries"),
        "edges": edge_ids,
        "handlers": handler_ids(oracle, "oracle.handlers"),
        "decisions": decision_ids(oracle, "oracle.decisions"),
    }
    review_sets = {
        "commands": operation_ids(review, "COMMAND", "reviewInventory.commands"),
        "queries": operation_ids(review, "QUERY", "reviewInventory.queries"),
        "handlers": handler_ids(review, "reviewInventory.handlers"),
        "decisions": decision_ids(review, "reviewInventory.decisions"),
    }
    expected_counts = {
        "commands": SUCCESSOR_CANONICAL_COUNTS["commands"],
        "queries": SUCCESSOR_CANONICAL_COUNTS["queries"],
        "edges": None,
        "handlers": SUCCESSOR_CANONICAL_COUNTS["systemHandlers"],
    }
    for label, expected in expected_counts.items():
        if expected is not None:
            findings.require(len(authoritative_sets[label]) == expected,
                             "P0-SUCCESSOR-ID-COUNT", f"authoritative.{label}",
                             f"expected={expected} actual={len(authoritative_sets[label])}")
    for label in ("commands", "queries", "handlers"):
        findings.require(authoritative_sets[label] == review_sets[label],
                         "P0-SUCCESSOR-ID-REVIEW-CLOSURE", label,
                         "oracle and review inventory ID sets differ")

    schema = oracle.get("schemaOracle")
    if not isinstance(schema, dict):
        findings.add("P0-SUCCESSOR-SCHEMA-PROJECTION", "oracle", "schemaOracle missing")
        return None, None, None
    tables = schema.get("expectedTables")
    if not isinstance(tables, list) or any(not isinstance(item, str) for item in tables):
        findings.add("P0-SUCCESSOR-SCHEMA-PROJECTION", "oracle", "expectedTables invalid")
        return None, None, None
    expected_tables = [str(item) for item in tables]
    findings.require(expected_tables == sorted(set(expected_tables)),
                     "P0-SUCCESSOR-SCHEMA-PROJECTION-ORDER", "oracle", "tables must be sorted/unique")
    findings.require(
        exact_int(schema.get("expectedTableCountDerived"), SUCCESSOR_CANONICAL_COUNTS["tableSpecifications"])
        and len(expected_tables) == SUCCESSOR_CANONICAL_COUNTS["tableSpecifications"],
        "P0-SUCCESSOR-SCHEMA-PROJECTION-COUNT", "oracle",
        f"declared={schema.get('expectedTableCountDerived')} actual={len(expected_tables)}",
    )
    closure = schema.get("closure")
    findings.require(closure == "EXACT_ACCEPTED_LIVE_TABLE_SPECIFICATION_SET",
                     "P0-SUCCESSOR-SCHEMA-PROJECTION-CLOSURE", "oracle", str(closure))
    schema_projection = {
        "closure": closure,
        "expectedTableCount": schema.get("expectedTableCountDerived"),
        "expectedTables": expected_tables,
    }
    projection = {
        "authoritative": {
            "commandIdsSha256": canonical_value_hash(authoritative_sets["commands"]),
            "queryIdsSha256": canonical_value_hash(authoritative_sets["queries"]),
            "edgeIdsSha256": canonical_value_hash(authoritative_sets["edges"]),
            "handlerIdsSha256": canonical_value_hash(authoritative_sets["handlers"]),
            "decisionIdsSha256": canonical_value_hash(authoritative_sets["decisions"]),
            "schemaProjectionSha256": canonical_value_hash(schema_projection),
        },
        "reviewInventory": {
            "commandIdsSha256": canonical_value_hash(review_sets["commands"]),
            "queryIdsSha256": canonical_value_hash(review_sets["queries"]),
            "handlerIdsSha256": canonical_value_hash(review_sets["handlers"]),
            "decisionIdsSha256": canonical_value_hash(review_sets["decisions"]),
        },
    }
    # Keep the PG fault/marker closure independently derived from the sealed
    # oracle and fixture.  A successor-labeled run that merely changes field
    # names while retaining legacy 372/20/875 values must fail verification.
    command_rows = [
        row for row in oracle.get("operations", [])
        if isinstance(row, dict) and row.get("mode") == "COMMAND"
    ]
    query_rows = [
        row for row in oracle.get("operations", [])
        if isinstance(row, dict) and row.get("mode") == "QUERY"
    ]
    handler_rows = [
        row for row in oracle.get("systemHandlers", [])
        if isinstance(row, dict)
    ]
    derived_decisions = len(authoritative_sets["decisions"])
    derived_scenario_counts = {
        "publicOperations": len(command_rows) + len(query_rows),
        "commands": len(command_rows),
        "queries": len(query_rows),
        "queryCases": len(query_rows) * 6,
        "edges": len(edge_rows),
        "handlers": len(handler_rows),
        "decisionReceipts": derived_decisions,
        "commandRollbackFaults": sum(
            max(1, len(row.get("orderedDml", []))) + 1 for row in command_rows
        ),
        "handlerRollbackFaults": sum(
            max(1, len(row.get("orderedDml", []))) + 1 for row in handler_rows
        ),
        "forbiddenEdges": sum(
            row.get("classification") == "FORBIDDEN_EDGE" for row in edge_rows
            if isinstance(row, dict)
        ),
    }
    # The runner's marker namespace is closed and source-derived: one marker
    # for each operation/query/edge/decision, six per query, four per handler,
    # and the replay/conflict/stale/negative/rollback markers for every
    # command (the latter contributes seven markers per command).
    derived_scenario_counts["markerCount"] = (
        8 * derived_scenario_counts["commands"]
        + 7 * derived_scenario_counts["queries"]
        + derived_scenario_counts["edges"]
        + 4 * derived_scenario_counts["handlers"]
        + derived_scenario_counts["decisionReceipts"]
    )
    authoritative_sets["_successorDerivedScenarioCounts"] = derived_scenario_counts
    return projection, authoritative_sets, expected_tables


def derive_id_projection(
    root: Path, findings: Findings
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str] | None]:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return _derive_successor_id_projection(root, findings)
    documents: dict[str, dict[str, Any]] = {}
    for label, name in (
        ("oracle", ORACLE_NAME),
        ("fixture", FIXTURE_NAME),
        ("reviewInventory", REVIEW_INVENTORY_NAME),
    ):
        path = check_safe_regular_file(root, name, findings, "P0-ID-AUTHORITY-FILE")
        if path is None:
            return None, None, None
        try:
            documents[label] = strict_json_file(path)
        except (OSError, StrictJsonError) as exc:
            findings.add("P0-ID-AUTHORITY-JSON", label, str(exc))
            return None, None, None

    oracle = documents["oracle"]
    fixture = documents["fixture"]
    review = documents["reviewInventory"]
    operations = oracle.get("operations")
    review_operations = review.get("operations")
    if not isinstance(operations, list) or not isinstance(review_operations, list):
        findings.add("P0-ID-OPERATIONS", "oracle/reviewInventory", "operations must be arrays")
        return None, None, None

    def operation_ids(rows: list[Any], mode: str, subject: str) -> list[str]:
        values = [row.get("operationId") for row in rows
                  if isinstance(row, dict) and row.get("mode") == mode]
        if any(not isinstance(item, str) or not item for item in values):
            findings.add("P0-ID-SHAPE", subject, "operation IDs must be non-empty strings")
            return []
        typed = [str(item) for item in values]
        if len(typed) != len(set(typed)):
            findings.add("P0-ID-DUPLICATE", subject, "duplicate operation ID")
        return sorted(typed)

    def decision_ids(rows: list[Any], subject: str) -> list[str]:
        values: list[str] = []
        for row in rows:
            if not isinstance(row, dict) or row.get("mode") != "COMMAND":
                continue
            effects = [
                effect
                for input_effect in row.get("inputEffects", [])
                if isinstance(input_effect, dict)
                for effect in input_effect.get("effects", [])
                if isinstance(effect, dict)
            ]
            if any(effect.get("kind") == "PERSISTED_DECISION_RECEIPT" for effect in effects):
                operation_id = row.get("operationId")
                if isinstance(operation_id, str) and operation_id:
                    values.append(operation_id)
                else:
                    findings.add("P0-ID-SHAPE", subject, "decision operation ID missing")
        if len(values) != len(set(values)):
            findings.add("P0-ID-DUPLICATE", subject, "duplicate decision operation ID")
        return sorted(values)

    def handler_ids(document: dict[str, Any], subject: str) -> list[str]:
        rows = document.get("systemHandlers")
        if not isinstance(rows, list):
            findings.add("P0-ID-HANDLERS", subject, "systemHandlers must be an array")
            return []
        values = [row.get("handlerId") for row in rows if isinstance(row, dict)]
        if any(not isinstance(item, str) or not item for item in values):
            findings.add("P0-ID-SHAPE", subject, "handler IDs must be non-empty strings")
            return []
        typed = [str(item) for item in values]
        if len(typed) != len(set(typed)):
            findings.add("P0-ID-DUPLICATE", subject, "duplicate handler ID")
        return sorted(typed)

    edge_inventory = fixture.get("edgeInventory")
    edge_rows = edge_inventory.get("rows") if isinstance(edge_inventory, dict) else None
    if not isinstance(edge_rows, list):
        findings.add("P0-ID-EDGES", "fixture", "edgeInventory.rows must be an array")
        return None, None, None
    edges = [row.get("edgeId") for row in edge_rows if isinstance(row, dict)]
    if any(not isinstance(item, str) or not item for item in edges):
        findings.add("P0-ID-SHAPE", "fixture.edges", "edge IDs must be non-empty strings")
        return None, None, None
    edge_ids = sorted(str(item) for item in edges)
    if len(edge_ids) != len(set(edge_ids)):
        findings.add("P0-ID-DUPLICATE", "fixture.edges", "duplicate edge ID")

    authoritative_sets = {
        "commands": operation_ids(operations, "COMMAND", "oracle.commands"),
        "queries": operation_ids(operations, "QUERY", "oracle.queries"),
        "edges": edge_ids,
        "handlers": handler_ids(oracle, "oracle.handlers"),
        "decisions": decision_ids(operations, "oracle.decisions"),
    }
    review_sets = {
        "commands": operation_ids(review_operations, "COMMAND", "reviewInventory.commands"),
        "queries": operation_ids(review_operations, "QUERY", "reviewInventory.queries"),
        "handlers": handler_ids(review, "reviewInventory.handlers"),
        "decisions": decision_ids(review_operations, "reviewInventory.decisions"),
    }
    expected_counts = {"commands": 81, "queries": 19, "edges": 58,
                       "handlers": 4, "decisions": 14}
    for label, expected in expected_counts.items():
        findings.require(len(authoritative_sets[label]) == expected, "P0-ID-COUNT",
                         f"authoritative.{label}",
                         f"expected={expected} actual={len(authoritative_sets[label])}")
    for label, expected in (("commands", 81), ("queries", 19),
                            ("handlers", 4), ("decisions", 14)):
        findings.require(len(review_sets[label]) == expected, "P0-ID-COUNT",
                         f"reviewInventory.{label}",
                         f"expected={expected} actual={len(review_sets[label])}")
    for label in ("commands", "queries", "handlers"):
        findings.require(authoritative_sets[label] == review_sets[label],
                         "P0-ID-REVIEW-CLOSURE", label,
                         "oracle and review inventory ID sets differ")

    schema_oracle = oracle.get("schemaOracle")
    if not isinstance(schema_oracle, dict):
        findings.add("P0-SCHEMA-PROJECTION", "oracle", "schemaOracle missing")
        return None, None, None
    tables = schema_oracle.get("expectedTables")
    count = schema_oracle.get("expectedTableCountDerived")
    closure = schema_oracle.get("closure")
    if not isinstance(tables, list) or any(not isinstance(item, str) for item in tables):
        findings.add("P0-SCHEMA-PROJECTION", "oracle", "expectedTables invalid")
        return None, None, None
    expected_tables = [str(item) for item in tables]
    findings.require(expected_tables == sorted(set(expected_tables)),
                     "P0-SCHEMA-PROJECTION-ORDER", "oracle", "tables must be unique and sorted")
    findings.require(exact_int(count, 71) and len(expected_tables) == 71,
                     "P0-SCHEMA-PROJECTION-COUNT", "oracle",
                     f"declared={count} actual={len(expected_tables)}")
    findings.require(closure == "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
                     "P0-SCHEMA-PROJECTION-CLOSURE", "oracle", str(closure))
    schema_projection = {
        "closure": closure,
        "expectedTableCount": count,
        "expectedTables": expected_tables,
    }
    projection = {
        "authoritative": {
            "commandIdsSha256": canonical_value_hash(authoritative_sets["commands"]),
            "queryIdsSha256": canonical_value_hash(authoritative_sets["queries"]),
            "edgeIdsSha256": canonical_value_hash(authoritative_sets["edges"]),
            "handlerIdsSha256": canonical_value_hash(authoritative_sets["handlers"]),
            "decisionIdsSha256": canonical_value_hash(authoritative_sets["decisions"]),
            "schemaProjectionSha256": canonical_value_hash(schema_projection),
        },
        "reviewInventory": {
            "commandIdsSha256": canonical_value_hash(review_sets["commands"]),
            "queryIdsSha256": canonical_value_hash(review_sets["queries"]),
            "handlerIdsSha256": canonical_value_hash(review_sets["handlers"]),
            "decisionIdsSha256": canonical_value_hash(review_sets["decisions"]),
        },
    }
    return projection, authoritative_sets, expected_tables


def _validate_successor_source_authority(
    root: Path,
    evidence: dict[str, Any],
    derived_projection: dict[str, Any] | None,
    findings: Findings,
    now: dt.datetime,
) -> dict[str, Any] | None:
    """Validate source authority against accepted-live bytes, never candidates."""
    path = check_safe_regular_file(root, SOURCE_AUTHORITY_MANIFEST_NAME, findings,
                                   "P0-SUCCESSOR-SOURCE-AUTHORITY-FILE")
    if path is None:
        return None
    try:
        manifest = strict_json_file(path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-SUCCESSOR-SOURCE-AUTHORITY-JSON", SOURCE_AUTHORITY_MANIFEST_NAME, str(exc))
        return None
    require_canonical_json_file(path, manifest, SOURCE_AUTHORITY_MANIFEST_NAME, findings)
    if not exact_keys(manifest, SOURCE_AUTHORITY_MANIFEST_KEYS, "successor.sourceAuthority", findings):
        return manifest
    findings.require(manifest.get("manifestId") == SOURCE_AUTHORITY_ID,
                     "P0-SUCCESSOR-SOURCE-AUTHORITY-ID", "sourceAuthority",
                     str(manifest.get("manifestId")))
    findings.require(exact_int(manifest.get("schemaVersion"), SOURCE_AUTHORITY_SCHEMA_VERSION),
                     "P0-SUCCESSOR-SOURCE-AUTHORITY-VERSION", "sourceAuthority",
                     str(manifest.get("schemaVersion")))
    findings.require(manifest.get("status") == "CURRENT_DIRECT_SOURCE_AUTHORITY_PINNED",
                     "P0-SUCCESSOR-SOURCE-AUTHORITY-STATUS", "sourceAuthority",
                     str(manifest.get("status")))
    findings.require(manifest.get("scope") == REVIEW_SCOPE,
                     "P0-SUCCESSOR-SOURCE-AUTHORITY-SCOPE", "sourceAuthority",
                     str(manifest.get("scope")))
    validate_trusted_tool_root_reference(manifest.get("trustedToolRoot"),
                                         "sourceAuthority.trustedToolRoot", findings)
    check_timestamp_freshness(manifest.get("generatedAt"), now,
                              "sourceAuthority.generatedAt", findings)
    current_seal = semantic_seal(manifest)
    findings.require(manifest.get("sealedPayloadSha256") == current_seal,
                     "P0-SUCCESSOR-SOURCE-AUTHORITY-SEAL", "sourceAuthority",
                     f"stored={manifest.get('sealedPayloadSha256')} current={current_seal}")
    reference = evidence.get("sourceAuthority")
    if isinstance(reference, dict):
        findings.require(reference.get("fileSha256") == file_hash(path),
                         "P0-SUCCESSOR-SOURCE-AUTHORITY-FILE-PIN", "evidence",
                         "file hash differs")
        findings.require(reference.get("sealedPayloadSha256") == current_seal,
                         "P0-SUCCESSOR-SOURCE-AUTHORITY-SEMANTIC-PIN", "evidence",
                         "seal differs")
    try:
        accepted = verify_accepted_live_canonical(root, root.parent)
    except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError) as exc:
        findings.add("P0-SUCCESSOR-ACCEPTED-LIVE-SOURCE", "sourceAuthority",
                     f"{type(exc).__name__}:{exc}")
        return manifest
    sources = manifest.get("sources")
    if not exact_keys(sources, set(SOURCE_AUTHORITY_FILES), "sourceAuthority.sources", findings):
        return manifest
    assert isinstance(sources, dict)
    actual_source_hashes: dict[str, str] = {}
    accepted_key_for_label = {
        "operationSsot": "operationSsot", "exact": "exact", "events": "events",
        "semanticBindings": "semanticBindings", "publicIdentity": "publicIdentity",
        "listeningSuccessorAuthority": "listeningAuthority",
    }
    for label, (expected_path, requires_seal) in SOURCE_AUTHORITY_FILES.items():
        row = sources.get(label)
        expected_keys = SOURCE_AUTHORITY_SOURCE_KEYS if requires_seal else SOURCE_AUTHORITY_SOURCE_KEYS_WITHOUT_SEAL
        if not exact_keys(row, expected_keys, f"sourceAuthority.sources.{label}", findings):
            continue
        assert isinstance(row, dict)
        if label in accepted_key_for_label:
            source = accepted["sources"][accepted_key_for_label[label]]
            actual_path = source.name
        else:
            source = root / expected_path
            actual_path = expected_path
        findings.require(row.get("path") == actual_path, "P0-SUCCESSOR-SOURCE-PATH", label,
                         f"expected={actual_path} actual={row.get('path')}")
        source_path = source if label in accepted_key_for_label else check_safe_regular_file(
            root, expected_path, findings, "P0-SUCCESSOR-SOURCE-FILE"
        )
        if source_path is None:
            continue
        actual_hash = file_hash(source_path)
        actual_source_hashes[label] = actual_hash
        findings.require(row.get("fileSha256") == actual_hash, "P0-SUCCESSOR-SOURCE-FILE-HASH",
                         label, f"manifest={row.get('fileSha256')} current={actual_hash}")
        if requires_seal:
            try:
                source_document = strict_json_file(source_path)
            except (OSError, StrictJsonError) as exc:
                findings.add("P0-SUCCESSOR-SOURCE-JSON", label, str(exc))
                continue
            actual_seal = semantic_seal(source_document)
            findings.require(source_document.get("sealedPayloadSha256") == actual_seal,
                             "P0-SUCCESSOR-SOURCE-SEMANTIC-SEAL", label, "source seal invalid")
            findings.require(row.get("sealedPayloadSha256") == actual_seal,
                             "P0-SUCCESSOR-SOURCE-SEMANTIC-PIN", label, "manifest seal differs")
    causal_pins = manifest.get("causalCanonicalSourcePins")
    expected_causal_keys = set(CAUSAL_PIN_SOURCE_LABELS.values())
    if not exact_keys(causal_pins, expected_causal_keys,
                      "sourceAuthority.causalCanonicalSourcePins", findings):
        causal_pins = None
    else:
        assert isinstance(causal_pins, dict)
        accepted_pin_labels = {
            "exact": "exact", "events": "events", "semanticBindings": "semanticBindings",
            "publicIdentity": "publicIdentity", "listeningSuccessorAuthority": "listeningAuthority",
        }
        for label, file_name in CAUSAL_PIN_SOURCE_LABELS.items():
            actual = file_hash(accepted["sources"][accepted_pin_labels[label]])
            findings.require(causal_pins.get(file_name) == actual,
                             "P0-SUCCESSOR-SOURCE-CAUSAL-PIN", file_name,
                             f"expected={actual} actual={causal_pins.get(file_name)}")
    if derived_projection is not None:
        findings.require(manifest.get("expectedProjection") == derived_projection,
                         "P0-SUCCESSOR-SOURCE-PROJECTION", "sourceAuthority",
                         "manifest projection differs from successor authorities")
        findings.require(evidence.get("expectedProjection") == derived_projection,
                         "P0-SUCCESSOR-EVIDENCE-PROJECTION", "evidence",
                         "evidence projection differs from successor authorities")
    return manifest


def validate_source_authority(
    root: Path,
    evidence: dict[str, Any],
    derived_projection: dict[str, Any] | None,
    findings: Findings,
    now: dt.datetime,
) -> dict[str, Any] | None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        return _validate_successor_source_authority(root, evidence, derived_projection,
                                                    findings, now)
    path = check_safe_regular_file(root, SOURCE_AUTHORITY_MANIFEST_NAME, findings,
                                   "P0-SOURCE-AUTHORITY-FILE")
    if path is None:
        return None
    try:
        manifest = strict_json_file(path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-SOURCE-AUTHORITY-JSON", SOURCE_AUTHORITY_MANIFEST_NAME, str(exc))
        return None
    require_canonical_json_file(path, manifest, SOURCE_AUTHORITY_MANIFEST_NAME, findings)
    if not exact_keys(manifest, SOURCE_AUTHORITY_MANIFEST_KEYS, "sourceAuthority", findings):
        return manifest
    findings.require(manifest.get("manifestId") == SOURCE_AUTHORITY_ID,
                     "P0-SOURCE-AUTHORITY-ID", "sourceAuthority", str(manifest.get("manifestId")))
    findings.require(exact_int(manifest.get("schemaVersion"), SOURCE_AUTHORITY_SCHEMA_VERSION),
                     "P0-SOURCE-AUTHORITY-VERSION", "sourceAuthority",
                     str(manifest.get("schemaVersion")))
    findings.require(manifest.get("status") == "CURRENT_DIRECT_SOURCE_AUTHORITY_PINNED",
                     "P0-SOURCE-AUTHORITY-STATUS", "sourceAuthority",
                     str(manifest.get("status")))
    findings.require(manifest.get("scope") == REVIEW_SCOPE, "P0-SOURCE-AUTHORITY-SCOPE",
                     "sourceAuthority", str(manifest.get("scope")))
    validate_trusted_tool_root_reference(
        manifest.get("trustedToolRoot"), "sourceAuthority.trustedToolRoot", findings,
    )
    check_timestamp_freshness(manifest.get("generatedAt"), now, "sourceAuthority.generatedAt",
                              findings)
    current_seal = semantic_seal(manifest)
    findings.require(current_seal == manifest.get("sealedPayloadSha256"),
                     "P0-SOURCE-AUTHORITY-SEAL", "sourceAuthority",
                     f"stored={manifest.get('sealedPayloadSha256')} current={current_seal}")
    reference = evidence.get("sourceAuthority")
    if isinstance(reference, dict):
        findings.require(reference.get("fileSha256") == file_hash(path),
                         "P0-SOURCE-AUTHORITY-FILE-PIN", "evidence", "file hash differs")
        findings.require(reference.get("sealedPayloadSha256") == current_seal,
                         "P0-SOURCE-AUTHORITY-SEMANTIC-PIN", "evidence", "seal differs")

    sources = manifest.get("sources")
    if not exact_keys(sources, set(SOURCE_AUTHORITY_FILES), "sourceAuthority.sources", findings):
        return manifest
    assert isinstance(sources, dict)
    actual_source_hashes: dict[str, str] = {}
    for label, (expected_path, requires_seal) in SOURCE_AUTHORITY_FILES.items():
        row = sources.get(label)
        expected_keys = (SOURCE_AUTHORITY_SOURCE_KEYS if requires_seal
                         else SOURCE_AUTHORITY_SOURCE_KEYS_WITHOUT_SEAL)
        if not exact_keys(row, expected_keys, f"sourceAuthority.sources.{label}", findings):
            continue
        assert isinstance(row, dict)
        findings.require(row.get("path") == expected_path, "P0-SOURCE-PATH", label,
                         f"expected={expected_path} actual={row.get('path')}")
        source_path = check_safe_regular_file(root, expected_path, findings, "P0-SOURCE-FILE")
        if source_path is None:
            continue
        actual_hash = file_hash(source_path)
        actual_source_hashes[label] = actual_hash
        findings.require(row.get("fileSha256") == actual_hash, "P0-SOURCE-FILE-HASH", label,
                         f"manifest={row.get('fileSha256')} current={actual_hash}")
        if requires_seal:
            try:
                source_document = strict_json_file(source_path)
            except (OSError, StrictJsonError) as exc:
                findings.add("P0-SOURCE-JSON", label, str(exc))
                continue
            actual_seal = semantic_seal(source_document)
            findings.require(source_document.get("sealedPayloadSha256") == actual_seal,
                             "P0-SOURCE-SEMANTIC-SEAL", label, "source seal invalid")
            findings.require(row.get("sealedPayloadSha256") == actual_seal,
                             "P0-SOURCE-SEMANTIC-PIN", label, "manifest seal differs")

    causal_pins = manifest.get("causalCanonicalSourcePins")
    expected_causal_keys = set(CAUSAL_PIN_SOURCE_LABELS.values())
    if not exact_keys(causal_pins, expected_causal_keys,
                      "sourceAuthority.causalCanonicalSourcePins", findings):
        causal_pins = None
    else:
        assert isinstance(causal_pins, dict)
        for label, file_name in CAUSAL_PIN_SOURCE_LABELS.items():
            findings.require(causal_pins.get(file_name) == actual_source_hashes.get(label),
                             "P0-SOURCE-CAUSAL-PIN", file_name, "manifest/current differ")
    causal_path = root / CANDIDATE_FILES["causal"]
    try:
        causal = strict_json_file(causal_path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-SOURCE-CAUSAL-JSON", causal_path.name, str(exc))
    else:
        findings.require(causal.get("canonicalSourcePins") == causal_pins,
                         "P0-SOURCE-CAUSAL-CLOSURE", causal_path.name,
                         "candidate canonicalSourcePins differ from independent manifest")
    validate_expected_projection(manifest.get("expectedProjection"),
                                 "sourceAuthority.expectedProjection", findings)
    if derived_projection is not None:
        findings.require(manifest.get("expectedProjection") == derived_projection,
                         "P0-SOURCE-PROJECTION", "sourceAuthority",
                         "manifest projection differs from current oracle/fixture/review inventory")
        findings.require(evidence.get("expectedProjection") == derived_projection,
                         "P0-EVIDENCE-PROJECTION", "evidence",
                         "evidence projection differs from current authorities")
    return manifest


def validate_control_intake(
    root: Path,
    g0_root: Path,
    evidence: dict[str, Any],
    source_manifest: dict[str, Any] | None,
    findings: Findings,
    now: dt.datetime,
) -> dict[str, Any] | None:
    path = check_safe_regular_file(g0_root, CONTROL_INTAKE_RELATIVE_PATH, findings,
                                   "P0-CONTROL-INTAKE-FILE")
    if path is None:
        return None
    try:
        intake = strict_json_file(path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-CONTROL-INTAKE-JSON", CONTROL_INTAKE_RECORDED_PATH, str(exc))
        return None
    require_canonical_json_file(path, intake, CONTROL_INTAKE_RECORDED_PATH, findings)
    if not exact_keys(intake, CONTROL_INTAKE_KEYS, "controlIntake", findings):
        return intake
    findings.require(intake.get("intakeId") == CONTROL_INTAKE_ID,
                     "P0-CONTROL-INTAKE-ID", "controlIntake", str(intake.get("intakeId")))
    findings.require(exact_int(intake.get("schemaVersion"), CONTROL_INTAKE_SCHEMA_VERSION),
                     "P0-CONTROL-INTAKE-VERSION", "controlIntake",
                     str(intake.get("schemaVersion")))
    findings.require(intake.get("status") == "ACCEPTED_FOR_INTERNAL_REVIEW_WORKFLOW",
                     "P0-CONTROL-INTAKE-STATUS", "controlIntake", str(intake.get("status")))
    findings.require(intake.get("gatePolicy") == GATE_POLICY,
                     "P0-CONTROL-INTAKE-POLICY", "controlIntake", str(intake.get("gatePolicy")))
    findings.require(intake.get("controlRole") == "ROLE.INTEGRATION_CONTROL",
                     "P0-CONTROL-INTAKE-ROLE", "controlIntake", str(intake.get("controlRole")))
    findings.require(intake.get("scope") == REVIEW_SCOPE, "P0-CONTROL-INTAKE-SCOPE",
                     "controlIntake", str(intake.get("scope")))
    findings.require(intake.get("externalIdentityAttestation") == NO_EXTERNAL_IDENTITY,
                     "P0-CONTROL-INTAKE-IDENTITY-SCOPE", "controlIntake",
                     str(intake.get("externalIdentityAttestation")))
    validate_trusted_tool_root_reference(
        intake.get("trustedToolRoot"), "controlIntake.trustedToolRoot", findings,
    )
    check_timestamp_freshness(intake.get("acceptedAt"), now, "controlIntake.acceptedAt", findings)
    current_seal = semantic_seal(intake)
    findings.require(intake.get("sealedPayloadSha256") == current_seal,
                     "P0-CONTROL-INTAKE-SEAL", "controlIntake", "semantic seal invalid")
    evidence_ref = evidence.get("controlIntake")
    if isinstance(evidence_ref, dict):
        findings.require(evidence_ref.get("fileSha256") == file_hash(path),
                         "P0-CONTROL-INTAKE-FILE-PIN", "evidence", "file hash differs")
        findings.require(evidence_ref.get("sealedPayloadSha256") == current_seal,
                         "P0-CONTROL-INTAKE-SEMANTIC-PIN", "evidence", "seal differs")

    source_ref = intake.get("sourceAuthorityManifest")
    if validate_artifact_reference(source_ref, "controlIntake.sourceAuthorityManifest",
                                   f"coding-readiness/{SOURCE_AUTHORITY_MANIFEST_NAME}", findings):
        evidence_source = evidence.get("sourceAuthority")
        if isinstance(evidence_source, dict):
            expected = {**evidence_source, "path": f"coding-readiness/{SOURCE_AUTHORITY_MANIFEST_NAME}"}
            findings.require(source_ref == expected, "P0-CONTROL-SOURCE-MIRROR",
                             "controlIntake", "source authority reference differs")
        if source_manifest is not None:
            findings.require(source_ref.get("sealedPayloadSha256")
                             == source_manifest.get("sealedPayloadSha256"),
                             "P0-CONTROL-SOURCE-SEAL", "controlIntake", "manifest seal differs")
            findings.require(
                source_manifest.get("trustedToolRoot") == intake.get("trustedToolRoot"),
                "P0-CONTROL-TRUSTED-ROOT-MIRROR", "controlIntake",
                "source authority and control intake trusted roots differ",
            )

    tool_pins = intake.get("toolPins")
    if exact_keys(tool_pins, CONTROL_TOOL_LABELS, "controlIntake.toolPins", findings):
        assert isinstance(tool_pins, dict)
        tool_contract = {
            "builder": (BUILDER_NAME, "builderFileSha256"),
            "independentValidator": (INDEPENDENT_VALIDATOR_NAME,
                                     "independentValidatorFileSha256"),
            "runner": (RUNNER_NAME, "runnerFileSha256"),
            "finalVerifier": (VERIFIER_NAME, "verifierFileSha256"),
        }
        for label, (name, evidence_key) in tool_contract.items():
            row = tool_pins.get(label)
            if not exact_keys(row, CONTROL_TOOL_PIN_KEYS, f"controlIntake.toolPins.{label}", findings):
                continue
            assert isinstance(row, dict)
            expected_path = f"coding-readiness/{name}"
            findings.require(row.get("path") == expected_path, "P0-CONTROL-TOOL-PATH", label,
                             f"expected={expected_path} actual={row.get('path')}")
            tool_path = check_safe_regular_file(root, name, findings, "P0-CONTROL-TOOL-FILE")
            if tool_path is None:
                continue
            current = file_hash(tool_path)
            findings.require(row.get("fileSha256") == current, "P0-CONTROL-TOOL-HASH", label,
                             "control pin differs from current bytes")
            if label in TRUSTED_TOOL_ROOT_SPEC["tools"]:
                trusted_row = TRUSTED_TOOL_ROOT_SPEC["tools"][label]
                trusted_hash = trusted_row.get("fileSha256")
                findings.require(row.get("fileSha256") == trusted_hash,
                                 "P0-CONTROL-TRUSTED-TOOL-HASH", label,
                                 "control pin differs from verifier-embedded trusted root")
            findings.require(evidence.get(evidence_key) == current,
                             "P0-CONTROL-EVIDENCE-TOOL-HASH", label,
                             "evidence pin differs from control/current")
    return intake


def _validate_successor_pg_comparison(
    evidence: dict[str, Any],
    findings: Findings,
    expected_sets: dict[str, Any] | None,
    expected_tables: list[str] | None,
    now: dt.datetime | None,
) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        _validate_successor_pg_comparison(evidence, findings, expected_sets,
                                          expected_tables, now)
        return
    runs = evidence.get("runs")
    if not isinstance(runs, list) or len(runs) != 2:
        findings.add("P0-SUCCESSOR-PG-RUNS", "evidence", "exactly two runs are required")
        return
    by_major: dict[int, dict[str, Any]] = {}
    for run in runs:
        if isinstance(run, dict) and type(run.get("postgresMajor")) is int:
            major = run["postgresMajor"]
            if major in by_major:
                findings.add("P0-SUCCESSOR-PG-DUPLICATE-MAJOR", str(major), "duplicate run")
            else:
                by_major[major] = run
    if set(by_major) != {16, 18}:
        findings.add("P0-SUCCESSOR-PG-MAJOR-SET", "runs",
                     f"expected=[16,18] actual={sorted(by_major)}")
        return
    valid = [validate_successor_pg_run(by_major[major], major, findings,
                                       expected_sets, expected_tables, now)
             for major in (16, 18)]
    if not all(valid):
        return
    p16 = comparable_run_hash(by_major[16])
    p18 = comparable_run_hash(by_major[18])
    comparison = evidence.get("executionComparison")
    if not isinstance(comparison, dict):
        return
    findings.require(comparison.get("pg16PayloadSha256") == p16,
                     "P0-SUCCESSOR-PG16-PAYLOAD-HASH", "executionComparison",
                     f"stored={comparison.get('pg16PayloadSha256')} current={p16}")
    findings.require(comparison.get("pg18PayloadSha256") == p18,
                     "P0-SUCCESSOR-PG18-PAYLOAD-HASH", "executionComparison",
                     f"stored={comparison.get('pg18PayloadSha256')} current={p18}")
    findings.require(p16 == p18, "P0-SUCCESSOR-PG-COMPARABILITY", "PG16/PG18",
                     f"PG16={p16} PG18={p18}")
    findings.require(comparison.get("comparableExecutionPayloadSha256") == p16 == p18,
                     "P0-SUCCESSOR-PG-COMPARABLE-PIN", "executionComparison",
                     str(comparison.get("comparableExecutionPayloadSha256")))


def validate_pg_comparison(
    evidence: dict[str, Any],
    findings: Findings,
    expected_sets: dict[str, Any] | None = None,
    expected_tables: list[str] | None = None,
    now: dt.datetime | None = None,
) -> None:
    runs = evidence.get("runs")
    if not isinstance(runs, list) or len(runs) != 2:
        findings.add("P0-PG-RUNS", "evidence", "exactly two runs are required")
        return
    by_major: dict[int, dict[str, Any]] = {}
    for run in runs:
        if isinstance(run, dict) and isinstance(run.get("postgresMajor"), int):
            major = run["postgresMajor"]
            if major in by_major:
                findings.add("P0-PG-DUPLICATE-MAJOR", str(major), "duplicate run")
            else:
                by_major[major] = run
    if set(by_major) != {16, 18}:
        findings.add("P0-PG-MAJOR-SET", "runs", f"expected=[16, 18] actual={sorted(by_major)}")
        return
    valid_results = [
        validate_pg_run(by_major[major], major, findings, expected_tables, now)
        for major in (16, 18)
    ]
    valid_shape = all(valid_results)
    if not valid_shape:
        return
    if expected_sets is not None:
        result_contract = {
            "operationResults81": ("operationId", "commands"),
            "queryResults19": ("operationId", "queries"),
            "edgeResults58": ("edgeId", "edges"),
            "handlerResults4": ("handlerId", "handlers"),
            "decisionReceiptResults": ("operationId", "decisions"),
        }
        for major in (16, 18):
            run = by_major[major]
            for result_key, (id_key, expected_key) in result_contract.items():
                rows = run.get(result_key)
                actual_ids = [row.get(id_key) for row in rows] if isinstance(rows, list) else []
                findings.require(actual_ids == expected_sets[expected_key],
                                 "P0-PG-ID-EXACT-EQUALITY",
                                 f"PG{major}.{result_key}",
                                 f"expectedHash={canonical_value_hash(expected_sets[expected_key])} "
                                 f"actualHash={canonical_value_hash(actual_ids)}")
    p16 = comparable_run_hash(by_major[16])
    p18 = comparable_run_hash(by_major[18])
    comparison = evidence.get("executionComparison")
    if not isinstance(comparison, dict):
        return
    findings.require(comparison.get("pg16PayloadSha256") == p16, "P0-PG16-PAYLOAD-HASH",
                     "executionComparison", f"stored={comparison.get('pg16PayloadSha256')} current={p16}")
    findings.require(comparison.get("pg18PayloadSha256") == p18, "P0-PG18-PAYLOAD-HASH",
                     "executionComparison", f"stored={comparison.get('pg18PayloadSha256')} current={p18}")
    findings.require(p16 == p18, "P0-PG-COMPARABILITY", "PG16/PG18", f"PG16={p16} PG18={p18}")
    findings.require(comparison.get("comparableExecutionPayloadSha256") == p16 == p18,
                     "P0-PG-COMPARABLE-PIN", "executionComparison",
                     str(comparison.get("comparableExecutionPayloadSha256")))


def validate_reciprocal_binding(
    evidence: dict[str, Any],
    report: dict[str, Any],
    report_path: Path,
    findings: Findings,
) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        findings.require(
            evidence.get("evidenceState") == "FINALIZED_SUCCESSOR_V3",
            "P0-SUCCESSOR-FINAL-EVIDENCE-STATE", "evidence",
            str(evidence.get("evidenceState")),
        )
        findings.require(
            evidence.get("unsignedStagingPath") == UNSIGNED_EVIDENCE_RELATIVE_PATH
            and evidence.get("finalEvidencePath") == EVIDENCE_RELATIVE_PATH
            and evidence.get("unsignedStagingPath") != evidence.get("finalEvidencePath"),
            "P0-SUCCESSOR-EVIDENCE-PATH-SEPARATION", "evidence",
            f"unsigned={evidence.get('unsignedStagingPath')} final={evidence.get('finalEvidencePath')}",
        )
    current_e = evidence_core_seal(evidence)
    stored_e = evidence.get("sealedPayloadSha256")
    findings.require(current_e == stored_e, "P0-EVIDENCE-CORE-SEAL", "evidence",
                     f"stored={stored_e} current={current_e}")
    reviewer = evidence.get("secondReviewer")
    if not isinstance(reviewer, dict):
        return
    findings.require(reviewer.get("evidenceCoreSealSha256") == current_e,
                     "P0-REVIEWER-EVIDENCE-SEAL", "secondReviewer",
                     str(reviewer.get("evidenceCoreSealSha256")))

    current_h = report_seal(report)
    stored_h = report.get("sealedPayloadSha256")
    findings.require(current_h == stored_h, "P0-REPORT-CANONICAL-SEAL", "report",
                     f"stored={stored_h} current={current_h}")
    current_r = file_hash(report_path)
    findings.require(reviewer.get("reportSealedPayloadSha256") == current_h,
                     "P0-REPORT-SEAL-RECIPROCAL", "secondReviewer",
                     str(reviewer.get("reportSealedPayloadSha256")))
    findings.require(reviewer.get("reportFileSha256") == current_r,
                     "P0-REPORT-FILE-RECIPROCAL", "secondReviewer",
                     f"stored={reviewer.get('reportFileSha256')} current={current_r}")

    subject = report.get("subject")
    report_reviewer = report.get("reviewer")
    if not isinstance(subject, dict) or not isinstance(report_reviewer, dict):
        return
    findings.require(subject.get("evidenceCoreSealSha256") == current_e,
                     "P0-REPORT-EVIDENCE-RECIPROCAL", "report.subject",
                     str(subject.get("evidenceCoreSealSha256")))
    evidence_to_subject = ({
        "evidenceId": "evidenceId",
        "oracleSha256": "oracleSha256",
        "oracleFileSha256": "oracleFileSha256",
        "fixtureSha256": "fixtureSha256",
        "fixtureFileSha256": "fixtureFileSha256",
        "builderFileSha256": "builderFileSha256",
        "runnerFileSha256": "runnerFileSha256",
        "independentValidatorFileSha256": "independentValidatorFileSha256",
        "verifierFileSha256": "verifierFileSha256",
        "candidateHashes": "candidateHashes",
        "trustedToolRoot": "trustedToolRoot",
        "sourceAuthority": "sourceAuthority",
        "controlIntake": "controlIntake",
        "expectedProjection": "expectedProjection",
    } if ACTIVE_PROFILE != SUCCESSOR_PROFILE else {
        "evidenceId": "evidenceId",
        "oracleSha256": "oracleSha256",
        "oracleFileSha256": "oracleFileSha256",
        "fixtureSha256": "fixtureSha256",
        "fixtureFileSha256": "fixtureFileSha256",
        "builderFileSha256": "builderFileSha256",
        "runnerFileSha256": "runnerFileSha256",
        "independentValidatorFileSha256": "independentValidatorFileSha256",
        "verifierFileSha256": "verifierFileSha256",
        "acceptedLiveSourceHashes": "acceptedLiveSourceHashes",
        "trustedToolRoot": "trustedToolRoot",
        "sourceAuthority": "sourceAuthority",
        "controlIntake": "controlIntake",
        "expectedProjection": "expectedProjection",
    })
    for evidence_key, subject_key in evidence_to_subject.items():
        findings.require(subject.get(subject_key) == evidence.get(evidence_key),
                         "P0-REPORT-SUBJECT-MIRROR", subject_key,
                         "report does not match evidence")
    comparison = evidence.get("executionComparison")
    if isinstance(comparison, dict):
        findings.require(
            subject.get("pgComparableExecutionPayloadSha256")
            == comparison.get("comparableExecutionPayloadSha256"),
            "P0-REPORT-PG-COMPARABLE-MIRROR", "report.subject", "common hash differs",
        )
        findings.require(
            subject.get("pgRunPayloadSha256") == {
                "16": comparison.get("pg16PayloadSha256"),
                "18": comparison.get("pg18PayloadSha256"),
            },
            "P0-REPORT-PG-RUN-MIRROR", "report.subject", "per-run hashes differ",
        )

    producers = evidence.get("producerPrincipalIds")
    findings.require(report_reviewer.get("producerPrincipalIdsReviewed") == producers,
                     "P0-REPORT-PRODUCER-MIRROR", "report.reviewer", "producer IDs differ")
    mirror_pairs = {
        "reviewerId": "reviewerId",
        "reviewerRole": "reviewerRole",
    }
    for evidence_key, report_key in mirror_pairs.items():
        findings.require(reviewer.get(evidence_key) == report_reviewer.get(report_key),
                         "P0-REVIEWER-MIRROR", evidence_key, "evidence/report differ")
    findings.require(reviewer.get("reportId") == report.get("reportId"),
                     "P0-REPORT-ID-MIRROR", "secondReviewer", "evidence/report differ")
    findings.require(reviewer.get("findingCounts") == report.get("findings", {}).get("counts"),
                     "P0-FINDING-COUNT-MIRROR", "secondReviewer", "evidence/report differ")
    findings.require(reviewer.get("reviewedAt") == report.get("reviewedAt"),
                     "P0-REVIEWED-AT-MIRROR", "secondReviewer", "evidence/report differ")


def validate_time_chain(
    evidence: dict[str, Any],
    report: dict[str, Any],
    source_manifest: dict[str, Any] | None,
    control_intake: dict[str, Any] | None,
    findings: Findings,
    now: dt.datetime,
) -> None:
    source_at = check_timestamp_freshness(
        source_manifest.get("generatedAt") if isinstance(source_manifest, dict) else None,
        now, "sourceAuthority.generatedAt", findings,
    ) if source_manifest is not None else None
    control_at = check_timestamp_freshness(
        control_intake.get("acceptedAt") if isinstance(control_intake, dict) else None,
        now, "controlIntake.acceptedAt", findings,
    ) if control_intake is not None else None
    generated_at = check_timestamp_freshness(evidence.get("generatedAt"), now,
                                             "evidence.generatedAt", findings)
    reviewed_at = check_timestamp_freshness(report.get("reviewedAt"), now,
                                            "report.reviewedAt", findings)
    reviewer = evidence.get("secondReviewer")
    reviewer_at = check_timestamp_freshness(
        reviewer.get("reviewedAt") if isinstance(reviewer, dict) else None,
        now, "evidence.secondReviewer.reviewedAt", findings,
    )
    ordered = [item for item in (source_at, control_at, generated_at, reviewed_at) if item is not None]
    if len(ordered) == 4:
        findings.require(ordered == sorted(ordered), "P0-TIMESTAMP-ORDER",
                         "source/control/evidence/report",
                         "required order is sourceAuthority <= controlIntake <= evidence <= report")
    if reviewed_at is not None and reviewer_at is not None:
        findings.require(reviewed_at == reviewer_at, "P0-TIMESTAMP-REVIEW-MIRROR",
                         "reviewedAt", "evidence and report timestamps differ")
    run_ends: list[dt.datetime] = []
    for run in evidence.get("runs", []) if isinstance(evidence.get("runs"), list) else []:
        if not isinstance(run, dict):
            continue
        receipt = run.get("executionReceipt")
        if isinstance(receipt, dict):
            ended = parse_utc_timestamp(receipt.get("endedAt"))
            if ended is not None:
                run_ends.append(ended)
    if generated_at is not None and len(run_ends) == 2:
        findings.require(max(run_ends) <= generated_at, "P0-TIMESTAMP-PG-EVIDENCE-ORDER",
                         "PG/evidence", "PG execution ended after evidence generation")


def decode_receipt_stdout(raw: bytes, name: str, findings: Findings) -> str | None:
    try:
        return raw.decode("utf-8", errors="strict").rstrip("\n")
    except UnicodeDecodeError as exc:
        findings.add("P0-SUBPROCESS-UTF8", name, str(exc))
        return None


def validate_independent_oracle_receipt(
    raw: bytes,
    name: str,
    findings: Findings,
) -> None:
    findings.require(raw.endswith(b"\n") and raw.count(b"\n") == 1
                     and not raw.startswith((b" ", b"\t", b"\r", b"\n")),
                     "P0-SUBPROCESS-RECEIPT-FRAMING", name,
                     "expected exactly one JSON line terminated by LF")
    try:
        payload = strict_json_bytes(raw, name)
    except StrictJsonError as exc:
        findings.add("P0-SUBPROCESS-RECEIPT-JSON", name, str(exc))
        return
    findings.require(raw == canonical_file_bytes(payload),
                     "P0-SUBPROCESS-RECEIPT-CANONICAL", name,
                     "receipt must be canonical compact JSON plus one LF")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        expected_keys = {
            "schema", "mode", "status", "errors", "byCode", "profile", "canonicalCounts",
        }
        if not exact_keys(payload, expected_keys, name, findings):
            return
        findings.require(payload.get("schema") == SUCCESSOR_INDEPENDENT_ORACLE_RECEIPT_SCHEMA,
                         "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")))
        findings.require(payload.get("mode") == "SUCCESSOR_V2_ORACLE",
                         "P0-SUBPROCESS-MODE", name, str(payload.get("mode")))
        findings.require(payload.get("profile") == SUCCESSOR_PROFILE,
                         "P0-SUBPROCESS-PROFILE", name, str(payload.get("profile")))
        findings.require(payload.get("canonicalCounts") == SUCCESSOR_CANONICAL_COUNTS,
                         "P0-SUBPROCESS-COUNTS", name, str(payload.get("canonicalCounts")))
        findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                         str(payload.get("status")))
        findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                         str(payload.get("errors")))
        findings.require(payload.get("byCode") == {}, "P0-SUBPROCESS-BY-CODE", name,
                         str(payload.get("byCode")))
        return
    expected_keys = {"schema", "mode", "status", "errors", "byCode"}
    if not exact_keys(payload, expected_keys, name, findings):
        return
    findings.require(
        payload.get("schema") == INDEPENDENT_ORACLE_RECEIPT_SCHEMA,
        "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")),
    )
    findings.require(payload.get("mode") == "ORACLE_ONLY", "P0-SUBPROCESS-MODE",
                     name, str(payload.get("mode")))
    findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                     str(payload.get("status")))
    findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                     str(payload.get("errors")))
    findings.require(payload.get("byCode") == {}, "P0-SUBPROCESS-BY-CODE", name,
                     str(payload.get("byCode")))


def validate_independent_evidence_receipt(
    raw: bytes,
    root: Path,
    name: str,
    findings: Findings,
) -> None:
    findings.require(raw.endswith(b"\n") and raw.count(b"\n") == 1
                     and not raw.startswith((b" ", b"\t", b"\r", b"\n")),
                     "P0-SUBPROCESS-RECEIPT-FRAMING", name,
                     "expected exactly one JSON line terminated by LF")
    try:
        payload = strict_json_bytes(raw, name)
    except StrictJsonError as exc:
        findings.add("P0-SUBPROCESS-RECEIPT-JSON", name, str(exc))
        return
    findings.require(raw == canonical_file_bytes(payload),
                     "P0-SUBPROCESS-RECEIPT-CANONICAL", name,
                     "receipt must be canonical compact JSON plus one LF")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        expected_keys = {
            "schema", "mode", "status", "errors", "byCode", "evidenceId",
            "evidencePath", "evidenceFileSha256",
        }
        if not exact_keys(payload, expected_keys, name, findings):
            return
        findings.require(payload.get("schema") == SUCCESSOR_INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA,
                         "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")))
        findings.require(payload.get("mode") == "CURRENT_V3_EVIDENCE",
                         "P0-SUBPROCESS-MODE", name, str(payload.get("mode")))
        findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                         str(payload.get("status")))
        findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                         str(payload.get("errors")))
        findings.require(payload.get("byCode") == {}, "P0-SUBPROCESS-BY-CODE", name,
                         str(payload.get("byCode")))
        findings.require(payload.get("evidenceId") == EVIDENCE_ID,
                         "P0-SUBPROCESS-EVIDENCE-ID", name, str(payload.get("evidenceId")))
        findings.require(payload.get("evidencePath") == EVIDENCE_RELATIVE_PATH,
                         "P0-SUBPROCESS-EVIDENCE-PATH", name, str(payload.get("evidencePath")))
        evidence_path = root / EVIDENCE_RELATIVE_PATH
        current_hash = file_hash(evidence_path) if evidence_path.is_file() and not evidence_path.is_symlink() else None
        findings.require(current_hash is not None, "P0-SUBPROCESS-EVIDENCE-CURRENT", name,
                         EVIDENCE_RELATIVE_PATH)
        findings.require(payload.get("evidenceFileSha256") == current_hash,
                         "P0-SUBPROCESS-EVIDENCE-HASH", name,
                         f"receipt={payload.get('evidenceFileSha256')} current={current_hash}")
        return
    expected_keys = {
        "schema", "mode", "status", "errors", "byCode", "evidenceId",
        "evidencePath", "evidenceFileSha256",
    }
    if not exact_keys(payload, expected_keys, name, findings):
        return
    findings.require(
        payload.get("schema") == INDEPENDENT_EVIDENCE_RECEIPT_SCHEMA,
        "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")),
    )
    findings.require(payload.get("mode") == "CURRENT_V2_EVIDENCE",
                     "P0-SUBPROCESS-MODE", name, str(payload.get("mode")))
    findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                     str(payload.get("status")))
    findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                     str(payload.get("errors")))
    findings.require(payload.get("byCode") == {}, "P0-SUBPROCESS-BY-CODE", name,
                     str(payload.get("byCode")))
    findings.require(payload.get("evidenceId") == EVIDENCE_ID,
                     "P0-SUBPROCESS-EVIDENCE-ID", name,
                     str(payload.get("evidenceId")))
    findings.require(payload.get("evidencePath") == EVIDENCE_RELATIVE_PATH,
                     "P0-SUBPROCESS-EVIDENCE-PATH", name,
                     str(payload.get("evidencePath")))
    evidence_path = root / EVIDENCE_RELATIVE_PATH
    current_hash = (
        file_hash(evidence_path)
        if evidence_path.is_file() and not evidence_path.is_symlink()
        else None
    )
    findings.require(current_hash is not None, "P0-SUBPROCESS-EVIDENCE-CURRENT",
                     name, EVIDENCE_RELATIVE_PATH)
    findings.require(payload.get("evidenceFileSha256") == current_hash,
                     "P0-SUBPROCESS-EVIDENCE-HASH", name,
                     f"receipt={payload.get('evidenceFileSha256')} current={current_hash}")


def validate_runner_check_receipt(
    raw: bytes,
    root: Path,
    name: str,
    findings: Findings,
) -> None:
    findings.require(raw.endswith(b"\n") and raw.count(b"\n") == 1
                     and not raw.startswith((b" ", b"\t", b"\r", b"\n")),
                     "P0-SUBPROCESS-RECEIPT-FRAMING", name,
                     "expected exactly one JSON line terminated by LF")
    try:
        payload = strict_json_bytes(raw, name)
    except StrictJsonError as exc:
        findings.add("P0-SUBPROCESS-RECEIPT-JSON", name, str(exc))
        return
    findings.require(raw == canonical_file_bytes(payload),
                     "P0-SUBPROCESS-RECEIPT-CANONICAL", name,
                     "receipt must be canonical compact JSON plus one LF")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        expected_keys = {
            "schema", "mode", "status", "errors", "evidenceId", "evidencePath",
            "evidenceFileSha256", "engines", "counts", "bytesUnchanged", "hostSemaphore",
            "comparableExecutionPayloadSha256",
        }
        if not exact_keys(payload, expected_keys, name, findings):
            return
        findings.require(payload.get("schema") == SUCCESSOR_RUNNER_CHECK_RECEIPT_SCHEMA,
                         "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")))
        findings.require(payload.get("mode") == "CHECK_CURRENT_V3_EVIDENCE",
                         "P0-SUBPROCESS-MODE", name, str(payload.get("mode")))
        findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                         str(payload.get("status")))
        findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                         str(payload.get("errors")))
        findings.require(payload.get("evidenceId") == EVIDENCE_ID,
                         "P0-SUBPROCESS-EVIDENCE-ID", name, str(payload.get("evidenceId")))
        findings.require(payload.get("evidencePath") == EVIDENCE_RELATIVE_PATH,
                         "P0-SUBPROCESS-EVIDENCE-PATH", name, str(payload.get("evidencePath")))
        evidence_path = root / EVIDENCE_RELATIVE_PATH
        current_hash = file_hash(evidence_path) if evidence_path.is_file() and not evidence_path.is_symlink() else None
        findings.require(current_hash is not None, "P0-SUBPROCESS-EVIDENCE-CURRENT", name,
                         EVIDENCE_RELATIVE_PATH)
        findings.require(payload.get("evidenceFileSha256") == current_hash,
                         "P0-SUBPROCESS-EVIDENCE-HASH", name,
                         f"receipt={payload.get('evidenceFileSha256')} current={current_hash}")
        findings.require(payload.get("engines") == [16, 18], "P0-SUBPROCESS-ENGINES",
                         name, str(payload.get("engines")))
        counts = payload.get("counts")
        expected_counts: Any = None
        evidence: dict[str, Any] | None = None
        try:
            if evidence_path.is_file():
                evidence = strict_json_file(evidence_path)
                expected_counts = evidence.get("runs", [{}])[0].get("scenarioCounts")
        except (OSError, StrictJsonError) as exc:
            findings.add("P0-SUBPROCESS-EVIDENCE-JSON", name, str(exc))
        findings.require(counts == expected_counts and isinstance(counts, dict),
                         "P0-SUBPROCESS-COUNTS", name, str(counts))
        findings.require(payload.get("bytesUnchanged") is True, "P0-SUBPROCESS-BYTE-STABILITY",
                         name, str(payload.get("bytesUnchanged")))
        expected_semaphore = {
            "name": HOST_VERIFICATION_SEMAPHORE,
            "protected": True,
            "acquisition": "PARENT_HELD",
        }
        findings.require(payload.get("hostSemaphore") == expected_semaphore,
                         "P0-SUBPROCESS-SEMAPHORE", name, str(payload.get("hostSemaphore")))
        check_hash(payload.get("comparableExecutionPayloadSha256"),
                   f"{name}.comparableExecutionPayloadSha256", findings)
        if evidence is not None:
            expected = evidence.get("executionComparison", {}).get(
                "comparableExecutionPayloadSha256"
            )
            findings.require(payload.get("comparableExecutionPayloadSha256") == expected,
                             "P0-SUBPROCESS-COMPARABLE-HASH", name,
                             f"receipt={payload.get('comparableExecutionPayloadSha256')} evidence={expected}")
        return
    expected_keys = {
        "schema", "mode", "status", "errors", "evidenceId", "evidencePath",
        "evidenceFileSha256", "engines", "counts", "bytesUnchanged",
        "hostSemaphore", "comparableExecutionPayloadSha256",
    }
    if not exact_keys(payload, expected_keys, name, findings):
        return
    findings.require(payload.get("schema") == RUNNER_CHECK_RECEIPT_SCHEMA,
                     "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")))
    findings.require(payload.get("mode") == "CHECK_CURRENT_V2_EVIDENCE",
                     "P0-SUBPROCESS-MODE", name, str(payload.get("mode")))
    findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                     str(payload.get("status")))
    findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                     str(payload.get("errors")))
    findings.require(payload.get("evidenceId") == EVIDENCE_ID,
                     "P0-SUBPROCESS-EVIDENCE-ID", name,
                     str(payload.get("evidenceId")))
    findings.require(payload.get("evidencePath") == EVIDENCE_RELATIVE_PATH,
                     "P0-SUBPROCESS-EVIDENCE-PATH", name,
                     str(payload.get("evidencePath")))
    evidence_path = root / EVIDENCE_RELATIVE_PATH
    current_hash = (
        file_hash(evidence_path)
        if evidence_path.is_file() and not evidence_path.is_symlink()
        else None
    )
    findings.require(current_hash is not None, "P0-SUBPROCESS-EVIDENCE-CURRENT",
                     name, EVIDENCE_RELATIVE_PATH)
    findings.require(payload.get("evidenceFileSha256") == current_hash,
                     "P0-SUBPROCESS-EVIDENCE-HASH", name,
                     f"receipt={payload.get('evidenceFileSha256')} current={current_hash}")
    engines = payload.get("engines")
    findings.require(
        isinstance(engines, list)
        and len(engines) == 2
        and all(type(item) is int for item in engines)
        and engines == [16, 18],
        "P0-SUBPROCESS-ENGINES", name, str(engines),
    )
    counts = payload.get("counts")
    expected_counts = {
        "operations": 162, "queries": 38, "edges": 116,
        "handlers": 8, "forbidden": 10,
    }
    findings.require(
        isinstance(counts, dict)
        and set(counts) == set(expected_counts)
        and all(type(counts.get(key)) is int for key in expected_counts)
        and counts == expected_counts,
        "P0-SUBPROCESS-COUNTS", name, str(counts),
    )
    findings.require(payload.get("bytesUnchanged") is True,
                     "P0-SUBPROCESS-BYTE-STABILITY", name,
                     str(payload.get("bytesUnchanged")))
    semaphore = payload.get("hostSemaphore")
    expected_semaphore = {
        "name": HOST_VERIFICATION_SEMAPHORE,
        "protected": True,
        "acquisition": "PARENT_HELD",
    }
    findings.require(semaphore == expected_semaphore,
                     "P0-SUBPROCESS-SEMAPHORE", name, str(semaphore))
    comparable_hash = payload.get("comparableExecutionPayloadSha256")
    check_hash(comparable_hash, f"{name}.comparableExecutionPayloadSha256", findings)
    try:
        evidence = strict_json_file(evidence_path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-SUBPROCESS-EVIDENCE-JSON", name, str(exc))
        return
    expected_comparable = (
        evidence.get("executionComparison", {})
        .get("comparableExecutionPayloadSha256")
    )
    findings.require(comparable_hash == expected_comparable,
                     "P0-SUBPROCESS-COMPARABLE-HASH", name,
                     f"receipt={comparable_hash} evidence={expected_comparable}")


def validate_design_report_receipt(
    raw: bytes,
    root: Path,
    name: str,
    findings: Findings,
) -> None:
    findings.require(raw.endswith(b"\n") and raw.count(b"\n") == 1
                     and not raw.startswith((b" ", b"\t", b"\r", b"\n")),
                     "P0-SUBPROCESS-RECEIPT-FRAMING", name,
                     "expected exactly one JSON line terminated by LF")
    try:
        payload = strict_json_bytes(raw, name)
    except StrictJsonError as exc:
        findings.add("P0-SUBPROCESS-RECEIPT-JSON", name, str(exc))
        return
    findings.require(raw == canonical_file_bytes(payload),
                     "P0-SUBPROCESS-RECEIPT-CANONICAL", name,
                     "receipt must be canonical compact JSON plus one LF")
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        expected_keys = {"schema", "status", "errors", "reportSha256",
                         "acceptedLiveSourceHashes"}
        if not exact_keys(payload, expected_keys, name, findings):
            return
        findings.require(payload.get("schema")
                         == "dwp.hris.modern.causal-independent-design-report-check.v2",
                         "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")))
        findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                         str(payload.get("status")))
        findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                         str(payload.get("errors")))
        check_hash(payload.get("reportSha256"), f"{name}.reportSha256", findings)
        design_report = root / DESIGN_REPORT_RELATIVE_PATH
        current_report_hash = file_hash(design_report) if design_report.is_file() and not design_report.is_symlink() else None
        findings.require(current_report_hash is not None,
                         "P0-SUBPROCESS-DESIGN-REPORT-CURRENT", name,
                         DESIGN_REPORT_RELATIVE_PATH)
        findings.require(payload.get("reportSha256") == current_report_hash,
                         "P0-SUBPROCESS-DESIGN-REPORT-HASH", name,
                         f"receipt={payload.get('reportSha256')} current={current_report_hash}")
        validate_accepted_live_source_hashes(
            payload.get("acceptedLiveSourceHashes"),
            f"{name}.acceptedLiveSourceHashes", root, findings,
        )
        return
    expected_keys = {"schema", "status", "errors", "reportSha256", "candidateHashes"}
    if not exact_keys(payload, expected_keys, name, findings):
        return
    findings.require(
        payload.get("schema") == "dwp.hris.modern.causal-independent-design-report-check.v1",
        "P0-SUBPROCESS-SCHEMA", name, str(payload.get("schema")),
    )
    findings.require(payload.get("status") == "PASS", "P0-SUBPROCESS-STATUS", name,
                     str(payload.get("status")))
    findings.require(exact_int(payload.get("errors"), 0), "P0-SUBPROCESS-ERRORS", name,
                     str(payload.get("errors")))
    check_hash(payload.get("reportSha256"), f"{name}.reportSha256", findings)
    design_report = root / DESIGN_REPORT_RELATIVE_PATH
    current_report_hash = (
        file_hash(design_report)
        if design_report.is_file() and not design_report.is_symlink()
        else None
    )
    findings.require(current_report_hash is not None,
                     "P0-SUBPROCESS-DESIGN-REPORT-CURRENT", name,
                     DESIGN_REPORT_RELATIVE_PATH)
    findings.require(payload.get("reportSha256") == current_report_hash,
                     "P0-SUBPROCESS-DESIGN-REPORT-HASH", name,
                     f"receipt={payload.get('reportSha256')} current={current_report_hash}")
    candidate_hashes = payload.get("candidateHashes")
    if not exact_keys(candidate_hashes, set(CANDIDATE_FILES), f"{name}.candidateHashes", findings):
        return
    assert isinstance(candidate_hashes, dict)
    for label, expected_path in CANDIDATE_FILES.items():
        row = candidate_hashes.get(label)
        if not exact_keys(row, {"path", "sha256"}, f"{name}.candidateHashes.{label}", findings):
            continue
        assert isinstance(row, dict)
        findings.require(row.get("path") == expected_path, "P0-SUBPROCESS-CANDIDATE-PATH",
                         label, str(row.get("path")))
        current_path = root / expected_path
        current = (
            file_hash(current_path)
            if current_path.is_file() and not current_path.is_symlink()
            else None
        )
        findings.require(current is not None, "P0-SUBPROCESS-CANDIDATE-CURRENT",
                         label, expected_path)
        findings.require(row.get("sha256") == current, "P0-SUBPROCESS-CANDIDATE-HASH",
                         label, f"receipt={row.get('sha256')} current={current}")


def run_typed_subprocess(
    name: str,
    argv: list[str],
    findings: Findings,
    validator: Callable[[bytes, str, Findings], None],
    *,
    cwd: Path,
    environment: dict[str, str] | None = None,
    timeout_seconds: int = 900,
) -> None:
    started = dt.datetime.now(dt.timezone.utc)
    start_mono = time.monotonic()
    try:
        completed = subprocess.run(
            argv,
            cwd=cwd,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=timeout_seconds,
        )
        exit_code: int | None = completed.returncode
        stdout = completed.stdout
        stderr = completed.stderr
    except subprocess.TimeoutExpired as exc:
        exit_code = None
        stdout = exc.stdout or b""
        stderr = exc.stderr or b""
        findings.add("P0-SUBPROCESS-TIMEOUT", name, f"timeout={timeout_seconds}s")
    except OSError as exc:
        exit_code = None
        stdout = b""
        stderr = str(exc).encode("utf-8", errors="replace")
        findings.add("P0-SUBPROCESS-EXEC", name, str(exc))
    ended = dt.datetime.now(dt.timezone.utc)
    receipt = {
        "name": name,
        "argv": argv,
        "argvSha256": canonical_value_hash(argv),
        "stdoutSha256": sha256_bytes(stdout),
        "stderrSha256": sha256_bytes(stderr),
        "exitCode": exit_code,
        "startedAt": started.isoformat(),
        "endedAt": ended.isoformat(),
        "durationMs": int((time.monotonic() - start_mono) * 1000),
    }
    findings.receipts.append(receipt)
    findings.require(exact_int(exit_code, 0), "P0-SUBPROCESS-EXIT", name, str(exit_code))
    findings.require(stderr == b"", "P0-SUBPROCESS-STDERR", name,
                     stderr.decode("utf-8", errors="replace")[:500])
    if exit_code == 0:
        try:
            validator(stdout, name, findings)
        except Exception as exc:
            findings.add("P0-SUBPROCESS-RECEIPT-VALIDATOR", name, repr(exc))


def exact_marker_validator(expected: str) -> Callable[[bytes, str, Findings], None]:
    def validate(raw: bytes, name: str, findings: Findings) -> None:
        expected_bytes = (expected + "\n").encode("utf-8")
        findings.require(raw == expected_bytes, "P0-SUBPROCESS-MARKER", name,
                         f"expectedSha={sha256_bytes(expected_bytes)} actualSha={sha256_bytes(raw)}")
    return validate


def parent_lock_attested() -> bool:
    """Accept parent-held mode only from the process that actually spawned us."""
    declared = os.environ.get("DWP_HRIS_HOST_LOCK_PARENT_PID")
    try:
        declared_pid = int(declared or "-1")
    except ValueError:
        return False
    return (
        declared == str(declared_pid)
        and declared_pid == os.getppid()
        and os.environ.get("DWP_HRIS_HOST_LOCK_NAME")
        == HOST_VERIFICATION_SEMAPHORE
    )


def run_production_subprocess_contracts(
    root: Path,
    findings: Findings,
) -> None:
    for relative in (
        BUILDER_NAME,
        INDEPENDENT_VALIDATOR_NAME,
        RUNNER_NAME,
        ORACLE_NAME,
        FIXTURE_NAME,
        EVIDENCE_RELATIVE_PATH,
        DESIGN_REPORT_RELATIVE_PATH,
        SOURCE_AUTHORITY_MANIFEST_NAME,
    ):
        check_safe_regular_file(root, relative, findings, "P0-SUBPROCESS-DEPENDENCY")
    python = sys.executable
    def trusted_argv(tool_label: str, invocation_id: str) -> list[str]:
        tool = TRUSTED_TOOL_ROOT_SPEC["tools"][tool_label]
        invocation = tool["invocations"][invocation_id]
        suffix = list(invocation["argvSuffix"])
        if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
            suffix.extend(["--profile", SUCCESSOR_PROFILE])
        return [python, str(root / tool["path"]), *suffix]

    def trusted_marker(tool_label: str, invocation_id: str) -> str:
        return TRUSTED_TOOL_ROOT_SPEC["tools"][tool_label]["invocations"][
            invocation_id
        ]["receipt"]["value"]

    specs: list[tuple[
        str, str, str, list[str], Callable[[bytes, str, Findings], None],
        dict[str, str] | None,
    ]] = [
        (
            "builder-check",
            "builder",
            "check",
            trusted_argv("builder", "check"),
            exact_marker_validator(trusted_marker("builder", "check")),
            None,
        ),
        (
            "builder-self-test",
            "builder",
            "selfTest",
            trusted_argv("builder", "selfTest"),
            exact_marker_validator(trusted_marker("builder", "selfTest")),
            None,
        ),
        (
            "independent-oracle-only",
            "independentValidator",
            "oracleOnly",
            trusted_argv("independentValidator", "oracleOnly"),
            validate_independent_oracle_receipt,
            None,
        ),
        (
            "independent-verify-design-report",
            "independentValidator",
            "verifyDesignReport",
            trusted_argv("independentValidator", "verifyDesignReport"),
            lambda raw, name, rows: validate_design_report_receipt(raw, root, name, rows),
            None,
        ),
        (
            "independent-default",
            "independentValidator",
            "currentV2Evidence",
            trusted_argv("independentValidator", "currentV2Evidence"),
            lambda raw, name, rows: validate_independent_evidence_receipt(
                raw, root, name, rows
            ),
            None,
        ),
        (
            "runner-self-test",
            "runner",
            "selfTest",
            trusted_argv("runner", "selfTest"),
            exact_marker_validator(trusted_marker("runner", "selfTest")),
            None,
        ),
    ]
    runner_environment = os.environ.copy()
    runner_environment.update({
        "DWP_HRIS_HOST_LOCK_NAME": HOST_VERIFICATION_SEMAPHORE,
        "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
    })
    specs.append((
        "runner-check",
        "runner",
        "checkCurrentV2Evidence",
        trusted_argv("runner", "checkCurrentV2Evidence"),
        lambda raw, name, rows: validate_runner_check_receipt(
            raw, root, name, rows
        ),
        runner_environment,
    ))
    for name, tool_label, invocation_id, argv, validator, environment in specs:
        expected_argv = trusted_argv(tool_label, invocation_id)
        findings.require(argv == expected_argv, "P0-SUBPROCESS-TRUSTED-ARGV", name,
                         f"expected={expected_argv} actual={argv}")
        run_typed_subprocess(name, argv, findings, validator, cwd=root,
                             environment=environment)
    findings.require(len(findings.receipts) == 7, "P0-SUBPROCESS-RECEIPT-COUNT",
                     "production", str(len(findings.receipts)))


def all_input_snapshot(root: Path, g0_root: Path) -> dict[str, dict[str, Any] | str]:
    root_names = {
        EVIDENCE_RELATIVE_PATH,
        REPORT_RELATIVE_PATH,
        ORACLE_NAME,
        FIXTURE_NAME,
        BUILDER_NAME,
        RUNNER_NAME,
        INDEPENDENT_VALIDATOR_NAME,
        VERIFIER_NAME,
        REVIEW_INVENTORY_NAME,
        REVIEW_FINALIZATION_NAME,
        SOURCE_AUTHORITY_MANIFEST_NAME,
        DESIGN_REPORT_RELATIVE_PATH,
        *CANDIDATE_FILES.values(),
        *(item[0] for item in SOURCE_AUTHORITY_FILES.values()),
    }
    paths = {f"coding-readiness/{name}": root / name for name in root_names}
    paths[CONTROL_INTAKE_RECORDED_PATH] = g0_root / CONTROL_INTAKE_RELATIVE_PATH
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        paths[f"coding-readiness/{SUCCESSOR_ACCEPTED_LIVE_MANIFEST}"] = (
            root / SUCCESSOR_ACCEPTED_LIVE_MANIFEST
        )
        paths[f"coding-readiness/{SUCCESSOR_INDEPENDENT_ACCEPTANCE}"] = (
            root / SUCCESSOR_INDEPENDENT_ACCEPTANCE
        )
        try:
            accepted = verify_accepted_live_canonical(root, root.parent)
        except (OSError, SuccessorProfileError, ValueError, KeyError, TypeError):
            accepted = None
        if accepted is not None:
            for key, source in accepted["sources"].items():
                paths[f"accepted-live/{key}"] = source
    snapshot: dict[str, dict[str, Any] | str] = {}
    for label, path in sorted(paths.items()):
        try:
            metadata = path.lstat()
        except FileNotFoundError:
            snapshot[label] = "MISSING"
            continue
        except OSError as exc:
            snapshot[label] = f"ERROR:{type(exc).__name__}:{exc}"
            continue
        row: dict[str, Any] = {
            "device": metadata.st_dev,
            "inode": metadata.st_ino,
            "mode": stat.S_IMODE(metadata.st_mode),
            "nlink": metadata.st_nlink,
            "size": metadata.st_size,
            "mtimeNs": metadata.st_mtime_ns,
            "ctimeNs": metadata.st_ctime_ns,
            "kind": "symlink" if stat.S_ISLNK(metadata.st_mode)
                    else "regular" if stat.S_ISREG(metadata.st_mode) else "other",
        }
        if stat.S_ISREG(metadata.st_mode):
            try:
                row["sha256"] = file_hash(path)
            except OSError as exc:
                row["sha256"] = f"ERROR:{type(exc).__name__}:{exc}"
        snapshot[label] = row
    return snapshot


def finish_with_stability(
    findings: Findings,
    before: dict[str, dict[str, Any] | str],
    root: Path,
    g0_root: Path,
) -> Findings:
    after = all_input_snapshot(root, g0_root)
    if before != after:
        changed = sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))
        findings.add("P0-ALL-INPUT-STABILITY", "verification-window",
                     f"changed={changed}")
    return findings


def verify_bundle(
    root: Path,
    *,
    g0_root: Path | None = None,
    now: dt.datetime | None = None,
    run_commands: bool = True,
    mutation_hook: Callable[[], None] | None = None,
) -> Findings:
    findings = Findings()
    check_now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    actual_g0 = g0_root or root.parent / "g0"
    initial_snapshot = all_input_snapshot(root, actual_g0)
    validate_internal_trusted_tool_root(
        root, findings, require_frozen=run_commands,
    )

    def finish() -> Findings:
        # Production verification is deliberately on the single exit path so
        # malformed or missing endorsement artifacts cannot bypass executable
        # controls.  Synthetic mutation tests opt out explicitly.
        if mutation_hook is not None:
            mutation_hook()
        if run_commands:
            run_production_subprocess_contracts(root, findings)
        return finish_with_stability(findings, initial_snapshot, root, actual_g0)

    evidence_path = check_safe_regular_file(
        root, EVIDENCE_RELATIVE_PATH, findings, "P0-EVIDENCE-FILE"
    )
    if evidence_path is None:
        legacy = root / LEGACY_EVIDENCE_RELATIVE_PATH
        if legacy.exists():
            findings.add(
                "P0-LEGACY-EVIDENCE-REJECTED",
                LEGACY_EVIDENCE_RELATIVE_PATH,
                "v1 evidence cannot satisfy the final endorsement contract",
            )
        return finish()
    try:
        evidence = strict_json_file(evidence_path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-EVIDENCE-JSON", EVIDENCE_RELATIVE_PATH, str(exc))
        return finish()
    if evidence.get("schemaVersion") != EVIDENCE_SCHEMA_VERSION or evidence.get("evidenceId") != EVIDENCE_ID:
        findings.add(
            "P0-EVIDENCE-V2-REQUIRED",
            EVIDENCE_RELATIVE_PATH,
            f"schemaVersion={evidence.get('schemaVersion')} evidenceId={evidence.get('evidenceId')}",
        )
        return finish()
    require_canonical_json_file(evidence_path, evidence, EVIDENCE_RELATIVE_PATH, findings)
    validate_evidence_schema(evidence, findings, root=root)

    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        unsigned_path = root / UNSIGNED_EVIDENCE_RELATIVE_PATH
        if unsigned_path == evidence_path:
            findings.add(
                "P0-SUCCESSOR-EVIDENCE-PATH-COLLISION",
                "evidence",
                "unsigned staging and finalized evidence paths must be distinct",
            )
        elif unsigned_path.exists() or unsigned_path.is_symlink():
            check_safe_regular_file(root, UNSIGNED_EVIDENCE_RELATIVE_PATH, findings,
                                    "P0-SUCCESSOR-UNSIGNED-EVIDENCE-FILE")

    report_relative = REPORT_RELATIVE_PATH
    reviewer = evidence.get("secondReviewer")
    if isinstance(reviewer, dict) and isinstance(reviewer.get("reportPath"), str):
        if reviewer["reportPath"] != REPORT_RELATIVE_PATH:
            findings.add("P0-REPORT-PATH-CONTRACT", str(reviewer["reportPath"]),
                         f"expected={REPORT_RELATIVE_PATH}")
        else:
            report_relative = reviewer["reportPath"]
    report_path = check_safe_regular_file(root, report_relative, findings, "P0-REPORT-FILE")
    if report_path is None:
        return finish()
    try:
        report = strict_json_file(report_path)
    except (OSError, StrictJsonError) as exc:
        findings.add("P0-REPORT-JSON", report_relative, str(exc))
        return finish()
    require_canonical_json_file(report_path, report, report_relative, findings)
    validate_report_schema(report, findings, root=root)
    validate_current_inputs(root, evidence, findings)
    derived_projection, expected_sets, expected_tables = derive_id_projection(root, findings)
    source_manifest = validate_source_authority(
        root, evidence, derived_projection, findings, check_now
    )
    control_intake = validate_control_intake(
        root, actual_g0, evidence, source_manifest, findings, check_now
    )
    validate_pg_comparison(evidence, findings, expected_sets, expected_tables, check_now)
    validate_reciprocal_binding(evidence, report, report_path, findings)
    validate_time_chain(evidence, report, source_manifest, control_intake, findings, check_now)
    return finish()


def write_json(path: Path, document: dict[str, Any]) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        create_only_bytes(
            path,
            json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False).encode("utf-8") + b"\n",
        )
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
                    encoding="utf-8")


def write_canonical_json(path: Path, document: dict[str, Any]) -> None:
    if ACTIVE_PROFILE == SUCCESSOR_PROFILE:
        create_only_bytes(path, canonical_file_bytes(document))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_file_bytes(document))


def make_synthetic_run(
    major: int,
    expected_tables: list[str],
    now: dt.datetime,
) -> dict[str, Any]:
    schema_hash = sha256_bytes(b"synthetic-schema")
    operations = [f"modern.test.command.{index:03d}" for index in range(1, 82)]
    queries = [f"modern.test.query.{index:03d}" for index in range(1, 20)]
    edges = [f"edge.{index:03d}" for index in range(1, 59)]
    handlers = [f"handler.{index:03d}" for index in range(1, 5)]
    query_cases = sorted([
        "minimum-valid", "optional-absent", "optional-present", "foreign-tenant",
        "wrong-purpose", "cursor-scope-mismatch",
    ])
    schema_projection_object = {
        "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
        "expectedTableCount": 71,
        "expectedTables": expected_tables,
    }
    argv = ["docker", "run", "--rm", f"postgres:{16 if major == 16 else '18.4'}"]
    started = now - dt.timedelta(minutes=20 if major == 16 else 15)
    ended = started + dt.timedelta(minutes=2)
    return {
        "postgresMajor": major,
        "serverVersion": f"PostgreSQL {major}.0 synthetic",
        "serverVersionNum": major * 10000,
        "image": "postgres:16" if major == 16 else "postgres:18.4",
        "schemaHash": schema_hash,
        "operationResults81": [
            {"operationId": item, "status": "PASS"} for item in operations
        ],
        "queryResults19": [
            {"operationId": item, "status": "PASS", "databaseDiff": "EMPTY",
             "cases": query_cases} for item in queries
        ],
        "edgeResults58": [{"edgeId": item, "status": "PASS"} for item in edges],
        "handlerResults4": [
            {"handlerId": item, "status": "PASS", "identicalReplay": "PASS",
             "differentDigestConflict": "PASS", "rollback": "PASS"}
            for item in handlers
        ],
        "rollbackFaultResults": {
            "faultPoints": 372, "status": "PASS", "receiptDomainOutboxAtomic": True,
        },
        "handlerRollbackFaultResults": {
            "faultPoints": 20, "status": "PASS", "inboxDomainOutboxAtomic": True,
        },
        "receiptOutboxReplayResults": [
            {"operationId": item, "identicalReplay": "PASS",
             "differentDigestConflict": "PASS", "duplicateDomainRows": 0,
             "duplicateOutboxRows": 0} for item in operations
        ],
        "tenantPurposeStaleConflictResults": [
            {"operationId": item, "foreignTenant": "PASS", "wrongPurpose": "PASS",
             "staleCas": "PASS", "ownerProofUnavailable": "PASS"} for item in operations
        ],
        "decisionReceiptResults": [
            {"operationId": item, "status": "PASS", "sameTransaction": True,
             "fields": ["ruleId", "inputDigestOrRef", "outcome", "decisionVersion"]}
            for item in operations[:14]
        ],
        "conditionalEventResults": {
            "operationId": "modern.onboarding.task.complete",
            "lastRequiredTask": "PRIMARY_AND_JOURNEY_COMPLETED",
            "nonLastRequiredTask": "PRIMARY_ONLY",
            "status": "PASS",
        },
        "criticalLifecycleResults": {
            "recruitingTwoStepHire": "PASS",
            "compensationSnapshotTimingAndDistinctIds": "PASS",
        },
        "forbiddenEdgeResults": {
            "expected": 5, "passed": 5, "rowCountZero": True, "outboxAbsent": True,
            "preexistingRowsUnchanged": True,
        },
        "scenarioCounts": {
            "schemaHash": schema_hash,
            "rollbackFaultCount": 372,
            "handlerRollbackFaultCount": 20,
            "commandCount": 81,
            "queryCount": 19,
            "queryCaseCount": 114,
            "decisionReceiptCount": 14,
            "edgeCount": 58,
            "handlerCount": 4,
            "markers": 875,
        },
        "schemaProjection": {
            "closure": schema_projection_object["closure"],
            "expectedTableCount": 71,
            "observedTables": expected_tables,
            "oracleProjectionSha256": canonical_value_hash(schema_projection_object),
            "observedProjectionSha256": canonical_value_hash(schema_projection_object),
        },
        "executionReceipt": {
            "imageId": "sha256:" + sha256_bytes(f"image-{major}".encode()),
            "repoDigest": "postgres@sha256:" + sha256_bytes(f"repo-{major}".encode()),
            "containerId": sha256_bytes(f"container-{major}".encode()),
            "argv": argv,
            "argvSha256": canonical_value_hash(argv),
            "stdoutSha256": sha256_bytes(f"stdout-{major}".encode()),
            "stderrSha256": sha256_bytes(b""),
            "exitCode": 0,
            "startedAt": started.isoformat(),
            "endedAt": ended.isoformat(),
        },
        "failures": 0,
    }


def build_synthetic_bundle(root: Path, now: dt.datetime) -> None:
    root.mkdir(parents=True, exist_ok=True)
    # The synthetic bundle copies current trusted tool bytes so its valid
    # baseline exercises the embedded root.  Hostile cases may replace these
    # copies, but cannot rewrite TRUSTED_TOOL_ROOT_SPEC inside this verifier.
    for tool_name in (BUILDER_NAME, RUNNER_NAME, INDEPENDENT_VALIDATOR_NAME):
        shutil.copyfile(BASE / tool_name, root / tool_name)
    shutil.copyfile(Path(__file__).resolve(), root / VERIFIER_NAME)

    commands = [f"modern.test.command.{index:03d}" for index in range(1, 82)]
    queries = [f"modern.test.query.{index:03d}" for index in range(1, 20)]
    handlers = [f"handler.{index:03d}" for index in range(1, 5)]
    decisions = set(commands[:14])
    operations: list[dict[str, Any]] = []
    for operation_id in commands:
        operations.append({
            "operationId": operation_id,
            "mode": "COMMAND",
            "inputEffects": ([{"effects": [{"kind": "PERSISTED_DECISION_RECEIPT"}]}]
                             if operation_id in decisions else []),
        })
    operations.extend({"operationId": operation_id, "mode": "QUERY", "inputEffects": []}
                      for operation_id in queries)
    expected_tables = [f"table_{index:03d}" for index in range(1, 72)]
    oracle = {
        "oracleId": "synthetic",
        "operations": operations,
        "systemHandlers": [{"handlerId": item} for item in handlers],
        "schemaOracle": {
            "closure": "EXACT_SET_NO_OMITTED_OR_UNREVIEWED_EXTRA_PRODUCER_TABLE",
            "expectedTableCountDerived": 71,
            "expectedTables": expected_tables,
        },
        "sealedPayloadSha256": "",
    }
    oracle["sealedPayloadSha256"] = semantic_seal(oracle)
    write_json(root / ORACLE_NAME, oracle)
    review_inventory = {
        "oracleId": "synthetic-review",
        "operations": copy.deepcopy(operations),
        "systemHandlers": [{"handlerId": item} for item in handlers],
        "sealedPayloadSha256": "",
    }
    review_inventory["sealedPayloadSha256"] = semantic_seal(review_inventory)
    write_json(root / REVIEW_INVENTORY_NAME, review_inventory)
    review_finalization = {"status": "FINAL", "sealedPayloadSha256": ""}
    review_finalization["sealedPayloadSha256"] = semantic_seal(review_finalization)
    write_json(root / REVIEW_FINALIZATION_NAME, review_finalization)
    fixture = {
        "fixtureId": "synthetic",
        "oracle": {"sealedPayloadSha256": oracle["sealedPayloadSha256"]},
        "edgeInventory": {"rows": [
            {"edgeId": f"edge.{index:03d}"} for index in range(1, 59)
        ]},
        "sealedPayloadSha256": "",
    }
    fixture["sealedPayloadSha256"] = semantic_seal(fixture)
    write_json(root / FIXTURE_NAME, fixture)

    write_json(root / CANDIDATE_FILES["exact"], {"candidateId": "exact"})
    write_json(root / CANDIDATE_FILES["events"], {"candidateId": "events"})
    semantic = {"sourceId": "semantic", "sealedPayloadSha256": ""}
    semantic["sealedPayloadSha256"] = semantic_seal(semantic)
    write_json(root / SOURCE_AUTHORITY_FILES["semanticBindings"][0], semantic)
    identity = {"sourceId": "identity", "sealedPayloadSha256": ""}
    identity["sealedPayloadSha256"] = semantic_seal(identity)
    write_json(root / SOURCE_AUTHORITY_FILES["publicIdentity"][0], identity)
    write_json(root / SOURCE_AUTHORITY_FILES["operationSsot"][0], {"sourceId": "operation-ssot"})
    listening_successor = {
        "contractId": "dwp.hris.sys.listening.stream-authority-successor.v1",
        "status": "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED",
        "sealedPayloadSha256": "",
    }
    listening_successor["sealedPayloadSha256"] = semantic_seal(listening_successor)
    write_json(
        root / SOURCE_AUTHORITY_FILES["listeningSuccessorAuthority"][0],
        listening_successor,
    )

    causal_pins = {
        file_name: file_hash(root / SOURCE_AUTHORITY_FILES[label][0])
        for label, file_name in CAUSAL_PIN_SOURCE_LABELS.items()
    }
    causal = {
        "candidateId": "causal",
        "canonicalSourcePins": causal_pins,
        "sealedPayloadSha256": "",
    }
    causal["sealedPayloadSha256"] = semantic_seal(causal)
    write_json(root / CANDIDATE_FILES["causal"], causal)
    lineage = {"candidateId": "lineage", "sealedPayloadSha256": ""}
    lineage["sealedPayloadSha256"] = semantic_seal(lineage)
    write_json(root / CANDIDATE_FILES["lineage"], lineage)
    (root / CANDIDATE_FILES["ownership"]).write_text(
        "contract_id,owner\nsynthetic,principal:builder\n", encoding="utf-8"
    )

    projection_findings = Findings()
    expected_projection, _, _ = derive_id_projection(root, projection_findings)
    if projection_findings.rows or expected_projection is None:
        raise AssertionError(f"synthetic projection invalid: {projection_findings.rows}")
    source_rows: dict[str, dict[str, str]] = {}
    for label, (relative, requires_seal) in SOURCE_AUTHORITY_FILES.items():
        source_path = root / relative
        row = {"path": relative, "fileSha256": file_hash(source_path)}
        if requires_seal:
            row["sealedPayloadSha256"] = strict_json_file(source_path)["sealedPayloadSha256"]
        source_rows[label] = row
    source_manifest = {
        "manifestId": SOURCE_AUTHORITY_ID,
        "schemaVersion": SOURCE_AUTHORITY_SCHEMA_VERSION,
        "status": "CURRENT_DIRECT_SOURCE_AUTHORITY_PINNED",
        "scope": REVIEW_SCOPE,
        "generatedAt": (now - dt.timedelta(minutes=40)).isoformat(),
        "trustedToolRoot": trusted_tool_root_reference(),
        "sources": source_rows,
        "causalCanonicalSourcePins": causal_pins,
        "expectedProjection": expected_projection,
        "sealedPayloadSha256": "",
    }
    source_manifest["sealedPayloadSha256"] = semantic_seal(source_manifest)
    source_manifest_path = root / SOURCE_AUTHORITY_MANIFEST_NAME
    write_canonical_json(source_manifest_path, source_manifest)
    source_reference = {
        "path": SOURCE_AUTHORITY_MANIFEST_NAME,
        "fileSha256": file_hash(source_manifest_path),
        "sealedPayloadSha256": source_manifest["sealedPayloadSha256"],
    }

    tool_contract = {
        "builder": BUILDER_NAME,
        "independentValidator": INDEPENDENT_VALIDATOR_NAME,
        "runner": RUNNER_NAME,
        "finalVerifier": VERIFIER_NAME,
    }
    control_intake = {
        "intakeId": CONTROL_INTAKE_ID,
        "schemaVersion": CONTROL_INTAKE_SCHEMA_VERSION,
        "status": "ACCEPTED_FOR_INTERNAL_REVIEW_WORKFLOW",
        "gatePolicy": GATE_POLICY,
        "controlRole": "ROLE.INTEGRATION_CONTROL",
        "scope": REVIEW_SCOPE,
        "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
        "acceptedAt": (now - dt.timedelta(minutes=35)).isoformat(),
        "trustedToolRoot": trusted_tool_root_reference(),
        "sourceAuthorityManifest": {
            **source_reference,
            "path": f"coding-readiness/{SOURCE_AUTHORITY_MANIFEST_NAME}",
        },
        "toolPins": {
            label: {"path": f"coding-readiness/{name}",
                    "fileSha256": file_hash(root / name)}
            for label, name in tool_contract.items()
        },
        "sealedPayloadSha256": "",
    }
    control_intake["sealedPayloadSha256"] = semantic_seal(control_intake)
    synthetic_g0 = root / "g0"
    control_path = synthetic_g0 / CONTROL_INTAKE_RELATIVE_PATH
    write_canonical_json(control_path, control_intake)
    control_reference = {
        "path": CONTROL_INTAKE_RECORDED_PATH,
        "fileSha256": file_hash(control_path),
        "sealedPayloadSha256": control_intake["sealedPayloadSha256"],
    }

    candidate_hashes: dict[str, dict[str, str]] = {}
    for label, relative in CANDIDATE_FILES.items():
        path = root / relative
        row = {"path": relative, "fileSha256": file_hash(path)}
        if label in CANDIDATES_WITH_SEMANTIC_SEALS:
            row["sealedPayloadSha256"] = strict_json_file(path)["sealedPayloadSha256"]
        candidate_hashes[label] = row

    runs = [make_synthetic_run(16, expected_tables, now),
            make_synthetic_run(18, expected_tables, now)]
    p16 = comparable_run_hash(runs[0])
    p18 = comparable_run_hash(runs[1])
    if p16 != p18:
        raise AssertionError("synthetic PG projections must be identical")
    reviewed_at = (now - dt.timedelta(minutes=5)).isoformat()
    evidence: dict[str, Any] = {
        "evidenceId": EVIDENCE_ID,
        "schemaVersion": EVIDENCE_SCHEMA_VERSION,
        "technicalStatus": EVIDENCE_TECHNICAL_STATUS,
        "gatePolicy": GATE_POLICY,
        "generatedAt": (now - dt.timedelta(minutes=10)).isoformat(),
        "producerPrincipalIds": ["principal:builder"],
        "oracleSha256": oracle["sealedPayloadSha256"],
        "oracleFileSha256": file_hash(root / ORACLE_NAME),
        "fixtureSha256": fixture["sealedPayloadSha256"],
        "fixtureFileSha256": file_hash(root / FIXTURE_NAME),
        "builderFileSha256": file_hash(root / BUILDER_NAME),
        "runnerFileSha256": file_hash(root / RUNNER_NAME),
        "independentValidatorFileSha256": file_hash(root / INDEPENDENT_VALIDATOR_NAME),
        "verifierFileSha256": file_hash(root / VERIFIER_NAME),
        "trustedToolRoot": trusted_tool_root_reference(),
        "sourceAuthority": source_reference,
        "controlIntake": control_reference,
        "expectedProjection": expected_projection,
        "candidateHashes": candidate_hashes,
        "runs": runs,
        "executionComparison": {
            "projectionId": PROJECTION_ID,
            "pg16PayloadSha256": p16,
            "pg18PayloadSha256": p18,
            "comparableExecutionPayloadSha256": p16,
        },
        "hostSemaphore": {
            "name": "hris-verification", "protected": True, "acquisition": "DIRECT",
        },
        "secondReviewer": {
            "signed": True,
            "attestationMode": ATTESTATION_MODE,
            "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
            "reviewerId": "reviewer:auditor",
            "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
            "reportId": REPORT_ID,
            "reportPath": REPORT_RELATIVE_PATH,
            "reportSealedPayloadSha256": "0" * 64,
            "reportFileSha256": "0" * 64,
            "evidenceCoreSealSha256": "0" * 64,
            "findingCounts": {"P0": 0, "P1": 0},
            "reviewedAt": reviewed_at,
        },
        "sealedPayloadSha256": "0" * 64,
    }
    current_e = evidence_core_seal(evidence)
    evidence["sealedPayloadSha256"] = current_e
    evidence["secondReviewer"]["evidenceCoreSealSha256"] = current_e
    report: dict[str, Any] = {
        "reportId": REPORT_ID,
        "schemaVersion": REPORT_SCHEMA_VERSION,
        "status": "PASS",
        "scope": REVIEW_SCOPE,
        "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
        "reviewer": {
            "reviewerId": "reviewer:auditor",
            "reviewerRole": "INDEPENDENT_HOSTILE_REVIEWER",
            "independenceAssertion": "DISTINCT_FROM_ALL_PRODUCERS",
            "producerPrincipalIdsReviewed": ["principal:builder"],
        },
        "subject": {
            "evidenceId": EVIDENCE_ID,
            "evidenceCoreSealSha256": current_e,
            "oracleSha256": evidence["oracleSha256"],
            "oracleFileSha256": evidence["oracleFileSha256"],
            "fixtureSha256": evidence["fixtureSha256"],
            "fixtureFileSha256": evidence["fixtureFileSha256"],
            "builderFileSha256": evidence["builderFileSha256"],
            "runnerFileSha256": evidence["runnerFileSha256"],
            "independentValidatorFileSha256": evidence["independentValidatorFileSha256"],
            "verifierFileSha256": evidence["verifierFileSha256"],
            "trustedToolRoot": copy.deepcopy(evidence["trustedToolRoot"]),
            "sourceAuthority": copy.deepcopy(source_reference),
            "controlIntake": copy.deepcopy(control_reference),
            "expectedProjection": copy.deepcopy(expected_projection),
            "candidateHashes": copy.deepcopy(candidate_hashes),
            "pgComparableExecutionPayloadSha256": p16,
            "pgRunPayloadSha256": {"16": p16, "18": p18},
        },
        "findings": {"counts": {"P0": 0, "P1": 0}, "P0": [], "P1": []},
        "assertions": REPORT_ASSERTIONS,
        "reviewedAt": reviewed_at,
        "sealedPayloadSha256": "0" * 64,
    }
    report["sealedPayloadSha256"] = report_seal(report)
    report_path = root / REPORT_RELATIVE_PATH
    write_canonical_json(report_path, report)
    evidence["secondReviewer"]["reportSealedPayloadSha256"] = report["sealedPayloadSha256"]
    evidence["secondReviewer"]["reportFileSha256"] = file_hash(report_path)
    write_canonical_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def read_bundle(root: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    return (
        strict_json_file(root / EVIDENCE_RELATIVE_PATH),
        strict_json_file(root / REPORT_RELATIVE_PATH),
    )


def rebind_bundle(root: Path, evidence: dict[str, Any], report: dict[str, Any],
                  *, sync_subject: bool = True) -> None:
    current_e = evidence_core_seal(evidence)
    evidence["sealedPayloadSha256"] = current_e
    evidence["secondReviewer"]["evidenceCoreSealSha256"] = current_e
    if sync_subject:
        subject = report["subject"]
        subject.update({
            "evidenceId": evidence["evidenceId"],
            "evidenceCoreSealSha256": current_e,
            "oracleSha256": evidence["oracleSha256"],
            "oracleFileSha256": evidence["oracleFileSha256"],
            "fixtureSha256": evidence["fixtureSha256"],
            "fixtureFileSha256": evidence["fixtureFileSha256"],
            "builderFileSha256": evidence["builderFileSha256"],
            "runnerFileSha256": evidence["runnerFileSha256"],
            "independentValidatorFileSha256": evidence["independentValidatorFileSha256"],
            "verifierFileSha256": evidence["verifierFileSha256"],
            "trustedToolRoot": copy.deepcopy(evidence["trustedToolRoot"]),
            "sourceAuthority": copy.deepcopy(evidence["sourceAuthority"]),
            "controlIntake": copy.deepcopy(evidence["controlIntake"]),
            "expectedProjection": copy.deepcopy(evidence["expectedProjection"]),
            "candidateHashes": copy.deepcopy(evidence["candidateHashes"]),
            "pgComparableExecutionPayloadSha256":
                evidence["executionComparison"]["comparableExecutionPayloadSha256"],
            "pgRunPayloadSha256": {
                "16": evidence["executionComparison"]["pg16PayloadSha256"],
                "18": evidence["executionComparison"]["pg18PayloadSha256"],
            },
        })
    report["sealedPayloadSha256"] = report_seal(report)
    report_path = root / REPORT_RELATIVE_PATH
    write_canonical_json(report_path, report)
    evidence["secondReviewer"]["reportSealedPayloadSha256"] = report["sealedPayloadSha256"]
    evidence["secondReviewer"]["reportFileSha256"] = file_hash(report_path)
    write_canonical_json(root / EVIDENCE_RELATIVE_PATH, evidence)


Mutator = Callable[[Path], None]


def mutation_signed_flag(root: Path) -> None:
    evidence, _ = read_bundle(root)
    evidence["secondReviewer"]["signed"] = False
    write_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def mutation_unknown_role(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["secondReviewer"]["reviewerRole"] = "SETTING_ADMIN"
    report["reviewer"]["reviewerRole"] = "SETTING_ADMIN"
    rebind_bundle(root, evidence, report)


def mutation_reviewer_is_producer(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["secondReviewer"]["reviewerId"] = "principal:builder"
    report["reviewer"]["reviewerId"] = "principal:builder"
    rebind_bundle(root, evidence, report)


def mutation_report_id_collision(root: Path) -> None:
    evidence, report = read_bundle(root)
    collision = evidence["secondReviewer"]["reviewerId"]
    evidence["secondReviewer"]["reportId"] = collision
    report["reportId"] = collision
    rebind_bundle(root, evidence, report)


def mutation_missing_ownership(root: Path) -> None:
    evidence, report = read_bundle(root)
    del evidence["candidateHashes"]["ownership"]
    rebind_bundle(root, evidence, report)


def mutation_extra_candidate(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["candidateHashes"]["rogue"] = {
        "path": "rogue.json", "fileSha256": "0" * 64,
    }
    rebind_bundle(root, evidence, report)


def mutation_current_candidate_bytes(root: Path) -> None:
    with (root / CANDIDATE_FILES["ownership"]).open("ab") as stream:
        stream.write(b"tampered,principal:rogue\n")


def mutation_oracle_bytes(root: Path) -> None:
    path = root / ORACLE_NAME
    document = strict_json_file(path)
    document["oracleId"] = "tampered"
    write_json(path, document)


def mutation_fixture_bytes(root: Path) -> None:
    path = root / FIXTURE_NAME
    document = strict_json_file(path)
    document["fixtureId"] = "tampered"
    write_json(path, document)


def mutation_broken_candidate_semantic_seal(root: Path) -> None:
    path = root / CANDIDATE_FILES["causal"]
    document = strict_json_file(path)
    document["candidateId"] = "causal-tampered"
    write_json(path, document)
    evidence, report = read_bundle(root)
    evidence["candidateHashes"]["causal"]["fileSha256"] = file_hash(path)
    rebind_bundle(root, evidence, report)


def mutation_runner_pin(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["runnerFileSha256"] = "0" * 64
    rebind_bundle(root, evidence, report)


def mutation_coherent_runner_rehash(root: Path) -> None:
    with (root / RUNNER_NAME).open("ab") as stream:
        stream.write(b"X")
    evidence, report = read_bundle(root)
    evidence["runnerFileSha256"] = file_hash(root / RUNNER_NAME)
    rebind_bundle(root, evidence, report)


def mutation_coherent_independent_validator_rehash(root: Path) -> None:
    with (root / INDEPENDENT_VALIDATOR_NAME).open("ab") as stream:
        stream.write(b"X")
    evidence, report = read_bundle(root)
    evidence["independentValidatorFileSha256"] = file_hash(root / INDEPENDENT_VALIDATOR_NAME)
    rebind_bundle(root, evidence, report)


def mutation_coherent_final_verifier_rehash(root: Path) -> None:
    with (root / VERIFIER_NAME).open("ab") as stream:
        stream.write(b"X")
    evidence, report = read_bundle(root)
    evidence["verifierFileSha256"] = file_hash(root / VERIFIER_NAME)
    rebind_bundle(root, evidence, report)


def mutation_independent_validator_bytes(root: Path) -> None:
    with (root / INDEPENDENT_VALIDATOR_NAME).open("ab") as stream:
        stream.write(b"X")


def mutation_final_verifier_bytes(root: Path) -> None:
    with (root / VERIFIER_NAME).open("ab") as stream:
        stream.write(b"X")


def mutation_verifier_pin(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["verifierFileSha256"] = "0" * 64
    rebind_bundle(root, evidence, report)


def mutation_pg_divergence(root: Path) -> None:
    evidence, report = read_bundle(root)
    other = sha256_bytes(b"different-schema")
    evidence["runs"][1]["schemaHash"] = other
    evidence["runs"][1]["scenarioCounts"]["schemaHash"] = other
    p18 = comparable_run_hash(evidence["runs"][1])
    evidence["executionComparison"]["pg18PayloadSha256"] = p18
    rebind_bundle(root, evidence, report)


def refresh_execution_hashes(evidence: dict[str, Any]) -> None:
    runs = {row["postgresMajor"]: row for row in evidence["runs"]}
    p16 = comparable_run_hash(runs[16])
    p18 = comparable_run_hash(runs[18])
    evidence["executionComparison"]["pg16PayloadSha256"] = p16
    evidence["executionComparison"]["pg18PayloadSha256"] = p18
    evidence["executionComparison"]["comparableExecutionPayloadSha256"] = p16


def mutation_arbitrary_pg_ids(root: Path) -> None:
    evidence, report = read_bundle(root)
    for run in evidence["runs"]:
        replacement = "modern.aaa.arbitrary"
        run["operationResults81"][0]["operationId"] = replacement
        run["receiptOutboxReplayResults"][0]["operationId"] = replacement
        run["tenantPurposeStaleConflictResults"][0]["operationId"] = replacement
    refresh_execution_hashes(evidence)
    rebind_bundle(root, evidence, report)


def mutation_arbitrary_schema_projection(root: Path) -> None:
    evidence, report = read_bundle(root)
    for run in evidence["runs"]:
        projection = run["schemaProjection"]
        projection["observedTables"][-1] = "zzzz_arbitrary_table"
        observed_object = {
            "closure": projection["closure"],
            "expectedTableCount": projection["expectedTableCount"],
            "expectedTables": projection["observedTables"],
        }
        projection["observedProjectionSha256"] = canonical_value_hash(observed_object)
    refresh_execution_hashes(evidence)
    rebind_bundle(root, evidence, report)


def mutation_arbitrary_images(root: Path) -> None:
    evidence, report = read_bundle(root)
    for run in evidence["runs"]:
        run["image"] = "postgres:latest"
        run["executionReceipt"]["imageId"] = "sha256:" + "a" * 64
        run["executionReceipt"]["repoDigest"] = "postgres@sha256:" + "b" * 64
    rebind_bundle(root, evidence, report)


def mutation_bool_numeric(root: Path) -> None:
    evidence, report = read_bundle(root)
    for run in evidence["runs"]:
        run["failures"] = False
    refresh_execution_hashes(evidence)
    rebind_bundle(root, evidence, report)


def mutation_pg_major_spoof(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["runs"][0]["serverVersionNum"] = 180000
    rebind_bundle(root, evidence, report)


def mutation_evidence_core_reseal_without_report(root: Path) -> None:
    evidence, _ = read_bundle(root)
    evidence["generatedAt"] = "2026-09-15T01:00:00+00:00"
    current_e = evidence_core_seal(evidence)
    evidence["sealedPayloadSha256"] = current_e
    evidence["secondReviewer"]["evidenceCoreSealSha256"] = current_e
    write_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def mutation_reviewer_mirror(root: Path) -> None:
    evidence, _ = read_bundle(root)
    evidence["secondReviewer"]["reviewedAt"] = "2026-09-15T02:00:00+00:00"
    write_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def mutation_report_subject_swap(root: Path) -> None:
    evidence, report = read_bundle(root)
    report["subject"]["evidenceCoreSealSha256"] = "0" * 64
    rebind_bundle(root, evidence, report, sync_subject=False)


def mutation_report_content_keep_seal(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    report = strict_json_file(path)
    report["reviewedAt"] = "2026-09-15T03:00:00+00:00"
    write_json(path, report)


def mutation_report_whitespace(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    path.write_bytes(path.read_bytes() + b" \n")


def mutation_extra_report_key(root: Path) -> None:
    evidence, report = read_bundle(root)
    report["unexpected"] = "forbidden"
    rebind_bundle(root, evidence, report)


def mutation_extra_evidence_key(root: Path) -> None:
    evidence, report = read_bundle(root)
    evidence["unexpected"] = "forbidden"
    rebind_bundle(root, evidence, report)


def mutation_report_p0(root: Path) -> None:
    evidence, report = read_bundle(root)
    report["findings"] = {
        "counts": {"P0": 1, "P1": 0},
        "P0": [{"code": "SYNTHETIC-P0"}],
        "P1": [],
    }
    evidence["secondReviewer"]["findingCounts"] = {"P0": 1, "P1": 0}
    rebind_bundle(root, evidence, report)


def mutation_report_p1(root: Path) -> None:
    evidence, report = read_bundle(root)
    report["findings"] = {
        "counts": {"P0": 0, "P1": 1},
        "P0": [],
        "P1": [{"code": "SYNTHETIC-P1"}],
    }
    evidence["secondReviewer"]["findingCounts"] = {"P0": 0, "P1": 1}
    rebind_bundle(root, evidence, report)


def mutation_path_traversal(root: Path) -> None:
    evidence, _ = read_bundle(root)
    evidence["secondReviewer"]["reportPath"] = "../hostile.json"
    write_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def mutation_missing_source_authority(root: Path) -> None:
    (root / SOURCE_AUTHORITY_MANIFEST_NAME).unlink()


def mutation_missing_control_intake(root: Path) -> None:
    (root / "g0" / CONTROL_INTAKE_RELATIVE_PATH).unlink()


def mutation_coherent_source_manifest_rehash(root: Path) -> None:
    source_path = root / SOURCE_AUTHORITY_FILES["operationSsot"][0]
    with source_path.open("ab") as stream:
        stream.write(b"X")
    manifest_path = root / SOURCE_AUTHORITY_MANIFEST_NAME
    manifest = strict_json_file(manifest_path)
    manifest["sources"]["operationSsot"]["fileSha256"] = file_hash(source_path)
    manifest["sealedPayloadSha256"] = semantic_seal(manifest)
    write_canonical_json(manifest_path, manifest)
    evidence, report = read_bundle(root)
    evidence["sourceAuthority"]["fileSha256"] = file_hash(manifest_path)
    evidence["sourceAuthority"]["sealedPayloadSha256"] = manifest["sealedPayloadSha256"]
    rebind_bundle(root, evidence, report)


def mutation_full_coherent_tool_bundle_replacement(root: Path) -> None:
    """Replace every writable tool pin/seal while leaving verifier code intact."""
    fake_tools = {
        BUILDER_NAME: """#!/usr/bin/env python3
import sys
if "--check" in sys.argv:
    print("MODERN_CAUSAL_ORACLE_CHECK=PASS operations=100 edges=58 failures=0")
else:
    print("MODERN_CAUSAL_ORACLE_SELF_TEST=PASS tests=3 failures=0")
""",
        INDEPENDENT_VALIDATOR_NAME: """#!/usr/bin/env python3
import hashlib, json, pathlib, sys
base = pathlib.Path(__file__).resolve().parent
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
if "--oracle-only" in sys.argv:
    value = {"schema":"dwp.hris.modern.causal-independent-oracle-check.v1","mode":"ORACLE_ONLY","status":"PASS","errors":0,"byCode":{}}
elif "--verify-design-report" in sys.argv:
    names = {"causal":"modern-capability-causal-state-contracts.v2.json","exact":"modern-capability-exact-schema-contracts.v1.json","events":"modern-capability-event-payload-contracts.v1.json","lineage":"modern-capability-event-successor-lineage.v2.json","ownership":"g3-contract-primary-ownership-register.csv"}
    value = {"schema":"dwp.hris.modern.causal-independent-design-report-check.v1","status":"PASS","errors":0,"reportSha256":digest(base / "reports/modern-causal-independent-design-findings.v1.json"),"candidateHashes":{key:{"path":name,"sha256":digest(base / name)} for key,name in names.items()}}
else:
    path = base / "reports/modern-causal-independent-pg-evidence.v2.json"
    value = {"schema":"dwp.hris.modern.causal-independent-evidence-check.v2","mode":"CURRENT_V2_EVIDENCE","status":"PASS","errors":0,"byCode":{},"evidenceId":"dwp.hris.modern.causal-independent-pg-evidence.v2","evidencePath":"reports/modern-causal-independent-pg-evidence.v2.json","evidenceFileSha256":digest(path)}
print(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",",":")))
""",
        RUNNER_NAME: """#!/usr/bin/env python3
import hashlib, json, pathlib, sys
if "--self-test" in sys.argv:
    print("MODERN_CAUSAL_PG_RUNNER_SELF_TEST=PASS tests=8 failures=0")
else:
    base = pathlib.Path(__file__).resolve().parent
    path = base / "reports/modern-causal-independent-pg-evidence.v2.json"
    evidence = json.loads(path.read_text(encoding="utf-8"))
    value = {"schema":"dwp.hris.modern.causal-independent-pg-runner-check.v2","mode":"CHECK_CURRENT_V2_EVIDENCE","status":"PASS","errors":0,"evidenceId":"dwp.hris.modern.causal-independent-pg-evidence.v2","evidencePath":"reports/modern-causal-independent-pg-evidence.v2.json","evidenceFileSha256":hashlib.sha256(path.read_bytes()).hexdigest(),"engines":[16,18],"counts":{"operations":162,"queries":38,"edges":116,"handlers":8,"forbidden":10},"bytesUnchanged":True,"hostSemaphore":{"name":"hris-verification","protected":True,"acquisition":"PARENT_HELD"},"comparableExecutionPayloadSha256":evidence["executionComparison"]["comparableExecutionPayloadSha256"]}
    print(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",",":")))
""",
    }
    for name, content in fake_tools.items():
        (root / name).write_text(content, encoding="utf-8")

    attacker_root = copy.deepcopy(TRUSTED_TOOL_ROOT_SPEC)
    attacker_root["status"] = "TOOLS_FROZEN"
    for label, name in (
        ("builder", BUILDER_NAME),
        ("independentValidator", INDEPENDENT_VALIDATOR_NAME),
        ("runner", RUNNER_NAME),
    ):
        attacker_root["tools"][label]["fileSha256"] = file_hash(root / name)
    attacker_reference = {
        "rootId": attacker_root["rootId"],
        "rootDigest": canonical_value_hash(attacker_root),
    }

    source_path = root / SOURCE_AUTHORITY_MANIFEST_NAME
    source = strict_json_file(source_path)
    source["trustedToolRoot"] = copy.deepcopy(attacker_reference)
    source["sealedPayloadSha256"] = semantic_seal(source)
    write_canonical_json(source_path, source)
    source_reference = {
        "path": SOURCE_AUTHORITY_MANIFEST_NAME,
        "fileSha256": file_hash(source_path),
        "sealedPayloadSha256": source["sealedPayloadSha256"],
    }

    control_path = root / "g0" / CONTROL_INTAKE_RELATIVE_PATH
    control = strict_json_file(control_path)
    control["trustedToolRoot"] = copy.deepcopy(attacker_reference)
    control["sourceAuthorityManifest"] = {
        **source_reference,
        "path": f"coding-readiness/{SOURCE_AUTHORITY_MANIFEST_NAME}",
    }
    for label, name in (
        ("builder", BUILDER_NAME),
        ("independentValidator", INDEPENDENT_VALIDATOR_NAME),
        ("runner", RUNNER_NAME),
    ):
        control["toolPins"][label]["fileSha256"] = file_hash(root / name)
    control["sealedPayloadSha256"] = semantic_seal(control)
    write_canonical_json(control_path, control)
    control_reference = {
        "path": CONTROL_INTAKE_RECORDED_PATH,
        "fileSha256": file_hash(control_path),
        "sealedPayloadSha256": control["sealedPayloadSha256"],
    }

    evidence, report = read_bundle(root)
    evidence["trustedToolRoot"] = copy.deepcopy(attacker_reference)
    evidence["sourceAuthority"] = source_reference
    evidence["controlIntake"] = control_reference
    evidence["builderFileSha256"] = file_hash(root / BUILDER_NAME)
    evidence["independentValidatorFileSha256"] = file_hash(
        root / INDEPENDENT_VALIDATOR_NAME
    )
    evidence["runnerFileSha256"] = file_hash(root / RUNNER_NAME)
    rebind_bundle(root, evidence, report)


def mutation_duplicate_key(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    raw = path.read_text(encoding="utf-8")
    raw = raw.replace('"schemaVersion":1,',
                      '"schemaVersion":1,"schemaVersion":1,', 1)
    path.write_text(raw, encoding="utf-8")


def mutation_bom(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    path.write_bytes(b"\xef\xbb\xbf" + path.read_bytes())


def mutation_nan(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    raw = path.read_text(encoding="utf-8")
    path.write_text(raw.replace('"schemaVersion":1', '"schemaVersion":NaN', 1),
                    encoding="utf-8")


def mutation_exponent(root: Path) -> None:
    path = root / EVIDENCE_RELATIVE_PATH
    raw = path.read_text(encoding="utf-8")
    path.write_text(raw.replace('"schemaVersion":2', '"schemaVersion":1e999', 1),
                    encoding="utf-8")


def mutation_stale_timestamp(root: Path) -> None:
    evidence, report = read_bundle(root)
    stale = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3)).isoformat()
    evidence["secondReviewer"]["reviewedAt"] = stale
    report["reviewedAt"] = stale
    rebind_bundle(root, evidence, report)


def mutation_future_timestamp(root: Path) -> None:
    evidence, report = read_bundle(root)
    future = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=3)).isoformat()
    evidence["secondReviewer"]["reviewedAt"] = future
    report["reviewedAt"] = future
    rebind_bundle(root, evidence, report)


def mutation_symlink(root: Path) -> None:
    path = root / REPORT_RELATIVE_PATH
    real = path.with_name("real-hostile-report.json")
    path.rename(real)
    path.symlink_to(real.name)


def mutation_v1_evidence(root: Path) -> None:
    evidence, _ = read_bundle(root)
    evidence["schemaVersion"] = 1
    evidence["evidenceId"] = "dwp.hris.modern.causal-independent-pg-evidence.v1"
    write_json(root / EVIDENCE_RELATIVE_PATH, evidence)


def mutation_missing_report(root: Path) -> None:
    (root / REPORT_RELATIVE_PATH).unlink()


SELF_TEST_MUTATIONS: list[tuple[str, Mutator]] = [
    ("signed-boolean-flip", mutation_signed_flag),
    ("unknown-reviewer-role", mutation_unknown_role),
    ("reviewer-equals-producer", mutation_reviewer_is_producer),
    ("reviewer-report-id-collision", mutation_report_id_collision),
    ("missing-ownership-candidate", mutation_missing_ownership),
    ("extra-candidate", mutation_extra_candidate),
    ("current-candidate-byte-change", mutation_current_candidate_bytes),
    ("current-oracle-byte-change", mutation_oracle_bytes),
    ("current-fixture-byte-change", mutation_fixture_bytes),
    ("candidate-semantic-seal-change", mutation_broken_candidate_semantic_seal),
    ("runner-current-hash-spoof", mutation_runner_pin),
    ("coherent-runner-rehash", mutation_coherent_runner_rehash),
    ("coherent-independent-validator-rehash", mutation_coherent_independent_validator_rehash),
    ("coherent-final-verifier-rehash", mutation_coherent_final_verifier_rehash),
    ("full-coherent-three-tool-bundle-replacement",
     mutation_full_coherent_tool_bundle_replacement),
    ("independent-validator-one-byte-change", mutation_independent_validator_bytes),
    ("final-verifier-one-byte-change", mutation_final_verifier_bytes),
    ("verifier-current-hash-spoof", mutation_verifier_pin),
    ("pg16-pg18-divergence", mutation_pg_divergence),
    ("arbitrary-pg-identifiers", mutation_arbitrary_pg_ids),
    ("arbitrary-schema-projection", mutation_arbitrary_schema_projection),
    ("arbitrary-postgres-image", mutation_arbitrary_images),
    ("bool-as-numeric-zero", mutation_bool_numeric),
    ("postgres-major-spoof", mutation_pg_major_spoof),
    ("evidence-core-reseal-without-report", mutation_evidence_core_reseal_without_report),
    ("reviewer-mirror-change", mutation_reviewer_mirror),
    ("report-swap-evidence-seal", mutation_report_subject_swap),
    ("report-content-keep-seal", mutation_report_content_keep_seal),
    ("report-whitespace-file-sha", mutation_report_whitespace),
    ("extra-report-key", mutation_extra_report_key),
    ("extra-evidence-key", mutation_extra_evidence_key),
    ("nonzero-p0", mutation_report_p0),
    ("nonzero-p1", mutation_report_p1),
    ("report-path-traversal", mutation_path_traversal),
    ("missing-source-authority", mutation_missing_source_authority),
    ("missing-g0-control-intake", mutation_missing_control_intake),
    ("coherent-source-manifest-rehash", mutation_coherent_source_manifest_rehash),
    ("duplicate-json-key", mutation_duplicate_key),
    ("utf8-bom", mutation_bom),
    ("nan-json", mutation_nan),
    ("exponent-json-number", mutation_exponent),
    ("stale-timestamp", mutation_stale_timestamp),
    ("future-timestamp", mutation_future_timestamp),
    ("report-symlink", mutation_symlink),
    ("legacy-v1-evidence", mutation_v1_evidence),
    ("missing-report", mutation_missing_report),
]


def run_self_test() -> dict[str, Any]:
    failures: list[dict[str, Any]] = []
    test_now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with tempfile.TemporaryDirectory(prefix="modern-causal-final-endorsement-") as temporary:
        fixture_root = Path(temporary) / "baseline"
        build_synthetic_bundle(fixture_root, test_now)
        evidence_path = fixture_root / EVIDENCE_RELATIVE_PATH
        report_path = fixture_root / REPORT_RELATIVE_PATH
        before = (file_hash(evidence_path), file_hash(report_path))
        baseline = verify_bundle(
            fixture_root, g0_root=fixture_root / "g0", now=test_now,
            run_commands=False,
        )
        after = (file_hash(evidence_path), file_hash(report_path))
        if baseline.rows:
            failures.append({"case": "baseline-valid", "findings": baseline.rows[:10]})
        if before != after:
            failures.append({"case": "baseline-byte-stability", "before": before, "after": after})

        for case_name, mutator in SELF_TEST_MUTATIONS:
            case_root = Path(temporary) / case_name
            shutil.copytree(fixture_root, case_root)
            try:
                mutator(case_root)
                result = verify_bundle(
                    case_root, g0_root=case_root / "g0", now=test_now,
                    run_commands=False,
                )
            except Exception as exc:  # A verifier self-test must report, not hide, harness failures.
                failures.append({"case": case_name, "harnessError": repr(exc)})
                continue
            if not result.rows:
                failures.append({"case": case_name, "detail": "mutation was accepted"})
            if (
                case_name == "full-coherent-three-tool-bundle-replacement"
                and not any(row["code"] == "P0-TRUSTED-TOOL-HASH"
                            for row in result.rows)
            ):
                failures.append({
                    "case": case_name,
                    "detail": "coherent replacement did not fail on embedded trusted tool bytes",
                    "findings": result.rows[:10],
                })

        toctou_root = Path(temporary) / "input-toctou"
        shutil.copytree(fixture_root, toctou_root)
        toctou_target = toctou_root / CANDIDATE_FILES["ownership"]

        def mutate_during_verification() -> None:
            with toctou_target.open("ab") as stream:
                stream.write(b"toctou,principal:rogue\n")

        toctou_result = verify_bundle(
            toctou_root,
            g0_root=toctou_root / "g0",
            now=test_now,
            run_commands=False,
            mutation_hook=mutate_during_verification,
        )
        if not any(row["code"] == "P0-ALL-INPUT-STABILITY" for row in toctou_result.rows):
            failures.append({"case": "input-toctou", "findings": toctou_result.rows[:10]})

        receipt_rows = Findings()
        exact_marker_validator("EXPECTED=PASS")(b"EXPECTED=PASS\n", "receipt-baseline", receipt_rows)
        if receipt_rows.rows:
            failures.append({"case": "typed-receipt-baseline", "findings": receipt_rows.rows})
        forged_receipt_rows = Findings()
        exact_marker_validator("EXPECTED=PASS")(b"EXPECTED=PASS extra\n", "receipt-forgery",
                                                 forged_receipt_rows)
        if not forged_receipt_rows.rows:
            failures.append({"case": "typed-receipt-forgery", "detail": "forged marker accepted"})

    return {
        "schema": "dwp.hris.modern.causal-final-endorsement-self-test.v3",
        "status": "PASS" if not failures else "FAIL",
        "baseline": "PASS" if not failures or failures[0].get("case") not in {
            "baseline-valid", "baseline-byte-stability"
        } else "FAIL",
        "negativeMutationCases": len(SELF_TEST_MUTATIONS) + 2,
        "failures": failures,
        "trustedToolRoot": trusted_tool_root_reference(),
        "trustAnchorStatus": TRUSTED_TOOL_ROOT_SPEC["status"],
        "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
    }


def emit(payload: dict[str, Any], compact: bool) -> None:
    print(json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":") if compact else None,
        indent=None if compact else 2,
    ))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true",
                        help="run valid-baseline and fail-closed mutation tests in a temp directory")
    parser.add_argument("--compact", action="store_true", help="emit one-line JSON")
    parser.add_argument(
        "--host-lock-held-by-parent",
        action="store_true",
        help="integration-only mode; requires exact parent PID/name attestation",
    )
    parser.add_argument(
        "--host-semaphore-timeout",
        type=int,
        default=300,
        metavar="SECONDS",
        help="direct-mode semaphore wait (0..300; default 300)",
    )
    args = parser.parse_args()

    if not 0 <= args.host_semaphore_timeout <= 300:
        parser.error("--host-semaphore-timeout must be between 0 and 300")
    if args.self_test and args.host_lock_held_by_parent:
        parser.error("--host-lock-held-by-parent cannot be combined with --self-test")

    if args.self_test:
        payload = run_self_test()
        emit(payload, args.compact)
        return 0 if payload["status"] == "PASS" else 1

    before: dict[str, str | None] = {}
    for relative in (EVIDENCE_RELATIVE_PATH, REPORT_RELATIVE_PATH):
        path = BASE / relative
        before[relative] = file_hash(path) if path.is_file() and not path.is_symlink() else None
    semaphore_receipt: dict[str, Any] | None = None
    if args.host_lock_held_by_parent:
        if not parent_lock_attested():
            findings = Findings()
            findings.add(
                "P0-HOST-SEMAPHORE-ATTESTATION",
                HOST_VERIFICATION_SEMAPHORE,
                "parent PID/name attestation is absent or does not match the spawning process",
            )
            semaphore_receipt = {
                "schema": "dwp.hris.host-semaphore-parent-attestation.v1",
                "name": HOST_VERIFICATION_SEMAPHORE,
                "status": "REJECTED",
                "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
            }
        else:
            semaphore_receipt = {
                "schema": "dwp.hris.host-semaphore-parent-attestation.v1",
                "name": HOST_VERIFICATION_SEMAPHORE,
                "status": "PARENT_ATTESTED",
                "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
            }
            try:
                findings = verify_bundle(BASE, g0_root=G0, run_commands=True)
            except Exception as exc:
                findings = Findings()
                findings.add("P0-VERIFIER-UNHANDLED", VERIFIER_NAME, repr(exc))
    else:
        try:
            with exclusive_host_semaphore(
                HOST_VERIFICATION_SEMAPHORE,
                timeout_seconds=float(args.host_semaphore_timeout),
            ) as active_receipt:
                findings = verify_bundle(BASE, g0_root=G0, run_commands=True)
            semaphore_receipt = copy.deepcopy(active_receipt)
        except SemaphoreTimeoutError as exc:
            findings = Findings()
            findings.add("P0-HOST-SEMAPHORE-TIMEOUT", HOST_VERIFICATION_SEMAPHORE,
                         str(exc))
            semaphore_receipt = copy.deepcopy(exc.metadata)
        except Exception as exc:
            findings = Findings()
            findings.add("P0-VERIFIER-UNHANDLED", VERIFIER_NAME, repr(exc))
    after: dict[str, str | None] = {}
    for relative in (EVIDENCE_RELATIVE_PATH, REPORT_RELATIVE_PATH):
        path = BASE / relative
        after[relative] = file_hash(path) if path.is_file() and not path.is_symlink() else None
    if before != after:
        findings.add("P0-VERIFIER-BYTE-STABILITY", "evidence/report",
                     f"before={before} after={after}")
    payload = {
        "schema": "dwp.hris.modern.causal-final-endorsement-check.v3",
        "status": "PASS" if not findings.rows else "FAIL",
        "errors": len(findings.rows),
        "findings": findings.rows,
        "subprocessReceipts": findings.receipts,
        "hostSemaphore": semaphore_receipt,
        "evidence": EVIDENCE_RELATIVE_PATH,
        "report": REPORT_RELATIVE_PATH,
        "bytesUnchanged": before == after,
        "trustedToolRoot": trusted_tool_root_reference(),
        "trustAnchorStatus": TRUSTED_TOOL_ROOT_SPEC["status"],
        "verifierThreatModel": TRUSTED_TOOL_ROOT_SPEC["threatModel"],
        "externalIdentityAttestation": NO_EXTERNAL_IDENTITY,
    }
    emit(payload, args.compact)
    return 0 if not findings.rows else 1


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
