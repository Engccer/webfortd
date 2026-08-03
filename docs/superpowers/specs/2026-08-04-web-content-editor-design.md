# 웹 콘텐츠 편집기 설계 (감수자용 git-backed 마크다운 편집기)

- 작성: 2026-08-04
- 상태: 위원장 설계 승인(대화), spec 리뷰 대기
- 범위: 웹앱만 (iOS 앱 제외)

## 1. 배경과 목표

중부대 연구보조원 등 비개발자 감수자가 git·저장소·sync 개념 없이 웹앱 안에서 콘텐츠를 직접 수정할 수 있어야 한다. 사업이 지속되면 콘텐츠 편집자가 바뀌어도 같은 경로로 편집이 가능해야 한다.

**영구 원칙과의 관계**: 2026-05-29 결정("콘텐츠 수정은 마크다운 정본을 통해서만, DB에 직접 쓰는 편집 UI 금지")을 뒤집지 않는다. 이 편집기는 당시 결정문이 예약해 둔 git-backed 어댑터 경로의 구현이다. 편집기는 DB가 아니라 마크다운 정본(GitHub repo)에 커밋하고, DB는 기존 파이프라인이 파생 갱신한다.

**측정 가능한 성과**: 감수자가 (a) OTP 로그인 → (b) 문서 페이지에서 편집 버튼 → (c) 본문 수정 → (d) 수정 반영 버튼, 4단계만으로 수 분 내 사이트에 반영된 것을 확인할 수 있다. git 개념 노출 0.

## 2. 확정 결정 (위원장, 2026-08-04)

| 항목 | 결정 |
|------|------|
| 반영 경로 | **master 직행 커밋** (git 이력 = 사후 감사, 오류는 revert) |
| 권한 모델 | **editor 역할 신설** (`editor_roles.role='editor'`; 편집기는 admin+editor, admin 대시보드·Draft Mode는 admin만) |
| 편집 범위 | **본문만** (frontmatter는 서버 보존, 클라이언트 미경유) |
| 신규 문서 생성 | **제외** (기존 문서 편집만, 신규는 위원장 몫) |
| 진입 경로 | **KB 문서 페이지의 편집 버튼** (권한자에게만 노출, 전용 허브 없음) |
| 임베딩 갱신 | **야간 GitHub Actions** (content 변경이 있던 날만 `kb:embed`) |
| 편집기 형식 | WYSIWYG 아님. 마크다운 textarea + 수동 프리뷰 토글 + 단축키 |

## 3. 접근안 비교 (기각 사유 기록)

- **자체 미니멀 편집기 (채택)**: 기존 인증(OTP)·렌더 파이프라인·검증 스크립트 전부 재사용. 신규 작성은 편집 화면 + 커밋 로직뿐.
- **기성 git-backed CMS(Decap 등, 기각)**: 편집자마다 GitHub 계정 + OAuth 로그인이 필요해 "비개발자가 저장소를 못 다룬다"는 출발 문제로 회귀. 편집 UI 접근성 품질도 통제 밖.
- **GitHub 웹 에디터 안내 문서화(기각)**: 공수 0이지만 같은 이유로 기각.

## 4. 아키텍처와 데이터 흐름

```
KB 문서 페이지 [편집] 버튼 (editor/admin에게만 노출)
  → /admin/editor?slug=<slug>
  → 서버 액션: GitHub Contents API GET으로 최신 .md + 파일 SHA 확보
  → frontmatter 분리(서버 보관), 본문만 textarea로
  → [프리뷰] 토글: 서버 액션이 기존 serialize 파이프라인 호출
     → MDXClientWrapper로 렌더 (프로덕션 KB 페이지와 동일 렌더 보장)
  → [수정 반영]: 서버 검증 → frontmatter 원본 + 새 본문 병합
     → GitHub Contents API PUT (master, SHA 낙관적 잠금)
  → push가 Vercel 빌드 트리거 (validate:content → sync:content → next build)
  → 수 분 내 정적 페이지·DB 인덱스 반영
  → RAG 임베딩은 야간 Actions가 갱신
```

- 커밋 메시지에 감수자 이메일 기록 → git 이력이 곧 감수 이력.
- 실측 확인(2026-08-04): master 브랜치 보호 규칙 없음(classic 404, ruleset 빈 배열) → API 직접 커밋 가능. 보호 규칙을 재도입하면 편집기 토큰의 bypass를 함께 설정해야 한다.
- 실측 확인: `KbPageLayout`이 `next-mdx-remote serialize`(서버) → `MDXClientWrapper`(클라이언트) 구조 → 프리뷰가 이 파이프라인을 그대로 재사용.

## 5. 신규 구성요소

