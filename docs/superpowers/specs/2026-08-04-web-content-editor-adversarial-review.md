제공된 spec만 근거로 검토하겠습니다. 파일 조회와 셸 실행은 하지 않고, 개별 기능보다 “서로 맞물릴 때 깨지는 불변식”을 중심으로 공격하겠습니다.
핵심 결론은 이미 분명합니다. 이 spec은 파일 단위 SHA 충돌은 다루지만, 커밋 SHA, 배포 SHA, DB 동기화 SHA, 임베딩 SHA를 하나의 버전으로 묶지 않아 “반영 완료”라는 상태를 정합하게 정의하지 못합니다. 이제 심각도와 실제 실패 시나리오별로 정리하겠습니다.
## 총평

**승인 보류가 맞습니다.** 현재 설계는 파일 단위 동시 편집은 어느 정도 막지만, 다음 다섯 버전을 하나의 일관된 상태로 묶지 못합니다.

`편집 기준 SHA → master SHA → Vercel 배포 SHA → DB sync SHA → embedding SHA`

특히 `GitHub PUT 성공`을 “반영 완료”라고 부르는 것이 가장 위험합니다. 실제로는 커밋 접수에 불과하며, 이후 빌드·DB 동기화·배포는 각각 독립적으로 실패하거나 순서가 뒤집힐 수 있습니다.

## 1. git-backed 커밋 흐름

1. **[심각도 P1] 파일 SHA는 저장소 전체에 대한 낙관적 잠금이 아니다.**  
   구체 시나리오: 감수자가 문서를 SHA A에서 열고 편집하는 동안, 다른 사람이 master에서 렌더러·검증 규칙·kb-index를 변경한다. Contents API PUT은 대상 파일이 그대로면 최신 master 위에 편집 커밋을 성공시킬 수 있다. 그러나 서버 사전 검증은 이전 배포 코드로 수행되어 새 master와의 조합을 검증하지 못한다.  
   설계 수준 권고: 편집 기준을 파일 SHA뿐 아니라 branch head commit SHA에 묶어야 한다. 알려진 base commit에서 후보 tree를 만들고 branch ref를 compare-and-swap하거나, 사용자에게 git을 노출하지 않는 내부 임시 브랜치와 자동 PR 흐름으로 전환한다.

2. **[심각도 P1] master 직행과 “빌드 실패 사전 차단”은 동시에 보장할 수 없다.**  
   구체 시나리오: PUT이 성공한 뒤 Vercel webhook 누락, 빌드 제한, 의존성 오류, Supabase 장애 또는 실제 `next build` 오류가 발생한다. master에는 깨진 커밋이 남지만 사이트는 이전 배포 상태다.  
   설계 수준 권고: 완전한 사전 차단이 목표라면 후보 커밋 전체를 CI에서 검증한 뒤 merge해야 한다. master 직행을 고수한다면 사전 차단이라는 표현을 버리고, 배포 실패 감지와 자동 revert를 필수 복구 경로로 설계해야 한다.

3. **[심각도 P1] “반영 완료” 상태가 너무 일찍 선언된다.**  
   구체 시나리오: GitHub PUT 응답은 성공했지만 Vercel 빌드는 실패한다. 감수자는 완료 안내를 믿고 사이트를 확인하지만 내용이 바뀌지 않는다. 현재 3-state 모델로는 이를 성공이나 통신 실패 중 어디에도 정확히 넣을 수 없다.  
   설계 수준 권고: 최소한 `검증 거부`, `충돌`, `커밋 접수`, `빌드 중`, `배포 완료`, `배포 실패`, `임베딩 대기` 상태를 구분한다. 최종 “사이트 반영 완료”는 실제 production deployment의 commit SHA를 확인한 뒤에만 표시한다.

4. **[심각도 P1] Vercel 빌드 간 DB write 경쟁이 통제되지 않는다.**  
   구체 시나리오: 커밋 A와 B가 연속으로 올라가 빌드 두 개가 겹친다. B의 sync가 먼저 끝난 뒤 A의 느린 sync가 나중에 끝나면 DB가 오래된 A 상태로 되돌아갈 수 있다. 이전 빌드가 취소되더라도 sync 도중 취소되면 외부 DB 변경은 되돌아가지 않는다.  
   설계 수준 권고: production sync를 직렬화하고, DB에 적용하려는 commit이 현재 적용 SHA보다 오래된 경우 거부해야 한다. commit SHA를 sync 메타데이터로 저장하고 ancestry 또는 단조 증가 규칙을 검사한다.

