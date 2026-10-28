#!/usr/bin/env python3
"""Validate PER-009 two-lane central execution authority and clean receipts."""

from __future__ import annotations

import sys

if not sys.flags.isolated:
    raise SystemExit("PER-009 authority validator must be invoked with /usr/bin/python3 -I")

import argparse
import ast
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess
from datetime import datetime
from typing import Any


FRONTEND = pathlib.Path(__file__).resolve().parents[5]
CANONICAL_WORKSPACE = pathlib.Path("/Users/a10697/Work/DWP")
CANONICAL_FRONTEND = CANONICAL_WORKSPACE / "dwp-frontend"
BACKEND = CANONICAL_WORKSPACE / "dwp-backend"
AGENT = CANONICAL_WORKSPACE / "dwp_agent"
HERE = pathlib.Path(__file__).resolve().parent
AUTHORITY_PATH = HERE / "per-009-central-execution-authority.v1.json"
BACKEND_TOKEN_PATH = HERE / "tokens/per-009-backend-central.start-token.v1.json"
FRONTEND_TOKEN_PATH = HERE / "tokens/per-009-frontend-mirror.start-token.v1.json"
REVIEW_PATH = HERE / "independent-review.v1.json"
VALIDATOR_PATH = pathlib.Path(__file__).resolve()
CONSUMER_PATH = HERE / "consume_per009_central_token.py"

SUCCESSOR_PATH = (
    FRONTEND
    / "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r1/per-009-transport-and-central-authorization-successor.v1.json"
)
PREDECESSOR_COMMIT = "1c00ee79108af9094ee89afab90ec646d47f5759"
PREDECESSOR_TREE = "74346aa1340f5208cf032f8e74648cf47ad57784"
BACKEND_BASE = "699ef730f21a89200be6dfed6d2e34148014cd10"
BACKEND_TREE = "3ea7866294cfd3bcb2ee950ff8b882f56f6f1317"
AGENT_BASE = "9beb5439cad065e7d919a98c9f9becb44481508a"
AGENT_TREE = "fe3880719360f4bdeff88bbbac1edc6f8affed88"

ROOT_REL = HERE.relative_to(FRONTEND).as_posix()
AUTHORITY_REL = AUTHORITY_PATH.relative_to(FRONTEND).as_posix()
BACKEND_TOKEN_REL = BACKEND_TOKEN_PATH.relative_to(FRONTEND).as_posix()
FRONTEND_TOKEN_REL = FRONTEND_TOKEN_PATH.relative_to(FRONTEND).as_posix()
REVIEW_REL = REVIEW_PATH.relative_to(FRONTEND).as_posix()
VALIDATOR_REL = VALIDATOR_PATH.relative_to(FRONTEND).as_posix()
CONSUMER_REL = CONSUMER_PATH.relative_to(FRONTEND).as_posix()
CARRIER_PATHS = {
    AUTHORITY_REL,
    BACKEND_TOKEN_REL,
    FRONTEND_TOKEN_REL,
    REVIEW_REL,
    CONSUMER_REL,
    VALIDATOR_REL,
}

BACKEND_LANE = "hris/per009-central-v63-v273-backend-20261028-r1"
FRONTEND_LANE = "hris/per009-central-mirror-frontend-20261028-r1"
EXTERNAL_ROOT = pathlib.Path(
    "/Users/a10697/Work/DWP/.hris-worktrees/wave7-20261028/batch06/per009-central"
)
CARRIER_VALIDATION_WORKTREE = EXTERNAL_ROOT / "carrier-validation-frontend"
BACKEND_WORKTREE = EXTERNAL_ROOT / "backend"
FRONTEND_WORKTREE = EXTERNAL_ROOT / "frontend"
RECEIPT_ROOT = EXTERNAL_ROOT / "receipts"
BACKEND_RECEIPT = RECEIPT_ROOT / "backend-clean-worktree-receipt.v1.json"
FRONTEND_RECEIPT = RECEIPT_ROOT / "frontend-clean-worktree-receipt.v1.json"
BACKEND_CONSUMPTION = RECEIPT_ROOT / "backend-token-consumption-receipt.v1.json"
FRONTEND_CONSUMPTION = RECEIPT_ROOT / "frontend-token-consumption-receipt.v1.json"
BACKEND_TARGETED = RECEIPT_ROOT / "backend-targeted-verification-receipt.v1.json"
BACKEND_POST_REVIEW = RECEIPT_ROOT / "backend-post-implementation-review.v1.json"
FRONTEND_TARGETED = RECEIPT_ROOT / "frontend-targeted-verification-receipt.v1.json"
FRONTEND_POST_REVIEW = RECEIPT_ROOT / "frontend-post-implementation-review.v1.json"

FRONTEND_ORIGIN = "https://github.com/choijoonbin/dwp-frontend.git"
BACKEND_ORIGIN = "https://github.com/choijoonbin/dwp-backend.git"
AGENT_ORIGIN = "https://github.com/choijoonbin/aura_agent.git"
GIT_BINARY = "/usr/bin/git"

BACKEND_EXECUTOR = "HRIS_PER009_BACKEND_CENTRAL_EXECUTOR"
BACKEND_VERIFIER = "HRIS_PER009_BACKEND_TARGETED_VERIFIER"
BACKEND_REVIEWER = "HRIS_PER009_BACKEND_INDEPENDENT_POST_REVIEWER"
FRONTEND_EXECUTOR = "HRIS_PER009_FRONTEND_MIRROR_EXECUTOR"
FRONTEND_VERIFIER = "HRIS_PER009_FRONTEND_TARGETED_VERIFIER"
FRONTEND_REVIEWER = "HRIS_PER009_FRONTEND_INDEPENDENT_POST_REVIEWER"

EXPECTED_IDENTITY_CONTRACT = {
    "backendExecutor": BACKEND_EXECUTOR,
    "backendTargetedVerifier": BACKEND_VERIFIER,
    "backendPostImplementationReviewer": BACKEND_REVIEWER,
    "frontendExecutor": FRONTEND_EXECUTOR,
    "frontendTargetedVerifier": FRONTEND_VERIFIER,
    "frontendPostImplementationReviewer": FRONTEND_REVIEWER,
    "allSixIdentitiesMustBeDistinct": True,
    "freeFormIdentityAccepted": False,
    "identityAssurance": "PROCEDURAL_ROLE_LABELS_WITH_EXACT_EVIDENCE_NOT_CRYPTOGRAPHIC_PRINCIPAL_ATTESTATION",
    "cryptographicPrincipalAuthenticationProvided": False,
}

EXPECTED_LANE_EVIDENCE_CONTRACT = {
    "backend": {
        "targetedVerificationReceiptPath": str(BACKEND_TARGETED),
        "targetedVerificationReceiptSchema": "dwp.hris.wave7.per009-backend-targeted-verification-receipt.v1",
        "postImplementationReviewPath": str(BACKEND_POST_REVIEW),
        "postImplementationReviewSchema": "dwp.hris.wave7.per009-backend-post-implementation-review.v1",
        "requiredDecision": "GO_FOR_PER009_BACKEND_V63_V273_LANE_BRANCH_PUSH_ONLY",
    },
    "frontend": {
        "targetedVerificationReceiptPath": str(FRONTEND_TARGETED),
        "targetedVerificationReceiptSchema": "dwp.hris.wave7.per009-frontend-targeted-verification-receipt.v1",
        "postImplementationReviewPath": str(FRONTEND_POST_REVIEW),
        "postImplementationReviewSchema": "dwp.hris.wave7.per009-frontend-post-implementation-review.v1",
        "requiredDecision": "GO_FOR_PER009_FRONTEND_V62_V63_MIRROR_LANE_BRANCH_PUSH_ONLY",
    },
}

GOVERNING_PINS = [
    {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r1/per-009-transport-and-central-authorization-successor.v1.json",
        "bytes": 50965,
        "sha256": "43db9ff57f5712e366321bb0962be689fa6e6d175023398576d9dd8a4bff3cd1",
    },
    {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r1/independent-review.v1.json",
        "bytes": 10554,
        "sha256": "52d1499ca353bc89fdfb1cd79c41f9bb88c775a14dc2d8cee74cb07d6d33df96",
    },
    {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r2/per-009-authorization-carrier-correction.v2.json",
        "bytes": 10030,
        "sha256": "9fe326084990120570c7c0ff6ae040c9d1c4600b1f54f47e3f9c48d0c025b8b1",
    },
    {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r2/independent-review.v2.json",
        "bytes": 6816,
        "sha256": "1834372aa6fd4b59da0d4ae606abea6f1e690a41782e797ef0f6438c0d2651fc",
    },
    {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r2/validate_per009_authorization_carrier_correction.py",
        "bytes": 21890,
        "sha256": "7efb095e8f68a730aaafd82f762f0099116961deb51abfd8039b8c88b1f0b9a8",
    },
]

EXPECTED_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "carrierValidationWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "backendCleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "frontendCleanWorktreeMaterializationAuthorizedAfterReviewedBackendLane": True,
    "backendOneShotTokenIssued": True,
    "frontendOneShotTokenIssued": True,
    "backendSourceAuthoringAuthorizedAfterCleanReceipt": True,
    "authV273SqlAuthoringAuthorizedAfterCleanReceipt": True,
    "frontendMirrorSourceAuthoringAuthorizedAfterCleanReceiptAndReviewedBackendLane": True,
    "laneCommitAndPushAuthorizedAfterTargetedVerificationAndPostReview": True,
    "backendDwpDevIntegrationAuthorized": False,
    "frontendDwpDevIntegrationAuthorized": False,
    "moduleOwnerPacketAuthorized": False,
    "moduleSourceAuthoringAuthorized": False,
    "performanceV21LeaseAuthorized": False,
    "routeOrMenuMountAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "bundleApprovalAuthorized": False,
    "bundleActivationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

EXPECTED_REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "carrierValidationWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "backendCleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "frontendCleanWorktreeMaterializationAuthorizedAfterReviewedBackendLane": True,
    "backendOneShotExecutionAuthorizedAfterCleanReceipt": True,
    "frontendOneShotExecutionAuthorizedAfterCleanReceiptAndReviewedBackendLane": True,
    "laneCommitAndPushAuthorizedAfterTargetedVerificationAndPostReview": True,
    "backendDwpDevIntegrationAuthorized": False,
    "frontendDwpDevIntegrationAuthorized": False,
    "moduleSourceAuthoringAuthorized": False,
    "performanceV21LeaseAuthorized": False,
    "routeOrMenuMountAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "bundleActivationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

