import base64,gzip,hashlib,json,os,subprocess,sys,time,signal
from pathlib import Path
from datetime import datetime,timezone
import xml.etree.ElementTree as ET
sys.dont_write_bytecode=True
ROOT=Path('/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend')
sys.path.insert(0,'/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0')
from host_semaphore import exclusive_host_semaphore
def utc():return datetime.now(timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
def archive(b):return dict(sha256=sha(b),bytes=len(b),gzipBase64=base64.b64encode(gzip.compress(b,mtime=0)).decode())
def manifest():
    names=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=ROOT).decode().split('\0')
    names=sorted(set(p for p in names if p and (('/src/' in p and p.endswith(('.java','.sql','.yaml','.yml'))) or p.endswith(('build.gradle','gradle.properties','libs.versions.toml')))))
    return [dict(path=p,sha256=sha((ROOT/p).read_bytes()),mtimeNs=str((ROOT/p).stat().st_mtime_ns),bytes=(ROOT/p).stat().st_size) for p in names if (ROOT/p).is_file()]
classes=["com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1PostgresTest"]
argv=['./gradlew',':dwp-auth-server:test','--rerun']
for c in classes:argv+=['--tests',c]
argv+=['--no-daemon','--max-workers=1']
env=dict(os.environ);env.update(JAVA_HOME='/Users/a10697/Library/Java/JavaVirtualMachines/corretto-23.0.2/Contents/Home',DWP_TEST_POSTGRES_IMAGE='postgres:16-alpine')
start=utc();before=None;post=None;xmls=[];out=b'';err=b'';lock=None;timed=False;exit_code=None;duration=0
try:
  with exclusive_host_semaphore('hris-verification',timeout_seconds=30) as lock:
    before=manifest();pre_status=subprocess.check_output(['git','status','--porcelain=v1'],cwd=ROOT).decode()
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
    start=utc();mono=time.monotonic();start_ns=time.time_ns();start_seconds=int(start_ns/1000000000)
    p=subprocess.Popen(argv,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:out,err=p.communicate(timeout=120)
    except subprocess.TimeoutExpired:
      timed=True;os.killpg(p.pid,signal.SIGTERM)
      try:out,err=p.communicate(timeout=5)
      except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);out,err=p.communicate(timeout=5)
    end=utc();duration=time.monotonic()-mono;exit_code=p.returncode;post=manifest()
    post_status=subprocess.check_output(['git','status','--porcelain=v1'],cwd=ROOT).decode()
    for c in classes:
      f=ROOT/'dwp-auth-server/build/test-results/test'/('TEST-'+c+'.xml')
      if not f.is_file():xmls.append(dict(path=str(f),missing=True));continue
      raw=f.read_bytes();tree=ET.fromstring(raw)
      cases=[dict(classname=x.get('classname'),name=x.get('name'),status='failure' if x.find('failure') is not None else 'error' if x.find('error') is not None else 'skipped' if x.find('skipped') is not None else 'passed') for x in tree.findall('testcase')]
      xmls.append(dict(path=str(f),mtimeNs=str(f.stat().st_mtime_ns),freshAfterStart=f.stat().st_mtime_ns>=start_ns,attributes=dict(tree.attrib),cases=cases,raw=archive(raw)))
    containers=subprocess.run(['docker','ps','--format','{{.ID}} {{.Names}} {{.Status}}'],capture_output=True,timeout=15)
    docker_events=subprocess.run(['docker','events','--since',str(start_seconds),'--until',str(int(time.time())+1),'--filter','type=container','--format','{{json .}}'],capture_output=True,timeout=15)
except Exception as failure:
  end=utc();err+=('HARNESS_FAILURE '+type(failure).__name__).encode()
  pre_status=locals().get('pre_status','');post_status=locals().get('post_status','');head=locals().get('head','')
cases=[x for s in xmls for x in s.get('cases',[])]
unique={(x['classname'],x['name']) for x in cases}
result='PASS' if exit_code==0 and not timed and before==post and len(cases)>0 and len(cases)==len(unique) and all(x['status']=='passed' for x in cases) and len(xmls)==len(classes) and all(s.get('freshAfterStart') for s in xmls) else 'FAIL'
receipt=dict(schema='dwp.hris.workforce-s1-author-run.v1',boundary='AUTHOR_ONLY_READ_NOT_COMMAND_NATIVE_TEST_ONLY',status=result,argv=argv,classes=classes,cwd=str(ROOT),head=head,startedAt=start,finishedAt=end,durationSeconds=duration,exitCode=exit_code,timeout=timed,hostLock=lock,environment=dict(JAVA_HOME=env['JAVA_HOME'],DWP_TEST_POSTGRES_IMAGE=env['DWP_TEST_POSTGRES_IMAGE']),sourceCount=len(before or []),sourceStable=before==post,preSources=before,postSources=post,preGitStatus=pre_status,postGitStatus=post_status,xmls=xmls,counts=dict(tests=len(cases),unique=len(unique),failure=sum(x['status']=='failure' for x in cases),error=sum(x['status']=='error' for x in cases),skipped=sum(x['status']=='skipped' for x in cases)),stdoutArchive=archive(out),stderrArchive=archive(err),dockerPost=dict(exitCode=containers.returncode,stdout=containers.stdout.decode(),stderr=containers.stderr.decode()) if 'containers' in locals() else None,dockerEvents=archive(docker_events.stdout) if 'docker_events' in locals() else None,wholeG3Approved=False,manualServerOrContainerStop=0)
raw=json.dumps(receipt,separators=(',',':')).encode();z=gzip.compress(raw,mtime=0);encoded=base64.b64encode(z).decode()
chunks=[encoded[i:i+12000] for i in range(0,len(encoded),12000)]
print('ARCHIVE_HEAD '+json.dumps({k:receipt[k] for k in ['status','counts','sourceCount','sourceStable','startedAt','finishedAt','durationSeconds','exitCode','timeout','hostLock']}|dict(receiptSha256=sha(raw),receiptBytes=len(raw),archiveSha256=sha(z),archiveBytes=len(z),chunks=len(chunks))),flush=True)
for i,c in enumerate(chunks):
 print('CHUNK '+str(i)+' '+c,flush=True)
 if not sys.stdin.readline():raise SystemExit('ARCHIVE_INCOMPLETE missing ACK')
print('ARCHIVE_COMPLETE '+sha(z),flush=True)

