#!/usr/bin/env python3
"""Fixed readonly-source/native-test replay; acknowledge stdout chunks, no receipt file writes."""
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
BLUEPRINT = Path('/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09')
ROOT = Path('/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend')
sys.path.insert(0, str(BLUEPRINT / 'g0'))
from host_semaphore import exclusive_host_semaphore

def utc():
    return datetime.now(timezone.utc).isoformat()

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def archive(raw):
    return {'sha256': sha(raw), 'bytes': len(raw),
            'gzipBase64': base64.b64encode(gzip.compress(raw, mtime=0)).decode()}

def source_manifest():
    names = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    selected = sorted(set(p for p in names if p and (('/src/' in p and p.endswith(('.java', '.sql', '.yml', '.yaml'))) or p.endswith(('build.gradle', 'gradle.properties', 'libs.versions.toml')))))
    return [{'path': p, 'sha256': sha((ROOT/p).read_bytes()), 'mtimeNs': str((ROOT/p).stat().st_mtime_ns)} for p in selected if (ROOT/p).is_file()]

people = json.loads((BLUEPRINT/'coding-readiness/reports/native-people-user-role-v3-author-verification-2026-09-14.json').read_text())
core = json.loads((BLUEPRINT/'coding-readiness/reports/runtime-authority-rw-p1-phase-b-author-evidence-2026-09-14.json').read_text())
expected = people['ownFiles'] + [{**p, 'path': str(ROOT/p['path'])} for p in core['finalOwnedSourcePins']]
classes = {
    'dwp-core': ['com.dwp.core.database.authority.RuntimeMetadataAdmissionGuardV1Test', 'com.dwp.core.database.authority.JdbcRuntimeMetadataPoolInspectionV1PostgresTest'],
    'dwp-people-server': ['com.dwp.services.people.hris.identity.v3.NativeHrisUserRolePolicyAdmissionPilotV3Test', 'com.dwp.services.people.hris.identity.v3.NativeHrisUserRolePolicyAdmissionPilotV3PostgresTest', 'com.dwp.services.people.hris.identity.v2.NativeHrisTargetPolicyQueryReaderV2PostgresTest'],
}
argv = ['./gradlew']
for module, targets in classes.items():
    argv += [f':{module}:test', '--rerun']
    for target in targets:
        argv += ['--tests', target]
argv += ['--no-daemon', '--max-workers=1']
env = dict(os.environ)
env.update(JAVA_HOME='/Users/a10697/Library/Java/JavaVirtualMachines/corretto-23.0.2/Contents/Home', DWP_TEST_POSTGRES_IMAGE='postgres:18.4-alpine')
with exclusive_host_semaphore('hris-verification', timeout_seconds=30) as lock:
    pre = source_manifest()
    for item in expected:
        p = Path(item['path'])
        assert sha(p.read_bytes()) == item['sha256'] and str(p.stat().st_mtime_ns) == item['mtimeNs'], 'frozen source differs'
    started = utc()
    monotonic = time.monotonic()
    process = subprocess.Popen(argv, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        out, err = process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try:
            out, err = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            out, err = process.communicate(timeout=5)
    finished = utc()
    duration = time.monotonic()-monotonic
    post = source_manifest()
    xmls = []
    for module, targets in classes.items():
        for target in targets:
            p = ROOT/module/'build/test-results/test'/f'TEST-{target}.xml'
            if not p.is_file():
                xmls.append({'path': str(p), 'missing': True})
                continue
            raw = p.read_bytes()
            tree = ET.fromstring(raw)
            cases = [{'classname': c.get('classname'), 'name': c.get('name'), 'status': 'failure' if c.find('failure') is not None else 'error' if c.find('error') is not None else 'skipped' if c.find('skipped') is not None else 'passed'} for c in tree.findall('testcase')]
            xmls.append({'path': str(p), 'mtimeNs': str(p.stat().st_mtime_ns), 'attributes': dict(tree.attrib), 'cases': cases, 'raw': archive(raw), 'freshAfterStart': p.stat().st_mtime_ns >= int(datetime.fromisoformat(started).timestamp()*1_000_000_000)})
    cases = [c for x in xmls for c in x.get('cases', [])]
    unique = {(c['classname'], c['name']) for c in cases}
    native_ids = sorted(set(re.findall(r'starting:\s*([a-f0-9]{64})', '\n'.join(gzip.decompress(base64.b64decode(x['raw']['gzipBase64'])).decode() for x in xmls if 'raw' in x))))
    inspections = []
    for identifier in native_ids:
        r = subprocess.run(['docker', 'inspect', '--format', '{{.Id}} {{.State.Status}}', identifier], capture_output=True, timeout=15)
        inspections.append({'id': identifier, 'exitCode': r.returncode, 'stdout': r.stdout.decode(), 'stderr': r.stderr.decode()})
receipt = {'status': 'PASS' if process.returncode == 0 and not timed_out and pre == post and len(unique) == len(cases) == 203 and all(c['status']=='passed' for c in cases) and all(x.get('freshAfterStart') for x in xmls) else 'FAIL', 'argv': argv, 'cwd': str(ROOT), 'environment': {'JAVA_HOME': env['JAVA_HOME'], 'DWP_TEST_POSTGRES_IMAGE': env['DWP_TEST_POSTGRES_IMAGE']}, 'startedAt': started, 'finishedAt': finished, 'durationSeconds': duration, 'exitCode': process.returncode, 'timeout': timed_out, 'counts': {'tests': len(cases), 'unique': len(unique), 'failed': sum(c['status']!='passed' for c in cases)}, 'sourceCount': len(pre), 'sourceStable': pre == post, 'preSources': pre, 'postSources': post, 'xmls': xmls, 'stdoutArchive': archive(out), 'stderrArchive': archive(err), 'hostLock': lock, 'ownedContainerInspections': inspections, 'limits': {'nativePeopleAndMetadataOnly': True, 'authGatewayDatesCurrentIssuerExplicitMocks': True, 'wholeG3Approved': False, 'manualContainerStop': 0}}
raw = json.dumps(receipt, separators=(',', ':')).encode()
compressed = gzip.compress(raw, mtime=0)
encoded = base64.b64encode(compressed).decode()
chunks = [encoded[i:i+4000] for i in range(0, len(encoded), 4000)]
print('ARCHIVE_HEAD '+json.dumps({'status': receipt['status'], 'counts': receipt['counts'], 'sourceCount': len(pre), 'sourceStable': pre == post, 'startedAt': started, 'finishedAt': finished, 'durationSeconds': duration, 'hostLock': lock, 'receiptSha256': sha(raw), 'receiptBytes': len(raw), 'archiveSha256': sha(compressed), 'archiveBytes': len(compressed), 'base64Chars': len(encoded), 'chunks': len(chunks)}), flush=True)
for index, chunk in enumerate(chunks):
    print(f'CHUNK {index} {chunk}', flush=True)
    if not sys.stdin.readline():
        raise SystemExit('archive incomplete: acknowledgment missing')
print('ARCHIVE_COMPLETE '+sha(compressed), flush=True)