EXPECTED_BACKEND_TOKEN_AUTHORITY = {
    "tokenIssued": True,
    "executableAfterCarrierPushAndCleanReceipt": True,
    "boundedBackendSourceAuthoringAuthorized": True,
    "authV273SqlAuthoringAuthorized": True,
    "laneCommitAndPushAuthorizedAfterVerificationAndReview": True,
    "backendDwpDevIntegrationAuthorized": False,
    "frontendSourceAuthoringAuthorized": False,
    "moduleSourceAuthoringAuthorized": False,
    "performanceV21LeaseAuthorized": False,
    "routeOrMenuMountAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "bundleActivationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

EXPECTED_FRONTEND_TOKEN_AUTHORITY = {
    "tokenIssued": True,
    "executableAfterCleanReceiptAndReviewedBackendLane": True,
    "boundedFrontendMirrorSourceAuthoringAuthorized": True,
    "laneCommitAndPushAuthorizedAfterVerificationAndReview": True,
    "frontendDwpDevIntegrationAuthorized": False,
    "backendSourceAuthoringAuthorized": False,
    "moduleSourceAuthoringAuthorized": False,
    "performanceV21LeaseAuthorized": False,
    "routeOrMenuMountAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "bundleActivationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

EXPECTED_STATIC_ARTIFACT_PINS = {
    AUTHORITY_REL: {
        "bytes": 23827,
        "sha256": "0dac6af7d492d37e1b9dbeac5c10b1f06bfa0cfb1bf203092ba14b27fae84911",
    },
    BACKEND_TOKEN_REL: {
        "bytes": 9967,
        "sha256": "58a68ad7f97ad42ea85af2b505e329a511e91f4fcfd83527ba17a7c52868f671",
    },
    FRONTEND_TOKEN_REL: {
        "bytes": 10802,
        "sha256": "af221f293fca50223e24e782bd126defa3e791d897f74ec92c7adf620164578e",
    },
    CONSUMER_REL: {
        "bytes": 13518,
        "sha256": "ca96149275b3921f26a672540d752bb2e02cfc9f887ec80e2ea0db0f14831f0e",
    },
}

EXPECTED_REVIEW_BOUNDARIES = [
    "The R1 authorization successor and append-only R2 lifecycle correction remain byte-exact and are not amended by this carrier.",
    "Frontend 1c00ee79, Backend 699ef730 and Agent 9beb5439 local and origin pins are exact. Dirty shared Calendar and Mail work plus existing uncommitted v62 bytes on all five future PER-009 Frontend mirror paths are non-authoritative and untouched: no sync, clean, reset or overwrite runs there; the carrier changes only six paths and validates from the retained detached carrier-validation-frontend worktree, which is not the Frontend product lane.",
    "Frontend, Backend and Agent exact audited HTTPS origin URLs are closed constants; every admission phase compares local refs and authoritative ls-remote dwp-dev heads to the bound commits instead of trusting stale remote-tracking refs.",
    "Backend v63 and Auth V273 are absent; canonical high-water is v62 and Auth migration high-water is V272 without an Auth-stream V273 collision.",
    "Frontend authorization mirror is v61 and must import immutable v62 before v63; direct v63-only synchronization is denied.",
    "Backend and Frontend receive different repository-scoped tokens and worktrees plus six distinct exact procedural executor, verifier and reviewer labels; these labels enforce evidence-role separation but are explicitly not cryptographic principal attestation. Backend verification, independent zero-finding review and branch push precede Frontend materialization and token consumption.",
    "Backend write authority is exactly the R1 union of 9 canonical, 11 generated and 13 targeted-test paths. Frontend write authority is exactly 5 mirror paths and the 4 sync or route paths are execute-only and byte-preserved; deletion, rename, gitlink, symlink and mode drift are rejected.",
    "Each token permits one operational consumption only while the current-UID 0700 receipt ledger and 0600 receipt are retained. O_EXCL denies concurrent replay, but same-UID deletion or rollback resistance and an external durable CAS are not provided; 4-hour and 2-hour deadlines are procedural bounded-work windows without trusted-clock attestation.",
    "Clean receipts bind the six committed carrier artifacts, exact origin URL, authoritative remote head and worktree provenance; consumption is followed by a full phase revalidation before source write is authorized.",
    "Backend completion is verified from actual commit blobs: canonical checksum, exact v63 counts and semantic delta, service projections, fixture lineage, required V273 semantics, direct-child mode-safe tree, exact evidence and remote push must all close.",
    "Automated checks prove exact artifacts and bounded source guardrails, not general-purpose semantic correctness of changed Python, Java or test bodies. The independent post-implementation reviewer must inspect all 33 material Backend diffs before lane push.",
    "Frontend remains dependency-gated until the exact Backend lane commit, tree, checksum, verification receipt, independent zero-finding review and remote push are bound; its official sync checks use the exact reviewed Backend paths.",
    "Frontend completion has a separate targeted receipt and independent review gate that revalidates the Backend source, direct-child mode-safe tree, five-path allowlist, four byte-preserved paths, v1-v61 preservation, exact Backend v62-v63 blobs, fixtures, size ceiling and remote push.",
    "Neither token authorizes direct dwp-dev integration; a later independently reviewed central integration authority is mandatory.",
    "People runtime remains v60 and generated v63 remains unmounted. No PER owner source, V21, menu, route, feature activation, enrollment, automatic import, approval, production release or business completion is authorized.",
    "Only bounded target groups may run once; a failure permits only the smallest affected rerun and never a repository-wide suite.",
]

EXPECTED_REVIEWERS = [
    {
        "reviewer": "per009_auth_precedent",
        "scope": "HRM-013 and PAY-005 two-repository authority, clean-receipt, lane-review and separate-integration precedents; append-only R1 and R2 preservation",
        "disposition": "PASS_ZERO_P0_P1_P2",
    },
    {
        "reviewer": "per009_auth_delta_review",
        "scope": "Exact current repository heads, dirty shared-checkout exclusion, v62 and V272 high-water evidence, v63 and V273 absence, v61 Frontend mirror and worktree collision audit",
        "disposition": "PASS_ZERO_P0_P1_P2",
    },
    {
        "reviewer": "per009_auth_generation_audit",
        "scope": "Exact 33-path Backend and 5-path Frontend write allowlists, phased operational one-shot lifecycle, atomic receipt creation, retained-ledger concurrent replay denial, procedural expiry and admission boundaries",
        "disposition": "PASS_ZERO_P0_P1_P2",
    },
]

EXPECTED_REVIEW_NEXT_ACTION = (
    "Commit and push this exact six-file carrier, retain the detached clean carrier-validation-frontend worktree, then materialize and receipt only the clean Backend product lane worktree. "
    "Do not consume either token in this preparation step; Frontend product-lane materialization remains gated by the reviewed and pushed Backend lane."
)

EXPECTED_REVIEW_NONCLAIMS = [
    "No Backend or Frontend central source has been authored, generated, tested, committed or pushed under these tokens.",
    "No token has been consumed.",
    "No lane result has been integrated into dwp-dev.",
    "No People PER-009 owner runtime, Goal domain, Performance V21 migration, UI, menu or route exists under this authority.",
    "No feature, tenant, bundle or production state is active.",
    "No PER-009, Batch 06, Wave 7 or HRIS business completion is claimed.",
    "No cryptographic, hardware-backed or separately authenticated principal attestation is claimed for executor, verifier or reviewer role labels.",
    "No deletion-resistant same-UID burn ledger, durable external compare-and-swap anchor or trusted-clock deadline attestation is claimed.",
    "No automated general-purpose proof of generator, Java runtime or test-body semantic correctness is claimed; that residual responsibility belongs to the mandatory independent post-implementation source diff review.",
]

EMPTY_SHA = hashlib.sha256(b"").hexdigest()


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def load(path: pathlib.Path) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            if key in value:
                raise ValueError(f"duplicate JSON key: {key}")
            value[key] = item
        return value

    def invalid_constant(value: str) -> Any:
        raise ValueError(f"non-finite JSON value: {value}")

    value = json.loads(
        path.read_text(encoding="utf-8"),
        object_pairs_hook=pairs,
        parse_constant=invalid_constant,
    )
    if not isinstance(value, dict):
        raise ValueError("JSON root must be an object")
    return value


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest(path: pathlib.Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), digest_bytes(data)


def validate_static_artifact_pins(failures: list[str]) -> None:
    paths = {
        AUTHORITY_REL: AUTHORITY_PATH,
        BACKEND_TOKEN_REL: BACKEND_TOKEN_PATH,
        FRONTEND_TOKEN_REL: FRONTEND_TOKEN_PATH,
        CONSUMER_REL: CONSUMER_PATH,
    }
    require(set(paths) == set(EXPECTED_STATIC_ARTIFACT_PINS), "static artifact pin set drift", failures)
    for relative, expected in EXPECTED_STATIC_ARTIFACT_PINS.items():
        path = paths[relative]
        require(path.is_file(), f"static authority artifact missing: {relative}", failures)
        if path.is_file():
            size, sha256 = digest(path)
            require(size == expected["bytes"], f"static authority artifact byte drift: {relative}", failures)
            require(sha256 == expected["sha256"], f"static authority artifact SHA-256 drift: {relative}", failures)


def isolated_git_environment() -> dict[str, str]:
    return {
        "LANG": "C",
        "LC_ALL": "C",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_NO_REPLACE_OBJECTS": "1",
        "GIT_TERMINAL_PROMPT": "0",
    }


def git(repo: pathlib.Path, *args: str, check: bool = True, text: bool = True) -> subprocess.CompletedProcess[Any]:
    return subprocess.run(
        [GIT_BINARY, "-C", str(repo), *args],
        check=check,
        capture_output=True,
        text=text,
        env=isolated_git_environment(),
    )


def remote_git(*args: str, text: bool = True) -> subprocess.CompletedProcess[Any]:
    return subprocess.run(
        [GIT_BINARY, *args],
        check=False,
        capture_output=True,
        text=text,
        cwd="/",
        env=isolated_git_environment(),
    )


def git_text(repo: pathlib.Path, *args: str) -> str:
    return git(repo, *args).stdout.strip()


def validate_remote_head(
    repository: pathlib.Path,
    branch: str,
    expected_origin: str,
    expected_commit: str,
    label: str,
    failures: list[str],
) -> None:
    remote_url = git(repository, "remote", "get-url", "origin", check=False)
    require(
        remote_url.returncode == 0 and remote_url.stdout.strip() == expected_origin,
        f"{label} origin URL drift",
        failures,
    )
    remote = remote_git("ls-remote", "--heads", expected_origin, f"refs/heads/{branch}")
    expected_line = f"{expected_commit}\trefs/heads/{branch}"
    require(
        remote.returncode == 0 and [line for line in remote.stdout.splitlines() if line] == [expected_line],
        f"{label} authoritative remote head drift",
        failures,
    )


def artifact(path: pathlib.Path) -> dict[str, Any]:
    size, sha256 = digest(path)
    return {
        "path": path.relative_to(FRONTEND).as_posix(),
        "bytes": size,
        "sha256": sha256,
    }


def artifact_at(commit: str, relative: str) -> dict[str, Any]:
    result = git(FRONTEND, "show", f"{commit}:{relative}", text=False)
    return {"path": relative, "bytes": len(result.stdout), "sha256": digest_bytes(result.stdout)}


def validate_pins(pins: list[dict[str, Any]], failures: list[str]) -> None:
    require(pins == GOVERNING_PINS, "governing artifact pin set drift", failures)
    for pin in GOVERNING_PINS:
        path = FRONTEND / pin["path"]
        require(path.is_file(), f"governing artifact missing: {pin['path']}", failures)
        if path.is_file():
            size, sha256 = digest(path)
            require(size == pin["bytes"], f"governing artifact byte drift: {pin['path']}", failures)
            require(sha256 == pin["sha256"], f"governing artifact SHA-256 drift: {pin['path']}", failures)


def validate_authority(authority: dict[str, Any], successor: dict[str, Any], failures: list[str]) -> None:
    require(authority.get("schema") == "dwp.hris.wave7.per009-central-execution-authority.v1", "authority schema drift", failures)
    require(
        authority.get("authorityId") == "R7-B06-PER009-CENTRAL-V63-V273-MIRROR-EXECUTION-AUTHORITY-R1",
        "authority id drift",
        failures,
    )
    require(authority.get("sliceId") == "BASE-TFR-PER-009", "authority slice drift", failures)
    require(authority.get("module") == "PER", "authority module drift", failures)
    require(authority.get("moduleSession") == "HRIS-PER", "authority module session drift", failures)
    require(
        authority.get("state")
        == "INDEPENDENTLY_REVIEWED_HASH_BOUND_TWO_LANE_CENTRAL_EXECUTION_AUTHORITY_SOURCE_REQUIRES_CLEAN_RECEIPTS",
        "authority state drift",
        failures,
    )
    predecessor = authority.get("carrierPredecessor", {})
    require(predecessor.get("commit") == PREDECESSOR_COMMIT, "carrier predecessor commit drift", failures)
    require(predecessor.get("tree") == PREDECESSOR_TREE, "carrier predecessor tree drift", failures)
    require(set(predecessor.get("exactCarrierChangedPaths", [])) == CARRIER_PATHS, "carrier path set drift", failures)
    validate_pins(authority.get("governingArtifacts", []), failures)

    future = successor.get("futureSourceAllowlist", {})
    expected_backend = (
        future.get("backendCanonical", [])
        + future.get("backendGenerated", [])
        + future.get("backendTargetedTests", [])
    )
    allowlist = authority.get("sourceAllowlist", {})
    require(allowlist.get("backendWritable") == expected_backend, "backend exact write allowlist drift", failures)
    require(allowlist.get("frontendWritable") == future.get("frontendCentralMirror"), "frontend exact write allowlist drift", failures)
    require(
        allowlist.get("frontendReadExecuteBytePreserved") == future.get("frontendBytePreservedAndExecuted"),
        "frontend byte-preserved execution list drift",
        failures,
    )
    require(len(expected_backend) == 33 and len(set(expected_backend)) == 33, "backend allowlist cardinality drift", failures)
    require(len(allowlist.get("frontendWritable", [])) == 5, "frontend allowlist cardinality drift", failures)
    require(len(allowlist.get("frontendReadExecuteBytePreserved", [])) == 4, "frontend preserved list cardinality drift", failures)
    require(allowlist.get("backendChangedPathsMustEqualSealedAllowlist") is True, "backend exact changed-path contract drift", failures)
    require(allowlist.get("frontendChangedPathsMustEqualSealedAllowlist") is True, "frontend exact changed-path contract drift", failures)
    require(allowlist.get("allSealedPathsMustHaveMaterialReviewableDiffs") is True, "material diff contract drift", failures)
    require(allowlist.get("manualGeneratedFileEditingAllowed") is False, "manual generated editing escaped", failures)
    require(allowlist.get("generalPurposeGeneratorRuntimeAndTestSemanticProofProvided") is False, "general-purpose source proof overclaim", failures)
    require(allowlist.get("independentPostImplementationSourceDiffReviewRequired") is True, "independent source diff review requirement drift", failures)
    require(allowlist.get("pathExpansionRequiresAppendOnlyAuthoritySuccessor") is True, "allowlist expansion contract drift", failures)
    require(
        "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql"
        in expected_backend,
        "exact Auth V273 path missing",
        failures,
    )
    require(
        all("approval-pilot-pep-v63" not in path for path in expected_backend),
        "forbidden Approval v63 projection escaped",
        failures,
    )
    bases = authority.get("repositoryBases", {})
    require(
        bases.get("backend")
        == {
            "repository": "dwp-backend",
            "branch": "dwp-dev",
            "originUrl": BACKEND_ORIGIN,
            "commit": BACKEND_BASE,
            "tree": BACKEND_TREE,
            "originMatchedAtAudit": True,
            "sharedCheckoutDirtyChangesExcluded": True,
            "v63Absent": True,
            "v273Absent": True,
            "authMigrationHighWater": "V272",
        },
        "backend repository base closed set drift",
        failures,
    )
    require(
        bases.get("agent")
        == {
            "repository": "dwp_agent",
            "branch": "dwp-dev",
            "originUrl": AGENT_ORIGIN,
            "commit": AGENT_BASE,
            "tree": AGENT_TREE,
            "originMatchedAtAudit": True,
            "sourceChangeRequired": False,
        },
        "Agent repository base closed set drift",
        failures,
    )
    require(
        bases.get("frontend")
        == {
            "repository": "dwp-frontend",
            "branch": "dwp-dev",
            "originUrl": FRONTEND_ORIGIN,
            "carrierBaseCommit": "CARRIER_COMMIT_SELF",
            "carrierBaseTree": "CARRIER_TREE_SELF",
            "sharedCheckoutDirtyChangesExcluded": True,
            "mirrorObservedVersion": 61,
            "mirrorObservedBytes": 79834507,
            "mirrorObservedSha256": "b94225a99141cb57deb589dca97c40a4d5026878e01c50751dfe635ee888365e",
        },
        "Frontend repository base closed set drift",
        failures,
    )
    semantic = authority.get("semanticClosure", {})
    require(
        semantic.get("backendExpectedCounts")
        == {
            "capabilities": 281,
            "accessPolicies": 24,
            "entitlementExpressions": 17,
            "predicatePolicies": 88,
            "routes": 1160,
            "PAGE": 162,
            "DATA": 349,
            "ACTION": 649,
        },
        "v63 expected count closure drift",
        failures,
    )
    require(semantic.get("addedCapabilities") == ["per.goal.self.write"], "v63 capability delta drift", failures)
    require(semantic.get("addedPredicates") == ["predicate.hcm-performance-goal-command.v1"], "v63 predicate delta drift", failures)
    require(
        semantic.get("addedRoutes")
        == ["route.hcm.performance.goal-create.action", "route.hcm.performance.goal-submit.action"],
        "v63 route delta drift",
        failures,
    )
    require(semantic.get("bundleStatus") == "DRAFT", "v63 status drift", failures)
    require(semantic.get("automaticImport") is False, "automatic import escaped", failures)
    require(semantic.get("featureBaseline") == "OFF", "feature baseline drift", failures)
    require(semantic.get("globalActiveRows") == 0 and semantic.get("tenantEnrollmentRows") == 0, "derived authority escaped", failures)
    require(semantic.get("frontendMirrorVersions") == [62, 63], "Frontend mirror order drift", failures)
    require(semantic.get("frontendMaximumSnapshotBytes") == 104857600, "Frontend mirror ceiling drift", failures)
    require(semantic.get("peopleRuntimeRemainsBoundToVersion") == 60, "People runtime binding escaped", failures)
    require(semantic.get("generatedV63PeopleProjectionMounted") is False, "generated People v63 projection mounted", failures)
    lanes = authority.get("lanes", {})
    require(
        lanes.get("carrierValidation")
        == {
            "repository": "dwp-frontend",
            "worktree": str(CARRIER_VALIDATION_WORKTREE),
            "checkoutMode": "DETACHED_EXACT_DWP_DEV_CARRIER",
            "mustRemainCleanThroughBothLaneConsumptions": True,
            "productLane": False,
        },
        "carrier validation worktree contract drift",
        failures,
    )
    require(lanes.get("backend", {}).get("branch") == BACKEND_LANE, "backend lane branch drift", failures)
    require(lanes.get("backend", {}).get("worktree") == str(BACKEND_WORKTREE), "backend lane worktree drift", failures)
    require(lanes.get("frontend", {}).get("branch") == FRONTEND_LANE, "frontend lane branch drift", failures)
    require(lanes.get("frontend", {}).get("worktree") == str(FRONTEND_WORKTREE), "frontend lane worktree drift", failures)
    require(authority.get("authority") == EXPECTED_AUTHORITY, "authority closed set drift", failures)
    lifecycle = authority.get("tokenLifecycle", {})
    require(lifecycle.get("maximumConsumptionPerToken") == 1, "token max-use drift", failures)
    require(lifecycle.get("replayAllowedWithinRetainedCurrentUidReceiptLedger") is False, "retained-ledger token replay escaped", failures)
    require(lifecycle.get("failedOrAbortedAfterAtomicConsumptionBurnsTokenWithinRetainedCurrentUidReceiptLedger") is True, "retained-ledger post-admission burn drift", failures)
    require(lifecycle.get("receiptDirectoryMode") == "0700", "receipt directory mode drift", failures)
    require(lifecycle.get("receiptFileMode") == "0600", "receipt file mode drift", failures)
    require(lifecycle.get("preConsumptionRevalidationRequired") is True, "pre-consumption revalidation missing", failures)
    require(lifecycle.get("preAdmissionValidationFailureConsumesToken") is False, "pre-admission denial unexpectedly burns token", failures)
    require(lifecycle.get("oExclProtectionScope") == "CONCURRENT_REPLAY_ONLY_WHILE_CURRENT_UID_0700_RECEIPT_LEDGER_AND_0600_RECEIPT_ARE_RETAINED", "O_EXCL protection scope drift", failures)
    require(lifecycle.get("sameUidReceiptDeletionOrRollbackDurableTamperResistanceProvided") is False, "same-UID receipt tamper-resistance overclaim", failures)
    require(lifecycle.get("durableCompareAndSwapOrExternalAppendOnlyAnchorProvided") is False, "durable CAS overclaim", failures)
    require(
        lifecycle.get("consumeBy")
        == "while carrier, token, clean receipt, exact base HEAD/tree/origin, worktree cleanliness, branch absence and allowlist digest remain unchanged",
        "token state-bound validity drift",
        failures,
    )
    require(lifecycle.get("backendExecutionDeadlineHoursAfterConsumption") == 4, "backend deadline drift", failures)
    require(lifecycle.get("frontendExecutionDeadlineHoursAfterConsumption") == 2, "frontend deadline drift", failures)
    require(lifecycle.get("executionDeadlineSemantics") == "PROCEDURAL_BOUNDED_WORK_WINDOW_ONLY", "deadline semantics drift", failures)
    require(lifecycle.get("trustedClockAttestationProvided") is False, "trusted-clock attestation overclaim", failures)
    require(lifecycle.get("cryptographicClockAttestationProvided") is False, "cryptographic clock attestation overclaim", failures)
    require(lifecycle.get("backendMustCompleteBeforeFrontendSourceWrite") is True, "lane sequencing drift", failures)
    require(lifecycle.get("directDwpDevIntegrationAuthorized") is False, "dwp-dev integration authority escaped", failures)
    require(authority.get("trustedExecutionIdentityContract") == EXPECTED_IDENTITY_CONTRACT, "trusted execution identity contract drift", failures)
    identity_values = [value for key, value in EXPECTED_IDENTITY_CONTRACT.items() if key.endswith(("Executor", "Verifier", "Reviewer"))]
    require(len(identity_values) == len(set(identity_values)) == 6, "trusted execution identities are not distinct", failures)
    require(authority.get("laneEvidenceContract") == EXPECTED_LANE_EVIDENCE_CONTRACT, "lane evidence contract drift", failures)
    require(authority.get("immutability", {}).get("sealed") is True, "authority is not sealed", failures)
    require(
        authority.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "authority amendment policy drift",
        failures,
    )


def validate_token(token: dict[str, Any], lane: str, authority: dict[str, Any], failures: list[str]) -> None:
    backend = lane == "backend"
    expected_schema = (
        "dwp.hris.wave7.per009-backend-central-start-token.v1"
        if backend
        else "dwp.hris.wave7.per009-frontend-mirror-start-token.v1"
    )
    expected_lane = "PER009_CENTRAL_BACKEND_V63_V273" if backend else "PER009_CENTRAL_FRONTEND_V62_V63_MIRROR"
    expected_id = (
        "HRIS-WAVE7-R7-BATCH06-PER009-CENTRAL-BACKEND-V63-V273-20261028-R1"
        if backend
        else "HRIS-WAVE7-R7-BATCH06-PER009-CENTRAL-FRONTEND-V62-V63-MIRROR-20261028-R1"
    )
    expected_state = (
        "ISSUED_HASH_BOUND_ONE_SHOT_EXECUTABLE_AFTER_CARRIER_PUSH_AND_CLEAN_RECEIPT"
        if backend
        else "ISSUED_HASH_BOUND_ONE_SHOT_DEPENDENCY_GATED_BY_REVIEWED_BACKEND_LANE"
    )
    expected_branch = BACKEND_LANE if backend else FRONTEND_LANE
    expected_worktree = BACKEND_WORKTREE if backend else FRONTEND_WORKTREE
    expected_receipt = BACKEND_RECEIPT if backend else FRONTEND_RECEIPT
    expected_consumption = BACKEND_CONSUMPTION if backend else FRONTEND_CONSUMPTION
    require(token.get("schema") == expected_schema, f"{lane} token schema drift", failures)
    require(token.get("tokenId") == expected_id, f"{lane} token id drift", failures)
    require(token.get("laneId") == expected_lane, f"{lane} token lane drift", failures)
    require(token.get("state") == expected_state, f"{lane} token state drift", failures)
    require(token.get("jti") == f"per009-central-{'backend-v63-v273' if backend else 'frontend-v62-v63-mirror'}-20261028-r1", f"{lane} token jti drift", failures)
    execution = token.get("execution", {})
    require(
        token.get("authorityBinding", {}).get("consumerPath") == CONSUMER_REL,
        f"{lane} token consumer binding drift",
        failures,
    )
    require(
        token.get("authorityBinding", {}).get("consumerInvocation")
        == (
            f"/usr/bin/python3 -I {CARRIER_VALIDATION_WORKTREE / CONSUMER_REL} backend --executor {BACKEND_EXECUTOR}"
            if backend
            else f"/usr/bin/python3 -I {CARRIER_VALIDATION_WORKTREE / CONSUMER_REL} frontend --executor {FRONTEND_EXECUTOR}"
        ),
        f"{lane} token isolated consumer invocation drift",
        failures,
    )
    require(execution.get("branch") == expected_branch, f"{lane} token branch drift", failures)
    require(execution.get("worktree") == str(expected_worktree), f"{lane} token worktree drift", failures)
    require(execution.get("cleanWorktreeReceiptPath") == str(expected_receipt), f"{lane} receipt path drift", failures)
    require(
        execution.get("completionEvidence")
        == {
            "targetedVerificationReceiptPath": str(BACKEND_TARGETED if backend else FRONTEND_TARGETED),
            "postImplementationReviewPath": str(BACKEND_POST_REVIEW if backend else FRONTEND_POST_REVIEW),
            "requiredVerifier": BACKEND_VERIFIER if backend else FRONTEND_VERIFIER,
            "requiredReviewer": BACKEND_REVIEWER if backend else FRONTEND_REVIEWER,
            "requiredDecision": (
                "GO_FOR_PER009_BACKEND_V63_V273_LANE_BRANCH_PUSH_ONLY"
                if backend
                else "GO_FOR_PER009_FRONTEND_V62_V63_MIRROR_LANE_BRANCH_PUSH_ONLY"
            ),
        },
        f"{lane} completion evidence contract drift",
        failures,
    )
    require(
        execution.get("operation")
        == (
            "GENERATE_VALIDATE_COMMIT_AND_PUSH_PRODUCT_AUTHORIZATION_V63_AND_AUTH_V273_ONLY"
            if backend
            else "SYNC_VALIDATE_COMMIT_AND_PUSH_UNMOUNTED_FRONTEND_V62_V63_MIRROR_ONLY"
        ),
        f"{lane} operation drift",
        failures,
    )
    if backend:
        require(execution.get("baseCommit") == BACKEND_BASE, "backend token base commit drift", failures)
        require(execution.get("baseTree") == BACKEND_TREE, "backend token base tree drift", failures)
    else:
        require(execution.get("baseCommit") == "CARRIER_COMMIT_SELF", "frontend token dynamic base commit drift", failures)
        require(execution.get("baseTree") == "CARRIER_TREE_SELF", "frontend token dynamic base tree drift", failures)
        dependency = execution.get("backendDependency", {})
        require(
            dependency
            == {
                "laneBranch": BACKEND_LANE,
                "targetedVerificationReceiptPath": str(BACKEND_TARGETED),
                "postImplementationReviewPath": str(BACKEND_POST_REVIEW),
                "requiredDecision": "GO_FOR_PER009_BACKEND_V63_V273_LANE_BRANCH_PUSH_ONLY",
                "requiredP0": 0,
                "requiredP1": 0,
                "requiredP2": 0,
                "remoteLanePushRequired": True,
                "exactCommitTreeChecksumAndReceiptHashesMustBeBoundAtConsumption": True,
            },
            "frontend backend dependency closed set drift",
            failures,
        )
    one_shot = token.get("oneShot", {})
    require(one_shot.get("maximumConsumptions") == 1, f"{lane} token max-use drift", failures)
    require(one_shot.get("consumedAtIssue") is False, f"{lane} token pre-consumed", failures)
    require(one_shot.get("replayAllowedWithinRetainedCurrentUidReceiptLedger") is False, f"{lane} retained-ledger replay escaped", failures)
    require(one_shot.get("failedOrAbortedAfterAtomicConsumptionBurnsTokenWithinRetainedCurrentUidReceiptLedger") is True, f"{lane} retained-ledger burn drift", failures)
    require(one_shot.get("preConsumptionRevalidationRequired") is True, f"{lane} pre-consumption revalidation drift", failures)
    require(one_shot.get("preAdmissionValidationFailureConsumesToken") is False, f"{lane} pre-admission consumption drift", failures)
    require(one_shot.get("oExclProtectionScope") == "CONCURRENT_REPLAY_ONLY_WHILE_CURRENT_UID_0700_RECEIPT_LEDGER_AND_0600_RECEIPT_ARE_RETAINED", f"{lane} O_EXCL protection scope drift", failures)
    require(one_shot.get("sameUidReceiptDeletionOrRollbackDurableTamperResistanceProvided") is False, f"{lane} same-UID tamper-resistance overclaim", failures)
    require(one_shot.get("durableCompareAndSwapOrExternalAppendOnlyAnchorProvided") is False, f"{lane} durable CAS overclaim", failures)
    require(one_shot.get("requiredExecutor") == (BACKEND_EXECUTOR if backend else FRONTEND_EXECUTOR), f"{lane} executor identity drift", failures)
    require(
        one_shot.get("consumeBy")
        == (
            "while carrier, token, clean receipt, exact base HEAD/tree/origin, worktree cleanliness, branch absence and allowlist digest remain unchanged"
            if backend
            else "while carrier, token, fresh Frontend clean receipt, exact carrier-base HEAD/tree/origin, worktree cleanliness, exact reviewed Backend dependency and allowlist digest remain unchanged"
        ),
        f"{lane} state-bound validity drift",
        failures,
    )
    require(one_shot.get("executionDeadlineHoursAfterConsumption") == (4 if backend else 2), f"{lane} deadline drift", failures)
    require(one_shot.get("executionDeadlineSemantics") == "PROCEDURAL_BOUNDED_WORK_WINDOW_ONLY", f"{lane} deadline semantics drift", failures)
    require(one_shot.get("trustedClockAttestationProvided") is False, f"{lane} trusted-clock overclaim", failures)
    require(one_shot.get("cryptographicClockAttestationProvided") is False, f"{lane} cryptographic-clock overclaim", failures)
    require(one_shot.get("consumptionReceiptPath") == str(expected_consumption), f"{lane} consumption path drift", failures)
    require(one_shot.get("consumptionReceiptMustBeCreatedAtomicallyBeforeFirstSourceWrite") is True, f"{lane} atomic consume drift", failures)
    require(
        one_shot.get("atomicCreation")
        == "current-UID 0700 directory; O_CREAT|O_EXCL|O_NOFOLLOW 0600 regular single-link file; fsync file and parent directory",
        f"{lane} atomic creation contract drift",
        failures,
    )
    expected_receipt_pins = [
        "jti and exact token SHA-256",
        "exact authority SHA-256 and carrier commit/tree",
        "repository, worktree realpath, branch, HEAD, tree and origin/dwp-dev",
        "clean receipt SHA-256 and closed allowlist digest",
    ]
    if not backend:
        expected_receipt_pins.append("reviewed Backend lane commit, tree, v63 checksum and receipt SHA-256 values")
    expected_receipt_pins.append("consumedAt, executionDeadline and executor identity")
    require(one_shot.get("receiptMustPin") == expected_receipt_pins, f"{lane} consumption pin closure drift", failures)
    require(one_shot.get("consumptionReceiptMustBeAbsentBeforeSourceWrite") is True, f"{lane} pre-write absence gate drift", failures)
    require(
        one_shot.get("expiresOn")
        == (
            [
                "base HEAD or tree drift",
                "origin/dwp-dev drift from the bound base before lane commit",
                "worktree dirty state before consumption",
                "allowlist or governing-artifact drift",
                "first committed lane result",
                "any prior consumption receipt",
            ]
            if backend
            else [
                "carrier-base HEAD or tree drift",
                "origin/dwp-dev drift from the bound base before lane commit",
                "worktree dirty state before consumption",
                "Backend dependency commit, tree, checksum, receipt or remote branch drift",
                "allowlist or governing-artifact drift",
                "first committed lane result",
                "any prior consumption receipt",
            ]
        ),
        f"{lane} token invalidation set drift",
        failures,
    )
    authorization = token.get("authorization", {})
    require(
        authorization == (EXPECTED_BACKEND_TOKEN_AUTHORITY if backend else EXPECTED_FRONTEND_TOKEN_AUTHORITY),
        f"{lane} token authority closed set drift",
        failures,
    )
    require(
        token.get("verification", {}).get("commands")
        == authority.get("verificationContract", {}).get("backendCommands" if backend else "frontendCommands"),
        f"{lane} exact verification command drift",
        failures,
    )


def validate_review(failures: list[str]) -> None:
    require(REVIEW_PATH.is_file(), "independent review missing", failures)
    if not REVIEW_PATH.is_file():
        return
    try:
        review = load(REVIEW_PATH)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"independent review cannot be loaded: {exc}")
        return
    require(
        set(review)
        == {
            "schema", "reviewId", "sliceId", "module", "moduleSession", "reviewedAt", "state",
            "independentReviewers", "artifactPins", "verifiedBoundaries", "postResolutionSeverityCounts",
            "authority", "nextAction", "nonClaims", "immutability",
        },
        "review field closure drift",
        failures,
    )
    require(review.get("schema") == "dwp.hris.wave7.per009-central-execution-authority-independent-review.v1", "review schema drift", failures)
    require(review.get("reviewId") == "R7-B06-PER009-CENTRAL-EXECUTION-AUTHORITY-INDEPENDENT-REVIEW-R1", "review id drift", failures)
    require(review.get("sliceId") == "BASE-TFR-PER-009", "review slice drift", failures)
    require(review.get("module") == "PER" and review.get("moduleSession") == "HRIS-PER", "review module identity drift", failures)
    require(review.get("state") == "PASS_ZERO_P0_ZERO_P1_ZERO_P2_CARRIER_AND_CLEAN_WORKTREE_MATERIALIZATION_AUTHORIZED", "review state drift", failures)
    expected_pins = [
        artifact(AUTHORITY_PATH),
        artifact(BACKEND_TOKEN_PATH),
        artifact(FRONTEND_TOKEN_PATH),
        artifact(CONSUMER_PATH),
        artifact(VALIDATOR_PATH),
    ]
    require(review.get("artifactPins") == expected_pins, "review artifact pin set drift", failures)
    require(review.get("independentReviewers") == EXPECTED_REVIEWERS, "reviewer evidence drift", failures)
    require(review.get("verifiedBoundaries") == EXPECTED_REVIEW_BOUNDARIES, "review boundary closure drift", failures)
    require(review.get("postResolutionSeverityCounts") == {"P0": 0, "P1": 0, "P2": 0}, "review severity drift", failures)
    require(review.get("authority") == EXPECTED_REVIEW_AUTHORITY, "review authority closed set drift", failures)
    require(review.get("nextAction") == EXPECTED_REVIEW_NEXT_ACTION, "review next action drift", failures)
    require(review.get("nonClaims") == EXPECTED_REVIEW_NONCLAIMS, "review non-claim closure drift", failures)
    reviewed_at = parse_time(review.get("reviewedAt"), "review reviewedAt", failures)
    immutability = review.get("immutability", {})
    require(
        set(immutability) == {"sealed", "sealedAt", "amendmentPolicy"},
        "review immutability field closure drift",
        failures,
    )
    require(immutability.get("sealed") is True, "review is not sealed", failures)
    sealed_at = parse_time(immutability.get("sealedAt"), "review sealedAt", failures)
    if reviewed_at is not None and sealed_at is not None:
        require(reviewed_at == sealed_at, "review sealedAt does not equal reviewedAt", failures)
    require(
        immutability.get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "review amendment policy drift",
        failures,
    )


def carrier_commit(failures: list[str]) -> tuple[str, str] | None:
    expected_protections = {
        "assumeUnchangedPaths": [],
        "skipWorktreePaths": [],
        "sparseCheckoutEnabled": False,
        "fsmonitorConfigured": False,
        "diffExternalConfigured": False,
        "graftFilePresent": False,
        "replaceRefs": [],
        "repositoryOrWorktreePathSymlinks": [],
    }
    require(
        pathlib.Path(os.path.abspath(FRONTEND)) == CARRIER_VALIDATION_WORKTREE,
        "validator is not running from the sealed carrier validation worktree",
        failures,
    )
    validate_repository_provenance(CANONICAL_FRONTEND, FRONTEND, "Frontend validation checkout", failures)
    validate_local_git_config(FRONTEND, "Frontend validation checkout", failures)
    require(actual_protections(FRONTEND, FRONTEND) == expected_protections, "Frontend validation checkout protections drift", failures)
    require(git_common_dir(FRONTEND) == CANONICAL_FRONTEND / ".git", "Frontend validation checkout git-common-dir drift", failures)
    try:
        head = git_text(FRONTEND, "rev-parse", "HEAD")
        local = git_text(FRONTEND, "rev-parse", "dwp-dev")
        origin = git_text(FRONTEND, "rev-parse", "origin/dwp-dev")
    except subprocess.CalledProcessError as exc:
        failures.append(f"carrier refs cannot be resolved: {exc.stderr.strip()}")
        return None
    require(head == local, "validation worktree HEAD is not current dwp-dev", failures)
    require(local == origin, "Frontend dwp-dev is not synchronized with origin", failures)
    require(git_text(FRONTEND, "branch", "--show-current") == "", "carrier validation worktree is not detached", failures)
    require(
        git(FRONTEND, "symbolic-ref", "-q", "HEAD", check=False).returncode != 0,
        "carrier validation worktree HEAD is symbolic",
        failures,
    )
    validate_remote_head(FRONTEND, "dwp-dev", FRONTEND_ORIGIN, local, "Frontend carrier", failures)
    parents = git_text(FRONTEND, "show", "-s", "--format=%P", local).split()
    require(parents == [PREDECESSOR_COMMIT], "carrier commit is not one direct non-merge child of predecessor", failures)
    changed = {
        line for line in git_text(FRONTEND, "diff", "--name-only", f"{PREDECESSOR_COMMIT}..{local}", "--").splitlines() if line
    }
    require(changed == CARRIER_PATHS, "carrier changed-path closure drift", failures)
    validate_changed_path_modes(
        FRONTEND,
        FRONTEND,
        PREDECESSOR_COMMIT,
        local,
        sorted(CARRIER_PATHS),
        "carrier",
        failures,
    )
    tree = git_text(FRONTEND, "rev-parse", f"{local}^{{tree}}")
    for ref_name in ("dwp-dev", "origin/dwp-dev"):
        for relative in sorted(CARRIER_PATHS):
            result = git(FRONTEND, "show", f"{ref_name}:{relative}", check=False, text=False)
            require(result.returncode == 0, f"carrier blob missing at {ref_name}:{relative}", failures)
            path = FRONTEND / relative
            if result.returncode == 0 and path.is_file():
                require(path.read_bytes() == result.stdout, f"carrier worktree differs from {ref_name}:{relative}", failures)
    require(git(FRONTEND, "status", "--porcelain", "--untracked-files=all").stdout == "", "Frontend validation worktree is not clean", failures)
    require(git(FRONTEND, "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching").stdout == "", "Frontend validation worktree contains ignored shadow paths", failures)
    return local, tree


def validate_static_repositories(failures: list[str]) -> None:
    for repository, label in (
        (CANONICAL_FRONTEND, "Frontend canonical repository"),
        (BACKEND, "Backend canonical repository"),
        (AGENT, "Agent canonical repository"),
    ):
        validate_repository_provenance(repository, repository, label, failures)
        validate_local_git_config(repository, label, failures)
    try:
        predecessor_tree = git_text(FRONTEND, "rev-parse", f"{PREDECESSOR_COMMIT}^{{tree}}")
        backend_local = git_text(BACKEND, "rev-parse", "dwp-dev")
        backend_origin = git_text(BACKEND, "rev-parse", "origin/dwp-dev")
        backend_tree = git_text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}")
        agent_local = git_text(AGENT, "rev-parse", "dwp-dev")
        agent_origin = git_text(AGENT, "rev-parse", "origin/dwp-dev")
        agent_tree = git_text(AGENT, "rev-parse", f"{AGENT_BASE}^{{tree}}")
    except subprocess.CalledProcessError as exc:
        failures.append(f"repository baseline cannot be resolved: {exc.stderr.strip()}")
        return
    require(predecessor_tree == PREDECESSOR_TREE, "carrier predecessor tree drift", failures)
    require(backend_local == BACKEND_BASE and backend_origin == BACKEND_BASE, "Backend dwp-dev base drift", failures)
    require(backend_tree == BACKEND_TREE, "Backend tree drift", failures)
    require(agent_local == AGENT_BASE and agent_origin == AGENT_BASE, "Agent dwp-dev base drift", failures)
    require(agent_tree == AGENT_TREE, "Agent tree drift", failures)
    validate_remote_head(BACKEND, "dwp-dev", BACKEND_ORIGIN, BACKEND_BASE, "Backend", failures)
    validate_remote_head(AGENT, "dwp-dev", AGENT_ORIGIN, AGENT_BASE, "Agent", failures)
    for relative in (
        "contracts/product-authorization/product-surfaces-v1.bundle-v63.json",
        "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql",
    ):
        absent = git(BACKEND, "cat-file", "-e", f"{BACKEND_BASE}:{relative}", check=False)
        require(absent.returncode != 0, f"unauthorized base artifact already exists: {relative}", failures)
    mirror = FRONTEND / "architecture/product-surface-authorization.v1.json"
    if mirror.is_file():
        size, sha256 = digest(mirror)
        require(size == 79834507, "Frontend mirror baseline byte drift", failures)
        require(sha256 == "b94225a99141cb57deb589dca97c40a4d5026878e01c50751dfe635ee888365e", "Frontend mirror baseline SHA-256 drift", failures)


