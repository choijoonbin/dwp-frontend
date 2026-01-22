# 테마 토큰 운영 표준

**최종 업데이트**: 2026-01-22

이 문서는 DWP Frontend에서 디자인 토큰 사용 표준을 명문화합니다. **색상 하드코딩 금지**, **spacing 단위 규칙**, **상태 토큰 표준 사용**을 통해 일관된 UI/UX를 유지합니다.

---

## 📋 목차

1. [핵심 원칙](#핵심-원칙)
2. [색상 토큰 (Palette)](#색상-토큰-palette)
3. [간격 토큰 (Spacing)](#간격-토큰-spacing)
4. [상태 토큰 (State)](#상태-토큰-state)
5. [DO / DON'T 예시](#do--dont-예시)
6. [검증 체크리스트](#검증-체크리스트)

---

## 핵심 원칙

### ❌ 절대 금지 사항

1. **색상 하드코딩 금지**
   - `#1976d2`, `rgb(25, 118, 210)`, `rgba(...)` 직접 사용 금지
   - 모든 색상은 반드시 `theme.palette.*`를 통해서만 사용

2. **픽셀 단위 하드코딩 금지**
   - `padding: 16px`, `margin: 32px` 직접 사용 금지
   - 모든 간격은 `theme.spacing()`을 통해서만 사용

3. **임의 상태 색상 금지**
   - 선택/호버/비활성 상태는 반드시 `action.*` 토큰 사용

### ✅ 표준 사용 원칙

1. **테마 토큰 First**: 항상 테마 토큰을 먼저 확인
2. **일관성 유지**: 같은 UI 요소는 같은 토큰 사용
3. **Dark Mode 대응**: 토큰 사용 시 자동으로 Dark Mode 지원
4. **확장성**: 테마 토큰은 브랜딩 변경 시 전체 일괄 적용 가능

---

## 색상 토큰 (Palette)

### 주요 색상

```typescript
// ✅ DO: 테마 토큰 사용
theme.palette.primary.main       // 메인 컬러
theme.palette.primary.light      // 밝은 메인 컬러
theme.palette.primary.dark       // 어두운 메인 컬러
theme.palette.primary.lighter    // 아주 밝은 메인 컬러
theme.palette.primary.darker     // 아주 어두운 메인 컬러

theme.palette.secondary.main     // 보조 컬러
theme.palette.error.main         // 에러 컬러
theme.palette.warning.main       // 경고 컬러
theme.palette.info.main          // 정보 컬러
theme.palette.success.main       // 성공 컬러
```

```tsx
// ❌ DON'T: 하드코딩
<Box sx={{ bgcolor: '#1976d2' }}>...</Box>
<Box sx={{ color: 'rgb(25, 118, 210)' }}>...</Box>

// ✅ DO: 테마 토큰 사용
<Box sx={{ bgcolor: 'primary.main' }}>...</Box>
<Box sx={{ color: 'primary.main' }}>...</Box>
```

### 텍스트 색상

```typescript
theme.palette.text.primary       // 주요 텍스트 (기본값)
theme.palette.text.secondary     // 보조 텍스트 (설명, 메타 정보)
theme.palette.text.disabled      // 비활성 텍스트
```

```tsx
// ❌ DON'T: 하드코딩
<Typography sx={{ color: '#666' }}>설명 텍스트</Typography>

// ✅ DO: 테마 토큰 사용
<Typography sx={{ color: 'text.secondary' }}>설명 텍스트</Typography>
```

### 배경 색상

```typescript
theme.palette.background.default  // 기본 배경 (페이지 배경)
theme.palette.background.paper    // 카드/패널 배경
theme.palette.background.neutral  // 중립 배경 (보조 영역)
```

```tsx
// ❌ DON'T: 하드코딩
<Card sx={{ bgcolor: '#fff' }}>...</Card>

// ✅ DO: 테마 토큰 사용
<Card sx={{ bgcolor: 'background.paper' }}>...</Card>
```

### 상태 색상

```typescript
theme.palette.action.active      // 활성 요소
theme.palette.action.hover       // 호버 상태 (마우스 오버)
theme.palette.action.selected    // 선택 상태 (현재 선택된 항목)
theme.palette.action.disabled    // 비활성 상태
theme.palette.action.focus       // 포커스 상태
```

**표준 사용 예시**:

```tsx
// ✅ SelectableCard 선택 상태
<Card
  sx={{
    bgcolor: selected ? 'action.selected' : 'background.paper',
    '&:hover': {
      bgcolor: selected ? 'action.selected' : 'action.hover',
    },
  }}
>
  ...
</Card>
```

### 구분선

```typescript
theme.palette.divider            // 구분선, 테두리
```

```tsx
// ❌ DON'T: 하드코딩
<Divider sx={{ borderColor: '#e0e0e0' }} />

// ✅ DO: 테마 토큰 사용
<Divider sx={{ borderColor: 'divider' }} />
```

---

## 간격 토큰 (Spacing)

### 표준 Spacing 단위

MUI 기본 spacing 단위는 **8px**입니다.

```typescript
theme.spacing(1)  // 8px
theme.spacing(2)  // 16px
theme.spacing(3)  // 24px
theme.spacing(4)  // 32px
theme.spacing(5)  // 40px
```

### 운영 규칙

| 용도 | 권장 Spacing | 픽셀 환산 |
|------|-------------|-----------|
| 최소 간격 | `spacing(0.5)` | 4px |
| 컴포넌트 내부 간격 | `spacing(1)` | 8px |
| 카드/패널 padding | `spacing(2)` | 16px |
| 섹션 간격 | `spacing(3)` | 24px |
| 페이지 여백 | `spacing(4)` | 32px |
| 대형 섹션 간격 | `spacing(5)` | 40px |

### DO / DON'T

```tsx
// ❌ DON'T: 픽셀 하드코딩
<Box sx={{ p: '16px', m: '32px' }}>...</Box>

// ✅ DO: spacing 함수 사용
<Box sx={{ p: 2, m: 4 }}>...</Box>

// ❌ DON'T: 임의 픽셀값
<Stack spacing="12px">...</Stack>

// ✅ DO: spacing 단위 사용
<Stack spacing={1.5}>...</Stack>  // 12px = 1.5 * 8px
```

### 반응형 Spacing

```tsx
// ✅ DO: breakpoint 기반 spacing
<Box
  sx={{
    p: { xs: 2, sm: 3, md: 4 },  // 모바일 16px, 태블릿 24px, 데스크탑 32px
  }}
>
  ...
</Box>
```

---

## 상태 토큰 (State)

### 상태별 표준 토큰

#### 1. 선택 상태 (Selected)

```tsx
// ✅ DO: action.selected 사용
<Card
  sx={{
    bgcolor: selected ? 'action.selected' : 'background.paper',
    borderColor: selected ? 'primary.main' : 'divider',
  }}
>
  ...
</Card>
```

#### 2. 호버 상태 (Hover)

```tsx
// ✅ DO: action.hover 사용
<Card
  sx={{
    bgcolor: 'background.paper',
    '&:hover': {
      bgcolor: 'action.hover',
    },
  }}
>
  ...
</Card>
```

#### 3. 비활성 상태 (Disabled)

```tsx
// ✅ DO: action.disabled 사용
<Button
  disabled
  sx={{
    color: 'action.disabled',
  }}
>
  비활성
</Button>
```

#### 4. 복합 상태 (선택 + 호버)

```tsx
// ✅ DO: 선택 상태 우선, 호버는 보조
<Card
  sx={{
    bgcolor: selected ? 'action.selected' : 'background.paper',
    '&:hover': {
      bgcolor: selected ? 'action.selected' : 'action.hover',
    },
  }}
>
  ...
</Card>
```

---

## DO / DON'T 예시

### ❌ BAD: 하드코딩 예시

```tsx
// ❌ 색상 하드코딩
<Box sx={{ bgcolor: '#f5f5f5', color: '#333' }}>...</Box>

// ❌ 픽셀 하드코딩
<Box sx={{ padding: '16px', marginBottom: '24px' }}>...</Box>

// ❌ 임의 상태 색상
<Card sx={{ bgcolor: selected ? '#e3f2fd' : '#fff' }}>...</Card>

// ❌ 혼재 사용
<Box sx={{ p: 2, marginTop: '32px' }}>...</Box>  // spacing(2) + 픽셀 혼재
```

### ✅ GOOD: 테마 토큰 사용 예시

```tsx
// ✅ 색상 토큰 사용
<Box sx={{ bgcolor: 'background.neutral', color: 'text.primary' }}>...</Box>

// ✅ spacing 함수 사용
<Box sx={{ p: 2, mb: 3 }}>...</Box>

// ✅ 상태 토큰 사용
<Card sx={{ bgcolor: selected ? 'action.selected' : 'background.paper' }}>...</Card>

// ✅ 일관된 토큰 사용
<Box sx={{ p: 2, mt: 4 }}>...</Box>  // 모두 spacing 단위
```

### ✅ BEST: 반응형 + 테마 토큰

```tsx
// ✅ 최상: breakpoint + 테마 토큰 조합
<Card
  sx={{
    p: { xs: 2, md: 3 },  // 모바일 16px, 데스크탑 24px
    bgcolor: selected ? 'action.selected' : 'background.paper',
    borderColor: 'divider',
    '&:hover': {
      bgcolor: selected ? 'action.selected' : 'action.hover',
    },
  }}
>
  <Typography variant="subtitle2" sx={{ color: selected ? 'primary.main' : 'text.primary' }}>
    제목
  </Typography>
  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
    설명
  </Typography>
</Card>
```

---

## 검증 체크리스트

PR 작성 시 아래 항목을 반드시 확인하세요.

### 색상 (Palette)

- [ ] `#`, `rgb()`, `rgba()` 하드코딩 사용 안 함
- [ ] 모든 색상이 `theme.palette.*`로 정의됨
- [ ] 선택 상태는 `action.selected` 사용
- [ ] 호버 상태는 `action.hover` 사용
- [ ] 비활성 상태는 `action.disabled` 사용
- [ ] 카드 배경은 `background.paper` 사용
- [ ] 구분선은 `divider` 사용

### 간격 (Spacing)

- [ ] `px` 단위 하드코딩 사용 안 함
- [ ] 모든 spacing이 `theme.spacing()` 또는 `sx` 단축 속성 사용
- [ ] `p`, `m`, `pt`, `pb`, `pl`, `pr` 등은 숫자 단위 사용
- [ ] 반응형 spacing은 breakpoint 객체로 정의

### 일관성

- [ ] 같은 UI 패턴은 같은 토큰 사용
- [ ] 임의 색상/간격이 없음
- [ ] Dark Mode에서도 정상 표시됨 (테마 토큰 사용 시 자동 지원)

---

## 참고 문서

- [MUI Theme Palette](https://mui.com/material-ui/customization/palette/)
- [MUI Theme Spacing](https://mui.com/material-ui/customization/spacing/)
- [디자인 시스템 가이드](./DESIGN_SYSTEM.md)
- [레이아웃 가이드](./LAYOUT_GUIDE.md)

---

## 문의

테마 토큰 관련 문의 사항은 디자인 시스템 담당자에게 문의하세요.
