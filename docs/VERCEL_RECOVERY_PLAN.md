# Vercel 회귀 계획 — engccer Hobby 배포로 임시 운영 (2026-05-26)

> KHUDT 팀 Pro Reactivate 실패(케이스 `01ZB5aczzV9bxDOo`, 응답 SLA 2~3주) 동안 webfortd 빌드 다운을 막기 위한 임시 회귀 계획. **GitHub repo와 Supabase는 KHUDT 명의 그대로 유지**, **Vercel 배포만 engccer 개인 Hobby 계정으로 회귀**. KHUDT 케이스 해결 후 0분 복귀를 전제로 설계.

상위 분석 문서: [VERCEL_PLAN_DECISION.md](VERCEL_PLAN_DECISION.md)

## 사전 점검 결과 (2026-05-26)

| 점검 항목 | 결과 | 비고 |
|----------|------|------|
| `khudt-org/webfortd` visibility | **public** | Hobby의 "private repo in GitHub organization 차단" 정책 우회 |
| Engccer ↔ khudt-org 멤버십 | active member | repo read/write 권한 OK |
| webfortd commit author 분포 | **100% `engccer@gmail.com`** (49/49) | Hobby의 "commit author = Hobby team owner" 조건 자동 충족 |
| 로컬 git config | `Engccer / engccer@gmail.com` | 향후 commit도 동일하게 기록 |
| engccer Vercel `webfortd` 프로젝트 | Ready (마지막 5/22 01:49 deploy) | aliases: `webfortd.vercel.app`, `webfortd-git-master-hunyong-kims-projects.vercel.app` |
| engccer Vercel Git link | repoId `1107250118` (현재 `Engccer/webfortd` 표기) | transfer 후에도 repoId 보존되어 `khudt-org/webfortd` 자동 follow 가능, 명시 갱신 권장 |
| engccer Vercel 환경변수 | `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (4d ago) | **`SUPABASE_SECRET_KEY` + AI 키 누락** — 갱신 필요 |
| Supabase Auth redirect URL | 미확인 | `webfortd.vercel.app`이 KHUDT Supabase의 Auth 허용 목록에 등록되어 있는지 확인 필요 |

### Vercel Hobby private repo 정책 출처

[docs/git §"Using Hobby teams"](https://vercel.com/docs/git):

> You cannot deploy to a Hobby team from a private repository in a GitHub organization, GitLab group, or Bitbucket workspace.
>
> To deploy commits under a Hobby team, the commit author must be the owner of the Hobby team containing the Vercel project connected to the Git repository.

webfortd repo는 **public**이고 commit author는 100% engccer이므로 두 조건 모두 자동 충족. **회귀 가능**.

## 실행 단계

### Step 1 — engccer Vercel Git link 명시 갱신 (5분, CLI 가능)

GitHub repo가 `Engccer/webfortd` → `khudt-org/webfortd`로 transfer된 후 Vercel이 repoId(`1107250118`)로 자동 follow하지만, 향후 push에 webhook이 정상 작동하도록 명시 갱신.

**방법 A — Vercel 대시보드 UI** (위원장 접근성 부담)
- engccer 계정으로 https://vercel.com/hunyong-kims-projects/webfortd/settings/git 접속
- Connected Git Repository → Disconnect → Connect with `khudt-org/webfortd` 다시 선택

**방법 B — Vercel REST API** (접근성 우선, 자동화 권장)
```bash
# 임시 디렉터리에서 engccer webfortd로 link 후 실행
TOKEN=$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")
curl -X PATCH "https://api.vercel.com/v9/projects/prj_RwwssLdPUfk1HIWNW7UGxzdi5HQO/link?teamId=team_66LLUVeTidGmTUOdF9ESgxuf" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"github","repo":"khudt-org/webfortd"}'
```

### Step 2 — 환경변수 갱신 (10분, CLI 가능, 위원장 확인 필요)

engccer Vercel webfortd에 KHUDT Supabase + AI 키 모두 등록. **secret 값은 위원장 로컬 `~/Mac-Projects/webfortd/.env.local`에서 가져옴**.

```bash
# 임시 디렉터리에서 engccer webfortd로 link 한 상태에서 실행
cd /tmp && mkdir webfortd-engccer && cd webfortd-engccer
vercel link --yes --project webfortd --scope hunyong-kims-projects

