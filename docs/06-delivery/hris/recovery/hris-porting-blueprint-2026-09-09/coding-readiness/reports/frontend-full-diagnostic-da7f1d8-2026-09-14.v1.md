# Frontend 전체 회귀 진단 — da7f1d8

결과: 전체 Vitest 회귀 **574 files / 4,673 tests PASS, exit 0**. 이는 현재 프론트 회귀 진단이며 HRIS 전체 업무 구현, G0 catalog 재봉인, G3 코드 착수 또는 G6 release 승인이 아니다.

- 검사 source HEAD: `da7f1d8dae2eb99f6b60f5ef7e47acc093366083`.
- tree: `618fbdde8489458fbdd856f6430aec99c9da9968`.
- backend 공식 계약 입력: integration backend `70c996fdafc011392056a1909a2e5222b240ded3`.
- Node 24.19 런타임, 기존 Yarn 및 설치된 의존성을 사용했다. `hris-verification` host lock 아래 실행하고 정상 해제했다.
- 전체 회귀 실행은 2026-09-14 오전 10:45 KST 구간에 시작했다. 관찰한 최종 출력의 Vitest duration은 135.06초, wrapper elapsed는 136.346초다. terminal session 14822가 exit 0으로 완료했으며 실행 전후 HEAD/tree 동일·git clean을 확인했다.
- 이 요약에는 전체 argv/원시 로그의 독립 digest capture가 없으므로 기존 target-command catalog의 exact 실행 영수증으로 대체하지 않는다. 최종 source와 catalog의 증거 capture는 별도로 수행해야 한다.

## 같은 source에서 수행한 추가 진단

| 검사 | exit | elapsed seconds |
| --- | ---: | ---: |
| package-manager policy | 0 | 0.915 |
| architecture | 0 | 30.705 |
| typecheck | 0 | 5.951 |
| explicit official backend release contracts | 0 | 3.874 |

명시적 backend 계약 입력과 backend revision을 사용했다. 승인된 Agent 계약 82 paths / 256 schemas와 의도된 구버전 negative evidence는 변경하지 않았다. 공식 제품 계약 12개·PEP matrix 60 cells의 검사도 통과했다. architecture 명령이 출력한 product production readiness BLOCKED는 별도의 운영 release 보류 상태이며 HRIS G3 승인으로 바꾸지 않았다.

이후 backend의 새 authority scaffold 및 신규 HRIS 계약 변경은 이 source-bound 진단 범위 밖이다. 최종 backend source에 대한 provenance 갱신·producer/consumer compile·전체 catalog capture·native/runtime evidence·published Gate 검사가 모두 필요하다.
