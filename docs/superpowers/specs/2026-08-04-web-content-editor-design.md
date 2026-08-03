# 웹 콘텐츠 편집기 설계 (감수자용 git-backed 마크다운 편집기)

- 작성: 2026-08-04 · 개정: 2026-08-04 (codex 적대적 리뷰 28건 처리 반영, 부록 참조)
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
| 편집 범위 | **본문만** (frontmatter는 클라이언트 미경유, 원본 바이트 보존) |
| 신규 문서 생성 | **제외** (기존 문서 편집만, 신규는 위원장 몫) |
| 진입 경로 | **KB 문서 페이지의 편집 버튼** (권한자에게만 노출, 전용 허브 없음) |
| DB·임베딩 갱신 | **야간 GitHub Actions** (`kb:sync` + `kb:embed`, 변경이 있을 때만) |
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
  → frontmatter 분리(원본 바이트 prefix), 본문만 textarea로
  → [프리뷰] 토글: 서버 액션이 기존 serialize 함수 재사용해 렌더
  → [수정 반영]: 서버 검증 → frontmatter 원본 바이트 + 새 본문 병합
     → GitHub Contents API PUT (master, 파일 SHA 낙관적 잠금)
  → push가 Vercel 빌드 트리거 (validate:content → JSON 인덱스 재생성 → next build)
  → 수 분 내 정적 페이지·검색 인덱스 반영  ※ 빌드는 DB를 건드리지 않는다(실코드 확인)
  → DB(documents·backlinks)와 RAG 임베딩은 야간 Actions가 kb:sync + kb:embed로 갱신
