#!/usr/bin/env python3
"""Fail-closed provenance validation for the SKKF behavioral source evidence.

The validator never opens a raw SKKF worktree file or asks Git for blob
contents.  Static validation operates on the governed inventories, registers,
and read-only sanitized exports.  Live validation additionally uses only Git
HEAD/tree/status and ``ls-tree`` metadata to prove that every sanitized or
excluded path is bound to the pinned source tree.

The JSON result is intentionally value-free: it reports counts, hashes, and
control failures, never source lines or secret-like values.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
G0 = ROOT / "g0"
EVIDENCE = G0 / "source-security-evidence"

SHA1 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")

COVERAGE_HEADER = [
    "session_id", "source_module", "artifact_type", "artifact_id",
    "display_key", "source_file", "source_line", "legacy_contract",
    "legacy_component_or_table", "observed_metadata", "disposition",
    "target_capability_id", "target_bounded_context_candidate",
    "target_api_or_event", "target_data_owner", "process_change",
    "genericity", "acceptance_evidence", "decision_status",
    "decision_owner", "notes",
]
COVERAGE_PROVENANCE_FIELDS = (
    "session_id", "source_module", "artifact_type", "artifact_id",
    "display_key", "source_file", "source_line", "legacy_contract",
    "legacy_component_or_table", "observed_metadata",
)
ROUTE_HEADER = [
    "module", "route_name", "path_expression", "component", "source_file",
    "line",
]
CONTROLLER_HEADER = [
    "module", "class_name", "base_mapping", "method_mapping_count",
    "customer_specific_markers", "source_file",
]
ENTITY_HEADER = [
    "module", "entity_class", "table_name", "id_strategy",
    "effective_date_fields", "tenant_company_fields", "source_file",
]
CONTAMINATION_HEADER = [
    "source_module", "source_file", "marker", "matched_line_count",
    "coverage_parent", "coverage_child_id", "decision_id", "target_capability",
    "required_disposition", "current_status", "notes",
]
SOURCE_SCOPE_HEADER = [
    "source_scope_id", "module", "original_repository_path",
    "original_branch", "original_head_sha", "original_worktree_state",
    "original_delta_digest", "delta_excluded", "snapshot_path",
    "snapshot_head_sha", "snapshot_tree_sha", "snapshot_state",
    "scope_status", "handling_mode", "inspection_path",
    "inspection_allowed", "copy_allowed", "dependency_import_allowed",
    "approved_outputs", "rights_evidence_status", "legal_approval_status",
    "security_status", "refresh_rule", "original_origin",
    "analysis_copy_mode", "analysis_access_register",
]
SOURCE_TREE_HEADER = [
    "source_scope_id", "module", "snapshot_path", "head_sha", "tree_sha",
    "head_committed_at", "snapshot_state", "tracked_files",
    "tracked_tree_manifest_digest",
]
VIEW_HEADER = [
    "source_scope_id", "module", "view_path", "source_head_sha",
    "source_tree_sha", "included_text_files", "excluded_files",
    "included_bytes", "view_digest_sha256", "filesystem_mode",
    "content_mode", "git_metadata_present", "build_execute_import_status",
]
ACCESS_HEADER = [
    "session_id", "artifact_id", "artifact_type", "source_module",
    "source_scope_id", "coverage_source_file", "source_line",
    "snapshot_relative_path", "sanitized_access_status",
    "sanitized_export_path", "source_line_status", "deny_rule_ids",
    "required_disposition", "raw_snapshot_access", "value_recorded",
    "mapping_fingerprint",
]
MANIFEST_HEADER = [
    "original_path", "export_path", "git_blob_sha", "sha256", "size_bytes",
    "export_mode", "import_status",
]
EXCLUDED_HEADER = [
    "original_path", "git_blob_sha", "sha256", "size_bytes",
    "deny_rule_ids", "disposition",
]
EVIDENCE_DIGEST_HEADER = ["path", "sha256", "size_bytes"]

TRUSTED_INVENTORY_SHA256 = {
    "skkf-route-inventory.csv":
        "10ffa46a4a1c4893149fbd7aeb542c08456f9053a32189cb2c7b8b56ca14ba67",
    "skkf-backend-controller-inventory.csv":
        "7f74f4aa11b8693df4bf4cf57a7a266e0a85bc14f979e1048ed6f7174cd76b8d",
    "skkf-entity-table-inventory.csv":
        "aa75b1b6d96578a652eac2676c00197861a4128a5e076c0b2c693dd9e7f2ea4c",
    "customer-specific-contamination-register.csv":
        "8985dfe3c2238a384d3247596563202ffbcc4dfe67c122ccf41e9de7520a4075",
}

# These hashes cover only the immutable source provenance columns.  Product
# decisions may evolve without permitting the source identity to drift.
TRUSTED_SHARD_PROVENANCE_SHA256 = {
    "session-registers/hris-hrm-source-coverage.csv":
        "e64f6e7927555a3e31aba905f903783f57d31554aa9d17ae931ef5b9124e0117",
    "session-registers/hris-per-source-coverage.csv":
        "92542e2d31a06aa01a84068a073604ba4a31fdfc4a7aafc2d8c2044191933b02",
    "session-registers/hris-pay-source-coverage.csv":
        "4ca4a22ec914fc082035c995d20b57903f4dcde855ae566458d12d463ae1ae0c",
    "session-registers/hris-tim-source-coverage.csv":
        "328e597d07b750106f0001c3c7f670a1ade5491c0970b9ac6b27cc2ea5c5eab6",
    "session-registers/hris-sys-source-coverage.csv":
        "2b0909aba46420d10389118b5b1b31968d7c57cd209c6e5f89089d2bf72c9c2e",
}
SHARD_ORDER = ["HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"]
SHARD_BY_SESSION = {
    "HRIS-HRM": "session-registers/hris-hrm-source-coverage.csv",
    "HRIS-PER": "session-registers/hris-per-source-coverage.csv",
    "HRIS-PAY": "session-registers/hris-pay-source-coverage.csv",
    "HRIS-TIM": "session-registers/hris-tim-source-coverage.csv",
    "HRIS-SYS": "session-registers/hris-sys-source-coverage.csv",
}

PINNED_SOURCES: dict[str, dict[str, Any]] = {
    "SRC-FRONT": {
        "module": "FRONT",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/frontend",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/frontend",
        "head": "e733eae1bc485be0f603f5b593c86321aaf844d2",
        "tree": "63b21abf8314de0a2134f87041fad526e6315091",
        "tracked": 2664,
        "tree_manifest": "0f62546d8e8bec5851dd5eb138a6ae584c4c47b86c1a8c4ec8c0a4c29a70c09a",
        "included": 2116,
        "excluded": 548,
        "included_bytes": 23716011,
        "view_digest": "2604fb73e68233581335092ff20baefdc6cf7d40fc193eebc5dd4de834c84c3a",
    },
    "SRC-HRM": {
        "module": "HRM",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/hrm",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/hrm",
        "head": "c8654c2132294cf79d2974cb727b31dae0eacc88",
        "tree": "0ed80487f0d5f6b733bfdf3cfced867a6f72bf4a",
        "tracked": 1957,
        "tree_manifest": "5ca2f9354727ef512178ddab460ffd22a7e4b5c6285d652e00b9cf5993fc4231",
        "included": 1825,
        "excluded": 132,
        "included_bytes": 8871299,
        "view_digest": "aa94aca39b3dba0720b3d02b9485dbed6573c8b665b66ac6d314b0657f8b9867",
    },
    "SRC-PER": {
        "module": "PER",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/per",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/per",
        "head": "6f81384d766731204ac8b6ef9d55ebd91b22e5cb",
        "tree": "07540b24f0ca4b3eba2349919132a954864f6968",
        "tracked": 1644,
        "tree_manifest": "0b85637d1c98af3a8ecc0fd31e1464da6e26ca64c824e6f72f2bdba25bdaf6f4",
        "included": 1514,
        "excluded": 130,
        "included_bytes": 7369162,
        "view_digest": "e841baef961f22777c1bafc318c43224ee30ed0d97cc790b8a16104f1d564054",
    },
    "SRC-PAY": {
        "module": "PAY",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/pay",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/pay",
        "head": "50459981288bb9d545b4432d970876de878909b4",
        "tree": "df4290a4b1dbc5666a6af437726d90760843131d",
        "tracked": 2372,
        "tree_manifest": "54b8e2976a86c334755a1b0314b650646cc91442fc60bb61de040fd77906d692",
        "included": 2174,
        "excluded": 198,
        "included_bytes": 8486029,
        "view_digest": "0d6e42d9b396f2878273b45544f79bb8b935b1a6647df0334a1e739ece4a1caf",
    },
    "SRC-TIM": {
        "module": "TIM",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/tim",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/tim",
        "head": "242aeb608c5d6bc2e00ef246d7e557c3def959a8",
        "tree": "f260d1fd1bdd4f4d368ce424c93cd8a0175524a5",
        "tracked": 2498,
        "tree_manifest": "d706c13d74eac422b05937cda8c2e763afbb1d40c47620c6a825948b043c86da",
        "included": 2363,
        "excluded": 135,
        "included_bytes": 10908875,
        "view_digest": "3ef2c593a639415e6b8dfd37a0bb181d692621eb3e15961ea620bf5eacaf2fa5",
    },
    "SRC-SYS": {
        "module": "SYS",
        "snapshot": "/Users/a10697/Work/DWP/.codex-worktrees/hris/source/sys",
        "view": "/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source/sys",
        "head": "c96a8920dd261ee3494109c575ecc7cafea6cd8c",
        "tree": "6e44416aa249130dbeadb9e63950ec0dc084c3aa",
        "tracked": 377,
        "tree_manifest": "5a389ecf294a053bfc5b56ff6ac3698981ffcc2f5dc5fa7683e8b552d079bfd1",
        "included": 226,
        "excluded": 151,
        "included_bytes": 846981,
        "view_digest": "8ab80eb23dc71cea66eb8781365724af49e0bb7950ba74722f1bfe75739ed895",
    },
}

SECURITY_BLOCKED_IDS = {
    "controller:hrm:cloudhr-hrm/src/main/java/com/kolonbenit/benitworx/app/com/meta/controller/data/UsrMetaDataController.java",
    "controller:hrm:cloudhr-hrm/src/main/java/com/kolonbenit/benitworx/app/com/template/controller/MailTemplateController.java",
    "controller:per:cloudhr-per/src/main/java/com/kolonbenit/benitworx/app/com/template/controller/MailTemplateController.java",
    "controller:per:cloudhr-per/src/main/java/com/kolonbenit/benitworx/app/com/template/controller/TemplateController.java",
    "controller:pay:cloudhr-pay/src/main/java/com/kolonbenit/benitworx/app/com/template/controller/MailTemplateController.java",
    "controller:tim:cloudhr-tim/src/main/java/com/kolonbenit/benitworx/app/com/template/controller/MailTemplateController.java",
    "controller:sys:cloudhr-sys/src/main/java/com/kolonbenit/benitworx/app/com/dictionary/controller/DictionaryQueryController.java",
    "controller:sys:cloudhr-sys/src/main/java/com/kolonbenit/benitworx/app/com/template/DeprecatedMailSendController.java",
    "controller:sys:cloudhr-sys/src/main/java/com/kolonbenit/benitworx/app/com/template/DeprecatedNotfcSendController.java",
}
RETIRED_IDS = {
    "route:hrm:hrm/src/publ/ben/router/benRouter.js:5",
    "route:hrm:hrm/src/publ/ben/router/benRouter.js:11",
}


class Validation:
    def __init__(self) -> None:
        self.checks = 0
        self.errors: list[str] = []
        self.groups: Counter[str] = Counter()
        self.group_errors: Counter[str] = Counter()

    def require(self, condition: bool, message: str, group: str) -> None:
        self.checks += 1
        self.groups[group] += 1
        if not condition:
            self.errors.append(f"[{group}] {message}")
            self.group_errors[group] += 1


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def stable_fingerprint(*parts: object) -> str:
    joined = "\x1f".join(str(part) for part in parts)
    return hashlib.sha256(joined.encode("utf-8", "surrogateescape")).hexdigest()


def coverage_provenance_sha256(rows: list[dict[str, str]]) -> str:
    payload = json.dumps(
        [
            {field: row.get(field, "") for field in COVERAGE_PROVENANCE_FIELDS}
            for row in rows
        ],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256_bytes(payload)


def safe_relative(value: str) -> bool:
    path = Path(value)
    return bool(value) and not path.is_absolute() and ".." not in path.parts


def within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def read_csv_exact(
    path: Path,
    expected_header: list[str],
    validation: Validation,
    group: str,
) -> list[dict[str, str]]:
    validation.require(path.is_file(), f"missing CSV: {path.name}", group)
    if not path.is_file():
        return []
    try:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            header = reader.fieldnames or []
            validation.require(
                header == expected_header,
                f"header drift: {path.name}",
                group,
            )
            rows = list(reader)
    except (OSError, UnicodeError, csv.Error) as error:
        validation.require(False, f"unreadable CSV {path.name}: {type(error).__name__}", group)
        return []
    validation.require(
        all(None not in row and all(value is not None for value in row.values()) for row in rows),
        f"malformed row width: {path.name}",
        group,
    )
    return rows


def validate_inventory_and_coverage(validation: Validation) -> dict[str, dict[str, str]]:
    group = "coverage-inventory"
    inventory_specs = {
        "skkf-route-inventory.csv": ROUTE_HEADER,
        "skkf-backend-controller-inventory.csv": CONTROLLER_HEADER,
        "skkf-entity-table-inventory.csv": ENTITY_HEADER,
        "customer-specific-contamination-register.csv": CONTAMINATION_HEADER,
    }
    inventories: dict[str, list[dict[str, str]]] = {}
    for name, header in inventory_specs.items():
        path = ROOT / name
        validation.require(
            path.is_file() and sha256_file(path) == TRUSTED_INVENTORY_SHA256[name],
            f"trusted inventory bytes drift: {name}",
            group,
        )
        inventories[name] = read_csv_exact(path, header, validation, group)

    master = read_csv_exact(
        ROOT / "five-session-source-coverage-register.csv",
        COVERAGE_HEADER,
        validation,
        group,
    )
    shards: dict[str, list[dict[str, str]]] = {}
    combined: list[dict[str, str]] = []
    for session in SHARD_ORDER:
        relative = SHARD_BY_SESSION[session]
        rows = read_csv_exact(ROOT / relative, COVERAGE_HEADER, validation, group)
        shards[session] = rows
        combined.extend(rows)
        validation.require(
            coverage_provenance_sha256(rows)
            == TRUSTED_SHARD_PROVENANCE_SHA256[relative],
            f"immutable provenance drift: {relative}",
            group,
        )
        validation.require(
            all(row.get("session_id") == session for row in rows),
            f"cross-session row in {relative}",
            group,
        )
    validation.require(master == combined, "master is not exact ordered shard merge", group)
    ids = [row.get("artifact_id", "") for row in master]
    validation.require(len(master) == 2269, f"coverage count {len(master)} != 2269", group)
    validation.require(len(ids) == len(set(ids)) and all(ids), "coverage IDs empty/duplicated", group)
    validation.require(
        Counter(row.get("artifact_type") for row in master)
        == Counter({"ROUTE": 886, "CONTROLLER": 825, "ENTITY": 558}),
        "coverage type totals drift",
        group,
    )

    def inventory_session(module: str) -> str:
        return "HRIS-PAY" if module == "yea" else f"HRIS-{module.upper()}"

    def raw_tuple(row: dict[str, str]) -> tuple[str, ...]:
        return tuple(row.get(field, "") for field in COVERAGE_PROVENANCE_FIELDS if field != "artifact_type")

    # raw_tuple omits artifact_type because each comparison is already filtered
    # by its canonical inventory class.
    routes = inventories["skkf-route-inventory.csv"]
    expected_routes = Counter(
        (
            inventory_session(row["module"]), row["module"],
            f"route:{row['module']}:{row['source_file']}:{row['line']}",
            row["route_name"], row["source_file"], row["line"],
            row["path_expression"], row["component"], "",
        )
        for row in routes
    )
    actual_routes = Counter(
        raw_tuple(row) for row in master if row.get("artifact_type") == "ROUTE"
    )
    validation.require(actual_routes == expected_routes, "route raw tuples differ from inventory", group)

    extra_markers: defaultdict[str, list[str]] = defaultdict(list)
    for row in inventories["customer-specific-contamination-register.csv"]:
        parent = row.get("coverage_parent", "")
        marker = row.get("marker", "")
        own_controller = f"controller:{row.get('source_module', '')}:{row.get('source_file', '')}"
        if parent == own_controller and marker:
            extra_markers[parent].append(marker)
    expected_controllers: Counter[tuple[str, ...]] = Counter()
    for row in inventories["skkf-backend-controller-inventory.csv"]:
        artifact_id = f"controller:{row['module']}:{row['source_file']}"
        markers = [item for item in row["customer_specific_markers"].split("|") if item]
        for marker in extra_markers.get(artifact_id, []):
            if marker not in markers:
                markers.append(marker)
        metadata = f"method_mapping_count={row['method_mapping_count']}"
        for marker in markers:
            metadata += f";customer_specific_markers={marker}"
        expected_controllers[
            (
                inventory_session(row["module"]), row["module"], artifact_id,
                row["class_name"], row["source_file"], "", row["base_mapping"],
                "", metadata,
            )
        ] += 1
    actual_controllers = Counter(
        raw_tuple(row) for row in master if row.get("artifact_type") == "CONTROLLER"
    )
    validation.require(
        actual_controllers == expected_controllers,
        "controller raw tuples differ from inventory",
        group,
    )

    expected_entities: Counter[tuple[str, ...]] = Counter()
    for row in inventories["skkf-entity-table-inventory.csv"]:
        artifact_id = f"entity:{row['module']}:{row['source_file']}"
        metadata = ";".join(
            f"{field}={row[field]}"
            for field in ("id_strategy", "effective_date_fields", "tenant_company_fields")
            if row[field]
        )
        expected_entities[
            (
                inventory_session(row["module"]), row["module"], artifact_id,
                row["entity_class"], row["source_file"], "", row["table_name"],
                row["table_name"], metadata,
            )
        ] += 1
    actual_entities = Counter(
        raw_tuple(row) for row in master if row.get("artifact_type") == "ENTITY"
    )
    validation.require(
        actual_entities == expected_entities,
        "entity raw tuples differ from inventory",
        group,
    )
    return {row["artifact_id"]: row for row in master if row.get("artifact_id")}


def validate_scope_tree_view_registers(
    validation: Validation,
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    group = "scope-tree-view"
    scope_rows = read_csv_exact(
        G0 / "source-scope-register.csv", SOURCE_SCOPE_HEADER, validation, group
    )
    in_scope = {
        row.get("source_scope_id", ""): row
        for row in scope_rows
        if row.get("scope_status") == "IN_SCOPE_G1_BEHAVIOR_ONLY"
    }
    validation.require(
        set(in_scope) == set(PINNED_SOURCES),
        "in-scope source identifier set drift",
        group,
    )
    validation.require(len(in_scope) == 6, "duplicate in-scope source rows", group)

    tree_rows = read_csv_exact(
        EVIDENCE / "source-tree-register.csv", SOURCE_TREE_HEADER, validation, group
    )
    trees = {row.get("source_scope_id", ""): row for row in tree_rows}
    validation.require(
        set(trees) == set(PINNED_SOURCES) and len(trees) == len(tree_rows),
        "source-tree register set/uniqueness drift",
        group,
    )
    view_rows = read_csv_exact(
        EVIDENCE / "sanitized-view-register.csv", VIEW_HEADER, validation, group
    )
    views = {row.get("source_scope_id", ""): row for row in view_rows}
    validation.require(
        set(views) == set(PINNED_SOURCES) and len(views) == len(view_rows),
        "sanitized-view register set/uniqueness drift",
        group,
    )

    for scope_id, pinned in PINNED_SOURCES.items():
        scope = in_scope.get(scope_id, {})
        tree = trees.get(scope_id, {})
        view = views.get(scope_id, {})
        validation.require(scope.get("module") == pinned["module"], f"{scope_id}: module drift", group)
        validation.require(
            scope.get("snapshot_path") == pinned["snapshot"]
            and scope.get("snapshot_head_sha") == pinned["head"]
            and scope.get("snapshot_tree_sha") == pinned["tree"],
            f"{scope_id}: pinned snapshot binding drift",
            group,
        )
        validation.require(
            scope.get("original_head_sha") == pinned["head"]
            and scope.get("snapshot_state") == "CLEAN_DETACHED",
            f"{scope_id}: source/snapshot state drift",
            group,
        )
        validation.require(
            scope.get("inspection_path") == pinned["view"]
            and scope.get("inspection_allowed") == "YES_G1_SANITIZED_ANALYSIS_ONLY",
            f"{scope_id}: inspection-view binding drift",
            group,
        )
        validation.require(
            scope.get("handling_mode") == "BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE"
            and scope.get("copy_allowed") == "NO"
            and scope.get("dependency_import_allowed") == "NO"
            and scope.get("legal_approval_status") == "NO_CODE_REUSE_APPROVAL"
            and scope.get("security_status") == "CONSERVATIVE_MODE_ACTIVE",
            f"{scope_id}: no-reuse policy drift",
            group,
        )
        validation.require(
            tree.get("module") == pinned["module"]
            and tree.get("snapshot_path") == pinned["snapshot"]
            and tree.get("head_sha") == pinned["head"]
            and tree.get("tree_sha") == pinned["tree"],
            f"{scope_id}: source-tree binding drift",
            group,
        )
        validation.require(
            tree.get("snapshot_state") == "CLEAN_DETACHED_VERIFIED"
            and tree.get("tracked_files") == str(pinned["tracked"])
            and tree.get("tracked_tree_manifest_digest") == pinned["tree_manifest"],
            f"{scope_id}: source-tree attestation drift",
            group,
        )
        validation.require(
            view.get("module") == pinned["module"]
            and view.get("view_path") == pinned["view"]
            and view.get("source_head_sha") == pinned["head"]
            and view.get("source_tree_sha") == pinned["tree"],
            f"{scope_id}: sanitized-view source binding drift",
            group,
        )
        validation.require(
            view.get("included_text_files") == str(pinned["included"])
            and view.get("excluded_files") == str(pinned["excluded"])
            and view.get("included_bytes") == str(pinned["included_bytes"])
            and view.get("view_digest_sha256") == pinned["view_digest"],
            f"{scope_id}: sanitized-view count/digest drift",
            group,
        )
        validation.require(
            view.get("filesystem_mode") == "FILES_0444_DIRECTORIES_0555"
            and view.get("content_mode") == "ORIGINAL_TEXT_RENAMED_DOT_ANALYSIS_DOT_TXT"
            and view.get("git_metadata_present") == "NO"
            and view.get("build_execute_import_status") == "PROHIBITED",
            f"{scope_id}: sanitized-view safety claim drift",
            group,
        )

    metadata_path = EVIDENCE / "scan-metadata.json"
    validation.require(metadata_path.is_file(), "scan metadata missing", group)
    metadata: dict[str, Any] = {}
    if metadata_path.is_file():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            validation.require(False, f"scan metadata unreadable: {type(error).__name__}", group)
    validation.require(metadata.get("schema_version") == 1, "scan metadata schema drift", group)
    decision = metadata.get("decision", {}) if isinstance(metadata, dict) else {}
    validation.require(
        decision.get("source_use") == "BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE"
        and decision.get("source_import") == "PROHIBITED"
        and decision.get("dependency_import") == "PROHIBITED"
        and decision.get("production_authority") == "NONE",
        "scan metadata decision boundary drift",
        group,
    )
    coverage_ref = metadata.get("coverage_register", {}) if isinstance(metadata, dict) else {}
    coverage_path = ROOT / "five-session-source-coverage-register.csv"
    validation.require(
        coverage_ref.get("sha256") == sha256_file(coverage_path)
        and coverage_ref.get("raw_row_floor") == 2269,
        "scan metadata coverage binding drift",
        group,
    )
    snapshots = metadata.get("source_snapshots", []) if isinstance(metadata, dict) else []
    snapshot_by_id = {
        item.get("source_scope_id", ""): item
        for item in snapshots
        if isinstance(item, dict)
    }
    validation.require(
        set(snapshot_by_id) == set(PINNED_SOURCES)
        and len(snapshot_by_id) == len(snapshots),
        "scan metadata source snapshot set drift",
        group,
    )
    for scope_id, pinned in PINNED_SOURCES.items():
        item = snapshot_by_id.get(scope_id, {})
        validation.require(
            item.get("module") == pinned["module"]
            and item.get("snapshot_path") == pinned["snapshot"]
            and item.get("head_sha") == pinned["head"]
            and item.get("tree_sha") == pinned["tree"]
            and item.get("tracked_files") == pinned["tracked"]
            and item.get("tracked_tree_manifest_digest") == pinned["tree_manifest"]
            and item.get("snapshot_state") == "CLEAN_DETACHED_VERIFIED",
            f"{scope_id}: scan metadata snapshot drift",
            group,
        )
    return trees, views


def validate_evidence_digest(validation: Validation) -> None:
    group = "evidence-digest"
    rows = read_csv_exact(
        EVIDENCE / "evidence-file-digests.csv",
        EVIDENCE_DIGEST_HEADER,
        validation,
        group,
    )
    names = [row.get("path", "") for row in rows]
    validation.require(
        names == sorted(names) and len(names) == len(set(names)),
        "evidence digest paths are unsorted/duplicated",
        group,
    )
    parts: list[str] = []
    for line, row in enumerate(rows, 2):
        name = row.get("path", "")
        validation.require(safe_relative(name) and len(Path(name).parts) == 1, f"line {line}: unsafe evidence path", group)
        path = EVIDENCE / name
        validation.require(path.is_file() and not path.is_symlink(), f"line {line}: evidence file missing/symlink", group)
        valid_size = row.get("size_bytes", "").isdigit()
        validation.require(valid_size and bool(SHA256.fullmatch(row.get("sha256", ""))), f"line {line}: invalid evidence digest metadata", group)
        if path.is_file() and valid_size:
            validation.require(path.stat().st_size == int(row["size_bytes"]), f"line {line}: evidence size drift", group)
            validation.require(sha256_file(path) == row["sha256"], f"line {line}: evidence SHA drift", group)
        parts.append(f"{name}:{row.get('sha256', '')}:{row.get('size_bytes', '')}")
    digest_path = EVIDENCE / "EVIDENCE_DIGEST.sha256"
    validation.require(digest_path.is_file(), "aggregate evidence digest missing", group)
    recorded = ""
    if digest_path.is_file():
        try:
            recorded = digest_path.read_text(encoding="ascii").strip().split()[0]
        except (OSError, UnicodeError, IndexError):
            recorded = ""
    calculated = stable_fingerprint("source-security-evidence-v1", *parts)
    validation.require(bool(SHA256.fullmatch(recorded)) and recorded == calculated, "aggregate evidence digest drift", group)


def validate_sanitized_views(
    validation: Validation,
    views: dict[str, dict[str, str]],
) -> dict[str, dict[str, dict[str, str]]]:
    group = "sanitized-bytes"
    indexes: dict[str, dict[str, dict[str, str]]] = {}
    for scope_id, pinned in PINNED_SOURCES.items():
        view = Path(pinned["view"])
        validation.require(view.is_dir(), f"{scope_id}: sanitized view missing", group)
        if not view.is_dir():
            indexes[scope_id] = {"included": {}, "excluded": {}}
            continue
        manifest_rows = read_csv_exact(view / "manifest.csv", MANIFEST_HEADER, validation, group)
        excluded_rows = read_csv_exact(view / "excluded-paths.csv", EXCLUDED_HEADER, validation, group)
        included_by_path: dict[str, dict[str, str]] = {}
        export_paths: set[str] = set()
        total_bytes = 0
        for line, row in enumerate(manifest_rows, 2):
            original = row.get("original_path", "")
            exported = row.get("export_path", "")
            validation.require(safe_relative(original), f"{scope_id} manifest:{line}: unsafe original path", group)
            validation.require(
                safe_relative(exported)
                and exported.startswith("content/")
                and exported.endswith(".analysis.txt"),
                f"{scope_id} manifest:{line}: unsafe export path",
                group,
            )
            validation.require(original not in included_by_path, f"{scope_id} manifest:{line}: duplicate original path", group)
            validation.require(exported not in export_paths, f"{scope_id} manifest:{line}: duplicate export path", group)
            included_by_path[original] = row
            export_paths.add(exported)
            validation.require(
                bool(SHA1.fullmatch(row.get("git_blob_sha", "")))
                and bool(SHA256.fullmatch(row.get("sha256", "")))
                and row.get("size_bytes", "").isdigit(),
                f"{scope_id} manifest:{line}: invalid hash/size",
                group,
            )
            validation.require(
                row.get("export_mode") == "0444_NON_EXECUTABLE_ANALYSIS_TEXT"
                and row.get("import_status") == "PROHIBITED",
                f"{scope_id} manifest:{line}: export safety drift",
                group,
            )
            export_path = (view / exported).resolve()
            validation.require(within(export_path, view.resolve()), f"{scope_id} manifest:{line}: export escapes view", group)
            validation.require(export_path.is_file(), f"{scope_id} manifest:{line}: export missing", group)
            if export_path.is_file():
                data = export_path.read_bytes()
                total_bytes += len(data)
                validation.require(len(data) == int(row["size_bytes"]), f"{scope_id} manifest:{line}: byte count drift", group)
                validation.require(sha256_bytes(data) == row["sha256"], f"{scope_id} manifest:{line}: SHA-256 drift", group)
                validation.require(git_blob_sha1(data) == row["git_blob_sha"], f"{scope_id} manifest:{line}: Git blob mismatch", group)
                validation.require(b"\0" not in data, f"{scope_id} manifest:{line}: NUL in sanitized text", group)
                validation.require(not data.startswith(b"#!"), f"{scope_id} manifest:{line}: executable shebang exported", group)
                try:
                    data.decode("utf-8")
                    decoded = True
                except UnicodeDecodeError:
                    decoded = False
                validation.require(decoded, f"{scope_id} manifest:{line}: non-UTF8 sanitized text", group)

        excluded_by_path: dict[str, dict[str, str]] = {}
        for line, row in enumerate(excluded_rows, 2):
            original = row.get("original_path", "")
            validation.require(safe_relative(original), f"{scope_id} excluded:{line}: unsafe path", group)
            validation.require(
                original not in excluded_by_path and original not in included_by_path,
                f"{scope_id} excluded:{line}: duplicate/overlap path",
                group,
            )
            excluded_by_path[original] = row
            validation.require(
                bool(SHA1.fullmatch(row.get("git_blob_sha", "")))
                and bool(SHA256.fullmatch(row.get("sha256", "")))
                and row.get("size_bytes", "").isdigit(),
                f"{scope_id} excluded:{line}: invalid hash/size metadata",
                group,
            )
            validation.require(
                bool(row.get("deny_rule_ids", ""))
                and row.get("disposition") == "NOT_EXPORTED",
                f"{scope_id} excluded:{line}: deny boundary drift",
                group,
            )

        validation.require(len(manifest_rows) == pinned["included"], f"{scope_id}: included count drift", group)
        validation.require(len(excluded_rows) == pinned["excluded"], f"{scope_id}: excluded count drift", group)
        validation.require(len(manifest_rows) + len(excluded_rows) == pinned["tracked"], f"{scope_id}: include/exclude partition incomplete", group)
        validation.require(total_bytes == pinned["included_bytes"], f"{scope_id}: included bytes drift", group)

        files = sorted(
            (item for item in view.rglob("*") if item.is_file() and item.name != "VIEW_DIGEST.sha256"),
            key=lambda item: item.relative_to(view).as_posix().encode("utf-8", "surrogateescape"),
        )
        digest_parts = [
            f"{item.relative_to(view).as_posix()}:{sha256_file(item)}"
            for item in files
        ]
        calculated_view_digest = stable_fingerprint(
            "sanitized-view-v1",
            scope_id,
            pinned["head"],
            pinned["tree"],
            *digest_parts,
        )
        validation.require(
            calculated_view_digest == pinned["view_digest"]
            and views.get(scope_id, {}).get("view_digest_sha256") == calculated_view_digest,
            f"{scope_id}: calculated view digest drift",
            group,
        )
        digest_file = view / "VIEW_DIGEST.sha256"
        recorded_view_digest = ""
        if digest_file.is_file():
            try:
                recorded_view_digest = digest_file.read_text(encoding="ascii").strip().split()[0]
            except (OSError, UnicodeError, IndexError):
                recorded_view_digest = ""
        validation.require(
            digest_file.is_file() and recorded_view_digest == calculated_view_digest,
            f"{scope_id}: VIEW_DIGEST drift",
            group,
        )
        indexes[scope_id] = {"included": included_by_path, "excluded": excluded_by_path}
    return indexes


def expected_source_binding(row: dict[str, str]) -> tuple[str, str]:
    source_file = row.get("source_file", "")
    module = row.get("source_module", "")
    if row.get("artifact_type") == "ROUTE":
        return "SRC-FRONT", f"packages/{source_file}"
    prefix = f"cloudhr-{module}/"
    relative = source_file[len(prefix):] if source_file.startswith(prefix) else source_file
    return f"SRC-{module.upper()}", relative


def validate_access_mapping(
    validation: Validation,
    coverage: dict[str, dict[str, str]],
    indexes: dict[str, dict[str, dict[str, str]]],
) -> None:
    group = "coverage-access"
    rows = read_csv_exact(
        EVIDENCE / "coverage-sanitized-access-register.csv",
        ACCESS_HEADER,
        validation,
        group,
    )
    by_id = {row.get("artifact_id", ""): row for row in rows}
    validation.require(len(rows) == 2269, f"access count {len(rows)} != 2269", group)
    validation.require(len(by_id) == len(rows), "access artifact IDs duplicated", group)
    validation.require(set(by_id) == set(coverage), "access/coverage artifact sets differ", group)
    statuses: Counter[str] = Counter()
    blocked: set[str] = set()
    retired: set[str] = set()
    line_counts: dict[Path, int] = {}

    status_contract = {
        "AVAILABLE_SANITIZED_TEXT": (
            "G1_ALLOWED_SANITIZED_VIEW_ONLY_RAW_SNAPSHOT_FORBIDDEN",
            {"IN_RANGE", "FILE_LEVEL_PROVENANCE"},
        ),
        "SECURITY_BLOCKED_UNKNOWN": (
            "UNKNOWN_SECURITY_REVIEW_OR_SAFE_BEHAVIORAL_SUBSTITUTE_REQUIRED",
            {"NOT_READABLE_BY_G1"},
        ),
        "EXCLUDED_BENSK_RETIRE": (
            "RETIRE_NO_G1_SOURCE_ACCESS",
            {"NOT_APPLICABLE_RETIRED"},
        ),
    }
    for line, row in enumerate(rows, 2):
        artifact_id = row.get("artifact_id", "")
        parent = coverage.get(artifact_id, {})
        validation.require(
            all(
                row.get(access_field, "") == parent.get(parent_field, "")
                for access_field, parent_field in (
                    ("session_id", "session_id"),
                    ("artifact_type", "artifact_type"),
                    ("source_module", "source_module"),
                    ("coverage_source_file", "source_file"),
                    ("source_line", "source_line"),
                )
            ),
            f"access line {line}: coverage mapping drift",
            group,
        )
        scope_id, relative = expected_source_binding(parent)
        validation.require(
            row.get("source_scope_id") == scope_id
            and row.get("snapshot_relative_path") == relative
            and safe_relative(relative),
            f"access line {line}: source scope/path binding drift",
            group,
        )
        expected_fingerprint = stable_fingerprint(
            "coverage-sanitized-map-v1",
            row.get("session_id", ""),
            artifact_id,
            row.get("source_scope_id", ""),
            row.get("snapshot_relative_path", ""),
            row.get("source_line", ""),
            row.get("sanitized_access_status", ""),
            row.get("deny_rule_ids", ""),
        )
        validation.require(
            row.get("mapping_fingerprint") == expected_fingerprint,
            f"access line {line}: mapping fingerprint drift",
            group,
        )
        validation.require(
            row.get("raw_snapshot_access") == "FORBIDDEN_FOR_G1_SESSION"
            and row.get("value_recorded") == "NO",
            f"access line {line}: raw/value boundary drift",
            group,
        )
        status = row.get("sanitized_access_status", "")
        statuses[status] += 1
        contract = status_contract.get(status)
        validation.require(contract is not None, f"access line {line}: invalid status", group)
        if contract is None:
            continue
        validation.require(
            row.get("required_disposition") == contract[0]
            and row.get("source_line_status") in contract[1],
            f"access line {line}: status/disposition contract drift",
            group,
        )
        source_index = indexes.get(scope_id, {"included": {}, "excluded": {}})
        if status == "AVAILABLE_SANITIZED_TEXT":
            manifest = source_index["included"].get(relative)
            validation.require(manifest is not None, f"access line {line}: source absent from sanitized manifest", group)
            expected_export = str(Path(PINNED_SOURCES[scope_id]["view"]) / manifest.get("export_path", "")) if manifest else ""
            validation.require(
                bool(expected_export)
                and row.get("sanitized_export_path") == expected_export
                and not row.get("deny_rule_ids"),
                f"access line {line}: sanitized export binding drift",
                group,
            )
            if parent.get("source_line") and expected_export:
                export_path = Path(expected_export)
                if export_path.is_file():
                    if export_path not in line_counts:
                        line_counts[export_path] = len(export_path.read_bytes().splitlines())
                    try:
                        source_line = int(parent["source_line"])
                    except ValueError:
                        source_line = 0
                    validation.require(
                        1 <= source_line <= line_counts[export_path]
                        and row.get("source_line_status") == "IN_RANGE",
                        f"access line {line}: source line out of sanitized range",
                        group,
                    )
            else:
                validation.require(
                    row.get("source_line_status") == "FILE_LEVEL_PROVENANCE",
                    f"access line {line}: file-level provenance status drift",
                    group,
                )
        else:
            excluded = source_index["excluded"].get(relative)
            validation.require(
                excluded is not None and not row.get("sanitized_export_path"),
                f"access line {line}: unavailable path not bound to exclusion manifest",
                group,
            )
            access_rules = {item for item in row.get("deny_rule_ids", "").split("|") if item}
            excluded_rules = {
                item for item in (excluded or {}).get("deny_rule_ids", "").split("|") if item
            }
            validation.require(
                bool(access_rules) and access_rules <= excluded_rules,
                f"access line {line}: deny rule not backed by exclusion manifest",
                group,
            )
            if status == "SECURITY_BLOCKED_UNKNOWN":
                blocked.add(artifact_id)
            else:
                retired.add(artifact_id)
                validation.require(
                    parent.get("disposition") == "RETIRE",
                    f"access line {line}: excluded BENSK artifact not retired",
                    group,
                )
    validation.require(
        statuses == Counter(
            {
                "AVAILABLE_SANITIZED_TEXT": 2258,
                "SECURITY_BLOCKED_UNKNOWN": 9,
                "EXCLUDED_BENSK_RETIRE": 2,
            }
        ),
        f"access status counts drift: {dict(statuses)}",
        group,
    )
    validation.require(blocked == SECURITY_BLOCKED_IDS, "security-blocked artifact set drift", group)
    validation.require(retired == RETIRED_IDS, "retired BENSK artifact set drift", group)


def git_output(path: Path, *arguments: str) -> tuple[int, bytes]:
    completed = subprocess.run(
        ["git", "-C", str(path), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=120,
    )
    return completed.returncode, completed.stdout


def parse_ls_tree(data: bytes) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for record in data.split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        mode, object_type, object_id = metadata.decode("ascii").split(" ")
        path = raw_path.decode("utf-8", "surrogateescape")
        if any(ord(character) < 32 for character in path):
            raise ValueError("Git tree path contains a control character")
        rows.append(
            {
                "mode": mode,
                "type": object_type,
                "blob": object_id,
                "path": path,
            }
        )
    return sorted(rows, key=lambda row: row["path"].encode("utf-8", "surrogateescape"))


def validate_live(
    validation: Validation,
    indexes: dict[str, dict[str, dict[str, str]]],
) -> None:
    group = "live-git-and-modes"
    sanitized_root = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/sanitized-source")
    validation.require(
        sanitized_root.is_dir()
        and not sanitized_root.is_symlink()
        and stat.S_IMODE(sanitized_root.stat().st_mode) == 0o555,
        "sanitized root missing/symlink/not mode 0555",
        group,
    )
    if sanitized_root.is_dir():
        expected_children = {Path(item["view"]).name for item in PINNED_SOURCES.values()}
        actual_children = {item.name for item in sanitized_root.iterdir()}
        validation.require(actual_children == expected_children, "sanitized root child set drift", group)

    for scope_id, pinned in PINNED_SOURCES.items():
        snapshot = Path(pinned["snapshot"])
        validation.require(snapshot.is_dir() and not snapshot.is_symlink(), f"{scope_id}: snapshot missing/symlink", group)
        if not snapshot.is_dir():
            continue
        code, head = git_output(snapshot, "rev-parse", "HEAD")
        validation.require(
            code == 0 and head.decode("ascii", "replace").strip() == pinned["head"],
            f"{scope_id}: live HEAD drift",
            group,
        )
        code, tree = git_output(snapshot, "rev-parse", "HEAD^{tree}")
        validation.require(
            code == 0 and tree.decode("ascii", "replace").strip() == pinned["tree"],
            f"{scope_id}: live tree drift",
            group,
        )
        code, status_output = git_output(
            snapshot, "status", "--porcelain=v1", "--untracked-files=all"
        )
        validation.require(code == 0 and not status_output, f"{scope_id}: snapshot is dirty", group)
        code, tree_output = git_output(snapshot, "ls-tree", "-r", "-z", "HEAD")
        validation.require(code == 0, f"{scope_id}: ls-tree failed", group)
        try:
            tree_rows = parse_ls_tree(tree_output) if code == 0 else []
        except (ValueError, UnicodeError) as error:
            validation.require(False, f"{scope_id}: malformed ls-tree metadata ({type(error).__name__})", group)
            tree_rows = []
        validation.require(
            len(tree_rows) == pinned["tracked"]
            and all(row["type"] == "blob" and bool(SHA1.fullmatch(row["blob"])) for row in tree_rows),
            f"{scope_id}: live tracked blob count/type drift",
            group,
        )
        validation.require(
            len({row["path"] for row in tree_rows}) == len(tree_rows),
            f"{scope_id}: duplicate Git tree path",
            group,
        )
        calculated_tree_manifest = stable_fingerprint(
            "tree-manifest-v1",
            scope_id,
            *(f"{row['mode']}:{row['blob']}:{row['path']}" for row in tree_rows),
        )
        validation.require(
            calculated_tree_manifest == pinned["tree_manifest"],
            f"{scope_id}: live Git tree manifest drift",
            group,
        )
        tree_by_path = {row["path"]: row for row in tree_rows}
        source_index = indexes.get(scope_id, {"included": {}, "excluded": {}})
        governed_paths = set(source_index["included"]) | set(source_index["excluded"])
        validation.require(
            governed_paths == set(tree_by_path),
            f"{scope_id}: sanitized/excluded paths do not partition pinned Git tree",
            group,
        )
        for original, row in source_index["included"].items():
            validation.require(
                tree_by_path.get(original, {}).get("blob") == row.get("git_blob_sha"),
                f"{scope_id}: included manifest Git blob drift",
                group,
            )
        for original, row in source_index["excluded"].items():
            validation.require(
                tree_by_path.get(original, {}).get("blob") == row.get("git_blob_sha"),
                f"{scope_id}: excluded manifest Git blob drift",
                group,
            )

        view = Path(pinned["view"])
        validation.require(view.is_dir() and not view.is_symlink(), f"{scope_id}: view missing/symlink", group)
        if not view.is_dir():
            continue
        nodes = list(view.rglob("*"))
        validation.require(
            not any(node.is_symlink() for node in nodes),
            f"{scope_id}: sanitized view contains symlink",
            group,
        )
        validation.require(
            not any(node.name == ".git" for node in nodes),
            f"{scope_id}: sanitized view contains Git metadata",
            group,
        )
        for directory in [view] + [node for node in nodes if node.is_dir()]:
            validation.require(
                stat.S_IMODE(directory.stat().st_mode) == 0o555,
                f"{scope_id}: sanitized directory mode drift",
                group,
            )
        for file_path in [node for node in nodes if node.is_file()]:
            validation.require(
                stat.S_IMODE(file_path.stat().st_mode) == 0o444,
                f"{scope_id}: sanitized file mode drift",
                group,
            )


def result_payload(
    validation: Validation,
    mode: str,
) -> dict[str, Any]:
    return {
        "schema": "dwp.hris.source-provenance.v1",
        "mode": mode,
        "status": "PASS" if not validation.errors else "FAIL",
        "checks": validation.checks,
        "errors": validation.errors,
        "coverageParents": 2269,
        "inventory": {"routes": 886, "controllers": 825, "entities": 558},
        "sources": len(PINNED_SOURCES),
        "sanitized": {"available": 2258, "blocked": 9, "retired": 2},
        "rawSourceContentRead": False,
        "gitLiveOperations": (
            ["rev-parse HEAD", "rev-parse HEAD^{tree}", "status --porcelain", "ls-tree -r"]
            if mode == "live"
            else []
        ),
        "groups": {
            group: {
                "checks": validation.groups[group],
                "errors": validation.group_errors[group],
            }
            for group in sorted(validation.groups)
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--static", action="store_true")
    mode.add_argument("--check-live", action="store_true")
    args = parser.parse_args()
    validation = Validation()
    try:
        coverage = validate_inventory_and_coverage(validation)
        _trees, views = validate_scope_tree_view_registers(validation)
        validate_evidence_digest(validation)
        indexes = validate_sanitized_views(validation, views)
        validate_access_mapping(validation, coverage, indexes)
        if args.check_live:
            validate_live(validation, indexes)
    except (KeyError, OSError, ValueError, subprocess.SubprocessError) as error:
        validation.require(
            False,
            f"validator exception: {type(error).__name__}",
            "internal",
        )
    mode_name = "live" if args.check_live else "static"
    print(json.dumps(result_payload(validation, mode_name), ensure_ascii=False, sort_keys=True))
    return 0 if not validation.errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
