#!/usr/bin/env python3
"""Generate the deterministic HRIS G1 merge/conflict inventory.

The command is read-only with respect to both Git repositories.  It uses
``git merge-tree`` so a conflict inventory can be refreshed without mutating
either integration worktree or repeatedly attempting a real merge.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path


PACKET_ID = "HRIS-G1-INTEGRATION-LOCK-20261006-R1"
REPOSITORIES = {
    "frontend": {
        "current": "08a05f764a7c6dec38cce2627b81bcb8ef87ee6c",
        "reconciled": "7f39d12cd10b8827c67355a7f445973d05373cc9",
        "integrationBranch": "codex/hris-g1-integration-frontend-20261006",
    },
    "backend": {
        "current": "5612cc1a0b4a21a4d0b9107739579f23d165790f",
        "reconciled": "0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294",
        "integrationBranch": "codex/hris-g1-integration-backend-20261006",
    },
}


def git(repo: Path, *args: str, accepted: tuple[int, ...] = (0,)) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode not in accepted:
        raise RuntimeError(
            f"git {' '.join(args)} failed with {result.returncode}:\n{result.stdout}"
        )
    return result.stdout


def changed_paths(repo: Path, base: str, tip: str) -> tuple[list[str], dict[str, int]]:
    names = sorted(
        line
        for line in git(repo, "diff", "--name-only", f"{base}..{tip}").splitlines()
        if line
    )
    states: Counter[str] = Counter()
    for line in git(repo, "diff", "--name-status", f"{base}..{tip}").splitlines():
        if line:
            states[line.split("\t", 1)[0][0]] += 1
    labels = {"A": "added", "D": "deleted", "M": "modified", "R": "renamed"}
    return names, {labels.get(key, key): value for key, value in sorted(states.items())}


def cluster(kind: str, path: str) -> str:
    lowered = path.lower()
    if kind == "frontend":
        if lowered.endswith(".png"):
            return "VISUAL_SNAPSHOT"
        if "shared-i18n" in lowered:
            return "I18N"
        if "assignment" in lowered:
            return "ASSIGNMENT"
        if any(token in lowered for token in ("product-surface", "pilot-fixture", "authorization")):
            return "AUTHORIZATION_CONTRACT"
        if any(token in lowered for token in ("home-wave", "app-launchpad", "shell-contract", "hcm-experience")):
            return "HOME_SHELL"
        return "OTHER_FRONTEND"
    if "dwp-people-server" in lowered:
        return "PEOPLE_ASSIGNMENT_SECURITY"
    if "dwp-gateway" in lowered:
        return "GATEWAY"
    if "openapi" in lowered:
        return "OPENAPI_GENERATION"
    if "dwp-platform-server" in lowered and "home" in lowered:
        return "PLATFORM_HOME_MIGRATION"
    if any(
        token in lowered
        for token in (
            "product-authorization",
            "dwp-auth-server",
            "pilot-fixture",
            "authorization",
        )
    ):
        return "AUTHORIZATION_CONTRACT"
    return "OTHER_BACKEND"


def merge_inventory(repo: Path, kind: str, current: str, reconciled: str) -> dict:
    output = git(
        repo,
        "merge-tree",
        "--write-tree",
        current,
        reconciled,
        accepted=(0, 1),
    )
    lines = output.splitlines()
    tree = lines[0] if lines and re.fullmatch(r"[0-9a-f]{40}", lines[0]) else None
    stage_pattern = re.compile(r"^\d{6} [0-9a-f]{40} [123]\t(.+)$")
    conflict_paths = sorted(
        {match.group(1) for line in lines if (match := stage_pattern.match(line))}
    )
    conflict_types: dict[str, str] = {}
    for line in lines:
        match = re.search(r"CONFLICT \(([^)]+)\): .* in (.+)$", line)
        if match:
            conflict_types[match.group(2)] = match.group(1).upper().replace("/", "_")
    records = [
        {
            "path": path,
            "cluster": cluster(kind, path),
            "conflictType": conflict_types.get(path, "UNMERGED"),
        }
        for path in conflict_paths
    ]
    return {
        "mergeTreeObject": tree,
        "textualConflictCount": len(records),
        "textualConflicts": records,
        "clusterCounts": dict(sorted(Counter(row["cluster"] for row in records).items())),
    }


def inspect(repo: Path, kind: str) -> dict:
    spec = REPOSITORIES[kind]
    current = spec["current"]
    reconciled = spec["reconciled"]
    base = git(repo, "merge-base", current, reconciled).strip()
    left, right = git(repo, "rev-list", "--left-right", "--count", f"{current}...{reconciled}").split()
    current_paths, current_states = changed_paths(repo, base, current)
    reconciled_paths, reconciled_states = changed_paths(repo, base, reconciled)
    overlap = sorted(set(current_paths) & set(reconciled_paths))
    merge = merge_inventory(repo, kind, current, reconciled)
    merge.update(
        {
            "semanticReviewPathCount": len(overlap),
            "semanticReviewPaths": [
                {"path": path, "cluster": cluster(kind, path)} for path in overlap
            ],
            "semanticReviewClusterCounts": dict(
                sorted(Counter(cluster(kind, path) for path in overlap).items())
            ),
        }
    )
    return {
        "currentPin": current,
        "reconciledPin": reconciled,
        "mergeBase": base,
        "divergence": {"currentOnlyCommits": int(left), "reconciledOnlyCommits": int(right)},
        "currentChangedPathCount": len(current_paths),
        "currentChangeKinds": current_states,
        "reconciledChangedPathCount": len(reconciled_paths),
        "reconciledChangeKinds": reconciled_states,
        "integrationBranch": spec["integrationBranch"],
        **merge,
    }


def render(frontend: Path, backend: Path) -> bytes:
    document = {
        "schema": "dwp.hris.g1-conflict-manifest.v1",
        "packetId": PACKET_ID,
        "generatedForDate": "2026-10-06",
        "method": "git merge-tree --write-tree; no checkout or index mutation",
        "repositories": {
            "frontend": inspect(frontend, "frontend"),
            "backend": inspect(backend, "backend"),
        },
        "policy": {
            "textualConflictResolution": "CLUSTER_OWNER_REVIEW_REQUIRED",
            "semanticReview": "ALL_DUAL_CHANGED_PATHS_REQUIRE_EXPLICIT_DISPOSITION",
            "bulkOursTheirs": "PROHIBITED",
            "generatedArtifacts": "REGENERATE_ONCE_AFTER_CANONICAL_SOURCE_DECISION",
        },
    }
    return (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend", required=True, type=Path)
    parser.add_argument("--backend", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = render(args.frontend.resolve(), args.backend.resolve())
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != expected:
            print("G1 conflict manifest drift")
            return 1
        print("G1 conflict manifest PASS")
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(expected)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
