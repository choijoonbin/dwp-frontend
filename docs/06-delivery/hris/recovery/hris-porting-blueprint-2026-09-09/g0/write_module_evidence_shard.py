#!/usr/bin/env python3
"""Atomically append a content-addressed artifact to one module evidence shard."""

from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
    inherited_host_semaphore_capability_is_valid,
)
from gate_authority import assert_authoritative_gate_open
from validate_blueprint_workspace_boundaries import (
    ROOT, SHARD_PHASES,
    SESSIONS,
    SHARD_MANIFEST,
    content_sha,
    empty_shard_manifest,
    make_shard_entry,
    live_shard_inventory,
    shard_writable_root,
    valid_shard_relative,
    validate_shard,
)

SHARDS = {
    (session, phase): ROOT / shard_writable_root(session, phase)
    for phase in SHARD_PHASES
    for session in SESSIONS
}
MAX_EVIDENCE_BYTES = 100 * 1024 * 1024


def evidence_shard_lock_name(session: str, phase: str = "g3") -> str:
    """Return the only permitted publication lock for a module/phase shard."""
    if (session, phase) not in SHARDS:
        raise ValueError("unknown module evidence shard")
    return (
        HOST_VERIFICATION_SEMAPHORE
        if phase == "g4"
        else f"hris-blueprint-evidence-{SESSIONS[session][0]}-{phase}"
    )


def _inherited_host_lock_is_valid(
    requested: bool,
    capability: object | None,
    environment: dict[str, str],
    holder_pid: int | None,
    phase: str,
) -> bool:
    """Validate the private same-process proof used by the G4 aggregate writer."""
    return (
        requested
        and phase == "g4"
        and inherited_host_semaphore_capability_is_valid(
            capability,
            HOST_VERIFICATION_SEMAPHORE,
            environment,
            holder_pid,
        )
    )


def _inherited_shard_lock_is_valid(
    requested: bool,
    capability: object | None,
    environment: dict[str, str],
    holder_pid: int | None,
    session: str,
    phase: str,
) -> bool:
    lock_name = evidence_shard_lock_name(session, phase)
    return (
        requested
        and phase == "g3"
        and holder_pid == os.getpid()
        and environment.get("DWP_HRIS_SHARD_LOCK_NAME") == lock_name
        and environment.get("DWP_HRIS_SHARD_LOCK_PARENT_PID") == str(holder_pid)
        and active_host_semaphore_capability(lock_name) is capability
    )


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


@contextmanager
def publication_lock_context(
    session: str,
    phase: str,
    *,
    inherited_host: bool,
    inherited_shard: bool,
):
    """Enforce global→shard ordering; only typed G4 may inherit global."""
    shard_name = evidence_shard_lock_name(session, phase)
    if phase == "g4":
        if not inherited_host:
            raise ValueError("G4 publication requires the typed Control host lease")
        yield
        return
    active_host = active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE)
    if inherited_shard:
        if active_host is None:
            raise ValueError("inherited G3 shard lock lacks an active global host lease")
        yield
        return
    if active_host is not None:
        with exclusive_host_semaphore(shard_name, timeout_seconds=30.0):
            yield
        return
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ):
        with exclusive_host_semaphore(shard_name, timeout_seconds=30.0):
            yield


def resolve_target(session: str, relative: str, phase: str = "g3") -> Path:
    if (session, phase) not in SHARDS:
        raise ValueError("unknown module session")
    if not valid_shard_relative(relative):
        raise ValueError("relative path is forbidden by the shard contract")
    raw_root = SHARDS[(session, phase)]
    try:
        root_metadata = raw_root.lstat()
    except OSError as error:
        raise ValueError("module evidence shard root is unavailable") from error
    if stat.S_ISLNK(root_metadata.st_mode) or not stat.S_ISDIR(root_metadata.st_mode):
        raise ValueError("module evidence shard root is unsafe")
    root = raw_root.resolve()
    target = root.joinpath(*Path(relative).parts)
    resolved_parent = target.parent.resolve(strict=False)
    if resolved_parent != root and root not in resolved_parent.parents:
        raise ValueError("target escapes module evidence shard")
    return target


