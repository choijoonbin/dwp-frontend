#!/usr/bin/env python3
"""Generate source-derived causal and per-session module successors.

The operation closed set is authoritative.  Counts are diagnostics derived
from exact IDs; they are never generation targets.  Canonical five inputs do
not reference these derived artifacts or the derived Listening summary.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import os
import stat
import tempfile
from io import StringIO
from pathlib import Path
from typing import Any

from generate_modern_operation_ssot_successor import compose as compose_operation_ssot
from generate_modern_semantic_identity_successor import compose_all as compose_semantic_all
from modern_closed_set_design import PREDECESSOR_OPERATION_SSOT_SHA256


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SSOT = HERE / "modern-capability-operation-causal-contract-ssot.v2.json"
MANIFEST = HERE / "modern-capability-closed-set-manifest.v3.json"
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
BINDINGS = HERE / "modern-capability-semantic-bindings.v1.json"
IDENTITIES = HERE / "modern-capability-public-identity-registry.v1.json"
CAUSAL = HERE / "modern-capability-causal-state-contracts.v2.json"
SUMMARY = HERE / "modern-capability-coding-contract-register.csv"
LISTENING_AUTHORITY = HERE / "sys-listening-stream-authority-successor.v2.json"
MODULES = {
    "HRIS-HRM": ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    "HRIS-PER": ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    "HRIS-TIM": ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    "HRIS-SYS": ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
}

# A canonical candidate is a closed, self-contained eight-file boundary.  The
# causal document is derived from the five canonical source documents; the
# manifest and Listening authority are included in the boundary so a checker
# can reject a partial, substituted, or independently rewritten candidate
# without reading any candidate path through a symlink.
CANDIDATE_FILE_NAMES = tuple(sorted({
    SSOT.name,
    MANIFEST.name,
    EXACT.name,
    EVENTS.name,
    BINDINGS.name,
    IDENTITIES.name,
    CAUSAL.name,
    LISTENING_AUTHORITY.name,
}))
CANDIDATE_SOURCE_NAMES = (
    SSOT.name,
    EXACT.name,
    EVENTS.name,
    BINDINGS.name,
    IDENTITIES.name,
    MANIFEST.name,
)
MAX_CANDIDATE_FILE_BYTES = 64 * 1024 * 1024

# These are historical G1/G2 module contracts.  Their raw bytes are pinned
# separately from their canonical JSON payloads: the former protects byte
# identity while the latter is the predecessor seal used in successor
# lineage.  Do not replace these paths with a dynamically discovered file.
PREDECESSOR_MODULE_PINS: dict[str, dict[str, Any]] = {
    "HRIS-HRM": {
        "path": "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "fileSha256": "ddf1fabeb93667076516250833b48ce9f1546935034402c221dca06e9911d9dc",
        "predecessorSealedPayloadSha256": "1c84109da5e095c78bfddb68037d1d4c5722dc91cabd8dbb4a1b2c31c370b8db",
        "contractId": "dwp.hris.modern.hrm.v1",
        "schemaVersion": 1,
    },
    "HRIS-PER": {
        "path": "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "fileSha256": "d7f1685814c8fd6f2602e10351fabf394fa57355be0b52989122b63da229d654",
        "predecessorSealedPayloadSha256": "0890d328037d01b9ac125ca6923190eb79e4cd7c1f39248d492e9757c955f410",
        "contractId": "dwp.hris.modern.per.v1",
        "schemaVersion": 1,
    },
    "HRIS-TIM": {
        "path": "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "fileSha256": "4677b96f21b39f7cd96b2339b08c0cb0017d122c7b8068e5038ee51903d9d2da",
        "predecessorSealedPayloadSha256": "ddf24bb205a968a29490406bdec2b2c720ad44ad02ec4b98ccc8c622cf8aeaea",
        "contractId": "dwp.hris.modern.tim.v1",
        "schemaVersion": 1,
    },
    "HRIS-SYS": {
        "path": "session-evidence/sys/g3-modern-capability-contracts.v1.json",
        "fileSha256": "4b6d47449fc7ce7070f1b7c46932c529e61e96576b00b75045db266c64791c33",
        "predecessorSealedPayloadSha256": "2ea82e31984d68b2ecf7ab0b7478e58a2505b6bc8027ce60bbb304b183303b0c",
        "contractId": "dwp.hris.modern.sys.v1",
        "schemaVersion": 1,
    },
}

# The only files that production ``--write`` is allowed to create.  PAY is
# intentionally absent: this generator has no PAY producer authority.
SUCCESSOR_MODULE_SPECS: dict[str, dict[str, Any]] = {
    "HRIS-HRM": {
        "path": ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v2.json",
        "contractId": "dwp.hris.modern.hrm.v2",
        "schemaVersion": 2,
    },
    "HRIS-PER": {
        "path": ROOT / "session-evidence/per/g3-modern-capability-contracts.v3.json",
        "contractId": "dwp.hris.modern.per.v3",
        "schemaVersion": 3,
    },
    "HRIS-TIM": {
        "path": ROOT / "session-evidence/tim/g3-modern-capability-contracts.v2.json",
        "contractId": "dwp.hris.modern.tim.v2",
        "schemaVersion": 2,
    },
    "HRIS-SYS": {
        "path": ROOT / "session-evidence/sys/g3-modern-capability-contracts.v2.json",
        "contractId": "dwp.hris.modern.sys.v2",
        "schemaVersion": 2,
    },
}
SUCCESSOR_MODULES: dict[str, Path] = {
    session: spec["path"] for session, spec in SUCCESSOR_MODULE_SPECS.items()
}
SUCCESSOR_SESSIONS = frozenset(SUCCESSOR_MODULE_SPECS)

VALID_OPERATION_MODES = {"COMMAND", "QUERY"}


def render(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def seal(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    payload = json.dumps(
        result, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    result["sealedPayloadSha256"] = hashlib.sha256(payload).hexdigest()
    return result


def _root_relative(path: Path) -> str:
    """Render a workspace path for deterministic lineage (or an absolute test path)."""
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def _canonical_payload_sha256(value: dict[str, Any]) -> str:
    payload = copy.deepcopy(value)
    payload.pop("sealedPayloadSha256", None)
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        .encode("utf-8")
    ).hexdigest()


def _verify_predecessor_pin(
    session: str, path: Path, pin: dict[str, Any],
) -> None:
    """Require exact historical bytes and the canonical predecessor payload seal."""
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"unreadable predecessor for {session}: {path}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"predecessor for {session} must be a JSON object")
    file_sha = hashlib.sha256(raw).hexdigest()
    if file_sha != pin["fileSha256"]:
        raise ValueError(
            f"sealed predecessor byte drift for {session}: "
            f"expected {pin['fileSha256']}, observed {file_sha}"
        )
    payload_sha = _canonical_payload_sha256(value)
    if payload_sha != pin["predecessorSealedPayloadSha256"]:
        raise ValueError(
            f"sealed predecessor payload drift for {session}: "
            f"expected {pin['predecessorSealedPayloadSha256']}, observed {payload_sha}"
        )
    if value.get("contractId") != pin["contractId"]:
        raise ValueError(f"sealed predecessor contract drift for {session}")
    if value.get("schemaVersion") != pin["schemaVersion"]:
        raise ValueError(f"sealed predecessor schema drift for {session}")


def _validate_path_set(
    observed: dict[str, Path], expected: dict[str, Path], label: str,
) -> None:
    if set(observed) != set(expected):
        raise ValueError(f"{label} closed set differs from the exact production set")
    for session in expected:
        if observed[session].resolve() != expected[session].resolve():
            raise ValueError(
                f"{label} path substitution for {session}: "
                f"expected {expected[session]}, observed {observed[session]}"
            )


def _verify_predecessors(
    predecessor_paths: dict[str, Path],
    expected_predecessor_paths: dict[str, Path],
    pins: dict[str, dict[str, Any]] = PREDECESSOR_MODULE_PINS,
) -> None:
    _validate_path_set(predecessor_paths, expected_predecessor_paths, "predecessor")
    if set(pins) != SUCCESSOR_SESSIONS:
        raise ValueError("predecessor pin set is not closed")
    for session in SUCCESSOR_MODULE_SPECS:
        if pins[session].get("path") != _root_relative(MODULES[session]):
            raise ValueError(f"predecessor pin path drift for {session}")
        _verify_predecessor_pin(session, predecessor_paths[session], pins[session])


def _validate_successor_document(
    session: str,
    output_path: Path,
    value: dict[str, Any],
    predecessor_path: Path,
) -> None:
    spec = SUCCESSOR_MODULE_SPECS[session]
    if value.get("contractId") != spec["contractId"]:
        raise ValueError(f"{session} successor contractId is not versioned")
    if value.get("schemaVersion") != spec["schemaVersion"]:
        raise ValueError(f"{session} successor schemaVersion is not versioned")
    expected_lineage = {
        "lineageType": "EXACT_PREDECESSOR_TO_VERSIONED_SUCCESSOR",
        "predecessorPath": _root_relative(predecessor_path),
        "predecessorFileSha256": PREDECESSOR_MODULE_PINS[session]["fileSha256"],
        "predecessorSealedPayloadSha256": PREDECESSOR_MODULE_PINS[session][
            "predecessorSealedPayloadSha256"
        ],
        "predecessorContractId": PREDECESSOR_MODULE_PINS[session]["contractId"],
        "predecessorSchemaVersion": PREDECESSOR_MODULE_PINS[session]["schemaVersion"],
        "predecessorSealKind": "CANONICAL_JSON_PAYLOAD_SHA256",
        "successorPath": _root_relative(output_path),
        "successorContractId": spec["contractId"],
        "successorSchemaVersion": spec["schemaVersion"],
        "predecessorBytesPreserved": True,
        "canonicalPromotionAuthorized": False,
    }
    if value.get("successorLineage") != expected_lineage:
        raise ValueError(f"{session} successor lineage is not an exact predecessor pin")
    if value.get("sealedPayloadSha256") != _canonical_payload_sha256(value):
        raise ValueError(f"{session} successor payload seal mismatch")


def _validate_successor_outputs(
    outputs: dict[str, Path],
    expected_outputs: dict[str, Path],
    predecessor_paths: dict[str, Path],
) -> None:
    _validate_path_set(outputs, expected_outputs, "successor output")
    output_set = {path.resolve() for path in outputs.values()}
    predecessor_set = {path.resolve() for path in predecessor_paths.values()}
    if output_set & predecessor_set:
        raise ValueError("successor output path aliases a predecessor path")


def _atomic_no_replace_write(
    entries: list[tuple[Path, bytes]],
) -> None:
    """Publish staged bytes with atomic create-only links; never replace a target."""
    staged: list[tuple[Path, Path, bytes]] = []
    created: list[tuple[Path, int, int]] = []
    try:
        for output, payload in entries:
            if output.exists():
                raise FileExistsError(f"successor target already exists: {output}")
            if not output.parent.is_dir():
                raise ValueError(f"successor target parent is absent: {output.parent}")
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=output.parent, prefix=output.name + ".",
                suffix=".stage", delete=False,
            ) as handle:
                staged_path = Path(handle.name)
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            staged.append((staged_path, output, payload))

        # A target may appear after the first preflight check.  os.link is the
        # final atomic no-replace operation and fails with EEXIST in that race.
        for staged_path, output, _ in staged:
            if output.exists():
                raise FileExistsError(f"successor target appeared during staging: {output}")
        for staged_path, output, _ in staged:
            os.link(staged_path, output)
            stat = output.stat()
            created.append((output, stat.st_dev, stat.st_ino))
            os.unlink(staged_path)
            _fsync_directory(output.parent)
        staged.clear()
    except Exception:
        for output, device, inode in reversed(created):
            try:
                stat = output.stat()
                if stat.st_dev == device and stat.st_ino == inode:
                    output.unlink()
                    _fsync_directory(output.parent)
            except FileNotFoundError:
                pass
        raise
    finally:
        for staged_path, _, _ in staged:
            try:
                staged_path.unlink()
            except FileNotFoundError:
                pass


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _write_versioned_successor_modules(
    modules: dict[str, dict[str, Any]],
    output_paths: dict[str, Path] | None = None,
    predecessor_paths: dict[str, Path] | None = None,
    expected_output_paths: dict[str, Path] | None = None,
    expected_predecessor_paths: dict[str, Path] | None = None,
) -> dict[str, str]:
    """Write only the closed successor set, with exact pins and no replacement.

    The expected-path parameters exist only for isolated temporary self-tests;
    production callers use their exact defaults and have no output-path CLI.
    """
    if output_paths is None:
        output_paths = SUCCESSOR_MODULES
    if predecessor_paths is None:
        predecessor_paths = MODULES
    if expected_output_paths is None:
        expected_output_paths = SUCCESSOR_MODULES
    if expected_predecessor_paths is None:
        expected_predecessor_paths = MODULES
    _validate_successor_outputs(output_paths, expected_output_paths, predecessor_paths)
    _verify_predecessors(predecessor_paths, expected_predecessor_paths)
    entries: list[tuple[Path, bytes]] = []
    for session in sorted(SUCCESSOR_SESSIONS):
        value = modules[session]
        output = output_paths[session]
        _validate_successor_document(
            session, output, value, predecessor_paths[session]
        )
        entries.append((output, render(value).encode("utf-8")))
    _atomic_no_replace_write(entries)
    return {
        _root_relative(path): hashlib.sha256(path.read_bytes()).hexdigest()
        for path, _ in entries
    }


def _index_unique(
    rows: list[dict[str, Any]], key: str, label: str,
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for position, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"{label}[{position}] must be an object")
        value = row.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{label}[{position}].{key} must be a non-empty string")
        if value in result:
            raise ValueError(f"duplicate {label} {key}: {value}")
        result[value] = row
    return result


def _nonempty_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{label} must be a non-empty string list")
    if any(not isinstance(item, str) or not item for item in value):
        raise ValueError(f"{label} must contain only non-empty strings")
    if len(value) != len(set(value)):
        raise ValueError(f"{label} contains duplicates")
    return list(value)


def _transition_states(
    subject: str, transition: dict[str, Any], key: str,
) -> list[str]:
    """Return an exact state union without guessing missing transition facts."""
    direct = transition.get(key)
    if direct is not None:
        return _nonempty_string_list(direct, f"{subject}.transition.{key}")
    branches = transition.get("branches")
    if not isinstance(branches, list) or not branches:
        raise ValueError(
            f"{subject}.transition.{key} is absent and no closed branches exist"
        )
    branch_key = "preState" if key == "preStates" else "postState"
    states: list[str] = []
    for position, branch in enumerate(branches):
        if not isinstance(branch, dict):
            raise ValueError(
                f"{subject}.transition.branches[{position}] must be an object"
            )
        state = branch.get(branch_key)
        if not isinstance(state, str) or not state:
            raise ValueError(
                f"{subject}.transition.branches[{position}].{branch_key} "
                "must be a non-empty string"
            )
        states.append(state)
    return sorted(set(states))


def _handler_events(handler: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    primary = handler.get("event")
    if primary is not None:
        if not isinstance(primary, dict):
            raise ValueError(f"{handler['handlerId']}.event must be an object")
        result.append(primary)
    for key in ("additionalEvents", "events"):
        values = handler.get(key, [])
        if not isinstance(values, list):
            raise ValueError(f"{handler['handlerId']}.{key} must be a list")
        if any(not isinstance(value, dict) for value in values):
            raise ValueError(f"{handler['handlerId']}.{key} must contain objects")
        result.extend(values)
    names = [row.get("eventName") for row in result]
    if any(not isinstance(name, str) or not name for name in names):
        raise ValueError(f"{handler['handlerId']} contains an invalid eventName")
    if len(names) != len(set(names)):
        raise ValueError(f"{handler['handlerId']} contains duplicate events")
    return result


def _handler_transition(
    handler: dict[str, Any],
) -> tuple[str, dict[str, Any] | None]:
    """Project only an explicitly closed handler state edge.

    Listening contains rootless multi-owner sagas and rooted append/multi-phase
    workers.  Their complete handler contracts remain in
    ``internalConsumerHandlers``; inventing one pre/post edge from DML would
    discard branches and is therefore forbidden.
    """
    handler_id = handler["handlerId"]
    root = handler.get("aggregateRoot")
    if root is None:
        return "ROOTLESS_EXACT_HANDLER_CONTRACT", None
    if not isinstance(root, dict):
        raise ValueError(f"{handler_id}.aggregateRoot must be an object or null")
    for key in ("table", "stateColumn"):
        if not isinstance(root.get(key), str) or not root[key]:
            raise ValueError(f"{handler_id}.aggregateRoot.{key} is required")
    has_pre = "preStates" in root
    has_post = "postStates" in root
    if has_pre != has_post:
        raise ValueError(
            f"{handler_id}.aggregateRoot must declare both preStates and postStates"
        )
    if not has_pre:
        return "ROOTED_EXACT_HANDLER_CONTRACT_NO_SINGLE_CLOSED_EDGE", None
    if root["preStates"] == [] and root.get("transitionKind") \
            == "APPEND_ONLY_OBSERVATION_NO_CASE_STATE_CHANGE":
        _nonempty_string_list(
            root["postStates"], f"{handler_id}.aggregateRoot.postStates"
        )
        return "APPEND_ONLY_OBSERVATION_EXACT_HANDLER_CONTRACT", None
    pre_states = _nonempty_string_list(
        root["preStates"], f"{handler_id}.aggregateRoot.preStates"
    )
    post_states = _nonempty_string_list(
        root["postStates"], f"{handler_id}.aggregateRoot.postStates"
    )
    transition_id = "HANDLER-" + handler_id.upper()
    return "EXPLICIT_ROOT_STATE_TRANSITION", {
        "transitionId": transition_id,
        "operationId": handler_id,
        "from": "|".join(pre_states),
        "to": "|".join(post_states),
        "aggregateRootTable": root["table"],
        "stateColumn": root["stateColumn"],
        "preStates": copy.deepcopy(pre_states),
        "postStates": copy.deepcopy(post_states),
        "postStateSource": "SIGNED_OWNER_RESULT",
        "postStateSink": root["table"] + "." + root["stateColumn"],
        "guard": "claimed inbox+exact signed owner result+CAS",
        "projectionKind": "EXPLICIT_HANDLER_ROOT_STATE_EDGE",
    }


def validate_source_projection_inputs(
    ssot: dict[str, Any], exact: dict[str, Any], events: dict[str, Any],
    manifest: dict[str, Any],
) -> None:
    """Validate every source variant before any derived artifact is staged."""
    manifest_ops = _index_unique(manifest.get("operations", []), "operationId", "manifest.operations")
    source_ops = _index_unique(ssot.get("operations", []), "operationId", "ssot.operations")
    bindings = _index_unique(exact.get("operationBindings", []), "operationId", "exact.operationBindings")
    lineages = _index_unique(
        exact.get("operationFieldLineage", []), "operationId", "exact.operationFieldLineage"
    )
    expected_ops = set(manifest_ops)
    for label, observed in (
        ("ssot.operations", set(source_ops)),
        ("exact.operationBindings", set(bindings)),
        ("exact.operationFieldLineage", set(lineages)),
    ):
        if observed != expected_ops:
            raise ValueError(f"{label} closed set differs from manifest")

    operation_event_producers: dict[str, list[str]] = {}
    for operation_id, operation in source_ops.items():
        manifest_row = manifest_ops[operation_id]
        mode = operation.get("mode")
        if mode not in VALID_OPERATION_MODES:
            raise ValueError(f"{operation_id} has invalid mode {mode!r}")
        if mode != manifest_row.get("mode") or operation.get("session") != manifest_row.get("session"):
            raise ValueError(f"{operation_id} mode/session differs from manifest")
        if bindings[operation_id].get("mode") != mode:
            raise ValueError(f"{operation_id} exact binding mode differs from SSOT")
        operation_events = operation.get("events", [])
        if not isinstance(operation_events, list):
            raise ValueError(f"{operation_id}.events must be a list")
        event_names: list[str] = []
        for position, event in enumerate(operation_events):
            if not isinstance(event, dict):
                raise ValueError(f"{operation_id}.events[{position}] must be an object")
            event_name = event.get("eventName")
            if not isinstance(event_name, str) or not event_name:
                raise ValueError(f"{operation_id}.events[{position}].eventName is invalid")
            event_names.append(event_name)
            operation_event_producers.setdefault(event_name, []).append(operation_id)
        if len(event_names) != len(set(event_names)):
            raise ValueError(f"{operation_id} contains duplicate events")
        if set(event_names) != set(manifest_row.get("eventIds", [])):
            raise ValueError(f"{operation_id} event set differs from manifest")
        transition = operation.get("transition")
        if mode == "QUERY":
            if transition is not None or event_names:
                raise ValueError(f"{operation_id} query cannot have transition/events")
            if bindings[operation_id].get("stateTransitionIds") or bindings[operation_id].get("eventNames"):
                raise ValueError(f"{operation_id} query exact binding mutates or emits")
            continue
        if not isinstance(transition, dict):
            raise ValueError(f"{operation_id} command requires a transition object")
        transition_id = transition.get("transitionId")
        if not isinstance(transition_id, str) or not transition_id:
            raise ValueError(f"{operation_id}.transition.transitionId is required")
        _transition_states(operation_id, transition, "preStates")
        _transition_states(operation_id, transition, "postStates")
        root = operation.get("aggregateRoot")
        if not isinstance(root, dict) or not root.get("table") or not root.get("stateColumn"):
            raise ValueError(f"{operation_id} command requires a physical aggregate root")
        if bindings[operation_id].get("stateTransitionIds") != [transition_id]:
            raise ValueError(f"{operation_id} exact transition binding differs from SSOT")
        if set(bindings[operation_id].get("eventNames", [])) != set(event_names):
            raise ValueError(f"{operation_id} exact event binding differs from SSOT")

    manifest_handlers = _nonempty_string_list(
        manifest.get("handlerIds"), "manifest.handlerIds"
    )
    handlers = _index_unique(ssot.get("systemHandlers", []), "handlerId", "ssot.systemHandlers")
    if set(handlers) != set(manifest_handlers):
        raise ValueError("ssot.systemHandlers closed set differs from manifest")
    handler_event_producers: dict[str, list[str]] = {}
    for handler_id, handler in handlers.items():
        if not isinstance(handler.get("session"), str) or not handler["session"]:
            raise ValueError(f"{handler_id}.session is required")
        if not isinstance(handler.get("capabilityId"), str) or not handler["capabilityId"]:
            raise ValueError(f"{handler_id}.capabilityId is required")
        _handler_transition(handler)
        for event in _handler_events(handler):
            handler_event_producers.setdefault(event["eventName"], []).append(handler_id)

    schemas = _index_unique(
        events.get("eventPayloadSchemas", []), "eventName", "events.eventPayloadSchemas"
    )
    expected_events = set(_nonempty_string_list(
        manifest.get("publicEventIds"), "manifest.publicEventIds"
    ))
    if set(schemas) != expected_events:
        raise ValueError("event schema closed set differs from manifest")
    if set(operation_event_producers) | set(handler_event_producers) != expected_events:
        raise ValueError("SSOT event producer closed set differs from manifest")
    for event_name, schema in schemas.items():
        operation_ids = schema.get("emittedByOperationIds")
        handler_ids = schema.get("emittedByInternalHandlerIds")
        if not isinstance(operation_ids, list) or not isinstance(handler_ids, list):
            raise ValueError(f"{event_name} must declare both producer identity lists")
        if operation_ids != operation_event_producers.get(event_name, []):
            raise ValueError(f"{event_name} operation producer identity drift")
        if handler_ids != handler_event_producers.get(event_name, []):
            raise ValueError(f"{event_name} handler producer identity drift")
        if len(operation_ids) + len(handler_ids) < 1:
            raise ValueError(f"{event_name} has no causal producer")
        producer_id = (operation_ids + handler_ids)[0]
        producer = source_ops.get(producer_id) or handlers.get(producer_id)
        if not producer or schema.get("session") != producer.get("session") \
                or schema.get("capabilityId") != producer.get("capabilityId"):
            raise ValueError(f"{event_name} producer session/capability drift")

    table_specs = _index_unique(
        exact.get("tableSpecifications", []), "tableName", "exact.tableSpecifications"
    )
    expected_tables = set(_nonempty_string_list(
        manifest.get("tableIds"), "manifest.tableIds"
    ))
    if set(table_specs) != expected_tables:
        raise ValueError("exact table closed set differs from manifest")


def _event_causal(event: dict[str, Any]) -> dict[str, Any]:
    fields = event["fields"]
    by_name = {row["name"]: row for row in fields}
    return {
        "eventName": event["eventName"],
        "eventType": event["eventName"].rsplit(".v", 1)[0],
        "aggregateEntityType": event["aggregateEntityType"],
        "aggregateIdSource": by_name["aggregateId"]["source"],
        "aggregateVersionSource": by_name["aggregateVersion"]["source"],
        "postStateSource": by_name["toState"]["source"],
        "emissionBoundary": "SAME_TRANSACTION_OUTBOX_LAST_AFTER_CLOSED_RECEIPT",
        "emissionCondition": event.get("condition", "ALWAYS"),
        "payloadFields": [row["name"] for row in fields],
        "payloadFieldSources": [
            {
                "field": row["name"], "source": row["source"],
                "sourceKind": row["sourceKind"],
                **({"referenceContract": copy.deepcopy(row["referenceContract"])}
                   if row.get("referenceContract") else {}),
            }
            for row in fields
        ],
        "deliveryPolicy": copy.deepcopy(event["audience"]),
        "consumerRefetch": copy.deepcopy(event["refetchContract"]),
        "restartReplay": "BYTE_IDENTICAL_FROM_DURABLE_FACTS",
    }


def build_causal(
    ssot: dict[str, Any], exact: dict[str, Any], events: dict[str, Any],
    semantic: dict[str, Any], identities: dict[str, Any], manifest: dict[str, Any],
) -> dict[str, Any]:
    bindings = {row["operationId"]: row for row in exact["operationBindings"]}
    lineages = {row["operationId"]: row for row in exact["operationFieldLineage"]}
    operations = []
    for source in ssot["operations"]:
        operation_id = source["operationId"]
        binding = bindings[operation_id]
        lineage = lineages[operation_id]
        domain_steps = [
            copy.deepcopy(row) for row in source.get("orderedDml", [])
            if row.get("role") not in {"COMMAND_RECEIPT", "TRANSACTIONAL_OUTBOX"}
        ]
        operations.append({
            "operationId": operation_id, "mode": source["mode"],
            "method": source["method"], "path": source["path"],
            "session": source["session"], "capabilityId": source["capabilityId"],
            "authorizationCapability": source["authorizationCapability"],
            "aggregateRoot": copy.deepcopy(source.get("aggregateRoot")),
            "readTables": copy.deepcopy(binding["readsTables"]),
            "writeTables": copy.deepcopy(binding["writesTables"]),
            "orderedDomainDml": domain_steps,
            "transactionEnvelope": copy.deepcopy(source.get("transactionEnvelope")),
            "mutationFieldSet": copy.deepcopy(lineage["mutationFieldSources"]),
            "transition": copy.deepcopy(source.get("transition")),
            "requiredInputUses": copy.deepcopy(source.get("inputEffects", [])),
            "causalEvents": [_event_causal(row) for row in source.get("events", [])],
            "identityConstraints": copy.deepcopy(source.get("selectors", [])),
            "forbiddenRequestFields": copy.deepcopy(source.get("forbiddenRequestFields", [])),
            "responseSchemaRef": binding["responseSchemaRef"],
            "responseFieldSources": copy.deepcopy(lineage["responseFieldSources"]),
            "queryProjection": copy.deepcopy(binding.get("responseProjection")),
        })
    source_pins = {
        SSOT.name: hashlib.sha256(render(ssot).encode("utf-8")).hexdigest(),
        EXACT.name: hashlib.sha256(render(exact).encode("utf-8")).hexdigest(),
        EVENTS.name: hashlib.sha256(render(events).encode("utf-8")).hexdigest(),
        BINDINGS.name: hashlib.sha256(render(semantic).encode("utf-8")).hexdigest(),
        IDENTITIES.name: hashlib.sha256(render(identities).encode("utf-8")).hexdigest(),
    }
    result = {
        "contractId": "dwp.hris.modern.causal-state-contracts.v3",
        "schemaVersion": 3, "status": "SEALED_G3_DESIGN_NOT_IMPLEMENTED",
        "scope": {
            "operations": len(operations),
            "commands": sum(row["mode"] == "COMMAND" for row in operations),
            "queries": sum(row["mode"] == "QUERY" for row in operations),
            "causalEvents": len(events["eventPayloadSchemas"]),
            "internalConsumerHandlers": len(ssot["systemHandlers"]),
            "tables": len(exact["tableSpecifications"]),
            "implementationState": "NOT_STARTED_G3",
            "productionState": "NOT_AUTHORIZED_G6",
        },
        "closedSetManifest": {
            "manifestId": manifest["manifestId"],
            "sealedPayloadSha256": manifest["sealedPayloadSha256"],
            "countsAreSourceDerived": True,
        },
        "policies": {
            "commandOrder": "CLAIM_RECEIPT_DOMAIN_CAS_CLOSED_RESULT_OUTBOX_LAST_ONE_TX",
            "handlerOrder": "CLAIM_INBOX_DOMAIN_CAS_CLOSED_ACK_OUTBOX_LAST_ONE_TX",
            "idempotencyTuple": "tenant+caller+operation+key",
            "requestDigest": "method+path+selectors+body excluding replay/trace/auth context",
            "eventSources": "PHYSICAL_POST_LOCKED_PRE_IMMUTABLE_OWNER_PROOF_ONLY",
            "responseSources": "PHYSICAL_POST_SEALED_RECEIPT_IMMUTABLE_PROOF_ONLY",
            "latestFallback": "FORBIDDEN",
            "implementationGate": "G3_NOT_STARTED_G6_NOT_AUTHORIZED",
        },
        "transactionInfrastructure": copy.deepcopy(ssot["transactionInfrastructure"]),
        "operations": operations,
        "internalConsumerHandlers": copy.deepcopy(ssot["systemHandlers"]),
        "eventSuccessorLineage": copy.deepcopy(ssot["eventSuccessorLineage"]),
        "canonicalSourcePins": dict(sorted(source_pins.items())),
        "dependencyDirection": "CANONICAL_FIVE_TO_CAUSAL_AND_MODULE_DERIVATIVES_ONLY",
        "derivedListeningSummaryDependency": "OPTIONAL_POST_CANONICAL_VALIDATION_ONLY",
    }
    return seal(result)


def _module_operation(binding: dict[str, Any]) -> dict[str, Any]:
    return {
        "operationId": binding["operationId"], "method": binding["method"],
        "path": binding["path"], "action": binding["action"],
        "authorizationCapability": binding["authorizationCapability"],
        "scope": copy.deepcopy(binding["scope"]), "mode": binding["mode"],
        "requestSchemaRef": binding["requestSchemaRef"],
        "responseSchemaRef": binding["responseSchemaRef"],
        "idempotency": binding["idempotency"],
        "expectedVersion": binding["expectedVersion"],
        "transitionIds": copy.deepcopy(binding["stateTransitionIds"]),
        "emits": copy.deepcopy(binding["eventNames"]),
        "readsTables": copy.deepcopy(binding["readsTables"]),
        "writesTables": copy.deepcopy(binding["writesTables"]),
    }


def _module_event(schema: dict[str, Any], transition_by_event: dict[str, list[str]]) -> dict[str, Any]:
    return {
        "name": schema["eventName"], "type": schema["eventType"],
        "version": schema["schemaVersion"], "topic": schema["topic"],
        "aggregate": next(
            row.get("referenceContract", {}).get("entityType")
            for row in schema["fields"] if row["name"] == "aggregateId"
        ),
        "payloadRequired": [row["name"] for row in schema["fields"] if row["required"]],
        "emittedOn": transition_by_event.get(schema["eventName"], []),
        "emittedByOperationIds": copy.deepcopy(schema["emittedByOperationIds"]),
        "emittedByInternalHandlerIds": copy.deepcopy(
            schema["emittedByInternalHandlerIds"]
        ),
        "emissionCondition": schema["emissionCondition"],
        "causalRule": schema["causalRule"],
        "deliveryPolicy": copy.deepcopy(schema["deliveryPolicy"]),
    }


def _module_table(table: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": table["tableName"], "kind": table["kind"],
        "idColumn": table["idColumn"]["name"],
        "effectiveTime": table.get("effectiveTime"),
        "immutability": table.get("immutability"),
        "foreignKeyBoundaries": copy.deepcopy(table.get("foreignKeys", [])),
        "typedOwnerReferenceContracts": copy.deepcopy(
            table.get("typedOwnerReferenceContracts", [])
        ),
        "uniqueKeys": copy.deepcopy(table.get("uniqueKeys", [])),
        "checks": copy.deepcopy(table.get("checks", [])),
        "indexes": copy.deepcopy(table.get("indexes", [])),
        "retentionClass": table.get("retentionPolicyRef"),
        "rowSecurity": table.get("rowSecurity"),
        "exactSpecificationRef": (
            "modern-capability-exact-schema-contracts.v1.json#tableSpecifications/"
            + table["tableName"]
        ),
    }


def project_modules(
    ssot: dict[str, Any], exact: dict[str, Any], events: dict[str, Any]
) -> dict[Path, dict[str, Any]]:
    operations = exact["operationBindings"]
    event_schemas = events["eventPayloadSchemas"]
    tables = exact["tableSpecifications"]
    transition_id_by_operation = {
        operation["operationId"]: operation["transition"]["transitionId"]
        for operation in ssot["operations"] if operation["mode"] == "COMMAND"
    }
    handler_projection = {
        handler["handlerId"]: _handler_transition(handler)
        for handler in ssot["systemHandlers"]
    }
    transition_id_by_handler = {
        handler_id: transition["transitionId"]
        for handler_id, (_, transition) in handler_projection.items()
        if transition is not None
    }
    transition_by_event = {
        schema["eventName"]: [
            transition_id_by_operation[operation_id]
            for operation_id in schema["emittedByOperationIds"]
        ] + [
            transition_id_by_handler[handler_id]
            for handler_id in schema["emittedByInternalHandlerIds"]
            if handler_id in transition_id_by_handler
        ]
        for schema in event_schemas
    }
    results = {}
    for session, path in MODULES.items():
        module = json.loads(path.read_text(encoding="utf-8"))
        capability_by_id = {row["capabilityId"]: row for row in module["capabilities"]}
        for capability_id, capability in capability_by_id.items():
            cap_ops = [
                row for row in operations
                if row["session"] == session and row["capabilityId"] == capability_id
            ]
            source_ops = [
                row for row in ssot["operations"]
                if row["session"] == session and row["capabilityId"] == capability_id
            ]
            handlers = [
                copy.deepcopy(row) for row in ssot["systemHandlers"]
                if row["session"] == session and row["capabilityId"] == capability_id
            ]
            transitions = []
            for row in source_ops:
                if row["mode"] != "COMMAND":
                    continue
                pre_states = _transition_states(row["operationId"], row["transition"], "preStates")
                post_states = _transition_states(row["operationId"], row["transition"], "postStates")
                transition = {
                    "transitionId": row["transition"]["transitionId"],
                    "operationId": row["operationId"],
                    "from": "|".join(pre_states),
                    "to": "|".join(post_states),
                    "aggregateRootTable": row["aggregateRoot"]["table"],
                    "stateColumn": row["aggregateRoot"]["stateColumn"],
                    "preStates": pre_states,
                    "postStates": post_states,
                    "postStateSource": row["transition"]["postStateSource"],
                    "postStateSink": row["transition"].get("stateSink")
                        or row["transition"].get("physicalPostStateSink"),
                    "guard": "tenant+purpose+population+exact CAS and owner proof",
                    "projectionKind": "PUBLIC_COMMAND_STATE_TRANSITION",
                }
                if row["transition"].get("branches") is not None:
                    transition["branches"] = copy.deepcopy(row["transition"]["branches"])
                transitions.append(transition)
            for handler in handlers:
                _, transition = handler_projection[handler["handlerId"]]
                if transition is not None:
                    transitions.append(copy.deepcopy(transition))
            cap_events = [
                row for row in event_schemas
                if row["session"] == session and row["capabilityId"] == capability_id
            ]
            cap_tables = [
                row for row in tables
                if row["session"] == session and row["capabilityId"] == capability_id
            ]
            capability["operations"] = [_module_operation(row) for row in cap_ops]
            capability["stateMachines"] = [{
                "stateMachineId": capability_id + ".StateMachine.v3",
                "aggregate": "OPERATION_SCOPED_EXACT_PHYSICAL_ROOTS",
                "initialState": "SEE_EACH_TRANSITION",
                "terminalStates": sorted({state for row in transitions for state in row["postStates"]}),
                "transitions": transitions,
            }]
            capability["events"] = [
                _module_event(row, transition_by_event) for row in cap_events
            ]
            capability["tables"] = [_module_table(row) for row in cap_tables]
            capability["internalConsumerHandlers"] = handlers
            capability["internalConsumerHandlerProjection"] = [{
                "handlerId": handler["handlerId"],
                "projectionKind": handler_projection[handler["handlerId"]][0],
                "stateTransitionId": (
                    handler_projection[handler["handlerId"]][1] or {}
                ).get("transitionId"),
                "sourceContractPreserved": True,
                "dmlStateInference": "FORBIDDEN",
            } for handler in handlers]
            capability["implementationState"] = "NOT_STARTED_G3"
            capability["productionState"] = "NOT_AUTHORIZED_G6"
        module["sourceDerivedClosure"] = {
            "operations": sum(len(row["operations"]) for row in module["capabilities"]),
            "events": sum(len(row["events"]) for row in module["capabilities"]),
            "tables": sum(len(row["tables"]) for row in module["capabilities"]),
            "handlers": sum(len(row["internalConsumerHandlers"]) for row in module["capabilities"]),
            "handlerStateTransitions": sum(
                sum(item["stateTransitionId"] is not None
                    for item in row["internalConsumerHandlerProjection"])
                for row in module["capabilities"]
            ),
            "handlerExactSourceOnly": sum(
                sum(item["stateTransitionId"] is None
                    for item in row["internalConsumerHandlerProjection"])
                for row in module["capabilities"]
            ),
        }
        results[path] = module
    return results


def project_versioned_successor_modules(
    modules: dict[Path, dict[str, Any]],
    output_paths: dict[str, Path] | None = None,
    predecessor_paths: dict[str, Path] | None = None,
) -> dict[str, dict[str, Any]]:
    """Create self-sealed, lineage-bearing successor documents in memory only."""
    if output_paths is None:
        output_paths = SUCCESSOR_MODULES
    if predecessor_paths is None:
        predecessor_paths = MODULES
    if set(output_paths) != SUCCESSOR_SESSIONS:
        raise ValueError("successor output set is not the closed HRM/PER/TIM/SYS set")
    if set(predecessor_paths) != SUCCESSOR_SESSIONS:
        raise ValueError("predecessor input set is not the closed HRM/PER/TIM/SYS set")
    results: dict[str, dict[str, Any]] = {}
    for session in sorted(SUCCESSOR_SESSIONS):
        predecessor_path = MODULES[session]
        if predecessor_path not in modules:
            raise ValueError(f"projected predecessor is missing for {session}")
        successor = copy.deepcopy(modules[predecessor_path])
        spec = SUCCESSOR_MODULE_SPECS[session]
        pin = PREDECESSOR_MODULE_PINS[session]
        successor["contractId"] = spec["contractId"]
        successor["schemaVersion"] = spec["schemaVersion"]
        successor["successorLineage"] = {
            "lineageType": "EXACT_PREDECESSOR_TO_VERSIONED_SUCCESSOR",
            "predecessorPath": _root_relative(predecessor_paths[session]),
            "predecessorFileSha256": pin["fileSha256"],
            "predecessorSealedPayloadSha256": pin[
                "predecessorSealedPayloadSha256"
            ],
            "predecessorContractId": pin["contractId"],
            "predecessorSchemaVersion": pin["schemaVersion"],
            "predecessorSealKind": "CANONICAL_JSON_PAYLOAD_SHA256",
            "successorPath": _root_relative(output_paths[session]),
            "successorContractId": spec["contractId"],
            "successorSchemaVersion": spec["schemaVersion"],
            "predecessorBytesPreserved": True,
            "canonicalPromotionAuthorized": False,
        }
        results[session] = seal(successor)
    return results


def project_summary(modules: dict[Path, dict[str, Any]]) -> str:
    with SUMMARY.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        names = list(reader.fieldnames or [])
        rows = list(reader)
    capabilities = {
        row["capabilityId"]: row
        for module in modules.values() for row in module["capabilities"]
    }
    for row in rows:
        capability = capabilities[row["capability_id"]]
        row["api_operation_count"] = str(len(capability["operations"]))
        row["state_machine_count"] = str(len(capability["stateMachines"]))
        row["state_transition_count"] = str(sum(
            len(machine["transitions"]) for machine in capability["stateMachines"]
        ))
        row["event_count"] = str(len(capability["events"]))
        row["physical_table_count"] = str(len(capability["tables"]))
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=names, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def compose_inputs(base_dir: Path | None = None) -> tuple[
    dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]
]:
    if base_dir is not None:
        return tuple(
            json.loads((base_dir / path.name).read_text(encoding="utf-8"))
            for path in (SSOT, EXACT, EVENTS, BINDINGS, IDENTITIES, MANIFEST)
        )  # type: ignore[return-value]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    ssot_bytes = SSOT.read_bytes()
    current_ssot = json.loads(ssot_bytes)
    current_sha = hashlib.sha256(ssot_bytes).hexdigest()
    if current_sha == PREDECESSOR_OPERATION_SSOT_SHA256:
        ssot = compose_operation_ssot(current_ssot, manifest)
    elif current_ssot.get("closedSetManifest", {}).get("sealedPayloadSha256") == manifest["sealedPayloadSha256"]:
        ssot = current_ssot
    else:
        raise ValueError("operation SSOT is neither sealed predecessor nor current successor")
    exact, events, semantic, identities = compose_semantic_all(
        json.loads(EXACT.read_text(encoding="utf-8")),
        json.loads(EVENTS.read_text(encoding="utf-8")),
        current_ssot, current_sha, manifest,
    )
    return ssot, exact, events, semantic, identities, manifest


def validate(
    causal: dict[str, Any], modules: dict[Path, dict[str, Any]], manifest: dict[str, Any],
    ssot: dict[str, Any] | None = None, exact: dict[str, Any] | None = None,
    events: dict[str, Any] | None = None,
) -> None:
    expected_ops = {row["operationId"] for row in manifest["operations"]}
    causal_ids = [row["operationId"] for row in causal["operations"]]
    if len(causal_ids) != len(set(causal_ids)) or set(causal_ids) != expected_ops:
        raise ValueError("causal operation closure differs from manifest")
    observed_op_rows = [
        row["operationId"] for module in modules.values()
        for capability in module["capabilities"] for row in capability["operations"]
    ]
    if len(observed_op_rows) != len(set(observed_op_rows)) \
            or set(observed_op_rows) != expected_ops:
        raise ValueError("module operation closure differs from manifest")
    observed_event_rows = [
        row["name"] for module in modules.values()
        for capability in module["capabilities"] for row in capability["events"]
    ]
    if len(observed_event_rows) != len(set(observed_event_rows)) \
            or set(observed_event_rows) != set(manifest["publicEventIds"]):
        raise ValueError("module event closure differs from manifest")
    observed_table_rows = [
        row["name"] for module in modules.values()
        for capability in module["capabilities"] for row in capability["tables"]
    ]
    if len(observed_table_rows) != len(set(observed_table_rows)) \
            or set(observed_table_rows) != set(manifest["tableIds"]):
        raise ValueError("module table closure differs from manifest")
    observed_handler_rows = [
        row["handlerId"] for module in modules.values()
        for capability in module["capabilities"]
        for row in capability["internalConsumerHandlers"]
    ]
    if len(observed_handler_rows) != len(set(observed_handler_rows)) \
            or set(observed_handler_rows) != set(manifest["handlerIds"]):
        raise ValueError("module handler closure differs from manifest")

    if ssot is None or exact is None or events is None:
        return
    source_ops = _index_unique(ssot["operations"], "operationId", "ssot.operations")
    bindings = _index_unique(exact["operationBindings"], "operationId", "exact.operationBindings")
    schemas = _index_unique(events["eventPayloadSchemas"], "eventName", "events.eventPayloadSchemas")
    handlers = _index_unique(ssot["systemHandlers"], "handlerId", "ssot.systemHandlers")
    module_ops = {
        row["operationId"]: row for module in modules.values()
        for capability in module["capabilities"] for row in capability["operations"]
    }
    for operation_id, binding in bindings.items():
        if module_ops[operation_id] != _module_operation(binding):
            raise ValueError(f"{operation_id} module operation projection drift")
        causal_row = next(row for row in causal["operations"] if row["operationId"] == operation_id)
        if causal_row["mode"] != source_ops[operation_id]["mode"]:
            raise ValueError(f"{operation_id} causal mode projection drift")
        if causal_row["mode"] == "QUERY" and (
            causal_row["writeTables"] or causal_row["orderedDomainDml"]
            or causal_row["transition"] is not None or causal_row["causalEvents"]
        ):
            raise ValueError(f"{operation_id} query projection is not read-only")

    module_handlers = {
        row["handlerId"]: row for module in modules.values()
        for capability in module["capabilities"]
        for row in capability["internalConsumerHandlers"]
    }
    for handler_id, handler in handlers.items():
        if module_handlers[handler_id] != handler:
            raise ValueError(f"{handler_id} exact handler contract projection drift")

    projected_transitions = {
        row["transitionId"]: row for module in modules.values()
        for capability in module["capabilities"]
        for machine in capability["stateMachines"] for row in machine["transitions"]
    }
    expected_transition_ids = {
        row["transition"]["transitionId"] for row in ssot["operations"]
        if row["mode"] == "COMMAND"
    }
    expected_transition_ids.update(
        transition["transitionId"] for handler in handlers.values()
        for _, transition in [_handler_transition(handler)] if transition is not None
    )
    if set(projected_transitions) != expected_transition_ids:
        raise ValueError("module explicit state transition projection drift")

    module_events = {
        row["name"]: row for module in modules.values()
        for capability in module["capabilities"] for row in capability["events"]
    }
    for event_name, schema in schemas.items():
        projected = module_events[event_name]
        if projected["emittedByOperationIds"] != schema["emittedByOperationIds"] \
                or projected["emittedByInternalHandlerIds"] != schema["emittedByInternalHandlerIds"]:
            raise ValueError(f"{event_name} module producer identity projection drift")
        expected_emitted_on = [
            source_ops[operation_id]["transition"]["transitionId"]
            for operation_id in schema["emittedByOperationIds"]
        ]
        expected_emitted_on.extend(
            transition["transitionId"]
            for handler_id in schema["emittedByInternalHandlerIds"]
            for _, transition in [_handler_transition(handlers[handler_id])]
            if transition is not None
        )
        if projected["emittedOn"] != expected_emitted_on:
            raise ValueError(f"{event_name} module state edge projection drift")


def _pipeline(
    inputs: tuple[
        dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any],
        dict[str, Any], dict[str, Any],
    ],
) -> tuple[dict[str, Any], dict[Path, dict[str, Any]], str]:
    ssot, exact, events, semantic, identities, manifest = inputs
    validate_source_projection_inputs(ssot, exact, events, manifest)
    causal = build_causal(ssot, exact, events, semantic, identities, manifest)
    modules = project_modules(ssot, exact, events)
    summary = project_summary(modules)
    validate(causal, modules, manifest, ssot, exact, events)
    return causal, modules, summary


def _candidate_path(candidate_dir: Path) -> Path:
    """Normalize a candidate path without resolving any symlink."""
    return Path(os.path.abspath(os.fspath(candidate_dir)))


def _stat_identity(value: os.stat_result) -> tuple[int, int]:
    return value.st_dev, value.st_ino


def _stat_snapshot(value: os.stat_result) -> dict[str, int]:
    return {
        "device": value.st_dev,
        "inode": value.st_ino,
        "size": value.st_size,
        "mode": stat.S_IMODE(value.st_mode),
        "mtime_ns": value.st_mtime_ns,
        "ctime_ns": value.st_ctime_ns,
    }


def _read_fd_bounded(fd: int, expected_size: int, path: Path) -> bytes:
    """Read exactly the opened file size, with a hard upper bound."""
    if expected_size < 0 or expected_size > MAX_CANDIDATE_FILE_BYTES:
        raise ValueError(
            f"candidate file size is outside bounded read limit: {path}"
        )
    remaining = expected_size
    chunks: list[bytes] = []
    while remaining:
        chunk = os.read(fd, min(1024 * 1024, remaining))
        if not chunk:
            raise ValueError(f"candidate file shrank during read: {path}")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _read_candidate_boundary(
    candidate_dir: Path,
) -> tuple[dict[str, dict[str, Any]], dict[str, bytes]]:
    """Read an exact candidate through stable directory/file descriptors.

    The path is checked on both sides of every bounded FD read.  A path
    rebinding, symlink, metadata change, or directory entry change therefore
    fails closed rather than allowing a mixed candidate snapshot.
    """
    candidate_dir = _candidate_path(candidate_dir)
    try:
        directory_path_before = os.lstat(candidate_dir)
    except OSError as exc:
        raise ValueError(f"candidate directory is unreadable: {candidate_dir}") from exc
    if stat.S_ISLNK(directory_path_before.st_mode):
        raise ValueError(f"candidate directory symlink is forbidden: {candidate_dir}")
    if not stat.S_ISDIR(directory_path_before.st_mode):
        raise ValueError(f"candidate path is not a directory: {candidate_dir}")

    directory_flags = os.O_RDONLY
    directory_flags |= getattr(os, "O_DIRECTORY", 0)
    directory_flags |= getattr(os, "O_NOFOLLOW", 0)
    directory_flags |= getattr(os, "O_CLOEXEC", 0)
    if not getattr(os, "O_NOFOLLOW", 0):
        raise ValueError("candidate read-only check requires O_NOFOLLOW")
    try:
        directory_fd = os.open(candidate_dir, directory_flags)
    except OSError as exc:
        raise ValueError(f"candidate directory cannot be opened safely: {candidate_dir}") from exc
    try:
        directory_fd_before = os.fstat(directory_fd)
        if not stat.S_ISDIR(directory_fd_before.st_mode):
            raise ValueError(f"candidate directory FD is not a directory: {candidate_dir}")
        if _stat_identity(directory_fd_before) != _stat_identity(directory_path_before):
            raise ValueError(f"candidate directory was rebound: {candidate_dir}")
        try:
            entry_names = set(os.listdir(directory_fd))
        except OSError as exc:
            raise ValueError(f"candidate directory cannot be listed: {candidate_dir}") from exc
        expected_names = set(CANDIDATE_FILE_NAMES)
        if entry_names != expected_names:
            missing = sorted(expected_names - entry_names)
            extra = sorted(entry_names - expected_names)
            raise ValueError(
                "candidate exact 8-file set mismatch: "
                f"missing={missing} extra={extra}"
            )

        file_flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) \
            | getattr(os, "O_CLOEXEC", 0)
        result: dict[str, dict[str, Any]] = {}
        raw_by_name: dict[str, bytes] = {}
        for name in CANDIDATE_FILE_NAMES:
            path = candidate_dir / name
            try:
                path_before = os.lstat(path)
            except OSError as exc:
                raise ValueError(f"candidate file is unreadable: {path}") from exc
            if stat.S_ISLNK(path_before.st_mode):
                raise ValueError(f"candidate symlink is forbidden: {path}")
            if not stat.S_ISREG(path_before.st_mode):
                raise ValueError(f"candidate entry is not a regular file: {path}")
            try:
                fd = os.open(name, file_flags, dir_fd=directory_fd)
            except OSError as exc:
                raise ValueError(f"candidate file cannot be opened safely: {path}") from exc
            try:
                file_before = os.fstat(fd)
                if not stat.S_ISREG(file_before.st_mode):
                    raise ValueError(f"candidate FD is not a regular file: {path}")
                if _stat_identity(path_before) != _stat_identity(file_before):
                    raise ValueError(f"candidate file was rebound: {path}")
                raw = _read_fd_bounded(fd, file_before.st_size, path)
                if len(raw) != file_before.st_size:
                    raise ValueError(f"candidate file read length mismatch: {path}")
                file_after = os.fstat(fd)
                try:
                    path_after = os.lstat(path)
                except OSError as exc:
                    raise ValueError(f"candidate file disappeared during read: {path}") from exc
                if _stat_identity(file_before) != _stat_identity(file_after) \
                        or _stat_snapshot(file_before) != _stat_snapshot(file_after):
                    raise ValueError(f"candidate file metadata changed during read: {path}")
                if _stat_identity(path_after) != _stat_identity(file_after):
                    raise ValueError(f"candidate file path was rebound during read: {path}")
                if _stat_snapshot(path_after) != _stat_snapshot(file_after):
                    raise ValueError(f"candidate file path metadata changed during read: {path}")
            finally:
                os.close(fd)
            raw_by_name[name] = raw
            result[name] = {
                "path": str(path),
                "fileSha256": hashlib.sha256(raw).hexdigest(),
                **_stat_snapshot(file_after),
            }

        try:
            entry_names_after = set(os.listdir(directory_fd))
            directory_fd_after = os.fstat(directory_fd)
            directory_path_after = os.lstat(candidate_dir)
        except OSError as exc:
            raise ValueError(
                f"candidate directory changed or became unreadable: {candidate_dir}"
            ) from exc
        if entry_names_after != expected_names:
            raise ValueError(f"candidate directory entries changed during read: {candidate_dir}")
        if _stat_identity(directory_fd_before) != _stat_identity(directory_fd_after) \
                or _stat_snapshot(directory_fd_before) != _stat_snapshot(directory_fd_after):
            raise ValueError(f"candidate directory metadata changed during read: {candidate_dir}")
        if not stat.S_ISDIR(directory_path_after.st_mode):
            raise ValueError(f"candidate directory path is no longer a directory: {candidate_dir}")
        if _stat_identity(directory_path_after) != _stat_identity(directory_fd_after):
            raise ValueError(f"candidate directory path was rebound during read: {candidate_dir}")
        if _stat_snapshot(directory_path_after) != _stat_snapshot(directory_fd_after):
            raise ValueError(f"candidate directory path metadata changed during read: {candidate_dir}")
        return result, raw_by_name
    finally:
        os.close(directory_fd)


def _candidate_snapshot(candidate_dir: Path) -> dict[str, dict[str, Any]]:
    """Snapshot candidate metadata using stable FD reads and no symlink follow."""
    result, _ = _read_candidate_boundary(candidate_dir)
    return result


def _read_candidate_documents(
    candidate_dir: Path,
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, bytes]]:
    """Read exactly eight candidate documents while retaining raw bytes for pins."""
    before, raw_by_name = _read_candidate_boundary(candidate_dir)
    documents: dict[str, dict[str, Any]] = {}
    for name in CANDIDATE_FILE_NAMES:
        try:
            value = json.loads(raw_by_name[name])
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"candidate JSON is unreadable: {name}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"candidate JSON must be an object: {name}")
        documents[name] = value
    return before, documents, raw_by_name


def _validate_candidate_manifest_links(
    documents: dict[str, dict[str, Any]], raw_by_name: dict[str, bytes],
) -> None:
    """Validate the candidate's manifest links and self-sealed authority inputs."""
    manifest = documents[MANIFEST.name]
    manifest_id = manifest.get("manifestId")
    manifest_seal = manifest.get("sealedPayloadSha256")
    if manifest_id != "dwp.hris.modern.closed-set-manifest.v3":
        raise ValueError("candidate manifest identity drift")
    if manifest.get("schemaVersion") != 3:
        raise ValueError("candidate manifest schema drift")
    if not isinstance(manifest_seal, str) or manifest_seal != _canonical_payload_sha256(manifest):
        raise ValueError("candidate manifest self-seal mismatch")
    manifest_file_sha = hashlib.sha256(raw_by_name[MANIFEST.name]).hexdigest()
    for name in CANDIDATE_SOURCE_NAMES:
        if name == MANIFEST.name:
            continue
        document = documents[name]
        link = document.get("closedSetManifest")
        if not isinstance(link, dict):
            raise ValueError(f"candidate manifest link missing: {name}")
        if link.get("manifestId") != manifest_id:
            raise ValueError(f"candidate manifest link identity drift: {name}")
        if link.get("sealedPayloadSha256") != manifest_seal:
            raise ValueError(f"candidate manifest link seal drift: {name}")
        if "fileSha256" in link and link.get("fileSha256") != manifest_file_sha:
            raise ValueError(f"candidate manifest file pin drift: {name}")
        if "path" in link and link.get("path") != MANIFEST.name:
            raise ValueError(f"candidate manifest link path drift: {name}")
        declared_seal = document.get("sealedPayloadSha256")
        if declared_seal is not None and declared_seal != _canonical_payload_sha256(document):
            raise ValueError(f"candidate source self-seal mismatch: {name}")

    authority = documents[LISTENING_AUTHORITY.name]
    owner_boundary_inputs = manifest.get("ownerBoundaryInputs")
    authority_pin = (
        owner_boundary_inputs.get("listeningStreamAuthority")
        if isinstance(owner_boundary_inputs, dict) else None
    )
    if not isinstance(authority_pin, dict):
        raise ValueError("candidate manifest Listening authority pin missing")
    if authority_pin.get("contractId") != "dwp.hris.sys.listening.stream-authority-successor.v2":
        raise ValueError("candidate manifest Listening authority contract pin drift")
    if authority_pin.get("path") != "coding-readiness/" + LISTENING_AUTHORITY.name:
        raise ValueError("candidate manifest Listening authority path pin drift")
    authority_raw_sha = hashlib.sha256(raw_by_name[LISTENING_AUTHORITY.name]).hexdigest()
    if authority_pin.get("fileSha256") != authority_raw_sha:
        raise ValueError("candidate manifest Listening authority file pin drift")
    if authority.get("contractId") != "dwp.hris.sys.listening.stream-authority-successor.v2":
        raise ValueError("candidate Listening authority identity drift")
    if authority.get("schemaVersion") != 2:
        raise ValueError("candidate Listening authority schema drift")
    authority_seal = authority.get("sealedPayloadSha256")
    if authority_seal != _canonical_payload_sha256(authority):
        raise ValueError("candidate Listening authority self-seal mismatch")
    if authority_pin.get("sealedPayloadSha256") != authority_seal:
        raise ValueError("candidate manifest Listening authority seal pin drift")
    precedence = authority.get("canonicalPrecedence")
    if not isinstance(precedence, dict) \
            or precedence.get("canonicalCandidatePinRequired") is not True \
            or precedence.get("reverseCanonicalHashPin") != "FORBIDDEN_TO_PREVENT_AUTHORITY_CYCLE":
        raise ValueError("candidate Listening authority precedence pin drift")


