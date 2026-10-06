#!/usr/bin/env python3
"""Run an ACK-streaming evidence producer and persist its lossless envelope."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True

if len(sys.argv) < 4 or sys.argv[2] != "--":
    raise SystemExit("usage: capture_ack_envelope.py OUTPUT -- COMMAND [ARG ...]")

output = Path(sys.argv[1])
argv = sys.argv[3:]
process = subprocess.Popen(
    argv,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1,
)
if process.stdin is None or process.stdout is None or process.stderr is None:
    raise SystemExit("failed to open acknowledgment streams")

head = None
chunks: dict[int, str] = {}
archive_complete = None
for line in process.stdout:
    stripped = line.rstrip("\n")
    if stripped.startswith("ARCHIVE_HEAD "):
        head = json.loads(stripped.removeprefix("ARCHIVE_HEAD "))
    elif stripped.startswith("CHUNK "):
        _, raw_index, chunk = stripped.split(" ", 2)
        index = int(raw_index)
        if index in chunks:
            raise SystemExit(f"duplicate archive chunk: {index}")
        chunks[index] = chunk
        process.stdin.write("ACK\n")
        process.stdin.flush()
    elif stripped.startswith("ARCHIVE_COMPLETE "):
        archive_complete = stripped.removeprefix("ARCHIVE_COMPLETE ")

process.stdin.close()
stderr = process.stderr.read()
exit_code = process.wait()
if exit_code != 0:
    raise SystemExit(f"evidence producer failed ({exit_code}): {stderr}")
if stderr:
    raise SystemExit(f"evidence producer emitted stderr: {stderr}")
if not isinstance(head, dict):
    raise SystemExit("archive head missing")
expected_indices = list(range(int(head["chunks"])))
if sorted(chunks) != expected_indices:
    raise SystemExit("archive acknowledgment sequence is incomplete")
archive_base64 = "".join(chunks[index] for index in expected_indices)
if len(archive_base64) != head["base64Chars"]:
    raise SystemExit("archive base64 length mismatch")
archive_bytes = __import__("base64").b64decode(archive_base64)
if len(archive_bytes) != head["archiveBytes"]:
    raise SystemExit("archive byte length mismatch")
archive_sha = hashlib.sha256(archive_bytes).hexdigest()
if archive_sha != head["archiveSha256"] or archive_sha != archive_complete:
    raise SystemExit("archive digest mismatch")
raw = __import__("gzip").decompress(archive_bytes)
if len(raw) != head["receiptBytes"] or hashlib.sha256(raw).hexdigest() != head["receiptSha256"]:
    raise SystemExit("receipt digest mismatch")

envelope = {
    "head": head,
    "archiveGzipBase64": archive_base64,
    "chunkIndices": expected_indices,
    "archiveComplete": archive_complete,
    "deliveryExitCode": exit_code,
}
output.write_text(json.dumps(envelope, indent=2, ensure_ascii=False) + "\n")
print(
    json.dumps(
        {
            "output": str(output),
            "status": head.get("status"),
            "receiptSha256": head["receiptSha256"],
            "archiveSha256": archive_sha,
            "acknowledgedChunks": len(expected_indices),
            "deliveryExitCode": exit_code,
        }
    )
)