def secure_receipt_bytes(path: pathlib.Path, failures: list[str]) -> bytes | None:
    require(RECEIPT_ROOT.is_dir(), f"receipt directory missing: {RECEIPT_ROOT}", failures)
    if RECEIPT_ROOT.is_dir():
        root_info = RECEIPT_ROOT.lstat()
        require(not RECEIPT_ROOT.is_symlink(), "receipt directory symlink forbidden", failures)
        require(stat.S_IMODE(root_info.st_mode) == 0o700, "receipt directory mode is not 0700", failures)
        require(root_info.st_uid == os.geteuid(), "receipt directory owner drift", failures)
        require(not symlink_components(RECEIPT_ROOT), "receipt directory ancestor symlink forbidden", failures)
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags)
    except FileNotFoundError:
        failures.append(f"clean receipt missing: {path}")
        return None
    except OSError as exc:
        failures.append(f"receipt cannot be opened safely: {path}: {exc}")
        return None
    try:
        info = os.fstat(descriptor)
        valid = True
        for condition, message in (
            (stat.S_ISREG(info.st_mode), f"receipt is not regular: {path}"),
            (stat.S_IMODE(info.st_mode) == 0o600, f"receipt mode is not 0600: {path}"),
            (info.st_uid == os.geteuid(), f"receipt owner drift: {path}"),
            (info.st_nlink == 1, f"receipt link count drift: {path}"),
            (info.st_size <= 65536, f"receipt exceeds size bound: {path}"),
        ):
            require(condition, message, failures)
            valid = valid and condition
        data = bytearray()
        while len(data) <= 65536:
            chunk = os.read(descriptor, min(65537 - len(data), 8192))
            if not chunk:
                break
            data.extend(chunk)
        require(len(data) == info.st_size and len(data) <= 65536, f"receipt size changed while reading: {path}", failures)
        valid = valid and len(data) == info.st_size and len(data) <= 65536
        return bytes(data) if valid else None
    finally:
        os.close(descriptor)
def parse_time(value: Any, label: str, failures: list[str]) -> datetime | None:
    if not isinstance(value, str):
        failures.append(f"missing timestamp: {label}")
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        failures.append(f"invalid timestamp: {label}")
        return None
    if parsed.utcoffset() is None:
        failures.append(f"timestamp must be timezone-aware: {label}")
        return None
    return parsed


def actual_protections(repository: pathlib.Path, worktree: pathlib.Path) -> dict[str, Any]:
    listed = git(worktree, "ls-files", "-v").stdout.splitlines()
    assume = sorted(line[2:] for line in listed if line and line[0].islower())
    skip = sorted(line[2:] for line in listed if line.startswith("S "))
    sparse = git(worktree, "config", "--bool", "core.sparseCheckout", check=False)
    fsmonitor = git(worktree, "config", "--get", "core.fsmonitor", check=False)
    diff_external = git(worktree, "config", "--get", "diff.external", check=False)
    common_value = git_text(worktree, "rev-parse", "--git-common-dir")
    common = pathlib.Path(common_value)
    if not common.is_absolute():
        common = pathlib.Path(os.path.abspath(worktree / common))
    replace_refs = git(worktree, "for-each-ref", "--format=%(refname)", "refs/replace").stdout.splitlines()
    symlinks = [str(path) for path in (repository, worktree) if path.is_symlink()]
    return {
        "assumeUnchangedPaths": assume,
        "skipWorktreePaths": skip,
        "sparseCheckoutEnabled": sparse.returncode == 0 and sparse.stdout.strip().lower() == "true",
        "fsmonitorConfigured": fsmonitor.returncode == 0 and bool(fsmonitor.stdout.strip()),
        "diffExternalConfigured": diff_external.returncode == 0 and bool(diff_external.stdout.strip()),
        "graftFilePresent": (common / "info/grafts").exists(),
        "replaceRefs": sorted(ref for ref in replace_refs if ref),
        "repositoryOrWorktreePathSymlinks": symlinks,
    }


def git_common_dir(worktree: pathlib.Path) -> pathlib.Path:
    value = pathlib.Path(git_text(worktree, "rev-parse", "--git-common-dir"))
    if not value.is_absolute():
        value = worktree / value
    return pathlib.Path(os.path.abspath(value))


def symlink_components(path: pathlib.Path) -> list[str]:
    absolute = pathlib.Path(os.path.abspath(path))
    current = pathlib.Path(absolute.anchor)
    found: list[str] = []
    for part in absolute.parts[1:]:
        current = current / part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                found.append(str(current))
        except OSError:
            break
    return found


def validate_local_git_config(worktree: pathlib.Path, label: str, failures: list[str]) -> None:
    listed = git(
        worktree,
        "config",
        "--name-only",
        "--get-regexp",
        ".*",
        check=False,
    )
    dangerous_pattern = re.compile(
        r"^(extensions\.worktreeconfig|core\.worktree|core\.attributesfile|include\..*|includeif\..*|url\..*\.(insteadof|pushinsteadof)|remote\..*\.(uploadpack|receivepack)|filter\..*)$"
    )
    dangerous_keys = [
        key for key in listed.stdout.splitlines() if dangerous_pattern.fullmatch(key.strip().lower())
    ]
    require(
        listed.returncode in {0, 1} and not dangerous_keys,
        f"{label} has transport or worktree-rewriting local Git config",
        failures,
    )


def validate_repository_provenance(
    repository: pathlib.Path,
    worktree: pathlib.Path,
    label: str,
    failures: list[str],
) -> None:
    expected_common = repository / ".git"
    require(not symlink_components(repository), f"{label} repository path contains symlink", failures)
    require(not symlink_components(worktree), f"{label} worktree path contains symlink", failures)
    try:
        common_info = expected_common.lstat()
    except OSError:
        failures.append(f"{label} canonical .git is missing")
        return
    require(stat.S_ISDIR(common_info.st_mode) and not expected_common.is_symlink(), f"{label} canonical .git is not a raw directory", failures)
    require(not symlink_components(expected_common), f"{label} canonical .git path contains symlink", failures)
    marker = worktree / ".git"
    try:
        marker_info = marker.lstat()
    except OSError:
        failures.append(f"{label} worktree .git marker is missing")
        return
    if pathlib.Path(os.path.abspath(worktree)) == pathlib.Path(os.path.abspath(repository)):
        require(stat.S_ISDIR(marker_info.st_mode) and not marker.is_symlink(), f"{label} canonical .git marker drift", failures)
    else:
        require(stat.S_ISREG(marker_info.st_mode) and not marker.is_symlink(), f"{label} linked-worktree .git marker is not a raw file", failures)
        try:
            marker_text = marker.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeDecodeError) as exc:
            failures.append(f"{label} linked-worktree .git marker cannot be read: {exc}")
        else:
            prefix = "gitdir: "
            require(marker_text.startswith(prefix), f"{label} linked-worktree .git marker format drift", failures)
            if marker_text.startswith(prefix):
                target = pathlib.Path(marker_text[len(prefix):])
                if not target.is_absolute():
                    target = marker.parent / target
                target = pathlib.Path(os.path.abspath(target))
                expected_root = pathlib.Path(os.path.abspath(expected_common / "worktrees"))
                try:
                    inside = os.path.commonpath([str(target), str(expected_root)]) == str(expected_root)
                except ValueError:
                    inside = False
                require(inside, f"{label} linked-worktree gitdir escapes canonical common dir", failures)
                require(not symlink_components(target), f"{label} linked-worktree gitdir path contains symlink", failures)
    require(git_common_dir(worktree) == expected_common, f"{label} git-common-dir drift", failures)


def tree_entry(repository: pathlib.Path, commit: str, relative: str) -> tuple[str, str, str] | None:
    result = git(repository, "ls-tree", "-z", commit, "--", relative, check=False, text=False)
    if result.returncode != 0 or not result.stdout:
        return None
    records = [record for record in result.stdout.split(b"\0") if record]
    if len(records) != 1 or b"\t" not in records[0]:
        return None
    metadata, path_bytes = records[0].split(b"\t", 1)
    parts = metadata.decode("ascii").split()
    if len(parts) != 3 or path_bytes.decode("utf-8") != relative:
        return None
    return parts[0], parts[1], parts[2]


def validate_changed_path_modes(
    repository: pathlib.Path,
    worktree: pathlib.Path,
    base_commit: str,
    tested_commit: str,
    changed_paths: list[str],
    label: str,
    failures: list[str],
) -> None:
    status_lines = [
        line
        for line in git_text(repository, "diff", "--name-status", "--no-renames", f"{base_commit}..{tested_commit}", "--").splitlines()
        if line
    ]
    parsed_paths: list[str] = []
    for line in status_lines:
        fields = line.split("\t")
        require(len(fields) == 2 and fields[0] in {"A", "M"}, f"{label} deletion, rename or unsupported status: {line}", failures)
        if len(fields) == 2:
            parsed_paths.append(fields[1])
    require(parsed_paths == changed_paths, f"{label} changed status/path closure drift", failures)
    for relative in changed_paths:
        target = tree_entry(repository, tested_commit, relative)
        base = tree_entry(repository, base_commit, relative)
        require(target is not None, f"{label} target tree entry missing: {relative}", failures)
        if target is None:
            continue
        mode, object_type, _ = target
        require(object_type == "blob" and mode not in {"120000", "160000"}, f"{label} non-blob or symlink/gitlink entry: {relative}", failures)
        if base is None:
            require(mode == "100644", f"{label} new path mode is not 100644: {relative}", failures)
        else:
            require((mode, object_type) == (base[0], base[1]), f"{label} existing path mode/type drift: {relative}", failures)
        current = worktree
        safe = True
        for part in pathlib.PurePosixPath(relative).parts:
            current = current / part
            if current.is_symlink():
                failures.append(f"{label} live path or ancestor is a symlink: {relative}")
                safe = False
                break
        if safe:
            try:
                info = current.lstat()
            except OSError:
                failures.append(f"{label} live path missing: {relative}")
            else:
                require(stat.S_ISREG(info.st_mode), f"{label} live path is not regular: {relative}", failures)