5. **[심각도 P2] git 이력을 감사 로그로 보는 가정이 성립하지 않는다.**  
   구체 시나리오: branch protection이 없으므로 force push나 branch 삭제로 이력을 다시 쓸 수 있다. PAT 명의의 커밋 메시지에 이메일을 넣는 것만으로 실제 OTP 사용자가 해당 수정을 했다는 강한 증명도 되지 않는다.  
   설계 수준 권고: force push와 branch 삭제를 금지하는 ruleset을 둔다. 편집 커밋에는 인증 사용자 UUID, base SHA, 대상 경로를 구조화된 trailer로 남기고, GitHub App 또는 전용 bot identity를 사용한다.

6. **[심각도 P2] 공개 저장소 커밋 메시지에 감수자 이메일을 영구 공개한다.**  
   구체 시나리오: 연구보조원의 개인 이메일이 public git history에 남아 검색·수집된다. 나중에 커밋을 revert해도 원래 객체와 포크에서 제거되지 않는다.  
   설계 수준 권고: 공개 이력에는 내부 editor ID나 가명 식별자를 남기고, 이메일은 별도의 접근 제한 감사 기록으로 관리한다. 최소한 사전 고지와 동의가 필요하다.

## 2. 보안

7. **[심각도 P1] fine-grained PAT의 실제 피해 범위는 `content/**`로 제한되지 않는다.**  
   구체 시나리오: 서버 액션 취약점, 환경변수 노출 또는 토큰 탈취가 발생한다. 토큰 권한은 애플리케이션의 경로 화이트리스트와 별개이므로 공격자는 저장소의 애플리케이션 코드와 설정까지 수정할 수 있다.  
   설계 수준 권고: 만료가 짧은 GitHub App installation token을 우선 사용한다. 강한 경로 격리가 필요하면 콘텐츠를 별도 저장소로 분리한다. 토큰 만료·회전·폐기 절차와 누출 경보도 운영 요건에 포함한다.

8. **[심각도 P1] MDX 본문을 신뢰 입력처럼 serialize하고 렌더한다.**  
   구체 시나리오: 권한 탈취 계정이 MDX expression, import/export, raw HTML 또는 위험한 컴포넌트 속성을 입력한다. 문법 컴파일은 성공하지만 프리뷰나 공개 페이지에서 능동 코드 또는 위험한 콘텐츠가 실행될 수 있다. 프리뷰 자체가 감수자 세션을 공격하는 경로가 될 수도 있다.  
   설계 수준 권고: 편집 가능한 마크다운 방언을 명시하고 MDX expression, import/export, raw HTML, 허용되지 않은 JSX를 AST 단계에서 거부한다. 컴포넌트와 URL scheme을 allowlist하고 프리뷰는 격리된 sandbox로 렌더한다.

9. **[심각도 P1] 역할 테이블의 권한 상승 방지가 spec에 없다.**  
   구체 시나리오: `editor_roles`에 기존 RLS 정책이 없거나 인증 사용자의 insert/update를 허용하면 일반 사용자가 자신의 행을 `editor`로 만들 수 있다. check constraint 완화는 이 공격을 막지 않는다.  
   설계 수준 권고: 역할 부여와 회수는 service role만 가능하도록 명시적인 RLS와 권한 회수 정책을 둔다. 이메일보다 Supabase user UUID를 권한의 정본 키로 사용하고, 일반 인증 사용자에 대한 insert/update/delete 거부 테스트를 추가한다.

10. **[심각도 P2] 경로 화이트리스트가 배포 시점의 kb-index에 의존한다.**  
    구체 시나리오: 배포된 서버의 slug 매핑은 오래된 상태인데 master에서는 파일이 이동되거나 해당 경로가 다른 문서에 재사용된다. 서버가 오래된 매핑으로 잘못된 파일을 편집할 수 있다. 또한 index에 draft가 포함되면 URL을 직접 호출해 숨겨진 문서를 편집할 수 있다.  
    설계 수준 권고: slug, 파일 경로, frontmatter slug, 허용 status를 동일한 Git commit에서 검증한다. 단순 `content/` 접두사뿐 아니라 정확한 `content/**/*.md` allowlist와 편집 가능 문서 정책을 적용한다.

