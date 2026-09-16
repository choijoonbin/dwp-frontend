# 사용자 화면 디자인 AI 프롬프트

아래 프롬프트는 현재 Stitch 프로젝트에 추가 화면을 요청할 때 사용한다. 기존 디자인 파일의 공통 셸, typography, spacing, color token, sidebar 밀도와 mobile navigation을 그대로 이어야 한다.

## 공통 지시문

```text
DWP 내부 AI 앱 DWAI·ON의 기존 Stitch 프로젝트를 확장하라.
새 브랜드, 새 글로벌 헤더, 새 사이드바, 마케팅 landing page를 만들지 말고
현재 DWAI·ON 화면의 공통 셸과 디자인 토큰을 그대로 사용하라.

DWAI·ON의 제품 약속은 “근거를 확인하고, 권한 안에서, 실제 업무 완료를
증명하는 AI”다. 화려한 AI 효과보다 출처, 범위, 최신성, 권한, 진행 상태,
다음 행동과 복구를 명확히 보여라.

공통 원칙:
- 사용자의 1차 질문과 1차 행동을 화면 상단에서 즉시 이해할 수 있게 한다.
- 대시보드식 카드 나열을 피하고 작업 단계에 맞는 list-detail, workspace,
  inspector, timeline 구조를 사용한다.
- 실제 API가 확인하지 않은 상태를 정상, 실시간, 안전, 완료로 표시하지 않는다.
- AI 답변 완료와 원본 업무 변경 완료를 구분한다.
- 질문 원문을 URL, breadcrumb, audit list에 노출하지 않는다.
- 관리 권한이 없는 사용자의 소스·대화·산출물을 암시하지 않는다.
- source permission은 조회 시점과 행동 직전에 다시 확인한다.
- 실행 가능한 행동은 preview, impact, approval, progress, recovery, receipt를 갖는다.
- loading, empty, partial, stale, permission denied, validation error, service error,
  revision conflict, cancelled, expired 상태를 포함한다.
- 현재 구현, 신규 UI, 신규 API, 운영 조건부 요소를 프레임 주석으로 구분한다.
- 예시 수치에는 “디자인용 가상 데이터”라고 표시한다.
- 1920px, 1440px, 1280px, 768px, 390px, 320px와 200% 확대를 설계한다.
- 초광폭에서는 내부 작업 grid를 최대 1600px까지 유연하게 사용해 과도한 좌우
  빈 여백을 피하고, 읽기 본문만 필요한 폭으로 제한한다.
- 키보드 focus, screen reader label, 44px touch target, reduced motion,
  forced colors를 고려한다.
- 고정된 예시 숫자는 mock data임을 분명히 하고 운영 정상 증거처럼 쓰지 않는다.
```

## U-00. AI 제안 수락에서 행동 검토까지

```text
기존 /dwaion/proposals의 상세 화면에서 제안을 수락한 뒤
/dwaion/actions의 governed action review로 이어지는 연속 화면을 설계하라.

주 사용자: AI가 발견한 업무를 근거와 영향까지 확인한 뒤 실제 행동을 검토하려는 구성원
운영 질문: 이 제안으로 어떤 대상에 어떤 변경이 일어나며 현재도 실행할 수 있는가?
1차 행동: 최신 preview를 확인한 뒤 원본 앱 확정 단계로 인계
화면 archetype: proposal evidence inspector → action preview → handoff receipt

제안 수락은 업무 실행 완료가 아니다. 수락 뒤 proposal ID, action key,
action inputs, evidence reference를 URL에 넣지 말고 one-time opaque launch 또는
서버의 proposal-to-draft 조회로 복원한다.

행동 검토 화면에는 다음을 포함한다.
- 원 제안 제목, 이유, 만료, 근거와 source freshness
- 실제 action type, 대상, 변경 전후 preview, 위험 등급
- 수락 시점과 현재 시점 사이의 권한·원본 version 변화
- 필요한 추가 입력, approval, 원본 앱 최종 확정 위치
- 적용 policy, idempotency command, 예상 결과와 취소·보상 가능 여부

문맥 복원 실패 시 일반 action catalog로 조용히 보내지 않는다. 제안은 수락됐지만
행동 초안을 복원하지 못했다는 상태, 다시 불러오기, 제안으로 돌아가기,
지원용 correlation ID를 제공한다.

필수 상태 프레임: 수락 직후, draft 복원 중, source 재검증, 입력 부족,
권한 변경, proposal 만료, stale target version, preview pass/review/block,
원본 앱 인계, 실행 접수, 실제 완료 receipt, 부분 실패, 복구.
```