def validate_clean_receipt(
    receipt_path: pathlib.Path,
    repository: pathlib.Path,
    worktree: pathlib.Path,
    branch: str,
    base_commit: str,
    base_tree: str,
    lane_id: str,
    carrier: tuple[str, str] | None,
    failures: list[str],
) -> None:
    receipt_bytes = secure_receipt_bytes(receipt_path, failures)
    if receipt_bytes is None or carrier is None:
        return
    try:
        receipt = strict_json_bytes(receipt_bytes)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"clean receipt cannot be loaded: {receipt_path}: {exc}")
        return
    carrier_commit_value, carrier_tree_value = carrier
    expected_origin_url = BACKEND_ORIGIN if pathlib.Path(os.path.abspath(repository)) == BACKEND else FRONTEND_ORIGIN
    expected_artifacts = [
        artifact_at(carrier_commit_value, AUTHORITY_REL),
        artifact_at(carrier_commit_value, BACKEND_TOKEN_REL),
        artifact_at(carrier_commit_value, FRONTEND_TOKEN_REL),
        artifact_at(carrier_commit_value, CONSUMER_REL),
        artifact_at(carrier_commit_value, VALIDATOR_REL),
        artifact_at(carrier_commit_value, REVIEW_REL),
    ]
    expected = {
        "schema": "dwp.hris.wave7.per009-central-clean-worktree-receipt.v1",
        "state": "HASH_BOUND_FRESH_CLEAN_UNCONSUMED_CENTRAL_LANE_WORKTREE",
        "laneId": lane_id,
        "authorityCarrierCommit": carrier_commit_value,
        "authorityCarrierTree": carrier_tree_value,
        "authorityCarrierCommittedAt": git_text(FRONTEND, "show", "-s", "--format=%cI", carrier_commit_value),
        "carrierArtifacts": expected_artifacts,
        "repository": repository.name,
        "repositoryRoot": str(repository),
        "repositoryRealRoot": str(repository.resolve()),
        "worktree": str(worktree),
        "worktreeRealRoot": str(worktree.resolve()),
        "gitCommonDir": str(repository / ".git"),
        "originUrl": expected_origin_url,
        "branch": branch,
        "baseCommit": base_commit,
        "baseTree": base_tree,
        "head": base_commit,
        "tree": base_tree,
        "originDwpDevAtMaterialization": base_commit,
        "authoritativeOriginDwpDevAtMaterialization": base_commit,
        "upstreamAtMaterialization": None,
        "remoteBranchPresentAtMaterialization": False,
        "statusPorcelainV2Bytes": 0,
        "statusPorcelainV2Sha256": EMPTY_SHA,
        "ignoredStatusPorcelainV2Bytes": 0,
        "ignoredStatusPorcelainV2Sha256": EMPTY_SHA,
        "tokenConsumptionReceiptPresent": False,
        "verifiedBy": "TRUSTED_PER009_CENTRAL_CLEAN_WORKTREE_CHECK",
    }
    require(set(receipt) == set(expected) | {"authorityCarrierPushObservedAt", "protections", "verifiedAt"}, f"clean receipt field closure drift: {lane_id}", failures)
    require({key: receipt.get(key) for key in expected} == expected, f"clean receipt evidence drift: {lane_id}", failures)
    require(
        receipt.get("protections")
        == {
            "assumeUnchangedPaths": [],
            "skipWorktreePaths": [],
            "sparseCheckoutEnabled": False,
            "fsmonitorConfigured": False,
            "diffExternalConfigured": False,
            "graftFilePresent": False,
            "replaceRefs": [],
            "repositoryOrWorktreePathSymlinks": [],
        },
        f"clean receipt protections drift: {lane_id}",
        failures,
    )
    committed_at = parse_time(receipt.get("authorityCarrierCommittedAt"), f"{lane_id} carrier committedAt", failures)
    pushed_at = parse_time(receipt.get("authorityCarrierPushObservedAt"), f"{lane_id} carrier pushObservedAt", failures)
    verified_at = parse_time(receipt.get("verifiedAt"), f"{lane_id} verifiedAt", failures)
    if committed_at is not None and pushed_at is not None and verified_at is not None:
        require(committed_at <= pushed_at <= verified_at, f"clean receipt causal order drift: {lane_id}", failures)

    require(worktree.is_dir(), f"worktree missing: {worktree}", failures)
    if not worktree.is_dir():
        return
    validate_repository_provenance(repository, worktree, lane_id, failures)
    validate_local_git_config(worktree, lane_id, failures)
    try:
        actual_head = git_text(worktree, "rev-parse", "HEAD")
        actual_tree = git_text(worktree, "rev-parse", "HEAD^{tree}")
        actual_branch = git_text(worktree, "branch", "--show-current")
        origin = git_text(worktree, "rev-parse", "origin/dwp-dev")
        status_value = git(worktree, "status", "--porcelain=v2", "--untracked-files=all").stdout
        ignored_status_value = git(worktree, "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching").stdout
        upstream = git(worktree, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}", check=False)
        remote_lane = git(repository, "rev-parse", "--verify", f"refs/remotes/origin/{branch}", check=False)
        remote_lane_authoritative = remote_git(
            "ls-remote",
            "--heads",
            expected_origin_url,
            f"refs/heads/{branch}",
        )
    except subprocess.CalledProcessError as exc:
        failures.append(f"worktree evidence cannot be resolved: {lane_id}: {exc.stderr.strip()}")
        return
    require(actual_head == base_commit, f"worktree HEAD drift: {lane_id}", failures)
    require(actual_tree == base_tree, f"worktree tree drift: {lane_id}", failures)
    require(actual_branch == branch, f"worktree branch drift: {lane_id}", failures)
    require(origin == base_commit, f"worktree origin/dwp-dev drift: {lane_id}", failures)
    require(git_common_dir(worktree) == repository / ".git", f"worktree git-common-dir provenance drift: {lane_id}", failures)
    require(git_text(repository, "remote", "get-url", "origin") == expected_origin_url, f"repository origin URL drift: {lane_id}", failures)
    require(git_text(worktree, "remote", "get-url", "origin") == expected_origin_url, f"worktree origin URL drift: {lane_id}", failures)
    validate_remote_head(repository, "dwp-dev", expected_origin_url, base_commit, f"{lane_id} base", failures)
    require(status_value == "", f"worktree is not clean: {lane_id}", failures)
    require(ignored_status_value == "", f"worktree contains ignored shadow paths: {lane_id}", failures)
    require(upstream.returncode != 0, f"worktree upstream unexpectedly exists: {lane_id}", failures)
    require(remote_lane.returncode != 0, f"remote lane unexpectedly exists: {lane_id}", failures)
    require(
        remote_lane_authoritative.returncode == 0 and remote_lane_authoritative.stdout == "",
        f"authoritative remote lane unexpectedly exists or cannot be checked: {lane_id}",
        failures,
    )
    require(receipt.get("protections") == actual_protections(repository, worktree), f"actual worktree protections drift: {lane_id}", failures)


def strict_json_bytes(data: bytes) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def invalid_constant(value: str) -> Any:
        raise ValueError(f"non-finite JSON value: {value}")

    value = json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid_constant)
    if not isinstance(value, dict):
        raise ValueError("JSON root must be an object")
    return value


def allowlist_digest(paths: list[str]) -> str:
    return digest_bytes(json.dumps(paths, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def validate_consumption_receipt(
    lane: str,
    carrier: tuple[str, str] | None,
    authority: dict[str, Any],
    failures: list[str],
    require_active_deadline: bool,
    backend_dependency: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    backend = lane == "backend"
    path = BACKEND_CONSUMPTION if backend else FRONTEND_CONSUMPTION
    receipt_bytes = secure_receipt_bytes(path, failures)
    if receipt_bytes is None or carrier is None:
        return None
    try:
        value = strict_json_bytes(receipt_bytes)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"{lane} consumption receipt cannot be loaded: {exc}")
        return None
    carrier_commit_value, carrier_tree_value = carrier
    token_path = BACKEND_TOKEN_PATH if backend else FRONTEND_TOKEN_PATH
    clean_path = BACKEND_RECEIPT if backend else FRONTEND_RECEIPT
    worktree = BACKEND_WORKTREE if backend else FRONTEND_WORKTREE
    branch = BACKEND_LANE if backend else FRONTEND_LANE
    base_commit = BACKEND_BASE if backend else carrier_commit_value
    base_tree = BACKEND_TREE if backend else carrier_tree_value
    writable = authority["sourceAllowlist"]["backendWritable" if backend else "frontendWritable"]
    clean_bytes = secure_receipt_bytes(clean_path, failures)
    expected_static = {
        "schema": "dwp.hris.wave7.per009-central-token-consumption-receipt.v1",
        "state": "CONSUMED_OPERATIONAL_ONE_SHOT_WITHIN_RETAINED_RECEIPT_LEDGER_SOURCE_WRITE_AUTHORIZED_UNTIL_PROCEDURAL_DEADLINE",
        "laneId": "PER009_CENTRAL_BACKEND_V63_V273" if backend else "PER009_CENTRAL_FRONTEND_V62_V63_MIRROR",
        "tokenId": load(token_path)["tokenId"],
        "jti": load(token_path)["jti"],
        "tokenArtifact": artifact_at(carrier_commit_value, token_path.relative_to(FRONTEND).as_posix()),
        "authorityArtifact": artifact_at(carrier_commit_value, AUTHORITY_REL),
        "authorityCarrierCommit": carrier_commit_value,
        "authorityCarrierTree": carrier_tree_value,
        "cleanReceiptSha256": digest_bytes(clean_bytes) if clean_bytes is not None else None,
        "allowlistSha256": allowlist_digest(writable),
        "repository": "dwp-backend" if backend else "dwp-frontend",
        "worktree": str(worktree),
        "branch": branch,
        "head": base_commit,
        "tree": base_tree,
        "originDwpDevAtConsumption": base_commit,
        "authoritativeOriginDwpDevAtConsumption": base_commit,
        "backendDependency": None if backend else backend_dependency,
        "oneShotEnforcementScope": "CONCURRENT_REPLAY_ONLY_WHILE_CURRENT_UID_0700_RECEIPT_LEDGER_AND_0600_RECEIPT_ARE_RETAINED",
        "durableTamperResistanceProvided": False,
        "executionDeadlineSemantics": "PROCEDURAL_BOUNDED_WORK_WINDOW_ONLY",
    }
    required_fields = set(expected_static) | {"consumedAt", "executionDeadline", "executor"}
    require(set(value) == required_fields, f"{lane} consumption receipt field closure drift", failures)
    require({key: value.get(key) for key in expected_static} == expected_static, f"{lane} consumption receipt evidence drift", failures)
    consumed = parse_time(value.get("consumedAt"), f"{lane} consumedAt", failures)
    deadline = parse_time(value.get("executionDeadline"), f"{lane} executionDeadline", failures)
    require(value.get("executor") == (BACKEND_EXECUTOR if backend else FRONTEND_EXECUTOR), f"{lane} executor identity drift", failures)
    if consumed is not None and deadline is not None:
        require(consumed.utcoffset() is not None and deadline.utcoffset() is not None, f"{lane} timestamps must be timezone-aware", failures)
        expected_seconds = (4 if backend else 2) * 3600
        try:
            require((deadline - consumed).total_seconds() == expected_seconds, f"{lane} execution deadline duration drift", failures)
            if require_active_deadline:
                now = datetime.now().astimezone()
                require(consumed <= now <= deadline, f"{lane} token execution window is not active", failures)
        except TypeError:
            failures.append(f"{lane} timestamp timezone mismatch")
    return value


def secure_external_json(
    path: pathlib.Path,
    label: str,
    failures: list[str],
) -> tuple[dict[str, Any], bytes] | None:
    data = secure_receipt_bytes(path, failures)
    if data is None:
        return None
    try:
        return strict_json_bytes(data), data
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"{label} cannot be loaded: {exc}")
        return None


def git_blob(repository: pathlib.Path, commit: str, relative: str, label: str, failures: list[str]) -> bytes | None:
    result = git(repository, "show", f"{commit}:{relative}", check=False, text=False)
    require(result.returncode == 0, f"{label} missing: {relative}", failures)
    return result.stdout if result.returncode == 0 else None


def git_json(repository: pathlib.Path, commit: str, relative: str, label: str, failures: list[str]) -> dict[str, Any] | None:
    data = git_blob(repository, commit, relative, label, failures)
    if data is None:
        return None
    try:
        return strict_json_bytes(data)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"{label} is not strict JSON: {relative}: {exc}")
        return None


def stable_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def content_checksum(value: dict[str, Any], checksum_field: str, remove_status: bool = False) -> str:
    payload = json.loads(json.dumps(value))
    payload.pop(checksum_field, None)
    if remove_status:
        payload.pop("bundleStatus", None)
    return digest_bytes(stable_json(payload))


def keyed(items: Any, key: str, label: str, failures: list[str]) -> dict[str, dict[str, Any]]:
    require(isinstance(items, list), f"{label} is not an array", failures)
    result: dict[str, dict[str, Any]] = {}
    if not isinstance(items, list):
        return result
    for item in items:
        require(isinstance(item, dict), f"{label} contains a non-object", failures)
        if not isinstance(item, dict):
            continue
        identity = item.get(key)
        require(isinstance(identity, str) and bool(identity), f"{label} identity missing", failures)
        if not isinstance(identity, str) or not identity:
            continue
        require(identity not in result, f"{label} duplicate identity: {identity}", failures)
        result[identity] = item
    return result


def require_exact_reverse_reference_delta(
    predecessor: dict[str, dict[str, Any]],
    successor: dict[str, dict[str, Any]],
    added_keys: set[str],
    exact_appends: dict[str, list[str]],
    label: str,
    failures: list[str],
) -> None:
    require(set(successor) - set(predecessor) == added_keys, f"{label} added key delta drift", failures)
    require(set(predecessor) <= set(successor), f"{label} predecessor key removed", failures)
    for identity, before in predecessor.items():
        expected = json.loads(json.dumps(before))
        append = exact_appends.get(identity, [])
        if append:
            routes = expected.get("routeContractKeys")
            require(isinstance(routes, list), f"{label} route references malformed: {identity}", failures)
            if isinstance(routes, list):
                require(not (set(routes) & set(append)), f"{label} append route already exists: {identity}", failures)
                expected["routeContractKeys"] = routes + append
        require(successor.get(identity) == expected, f"{label} exact predecessor or reverse-reference drift: {identity}", failures)


def expected_generated_route(source: dict[str, Any]) -> dict[str, Any]:
    profiles = []
    for profile in source["profiles"]:
        profiles.append(
            {
                "activeAccessModes": profile["activeAccessModes"],
                "precedence": profile["precedence"],
                "predicatePolicyKeys": profile["predicatePolicyKeys"],
                "profileKey": profile["profileKey"],
                "readOnly": profile["readOnly"],
                "requiredAccess": {
                    "capabilityContractKey": profile["requiredCapability"],
                    "type": "CAPABILITY",
                },
                "targetBindingKinds": profile["targetBindingKinds"],
            }
        )
    return {
        "accessProfiles": profiles,
        "gatewayApiBindings": [source["gatewayBinding"]],
        "lifecycleState": source["lifecycleState"],
        "navigationContextId": source["navigationContextId"],
        "owner": source["owner"],
        "policyVersion": source["policyVersion"],
        "routeContractKey": source["routeContractKey"],
        "routeKind": source["routeKind"],
        "servicePepBindings": [source["servicePepBinding"]],
        "sideEffectFree": source["sideEffectFree"],
        "subject": source["subject"],
        "uiRouteId": source["uiRouteId"],
        "uiRoutePattern": source["uiRoutePattern"],
    }


def canonical_sql_tokens(sql: str) -> tuple[str, ...]:
    """Tokenize SQL without executing it; comments and whitespace are non-semantic."""
    if sql.startswith("\ufeff") or "\x00" in sql or "\r" in sql:
        raise ValueError("SQL must be UTF-8 LF text without BOM, NUL or CR")
    tokens: list[str] = []
    index = 0
    while index < len(sql):
        character = sql[index]
        if character.isspace():
            index += 1
            continue
        if sql.startswith("--", index):
            newline = sql.find("\n", index + 2)
            index = len(sql) if newline < 0 else newline + 1
            continue
        if sql.startswith("/*", index):
            end = sql.find("*/", index + 2)
            if end < 0:
                raise ValueError("unterminated SQL block comment")
            index = end + 2
            continue
        if character == "'":
            end = index + 1
            while end < len(sql):
                if sql[end] == "'":
                    if end + 1 < len(sql) and sql[end + 1] == "'":
                        end += 2
                        continue
                    end += 1
                    break
                end += 1
            else:
                raise ValueError("unterminated SQL string")
            tokens.append(sql[index:end])
            index = end
            continue
        dollar = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", sql[index:])
        if dollar:
            tokens.append(dollar.group(0))
            index += len(dollar.group(0))
            continue
        identifier = re.match(r"[A-Za-z_][A-Za-z0-9_$]*", sql[index:])
        if identifier:
            tokens.append(identifier.group(0).upper())
            index += len(identifier.group(0))
            continue
        number = re.match(r"\d+(?:\.\d+)?", sql[index:])
        if number:
            tokens.append(number.group(0))
            index += len(number.group(0))
            continue
        operator = next(
            (candidate for candidate in ("::", "<>" , "<=", ">=", "!=", "||", ":=") if sql.startswith(candidate, index)),
            None,
        )
        if operator:
            tokens.append(operator)
            index += len(operator)
            continue
        if character in "(),;.=+-*/<>":
            tokens.append(character)
            index += 1
            continue
        raise ValueError(f"unsupported SQL token at offset {index}: {character!r}")
    return tuple(tokens)


