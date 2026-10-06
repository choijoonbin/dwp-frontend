#!/usr/bin/env python3
"""Bounded PAY civil-date real-page replay; stdout receipt only."""
import base64,gzip,hashlib,json,os,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
sys.dont_write_bytecode=True
sys.path.insert(0,"/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0")
from host_semaphore import exclusive_host_semaphore
root=Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
stage=sys.argv[1];assert stage in ("before","after")
names=subprocess.check_output(["git","ls-files","-z","--cached","--others","--exclude-standard"],cwd=root).decode().split("\0")
paths=sorted(set(p for p in names if p and (p.startswith("apps/dwp/src/features/hris/payroll/") or p.startswith("libs/shared-i18n/src/") and p.endswith((".ts",".tsx")) or p in ("libs/shared-utils/src/axios-instance.ts","libs/shared-utils/src/axios-response-lifecycle.test.ts","libs/shared-utils/src/http-error.ts","libs/shared-utils/src/regional-preference.ts","apps/dwp/vitest.config.ts","vitest.config.ts","package.json","yarn.lock","tsconfig.base.json")) and (root/p).is_file()))
def sha(b):return hashlib.sha256(b).hexdigest()
def arc(b):return {"sha256":sha(b),"bytes":len(b),"gzipBase64":base64.b64encode(gzip.compress(b,mtime=0)).decode()}
def snap():return [{"path":p,"sha256":sha((root/p).read_bytes()),"mtimeNs":str((root/p).stat().st_mtime_ns)} for p in paths]
def utc():return datetime.now(timezone.utc).isoformat()
argv=["/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node","node_modules/vitest/vitest.mjs","run","--project","dwp-app","apps/dwp/src/features/hris/payroll/","--maxWorkers=1","--reporter=json"]
with exclusive_host_semaphore("hris-verification",timeout_seconds=30) as lock:
 pre=snap();start=utc();t=time.monotonic()
 try:
  r=subprocess.run(argv,cwd=root,capture_output=True,timeout=60);out=r.stdout;err=r.stderr;code=r.returncode;timedout=False
 except subprocess.TimeoutExpired as e:
  out=e.stdout or b"";err=e.stderr or b"";code=None;timedout=True
 end=utc();duration=time.monotonic()-t;post=snap()
 text=out.decode();offset=text.find('{"numTotalTestSuites"');j=json.loads(text[offset:]) if offset>=0 else {}
 cases=[{"fullName":a["fullName"],"status":a["status"],"failureMessages":a.get("failureMessages",[])} for q in j.get("testResults",[]) for a in q.get("assertionResults",[])]
 counts={k:j.get(k) for k in ["numTotalTests","numPassedTests","numFailedTests","numPendingTests"]}
 expected=(code==1 and counts=={"numTotalTests":59,"numPassedTests":58,"numFailedTests":1,"numPendingTests":0}) if stage=="before" else (code==0 and counts=={"numTotalTests":59,"numPassedTests":59,"numFailedTests":0,"numPendingTests":0})
 selected=["apps/dwp/src/features/hris/payroll/pages/hris-payroll-workspace.tsx","apps/dwp/src/features/hris/payroll/testing/hris-payroll-workspace.runtime.test.tsx","libs/shared-i18n/src/lib/formatters.ts","libs/shared-i18n/src/lib/formatters.test.ts","libs/shared-i18n/src/index.ts"]
 snapshots=arc(json.dumps([{"path":p,"utf8":(root/p).read_text(),"sha256":sha((root/p).read_bytes())} for p in selected]).encode())
receipt={"status":"EXPECTED_REPRO_CONFIRMED" if stage=="before" and expected and pre==post and not timedout else "PASS" if stage=="after" and expected and pre==post and not timedout else "FAIL","stage":stage,"argv":argv,"cwd":str(root),"startedAt":start,"finishedAt":end,"durationSeconds":duration,"exitCode":code,"timeout":timedout,"counts":counts,"caseResults":cases,"preSources":pre,"postSources":post,"sourceStable":pre==post,"selectedSourceSnapshots":snapshots,"stdoutArchive":arc(out),"stderrArchive":arc(err),"hostLock":lock,"limits":{"pageAndNativeIntlJsdomOnly":True,"apiAndAuthorityAreMocks":True,"wholeG3Approved":False}}
print(json.dumps(receipt))
