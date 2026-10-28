#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = FRONTEND.parent / "dwp-backend"
PACKET = HERE / "owner-packet.v1.json"
RESERVATION = HERE / "migration-lease-v57-reservation.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


packet = json.loads(PACKET.read_text())
reservation = json.loads(RESERVATION.read_text())
review = json.loads(REVIEW.read_text())

require(packet["state"] == "SEALED_EXACT_PAY005_OWNER_PACKET_WORKTREES_AND_ACTIVE_V57_LEASE_PENDING_SOURCE_NO_GO", "packet state drift")
require(reservation["state"] == "RESERVED_NOT_ACTIVE", "reservation state drift")
require(packet["sliceId"] == reservation["sliceId"] == "BASE-TFR-PAY-005", "slice drift")
require(reservation["lease"]["version"] == "V57" and reservation["lease"]["predecessorHighWater"] == "V56", "migration sequence drift")
require(reservation["lease"]["exactPath"].endswith("V57__pay_base_tfr_pay_005_tax_result.sql"), "migration path drift")
require(reservation["exactSchemaDelta"]["createExactly"] == ["pay_tax_result_facts"], "schema delta drift")
require(packet["acceptanceContract"]["criteriaCount"] == 12, "acceptance count drift")
require(packet["plannedWorktrees"]["materializedNow"] is False, "premature materialization claim")
for key in ("sourceAuthoringAuthorizedNow", "migrationAuthoringAuthorizedNow", "testExecutionAuthorizedNow", "moduleCommitOrPushAuthorizedNow", "directDwpDevMergeAuthorized", "routeOrMenuMountAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "productionLegalOrProviderBindingAuthorized"):
    require(packet["authority"][key] is False, f"unsafe packet authority {key}")

for pin in packet["immutableAuthorityBasis"].values():
    path = (HERE / pin["path"]).resolve()
    sha, size = digest(path)
    require((sha, size) == (pin["sha256"], pin["bytes"]), f"authority pin drift: {path}")

for repo, pins in ((FRONTEND, packet["currentSharedFilePins"]["frontend"]), (BACKEND, packet["currentSharedFilePins"]["backend"])):
    for pin in pins:
        sha, size = digest(repo / pin["path"])
        require((sha, size) == (pin["sha256"], pin["bytes"]), f"shared source drift: {pin['path']}")

frontend_pin = packet["basePins"]["frontend"]
backend_pin = packet["basePins"]["backend"]
require(git(FRONTEND, "rev-parse", f'{frontend_pin["commit"]}^{{tree}}') == frontend_pin["tree"], "frontend tree drift")
require(git(BACKEND, "rev-parse", f'{backend_pin["commit"]}^{{tree}}') == backend_pin["tree"], "backend tree drift")
require(git(BACKEND, "rev-parse", "origin/dwp-dev") == backend_pin["commit"], "backend origin drift")
v57 = list((BACKEND / "dwp-payroll-server/src/main/resources/db/migration").glob("V57__*.sql"))
require(v57 == [], "V57 already exists")

packet_sha, packet_bytes = digest(PACKET)
reservation_sha, reservation_bytes = digest(RESERVATION)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(review["packetPin"] == {"sha256": packet_sha, "bytes": packet_bytes}, "review packet pin drift")
require(review["reservationPin"] == {"sha256": reservation_sha, "bytes": reservation_bytes}, "review reservation pin drift")
require(review["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(review["decision"] == "GO_TO_CLEAN_PAY005_WORKTREE_MATERIALIZATION_SOURCE_NO_GO", "review decision drift")
require(review["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review finding drift")
print("PASS: PAY-005 owner packet and exclusive V57 reservation are sealed; source remains unauthorized until clean worktrees, active lease and token.")
