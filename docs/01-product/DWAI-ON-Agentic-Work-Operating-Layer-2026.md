# DWAI·ON Agentic Work Operating Layer 2026

- 상태: 제품·아키텍처 정본
- 기준일: 2026-08-27
- 적용 범위: DWP Frontend, Agent Control Plane, Gateway 및 도메인 앱 연계
- 이전 호환: `/ask`는 호환 진입점으로만 유지하고 정본 경험은 `/dwaion/*`에서 제공한다.

## 1. 제품 정의

DWAI·ON은 대화형 검색창이 아니다. DWP의 사람, 조직 지식, 서비스, 정책과 업무 행동을 안전하게 연결하는 **Agentic Work Operating Layer**다.

사용자는 자연어와 음성으로 의도를 표현하고, DWAI·ON은 다음을 수행한다.

1. 현재 사용자·테넌트·앱 맥락을 해석한다.
2. 권한 범위 안에서 근거를 검색하고 출처를 제시한다.
3. 실행 가능한 작업은 계획, 영향 범위, 위험도를 먼저 보여준다.
4. 도메인 앱으로 안전하게 인계하거나 승인을 거쳐 실행한다.
5. 실행 결과와 정책 판정을 사용자가 다시 확인할 수 있게 남긴다.

핵심 약속은 **답변보다 업무 완결성**, **자동화보다 통제 가능한 자율성**, **화려함보다 근거와 신뢰**다.

## 2. 하나의 제품, 세 가지 표면

| 표면                     | 목적                              | 핵심 경험                                                        |
| ------------------------ | --------------------------------- | ---------------------------------------------------------------- |
| 글로벌 플로팅 어시스턴트 | 현재 화면을 떠나지 않는 빠른 도움 | 맥락 질문, 추천 프롬프트, 가이드, 담당자, 서비스 상태            |
| DWAI·ON 전체 앱          | 깊은 탐색과 복합 업무             | 새 작업, 대화, AI 제안함, 실행 이력, 에이전트, 행동, 향후 산출물 |
| 관리·통제 표면           | 운영자 거버넌스                   | Agent, Source, Action, Safety, Evaluation, Gate, Audit           |

플로팅 어시스턴트와 전체 앱은 서로 다른 AI가 아니다. 동일한 정책, 실행 ID, 대화, 감사 증거를 공유하는 두 개의 UX 표면이다.

음성도 별도 앱이 아니다. 키보드, 클릭과 동등한 입력·출력 채널이다.

## 3. 현재 제공 계약

### 3.1 안전하게 제공되는 기능

- 권한과 테넌트 범위가 적용된 근거 기반 질문
- 출처와 정책 경계를 포함한 답변
- 대화 이력과 후속 질문
- Action 계획 미리보기와 원본 앱 인계
- 운영 Gate, 실행 예산, 위임 신원, 감사 증거
- 사용자 본인의 실제 Agent 실행 이력
- 실제 Agent 제안의 사용자별 받은함, 근거 확인, 수락·미루기·해제 수명주기
- 짧은 음성 녹음의 STT 변환 후 **사용자 검토를 거친 전송**
- 답변의 요청 기반 TTS 재생

### 3.2 의도적으로 제공하지 않는 기능

- 항상 듣는 웨이크워드나 백그라운드 녹음
- 음성만으로 결재·삭제·권한 변경을 확정하는 기능
- 권한 검증 없이 Agent가 도메인 DB를 직접 변경하는 기능
- 실제 런타임이나 데이터 모델이 없는 가짜 자동화·산출물 카드
- 모델의 추론 문장을 승인 증거나 감사 로그로 사용하는 기능

## 4. 사용자 정보 구조

### 현재

1. **홈**: 가능한 업무와 최근 맥락을 요약한다.
2. **새 작업**: 텍스트 또는 음성으로 의도를 입력한다.
3. **대화**: 근거와 후속 맥락을 이어간다.
4. **실행 이력**: 실제 Agent 실행 상태, 위험도, 정책, 소스, 소요 시간을 확인한다.
5. **AI 제안함**: Agent가 먼저 제안한 업무의 이유와 근거를 확인하고 수락·미루기·해제를 결정한다.
6. **에이전트**: 사용 가능한 전문 Agent와 책임 범위를 탐색한다.
7. **행동**: 사용자가 가진 도메인 권한 안에서 가능한 작업을 확인한다.

### P1 이후

1. **산출물**: 보고서, 초안, 비교표, 계획 등 장기 작업 결과를 관리한다.
2. **자동화**: 사용자가 동의한 반복 업무를 일정, 조건, 예산과 함께 관리한다.
3. **메모리**: 개인·팀 선호를 명시적으로 확인하고 수정·삭제한다.

