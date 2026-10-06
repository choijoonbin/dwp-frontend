#!/usr/bin/env python3
"""Process-wide, fail-closed host semaphore for expensive HRIS verification.

The lock lives outside every Git worktree, so acquiring it cannot make a target
checkout dirty.  Callers receive value-free timing metadata that can be embedded
in a verification receipt.  This module deliberately does not execute commands.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import stat
import tempfile
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


LOCK_ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/.control-locks")
LOCK_NAME = re.compile(r"[a-z][a-z0-9-]{0,62}")
HOST_VERIFICATION_SEMAPHORE = "hris-verification"
_ACTIVE_LEASES: dict[
    str, tuple[object, int, int, int, int, int, Path, int, str]
] = {}
_ACTIVE_LEASES_GUARD = threading.RLock()


class SemaphoreTimeoutError(TimeoutError):
    """Raised when an exclusive host semaphore cannot be acquired in time."""

    def __init__(self, metadata: dict[str, object]) -> None:
        super().__init__(f"host semaphore timeout: {metadata['name']}")
        self.metadata = metadata


def active_host_semaphore_capability(name: str) -> object | None:
    """Return an opaque same-process capability only while this context owns flock."""
    with _ACTIVE_LEASES_GUARD:
        lease = _ACTIVE_LEASES.get(name)
        if lease is None:
            return None
        (
            capability, pid, holder_thread, descriptor, device, inode, _lock_path,
            _nonce_descriptor, _nonce_sha256,
        ) = lease
        if pid != os.getpid() or holder_thread != threading.get_ident():
            return None
        try:
            metadata = os.fstat(descriptor)
        except OSError:
            return None
        if (metadata.st_dev, metadata.st_ino) != (device, inode):
            return None
        return capability


def active_host_semaphore_inheritance(
    name: str,
) -> tuple[tuple[int, int], dict[str, str]]:
    """Cross-process lease inheritance is deliberately unsupported.

    Advisory locks cannot prove that an inherited descriptor belongs to the
    process that acquired the lock: a same-UID process can open and mutate the
    canonical lock file while another process holds ``flock``.  Integration
    callers must use a two-phase protocol or the same-thread opaque capability.
    """
    del name
    raise ValueError("cross-process host semaphore inheritance is forbidden")


def inherited_host_semaphore_fd_is_valid(
    requested: bool,
    environment: dict[str, str],
    parent_pid: int,
    *,
    name: str = HOST_VERIFICATION_SEMAPHORE,
    lock_root: Path = LOCK_ROOT,
) -> bool:
    """Reject every cross-process descriptor/environment proof fail-closed."""
    del requested, environment, parent_pid, name, lock_root
    return False


def child_host_semaphore_inheritance(
    name: str = HOST_VERIFICATION_SEMAPHORE,
    *,
    environment: dict[str, str] | None = None,
    lock_root: Path = LOCK_ROOT,
) -> tuple[tuple[int, int], dict[str, str]]:
    """Reject relay attempts; no cross-process proof is authoritative."""
    del name, environment, lock_root
    raise ValueError("cross-process host semaphore relay is forbidden")


def inherited_host_semaphore_capability_is_valid(
    capability: object | None,
    name: str,
    environment: dict[str, str],
    holder_pid: int | None,
) -> bool:
    """Validate identity against the live in-process lease, never PID text alone."""
    return (
        capability is not None
        and holder_pid == os.getpid()
        and environment.get("DWP_HRIS_HOST_LOCK_NAME") == name
        and environment.get("DWP_HRIS_HOST_LOCK_PARENT_PID") == str(holder_pid)
        and active_host_semaphore_capability(name) is capability
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def _secure_lock_root(root: Path) -> None:
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    root_stat = root.lstat()
    if not stat.S_ISDIR(root_stat.st_mode) or root_stat.st_uid != os.getuid():
        raise PermissionError(f"unsafe semaphore root: {root}")
    current_mode = stat.S_IMODE(root_stat.st_mode)
    if current_mode & 0o077:
        root.chmod(current_mode & ~0o077)


@contextmanager
def exclusive_host_semaphore(
    name: str,
    *,
    timeout_seconds: float = 30.0,
    lock_root: Path = LOCK_ROOT,
) -> Iterator[dict[str, object]]:
    """Acquire an exclusive advisory lock or fail without running protected work."""

    if not LOCK_NAME.fullmatch(name):
        raise ValueError("semaphore name must match [a-z][a-z0-9-]{0,62}")
    if timeout_seconds < 0 or timeout_seconds > 300:
        raise ValueError("timeout_seconds must be between 0 and 300")
    _secure_lock_root(lock_root)
    lock_path = lock_root / f"{name}.lock"
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    requested_at = utc_now()
    started = time.monotonic()
    metadata: dict[str, object] = {
        "schema": "dwp.hris.host-semaphore-receipt.v1",
        "name": name,
        "lockPath": str(lock_path),
        "requestedAt": requested_at,
        "acquiredAt": None,
        "releasedAt": None,
        "waitMilliseconds": None,
        "status": "WAITING",
    }
    acquired = False
    capability: object | None = None
    nonce_descriptor: int | None = None
    try:
        file_stat = os.fstat(descriptor)
        path_stat = lock_path.lstat()
        if (
            not stat.S_ISREG(file_stat.st_mode)
            or file_stat.st_uid != os.getuid()
            or (file_stat.st_dev, file_stat.st_ino)
            != (path_stat.st_dev, path_stat.st_ino)
        ):
            raise PermissionError(f"unsafe semaphore file: {lock_path}")
        os.fchmod(descriptor, 0o600)
        while True:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                acquired = True
                break
            except BlockingIOError:
                elapsed = time.monotonic() - started
                if elapsed >= timeout_seconds:
                    metadata.update(
                        {
                            "waitMilliseconds": round(elapsed * 1000),
                            "status": "TIMEOUT_FAIL_CLOSED",
                        }
                    )
                    raise SemaphoreTimeoutError(metadata)
                time.sleep(min(0.1, max(0.0, timeout_seconds - elapsed)))
        elapsed = time.monotonic() - started
        metadata.update(
            {
                "acquiredAt": utc_now(),
                "waitMilliseconds": round(elapsed * 1000),
                "status": "ACQUIRED",
            }
        )
        nonce = os.urandom(32)
        nonce_sha256 = hashlib.sha256(nonce).hexdigest()
        nonce_descriptor, nonce_path = tempfile.mkstemp(
            prefix=f".{name}.capability.", dir=lock_root
        )
        os.fchmod(nonce_descriptor, 0o600)
        os.unlink(nonce_path)
        os.write(nonce_descriptor, nonce)
        os.fsync(nonce_descriptor)
        lock_record = (
            json.dumps(
                {
                    "schema": "dwp.hris.host-semaphore-lock-record.v1",
                    "name": name,
                    "nonceSha256": nonce_sha256,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n"
        ).encode("utf-8")
        os.ftruncate(descriptor, 0)
        os.pwrite(descriptor, lock_record, 0)
        os.fsync(descriptor)
        capability = object()
        with _ACTIVE_LEASES_GUARD:
            if name in _ACTIVE_LEASES:
                raise RuntimeError("same-process semaphore lease registry collision")
            _ACTIVE_LEASES[name] = (
                capability,
                os.getpid(),
                threading.get_ident(),
                descriptor,
                file_stat.st_dev,
                file_stat.st_ino,
                lock_path,
                nonce_descriptor,
                nonce_sha256,
            )
        yield metadata
    finally:
        if acquired:
            with _ACTIVE_LEASES_GUARD:
                registered = _ACTIVE_LEASES.get(name)
                if registered is not None and registered[0] is capability:
                    del _ACTIVE_LEASES[name]
            metadata["releasedAt"] = utc_now()
            metadata["status"] = "RELEASED"
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)
        if nonce_descriptor is not None:
            os.close(nonce_descriptor)


def _obsolete_cross_process_self_test_not_called() -> dict[str, object]:
    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-semaphore-test-") as temporary:
        root = Path(temporary)
        with exclusive_host_semaphore(
            "self-test", timeout_seconds=1.0, lock_root=root
        ) as first:
            cases["exclusive-acquire"] = first["status"] == "ACQUIRED"
            capability = active_host_semaphore_capability("self-test")
            proof_environment = {
                "DWP_HRIS_HOST_LOCK_NAME": "self-test",
                "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
            }
            cases["opaque-active-capability-accepted"] = (
                inherited_host_semaphore_capability_is_valid(
                    capability, "self-test", proof_environment, os.getpid()
                )
            )
            cases["forged-object-with-correct-pid-and-env-rejected"] = not (
                inherited_host_semaphore_capability_is_valid(
                    object(), "self-test", proof_environment, os.getpid()
                )
            )
            inherited_descriptors, child_proof = active_host_semaphore_inheritance(
                "self-test"
            )
            fd_check_script = (
                "import os,sys\n"
                "from pathlib import Path\n"
                "from host_semaphore import inherited_host_semaphore_fd_is_valid\n"
                "valid=inherited_host_semaphore_fd_is_valid(True,dict(os.environ),os.getppid(),name='self-test',lock_root=Path(sys.argv[1]))\n"
                "raise SystemExit(0 if valid else 7)\n"
            )
            child_environment = {**os.environ, **child_proof}
            inherited_child = subprocess.run(
                [sys.executable, "-c", fd_check_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env=child_environment,
                pass_fds=inherited_descriptors,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["child-accepts-real-inherited-locked-fd"] = (
                inherited_child.returncode == 0
            )
            relay_script = (
                "import os,subprocess,sys\n"
                "from pathlib import Path\n"
                "from host_semaphore import child_host_semaphore_inheritance\n"
                "fds,proof=child_host_semaphore_inheritance('self-test',lock_root=Path(sys.argv[1]))\n"
                "grand='import os,sys; from pathlib import Path; from host_semaphore import inherited_host_semaphore_fd_is_valid as v; raise SystemExit(0 if v(True,dict(os.environ),os.getppid(),name=\"self-test\",lock_root=Path(sys.argv[1])) else 8)'\n"
                "done=subprocess.run([sys.executable,'-c',grand,sys.argv[1]],env={**os.environ,**proof},pass_fds=fds)\n"
                "raise SystemExit(done.returncode)\n"
            )
            relayed_child = subprocess.run(
                [sys.executable, "-c", relay_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env=child_environment,
                pass_fds=inherited_descriptors,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["validated-child-can-relay-same-locked-fd-to-grandchild"] = (
                relayed_child.returncode == 0
            )
            no_fd_environment = dict(child_environment)
            no_fd_environment.pop("DWP_HRIS_HOST_LOCK_FD", None)
            no_fd_child = subprocess.run(
                [sys.executable, "-c", fd_check_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env=no_fd_environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["forged-env-without-inherited-fd-rejected"] = (
                no_fd_child.returncode == 7
            )
            forged_relay = subprocess.run(
                [sys.executable, "-c", relay_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env=no_fd_environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["forged-env-without-fd-cannot-relay"] = forged_relay.returncode != 0
            other_path = root / "other.lock"
            other_descriptor = os.open(other_path, os.O_CREAT | os.O_RDWR, 0o600)
            try:
                fcntl.flock(other_descriptor, fcntl.LOCK_EX)
                wrong_fd_environment = dict(child_environment)
                wrong_fd_environment["DWP_HRIS_HOST_LOCK_FD"] = str(other_descriptor)
                wrong_fd_child = subprocess.run(
                    [sys.executable, "-c", fd_check_script, str(root)],
                    cwd=Path(__file__).resolve().parent,
                    env=wrong_fd_environment,
                    pass_fds=(other_descriptor, inherited_descriptors[1]),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                cases["different-lock-inherited-fd-rejected"] = (
                    wrong_fd_child.returncode == 7
                )
            finally:
                fcntl.flock(other_descriptor, fcntl.LOCK_UN)
                os.close(other_descriptor)
            unlocked_same_descriptor = os.open(root / "self-test.lock", os.O_RDWR)
            forged_nonce_descriptor, forged_nonce_path = tempfile.mkstemp(
                prefix=".forged-capability.", dir=root
            )
            try:
                os.unlink(forged_nonce_path)
                os.write(forged_nonce_descriptor, os.urandom(32))
                forged_same_environment = dict(child_environment)
                forged_same_environment["DWP_HRIS_HOST_LOCK_FD"] = str(
                    unlocked_same_descriptor
                )
                forged_same_environment["DWP_HRIS_HOST_LOCK_CAP_FD"] = str(
                    forged_nonce_descriptor
                )
                forged_same_child = subprocess.run(
                    [sys.executable, "-c", fd_check_script, str(root)],
                    cwd=Path(__file__).resolve().parent,
                    env=forged_same_environment,
                    pass_fds=(unlocked_same_descriptor, forged_nonce_descriptor),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                cases["other-holder-plus-unlocked-canonical-fd-forgery-rejected"] = (
                    forged_same_child.returncode == 7
                )
            finally:
                os.close(unlocked_same_descriptor)
                os.close(forged_nonce_descriptor)
            child_script = (
                "import sys\n"
                "from pathlib import Path\n"
                "from host_semaphore import SemaphoreTimeoutError, exclusive_host_semaphore\n"
                "try:\n"
                "  with exclusive_host_semaphore('self-test', timeout_seconds=0.0, lock_root=Path(sys.argv[1])):\n"
                "    raise SystemExit(9)\n"
                "except SemaphoreTimeoutError:\n"
                "  raise SystemExit(0)\n"
            )
            child = subprocess.run(
                [sys.executable, "-c", child_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["competing-process-cannot-bypass-live-flock"] = child.returncode == 0
            try:
                with exclusive_host_semaphore(
                    "self-test", timeout_seconds=0.0, lock_root=root
                ):
                    cases["nested-contention-fails"] = False
            except SemaphoreTimeoutError as error:
                cases["nested-contention-fails"] = (
                    error.metadata["status"] == "TIMEOUT_FAIL_CLOSED"
                )
        cases["release-recorded"] = first["status"] == "RELEASED"
        cases["capability-revoked-on-context-exit"] = (
            active_host_semaphore_capability("self-test") is None
            and not inherited_host_semaphore_capability_is_valid(
                capability, "self-test", proof_environment, os.getpid()
            )
        )
        unlocked_descriptor = os.open(root / "self-test.lock", os.O_RDWR)
        unlocked_nonce_descriptor, unlocked_nonce_path = tempfile.mkstemp(
            prefix=".unlocked-capability.", dir=root
        )
        try:
            os.unlink(unlocked_nonce_path)
            unlocked_nonce = os.urandom(32)
            os.write(unlocked_nonce_descriptor, unlocked_nonce)
            unlocked_record = (
                json.dumps(
                    {
                        "schema": "dwp.hris.host-semaphore-lock-record.v1",
                        "name": "self-test",
                        "nonceSha256": hashlib.sha256(unlocked_nonce).hexdigest(),
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                )
                + "\n"
            ).encode()
            os.ftruncate(unlocked_descriptor, 0)
            os.pwrite(unlocked_descriptor, unlocked_record, 0)
            unlocked_environment = {
                "DWP_HRIS_HOST_LOCK_NAME": "self-test",
                "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
                "DWP_HRIS_HOST_LOCK_FD": str(unlocked_descriptor),
                "DWP_HRIS_HOST_LOCK_CAP_FD": str(unlocked_nonce_descriptor),
            }
            unlocked_child = subprocess.run(
                [sys.executable, "-c", fd_check_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env={**os.environ, **unlocked_environment},
                pass_fds=(unlocked_descriptor, unlocked_nonce_descriptor),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["unlocked-canonical-fd-rejected"] = unlocked_child.returncode == 7
            unlocked_relay = subprocess.run(
                [sys.executable, "-c", relay_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                env={**os.environ, **unlocked_environment},
                pass_fds=(unlocked_descriptor, unlocked_nonce_descriptor),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["unlocked-canonical-fd-cannot-relay"] = (
                unlocked_relay.returncode != 0
            )
        finally:
            os.close(unlocked_descriptor)
            os.close(unlocked_nonce_descriptor)
        cases["lock-mode-0600"] = stat.S_IMODE((root / "self-test.lock").stat().st_mode) == 0o600
        try:
            with exclusive_host_semaphore("../escape", lock_root=root):
                cases["unsafe-name-rejected"] = False
        except ValueError:
            cases["unsafe-name-rejected"] = True
    status_value = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.host-semaphore-self-test.v1",
        "status": status_value,
        "cases": cases,
    }


def self_test() -> dict[str, object]:
    """Seal local exclusion and prove all cross-process proof paths reject."""
    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-semaphore-test-") as temporary:
        root = Path(temporary)
        with exclusive_host_semaphore(
            "self-test", timeout_seconds=1.0, lock_root=root
        ) as first:
            cases["exclusive-acquire"] = first["status"] == "ACQUIRED"
            capability = active_host_semaphore_capability("self-test")
            proof_environment = {
                "DWP_HRIS_HOST_LOCK_NAME": "self-test",
                "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
            }
            cases["same-thread-opaque-active-capability-accepted"] = (
                inherited_host_semaphore_capability_is_valid(
                    capability, "self-test", proof_environment, os.getpid()
                )
            )
            cases["forged-object-rejected"] = not (
                inherited_host_semaphore_capability_is_valid(
                    object(), "self-test", proof_environment, os.getpid()
                )
            )
            thread_observation: list[bool] = []

            def observe_from_non_holder_thread() -> None:
                thread_observation.extend(
                    [
                        active_host_semaphore_capability("self-test") is None,
                        not inherited_host_semaphore_capability_is_valid(
                            capability,
                            "self-test",
                            proof_environment,
                            os.getpid(),
                        ),
                    ]
                )

            observer = threading.Thread(target=observe_from_non_holder_thread)
            observer.start()
            observer.join(timeout=2.0)
            cases["same-process-non-holder-thread-rejected"] = (
                not observer.is_alive()
                and thread_observation == [True, True]
            )
            try:
                active_host_semaphore_inheritance("self-test")
                cases["cross-process-export-always-rejected"] = False
            except ValueError:
                cases["cross-process-export-always-rejected"] = True
            try:
                child_host_semaphore_inheritance(
                    "self-test", lock_root=root
                )
                cases["cross-process-relay-always-rejected"] = False
            except ValueError:
                cases["cross-process-relay-always-rejected"] = True

            # Reproduce the advisory-lock attack: a same-UID opener can mutate
            # the lock record while this process legitimately holds flock.  The
            # retired inherited-FD verifier must still reject unconditionally.
            attacker_lock_fd = os.open(root / "self-test.lock", os.O_RDWR)
            attacker_nonce_fd, attacker_nonce_path = tempfile.mkstemp(
                prefix=".attacker-capability.", dir=root
            )
            try:
                os.unlink(attacker_nonce_path)
                attacker_nonce = os.urandom(32)
                os.write(attacker_nonce_fd, attacker_nonce)
                forged_record = (
                    json.dumps(
                        {
                            "schema": "dwp.hris.host-semaphore-lock-record.v1",
                            "name": "self-test",
                            "nonceSha256": hashlib.sha256(attacker_nonce).hexdigest(),
                        },
                        sort_keys=True,
                        separators=(",", ":"),
                    )
                    + "\n"
                ).encode("utf-8")
                os.ftruncate(attacker_lock_fd, 0)
                os.pwrite(attacker_lock_fd, forged_record, 0)
                forged_environment = {
                    "DWP_HRIS_HOST_LOCK_NAME": "self-test",
                    "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
                    "DWP_HRIS_HOST_LOCK_FD": str(attacker_lock_fd),
                    "DWP_HRIS_HOST_LOCK_CAP_FD": str(attacker_nonce_fd),
                }
                cases["advisory-record-overwrite-fd-forgery-rejected"] = not (
                    inherited_host_semaphore_fd_is_valid(
                        True,
                        forged_environment,
                        os.getpid(),
                        name="self-test",
                        lock_root=root,
                    )
                )
            finally:
                os.close(attacker_lock_fd)
                os.close(attacker_nonce_fd)

            child_script = (
                "import sys\n"
                "from pathlib import Path\n"
                "from host_semaphore import SemaphoreTimeoutError, exclusive_host_semaphore\n"
                "try:\n"
                "  with exclusive_host_semaphore('self-test', timeout_seconds=0.0, lock_root=Path(sys.argv[1])):\n"
                "    raise SystemExit(9)\n"
                "except SemaphoreTimeoutError:\n"
                "  raise SystemExit(0)\n"
            )
            child = subprocess.run(
                [sys.executable, "-c", child_script, str(root)],
                cwd=Path(__file__).resolve().parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            cases["competing-process-cannot-bypass-live-flock"] = (
                child.returncode == 0
            )
            try:
                with exclusive_host_semaphore(
                    "self-test", timeout_seconds=0.0, lock_root=root
                ):
                    cases["nested-contention-fails"] = False
            except SemaphoreTimeoutError as error:
                cases["nested-contention-fails"] = (
                    error.metadata["status"] == "TIMEOUT_FAIL_CLOSED"
                )
        cases["release-recorded"] = first["status"] == "RELEASED"
        cases["capability-revoked-on-context-exit"] = (
            active_host_semaphore_capability("self-test") is None
            and not inherited_host_semaphore_capability_is_valid(
                capability, "self-test", proof_environment, os.getpid()
            )
        )
        cases["lock-mode-0600"] = (
            stat.S_IMODE((root / "self-test.lock").stat().st_mode) == 0o600
        )
        try:
            with exclusive_host_semaphore("../escape", lock_root=root):
                cases["unsafe-name-rejected"] = False
        except ValueError:
            cases["unsafe-name-rejected"] = True
    status_value = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.host-semaphore-self-test.v1",
        "status": status_value,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if not args.self_test:
        parser.error("only --self-test is supported; import this module to acquire a lock")
    result = self_test()
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