## U-01. 보안형 파일·멀티모달 질문

```text
기존 /dwaion/new “새 대화” 화면을 확장한 데스크톱과 모바일 프레임을 설계하라.

주 사용자: 자신의 권한 범위에서 업무 자료를 질문하려는 일반 구성원
운영 질문: 어떤 자료를 어떤 범위와 보존 조건으로 AI에게 분석시킬 것인가?
1차 행동: 파일과 소스를 확인한 뒤 질문 시작
화면 archetype: 집중형 conversation workspace + 입력 하단 attachment tray

기존 텍스트 입력, source chip, 검토형 음성 입력을 유지한다. 첨부 버튼에서
PDF, DOCX, XLSX/CSV, PNG/JPG를 선택할 수 있지만 다음 단계가 보이게 한다.

1. 업로드 전
   - 허용 형식, 파일별/전체 크기, 보존 기간, 원본 저장 여부
   - 현재 선택한 업무 소스와 첨부 파일을 구분
2. 검사 중
   - upload, malware scan, DLP/classification, parsing, indexing을 단계별 표시
   - 취소 가능, 다른 질문 입력은 보존
3. 검사 결과
   - 준비됨, 검토 필요, 차단됨, parser 부분 실패, 암호 파일, 중복 파일
   - 민감도, 보존 만료, 표·시트·이미지 OCR 가능 여부
4. 질문 후
   - 문장별 인용에서 파일명, page, sheet, cell/range, image region으로 이동
   - 오래된 버전 또는 접근권한 변경 시 인용을 회색 처리하고 재검증 제공

파일 검사 실패를 단순 toast로 끝내지 말고 해당 파일 행에서 원인과 가능한
다음 행동을 제시한다. 차단된 파일을 제외하고 계속할 때 실제 분석 범위가
달라진다는 확인을 받는다. 파일 내용이나 민감정보를 오류 메시지에 노출하지 않는다.

필수 상태 프레임: 빈 composer, 여러 파일 검사 중, DLP 검토 필요, 한 파일 차단,
부분 parsing, 질문 실행 중, 인용 열기, 보존 만료 예정, 403, 413, 422, 503.
```

## U-02. Deep Research

```text
기존 /dwaion/new 안의 “깊은 조사” 모드와 /dwaion/activity의 장기 실행 상세를
하나의 연속 사용자 여정으로 설계하라. 새 상위 메뉴는 만들지 않는다.

주 사용자: 여러 사내 소스와 첨부 자료를 비교해 검토 가능한 보고서가 필요한 구성원
운영 질문: 어떤 질문을 어떤 소스·한도·산출물로 조사하고 현재 어디까지 확인했는가?
1차 행동: 조사 계획 검토 후 시작
화면 archetype: 계획 builder → live execution timeline → evidence report workspace

시작 전 화면:
- 연구 목표와 성공 조건
- 허용 source와 제외 source
- 기간·지역·조직 범위
- 최대 실행 시간과 비용 범위
- 산출물 형식: 요약, 비교표, 의사결정 메모, 업무 계획
- 쓰기 행동 없음이 기본이며, 결과로 제안을 만들 때 별도 검토
- 예상 접근 불가 source와 coverage 한계

실행 중 화면:
- 계획 단계와 현재 단계, 완료/진행/대기/부분 실패
- 발견한 source 수보다 실제 검증 범위와 freshness를 우선
- 진행 중 질문 범위 수정, 일시중지, 재개, 취소
- source별 권한 변경, rate limit, parser 실패를 숨기지 않음
- 장시간 화면을 떠나도 /dwaion/activity에서 계속 확인

완료 화면:
- 결론, 확인된 사실, 불확실성, 반대 근거, 빠진 source
- 문장·표 행과 원본 인용 연결
- 조사 plan version, 사용한 정책·모델 route, 시작/종료 시각
- “산출물로 저장”, “AI 제안 만들기”, “추가 조사” 행동
- 산출물 저장은 immutable version과 preflight 후 receipt 표시

필수 상태 프레임: 계획 초안, 범위 경고, 승인 대기, 실행 중, pause, cancel 확인,
부분 완료, budget/time limit 도달, source 권한 변경, 서비스 복구 후 resume,
완료, 완료했지만 근거 부족, 산출물 저장 충돌.
```

## U-03. 실제 실행 가능한 내 AI 루틴