### 4.1 AI 제안함 운영 계약

- 제안 생성은 `ADMIN.DWAION_OPERATIONS:MANAGE` 또는 상위 DWAI·ON 관리 권한이 있는 TENANT
  생산자만 수행한다.
- 제안 제목·요약·근거·초안 입력과 운영 사유는 DWP2 envelope로 암호화하며 목록 조회는 어떤
  행도 생성·변경하지 않는다.
- `tenant + target user + source event`로 중복 생성을 차단하고 모든 결정은 command UUID 멱등성과
  `expectedRevision` 사전조건을 강제한다.
- 만료와 미루기 종료는 조회 시 투영하고, 원본 상태를 조용히 쓰지 않는다.
- 생성·수락·미루기·해제는 별도 append-only 이벤트 원장에 기록한다.
- 제안 수락은 업무 실행이 아니다. Action이 있더라도 기존 Action Catalog와 담당 앱의 최종 검토
  단계로 이동하며 현재 권한·정책·운영 Gate를 다시 확인한다.
- 사용자의 업무 신호 분석 허용 설정을 확인하고 사용자가 `지금 분석`을 누른 경우에만 현재 세션과
  권한에 결속된 Context Broker 원본을 조회한다. 원본 일부가 실패하면 이를 영수증에 표시하고
  추정으로 채우지 않는다.
- 분석 명령은 세션·언어·사용자에 결속된 command UUID, generation lease, 암호화 결과 영수증으로
  중복·병렬·stale worker를 차단한다. 제안 데이터 비우기는 진행 중 lease와 replay 영수증까지 함께
  폐기하지만 담당 앱의 원본 기록은 변경하지 않는다.

## 5. 음성 경험 계약

### P0 상태 모델

`idle -> permission -> recording -> transcribing -> review -> submit`

- 녹음 시작은 명시적인 버튼 동작으로만 가능하다.
- 브라우저 마이크 권한 거절은 텍스트 입력을 막지 않는다.
- 녹음은 45초, 4MB로 제한하고 서버는 허용된 미디어 타입만 받는다.
- 원본 음성은 일시적으로만 전달하고 DWP 저장소에 보관하지 않는다.
- STT 결과는 입력창에 채우되 자동 전송하지 않는다.
- 사용자가 텍스트를 검토·수정한 뒤 기존 전송 버튼으로 요청한다.
- TTS는 사용자가 재생을 누른 답변만 생성하며 자동 재생하지 않는다.
- 재생 중지, 상태 안내, 키보드 조작, 접근 가능한 이름을 제공한다.

### P2 실시간 음성 조건

실시간 speech-to-speech는 단순 STT/TTS 대체가 아니다. 다음 조건이 모두 충족된 뒤 도입한다.

- 짧은 세션 토큰과 WebRTC 기반 연결
- 음성 활동 감지, 끼어들기, 자막, 명시적 음소거
- 도구 호출 전 시각적 계획과 위험 확인
- L2 이상 행동의 화면 기반 승인
- 세션 비용·시간 예산과 중단 가능성
- 개인정보 처리 고지와 관리자 정책

## 6. 참조 아키텍처

```text
Web surfaces
  -> DWP Gateway / delegated user identity
    -> DWAI·ON Agent Control Plane
      -> intent and context router
      -> knowledge retrieval and citations
      -> plan validator and policy decision
      -> bounded execution runtime
        -> domain application PEP
          -> domain service / outbox / audit receipt
```

### 책임 경계

- **Gateway**: 로그인 세션, 테넌트·사용자 위임 신원, 외부 API 경계
- **Agent Control Plane**: 계획, 모델 라우팅, 실행 상태, 운영 Gate, 평가
- **Policy Decision**: 위험도, 권한, 승인, 데이터 사용 정책 판정
- **도메인 앱 PEP**: 캘린더, 메일, 결재 등 최종 명령 재검증과 변경
- **증거 계층**: plan hash, correlation ID, 정책 판정, handoff, 결과 receipt

Agent가 가진 권한은 사용자의 권한을 확대하지 않는다. 최종 변경은 항상 도메인 앱이 자신의 권한·사전조건·멱등성 규칙으로 다시 검증한다.

## 7. 위험과 승인 모델

| 수준         | 예시                            | UX 계약                                  |
| ------------ | ------------------------------- | ---------------------------------------- |
| L0 조회      | 정책 검색, 일정 조회            | 즉시 실행, 근거 표시                     |
| L1 낮은 영향 | 개인 초안, 검색 조건 저장       | 결과 미리보기와 실행 취소                |
| L2 외부 영향 | 메일 전송, 일정 초대            | 계획·대상·영향 확인 후 명시 승인         |
| L3 고위험    | 결재 확정, 권한 변경, 대량 변경 | 강한 재인증, 분리된 승인, 도메인 앱 확정 |

