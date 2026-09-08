# Services 소유 앱 보완 제출 최종 검증

통합업무함에서 서비스 요청 원본으로 이동한 사용자가 요청된 정보를 보완하고, 검토 후 제출하여 서비스 담당자의 처리 재개까지 확인하는 흐름을 검증했다. Work는 업무 요약과 원본 이동을 맡고, Services가 보완 입력·검토·제출을 소유한다.

## 이번 마감에서 수정한 결함

1. 동일 사용자·범위에서 접근 모드가 바뀌거나 사용자/범위를 바꿨다가 돌아올 때 이전 요청의 늦은 응답이 새 작성 내용에 반영될 수 있었다. 작성자 식별에 접근 모드를 포함하고 컴포넌트 세대가 다른 사전 조회·제출 응답을 무효화했다.
2. 첫 보완 제출 성공 이후 같은 요청이 다시 보완 대기로 바뀌어도 성공 안내가 계속 남아 재작성할 수 없었다. 최신 보완 요청의 버전과 값을 기준으로 새 작성 주기를 시작하도록 수정했다.
3. 제출 409 이후 최신 요청 재조회가 일시적으로 실패하면 상세 페이지가 입력 컴포넌트를 제거하여 사유가 유실될 수 있었다. 기존 요청 데이터가 있는 5xx·전송 오류에서는 작성 화면과 재조회 동작을 유지한다. 401·403·404와 같은 원본 접근 거부는 기존 차단 동작을 유지한다.

첫 번째 결함의 세 가지 재현과 두 번째 결함은 수정 전 실패한 mounted 테스트를 기록했다. 기존 제출 스키마, API 경로·계약, 권한 부여와 제품 활성화는 수정하지 않았다.

## 최종 결과

- 단위 테스트 14/14 PASS: 모델 7, API 3, 실제 컴포넌트의 사용자·범위·접근 모드 격리와 재보완 주기 4.
- E2E 24/24 PASS: Chromium 및 mobile(iPhone 13 설정) 각 12개. 작성 검증, 제출 미리보기, 정상 접수, 최신 버전 충돌, 실제 POST 409, 409 후 GET 503 복구, POST 403 입력 보존, 권한 없는 사용자, 111 정확한 ACTION 재검증, 원본 scope·decision revision 전달, 응답 유실 시 같은 idempotency key·body 재전송을 포함한다.
- 390px·320px 한국어 화면에서 작성·미리보기·접수 결과를 캡처하고 시각적으로 확인했다. 확인창 전환이 끝난 뒤 캡처하여 내용과 버튼을 확인했다. 320px 가로 넘침 및 Axe serious/critical 위반 없음.
- 대상 소스·검증 파일 ESLint PASS. 최신 API 조회의 contextScopeKey는 API 테스트에서, 제출의 scope와 decision revision은 111 E2E에서 확인했다.

로그는 `unit-final.log`, `e2e-final.log`, `eslint.log`다. `identity-before.log`와 `reopen-before.log`는 수정 전 재현 기록이다. 캡처는 `results/`에 보관했고 파일별 SHA-256은 `manifest.json`에 기록했다.

## 변경 파일과 통합 경계

생산 변경은 `service-information-response.tsx`, `pages/services.tsx`의 RequestDetailView, ko/en `services.json` 안내 두 키다. `service-information-response-model.ts`, `service-information-response-fields.tsx`, `service-center-api.ts`의 기존 구현과 optional scope 전달 계약은 읽기 감사 및 검증만 수행했다. 검증은 `service-information-response-identity.test.tsx`와 `e2e/services-information-response.spec.ts`에 보강했다.

테스트는 허용된 가상 응답을 사용하는 개발 검증이다. 중앙 통합에서 확인한 v6 DRAFT 및 운영 활성화 `BLOCKED_EXTERNAL` 상태는 그대로다. 이 자료는 실운영 활성화나 Stitch 전체 18개 화면의 완료 증거로 확대 해석하지 않는다. 전체 Work 회귀·Workspace 빌드·공유 정적 Gate는 조정 에이전트의 최종 통합 결과를 따른다.

담당 구현과 검증 파일은 CLOSED/FROZEN 상태다.