| 구성요소 | 내용 |
|----------|------|
| 0014 마이그레이션 | `editor_roles`에 'editor' 역할 허용(제약 확인·필요 시 완화). 연구보조원 이메일 seed는 운영 시점에 별도 수행 |
| `src/lib/auth/editor.ts` | editor-or-admin 판정 헬퍼 (기존 `admin.ts` 패턴 준용, fail-safe) |
| KB 페이지 편집 버튼 | KB 페이지는 정적 prerender라 서버 사용자별 분기 불가 → 클라이언트 컴포넌트가 세션 확인 후 role 조회해 노출. 비로그인·무권한자에게는 DOM 미렌더 |
| `/admin/editor` 페이지 | dynamic 페이지 1개. 로드·프리뷰·반영을 모두 **서버 액션**으로 처리(API 라우트 신설 없음) → Vercel 함수 9 → **10/12** |
| `src/lib/github/contents.ts` | fetch 기반 얇은 래퍼(GET/PUT 2콜). octokit 의존성 추가하지 않음 |
| `.github/workflows/nightly-embed.yml` | 매일 밤 cron. 전일 이후 `content/**` 변경 커밋이 있을 때만 `kb:embed` 실행 |

## 6. 보안

- **GitHub 토큰**: fine-grained PAT, `khudt-org/webfortd` 한정 `contents:write`만. Vercel 서버 환경변수(`GITHUB_CONTENT_TOKEN`), 클라이언트 절대 비노출.
- **경로 화이트리스트**: 클라이언트는 slug만 전송. 서버가 kb-index로 slug → 파일 경로를 해석하므로 `content/` 밖·`..` 접근이 구조적으로 불가능.
- **역할 재검증**: 모든 서버 액션에서 세션 + editor/admin role 확인(클라이언트 노출 여부와 무관하게 서버가 최종 게이트).
- **rate limit**: 반영 액션에 기존 `src/lib/rate-limit.ts` 재사용.
- **frontmatter 비경유**: 클라이언트는 본문 문자열만 왕복 → status·slug 등 메타데이터 오염 원천 차단.

## 7. 에러 처리 (3-state 불변식 준수)

성공 / 검증 실패 / 통신 실패를 항상 구분된 한국어 텍스트로 전달한다.

- **동시 편집 충돌**: PUT 시점 SHA 불일치 → "다른 수정과 충돌했습니다" 통지 + 편집 중이던 텍스트는 화면에 보존한 채 최신본 재로드. 병합은 사용자 판단.
- **검증 실패 사전 차단**: 반영 전에 서버가 새 본문으로 ① `serialize` 실행(프리뷰와 동일 경로 — 실패하면 프로덕션 렌더도 실패한다) ② `check-mdx-escape` 로직 검사를 통과해야만 커밋한다. 근거: 깨진 커밋은 Vercel 빌드를 조용히 실패시켜 "반영됐다는데 사이트가 안 바뀌는", 감수자가 진단할 수 없는 상태를 만든다.
- **GitHub API 실패**: 한국어 메시지 + 재시도 안내. 편집 내용은 유실하지 않는다.

## 8. 접근성 (헌장 §1·§5 적용)

- `<textarea>` + 연결 `<label>`. 자동 저장 없음(명시 버튼만). 터치 타깃 ≥44px.
- 편집↔프리뷰 토글: 버튼 라벨 전환("프리뷰 보기"↔"편집으로 돌아가기")이 상태 신호. 전환 시 포커스는 토글 버튼에 유지(§5 포커스 이탈 방지).
- 반영 버튼: `aria-disabled` + in-flight ref 가드(더블 클릭 중복 커밋 차단). 완료 통지는 단일 polite live region("반영 완료. 수 분 내 사이트에 적용됩니다").
- 단축키: **Cmd/Ctrl+S = 수정 반영**, **Cmd/Ctrl+E = 편집/프리뷰 전환**. 브라우저 기본 동작 preventDefault, textarea 포커스 중에도 동작.
- 최종 판정: 위원장 VoiceOver 실기기 실측(리뷰로 대체 불가).

## 9. 테스트

- **unit(node:test)**: frontmatter 분리·병합 왕복 무손실, slug→경로 화이트리스트(탈출 시도 포함), GitHub 래퍼 SHA 충돌·오류 경로(mock fetch), 검증 사전 차단.
- **component(vitest)**: 토글 라벨 전환·버튼 상태·live region 문구.
- **a11y(playwright+axe)**: 기존 스위트에 editor 페이지 추가.
- **실측 게이트**: 반영 → Vercel 빌드 → 사이트 확인 1회 실호출(fixture green ≠ 실계약).

## 10. 범위 제외 (YAGNI)

- WYSIWYG·실시간 라이브 프리뷰·자동 저장·버전 diff UI·신규 문서 생성·frontmatter 편집·전용 문서 허브·iOS 편집. 필요가 실증되면 별도 사이클.

## 11. 운영 체크리스트 (구현과 별도, 배포 시점)

1. fine-grained PAT 발급(위원장 GitHub 계정) → Vercel 환경변수 등록
2. GitHub Actions Secrets 등록: `GEMINI_API_KEY`, Supabase URL·service_role 키 (야간 임베딩용)
3. 연구보조원 이메일 `editor_roles` seed (0014 이후 운영 쿼리)
4. 감수자용 1쪽 사용 안내(로그인 → 편집 → 반영) 작성