def _check_causal_candidate_documents(
    documents: dict[str, dict[str, Any]], raw_by_name: dict[str, bytes],
) -> dict[str, Any]:
    """Synthesize and validate a causal candidate entirely in memory."""
    _validate_candidate_manifest_links(documents, raw_by_name)
    inputs = tuple(
        documents[name]
        for name in (
            SSOT.name, EXACT.name, EVENTS.name, BINDINGS.name,
            IDENTITIES.name, MANIFEST.name,
        )
    )
    ssot, exact, events, semantic, identities, manifest = inputs
    validate_source_projection_inputs(ssot, exact, events, manifest)
    expected = build_causal(ssot, exact, events, semantic, identities, manifest)
    expected_source_pins = expected["canonicalSourcePins"]
    expected_pin_names = set(CANDIDATE_SOURCE_NAMES) - {MANIFEST.name}
    if set(expected_source_pins) != expected_pin_names:
        raise ValueError("candidate expected causal source-pin set drift")
    for name in sorted(expected_source_pins):
        observed_sha = hashlib.sha256(raw_by_name[name]).hexdigest()
        if observed_sha != expected_source_pins[name]:
            raise ValueError(f"candidate source-pin drift: {name}")

    observed_raw = raw_by_name[CAUSAL.name]
    observed = documents[CAUSAL.name]
    observed_seal = observed.get("sealedPayloadSha256")
    if not isinstance(observed_seal, str) \
            or observed_seal != _canonical_payload_sha256(observed):
        raise ValueError("candidate causal self-seal mismatch")
    if observed.get("closedSetManifest") != expected.get("closedSetManifest"):
        raise ValueError("candidate causal manifest link mismatch")
    if observed.get("canonicalSourcePins") != expected.get("canonicalSourcePins"):
        raise ValueError("candidate causal source-pin drift")
    expected_raw = render(expected).encode("utf-8")
    if observed_raw != expected_raw:
        raise ValueError("candidate causal bytes mismatch")
    return {
        "expectedCausalSha256": hashlib.sha256(expected_raw).hexdigest(),
        "observedCausalSha256": hashlib.sha256(observed_raw).hexdigest(),
        "expectedCausalSealedPayloadSha256": expected["sealedPayloadSha256"],
        "observedCausalSealedPayloadSha256": observed_seal,
        "causalBytesEqual": True,
        "causalSelfSealValid": True,
        "causalManifestLinkValid": True,
        "causalSourcePinsValid": True,
    }