def read_stable_source(source: Path) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(source, flags)
    except OSError as error:
        raise ValueError(f"source must be a readable regular non-symlink file: {error}") from error
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            raise ValueError("source must be a regular non-symlink file")
        if before.st_size > MAX_EVIDENCE_BYTES:
            raise ValueError("source exceeds the 100 MiB evidence shard limit")
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(1024 * 1024, remaining))
            if not chunk:
                raise ValueError("source changed while it was read")
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1):
            raise ValueError("source grew while it was read")
        after = os.fstat(descriptor)
        if (
            before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns
        ) != (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns
        ):
            raise ValueError("source changed while it was read")
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def ensure_safe_parent(root: Path, target: Path) -> None:
    root_metadata = root.lstat()
    if not stat.S_ISDIR(root_metadata.st_mode) or stat.S_ISLNK(root_metadata.st_mode):
        raise ValueError("module evidence shard root is unsafe")
    current = root
    for part in target.relative_to(root).parent.parts:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            current.mkdir(mode=0o700)
            fsync_directory(current.parent)
            metadata = current.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
            raise ValueError("target parent contains a non-directory or symlink")


def atomic_write_manifest(path: Path, payload: dict[str, object]) -> None:
    data = (
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode()
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def assert_canonical_workspace(
    session: str, phase: str = "g3", *, canonical_only: bool = False
) -> None:
    arguments = [
        sys.executable,
        str(ROOT / "g0/validate_blueprint_workspace_boundaries.py"),
        "--session", session, "--phase", phase, "--compact",
    ]
    if canonical_only:
        arguments.append("--canonical-only")
    check = subprocess.run(
        arguments,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
        shell=False,
    )
    if check.returncode != 0:
        raise ValueError("canonical blueprint snapshot or append-only shard is not valid")


def append_new_bytes(
    session: str,
    artifacts: list[tuple[str, bytes]],
    phase: str = "g3",
    *,
    _host_lock_held_by_parent: bool = False,
    _host_lock_capability: object | None = None,
    _lock_environment: dict[str, str] | None = None,
    _parent_pid: int | None = None,
    _shard_lock_held_by_parent: bool = False,
    _shard_lock_capability: object | None = None,
) -> list[tuple[Path, str]]:
    """Append several immutable files under one shard lock and manifest commit."""
    if not artifacts:
        raise ValueError("artifact batch must not be empty")
    relatives = [relative for relative, _data in artifacts]
    if len(relatives) != len(set(relatives)):
        raise ValueError("artifact batch contains duplicate paths")
    if any(not isinstance(data, bytes) or len(data) > MAX_EVIDENCE_BYTES for _relative, data in artifacts):
        raise ValueError("artifact bytes are invalid or exceed the 100 MiB limit")
    targets = [resolve_target(session, relative, phase) for relative in relatives]
    inherited = _inherited_host_lock_is_valid(
        _host_lock_held_by_parent,
        _host_lock_capability,
        dict(os.environ) if _lock_environment is None else _lock_environment,
        _parent_pid,
        phase,
    )
    shard_inherited = _inherited_shard_lock_is_valid(
        _shard_lock_held_by_parent,
        _shard_lock_capability,
        dict(os.environ) if _lock_environment is None else _lock_environment,
        _parent_pid,
        session,
        phase,
    )
    if _host_lock_held_by_parent and not inherited:
        raise ValueError("inherited host semaphore proof is invalid")
    if _shard_lock_held_by_parent and not shard_inherited:
        raise ValueError("inherited shard semaphore proof is invalid")
    if inherited and shard_inherited:
        raise ValueError("multiple inherited publication locks are forbidden")
    if phase == "g4" and not inherited:
        raise ValueError(
            "G4 evidence publication is restricted to the typed Control builder "
            "holding a live opaque host capability"
        )
    with publication_lock_context(
        session,
        phase,
        inherited_host=inherited,
        inherited_shard=shard_inherited,
    ):
        assert_authoritative_gate_open()
        # A killed prior publisher may have durably created an exact subset of
        # this batch before its single manifest commit.  Validate immutable
        # central inputs first, then reconcile only those explicitly named
        # target paths; unrelated or byte-different orphans remain fail-closed.
        assert_canonical_workspace(session, phase, canonical_only=True)
        root = SHARDS[(session, phase)].resolve()
        manifest_path = root / SHARD_MANIFEST
        try:
            manifest = json.loads(manifest_path.read_text())
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"append-only shard manifest is unavailable: {error}") from error
        entries = manifest.get("entries")
        if not isinstance(entries, list):
            raise ValueError("append-only shard manifest entries are invalid")
        manifest_paths = {
            str(entry.get("path", ""))
            for entry in entries if isinstance(entry, dict)
        }
        live_files, live_symlinks = live_shard_inventory(root)
        committed_files = {
            relative: live_files[relative]
            for relative in manifest_paths if relative in live_files
        }
        validation_errors = validate_shard(
            session,
            phase,
            manifest_payload=manifest,
            virtual_files=committed_files,
            virtual_symlinks=live_symlinks,
        )
        if validation_errors:
            raise ValueError("append-only shard is not valid before append: " + "; ".join(validation_errors))
        unmanifested = set(live_files) - manifest_paths
        requested = set(relatives)
        if unmanifested - requested:
            raise ValueError(
                "append-only shard contains an unrelated uncommitted artifact: "
                + ", ".join(sorted(unmanifested - requested))
            )
        entry_by_path = {
            str(entry.get("path", "")): entry
            for entry in entries if isinstance(entry, dict)
        }
        new_artifacts: list[tuple[str, bytes, Path]] = []
        for target, (relative, data) in zip(targets, artifacts):
            ensure_safe_parent(root, target)
            if relative in entry_by_path:
                observed = live_files.get(relative)
                entry = entry_by_path[relative]
                if (
                    observed != (data, "0600")
                    or entry.get("sha256") != content_sha(data)
                ):
                    raise ValueError(f"committed CREATE_NEW_ONLY target differs: {relative}")
                continue
            if target.exists() or target.is_symlink():
                try:
                    metadata = target.lstat()
                except OSError as error:
                    raise ValueError(f"uncommitted target is unstable: {relative}") from error
                if (
                    stat.S_ISLNK(metadata.st_mode)
                    or not stat.S_ISREG(metadata.st_mode)
                    or stat.S_IMODE(metadata.st_mode) != 0o600
                    or target.read_bytes() != data
                ):
                    raise ValueError(
                        f"uncommitted target cannot be resumed byte-identically: {relative}"
                    )
            new_artifacts.append((relative, data, target))
        if not new_artifacts:
            return [
                (target, str(entry_by_path[relative]["entryChainSha256"]))
                for target, relative in zip(targets, relatives)
            ]
        prior = str(manifest.get("chainHeadSha256", ""))
        new_entries: list[dict[str, object]] = []
        for offset, (relative, data, _target) in enumerate(new_artifacts, 1):
            entry = make_shard_entry(
                session, len(entries) + offset, relative, data, "0600", prior
            )
            new_entries.append(entry)
            prior = str(entry["entryChainSha256"])
        updated = dict(manifest)
        updated["entries"] = [*entries, *new_entries]
        updated["entryCount"] = len(entries) + len(new_entries)
        updated["chainHeadSha256"] = prior
        prior_manifest = manifest_path.read_bytes()
        created: list[Path] = []
        manifest_committed = False
        try:
            for _relative, data, target in new_artifacts:
                if target.exists():
                    continue
                flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
                if hasattr(os, "O_NOFOLLOW"):
                    flags |= os.O_NOFOLLOW
                descriptor = os.open(target, flags, 0o600)
                created.append(target)
                with os.fdopen(descriptor, "wb") as handle:
                    handle.write(data)
                    handle.flush()
                    os.fsync(handle.fileno())
                fsync_directory(target.parent)
            atomic_write_manifest(manifest_path, updated)
            manifest_committed = True
            post_errors = validate_shard(session, phase)
            if post_errors:
                raise ValueError("post-append shard validation failed: " + "; ".join(post_errors))
        except Exception:
            for target in reversed(created):
                if target.is_file() and not target.is_symlink():
                    target.unlink()
                    fsync_directory(target.parent)
            if manifest_committed:
                restore_descriptor, restore_path = tempfile.mkstemp(
                    prefix=manifest_path.name + ".rollback.", dir=manifest_path.parent
                )
                try:
                    with os.fdopen(restore_descriptor, "wb") as handle:
                        handle.write(prior_manifest)
                        handle.flush()
                        os.fsync(handle.fileno())
                    os.replace(restore_path, manifest_path)
                    fsync_directory(manifest_path.parent)
                finally:
                    if os.path.exists(restore_path):
                        os.unlink(restore_path)
            raise
        chain_by_path = {
            str(entry["path"]): str(entry["entryChainSha256"])
            for entry in [*entries, *new_entries]
        }
        return [
            (target, chain_by_path[relative])
            for target, relative in zip(targets, relatives)
        ]