def render_expected_v273_sql(checksum: str) -> str:
    """Return the only V273 statement graph authorized by this carrier."""
    return f"""
INSERT INTO sys_tenant_resource_templates
    (resource_key, resource_type, display_name, required_entitlement)
VALUES
    ('DATA.HRIS_PERFORMANCE_GOAL', 'DATA', 'HRIS performance goal data', 'core.people')
ON CONFLICT (resource_key) DO NOTHING;

INSERT INTO sys_admin_scoped_duty_catalog
    (duty_code, product_key, legacy_role_code, product_resource_key, resource_key,
     audit_policy_exception, risk_tier, lifecycle_state)
VALUES
    ('HRIS_DUTY_SELF_GOAL_AUTHOR', 'hcm', 'WORKSPACE_MEMBER', 'APP.HCM',
     'DATA.HRIS_PERFORMANCE_GOAL', FALSE, 'MEDIUM', 'ACTIVE'),
    ('HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER', 'hcm', 'TALENT_ADMIN', 'APP.HCM',
     'DATA.HRIS_PERFORMANCE_REVIEW', FALSE, 'HIGH', 'ACTIVE')
ON CONFLICT (duty_code) DO NOTHING;

INSERT INTO sys_admin_scoped_duty_capabilities
    (duty_code, capability_contract_key, permission_resource_key, permission_code)
VALUES
    ('HRIS_DUTY_SELF_GOAL_AUTHOR', 'per.goal.self.write',
     'DATA.HRIS_PERFORMANCE_GOAL', 'UPDATE'),
    ('HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER', 'hcm.team.performance.review',
     'DATA.HRIS_PERFORMANCE_REVIEW', 'UPDATE')
ON CONFLICT (duty_code, capability_contract_key) DO NOTHING;

INSERT INTO com_resources
    (tenant_id, type, key, name, enabled, created_by, updated_by)
SELECT tenant.tenant_id, template.resource_type, template.resource_key,
       template.display_name, TRUE, 1, 1
  FROM com_tenants tenant
 CROSS JOIN sys_tenant_resource_templates template
 WHERE template.resource_key = 'DATA.HRIS_PERFORMANCE_GOAL'
   AND template.lifecycle_state = 'ACTIVE'
ON CONFLICT (tenant_id, type, key) DO NOTHING;

INSERT INTO auth_product_authorization_seed_release
    (bundle_key, version, checksum, auth_seed_artifact,
     intended_bundle_status, automatic_import_enabled)
VALUES
    ('product-surfaces', 63, '{checksum}',
     'product-surfaces-v1.bundle-v63.generated.json', 'DRAFT', FALSE)
ON CONFLICT (bundle_key, version) DO NOTHING;

INSERT INTO sys_product_feature_activation_policies
    (feature_key, policy_version, product_key, app_resource_key,
     minimum_bundle_version, baseline_state, owner_key)
VALUES
    ('HRIS_PER_GOAL_COMMANDS', 1, 'hcm', 'APP.HCM', 63, 'OFF', 'PER')
ON CONFLICT (feature_key, policy_version) DO NOTHING;

INSERT INTO sys_product_feature_route_owners (route_contract_key, feature_key)
VALUES
    ('route.hcm.performance.goal-create.action', 'HRIS_PER_GOAL_COMMANDS'),
    ('route.hcm.performance.goal-submit.action', 'HRIS_PER_GOAL_COMMANDS')
ON CONFLICT (route_contract_key) DO NOTHING;

INSERT INTO sys_product_feature_route_bindings
    (route_contract_key, feature_key, policy_version, product_key, app_resource_key,
     minimum_bundle_version, route_kind, subject_type, surface_key)
VALUES
    ('route.hcm.performance.goal-create.action', 'HRIS_PER_GOAL_COMMANDS', 1,
     'hcm', 'APP.HCM', 63, 'ACTION', 'PRODUCT', 'hcm.operations'),
    ('route.hcm.performance.goal-submit.action', 'HRIS_PER_GOAL_COMMANDS', 1,
     'hcm', 'APP.HCM', 63, 'ACTION', 'PRODUCT', 'hcm.operations')
ON CONFLICT (route_contract_key, feature_key, policy_version) DO NOTHING;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM sys_tenant_resource_templates
         WHERE resource_key = 'DATA.HRIS_PERFORMANCE_GOAL') <> 1
       OR NOT EXISTS (
           SELECT 1 FROM sys_tenant_resource_templates
            WHERE resource_key = 'DATA.HRIS_PERFORMANCE_GOAL'
              AND resource_type = 'DATA'
              AND display_name = 'HRIS performance goal data'
              AND required_entitlement = 'core.people'
              AND lifecycle_state = 'ACTIVE')
       OR NOT EXISTS (
           SELECT 1 FROM sys_tenant_resource_templates
            WHERE resource_key = 'DATA.HRIS_PERFORMANCE_REVIEW'
              AND resource_type = 'DATA'
              AND display_name = 'HRIS performance assigned review'
              AND required_entitlement = 'core.people'
              AND lifecycle_state = 'ACTIVE')
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 resource templates differ from the sealed tuples';
    END IF;

    IF (SELECT COUNT(*) FROM sys_admin_scoped_duty_catalog
         WHERE duty_code IN ('HRIS_DUTY_SELF_GOAL_AUTHOR',
                             'HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER')) <> 2
       OR EXISTS (
           SELECT 1
             FROM (VALUES
                 ('HRIS_DUTY_SELF_GOAL_AUTHOR', 'WORKSPACE_MEMBER',
                  'DATA.HRIS_PERFORMANCE_GOAL', 'MEDIUM'),
                 ('HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER', 'TALENT_ADMIN',
                  'DATA.HRIS_PERFORMANCE_REVIEW', 'HIGH')
             ) AS expected(duty_code, legacy_role_code, resource_key, risk_tier)
             LEFT JOIN sys_admin_scoped_duty_catalog duty
               ON duty.duty_code = expected.duty_code
              AND duty.product_key = 'hcm'
              AND duty.legacy_role_code = expected.legacy_role_code
              AND duty.product_resource_key = 'APP.HCM'
              AND duty.resource_key = expected.resource_key
              AND duty.audit_policy_exception = FALSE
              AND duty.risk_tier = expected.risk_tier
              AND duty.lifecycle_state = 'ACTIVE'
              AND duty.version = 0
            WHERE duty.duty_code IS NULL)
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 scoped duties differ from the sealed tuples';
    END IF;

    IF (SELECT COUNT(*) FROM sys_admin_scoped_duty_capabilities
         WHERE duty_code IN ('HRIS_DUTY_SELF_GOAL_AUTHOR',
                             'HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER')) <> 2
       OR EXISTS (
           SELECT 1
             FROM (VALUES
                 ('HRIS_DUTY_SELF_GOAL_AUTHOR', 'per.goal.self.write',
                  'DATA.HRIS_PERFORMANCE_GOAL', 'UPDATE'),
                 ('HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER', 'hcm.team.performance.review',
                  'DATA.HRIS_PERFORMANCE_REVIEW', 'UPDATE')
             ) AS expected(duty_code, capability_key, resource_key, permission_code)
             LEFT JOIN sys_admin_scoped_duty_capabilities capability
               ON capability.duty_code = expected.duty_code
              AND capability.capability_contract_key = expected.capability_key
              AND capability.permission_resource_key = expected.resource_key
              AND capability.permission_code = expected.permission_code
              AND capability.resolved_capability_code =
                  expected.resource_key || ':' || expected.permission_code
            WHERE capability.duty_code IS NULL)
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 duty capabilities differ from the sealed tuples';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM com_tenants tenant
          LEFT JOIN com_resources resource
            ON resource.tenant_id = tenant.tenant_id
           AND resource.type = 'DATA'
           AND resource.key = 'DATA.HRIS_PERFORMANCE_GOAL'
           AND resource.name = 'HRIS performance goal data'
           AND resource.enabled = TRUE
           AND resource.created_by = 1
           AND resource.updated_by = 1
         WHERE resource.resource_id IS NULL)
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 tenant resource differs from the sealed tuple';
    END IF;

    IF (SELECT COUNT(*) FROM auth_product_authorization_seed_release
         WHERE bundle_key = 'product-surfaces' AND version = 63) <> 1
       OR NOT EXISTS (
           SELECT 1 FROM auth_product_authorization_seed_release
            WHERE bundle_key = 'product-surfaces'
              AND version = 63
              AND checksum = '{checksum}'
              AND auth_seed_artifact = 'product-surfaces-v1.bundle-v63.generated.json'
              AND intended_bundle_status = 'DRAFT'
              AND automatic_import_enabled = FALSE)
    THEN
        RAISE EXCEPTION 'V273 conflict: product-authorization v63 release differs from the sealed tuple';
    END IF;

    IF (SELECT COUNT(*) FROM sys_product_feature_activation_policies
         WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS') <> 1
       OR NOT EXISTS (
           SELECT 1 FROM sys_product_feature_activation_policies
            WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS'
              AND policy_version = 1
              AND product_key = 'hcm'
              AND app_resource_key = 'APP.HCM'
              AND minimum_bundle_version = 63
              AND baseline_state = 'OFF'
              AND lifecycle_state = 'PUBLISHED'
              AND owner_key = 'PER')
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 feature policy differs from the sealed tuple';
    END IF;

    IF (SELECT COUNT(*) FROM sys_product_feature_route_owners
         WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS') <> 2
       OR EXISTS (
           SELECT 1
             FROM (VALUES
                 ('route.hcm.performance.goal-create.action'),
                 ('route.hcm.performance.goal-submit.action')
             ) AS expected(route_contract_key)
             LEFT JOIN sys_product_feature_route_owners owner_row
               ON owner_row.route_contract_key = expected.route_contract_key
              AND owner_row.feature_key = 'HRIS_PER_GOAL_COMMANDS'
            WHERE owner_row.route_contract_key IS NULL)
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 route owners differ from the sealed tuples';
    END IF;

    IF (SELECT COUNT(*) FROM sys_product_feature_route_bindings
         WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS') <> 2
       OR EXISTS (
           SELECT 1
             FROM (VALUES
                 ('route.hcm.performance.goal-create.action'),
                 ('route.hcm.performance.goal-submit.action')
             ) AS expected(route_contract_key)
             LEFT JOIN sys_product_feature_route_bindings binding
               ON binding.route_contract_key = expected.route_contract_key
              AND binding.feature_key = 'HRIS_PER_GOAL_COMMANDS'
              AND binding.policy_version = 1
              AND binding.product_key = 'hcm'
              AND binding.app_resource_key = 'APP.HCM'
              AND binding.minimum_bundle_version = 63
              AND binding.route_kind = 'ACTION'
              AND binding.subject_type = 'PRODUCT'
              AND binding.surface_key = 'hcm.operations'
              AND binding.lifecycle_state = 'ACTIVE'
            WHERE binding.route_contract_key IS NULL)
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 route bindings differ from the sealed tuples';
    END IF;

    IF EXISTS (
        SELECT 1 FROM auth_product_authorization_bundle
         WHERE bundle_key = 'product-surfaces' AND version = 63)
    OR EXISTS (
        SELECT 1
          FROM auth_product_authorization_active active
          JOIN auth_product_authorization_bundle bundle
            ON bundle.bundle_id = active.bundle_id
           AND bundle.bundle_key = active.bundle_key
         WHERE bundle.bundle_key = 'product-surfaces' AND bundle.version = 63)
    OR EXISTS (
        SELECT 1
          FROM auth_product_authorization_activation_event event
          JOIN auth_product_authorization_bundle bundle
            ON bundle.bundle_id = event.to_bundle_id
           AND bundle.bundle_key = event.bundle_key
         WHERE bundle.bundle_key = 'product-surfaces' AND bundle.version = 63)
    OR EXISTS (
        SELECT 1 FROM auth_product_feature_activation_changes
         WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS')
    OR EXISTS (
        SELECT 1 FROM com_tenant_feature_enrollment_changes
         WHERE feature_key = 'HRIS_PER_GOAL_COMMANDS')
    OR EXISTS (
        SELECT 1 FROM sys_tenant_role_permission_templates
         WHERE resource_key = 'DATA.HRIS_PERFORMANCE_GOAL')
    OR EXISTS (
        SELECT 1
          FROM com_role_permissions role_permission
          JOIN com_resources resource
            ON resource.resource_id = role_permission.resource_id
         WHERE resource.key = 'DATA.HRIS_PERFORMANCE_GOAL')
    OR EXISTS (
        SELECT 1 FROM com_admin_scoped_duty_assignments
         WHERE duty_code IN ('HRIS_DUTY_SELF_GOAL_AUTHOR',
                             'HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER'))
    OR EXISTS (
        SELECT 1 FROM sys_admin_app_preset_duties
         WHERE duty_code IN ('HRIS_DUTY_SELF_GOAL_AUTHOR',
                             'HRIS_DUTY_MANAGER_PERFORMANCE_REVIEWER'))
    OR EXISTS (
        SELECT 1 FROM com_admin_resource_set_members
         WHERE resource_key = 'DATA.HRIS_PERFORMANCE_GOAL')
    OR EXISTS (
        SELECT 1
          FROM com_principal_resource_grants grant_record
          JOIN com_resources resource
            ON resource.resource_id = grant_record.resource_id
         WHERE resource.key = 'DATA.HRIS_PERFORMANCE_GOAL')
    OR EXISTS (
        SELECT 1 FROM sys_builtin_role_catalog
         WHERE role_code IN ('HRIS_EMPLOYEE', 'HRIS_LINE_MANAGER',
                             'HRIS_PERFORMANCE_OPERATOR', 'EMPLOYEE', 'MANAGER'))
    OR EXISTS (
        SELECT 1 FROM com_roles
         WHERE builtin_role_code IN ('HRIS_EMPLOYEE', 'HRIS_LINE_MANAGER',
                                     'HRIS_PERFORMANCE_OPERATOR', 'EMPLOYEE', 'MANAGER'))
    THEN
        RAISE EXCEPTION 'V273 conflict: PER-009 must remain default-off with zero derived authority';
    END IF;
END;
$$;
""".strip() + "\n"


def validate_v273_sql(sql: str, checksum: str, failures: list[str]) -> None:
    expected = render_expected_v273_sql(checksum)
    require(expected.count(checksum) == 2, "Auth V273 canonical checksum cardinality drift", failures)
    require(sql.count(checksum) == 2, "Auth V273 actual checksum cardinality drift", failures)
    try:
        actual_tokens = canonical_sql_tokens(sql)
        expected_tokens = canonical_sql_tokens(expected)
    except ValueError as exc:
        failures.append(f"Auth V273 canonical SQL validation failed: {exc}")
        return
    require(actual_tokens == expected_tokens, "Auth V273 canonical statement or conflict-proof drift", failures)


def validate_projection(
    projection: dict[str, Any] | None,
    expected: dict[str, int],
    owner: str,
    registry_checksum: str,
    label: str,
    failures: list[str],
) -> None:
    if projection is None:
        return
    require(projection.get("ownerServiceKey") == owner, f"{label} owner drift", failures)
    require(
        projection.get("registryRef")
        == {"bundleKey": "product-surfaces", "sha256": registry_checksum, "version": 63},
        f"{label} registry reference drift",
        failures,
    )
    for section in ("capabilities", "accessPolicies", "entitlementExpressions", "predicatePolicies", "routes"):
        require(isinstance(projection.get(section), list) and len(projection[section]) == expected[section], f"{label} {section} count drift", failures)
    require(projection.get("bindingPairCount") == expected["bindings"], f"{label} binding count drift", failures)
    require(projection.get("sourceRegistryRouteCount") == 1160, f"{label} source registry count drift", failures)
    require(projection.get("projectedRouteContractCount") == expected["routes"], f"{label} projected route count drift", failures)
    route_counts = {"PAGE": 0, "DATA": 0, "ACTION": 0}
    for route in projection.get("routes", []):
        if isinstance(route, dict) and route.get("routeKind") in route_counts:
            route_counts[route["routeKind"]] += 1
    require(route_counts == {key: expected[key] for key in ("PAGE", "DATA", "ACTION")}, f"{label} route-kind count drift", failures)
    require(projection.get("routeKindCounts") == route_counts, f"{label} declared route-kind count drift", failures)
    require(projection.get("projectionChecksumAlgorithm") == "SHA-256", f"{label} checksum algorithm drift", failures)
    require(
        projection.get("projectionChecksum") == content_checksum(projection, "projectionChecksum"),
        f"{label} internal checksum drift",
        failures,
    )


def backend_source_text(commit: str, relative: str, label: str, failures: list[str]) -> str | None:
    return decode_blob(git_blob(BACKEND, commit, relative, label, failures), label, failures)


def java_method_names(source: str) -> set[str]:
    return set(re.findall(r"(?m)^\s*(?:public|protected|private|static|final|synchronized|\s)*\s*(?:void|boolean|int|long|String|[A-Z][A-Za-z0-9_<>?,. ]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", source)) | set(
        re.findall(r"(?m)^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", source)
    )


