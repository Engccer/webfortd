# 장애인교원 교육전념 여건 지원 플랫폼

## 프로젝트 개요

장애인교원이 필요한 지원 정보를 한곳에서 쉽고 빠르게 확인할 수 있는 사용자 중심 위키 형식 웹사이트입니다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Radix UI (headless, accessible)
- **Icons**: Lucide Icons
- **Animation**: Framer Motion (예정)
- **Search**: Flexsearch (예정)
- **Content**: MDX (next-mdx-remote, remark-gfm, rehype-slug)

## 디렉토리 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── about/              # 플랫폼 소개
│   │   ├── purpose/        # 소개 및 이용안내
│   │   └── partners/       # 연혁 및 협력기관
│   ├── support/            # 지원제도 안내
│   │   ├── area/           # 지원영역별 제도
│   │   ├── disability/     # 장애유형별 제도
│   │   └── region/         # 시도별 제도
│   ├── resources/          # 연구·법령·통계
│   │   ├── research/       # 연구자료
│   │   ├── law/            # 법령 및 지침
│   │   ├── statistics/     # 현황 통계
│   │   └── policy/         # 정책 제안
│   ├── rights/             # 권리 구제
│   │   ├── entitlements/   # 권리 및 의무
│   │   ├── cases/          # 사례 모음
│   │   ├── procedure/      # 구제 절차
│   │   └── report/         # 침해 신고
│   ├── stories/            # 현장 사례
│   │   ├── best-practices/ # 우수 사례
│   │   ├── awareness/      # 인식 개선
│   │   └── media/          # 미디어 자료
│   ├── participate/        # 참여하기
│   │   ├── faq/            # 자주 묻는 질문
│   │   ├── ask/            # 질문하기
│   │   └── check/          # 나의 권리 알아보기
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 홈페이지
│   └── globals.css         # 전역 스타일
├── components/
│   ├── accessibility/      # 접근성 컴포넌트
│   │   ├── SkipLink.tsx
│   │   └── AccessibilityToolbar.tsx
│   ├── layout/             # 레이아웃 컴포넌트
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── Breadcrumb.tsx
│   ├── mdx/                # MDX 콘텐츠 컴포넌트
│   │   ├── MDXContent.tsx    # MDX 렌더러
│   │   ├── MDXClientWrapper.tsx # 클라이언트 래퍼
│   │   └── TableOfContents.tsx # 목차 컴포넌트
│   └── ui/                 # UI 컴포넌트
│       ├── Button.tsx
│       └── Card.tsx
├── content/                # MDX 콘텐츠 파일
│   └── resources/
│       ├── law/            # 법령·지침 문서
│       └── research/       # 연구자료 문서
└── lib/
    ├── utils.ts            # 유틸리티 함수
    ├── accessibility.ts    # 접근성 설정 관리
    ├── navigation.ts       # 내비게이션 구조
    └── mdx.ts              # MDX 유틸리티
```

## 주요 기능

### 접근성 도구
- 글자 크기 조절 (80%~200%)
- 줄 간격 조절 (보통/넓게/매우넓게)
- 고대비 모드 (기본/검정-노랑/검정-하양)
- 링크 밑줄 표시
- 애니메이션 축소
- 키보드 단축키 (Alt+0~3)
- 스킵 링크

### 사용자 유형별 진입점
- 장애인교원 (당사자)
- 학교 관리자
- 교육청 담당자
- 정책입안자

### 정보 아키텍처 (IA)
1. 플랫폼 소개
2. 지원제도 안내 (영역별/장애유형별/시도별)
3. 연구·법령·통계
4. 권리 구제
5. 현장 사례
6. 참여하기

## 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트
npm run lint
```

## 향후 계획

- [x] MDX 콘텐츠 시스템 구축
- [ ] 검색 기능 (Flexsearch) 구현
- [ ] 다크 모드 지원
- [ ] 실제 콘텐츠 추가
- [ ] 백엔드 연동 (질문하기, 신고하기 등)

## 참고 자료

- 자문 의견서 (자문 의견서_확장본.md)
- 기존 사이트 분석 (사이트_현황_분석.md)

## 작업 이력

- 2025-12-01: 프로젝트 초기화 및 기본 구조 구축
- 2025-12-01: 접근성 도구 구현 (AccessibilityToolbar)
- 2025-12-01: 레이아웃 컴포넌트 구현 (Header, Footer, Sidebar, Breadcrumb)
- 2025-12-01: 전체 페이지 골격 구현 (6개 섹션, 21개 페이지)
- 2025-12-01: MDX 콘텐츠 시스템 구축 (next-mdx-remote 연동)
- 2025-12-01: 연구자료/법령지침 MDX 문서 페이지 구현
- 2025-12-01: ARIA 간소화 - 문서 카드 링크 구조 최적화
- 2025-12-01: 연구자료 목록 업데이트 (샘플 데이터 교체)
- 2025-12-01: 샘플 데이터 경고 배너 추가 (stories/media, participate/faq, resources/research)
- 2025-12-01: 읽기 모드 구현 - 문서 상세 페이지 풀스크린 UI