11. **[심각도 P2] “frontmatter는 서버 보관”의 상태 모델이 정의되지 않았다.**  
    구체 시나리오: 서버리스 액션 사이에는 메모리가 보존되지 않는다. 제출 시 최신 파일을 다시 읽어 최신 SHA를 사용하면 다른 사용자의 본문 변경을 덮어쓸 수 있고, 최초 frontmatter를 클라이언트 상태로 넘기면 “클라이언트 미경유” 주장과 충돌한다.  
    설계 수준 권고: 제출에는 slug, base commit SHA, file SHA만 보내고 서버가 base commit의 원본 파일을 다시 읽도록 한다. frontmatter는 parse 후 재직렬화하지 말고 BOM, 줄바꿈, YAML 주석과 순서를 포함한 원본 byte prefix를 그대로 보존한다.

12. **[심각도 P2] 서버 액션 gate만 있고 자원 소비 제한은 반영 액션에만 있다.**  
    구체 시나리오: 권한 계정이 대형 본문을 반복 preview하여 serialize 비용과 함수 실행 시간을 소진한다. GitHub GET도 반복해 API rate limit을 고갈시킬 수 있다.  
    설계 수준 권고: load, preview, submit 모두에 사용자·문서·IP 단위의 분산 rate limit, 본문 크기 제한, 실행 시간 제한을 둔다. 인메모리 ref와 Vercel 인스턴스 로컬 제한은 보안 경계로 인정하지 않는다.

## 3. 서버 사전 검증 커버리지

13. **[심각도 P1] `serialize + check-mdx-escape`는 실제 빌드 실패의 일부만 막는다.**  
    구체 시나리오: 본문 하나는 serialize되지만 전체 저장소 validation의 중복 ID, 링크·backlink invariant, 전역 색인 생성, page layout 렌더, static generation, 번들 제한 또는 다른 문서와의 상호작용에서 실패한다.  
    설계 수준 권고: 이를 “구문 위험 감소”로 표현해야 한다. 실제 사전 보장은 후보 tree 전체에 `validate:content`, side effect 없는 `sync:content --dry-run`, `next build`를 실행한 경우에만 주장한다.

14. **[심각도 P1] sync 성공 여부는 콘텐츠 사전 검증으로 예측할 수 없다.**  
    구체 시나리오: 본문 검증은 성공하지만 Supabase 인증 만료, schema drift, 네트워크 장애, quota 또는 insert 제약 오류로 sync가 실패한다. delete 이후 insert가 실패하면 DB가 비거나 부분 상태가 된다.  
    설계 수준 권고: delete-then-insert를 transaction 또는 staging table 후 atomic swap으로 바꾼다. 빌드 단계에서는 외부 production DB를 변경하지 않고, 성공한 production deployment의 SHA를 받아 post-deploy sync하는 구조가 안전하다.

15. **[심각도 P2] 프리뷰와 production render가 동일하다는 주장은 과도하다.**  
    구체 시나리오: 프리뷰는 동적 서버 액션에서 본문만 serialize하지만 production은 route layout, metadata, 정적 생성 파라미터, 전역 MDX component registry와 빌드 전용 경로를 함께 실행한다. 프리뷰가 성공해도 production static generation은 실패할 수 있다.  
    설계 수준 권고: “동일 serialize 함수 재사용”으로 범위를 낮춰 표현한다. 동일 렌더 보장이 필요하면 실제 page component를 후보 콘텐츠로 렌더하는 통합 테스트 또는 임시 배포가 필요하다.

16. **[심각도 P2] 함수 수 `9 → 10`은 설계만으로 확정할 수 없다.**  
    구체 시나리오: Next.js 16의 번들·라우트 분할 결과 서버 액션이나 관련 동적 경로가 별도 함수로 계산되어 12개 제한을 넘는다.  
    설계 수준 권고: 빌드 산출물의 실제 함수 수를 CI acceptance criterion으로 둔다. 제한 초과 시 배포 전에 실패시키고 최소 1개 이상의 운영 여유를 확보한다.

## 4. 정적 페이지와 클라이언트 권한 조회

17. **[심각도 P1] `/admin/editor`와 기존 admin middleware가 충돌할 가능성이 크다.**  
    구체 시나리오: 기존 middleware가 `/admin/**`를 admin 전용으로 막고 있다면 새 editor 역할 사용자는 버튼을 보지만 편집 페이지 진입 시 거부된다. 반대로 middleware를 `editor-or-admin`으로 넓히면 admin 대시보드와 Draft Mode까지 editor에게 열릴 수 있다.  
    설계 수준 권고: `/admin/editor`를 별도 route group으로 분리하거나 정확한 경로별 권한 행렬을 정의한다. 기존 `requireAdmin`을 변경하지 말고 `requireEditorOrAdmin`을 별도 추가한다.