def parse_java_set(source: str, name: str) -> set[str]:
    match = re.search(rf"\b{re.escape(name)}\s*=\s*Set\.of\((.*?)\);", source, flags=re.DOTALL)
    if not match:
        raise ValueError(f"Java set missing: {name}")
    body = match.group(1)
    values = set(re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', body))
    residue = re.sub(r'"([^"\\]*(?:\\.[^"\\]*)*)"', "", body)
    for identifier in re.findall(r"\b[A-Z][A-Z0-9_]*\b", residue):
        values.add(f"@{identifier}")
    return values


def validate_backend_source_closure(
    commit: str,
    v63: dict[str, Any],
    failures: list[str],
) -> None:
    paths = {
        "yaml": "contracts/product-authorization/product-surfaces-v1.yaml",
        "generator": "scripts/generate-product-authorization-contracts.py",
        "fixtureGenerator": "scripts/generate-product-authorization-fixtures.py",
        "lineage": "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
        "topology": "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationGateTopologyValidator.java",
        "gateway": "dwp-gateway/src/main/java/com/dwp/gateway/filter/ProductSurfaceRoutePolicies.java",
    }
    target: dict[str, str] = {}
    base: dict[str, str] = {}
    for key, relative in paths.items():
        target_value = backend_source_text(commit, relative, f"Backend {key} source", failures)
        base_value = backend_source_text(BACKEND_BASE, relative, f"Backend {key} predecessor source", failures)
        if target_value is None or base_value is None:
            return
        target[key] = target_value
        base[key] = base_value

    for identity in (
        "per.goal.self.write",
        "predicate.hcm-performance-goal-command.v1",
        "route.hcm.performance.goal-create.action",
        "route.hcm.performance.goal-submit.action",
    ):
        require(identity in target["yaml"], f"Backend canonical YAML missing PER-009 identity: {identity}", failures)
    for forbidden in ("bundleStatus: ACTIVE", "automaticImportEnabled: true", "implementationAuthorizedNow: true"):
        require(forbidden not in target["yaml"], f"Backend canonical YAML activation escape: {forbidden}", failures)

    try:
        ast.parse(target["generator"])
        fixture_tree = ast.parse(target["fixtureGenerator"])
    except SyntaxError as exc:
        failures.append(f"Backend generator syntax drift: {exc}")
    else:
        fixture_versions: Any = None
        for node in fixture_tree.body:
            if isinstance(node, ast.Assign) and any(isinstance(item, ast.Name) and item.id == "REGISTRY_VERSIONS" for item in node.targets):
                fixture_versions = ast.literal_eval(node.value)
        require(fixture_versions == tuple(range(1, 64)), "Backend fixture generator version lineage drift", failures)
    generator = target["generator"]
    for required in (
        "HCM_PEP_V63_OUTPUTS", "product-surfaces-v1.bundle-v63", "BUNDLE_VERSIONS = tuple(range(1, 64))",
        "63: {\"capabilities\": 281", "hcm_peps_v63", "snapshots[62]", "version=63",
    ):
        require(required in generator, f"Backend contract generator v63 closure missing: {required}", failures)
    for source_name in ("generator", "fixtureGenerator"):
        added = "\n".join(line[1:] for line in git_text(BACKEND, "diff", "--unified=0", BACKEND_BASE, commit, "--", paths[source_name]).splitlines() if line.startswith("+") and not line.startswith("+++"))
        for forbidden in ("eval(", "exec(", "__import__(", "os.system", "subprocess", "compile("):
            require(forbidden not in added, f"Backend {source_name} adds executable escape: {forbidden}", failures)

    lineage = target["lineage"]
    base_lineage = base["lineage"]
    checksum_section = lineage.split("private static final Map<Long, Map<String, Integer>> COUNTS", 1)[0]
    base_checksum_section = base_lineage.split("private static final Map<Long, Map<String, Integer>> COUNTS", 1)[0]
    checksum_entries = {int(version): checksum for version, checksum in re.findall(r'Map\.entry\((\d+)L, "([0-9a-f]{64})"\)', checksum_section)}
    base_checksum_entries = {int(version): checksum for version, checksum in re.findall(r'Map\.entry\((\d+)L, "([0-9a-f]{64})"\)', base_checksum_section)}
    require({key: checksum_entries.get(key) for key in base_checksum_entries} == base_checksum_entries, "Backend release lineage predecessor checksum mutation", failures)
    require(set(checksum_entries) == set(range(1, 64)) and checksum_entries.get(63) == v63["checksum"], "Backend release lineage v63 checksum closure drift", failures)
    count_entries = {
        int(version): tuple(int(value.strip()) for value in values.split(","))
        for version, values in re.findall(r"Map\.entry\((\d+)L, counts\(([^)]*)\)\)", lineage)
    }
    base_count_entries = {
        int(version): tuple(int(value.strip()) for value in values.split(","))
        for version, values in re.findall(r"Map\.entry\((\d+)L, counts\(([^)]*)\)\)", base_lineage)
    }
    require({key: count_entries.get(key) for key in base_count_entries} == base_count_entries, "Backend release lineage predecessor count mutation", failures)
    require(set(count_entries) == set(range(1, 64)) and count_entries.get(63) == (281, 24, 17, 88, 1160), "Backend release lineage v63 count closure drift", failures)
    require(lineage.count("index.latestVersion() == 63") == 1 and lineage.count("index.versions().size() == 63") == 1, "Backend release lineage latest pointer drift", failures)

    try:
        require(
            parse_java_set(target["gateway"], "TENANT_FEATURE_GOVERNED_ROUTE_KEYS")
            == parse_java_set(base["gateway"], "TENANT_FEATURE_GOVERNED_ROUTE_KEYS")
            | {"route.hcm.performance.goal-create.action", "route.hcm.performance.goal-submit.action"},
            "Backend gateway governed-route exact delta drift",
            failures,
        )
    except ValueError as exc:
        failures.append(f"Backend gateway route-set validation failed closed: {exc}")

    topology = target["topology"]
    for required in (
        "route.hcm.performance.goal-create.action", "route.hcm.performance.goal-submit.action",
        "hcm.team.performance.review", "per.goal.self.write", "stepUps.isEmpty()",
    ):
        require(required in topology, f"Backend topology v63 closure missing: {required}", failures)
    require(java_method_names(base["topology"]) <= java_method_names(topology), "Backend topology predecessor method removed", failures)
    for source_name in ("lineage", "topology", "gateway"):
        added = "\n".join(line[1:] for line in git_text(BACKEND, "diff", "--unified=0", BACKEND_BASE, commit, "--", paths[source_name]).splitlines() if line.startswith("+") and not line.startswith("+++"))
        for forbidden in ("System.exit", "Runtime.getRuntime", "ProcessBuilder", "setAccessible(", "Class.forName"):
            require(forbidden not in added, f"Backend runtime source adds executable escape: {forbidden}", failures)

    test_paths = [
        relative for relative in load(AUTHORITY_PATH)["sourceAllowlist"]["backendWritable"]
        if "/src/test/" in relative or relative.startswith("scripts/tests/")
    ]
    for relative in test_paths:
        source = backend_source_text(commit, relative, f"Backend targeted test {relative}", failures)
        if source is None:
            continue
        require(not re.search(r"@(?:Disabled|Ignore)\b|assumeTrue\s*\(\s*false|assumeFalse\s*\(\s*true", source), f"Backend targeted test disabled: {relative}", failures)
        predecessor_result = git(BACKEND, "show", f"{BACKEND_BASE}:{relative}", check=False, text=False)
        if predecessor_result.returncode == 0:
            predecessor_text = predecessor_result.stdout.decode("utf-8")
            require(java_method_names(predecessor_text) <= java_method_names(source), f"Backend targeted predecessor test method removed: {relative}", failures)
        elif relative.endswith("Test.java") or pathlib.PurePosixPath(relative).name.startswith("test_"):
            require(bool(java_method_names(source)), f"Backend new targeted test has no test methods: {relative}", failures)


def validate_backend_v63_semantics(
    commit: str,
    authority: dict[str, Any],
    successor_design: dict[str, Any],
    targeted_checksum: Any,
    failures: list[str],
) -> None:
    bundle_path = "contracts/product-authorization/product-surfaces-v1.bundle-v63.json"
    predecessor_path = "contracts/product-authorization/product-surfaces-v1.bundle-v62.json"
    predecessor_bytes = git_blob(BACKEND, BACKEND_BASE, predecessor_path, "Backend v62 predecessor", failures)
    target_predecessor = git_blob(BACKEND, commit, predecessor_path, "Backend target v62 predecessor", failures)
    expected_predecessor = successor_design["productAuthorizationLineage"]["predecessor"]
    if predecessor_bytes is not None:
        require(len(predecessor_bytes) == expected_predecessor["bytes"], "Backend v62 predecessor byte drift", failures)
        require(digest_bytes(predecessor_bytes) == expected_predecessor["fileSha256"], "Backend v62 predecessor SHA-256 drift", failures)
    require(predecessor_bytes == target_predecessor, "Backend v62 predecessor is not byte-identical", failures)
    v62 = git_json(BACKEND, commit, predecessor_path, "Backend target v62 predecessor", failures)
    v63 = git_json(BACKEND, commit, bundle_path, "Backend v63 bundle", failures)
    if v62 is None or v63 is None:
        return
    require(v63.get("version") == 63 and v63.get("bundleStatus") == "DRAFT", "Backend v63 identity drift", failures)
    require(set(v63) == set(v62), "Backend v63 top-level field closure drift", failures)
    for field in ("schemaVersion", "bundleKey", "owner", "authorityEndpoints", "checksumAlgorithm", "bundleStatus"):
        require(v63.get(field) == v62.get(field), f"Backend v63 top-level semantic drift: {field}", failures)
    require(v63.get("checksumAlgorithm") == "SHA-256", "Backend v63 checksum algorithm drift", failures)
    require(v63.get("checksum") == content_checksum(v63, "checksum", True), "Backend v63 internal checksum drift", failures)
    require(v63.get("checksum") == targeted_checksum, "Backend v63 targeted checksum drift", failures)
    expected_counts = authority["semanticClosure"]["backendExpectedCounts"]
    for section in ("capabilities", "accessPolicies", "entitlementExpressions", "predicatePolicies", "routes"):
        require(isinstance(v63.get(section), list) and len(v63[section]) == expected_counts[section], f"Backend v63 {section} count drift", failures)
    route_counts = {"PAGE": 0, "DATA": 0, "ACTION": 0}
    for route in v63.get("routes", []):
        if isinstance(route, dict) and route.get("routeKind") in route_counts:
            route_counts[route["routeKind"]] += 1
    require(route_counts == {key: expected_counts[key] for key in ("PAGE", "DATA", "ACTION")}, "Backend v63 route-kind count drift", failures)

    section_keys = {
        "capabilities": "contractKey",
        "accessPolicies": "accessPolicyKey",
        "entitlementExpressions": "expressionKey",
        "predicatePolicies": "predicatePolicyKey",
        "routes": "routeContractKey",
    }
    before = {section: keyed(v62.get(section), key, f"v62 {section}", failures) for section, key in section_keys.items()}
    after = {section: keyed(v63.get(section), key, f"v63 {section}", failures) for section, key in section_keys.items()}
    added_routes = set(authority["semanticClosure"]["addedRoutes"])
    ordered_added_routes = authority["semanticClosure"]["addedRoutes"]
    require_exact_reverse_reference_delta(
        before["capabilities"],
        after["capabilities"],
        {"per.goal.self.write"},
        {"hcm.team.performance.review": ordered_added_routes},
        "capability",
        failures,
    )
    require_exact_reverse_reference_delta(
        before["predicatePolicies"],
        after["predicatePolicies"],
        {"predicate.hcm-performance-goal-command.v1"},
        {
            "predicate.self-person.v1": ordered_added_routes,
            "predicate.team-target-population.v1": ordered_added_routes,
        },
        "predicate",
        failures,
    )
    require(before["accessPolicies"] == after["accessPolicies"], "Backend v63 access-policy mutation", failures)
    require(before["entitlementExpressions"] == after["entitlementExpressions"], "Backend v63 entitlement-expression mutation", failures)
    require(set(after["routes"]) - set(before["routes"]) == added_routes and set(before["routes"]) <= set(after["routes"]), "Backend v63 route delta drift", failures)
    for identity, value in before["routes"].items():
        require(after["routes"].get(identity) == value, f"Backend v63 existing route mutation: {identity}", failures)
    require(
        after["capabilities"].get("per.goal.self.write") == successor_design["capabilityDecision"]["newSelfCapability"],
        "Backend v63 self capability semantics drift",
        failures,
    )
    predicate_source = successor_design["predicateDecision"]
    predicate_fields = set(next(iter(after["predicatePolicies"].values())))
    expected_predicate = {key: predicate_source[key] for key in predicate_fields}
    require(after["predicatePolicies"].get("predicate.hcm-performance-goal-command.v1") == expected_predicate, "Backend v63 predicate semantics drift", failures)
    expected_routes = {item["routeContractKey"]: expected_generated_route(item) for item in successor_design["routeContracts"]}
    require({key: after["routes"].get(key) for key in added_routes} == expected_routes, "Backend v63 Goal route semantics drift", failures)

    alias = git_json(BACKEND, commit, "contracts/product-authorization/product-surfaces-v1.json", "Backend latest alias", failures)
    auth_bundle = git_json(BACKEND, commit, "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v63.generated.json", "Backend Auth v63 bundle", failures)
    auth_alias = git_json(BACKEND, commit, "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.generated.json", "Backend Auth latest alias", failures)
    require(alias == v63 and auth_bundle == v63 and auth_alias == v63, "Backend v63 alias or Auth bundle drift", failures)
    index = git_json(BACKEND, commit, "contracts/product-authorization/product-surfaces-v1.index.json", "Backend registry index", failures)
    base_index = git_json(BACKEND, BACKEND_BASE, "contracts/product-authorization/product-surfaces-v1.index.json", "Backend base registry index", failures)
    if index is not None:
        require(index.get("latestVersion") == 63 and index.get("latestChecksum") == v63["checksum"], "Backend registry index latest pointer drift", failures)
        versions = index.get("versions")
        base_versions = base_index.get("versions") if isinstance(base_index, dict) else None
        require(isinstance(versions, list) and isinstance(base_versions, list) and versions[:-1] == base_versions, "Backend registry index predecessor lineage drift", failures)
        expected_v63_index = {
            "version": 63,
            "bundleStatus": "DRAFT",
            "checksum": v63["checksum"],
            "artifact": "product-surfaces-v1.bundle-v63.json",
            "authSeedArtifact": "product-surfaces-v1.bundle-v63.generated.json",
            "counts": {section: len(v63[section]) for section in ("capabilities", "accessPolicies", "entitlementExpressions", "predicatePolicies", "routes")},
        }
        require(isinstance(versions, list) and versions[-1:] == [expected_v63_index], "Backend registry index v63 entry drift", failures)
        if isinstance(base_index, dict):
            require(set(index) == set(base_index), "Backend registry index field closure drift", failures)
            for key in ("schemaVersion", "bundleKey", "indexChecksumAlgorithm"):
                require(index.get(key) == base_index.get(key), f"Backend registry index predecessor field drift: {key}", failures)
        require(index.get("latestArtifact") == "product-surfaces-v1.bundle-v63.json", "Backend registry index latest artifact drift", failures)
        require(index.get("latestAuthSeedArtifact") == "product-surfaces-v1.bundle-v63.generated.json", "Backend registry index latest Auth artifact drift", failures)
        require(index.get("indexChecksum") == content_checksum(index, "indexChecksum"), "Backend registry index checksum drift", failures)
        auth_index = git_json(BACKEND, commit, "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json", "Backend Auth registry index", failures)
        require(auth_index == index, "Backend Auth registry index differs from canonical index", failures)
    fixture = git_json(BACKEND, commit, "contracts/product-authorization/pilot-fixtures.v1.generated.json", "Backend pilot fixture", failures)
    base_fixture = git_json(BACKEND, BACKEND_BASE, "contracts/product-authorization/pilot-fixtures.v1.generated.json", "Backend base pilot fixture", failures)
    if fixture is not None:
        lineage = fixture.get("registryLineage", {})
        versions = lineage.get("versions") if isinstance(lineage, dict) else None
        base_lineage = base_fixture.get("registryLineage") if isinstance(base_fixture, dict) else None
        base_lineage_versions = base_lineage.get("versions") if isinstance(base_lineage, dict) else None
        require(
            isinstance(versions, list)
            and isinstance(base_lineage_versions, list)
            and versions[:-1] == base_lineage_versions
            and versions[-1:] == [{"bundleKey": "product-surfaces", "sha256": v63["checksum"], "version": 63}],
            "Backend pilot fixture registry lineage drift",
            failures,
        )
        require(isinstance(lineage, dict) and lineage.get("latestAliasVersion") == 63, "Backend pilot fixture latest alias drift", failures)
        if isinstance(lineage, dict) and isinstance(base_lineage, dict):
            require(set(lineage) == set(base_lineage), "Backend pilot fixture lineage field closure drift", failures)
            for key in ("authority", "bundleKey"):
                require(lineage.get(key) == base_lineage.get(key), f"Backend pilot fixture lineage predecessor field drift: {key}", failures)
        require(fixture.get("fixtureChecksumAlgorithm") == "SHA-256", "Backend pilot fixture checksum algorithm drift", failures)
        require(fixture.get("fixtureChecksum") == content_checksum(fixture, "fixtureChecksum"), "Backend pilot fixture checksum drift", failures)
        if isinstance(base_fixture, dict) and isinstance(base_lineage, dict):
            normalized_fixture = json.loads(json.dumps(fixture))
            normalized_fixture["registryLineage"] = base_lineage
            normalized_fixture["fixtureChecksum"] = base_fixture.get("fixtureChecksum")
            require(normalized_fixture == base_fixture, "Backend pilot fixture non-lineage predecessor content drift", failures)

    projection_paths = {
        "people": "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v63.generated.json",
        "time": "dwp-time-server/src/main/resources/product-authorization/hcm-time-pep-v63.generated.json",
        "platform": "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v63.generated.json",
        "payroll": "dwp-payroll-server/src/main/resources/product-authorization/hcm-payroll-pep-v63.generated.json",
    }
    expected_projection = successor_design["productAuthorizationLineage"]["successor"]
    projection_counts = {"people": expected_projection["expectedPeopleProjection"], **expected_projection["unchangedServiceProjectionCounts"]}
    for owner, relative in projection_paths.items():
        projection = git_json(BACKEND, commit, relative, f"Backend {owner} v63 projection", failures)
        validate_projection(projection, projection_counts[owner], owner, v63["checksum"], f"Backend {owner} v63 projection", failures)
        predecessor_projection = git_json(BACKEND, BACKEND_BASE, relative.replace("v63", "v62"), f"Backend {owner} v62 projection", failures)
        if projection is None or predecessor_projection is None:
            continue
        require(set(projection) == set(predecessor_projection), f"Backend {owner} projection field closure drift", failures)
        if owner != "people":
            normalized_projection = json.loads(json.dumps(projection))
            for field in ("projectionKey", "registryRef", "sourceRegistryRouteCount", "projectionChecksum"):
                normalized_projection[field] = predecessor_projection[field]
            require(normalized_projection == predecessor_projection, f"Backend {owner} v63 semantic projection drift", failures)
        else:
            unchanged_fields = set(projection) - {
                "capabilities", "predicatePolicies", "routes", "bindingPairCount",
                "projectedRouteContractCount", "routeKindCounts", "projectionKey",
                "registryRef", "sourceRegistryRouteCount", "projectionChecksum",
            }
            for field in unchanged_fields:
                require(projection.get(field) == predecessor_projection.get(field), f"Backend people projection predecessor field drift: {field}", failures)
            people_before_capabilities = keyed(predecessor_projection.get("capabilities"), "contractKey", "People v62 capabilities", failures)
            people_after_capabilities = keyed(projection.get("capabilities"), "contractKey", "People v63 capabilities", failures)
            people_before_predicates = keyed(predecessor_projection.get("predicatePolicies"), "predicatePolicyKey", "People v62 predicates", failures)
            people_after_predicates = keyed(projection.get("predicatePolicies"), "predicatePolicyKey", "People v63 predicates", failures)
            people_before_routes = keyed(predecessor_projection.get("routes"), "routeContractKey", "People v62 routes", failures)
            people_after_routes = keyed(projection.get("routes"), "routeContractKey", "People v63 routes", failures)
            require_exact_reverse_reference_delta(
                people_before_capabilities,
                people_after_capabilities,
                {"per.goal.self.write"},
                {"hcm.team.performance.review": ordered_added_routes},
                "People capability projection",
                failures,
            )
            require_exact_reverse_reference_delta(
                people_before_predicates,
                people_after_predicates,
                {"predicate.hcm-performance-goal-command.v1"},
                {"predicate.self-person.v1": ordered_added_routes, "predicate.team-target-population.v1": ordered_added_routes},
                "People predicate projection",
                failures,
            )
            require(set(people_after_routes) - set(people_before_routes) == added_routes, "People route projection delta drift", failures)
            for identity, value in people_before_routes.items():
                require(people_after_routes.get(identity) == value, f"People existing route projection mutation: {identity}", failures)
            require(people_after_capabilities.get("per.goal.self.write") == after["capabilities"].get("per.goal.self.write"), "People self capability differs from canonical v63", failures)
            require(people_after_predicates.get("predicate.hcm-performance-goal-command.v1") == after["predicatePolicies"].get("predicate.hcm-performance-goal-command.v1"), "People Goal predicate differs from canonical v63", failures)
            require({key: people_after_routes.get(key) for key in added_routes} == {key: after["routes"].get(key) for key in added_routes}, "People Goal routes differ from canonical v63", failures)
    approval_absent = git(BACKEND, "cat-file", "-e", f"{commit}:dwp-auth-server/src/main/resources/product-authorization/approval-pilot-pep-v63.generated.json", check=False)
    require(approval_absent.returncode != 0, "forbidden Approval v63 projection exists", failures)

    migration_path = "dwp-auth-server/src/main/resources/db/migration/V273__declare_hris_per009_v63_authorization_seed.sql"
    migration = git_blob(BACKEND, commit, migration_path, "Backend Auth V273 migration", failures)
    if migration is not None:
        try:
            sql = migration.decode("utf-8")
        except UnicodeDecodeError:
            failures.append("Backend Auth V273 migration is not UTF-8")
        else:
            validate_v273_sql(sql, v63["checksum"], failures)
    validate_backend_source_closure(commit, v63, failures)


def validate_backend_dependency(
    carrier: tuple[str, str] | None,
    authority: dict[str, Any],
    failures: list[str],
) -> dict[str, Any] | None:
    if carrier is None:
        return None
    clean_bytes = secure_receipt_bytes(BACKEND_RECEIPT, failures)
    targeted_artifact = secure_external_json(BACKEND_TARGETED, "backend targeted verification receipt", failures)
    review_artifact = secure_external_json(BACKEND_POST_REVIEW, "backend post-implementation review", failures)
    consumed_artifact = secure_external_json(BACKEND_CONSUMPTION, "backend token consumption receipt", failures)
    if clean_bytes is None or targeted_artifact is None or review_artifact is None or consumed_artifact is None:
        return None
    targeted, targeted_bytes = targeted_artifact
    review, review_bytes = review_artifact
    consumed_receipt, consumed_bytes = consumed_artifact
    carrier_commit_value, carrier_tree_value = carrier
    targeted_fields = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "backendTokenArtifact", "cleanReceiptSha256", "consumptionReceiptSha256",
        "repository", "branch", "baseCommit", "baseTree", "testedCommit", "testedTree",
        "v63Checksum", "changedPaths", "changedArtifacts", "verificationCommands",
        "exitCodes", "semanticEvidence", "verifiedAt", "verifiedBy",
    }
    require(set(targeted) == targeted_fields, "backend targeted receipt field closure drift", failures)
    require(targeted.get("schema") == "dwp.hris.wave7.per009-backend-targeted-verification-receipt.v1", "backend targeted receipt schema drift", failures)
    require(targeted.get("state") == "TRUSTED_EXACT_PER009_BACKEND_V63_V273_TREE_AND_TARGETED_TESTS_PASS", "backend targeted receipt state drift", failures)
    require(targeted.get("authorityCarrierCommit") == carrier_commit_value, "backend targeted carrier commit drift", failures)
    require(targeted.get("authorityCarrierTree") == carrier_tree_value, "backend targeted carrier tree drift", failures)
    require(targeted.get("backendTokenArtifact") == artifact_at(carrier_commit_value, BACKEND_TOKEN_REL), "backend targeted token pin drift", failures)
    require(
        targeted.get("cleanReceiptSha256") == digest_bytes(clean_bytes),
        "backend targeted clean receipt pin drift",
        failures,
    )
    require(
        targeted.get("consumptionReceiptSha256") == digest_bytes(consumed_bytes),
        "backend targeted consumption pin drift",
        failures,
    )
    require(targeted.get("repository") == "dwp-backend" and targeted.get("branch") == BACKEND_LANE, "backend targeted repository or branch drift", failures)
    require(targeted.get("baseCommit") == BACKEND_BASE and targeted.get("baseTree") == BACKEND_TREE, "backend targeted base drift", failures)
    commit = targeted.get("testedCommit")
    tree = targeted.get("testedTree")
    valid_commit = isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit) is not None
    valid_tree = isinstance(tree, str) and re.fullmatch(r"[0-9a-f]{40}", tree) is not None
    require(valid_commit, "backend tested commit invalid", failures)
    require(valid_tree, "backend tested tree invalid", failures)
    commit_present = bool(valid_commit and git(BACKEND, "cat-file", "-e", f"{commit}^{{commit}}", check=False).returncode == 0)
    require(commit_present, "backend tested commit object missing", failures)
    if commit_present:
        parents = git_text(BACKEND, "show", "-s", "--format=%P", commit).split()
        require(parents == [BACKEND_BASE], "backend lane commit is not a direct child", failures)
        require(git_text(BACKEND, "rev-parse", f"{commit}^{{tree}}") == tree, "backend lane tree drift", failures)
        changed = [line for line in git_text(BACKEND, "diff", "--name-only", f"{BACKEND_BASE}..{commit}", "--").splitlines() if line]
        require(changed == targeted.get("changedPaths"), "backend targeted changed path drift", failures)
        require(
            set(changed) == set(authority["sourceAllowlist"]["backendWritable"])
            and len(changed) == len(authority["sourceAllowlist"]["backendWritable"]) == 33,
            "backend changed path set is not the exact sealed 33-path allowlist",
            failures,
        )
        validate_changed_path_modes(BACKEND, BACKEND_WORKTREE, BACKEND_BASE, commit, changed, "Backend lane", failures)
        expected_artifacts = []
        for relative in changed:
            result = git(BACKEND, "show", f"{commit}:{relative}", check=False, text=False)
            require(result.returncode == 0, f"backend changed artifact missing: {relative}", failures)
            if result.returncode == 0:
                expected_artifacts.append({"path": relative, "bytes": len(result.stdout), "sha256": digest_bytes(result.stdout)})
        require(targeted.get("changedArtifacts") == expected_artifacts, "backend changed artifact pins drift", failures)
        bundle_result = git(BACKEND, "show", f"{commit}:contracts/product-authorization/product-surfaces-v1.bundle-v63.json", check=False, text=False)
        require(bundle_result.returncode == 0, "backend v63 bundle missing", failures)
        if bundle_result.returncode == 0:
            try:
                bundle = strict_json_bytes(bundle_result.stdout)
            except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
                failures.append(f"backend v63 bundle cannot be loaded: {exc}")
            else:
                require(bundle.get("checksum") == targeted.get("v63Checksum"), "backend v63 checksum drift", failures)
                require(bundle.get("version") == 63 and bundle.get("bundleStatus") == "DRAFT", "backend v63 identity drift", failures)
        try:
            validate_backend_v63_semantics(commit, authority, load(SUCCESSOR_PATH), targeted.get("v63Checksum"), failures)
        except (AttributeError, IndexError, KeyError, TypeError, ValueError, subprocess.CalledProcessError) as exc:
            failures.append(f"Backend v63 semantic validation failed closed: {exc}")
    require(
        isinstance(targeted.get("v63Checksum"), str)
        and re.fullmatch(r"[0-9a-f]{64}", targeted["v63Checksum"]) is not None,
        "backend v63 checksum format drift",
        failures,
    )
    require(targeted.get("verifiedBy") == BACKEND_VERIFIER, "backend targeted verifier identity drift", failures)
    require(targeted.get("verificationCommands") == authority["verificationContract"]["backendCommands"], "backend verification command drift", failures)
    require(targeted.get("exitCodes") == {command: 0 for command in authority["verificationContract"]["backendCommands"]}, "backend verification exit-code drift", failures)
    expected_semantic_evidence = {
        "v63 exact 281/24/17/88/1160 and PAGE162/DATA349/ACTION649 counts": "PASS",
        "only one capability, one predicate and two Goal ACTION routes over immutable v62": "PASS",
        "four SELF and MANAGER branches equal the sealed PEP register": "PASS",
        "V273 is DRAFT default-OFF with zero import activation enrollment assignment and grant effects": "PASS",
        "People v63 projection is generated but runtime remains v60 and unmounted": "PASS",
        "Time Platform and Payroll projections preserve semantics and Approval v63 is absent": "PASS",
    }
    require(targeted.get("semanticEvidence") == expected_semantic_evidence, "backend semantic evidence drift", failures)

    review_fields = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "targetedVerificationReceiptSha256", "laneCommit", "laneTree", "v63Checksum",
        "changedPaths", "p0", "p1", "p2", "decision", "reviewedAt",
        "lanePushObservedAt", "recordedAt", "reviewedBy",
    }
    require(set(review) == review_fields, "backend post-review field closure drift", failures)
    require(review.get("schema") == "dwp.hris.wave7.per009-backend-post-implementation-review.v1", "backend post-review schema drift", failures)
    require(review.get("state") == "INDEPENDENTLY_REVIEWED_EXACT_PER009_BACKEND_V63_V273_LANE_BRANCH_PUSH_ONLY", "backend post-review state drift", failures)
    require(review.get("authorityCarrierCommit") == carrier_commit_value and review.get("authorityCarrierTree") == carrier_tree_value, "backend post-review carrier drift", failures)
    require(review.get("targetedVerificationReceiptSha256") == digest_bytes(targeted_bytes), "backend post-review targeted pin drift", failures)
    require(review.get("laneCommit") == commit and review.get("laneTree") == tree, "backend post-review lane drift", failures)
    require(review.get("v63Checksum") == targeted.get("v63Checksum"), "backend post-review checksum drift", failures)
    require(review.get("changedPaths") == targeted.get("changedPaths"), "backend post-review path drift", failures)
    require(review.get("p0") == review.get("p1") == review.get("p2") == 0, "backend post-review severity drift", failures)
    require(review.get("decision") == "GO_FOR_PER009_BACKEND_V63_V273_LANE_BRANCH_PUSH_ONLY", "backend post-review decision drift", failures)
    require(review.get("reviewedBy") == BACKEND_REVIEWER, "backend post-review reviewer identity drift", failures)
    require(len({BACKEND_EXECUTOR, targeted.get("verifiedBy"), review.get("reviewedBy")}) == 3, "backend executor, verifier and reviewer are not independent", failures)
    remote = remote_git("ls-remote", "--heads", BACKEND_ORIGIN, f"refs/heads/{BACKEND_LANE}")
    remote_lines = [line for line in remote.stdout.splitlines() if line]
    require(remote.returncode == 0 and remote_lines == [f"{commit}\trefs/heads/{BACKEND_LANE}"], "backend remote lane does not equal reviewed commit", failures)
    if isinstance(commit, str) and len(commit) == 40:
        require(BACKEND_WORKTREE.is_dir(), "reviewed Backend lane worktree missing before Frontend sync", failures)
        if BACKEND_WORKTREE.is_dir():
            validate_repository_provenance(BACKEND, BACKEND_WORKTREE, "Backend sync source", failures)
            validate_local_git_config(BACKEND_WORKTREE, "Backend sync source", failures)
            require(git_text(BACKEND_WORKTREE, "rev-parse", "HEAD") == commit, "Backend sync source worktree HEAD drift", failures)
            require(git_text(BACKEND_WORKTREE, "rev-parse", "HEAD^{tree}") == tree, "Backend sync source worktree tree drift", failures)
            require(git_text(BACKEND_WORKTREE, "branch", "--show-current") == BACKEND_LANE, "Backend sync source branch drift", failures)
            require(git(BACKEND_WORKTREE, "status", "--porcelain=v2", "--untracked-files=all").stdout == "", "Backend sync source worktree is dirty", failures)
            require(git(BACKEND_WORKTREE, "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching").stdout == "", "Backend sync source contains ignored shadow paths", failures)
            require(git_common_dir(BACKEND_WORKTREE) == BACKEND / ".git", "Backend sync source git-common-dir drift", failures)
            require(
                git_text(BACKEND_WORKTREE, "remote", "get-url", "origin") == BACKEND_ORIGIN,
                "Backend sync source origin URL drift",
                failures,
            )
            require(
                actual_protections(BACKEND, BACKEND_WORKTREE)
                == {
                    "assumeUnchangedPaths": [],
                    "skipWorktreePaths": [],
                    "sparseCheckoutEnabled": False,
                    "fsmonitorConfigured": False,
                    "diffExternalConfigured": False,
                    "graftFilePresent": False,
                    "replaceRefs": [],
                    "repositoryOrWorktreePathSymlinks": [],
                },
                "Backend sync source worktree protections drift",
                failures,
            )
    committed = parse_time(git_text(BACKEND, "show", "-s", "--format=%cI", commit), "backend committedAt", failures) if isinstance(commit, str) and len(commit) == 40 else None
    verified = parse_time(targeted.get("verifiedAt"), "backend targeted verifiedAt", failures)
    reviewed = parse_time(review.get("reviewedAt"), "backend reviewedAt", failures)
    pushed = parse_time(review.get("lanePushObservedAt"), "backend lanePushObservedAt", failures)
    recorded = parse_time(review.get("recordedAt"), "backend review recordedAt", failures)
    consumed_at = parse_time(consumed_receipt.get("consumedAt"), "backend consumedAt", failures)
    execution_deadline = parse_time(consumed_receipt.get("executionDeadline"), "backend executionDeadline", failures)
    if all(item is not None for item in (consumed_at, committed, execution_deadline)):
        require(consumed_at <= committed <= execution_deadline, "backend lane commit is outside the consumed token execution window", failures)
    if all(item is not None for item in (committed, verified, reviewed, pushed, recorded)):
        try:
            require(committed <= verified <= reviewed <= pushed <= recorded, "backend receipt causal order drift", failures)
        except TypeError:
            failures.append("backend receipt timestamp timezone mismatch")
    return {
        "targetedVerificationReceiptSha256": digest_bytes(targeted_bytes),
        "postImplementationReviewSha256": digest_bytes(review_bytes),
        "laneCommit": commit,
        "laneTree": tree,
        "v63Checksum": targeted.get("v63Checksum"),
    }