def copy_new(
    session: str, source: Path, relative: str, phase: str = "g3"
) -> tuple[Path, str]:
    data = read_stable_source(source)
    return append_new_bytes(session, [(relative, data)], phase)[0]


def self_test() -> dict[str, bool]:
    import inspect
    from unittest import mock

    cases: dict[str, bool] = {}
    accepted = resolve_target("HRIS-PER", "checkpoints/receipt.json")
    cases["owned-nested-path-accepted"] = (
        "session-evidence/per/g3/module-evidence" in accepted.as_posix()
    )
    accepted_g4 = resolve_target(
        "HRIS-PER", "slices/base-tfr-per-001/acceptance-evidence.json", "g4"
    )
    cases["owned-g4-path-accepted"] = (
        "session-evidence/per/g4/slices/base-tfr-per-001" in accepted_g4.as_posix()
    )
    cases["g4-writer-shares-control-semaphore"] = (
        HOST_VERIFICATION_SEMAPHORE == "hris-verification"
    )
    valid_lock_environment = {
        "DWP_HRIS_HOST_LOCK_NAME": HOST_VERIFICATION_SEMAPHORE,
        "DWP_HRIS_HOST_LOCK_PARENT_PID": str(os.getpid()),
    }
    with exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE) as _lease:
        capability = active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE)
        cases["private-same-process-g4-parent-lock-proof-accepted"] = (
            _inherited_host_lock_is_valid(
                True,
                capability,
                valid_lock_environment,
                os.getpid(),
                "g4",
            )
        )
        cases["forged-or-g3-parent-lock-proof-rejected"] = (
            not _inherited_host_lock_is_valid(
                True, object(), valid_lock_environment, os.getpid(), "g4"
            )
            and not _inherited_host_lock_is_valid(
                True, capability, valid_lock_environment, os.getpid() + 1, "g4"
            )
            and not _inherited_host_lock_is_valid(
                True, capability, valid_lock_environment, os.getpid(), "g3"
            )
        )
    shard_lock_name = evidence_shard_lock_name("HRIS-HRM", "g3")
    shard_environment = {
        "DWP_HRIS_SHARD_LOCK_NAME": shard_lock_name,
        "DWP_HRIS_SHARD_LOCK_PARENT_PID": str(os.getpid()),
    }
    with exclusive_host_semaphore(shard_lock_name) as _lease:
        shard_capability = active_host_semaphore_capability(shard_lock_name)
        cases["private-same-process-g3-shard-lock-proof-accepted"] = (
            _inherited_shard_lock_is_valid(
                True,
                shard_capability,
                shard_environment,
                os.getpid(),
                "HRIS-HRM",
                "g3",
            )
        )
        cases["forged-or-cross-owner-shard-lock-proof-rejected"] = (
            not _inherited_shard_lock_is_valid(
                True,
                object(),
                shard_environment,
                os.getpid(),
                "HRIS-HRM",
                "g3",
            )
            and not _inherited_shard_lock_is_valid(
                True,
                shard_capability,
                shard_environment,
                os.getpid(),
                "HRIS-PER",
                "g3",
            )
        )
    rejected = 0
    for session, relative in [
        ("HRIS-PER", "../hrm/receipt.json"),
        ("HRIS-PER", "/tmp/receipt.json"),
        ("HRIS-HRM", ".shard-contract.json"),
        ("CONTROL", "receipt.json"),
        ("HRIS-SYS", "receipt.exe"),
    ]:
        try:
            resolve_target(session, relative)
        except ValueError:
            rejected += 1
    cases["escape-reserved-session-and-suffix-rejected"] = rejected == 5
    with tempfile.TemporaryDirectory(prefix="hris-shard-writer-") as temporary:
        root = Path(temporary)
        source = root / "receipt.json"
        source.write_bytes(b'{"status":"PASS"}\n')
        cases["stable-regular-source-read"] = read_stable_source(source).endswith(b"\n")
        link = root / "receipt-link.json"
        link.symlink_to(source)
        try:
            read_stable_source(link)
            cases["source-symlink-rejected"] = False
        except ValueError:
            cases["source-symlink-rejected"] = True
        cases["empty-manifest-seed-is-session-bound"] = (
            empty_shard_manifest("HRIS-HRM")["chainHeadSha256"]
            != empty_shard_manifest("HRIS-PER")["chainHeadSha256"]
        )
        cases["empty-manifest-seed-is-phase-bound"] = (
            empty_shard_manifest("HRIS-HRM", "g3")["chainHeadSha256"]
            != empty_shard_manifest("HRIS-HRM", "g4")["chainHeadSha256"]
        )
        cases["module-submission-remains-untrusted-before-control-anchor"] = (
            empty_shard_manifest("HRIS-HRM")["trustState"]
            == "UNTRUSTED_UNTIL_CONTROL_REPLAY_AND_CHECKPOINT_CAS_APPEND"
        )
    try:
        append_new_bytes(
            "HRIS-HRM",
            [("checkpoints/a.json", b"a"), ("checkpoints/a.json", b"b")],
        )
        cases["duplicate-batch-path-rejected-before-write"] = False
    except ValueError:
        cases["duplicate-batch-path-rejected-before-write"] = True
    try:
        append_new_bytes("HRIS-HRM", [("../escape.json", b"x")])
        cases["unsafe-batch-path-rejected-before-write"] = False
    except ValueError:
        cases["unsafe-batch-path-rejected-before-write"] = True
    cases["single-copy-delegates-to-batch-append"] = (
        "append_new_bytes(" in inspect.getsource(copy_new)
    )
    preflight_source = inspect.getsource(assert_canonical_workspace)
    cases["concurrent-foreign-shard-midpoint-is-outside-scoped-preflight"] = (
        '"--session", session' in preflight_source
        and '"--phase", phase' in preflight_source
        and "validate_blueprint_workspace_boundaries.py" in preflight_source
    )
    with tempfile.TemporaryDirectory(prefix="hris-shard-crash-resume-") as temporary:
        shard = Path(temporary) / "module-evidence"
        shard.mkdir(mode=0o700)
        manifest_path = shard / SHARD_MANIFEST
        atomic_write_manifest(manifest_path, empty_shard_manifest("HRIS-HRM"))
        orphan = shard / "checkpoints/a.json"
        ensure_safe_parent(shard, orphan)
        orphan.write_bytes(b"a")
        orphan.chmod(0o600)
        fsync_directory(orphan.parent)
        with (
            mock.patch.dict(SHARDS, {("HRIS-HRM", "g3"): shard}),
            mock.patch(f"{__name__}.assert_canonical_workspace"),
            mock.patch(f"{__name__}.assert_authoritative_gate_open"),
            mock.patch(f"{__name__}.validate_shard", return_value=[]),
        ):
            result = append_new_bytes(
                "HRIS-HRM",
                [("checkpoints/a.json", b"a"), ("checkpoints/b.json", b"b")],
            )
            resumed_manifest = json.loads(manifest_path.read_text())
            cases["killed-file-before-manifest-batch-resumes-byte-identically"] = (
                len(result) == 2
                and resumed_manifest["entryCount"] == 2
                and (shard / "checkpoints/b.json").read_bytes() == b"b"
            )
            retry = append_new_bytes(
                "HRIS-HRM",
                [("checkpoints/a.json", b"a"), ("checkpoints/b.json", b"b")],
            )
            cases["fully-committed-batch-retry-is-idempotent"] = retry == result

        atomic_write_manifest(manifest_path, empty_shard_manifest("HRIS-HRM"))
        for value in list((shard / "checkpoints").iterdir()):
            value.unlink()
        wrong = shard / "checkpoints/wrong.json"
        wrong.write_bytes(b"wrong")
        wrong.chmod(0o600)
        with (
            mock.patch.dict(SHARDS, {("HRIS-HRM", "g3"): shard}),
            mock.patch(f"{__name__}.assert_canonical_workspace"),
            mock.patch(f"{__name__}.assert_authoritative_gate_open"),
            mock.patch(f"{__name__}.validate_shard", return_value=[]),
        ):
            try:
                append_new_bytes("HRIS-HRM", [("checkpoints/wrong.json", b"expected")])
                cases["byte-different-partial-publication-rejected"] = False
            except ValueError:
                cases["byte-different-partial-publication-rejected"] = True
            try:
                append_new_bytes("HRIS-HRM", [("checkpoints/new.json", b"new")])
                cases["unrelated-orphan-publication-rejected"] = False
            except ValueError:
                cases["unrelated-orphan-publication-rejected"] = True
    writer_source = inspect.getsource(append_new_bytes)
    parent_source = inspect.getsource(ensure_safe_parent)
    cases["data-create-unlink-and-directory-create-are-parent-fsynced"] = (
        writer_source.count("fsync_directory(target.parent)") >= 2
        and "fsync_directory(current.parent)" in parent_source
    )
    main_source = inspect.getsource(main)
    cases["parent-lock-bypass-has-no-public-cli-flag"] = (
        "host-lock-held" not in main_source
        and "shard-lock-held" not in main_source
        and "_host_lock_held_by_parent" not in main_source
        and "_shard_lock_held_by_parent" not in main_source
    )
    append_source = inspect.getsource(append_new_bytes)
    cases["generic-g4-write-without-live-control-capability-is-rejected"] = (
        'if phase == "g4" and not inherited:' in append_source
        and "typed Control builder" in append_source
        and 'if args.phase == "g4":' in main_source
    )
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=sorted(SESSIONS))
    parser.add_argument("--phase", choices=sorted(SHARD_PHASES), default="g3")
    parser.add_argument("--source", type=Path)
    parser.add_argument("--relative-path")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        cases = self_test()
        ok = all(cases.values())
        print(json.dumps({
            "schema": "dwp.hris.module-evidence-shard-writer-self-test.v3",
            "status": "PASS" if ok else "FAIL",
            "caseCount": len(cases),
            "cases": cases,
        }, sort_keys=True, separators=(",", ":")))
        return 0 if ok else 1
    if not args.session or args.source is None or not args.relative_path:
        parser.error("--session, --source and --relative-path are required")
    if args.phase == "g4":
        parser.error("generic CLI publication to G4 is forbidden; use the typed Control builder")
    try:
        target, chain = copy_new(
            args.session, args.source.resolve(), args.relative_path, args.phase
        )
    except (OSError, ValueError) as error:
        print(f"MODULE_EVIDENCE_SHARD_WRITE=FAIL reason={error}")
        return 1
    print(
        "MODULE_EVIDENCE_SHARD_WRITE=PASS "
        f"path={target.relative_to(ROOT)} entryChainSha256={chain}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