def check_candidate_dir(candidate_dir: Path) -> dict[str, Any]:
    """Read-only check for an exact eight-file canonical candidate.

    No staging, replacement, permission change, or other candidate mutation is
    performed.  The before/after metadata check is deliberately performed even
    when a candidate validation error is raised, so an accidental write cannot
    be hidden by an earlier finding.
    """
    before, documents, raw_by_name = _read_candidate_documents(candidate_dir)
    failure: Exception | None = None
    result: dict[str, Any] | None = None
    try:
        result = _check_causal_candidate_documents(documents, raw_by_name)
    except Exception as exc:  # candidate failures must still receive an after-snapshot
        failure = exc
    try:
        after = _candidate_snapshot(candidate_dir)
    except Exception as exc:
        raise ValueError("candidate changed or became unreadable during read-only check") from exc
    if after != before:
        changed = sorted(
            name for name in CANDIDATE_FILE_NAMES if before.get(name) != after.get(name)
        )
        raise ValueError(
            "candidate mutated during read-only check: "
            + ",".join(changed)
        )
    if failure is not None:
        raise failure
    assert result is not None
    result.update({
        "candidateDir": str(Path(os.path.abspath(os.fspath(candidate_dir)))),
        "candidateFileNames": list(CANDIDATE_FILE_NAMES),
        "candidateFileCount": len(CANDIDATE_FILE_NAMES),
        "metadataBefore": before,
        "metadataAfter": after,
        "candidateMetadataUnchanged": True,
        "readOnly": True,
        "candidateMutation": "NONE",
    })
    return result


