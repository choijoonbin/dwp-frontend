#!/usr/bin/env python3
"""Validate the append-only PER-009 R2 authorization-carrier correction."""

from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
from typing import Any


FRONTEND = pathlib.Path(__file__).resolve().parents[5]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
AGENT = WORKSPACE / "dwp_agent"
R1_DIR = FRONTEND / "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r1"
R2_DIR = pathlib.Path(__file__).resolve().parent
CORRECTION_PATH = R2_DIR / "per-009-authorization-carrier-correction.v2.json"
REVIEW_PATH = R2_DIR / "independent-review.v2.json"
VALIDATOR_PATH = pathlib.Path(__file__).resolve()
R1_VALIDATOR_PATH = R1_DIR / "validate_per009_authorization_successor.py"

SEMANTIC_PREDECESSOR = {
    "commit": "f5eaa06792a4949993f6cb8bd36474ceaf1d1830",
    "tree": "7ebe8f711396b5b1189dc079e2bffc75e23b2494",
}
SEALED_R1 = {
    "repository": "dwp-frontend",
    "branch": "dwp-dev",
    "commit": "8ffb5f0d4ed420807e7ce0200ed61b518f49f903",
    "tree": "86d958a7f8eeb869e4d5a53f68e1e21218d63833",
    "originMatchedAtSeal": True,
    "artifacts": [
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
            "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-per009-authorization-successor-r1/validate_per009_authorization_successor.py",
            "bytes": 79272,
            "sha256": "a1ef769efe8398446883a9cd0623fdf4f048f44f19b41f8416676839045180bc",
        },
    ],
}

R2_RELATIVE_PATHS = {
    path.relative_to(FRONTEND).as_posix()
    for path in (CORRECTION_PATH, REVIEW_PATH, VALIDATOR_PATH)
}
R1_RELATIVE_PATHS = {artifact["path"] for artifact in SEALED_R1["artifacts"]}
ALL_CARRIER_PATHS = R1_RELATIVE_PATHS | R2_RELATIVE_PATHS

EXPECTED_BASELINES = {
    "frontendSemanticPredecessor": {
        "repository": "dwp-frontend",
        "branch": "dwp-dev",
        **SEMANTIC_PREDECESSOR,
    },
    "backend": {
        "repository": "dwp-backend",
        "branch": "dwp-dev",
        "commit": "699ef730f21a89200be6dfed6d2e34148014cd10",
        "tree": "3ea7866294cfd3bcb2ee950ff8b882f56f6f1317",
    },
    "agent": {
        "repository": "dwp_agent",
        "branch": "dwp-dev",
        "commit": "9beb5439cad065e7d919a98c9f9becb44481508a",
        "tree": "fe3880719360f4bdeff88bbbac1edc6f8affed88",
    },
}

EXPECTED_CLOSURE = {
    "branch": "dwp-dev",
    "sealedR1MustRemainAncestor": True,
    "localAndOriginMustMatch": True,
    "r1ArtifactsMustRemainByteExact": True,
    "r1ToCurrentChangedPaths": sorted(R2_RELATIVE_PATHS),
    "semanticPredecessorToCurrentChangedPaths": sorted(ALL_CARRIER_PATHS),
    "allSixCarrierWorktreeFilesMustEqualLocalAndOriginBlobs": True,
    "validationWorktreeHeadMustEqualDwpDev": True,
    "validationWorktreeBranchNameRequired": False,
    "stagedCarrierDifferenceAllowed": False,
    "unstagedCarrierDifferenceAllowed": False,
    "unrelatedFrontendWorktreeDifferenceAllowed": False,
    "backendAndAgentExactHeadsPreserved": True,
}

EXPECTED_CORRECTION_AUTHORITY = {
    "independentReviewComplete": False,
    "correctionCarrierCommitAndPushAuthorized": False,
    "separateCentralAuthorityPreparationEligibleAfterCarrierPush": False,
    "boundedCentralImplementationAuthorized": False,
    "centralBackendWorktreeAuthorized": False,
    "centralFrontendWorktreeAuthorized": False,
    "centralExecutableTokenAuthorized": False,
    "backendSourceAuthoringAuthorized": False,
    "frontendMirrorSourceAuthoringAuthorized": False,
    "authV273SqlAuthoringAuthorized": False,
    "moduleOwnerPacketAuthorized": False,
    "moduleSourceAuthoringAuthorized": False,
    "moduleWorktreeAuthorized": False,
    "moduleStartTokenAuthorized": False,
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
    **EXPECTED_CORRECTION_AUTHORITY,
    "independentReviewComplete": True,
    "correctionCarrierCommitAndPushAuthorized": True,
    "separateCentralAuthorityPreparationEligibleAfterCarrierPush": True,
}

