# 장애인교원 교육전념 여건 지원 플랫폼

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://webfortd.vercel.app/)

> **배포 URL**: https://webfortd.vercel.app/

장애인교원이 필요한 지원 정보를 한곳에서 쉽고 빠르게 확인할 수 있는 **사용자 중심 위키 형식 웹사이트**입니다.

## 프로젝트 개요

이 플랫폼은 장애인교원의 교육 활동을 지원하기 위해 다양한 지원제도, 법령, 연구자료, 권리 구제 정보 등을 통합적으로 제공합니다. 사용자 유형별 맞춤 정보 제공과 높은 웹 접근성을 핵심 가치로 삼고 있습니다.

### 대상 사용자

- **장애인교원 (당사자)**: 본인에게 필요한 지원제도와 권리 정보 확인
- **학교 관리자**: 장애인교원 지원을 위한 행정 정보 파악
- **교육청 담당자**: 정책 시행 및 지원 업무 참고
- **정책입안자**: 장애인교원 관련 정책 수립 기초자료 활용

## 주요 기능

### 접근성 도구

웹 접근성을 최우선으로 고려하여 다양한 접근성 옵션을 제공합니다:

| 기능 | 설명 |
|------|------|
| 글자 크기 조절 | 80%~200% 범위에서 조절 가능 |
| 줄 간격 조절 | 보통/넓게/매우넓게 3단계 |
| 고대비 모드 | 기본/검정-노랑/검정-하양 |
| 링크 밑줄 표시 | 링크 식별 용이성 향상 |
| 애니메이션 축소 | 움직임 민감 사용자 배려 |
| 키보드 단축키 | Alt+0~3 빠른 접근 |
| 스킵 링크 | 본문 바로가기 |

### 정보 아키텍처 (IA)

```
1. 플랫폼 소개
   ├── 소개 및 이용안내
   └── 연혁 및 협력기관

2. 지원제도 안내
   ├── 지원영역별 제도
   ├── 장애유형별 제도
   └── 시도별 제도

3. 연구·법령·통계
   ├── 연구자료
   ├── 법령 및 지침
   ├── 현황 통계
   └── 정책 제안

4. 권리 구제
   ├── 권리 및 의무
   ├── 사례 모음
   ├── 구제 절차
   └── 침해 신고

5. 현장 사례
   ├── 우수 사례
   ├── 인식 개선
   └── 미디어 자료

6. 참여하기
   ├── 자주 묻는 질문
   ├── 질문하기
   └── 나의 권리 알아보기
```

### 콘텐츠 관리

- **MDX 기반 콘텐츠**: Markdown + React 컴포넌트로 유연한 콘텐츠 작성
- **자동 목차 생성**: 문서 내 헤딩 기반 목차 자동 생성
- **읽기 모드**: 문서 상세 페이지 풀스크린 UI

## 기술 스택

### 프레임워크 및 언어

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.x | React 프레임워크 (App Router) |
| TypeScript | 5.x | 타입 안전성 |
| React | 19.x | UI 라이브러리 |

### 스타일링 및 UI

| 기술 | 용도 |
|------|------|
| Tailwind CSS | 유틸리티 기반 스타일링 |
| Radix UI | 접근성 기반 헤드리스 컴포넌트 |
| Lucide Icons | 아이콘 시스템 |
| Framer Motion | 애니메이션 |

### 콘텐츠 관리

| 기술 | 용도 |
|------|------|
| next-mdx-remote | MDX 원격 렌더링 |
| gray-matter | 프론트매터 파싱 |
| remark-gfm | GitHub Flavored Markdown |
| rehype-slug | 헤딩 ID 자동 생성 |

## 디렉토리 구조

```
webfortd/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 배포 (현재 비활성화)
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── about/              # 플랫폼 소개
│   │   ├── support/            # 지원제도 안내
│   │   ├── resources/          # 연구·법령·통계
│   │   ├── rights/             # 권리 구제
│   │   ├── stories/            # 현장 사례
│   │   ├── participate/        # 참여하기
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 홈페이지
│   │   └── globals.css         # 전역 스타일
│   ├── components/
│   │   ├── accessibility/      # 접근성 컴포넌트
│   │   │   ├── SkipLink.tsx
│   │   │   └── AccessibilityToolbar.tsx
│   │   ├── layout/             # 레이아웃 컴포넌트
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Breadcrumb.tsx
│   │   ├── mdx/                # MDX 콘텐츠 컴포넌트
│   │   │   ├── MDXContent.tsx
│   │   │   ├── MDXClientWrapper.tsx
│   │   │   └── TableOfContents.tsx
│   │   └── ui/                 # UI 컴포넌트
│   │       ├── Button.tsx
│   │       └── Card.tsx
│   ├── content/                # MDX 콘텐츠 파일
│   │   └── resources/
│   │       ├── law/            # 법령·지침 문서
│   │       └── research/       # 연구자료 문서
│   └── lib/
│       ├── utils.ts            # 유틸리티 함수
│       ├── accessibility.ts    # 접근성 설정 관리
│       ├── navigation.ts       # 내비게이션 구조
│       └── mdx.ts              # MDX 유틸리티
├── public/                     # 정적 파일
├── next.config.ts              # Next.js 설정
├── tailwind.config.ts          # Tailwind 설정
├── tsconfig.json               # TypeScript 설정
└── package.json                # 프로젝트 의존성
```