def _copy_candidate_fixture(source_dir: Path, target_dir: Path) -> None:
    """Copy an exact candidate into a disposable directory for hostile tests."""
    target_dir.mkdir(parents=True, exist_ok=True)
    for name in CANDIDATE_FILE_NAMES:
        source = source_dir / name
        if not source.is_file() or source.is_symlink():
            raise ValueError(f"self-test source candidate is not an exact file: {source}")
        (target_dir / name).write_bytes(source.read_bytes())


def _run_readonly_candidate_self_tests(base_dir: Path) -> list[str]:
    """Exercise read-only candidate checks without touching the source candidate."""
    passed: list[str] = []

    def expect_failure(name: str, mutate: Any) -> None:
        with tempfile.TemporaryDirectory(prefix="modern-causal-readonly-selftest-") as temp:
            root = Path(temp)
            _copy_candidate_fixture(base_dir, root)
            mutate(root)
            try:
                check_candidate_dir(root)
            except (OSError, ValueError, UnicodeError):
                passed.append(name)
            else:
                raise ValueError(f"read-only hostile self-test was accepted: {name}")

    expect_failure(
        "readonly-missing-file",
        lambda root: (root / MANIFEST.name).unlink(),
    )
    expect_failure(
        "readonly-extra-file",
        lambda root: (root / "unexpected-candidate-entry.json").write_bytes(b"{}\n"),
    )

    def symlink_mutation(root: Path) -> None:
        target = root / SSOT.name
        target.unlink()
        os.symlink(root / MANIFEST.name, target)

    expect_failure("readonly-symlink-rejected", symlink_mutation)

    def authority_substitution(root: Path) -> None:
        target = root / LISTENING_AUTHORITY.name
        value = json.loads(target.read_bytes())
        value["canonicalPrecedence"]["activeAuthority"] = (
            "HOSTILE_RESEALED_AUTHORITY"
        )
        target.write_bytes(render(seal(value)).encode("utf-8"))

    expect_failure("readonly-authority-substitution", authority_substitution)

    def source_pin_mutation(root: Path) -> None:
        target = root / SSOT.name
        raw = target.read_bytes()
        if raw.endswith(b"\n"):
            target.write_bytes(raw[:-1] + b"  " + raw[-1:])
        else:
            target.write_bytes(raw + b" ")

    expect_failure("readonly-source-pin-drift", source_pin_mutation)

    def causal_mutation(root: Path) -> None:
        target = root / CAUSAL.name
        value = json.loads(target.read_bytes())
        value["status"] = "HOSTILE_READONLY_SELFTEST"
        target.write_bytes(render(seal(value)).encode("utf-8"))

    expect_failure("readonly-causal-mismatch", causal_mutation)

    with tempfile.TemporaryDirectory(prefix="modern-causal-readonly-selftest-") as temp:
        root = Path(temp)
        _copy_candidate_fixture(base_dir, root)
        rebound = False
        real_open = os.open

        def rebound_open(
            path: str | bytes | os.PathLike[str] | os.PathLike[bytes],
            flags: int,
            mode: int = 0o777,
            *,
            dir_fd: int | None = None,
        ) -> int:
            nonlocal rebound
            if dir_fd is None:
                fd = real_open(path, flags, mode)
            else:
                fd = real_open(path, flags, mode, dir_fd=dir_fd)
            if not rebound and dir_fd is not None and os.fspath(path) == SSOT.name:
                target = root / SSOT.name
                raw = target.read_bytes()
                target.unlink()
                target.write_bytes(raw)
                rebound = True
            return fd

        try:
            from unittest.mock import patch
            with patch.object(os, "open", side_effect=rebound_open):
                check_candidate_dir(root)
        except (OSError, ValueError, UnicodeError):
            pass
        else:
            raise ValueError("read-only path rebinding was accepted")
        if not rebound:
            raise ValueError("read-only rebinding hostile test did not rebind a path")
        passed.append("readonly-rebinding-rejected")

    with tempfile.TemporaryDirectory(prefix="modern-causal-readonly-selftest-") as temp:
        root = Path(temp)
        _copy_candidate_fixture(base_dir, root)
        before = _candidate_snapshot(root)
        try:
            # A valid check must not even attempt a mutating primitive.  The
            # fixture is complete before these guards are installed.
            from unittest.mock import patch
            with patch.object(Path, "write_bytes", side_effect=AssertionError("write")), \
                    patch.object(Path, "write_text", side_effect=AssertionError("write")), \
                    patch.object(Path, "touch", side_effect=AssertionError("touch")), \
                    patch.object(Path, "unlink", side_effect=AssertionError("unlink")), \
                    patch.object(Path, "rename", side_effect=AssertionError("rename")), \
                    patch.object(Path, "replace", side_effect=AssertionError("replace")), \
                    patch.object(Path, "chmod", side_effect=AssertionError("chmod")), \
                    patch.object(os, "replace", side_effect=AssertionError("replace")), \
                    patch.object(os, "chmod", side_effect=AssertionError("chmod")), \
                    patch.object(tempfile, "NamedTemporaryFile", side_effect=AssertionError("temp")):
                check_candidate_dir(root)
        except AssertionError as exc:
            raise ValueError(f"read-only check attempted a mutation: {exc}") from exc
        after = _candidate_snapshot(root)
        if after != before:
            raise ValueError("read-only check changed candidate fixture metadata")
        passed.append("readonly-no-write")
    return passed


