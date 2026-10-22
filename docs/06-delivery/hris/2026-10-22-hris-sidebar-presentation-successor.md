# 2026-10-22 HRIS Sidebar Presentation Successor

> 상태: `DECIDED` — 사용자 검토를 반영한 표시명·반응형 presentation 보완
>
> 적용 대상: HRIS 1차 rail 표시명, workbench task navigator 제목·검색 이름, mobile drill-in header
>
> 비적용 대상: canonical workbench ID·계약명, route, owner, 7 workbench·46 group·99-node topology,
> tenant/legal-entity navigation policy 및 PAGE 권한

이 문서는 `09-information-architecture-contract.md`와
`2026-10-20-hris-navigation-experience-successor.md`의 **workbench 표시명 조항만** 후속 결정으로
대체하며, 두 문서의 IA·권한·탐색 구조 계약은 그대로 유지한다.

## 결정

상위 그룹 `HR 운영`이 운영 문맥을 제공하므로 그 아래 1차 항목은 다음과 같이 짧은 명사형으로
통일한다.

| 표시 그룹 | 1차 표시명                     |
| --------- | ------------------------------ |
| HR 운영   | `인사`, `근태`, `급여`, `성과` |

영문은 같은 원칙으로 `People`, `Time`, `Payroll`, `Performance`를 사용한다. 이 변경은
`HRIS-WB-HR-OPERATIONS`의 canonical 계약명 `인사 운영` / `HR operations`를 바꾸지 않는
presentation-only override다. Sidebar, desktop panel 제목, mobile drill-in 제목 및 검색 접근성 이름은
모두 같은 i18n 표시명을 사용한다.

Mobile drill-in 제목은 긴 한국어·영어 또는 향후 governed label을 생략하지 않는다. 320px·390px 및
200% 확대에서도 header 높이가 내용에 맞게 늘어나고 제목은 줄바꿈한다. Back·close control은 기존
44px target을 유지한다.

## 불변 조건

- canonical/generated IA 산출물과 digest를 수정하지 않는다.
- tenant·legal-entity policy와 Product Surface PAGE 권한의 교집합만 표시한다.
- panel search, count, group, leaf 및 `/hr/explore` 권한 규칙을 변경하지 않는다.
- HRIS 외 ProductArea navigation 표현을 변경하지 않는다.

## 인수조건

1. 한국어 rail과 panel 제목은 모두 `인사`, 영어는 모두 `People`로 일치한다.
2. 검색 입력의 accessible name도 같은 표시명을 사용한다.
3. `인사 운영` / `HR operations` canonical 계약명은 runtime topology에 그대로 남는다.
4. mobile 제목은 ellipsis 없이 wrap하며 back·close target은 44px를 유지한다.
5. 변경된 i18n, task navigation, mobile focus 계약과 단일 HRIS navigation browser journey가 통과한다.