## 개발 환경 설정

### 사전 요구사항

- **Node.js**: 20.x 이상
- **npm**: 10.x 이상 (또는 yarn, pnpm)

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/Engccer/webfortd.git
cd webfortd

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버가 실행되면 [http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 사용 가능한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (핫 리로드 지원) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 코드 검사 |

## 배포

### 현재 배포 환경

- **Vercel**: 메인 배포 플랫폼 (자동 배포)
  - **URL**: https://webfortd.vercel.app/
  - `master` 브랜치 푸시 시 자동 배포
  - SSR/ISR 기능 활용 가능

### GitHub Pages (비활성화됨)

GitHub Pages 배포는 현재 비활성화되어 있습니다. 필요시 다음과 같이 재활성화할 수 있습니다:

1. `.github/workflows/deploy.yml`에서 주석 처리된 `push` 트리거 복원
2. GitHub Actions 탭에서 수동 실행 가능

```yaml
# deploy.yml에서 아래 주석 해제
on:
  push:
    branches: [master]
  workflow_dispatch:
```

### 환경별 설정

`next.config.ts`에서 `DEPLOY_TARGET` 환경 변수로 배포 환경을 구분합니다:

| 환경 | DEPLOY_TARGET | basePath | output |
|------|---------------|----------|--------|
| Vercel | (미설정) | `""` | SSR |
| GitHub Pages | `github-pages` | `/webfortd` | `export` |

## 콘텐츠 작성 가이드

### MDX 문서 추가

`src/content/` 디렉토리에 MDX 파일을 추가합니다.

```markdown
---
title: "문서 제목"
description: "문서 설명"
author: "작성자"
date: "2025-01-01"
category: "카테고리"
tags: ["태그1", "태그2"]
---

# 본문 내용

Markdown 문법과 React 컴포넌트를 함께 사용할 수 있습니다.
```

### 새 페이지 추가

1. `src/app/` 하위에 폴더 생성
2. `page.tsx` 파일 작성
3. `src/lib/navigation.ts`에 네비게이션 항목 추가

## 접근성 가이드라인

이 프로젝트는 WCAG 2.1 AA 수준을 목표로 합니다:

- **인식의 용이성**: 대체 텍스트, 색상 대비, 텍스트 크기 조절
- **운용의 용이성**: 키보드 접근성, 스킵 링크, 충분한 시간
- **이해의 용이성**: 일관된 네비게이션, 명확한 레이블
- **견고성**: 시맨틱 HTML, ARIA 속성

## 개발 로드맵

### 완료된 작업

- [x] 프로젝트 초기화 및 기본 구조 구축
- [x] 접근성 도구 구현 (AccessibilityToolbar)
- [x] 레이아웃 컴포넌트 구현 (Header, Footer, Sidebar, Breadcrumb)
- [x] 전체 페이지 골격 구현 (6개 섹션, 21개 페이지)
- [x] MDX 콘텐츠 시스템 구축
- [x] 읽기 모드 구현

### 진행 예정

- [ ] 검색 기능 구현 (Flexsearch)
- [ ] 다크 모드 지원
- [ ] 실제 콘텐츠 추가
- [ ] 백엔드 연동 (질문하기, 신고하기 등)
- [ ] 다국어 지원 검토

## 기여 방법

1. 이슈 등록: 버그 리포트 또는 기능 제안
2. 포크 후 브랜치 생성
3. 변경사항 커밋
4. Pull Request 생성

## 라이선스

이 프로젝트의 라이선스는 추후 결정될 예정입니다.

## 문의

프로젝트 관련 문의사항은 이슈를 통해 등록해 주세요.

---

**마지막 업데이트**: 2025년 12월 1일