음성은 L0·L1 요청 입력에 사용할 수 있지만 L2·L3의 최종 승인을 대체하지 않는다.

## 8. 단계별 로드맵

### P0: 신뢰 가능한 기반

- [x] 조회·행동 운영 Gate와 fail-closed 기동
- [x] 위임 신원과 테넌트·사용자 경계
- [x] 실행 시간·동시성 예산
- [x] lease fencing과 stale worker 차단
- [x] one-time 질문 launch
- [x] Action handoff provenance
- [x] 사용자 실제 실행 이력
- [x] 검토형 STT와 요청형 TTS
- [x] OpenAPI 정본과 Frontend 생성 타입

### P1: 업무 완결성

- [x] 암호화·사용자 격리·감사·멱등성을 갖춘 Agent Inbox와 제안 수명주기
- [x] 사용자 명시 요청 기반 권한 결속 업무 신호 분석, 부분 실패 영수증, 즉시 비활성·삭제
- [ ] 장기 실행·재시도를 위한 durable workflow engine
- [ ] 산출물 workspace와 버전·공유·승인
- [ ] 도메인 이벤트, 결과 receipt, 취소·보상 계약
- [ ] 정책 엔진 분리와 정책 시뮬레이션
- [ ] 사용자 메모리 동의·조회·수정·삭제

### P2: 개방형 Agent 플랫폼

- [ ] MCP 기반 도구·데이터 커넥터 등록과 OAuth audience binding
- [ ] A2A 기반 Agent 발견·위임·상태 교환
- [ ] Agent Studio, 버전, 평가, 배포, 롤백
- [ ] 실시간 음성, 자막, 끼어들기, 다국어
- [ ] 팀 단위 Agent와 협업 산출물

### P3: 통제된 자율 운영

- [ ] 이벤트 기반 선제 제안과 사용자별 자동화
- [ ] 실행 예산, 업무 시간, 중단 조건을 포함한 자율 정책
- [ ] 운영 품질·비용·편향·실패를 연결한 통합 관측
- [ ] 산업별 Agent pack과 테넌트 배포 카탈로그

## 9. 출시 Gate

다음 중 하나라도 충족하지 못하면 기능을 켜지 않는다.

- 권한 행렬·테넌트 격리·위임 신원·음성 경계 테스트
- 동일 명령 재전송에 대한 멱등성과 사전조건
- stale worker가 결과나 대화에 영향을 주지 않는 경쟁 테스트
- 실행 실패·취소·타임아웃의 사용자 가시성
- 원본 음성 비저장과 로그 민감정보 검사
- 키보드, 스크린리더 이름, 상태 안내, reduced motion 검증
- OpenAPI snapshot, generated frontend type, 전체 테스트·빌드·E2E

## 10. 보수적 현재 평가

| 영역             | 등급 | 판단                                                            |
| ---------------- | ---- | --------------------------------------------------------------- |
| 조회 신뢰성·근거 | B    | 근거·Gate·감사 기반은 갖췄지만 품질 평가 확장이 필요하다.       |
| 행동 안전성      | B-   | 계획·handoff는 강하지만 광범위한 도메인 receipt·보상은 P1이다.  |
| 사용자 경험      | B-   | 글로벌/전체 표면, 음성 P0와 제안함은 갖췄으나 Artifact가 없다.  |
| 플랫폼 확장성    | C+   | Agent·Source·Action 개념은 있으나 MCP/A2A/Studio가 미완성이다.  |
| 자율성           | C    | 현재는 통제된 요청형 실행이며 선제적·지속형 실행은 아직 아니다. |

따라서 현재 제품은 **Governed Agentic Assistant + Proactive Inbox** 단계다. 완성형 Agentic Work
OS라는 표현은 durable workflow, 산출물, 도메인 결과 receipt, 정책 시뮬레이션과 사용자 메모리까지
닫은 뒤 사용한다.

## 11. 공식 근거

- [Microsoft 365 Copilot Agents overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agents-overview)
- [Google Gemini Enterprise Agents](https://cloud.google.com/gemini-enterprise/agents)
- [Agent2Agent Protocol specification](https://a2a-protocol.org/dev/specification/)
- [Model Context Protocol authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [OpenAI Realtime and audio](https://developers.openai.com/api/docs/guides/realtime)
- [Temporal durable execution](https://docs.temporal.io/temporal)
- [Open Policy Agent](https://www.openpolicyagent.org/docs)
- [W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
