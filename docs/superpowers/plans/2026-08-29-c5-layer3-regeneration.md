# C5 3층 위키 문서 재생성 플랜 (2026-08-29) — 완료(결과는 CHANGELOG 2026-08-29)

spec 정본: `docs/DECOMPOSE_V2_DESIGN.md`(= 자문 메모 `260828_3층_원자화규칙_슬러그체계_설계.md`), 상위 전략 `260827_재생성전략…` §4~§6. 위원장 확정 결정(8/28 §5): 전부 draft → 2차 검증 뒤 `kb:bootstrap` 일괄 공개 / 임베딩은 2차 검증 뒤 1회 / 이미지 매핑 키 alt 해시 재설계.

구현 방식 판정: inline. 근거: 분해 스크립트 → dry-run 실측 → 슬러그 확정 → 대응표 → 참조 갱신 → 검증 게이트가 한 줄로 의존하고, 같은 파일(`decompose-source.ts`, `content/`)을 계속 다시 만진다. 리뷰만 별도 컨텍스트(서브에이전트)로 분리.

## 실측으로 확정한 전제 (설계 문서에 없던 것)

1. **프로덕션은 `[[slug]]`를 링크로 렌더하지 않는다**(`escapeKbContent`가 `<`만 escape하고 위키링크 변환은 어디에도 없음. 실측: `/policies/2023-hr-1-3`의 관련 페이지가 `[[2023-hr-2-3]] — 2) 전보 임용` 글자 그대로). 설계 §3.4의 `[[slug|제목]] (원본 N쪽)` 블록이 성립하려면 `kb-mdx.ts`에 위키링크 → 마크다운 링크 변환(슬러그 → href 해석기 주입)이 필요하다.
2. **`escapeKbContent`가 모든 `<`를 `&lt;`로 바꾼다** → v4의 `<br>` 10,795건·`<mark>` 757건이 글자로 노출된다. 허용 태그(br·mark·sub·sup, 속성 없음)만 속성 없는 정규형으로 되살리는 화이트리스트를 escape 뒤에 둔다(JSX 표현식·속성·기타 태그는 여전히 차단 → 보안 계층 유지).
3. v4에는 `(이미지: …)`가 5건뿐(v3 104건). 지원인력 부록2의 기기 사진 12장은 `(사진: 기기명)` 표 셀(C6, 이번 범위 밖). v3 이미지 매핑 104건·적용 21건·래스터 후보 79건은 **v4 전사로 대체된 v3 산출물**이라 `content/_archive-v3/`로 이동해 보존하고 새 `_image-mappings.json`은 alt 해시 키 스킴의 빈 상태로 시작한다(C3 검수 큐 79건은 폐기 사유와 함께 BACKLOG 갱신).
4. **야간 `nightly-embed.yml`이 content SHA 변경마다 kb:sync+kb:embed를 실행**한다. 결정 2(임베딩 1회)와 "kb:sync는 주소 기준이라 구 행 고아화"를 지키려면 이번 커밋부터 2차 검증 완료까지 야간 잡을 멈춰야 한다 → `content/.embed-paused` 파일 존재 시 skip(SHA 미기록이라 파일 삭제 즉시 재개).
5. 제목 번호 실측(4종 합계): `1)` 231 / `(1)` 155 / `가.` 153 / `①` 121 / `□` 109 / `가)` 78 / `1.` 72 / `㉠` 62 / 번호 없음 38 / `Ⅰ.` 17 / `[부록 N-N]` 7 / `<표 N>` 5 / `◇` 3 / `<부록N>` 5. 쪽 주석 3변형 `<!-- p.9 (pdf 11) -->`·`<!-- p.Ⅰ-3 (pdf 15) -->`·`<!-- p.pdf2 (pdf 2) -->`.

## 태스크

1. 준비: 구 content 스냅샷(scratchpad) + v3 정본 4종 `data/source-md/v3/`로 이동(입력 폴더는 v4만).
2. `src/types/kb.ts`: `source_page`·`source_page_end`(string)·`source_page_pdf`(int) 선택 필드.
3. `scripts/decompose-source.ts` 개정: outline 슬러그(번호 파서·전 조상 경로·`x<n>`·`-d2`·`-pt<n>`), 부모 서문 개요 페이지(≥100자)/미만은 첫 자식 앞 병합, 제외 제목(`<표`·`<그림`·참고·TIP·Q&A → 굵게 강등), 제목 유일성(부모 접두), 제목 끝 쪽수 제거, 빈 조각(<100자) 다음 형제에 `## 원제목`으로 병합, 5만 자 표 경계 분할, 쪽 주석 → frontmatter·본문 제거, 이미지 보존+마커, 허용/금지 태그 상수, 범위 경고, 관련 페이지 블록, CA는 `slugScheme: 'article'`로 기존 경로 보존. `--file`·`--reset`은 source_origin 단위 유지.
4. dry-run으로 출처별 건수·평균 길이 실측 → splitLevel 확정(기본 3, 2024-staff 4 검토) → 4종 `--reset --file` 재생성.
5. `scripts/slug-migration.ts`: 제목 정규화 일치 → 본문 3-gram Jaccard(0.5) → 미매칭, `docs/slug-migration-2026-08.csv`.
6. `scripts/apply-slug-migration.ts`: `_axis-overrides.json`·(archive 제외) src 문자열·faq `[[링크]]`·테스트 고정값 치환(토큰 경계, 1:N·미매칭은 목록만).
7. `scripts/image-mappings.ts`: 키 `<slug>#<source>#<alt40 sha1 8자>`, 마커+alt 줄 함께 치환, v3 자산 archive.
8. `src/lib/kb-mdx.ts`: 위키링크 변환(resolver 주입) + 허용 태그 복원. `KbPageLayout`·편집기 프리뷰에 resolver 전달.
9. `scripts/validate-frontmatter.ts`: 금지 태그·허용 태그 균형·끊긴 위키링크·출처별 제목 중복·100자 미만/5만 자 초과·`-p-`/`appendix-` 재발 차단.
10. `.github/workflows/nightly-embed.yml` 일시정지 게이트 + `content/.embed-paused`.
11. 테스트 갱신(decompose·image-mappings·raster·AxisDocList·media-curation·a11y 샘플) + `npm test`·`test:components`·`lint`·`build`.
12. 회귀 표 `docs/regression-2026-08-review48.md`, 문서 분배(CHANGELOG·PROGRESS·BACKLOG·CLAUDE.md 영구 규칙·data/README·IMAGE_MAPPING_GUIDE·DECOMPOSE_V2_DESIGN 구현 메모).
13. 서브에이전트 리뷰(spec 정합 + 코드 품질) → commit → push.