CORRECTION_NEXT_ACTION = (
    "Independently review this exact R2 correction, commit and push only its three files on Frontend dwp-dev, "
    "require a post-push PASS, then prepare a separate clean Backend and Frontend central execution authority and "
    "one-shot tokens for the allowlisted v63, V273 and unmounted mirror implementation."
)
REVIEW_NEXT_ACTION = (
    "After this exact R2 correction is committed and pushed on Frontend dwp-dev and its validator passes, prepare "
    "and independently review a separate clean Backend and Frontend central execution authority and one-shot tokens "
    "for the allowlisted v63, V273 and unmounted mirror implementation."
)


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def load(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: pathlib.Path) -> tuple[int, str]:
    payload = path.read_bytes()
    return len(payload), hashlib.sha256(payload).hexdigest()


def git(repo: pathlib.Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=check,
        capture_output=True,
        text=True,
    )


def exact_pin(path: pathlib.Path) -> dict[str, Any]:
    size, sha256 = digest(path)
    return {
        "repository": "dwp-frontend",
        "path": path.relative_to(FRONTEND).as_posix(),
        "bytes": size,
        "sha256": sha256,
    }


def validate_correction(correction: dict[str, Any], failures: list[str]) -> None:
    require(correction.get("schema") == "dwp.hris.authorization-carrier-correction.v2", "correction schema drift", failures)
    require(
        correction.get("correctionId") == "R7-B06-PER009-AUTHORIZATION-CARRIER-CORRECTION-R2",
        "correction id drift",
        failures,
    )
    require(correction.get("sliceId") == "BASE-TFR-PER-009", "correction slice drift", failures)
    require(correction.get("module") == "PER", "correction module drift", failures)
    require(correction.get("moduleSession") == "HRIS-PER", "correction module session drift", failures)
    require(
        correction.get("state")
        == "SEALED_APPEND_ONLY_R1_VALIDATION_LIFECYCLE_CORRECTION_INDEPENDENT_REVIEW_REQUIRED_SOURCE_WITHHELD",
        "correction state drift",
        failures,
    )
    require(correction.get("sealedR1Predecessor") == SEALED_R1, "sealed R1 predecessor pin drift", failures)
    require(correction.get("repositoryBaselines") == EXPECTED_BASELINES, "repository baseline closed set drift", failures)
    require(correction.get("carrierClosure") == EXPECTED_CLOSURE, "carrier closure closed set drift", failures)
    require(
        correction.get("semanticPreservation")
        == {
            "runR1SemanticValidatorWithLifecycleBaselineAdapter": True,
            "adapterMayChangeR1Files": False,
            "adapterMayChangeR1ExpectedSemanticPins": False,
            "adapterScope": "Replace only the obsolete exact-current-Frontend-head assertion with immutable semantic-predecessor ancestry while retaining exact Backend and Agent heads; all R1 transport, authorization, migration, allowlist, lineage, ownership, review-pin and source-withheld checks still execute.",
            "expectedR1SemanticResult": "PASS",
        },
        "R1 semantic preservation contract drift",
        failures,
    )
    require(
        correction.get("validationAdmission")
        == {
            "preCommitExpectedState": "FAIL_UNTIL_R2_IS_COMMITTED_AND_A_CLEAN_EXACT_HEAD_VALIDATION_WORKTREE_IS_USED",
            "postPushRequiredState": "PASS_ZERO_FAILURES",
            "postPushValidationWorktree": "CLEAN_HEAD_EQUAL_TO_LOCAL_AND_ORIGIN_DWP_DEV_MAY_BE_DETACHED",
            "fullSuiteRequired": False,
            "sourceTestsRequired": False,
            "reason": "This append-only correction changes documentation and admission validation only; product authorization v63, Auth V273 and all runtime source remain unauthorized and absent.",
        },
        "validation admission contract drift",
        failures,
    )
    findings = correction.get("resolvedFindings", [])
    require(
        [(item.get("id"), item.get("priorSeverity"), item.get("state")) for item in findings]
        == [
            ("PER009-AUTH-009", "P1", "RESOLVED_BY_APPEND_ONLY_R2"),
            ("PER009-AUTH-010", "P1", "RESOLVED_BY_APPEND_ONLY_R2"),
            ("PER009-AUTH-011", "P1", "RESOLVED_BY_APPEND_ONLY_R2"),
            ("PER009-AUTH-012", "P1", "RESOLVED_BY_APPEND_ONLY_R2"),
            ("PER009-AUTH-013", "P1", "RESOLVED_BY_APPEND_ONLY_R2"),
        ],
        "correction finding identity or disposition drift",
        failures,
    )
    require(correction.get("authority") == EXPECTED_CORRECTION_AUTHORITY, "correction authority closed set drift", failures)
    require(correction.get("nextAction") == CORRECTION_NEXT_ACTION, "correction next action drift", failures)
    require(correction.get("immutability", {}).get("sealed") is True, "correction is not sealed", failures)
    require(
        correction.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "correction amendment policy drift",
        failures,
    )