def _run_versioned_successor_self_tests(
    modules: dict[Path, dict[str, Any]],
) -> list[str]:
    """Exercise successor sealing and the create-only writer entirely in /tmp."""
    if set(SUCCESSOR_MODULES) != {"HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-SYS"}:
        raise ValueError("versioned successor output set is not closed")
    successor_documents = project_versioned_successor_modules(modules)
    for session, output_path in SUCCESSOR_MODULES.items():
        _validate_successor_document(
            session, output_path, successor_documents[session], MODULES[session]
        )
    passed = ["versioned-successor-closed-set", "versioned-successor-lineage-sealed"]

    with tempfile.TemporaryDirectory(prefix="modern-module-successor-selftest-") as name:
        root = Path(name)
        predecessor_paths: dict[str, Path] = {}
        output_paths: dict[str, Path] = {}
        for session in sorted(SUCCESSOR_SESSIONS):
            predecessor = root / "predecessors" / f"{session}.json"
            output = root / "outputs" / f"{session}.json"
            predecessor.parent.mkdir(parents=True, exist_ok=True)
            output.parent.mkdir(parents=True, exist_ok=True)
            predecessor.write_bytes(MODULES[session].read_bytes())
            predecessor_paths[session] = predecessor
            output_paths[session] = output
        temp_documents = project_versioned_successor_modules(
            modules, output_paths, predecessor_paths
        )
        _write_versioned_successor_modules(
            temp_documents,
            output_paths=output_paths,
            predecessor_paths=predecessor_paths,
            expected_output_paths=output_paths,
            expected_predecessor_paths=predecessor_paths,
        )
        for session, output in output_paths.items():
            observed = json.loads(output.read_text(encoding="utf-8"))
            _validate_successor_document(
                session, output, observed, predecessor_paths[session]
            )
        before = {path: path.read_bytes() for path in output_paths.values()}
        try:
            _write_versioned_successor_modules(
                temp_documents,
                output_paths=output_paths,
                predecessor_paths=predecessor_paths,
                expected_output_paths=output_paths,
                expected_predecessor_paths=predecessor_paths,
            )
        except FileExistsError:
            pass
        else:
            raise ValueError("existing successor target was accepted")
        if before != {path: path.read_bytes() for path in output_paths.values()}:
            raise ValueError("existing successor target bytes changed")
        passed.append("atomic-no-replace-write")
        passed.append("existing-target-no-replace")

        drifted = predecessor_paths["HRIS-HRM"]
        raw = drifted.read_bytes()
        drifted.write_bytes(raw[:-1] + (b" " if raw.endswith(b"\n") else b"\n"))
        try:
            _write_versioned_successor_modules(
                temp_documents,
                output_paths=output_paths,
                predecessor_paths=predecessor_paths,
                expected_output_paths=output_paths,
                expected_predecessor_paths=predecessor_paths,
            )
        except ValueError:
            pass
        else:
            raise ValueError("predecessor drift was accepted")
        passed.append("predecessor-pin-drift")

        substituted_outputs = dict(output_paths)
        substituted_outputs["HRIS-HRM"] = predecessor_paths["HRIS-HRM"]
        try:
            _write_versioned_successor_modules(
                temp_documents,
                output_paths=substituted_outputs,
                predecessor_paths=predecessor_paths,
                expected_output_paths=output_paths,
                expected_predecessor_paths=predecessor_paths,
            )
        except ValueError:
            pass
        else:
            raise ValueError("successor path substitution was accepted")
        passed.append("successor-path-substitution")

        substituted_predecessors = dict(predecessor_paths)
        substituted_predecessors["HRIS-SYS"] = root / "predecessors" / "substituted.json"
        try:
            _write_versioned_successor_modules(
                temp_documents,
                output_paths=output_paths,
                predecessor_paths=substituted_predecessors,
                expected_output_paths=output_paths,
                expected_predecessor_paths=predecessor_paths,
            )
        except ValueError:
            pass
        else:
            raise ValueError("predecessor path substitution was accepted")
        passed.append("predecessor-path-substitution")

        extra_outputs = dict(output_paths)
        extra_outputs["PAY"] = root / "outputs" / "PAY.v2.json"
        try:
            _write_versioned_successor_modules(
                temp_documents,
                output_paths=extra_outputs,
                predecessor_paths=predecessor_paths,
                expected_output_paths=output_paths,
                expected_predecessor_paths=predecessor_paths,
            )
        except ValueError:
            pass
        else:
            raise ValueError("extra successor output was accepted")
        passed.append("successor-output-closed-set")
    return passed