```

- **파이프라인 사실**(2026-08-04 실코드 확인): 빌드의 `sync:content`는 JSON 인덱스(`kb-index.generated.json`) 생성만 한다. DB 동기화는 별도 스크립트 `kb:sync`(documents **upsert**, backlinks delete+insert)이며 현재 수동 → 야간 Actions로 자동화한다. 사이트 페이지·검색은 빌드 산출물만 쓰므로 감수자 확인 경로는 push→빌드만으로 완결된다.
- **stateless 제출 프로토콜**: 서버리스라 액션 간 서버 상태가 없다. 클라이언트는 `{slug, baseFileSha, body}`만 보유·전송한다. 제출 시 서버가 현재 파일을 GET → SHA가 `baseFileSha`와 다르면 충돌 처리, 같으면 그 파일의 frontmatter 원본 바이트(YAML 재직렬화 금지 — 주석·순서·줄바꿈 보존)에 새 본문을 이어 붙여 PUT한다. frontmatter는 어떤 형태로도 클라이언트에 가지 않는다.
- **상태 모델(정직한 명명)**: 반영 성공 = **"커밋 접수"**다("반영 완료" 아님 — PUT 성공 뒤에도 빌드는 독립적으로 실패할 수 있다). 사용자 통지 4상태: `검증 거부` / `충돌` / `커밋 접수` / `통신 실패`. 접수 안내에 "몇 분 후 문서 페이지를 새로고침해 확인하세요"를 포함한다. 빌드 실패는 Vercel이 위원장에게 이메일 통지(운영 런북 §11).
- **커밋 신원(공개 저장소 비기재 원칙 정합)**: repo는 public이므로 커밋 메시지·author에 감수자 개인 이메일을 넣지 않는다. `content(edit): <slug> [editor:<supabase UUID 앞 8자>]` 형식의 가명 식별자만 기록하고, 실명 매핑은 `editor_roles`(DB, 비공개)가 담당한다.
- 실측 확인(2026-08-04): master 브랜치 보호 규칙 없음 → API 직접 커밋 가능. force push·브랜치 삭제 금지 ruleset을 운영 체크리스트에 추가한다(§11).

## 5. 신규 구성요소

| 구성요소 | 내용 |
|----------|------|
| 0014 마이그레이션 | `editor_roles`에 'editor' 역할 허용 + **write(insert/update/delete)는 service_role만 가능함을 RLS로 명시**(권한 자기부여 차단). seed는 운영 시점 별도 수행 |
| `src/lib/auth/editor.ts` | editor-or-admin 판정 헬퍼. 기존 admin 게이트는 변경하지 않고 별도 함수로 추가(권한 행렬: `/admin/editor`만 editor 허용, 대시보드·Draft Mode는 admin 불변) |
| KB 페이지 편집 버튼 | KB 페이지는 정적 prerender라 서버 사용자별 분기 불가 → 클라이언트 컴포넌트가 세션 확인 후 role 조회해 노출. 비로그인·무권한자에게는 DOM 미렌더. `/admin/editor` 직접 접근 시에는 로그인 필요/권한 없음/조회 실패를 구분 메시지로 |
| `/admin/editor` 페이지 | dynamic 페이지 1개. 로드·프리뷰·반영을 모두 **서버 액션**으로(API 라우트 신설 없음) → Vercel 함수 예상 10/12. **구현 시 빌드 산출물의 실제 함수 수 실측 확인을 acceptance로** |
| `src/lib/github/contents.ts` | fetch 기반 얇은 래퍼(GET/PUT 2콜). octokit 의존성 불추가 |
| `.github/workflows/nightly-embed.yml` | 매일 밤 cron. **트리거 기준은 날짜가 아니라 SHA**: 마지막 성공 실행이 기록한 content SHA와 현재 master의 content SHA가 다를 때만 `kb:sync` → `kb:embed` 순차 실행(같은 잡 안 직렬 실행이라 sync·embed 간 경쟁 없음). 실패 시 SHA가 갱신되지 않아 다음 실행이 자동 재시도 |

## 6. 보안

- **GitHub 토큰**: fine-grained PAT, `khudt-org/webfortd` 한정 `contents:write`만. Vercel 서버 환경변수(`GITHUB_CONTENT_TOKEN`), 클라이언트 절대 비노출. **수용 한계**: PAT는 경로 단위 제한이 불가능해 탈취 시 repo 전체 쓰기가 열린다 — 시범 규모에서는 서버 측 경로 화이트리스트 + 주기 회전(§11)으로 위험을 수용하고, GitHub App 전환·콘텐츠 repo 분리는 후속 검토로 남긴다(부록 R3).
- **경로 화이트리스트**: 클라이언트는 slug만 전송. 서버가 kb-index로 slug → 파일 경로를 해석하므로 `content/` 밖·`..` 접근이 구조적으로 불가능. 해석된 경로의 GET이 404면(파일 이동 등 stale index) 명확한 오류로 중단.
- **MDX 구문 차단**: 본문은 **순수 마크다운만 허용**. 반영 전 remark AST 검사에서 MDX 표현식·`import`/`export`·JSX 노드를 거부한다. 근거: next-mdx-remote는 MDX를 컴파일하므로 편집 계정 탈취 시 본문이 곧 코드 주입 표면이 된다 — 기존 콘텐츠는 위원장 단독 작성이라 없던 위협 모델.
- **역할 재검증**: 모든 서버 액션에서 세션 + editor/admin role 확인(클라이언트 노출 여부와 무관하게 서버가 최종 게이트).
- **자원 제한**: 로드·프리뷰·반영 **전부**에 기존 `rate-limit.ts` 재사용 + 본문 크기 상한(200KB).
- **frontmatter 비경유**: §4 프로토콜로 status·slug 등 메타데이터 오염 원천 차단.

## 7. 에러 처리 (3-state 불변식 준수)

§4 상태 모델의 4상태를 항상 구분된 한국어 텍스트로 전달한다.

- **동시 편집 충돌**: SHA 불일치 시 "다른 수정과 충돌했습니다" 통지. **내 편집본은 별도 읽기 영역에 보존**(복사 가능)하고 textarea에는 최신본을 로드한다 — 한 칸에서 두 판본을 섞지 않는다. 재적용 판단은 사용자 몫.
- **검증 거부(사전 차단)**: 반영 전에 서버가 새 본문으로 ① `serialize` 실행(프리뷰와 동일 함수 — 실패하면 프로덕션 렌더도 실패) ② `check-mdx-escape` 검사 ③ MDX 구문 차단(§6)을 통과해야만 커밋한다. **범위 명시**: 이 검증은 본문 구문 결함을 차단하는 것이지 빌드 성공의 완전 보장이 아니다(의존성·인프라 실패는 별개) — 그래서 성공 상태를 "커밋 접수"로 명명한다.
- **통신 실패**: GitHub API 연결·인증 실패(PAT 만료 포함)는 "시스템 연결 문제입니다. 관리자에게 알려 주세요"로 일반 네트워크 오류와 구분. 편집 내용은 유실하지 않는다.
- **초안 유실 방지**: 편집 중 본문을 `localStorage`에 slug+baseFileSha 키로 백업. 세션 만료·브라우저 crash 후 재진입 시 복원을 제안한다(OTP 재로그인이 길어져도 초안 생존).

## 8. 접근성 (헌장 §1·§5 적용)

- `<textarea>` + 연결 `<label>`. 자동 저장 없음(명시 버튼만). 터치 타깃 ≥44px.
- 편집↔프리뷰 토글: 버튼 라벨 전환("프리뷰 보기"↔"편집으로 돌아가기")이 상태 신호. 전환 시 포커스는 토글 버튼에 유지(§5 포커스 이탈 방지).
- 반영 버튼: `aria-disabled` + in-flight ref 가드(더블 클릭 중복 커밋 차단). 결과 통지는 단일 polite live region(4상태 문구).
- 단축키: **Cmd/Ctrl+S = 수정 반영**, **Cmd/Ctrl+E = 편집/프리뷰 전환**. **편집기 컨테이너에 포커스가 있을 때만** 동작(전역 가로채기 금지), 브라우저 기본 동작 preventDefault. 모든 기능은 버튼만으로 완결(단축키는 보조).
- 최종 판정: 위원장 VoiceOver 실기기 실측(리뷰로 대체 불가).

## 9. 테스트

- **unit(node:test)**: frontmatter 바이트 보존 병합 왕복 무손실, slug→경로 화이트리스트(탈출·404 포함), GitHub 래퍼 SHA 충돌·오류 경로(mock fetch), MDX 구문 차단(표현식·import·JSX 거부 케이스), 검증 사전 차단.
- **migration/integration**: `editor_roles` 일반 인증 사용자 insert/update/delete 거부(RLS), editor role의 read 경로.
- **component(vitest)**: 토글 라벨 전환·버튼 상태·live region 4상태 문구·충돌 시 편집본 보존 영역.
- **a11y(playwright+axe)**: 기존 스위트에 editor 페이지 추가.
- **실측 게이트**: 반영 → Vercel 빌드 → 사이트 확인 1회 실호출 + 빌드 산출 함수 수 확인(fixture green ≠ 실계약).

## 10. 범위 제외 (YAGNI)

- WYSIWYG·실시간 라이브 프리뷰·자동 저장(서버)·버전 diff UI·신규 문서 생성·frontmatter 편집·전용 문서 허브·iOS 편집·배포 상태 실시간 추적 UI. 필요가 실증되면 별도 사이클.

## 11. 운영 체크리스트 (구현과 별도, 배포 시점)

1. fine-grained PAT 발급(위원장 GitHub 계정, contents:write 한정) → Vercel 환경변수 등록. **회전 주기(만료일) 캘린더 등록** — 만료 시 전 편집이 "시스템 연결 문제"로 실패한다
2. master ruleset 등록: force push·브랜치 삭제 금지(감사 이력 보전)
3. GitHub Actions Secrets 등록: `GEMINI_API_KEY`, Supabase URL·service_role 키 (야간 sync+embed용)
4. 연구보조원 이메일 `editor_roles` seed (0014 이후 운영 쿼리, 가명 식별자 매핑 확인)
5. 감수자용 1쪽 사용 안내(로그인 → 편집 → 반영 → 몇 분 후 새로고침 확인) + 문제 해결 절차(버튼이 안 보일 때: 로그인 만료/권한 미등록 구분)
6. 런북: Vercel 빌드 실패 이메일 수신 시 대응(revert 절차), 긴급 수정 시 RAG 즉시 갱신은 수동 `kb:sync`+`kb:embed`

## 부록: 적대적 리뷰 처리 기록 (2026-08-04, codex 28건)

**수용(설계 반영)**: 커밋 신원 가명화(공개 repo 개인정보) · MDX 주입 차단 · stateless 제출 프로토콜(frontmatter 바이트 보존) · "커밋 접수" 상태 모델 + 검증 범위 정직화 · SHA 기준 야간 트리거(실패 자동 재시도) · editor_roles write RLS 명시 · ruleset(force push 금지) · 전 액션 rate limit + 크기 상한 · 권한 행렬 분리 · 충돌 시 편집본 분리 보존 · localStorage 초안 · PAT 만료 오류 구분 + 회전 런북 · 단축키 포커스 스코프 · stale index 404 처리 · 함수 수 실측 acceptance.

**기각(근거)**:
- R1 repo 전체 CAS·후보 트리 검증: 코드 변경은 PR 경유(위원장)라 content 편집과 파일 교차가 없고, 시범 규모 비례성 위배. 잔여 위험 수용.
- R2 빌드 간 DB write 경쟁: 무근 — 빌드는 DB에 쓰지 않는다(실코드 확인, `sync:content`=JSON 생성만).
- R3 GitHub App·콘텐츠 repo 분리: blast radius는 인정하되 시범 규모에서 화이트리스트+회전으로 수용. 후속 검토 항목으로만 유지.
- R4 kb:sync 원자성(빈 DB 창): documents는 delete가 아니라 upsert(실코드 확인). backlinks delete+insert는 기존 파이프라인 속성이며 파생 데이터라 재실행 복구 가능 — 본 spec 범위 밖.
- R5 sync·embed writer 경쟁: 같은 야간 잡에서 직렬 실행으로 구조적 소멸(§5). documents upsert는 chunks cascade를 유발하지 않음.
- R6 배포 SHA·임베딩 SHA 엄밀 결합: 야간 배치 단위에서 심야 수 분 어긋남은 시범 규모에서 무시 가능. 수용 한계로 기록.
- R7 모델·청커 fingerprint: 모델 교체는 위원장의 의도적 작업이라 수동 전체 재처리 경로(§11-6)가 정본.