```text
기존 /dwaion/routines와 /dwaion/activity를 확장하라.

주 사용자: 반복 확인을 자동화하되 변경은 통제하려는 구성원
운영 질문: 언제 무엇을 확인하고, 어떤 결과를 제안으로 받을지, 실패 시 어떻게 멈출까?
1차 행동: dry-run 결과를 검토하고 루틴 활성화
화면 archetype: routine list-detail + versioned editor + run timeline

루틴 editor에는 다음을 포함한다.
- 시간 schedule 또는 승인된 event trigger
- timezone, active window, quiet hours, 만료일
- source 범위와 Agent
- 결과 전달: AI 제안함, 알림, 산출물
- action 수준: 조사만 / 제안 생성 / 승인된 저위험 행동
- 실행당·일·월 budget과 최대 반복 횟수
- 실패 시 retry, backoff, 중단, 담당자 알림, 보상 정책
- 현재 version과 적용 예정 version

활성화 전 dry-run은 사용할 source, 예상 action, 권한 판정, 비용 범위,
예상 알림을 보여준다. 실제 변경을 수행하지 않는다. 활성화·수정·일시중지·재개는
expectedVersion, 사유, receipt를 가진다.

실행 상세는 scheduled, leased, running, waiting approval, retrying, compensating,
completed, partial, failed, cancelled, expired를 구분한다. 완료 상태에는 원본 시스템의
실제 결과와 receipt가 있어야 한다. 중복 trigger가 합쳐졌다면 이유를 보여준다.

필수 상태 프레임: 첫 루틴, dry-run pass/review/block, 승인 대기, 예약됨,
quiet hours 보류, 권한 만료, budget 초과, retry, 부분 성공, compensation,
중복 억제, pause, archive, version conflict.
```

## U-04. 팀 산출물과 검토

```text
기존 /dwaion/artifacts 안에 “내 산출물 / 팀 작업공간 / 검토 요청” 탭을 추가하라.
별도 프로젝트 상위 메뉴는 만들지 않는다.

주 사용자: AI 결과를 동료와 검토하고 승인된 버전으로 배포하려는 작성자와 검토자
운영 질문: 어떤 버전이 어떤 근거와 권한으로 누구에게 검토·공유되고 있는가?
1차 행동: 검토 요청 또는 승인·수정 요청
화면 archetype: artifact list + collaborative editor + evidence/review inspector

다음 계약을 시각화한다.
- 개인 초안에서 팀 작업공간으로 전환할 때 공유 대상과 source 권한 preflight
- owner, editor, reviewer, viewer 역할
- presence는 실제 협업 세션이 연결됐을 때만 표시
- autosave와 revision conflict, 읽기 전용 fallback
- immutable version, source references, freshness, DLP finding
- 검토 의견, 수정 요청, 승인, 승인 취소, 만료
- 외부 공유는 기본 차단, 예외 승인과 기간 제한
- 구성원 권한이 바뀌면 기존 인용·다운로드·export를 재검증

공동 편집 장식보다 현재 저장 상태, 충돌 해결, 검토 대상 version과 배포 가능 여부를
우선한다. 개인 질문 원문을 팀 공간으로 자동 복제하지 않는다.

필수 상태 프레임: 개인 초안, 팀 전환 preflight, 일부 수신자 권한 부족,
동시 편집 충돌, 검토 대기, 수정 요청, 승인, DLP 차단, 공유 만료,
접근 철회, export worker 실패, 검증된 파일 완료.
```

## U-05. 개인 memory와 삭제 증거

```text
기존 /dwaion/personal-controls를 확장하라.

주 사용자: AI가 기억하고 사용하는 자신의 정보를 직접 통제하려는 구성원
운영 질문: 어떤 정보가 왜 기억되었고 어디에 적용되며 언제 삭제되는가?
1차 행동: memory 수정·만료·삭제 또는 source 사용 중지
화면 archetype: privacy control center + item inspector + deletion timeline

각 memory에 생성 방식, 원본 source, 생성 시각, 적용 범위, 민감도, 만료일,
최근 사용 시각을 표시한다. 명시적 사용자 저장과 시스템이 제안한 memory를 구분한다.
사용자는 수정, 일시 비활성화, 범위 축소, 만료 설정, 삭제를 선택할 수 있다.

삭제는 요청 접수, 신규 사용 차단, 주 저장소 삭제, 파생 index 삭제,
backup 정책 반영, 완료/부분/실패 영수증으로 보여준다. UI 삭제와 물리 삭제를
같은 완료로 표시하지 않는다. 법적 보존으로 삭제할 수 없다면 범위와 해제 조건을 설명한다.

필수 상태 프레임: 빈 memory, 여러 source에서 파생, source 접근 철회,
삭제 요청, 삭제 진행, 일부 시스템 지연, legal hold, 완료 receipt, 403/503.
```