# 1. KHUDT Supabase URL/ANON_KEY 갱신 (이미 등록된 값이 KHUDT 거라면 skip 가능)
#    위원장 .env.local의 NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY 값을 그대로
echo "<KHUDT Supabase URL>" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --force
echo "<KHUDT Supabase ANON KEY>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --force

# 2. SUPABASE_SECRET_KEY (서버 사이드, 신규 추가)
echo "<KHUDT Supabase SECRET KEY>" | vercel env add SUPABASE_SECRET_KEY production --sensitive

# 3. SITE_URL을 engccer 도메인으로
echo "https://webfortd.vercel.app" | vercel env add NEXT_PUBLIC_SITE_URL production --force

# 4. AI 키 (코드가 어떤 키를 쓰는지에 따라 — AI Gateway OIDC라면 자동, 직접 API key라면 추가 필요)
#    src/app/api/chat/route.ts는 `gateway('google/gemini-3.5-flash')` 사용 → Vercel AI Gateway OIDC 자동
#    별도 환경변수 불필요. (직접 Google API 사용 시에만 GOOGLE_GENERATIVE_AI_API_KEY 등 추가)
```

### Step 3 — KHUDT Supabase Auth redirect URL 등록 확인/추가 (5분)

매직링크 redirect 도메인 허용. 5/21까지 engccer에서 작동했으므로 이미 등록돼 있을 가능성 높음.

**확인 (Supabase 대시보드)** — khudt@khudt.net 계정으로 로그인:
- https://supabase.com/dashboard/project/djaeeqdxkynjxngwvzyn/auth/url-configuration
- Site URL: 운영용 도메인 (KHUDT 운영 중이라면 KHUDT 도메인 그대로 두고)
- Additional Redirect URLs에 `https://webfortd.vercel.app/**` 포함 여부 확인
- 없으면 추가

### Step 4 — 배포 트리거 (5분, CLI 가능)

```bash
# master 브랜치에 빈 commit 또는 Vercel 대시보드 Redeploy
cd ~/Mac-Projects/webfortd
git checkout master
git pull --rebase
# 빈 commit 트리거
git commit --allow-empty -m "chore(vercel): trigger redeploy from engccer scope (KHUDT 케이스 대기 회귀)"
git push origin master

# 또는 임시 디렉터리에서 직접 deploy
cd /tmp/webfortd-engccer
vercel deploy --prod
```

### Step 5 — 동작 검증 (10분)

```bash
# 1. 배포 상태
curl -sI https://webfortd.vercel.app | head -5  # HTTP 200 확인

# 2. 채팅 API smoke (RAG 응답 + source_refs 포함 확인)
#    Phase 3 M3 smoke 절차: docs/M3_SMOKE_PROCEDURE.md 참조

# 3. Supabase 매직링크 redirect 동작 (브라우저 수동 — 위원장 자녀/배우자 등에게 위탁 가능)
#    https://webfortd.vercel.app/sign-in → 위원장 이메일 → 링크 클릭 → 정상 로그인
```

## KHUDT 복귀 절차 (Vercel 케이스 회신 후)

KHUDT 팀 Pro Reactivate 성공 시점에 즉시 복귀:

| 단계 | 작업 | 비고 |
|------|------|------|
| 1 | KHUDT Vercel webfortd 프로젝트 GitHub 연결 확인 — 그대로 `khudt-org/webfortd` 가리키는지 | 변경 안 됐다면 skip |
| 2 | KHUDT Vercel webfortd 환경변수 그대로 살아있는지 확인 (4일 전부터 변경 없으면 OK) | 변경됐다면 `vercel env pull`로 비교 후 동기화 |
| 3 | engccer Vercel webfortd 배포 중단 (Settings → Git → Disconnect 또는 Pause) | 또는 master push 후 KHUDT 측만 빌드되도록 engccer 측 GitHub webhook 해제 |
| 4 | KHUDT 측 master push 또는 Redeploy 트리거 | 자동 빌드 |
| 5 | 동작 검증 (Step 5와 동일) | 정상 시 회귀 종료 |
| 6 | webfortd CLAUDE.md "프로젝트 정체성" 표 갱신 — 임시 회귀 메모 제거 | |
| 7 | 본 문서에 회귀 종료 일자 추가 | |

복귀 소요 시간: **5~15분** (환경변수 변경 없었을 경우)

## 위험 및 완화

### R1 — Vercel Hobby plan의 commercial use 잠재 신고/검토

webfortd가 노조 운영 + 중부대 사업 자산이라 Vercel Fair Use상 commercial에 가까움 (donations 안내, 사업 협상 자산). engccer 회귀 후에도 정책상 잠재 위험은 동일.

**완화**: 단기(~3주) 운영은 자동 차단 가능성 낮음. 자동 분석이 아닌 신고 기반이므로. 노조 공식 안내 채널에서 webfortd 임시 도메인 노출 최소화.

### R2 — engccer 계정에 별도 commit author push 시 deploy 차단

향후 협업자 추가 또는 GitHub PR merge bot 같은 commit이 들어오면 author 다양성 발생 → Vercel이 collaboration 감지 → deploy 차단.

**완화**:
- 회귀 기간 동안 webfortd PR merge는 **반드시 위원장 본인 계정으로** (Squash merge 시 GitHub UI의 default committer는 GitHub Actions bot일 수 있으므로 주의 — Squash 옵션을 "Use commit metadata" 또는 위원장 author로 명시 선택)
- claude-code 등 AI agent의 commit도 위원장 git config(`engccer@gmail.com`) 그대로 사용 → 본 문서 작성 시점에 이미 통일됨, 변경 불필요
- 외부 협업자(중부대 위탁 사업 측 등)는 회귀 기간 동안 PR 머지 보류 또는 위원장 cherry-pick으로 author 통일

### R3 — engccer Vercel 환경변수가 .env.local과 drift

수동 입력이라 오타·누락 가능.

**완화**:
- Step 2 직후 `vercel env pull .env.production.local` (임시 디렉터리에서) → `.env.local`과 diff로 차이 검사
- 비교 스크립트 권장:
  ```bash
  cd /tmp/webfortd-engccer && vercel env pull .env.compare --environment=production --yes
  diff <(grep -o '^[A-Z_]*=' .env.compare | sort) <(grep -o '^[A-Z_]*=' ~/Mac-Projects/webfortd/.env.local | sort)
  ```

### R4 — Supabase Auth redirect URL 누락

이전 deploy 시점에 등록됐을 가능성 높지만, 그 사이 위원장이 KHUDT 운영 시 Site URL을 KHUDT 도메인 단독으로 좁혔다면 engccer 회귀 시 매직링크 깨짐.

**완화**: Step 3에서 명시적 확인. Additional Redirect URLs에 `https://webfortd.vercel.app/**` 포함 보장.

## 출처

- [Vercel docs/git — Using Hobby teams](https://vercel.com/docs/git) (인용: "You cannot deploy to a Hobby team from a private repository in a GitHub organization" / "the commit author must be the owner of the Hobby team")
- [Vercel Community: Deployment blocked because commit author does not have contributing access](https://community.vercel.com/t/vercel-deployment-blocked-because-commit-author-does-not-have-contributing-access-on-hobby-plan/36192)
- [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (commercial use 정책)
- [Vercel env-vars 스킬 가이드](https://vercel.com/docs/environment-variables)
- 본 webfortd repo 자가 검증 (commit author 분포, repo visibility, engccer Vercel 프로젝트 상태)