def validate_review(failures: list[str]) -> None:
    require(REVIEW_PATH.is_file(), "R2 independent review is missing", failures)
    if not REVIEW_PATH.is_file():
        return
    try:
        review = load(REVIEW_PATH)
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(f"R2 independent review cannot be loaded: {exc}")
        return
    require(review.get("schema") == "dwp.hris.independent-review.v2", "R2 review schema drift", failures)
    require(
        review.get("reviewId") == "R7-B06-PER009-AUTHORIZATION-CARRIER-CORRECTION-INDEPENDENT-REVIEW-R2",
        "R2 review id drift",
        failures,
    )
    require(review.get("sliceId") == "BASE-TFR-PER-009", "R2 review slice drift", failures)
    require(review.get("module") == "PER", "R2 review module drift", failures)
    require(review.get("moduleSession") == "HRIS-PER", "R2 review module session drift", failures)
    require(
        review.get("state")
        == "INDEPENDENTLY_REVIEWED_PASS_ZERO_P0_ZERO_P1_ZERO_P2_APPEND_ONLY_R2_CARRIER_COMMIT_AND_PUSH_AUTHORIZED_CENTRAL_SOURCE_STILL_WITHHELD",
        "R2 review state drift",
        failures,
    )
    expected_pins = [exact_pin(CORRECTION_PATH), exact_pin(VALIDATOR_PATH)]
    require(review.get("reviewedArtifacts") == expected_pins, "R2 review artifact pin set drift", failures)
    require(
        [(item.get("reviewer"), item.get("disposition")) for item in review.get("independentReviewers", [])]
        == [
            ("per009_auth_delta_review", "PASS_ZERO_P0_P1_P2"),
            ("per009_auth_precedent", "PASS_ZERO_P0_P1_P2"),
            ("per009_auth_generation_audit", "PASS_ZERO_P0_P1_P2"),
        ],
        "R2 reviewer set or disposition drift",
        failures,
    )
    require(
        review.get("resolvedFindingIds")
        == [
            "PER009-AUTH-009",
            "PER009-AUTH-010",
            "PER009-AUTH-011",
            "PER009-AUTH-012",
            "PER009-AUTH-013",
        ],
        "R2 resolved finding set drift",
        failures,
    )
    require(review.get("postResolutionSeverityCounts") == {"P0": 0, "P1": 0, "P2": 0}, "R2 review is not zero severity", failures)
    require(review.get("authority") == EXPECTED_REVIEW_AUTHORITY, "R2 review authority closed set drift", failures)
    require(review.get("nextAction") == REVIEW_NEXT_ACTION, "R2 review next action drift", failures)
    require(review.get("immutability", {}).get("sealed") is True, "R2 review is not sealed", failures)
    require(
        review.get("immutability", {}).get("amendmentPolicy")
        == "APPEND_ONLY_SUCCESSOR_WITH_NEW_ID_AND_SHA256",
        "R2 review amendment policy drift",
        failures,
    )


