# Flow Stitch 내보내기 구현 감사

## 판정

전달 ZIP은 정상이며 경로 안전성·CRC를 통과했다. 5개 화면마다 서로 다른 `code.html`과 `screen.png`가 있고 공통 `DESIGN.md`가 있다. Flow 시각 정본 보관과 DWP 재구현의 기준으로 충분하다.

다만 이 패키지는 React/MUI 제품 소스가 아니라 **Tailwind CDN 기반 독립 정적 HTML 목업**이다. 제품에 직접 병합하지 않고 현재 DWP의 컴포넌트·토큰·권한·데이터 계약으로 포팅한다.

## 화면 대응

| Stitch 폴더      | 정본                              |
| ---------------- | --------------------------------- |
| `flow_1920px_3`  | `FLOW-BASE-DESKTOP-FINAL`         |
| `flow_390px_1`   | `FLOW-BASE-MOBILE-FINAL`          |
| `flow_1920px`    | `FLOW-PERSONALIZED-DESKTOP-FINAL` |
| `flow_390px_2`   | `FLOW-PERSONALIZED-MOBILE-FINAL`  |
| `flow_12_1920px` | `FLOW-EDITOR-DESKTOP`             |

## 확보한 내용

- 5개 정적 HTML과 5개 PNG
- 색·타이포·간격·shape·컴포넌트 원칙을 담은 `DESIGN.md`
- 접근 가능한 Figma 파일, Page 1과 정본 5개 node metadata
- 읽기 홈 4개의 위젯 내부 `overflow-y:auto` 부재
- 편집 스튜디오의 카탈로그 패널 독립 스크롤

## 구현 시 교정할 차이

- 모든 HTML이 `cdn.tailwindcss.com`, Google Fonts, Material Symbols에 의존한다. React source tree, MUI 컴포넌트, package/lock, 로컬 SVG·폰트 묶음은 없다.
- 개인화 모바일 한 화면은 `lh3.googleusercontent.com` 원격 사진에 의존한다. 제품 asset으로 확정하거나 대체해야 한다.
- 화면 이름은 1920px이지만 Figma의 데스크톱 frame 3개 실제 폭은 1280px다.
- PNG export도 각각 1065×1600, 1280×1788, 1280×1250, 245×1600, 250×1600으로 명시 viewport와 다르다. 구현 비교는 HTML을 실제 1920/1440/390/320 viewport에서 다시 렌더링해 수행한다.
- 두 데스크톱 읽기 화면의 실제 Tailwind 열은 `5/4/3` span, 즉 약 41.7%/33.3%/25%이며 매니페스트의 38%/34%/28%와 다르다.
- 1440px 2열 전환 규칙은 HTML에 구현돼 있지 않으며 `lg` 이상에서 3열이다.
- 모든 HTML이 WebKit 스크롤바를 전역 숨긴다. 제품에서는 문서 스크롤 가능성을 인지할 수 있고 키보드·터치가 작동하도록 다시 설계한다.
- API, 라우팅, 실제 저장, drag, 권한·오류 상태는 없다. 일부 버튼·checkbox·편집 선택·Ctrl+S의 시각 피드백만 동작한다.
- `DESIGN.md` frontmatter와 설명/HTML의 일부 토큰이 서로 다르고, base mobile의 Tailwind error token에는 `#`가 빠져 있다.
- 다섯 HTML 중 네 파일의 `lang`이 `en`이다. 실제 한국어 화면은 `lang="ko"`와 다국어 계약을 적용한다.

## 구현 수용 기준

- 현재 DWP React/MUI/Emotion 및 `@dwp-frontend/design-system`으로 재구성
- 현재 owner route·permission·freshness·상태 계약 사용
- 1920/1440/1280/390/320과 사이드바 펼침·접힘을 실제 브라우저로 검증
- 읽기 홈은 페이지 하나의 세로 스크롤, 편집 스튜디오는 경계가 분명한 작업 패널만 독립 스크롤
- 구현 캡처를 다섯 정본과 나란히 비교하고 모든 의도적 차이를 기록

원본 ZIP과 파일별 checksum 및 인도 상태는 이 디렉터리의 `archive-manifest.json`과 `README.md`를 따른다.