18. **[심각도 P2] 클라이언트 버튼은 인증 장애를 무권한 상태처럼 숨긴다.**  
    구체 시나리오: 세션 refresh나 role 조회가 실패하면 권한자도 버튼을 전혀 보지 못한다. 비개발자는 자신이 seed되지 않았는지, 로그인이 만료됐는지, 네트워크가 실패했는지 구분할 수 없다.  
    설계 수준 권고: 로그인 상태, 권한 없음, 권한 조회 실패를 구분한다. 편집 진입을 다시 찾을 수 있는 명시적 “편집 모드” 경로와 재로그인·재시도 안내를 제공한다.

19. **[심각도 P2] 배포 후에도 사용자가 이전 정적 페이지를 볼 수 있다.**  
    구체 시나리오: 새 deployment가 성공했지만 브라우저 router cache, prefetch 또는 열린 탭의 RSC 상태 때문에 편집 직후 같은 URL에서 이전 내용을 계속 본다. 감수자는 배포 실패로 오인한다.  
    설계 수준 권고: 배포 상태 화면에 commit/version을 표시하고, 완료 후 해당 문서를 새로 탐색하거나 강제 갱신할 수 있는 동작을 제공한다. 단순히 “수 분 후 확인”에 맡기지 않는다.

## 5. 임베딩과 sync 정합성

20. **[심각도 P1] Vercel sync와 야간 embedding이 동일 데이터에 대한 독립 writer가 된다.**  
    구체 시나리오: 야간 `kb:embed`가 chunks를 쓰는 동안 Vercel sync가 documents를 delete-then-insert한다. FK cascade로 chunks가 사라지거나, 새 document ID와 이전 chunks가 어긋날 수 있다.  
    설계 수준 권고: 테이블별 writer ownership을 명시하고 두 작업에 공통 lock을 둔다. 문서 ID는 경로 또는 안정된 식별자로 유지하며, chunks도 `source_commit_sha`와 `content_hash`를 가져야 한다.

21. **[심각도 P1] “전일 이후 변경” 검사는 실패 복구 상태를 표현하지 못한다.**  
    구체 시나리오: 콘텐츠 변경이 있었지만 그날 embedding이 실패한다. 다음 날 새 콘텐츠 커밋이 없으면 workflow는 변경 없음으로 판단해 영원히 재시도하지 않는다. cron 시간대 경계나 지연 실행도 누락을 만들 수 있다.  
    설계 수준 권고: 날짜가 아니라 `last_successful_embedding_sha`와 현재 production content SHA를 비교한다. 실패하면 동일 SHA를 다음 실행에서 반드시 재시도한다.

22. **[심각도 P1] embedding 대상 SHA가 실제 배포·DB SHA와 결합되지 않았다.**  
    구체 시나리오: workflow가 최신 master B를 checkout하지만 production은 아직 A이고 DB sync도 A다. embedding은 B의 파일과 A의 DB를 섞거나, B를 쓰는 도중 C 배포 sync가 chunks를 삭제한다.  
    설계 수준 권고: 성공한 production deployment와 sync가 확인한 정확한 SHA만 embedding 입력으로 받는다. 새 chunks는 staging에 완성한 뒤 해당 SHA가 여전히 현재 production SHA일 때 atomic swap한다.

23. **[심각도 P2] 콘텐츠 변경만 감지하면 embedding 코드·모델 변경을 놓친다.**  
    구체 시나리오: chunking 로직, Gemini 모델 또는 embedding 차원이 바뀌었지만 `content/**` 커밋이 없다. workflow가 실행되지 않아 서로 다른 버전의 vector가 혼재한다.  
    설계 수준 권고: 콘텐츠 SHA뿐 아니라 chunker version, model identifier, embedding dimension을 fingerprint에 포함한다. fingerprint가 다르면 전체 재처리를 수행한다.

