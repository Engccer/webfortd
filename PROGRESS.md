# PROGRESS

> 현재 상태·다음 단계·미결 결정만 담는다(자율성 헌장 §문서화 규율). 항구 원칙은 CLAUDE.md, 날짜별 이력은 CHANGELOG.md, 열린 항목·판정 대기·이월은 docs/BACKLOG.md, PR 단위 상세는 git log.

## 현재 상태 (2026-08-29)

- **웹**: Phase 1~4·A·B·7 완료. production https://webfortd.vercel.app (engccer Hobby 임시 운영, KHUDT Pro는 결제 락 — 복귀는 §미결 결정). Hobby 함수 12개 제한 아래 함수 9개로 배포 정상(2026-07-17 `[...kb]` catch-all 통합 이후).
- **2층 마크다운 정본 v4 4종 완비(2026-08-28)**: `data/source-md/*_fused_v4_*.md`(v3는 `data/source-md/v3/` 보존).
- **3층 재생성 완료(2026-08-29, BACKLOG C5 종결)**: 4종 파생 363건(research 92·hr 71·jbu 69·staff 131), outline 주소 체계(`docs/DECOMPOSE_V2_DESIGN.md`), 대응표 `docs/slug-migration-2026-08.csv`, 회귀 표 `docs/regression-2026-08-review48.md`. **전부 draft** — 2차 검증(9/6 마감) 뒤 `npm run kb:bootstrap` 일괄 공개 → `content/.embed-paused` 삭제 → 야간 sync+embed 재개(임베딩 1회). 그때까지 production 4종 문서는 「검토 중」, 채팅 RAG는 DB의 v3 청크 유지.
- **콘텐츠 baseline**: `content/` 422건 = published 59(단체협약 49 + resources 10) + draft 363(4종) + draft 9(FAQ). 축 7개. RAG 청크는 DB 기준 2775(v3, 재임베딩 전).
- **웹 콘텐츠 편집기 운영 중**(2026-08-04, PR #113): `(wiki)/editor`, GitHub PAT·Actions Secrets 등록 완료, 야간 sync+embed 워크플로(`nightly-embed.yml`, `LAST_EMBED_SHA` 게이트) 가동, production 실호출 통과. 잔여는 운영 잔무·VoiceOver 실측(BACKLOG §A8·§B).
- **iOS 네이티브 v1**: 5탭(위키·채팅·자료실·미디어·설정) + 홀드 받아쓰기(채팅·위키 검색), 오프라인 위키 535건, OTP 인증·이력. Kit 테스트 49 green. iPhone 13 Pro 실기기 배포 상태(`ios/deploy-device.sh`), 서명 팀 72JQ7VD4V5(Apple Developer Program 유료, 2026-07-12 승인). TestFlight 미제출(준비물 BACKLOG §D). 정본 spec `docs/superpowers/specs/2026-07-10-ios-native-app-design.md`, 배포 절차 `docs/IOS_DISTRIBUTION.md`.
- **테스트 baseline**(2026-08-04): unit 411 / component 190 / a11y 35 / integration RLS 5(실 DB; 기존 migrations 8건은 드리프트 실패 중 — BACKLOG E5).
- **공식 사업 트랙**(2026-07-14): 과업요청서 최종본 중부대 전달 완료, 수행사 선정·계약은 중부대 주관. webfortd는 독립 레퍼런스 트랙(`docs/DIRECTION_2026.md` §11).
- **서버 공용 자산**: Bearer 이중 인증(`src/lib/supabase/request-auth.ts`) + `GET /api/chat/threads/[id]`(iOS·웹 이력 복원 공용).

## 다음 단계

1. **위원장 실측 게이트 일괄**(BACKLOG §A): iOS 실기기(비행기 모드·VoiceOver 로터/표·OTP 플로), 편집기 VoiceOver 편집 흐름, 웹 hero 검색·라이브 음성 실 마이크, 애니메이션 feel check.
2. 게이트 통과 후 iOS TestFlight: 판매자명 결정(§미결 결정) → App Store Connect 앱 레코드 → Archive → 내부 테스터(`docs/IOS_DISTRIBUTION.md` §3). 준비물은 BACKLOG §D.
3. 편집기 운영 잔무(BACKLOG §B): 연구보조원 `editor_roles` seed(이메일 수령 시), 안내 전달, PAT 만료 캘린더, 런북.
4. **3층 후속(8/27 메모 §6 6~11단계)**: 드라이브 `3. 위키 문서/` 스냅샷 교체·검수 시트 v2(대응표 CSV 적용)·재생성 안내문 게시(8/30) → 2차 검수팀 회의 → 2차 검수 마감(9/6) → `kb:bootstrap` 일괄 공개 + `.embed-paused` 삭제 → 수행사 전달(9/7 회의 이후). 2층 제목 승격 누락 2건(BACKLOG C8)은 2차 검증 전 반영.

## 미결 결정 (위원장)

| 항목 | 내용 | 근거 문서 |
|------|------|-----------|
| KHUDT Pro 재활성(1안) 실행 시점 | 배포는 2안(PR #100)으로 정상. Pro 복귀는 사업 자산 명의 정합 목적으로 유효한 옵션 — Billing에 Reactivate Pro 버튼 활성 + MasterCard •••• 2970 등록 확인(2026-07-17). 월 $20 결제라 위원장 실행 몫(5~15분) | `docs/VERCEL_RECOVERY_PLAN.md` |
| App Store 판매자명 | 개인(김헌용, 현재 가입 상태 그대로) vs 조직(장교조 명의, D-U-N-S 필요). Developer Program 가입·비용 게이트는 2026-07-12 해소됨 | `docs/IOS_DISTRIBUTION.md` §1 |
| 앱 아이콘 디자인 방향 | 1024×1024 미제작. "장애인교원 위키" 정체성을 담은 신규 제작 필요 | `docs/IOS_DISTRIBUTION.md` §2 |
| M5 라이브 음성 재개 시점 | dodo-planet Live 오류 수정·검증 후 이식(2026-07-10 지시) | iOS spec §4.4 |
| LICENSE·저작권 표기 | 공개 저장소이자 사업 자산이라 저작권 주체·라이선스는 위원장 결정 | BACKLOG F1 |
