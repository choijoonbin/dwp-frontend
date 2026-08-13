# DWP-R1-ADM-007 AI Agent 계약

Agent는 Navigation 게시, 앱 접근 승인·반려·이행·회수를 사용자 권한만으로 직접 실행하지
않는다. 향후 Tool로 추가할 경우 변경 전 Revision·영향 Preview, 요청자·승인자·이행자의
분리, 승인 Token과 만료, Tenant·User·App·Permission의 최소 Scope, Idempotency와
보상·회수를 모두 요구한다. Tool 호출은 현재 UI와 동일한 API와 감사 계약을 사용하며
서비스 Token으로 사람의 승인 책임을 대체하지 않는다.

단순 자연어 요청을 승인 근거로 사용하지 않는다.
