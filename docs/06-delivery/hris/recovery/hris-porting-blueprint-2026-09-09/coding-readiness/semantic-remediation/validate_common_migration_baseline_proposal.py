#!/usr/bin/env python3
"""Read-only committed SQL inventory; proposal checks never authorize G3.

No working-tree SQL is read. Git ancestry, modes, full blob OIDs and SHA-256
are independently checked. Multipart Flyway versions normalize like 89_1.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unittest

DEFAULT_REPO = "/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend"
BASE = "6f1ed92d2610ace3df75f094297032e8b476ef5d"
STREAMS = {
    "auth-main": ("dwp-auth-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "people-main": ("dwp-people-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "people-performance": ("dwp-people-server", "performance-migration", "hris_performance", "flyway_performance_schema_history", "CONTROL"),
    "platform-main": ("dwp-platform-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "approval-main": ("dwp-approval-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "notification-main": ("dwp-notification-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "provider-main": ("dwp-provider-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "payroll-main": ("dwp-payroll-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "time-main": ("dwp-time-server", "migration", "public", "flyway_schema_history", "CONTROL"),
    "meeting-protected": ("dwp-meeting-server", "migration", "public", "flyway_schema_history", "OUTSIDE_CONTROL_PROTECTED"),
    "space-protected": ("dwp-space-server", "migration", "public", "flyway_schema_history", "OUTSIDE_CONTROL_PROTECTED"),
    "messaging-protected": ("dwp-messaging-server", "migration", "public", "flyway_schema_history", "OUTSIDE_CONTROL_PROTECTED"),
    "core-classpath-repeatable": ("dwp-core", "migration", "SERVICE_CLASSPATH_DEPENDENT", "SERVICE_HISTORY_DEPENDENT", "SHARED_RESOURCE_NOT_STANDALONE_STREAM"),
}


def git(repo: str, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", repo, *args])


def tree(repo: str, revision: str) -> dict[str, tuple[str, str]]:
    result = {}
    for row in git(repo, "ls-tree", "-rz", revision).split(b"\0"):
        if not row:
            continue
        metadata, raw_path = row.split(b"\t", 1)
        mode, kind, oid = metadata.decode().split()
        path = raw_path.decode()
        if path.endswith(".sql") and "/src/main/resources/db/" in path:
            if kind != "blob" or mode != "100644":
                raise ValueError("SQL must be regular non-executable Git blob: " + path)
            result[path] = (mode, oid)
    return result


def version(filename: str) -> tuple[int, ...] | None:
    match = re.fullmatch(r"V(\d+(?:[_.]\d+)*)__[^/]+\.sql", filename)
    if not match:
        if re.fullmatch(r"R__[^/]+\.sql", filename):
            return None
        raise ValueError("Unclassified Flyway SQL filename: " + filename)
    return tuple(int(part) for part in re.split(r"[_.]", match.group(1)))


def require_unique_versions(paths: list[str]) -> None:
    seen = {}
    for path in paths:
        key = version(Path(path).name)
        if key is not None:
            # Trailing zero is Flyway-version-equivalent to the shorter form.
            while len(key) > 1 and key[-1] == 0:
                key = key[:-1]
            if key in seen:
                raise ValueError("Duplicate normalized version: " + seen[key] + " and " + path)
            seen[key] = path


def require_immutable(before: dict, after: dict) -> None:
    for path, identity in before.items():
        if after.get(path) != identity:
            raise ValueError("Historical SQL modified/deleted/mode-changed: " + path)


def blob(repo: str, oid: str) -> bytes:
    data = git(repo, "cat-file", "blob", oid)
    computed = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if computed != oid:
        raise ValueError("Git blob bytes do not match OID")
    return data


def inventory(repo: str, base: str, current: str, stream: str | None = None) -> dict:
    base = git(repo, "rev-parse", base + "^{commit}").decode().strip()
    current = git(repo, "rev-parse", current + "^{commit}").decode().strip()
    subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", base, current], check=True)
    before, after = tree(repo, base), tree(repo, current)
    require_immutable(before, after)
    groups = []
    classified = set()
    for key, (service, directory, schema, history, boundary) in STREAMS.items():
        prefix = service + "/src/main/resources/db/" + directory + "/"
        paths = sorted(path for path in after if path.startswith(prefix))
        classified.update(paths)
        require_unique_versions(paths)
        if stream is not None and key != stream:
            continue
        entries = []
        for path in paths:
            data = blob(repo, after[path][1])
            parsed = version(Path(path).name)
            entries.append({
                "path": path, "mode": after[path][0], "gitBlobOid": after[path][1],
                "sha256": hashlib.sha256(data).hexdigest(), "byteLength": len(data),
                "version": ".".join(map(str, parsed)) if parsed is not None else None,
                "kind": "VERSIONED" if parsed is not None else "REPEATABLE",
                "lineage": "HISTORICAL_BLOB_IDENTICAL" if path in before else "COMMON_SUCCESSOR_ADDED",
                "historicalBlobOid": before[path][1] if path in before else None,
            })
        numbered = [version(Path(path).name) for path in paths if version(Path(path).name) is not None]
        old_paths = [path for path in before if path.startswith(prefix)]
        old_numbered = [version(Path(path).name) for path in old_paths if version(Path(path).name) is not None]
        groups.append({"streamKey": key, "service": service, "migrationDir": prefix[:-1],
                       "schema": schema, "historyTable": history, "boundary": boundary,
                       "baselineFileCount": len(old_paths), "currentFileCount": len(paths),
                       "baselineHighWater": ".".join(map(str, max(old_numbered))) if old_numbered else "0",
                       "currentHighWater": ".".join(map(str, max(numbered))) if numbered else "0",
                       "files": entries})
    extras = sorted(set(after) - classified)
    # Extras are explicit local fixture paths, never silently part of strict streams.
    if any("/db/local-seed/" not in path for path in extras):
        raise ValueError("Unclassified migration resource directory")
    local_fixtures = []
    if stream is None or stream == "local-fixtures":
        for path in extras:
            data = blob(repo, after[path][1])
            local_fixtures.append({"path": path, "gitBlobOid": after[path][1],
                                   "sha256": hashlib.sha256(data).hexdigest(),
                                   "lineage": "HISTORICAL_BLOB_IDENTICAL" if path in before else "COMMON_SUCCESSOR_ADDED",
                                   "strictStreamIncluded": False})
    return {"baseCommit": base, "baseTree": git(repo, "rev-parse", base + "^{tree}").decode().strip(),
            "currentCommit": current, "currentTree": git(repo, "rev-parse", current + "^{tree}").decode().strip(),
            "ancestor": True, "workingTreeSqlRead": False, "historicalSqlFiles": len(before),
            "currentSqlFiles": len(after), "addedPaths": sorted(set(after) - set(before)),
            "modifiedOrDeletedPaths": [], "streams": groups, "localFixtureFiles": local_fixtures}


def require_proposal_slots(specs: list[dict], groups: list[dict]) -> None:
    streams = {group["streamKey"]: group for group in groups}
    allocated = set()
    for spec in specs:
        start, end = spec["start"], spec["end"]
        if start < 1 or end < start or spec["capacity"] != end - start + 1:
            raise ValueError("Invalid proposed range capacity")
        group = streams[spec["stream"]]
        actual = {tuple(int(p) for p in row["version"].split("."))
                  for row in group["files"] if row.get("version")}
        versions = set()
        for row in spec["namedSliceProposal"]:
            v = row["version"]
            key = (spec["stream"], v)
            if v < start or v > end or v in versions or key in allocated or (v,) in actual:
                raise ValueError("Proposed slot duplicate, out-of-range or committed collision")
            if version(Path(row["proposalFile"]).name) != (v,):
                raise ValueError("Proposal filename/version mismatch")
            if not row["proposalFile"].startswith(group["migrationDir"] + "/"):
                raise ValueError("Proposal filename routed outside declared stream")
            versions.add(v)
            allocated.add(key)
        if spec["currentSliceDemand"] != len(spec["namedSliceProposal"]):
            raise ValueError("Current slice demand differs from distinct proposal slots")
        if spec["provisionalSpareVersions"] != [v for v in range(start, end + 1) if v not in versions]:
            raise ValueError("Spare capacity does not reconcile")


def verify_proposal(repo: str, doc: dict) -> dict:
    if doc.get("status") != "DESIGN_PROPOSED_NOT_CANONICAL" or doc.get("g3Authorization") != "NONE":
        raise ValueError("Proposal cannot authorize G3")
    declared = doc["gitOnlyInventory"]
    if declared["baseCommit"] != BASE:
        raise ValueError("Historical approved baseline differs")
    # Re-resolve Git path->OID, immutable lineage and independent blob bytes.
    actual = inventory(repo, declared["baseCommit"], declared["currentCommit"])
    for key in ["baseCommit", "baseTree", "currentCommit", "currentTree", "historicalSqlFiles",
                "currentSqlFiles", "addedPaths", "modifiedOrDeletedPaths", "streams", "localFixtureFiles"]:
        if declared[key] != actual[key]:
            raise ValueError("Manifest differs from committed Git oracle: " + key)
    require_proposal_slots(doc["successorAllocationDesign"], actual["streams"])
    return {"gitFiles": actual["currentSqlFiles"], "immutableHistoricalFiles": actual["historicalSqlFiles"],
            "added": len(actual["addedPaths"]), "rangeDesigns": len(doc["successorAllocationDesign"]),
            "currentSliceSlots": sum(spec["currentSliceDemand"] for spec in doc["successorAllocationDesign"]),
            "semanticCapacity": "NOT_VERIFIED", "canonicalAllocation": "UNCHANGED", "g3Authorization": "NONE"}


class ProposalVerifierTests(unittest.TestCase):
    def test_multipart_version(self):
        self.assertEqual(version("V89_1__test.sql"), (89, 1))

    def test_repeatable_classified(self):
        self.assertIsNone(version("R__test.sql"))

    def test_bad_name_rejected(self):
        with self.assertRaises(ValueError):
            version("bad.sql")

    def test_version_alias_rejected(self):
        with self.assertRaises(ValueError):
            require_unique_versions(["V1__a.sql", "V01_0__b.sql"])

    def test_replacement_rejected(self):
        with self.assertRaises(ValueError):
            require_immutable({"old.sql": ("100644", "old")}, {"old.sql": ("100644", "new")})

    def test_delete_rejected(self):
        with self.assertRaises(ValueError):
            require_immutable({"old.sql": ("100644", "old")}, {})

    def test_addition_and_gap_allowed(self):
        require_immutable({"V26__a.sql": "oid"}, {"V26__a.sql": "oid", "V28__b.sql": "new"})
        require_unique_versions(["V26__a.sql", "V28__b.sql"])

    def test_nonregular_mode_rejected_by_immutability(self):
        with self.assertRaises(ValueError):
            require_immutable({"a.sql": ("100644", "oid")}, {"a.sql": ("120000", "oid")})

    def slot_fixture(self):
        group = {"streamKey": "test", "migrationDir": "db/migration", "files": [{"version": "1"}]}
        spec = {"stream": "test", "start": 2, "end": 3, "capacity": 2,
                "currentSliceDemand": 1, "provisionalSpareVersions": [3],
                "namedSliceProposal": [{"version": 2, "proposalFile": "db/migration/V2__x.sql"}]}
        return spec, group

    def test_healthy_slot_capacity(self):
        spec, group = self.slot_fixture()
        require_proposal_slots([spec], [group])

    def test_committed_slot_collision_rejected(self):
        spec, group = self.slot_fixture()
        group["files"].append({"version": "2"})
        with self.assertRaises(ValueError):
            require_proposal_slots([spec], [group])

    def test_slot_duplicate_rejected(self):
        spec, group = self.slot_fixture()
        spec["namedSliceProposal"].append(dict(spec["namedSliceProposal"][0]))
        with self.assertRaises(ValueError):
            require_proposal_slots([spec], [group])

    def test_wrong_stream_filename_rejected(self):
        spec, group = self.slot_fixture()
        spec["namedSliceProposal"][0]["proposalFile"] = "other/V2__x.sql"
        with self.assertRaises(ValueError):
            require_proposal_slots([spec], [group])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--base", default=BASE)
    parser.add_argument("--current", default="HEAD")
    parser.add_argument("--stream", choices=[*STREAMS, "local-fixtures"])
    parser.add_argument("--emit", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--proposal", type=Path)
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ProposalVerifierTests)
        result = unittest.TextTestRunner().run(suite)
        raise SystemExit(0 if result.wasSuccessful() else 1)
    if args.proposal:
        print(json.dumps(verify_proposal(args.repo, json.loads(args.proposal.read_text())), indent=2))
        print("PROPOSAL_GIT_AND_SLOTS=PASS; SEMANTIC_CAPACITY=UNVERIFIED; G3_AUTHORIZATION=NONE")
        return
    doc = inventory(args.repo, args.base, args.current, args.stream)
    if args.emit:
        print(json.dumps(doc, separators=(",", ":")))
    else:
        print(json.dumps({key: value for key, value in doc.items() if key not in {"streams", "localFixtureFiles"}}, indent=2))
        print("PROPOSAL_GIT_LINEAGE=PASS; CANONICAL_ALLOCATION=UNCHANGED; G3_AUTHORIZATION=NONE")


if __name__ == "__main__":
    main()