def validate_r1_bytes(failures: list[str]) -> None:
    for artifact in SEALED_R1["artifacts"]:
        path = FRONTEND / artifact["path"]
        require(path.is_file(), f"sealed R1 artifact missing: {artifact['path']}", failures)
        if path.is_file():
            size, sha256 = digest(path)
            require(size == artifact["bytes"], f"sealed R1 byte drift: {artifact['path']}", failures)
            require(sha256 == artifact["sha256"], f"sealed R1 SHA-256 drift: {artifact['path']}", failures)


def validate_repository_closure(failures: list[str]) -> None:
    try:
        head = git(FRONTEND, "rev-parse", "HEAD").stdout.strip()
        local = git(FRONTEND, "rev-parse", "dwp-dev").stdout.strip()
        origin = git(FRONTEND, "rev-parse", "origin/dwp-dev").stdout.strip()
        r1_tree = git(FRONTEND, "rev-parse", f"{SEALED_R1['commit']}^{{tree}}").stdout.strip()
        semantic_tree = git(FRONTEND, "rev-parse", f"{SEMANTIC_PREDECESSOR['commit']}^{{tree}}").stdout.strip()
    except subprocess.CalledProcessError as exc:
        failures.append(f"Frontend git closure cannot be resolved: {exc.stderr.strip()}")
        return
    require(head == local, "Frontend validation worktree HEAD is not current local dwp-dev", failures)
    require(local == origin, "Frontend dwp-dev is not synchronized with origin/dwp-dev", failures)
    require(r1_tree == SEALED_R1["tree"], "sealed R1 commit tree drift", failures)
    require(semantic_tree == SEMANTIC_PREDECESSOR["tree"], "semantic predecessor tree drift", failures)

    for ref_name in ("dwp-dev", "origin/dwp-dev"):
        r1_ancestor = git(FRONTEND, "merge-base", "--is-ancestor", SEALED_R1["commit"], ref_name, check=False)
        semantic_ancestor = git(FRONTEND, "merge-base", "--is-ancestor", SEMANTIC_PREDECESSOR["commit"], ref_name, check=False)
        require(r1_ancestor.returncode == 0, f"sealed R1 is not an ancestor of {ref_name}", failures)
        require(semantic_ancestor.returncode == 0, f"semantic predecessor is not an ancestor of {ref_name}", failures)

        r1_delta = {
            line
            for line in git(FRONTEND, "diff", "--name-only", f"{SEALED_R1['commit']}..{ref_name}", "--").stdout.splitlines()
            if line
        }
        cumulative_delta = {
            line
            for line in git(FRONTEND, "diff", "--name-only", f"{SEMANTIC_PREDECESSOR['commit']}..{ref_name}", "--").stdout.splitlines()
            if line
        }
        require(r1_delta == R2_RELATIVE_PATHS, f"R1-to-current changed-path closure drift at {ref_name}", failures)
        require(cumulative_delta == ALL_CARRIER_PATHS, f"cumulative carrier changed-path closure drift at {ref_name}", failures)

        for relative in sorted(ALL_CARRIER_PATHS):
            blob = subprocess.run(
                ["git", "-C", str(FRONTEND), "show", f"{ref_name}:{relative}"],
                check=False,
                capture_output=True,
            )
            require(blob.returncode == 0, f"carrier blob missing at {ref_name}:{relative}", failures)
            path = FRONTEND / relative
            if blob.returncode == 0 and path.is_file():
                require(
                    path.read_bytes() == blob.stdout,
                    f"carrier worktree blob differs from {ref_name}:{relative}",
                    failures,
                )

    for staged in (False, True):
        arguments = ["diff", "--quiet"]
        if staged:
            arguments.append("--cached")
        arguments.extend(["--", *sorted(ALL_CARRIER_PATHS)])
        clean = git(FRONTEND, *arguments, check=False)
        require(clean.returncode == 0, f"carrier has {'staged' if staged else 'unstaged'} differences", failures)

    status = git(FRONTEND, "status", "--porcelain", "--untracked-files=all").stdout
    require(status == "", "Frontend worktree is not clean", failures)

    for name, repo, expected in (
        ("Backend", BACKEND, EXPECTED_BASELINES["backend"]),
        ("Agent", AGENT, EXPECTED_BASELINES["agent"]),
    ):
        try:
            repo_branch = git(repo, "branch", "--show-current").stdout.strip()
            repo_local = git(repo, "rev-parse", "dwp-dev").stdout.strip()
            repo_origin = git(repo, "rev-parse", "origin/dwp-dev").stdout.strip()
            repo_tree = git(repo, "rev-parse", f"{expected['commit']}^{{tree}}").stdout.strip()
        except subprocess.CalledProcessError as exc:
            failures.append(f"{name} baseline cannot be resolved: {exc.stderr.strip()}")
            continue
        require(repo_branch == "dwp-dev", f"{name} worktree is not on dwp-dev", failures)
        require(repo_local == expected["commit"], f"{name} local dwp-dev drift", failures)
        require(repo_origin == expected["commit"], f"{name} origin/dwp-dev drift", failures)
        require(repo_tree == expected["tree"], f"{name} baseline tree drift", failures)


