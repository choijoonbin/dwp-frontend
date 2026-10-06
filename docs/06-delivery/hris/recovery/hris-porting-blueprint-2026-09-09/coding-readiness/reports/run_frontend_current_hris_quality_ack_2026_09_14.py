#!/usr/bin/env python3
"""Current HRIS full TypeScript + original eight and added PER lint; lossless ACK receipt."""
import base64,gzip,hashlib,json,subprocess,sys,time
from datetime import datetime,timezone
from pathlib import Path
sys.dont_write_bytecode=True
reports=Path("/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports")
sys.path.insert(0,str(reports.parent.parent/"g0"))
from host_semaphore import exclusive_host_semaphore
root=Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
prior=json.loads((reports/"frontend-payroll-remediation-quality-after-shared-type-fix-2026-09-14.json").read_text())
commands=[(x["argv"],x["timeoutSeconds"]) for x in prior["results"]]
assert len(commands)==8 and all(a[0].endswith("/node") for a,t in commands)
commands.append((commands[-1][0][:-1]+["apps/dwp/src/features/hris/performance"],commands[-1][1]))
assert commands[-1][0][1].endswith("eslint.js") and commands[-1][0][-1].endswith("/performance")
names=subprocess.check_output(["git","ls-files","-z","--cached","--others","--exclude-standard"],cwd=root).decode().split("\0")
selected=set(x["path"] for x in prior["preSources"])
selected.update(p for p in names if p and (p.startswith("libs/shared-i18n/src/") or p in ("libs/shared-utils/src/axios-cancellation-race.test.ts","libs/shared-utils/src/axios-response-lifecycle.test.ts","libs/shared-utils/src/axios-instance.ts","libs/shared-utils/src/http-error.ts")))
selected.update(p for p in names if p and p.startswith("apps/dwp/src/features/hris/"))
selected.update(a[1] for a,t in commands)
selected.update(("package.json","yarn.lock","tsconfig.base.json","tsconfig.json","eslint.config.mjs"))
paths=sorted(p for p in selected if (root/p).is_file())
def sha(b):return hashlib.sha256(b).hexdigest()
def arc(b):return {"sha256":sha(b),"bytes":len(b),"gzipBase64":base64.b64encode(gzip.compress(b,mtime=0)).decode()}
def snap():return [{"path":p,"sha256":sha((root/p).read_bytes()),"mtimeNs":str((root/p).stat().st_mtime_ns)} for p in paths]
def utc():return datetime.now(timezone.utc).isoformat()
results=[]
with exclusive_host_semaphore("hris-verification",timeout_seconds=30) as lock:
 pre=snap();started=utc()
 for argv,limit in commands:
  start=utc();t=time.monotonic()
  try:
   run=subprocess.run(argv,cwd=root,capture_output=True,timeout=limit)
   out,err,code,timed=run.stdout,run.stderr,run.returncode,False
  except subprocess.TimeoutExpired as e:
   out,err,code,timed=e.stdout or b"",e.stderr or b"",None,True
  results.append({"argv":argv,"timeoutSeconds":limit,"startedAt":start,"finishedAt":utc(),"durationSeconds":time.monotonic()-t,"exitCode":code,"timedOut":timed,"stdoutArchive":arc(out),"stderrArchive":arc(err)})
  print("QUALITY_PROGRESS "+json.dumps({"index":len(results),"exitCode":code,"timedOut":timed}),flush=True)
 post=snap();finished=utc()
receipt={"schema":"dwp.frontend.current-civil-date-root-quality.v1","status":"PASS" if pre==post and all(x["exitCode"]==0 and not x["timedOut"] for x in results) else "FAIL","cwd":str(root),"startedAt":started,"finishedAt":finished,"results":results,"preSources":pre,"postSources":post,"sourceStable":pre==post,"priorCommandsUnchanged":True,"hostLock":lock,"limits":{"selectedHashesNotWholeSourceSemanticApproval":True,"nativeSourceCalls":0,"browserRun":False,"G3Open":False}}
raw=json.dumps(receipt,separators=(",",":")).encode();compressed=gzip.compress(raw,mtime=0);encoded=base64.b64encode(compressed).decode()
chunks=[encoded[i:i+4000] for i in range(0,len(encoded),4000)]
print("ARCHIVE_HEAD "+json.dumps({"status":receipt["status"],"results":[{"argv":x["argv"],"exitCode":x["exitCode"],"timedOut":x["timedOut"]} for x in results],"sourceCount":len(pre),"sourceStable":pre==post,"startedAt":started,"finishedAt":finished,"hostLock":lock,"receiptSha256":sha(raw),"receiptBytes":len(raw),"archiveSha256":sha(compressed),"archiveBytes":len(compressed),"base64Chars":len(encoded),"chunks":len(chunks)}),flush=True)
for index,chunk in enumerate(chunks):
 print(f"CHUNK {index} {chunk}",flush=True)
 if not sys.stdin.readline():raise SystemExit("archive incomplete: acknowledgment missing")
print("ARCHIVE_COMPLETE "+sha(compressed),flush=True)
