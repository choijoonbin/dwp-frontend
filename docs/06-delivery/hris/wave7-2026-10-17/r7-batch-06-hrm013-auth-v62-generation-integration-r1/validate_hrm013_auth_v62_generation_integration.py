#!/usr/bin/env python3
"""Fail-closed HRM-013 Auth-v62 central-integration validator.

The validator is read-only.  Authoritative runs use ``/usr/bin/python3 -I``
inside the sealed environment checked below.  It authorizes only the exact
reviewed Auth-v62 generation commit for direct fast-forward integration.  Any
later backend descendant is delegated only after a fixed ninth-validator Auth
V271 carrier and an external hash-bound delegation receipt are both present.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT = Path(__file__).absolute()
HERE = SCRIPT.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
GIT = "/usr/bin/git"

LIFECYCLE_CORRECTION_BASE = "50cf521fd38f09f1a930582562fd15f7c4bc126b"
LIFECYCLE_CORRECTION_BASE_TREE = "830b484b5a3b338e984bbecd4be71236e611a86c"
LIFECYCLE_CORRECTION_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-validator-lifecycle-"
    "correction-frontend-20261027-r1"
)
LIFECYCLE_CORRECTION_ROOT = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-validator-lifecycle-successor-r1"
)
LIFECYCLE_CORRECTION_AUTHORITY = (
    f"{LIFECYCLE_CORRECTION_ROOT}/validator-lifecycle-successor-authority.v1.json"
)
LIFECYCLE_CORRECTION_REVIEW = f"{LIFECYCLE_CORRECTION_ROOT}/independent-review.v1.json"
LIFECYCLE_CORRECTION_VALIDATOR = (
    f"{LIFECYCLE_CORRECTION_ROOT}/validate_hrm013_validator_lifecycle_successor.py"
)
LIFECYCLE_SEVENTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1/"
    "validate_hrm013_auth_v62_generation_authority.py"
)
LIFECYCLE_EIGHTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1/"
    "validate_hrm013_auth_v62_generation_integration.py"
)
LIFECYCLE_NINTH_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v271-authority-r1/"
    "validate_hrm013_auth_v271_authority.py"
)
LIFECYCLE_VALIDATORS = [
    LIFECYCLE_SEVENTH_VALIDATOR,
    LIFECYCLE_EIGHTH_VALIDATOR,
    LIFECYCLE_NINTH_VALIDATOR,
]
LIFECYCLE_CORRECTION_PATHS = {
    *LIFECYCLE_VALIDATORS,
    LIFECYCLE_CORRECTION_AUTHORITY,
    LIFECYCLE_CORRECTION_REVIEW,
    LIFECYCLE_CORRECTION_VALIDATOR,
    "package.json",
}
APPROVAL_INTEGRATION_COMMIT = "2479ef3da2185668ec8dcbe4815cd6ba3caa0986"
APPROVAL_INTEGRATION_TREE = "8e99270400e5c47928d659a7ba4fe0552963445f"
APPROVAL_INTEGRATION_PARENT = "b2fa6d56f16ce5befe0e366ca55d34ef8f42f58e"
HARDENED_AUTH_RUNTIME_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-runtime-authority-r1/"
    "validate_hrm013_auth_runtime_authority.py"
)
APPROVAL_INTEGRATION_PATHS = {
    "package.json",
    HARDENED_AUTH_RUNTIME_VALIDATOR,
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-authority-r1/validate_hrm013_approval_readiness_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-successor-r1/validate_hrm013_approval_readiness_successor.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/validate_hrm013_owner_runtime_phase4_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-clarification-r1/validate_hrm013_approval_drain_clarification.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/approval-runtime-central-integration-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/validate_hrm013_approval_runtime_integration.py",
}

RESEAL_BASE = "6c79565649861f8bd1e9658495edc85155c10744"
RESEAL_BASE_TREE = "aa7049f0429cfba465995e3b46fad7e7caebf64c"
RESEAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-reseal-"
    "integration-frontend-20261027-r2"
)
RESEAL_ROOT = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-reseal-integration-r1"
)
RESEAL_AUTHORITY = f"{RESEAL_ROOT}/approval-reseal-central-integration-authority.v1.json"
RESEAL_REVIEW = f"{RESEAL_ROOT}/independent-review.v1.json"
RESEAL_DIRECT_VALIDATORS = [
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-authority-r1/validate_hrm013_approval_readiness_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-successor-r1/validate_hrm013_approval_readiness_successor.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-integration-r1/validate_hrm013_approval_readiness_integration.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-phase4-authority-r1/validate_hrm013_owner_runtime_phase4_authority.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-drain-clarification-r1/validate_hrm013_approval_drain_clarification.py",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-runtime-integration-r1/validate_hrm013_approval_runtime_integration.py",
]
RESEAL_VALIDATORS = [
    *LIFECYCLE_VALIDATORS,
    *RESEAL_DIRECT_VALIDATORS,
    LIFECYCLE_CORRECTION_VALIDATOR,
]
RESEAL_PATHS = {*RESEAL_VALIDATORS, RESEAL_AUTHORITY, RESEAL_REVIEW}
RESEAL_AUTHORITY_PIN = {
    "path": RESEAL_AUTHORITY, "bytes": 14019,
    "sha256": "e116042f691f96d750b1cff6f129a9e0c5284ae83880e9446c18b20efaa0a5a4",
}
RESEAL_PACKAGE_PIN = {
    "path": "package.json", "bytes": 16620,
    "sha256": "2852cdd0cb616ff419479018e9d30d3602d606a9014fbf64e9a40d6b8d889bb6",
}

PEOPLE_BASE = "91b47dda9a6692e7a6f827cbfc1f6a173cfc641c"
PEOPLE_BASE_TREE = "08c0665e06cc0e94afd368386a923b46acfa7a3c"
PEOPLE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-people-rebase-"
    "integration-frontend-20261027-r1"
)
PEOPLE_ROOT = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-people-rebase-integration-r1"
)
PEOPLE_AUTHORITY = f"{PEOPLE_ROOT}/people-rebase-central-integration-authority.v1.json"
PEOPLE_REVIEW = f"{PEOPLE_ROOT}/independent-review.v1.json"
PEOPLE_VALIDATORS = [*RESEAL_VALIDATORS]
PEOPLE_PATHS = {*PEOPLE_VALIDATORS, PEOPLE_AUTHORITY, PEOPLE_REVIEW}
PEOPLE_AUTHORITY_PIN = {
    "path": PEOPLE_AUTHORITY, "bytes": 16569,
    "sha256": "9238dbafd34bf420ebd66daf5ca76fea8583ee875b36ee59acf3364524919e56",
}
PEOPLE_BACKEND_BASE = "3970b26c111c0492d7a7b637b8153f7a6844318d"
PEOPLE_BACKEND_COMMIT = "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"
PEOPLE_BACKEND_TREE = "f17b244d9d47da035dfe09f7c9a604796f19eb74"
PEOPLE_BACKEND_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-people-owner-runtime-backend-20261027-r2"
)
PEOPLE_GOVERNANCE_PARENT = "dca74e7fabc58651a40b2b9605b38da5adc1b9b8"
PEOPLE_GOVERNANCE_COMMIT = "1b781cd368f1d1433b310606910e3f4e074bdb6c"
PEOPLE_GOVERNANCE_TREE = "a076a61f790faba5102eccf4029a327aa40e12d3"
PEOPLE_GOVERNANCE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-people-governance-frontend-20261027-r1"
)
PEOPLE_GOVERNANCE_AUTHORITY = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{PEOPLE_BACKEND_COMMIT}/authority.v1.json"
)
PEOPLE_GOVERNANCE_REVIEW = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{PEOPLE_BACKEND_COMMIT}/independent-review.v1.json"
)



PARENT = "fcfd8603fa681cc6c2fe45f6157db427e6e43e67"
PARENT_TREE = "9822126196e7d5c9643ea1d2f82555e9b9cd1c01"
GENERATION_CARRIER = "d80e886121886792c33150b0ff97f128f0da9e14"
GENERATION_CARRIER_TREE = "f1881031cbb6052913560d8eed9ad26168eebe41"
GOVERNANCE_CARRIER = "0da394dc1adbd2559e964d16adb557150ca8e70e"
GOVERNANCE_CARRIER_TREE = "9bf4c8363abdda539fe63e8e3683bfdc1fd6ce7d"
BACKEND_BASE = "3505cb2e84fc73f97d62de385cc347c5f8c81572"
BACKEND_BASE_TREE = "fa84a79668fd0f133d34c81d5a649747a6c527b6"
GENERATION_COMMIT = "d7a6ed8ae9ae2d91fd68c8d0a31a882e4da101f5"
GENERATION_TREE = "fdf087a186c3084fbca6fcad2c32b119d8865675"
GENERATION_BRANCH = "codex/hris-wave7-batch06-hrm013-auth-v62-generation-backend-20261026-r1"

ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-integration-r1"
)
AUTHORITY_REL = f"{ROOT_REL}/auth-v62-generation-central-integration-authority.v1.json"
REVIEW_REL = f"{ROOT_REL}/independent-review.v1.json"
VALIDATOR_REL = f"{ROOT_REL}/validate_hrm013_auth_v62_generation_integration.py"
CARRIER_PATHS = {"package.json", AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL}
AUTHORITY_BYTES = 7811
AUTHORITY_SHA256 = "f823a5b7e256a0e29832ea423c6423db645aa09da11eb15119888db4e44f486b"

SEVENTH_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1/"
    "validate_hrm013_auth_v62_generation_authority.py"
)
SIXTH_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py"
)
GENERATION_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v62-generation-r1"
)
GENERATION_AUTHORITY_REL = f"{GENERATION_ROOT_REL}/auth-v62-generation-execution-authority.v1.json"
GENERATION_TOKEN_REL = f"{GENERATION_ROOT_REL}/auth-v62-generation.start-token.v1.json"
GENERATION_REVIEW_REL = f"{GENERATION_ROOT_REL}/independent-review.v1.json"

PREDECESSOR_SCRIPT = (
    "python3 docs/06-delivery/hris/tools/validate_current_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "validate_hrm013_owner_runtime_binding_gate.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "validate_hrm013_runtime_contract_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-shared-contract-integration-r1/"
    "validate_hrm013_shared_contract_integration.py && "
    "python3 " + SEVENTH_REL
)
CURRENT_SCRIPT = PREDECESSOR_SCRIPT + " && python3 " + VALIDATOR_REL

RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)
TARGETED_RECEIPT = RECEIPTS / "auth-v62-generation-targeted-verification-receipt.v1.json"
POST_RECEIPT = RECEIPTS / "auth-v62-generation-post-implementation-review.v1.json"
GOVERNANCE_RECEIPT = (
    RECEIPTS / "backend-descendants" /
    f"{GENERATION_COMMIT}.hrm013-shared-contract-governance.v1.json"
)
CENTRAL_RECEIPT = RECEIPTS / "auth-v62-generation-central-integration-authority.v1.json"
TARGETED_BYTES = 14050
TARGETED_SHA256 = "5802fc25096c2ab3094132c8ca9015ebfa7d0a264b79cc6ad3d552563d37d7f1"
POST_BYTES = 4188
POST_SHA256 = "d73f12ad188ce64ca0f7e148c7619e9c7b606275733a2cdd5660aebb29c401eb"
GOVERNANCE_BYTES = 7576
GOVERNANCE_SHA256 = "58076558a9437ac1f5ba3cebae3559a37e69a05ced59e8ed7c56ad3b143e903d"

# This fixed successor does not grant V271.  It defines the only evidence by
# which this immutable eighth validator may delegate later backend descendants
# to a separately reviewed ninth validator.
V271_ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-v271-authority-r1"
)
V271_AUTHORITY_REL = f"{V271_ROOT_REL}/auth-v271-execution-authority.v1.json"
V271_REVIEW_REL = f"{V271_ROOT_REL}/independent-review.v1.json"
V271_VALIDATOR_REL = f"{V271_ROOT_REL}/validate_hrm013_auth_v271_authority.py"
V271_CARRIER_PATHS = {"package.json", V271_AUTHORITY_REL, V271_REVIEW_REL, V271_VALIDATOR_REL}
V271_DELEGATION_RECEIPT = RECEIPTS / "auth-v271-successor-delegation-authority.v1.json"
V271_BACKEND_BRANCH = "codex/hris-wave7-batch06-hrm013-auth-v271-backend-20261027-r1"
V271_MIGRATION_REL = (
    "dwp-auth-server/src/main/resources/db/migration/"
    "V271__create_hris_service_grant_authority.sql"
)
V271_AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "authV271ReservationAuthorized": True,
    "authV271ImplementationAuthorizedAfterSeparateCleanWorktreeReceipt": True,
    "laneCommitAndPushAuthorizedAfterTargetedVerification": True,
    "backendDwpDevIntegrationAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
V271_REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "cleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
    "authV271AuthoringAuthorizedAfterCleanReceipt": True,
    "backendDwpDevIntegrationAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
V271_REVIEW_BOUNDARIES = [
    "EXACT_AUTH_V62_INTEGRATION_CARRIER_AND_RECEIPT_PINS",
    "EXACT_BACKEND_GENERATION_BASE_AND_V271_MIGRATION_PATH",
    "DEDICATED_CLEAN_WORKTREE_AND_TARGETED_VERIFICATION_REQUIRED",
    "NO_DIRECT_BACKEND_DWP_DEV_INTEGRATION",
    "NO_RUNTIME_ACTIVATION_TENANT_OR_PRODUCTION_AUTHORITY",
]

GENERATION_CHANGED_PATHS = [
    "contracts/product-authorization/pilot-fixtures.v1.generated.json",
    "contracts/product-authorization/product-surfaces-v1.bundle-v62.json",
    "contracts/product-authorization/product-surfaces-v1.index.json",
    "contracts/product-authorization/product-surfaces-v1.json",
    "contracts/product-authorization/product-surfaces-v1.yaml",
    "dwp-approval-server/src/main/resources/product-authorization/approval-pilot-pep-v62.generated.json",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationContractValidator.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v62.generated.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.generated.json",
    "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/config/ProductAuthorizationSeedLoaderTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationContractReleaseLineageTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineageTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationV62ContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapter.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/support/PilotAuthorizationFixtureAdapterTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/ProductSurfaceDecisionContextFilterTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/productsurface/GeneratedProductRouteCatalogTest.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapter.java",
    "dwp-gateway/src/test/java/com/dwp/gateway/support/PilotAuthorizationFixtureAdapterTest.java",
    "dwp-payroll-server/src/main/resources/product-authorization/hcm-payroll-pep-v62.generated.json",
    "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v62.generated.json",
    "dwp-platform-server/src/main/resources/product-authorization/hcm-platform-pep-v62.generated.json",
    "dwp-time-server/src/main/resources/product-authorization/hcm-time-pep-v62.generated.json",
    "scripts/generate-product-authorization-contracts.py",
    "scripts/generate-product-authorization-fixtures.py",
    "scripts/tests/test_product_authorization_v61.py",
    "scripts/tests/test_product_authorization_v62.py",
]

GENERATION_ARTIFACT_PINS = [
    {"path": GENERATION_AUTHORITY_REL, "bytes": 28892, "sha256": "5e1fcb96b785746eda572c2af1918340b776fcb4e5d152900f8ea29acabc2350"},
    {"path": GENERATION_TOKEN_REL, "bytes": 6459, "sha256": "c79e902bcc38d20940142685f3403c4ae9c68f8b501807d168d68993a2874fab"},
    {"path": SEVENTH_REL, "bytes": 73707, "sha256": "838aa615dbe5311f7af28eca26b8d480bdd21f6448e9eea6b80a39b506762794"},
    {"path": GENERATION_REVIEW_REL, "bytes": 3592, "sha256": "aa75f5d15a22ebdcfd8c095fa7ff01f1dcf9fc1f1d3082b02b444a2b356e9a5b"},
    {"path": "package.json", "bytes": 14999, "sha256": "64ee851196664cfa8937262a43ae14bb70a5873c294f03868bef34b37bb95794"},
]

GOVERNANCE_AUTHORITY_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-backend-descendant-governance/"
    f"{GENERATION_COMMIT}/authority.v1.json"
)
GOVERNANCE_REVIEW_REL = GOVERNANCE_AUTHORITY_REL.replace("authority.v1.json", "independent-review.v1.json")
GOVERNANCE_ARTIFACT_PINS = [
    {"path": GOVERNANCE_AUTHORITY_REL, "bytes": 7100, "sha256": "05efb27c4321f4d46f024af658628a4435ae50d21f8d1ec0a26075001479a8ea"},
    {"path": GOVERNANCE_REVIEW_REL, "bytes": 2187, "sha256": "3c99753d3ccea06e2f40f00e9c45bb9a5e0dda61df817440545ac5de0a842f9b"},
]

AUTHORITY_MAP = {
    "independentReviewComplete": True,
    "externalCentralIntegrationReceiptRequired": True,
    "exactGenerationCommitDirectFastForwardAuthorizedAfterReceipt": True,
    "differentBackendTargetAuthorized": False,
    "mergeRebaseSquashOrCherryPickAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_AUTHORITY = {
    "independentReviewComplete": True,
    "carrierCommitAndPushAuthorized": True,
    "externalReceiptIssuanceAuthorizedAfterCarrierPush": True,
    "exactGenerationCommitDirectFastForwardAuthorizedAfterReceipt": True,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "runtimeImplementationAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}
REVIEW_BOUNDARIES = [
    "GENERATION_AUTHORITY_CARRIER_AND_FIVE_ARTIFACT_PINS",
    "EXACT_GENERATION_LANE_COMMIT_TREE_PATHS_AND_RECEIPTS",
    "DESCENDANT_GOVERNANCE_CARRIER_ARTIFACT_AND_RECEIPT_PINS",
    "EXTERNAL_CENTRAL_INTEGRATION_RECEIPT_REQUIRED",
    "DIRECT_FAST_FORWARD_TO_EXACT_GENERATION_COMMIT_ONLY",
    "NO_V271_MIGRATION_RUNTIME_ACTIVATION_OR_PRODUCTION_AUTHORITY",
]

SAFE_GIT_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}
TRUSTED_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "CPATH": "/usr/local/include", "LIBRARY_PATH": "/usr/local/lib",
    "MANPATH": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/share/man:/Library/Developer/CommandLineTools/usr/share/man:/Library/Developer/CommandLineTools/Toolchains/XcodeDefault.xctoolchain/usr/share/man:",
    "SDKROOT": "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk",
    "__CF_USER_TEXT_ENCODING": "0x1F7:0x3:0x33",
}
TRUSTED_PYTHONS = {
    Path("/usr/bin/python3").resolve(),
    Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
}
UNSAFE_ENV = {
    "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR", "GIT_CEILING_DIRECTORIES",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_CONFIG", "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_EXEC_PATH",
    "GIT_ATTR_NOSYSTEM", "GIT_OPTIONAL_LOCKS", "GIT_EXTERNAL_DIFF",
}
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()


class VerificationError(RuntimeError):
    pass


class V:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            raise VerificationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.require(strict_equal(actual, expected), message)


def strict_equal(actual: Any, expected: Any) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return set(actual) == set(expected) and all(
            type(key) is str and strict_equal(actual[key], expected[key]) for key in expected
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            strict_equal(left, right) for left, right in zip(actual, expected)
        )
    return actual == expected


def duplicate_guard(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise VerificationError(f"duplicate JSON key: {key}")
        value[key] = item
    return value


def reject_nonfinite(value: str) -> Any:
    raise VerificationError(f"non-finite JSON value: {value}")


def load_json(data: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            data.decode("utf-8"), object_pairs_hook=duplicate_guard,
            parse_constant=reject_nonfinite,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid JSON {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root is not an object: {label}")
    return value


def closed(v: V, value: Any, keys: set[str], label: str) -> None:
    v.require(isinstance(value, dict), f"{label} must be an object")
    if isinstance(value, dict):
        v.exact(set(value), keys, f"{label} key set drift")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def artifact(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def parse_time(value: Any, label: str) -> datetime:
    pattern = r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|[+-][0-9]{2}:[0-9]{2})"
    if type(value) is not str or re.fullmatch(pattern, value) is None:
        raise VerificationError(f"{label} is not whole-second RFC3339")
    try:
        result = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError as exc:
        raise VerificationError(f"invalid {label}") from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise VerificationError(f"{label} lacks timezone")
    return result.astimezone(timezone.utc)


def causal(v: V, events: list[tuple[str, datetime]]) -> None:
    for (left_name, left), (right_name, right) in zip(events, events[1:]):
        v.require(left <= right, f"{left_name} follows {right_name}")
    for name, value in events:
        v.require(value <= datetime.now(timezone.utc) + timedelta(minutes=5), f"future {name}")


def canonical(path: Any) -> bool:
    if type(path) is not str or not path:
        return False
    parsed = PurePosixPath(path)
    return not parsed.is_absolute() and parsed.as_posix() == path and all(
        part not in {"", ".", ".."} for part in parsed.parts
    )


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        [GIT, *args], cwd=repo, env=SAFE_GIT_ENV, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False, shell=False,
    )
    if check and result.returncode:
        raise VerificationError(
            f"git {' '.join(args)} failed: "
            f"{result.stderr.decode('utf-8', errors='replace').strip()}"
        )
    return result


def text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def blob(repo: Path, revision: str, path: str) -> bytes | None:
    result = git(repo, "show", f"{revision}:{path}", check=False)
    return result.stdout if result.returncode == 0 else None


def mode(repo: Path, revision: str, path: str) -> str | None:
    output = text(repo, "ls-tree", revision, "--", path)
    fields = output.split(None, 3) if output else []
    return fields[0] if len(fields) == 4 and fields[3] == path else None


def nul(data: bytes) -> set[str]:
    return {item.decode("utf-8", errors="strict") for item in data.split(b"\0") if item}


def changes(repo: Path) -> set[str]:
    return (
        nul(git(repo, "diff", "--name-only", "-z", "HEAD", "--").stdout)
        | nul(git(repo, "diff", "--cached", "--name-only", "-z", "HEAD", "--").stdout)
        | nul(git(repo, "ls-files", "--others", "--exclude-standard", "-z").stdout)
    )


def between(repo: Path, older: str, newer: str) -> set[str]:
    return nul(git(repo, "diff", "--name-only", "-z", f"{older}..{newer}", "--").stdout)


def ancestor(repo: Path, older: str, newer: str) -> bool:
    return git(repo, "merge-base", "--is-ancestor", older, newer, check=False).returncode == 0


def git_artifact(repo: Path, revision: str, path: str) -> dict[str, Any]:
    data = blob(repo, revision, path)
    if data is None:
        raise VerificationError(f"missing Git blob {revision}:{path}")
    return artifact(path, data)


def present(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def symlink_free(root: Path, relative: str) -> bool:
    if not canonical(relative):
        return False
    root = root.absolute()
    if root != root.resolve() or root.is_symlink():
        return False
    current = root
    for part in PurePosixPath(relative).parts:
        current /= part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return False
        except FileNotFoundError:
            return False
    try:
        current.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def open_directory(path: Path) -> int:
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path.absolute().anchor, flags)
    try:
        for part in path.absolute().parts[1:]:
            child = os.open(part, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
    except Exception:
        os.close(descriptor)
        raise
    return descriptor


def read_receipt(path: Path, label: str) -> bytes:
    parent = open_directory(path.parent)
    descriptor = -1
    try:
        descriptor = os.open(path.name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent)
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode) or stat.S_IMODE(before.st_mode) != 0o600
            or before.st_uid != os.geteuid() or before.st_nlink != 1 or before.st_size > 65536
        ):
            raise VerificationError(f"unsafe {label} file metadata")
        with os.fdopen(descriptor, "rb", closefd=True) as stream:
            descriptor = -1
            data = stream.read(65537)
            after = os.fstat(stream.fileno())
        stable = ("st_dev", "st_ino", "st_mode", "st_uid", "st_nlink", "st_size", "st_mtime_ns")
        if len(data) != before.st_size or len(data) > 65536:
            raise VerificationError(f"unstable or oversized {label}")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            raise VerificationError(f"{label} changed while read")
        return data
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        os.close(parent)


def runtime(v: V, required: bool) -> bool:
    inherited = sorted(
        key for key in os.environ
        if key in UNSAFE_ENV or key.startswith("GIT_CONFIG_KEY_") or key.startswith("GIT_CONFIG_VALUE_")
    )
    v.require(not inherited, f"unsafe inherited Git environment: {inherited}")
    isolated = bool(sys.flags.isolated) and Path(sys.executable).resolve() in TRUSTED_PYTHONS
    if required:
        v.require(isolated, "trusted validation requires /usr/bin/python3 -I")
        v.exact(dict(os.environ), TRUSTED_ENV, "trusted env -i allowlist drift")
    return isolated


def hygiene(v: V, repo: Path) -> None:
    v.exact(Path(text(repo, "rev-parse", "--show-toplevel")).resolve(), repo.resolve(), "Git root drift")
    v.require(not text(repo, "for-each-ref", "--format=%(refname)", "refs/replace/"), "replace refs forbidden")
    unsafe = git(
        repo, "config", "--get-regexp",
        r"^(core\.sparseCheckout|core\.sparseCheckoutCone|core\.fsmonitor|diff\.external|diff\..*\.command)$",
        check=False,
    )
    v.require(unsafe.returncode == 1 and not unsafe.stdout, "unsafe Git config")
    tags = [entry[:1] for entry in git(repo, "ls-files", "-v", "-z").stdout.split(b"\0") if entry]
    v.require(not [tag for tag in tags if tag != b"H"], "assume-unchanged or skip-worktree forbidden")


def expected_package(parent: str = PARENT) -> bytes:
    data = blob(FRONTEND, parent, "package.json")
    if data is None:
        raise VerificationError("carrier parent package missing")
    package = load_json(data, "carrier parent package")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != PREDECESSOR_SCRIPT:
        raise VerificationError("carrier parent validator chain drift")
    old = json.dumps(PREDECESSOR_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("carrier package append bytes missing or ambiguous")
    return data.replace(old, new, 1)


def check_package(v: V, data: bytes, *, exact: bool) -> None:
    if exact:
        v.exact(data, expected_package(), "package is not exact eighth-validator append")
    package = load_json(data, "package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "package scripts missing")
    if not isinstance(scripts, dict):
        return
    v.require("prehris:current-contracts:check" not in scripts, "pre-hook forbidden")
    v.require("posthris:current-contracts:check" not in scripts, "post-hook forbidden")
    command = scripts.get("hris:current-contracts:check")
    v.require(isinstance(command, str), "validator chain missing")
    if not isinstance(command, str):
        return
    parts = command.split(" && ")
    sealed = CURRENT_SCRIPT.split(" && ")
    v.require(parts[: len(sealed)] == sealed, "sealed eighth-validator prefix drift")
    pattern = re.compile(r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)")
    matched = [pattern.fullmatch(part) for part in parts]
    v.require(all(matched), "non-validator command in chain")
    paths = [match.group(1) for match in matched if match]
    v.require(len(paths) == len(set(paths)), "duplicate validator command")
    v.exact(paths[6:8], [SEVENTH_REL, VALIDATOR_REL], "seventh/eighth order drift")


def check_current_v271_chain(v: V, carrier_commit: str, carrier_blobs: dict[str, bytes]) -> None:
    head = text(FRONTEND, "rev-parse", "HEAD")
    v.exact(mode(FRONTEND, head, "package.json"), "100644", "unsafe current package mode")
    v.require(symlink_free(FRONTEND, "package.json"), "current package missing or symlinked")
    head_package = blob(FRONTEND, head, "package.json")
    v.require(head_package is not None, "current package missing from frontend HEAD")
    current_package = (FRONTEND / "package.json").read_bytes()
    v.exact(
        artifact("package.json", current_package),
        artifact("package.json", head_package or b""),
        "live package differs from frontend HEAD",
    )
    package = load_json(current_package, "current package with V271 successor")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "current V271 package scripts missing")
    if not isinstance(scripts, dict):
        return
    command = scripts.get("hris:current-contracts:check")
    ninth_script = CURRENT_SCRIPT + " && python3 " + V271_VALIDATOR_REL
    v.require(isinstance(command, str), "current V271 validator chain missing")
    if not isinstance(command, str):
        return
    parts = command.split(" && ")
    sealed = ninth_script.split(" && ")
    v.require(parts[: len(sealed)] == sealed, "current package lost or replaced the fixed ninth validator")
    pattern = re.compile(r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)")
    matched = [pattern.fullmatch(part) for part in parts]
    v.require(all(matched), "non-validator command in current V271 chain")
    paths = [match.group(1) for match in matched if match]
    v.require(len(paths) == len(set(paths)), "duplicate current V271 validator command")
    v.exact(paths[6:9], [SEVENTH_REL, VALIDATOR_REL, V271_VALIDATOR_REL], "seventh/eighth/ninth order drift")
    correction = lifecycle_correction(v)
    for path in (V271_AUTHORITY_REL, V271_REVIEW_REL, V271_VALIDATOR_REL):
        v.exact(mode(FRONTEND, head, path), "100644", f"unsafe current V271 artifact mode: {path}")
        current = blob(FRONTEND, head, path)
        v.require(current is not None, f"current V271 artifact missing: {path}")
        expected_live = (
            correction["currentBlobs"][path]
            if path == V271_VALIDATOR_REL else carrier_blobs[path]
        )
        v.exact(artifact(path, current or b""), artifact(path, expected_live), f"current V271 artifact mutated: {path}")
        v.require(symlink_free(FRONTEND, path), f"current V271 artifact symlinked: {path}")
        v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, expected_live), f"live V271 artifact drift: {path}")
    v.require(ancestor(FRONTEND, carrier_commit, head), "current frontend lost V271 carrier")


def expected_review(blobs: dict[str, bytes]) -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-central-integration-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_V62_GENERATION_CENTRAL_INTEGRATION_REVIEW",
        "scope": {
            "authorityPath": AUTHORITY_REL,
            "validatorPath": VALIDATOR_REL,
            "packagePath": "package.json",
            "reviewedBoundaries": REVIEW_BOUNDARIES,
        },
        "findings": {
            "p0": [], "p1": [], "p2": [],
            "notes": [
                "The carrier authorizes only externally attested direct fast-forward integration of the exact reviewed Auth v62 generation commit.",
                "The generation carrier, both generation receipts and the ordered descendant-governance carrier and receipt are hash-bound.",
                "No V271 reservation, migration, runtime, activation, tenant enrollment, production binding or release is authorized.",
            ],
        },
        "finalVerdict": {
            "p0": 0, "p1": 0, "p2": 0,
            "decision": "GO_FOR_AUTH_V62_GENERATION_CENTRAL_INTEGRATION_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
        },
        "authority": REVIEW_AUTHORITY,
        "artifactPins": [
            artifact(AUTHORITY_REL, blobs[AUTHORITY_REL]),
            artifact(VALIDATOR_REL, blobs[VALIDATOR_REL]),
            artifact("package.json", blobs["package.json"]),
        ],
    }


def check_authority(v: V, data: bytes) -> dict[str, Any]:
    v.exact((len(data), digest(data)), (AUTHORITY_BYTES, AUTHORITY_SHA256), "authority bytes/hash drift")
    authority = load_json(data, "central integration authority")
    closed(v, authority, {
        "schema", "state", "lane", "predecessorCarrier", "generationEvidence",
        "descendantGovernanceEvidence", "centralIntegrationBoundary", "authority",
    }, "central integration authority")
    v.exact({key: authority.get(key) for key in ("schema", "state", "lane")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-central-integration-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_V62_GENERATION_DIRECT_FAST_FORWARD_INTEGRATION_AUTHORITY",
        "lane": "AUTH_PRODUCT_AUTHORIZATION_V62_GENERATION_CENTRAL_INTEGRATION",
    }, "authority identity drift")
    v.exact(authority.get("authority"), AUTHORITY_MAP, "authority map drift")
    return authority


def check_review(v: V, data: bytes, blobs: dict[str, bytes], committed: datetime | None) -> datetime:
    review = load_json(data, "central integration review")
    closed(v, review, {
        "schema", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "central integration review")
    expected = expected_review(blobs)
    v.exact({key: review.get(key) for key in expected}, expected, "central integration review drift")
    reviewed = parse_time(review.get("reviewedAt"), "central integration reviewedAt")
    causal(v, [("central review reviewedAt", reviewed)] + ([] if committed is None else [("carrier committedAt", committed)]))
    return reviewed


def check_static_evidence(v: V) -> tuple[bytes, bytes, bytes]:
    v.exact(text(FRONTEND, "rev-parse", f"{PARENT}^{{tree}}"), PARENT_TREE, "parent tree drift")
    v.exact(text(FRONTEND, "rev-parse", f"{GENERATION_CARRIER}^{{tree}}"), GENERATION_CARRIER_TREE, "generation carrier tree drift")
    v.exact(text(FRONTEND, "rev-parse", f"{GOVERNANCE_CARRIER}^{{tree}}"), GOVERNANCE_CARRIER_TREE, "governance carrier tree drift")
    v.require(ancestor(FRONTEND, GENERATION_CARRIER, PARENT), "parent lost generation carrier")
    v.require(ancestor(FRONTEND, GOVERNANCE_CARRIER, PARENT), "parent lost governance carrier")
    v.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_BASE_TREE, "backend base tree drift")
    v.exact(text(BACKEND, "rev-parse", f"{GENERATION_COMMIT}^{{tree}}"), GENERATION_TREE, "generation tree drift")
    v.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", GENERATION_COMMIT).split(),
        [GENERATION_COMMIT, BACKEND_BASE], "generation commit is not exact direct child",
    )
    v.exact(sorted(between(BACKEND, BACKEND_BASE, GENERATION_COMMIT)), GENERATION_CHANGED_PATHS, "generation changed paths drift")
    for expected in GENERATION_ARTIFACT_PINS:
        v.exact(git_artifact(FRONTEND, GENERATION_CARRIER, expected["path"]), expected, f"generation artifact drift: {expected['path']}")
    for expected in GOVERNANCE_ARTIFACT_PINS:
        v.exact(git_artifact(FRONTEND, GOVERNANCE_CARRIER, expected["path"]), expected, f"governance artifact drift: {expected['path']}")
    targeted = read_receipt(TARGETED_RECEIPT, "targeted verification receipt")
    post = read_receipt(POST_RECEIPT, "post-implementation receipt")
    governance = read_receipt(GOVERNANCE_RECEIPT, "descendant governance receipt")
    v.exact((len(targeted), digest(targeted)), (TARGETED_BYTES, TARGETED_SHA256), "targeted receipt drift")
    v.exact((len(post), digest(post)), (POST_BYTES, POST_SHA256), "post receipt drift")
    v.exact((len(governance), digest(governance)), (GOVERNANCE_BYTES, GOVERNANCE_SHA256), "governance receipt drift")
    remote = text(BACKEND, "rev-parse", f"origin/{GENERATION_BRANCH}")
    v.exact(remote, GENERATION_COMMIT, "generation remote branch drift")
    return targeted, post, governance


def authoring(v: V) -> dict[str, Any]:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    v.exact(text(FRONTEND, "rev-parse", "HEAD"), PARENT, "frontend authoring base drift")
    v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), PARENT, "frontend origin drift")
    v.exact(changes(FRONTEND), CARRIER_PATHS, "authoring four-path carrier drift")
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.require(symlink_free(FRONTEND, path), f"authoring artifact missing or symlinked: {path}")
        blobs[path] = (FRONTEND / path).read_bytes()
    check_package(v, blobs["package.json"], exact=True)
    check_authority(v, blobs[AUTHORITY_REL])
    check_review(v, blobs[REVIEW_REL], blobs, None)
    v.require(not present(CENTRAL_RECEIPT), "central receipt exists before carrier push")
    v.require(not present(V271_DELEGATION_RECEIPT), "V271 delegation receipt exists during eighth-carrier authoring")
    return {"commit": None, "tree": None, "blobs": blobs, "reviewedAt": None}


def historical(v: V) -> dict[str, Any]:
    v.exact(text(FRONTEND, "branch", "--show-current"), "dwp-dev", "frontend branch drift")
    head = text(FRONTEND, "rev-parse", "HEAD")
    v.exact(head, text(FRONTEND, "rev-parse", "origin/dwp-dev"), "frontend HEAD/origin drift")
    v.require(not changes(FRONTEND), "frontend worktree dirty")
    additions: list[str] = []
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"carrier introduction ambiguous: {path}")
        additions.extend(found)
    v.require(len(set(additions)) == 1, "carrier artifacts introduced separately")
    carrier = additions[0] if additions else ""
    v.exact(text(FRONTEND, "rev-list", "--parents", "-n", "1", carrier).split(), [carrier, PARENT], "carrier parent drift")
    v.exact(between(FRONTEND, PARENT, carrier), CARRIER_PATHS, "carrier path set drift")
    v.require(ancestor(FRONTEND, carrier, head), "carrier not on frontend dwp-dev")
    correction = lifecycle_correction(v)
    blobs: dict[str, bytes] = {}
    for path in (AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, carrier, path), "100644", f"unsafe carrier mode: {path}")
        data = blob(FRONTEND, carrier, path)
        v.require(data is not None, f"carrier artifact missing: {path}")
        blobs[path] = data or b""
        if path != "package.json":
            v.require(symlink_free(FRONTEND, path), f"current carrier artifact symlinked: {path}")
            expected_live = (
                correction["currentBlobs"][path]
                if path == VALIDATOR_REL else blobs[path]
            )
            v.exact(artifact(path, (FRONTEND / path).read_bytes()), artifact(path, expected_live), f"current carrier artifact drift: {path}")
    check_package(v, blobs["package.json"], exact=True)
    v.exact(mode(FRONTEND, head, "package.json"), "100644", "unsafe current package mode")
    v.require(symlink_free(FRONTEND, "package.json"), "current package missing or symlinked")
    head_package = blob(FRONTEND, head, "package.json")
    v.require(head_package is not None, "current package missing from frontend HEAD")
    live_package = (FRONTEND / "package.json").read_bytes()
    v.exact(
        artifact("package.json", live_package), artifact("package.json", head_package or b""),
        "live package differs from frontend HEAD",
    )
    check_package(v, live_package, exact=head == carrier)
    check_authority(v, blobs[AUTHORITY_REL])
    committed = parse_time(text(FRONTEND, "show", "-s", "--format=%cI", carrier), "carrier committedAt")
    reviewed = check_review(v, blobs[REVIEW_REL], blobs, committed)
    return {
        "commit": carrier, "tree": text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "blobs": blobs, "reviewedAt": reviewed,
    }


def backend_default(v: V, *, authoring_mode: bool, central_present: bool) -> str:
    v.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "backend default branch drift")
    head = text(BACKEND, "rev-parse", "HEAD")
    v.exact(head, text(BACKEND, "rev-parse", "origin/dwp-dev"), "backend HEAD/origin drift")
    v.require(not changes(BACKEND), "backend default worktree dirty")
    if authoring_mode or not central_present:
        v.exact(head, BACKEND_BASE, "backend moved before central integration receipt")
    return head


CENTRAL_RECEIPT_FIELDS = {
    "schema", "state", "generationAuthorityCarrierCommit", "generationAuthorityCarrierTree",
    "generationAuthorityArtifact", "generationTokenArtifact", "generationValidatorArtifact",
    "generationIndependentReviewArtifact", "generationPackageArtifact",
    "targetedVerificationReceiptSha256", "postImplementationReviewReceiptSha256",
    "backendBaseCommit", "backendBaseTree", "generationLaneCommit", "generationLaneTree",
    "generationLaneChangedPaths", "descendantGovernanceCarrierCommit",
    "descendantGovernanceCarrierTree", "descendantGovernanceAuthorityArtifact",
    "descendantGovernanceIndependentReviewArtifact", "descendantGovernanceReceiptSha256",
    "centralIntegrationAuthorityCarrierCommit", "centralIntegrationAuthorityCarrierTree",
    "centralIntegrationAuthorityArtifact", "centralIntegrationValidatorArtifact",
    "centralIntegrationIndependentReviewArtifact", "centralIntegrationPackageArtifact",
    "generationLaneCommittedAt", "targetedVerificationVerifiedAt",
    "postImplementationReviewReviewedAt", "generationLanePushObservedAt",
    "postImplementationReviewRecordedAt", "descendantGovernanceReceiptRecordedAt",
    "centralIntegrationReviewReviewedAt", "centralIntegrationAuthorityCarrierCommittedAt",
    "centralIntegrationAuthorityCarrierPushObservedAt", "p0", "p1", "p2", "decision",
    "integrationMode", "recordedAt", "recordedBy",
}


def check_central_receipt(
    v: V, carrier: dict[str, Any], targeted_data: bytes, post_data: bytes,
    governance_data: bytes,
) -> tuple[bytes, datetime]:
    data = read_receipt(CENTRAL_RECEIPT, "central integration receipt")
    receipt = load_json(data, "central integration receipt")
    closed(v, receipt, CENTRAL_RECEIPT_FIELDS, "central integration receipt")
    generation_blobs = {item["path"]: blob(FRONTEND, GENERATION_CARRIER, item["path"]) for item in GENERATION_ARTIFACT_PINS}
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v62-generation-central-integration-authority-receipt.v1",
        "state": "HASH_BOUND_ZERO_FINDING_AUTH_V62_GENERATION_DIRECT_FAST_FORWARD_INTEGRATION_AUTHORITY",
        "generationAuthorityCarrierCommit": GENERATION_CARRIER,
        "generationAuthorityCarrierTree": GENERATION_CARRIER_TREE,
        "generationAuthorityArtifact": artifact(GENERATION_AUTHORITY_REL, generation_blobs[GENERATION_AUTHORITY_REL] or b""),
        "generationTokenArtifact": artifact(GENERATION_TOKEN_REL, generation_blobs[GENERATION_TOKEN_REL] or b""),
        "generationValidatorArtifact": artifact(SEVENTH_REL, generation_blobs[SEVENTH_REL] or b""),
        "generationIndependentReviewArtifact": artifact(GENERATION_REVIEW_REL, generation_blobs[GENERATION_REVIEW_REL] or b""),
        "generationPackageArtifact": artifact("package.json", generation_blobs["package.json"] or b""),
        "targetedVerificationReceiptSha256": digest(targeted_data),
        "postImplementationReviewReceiptSha256": digest(post_data),
        "backendBaseCommit": BACKEND_BASE, "backendBaseTree": BACKEND_BASE_TREE,
        "generationLaneCommit": GENERATION_COMMIT, "generationLaneTree": GENERATION_TREE,
        "generationLaneChangedPaths": GENERATION_CHANGED_PATHS,
        "descendantGovernanceCarrierCommit": GOVERNANCE_CARRIER,
        "descendantGovernanceCarrierTree": GOVERNANCE_CARRIER_TREE,
        "descendantGovernanceAuthorityArtifact": GOVERNANCE_ARTIFACT_PINS[0],
        "descendantGovernanceIndependentReviewArtifact": GOVERNANCE_ARTIFACT_PINS[1],
        "descendantGovernanceReceiptSha256": digest(governance_data),
        "centralIntegrationAuthorityCarrierCommit": carrier["commit"],
        "centralIntegrationAuthorityCarrierTree": carrier["tree"],
        "centralIntegrationAuthorityArtifact": artifact(AUTHORITY_REL, carrier["blobs"][AUTHORITY_REL]),
        "centralIntegrationValidatorArtifact": artifact(VALIDATOR_REL, carrier["blobs"][VALIDATOR_REL]),
        "centralIntegrationIndependentReviewArtifact": artifact(REVIEW_REL, carrier["blobs"][REVIEW_REL]),
        "centralIntegrationPackageArtifact": artifact("package.json", carrier["blobs"]["package.json"]),
        "generationLaneCommittedAt": text(BACKEND, "show", "-s", "--format=%cI", GENERATION_COMMIT),
        "targetedVerificationVerifiedAt": load_json(targeted_data, "targeted receipt").get("verifiedAt"),
        "postImplementationReviewReviewedAt": load_json(post_data, "post receipt").get("reviewedAt"),
        "generationLanePushObservedAt": load_json(post_data, "post receipt").get("lanePushObservedAt"),
        "postImplementationReviewRecordedAt": load_json(post_data, "post receipt").get("recordedAt"),
        "descendantGovernanceReceiptRecordedAt": load_json(governance_data, "governance receipt").get("recordedAt"),
        "centralIntegrationReviewReviewedAt": load_json(carrier["blobs"][REVIEW_REL], "central review").get("reviewedAt"),
        "centralIntegrationAuthorityCarrierCommittedAt": text(FRONTEND, "show", "-s", "--format=%cI", carrier["commit"]),
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_V62_GENERATION_DIRECT_FAST_FORWARD_DWP_DEV_INTEGRATION_ONLY",
        "integrationMode": "DIRECT_FAST_FORWARD_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_AUTH_V62_GENERATION_CENTRAL_INTEGRATION_REVIEW",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "central integration receipt evidence drift")
    events = [
        ("generation commit", parse_time(receipt.get("generationLaneCommittedAt"), "generationLaneCommittedAt")),
        ("targeted verification", parse_time(receipt.get("targetedVerificationVerifiedAt"), "targetedVerificationVerifiedAt")),
        ("post review", parse_time(receipt.get("postImplementationReviewReviewedAt"), "postImplementationReviewReviewedAt")),
        ("generation push", parse_time(receipt.get("generationLanePushObservedAt"), "generationLanePushObservedAt")),
        ("post receipt", parse_time(receipt.get("postImplementationReviewRecordedAt"), "postImplementationReviewRecordedAt")),
        ("governance receipt", parse_time(receipt.get("descendantGovernanceReceiptRecordedAt"), "descendantGovernanceReceiptRecordedAt")),
        ("central review", parse_time(receipt.get("centralIntegrationReviewReviewedAt"), "centralIntegrationReviewReviewedAt")),
        ("central carrier commit", parse_time(receipt.get("centralIntegrationAuthorityCarrierCommittedAt"), "centralIntegrationAuthorityCarrierCommittedAt")),
        ("central carrier push", parse_time(receipt.get("centralIntegrationAuthorityCarrierPushObservedAt"), "centralIntegrationAuthorityCarrierPushObservedAt")),
        ("central receipt", parse_time(receipt.get("recordedAt"), "recordedAt")),
    ]
    causal(v, events)
    return data, events[-1][1]


V271_RECEIPT_FIELDS = {
    "schema", "state", "v62IntegrationCarrierCommit", "v62IntegrationCarrierTree",
    "v62CentralIntegrationReceiptSha256", "v271AuthorityCarrierCommit",
    "v271AuthorityCarrierTree", "v271AuthorityCarrierParentCommit",
    "v271AuthorityArtifact", "v271ValidatorArtifact", "v271IndependentReviewArtifact",
    "v271PackageArtifact", "previousBackendCommit", "previousBackendTree",
    "authorizedBackendBranch", "authorizedBackendCommit", "authorizedBackendTree", "authorizedBackendParentCommit",
    "authorizedBackendChangedPaths", "backendDescendantGovernanceCarrierCommit",
    "backendDescendantGovernanceCarrierTree", "backendDescendantGovernanceAuthorityArtifact",
    "backendDescendantGovernanceIndependentReviewArtifact",
    "backendDescendantGovernanceReceiptPath", "backendDescendantGovernanceReceiptSha256",
    "backendCommitCommittedAt", "v271ReviewReviewedAt", "v271CarrierCommittedAt",
    "v271CarrierPushObservedAt", "backendGovernanceReceiptRecordedAt", "recordedAt",
    "p0", "p1", "p2", "decision", "recordedBy",
}


def expected_v271_package(parent: str) -> bytes:
    data = blob(FRONTEND, parent, "package.json")
    if data is None:
        raise VerificationError("V271 carrier parent package missing")
    package = load_json(data, "V271 carrier parent package")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict) or scripts.get("hris:current-contracts:check") != CURRENT_SCRIPT:
        raise VerificationError("V271 carrier parent does not end at eighth validator")
    successor = CURRENT_SCRIPT + " && python3 " + V271_VALIDATOR_REL
    old = json.dumps(CURRENT_SCRIPT, ensure_ascii=False).encode()[1:-1]
    new = json.dumps(successor, ensure_ascii=False).encode()[1:-1]
    if data.count(old) != 1:
        raise VerificationError("V271 package append bytes missing or ambiguous")
    return data.replace(old, new, 1)


def check_v271_delegation(
    v: V,
    carrier: dict[str, Any],
    central_data: bytes,
    central_recorded_at: datetime,
    backend_head: str,
) -> str:
    data = read_receipt(V271_DELEGATION_RECEIPT, "V271 successor delegation receipt")
    receipt = load_json(data, "V271 successor delegation receipt")
    closed(v, receipt, V271_RECEIPT_FIELDS, "V271 successor delegation receipt")
    for key in ("v271AuthorityCarrierCommit", "authorizedBackendCommit", "backendDescendantGovernanceCarrierCommit"):
        v.require(type(receipt.get(key)) is str and re.fullmatch(r"[0-9a-f]{40}", receipt[key]) is not None, f"invalid {key}")
    v271_carrier = receipt["v271AuthorityCarrierCommit"]
    additions: list[str] = []
    for path in (V271_AUTHORITY_REL, V271_REVIEW_REL, V271_VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.require(len(found) == 1, f"V271 carrier introduction ambiguous: {path}")
        additions.extend(found)
    v.exact(set(additions), {v271_carrier}, "V271 carrier artifact commit drift")
    parents = text(FRONTEND, "rev-list", "--parents", "-n", "1", v271_carrier).split()
    v.require(len(parents) == 2, "V271 carrier must be non-merge")
    v.exact(receipt.get("v271AuthorityCarrierParentCommit"), parents[1], "V271 carrier parent receipt drift")
    v.require(ancestor(FRONTEND, carrier["commit"], parents[1]), "V271 carrier bypasses eighth carrier")
    v.exact(between(FRONTEND, parents[1], v271_carrier), V271_CARRIER_PATHS, "V271 carrier path drift")
    frontend_head = text(FRONTEND, "rev-parse", "HEAD")
    v.require(ancestor(FRONTEND, v271_carrier, frontend_head), "V271 carrier not on frontend dwp-dev")
    v.require(ancestor(FRONTEND, v271_carrier, text(FRONTEND, "rev-parse", "origin/dwp-dev")), "V271 carrier not pushed")
    v.exact(blob(FRONTEND, v271_carrier, "package.json"), expected_v271_package(parents[1]), "V271 package is not exact ninth append")
    v271_blobs: dict[str, bytes] = {}
    for path in (V271_AUTHORITY_REL, V271_REVIEW_REL, V271_VALIDATOR_REL, "package.json"):
        v.exact(mode(FRONTEND, v271_carrier, path), "100644", f"unsafe V271 carrier mode: {path}")
        item = blob(FRONTEND, v271_carrier, path)
        v.require(item is not None, f"missing V271 carrier artifact: {path}")
        v271_blobs[path] = item or b""
    try:
        compile(v271_blobs[V271_VALIDATOR_REL].decode("utf-8"), V271_VALIDATOR_REL, "exec")
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationError(f"invalid ninth validator: {exc}") from exc
    forbidden = ("write_" + "text(", "write_" + "bytes(", "O_" + "CREAT", "shell=" + "True")
    source = v271_blobs[V271_VALIDATOR_REL].decode("utf-8")
    v.require(not any(token in source for token in forbidden), "ninth validator contains write/shell primitive")
    check_current_v271_chain(v, v271_carrier, v271_blobs)
    v271_authority = load_json(v271_blobs[V271_AUTHORITY_REL], "V271 authority")
    closed(v, v271_authority, {
        "schema", "state", "lane", "predecessorCarrier", "backendImplementation",
        "delegationBoundary", "authority",
    }, "V271 authority")
    v.exact({key: v271_authority.get(key) for key in ("schema", "state", "lane")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-execution-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_V271_EXECUTION_AUTHORITY",
        "lane": "AUTH_V271_EXCLUSIVE_MIGRATION",
    }, "V271 authority identity drift")
    v.exact(v271_authority.get("predecessorCarrier"), {
        "repository": "dwp-frontend", "branch": "dwp-dev",
        "commit": parents[1], "tree": text(FRONTEND, "rev-parse", f"{parents[1]}^{{tree}}"),
        "v62IntegrationCarrierCommit": carrier["commit"],
        "v62IntegrationCarrierTree": carrier["tree"],
        "v62CentralIntegrationReceiptSha256": digest(central_data),
    }, "V271 predecessor closure drift")
    v.exact(v271_authority.get("backendImplementation"), {
        "repository": "dwp-backend", "branch": V271_BACKEND_BRANCH,
        "baseCommit": GENERATION_COMMIT,
        "baseTree": GENERATION_TREE,
        "operation": "AUTHOR_VALIDATE_COMMIT_AND_PUSH_AUTH_V271_ONLY",
        "requiredDirectChild": True, "requiredMigrationPath": V271_MIGRATION_REL,
        "databaseMigrationVersion": 271, "directDwpDevIntegrationAuthorized": False,
    }, "V271 backend implementation boundary drift")
    v.exact(v271_authority.get("delegationBoundary"), {
        "receiptPath": str(V271_DELEGATION_RECEIPT),
        "receiptSchema": "dwp.hris.wave7.hrm013-auth-v271-successor-delegation-authority-receipt.v1",
        "receiptState": "HASH_BOUND_REVIEWED_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION",
        "requiredDecision": "GO_FOR_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION_ONLY",
        "externalAttestationRequired": True,
        "currentV62AuthorityGrantsV271": False,
    }, "V271 delegation boundary drift")
    v.exact(v271_authority.get("authority"), V271_AUTHORITY_MAP, "V271 authority map drift")
    v271_review = load_json(v271_blobs[V271_REVIEW_REL], "V271 review")
    closed(v, v271_review, {
        "schema", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "V271 review")
    v.exact({key: v271_review.get(key) for key in ("schema", "reviewer")}, {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-execution-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_V271_AUTHORITY_REVIEW",
    }, "V271 review identity drift")
    v.exact(v271_review.get("scope"), {
        "authorityPath": V271_AUTHORITY_REL, "validatorPath": V271_VALIDATOR_REL,
        "packagePath": "package.json", "reviewedBoundaries": V271_REVIEW_BOUNDARIES,
    }, "V271 review scope drift")
    v.exact(v271_review.get("findings"), {
        "p0": [], "p1": [], "p2": [],
        "notes": [
            "The carrier may authorize only one separately receipted Auth V271 migration lane from the exact integrated Auth v62 commit.",
            "Backend dwp-dev integration remains forbidden until descendant governance and successor delegation receipts are complete.",
            "No runtime, activation, tenant enrollment, production binding or release authority is granted.",
        ],
    }, "V271 review findings drift")
    v.exact(v271_review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_V271_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY",
    }, "V271 review verdict drift")
    v.exact(v271_review.get("authority"), V271_REVIEW_AUTHORITY, "V271 review authority drift")
    v.exact(v271_review.get("artifactPins"), [
        artifact(V271_AUTHORITY_REL, v271_blobs[V271_AUTHORITY_REL]),
        artifact(V271_VALIDATOR_REL, v271_blobs[V271_VALIDATOR_REL]),
        artifact("package.json", v271_blobs["package.json"]),
    ], "V271 review artifact pins drift")
    v.exact(
        parse_time(v271_review.get("reviewedAt"), "V271 review reviewedAt"),
        parse_time(receipt.get("v271ReviewReviewedAt"), "receipt v271ReviewReviewedAt"),
        "V271 review timestamp receipt drift",
    )
    authorized = receipt["authorizedBackendCommit"]
    authorized_tree = text(BACKEND, "rev-parse", f"{authorized}^{{tree}}")
    backend_parents = text(BACKEND, "rev-list", "--parents", "-n", "1", authorized).split()
    v.exact(backend_parents, [authorized, GENERATION_COMMIT], "authorized V271 backend commit is not direct child")
    changed = sorted(between(BACKEND, GENERATION_COMMIT, authorized))
    v.require(bool(changed) and all(canonical(path) for path in changed), "invalid V271 changed paths")
    v.require(V271_MIGRATION_REL in changed, "authorized V271 commit lacks exact migration")
    v.require(not any("/db/migration/" in path and path != V271_MIGRATION_REL for path in changed), "additional migration in V271 commit")
    remote_v271 = git(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{V271_BACKEND_BRANCH}", check=False)
    v.require(remote_v271.returncode == 0, "authorized V271 module branch is not pushed")
    if remote_v271.returncode == 0:
        v.exact(remote_v271.stdout.decode("utf-8", errors="strict").strip(), authorized, "authorized V271 remote branch drift")
    governance_commit = receipt["backendDescendantGovernanceCarrierCommit"]
    governance_root = (
        "docs/06-delivery/hris/wave7-2026-10-17/"
        f"r7-batch-06-hrm013-backend-descendant-governance/{authorized}"
    )
    governance_authority = f"{governance_root}/authority.v1.json"
    governance_review = f"{governance_root}/independent-review.v1.json"
    governance_additions: list[str] = []
    for path in (governance_authority, governance_review):
        found = [
            line for line in text(
                FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path,
            ).splitlines() if line
        ]
        v.require(len(found) == 1, f"V271 governance artifact introduction ambiguous: {path}")
        governance_additions.extend(found)
    v.exact(set(governance_additions), {governance_commit}, "V271 governance carrier artifact commit drift")
    v.exact(
        text(FRONTEND, "rev-list", "--parents", "-n", "1", governance_commit).split(),
        [governance_commit, GOVERNANCE_CARRIER],
        "V271 governance carrier is not the ordered direct child of d7 governance",
    )
    v.exact(
        between(FRONTEND, GOVERNANCE_CARRIER, governance_commit),
        {governance_authority, governance_review},
        "V271 governance carrier path set drift",
    )
    frontend_origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
    v.require(
        ancestor(FRONTEND, governance_commit, frontend_head)
        and ancestor(FRONTEND, governance_commit, frontend_origin),
        "V271 governance carrier is not on pushed frontend dwp-dev",
    )
    governance_blobs = {
        governance_authority: blob(FRONTEND, governance_commit, governance_authority),
        governance_review: blob(FRONTEND, governance_commit, governance_review),
    }
    v.require(all(item is not None for item in governance_blobs.values()), "missing V271 descendant governance artifacts")
    for path in (governance_authority, governance_review):
        v.exact(mode(FRONTEND, governance_commit, path), "100644", f"unsafe V271 governance carrier mode: {path}")
        v.exact(mode(FRONTEND, frontend_head, path), "100644", f"unsafe current V271 governance mode: {path}")
        current = blob(FRONTEND, frontend_head, path)
        v.require(current is not None, f"current V271 governance artifact missing: {path}")
        v.exact(
            artifact(path, current or b""), artifact(path, governance_blobs[path] or b""),
            f"V271 governance artifact mutated after carrier: {path}",
        )
        v.require(symlink_free(FRONTEND, path), f"live V271 governance artifact symlinked: {path}")
        v.exact(
            artifact(path, (FRONTEND / path).read_bytes()), artifact(path, governance_blobs[path] or b""),
            f"live V271 governance artifact drift: {path}",
        )
    governance_receipt_path = RECEIPTS / "backend-descendants" / f"{authorized}.hrm013-shared-contract-governance.v1.json"
    governance_receipt_data = read_receipt(governance_receipt_path, "V271 descendant governance receipt")
    governance_receipt = load_json(governance_receipt_data, "V271 descendant governance receipt")
    closed(v, governance_receipt, {
        "schema", "state", "sharedIntegrationCommit", "sharedIntegrationTree",
        "immediateParentCommit", "descendantCommit", "descendantTree",
        "descendantChangedPaths", "sharedElevenBlobPins",
        "governingFrontendCarrierCommit", "governingFrontendCarrierTree",
        "governingAuthorityArtifact", "governingValidatorArtifact",
        "governingIndependentReviewArtifact", "governingPackageArtifact",
        "previousGovernanceReceiptSha256", "p0", "p1", "p2", "decision",
        "recordedAt", "recordedBy",
    }, "V271 descendant governance receipt")
    previous_governance_data = read_receipt(GOVERNANCE_RECEIPT, "d7 descendant governance receipt")
    v.exact(
        (len(previous_governance_data), digest(previous_governance_data)),
        (GOVERNANCE_BYTES, GOVERNANCE_SHA256),
        "d7 descendant governance receipt drift during V271 delegation",
    )
    previous_governance = load_json(previous_governance_data, "d7 descendant governance receipt")
    governance_package = blob(FRONTEND, governance_commit, "package.json")
    governance_validator = blob(FRONTEND, governance_commit, SIXTH_REL)
    v.require(governance_package is not None, "V271 governance carrier package missing")
    v.require(governance_validator is not None, "V271 governance carrier governing validator missing")
    v.exact(mode(FRONTEND, governance_commit, "package.json"), "100644", "unsafe V271 governance package mode")
    v.exact(mode(FRONTEND, governance_commit, SIXTH_REL), "100644", "unsafe V271 governance validator mode")
    expected_governance_receipt = {
        "schema": "dwp.hris.wave7.hrm013-shared-contract-backend-descendant-governance-receipt.v1",
        "state": "REVIEWED_ORDERED_BACKEND_DESCENDANT_GOVERNANCE_SHARED_ELEVEN_BLOBS_IMMUTABLE",
        "sharedIntegrationCommit": previous_governance.get("sharedIntegrationCommit"),
        "sharedIntegrationTree": previous_governance.get("sharedIntegrationTree"),
        "immediateParentCommit": GENERATION_COMMIT,
        "descendantCommit": authorized,
        "descendantTree": authorized_tree,
        "descendantChangedPaths": changed,
        "sharedElevenBlobPins": previous_governance.get("sharedElevenBlobPins"),
        "governingFrontendCarrierCommit": governance_commit,
        "governingFrontendCarrierTree": text(FRONTEND, "rev-parse", f"{governance_commit}^{{tree}}"),
        "governingAuthorityArtifact": artifact(governance_authority, governance_blobs[governance_authority] or b""),
        "governingValidatorArtifact": artifact(SIXTH_REL, governance_validator or b""),
        "governingIndependentReviewArtifact": artifact(governance_review, governance_blobs[governance_review] or b""),
        "governingPackageArtifact": artifact("package.json", governance_package or b""),
        "previousGovernanceReceiptSha256": digest(previous_governance_data),
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_BACKEND_DESCENDANT_GOVERNANCE_REVIEW",
    }
    v.exact(
        {key: governance_receipt.get(key) for key in expected_governance_receipt},
        expected_governance_receipt,
        "V271 descendant governance receipt evidence drift",
    )
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-v271-successor-delegation-authority-receipt.v1",
        "state": "HASH_BOUND_REVIEWED_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION",
        "v62IntegrationCarrierCommit": carrier["commit"],
        "v62IntegrationCarrierTree": carrier["tree"],
        "v62CentralIntegrationReceiptSha256": digest(central_data),
        "v271AuthorityCarrierCommit": v271_carrier,
        "v271AuthorityCarrierTree": text(FRONTEND, "rev-parse", f"{v271_carrier}^{{tree}}"),
        "v271AuthorityCarrierParentCommit": parents[1],
        "v271AuthorityArtifact": artifact(V271_AUTHORITY_REL, v271_blobs[V271_AUTHORITY_REL]),
        "v271ValidatorArtifact": artifact(V271_VALIDATOR_REL, v271_blobs[V271_VALIDATOR_REL]),
        "v271IndependentReviewArtifact": artifact(V271_REVIEW_REL, v271_blobs[V271_REVIEW_REL]),
        "v271PackageArtifact": artifact("package.json", v271_blobs["package.json"]),
        "previousBackendCommit": GENERATION_COMMIT,
        "previousBackendTree": GENERATION_TREE,
        "authorizedBackendBranch": V271_BACKEND_BRANCH,
        "authorizedBackendCommit": authorized,
        "authorizedBackendTree": authorized_tree,
        "authorizedBackendParentCommit": GENERATION_COMMIT,
        "authorizedBackendChangedPaths": changed,
        "backendDescendantGovernanceCarrierCommit": governance_commit,
        "backendDescendantGovernanceCarrierTree": text(FRONTEND, "rev-parse", f"{governance_commit}^{{tree}}"),
        "backendDescendantGovernanceAuthorityArtifact": artifact(governance_authority, governance_blobs[governance_authority] or b""),
        "backendDescendantGovernanceIndependentReviewArtifact": artifact(governance_review, governance_blobs[governance_review] or b""),
        "backendDescendantGovernanceReceiptPath": str(governance_receipt_path),
        "backendDescendantGovernanceReceiptSha256": digest(governance_receipt_data),
        "backendCommitCommittedAt": text(BACKEND, "show", "-s", "--format=%cI", authorized),
        "v271ReviewReviewedAt": load_json(v271_blobs[V271_REVIEW_REL], "V271 review").get("reviewedAt"),
        "v271CarrierCommittedAt": text(FRONTEND, "show", "-s", "--format=%cI", v271_carrier),
        "backendGovernanceReceiptRecordedAt": load_json(
            governance_receipt_data, "V271 descendant governance receipt"
        ).get("recordedAt"),
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_AUTH_V271_SUCCESSOR_CONTROL_DELEGATION_ONLY",
        "recordedBy": "INDEPENDENT_HRM013_AUTH_V271_SUCCESSOR_DELEGATION_REVIEW",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "V271 delegation receipt evidence drift")
    causal(v, [
        ("v62 central receipt", central_recorded_at),
        ("V271 review", parse_time(receipt.get("v271ReviewReviewedAt"), "v271ReviewReviewedAt")),
        ("V271 carrier commit", parse_time(receipt.get("v271CarrierCommittedAt"), "v271CarrierCommittedAt")),
        ("V271 carrier push", parse_time(receipt.get("v271CarrierPushObservedAt"), "v271CarrierPushObservedAt")),
        ("backend commit", parse_time(receipt.get("backendCommitCommittedAt"), "backendCommitCommittedAt")),
        ("backend governance receipt", parse_time(receipt.get("backendGovernanceReceiptRecordedAt"), "backendGovernanceReceiptRecordedAt")),
        ("delegation receipt", parse_time(receipt.get("recordedAt"), "recordedAt")),
    ])
    v.require(ancestor(BACKEND, authorized, backend_head), "backend head predates delegated V271 commit")
    return "AUTH_V271_SUCCESSOR_CONTROL_DELEGATED_TO_FIXED_NINTH_VALIDATOR"


def post_central_action(backend_head: str, delegation_receipt_present: bool) -> str:
    if backend_head == BACKEND_BASE:
        if delegation_receipt_present:
            raise VerificationError("V271 delegation receipt precedes v62 integration")
        return "BASE_READY"
    if backend_head == GENERATION_COMMIT:
        if delegation_receipt_present:
            raise VerificationError("V271 delegation receipt precedes V271 backend integration and governance")
        return "GENERATION_INTEGRATED"
    if not delegation_receipt_present:
        raise VerificationError("backend descendant lacks fixed V271 delegation receipt")
    return "V271_DELEGATED"


def negatives(v: V) -> None:
    for left, right in ((True, 1), (False, 0), (1, 1.0)):
        v.require(not strict_equal(left, right), "strict type fixture accepted")
    for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'):
        try:
            load_json(raw, "negative")
        except VerificationError:
            continue
        raise VerificationError("invalid JSON fixture accepted")
    for unsafe in ("../x", "/x", "a//b", "a/./b"):
        v.require(not canonical(unsafe), f"unsafe path accepted: {unsafe}")
    v.exact(post_central_action(BACKEND_BASE, False), "BASE_READY", "base ready fixture drift")
    try:
        post_central_action(BACKEND_BASE, True)
    except VerificationError:
        pass
    else:
        raise VerificationError("premature V271 receipt accepted at backend base")
    v.exact(
        post_central_action(GENERATION_COMMIT, False), "GENERATION_INTEGRATED",
        "generation integration fixture drift",
    )
    try:
        post_central_action(GENERATION_COMMIT, True)
    except VerificationError:
        pass
    else:
        raise VerificationError("pre-fast-forward V271 delegation receipt accepted")
    v.exact(post_central_action("f" * 40, True), "V271_DELEGATED", "delegation fixture drift")
    try:
        post_central_action("f" * 40, False)
    except VerificationError:
        pass
    else:
        raise VerificationError("backend descendant without delegation receipt accepted")



def expected_lifecycle_correction_authority() -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-validator-lifecycle-successor-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_THREE_VALIDATOR_LIFECYCLE_SUCCESSOR",
        "sliceId": "BASE-TFR-HRM-013",
        "lane": "FRONTEND_VALIDATOR_LIFECYCLE_CORRECTION",
        "carrier": {
            "repository": "dwp-frontend",
            "branch": LIFECYCLE_CORRECTION_BRANCH,
            "baseCommit": LIFECYCLE_CORRECTION_BASE,
            "baseTree": LIFECYCLE_CORRECTION_BASE_TREE,
            "requiredDirectChild": True,
            "exactChangedPathCount": 7,
            "exactChangedPaths": [
                *LIFECYCLE_VALIDATORS,
                LIFECYCLE_CORRECTION_AUTHORITY,
                LIFECYCLE_CORRECTION_REVIEW,
                LIFECYCLE_CORRECTION_VALIDATOR,
                "package.json",
            ],
        },
        "historicalValidatorIntroductions": [
            {"path": LIFECYCLE_SEVENTH_VALIDATOR, "commit": "d80e886121886792c33150b0ff97f128f0da9e14"},
            {"path": LIFECYCLE_EIGHTH_VALIDATOR, "commit": "4b24bdefb0f61d5cb61d89d08397975e45ac389e"},
            {"path": LIFECYCLE_NINTH_VALIDATOR, "commit": "24cb37b7c9f23b2f74a833aedf6939e499f5ab99"},
        ],
        "correction": {
            "modifiedValidatorPaths": LIFECYCLE_VALIDATORS,
            "historicalAuthorityReviewAndTokenBlobsRemainPinned": True,
            "successorBlobSubstitutionRestrictedToValidatorPaths": True,
            "packageMutationRestrictedToExactSingleValidatorAppend": True,
            "basePackagePin": {
                "path": "package.json", "bytes": 16469,
                "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
            },
            "appendedValidatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
            "approvalRuntimeHardening": {
                "carrierCommit": APPROVAL_INTEGRATION_COMMIT,
                "carrierTree": APPROVAL_INTEGRATION_TREE,
                "carrierParent": APPROVAL_INTEGRATION_PARENT,
                "exactChangedPathCount": 9,
                "authRuntimeValidatorPath": HARDENED_AUTH_RUNTIME_VALIDATOR,
                "authRuntimeValidatorBytes": 34031,
                "authRuntimeValidatorSha256": "a84254807daebc854ae35c9c6388869d02ba4129deda3a94312a367fad117b1c",
            },
        },
        "authority": {
            "independentReviewComplete": True,
            "exactSevenPathCarrierCommitAndPushAuthorized": True,
            "existingCurrentContractChainRevalidationAuthorized": True,
            "exactSingleValidatorPackageAppendAuthorized": True,
            "backendDwpDevIntegrationAuthorized": False,
            "approvalRuntimeIntegrationAuthorityExpanded": False,
            "peopleIntegrationAuthorized": False,
            "featureActivationAuthorized": False,
            "tenantEnrollmentAuthorized": False,
            "runtimeCredentialProvisioningAuthorized": False,
            "productionReleaseAuthorized": False,
            "businessCompletionCredit": 0,
        },
        "next": (
            "RERUN_CURRENT_CONTRACT_CHAIN_THEN_CONTINUE_ONLY_UNDER_"
            "EXISTING_APPROVAL_RUNTIME_INTEGRATION_AUTHORITY"
        ),
    }


def approval_reseal_successor(
    v: V, authoring: bool = False, people_authoring: bool = False,
) -> dict[str, Any] | None:
    v.exact(
        text(FRONTEND, "rev-parse", f"{RESEAL_BASE}^{{tree}}"),
        RESEAL_BASE_TREE,
        "Approval reseal base tree",
    )
    if authoring:
        v.exact(text(FRONTEND, "branch", "--show-current"), RESEAL_BRANCH, "Approval reseal branch")
        v.exact(text(FRONTEND, "rev-parse", "HEAD"), RESEAL_BASE, "Approval reseal authoring head")
        v.exact(changes(FRONTEND), RESEAL_PATHS, "Approval reseal authoring paths")
        commit = None
    else:
        additions = [
            [line for line in text(
                FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path,
            ).splitlines() if line]
            for path in (RESEAL_AUTHORITY, RESEAL_REVIEW)
        ]
        if not any(additions):
            return None
        for path, found in zip((RESEAL_AUTHORITY, RESEAL_REVIEW), additions):
            v.exact(len(found), 1, f"Approval reseal introduction count: {path}")
        commits = [item for found in additions for item in found]
        v.exact(len(set(commits)), 1, "Approval reseal artifacts introduced separately")
        commit = commits[0] if commits else ""
        v.exact(
            text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(),
            [commit, RESEAL_BASE],
            "Approval reseal carrier is not the exact direct child",
        )
        v.exact(between(FRONTEND, RESEAL_BASE, commit), RESEAL_PATHS, "Approval reseal carrier paths")
        head = text(FRONTEND, "rev-parse", "HEAD")
        origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
        v.exact(head, origin, "frontend HEAD/origin drift after Approval reseal")
        v.require(
            ancestor(FRONTEND, commit, head) and ancestor(FRONTEND, commit, origin),
            "Approval reseal carrier is not on pushed frontend dwp-dev",
        )
        if people_authoring:
            v.exact(text(FRONTEND, "branch", "--show-current"), PEOPLE_BRANCH, "People branch during Approval reseal validation")
            v.exact(head, PEOPLE_BASE, "People base during Approval reseal validation")
            v.exact(changes(FRONTEND), PEOPLE_PATHS, "People paths during Approval reseal validation")
        else:
            v.exact(changes(FRONTEND), set(), "frontend dirty after Approval reseal")

    blobs: dict[str, bytes] = {}
    for path in [RESEAL_AUTHORITY, RESEAL_REVIEW, *RESEAL_VALIDATORS]:
        candidate = FRONTEND / path
        v.require(candidate.is_file() and not candidate.is_symlink(), f"Approval reseal artifact missing/symlinked: {path}")
        v.exact(stat.S_IMODE(candidate.stat().st_mode), 0o644, f"Approval reseal live mode: {path}")
        live = candidate.read_bytes()
        if commit is None:
            data = live
        else:
            v.exact(mode(FRONTEND, commit, path), "100644", f"Approval reseal carrier mode: {path}")
            data = blob(FRONTEND, commit, path)
            v.require(data is not None, f"Approval reseal carrier artifact missing: {path}")
            data = data or b""
            if not (people_authoring and path in PEOPLE_VALIDATORS):
                v.exact(artifact(path, live), artifact(path, data), f"Approval reseal live drift: {path}")
        blobs[path] = data

    package_data = (FRONTEND / "package.json").read_bytes()
    base_package = blob(FRONTEND, RESEAL_BASE, "package.json")
    v.require(base_package is not None, "Approval reseal base package missing")
    v.exact(package_data, base_package or b"", "Approval reseal package changed")
    v.exact(artifact("package.json", package_data), RESEAL_PACKAGE_PIN, "Approval reseal package pin")
    package = load_json(package_data, "Approval reseal package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "Approval reseal scripts missing")
    command = scripts.get("hris:current-contracts:check") if isinstance(scripts, dict) else None
    v.require(isinstance(command, str), "Approval reseal current-contract chain missing")
    if isinstance(scripts, dict):
        v.require("prehris:current-contracts:check" not in scripts, "Approval reseal npm pre-hook")
        v.require("posthris:current-contracts:check" not in scripts, "Approval reseal npm post-hook")
    if isinstance(command, str):
        parts = command.split(" && ")
        matches = [re.fullmatch(
            r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
            item,
        ) for item in parts]
        v.require(all(matches), "Approval reseal chain contains a non-validator command")
        paths = [match.group(1) for match in matches if match]
        v.exact(len(paths), 18, "Approval reseal command count")
        v.exact(len(paths), len(set(paths)), "Approval reseal duplicate validator command")
        v.exact(paths[-1], LIFECYCLE_CORRECTION_VALIDATOR, "Approval reseal governing validator order")
    blobs["package.json"] = package_data

    v.exact(artifact(RESEAL_AUTHORITY, blobs[RESEAL_AUTHORITY]), RESEAL_AUTHORITY_PIN, "Approval reseal authority pin")
    load_json(blobs[RESEAL_AUTHORITY], "Approval reseal authority")
    review = load_json(blobs[RESEAL_REVIEW], "Approval reseal review")
    v.exact(set(review), {
        "schema", "state", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "Approval reseal review key set")
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-approval-reseal-central-integration-independent-review.v1", "Approval reseal review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_TWELVE_PATH_APPROVAL_RESEAL_INTEGRATION", "Approval reseal review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_APPROVAL_RESEAL_INTEGRATION_REVIEW", "Approval reseal reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": RESEAL_AUTHORITY,
        "governingValidatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
        "modifiedValidatorPaths": RESEAL_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_DIRECT_CHILD_TWELVE_PATH_CARRIER",
            "B9880EC6_REMAINS_IMMUTABLE_HISTORICAL_EVIDENCE_ONLY",
            "ONLY_EXACT_3970B26C_SAME_TREE_SUCCESSOR_MAY_FAST_FORWARD",
            "EXACT_ORDERED_DESCENDANT_GOVERNANCE_AND_SECURE_EXTERNAL_RECEIPTS",
            "TEN_CURRENT_VALIDATOR_BLOBS_AND_UNCHANGED_EIGHTEEN_COMMAND_PACKAGE",
            "NO_FEATURE_TENANT_CREDENTIAL_OR_PRODUCTION_AUTHORITY",
        ],
    }, "Approval reseal review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "Approval reseal findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_APPROVAL_SAME_TREE_RESEAL_CORRECTION_AND_3970_FAST_FORWARD_AFTER_GOVERNANCE_CLOSURE",
    }, "Approval reseal verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactTwelvePathCarrierCommitAndPushAuthorized": True,
        "exact3970FastForwardAuthorizedAfterGovernanceClosure": True,
        "originalB988IntegrationAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "featureActivationOrTenantOrCredentialOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "Approval reseal review authority")
    v.exact(review.get("artifactPins"), [
        artifact(RESEAL_AUTHORITY, blobs[RESEAL_AUTHORITY]),
        *[artifact(path, blobs[path]) for path in RESEAL_VALIDATORS],
        artifact("package.json", package_data),
    ], "Approval reseal review pins")
    reviewed_at = parse_time(review.get("reviewedAt"), "Approval reseal reviewedAt")
    v.require(reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5), "Approval reseal review is in the future")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(int((FRONTEND / path).stat().st_mtime), timezone.utc)
            for path in [RESEAL_AUTHORITY, *RESEAL_VALIDATORS, "package.json"]
        )
        v.require(latest <= reviewed_at, "Approval reseal review predates authoring snapshot")
    else:
        committed_at = parse_time(
            text(FRONTEND, "show", "-s", "--format=%cI", commit),
            "Approval reseal carrier committedAt",
        )
        v.require(reviewed_at <= committed_at, "Approval reseal review follows carrier commit")
    return {"commit": commit, "blobs": blobs}


def people_receipt(v: V, path: Path, size: int, sha256: str) -> dict[str, Any]:
    v.require(path.exists() and not path.is_symlink(), f"People receipt missing/symlinked: {path}")
    info = path.stat()
    v.require(stat.S_ISREG(info.st_mode), f"People receipt is not regular: {path}")
    v.exact(stat.S_IMODE(info.st_mode), 0o600, f"People receipt mode: {path}")
    v.exact(info.st_uid, os.getuid(), f"People receipt owner: {path}")
    v.exact(info.st_nlink, 1, f"People receipt link count: {path}")
    data = path.read_bytes()
    v.exact(artifact(str(path), data), {
        "path": str(path), "bytes": size, "sha256": sha256,
    }, f"People receipt pin: {path}")
    return load_json(data, str(path))


def people_rebase_successor(
    v: V, authoring: bool = False,
) -> dict[str, Any] | None:
    v.exact(
        text(FRONTEND, "rev-parse", f"{PEOPLE_BASE}^{{tree}}"),
        PEOPLE_BASE_TREE,
        "People integration base tree",
    )
    if authoring:
        v.exact(text(FRONTEND, "branch", "--show-current"), PEOPLE_BRANCH, "People integration branch")
        v.exact(text(FRONTEND, "rev-parse", "HEAD"), PEOPLE_BASE, "People integration authoring head")
        v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), PEOPLE_BASE, "People integration authoring origin")
        v.exact(changes(FRONTEND), PEOPLE_PATHS, "People integration authoring paths")
        v.require(
            not ancestor(FRONTEND, PEOPLE_GOVERNANCE_COMMIT, PEOPLE_BASE),
            "People governance merged before central authority carrier",
        )
        commit = None
        head = PEOPLE_BASE
        origin = PEOPLE_BASE
    else:
        additions = [
            [line for line in text(
                FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path,
            ).splitlines() if line]
            for path in (PEOPLE_AUTHORITY, PEOPLE_REVIEW)
        ]
        if not any(additions):
            return None
        for path, found in zip((PEOPLE_AUTHORITY, PEOPLE_REVIEW), additions):
            v.exact(len(found), 1, f"People integration introduction count: {path}")
        commits = [item for found in additions for item in found]
        v.exact(len(set(commits)), 1, "People integration authority/review introduced separately")
        commit = commits[0] if commits else ""
        v.exact(
            text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(),
            [commit, PEOPLE_BASE],
            "People integration carrier is not exact direct child",
        )
        v.exact(
            between(FRONTEND, PEOPLE_BASE, commit),
            PEOPLE_PATHS,
            "People integration carrier paths",
        )
        head = text(FRONTEND, "rev-parse", "HEAD")
        origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
        v.exact(head, origin, "frontend HEAD/origin drift after People integration")
        v.require(
            ancestor(FRONTEND, commit, head) and ancestor(FRONTEND, commit, origin),
            "People integration authority carrier is not in force",
        )
        v.exact(changes(FRONTEND), set(), "frontend dirty after People integration")

    blobs: dict[str, bytes] = {}
    for path in [PEOPLE_AUTHORITY, PEOPLE_REVIEW, *PEOPLE_VALIDATORS]:
        candidate = FRONTEND / path
        v.require(candidate.is_file() and not candidate.is_symlink(), f"People artifact missing/symlinked: {path}")
        v.exact(stat.S_IMODE(candidate.stat().st_mode), 0o644, f"People live mode: {path}")
        live = candidate.read_bytes()
        if commit is None:
            data = live
        else:
            v.exact(mode(FRONTEND, commit, path), "100644", f"People carrier mode: {path}")
            data = blob(FRONTEND, commit, path)
            v.require(data is not None, f"People carrier artifact missing: {path}")
            data = data or b""
            v.exact(artifact(path, live), artifact(path, data), f"People live drift: {path}")
        blobs[path] = data

    package_data = (FRONTEND / "package.json").read_bytes()
    base_package = blob(FRONTEND, PEOPLE_BASE, "package.json")
    v.require(base_package is not None, "People base package missing")
    v.exact(package_data, base_package or b"", "People package changed")
    v.exact(artifact("package.json", package_data), RESEAL_PACKAGE_PIN, "People package pin")
    package = load_json(package_data, "People package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "People package scripts missing")
    command = scripts.get("hris:current-contracts:check") if isinstance(scripts, dict) else None
    v.require(isinstance(command, str), "People current-contract chain missing")
    if isinstance(scripts, dict):
        v.require("prehris:current-contracts:check" not in scripts, "People npm pre-hook")
        v.require("posthris:current-contracts:check" not in scripts, "People npm post-hook")
    if isinstance(command, str):
        paths = [
            match.group(1)
            for item in command.split(" && ")
            if (match := re.fullmatch(
                r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
                item,
            ))
        ]
        v.exact(len(paths), 18, "People current-contract command count")
        v.exact(len(paths), len(set(paths)), "People duplicate validator command")
        v.exact(paths[-1], LIFECYCLE_CORRECTION_VALIDATOR, "People governing validator order")
    blobs["package.json"] = package_data

    v.exact(artifact(PEOPLE_AUTHORITY, blobs[PEOPLE_AUTHORITY]), PEOPLE_AUTHORITY_PIN, "People authority pin")
    authority = load_json(blobs[PEOPLE_AUTHORITY], "People integration authority")
    v.exact(authority.get("schema"), "dwp.hris.wave7.hrm013-people-rebase-central-integration-authority.v1", "People authority schema")
    v.exact(authority.get("state"), "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_PEOPLE_POST_REBASE_INTEGRATION", "People authority state")
    v.exact(authority.get("carrier"), {
        "repository": "dwp-frontend", "branch": PEOPLE_BRANCH,
        "baseCommit": PEOPLE_BASE, "baseTree": PEOPLE_BASE_TREE,
        "requiredDirectChild": True, "exactChangedPathCount": 12,
        "exactChangedPaths": [*PEOPLE_VALIDATORS, PEOPLE_AUTHORITY, PEOPLE_REVIEW],
    }, "People authority carrier")
    v.exact(authority.get("authority"), {
        "independentReviewComplete": True,
        "exactTwelvePathCarrierCommitAndPushAuthorized": True,
        "frontendDwpDevDirectFastForwardToExactCarrierAuthorized": True,
        "exactOneGovernanceAncestryMergeAuthorizedAfterCarrierInForce": True,
        "peopleDirectFastForwardAuthorizedAfterGovernanceClosure": True,
        "historical626e1deIntegrationAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "featureActivationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "runtimeCredentialProvisioningAuthorized": False,
        "productionReleaseAuthorized": False,
        "businessCompletionCredit": 0,
    }, "People authority flags")

    review = load_json(blobs[PEOPLE_REVIEW], "People integration review")
    v.exact(set(review), {
        "schema", "state", "reviewedAt", "reviewer", "scope", "findings",
        "finalVerdict", "authority", "artifactPins",
    }, "People integration review key set")
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-people-rebase-central-integration-independent-review.v1", "People review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_TWELVE_PATH_PEOPLE_POST_REBASE_INTEGRATION", "People review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_PEOPLE_REBASE_INTEGRATION_REVIEW", "People reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": PEOPLE_AUTHORITY,
        "governingValidatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
        "modifiedValidatorPaths": PEOPLE_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_PRE_GOVERNANCE_DIRECT_CHILD_TWELVE_PATH_CARRIER",
            "HISTORICAL_626E1DE_REMAINS_IMMUTABLE_HISTORY_ONLY",
            "ONLY_EXACT_8CCC7BAE_POST_REBASE_SUCCESSOR_MAY_FAST_FORWARD",
            "EXACT_ONE_NO_FF_GOVERNANCE_ANCESTRY_MERGE_AFTER_AUTHORITY_IN_FORCE",
            "TEN_CURRENT_VALIDATOR_BLOBS_AND_UNCHANGED_EIGHTEEN_COMMAND_PACKAGE",
            "NO_FEATURE_TENANT_CREDENTIAL_OR_PRODUCTION_AUTHORITY",
        ],
    }, "People review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "People review findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_PEOPLE_POST_REBASE_CORRECTION_GOVERNANCE_ANCESTRY_MERGE_AND_8CCC7BAE_FAST_FORWARD_AFTER_CLOSURE",
    }, "People review verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactTwelvePathCarrierCommitAndPushAuthorized": True,
        "frontendDwpDevFastForwardToExactCarrierAuthorized": True,
        "exactOneGovernanceAncestryMergeAuthorizedAfterCarrierInForce": True,
        "exact8ccc7baeFastForwardAuthorizedAfterGovernanceClosure": True,
        "historical626e1deIntegrationAuthorized": False,
        "additionalSourceOrTestChangeAuthorized": False,
        "featureActivationOrTenantOrCredentialOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "People review authority")
    v.exact(review.get("artifactPins"), [
        artifact(PEOPLE_AUTHORITY, blobs[PEOPLE_AUTHORITY]),
        *[artifact(path, blobs[path]) for path in PEOPLE_VALIDATORS],
        artifact("package.json", package_data),
    ], "People review pins")

    targeted = people_receipt(
        v, RECEIPTS / "people-owner-runtime-post-rebase-targeted-verification-receipt.v1.json",
        7063, "d9768f87e11b6bfa516f79ed20423d33af7cfd5bd58aa059dd9d4d0c69c57881",
    )
    post = people_receipt(
        v, RECEIPTS / "people-owner-runtime-post-rebase-independent-review.v1.json",
        7184, "52bd5980120e9c2c19df94ed8fc53eaf607687f426c69d4579fc8b4bd3648d38",
    )
    approval = people_receipt(
        v, RECEIPTS / "approval-runtime-central-integration-receipt.v1.json",
        9407, "f988c7bc9d72d7e34c22a0ae57684b347ab96d9be94cf7e088a9ba1cc5f0be3b",
    )
    governance_receipt = people_receipt(
        v, RECEIPTS / "backend-descendants" /
        f"{PEOPLE_BACKEND_COMMIT}.hrm013-shared-contract-governance.v1.json",
        10313, "51a0f53b0333c4a998a91c6a1e8eef3034cb5411af8cd640201c422010ef306f",
    )
    v.exact(targeted.get("decision"), "TARGETED_VERIFICATION_PASS_INDEPENDENT_POST_REBASE_REVIEW_REQUIRED_BEFORE_BRANCH_PUSH_OR_INTEGRATION", "People targeted decision")
    v.exact(post.get("decision"), "GO_FOR_EXACT_POST_REBASE_PEOPLE_OWNER_RUNTIME_BRANCH_COMMIT_PUSH_ONLY", "People post-rebase decision")
    v.exact(post.get("findings"), {"p0": 0, "p1": 0, "p2": 0}, "People post-rebase findings")
    v.exact(approval.get("state"), "APPROVAL_RESEAL_INTEGRATION_SUCCESSOR_IN_FORCE_BACKEND_INTEGRATED", "Approval prerequisite state")
    v.exact(
        (governance_receipt.get("immediateParentCommit"), governance_receipt.get("descendantCommit"),
         governance_receipt.get("descendantTree"), governance_receipt.get("governingFrontendCarrierCommit"),
         governance_receipt.get("decision")),
        (PEOPLE_BACKEND_BASE, PEOPLE_BACKEND_COMMIT, PEOPLE_BACKEND_TREE,
         PEOPLE_GOVERNANCE_COMMIT, "GO_FOR_EXACT_BACKEND_DESCENDANT_GOVERNANCE_ONLY"),
        "People governance receipt identity",
    )

    v.exact(
        text(BACKEND, "rev-list", "--parents", "-n", "1", PEOPLE_BACKEND_COMMIT).split(),
        [PEOPLE_BACKEND_COMMIT, PEOPLE_BACKEND_BASE],
        "People backend successor parent",
    )
    v.exact(text(BACKEND, "rev-parse", f"{PEOPLE_BACKEND_COMMIT}^{{tree}}"), PEOPLE_BACKEND_TREE, "People backend tree")
    v.exact(text(BACKEND, "rev-parse", f"origin/{PEOPLE_BACKEND_BRANCH}"), PEOPLE_BACKEND_COMMIT, "People backend branch push")
    v.exact(len(between(BACKEND, PEOPLE_BACKEND_BASE, PEOPLE_BACKEND_COMMIT)), 46, "People backend path count")
    v.exact(
        text(FRONTEND, "rev-list", "--parents", "-n", "1", PEOPLE_GOVERNANCE_COMMIT).split(),
        [PEOPLE_GOVERNANCE_COMMIT, PEOPLE_GOVERNANCE_PARENT],
        "People governance carrier parent",
    )
    v.exact(text(FRONTEND, "rev-parse", f"{PEOPLE_GOVERNANCE_COMMIT}^{{tree}}"), PEOPLE_GOVERNANCE_TREE, "People governance tree")
    v.exact(
        between(FRONTEND, PEOPLE_GOVERNANCE_PARENT, PEOPLE_GOVERNANCE_COMMIT),
        {PEOPLE_GOVERNANCE_AUTHORITY, PEOPLE_GOVERNANCE_REVIEW},
        "People governance paths",
    )
    v.exact(text(FRONTEND, "rev-parse", f"origin/{PEOPLE_GOVERNANCE_BRANCH}"), PEOPLE_GOVERNANCE_COMMIT, "People governance push")
    for path, expected in {
        PEOPLE_GOVERNANCE_AUTHORITY: {
            "path": PEOPLE_GOVERNANCE_AUTHORITY, "bytes": 9928,
            "sha256": "01b59c84d3ebedaa0081ac321432724128bf0ef3ea5f7eb8077ebf77f5faa05b",
        },
        PEOPLE_GOVERNANCE_REVIEW: {
            "path": PEOPLE_GOVERNANCE_REVIEW, "bytes": 2187,
            "sha256": "849416fbf4ec8664ae8c999007be755a14e58158a10a0509d869fa14995eba42",
        },
    }.items():
        data = blob(FRONTEND, PEOPLE_GOVERNANCE_COMMIT, path)
        v.require(data is not None, f"People governance artifact missing: {path}")
        v.exact(artifact(path, data or b""), expected, f"People governance artifact pin: {path}")

    reviewed_at = parse_time(review.get("reviewedAt"), "People integration reviewedAt")
    evidence_at = parse_time(governance_receipt.get("recordedAt"), "People governance recordedAt")
    v.require(evidence_at <= reviewed_at, "People integration review predates governance evidence")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(int((FRONTEND / path).stat().st_mtime), timezone.utc)
            for path in [PEOPLE_AUTHORITY, *PEOPLE_VALIDATORS, "package.json"]
        )
        v.require(latest <= reviewed_at, "People review predates authoring snapshot")
    else:
        committed_at = parse_time(
            text(FRONTEND, "show", "-s", "--format=%cI", commit),
            "People integration carrier committedAt",
        )
        v.require(reviewed_at <= committed_at, "People review follows carrier commit")

    v.exact(text(BACKEND, "branch", "--show-current"), "dwp-dev", "People backend branch")
    backend_head = text(BACKEND, "rev-parse", "HEAD")
    v.exact(backend_head, text(BACKEND, "rev-parse", "origin/dwp-dev"), "People backend HEAD/origin drift")
    v.require(not changes(BACKEND), "People backend default dirty")
    v.require(backend_head in {PEOPLE_BACKEND_BASE, PEOPLE_BACKEND_COMMIT}, "unexpected People backend state")
    governance_merged = (
        ancestor(FRONTEND, PEOPLE_GOVERNANCE_COMMIT, head)
        and ancestor(FRONTEND, PEOPLE_GOVERNANCE_COMMIT, origin)
    )
    if authoring:
        v.exact(backend_head, PEOPLE_BACKEND_BASE, "backend moved during People authoring")
        v.require(not governance_merged, "People governance merged during authority authoring")
        state = "PEOPLE_REBASE_INTEGRATION_SUCCESSOR_READY_TO_COMMIT_AND_PUSH"
    elif not governance_merged:
        v.exact(backend_head, PEOPLE_BACKEND_BASE, "backend moved before People governance closure")
        state = "PEOPLE_REBASE_INTEGRATION_AUTHORITY_IN_FORCE_GOVERNANCE_MERGE_REQUIRED"
    else:
        merges = []
        for line in text(FRONTEND, "rev-list", "--parents", f"{commit}..{head}").splitlines():
            parts = line.split()
            if len(parts) == 3 and parts[1:] == [commit, PEOPLE_GOVERNANCE_COMMIT]:
                merges.append(parts[0])
        v.exact(len(merges), 1, "People governance requires exactly one authorized two-parent merge")
        merge_commit = merges[0]
        governance_paths = {PEOPLE_GOVERNANCE_AUTHORITY, PEOPLE_GOVERNANCE_REVIEW}
        v.exact(
            between(FRONTEND, commit, merge_commit), governance_paths,
            "People governance merge first-parent path set",
        )
        for path in governance_paths:
            v.exact(
                mode(FRONTEND, merge_commit, path), "100644",
                f"People governance merge regular non-symlink mode: {path}",
            )
            merged = blob(FRONTEND, merge_commit, path)
            governed = blob(FRONTEND, PEOPLE_GOVERNANCE_COMMIT, path)
            v.require(merged is not None and governed is not None, f"People governance merge blob missing: {path}")
            v.exact(merged, governed, f"People governance merge blob drift: {path}")
        expected = git(
            FRONTEND, "merge-tree", "--write-tree", "--no-messages",
            commit, PEOPLE_GOVERNANCE_COMMIT, check=False,
        )
        v.exact(expected.returncode, 0, "People governance clean three-way merge probe")
        expected_trees = expected.stdout.decode("ascii", errors="strict").strip().splitlines()
        v.exact(len(expected_trees), 1, "People governance expected merge-tree output")
        v.exact(
            text(FRONTEND, "rev-parse", f"{merge_commit}^{{tree}}"),
            expected_trees[0],
            "People governance merge tree differs from clean three-way result",
        )
        state = (
            "PEOPLE_REBASE_INTEGRATION_GOVERNANCE_CLOSED_READY_FOR_BACKEND_FF"
            if backend_head == PEOPLE_BACKEND_BASE
            else "PEOPLE_REBASE_INTEGRATION_SUCCESSOR_IN_FORCE_BACKEND_INTEGRATED"
        )
    return {"commit": commit, "blobs": blobs, "state": state}



def lifecycle_correction(
    v: V, authoring: bool = False, reseal_authoring: bool = False,
    people_authoring: bool = False,
) -> dict[str, Any]:
    v.exact(
        text(FRONTEND, "rev-parse", f"{LIFECYCLE_CORRECTION_BASE}^{{tree}}"),
        LIFECYCLE_CORRECTION_BASE_TREE,
        "lifecycle correction base tree",
    )
    v.exact(
        text(FRONTEND, "rev-list", "--parents", "-n", "1", APPROVAL_INTEGRATION_COMMIT).split(),
        [APPROVAL_INTEGRATION_COMMIT, APPROVAL_INTEGRATION_PARENT],
        "Approval integration carrier parent",
    )
    v.exact(
        text(FRONTEND, "rev-parse", f"{APPROVAL_INTEGRATION_COMMIT}^{{tree}}"),
        APPROVAL_INTEGRATION_TREE,
        "Approval integration carrier tree",
    )
    v.exact(
        between(FRONTEND, APPROVAL_INTEGRATION_PARENT, APPROVAL_INTEGRATION_COMMIT),
        APPROVAL_INTEGRATION_PATHS,
        "Approval integration carrier paths",
    )
    hardened = blob(FRONTEND, APPROVAL_INTEGRATION_COMMIT, HARDENED_AUTH_RUNTIME_VALIDATOR)
    v.require(hardened is not None, "hardened Auth runtime validator missing")
    v.exact(
        artifact(HARDENED_AUTH_RUNTIME_VALIDATOR, hardened or b""),
        {
            "path": HARDENED_AUTH_RUNTIME_VALIDATOR,
            "bytes": 34031,
            "sha256": "a84254807daebc854ae35c9c6388869d02ba4129deda3a94312a367fad117b1c",
        },
        "hardened Auth runtime validator pin",
    )

    if authoring:
        v.exact(text(FRONTEND, "branch", "--show-current"), LIFECYCLE_CORRECTION_BRANCH, "correction branch")
        v.exact(text(FRONTEND, "rev-parse", "HEAD"), LIFECYCLE_CORRECTION_BASE, "correction authoring head")
        v.exact(text(FRONTEND, "rev-parse", "origin/dwp-dev"), LIFECYCLE_CORRECTION_BASE, "correction authoring origin")
        v.exact(changes(FRONTEND), LIFECYCLE_CORRECTION_PATHS, "correction authoring paths")
        commit = None
    else:
        additions: list[str] = []
        for path in (
            LIFECYCLE_CORRECTION_AUTHORITY,
            LIFECYCLE_CORRECTION_REVIEW,
            LIFECYCLE_CORRECTION_VALIDATOR,
        ):
            found = [
                line for line in text(
                    FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path,
                ).splitlines() if line
            ]
            v.require(len(found) == 1, f"lifecycle correction introduction ambiguous: {path}")
            additions.extend(found)
        v.exact(len(set(additions)), 1, "lifecycle correction artifacts introduced separately")
        commit = additions[0] if additions else ""
        v.exact(
            text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(),
            [commit, LIFECYCLE_CORRECTION_BASE],
            "lifecycle correction is not the exact direct child",
        )
        v.exact(
            between(FRONTEND, LIFECYCLE_CORRECTION_BASE, commit),
            LIFECYCLE_CORRECTION_PATHS,
            "lifecycle correction path set",
        )
        head = text(FRONTEND, "rev-parse", "HEAD")
        origin = text(FRONTEND, "rev-parse", "origin/dwp-dev")
        v.require(
            ancestor(FRONTEND, commit, head) and ancestor(FRONTEND, commit, origin),
            "lifecycle correction is not on pushed frontend dwp-dev",
        )
        if reseal_authoring:
            v.exact(text(FRONTEND, "branch", "--show-current"), RESEAL_BRANCH, "Approval reseal branch")
            v.exact(head, RESEAL_BASE, "Approval reseal base during lifecycle validation")
            v.exact(changes(FRONTEND), RESEAL_PATHS, "Approval reseal paths during lifecycle validation")
        elif people_authoring:
            v.exact(text(FRONTEND, "branch", "--show-current"), PEOPLE_BRANCH, "People integration branch")
            v.exact(head, PEOPLE_BASE, "People integration base during lifecycle validation")
            v.exact(changes(FRONTEND), PEOPLE_PATHS, "People integration paths during lifecycle validation")
        else:
            v.exact(head, origin, "frontend HEAD/origin drift after lifecycle correction")
            v.exact(changes(FRONTEND), set(), "frontend dirty after lifecycle correction")

    reseal = None if authoring else approval_reseal_successor(
        v, reseal_authoring, people_authoring=people_authoring,
    )
    reseal_blobs = {} if reseal is None else reseal["blobs"]
    people = None if authoring or reseal_authoring else people_rebase_successor(
        v, people_authoring,
    )
    people_blobs = {} if people is None else people["blobs"]

    blobs: dict[str, bytes] = {}
    for path in [
        LIFECYCLE_CORRECTION_AUTHORITY,
        LIFECYCLE_CORRECTION_REVIEW,
        LIFECYCLE_CORRECTION_VALIDATOR,
        *LIFECYCLE_VALIDATORS,
        "package.json",
    ]:
        if commit is None:
            candidate = FRONTEND / path
            v.require(candidate.is_file() and not candidate.is_symlink(), f"correction artifact missing: {path}")
            v.exact(stat.S_IMODE(candidate.stat().st_mode), 0o644, f"correction artifact mode: {path}")
            data = candidate.read_bytes()
        else:
            v.exact(mode(FRONTEND, commit, path), "100644", f"correction carrier mode: {path}")
            data = blob(FRONTEND, commit, path)
            v.require(data is not None, f"correction carrier artifact missing: {path}")
            data = data or b""
            v.exact(mode(FRONTEND, text(FRONTEND, "rev-parse", "HEAD"), path), "100644", f"current correction mode: {path}")
            v.require(symlink_free(FRONTEND, path), f"current correction artifact symlinked: {path}")
            expected_live = people_blobs.get(path, reseal_blobs.get(path, data))
            v.exact(
                artifact(path, (FRONTEND / path).read_bytes()),
                artifact(path, expected_live),
                f"current correction artifact drift: {path}",
            )
        blobs[path] = data

    base_package = blob(FRONTEND, LIFECYCLE_CORRECTION_BASE, "package.json")
    v.require(base_package is not None, "correction base package missing")
    v.exact(
        artifact("package.json", base_package or b""),
        {
            "path": "package.json", "bytes": 16469,
            "sha256": "0e496cced22dbc11a4c9dfd7315f83d8ae6c905ec99c4cec166a6437b6a6e3ee",
        },
        "correction base package pin",
    )
    base_package_json = load_json(base_package or b"", "lifecycle correction base package")
    base_command = base_package_json["scripts"]["hris:current-contracts:check"]
    successor_command = base_command + " && python3 " + LIFECYCLE_CORRECTION_VALIDATOR
    old_command = json.dumps(base_command, ensure_ascii=False).encode()[1:-1]
    new_command = json.dumps(successor_command, ensure_ascii=False).encode()[1:-1]
    v.exact((base_package or b"").count(old_command), 1, "base package command byte count")
    expected_package = (base_package or b"").replace(old_command, new_command, 1)
    v.exact(blobs["package.json"], expected_package, "lifecycle correction package bytes drift")
    package = load_json(blobs["package.json"], "lifecycle correction package")
    scripts = package.get("scripts")
    v.require(isinstance(scripts, dict), "lifecycle correction scripts missing")
    if isinstance(scripts, dict):
        v.require("prehris:current-contracts:check" not in scripts, "lifecycle correction npm pre-hook")
        v.require("posthris:current-contracts:check" not in scripts, "lifecycle correction npm post-hook")
        command = scripts.get("hris:current-contracts:check")
        v.require(isinstance(command, str), "lifecycle correction chain missing")
        if isinstance(command, str):
            parts = command.split(" && ")
            matches = [re.fullmatch(
                r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
                item,
            ) for item in parts]
            v.require(all(matches), "lifecycle correction contains a non-validator command")
            validator_paths = [match.group(1) for match in matches if match]
            v.exact(len(validator_paths), len(set(validator_paths)), "lifecycle correction duplicate validator")
            v.exact(validator_paths[-1], LIFECYCLE_CORRECTION_VALIDATOR, "lifecycle correction validator order")
    correction_validator = FRONTEND / LIFECYCLE_CORRECTION_VALIDATOR
    v.require(
        correction_validator.is_file() and not correction_validator.is_symlink(),
        "lifecycle correction validator missing or symlinked",
    )
    tracked = git(
        FRONTEND, "ls-files", "--error-unmatch", "--",
        LIFECYCLE_CORRECTION_VALIDATOR, check=False,
    )
    v.require(tracked.returncode == 0, "lifecycle correction validator is untracked")
    v.exact(
        artifact("package.json", (FRONTEND / "package.json").read_bytes()),
        artifact("package.json", blobs["package.json"]),
        "live package drift during lifecycle correction",
    )

    authority = load_json(blobs[LIFECYCLE_CORRECTION_AUTHORITY], "lifecycle correction authority")
    v.exact(authority, expected_lifecycle_correction_authority(), "lifecycle correction authority drift")
    review = load_json(blobs[LIFECYCLE_CORRECTION_REVIEW], "lifecycle correction review")
    v.exact(
        set(review),
        {"schema", "state", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"},
        "lifecycle correction review key set",
    )
    v.exact(review.get("schema"), "dwp.hris.wave7.hrm013-validator-lifecycle-successor-independent-review.v1", "lifecycle review schema")
    v.exact(review.get("state"), "INDEPENDENT_ZERO_FINDING_REVIEW_OF_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR", "lifecycle review state")
    v.exact(review.get("reviewer"), "INDEPENDENT_HRM013_VALIDATOR_LIFECYCLE_SUCCESSOR_REVIEW", "lifecycle reviewer")
    v.exact(review.get("scope"), {
        "authorityPath": LIFECYCLE_CORRECTION_AUTHORITY,
        "reviewPath": LIFECYCLE_CORRECTION_REVIEW,
        "validatorPath": LIFECYCLE_CORRECTION_VALIDATOR,
        "modifiedValidatorPaths": LIFECYCLE_VALIDATORS,
        "packagePath": "package.json",
        "reviewedBoundaries": [
            "EXACT_DIRECT_CHILD_SEVEN_PATH_CARRIER",
            "ORIGINAL_AUTHORITY_REVIEW_AND_TOKEN_BLOBS_REMAIN_IMMUTABLE",
            "ONLY_THREE_VALIDATOR_BLOBS_USE_THE_CORRECTION_CARRIER",
            "AUTH_RUNTIME_HARDENING_BOUND_TO_EXACT_APPROVAL_INTEGRATION_CARRIER",
            "EXACT_SINGLE_VALIDATOR_PACKAGE_APPEND_AND_NO_BACKEND_OR_ACTIVATION_AUTHORITY",
        ],
    }, "lifecycle review scope")
    v.exact(review.get("findings"), {"p0": [], "p1": [], "p2": []}, "lifecycle review findings")
    v.exact(review.get("finalVerdict"), {
        "p0": 0, "p1": 0, "p2": 0,
        "decision": "GO_FOR_EXACT_SEVEN_PATH_VALIDATOR_LIFECYCLE_SUCCESSOR_ONLY",
    }, "lifecycle review verdict")
    v.exact(review.get("authority"), {
        "independentReviewComplete": True,
        "exactSevenPathCarrierCommitAndPushAuthorized": True,
        "currentContractChainRevalidationAuthorized": True,
        "exactSingleValidatorPackageAppendAuthorized": True,
        "backendDwpDevIntegrationAuthorized": False,
        "featureActivationOrProductionAuthority": False,
        "businessCompletionCredit": 0,
    }, "lifecycle review authority")
    v.exact(review.get("artifactPins"), [
        artifact(LIFECYCLE_CORRECTION_AUTHORITY, blobs[LIFECYCLE_CORRECTION_AUTHORITY]),
        artifact(LIFECYCLE_CORRECTION_VALIDATOR, blobs[LIFECYCLE_CORRECTION_VALIDATOR]),
        *[artifact(path, blobs[path]) for path in LIFECYCLE_VALIDATORS],
        artifact("package.json", blobs["package.json"]),
    ], "lifecycle review artifact pins")
    reviewed_at = parse_time(review.get("reviewedAt"), "lifecycle correction reviewedAt")
    v.require(
        reviewed_at <= datetime.now(timezone.utc) + timedelta(minutes=5),
        "lifecycle correction review is in the future",
    )
    base_at = parse_time(
        text(FRONTEND, "show", "-s", "--format=%cI", LIFECYCLE_CORRECTION_BASE),
        "lifecycle correction base committedAt",
    )
    hardening_at = parse_time(
        text(FRONTEND, "show", "-s", "--format=%cI", APPROVAL_INTEGRATION_COMMIT),
        "Approval integration committedAt",
    )
    v.require(max(base_at, hardening_at) <= reviewed_at, "lifecycle review predates its prerequisites")
    if commit is None:
        latest = max(
            datetime.fromtimestamp(
                int((FRONTEND / path).stat().st_mtime), timezone.utc,
            )
            for path in [
                LIFECYCLE_CORRECTION_AUTHORITY,
                LIFECYCLE_CORRECTION_VALIDATOR,
                *LIFECYCLE_VALIDATORS,
                "package.json",
            ]
        )
        v.require(latest <= reviewed_at, "lifecycle review predates final authoring snapshot")
    else:
        committed_at = parse_time(
            text(FRONTEND, "show", "-s", "--format=%cI", commit),
            "lifecycle correction committedAt",
        )
        v.require(reviewed_at <= committed_at, "lifecycle review follows correction commit")
    current_blobs = {**blobs, **{
        path: data for path, data in reseal_blobs.items()
        if path in [*LIFECYCLE_VALIDATORS, LIFECYCLE_CORRECTION_VALIDATOR]
    }, **{
        path: data for path, data in people_blobs.items()
        if path in [*LIFECYCLE_VALIDATORS, LIFECYCLE_CORRECTION_VALIDATOR]
    }}
    return {
        "commit": commit,
        "blobs": blobs,
        "currentBlobs": current_blobs,
        "hardenedAuthRuntimeValidator": hardened or b"",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authoring", action="store_true")
    parser.add_argument("--lifecycle-correction-authoring", action="store_true")
    parser.add_argument("--approval-reseal-authoring", action="store_true")
    parser.add_argument("--people-rebase-authoring", action="store_true")
    parser.add_argument("--require-trusted", action="store_true")
    args = parser.parse_args()
    v = V()
    try:
        isolated = runtime(
            v,
            args.require_trusted or args.authoring
            or args.lifecycle_correction_authoring
            or args.approval_reseal_authoring
            or args.people_rebase_authoring,
        )
        v.require(
            sum((
                args.lifecycle_correction_authoring,
                args.approval_reseal_authoring,
                args.people_rebase_authoring,
            )) <= 1,
            "correction authoring modes are mutually exclusive",
        )
        if args.people_rebase_authoring:
            lifecycle_correction(v, people_authoring=True)
            print(
                "PASS state=PEOPLE_REBASE_INTEGRATION_SUCCESSOR_READY_TO_COMMIT_AND_PUSH "
                f"checks={v.checks} trusted_runtime={'true' if isolated else 'false'}"
            )
            return 0
        if args.approval_reseal_authoring:
            lifecycle_correction(v, reseal_authoring=True)
            print(
                "PASS state=APPROVAL_RESEAL_INTEGRATION_SUCCESSOR_READY_TO_COMMIT_AND_PUSH "
                f"checks={v.checks} trusted_runtime={'true' if isolated else 'false'}"
            )
            return 0
        if args.lifecycle_correction_authoring:
            lifecycle_correction(v, authoring=True)
            print(
                "PASS state=VALIDATOR_LIFECYCLE_SUCCESSOR_READY_TO_COMMIT_AND_PUSH "
                f"checks={v.checks} trusted_runtime={'true' if isolated else 'false'}"
            )
            return 0
        negatives(v)
        v.require(SCRIPT == SCRIPT.resolve(), "validator path symlinked")
        hygiene(v, FRONTEND)
        hygiene(v, BACKEND)
        targeted_data, post_data, governance_data = check_static_evidence(v)
        central_present = present(CENTRAL_RECEIPT)
        backend_head = backend_default(v, authoring_mode=args.authoring, central_present=central_present)
        if args.authoring:
            carrier = authoring(v)
            state = "AUTH_V62_CENTRAL_INTEGRATION_CARRIER_AUTHORING_RECEIPT_NOT_YET_ALLOWED"
        else:
            carrier = historical(v)
            if not central_present:
                v.require(not present(V271_DELEGATION_RECEIPT), "V271 delegation receipt precedes central receipt")
                state = "AUTH_V62_CENTRAL_INTEGRATION_CARRIER_PUSHED_EXTERNAL_RECEIPT_REQUIRED"
            else:
                central_data, central_recorded_at = check_central_receipt(
                    v, carrier, targeted_data, post_data, governance_data,
                )
                action = post_central_action(backend_head, present(V271_DELEGATION_RECEIPT))
                if action == "BASE_READY":
                    state = "AUTH_V62_GENERATION_CENTRAL_INTEGRATION_AUTHORITY_READY"
                elif action == "GENERATION_INTEGRATED":
                    v.exact(text(BACKEND, "rev-list", "--parents", "-n", "1", backend_head).split(), [GENERATION_COMMIT, BACKEND_BASE], "integrated generation commit topology drift")
                    state = "AUTH_V62_GENERATION_DIRECT_FAST_FORWARD_INTEGRATED"
                else:
                    state = check_v271_delegation(
                        v, carrier, central_data, central_recorded_at, backend_head,
                    )
        print(
            f"PASS state={state} checks={v.checks} "
            f"trusted_runtime={'true' if isolated else 'false'} receipt_issuance=external-only"
        )
        return 0
    except (VerificationError, OSError, UnicodeError, KeyError, TypeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
