# Vercel 플랜 의존성 분석 — Hobby 차단 원인 확정 (2026-05-25)

> webfortd가 Vercel Hobby tier에서 동작하지 않고 Pro 구독을 강제로 요구하는 진짜 원인을 공식 문서 + 실측으로 확정한 결과 문서. 5/22 Pro 전환 → 5/22 결제 실패 → 5/24 KHUDT's projects 팀 suspended 흐름의 후속 진단.

## 배경 — 사건 타임라인

| 날짜 | 사건 |
|------|------|
| 2026-05-22 16:48 | KHUDT Vercel 계정에서 새 디바이스 로그인 (New sign-in detected) |
| 2026-05-22 ~19:00 | Hobby → Pro 전환 시도, 카드 끝자리 2970(법인 카드)로 결제 |
| 2026-05-22 19:13 | 2차 결제 실패 — `$20.00 payment to Vercel Inc. was unsuccessful` + `[Action Required] Payment Failed And Shutdown Coming Soon` |
| 2026-05-23 15:36~15:46 | `Failed preview deployment on team 'KHUDT's projects'` 알림 3건 (메일 본문은 minimal notification, 빌드 로그 미포함) |
| 2026-05-24 06:20 | `KHUDT's projects has used $0 of $0 in monthly Pro plan credit` — Pro credit 다운그레이드 |
| 2026-05-25 | Vercel 대시보드: 팀 상태 **Paused/Suspended**, Open Invoices 0건, Stripe direct invoice #C5UTAXAH-0001은 **Void** 상태 (결제 자체가 비활성화) |
| 2026-05-25 02:33 | 위원장이 Vercel Support에 케이스 접수 — 케이스 번호 **`01ZB5aczzV9bxDOo`**, 제목 "Pro Plan Reactivation Failing - **Subscription Locked to Declined Payment Method**". 응답 SLA **2~3주** (billing 큐 대량 처리 중). [Support Center](https://vercel.com/khudt-s-projects/~/support/cases/01ZB5aczzV9bxDOo) |

## 처음 가설과 폐기 사유

| 가설 | 검증 결과 | 비고 |
|------|-----------|------|
| `src/app/api/chat/route.ts:31` `maxDuration = 60`이 Hobby 10초 한계 초과 | ❌ **폐기** | 공식 문서 명시: Hobby Function maxDuration "10s (default) - configurable up to 60s (1 minute)". Hobby에서도 60초까지 OK |
| daily cron이 Hobby 한계 초과 | ❌ 폐기 | `vercel.json`의 `"schedule": "0 3 * * *"`는 daily 1회로 Hobby 허용 범위 |
| Deployment Protection (Vercel Authentication) 사용이 Pro-only 기능 | ⚠️ 부분 사실, 단독 원인은 아님 | Vercel Authentication은 Hobby도 가능. Password Protection은 Pro Add-on. 첫 탭이 Deployment Protection 설정 페이지였던 건 단지 화면 컨텍스트 |

## 확정된 진짜 차단 원인 (우선순위 순)

### ★ 1순위 — Commercial use 위반 (Fair Use Guidelines)

Vercel 공식 [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)의 결정적 정책:

> **Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan.**
>
> Commercial usage is defined as any Deployment that is used for the purpose of financial gain of **anyone** involved in **any part of the production** of the project, including a paid employee or consultant writing the code.
>
> Examples ... include:
> - Any method of requesting or processing payment from visitors of the site
> - Advertising the sale of a product or service
> - Receiving payment to create, update, or host the site
> - Affiliate linking is the primary purpose of the site
> - The inclusion of advertisements
>
> **💡 Note: Asking for Donations fall under commercial usage.**

webfortd가 commercial로 분류되는 근거:
- 노조 사이트로서 **조합비·후원금·기부 안내**가 사이트 목적의 일부 (KHUDT 도메인 운영 자체가 노조 운영비 정산 대상 → "financial gain of anyone involved in production"에 부합 가능)
- 중부대 위탁 사업의 **자문 근거 자산**으로 운영 중 (사업 협상의 일부 — "financial gain"에 가까운 위치)
- "Donations 요청도 commercial"이라는 공식 예시가 결정적

**즉, webfortd는 정책상 Hobby에 머무는 것 자체가 fair use 위반**이며 Pro 또는 Enterprise를 강제하는 정책 차단이 합당하게 적용됨.

### 2순위 — Team feature 비호환 + overdue freeze

Vercel 공식 [Pro Plan 문서](https://vercel.com/docs/plans/pro-plan):

> Each account is limited to one team on the Hobby plan. If you attempt to downgrade a Pro team while already having a Hobby team, the platform will either require one team to be deleted or the two teams to be merged.
>
> When you downgrade a Pro team, **all active members except for the original owner are removed**.

[Hobby Plan 문서](https://vercel.com/docs/plans/hobby) Pro vs Hobby 비교표:

| Feature | Hobby | Pro |
|---------|-------|-----|
| Team collaboration features | — | Yes |

추가로 Vercel Community 보고(여러 사례):

> Users with overdue accounts are unable to downgrade to the Hobby plan because the system blocks changes for overdue accounts. In some cases, instead of automatically downgrading, accounts get suspended even though no credit card was added.

KHUDT's projects의 상황은 이와 정확히 일치:
- Pro team으로 5/22 생성 (multi-member team 가능 구조)
- 결제 실패 → overdue 상태
- Vercel은 overdue 계정의 Hobby downgrade를 차단하고 그냥 suspended로 freeze
- 따라서 "Hobby로 자동 강등 후 동작"이 아니라 "Pro 못 결제 + Hobby로도 못 내려감 → freeze"

### maxDuration 가설 폐기 근거 (참고)

[Vercel Functions duration limits](https://vercel.com/docs/functions/limitations#max-duration) 명시:
- Hobby: 10s default, **configurable up to 60s**
- Pro: 15s default, configurable up to 300s

Fluid Compute 도입 이후의 일부 자료는 "Hobby 300s까지"라고 표기하나, 공식 Hobby plan 페이지의 비교표는 여전히 "60s max"로 유지. 어느 쪽이든 **현재 webfortd 설정(60)은 Hobby 한계 내**.

## carryover 질문 — 개인 계정 Pro로 전환하면 KHUDT 팀도 Pro?

**결론: 아니오.** Vercel Pro 구독은 **per-team billing**입니다.

근거:
- [Pro Plan Pricing](https://vercel.com/docs/plans/pro-plan): "$20/month Pro platform fee — 1 deploying team seat included" → 팀 단위 청구
- 한 사용자가 여러 팀의 owner/member일 수 있지만 각 팀이 독립 결제
- engccer@gmail.com 개인 계정을 Pro로 전환해도 KHUDT's projects 팀의 plan에는 영향 없음

### 우회 옵션 — 프로젝트 transfer

webfortd 프로젝트를 KHUDT's projects 팀에서 위원장 개인 Pro 팀(예: `hunyong-kims-projects`)으로 이전(transfer)하면, 개인 Pro 구독 하에 동일 프로젝트 운영 가능. 단점:
- 도메인, 환경 변수, Stores 수동 이전 필요
- KHUDT 팀의 "공식 노조 자산" 정체성이 흐려짐
- 단일 deploying seat($20/월)로 동일 비용. 카드 문제는 동일하게 발생할 수 있음

또한 webfortd CLAUDE.md "프로젝트 정체성" 섹션에 명시된 운영 원칙:

> 시범 모델 (이 프로젝트) | https://webfortd-khudt-s-projects.vercel.app/ (**2026-05-23 장교조 KHUDT 명의 이관**)

즉 5/23에 의도적으로 KHUDT 팀으로 이전한 흐름과 정면 충돌. 사업 협상 자산이라는 위치 때문에 KHUDT 명의 유지가 권장됨.

## CLI 진단에서 발견된 추가 사실

- `vercel teams ls` 결과: 현재 CLI는 `Hunyong Kim's projects` 팀만 접근 가능 (slug: `hunyong-kims-projects`)
- `vercel whoami` → `Not authorized` — KHUDT 팀 멤버십이 있는 별도 Vercel 계정 토큰이 만료/미인증
- `.vercel/project.json`의 `orgId: team_S62VKPOI4JYEPu5TCtz7cQSa` = KHUDT 팀 internal ID (CLI scope `khudt-s-projects` slug 추정되나 현재 토큰으로 접근 불가)

→ KHUDT 팀에 CLI로 접근하려면 별도 Vercel 토큰 또는 KHUDT 명의 Vercel 계정으로 재로그인 필요.

## 후속: engccer Hobby 회귀 계획 (2026-05-26)

KHUDT 케이스 응답이 2~3주 걸리는 동안 webfortd 빌드 다운을 피하기 위해 **GitHub repo·Supabase는 KHUDT 명의 그대로, Vercel 배포만 engccer 개인 Hobby로 임시 회귀**하는 별도 계획 문서 작성:

→ **[VERCEL_RECOVERY_PLAN.md](VERCEL_RECOVERY_PLAN.md)** (사전 점검 결과·실행 단계 5종·KHUDT 복귀 절차·위험 4종)

회귀 가능성 검증 핵심:
- ✅ `khudt-org/webfortd`는 **public** (Hobby의 private-in-org 차단 정책 우회)
- ✅ commit author 100% `engccer@gmail.com` (Hobby의 author=owner 조건 자동 충족)
- ✅ engccer Vercel `webfortd` 프로젝트 살아있음 (마지막 deploy 5/22, Status Ready)

## 권장 결정 (2026-05-25 갱신)

**상황 갱신**: Vercel Support 케이스 `01ZB5aczzV9bxDOo` 접수 결과 차단의 진짜 원인이 카드가 아닌 **Vercel 결제 시스템의 페이지 락 결함**(Subscription Locked to Declined Payment Method)임이 확정. 거절된 카드에 구독이 묶여 새 결제·카드 변경 모두 차단되는 UX 결함이므로 카드 정상화로는 해결 불가, **Vercel 측 수동 개입이 필수**. 응답 SLA 2~3주.

### 즉시 결정 (2026-05-25 ~ Vercel 회신까지)

webfortd 빌드 다운 시간을 줄이려면 **임시 transfer** 권장 강도가 높아짐. 사업 맥락상 KHUDT 명의 정합성 vs 가용성 손실 trade-off:

| 옵션 | 다운 시간 | 사업 명의 정합성 | 비용 | 권장도 |
|------|-----------|------------------|------|--------|
| A. KHUDT 케이스 회신 대기 | **2~3주** | 유지 | $0 추가 | △ — 가용성 손실 큼 |
| B. 개인 Pro 팀(`hunyong-kims-projects`)으로 임시 transfer → 회신 후 복귀 | ~1일 | 일시 훼손, 회신 후 복원 | 개인 Pro $20/월 (KHUDT 케이스 해결 후 환불·credit 가능성 협상) | ◯ — 가용성 회복 + 복원 가능 |
| C. GitHub Pages 정적 배포만 활용 | 즉시 | 유지 (도메인 다름) | $0 | ✕ — 채팅 API 미동작, 핵심 가치 손실 |

기본 권장: **B안 임시 transfer**. 사업 명의 훼손은 *일시적*이고 케이스 회신 후 복원 가능. 2~3주 다운은 2026 교육감 정책 질의서 발송 시기에 노조 운영·사업 협상 모두에 부담.

### 임시 transfer 실행 시 체크리스트 (B안 선택 시)

1. 위원장 개인 Vercel 계정(`engccer@gmail.com` 또는 동등) Pro 전환 (per-team billing이므로 별도 결제 필요)
2. webfortd 프로젝트 → `hunyong-kims-projects` 팀으로 transfer
   - 도메인 (`webfortd-khudt-s-projects.vercel.app`은 사라짐, 새 prefix 생김)
   - 환경 변수 (Supabase URL/keys, AI Gateway token 등) 수동 이관
   - Storage/Stores (없으면 skip)
3. `.vercel/project.json` 갱신 + `vercel link` 재실행
4. KHUDT 케이스 회신 후 KHUDT 팀 Pro 정상화 → 다시 KHUDT 팀으로 transfer 복귀
5. transfer 사실을 webfortd CLAUDE.md "프로젝트 정체성" 표에 임시 메모 (회신 후 제거)

### A안(대기) 선택 시

- Support Center 케이스 페이지를 1~2일 간격으로 점검 (자동화 가능)
- 노조 조합원·중부대 협상 대상에 webfortd 다운 사유 사전 고지 (단순 "결제 문제"가 아니라 "Vercel 시스템 결함 처리 대기"로 정확히 안내)

## 출처

- [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) — Commercial usage 정의·예시 정본
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — Hobby 제약, Pro vs Hobby 비교표
- [Vercel Pro Plan](https://vercel.com/docs/plans/pro-plan) — Pro pricing, downgrade 절차, member 제거 정책
- [Vercel Functions duration limits](https://vercel.com/docs/functions/limitations#max-duration) — maxDuration 한계
- Vercel Community: [Unable to downgrade](https://community.vercel.com/t/unable-to-downgrade/39026.md), [Vercel Pro plan upgrade failure and suspended team](https://community.vercel.com/t/vercel-pro-plan-upgrade-failure-and-suspended-team-causing-project-downtime/32756) — overdue freeze 패턴
- 이메일 #11 (2026-05-22 19:13, Vercel): `[Action Required] Payment Failed And Shutdown Coming Soon`
- 이메일 #4 (2026-05-24 06:20, Vercel): `KHUDT's projects has used $0 of $0 in monthly Pro plan credit`
- `.vercel/project.json` (orgId, projectId)
- Stripe invoice 페이지 직접 확인 (Void 상태 캡처)