def run_self_tests(base_dir: Path) -> list[str]:
    original = compose_inputs(base_dir)
    causal, modules, _ = _pipeline(original)
    manifest = original[-1]
    scope = manifest["scope"]
    observed_scope = {
        "operations": len(causal["operations"]),
        "commands": sum(row["mode"] == "COMMAND" for row in causal["operations"]),
        "queries": sum(row["mode"] == "QUERY" for row in causal["operations"]),
        "handlers": len(causal["internalConsumerHandlers"]),
        "publicEvents": causal["scope"]["causalEvents"],
        "tableSpecifications": causal["scope"]["tables"],
    }
    for key, value in observed_scope.items():
        if scope.get(key) != value:
            raise ValueError(f"self-test baseline scope drift for {key}")

    module_events = {
        row["name"]: row for module in modules.values()
        for capability in module["capabilities"] for row in capability["events"]
    }
    if module_events["EmployeeListeningSurveyPublished.v3"]["emittedOn"]:
        raise ValueError("rootless Listening handler was given an invented state edge")
    if module_events["EmployeeListeningSurveyPublished.v3"][
        "emittedByInternalHandlerIds"
    ] != ["internal.listening.configuration.admission-install-receipt.consume"]:
        raise ValueError("rootless Listening handler identity was not preserved")
    if module_events["WorkforceScenarioSimulationFailed.v2"][
        "emittedByInternalHandlerIds"
    ] != ["internal.workforceplan.simulation-result.consume"]:
        raise ValueError("additional handler event producer was not preserved")
    branch_transition = next(
        row for module in modules.values() for capability in module["capabilities"]
        for machine in capability["stateMachines"] for row in machine["transitions"]
        if row["operationId"] == "modern.compplan.proposal.upsert"
    )
    if not branch_transition.get("branches") or not branch_transition["preStates"]:
        raise ValueError("branch command projection was flattened or lost")

    cases: list[tuple[str, Any]] = []

    def source_operation(values: list[dict[str, Any]], operation_id: str) -> dict[str, Any]:
        return next(row for row in values[0]["operations"] if row["operationId"] == operation_id)

    def source_handler(values: list[dict[str, Any]], handler_id: str) -> dict[str, Any]:
        return next(row for row in values[0]["systemHandlers"] if row["handlerId"] == handler_id)

    cases.extend([
        ("duplicate-operation", lambda values: values[0]["operations"].append(
            copy.deepcopy(values[0]["operations"][0])
        )),
        ("invalid-mode", lambda values: source_operation(
            values, "modern.listening.surveys.query"
        ).update({"mode": "BROKEN"})),
        ("query-transition", lambda values: source_operation(
            values, "modern.listening.surveys.query"
        ).update({"transition": {"transitionId": "INVALID"}})),
        ("command-transition-missing", lambda values: source_operation(
            values, "modern.listening.survey.create"
        ).update({"transition": None})),
        ("branch-state-missing", lambda values: source_operation(
            values, "modern.compplan.proposal.upsert"
        )["transition"]["branches"][0].pop("preState")),
        ("handler-half-state", lambda values: source_handler(
            values, "internal.ai.assistance-result.consume"
        )["aggregateRoot"].pop("postStates")),
        ("handler-root-type", lambda values: source_handler(
            values, "internal.listening.protected.erasure.request"
        ).update({"aggregateRoot": "INVALID"})),
        ("exact-operation-removed", lambda values: values[1]["operationBindings"].pop()),
        ("event-producer-drift", lambda values: next(
            row for row in values[2]["eventPayloadSchemas"]
            if row["eventName"] == "EmployeeListeningSurveyPublished.v3"
        ).update({"emittedByInternalHandlerIds": []})),
        ("manifest-mode-drift", lambda values: next(
            row for row in values[5]["operations"]
            if row["operationId"] == "modern.listening.surveys.query"
        ).update({"mode": "COMMAND"})),
    ])
    passed = ["baseline-closed-set", "rootless-handler-no-invention",
              "additional-handler-event", "branch-command-lossless"]
    for name, mutate in cases:
        values = list(copy.deepcopy(original))
        mutate(values)
        try:
            _pipeline(tuple(values))  # type: ignore[arg-type]
        except ValueError:
            passed.append(name)
        else:
            raise ValueError(f"hostile self-test was accepted: {name}")
    passed.extend(_run_versioned_successor_self_tests(modules))
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate causal/module successors or explicitly check a canonical candidate.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", action="store_true", help="read-only in-memory preview")
    group.add_argument("--write", action="store_true", help="WRITE versioned module successors")
    group.add_argument("--check", action="store_true", help="read-only check of published versioned successors")
    group.add_argument(
        "--candidate-dir", type=Path, metavar="PATH",
        help="WRITE causal candidate JSON under PATH (this mode may replace that causal output)",
    )
    group.add_argument(
        "--check-candidate-dir", type=Path, metavar="PATH",
        help="READ-ONLY exact eight-file candidate check; no candidate temp/replace/chmod/write",
    )
    group.add_argument(
        "--self-test-candidate-dir", type=Path, metavar="PATH",
        help="run the 22-case generator suite plus read-only hostile candidate tests",
    )
    args = parser.parse_args()
    if args.self_test_candidate_dir:
        passed = run_self_tests(args.self_test_candidate_dir)
        readonly_passed = _run_readonly_candidate_self_tests(args.self_test_candidate_dir)
        if len(passed) != 22:
            raise ValueError(f"legacy generator self-test count drift: {len(passed)}/22")
        if len(readonly_passed) != 8:
            raise ValueError(
                f"read-only candidate self-test count drift: {len(readonly_passed)}/8"
            )
        print(
            "MODERN_CAUSAL_MODULE_SUCCESSOR_SELFTEST=PASS"
            f" cases={len(passed)} legacyCases={len(passed)}/22"
            f" readonlyCases={len(readonly_passed)}/8"
            f" names={','.join(passed)}"
            f" readonlyNames={','.join(readonly_passed)}"
        )
        return 0
    if args.check_candidate_dir:
        try:
            result = check_candidate_dir(args.check_candidate_dir)
        except (OSError, ValueError, UnicodeError) as exc:
            print(
                "MODERN_CAUSAL_CANDIDATE_READONLY_CHECK=FAIL"
                f" mode=READ_ONLY reason={exc}"
            )
            return 1
        print(
            "MODERN_CAUSAL_CANDIDATE_READONLY_CHECK=PASS"
            " mode=READ_ONLY"
            f" files={result['candidateFileCount']}"
            f" causalSha256={result['observedCausalSha256']}"
            f" causalSeal={result['observedCausalSealedPayloadSha256']}"
            " metadata=UNCHANGED"
            " candidateMutation=NONE"
        )
        return 0
    if args.check:
        present = [path.exists() for path in SUCCESSOR_MODULES.values()]
        if not any(present):
            print(
                "MODERN_CAUSAL_VERSIONED_SUCCESSOR_CHECK=PENDING"
                " reason=NO_SUCCESSOR_OUTPUTS_PUBLISHED"
            )
            return 2
        if not all(present):
            print(
                "MODERN_CAUSAL_VERSIONED_SUCCESSOR_CHECK=FAIL"
                " reason=PARTIAL_SUCCESSOR_OUTPUT_SET"
            )
            return 2
    inputs = compose_inputs(args.candidate_dir)
    ssot, exact, events, semantic, identities, manifest = inputs
    causal, modules, summary = _pipeline(inputs)
    if args.preview:
        successor_documents = project_versioned_successor_modules(modules)
        module_digest = hashlib.sha256("".join(
            render(successor_documents[session])
            for session in sorted(successor_documents)
        ).encode("utf-8")).hexdigest()
        print(
            "MODERN_CAUSAL_MODULE_SUCCESSOR_PREVIEW=PASS"
            f" operations={len(causal['operations'])}"
            f" events={causal['scope']['causalEvents']}"
            f" handlers={causal['scope']['internalConsumerHandlers']}"
            f" causalSha256={hashlib.sha256(render(causal).encode()).hexdigest()}"
            f" modulesCombinedSha256={module_digest}"
            f" successorOutputs={','.join(_root_relative(SUCCESSOR_MODULES[session]) for session in sorted(SUCCESSOR_SESSIONS))}"
        )
        return 0
    if args.candidate_dir:
        output = args.candidate_dir / CAUSAL.name
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent,
            prefix=output.name + ".", suffix=".tmp", delete=False,
        ) as handle:
            staged = Path(handle.name)
            handle.write(render(causal))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(staged, output)
        if output.read_text(encoding="utf-8") != render(causal):
            raise ValueError("staged causal byte mismatch")
        print(
            "MODERN_CAUSAL_CANDIDATE_WRITE=PASS"
            " mode=WRITE"
            f" path={output} sha256={hashlib.sha256(output.read_bytes()).hexdigest()}"
        )
        return 0
    if args.write:
        successor_documents = project_versioned_successor_modules(modules)
        hashes = _write_versioned_successor_modules(successor_documents)
        print(
            "MODERN_CAUSAL_VERSIONED_SUCCESSOR_WRITE=PASS"
            f" outputs={','.join(sorted(hashes))}"
        )
        return 0
    if args.check:
        _verify_predecessors(MODULES, MODULES)
        successor_documents = project_versioned_successor_modules(modules)
        mismatches = []
        for session, path in SUCCESSOR_MODULES.items():
            try:
                observed = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise ValueError(f"unreadable versioned successor: {path}") from exc
            if not isinstance(observed, dict):
                raise ValueError(f"versioned successor must be an object: {path}")
            _validate_successor_document(
                session, path, observed, MODULES[session]
            )
            if path.read_text(encoding="utf-8") != render(successor_documents[session]):
                mismatches.append(str(path))
        if mismatches:
            raise ValueError(
                "versioned successor generated bytes mismatch: "
                + ", ".join(mismatches)
            )
        print(
            "MODERN_CAUSAL_VERSIONED_SUCCESSOR_CHECK=PASS"
            f" outputs={','.join(_root_relative(SUCCESSOR_MODULES[session]) for session in sorted(SUCCESSOR_SESSIONS))}"
        )
        return 0
    raise AssertionError("unreachable generator mode")


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