class TypeScriptLiteralParser:
    """Parse only the inert literal subset emitted by the trusted sync scripts."""

    def __init__(self, source: str, start: int) -> None:
        self.source = source
        self.position = start

    def whitespace(self) -> None:
        while self.position < len(self.source) and self.source[self.position].isspace():
            self.position += 1

    def value(self) -> Any:
        self.whitespace()
        if self.position >= len(self.source):
            raise ValueError("unexpected end of TypeScript literal")
        character = self.source[self.position]
        if character == "{":
            return self.object()
        if character == "[":
            return self.array()
        if character in {"'", '"'}:
            return self.string()
        number = re.match(r"-?\d+", self.source[self.position:])
        if number:
            self.position += len(number.group(0))
            return int(number.group(0))
        identifier = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", self.source[self.position:])
        if not identifier:
            raise ValueError(f"unsupported TypeScript literal token at {self.position}")
        name = identifier.group(0)
        self.position += len(name)
        if name == "true":
            return True
        if name == "false":
            return False
        if name == "null":
            return None
        if name == "authorizationCounts":
            self.whitespace()
            if self.position >= len(self.source) or self.source[self.position] != "(":
                raise ValueError("authorizationCounts must be a direct literal call")
            self.position += 1
            arguments: list[int] = []
            for index in range(5):
                argument = self.value()
                if not isinstance(argument, int):
                    raise ValueError("authorizationCounts accepts integers only")
                arguments.append(argument)
                self.whitespace()
                delimiter = ")" if index == 4 else ","
                if self.position >= len(self.source) or self.source[self.position] != delimiter:
                    raise ValueError("authorizationCounts arity drift")
                self.position += 1
            return {"authorizationCounts": arguments}
        raise ValueError(f"executable TypeScript identifier is forbidden: {name}")

    def string(self) -> str:
        start = self.position
        quote = self.source[self.position]
        self.position += 1
        while self.position < len(self.source):
            character = self.source[self.position]
            if character == "\\":
                self.position += 2
                continue
            self.position += 1
            if character == quote:
                try:
                    value = ast.literal_eval(self.source[start:self.position])
                except (SyntaxError, ValueError) as exc:
                    raise ValueError(f"invalid TypeScript string literal: {exc}") from exc
                if not isinstance(value, str):
                    raise ValueError("TypeScript string literal is not text")
                return value
        raise ValueError("unterminated TypeScript string literal")

    def key(self) -> str | int:
        self.whitespace()
        if self.position >= len(self.source):
            raise ValueError("unexpected end of TypeScript object key")
        if self.source[self.position] in {"'", '"'}:
            return self.string()
        number = re.match(r"\d+", self.source[self.position:])
        if number:
            self.position += len(number.group(0))
            return int(number.group(0))
        identifier = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", self.source[self.position:])
        if not identifier:
            raise ValueError(f"invalid TypeScript object key at {self.position}")
        self.position += len(identifier.group(0))
        return identifier.group(0)

    def object(self) -> dict[Any, Any]:
        result: dict[Any, Any] = {}
        self.position += 1
        self.whitespace()
        if self.position < len(self.source) and self.source[self.position] == "}":
            self.position += 1
            return result
        while True:
            key = self.key()
            if key in result:
                raise ValueError(f"duplicate TypeScript object key: {key}")
            self.whitespace()
            if self.position >= len(self.source) or self.source[self.position] != ":":
                raise ValueError("TypeScript object key is missing ':'")
            self.position += 1
            result[key] = self.value()
            self.whitespace()
            if self.position >= len(self.source) or self.source[self.position] not in {",", "}"}:
                raise ValueError("TypeScript object delimiter drift")
            delimiter = self.source[self.position]
            self.position += 1
            if delimiter == "}":
                return result
            self.whitespace()
            if self.position < len(self.source) and self.source[self.position] == "}":
                self.position += 1
                return result

    def array(self) -> list[Any]:
        result: list[Any] = []
        self.position += 1
        self.whitespace()
        if self.position < len(self.source) and self.source[self.position] == "]":
            self.position += 1
            return result
        while True:
            result.append(self.value())
            self.whitespace()
            if self.position >= len(self.source) or self.source[self.position] not in {",", "]"}:
                raise ValueError("TypeScript array delimiter drift")
            delimiter = self.source[self.position]
            self.position += 1
            if delimiter == "]":
                return result
            self.whitespace()
            if self.position < len(self.source) and self.source[self.position] == "]":
                self.position += 1
                return result


def extract_literal_scaffold(source: str, specifications: list[tuple[str, str]]) -> tuple[list[Any], str]:
    values: list[Any] = []
    scaffold: list[str] = []
    cursor = 0
    for ordinal, (marker, suffix) in enumerate(specifications):
        if source.count(marker) != 1:
            raise ValueError(f"generated TypeScript marker cardinality drift: {marker}")
        start = source.find(marker, cursor)
        if start < 0:
            raise ValueError(f"generated TypeScript marker order drift: {marker}")
        literal_start = start + len(marker)
        scaffold.append(source[cursor:literal_start])
        parser = TypeScriptLiteralParser(source, literal_start)
        values.append(parser.value())
        parser.whitespace()
        if not source.startswith(suffix, parser.position):
            raise ValueError(f"generated TypeScript literal suffix drift: {marker}")
        scaffold.append(f"<SEALED_LITERAL_{ordinal}>{suffix}")
        cursor = parser.position + len(suffix)
    scaffold.append(source[cursor:])
    return values, "".join(scaffold)


def normalize_fixture_typescript_scaffold(scaffold: str, versions: list[int], latest: int) -> str:
    version_pattern = re.compile(r"(?m)^(\s*)version:\s*((?:\|?\s*\d+\s*)+);$")
    matches = list(version_pattern.finditer(scaffold))
    if len(matches) != 2:
        raise ValueError("fixture TypeScript version union cardinality drift")
    for match in matches:
        if [int(value) for value in re.findall(r"\d+", match.group(2))] != versions:
            raise ValueError("fixture TypeScript version union drift")
    normalized = version_pattern.sub(lambda match: f"{match.group(1)}version: <SEALED_VERSIONS>;", scaffold)
    latest_pattern = re.compile(r"(?m)^(\s*latestAliasVersion:\s*)(\d+);$")
    matches = list(latest_pattern.finditer(normalized))
    if len(matches) != 1 or int(matches[0].group(2)) != latest:
        raise ValueError("fixture TypeScript latest alias type drift")
    return latest_pattern.sub(r"\1<SEALED_LATEST>;", normalized)


def decode_blob(blob: bytes | None, label: str, failures: list[str]) -> str | None:
    if blob is None:
        return None
    try:
        return blob.decode("utf-8")
    except UnicodeDecodeError:
        failures.append(f"{label} is not UTF-8")
        return None


def validate_frontend_static_generated_artifacts(
    base_commit: str,
    commit: str,
    snapshot: dict[str, Any],
    fixture: dict[str, Any],
    failures: list[str],
) -> None:
    versions_relative = "scripts/product-authorization-fixture-versions.mjs"
    route_relative = "apps/dwp/src/routes/product-surface-authorization.generated.ts"
    fixture_relative = "libs/shared-utils/src/test-utils/pilot-authorization-fixtures.generated.ts"
    sources: dict[str, tuple[str | None, str | None]] = {}
    for relative, label in (
        (versions_relative, "Frontend fixture-version literal module"),
        (route_relative, "Frontend generated route TypeScript"),
        (fixture_relative, "Frontend generated fixture TypeScript"),
    ):
        base = decode_blob(git_blob(CANONICAL_FRONTEND, base_commit, relative, f"{label} base", failures), f"{label} base", failures)
        target = decode_blob(git_blob(CANONICAL_FRONTEND, commit, relative, label, failures), label, failures)
        sources[relative] = (base, target)
    if any(base is None or target is None for base, target in sources.values()):
        return
    version_specs = [
        ("export const EXPECTED_REGISTRY_VERSIONS = ", ";"),
        ("export const PRESERVED_AUTHORIZATION_CHECKSUMS = Object.freeze(", ");"),
        ("export const EXPECTED_AUTHORIZATION_COUNTS = Object.freeze(", ");"),
    ]
    route_specs = [
        ("export const PRODUCT_AUTHORIZATION_REGISTRY_REVISION = ", "as const;"),
        ("export const PRODUCT_SURFACE_ROLLOUT_INVENTORY_REVISION = ", "as const;"),
        ("export const PRODUCT_SURFACE_ROLLOUT_PRODUCTS = ", "as const;"),
        ("export const PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS = ", "as const satisfies readonly ProductAuthorizationRouteProjection[];"),
    ]
    fixture_specs = [("export const PILOT_AUTHORIZATION_FIXTURES = ", "as const satisfies PilotAuthorizationFixtureBundle;")]
    try:
        base_version_values, base_version_scaffold = extract_literal_scaffold(sources[versions_relative][0], version_specs)
        version_values, version_scaffold = extract_literal_scaffold(sources[versions_relative][1], version_specs)
        require(version_scaffold == base_version_scaffold, "Frontend fixture-version executable scaffold drift", failures)
        versions, checksums, counts = version_values
        require(versions == list(range(1, 64)), "Frontend fixture-version literal lineage drift", failures)
        bundles = snapshot.get("bundles")
        if isinstance(bundles, list) and len(bundles) == 63:
            require(checksums == {item["version"]: item["checksum"] for item in bundles}, "Frontend fixture-version checksum literal drift", failures)
            expected_counts = {
                item["version"]: {"authorizationCounts": [len(item[section]) for section in ("capabilities", "accessPolicies", "entitlementExpressions", "predicatePolicies", "routes")]}
                for item in bundles
            }
            require(counts == expected_counts, "Frontend fixture-version count literal drift", failures)
        require(base_version_values[0] == list(range(1, len(base_version_values[0]) + 1)), "Frontend base fixture-version lineage malformed", failures)

        base_route_values, base_route_scaffold = extract_literal_scaffold(sources[route_relative][0], route_specs)
        route_values, route_scaffold = extract_literal_scaffold(sources[route_relative][1], route_specs)
        require(route_scaffold == base_route_scaffold, "Frontend generated route executable scaffold drift", failures)
        index = snapshot["index"]
        rollout = snapshot["rolloutInventory"]
        latest = snapshot["latestAlias"]
        expected_routes = [
            {
                "routeContractKey": route["routeContractKey"], "routeKind": route["routeKind"],
                "navigationContextId": route["navigationContextId"], "subjectType": route["subject"]["type"],
                "productId": route["subject"].get("productKey"), "surfaceId": route["subject"].get("surfaceKey"),
                "routeId": route.get("uiRouteId"), "pattern": route.get("uiRoutePattern"),
                "gatewayBindings": [{"method": binding["method"], "path": binding["path"]} for binding in route["gatewayApiBindings"]],
            }
            for route in latest["routes"]
        ]
        expected_route_values = [
            {"bundleKey": index["bundleKey"], "version": index["latestVersion"], "checksum": index["latestChecksum"], "indexChecksum": index["indexChecksum"]},
            {"inventoryKey": rollout["inventoryKey"], "checksum": rollout["checksum"]},
            rollout["products"], expected_routes,
        ]
        require(route_values == expected_route_values, "Frontend generated route literal semantics drift", failures)
        require(len(base_route_values) == 4, "Frontend base generated route literal closure drift", failures)

        base_fixture_values, base_fixture_scaffold = extract_literal_scaffold(sources[fixture_relative][0], fixture_specs)
        fixture_values, fixture_scaffold = extract_literal_scaffold(sources[fixture_relative][1], fixture_specs)
        base_versions = list(range(1, len(base_version_values[0]) + 1))
        require(
            normalize_fixture_typescript_scaffold(fixture_scaffold, list(range(1, 64)), 63)
            == normalize_fixture_typescript_scaffold(base_fixture_scaffold, base_versions, base_versions[-1]),
            "Frontend generated fixture executable scaffold drift",
            failures,
        )
        require(fixture_values == [fixture], "Frontend generated fixture literal semantics drift", failures)
        require(len(base_fixture_values) == 1, "Frontend base generated fixture literal closure drift", failures)
    except (AttributeError, IndexError, KeyError, TypeError, ValueError) as exc:
        failures.append(f"Frontend static generated-artifact validation failed closed: {exc}")


