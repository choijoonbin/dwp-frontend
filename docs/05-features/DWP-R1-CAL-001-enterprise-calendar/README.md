# DWP-R1-CAL-001 Enterprise Calendar

- 상태: Implemented
- 사용자 진입점: `/calendar/home`
- 관리자 진입점: `/calendar/admin/overview`
- 리소스: `APP.CALENDAR`, `ADMIN.CALENDAR`

## 제공 범위

- 오늘 홈: 다음 일정, 회의 참여, 시간 요약, 오늘의 흐름, 주간 리듬, 시간 코치
- 일정: 주·월·날짜별 목록, 빈 시간 생성, 반복 일정, 참석자·자원 포함 수정·취소, RSVP
- 가용 시간: People 구성원 최대 20명, 14일 범위, 근무시간·시간대 기반 후보
- 공간·자원: 회의실·좌석·장비, 시간·유형·수용 인원·설비 필터, 승인형 예약
- 시간 인사이트: 회의·집중·과부하·충돌, 설명 가능한 개인 권장사항
- 운영: 집계 현황, 예약 승인함, 자원 CRUD, 일정 정책
- 반응형: Desktop 주간 보기, Mobile 날짜별 목록 기본, 모바일 전체 Dialog
- 다국어: 한국어·영어 화면 및 날짜·시간 형식

## SKAX Seed

- People 원장과 IAM이 연결된 SKAX 구성원 178명 전원의 개인 캘린더 178개
- 활성 일정 1,122개: 회의 714, 집중 178, 업무 178, 부재 17, 리마인더 35
- 구성원 간 참석 관계 889개와 IAM·People identity bridge 178개
- 회사 캘린더 1개, 플랫폼 캘린더 1개
- 자원 8개: 회의실 6, 좌석 1, 장비 1
- 충돌 없이 시간·공간에 분산된 활성 자원 예약 222개: 확정 192, 승인 대기 30
- 이름·회사 이메일·응답 상태·일정 유형·시간을 결정적으로 변형해 DB 재구축 결과를 재현
- 기존 `member{id}@sk.com` 임시 참석자 0개
- 캘린더 관리자 그룹 1개, 위임 사용자 1명

## 검증 시나리오

1. 일반 구성원이 홈·일정·인사이트와 개인 일정만 본다.
2. 반복 일정이 화면과 가용 시간 계산에 같은 occurrence로 반영된다.
3. 타인 가용 시간 조회 응답에 일정 제목·메모가 포함되지 않는다.
4. 승인형 자원 일정 생성 시 예약이 `PENDING`이다.
5. `CALENDAR_ADMIN`만 승인 결정을 수행하고 결정 사유가 감사에 남는다.
6. 일정 취소 시 이벤트와 예약이 함께 `CANCELLED`다.
7. 일반 Tenant 관리자는 관리자 조회만 가능하고 정책 변경·승인은 거부된다.
8. Desktop 1280x720, Mobile 390x844에서 페이지 가로 overflow와 UI 중첩이 없다.
9. 일정 행에 중첩 button이 없고 브라우저 console error가 없다.
10. 반복 자원의 미래 occurrence와 겹치는 요청은 `409 RESOURCE_CONFLICT`로 거부된다.
11. 공유 캘린더의 비공개·기밀 일정은 비관련 사용자의 일정 피드에서 제외된다.
12. 반복 일정은 이벤트 시간대 현지 시각을 유지해 DST 전후에도 같은 시각에 표시된다.

## 실행 검증 증거

- 일반 구성원 `minseo.kim@sk.com`으로 반복 일정·필수 참석자·회의실 생성 성공
- 참석자와 회의실을 함께 변경한 뒤 참석자, 자원 예약, 낙관적 version 갱신 확인
- 두 번째 일정이 첫 일정의 미래 반복 회차와 겹칠 때 HTTP `409` 확인
- 비관련 `CALENDAR_ADMIN`이 공유 캘린더의 `CONFIDENTIAL` 일정 상세를 받지 않음
- 취소 시 Event와 Booking이 함께 `CANCELLED`, 생성·수정·취소 감사 이벤트 3건 확인
- Seed 반복 occurrence를 90일 펼친 자원 중복 예약 0건 확인
- Auth 구성원 ID와 Platform 개인 캘린더 소유자 집합 178건 일치 확인
- 구성원별 활성 소유 일정 최소 6개, 참석자 identity 불일치 및 활성 예약 겹침 0건 확인

## 데이터베이스 이력

- Platform `V69`: 캘린더 도메인·SKAX 일정·자원 Seed
- Platform `V71`: IAM·People identity bridge와 예약 승인 거버넌스
- Platform `V72`: 충돌 없는 Seed 재배치와 활성 예약 GiST exclusion constraint
- Platform `V74`: SKAX 구성원 178명 전체 일정·참석·부재·리마인더·자원 예약 Seed
- Platform `V75`: 리마인더와 회의·자원 일정의 사용자 화면 중첩 제거
- Platform `V76`: 부재 일정과 동일 사용자의 자원 예약 충돌 제거
- Auth `V51`: 캘린더 앱·관리 권한·위임 역할·SKAX 관리자 그룹

## 외부 준비가 필요한 후속 범위

Google Workspace·Microsoft 365 양방향 동기화, Meet·Teams 링크 발급, 외부 Poll·예약
페이지는 공급사 Tenant와 OAuth/Webhook 정보가 준비된 뒤 Adapter 단계로 진행한다.