def validate_r1_semantics_with_lifecycle_adapter(failures: list[str]) -> None:
    spec = importlib.util.spec_from_file_location("per009_r1_validator", R1_VALIDATOR_PATH)
    require(spec is not None and spec.loader is not None, "R1 validator import spec cannot be created", failures)
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    def adapted_baselines(basis: dict[str, Any], nested_failures: list[str]) -> None:
        for key, expected in module.EXPECTED_BASELINES.items():
            actual = basis.get(key)
            module.require(isinstance(actual, dict), f"missing authority baseline: {key}", nested_failures)
            if not isinstance(actual, dict):
                continue
            for field, value in expected.items():
                module.require(actual.get(field) == value, f"{key} {field} drift", nested_failures)
            module.require(actual.get("originMatchedAtAudit") is True, f"{key} origin audit pin missing", nested_failures)
            repo = module.REPOSITORIES[expected["repository"]]
            try:
                tree = module.git(repo, "rev-parse", f"{expected['commit']}^{{tree}}")
                local_commit = module.git(repo, "rev-parse", expected["branch"])
                origin_commit = module.git(repo, "rev-parse", f"origin/{expected['branch']}")
            except subprocess.CalledProcessError as exc:
                nested_failures.append(f"{key} git pin cannot be resolved: {exc.stderr.strip()}")
                continue
            module.require(tree == expected["tree"], f"{key} commit tree drift", nested_failures)
            if key == "frontendBaseline":
                for ref_name in (expected["branch"], f"origin/{expected['branch']}"):
                    ancestor = subprocess.run(
                        ["git", "-C", str(repo), "merge-base", "--is-ancestor", expected["commit"], ref_name],
                        check=False,
                        capture_output=True,
                        text=True,
                    )
                    module.require(
                        ancestor.returncode == 0,
                        f"{key} semantic predecessor is not an ancestor of {ref_name}",
                        nested_failures,
                    )
            else:
                module.require(local_commit == expected["commit"], f"{key} local dwp-dev drift", nested_failures)
                module.require(origin_commit == expected["commit"], f"{key} origin/dwp-dev drift", nested_failures)

    module.validate_baselines = adapted_baselines
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        result = module.main()
    require(result == 0, f"adapted R1 semantic validation failed: {captured.getvalue().strip()}", failures)


def main() -> int:
    failures: list[str] = []
    require(CORRECTION_PATH.is_file(), "R2 correction manifest is missing", failures)
    if CORRECTION_PATH.is_file():
        try:
            correction = load(CORRECTION_PATH)
        except (OSError, json.JSONDecodeError) as exc:
            failures.append(f"R2 correction manifest cannot be loaded: {exc}")
        else:
            validate_correction(correction, failures)

    validate_r1_bytes(failures)
    validate_review(failures)
    validate_repository_closure(failures)
    validate_r1_semantics_with_lifecycle_adapter(failures)

    payload = {
        "status": "PASS" if not failures else "FAIL",
        "sliceId": "BASE-TFR-PER-009",
        "correction": CORRECTION_PATH.relative_to(FRONTEND).as_posix(),
        "review": REVIEW_PATH.relative_to(FRONTEND).as_posix(),
        "sealedR1Commit": SEALED_R1["commit"],
        "failureCount": len(failures),
        "failures": failures,
        "sourceAuthoringAuthorized": False,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
