#!/usr/bin/env python3
"""Source-only composer and create-only publisher for phase-5 derivatives.

This module deliberately has no production publish CLI.  It composes and
validates nine versioned derivative documents from an already independently
accepted eight-file live canonical bundle.  Publication is a create-only,
closed-set transaction; predecessor, candidate, live and Gate paths are never
replacement targets.  The only direct mode is a disposable self-test.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SEAL_METHOD = "SHA256_OF_UTF8_JSON_SORT_KEYS_COMPACT_EXCLUDING_sealedPayloadSha256"
PAYROLL_DEPENDENCY_ID = "compensation.resolveApprovedSnapshotForPayroll.v1"
LISTENING_DEPENDENCY_ID = (
    "configuration.resolveSignedParticipationOfferForEntitledSubject.v1"
)
PAYROLL_EVENT = "ApprovedCompensationPlanSnapshotPublished.v2"
PAYROLL_PURPOSE = "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH"


def _expected_payroll_digest_canonicalization() -> dict[str, Any]:
    return {
        "contractVersion": "DWP_HRIS_PAYROLL_SNAPSHOT_DIGEST_V1",
        "hashAlgorithm": "SHA-256",
        "serialization": "RFC8785_JCS",
        "encoding": "UTF-8",
        "framing": (
            "UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(canonicalValue))"
        ),
        "transportRepresentation": (
            "EXCLUDED_COMPRESSED_UNCOMPRESSED_AND_CHUNK_FRAMING_BYTES"
        ),
        "typedScalars": {
            "uuid": "LOWERCASE_RFC4122_HYPHENATED",
            "date": "ISO8601_FULL_DATE_YYYY-MM-DD",
            "bigint": (
                "NONNEGATIVE_INT64_CANONICAL_DECIMAL_STRING_0_TO_"
                "9223372036854775807_NO_PLUS_NO_LEADING_ZERO"
            ),
            "boundedInteger": "RFC8785_JSON_INTEGER_0_TO_100000",
            "nullable": "REQUIRED_FIELD_EXPLICIT_JSON_NULL_NEVER_ABSENT",
            "postedMoney": (
                "CANONICAL_DECIMAL_STRING_PRECISION_19_SCALE_4_NO_EXPONENT_"
                "NO_NEGATIVE_ZERO_NO_IMPLICIT_ROUNDING"
            ),
            "digestHex": "LOWERCASE_HEX_64",
        },
        "lineDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.LINE.V1",
            "canonicalValue": "JSON_ARRAY_IN_EXACT_FIELD_ORDER",
            "fieldOrder": [
                "lineId", "lineSequence", "workerId", "assignmentId",
                "componentCode", "currency", "approvedAmount", "effectiveFrom",
                "effectiveTo",
            ],
            "excludedFields": ["lineDigest"],
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS("
                "fieldValueArray)))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "payloadDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.PAYLOAD.V1",
            "canonicalValue": (
                "JSON_ARRAY_[HEADER_VALUE_ARRAY,ORDERED_LINE_DIGEST_HEX_ARRAY]"
            ),
            "headerFieldOrder": [
                "snapshotId", "snapshotRevision", "planId", "cycleId",
                "effectiveFrom", "effectiveTo", "approvalReceiptId",
                "sourceVersion", "lineCount",
            ],
            "excludedHeaderFields": ["payloadDigest"],
            "lineDigestOrder": "lineSequence ASC CONTIGUOUS_FROM_1",
            "lineDigestEncoding": "LOWERCASE_HEX_64_RAW_DIGEST_TEXT",
            "lineCountBinding": (
                "header.lineCount IS_IN_HEADER_PREIMAGE_AND_EQUALS_DIGEST_LIST_COUNT"
            ),
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(["
                "headerValueArray,orderedLineDigestHexArray])))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "closedInputValidation": {
            "schema": "EXACT_NO_ADDITIONAL_FIELDS",
            "duplicateFieldNames": "REJECT",
            "missingRequiredFields": "REJECT",
            "lineSequence": "ONE_BASED_CONTIGUOUS_NO_GAP_NO_DUPLICATE",
            "lineCountMatch": "REQUIRED_BEFORE_DIGEST_ACCEPTANCE",
            "zeroLines": "REJECT_MIN_ITEMS_1",
            "oneLine": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "oneHundredThousandLines": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "aboveOneHundredThousandLines": "REJECT_BEFORE_DIGEST_CALCULATION",
            "nullVsAbsent": (
                "DISTINCT_EFFECTIVE_TO_NULL_REQUIRED_FIELD_ABSENCE_REJECTED"
            ),
            "decimalAlternateSpelling": "REJECT_NON_CANONICAL_BEFORE_DIGEST",
            "selfDigestInjection": (
                "REJECT_DIGEST_FIELDS_ARE_NEVER_PREIMAGE_MEMBERS"
            ),
        },
    }

ACCEPTED_SOURCE_NAMES = (
    "modern-capability-causal-state-contracts.v2.json",
    "modern-capability-closed-set-manifest.v3.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-semantic-bindings.v1.json",
    "sys-listening-stream-authority-successor.v2.json",
)

TARGETS = {
    "eventLineage": "coding-readiness/modern-capability-event-successor-lineage.v3.json",
    "hrmModule": "session-evidence/hrm/g3-modern-capability-contracts.v2.json",
    "perModule": "session-evidence/per/g3-modern-capability-contracts.v3.json",
    "timModule": "session-evidence/tim/g3-modern-capability-contracts.v2.json",
    "sysModule": "session-evidence/sys/g3-modern-capability-contracts.v2.json",
    "payConsumer": "session-evidence/pay/g3-modern-capability-consumer-contracts.v2.json",
    "sysExact": "coding-readiness/sys-exact-business-start-successor.v2.json",
    "sysLineage": "coding-readiness/sys-exact-business-successor-lineage.v2.json",
    "sysPin": "coding-readiness/sys-exact-business-start-pin.v2.json",
}

PUBLISH_ORDER = (
    "eventLineage", "hrmModule", "perModule", "timModule", "sysModule",
    "payConsumer", "sysExact", "sysLineage", "sysPin",
)

PREDECESSOR_PINS = {
    "hrmModule": {
        "path": "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "fileSha256": "ddf1fabeb93667076516250833b48ce9f1546935034402c221dca06e9911d9dc",
        "payloadSha256": "1c84109da5e095c78bfddb68037d1d4c5722dc91cabd8dbb4a1b2c31c370b8db",
    },
    "perModule": {
        "path": "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "fileSha256": "d7f1685814c8fd6f2602e10351fabf394fa57355be0b52989122b63da229d654",
        "payloadSha256": "0890d328037d01b9ac125ca6923190eb79e4cd7c1f39248d492e9757c955f410",
    },
    "timModule": {
        "path": "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "fileSha256": "4677b96f21b39f7cd96b2339b08c0cb0017d122c7b8068e5038ee51903d9d2da",
        "payloadSha256": "ddf24bb205a968a29490406bdec2b2c720ad44ad02ec4b98ccc8c622cf8aeaea",
    },
    "sysModule": {
        "path": "session-evidence/sys/g3-modern-capability-contracts.v1.json",
        "fileSha256": "4b6d47449fc7ce7070f1b7c46932c529e61e96576b00b75045db266c64791c33",
        "payloadSha256": "2ea82e31984d68b2ecf7ab0b7478e58a2505b6bc8027ce60bbb304b183303b0c",
    },
    "payConsumer": {
        "path": "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
        "fileSha256": "2e8729b8835c9a44ff708cb662c87d3fecaceee53f0575b12ee5a4ad2aa0eff7",
        "payloadSha256": "602cd9df1b2a1fbaaee34978431df793e5fcd78a7d75ca0548bdcfe90bdc3ff4",
    },
    "eventLineage": {
        "path": "coding-readiness/modern-capability-event-successor-lineage.v2.json",
        "fileSha256": "0eb74ee179f19ecf23e1684160cbe954dd5adcc96e9002541d6772f3ace37549",
        "payloadSha256": "aff2f7228815c73bb8445787ba260accf1a5d165ee2426351fda08258ade52e9",
    },
    "sysExact": {
        "path": "coding-readiness/sys-exact-business-start-successor.v1.json",
        "fileSha256": "aa4f82925a5a34132ed69844ca088111d551b7effbe1d70d8104846db82c44be",
        "payloadSha256": "62cc2727207d5bc78ffd720d3c699db35e86d5e4a2006b3fb2e24747361f82d3",
    },
    "sysLineage": {
        "path": "coding-readiness/sys-exact-business-successor-lineage.v1.json",
        "fileSha256": "33fdb48e83677037ff25a34be705f9397227bc205531510bb45e5cf14bfb50dc",
        "payloadSha256": "9fdb105895d2da145f8f6346960be2a1f7d3dc2dc112e296c858105676533602",
    },
    "sysPin": {
        "path": "coding-readiness/sys-exact-business-start-pin.v1.json",
        "fileSha256": "ab0a51ef5d3d66c5ece6d0621e764792181dd9586faf21fa46d9babd0fc86ce3",
        "payloadSha256": "ca07ee2f280ffcf1c3156faad668e67b814d32c6f2415a6225fa23f869e1c83e",
    },
}

MODULE_KEYS = {
    "HRIS-HRM": "hrmModule",
    "HRIS-PER": "perModule",
    "HRIS-TIM": "timModule",
    "HRIS-SYS": "sysModule",
}


class DerivativePublicationError(ValueError):
    """A phase-5 source, lineage or create-only safety condition failed."""


def compact_payload(value: dict[str, Any]) -> bytes:
    body = copy.deepcopy(value)
    body.pop("sealedPayloadSha256", None)
    return json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")


def payload_sha(value: dict[str, Any]) -> str:
    return hashlib.sha256(compact_payload(value)).hexdigest()


def seal(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = payload_sha(result)
    return result


def render(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode(
        "utf-8"
    )


def render_canonical_source(value: dict[str, Any]) -> bytes:
    """Render source documents with the canonical generators' byte policy.

    Canonical source hashes include insertion order; derivative documents use
    the sorted-key renderer above.  Keeping the two byte domains explicit
    prevents a synthetic accepted-live fixture from claiming hashes that its
    embedded closed-set manifest pin does not actually describe.
    """
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def parse_object(raw: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DerivativePublicationError(f"{label}: unreadable JSON") from error
    if not isinstance(value, dict):
        raise DerivativePublicationError(f"{label}: JSON root is not an object")
    return value


def verify_predecessors(raw_by_key: dict[str, bytes]) -> dict[str, dict[str, Any]]:
    if set(raw_by_key) != set(PREDECESSOR_PINS):
        raise DerivativePublicationError("predecessor closed set drift")
    result: dict[str, dict[str, Any]] = {}
    for key, pin in PREDECESSOR_PINS.items():
        raw = raw_by_key[key]
        value = parse_object(raw, key)
        if hashlib.sha256(raw).hexdigest() != pin["fileSha256"]:
            raise DerivativePublicationError(f"{key}: predecessor byte pin drift")
        if payload_sha(value) != pin["payloadSha256"]:
            raise DerivativePublicationError(f"{key}: predecessor payload pin drift")
        result[key] = value
    return result


def accepted_source_pin(
    raw_by_name: dict[str, bytes], acceptance: dict[str, Any],
) -> dict[str, Any]:
    if set(raw_by_name) != set(ACCEPTED_SOURCE_NAMES):
        raise DerivativePublicationError("accepted canonical exact eight-file set drift")
    if acceptance.get("status") != "PASS" or acceptance.get("acceptedLive") is not True:
        raise DerivativePublicationError("accepted-live independent acceptance is absent")
    files = {
        name: hashlib.sha256(raw_by_name[name]).hexdigest()
        for name in sorted(raw_by_name)
    }
    if acceptance.get("sourceFileSha256") != files:
        raise DerivativePublicationError("accepted-live source hash map drift")
    ref = acceptance.get("acceptanceRef")
    if not isinstance(ref, dict) or set(ref) != {
        "path", "fileSha256", "sealedPayloadSha256",
    }:
        raise DerivativePublicationError("accepted-live acceptance pin is not exact")
    documents = {
        name: parse_object(raw_by_name[name], name) for name in ACCEPTED_SOURCE_NAMES
    }
    manifest = documents["modern-capability-closed-set-manifest.v3.json"]
    if manifest.get("sealedPayloadSha256") != payload_sha(manifest):
        raise DerivativePublicationError("accepted manifest self-seal mismatch")
    return {
        "acceptedLiveManifest": copy.deepcopy(ref),
        "sourceFileCount": 8,
        "sourceFileSha256": files,
        "manifestId": manifest.get("manifestId"),
        "manifestSealedPayloadSha256": manifest.get("sealedPayloadSha256"),
        "productionState": "NOT_AUTHORIZED_G6",
    }


def _payroll_boundary(
    ssot: dict[str, Any], events: dict[str, Any], manifest: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    all_dependencies = ssot.get("ownerDependencyContracts", [])
    dependency_ids = [
        row.get("dependencyContractId") for row in all_dependencies
    ]
    if (
        len(all_dependencies) != 2
        or len(dependency_ids) != len(set(dependency_ids))
        or set(dependency_ids) != {PAYROLL_DEPENDENCY_ID, LISTENING_DEPENDENCY_ID}
    ):
        raise DerivativePublicationError(
            "P0_PAY_BOUNDARY: global dependency closed set is not exact two"
        )
    manifest_pins = sorted(({
        "dependencyContractId": row.get("dependencyContractId"),
        "ownerSession": row.get("ownerSession"),
        "consumerSession": row.get("consumerSession"),
        "sealedPayloadSha256": row.get("sealedPayloadSha256"),
    } for row in all_dependencies), key=lambda row: str(
        row["dependencyContractId"]
    ))
    if (
        manifest.get("scope", {}).get("ownerDependencyContracts") != 2
        or manifest.get("ownerDependencyContracts") != manifest_pins
        or manifest.get("listeningStaticDesign", {}).get(
            "exactCounts", {}
        ).get("ownerDependencyContracts") != 1
    ):
        raise DerivativePublicationError(
            "P0_PAY_BOUNDARY: manifest global/local dependency closure drift"
        )
    if any(
        row.get("sealedPayloadSha256") != payload_sha(row)
        for row in all_dependencies
    ):
        raise DerivativePublicationError(
            "P0_PAY_BOUNDARY: dependency self-seal mismatch"
        )
    dependencies = [
        row for row in all_dependencies
        if row.get("dependencyContractId") == PAYROLL_DEPENDENCY_ID
    ]
    event_rows = [
        row for row in events.get("eventPayloadSchemas", [])
        if row.get("eventName") == PAYROLL_EVENT
    ]
    if len(dependencies) != 1 or len(event_rows) != 1:
        raise DerivativePublicationError(
            "P0_PAY_BOUNDARY: exact dependency/event cardinality is not one"
        )
    dependency, event = dependencies[0], event_rows[0]
    refetch = event.get("consumerRefetchPolicy", {})
    dependency_seal = payload_sha(dependency)
    request_fields = {
        row.get("name")
        for row in dependency.get("requestSchema", {}).get("fields", [])
    }
    line_fields = {
        row.get("name")
        for row in dependency.get("responseSchema", {}).get("lines", {}).get(
            "itemFields", []
        )
    }
    failures = []
    checks = {
        "self-seal": dependency.get("sealedPayloadSha256") == dependency_seal,
        "owner-consumer": dependency.get("ownerSession") == "HRIS-PER"
        and dependency.get("consumerSession") == "HRIS-PAY",
        "digest-canonicalization": dependency.get("digestCanonicalization")
        == _expected_payroll_digest_canonicalization(),
        "request-tuple": request_fields
        == {"tenantId", "snapshotId", "snapshotRevision", "payloadDigest", "purposeCode"},
        "tenant-override": dependency.get("requestSchema", {}).get(
            "callerTenantOverride"
        ) == "FORBIDDEN",
        "read-only": dependency.get("orderedDml") == []
        and dependency.get("writes") == "FORBIDDEN"
        and dependency.get("receiptAndOutbox") == "FORBIDDEN_READ_ONLY_DEPENDENCY",
        "no-latest": dependency.get("latestFallback") == "FORBIDDEN"
        and dependency.get("readPlan", {}).get("latestFallback") == "FORBIDDEN",
        "bounded-lines": dependency.get("responseSchema", {}).get("lines", {}).get(
            "maxItems"
        ) == 100000
        and line_fields == {
            "lineId", "lineSequence", "workerId", "assignmentId",
            "componentCode", "currency", "approvedAmount", "effectiveFrom",
            "effectiveTo", "lineDigest",
        },
        "stream-validation": all(
            dependency.get("streamingValidation", {}).get(key)
            for key in ("count", "sequence", "digest", "failure")
        ),
        "event-ref": refetch.get("allowed") is True
        and refetch.get("mode") == "EXACT_OWNER_DEPENDENCY"
        and refetch.get("dependencyContractId") == PAYROLL_DEPENDENCY_ID
        and refetch.get("dependencyContractSha256") == dependency_seal,
        "event-envelope-tenant": refetch.get("selectorTuple", [None])[0]
        == "eventEnvelope.tenantId"
        and refetch.get("tenantBinding") == {
            "eventEnvelopeTenant": "eventEnvelope.tenantId",
            "signedWorkloadTenant": "verifiedWorkloadContext.tenantId",
            "ownerRowTenant": "prf_cmp_approved_snapshots.tenant_id",
            "equality": "ALL_THREE_REQUIRED_EQUAL",
        },
        "event-minimal": "lines" not in {
            row.get("name") for row in event.get("fields", [])
        },
        "pay-authorization": refetch.get("consumerSessionAllowlist") == ["HRIS-PAY"]
        and refetch.get("purpose") == PAYROLL_PURPOSE
        and refetch.get("pep", {}).get("denyOnUnavailable") is True,
        "event-pay-minimum-exposure": event.get("deliveryPolicy", {}).get(
            "consumerFieldAllowlists", {}
        ).get("HRIS-PAY") == {
            "purpose": [PAYROLL_PURPOSE],
            "mode": "EXACT_ALLOWLIST",
            "fields": [
                "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
            ],
        },
    }
    failures.extend(name for name, passed in checks.items() if not passed)
    if failures:
        raise DerivativePublicationError(
            "P0_PAY_BOUNDARY: " + ",".join(sorted(failures))
        )
    return dependency, event


def _lineage(
    key: str, successor_path: str, accepted: dict[str, Any],
) -> dict[str, Any]:
    pin = PREDECESSOR_PINS[key]
    return {
        "lineageType": "EXACT_PREDECESSOR_TO_VERSIONED_ACCEPTED_LIVE_DERIVATIVE",
        "predecessorPath": pin["path"],
        "predecessorFileSha256": pin["fileSha256"],
        "predecessorPayloadSha256": pin["payloadSha256"],
        "successorPath": successor_path,
        "acceptedLiveManifest": copy.deepcopy(accepted["acceptedLiveManifest"]),
        "predecessorBytesPreserved": True,
        "canonicalPromotionAuthorized": False,
    }


def _compose_modules(
    projected: dict[str, dict[str, Any]], accepted: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    if set(projected) != set(MODULE_KEYS):
        raise DerivativePublicationError("projected module session set drift")
    result: dict[str, dict[str, Any]] = {}
    expected_contracts = {
        "HRIS-HRM": ("dwp.hris.modern.hrm.v2", 2),
        "HRIS-PER": ("dwp.hris.modern.per.v3", 3),
        "HRIS-TIM": ("dwp.hris.modern.tim.v2", 2),
        "HRIS-SYS": ("dwp.hris.modern.sys.v2", 2),
    }
    for session, key in MODULE_KEYS.items():
        value = copy.deepcopy(projected[session])
        contract_id, version = expected_contracts[session]
        if value.get("contractId") != contract_id or value.get("schemaVersion") != version:
            raise DerivativePublicationError(f"{session}: module version projection drift")
        value["acceptedCanonicalSourceBundle"] = copy.deepcopy(accepted)
        value["publicationState"] = "STAGED_NOT_CURRENT_NOT_IMPLEMENTED"
        value["successorLineage"] = _lineage(key, TARGETS[key], accepted)
        result[key] = seal(value)
    return result


def _compose_event_lineage(
    predecessor: dict[str, Any], ssot: dict[str, Any], events: dict[str, Any],
    accepted: dict[str, Any],
) -> dict[str, Any]:
    schemas = {
        row["eventName"]: row for row in events.get("eventPayloadSchemas", [])
    }
    transitions = copy.deepcopy(ssot.get("eventSuccessorLineage", []))
    successor_names = {
        name for row in transitions for name in row.get("successorEvents", [])
    }
    for name in successor_names:
        if name not in schemas:
            raise DerivativePublicationError(f"event lineage successor absent: {name}")
    result = copy.deepcopy(predecessor)
    result.update({
        "contractId": "dwp.hris.modern.event-successor-lineage.v3",
        "schemaVersion": 3,
        "status": "STAGED_ACCEPTED_LIVE_DERIVATIVE_NOT_CURRENT",
        "predecessorLineage": _lineage("eventLineage", TARGETS["eventLineage"], accepted),
        "acceptedLiveTransitionLineage": transitions,
        "acceptedLiveTransitionContracts": [
            {
                "eventName": name,
                "session": schemas[name].get("session"),
                "schemaVersion": schemas[name].get("schemaVersion"),
                "producerOperationIds": copy.deepcopy(
                    schemas[name].get("emittedByOperationIds", [])
                ),
                "producerHandlerIds": copy.deepcopy(
                    schemas[name].get("emittedByInternalHandlerIds", [])
                ),
                "payloadFields": [
                    row.get("name") for row in schemas[name].get("fields", [])
                ],
            }
            for name in sorted(successor_names)
        ],
        "introducedAcceptedLiveEvents": sorted(set(schemas) - successor_names),
        "acceptedCanonicalSourceBundle": copy.deepcopy(accepted),
        "publicationState": "STAGED_NOT_CURRENT_NOT_IMPLEMENTED",
    })
    return seal(result)


def _compose_pay(
    predecessor: dict[str, Any], dependency: dict[str, Any],
    event: dict[str, Any], accepted: dict[str, Any],
) -> dict[str, Any]:
    result = copy.deepcopy(predecessor)
    result.update({
        "contractId": "dwp.hris.modern.pay-consumer.v2",
        "schemaVersion": 2,
        "status": "STAGED_G3_CONTRACT_READY_NOT_IMPLEMENTED",
        "sourceDerivedConsumerBoundary": {
            "dependencyContract": copy.deepcopy(dependency),
            "invalidationEvent": copy.deepcopy(event),
            "eventPayloadMode": "HEADER_DIGEST_TRIGGER_ONLY_NO_PAY_LINES",
            "consumerIngest": (
                "STAGE_THEN_ATOMIC_FREEZE_AFTER_TENANT_REVISION_COUNT_SEQUENCE_"
                "DIGEST_AND_AUTHORIZATION_VALIDATION"
            ),
            "duplicateReplay": "UNIQUE_CONSUMER_LEDGER_NO_DUPLICATE_INPUT_ROWS",
        },
        "acceptedCanonicalSourceBundle": copy.deepcopy(accepted),
        "successorLineage": _lineage("payConsumer", TARGETS["payConsumer"], accepted),
        "publicationState": "STAGED_NOT_CURRENT_NOT_IMPLEMENTED",
    })
    return seal(result)


def _sys_counts(module: dict[str, Any]) -> dict[str, int]:
    closure = module.get("sourceDerivedClosure", {})
    return {
        "modernPublicOperationCount": int(closure.get("operations", 0)),
        "modernEventCount": int(closure.get("events", 0)),
        "modernTableCount": int(closure.get("tables", 0)),
        "modernInternalHandlerCount": int(closure.get("handlers", 0)),
    }


def _compose_sys_exact(
    predecessor: dict[str, Any], sys_module: dict[str, Any],
    event_lineage: dict[str, Any], pay_consumer: dict[str, Any],
    accepted: dict[str, Any],
) -> dict[str, Any]:
    result = copy.deepcopy(predecessor)
    result.update({
        "contractId": "dwp.hris.sys-exact-business-start-successor.v2",
        "schemaVersion": 2,
        "status": "STAGED_SYS_EXACT_SUCCESSOR_NOT_CURRENT",
        "canonicalDesignPublished": False,
        "runtimeImplemented": False,
        "productionAuthorized": False,
        "currentPointer": {
            "artifactId": "SYS_EXACT_BUSINESS_EQUIVALENCE",
            "currentPath": PREDECESSOR_PINS["sysExact"]["path"],
            "currentVersion": 1,
            "stagedSuccessorPath": TARGETS["sysExact"],
            "stagedSuccessorVersion": 2,
            "pointerState": "PENDING_EXPLICIT_ATOMIC_SWITCH_AFTER_BUNDLE_VALIDATION",
            "switchPerformed": False,
        },
        "acceptedCanonicalSourceBundle": copy.deepcopy(accepted),
        "modernSysSourceClosure": _sys_counts(sys_module),
        "derivativePins": {
            "sysModule": {
                "path": TARGETS["sysModule"],
                "fileSha256": hashlib.sha256(render(sys_module)).hexdigest(),
                "sealedPayloadSha256": sys_module["sealedPayloadSha256"],
            },
            "eventLineage": {
                "path": TARGETS["eventLineage"],
                "fileSha256": hashlib.sha256(render(event_lineage)).hexdigest(),
                "sealedPayloadSha256": event_lineage["sealedPayloadSha256"],
            },
            "payConsumer": {
                "path": TARGETS["payConsumer"],
                "fileSha256": hashlib.sha256(render(pay_consumer)).hexdigest(),
                "sealedPayloadSha256": pay_consumer["sealedPayloadSha256"],
            },
        },
        "successorLineage": _lineage("sysExact", TARGETS["sysExact"], accepted),
        "switchPrerequisites": [
            "ACCEPTED_LIVE_CANONICAL_AND_INDEPENDENT_ACCEPTANCE_EXACT",
            "ALL_NINE_DERIVATIVES_CREATE_ONLY_PRESENT_AND_SELF_SEALED",
            "PRIMARY_AND_INDEPENDENT_DERIVATIVE_VALIDATION_PASS",
            "SUPPORTED_READER_INVENTORY_REFRESH_AND_INDEPENDENT_REAUDIT_PASS",
            "GLOBAL_GATE_REMAINS_CLOSED_UNTIL_EXPLICIT_CONTROL_DECISION",
        ],
        "publicationState": "STAGED_NOT_CURRENT_NOT_IMPLEMENTED",
    })
    return seal(result)


def _compose_sys_lineage(
    predecessor: dict[str, Any], sys_exact: dict[str, Any],
    accepted: dict[str, Any],
) -> dict[str, Any]:
    result = copy.deepcopy(predecessor)
    result.update({
        "lineageId": "dwp.hris.sys-exact-business-successor-lineage.v2",
        "schemaVersion": 2,
        "status": "STAGED_SUCCESSOR_LINEAGE_CURRENT_POINTER_UNCHANGED",
        "priorCurrent": {
            "path": PREDECESSOR_PINS["sysExact"]["path"],
            "fileSha256": PREDECESSOR_PINS["sysExact"]["fileSha256"],
            "version": 1,
            "state": "CURRENT_EXACT_SUCCESSOR_UNCHANGED",
        },
        "stagedSuccessor": {
            "path": TARGETS["sysExact"],
            "fileSha256": hashlib.sha256(render(sys_exact)).hexdigest(),
            "sealedPayloadSha256": sys_exact["sealedPayloadSha256"],
            "version": 2,
            "state": "STAGED_NOT_CURRENT",
        },
        "currentPointer": {
            "artifactId": "SYS_EXACT_BUSINESS_EQUIVALENCE",
            "path": PREDECESSOR_PINS["sysExact"]["path"],
            "version": 1,
            "state": "CURRENT_EXACT_SUCCESSOR_UNCHANGED",
            "switchPerformed": False,
        },
        "acceptedCanonicalSourceBundle": copy.deepcopy(accepted),
        "successorLineage": _lineage("sysLineage", TARGETS["sysLineage"], accepted),
        "publicationState": "STAGED_NOT_CURRENT_NOT_IMPLEMENTED",
    })
    return seal(result)


def _compose_sys_pin(
    predecessor: dict[str, Any], bundle: dict[str, dict[str, Any]],
    accepted: dict[str, Any],
) -> dict[str, Any]:
    result = copy.deepcopy(predecessor)
    result.update({
        "pinId": "dwp.hris.sys-exact-business-start-pin.v2",
        "schemaVersion": 2,
        "status": "STAGED_SYS_EXACT_PIN_NOT_CURRENT",
        "currentArtifactPath": PREDECESSOR_PINS["sysExact"]["path"],
        "currentArtifactSha256": PREDECESSOR_PINS["sysExact"]["fileSha256"],
        "stagedArtifactPath": TARGETS["sysExact"],
        "stagedArtifactSha256": hashlib.sha256(render(bundle["sysExact"])).hexdigest(),
        "stagedLineagePath": TARGETS["sysLineage"],
        "stagedLineageSha256": hashlib.sha256(render(bundle["sysLineage"])).hexdigest(),
        "derivativeBundlePins": {
            key: {
                "path": TARGETS[key],
                "fileSha256": hashlib.sha256(render(bundle[key])).hexdigest(),
                "sealedPayloadSha256": bundle[key]["sealedPayloadSha256"],
            }
            for key in PUBLISH_ORDER if key != "sysPin"
        },
        "acceptedCanonicalSourceBundle": copy.deepcopy(accepted),
        "successorLineage": _lineage("sysPin", TARGETS["sysPin"], accepted),
        "pointerSwitch": {
            "performed": False,
            "state": "PENDING_EXPLICIT_ATOMIC_SWITCH_AFTER_BUNDLE_VALIDATION",
        },
        "publicationState": "STAGED_NOT_CURRENT_NOT_IMPLEMENTED",
    })
    return seal(result)


def compose_bundle(
    *,
    accepted_raw_by_name: dict[str, bytes],
    acceptance: dict[str, Any],
    predecessor_raw_by_key: dict[str, bytes],
    projected_modules: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    predecessors = verify_predecessors(predecessor_raw_by_key)
    accepted = accepted_source_pin(accepted_raw_by_name, acceptance)
    documents = {
        name: parse_object(raw, name) for name, raw in accepted_raw_by_name.items()
    }
    dependency, event = _payroll_boundary(
        documents["modern-capability-operation-causal-contract-ssot.v2.json"],
        documents["modern-capability-event-payload-contracts.v1.json"],
        documents["modern-capability-closed-set-manifest.v3.json"],
    )
    bundle = _compose_modules(projected_modules, accepted)
    bundle["eventLineage"] = _compose_event_lineage(
        predecessors["eventLineage"],
        documents["modern-capability-operation-causal-contract-ssot.v2.json"],
        documents["modern-capability-event-payload-contracts.v1.json"],
        accepted,
    )
    bundle["payConsumer"] = _compose_pay(
        predecessors["payConsumer"], dependency, event, accepted,
    )
    bundle["sysExact"] = _compose_sys_exact(
        predecessors["sysExact"], bundle["sysModule"],
        bundle["eventLineage"], bundle["payConsumer"], accepted,
    )
    bundle["sysLineage"] = _compose_sys_lineage(
        predecessors["sysLineage"], bundle["sysExact"], accepted,
    )
    bundle["sysPin"] = _compose_sys_pin(
        predecessors["sysPin"], bundle, accepted,
    )
    validate_bundle(bundle, accepted)
    return bundle


def validate_bundle(
    bundle: dict[str, dict[str, Any]], accepted: dict[str, Any] | None = None,
) -> None:
    if set(bundle) != set(TARGETS):
        raise DerivativePublicationError("derivative output closed set drift")
    for key, value in bundle.items():
        if value.get("sealedPayloadSha256") != payload_sha(value):
            raise DerivativePublicationError(f"{key}: derivative self-seal mismatch")
        lineage = value.get("successorLineage") or value.get("predecessorLineage")
        if not isinstance(lineage, dict):
            raise DerivativePublicationError(f"{key}: exact lineage missing")
        if lineage.get("predecessorFileSha256") != PREDECESSOR_PINS[key][
            "fileSha256"
        ]:
            raise DerivativePublicationError(f"{key}: predecessor pin drift")
        if lineage.get("successorPath") != TARGETS[key]:
            raise DerivativePublicationError(f"{key}: successor path drift")
        if value.get("publicationState") != "STAGED_NOT_CURRENT_NOT_IMPLEMENTED":
            raise DerivativePublicationError(f"{key}: publication state drift")
        if accepted is not None and value.get(
            "acceptedCanonicalSourceBundle"
        ) != accepted:
            raise DerivativePublicationError(f"{key}: accepted source pin drift")
    if bundle["sysExact"]["currentPointer"].get("currentVersion") != 1:
        raise DerivativePublicationError("SYS exact v1 current pointer changed")
    if bundle["sysLineage"]["currentPointer"].get("version") != 1:
        raise DerivativePublicationError("SYS lineage v1 current pointer changed")
    if bundle["sysPin"]["pointerSwitch"].get("performed") is not False:
        raise DerivativePublicationError("SYS pointer switch occurred during staging")


def _absolute_under(root: Path, relative: str) -> Path:
    if Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise DerivativePublicationError(f"unsafe derivative target: {relative}")
    # Normalize the trusted publication root once. macOS exposes /var as a
    # platform symlink to /private/var; only descendants of this normalized
    # root are attacker-controlled components that must be checked by lstat.
    root_abs = Path(os.path.realpath(root))
    target = Path(os.path.abspath(root_abs / relative))
    try:
        target.relative_to(root_abs)
    except ValueError as error:
        raise DerivativePublicationError(f"target escapes root: {relative}") from error
    return target


def _secure_parent(parent: Path, root: Path, expected_uid: int) -> None:
    root = Path(os.path.realpath(root))
    current = parent
    chain = []
    while True:
        chain.append(current)
        if current == root:
            break
        if current == current.parent:
            raise DerivativePublicationError(
                f"target parent is outside publication root: {parent}"
            )
        current = current.parent
    for item in chain:
        metadata = item.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise DerivativePublicationError(f"unsafe target parent: {item}")
        if (
            metadata.st_uid != expected_uid
            or stat.S_IMODE(metadata.st_mode) & 0o022
        ):
            raise DerivativePublicationError(f"writable/foreign target parent: {item}")


def create_only_bundle(
    bundle: dict[str, dict[str, Any]],
    *,
    root: Path,
    expected_targets: dict[str, str] | None = None,
    test_only_allow_target_override: bool = False,
    failure_after_links: int | None = None,
    stage_hook: Callable[[Path, str], None] | None = None,
) -> dict[str, str]:
    validate_bundle(bundle)
    target_map = TARGETS if expected_targets is None else expected_targets
    if target_map != TARGETS and not test_only_allow_target_override:
        raise DerivativePublicationError("derivative target map override is test-only")
    if set(target_map) != set(TARGETS):
        raise DerivativePublicationError("expected target key set drift")
    if tuple(PUBLISH_ORDER) != tuple(key for key in PUBLISH_ORDER):
        raise AssertionError("publish order drift")
    paths = {
        key: _absolute_under(root, target_map[key]) for key in PUBLISH_ORDER
    }
    if len({str(path) for path in paths.values()}) != len(paths):
        raise DerivativePublicationError("derivative target alias")
    uid = os.getuid()
    stages: list[tuple[str, Path, Path, bytes]] = []
    created: list[tuple[Path, int, int]] = []
    try:
        for key in PUBLISH_ORDER:
            target = paths[key]
            _secure_parent(target.parent, root, uid)
            try:
                target.lstat()
            except FileNotFoundError:
                pass
            else:
                raise FileExistsError(f"derivative target occupied: {target}")
            payload = render(bundle[key])
            descriptor, temporary = tempfile.mkstemp(
                prefix=f".{target.name}.", suffix=".stage", dir=target.parent,
            )
            stage = Path(temporary)
            try:
                os.fchmod(descriptor, 0o600)
                os.write(descriptor, payload)
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            if stage_hook is not None:
                stage_hook(stage, key)
            metadata = stage.lstat()
            if (
                not stat.S_ISREG(metadata.st_mode)
                or metadata.st_uid != uid
                or stat.S_IMODE(metadata.st_mode) != 0o600
                or metadata.st_nlink != 1
                or metadata.st_size != len(payload)
                or hashlib.sha256(stage.read_bytes()).digest()
                != hashlib.sha256(payload).digest()
            ):
                raise DerivativePublicationError(f"unsafe staged derivative: {key}")
            stages.append((key, stage, target, payload))
        for index, (key, stage, target, payload) in enumerate(stages, 1):
            os.link(stage, target, follow_symlinks=False)
            target_stat = target.lstat()
            stage_stat = stage.lstat()
            if (
                (target_stat.st_dev, target_stat.st_ino)
                != (stage_stat.st_dev, stage_stat.st_ino)
                or target_stat.st_nlink != 2
            ):
                raise DerivativePublicationError(f"create-only link identity drift: {key}")
            created.append((target, target_stat.st_dev, target_stat.st_ino))
            stage.unlink()
            final_stat = target.lstat()
            if (
                (final_stat.st_dev, final_stat.st_ino)
                != (target_stat.st_dev, target_stat.st_ino)
                or final_stat.st_nlink != 1
                or stat.S_IMODE(final_stat.st_mode) != 0o600
                or final_stat.st_size != len(payload)
                or hashlib.sha256(target.read_bytes()).digest()
                != hashlib.sha256(payload).digest()
            ):
                raise DerivativePublicationError(
                    f"final create-only derivative identity drift: {key}"
                )
            directory_fd = os.open(target.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
            if failure_after_links is not None and index == failure_after_links:
                raise DerivativePublicationError("injected partial publication failure")
        stages.clear()
        return {
            TARGETS[key]: hashlib.sha256(paths[key].read_bytes()).hexdigest()
            for key in PUBLISH_ORDER
        }
    except BaseException:
        for target, device, inode in reversed(created):
            try:
                metadata = target.lstat()
                if (
                    metadata.st_dev == device
                    and metadata.st_ino == inode
                    and stat.S_ISREG(metadata.st_mode)
                ):
                    target.unlink()
            except FileNotFoundError:
                pass
        raise
    finally:
        for _key, stage, _target, _payload in stages:
            try:
                stage.unlink()
            except FileNotFoundError:
                pass


def _load_predecessor_raw(root: Path = ROOT) -> dict[str, bytes]:
    return {
        key: (root / pin["path"]).read_bytes()
        for key, pin in PREDECESSOR_PINS.items()
    }


def _synthetic_inputs() -> tuple[
    dict[str, bytes], dict[str, Any], dict[str, bytes], dict[str, dict[str, Any]]
]:
    """Build the repaired v9/v7 projection only in memory for self-tests."""
    import sys

    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    from generate_modern_causal_module_successor import (
        _pipeline,
        project_versioned_successor_modules,
    )
    from generate_modern_closed_set_manifest import build_manifest
    from generate_modern_operation_ssot_successor import compose, validate
    from generate_modern_semantic_identity_successor import compose_all
    from modern_successor_reader_guard import guarded_modern_successor_read

    candidate = HERE / "modern-canonical-candidate.A7K8Kj"
    with guarded_modern_successor_read(__file__, enforce_inventory=False):
        manifest = build_manifest()
    ssot = compose(
        json.loads((candidate / ACCEPTED_SOURCE_NAMES[4]).read_text()), manifest,
    )
    validate(ssot, manifest)
    exact, events, semantic, identities = compose_all(
        json.loads((candidate / ACCEPTED_SOURCE_NAMES[3]).read_text()),
        json.loads((candidate / ACCEPTED_SOURCE_NAMES[2]).read_text()),
        ssot,
        "SOURCE_ONLY_SYNTHETIC_ACCEPTED_LIVE",
        manifest,
    )
    causal, modules, _summary = _pipeline(
        (ssot, exact, events, semantic, identities, manifest)
    )
    projected_modules = project_versioned_successor_modules(modules)
    listening = json.loads((candidate / ACCEPTED_SOURCE_NAMES[7]).read_text())
    documents = {
        ACCEPTED_SOURCE_NAMES[0]: causal,
        ACCEPTED_SOURCE_NAMES[1]: manifest,
        ACCEPTED_SOURCE_NAMES[2]: events,
        ACCEPTED_SOURCE_NAMES[3]: exact,
        ACCEPTED_SOURCE_NAMES[4]: ssot,
        ACCEPTED_SOURCE_NAMES[5]: identities,
        ACCEPTED_SOURCE_NAMES[6]: semantic,
        ACCEPTED_SOURCE_NAMES[7]: listening,
    }
    raw = {
        name: (
            (candidate / name).read_bytes()
            if name == ACCEPTED_SOURCE_NAMES[7]
            else render_canonical_source(value)
        )
        for name, value in documents.items()
    }
    acceptance = {
        "status": "PASS",
        "acceptedLive": True,
        "sourceFileSha256": {
            name: hashlib.sha256(value).hexdigest() for name, value in raw.items()
        },
        "acceptanceRef": {
            "path": "SYNTHETIC_SELFTEST_ACCEPTANCE_NOT_PUBLISHABLE",
            "fileSha256": "1" * 64,
            "sealedPayloadSha256": "2" * 64,
        },
    }
    return raw, acceptance, _load_predecessor_raw(), projected_modules


def run_self_tests() -> dict[str, Any]:
    cases: dict[str, bool] = {}
    raw, acceptance, predecessors, projected = _synthetic_inputs()
    bundle = compose_bundle(
        accepted_raw_by_name=raw,
        acceptance=acceptance,
        predecessor_raw_by_key=predecessors,
        projected_modules=projected,
    )
    cases["compose-exact-nine"] = set(bundle) == set(TARGETS)
    cases["all-self-sealed"] = all(
        value["sealedPayloadSha256"] == payload_sha(value)
        for value in bundle.values()
    )
    cases["sys-pointer-not-switched"] = (
        bundle["sysExact"]["currentPointer"]["currentVersion"] == 1
        and bundle["sysPin"]["pointerSwitch"]["performed"] is False
    )
    # The immutable A7K8Kj candidate intentionally remains rejected until a
    # distinct repaired candidate is built and independently accepted.
    legacy = HERE / "modern-canonical-candidate.A7K8Kj"
    try:
        _payroll_boundary(
            json.loads((legacy / ACCEPTED_SOURCE_NAMES[4]).read_text()),
            json.loads((legacy / ACCEPTED_SOURCE_NAMES[2]).read_text()),
            json.loads((legacy / ACCEPTED_SOURCE_NAMES[1]).read_text()),
        )
        cases["legacy-pay-gap-rejected"] = False
    except DerivativePublicationError:
        cases["legacy-pay-gap-rejected"] = True
    try:
        accepted_source_pin(raw, {})
        cases["accepted-live-absence-rejected"] = False
    except DerivativePublicationError:
        cases["accepted-live-absence-rejected"] = True
    drift = dict(predecessors)
    drift["payConsumer"] = drift["payConsumer"] + b" "
    try:
        verify_predecessors(drift)
        cases["predecessor-drift-rejected"] = False
    except DerivativePublicationError:
        cases["predecessor-drift-rejected"] = True

    def fixture_root(name: str) -> tuple[Path, tempfile.TemporaryDirectory[str]]:
        temporary = tempfile.TemporaryDirectory(prefix=f"phase5-{name}-")
        root = Path(temporary.name)
        for relative in TARGETS.values():
            parent = (root / relative).parent
            parent.mkdir(parents=True, exist_ok=True)
            parent.chmod(0o700)
        return root, temporary

    root, temporary = fixture_root("success")
    try:
        hashes = create_only_bundle(bundle, root=root)
        cases["create-only-nine"] = len(hashes) == 9
        before = {
            key: (root / relative).read_bytes() for key, relative in TARGETS.items()
        }
        try:
            create_only_bundle(bundle, root=root)
            cases["duplicate-publication-rejected"] = False
        except FileExistsError:
            cases["duplicate-publication-rejected"] = before == {
                key: (root / relative).read_bytes()
                for key, relative in TARGETS.items()
            }
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("occupied")
    try:
        occupied = root / TARGETS["eventLineage"]
        occupied.write_text("occupied", encoding="utf-8")
        try:
            create_only_bundle(bundle, root=root)
            cases["occupied-target-rejected"] = False
        except FileExistsError:
            cases["occupied-target-rejected"] = occupied.read_text() == "occupied"
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("symlink")
    try:
        external = root / "external"
        external.write_text("external", encoding="utf-8")
        (root / TARGETS["eventLineage"]).symlink_to(external)
        try:
            create_only_bundle(bundle, root=root)
            cases["symlink-target-rejected"] = False
        except FileExistsError:
            cases["symlink-target-rejected"] = external.read_text() == "external"
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("hardlink")
    try:
        external = root / "external"
        external.write_text("external", encoding="utf-8")
        os.link(external, root / TARGETS["eventLineage"])
        try:
            create_only_bundle(bundle, root=root)
            cases["hardlink-target-rejected"] = False
        except FileExistsError:
            cases["hardlink-target-rejected"] = external.read_text() == "external"
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("stage-hardlink")
    extra: list[Path] = []
    try:
        def hardlink_stage(stage: Path, key: str) -> None:
            if key == "eventLineage":
                linked = stage.with_suffix(".hostile-link")
                os.link(stage, linked)
                extra.append(linked)
        try:
            create_only_bundle(bundle, root=root, stage_hook=hardlink_stage)
            cases["hardlinked-stage-rejected"] = False
        except DerivativePublicationError:
            cases["hardlinked-stage-rejected"] = not any(
                (root / relative).exists() for relative in TARGETS.values()
            )
    finally:
        for path in extra:
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        temporary.cleanup()

    root, temporary = fixture_root("writable-parent")
    try:
        (root / TARGETS["eventLineage"]).parent.chmod(0o777)
        try:
            create_only_bundle(bundle, root=root)
            cases["writable-parent-rejected"] = False
        except DerivativePublicationError:
            cases["writable-parent-rejected"] = True
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("partial")
    try:
        try:
            create_only_bundle(bundle, root=root, failure_after_links=4)
            cases["partial-failure-rollback"] = False
        except DerivativePublicationError:
            cases["partial-failure-rollback"] = not any(
                (root / relative).exists() for relative in TARGETS.values()
            )
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("traversal")
    try:
        hostile = dict(TARGETS)
        hostile["eventLineage"] = "../escape.json"
        try:
            create_only_bundle(
                bundle, root=root, expected_targets=hostile,
                test_only_allow_target_override=True,
            )
            cases["traversal-rejected"] = False
        except DerivativePublicationError:
            cases["traversal-rejected"] = not (root.parent / "escape.json").exists()
    finally:
        temporary.cleanup()

    root, temporary = fixture_root("target-remap")
    try:
        remapped = dict(TARGETS)
        remapped["eventLineage"] = "coding-readiness/remapped-event-lineage.json"
        try:
            create_only_bundle(bundle, root=root, expected_targets=remapped)
            cases["target-remap-rejected"] = False
        except DerivativePublicationError:
            cases["target-remap-rejected"] = not any(
                (root / relative).exists() for relative in remapped.values()
            )
    finally:
        temporary.cleanup()

    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-causal-derivative-publication-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "failedCases": failed,
        "cases": cases,
        "realSuccessorArtifactsCreated": False,
        "productionPublishCli": "INTENTIONALLY_ABSENT_UNTIL_ACCEPTED_LIVE_AND_READER_INVENTORY_REFRESH",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", required=True)
    args = parser.parse_args()
    result = run_self_tests()
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0 if result["status"] == "PASS" else 1


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