24. **[심각도 P2] 야간 지연 동안 사이트와 RAG가 서로 다른 사실을 말한다.**  
    구체 시나리오: 잘못된 내용을 긴급 수정해 사이트에는 반영됐지만 RAG는 다음 성공한 배치까지 이전 내용을 답한다.  
    설계 수준 권고: RAG가 사용 중인 content SHA와 마지막 갱신 시각을 운영 화면에 표시한다. 중요 수정에는 수동 재처리 또는 해당 문서 RAG 일시 제외 경로가 필요하다.

## 6. 비개발자 운영 실패 모드

25. **[심각도 P2] 현재 충돌 UX로는 안전한 병합이 불가능하다.**  
    구체 시나리오: 충돌 후 “편집 텍스트를 보존한 채 최신본 재로드”하려면 사용자 초안과 최신본 두 개가 필요하다. textarea 하나만 있으면 어느 쪽을 유지할지 알 수 없고, 비개발자가 수동 병합 과정에서 타인의 수정을 삭제할 수 있다.  
    설계 수준 권고: 충돌은 YAGNI 대상이 아니다. 최소한 “내 수정”, “최신본”, 변경된 부분을 접근 가능한 형태로 비교하고, 복사·재적용·취소를 선택하게 해야 한다.

26. **[심각도 P2] 세션 만료와 탭 손실에 대한 복구 경로가 없다.**  
    구체 시나리오: 원문 대조에 오래 걸려 OTP 세션이 만료된 뒤 반영을 누른다. 재로그인 과정이나 페이지 이동 중 textarea 내용이 사라진다. 브라우저 crash도 같은 결과를 낸다.  
    설계 수준 권고: 제출 실패와 재로그인 뒤에도 복원되는 로컬 초안을 문서·base SHA 단위로 보관한다. 서버 반영 자동 저장과 브라우저 내 복구 초안은 별개 기능으로 취급할 수 있다.

27. **[심각도 P2] PAT 만료와 배포 실패가 감수자에게 일반 통신 실패로만 보인다.**  
    구체 시나리오: PAT가 만료되어 모든 편집이 갑자기 실패하거나 Vercel 연동이 끊긴다. 연구보조원은 반복 재시도하고 위원장은 장애를 뒤늦게 알게 된다.  
    설계 수준 권고: GitHub 인증 preflight, 토큰 만료 사전 경보, Vercel deployment 실패 알림, 담당자용 장애 runbook을 운영 체크리스트에 포함한다.

28. **[심각도 P3] `Cmd/Ctrl+E` 전역 가로채기는 브라우저 기본 탐색을 훼손할 수 있다.**  
    구체 시나리오: 스크린 리더 사용자가 브라우저의 기본 단축 동작을 기대하지만 편집기가 이를 강제로 막는다. 포커스 위치와 무관하게 작동하면 탈출하기도 어렵다.  
    설계 수준 권고: 충돌 가능성이 낮은 단축키를 선택하거나 textarea에 포커스가 있을 때만 동작하게 한다. 단축키는 보조 수단이고 모든 기능은 명시 버튼으로 완전히 사용할 수 있어야 한다.

## 검토했으나 무결

다음 부분은 전제와 범위를 제한하면 타당합니다.

- **같은 파일에 대한 GitHub SHA 낙관적 잠금**: 동일 파일의 오래된 편집이 조용히 덮어쓰는 것은 막는다. 다만 저장소 전체 race는 막지 않는다.
- **클라이언트 편집 버튼을 보안 경계로 사용하지 않는 원칙**: 모든 서버 액션에서 권한을 다시 검증한다면 정적 페이지의 클라이언트 버튼 자체는 허용 가능한 표시 계층이다.
- **마크다운을 정본으로 유지하는 방향**: 편집 UI가 DB를 직접 수정하지 않고 Git 커밋만 만든다는 명령 경계는 기존 원칙과 일치한다.
- **frontmatter를 본문 편집 대상에서 제외하는 결정**: raw prefix를 정확한 base commit에 결합해 byte 단위로 보존한다는 조건에서는 적절하다.
- **신규 문서 생성 제외**: 편집 범위를 줄여 slug·파일명·초기 metadata 생성 문제를 피한다는 점에서 무결하다.

핵심 승인 조건은 하나입니다. `production site SHA = documents sync SHA`를 보장하고, `embedding SHA`가 그 조상인지 명시적으로 추적해야 합니다. 이 불변식 없이 master 직행, 사전 검증, 야간 embedding을 함께 운영하면 각 구성요소가 개별적으로 성공해도 전체 시스템은 서로 다른 버전의 콘텐츠를 서비스할 수 있습니다.