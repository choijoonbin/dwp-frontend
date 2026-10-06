#!/usr/bin/env python3
"""Generate or verify the exact Git lineage behind the HRIS code-entry seal."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import subprocess
import tempfile
from pathlib import Path


G0 = Path(__file__).resolve().parent
# Successor allowlists are intentionally exhaustive.  Large repositories can
# exceed Python's conservative 128 KiB CSV-field default, so readers of this
# canonical artifact must opt into a bounded, repository-scale limit.
CSV_FIELD_SIZE_LIMIT = 16 * 1024 * 1024
csv.field_size_limit(max(csv.field_size_limit(), CSV_FIELD_SIZE_LIMIT))
MANIFEST = G0 / "integration-baseline-manifest.csv"
OUTPUT = G0 / "code-entry-baseline-lineage.csv"
HEADER = [
    "lineage_id",
    "repository",
    "characterization_head_sha",
    "characterization_tree_sha",
    "code_entry_head_sha",
    "code_entry_tree_sha",
    "lineage_relation",
    "approved_commit_count",
    "approved_commit_shas",
    "approved_change_count",
    "approved_diff_name_status_sha256",
    "approved_path_allowlist",
    "remote_alignment",
    "lineage_state",
]
SPECS = {
    "DWP_BACKEND": {
        "lineage_id": "LINEAGE-BACKEND",
        "characterization_head_sha": "5670877de7a39e94e75021c7e23cbbb553296c90",
        "characterization_tree_sha": "01f282e67791e1c269128fb79a547ac71148bfac",
        "lineage_relation": "CHARACTERIZATION_PREDECESSOR_PLUS_APPROVED_CONTROL_SCAFFOLD",
    },
    "DWP_FRONTEND": {
        "lineage_id": "LINEAGE-FRONTEND",
        "characterization_head_sha": "7635ce4223000ed83cb4965f8374d8a8433f1a62",
        "characterization_tree_sha": "ddee9ac46c4106c39ca88d91010edd0bdeb219f5",
        "lineage_relation": "CHARACTERIZATION_PREDECESSOR_PLUS_APPROVED_UPSTREAM_AND_CONTROL_SYNC",
    },
}


class LineageError(RuntimeError):
    pass


def run_git(repository: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(repository), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise LineageError(
            f"git {' '.join(arguments)} failed for {repository}: {completed.stdout.strip()}"
        )
    return completed.stdout.rstrip("\n")


def read_manifest(path: Path = MANIFEST) -> dict[str, dict[str, str]]:
    try:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.DictReader(handle))
    except OSError as error:
        raise LineageError(f"cannot read baseline manifest: {error}") from error
    by_repository = {row.get("repository", ""): row for row in rows}
    if len(rows) != 2 or set(by_repository) != set(SPECS):
        raise LineageError("baseline manifest must contain exactly one backend and one frontend row")
    return by_repository


def canonical_diff_digest(lines: list[str]) -> str:
    payload = ("\n".join(lines) + ("\n" if lines else "")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def build_row(repository_name: str, manifest: dict[str, str]) -> dict[str, str]:
    spec = SPECS[repository_name]
    if manifest.get("integration_dirty_count") != "0":
        raise LineageError(f"{repository_name}: manifest does not seal a clean worktree")
    if manifest.get("remote_alignment") != spec["lineage_relation"]:
        raise LineageError(f"{repository_name}: remote-alignment relation drift")

    repository = Path(manifest.get("integration_worktree", ""))
    if not repository.is_absolute() or not repository.is_dir():
        raise LineageError(f"{repository_name}: invalid integration worktree")
    porcelain = run_git(repository, "status", "--porcelain=v1")
    if porcelain:
        raise LineageError(f"{repository_name}: integration worktree is dirty")

    code_head = run_git(repository, "rev-parse", "HEAD")
    code_tree = run_git(repository, "rev-parse", "HEAD^{tree}")
    if code_head != manifest.get("integration_head_sha"):
        raise LineageError(f"{repository_name}: manifest/HEAD mismatch")
    if code_tree != manifest.get("integration_tree_sha"):
        raise LineageError(f"{repository_name}: manifest/tree mismatch")

    characterization_head = spec["characterization_head_sha"]
    characterization_tree = run_git(repository, "rev-parse", f"{characterization_head}^{{tree}}")
    if characterization_tree != spec["characterization_tree_sha"]:
        raise LineageError(f"{repository_name}: characterization tree drift")
    run_git(repository, "merge-base", "--is-ancestor", characterization_head, code_head)

    commits_output = run_git(
        repository, "rev-list", "--reverse", f"{characterization_head}..{code_head}"
    )
    commits = commits_output.splitlines() if commits_output else []
    diff_output = run_git(
        repository,
        "diff",
        "--name-status",
        "--no-renames",
        characterization_head,
        code_head,
    )
    diff_lines = diff_output.splitlines() if diff_output else []
    parsed = [line.split("\t") for line in diff_lines]
    if any(len(parts) != 2 or parts[0] not in {"A", "M", "D"} for parts in parsed):
        raise LineageError(f"{repository_name}: unsupported successor diff operation")
    paths = sorted(parts[1] for parts in parsed)
    if len(paths) != len(set(paths)):
        raise LineageError(f"{repository_name}: duplicate successor diff path")

    return {
        "lineage_id": spec["lineage_id"],
        "repository": repository_name,
        "characterization_head_sha": characterization_head,
        "characterization_tree_sha": characterization_tree,
        "code_entry_head_sha": code_head,
        "code_entry_tree_sha": code_tree,
        "lineage_relation": spec["lineage_relation"],
        "approved_commit_count": str(len(commits)),
        "approved_commit_shas": "|".join(commits),
        "approved_change_count": str(len(diff_lines)),
        "approved_diff_name_status_sha256": canonical_diff_digest(diff_lines),
        "approved_path_allowlist": "|".join(paths),
        "remote_alignment": manifest["remote_alignment"],
        "lineage_state": "VERIFIED_CODE_ENTRY_SEAL",
    }


def render(rows: list[dict[str, str]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def generate(manifest_path: Path = MANIFEST) -> bytes:
    manifest = read_manifest(manifest_path)
    return render([build_row(name, manifest[name]) for name in ("DWP_BACKEND", "DWP_FRONTEND")])


def write_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def self_test() -> list[str]:
    errors: list[str] = []
    if canonical_diff_digest(["A\ta", "M\tb"]) != hashlib.sha256(
        b"A\ta\nM\tb\n"
    ).hexdigest():
        errors.append("newline-terminated diff digest is not canonical")
    sample = [{field: field for field in HEADER}]
    output = render(sample).decode("utf-8")
    with io.StringIO(output) as handle:
        rows = list(csv.DictReader(handle))
    if list(rows[0]) != HEADER or rows[0] != sample[0]:
        errors.append("CSV round-trip/header order drift")
    large_sample = [{field: field for field in HEADER}]
    large_sample[0]["approved_path_allowlist"] = "|".join(
        f"large/path/{index:05d}/{'x' * 96}" for index in range(2048)
    )
    with io.StringIO(render(large_sample).decode("utf-8")) as handle:
        large_rows = list(csv.DictReader(handle))
    if large_rows != large_sample:
        errors.append("repository-scale CSV field round-trip drift")
    if set(SPECS) != {"DWP_BACKEND", "DWP_FRONTEND"}:
        errors.append("repository set drift")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        errors = self_test()
        print(f"CODE_ENTRY_LINEAGE_GENERATOR_SELF_TEST={'PASS' if not errors else 'FAIL'}")
        for error in errors:
            print(f"ERROR: {error}")
        return 0 if not errors else 1

    try:
        generated = generate()
    except LineageError as error:
        print(f"CODE_ENTRY_LINEAGE_GENERATOR=FAIL\nERROR: {error}")
        return 1
    if args.write:
        write_atomic(OUTPUT, generated)
        print(f"CODE_ENTRY_LINEAGE_GENERATOR=PASS mode=write sha256={hashlib.sha256(generated).hexdigest()}")
        return 0
    current = OUTPUT.read_bytes() if OUTPUT.is_file() else b""
    if current != generated:
        print("CODE_ENTRY_LINEAGE_GENERATOR=FAIL\nERROR: code-entry baseline lineage is stale")
        return 1
    print(f"CODE_ENTRY_LINEAGE_GENERATOR=PASS mode=check sha256={hashlib.sha256(generated).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
