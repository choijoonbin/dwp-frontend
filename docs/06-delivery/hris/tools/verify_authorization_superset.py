#!/usr/bin/env python3
"""Verify the reconciled v33 authorization semantics are a subset of current v34."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any


CURRENT_COMMIT = "5612cc1a0b4a21a4d0b9107739579f23d165790f"
CURRENT_PATH = "contracts/product-authorization/product-surfaces-v1.bundle-v34.json"
CURRENT_SHA256 = "8edd29e91a915fc035028c44af4055673bf5e53c7a5ca77e2af381d69bc60135"
CURRENT_SEMANTIC_CHECKSUM = "852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b"
RECONCILED_COMMIT = "0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294"
RECONCILED_PATH = "contracts/product-authorization/product-surfaces-v1.bundle-v33.json"
RECONCILED_SHA256 = "0616d24f6ed473bcec3f0fae3edeffeefa3632648732e26bfc884d91b2eed456"
RECONCILED_SEMANTIC_CHECKSUM = "254ead674e1126d50e8dcf1011486ea1127fb2479f7a82d832cdf0466995bc49"

IDENTITY_KEYS = {
    "routes": "routeContractKey",
    "capabilities": "contractKey",
    "accessPolicies": "accessPolicyKey",
    "predicatePolicies": "predicatePolicyKey",
    "entitlementExpressions": "expressionKey",
    "authorityEndpoints": "endpointKey",
}

EXPECTED_CURRENT_ONLY = {
    "routes": {
        "route.communications.management.code-sets.data",
        "route.hcm.operations.assignment-detail.data",
        "route.hcm.operations.assignment-proposal-cancel.action",
        "route.hcm.operations.assignment-proposal-create.action",
        "route.hcm.operations.assignment-proposal-detail.data",
        "route.hcm.operations.assignment-proposal-submit.action",
        "route.hcm.operations.assignment-proposal-validate.action",
        "route.hcm.operations.assignment-timeline.data",
    },
    "capabilities": {
        "hcm.operations.assignment-proposal.cancel",
        "hcm.operations.assignment-proposal.create",
        "hcm.operations.assignment-proposal.submit",
        "hcm.operations.assignment-proposal.validate",
    },
    "accessPolicies": set(),
    "predicatePolicies": {"predicate.communications-code-set.v1"},
    "entitlementExpressions": set(),
    "authorityEndpoints": set(),
}

EXPECTED_EXPANDED_COMMON = {
    "capabilities": {
        "hcm.operations.workforce.read",
        "communications.content.read",
    },
    "predicatePolicies": {
        "predicate.hcm-workforce-visible-person.v1",
        "predicate.people.object-version.v1",
    },
}


def git_show(repo: Path, commit: str, path: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), "show", f"{commit}:{path}"])


def fail(message: str) -> None:
    raise AssertionError(message)


def without_route_keys(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if key != "routeContractKeys"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", type=Path, default=Path(__file__).resolve().parents[5] / "dwp-backend")
    args = parser.parse_args()
    backend = args.backend.resolve()

    current_bytes = git_show(backend, CURRENT_COMMIT, CURRENT_PATH)
    reconciled_bytes = git_show(backend, RECONCILED_COMMIT, RECONCILED_PATH)
    if hashlib.sha256(current_bytes).hexdigest() != CURRENT_SHA256:
        fail("current v34 byte SHA drift")
    if hashlib.sha256(reconciled_bytes).hexdigest() != RECONCILED_SHA256:
        fail("reconciled v33 byte SHA drift")
    current = json.loads(current_bytes)
    reconciled = json.loads(reconciled_bytes)
    if current.get("checksum") != CURRENT_SEMANTIC_CHECKSUM:
        fail("current v34 semantic checksum drift")
    if reconciled.get("checksum") != RECONCILED_SEMANTIC_CHECKSUM:
        fail("reconciled v33 semantic checksum drift")

    result: dict[str, Any] = {}
    observed_expanded: dict[str, set[str]] = {}
    for collection, identity_key in IDENTITY_KEYS.items():
        current_by_id = {item[identity_key]: item for item in current[collection]}
        reconciled_by_id = {item[identity_key]: item for item in reconciled[collection]}
        reconciled_only = set(reconciled_by_id) - set(current_by_id)
        current_only = set(current_by_id) - set(reconciled_by_id)
        if reconciled_only:
            fail(f"{collection} has reconciled-only identities: {sorted(reconciled_only)}")
        if current_only != EXPECTED_CURRENT_ONLY[collection]:
            fail(f"{collection} current-only identity drift")

        expanded: set[str] = set()
        for identity in sorted(set(current_by_id) & set(reconciled_by_id)):
            current_item = current_by_id[identity]
            reconciled_item = reconciled_by_id[identity]
            if current_item == reconciled_item:
                continue
            if without_route_keys(current_item) != without_route_keys(reconciled_item):
                fail(f"{collection}/{identity} differs outside routeContractKeys")
            current_routes = set(current_item.get("routeContractKeys", []))
            reconciled_routes = set(reconciled_item.get("routeContractKeys", []))
            if not reconciled_routes < current_routes:
                fail(f"{collection}/{identity} routeContractKeys are not a strict current superset")
            expanded.add(identity)
        observed_expanded[collection] = expanded
        result[collection] = {
            "currentCount": len(current_by_id),
            "reconciledCount": len(reconciled_by_id),
            "currentOnly": sorted(current_only),
            "reconciledOnly": [],
            "expandedCommon": sorted(expanded),
        }

    expected_expanded = {key: value for key, value in EXPECTED_EXPANDED_COMMON.items()}
    actual_expanded = {key: value for key, value in observed_expanded.items() if value}
    if actual_expanded != expected_expanded:
        fail("expanded common identity set drift")

    print(
        json.dumps(
            {
                "status": "PASS",
                "decision": "RECONCILED_V33_IS_SEMANTIC_SUBSET_OF_CURRENT_V34",
                "current": {
                    "commit": CURRENT_COMMIT,
                    "path": CURRENT_PATH,
                    "sha256": CURRENT_SHA256,
                    "semanticChecksum": CURRENT_SEMANTIC_CHECKSUM,
                },
                "reconciled": {
                    "commit": RECONCILED_COMMIT,
                    "path": RECONCILED_PATH,
                    "sha256": RECONCILED_SHA256,
                    "semanticChecksum": RECONCILED_SEMANTIC_CHECKSUM,
                },
                "collections": result,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
