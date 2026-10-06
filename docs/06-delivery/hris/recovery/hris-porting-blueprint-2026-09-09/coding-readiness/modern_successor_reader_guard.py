#!/usr/bin/env python3
"""Mandatory shared-lock and durable-journal guard for modern live readers.

Every supported direct reader of the promoted canonical/physical path set runs
inside this context.  Readers take a shared flock on the same host semaphore
file used exclusively by Control writers.  After the shared lock is acquired,
the durable central fence is checked.  Consequently a live writer cannot begin
while any reader is active, and a writer death that leaves PREPARED,
COMMITTING, or FINALIZING state blocks every later reader even though the
writer's exclusive flock has been released.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import stat
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator, TypeVar


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
G0 = ROOT / "g0"
INVENTORY = HERE / "modern-successor-supported-reader-inventory.v5.json"

if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))

from central_transaction_fence import (  # noqa: E402
    assert_all_central_transactions_committed,
    modern_successor_promotion_errors,
)
from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    LOCK_ROOT,
    active_host_semaphore_capability,
)


INVENTORY_SCHEMA = "dwp.hris.modern-successor-supported-reader-inventory.v5"
INVENTORY_PREDECESSOR = {
    "path": "coding-readiness/modern-successor-supported-reader-inventory.v4.json",
    "fileSha256": "40d272662a574e67f16779580822d6c68ce2ceb39868825a96f19a15d58eb08c",
    "sealedPayloadSha256": "6d54e432c4c069338087eb9a944e7ba04da2b7ed3e587eca7a1612bab696b5dd",
    "disposition": "IMMUTABLE_SELF_SEALED_PREDECESSOR_SUPERSEDED_BY_V5_REFRESH",
}
SEAL_METHOD = "SHA256_OF_UTF8_JSON_SORT_KEYS_COMPACT_EXCLUDING_sealedPayloadSha256"
SUPPORTED_DISPOSITIONS = {
    "GUARDED_DIRECT_ENTRYPOINT",
    "GUARDED_CJS_DIRECT_ENTRYPOINT",
    "GUARDED_LIBRARY_CALLERS_ONLY",
    "CONTROL_WRITER_SELF_GUARDED",
}
T = TypeVar("T")
_THREAD_LEASES: dict[int, tuple[int, int]] = {}
_THREAD_LEASES_LOCK = threading.RLock()


class ReaderFenceError(RuntimeError):
    """A supported reader cannot prove one stable terminal generation."""


def _canonical_compact(payload: dict[str, object]) -> bytes:
    body = dict(payload)
    body.pop("sealedPayloadSha256", None)
    return json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def _load_inventory(path: Path = INVENTORY) -> dict[str, object]:
    try:
        if path.is_symlink() or not path.is_file():
            raise ReaderFenceError(f"reader inventory missing or unsafe: {path}")
        raw = path.read_bytes()
        payload = json.loads(raw)
    except (OSError, json.JSONDecodeError) as error:
        raise ReaderFenceError(f"reader inventory unreadable: {error}") from error
    if not isinstance(payload, dict) or payload.get("schema") != INVENTORY_SCHEMA:
        raise ReaderFenceError("reader inventory schema drift")
    seal = payload.get("sealedPayloadSha256")
    expected = hashlib.sha256(_canonical_compact(payload)).hexdigest()
    if seal != expected:
        raise ReaderFenceError("reader inventory self-seal mismatch")
    entries = payload.get("entries")
    if not isinstance(entries, list):
        raise ReaderFenceError("reader inventory entries drift")
    if payload.get("predecessorInventory") != INVENTORY_PREDECESSOR:
        raise ReaderFenceError("reader inventory predecessor pin drift")
    return payload


def _relative_entrypoint(entrypoint: str | Path, root: Path = ROOT) -> str:
    path = Path(entrypoint).absolute()
    try:
        return path.relative_to(root.absolute()).as_posix()
    except ValueError as error:
        raise ReaderFenceError(f"reader entrypoint escapes blueprint root: {path}") from error


def _assert_supported_entrypoint(
    entrypoint: str | Path,
    *,
    inventory_path: Path = INVENTORY,
    root: Path = ROOT,
    allowed_dispositions: set[str] | None = None,
) -> str:
    relative = _relative_entrypoint(entrypoint, root)
    inventory = _load_inventory(inventory_path)
    matches = [
        item
        for item in inventory["entries"]
        if isinstance(item, dict) and item.get("path") == relative
    ]
    if len(matches) != 1:
        raise ReaderFenceError(f"reader is not uniquely inventoried: {relative}")
    disposition = matches[0].get("disposition")
    allowed = allowed_dispositions or {
        "GUARDED_DIRECT_ENTRYPOINT",
        "GUARDED_LIBRARY_CALLERS_ONLY",
    }
    if disposition not in allowed:
        raise ReaderFenceError(
            f"reader disposition cannot enter Python guard: {relative}:{disposition}"
        )
    return relative


def _secure_lock_root(lock_root: Path) -> None:
    lock_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    metadata = lock_root.lstat()
    if (
        not stat.S_ISDIR(metadata.st_mode)
        or stat.S_ISLNK(metadata.st_mode)
        or metadata.st_uid != os.getuid()
        or stat.S_IMODE(metadata.st_mode) & 0o077
    ):
        raise ReaderFenceError(f"unsafe reader lock root: {lock_root}")


def _acquire_shared_lock(lock_root: Path, timeout_seconds: float) -> int:
    if timeout_seconds < 0 or timeout_seconds > 300:
        raise ReaderFenceError("reader lock timeout must be between 0 and 300 seconds")
    _secure_lock_root(lock_root)
    lock_path = lock_root / f"{HOST_VERIFICATION_SEMAPHORE}.lock"
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    try:
        file_stat = os.fstat(descriptor)
        path_stat = lock_path.lstat()
        if (
            not stat.S_ISREG(file_stat.st_mode)
            or file_stat.st_uid != os.getuid()
            or (file_stat.st_dev, file_stat.st_ino)
            != (path_stat.st_dev, path_stat.st_ino)
        ):
            raise ReaderFenceError(f"unsafe reader lock file: {lock_path}")
        os.fchmod(descriptor, 0o600)
        started = time.monotonic()
        while True:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_SH | fcntl.LOCK_NB)
                return descriptor
            except BlockingIOError:
                if time.monotonic() - started >= timeout_seconds:
                    raise ReaderFenceError(
                        f"shared reader semaphore timeout: {HOST_VERIFICATION_SEMAPHORE}"
                    )
                time.sleep(min(0.05, max(0.0, timeout_seconds)))
    except BaseException:
        os.close(descriptor)
        raise


def _assert_durable_terminal_fence() -> None:
    try:
        assert_all_central_transactions_committed()
    except (OSError, ValueError) as error:
        raise ReaderFenceError(f"durable reader fence blocked: {error}") from error


@contextmanager
def guarded_modern_successor_read(
    entrypoint: str | Path,
    *,
    timeout_seconds: float = 300.0,
    lock_root: Path = LOCK_ROOT,
    inventory_path: Path = INVENTORY,
    root: Path = ROOT,
    enforce_inventory: bool = True,
) -> Iterator[dict[str, object]]:
    """Hold a shared writer-excluding lock and require terminal journals."""
    relative = (
        _assert_supported_entrypoint(
            entrypoint, inventory_path=inventory_path, root=root
        )
        if enforce_inventory
        else _relative_entrypoint(entrypoint, root)
    )
    thread_id = threading.get_ident()
    descriptor: int | None = None
    owns_descriptor = False
    with _THREAD_LEASES_LOCK:
        active = _THREAD_LEASES.get(thread_id)
        if active is not None:
            descriptor, depth = active
            _THREAD_LEASES[thread_id] = (descriptor, depth + 1)
        elif active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is not None:
            # A same-thread Control writer already owns the stronger exclusive
            # lease.  Never open another descriptor and accidentally downgrade
            # or split that lease.
            _THREAD_LEASES[thread_id] = (-1, 1)
            descriptor = -1
        else:
            descriptor = _acquire_shared_lock(lock_root, timeout_seconds)
            owns_descriptor = True
            _THREAD_LEASES[thread_id] = (descriptor, 1)
    try:
        _assert_durable_terminal_fence()
        yield {
            "schema": "dwp.hris.modern-successor-reader-lease.v1",
            "entrypoint": relative,
            "lockMode": "EXCLUSIVE_CONTROL_REUSE" if descriptor == -1 else "SHARED",
            "journalFence": "TERMINAL_OR_ABSENT",
        }
        _assert_durable_terminal_fence()
    finally:
        with _THREAD_LEASES_LOCK:
            current = _THREAD_LEASES.get(thread_id)
            if current is not None:
                current_descriptor, depth = current
                if depth > 1:
                    _THREAD_LEASES[thread_id] = (current_descriptor, depth - 1)
                else:
                    del _THREAD_LEASES[thread_id]
                    if owns_descriptor and current_descriptor >= 0:
                        fcntl.flock(current_descriptor, fcntl.LOCK_UN)
                        os.close(current_descriptor)


def require_active_reader_guard(entrypoint: str | Path) -> None:
    """Fail a library live-read/write call outside an active guarded entrypoint."""
    relative = _assert_supported_entrypoint(entrypoint)
    with _THREAD_LEASES_LOCK:
        if threading.get_ident() not in _THREAD_LEASES:
            raise ReaderFenceError(
                f"guarded library call requires an active reader lease: {relative}"
            )
    _assert_durable_terminal_fence()


def guarded_main(
    entrypoint: str | Path,
    callback: Callable[..., T],
    *args: object,
    **kwargs: object,
) -> T | int:
    try:
        with guarded_modern_successor_read(entrypoint):
            return callback(*args, **kwargs)
    except ReaderFenceError as error:
        print(f"MODERN_SUCCESSOR_READER_FENCE=BLOCKED reason={error}", file=sys.stderr)
        return 78


def run_guarded_cjs(entrypoint: Path, arguments: list[str]) -> int:
    """Run the sole supported CJS reader with an inherited locked descriptor."""
    relative = _assert_supported_entrypoint(
        entrypoint,
        allowed_dispositions={"GUARDED_CJS_DIRECT_ENTRYPOINT"},
    )
    with guarded_modern_successor_read(entrypoint, enforce_inventory=False):
        with _THREAD_LEASES_LOCK:
            descriptor, _depth = _THREAD_LEASES[threading.get_ident()]
        if descriptor < 0:
            raise ReaderFenceError(
                "CJS reader cannot inherit an opaque exclusive writer descriptor"
            )
        os.set_inheritable(descriptor, True)
        lock_path = LOCK_ROOT / f"{HOST_VERIFICATION_SEMAPHORE}.lock"
        metadata = os.fstat(descriptor)
        environment = dict(os.environ)
        environment.update(
            {
                "DWP_HRIS_READER_GUARD_FD": str(descriptor),
                "DWP_HRIS_READER_GUARD_DEVICE": str(metadata.st_dev),
                "DWP_HRIS_READER_GUARD_INODE": str(metadata.st_ino),
                "DWP_HRIS_READER_GUARD_ENTRYPOINT": relative,
                "DWP_HRIS_READER_GUARD_LOCK_PATH": str(lock_path),
            }
        )
        try:
            completed = subprocess.run(
                ["node", str(entrypoint), *arguments],
                cwd=str(ROOT),
                env=environment,
                pass_fds=(descriptor,),
                check=False,
            )
        finally:
            os.set_inheritable(descriptor, False)
        return completed.returncode


def _fixture_journal(path: Path, phase: str) -> None:
    statuses = {
        "PREPARED": "PROMOTION_TRANSACTION_PREPARED",
        "COMMITTING": "PROMOTION_TRANSACTION_COMMITTING",
        "FINALIZING": "PROMOTION_TRANSACTION_FINALIZING",
        "COMMITTED": "PROMOTION_TRANSACTION_COMMITTED",
        "ROLLED_BACK": "PROMOTION_TRANSACTION_ROLLED_BACK",
    }
    payload = {
        "schema": "dwp.hris.modern-successor-promotion-transaction-state.v1",
        "transactionId": "MODERN-SUCCESSOR-READER-GUARD-SELFTEST",
        "specPath": "coding-readiness/reports/selftest-spec.json",
        "specSha256": "0" * 64,
        "phase": phase,
        "status": statuses[phase],
        "transactionDirectory": "coding-readiness/.modern-successor-promotion/selftest",
        "promotionReportPath": "coding-readiness/reports/selftest-receipt.json",
        "preparedAt": "2026-09-16T00:00:00Z",
        "updatedAt": "2026-09-16T00:00:01Z",
        "nextDestination": None,
        "installedDestinations": [],
        "receiptSha256": "1" * 64 if phase == "COMMITTED" else None,
        "priorJournalSha256": None,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def self_test() -> dict[str, object]:
    import tempfile
    from unittest import mock

    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-reader-guard-") as temporary:
        fixture = Path(temporary)
        fixture_root = fixture / "root"
        fixture_root.mkdir()
        entrypoint = fixture_root / "reader.py"
        entrypoint.write_text("# fixture\n", encoding="utf-8")
        journal = fixture_root / "journal.json"
        lock_root = fixture / "locks"

        def fence() -> None:
            errors = modern_successor_promotion_errors(journal)
            if errors:
                raise ValueError("; ".join(errors))

        with mock.patch(
            f"{__name__}.assert_all_central_transactions_committed", side_effect=fence
        ):
            with guarded_modern_successor_read(
                entrypoint,
                lock_root=lock_root,
                root=fixture_root,
                enforce_inventory=False,
            ):
                cases["absent-journal-admitted"] = True
            for phase in ("PREPARED", "COMMITTING", "FINALIZING"):
                _fixture_journal(journal, phase)
                callback_called = False
                try:
                    with guarded_modern_successor_read(
                        entrypoint,
                        lock_root=lock_root,
                        root=fixture_root,
                        enforce_inventory=False,
                    ):
                        callback_called = True
                    cases[f"writer-death-{phase.lower()}-blocked"] = False
                except ReaderFenceError:
                    cases[f"writer-death-{phase.lower()}-blocked"] = not callback_called
            journal.write_text("{}\n", encoding="utf-8")
            try:
                with guarded_modern_successor_read(
                    entrypoint,
                    lock_root=lock_root,
                    root=fixture_root,
                    enforce_inventory=False,
                ):
                    pass
                cases["malformed-journal-blocked"] = False
            except ReaderFenceError:
                cases["malformed-journal-blocked"] = True
            for phase in ("COMMITTED", "ROLLED_BACK"):
                _fixture_journal(journal, phase)
                try:
                    with guarded_modern_successor_read(
                        entrypoint,
                        lock_root=lock_root,
                        root=fixture_root,
                        enforce_inventory=False,
                    ):
                        pass
                    cases[f"terminal-{phase.lower()}-admitted"] = True
                except ReaderFenceError:
                    cases[f"terminal-{phase.lower()}-admitted"] = False
            journal.unlink()
            with guarded_modern_successor_read(
                entrypoint,
                lock_root=lock_root,
                root=fixture_root,
                enforce_inventory=False,
            ):
                with guarded_modern_successor_read(
                    entrypoint,
                    lock_root=lock_root,
                    root=fixture_root,
                    enforce_inventory=False,
                ):
                    cases["same-thread-nested-reader-is-reentrant"] = True
            with guarded_modern_successor_read(
                entrypoint,
                lock_root=lock_root,
                root=fixture_root,
                enforce_inventory=False,
            ):
                lock_path = lock_root / f"{HOST_VERIFICATION_SEMAPHORE}.lock"
                probe = subprocess.run(
                    [
                        sys.executable,
                        "-c",
                        (
                            "import fcntl,os,sys;"
                            "fd=os.open(sys.argv[1],os.O_RDWR);"
                            "\ntry: fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)"
                            "\nexcept BlockingIOError: raise SystemExit(0)"
                            "\nraise SystemExit(1)"
                        ),
                        str(lock_path),
                    ],
                    check=False,
                )
                cases["active-shared-reader-excludes-writer-process"] = (
                    probe.returncode == 0
                )
            probe = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    (
                        "import fcntl,os,sys;"
                        "fd=os.open(sys.argv[1],os.O_RDWR);"
                        "fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)"
                    ),
                    str(lock_path),
                ],
                check=False,
            )
            cases["writer-process-admitted-after-reader-release"] = (
                probe.returncode == 0
            )

    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-successor-reader-guard-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "failedCases": failed,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--self-test", action="store_true")
    action.add_argument("--run-cjs", type=Path)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    if args.run_cjs is not None:
        arguments = list(args.arguments)
        if arguments[:1] == ["--"]:
            arguments = arguments[1:]
        try:
            return run_guarded_cjs(args.run_cjs.absolute(), arguments)
        except ReaderFenceError as error:
            print(f"MODERN_SUCCESSOR_READER_FENCE=BLOCKED reason={error}", file=sys.stderr)
            return 78
    result = self_test()
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if args.compact else None,
            indent=None if args.compact else 2,
        )
    )
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
