# Identity owner ABI: root 독립 검토

상태: INDEPENDENT_SCAFFOLD_REVIEW_ONLY / NOT_READY / G3 CLOSED.

구현 작성자가 아닌 root가 신규 Java 14개 전체를 읽고, 현재 Java 14개+ABI 문서 2개의 SHA·줄 수·실행 전 수정 시각과 실제 XML 5개의 SHA·case 수·상태·시각을 대조했다. 16개 source hash와 5개 XML이 작성자 고정 증거와 일치한다. XML의 실제 합계는 85건, 실패·오류·skip 0이다. 이것은 작성자의 03:19:31–03:19:49 UTC 실제 집중 실행 기록을 독립적으로 확인한 것이며 root가 테스트를 다시 실행했다는 주장은 아니다.

기존 Auth principal→person과 People person→worker→relationship→assignment를 재사용하는 미배선 common ABI다. 공개 owner DTO는 미검증 carrier이며 임의 factory 배선이 production trust를 만들지 않는다. root 지적에 따른 native UUID record 일관성, 발급 직전 lease 재검사, 목적별 owner 상태 정책, 실제 typed consumer projection이 최종 소스에 반영됐다. native producer/서명·freshness·revoke/HTTP·Gateway PEP/lifecycle/13-stream pilot은 여전히 OPEN이다.

증거 정밀도 지적: 이전 JSON의 mtimeNs 16개는 JavaScript 안전 정수 범위를 넘어 −133~178ns 반올림 차이가 있다. 해시 변화는 없지만 그 숫자를 nanosecond-exact 역사 증거로 승인하지 않는다. 독립 JSON에는 현재 실제 ns를 decimal string으로 새 캡처하고 차이를 명시했다. 새 캡처를 과거 pre/post 정확한 ns로 소급하거나 tolerance로 exact 검사를 PASS 처리하지 않았다. 모든 실제 source 수정 시각이 작성자 실행 시작 전이라는 사실과 SHA 일치는 별도로 검증됐다.

현재 integration BE HEAD db0d2b5, tracked diff 0, 신규 Java 14개 untracked다. FE aaeba79 clean이다. 다섯 canonical BE로 전파·commit하지 않았으며 전체 개발 준비 승인도 하지 않는다. 현재 전체 검증/초기 global live Control/current sealed baseline은 이 집중 기록으로 대체할 수 없다.

정확한 원본 SHA·현재 source/ns·5 XML·남은 P0는 [독립 증거 JSON](identity-owner-abi-root-independent-review-2026-09-14.json)에 있다.