def validate_frontend_lane_result(
    carrier: tuple[str, str] | None,
    authority: dict[str, Any],
    backend_dependency: dict[str, Any] | None,
    failures: list[str],
) -> None:
    if carrier is None or backend_dependency is None:
        return
    clean_bytes = secure_receipt_bytes(FRONTEND_RECEIPT, failures)
    targeted_artifact = secure_external_json(FRONTEND_TARGETED, "frontend targeted verification receipt", failures)
    review_artifact = secure_external_json(FRONTEND_POST_REVIEW, "frontend post-implementation review", failures)
    consumed_artifact = secure_external_json(FRONTEND_CONSUMPTION, "frontend token consumption receipt", failures)
    if clean_bytes is None or targeted_artifact is None or review_artifact is None or consumed_artifact is None:
        return
    targeted, targeted_bytes = targeted_artifact
    review, _review_bytes = review_artifact
    consumed_receipt, consumed_bytes = consumed_artifact
    carrier_commit_value, carrier_tree_value = carrier
    targeted_fields = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "frontendTokenArtifact", "cleanReceiptSha256", "consumptionReceiptSha256",
        "backendDependency", "repository", "branch", "baseCommit", "baseTree",
        "testedCommit", "testedTree", "changedPaths", "changedArtifacts",
        "bytePreservedArtifacts", "verificationCommands", "exitCodes",
        "semanticEvidence", "verifiedAt", "verifiedBy",
    }
    require(set(targeted) == targeted_fields, "frontend targeted receipt field closure drift", failures)
    require(targeted.get("schema") == "dwp.hris.wave7.per009-frontend-targeted-verification-receipt.v1", "frontend targeted receipt schema drift", failures)
    require(targeted.get("state") == "TRUSTED_EXACT_PER009_FRONTEND_V62_V63_MIRROR_TREE_AND_TARGETED_TESTS_PASS", "frontend targeted receipt state drift", failures)
    require(targeted.get("authorityCarrierCommit") == carrier_commit_value and targeted.get("authorityCarrierTree") == carrier_tree_value, "frontend targeted carrier drift", failures)
    require(targeted.get("frontendTokenArtifact") == artifact_at(carrier_commit_value, FRONTEND_TOKEN_REL), "frontend targeted token pin drift", failures)
    require(targeted.get("cleanReceiptSha256") == digest_bytes(clean_bytes), "frontend targeted clean receipt pin drift", failures)
    require(targeted.get("consumptionReceiptSha256") == digest_bytes(consumed_bytes), "frontend targeted consumption pin drift", failures)
    require(targeted.get("backendDependency") == backend_dependency, "frontend targeted Backend dependency drift", failures)
    require(targeted.get("repository") == "dwp-frontend" and targeted.get("branch") == FRONTEND_LANE, "frontend targeted repository or branch drift", failures)
    require(targeted.get("baseCommit") == carrier_commit_value and targeted.get("baseTree") == carrier_tree_value, "frontend targeted base drift", failures)
    commit = targeted.get("testedCommit")
    tree = targeted.get("testedTree")
    valid_commit = isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit) is not None
    valid_tree = isinstance(tree, str) and re.fullmatch(r"[0-9a-f]{40}", tree) is not None
    require(valid_commit, "frontend tested commit invalid", failures)
    require(valid_tree, "frontend tested tree invalid", failures)
    commit_present = bool(valid_commit and git(CANONICAL_FRONTEND, "cat-file", "-e", f"{commit}^{{commit}}", check=False).returncode == 0)
    require(commit_present, "frontend tested commit object missing", failures)
    changed: list[str] = []
    if commit_present:
        require(git_text(CANONICAL_FRONTEND, "show", "-s", "--format=%P", commit).split() == [carrier_commit_value], "frontend lane commit is not a direct child", failures)
        require(git_text(CANONICAL_FRONTEND, "rev-parse", f"{commit}^{{tree}}") == tree, "frontend lane tree drift", failures)
        changed = [line for line in git_text(CANONICAL_FRONTEND, "diff", "--name-only", f"{carrier_commit_value}..{commit}", "--").splitlines() if line]
        require(changed == targeted.get("changedPaths"), "frontend targeted changed path drift", failures)
        require(
            set(changed) == set(authority["sourceAllowlist"]["frontendWritable"])
            and len(changed) == len(authority["sourceAllowlist"]["frontendWritable"]) == 5,
            "frontend changed path set is not the exact sealed 5-path allowlist",
            failures,
        )
        validate_changed_path_modes(CANONICAL_FRONTEND, FRONTEND_WORKTREE, carrier_commit_value, commit, changed, "Frontend lane", failures)
        expected_artifacts = []
        for relative in changed:
            data = git_blob(CANONICAL_FRONTEND, commit, relative, "Frontend changed artifact", failures)
            if data is not None:
                expected_artifacts.append({"path": relative, "bytes": len(data), "sha256": digest_bytes(data)})
        require(targeted.get("changedArtifacts") == expected_artifacts, "frontend changed artifact pins drift", failures)
        preserved_artifacts = []
        for relative in authority["sourceAllowlist"]["frontendReadExecuteBytePreserved"]:
            before = git_blob(CANONICAL_FRONTEND, carrier_commit_value, relative, "Frontend preserved base artifact", failures)
            after = git_blob(CANONICAL_FRONTEND, commit, relative, "Frontend preserved lane artifact", failures)
            require(before == after, f"Frontend byte-preserved path drift: {relative}", failures)
            if before is not None:
                preserved_artifacts.append({"path": relative, "bytes": len(before), "sha256": digest_bytes(before)})
        require(targeted.get("bytePreservedArtifacts") == preserved_artifacts, "frontend preserved artifact pins drift", failures)

        snapshot_relative = "architecture/product-surface-authorization.v1.json"
        base_snapshot = git_json(CANONICAL_FRONTEND, carrier_commit_value, snapshot_relative, "Frontend base mirror", failures)
        snapshot = git_json(CANONICAL_FRONTEND, commit, snapshot_relative, "Frontend v63 mirror", failures)
        backend_commit = backend_dependency["laneCommit"]
        backend_v62 = git_json(BACKEND, backend_commit, "contracts/product-authorization/product-surfaces-v1.bundle-v62.json", "reviewed Backend v62", failures)
        backend_v63 = git_json(BACKEND, backend_commit, "contracts/product-authorization/product-surfaces-v1.bundle-v63.json", "reviewed Backend v63", failures)
        backend_index = git_json(BACKEND, backend_commit, "contracts/product-authorization/product-surfaces-v1.index.json", "reviewed Backend index", failures)
        backend_alias = git_json(BACKEND, backend_commit, "contracts/product-authorization/product-surfaces-v1.json", "reviewed Backend alias", failures)
        backend_rollout = git_json(BACKEND, backend_commit, "contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json", "reviewed Backend rollout inventory", failures)
        if base_snapshot is not None and snapshot is not None and all(item is not None for item in (backend_v62, backend_v63, backend_index, backend_alias, backend_rollout)):
            require(set(snapshot) == {"schemaVersion", "snapshotKey", "index", "bundles", "latestAlias", "rolloutInventory"}, "Frontend mirror field closure drift", failures)
            bundles = snapshot.get("bundles")
            base_bundles = base_snapshot.get("bundles")
            require(isinstance(bundles, list) and [item.get("version") for item in bundles] == list(range(1, 64)), "Frontend mirror version lineage drift", failures)
            if isinstance(bundles, list) and isinstance(base_bundles, list) and len(bundles) == 63:
                require(bundles[:61] == base_bundles, "Frontend v1-v61 mirror mutation", failures)
                require(bundles[61] == backend_v62 and bundles[62] == backend_v63, "Frontend v62/v63 mirror differs from reviewed Backend blobs", failures)
            require(snapshot.get("index") == backend_index, "Frontend mirror index differs from reviewed Backend", failures)
            require(snapshot.get("latestAlias") == backend_alias == backend_v63, "Frontend latest alias drift", failures)
            require(snapshot.get("rolloutInventory") == backend_rollout, "Frontend rollout inventory drift", failures)
        snapshot_blob = git_blob(CANONICAL_FRONTEND, commit, snapshot_relative, "Frontend v63 mirror", failures)
        if snapshot_blob is not None:
            require(len(snapshot_blob) < authority["semanticClosure"]["frontendMaximumSnapshotBytes"], "Frontend mirror exceeds size ceiling", failures)
        frontend_fixture = git_json(CANONICAL_FRONTEND, commit, "architecture/pilot-fixtures.v1.generated.json", "Frontend fixture mirror", failures)
        backend_fixture = git_json(BACKEND, backend_commit, "contracts/product-authorization/pilot-fixtures.v1.generated.json", "reviewed Backend fixture", failures)
        require(frontend_fixture == backend_fixture, "Frontend fixture mirror differs from reviewed Backend", failures)
        if snapshot is not None and frontend_fixture is not None:
            validate_frontend_static_generated_artifacts(
                carrier_commit_value,
                commit,
                snapshot,
                frontend_fixture,
                failures,
            )

    require(targeted.get("verificationCommands") == authority["verificationContract"]["frontendCommands"], "frontend verification command drift", failures)
    require(targeted.get("exitCodes") == {command: 0 for command in authority["verificationContract"]["frontendCommands"]}, "frontend verification exit-code drift", failures)
    expected_semantic_evidence = {
        "v1-v61 mirror objects remain identical and reviewed Backend v62 then v63 are appended in order": "PASS",
        "index latest alias rollout inventory and fixture mirror equal reviewed Backend commit blobs": "PASS",
        "all four execute-only route and sync paths remain byte-identical": "PASS",
        "no PAGE route menu navigation provider feature enrollment or runtime binding is introduced": "PASS",
        "authorization snapshot remains strictly below 104857600 bytes": "PASS",
    }
    require(targeted.get("semanticEvidence") == expected_semantic_evidence, "frontend semantic evidence drift", failures)
    require(targeted.get("verifiedBy") == FRONTEND_VERIFIER, "frontend targeted verifier identity drift", failures)

    review_fields = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "targetedVerificationReceiptSha256", "backendDependency", "laneCommit", "laneTree",
        "changedPaths", "p0", "p1", "p2", "decision", "reviewedAt",
        "lanePushObservedAt", "recordedAt", "reviewedBy",
    }
    require(set(review) == review_fields, "frontend post-review field closure drift", failures)
    require(review.get("schema") == "dwp.hris.wave7.per009-frontend-post-implementation-review.v1", "frontend post-review schema drift", failures)
    require(review.get("state") == "INDEPENDENTLY_REVIEWED_EXACT_PER009_FRONTEND_V62_V63_MIRROR_LANE_BRANCH_PUSH_ONLY", "frontend post-review state drift", failures)
    require(review.get("authorityCarrierCommit") == carrier_commit_value and review.get("authorityCarrierTree") == carrier_tree_value, "frontend post-review carrier drift", failures)
    require(review.get("targetedVerificationReceiptSha256") == digest_bytes(targeted_bytes), "frontend post-review targeted pin drift", failures)
    require(review.get("backendDependency") == backend_dependency, "frontend post-review Backend dependency drift", failures)
    require(review.get("laneCommit") == commit and review.get("laneTree") == tree, "frontend post-review lane drift", failures)
    require(review.get("changedPaths") == changed, "frontend post-review path drift", failures)
    require(review.get("p0") == review.get("p1") == review.get("p2") == 0, "frontend post-review severity drift", failures)
    require(review.get("decision") == "GO_FOR_PER009_FRONTEND_V62_V63_MIRROR_LANE_BRANCH_PUSH_ONLY", "frontend post-review decision drift", failures)
    require(review.get("reviewedBy") == FRONTEND_REVIEWER, "frontend post-review reviewer identity drift", failures)
    require(len({FRONTEND_EXECUTOR, targeted.get("verifiedBy"), review.get("reviewedBy")}) == 3, "frontend executor, verifier and reviewer are not independent", failures)
    remote = remote_git("ls-remote", "--heads", FRONTEND_ORIGIN, f"refs/heads/{FRONTEND_LANE}")
    require(remote.returncode == 0 and [line for line in remote.stdout.splitlines() if line] == [f"{commit}\trefs/heads/{FRONTEND_LANE}"], "frontend remote lane does not equal reviewed commit", failures)
    require(FRONTEND_WORKTREE.is_dir(), "reviewed Frontend lane worktree missing", failures)
    if commit_present and FRONTEND_WORKTREE.is_dir():
        validate_repository_provenance(CANONICAL_FRONTEND, FRONTEND_WORKTREE, "Frontend result", failures)
        validate_local_git_config(FRONTEND_WORKTREE, "Frontend result", failures)
        require(git_text(FRONTEND_WORKTREE, "rev-parse", "HEAD") == commit, "Frontend result worktree HEAD drift", failures)
        require(git_text(FRONTEND_WORKTREE, "rev-parse", "HEAD^{tree}") == tree, "Frontend result worktree tree drift", failures)
        require(git_text(FRONTEND_WORKTREE, "branch", "--show-current") == FRONTEND_LANE, "Frontend result worktree branch drift", failures)
        require(git(FRONTEND_WORKTREE, "status", "--porcelain=v2", "--untracked-files=all").stdout == "", "Frontend result worktree is dirty", failures)
        require(git(FRONTEND_WORKTREE, "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching").stdout == "", "Frontend result worktree contains ignored shadow paths", failures)
        require(git_common_dir(FRONTEND_WORKTREE) == CANONICAL_FRONTEND / ".git", "Frontend result git-common-dir drift", failures)
        require(git_text(FRONTEND_WORKTREE, "remote", "get-url", "origin") == FRONTEND_ORIGIN, "Frontend result origin URL drift", failures)
        require(actual_protections(CANONICAL_FRONTEND, FRONTEND_WORKTREE) == {"assumeUnchangedPaths": [], "skipWorktreePaths": [], "sparseCheckoutEnabled": False, "fsmonitorConfigured": False, "diffExternalConfigured": False, "graftFilePresent": False, "replaceRefs": [], "repositoryOrWorktreePathSymlinks": []}, "Frontend result worktree protections drift", failures)
    committed = parse_time(git_text(CANONICAL_FRONTEND, "show", "-s", "--format=%cI", commit), "frontend committedAt", failures) if commit_present else None
    verified = parse_time(targeted.get("verifiedAt"), "frontend targeted verifiedAt", failures)
    reviewed = parse_time(review.get("reviewedAt"), "frontend reviewedAt", failures)
    pushed = parse_time(review.get("lanePushObservedAt"), "frontend lanePushObservedAt", failures)
    recorded = parse_time(review.get("recordedAt"), "frontend review recordedAt", failures)
    consumed_at = parse_time(consumed_receipt.get("consumedAt"), "frontend consumedAt", failures)
    execution_deadline = parse_time(consumed_receipt.get("executionDeadline"), "frontend executionDeadline", failures)
    if all(item is not None for item in (consumed_at, committed, execution_deadline)):
        require(consumed_at <= committed <= execution_deadline, "frontend lane commit is outside the consumed token execution window", failures)
    if all(item is not None for item in (committed, verified, reviewed, pushed, recorded)):
        require(committed <= verified <= reviewed <= pushed <= recorded, "frontend receipt causal order drift", failures)


def validate_phase(phase: str) -> tuple[list[str], tuple[str, str] | None]:
    failures: list[str] = []
    required_files = [
        AUTHORITY_PATH,
        BACKEND_TOKEN_PATH,
        FRONTEND_TOKEN_PATH,
        REVIEW_PATH,
        CONSUMER_PATH,
        VALIDATOR_PATH,
    ]
    for path in required_files:
        require(path.is_file(), f"authority artifact missing: {path}", failures)
    validate_static_artifact_pins(failures)
    authority: dict[str, Any] = {}
    try:
        authority = load(AUTHORITY_PATH)
        backend_token = load(BACKEND_TOKEN_PATH)
        frontend_token = load(FRONTEND_TOKEN_PATH)
        successor = load(SUCCESSOR_PATH)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        failures.append(f"authority artifact cannot be loaded: {exc}")
    else:
        validate_authority(authority, successor, failures)
        validate_token(backend_token, "backend", authority, failures)
        validate_token(frontend_token, "frontend", authority, failures)
    validate_review(failures)
    validate_static_repositories(failures)
    carrier = carrier_commit(failures)
    frontend_base_commit = carrier[0] if carrier else "UNRESOLVED"
    frontend_base_tree = carrier[1] if carrier else "UNRESOLVED"
    if phase in {"backend-ready", "backend-consumed"}:
        validate_clean_receipt(
            BACKEND_RECEIPT,
            BACKEND,
            BACKEND_WORKTREE,
            BACKEND_LANE,
            BACKEND_BASE,
            BACKEND_TREE,
            "PER009_CENTRAL_BACKEND_V63_V273",
            carrier,
            failures,
        )
        require(not FRONTEND_RECEIPT.exists(), "Frontend clean receipt exists before reviewed Backend lane", failures)
        require(not FRONTEND_WORKTREE.exists(), "Frontend worktree exists before reviewed Backend lane", failures)
        require(
            git(CANONICAL_FRONTEND, "rev-parse", "--verify", f"refs/heads/{FRONTEND_LANE}", check=False).returncode != 0,
            "Frontend lane branch exists before reviewed Backend lane",
            failures,
        )
        require(
            git(CANONICAL_FRONTEND, "rev-parse", "--verify", f"refs/remotes/origin/{FRONTEND_LANE}", check=False).returncode != 0,
            "Frontend remote-tracking lane exists before reviewed Backend lane",
            failures,
        )
        frontend_remote_lane = remote_git("ls-remote", "--heads", FRONTEND_ORIGIN, f"refs/heads/{FRONTEND_LANE}")
        require(
            frontend_remote_lane.returncode == 0 and frontend_remote_lane.stdout == "",
            "Frontend authoritative remote lane exists before reviewed Backend lane",
            failures,
        )
        require(not FRONTEND_CONSUMPTION.exists(), "Frontend token consumed before reviewed Backend lane", failures)
        if phase == "backend-ready":
            require(not BACKEND_CONSUMPTION.exists(), "backend token already consumed", failures)
        else:
            validate_consumption_receipt("backend", carrier, authority, failures, True)
    elif phase == "backend-pushed":
        validate_backend_dependency(carrier, authority, failures)
        validate_consumption_receipt("backend", carrier, authority, failures, False)
        require(not FRONTEND_RECEIPT.exists(), "Frontend clean receipt exists before Frontend materialization authority", failures)
        require(not FRONTEND_WORKTREE.exists(), "Frontend worktree exists before Frontend materialization authority", failures)
        require(not FRONTEND_CONSUMPTION.exists(), "Frontend token consumed before Frontend materialization authority", failures)
        require(git(CANONICAL_FRONTEND, "rev-parse", "--verify", f"refs/heads/{FRONTEND_LANE}", check=False).returncode != 0, "Frontend lane branch exists before Frontend materialization authority", failures)
        frontend_remote_lane = remote_git("ls-remote", "--heads", FRONTEND_ORIGIN, f"refs/heads/{FRONTEND_LANE}")
        require(frontend_remote_lane.returncode == 0 and frontend_remote_lane.stdout == "", "Frontend remote lane exists before Frontend materialization authority", failures)
    elif phase in {"frontend-ready", "frontend-consumed", "frontend-pushed"}:
        backend_dependency = validate_backend_dependency(carrier, authority, failures)
        validate_consumption_receipt("backend", carrier, authority, failures, False)
        if phase in {"frontend-ready", "frontend-consumed"}:
            validate_clean_receipt(
                FRONTEND_RECEIPT,
                CANONICAL_FRONTEND,
                FRONTEND_WORKTREE,
                FRONTEND_LANE,
                frontend_base_commit,
                frontend_base_tree,
                "PER009_CENTRAL_FRONTEND_V62_V63_MIRROR",
                carrier,
                failures,
            )
        if phase == "frontend-ready":
            require(not FRONTEND_CONSUMPTION.exists(), "frontend token already consumed", failures)
        else:
            validate_consumption_receipt(
                "frontend",
                carrier,
                authority,
                failures,
                phase == "frontend-consumed",
                backend_dependency,
            )
        if phase == "frontend-pushed":
            try:
                validate_frontend_lane_result(carrier, authority, backend_dependency, failures)
            except (AttributeError, IndexError, KeyError, TypeError, ValueError, subprocess.CalledProcessError) as exc:
                failures.append(f"Frontend mirror result validation failed closed: {exc}")
    else:
        failures.append(f"unsupported validation phase: {phase}")
    return failures, carrier


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--phase",
        choices=("backend-ready", "backend-consumed", "backend-pushed", "frontend-ready", "frontend-consumed", "frontend-pushed"),
        default="backend-ready",
    )
    args = parser.parse_args()
    failures, carrier = validate_phase(args.phase)

    payload = {
        "status": "PASS" if not failures else "FAIL",
        "sliceId": "BASE-TFR-PER-009",
        "authority": AUTHORITY_REL,
        "phase": args.phase,
        "carrierCommit": carrier[0] if carrier else None,
        "backendCleanReceipt": str(BACKEND_RECEIPT),
        "frontendCleanReceipt": str(FRONTEND_RECEIPT),
        "backendTokenConsumed": BACKEND_CONSUMPTION.exists(),
        "frontendTokenConsumed": FRONTEND_CONSUMPTION.exists(),
        "failureCount": len(failures),
        "failures": failures,
        "sourceAuthored": False,
        "businessCompletionCredit": 0,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
