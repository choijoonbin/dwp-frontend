#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DISPOSITION = HERE / "semantic-disposition.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


d = json.loads(DISPOSITION.read_text())
r = json.loads(REVIEW.read_text())
require(d["state"] == "PAY005_TYPED_TAX_RESULT_AND_IAQ048_CONTRIBUTION_SEALED_EXACT_PACKET_REQUIRED_SOURCE_NO_GO", "state drift")
require(d["sliceId"] == "BASE-TFR-PAY-005" and d["moduleSession"] == "HRIS-PAY", "owner drift")
require([x["id"] for x in d["dependencySnapshot"]] == ["DEP-001", "DEP-002", "DEP-003", "DEP-016"], "dependency drift")
require(all(x["status"] == "READY" for x in d["dependencySnapshot"]), "dependency not ready")
require(d["entryQuery"]["fieldGroupsInExactOrder"] == ["TAX_RESULT", "SOCIAL_INSURANCE", "POLICY_VERSION"], "field order drift")
require(d["entryQuery"]["availableActions"] == [], "actions must remain empty")
require(d["migrationDisposition"]["currentHighWater"] == "V56" and d["migrationDisposition"]["requiredVersion"] == "V57", "migration rebase drift")
require(d["migrationDisposition"]["createExactly"] == ["pay_tax_result_facts"], "schema delta drift")
require(d["migrationDisposition"]["exactPath"].endswith("V57__pay_base_tfr_pay_005_tax_result.sql"), "migration path drift")
require(len(d["acceptanceCriteria"]) == 12, "acceptance count drift")
require([x["id"] for x in d["acceptanceCriteria"]] == [f"PAY005-AC-{n:02d}" for n in range(1, 13)], "acceptance ids drift")
for key in ("sourceAuthoringAuthorizedByThisDisposition", "migrationAuthoringAuthorizedByThisDisposition", "testExecutionAuthorizedByThisDisposition", "moduleCommitOrPushAuthorizedByThisDisposition", "directDwpDevSourceMergeAuthorized", "productionActivationAuthorized"):
    require(d["authority"][key] is False, f"unsafe authority {key}")
for pin in d["predecessorPins"].values():
    path = (HERE / pin["path"]).resolve()
    sha, size = digest(path)
    require((sha, size) == (pin["sha256"], pin["bytes"]), f"pin drift: {path}")
d_sha, d_bytes = digest(DISPOSITION)
v_sha, v_bytes = digest(Path(__file__).resolve())
require(r["dispositionPin"] == {"sha256": d_sha, "bytes": d_bytes}, "review disposition pin drift")
require(r["validatorPin"] == {"sha256": v_sha, "bytes": v_bytes}, "review validator pin drift")
require(r["decision"] == "GO_TO_EXACT_PAY005_PACKET_AND_V57_RESERVATION_SOURCE_NO_GO", "review decision drift")
require(r["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review finding drift")
print("PASS: PAY-005 semantic boundary and V57 rebase are sealed; source remains unauthorized.")
