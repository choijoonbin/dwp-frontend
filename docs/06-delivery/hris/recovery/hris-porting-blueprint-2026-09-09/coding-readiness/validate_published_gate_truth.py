#!/usr/bin/env python3
"""Verify that the published HRIS coding-gate declaration is a current LIVE result.

The default mode additionally reruns the global G0 live checkpoint and remains
the only mode for initially opening the coding gate.  ``--verify-seal-only`` is
for resuming an already-open module session: it verifies the sealed LIVE report,
Markdown/declaration, checkpoints and every published artifact digest without
re-running a global clean-worktree check against deliberately active sessions.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from validate_full_coding_readiness import artifact_paths, markdown_report


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT_JSON = HERE / "reports/full-coding-readiness-latest.json"
REPORT_MD = HERE / "reports/full-coding-readiness-latest.md"
DECLARATION = ROOT / "README.md"
CHECKPOINT = ROOT / "g0/checkpoint-register.csv"
G3_CHECKPOINT = ROOT / "g0/g3-checkpoint-register.csv"
G0_LIVE_VALIDATOR = ROOT / "g0/validate_code_checkpoint.py"

# These assurance groups are not optional documentation. They are direct authority
# inputs for the late C1/C2/C3 closures and the modern semantic contract gate.
# Keeping the groups explicit also lets the self-test prove that every new
# authority family is covered by the published digest manifest.
REQUIRED_ASSURANCE_ARTIFACTS: dict[str, frozenset[str]] = {
    "c1-migration-successor": frozenset(
        {
            "g0/migration-successor-register.v1.json",
            "g0/migration-allocation-register.csv",
            "g0/migration-stream-register.csv",
            "g0/g3-verification-command-catalog.v1.json",
            "coding-readiness/generate_g3_slice_code_go_register.py",
            "coding-readiness/validate_g3_slice_code_go.py",
            "coding-readiness/g3-slice-code-go-register.csv",
            "coding-readiness/validate_full_coding_readiness.py",
            "g0/validate_migration_successor.py",
        }
    ),
    "c2-identity-consumers": frozenset(
        {
            "coding-readiness/validate_identity_c2_consumers.py",
            "g0/integration-baseline-manifest.csv",
            "g0/blueprint-central-snapshot-manifest.v1.json",
        }
    ),
    "c3-optional-capability": frozenset(
        {
            "coding-readiness/optional-capability-admission-contract.v1.json",
            "coding-readiness/validate_optional_capability_admission.py",
            "coding-readiness/optional-capability-implementation-manifest.v1.json",
            "coding-readiness/validate_optional_capability_implementation.py",
        }
    ),
    "modern-semantic-contract": frozenset(
        {
            "modern-hris-capability-roadmap.csv",
            "target-table-catalog.md",
            "coding-readiness/modern-capability-delivery-register.csv",
            "coding-readiness/modern-capability-trace-register.csv",
            "coding-readiness/modern-capability-coding-contract-register.csv",
            "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
            "coding-readiness/modern-capability-event-payload-contracts.v1.json",
            "coding-readiness/modern-capability-semantic-bindings.v1.json",
            "coding-readiness/modern-capability-public-identity-registry.v1.json",
            "coding-readiness/modern-menu-node-register.csv",
            "coding-readiness/modern-capability-authorization-register.csv",
            "coding-readiness/07-modern-capability-coding-contract.md",
            "coding-readiness/validate_modern_capability_contracts.py",
            "coding-readiness/validate_modern_capability_authorization.py",
            "coding-readiness/generate_modern_semantic_field_lineage.py",
            "coding-readiness/validate_modern_semantic_field_lineage.py",
            "coding-readiness/test_modern_semantic_field_lineage.py",
            "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
            "session-evidence/per/g3-modern-capability-contracts.v2.json",
            "session-evidence/tim/g3-modern-capability-contracts.v1.json",
            "session-evidence/sys/g3-modern-capability-contracts.v1.json",
            "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
            "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
            "session-evidence/per/g2-readiness/physical-schema.sql",
            "session-evidence/tim/g2-physical-schema.sql",
            "session-evidence/pay/g2-physical-schema.sql",
            "session-evidence/sys/g2-physical-schema.sql",
        }
    ),
    "modern-causal-contract": frozenset(
        {
            "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json",
            "coding-readiness/modern-capability-causal-state-contracts.v2.json",
            "coding-readiness/modern-capability-event-successor-lineage.v2.json",
            "coding-readiness/generate_modern_causal_successor.py",
            "coding-readiness/modern_causal_successor.py",
            "coding-readiness/modern_causal_candidate_projection.py",
            "coding-readiness/generate_modern_event_successor_lineage.py",
            "coding-readiness/validate_modern_causal_state_contracts.py",
            "coding-readiness/modern-causal-independent-review-inventory.v1.json",
            "coding-readiness/modern-causal-independent-reviewed-finalization.v1.json",
            "coding-readiness/modern-causal-independent-oracle.v1.json",
            "coding-readiness/modern-causal-independent-pg-fixtures.v1.json",
            "coding-readiness/modern-causal-final-source-authority-manifest.v1.json",
            "coding-readiness/build_modern_causal_independent_oracle.py",
            "coding-readiness/validate_modern_causal_independent_oracle.py",
            "coding-readiness/run_modern_causal_independent_pg_fixtures.py",
            "coding-readiness/validate_modern_causal_final_endorsement.py",
            "coding-readiness/reports/modern-causal-independent-design-findings.v1.json",
            "coding-readiness/reports/modern-causal-independent-pg-evidence.v2.json",
            "coding-readiness/reports/modern-causal-independent-final-hostile-review.v1.json",
            "g0/control-evidence-intake/modern-causal-final-endorsement.v1.json",
        }
    ),
    "sys-exact-business-start": frozenset(
        {
            "coding-readiness/sys-exact-business-start-successor.v1.json",
            "coding-readiness/sys-exact-business-successor-lineage.v1.json",
            "coding-readiness/sys-exact-business-start-pin.v1.json",
            "coding-readiness/validate_sys_exact_business_start.py",
            "coding-readiness/audit_sys_exact_business_start.cjs",
            "session-prompts/05-cloudhr-sys-session.md",
            "session-evidence/sys/g2-implementation-contract.v2.md",
            "session-evidence/sys/validate_sys_readiness.v2.py",
            "session-evidence/sys/g3-modern-capability-contracts.v1.json",
        }
    ),
    "pre-g3-common-foundation-migrations": frozenset(
        {
            "g0/pre-g3-common-foundation-migration-receipt-contract.v1.md",
            "g0/validate_pre_g3_common_foundation_migrations.py",
            "g0/capture_pre_g3_common_foundation_postgres_evidence.py",
            "g0/materialize_pre_g3_common_foundation_migration_receipts.py",
            "g0/generate_migration_successor_register.py",
            "g0/pre-g3-common-foundation-migration-allocation.v1.json",
            "g0/pre-g3-common-foundation-migration-technical-review.v1.json",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.v1.json",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.junit.xml",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.observations.v1.json",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.v1.json",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.junit.xml",
            "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.observations.v1.json",
        }
    ),
}
REQUIRED_DYNAMIC_ARTIFACTS = {
    "remaining-preparation-register.csv",
    "g0/pre-g3-common-foundation-migration-allocation.v1.json",
    "g0/pre-g3-common-foundation-migration-technical-review.v1.json",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.v1.json",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.junit.xml",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.observations.v1.json",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.v1.json",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.junit.xml",
    "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.observations.v1.json",
    "coding-readiness/g3-contract-primary-ownership-register.csv",
    "coding-readiness/generated-contract-runtime-invariant-register.csv",
    "coding-readiness/g3-file-allocation-register.csv",
    "coding-readiness/frontend-shared-presentation-binding-register.csv",
    "coding-readiness/validate_frontend_shared_presentation_boundary.py",
    "coding-readiness/g3-slice-code-go-register.csv",
    "coding-readiness/hris-api-sor-transition-register.csv",
    "coding-readiness/validate_hris_api_sor_transitions.py",
    "coding-readiness/ia-node-access-contract-register.csv",
    "coding-readiness/ia-entry-query-projection-register.csv",
    "coding-readiness/ia-entry-query-projection-schemas.v1.json",
    "coding-readiness/ia-entry-query-api-contract-register.csv",
    "coding-readiness/ia-entry-query-runtime-invariant-register.csv",
    "coding-readiness/ia-entry-query-field-type-register.csv",
    "coding-readiness/ia-entry-query-action-key-register.csv",
    "coding-readiness/ia-shared-authorization-exception-register.csv",
    "coding-readiness/generate_ia_entry_query_projection_schemas.py",
    "coding-readiness/validate_ia_node_access_contracts.py",
    "customer-specific-contamination-register.csv",
    "coding-readiness/validate_contamination_decisions.py",
    "coding-readiness/validate_g6_database_activation_boundaries.py",
    "coding-readiness/module-exact-business-start-canonical.v1.json",
    "coding-readiness/module-exact-business-schemas.v1.json",
    "coding-readiness/module-exact-business-fixtures.v1.json",
    "coding-readiness/module-exact-business-lineage-register.v1.csv",
    "coding-readiness/module-exact-business-start-pin.v1.json",
    "coding-readiness/validate_module_exact_business_start.cjs",
    "coding-readiness/audit_module_exact_business_start.py",
    "coding-readiness/modern-capability-semantic-bindings.v1.json",
    "coding-readiness/modern-capability-public-identity-registry.v1.json",
    "g0/blueprint-artifact-successor-lineage.csv",
    "g0/current-blueprint-artifact-pointer.csv",
    "g0/validate_blueprint_artifact_lineage.py",
    "g0/blueprint-central-snapshot-manifest.v1.json",
    "g0/blueprint-workspace-boundary-register.csv",
    "g0/generate_blueprint_canonical_snapshot.py",
    "g0/validate_blueprint_workspace_boundaries.py",
    "g0/write_module_evidence_shard.py",
    "session-evidence/per/g3-modern-capability-contracts.v1.json",
    "session-evidence/per/g3-modern-capability-contracts.v2.json",
    "session-evidence/sys/validate_sys_readiness.py",
    "session-evidence/sys/validate_sys_readiness.v2.py",
    "g0/build-matrix.csv",
    "g0/append_g3_control_delivery.py",
    "g0/append_g3_checkpoint.py",
    "g0/capture_g3_checkpoint_evidence.py",
    "g0/capture_session_environment_evidence.py",
    "g0/capture_target_command_evidence.py",
    "g0/checkpoint-register.csv",
    "g0/code-entry-baseline-lineage.csv",
    "g0/central-artifact-classification-register.csv",
    "g0/contract-publication-bootstrap-contract.v1.json",
    "g0/control-sync-command-catalog.v1.json",
    "g0/current-g3-gate-decision.json",
    "g0/file-ownership-register.csv",
    "g0/g1-g2-sealed-artifact-register.csv",
    "g0/g3-checkpoint-evidence-contract.md",
    "g0/g3-checkpoint-register.csv",
    "g0/g3-control-proposal-register.csv",
    "g0/g3-control-delivery-state.json",
    "g0/g3-control-release-register.csv",
    "g0/g3-control-sync-receipt-register.csv",
    "g0/g3-cross-repo-dependency-register.csv",
    "g0/g3-verification-command-catalog.v1.json",
    "g0/host_semaphore.py",
    "g0/independent-session-environment-verification.md",
    "g0/integration-baseline-manifest.csv",
    "g0/migration-allocation-register.csv",
    "g0/migration-stream-register.csv",
    "g0/new-file-allocation-register.csv",
    "g0/prepare_g3_checkpoint.py",
    "g0/run_required_gradle_test_gate.py",
    "g0/session-environment-command-catalog.v1.json",
    "g0/session-environment-evidence.json",
    "g0/session-support-worktree-register.csv",
    "g0/target-command-evidence-backend.json",
    "g0/target-command-evidence-frontend.json",
    "g0/validate_code_checkpoint.py",
    "g0/validate_central_artifact_delivery.py",
    "g0/validate_contract_publication_bootstrap.py",
    "g0/validate_generated_contract_runtime_invariants.py",
    "g0/validate_typed_contract_test_allocations.py",
    "g0/worktree-branch-register.csv",
}.union(*REQUIRED_ASSURANCE_ARTIFACTS.values())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve_artifact(reference: str) -> Path:
    """Resolve a canonical blueprint-root-relative artifact without fallback."""
    return ROOT / reference


def validate(
    payload: dict[str, Any],
    markdown: str,
    declaration: str,
    *,
    verify_files: bool,
) -> list[str]:
    errors: list[str] = []
    expected = {
        "schema": "dwp.hris.full-coding-readiness.v1",
        "mode": "LIVE",
        "status": "PASS",
        "effectiveGate": "OPEN_G3_CODE",
        "implementationState": "NOT_STARTED_G3",
        "functionalAcceptanceState": "NOT_STARTED_G4",
        "designState": "DEFERRED_G5_AFTER_G4",
        "productionState": "NOT_AUTHORIZED_G6",
        "reportAuthority": "AUTHORITATIVE_LIVE",
    }
    for field, value in expected.items():
        if payload.get(field) != value:
            errors.append(f"published report {field} is not {value}")
    if payload.get("errors") != []:
        errors.append("published report contains blockers")
    try:
        parsed = datetime.fromisoformat(str(payload.get("generatedAt", "")).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            errors.append("published report timestamp is not timezone-aware")
    except ValueError:
        errors.append("published report timestamp invalid")

    markdown_markers = [
        "- 검증 모드: LIVE",
        "- 검증 결과: PASS",
        "- 유효 코드 Gate: OPEN_G3_CODE",
        "- 보고서 권위: AUTHORITATIVE_LIVE",
        "- 구현 상태: NOT_STARTED_G3",
        "- Production 상태: NOT_AUTHORIZED_G6",
    ]
    for marker in markdown_markers:
        if marker not in markdown:
            errors.append(f"published Markdown missing {marker}")
    try:
        expected_markdown = markdown_report(payload)
    except (KeyError, TypeError, ValueError) as error:
        errors.append(f"published JSON cannot render canonical Markdown: {error}")
    else:
        if markdown != expected_markdown:
            errors.append("published Markdown is not the exact rendering of the JSON report")
    for marker in (
        f"- 생성시각: {payload.get('generatedAt')}",
        f"- 보고서 권위: {payload.get('reportAuthority')}",
        f"- G3 checkpoint digest: {payload.get('g3CheckpointSha256')}",
    ):
        if marker not in markdown:
            errors.append(f"published JSON/Markdown pair binding missing {marker}")
    declaration_markers = [
        "5개 모듈 모두 `OPEN_G3_CODE`",
        "구현 `NOT_STARTED_G3`",
        "Production `NOT_AUTHORIZED_G6`",
        "coding-readiness/reports/full-coding-readiness-latest.md",
        "authoritative LIVE",
    ]
    for marker in declaration_markers:
        if marker.lower() not in declaration.lower():
            errors.append(f"published declaration missing {marker}")

    artifacts = payload.get("artifactSha256", {})
    if not isinstance(artifacts, dict) or not artifacts:
        errors.append("published artifact digest set missing")
        artifacts = {}
    else:
        expected_artifacts = {
            str(path.relative_to(ROOT)) for path in artifact_paths()
        }
        missing_expected = expected_artifacts - set(artifacts)
        unexpected = set(artifacts) - expected_artifacts
        if missing_expected:
            errors.append(
                "published full artifact digest set incomplete: "
                + ", ".join(sorted(missing_expected))
            )
        if unexpected:
            errors.append(
                "published artifact digest set contains unregistered paths: "
                + ", ".join(sorted(unexpected))
            )
        missing_dynamic = REQUIRED_DYNAMIC_ARTIFACTS - set(artifacts)
        if missing_dynamic:
            errors.append(
                "published dynamic G0 artifact digest set incomplete: "
                + ", ".join(sorted(missing_dynamic))
            )

    if verify_files:
        if payload.get("checkpointSha256") != sha256(CHECKPOINT):
            errors.append("published checkpoint digest is stale")
        if payload.get("g3CheckpointSha256") != sha256(G3_CHECKPOINT):
            errors.append("published G3 append-only checkpoint digest is stale")
        if payload.get("publishedDeclarationSha256") != sha256(DECLARATION):
            errors.append("published declaration digest is stale")
        registered_artifacts = {
            str(path.relative_to(ROOT)) for path in artifact_paths()
        }
        for reference, expected_digest in artifacts.items():
            # Unexpected references are already a hard error above.  Do not
            # turn their user-controlled values into filesystem probes.
            if reference not in registered_artifacts:
                continue
            path = resolve_artifact(reference)
            if not path.is_file():
                errors.append(f"published artifact missing: {reference}")
            elif sha256(path) != expected_digest:
                errors.append(f"published artifact digest stale: {reference}")
    return sorted(set(errors))


def validate_fresh_live_checkpoint() -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        completed = subprocess.run(
            [sys.executable, str(G0_LIVE_VALIDATOR), "--check-live"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=2400,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return [f"fresh G0 live checkpoint could not run: {error}"], {}
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return ["fresh G0 live checkpoint did not emit JSON"], {}
    if not isinstance(payload, dict):
        return ["fresh G0 live checkpoint payload is not an object"], {}
    expected = {
        "schema": "dwp.hris.full-code-checkpoint.v1",
        "mode": "live",
        "status": "PASS",
        "code_gate": "OPEN_G3_CODE",
        "production_activation": "NOT_AUTHORIZED_G6",
    }
    if completed.returncode != 0:
        errors.append(f"fresh G0 live checkpoint failed rc={completed.returncode}")
    for field, value in expected.items():
        if payload.get(field) != value:
            errors.append(f"fresh G0 live checkpoint {field} is not {value}")
    if payload.get("errors") != []:
        errors.append("fresh G0 live checkpoint contains blockers")
    return errors, payload


def validate_publication(
    payload: dict[str, Any],
    markdown: str,
    declaration: str,
    *,
    verify_files: bool,
    verify_seal_only: bool,
    fresh_validator: Callable[
        [], tuple[list[str], dict[str, Any]]
    ] = validate_fresh_live_checkpoint,
) -> tuple[list[str], dict[str, Any]]:
    """Validate one publication, optionally without a new global live replay."""
    errors = validate(payload, markdown, declaration, verify_files=verify_files)
    if verify_seal_only:
        return sorted(set(errors)), {}
    live_errors, live_checkpoint = fresh_validator()
    return sorted(set(errors + live_errors)), live_checkpoint


def self_test(
    payload: dict[str, Any], markdown: str, declaration: str
) -> dict[str, Any]:
    cases: dict[str, list[str]] = {}
    # This command is the fourth and final initial-open step, so its healthy
    # baseline must still be the current on-disk seal.  Mutation cases below
    # remain synthetic, but a digest/declaration/checkpoint change between the
    # preceding normal verification and this self-test must fail closed.
    baseline_errors = validate(payload, markdown, declaration, verify_files=True)

    def mutate(name: str, field: str, value: Any) -> None:
        candidate = copy.deepcopy(payload)
        candidate[field] = value
        cases[name] = validate(candidate, markdown, declaration, verify_files=False)

    mutate("static-mode", "mode", "STATIC")
    mutate("failed-status", "status", "FAIL")
    mutate("blocked-gate", "effectiveGate", "BLOCKED")
    mutate("implementation-overstatement", "implementationState", "COMPLETE")
    mutate("production-overstatement", "productionState", "AUTHORIZED")
    cases["markdown-drift"] = validate(
        payload,
        markdown.replace("- 검증 모드: LIVE", "- 검증 모드: STATIC"),
        declaration,
        verify_files=False,
    )
    cases["declaration-drift"] = validate(
        payload,
        markdown,
        declaration.replace("authoritative LIVE", "historical"),
        verify_files=False,
    )
    cases["json-markdown-pair-drift"] = validate(
        payload,
        markdown.replace(str(payload.get("generatedAt")), "2000-01-01T00:00:00Z", 1),
        declaration,
        verify_files=False,
    )
    cases["g3-digest-pair-drift"] = validate(
        payload,
        markdown.replace(str(payload.get("g3CheckpointSha256")), "0" * 64, 1),
        declaration,
        verify_files=False,
    )
    candidate = copy.deepcopy(payload)
    candidate["errors"] = ["injected blocker"]
    cases["hidden-blocker"] = validate(candidate, markdown, declaration, verify_files=False)
    candidate = copy.deepcopy(payload)
    candidate_artifacts = candidate.get("artifactSha256", {})
    if isinstance(candidate_artifacts, dict) and REQUIRED_DYNAMIC_ARTIFACTS:
        candidate_artifacts.pop(sorted(REQUIRED_DYNAMIC_ARTIFACTS)[0], None)
    cases["artifact-manifest-gap"] = validate(
        candidate, markdown, declaration, verify_files=False
    )
    expected_non_dynamic = sorted(
        {
            str(path.relative_to(ROOT)) for path in artifact_paths()
        }
        - REQUIRED_DYNAMIC_ARTIFACTS
    )
    if expected_non_dynamic:
        candidate = copy.deepcopy(payload)
        candidate_artifacts = candidate.get("artifactSha256", {})
        if isinstance(candidate_artifacts, dict):
            candidate_artifacts.pop(expected_non_dynamic[0], None)
        cases["full-generated-artifact-manifest-gap"] = validate(
            candidate, markdown, declaration, verify_files=False
        )
    candidate = copy.deepcopy(payload)
    candidate_artifacts = candidate.get("artifactSha256", {})
    if isinstance(candidate_artifacts, dict):
        candidate_artifacts["../../unregistered-artifact"] = "0" * 64
    cases["unregistered-artifact-path"] = validate(
        candidate, markdown, declaration, verify_files=False
    )
    for assurance_group, references in sorted(REQUIRED_ASSURANCE_ARTIFACTS.items()):
        for ordinal, reference in enumerate(sorted(references), start=1):
            candidate = copy.deepcopy(payload)
            candidate_artifacts = candidate.get("artifactSha256", {})
            if isinstance(candidate_artifacts, dict):
                candidate_artifacts.pop(reference, None)
            cases[f"{assurance_group}-artifact-{ordinal:02d}-gap"] = validate(
                candidate, markdown, declaration, verify_files=False
            )

    mode_contract_errors: list[str] = []
    fresh_calls: list[str] = []

    def injected_fresh_validator() -> tuple[list[str], dict[str, Any]]:
        fresh_calls.append("called")
        return ["injected fresh global failure"], {"status": "FAIL"}

    seal_errors, seal_checkpoint = validate_publication(
        payload,
        markdown,
        declaration,
        verify_files=True,
        verify_seal_only=True,
        fresh_validator=injected_fresh_validator,
    )
    if fresh_calls or seal_checkpoint or seal_errors != baseline_errors:
        mode_contract_errors.append(
            "seal-only mode executed or incorporated the fresh global validator"
        )
    normal_errors, normal_checkpoint = validate_publication(
        payload,
        markdown,
        declaration,
        verify_files=True,
        verify_seal_only=False,
        fresh_validator=injected_fresh_validator,
    )
    if (
        fresh_calls != ["called"]
        or "injected fresh global failure" not in normal_errors
        or normal_checkpoint.get("status") != "FAIL"
    ):
        mode_contract_errors.append(
            "default mode no longer requires and propagates fresh global validation"
        )
    rejected = sum(bool(value) for value in cases.values())
    status = (
        "PASS"
        if not baseline_errors
        and rejected == len(cases)
        and not mode_contract_errors
        else "FAIL"
    )
    return {
        "schema": "dwp.hris.published-gate-truth-self-test.v1",
        "status": status,
        "tamperCaseCount": len(cases),
        "tamperRejectedCount": rejected,
        "modeContractCheckCount": 2,
        "rejectedErrorCountByCase": {key: len(value) for key, value in cases.items()},
        "blockers": (
            []
            if status == "PASS"
            else baseline_errors
            + [key for key, value in cases.items() if not value]
            + mode_contract_errors
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--self-test", action="store_true")
    mode.add_argument(
        "--verify-seal-only",
        action="store_true",
        help=(
            "verify the already-published LIVE seal without a new global G0 live "
            "replay; never use this mode for the initial gate opening"
        ),
    )
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    missing = [
        path
        for path in (REPORT_JSON, REPORT_MD, DECLARATION, CHECKPOINT, G3_CHECKPOINT)
        if not path.is_file()
    ]
    if missing:
        payload: dict[str, Any] = {
            "schema": "dwp.hris.published-gate-truth.v1",
            "status": "FAIL",
            "blockers": [f"missing {path}" for path in missing],
        }
    else:
        try:
            report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
            if not isinstance(report, dict):
                raise ValueError("report JSON root is not an object")
            markdown = REPORT_MD.read_text(encoding="utf-8")
            declaration = DECLARATION.read_text(encoding="utf-8")
            if args.self_test:
                payload = self_test(report, markdown, declaration)
            else:
                errors, live_checkpoint = validate_publication(
                    report,
                    markdown,
                    declaration,
                    verify_files=True,
                    verify_seal_only=args.verify_seal_only,
                )
                payload = {
                    "schema": "dwp.hris.published-gate-truth.v1",
                    "status": "PASS" if not errors else "FAIL",
                    "verificationMode": (
                        "SEALED_PUBLICATION_ONLY"
                        if args.verify_seal_only
                        else "PUBLICATION_AND_FRESH_GLOBAL_LIVE"
                    ),
                    "reportMode": report.get("mode"),
                    "reportStatus": report.get("status"),
                    "effectiveGate": report.get("effectiveGate"),
                    "checkpointSha256": report.get("checkpointSha256"),
                    "g3CheckpointSha256": report.get("g3CheckpointSha256"),
                    "publishedDeclarationSha256": report.get(
                        "publishedDeclarationSha256"
                    ),
                    "artifactCount": len(report.get("artifactSha256", {})),
                    "freshLiveCheckpointStatus": (
                        "NOT_RUN_EXPLICIT_SEAL_ONLY"
                        if args.verify_seal_only
                        else live_checkpoint.get("status")
                    ),
                    "freshLiveCheckpointChecks": (
                        None
                        if args.verify_seal_only
                        else live_checkpoint.get("checks")
                    ),
                    "blockers": errors,
                }
        except (json.JSONDecodeError, OSError, ValueError) as error:
            payload = {
                "schema": "dwp.hris.published-gate-truth.v1",
                "status": "FAIL",
                "blockers": [f"published report unreadable: {error}"],
            }
    print(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=None if args.compact else 2,
            separators=(",", ":") if args.compact else None,
        )
    )
    return 0 if payload["status"] == "PASS" else 1


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
