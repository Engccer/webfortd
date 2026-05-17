# 콘텐츠/코드 변경 PR

<!--
이 템플릿은 콘텐츠 변경(content/**/*.md) 위주로 작성됐습니다.
코드/스크립트 변경 PR이면 "코드 변경 보조 체크리스트" 섹션만 채워도 됩니다.
-->

## 요약

<!-- 1~3줄. 무엇을 왜 바꿨는지. -->

## 영향 범위

- 변경된 페이지 수:
- 주요 변경 내용:
- 위키링크 추가 또는 수정 여부: 있음 / 없음

## 콘텐츠 변경 체크리스트

### 필수 확인

- [ ] `npm run validate:content`를 로컬에서 실행해 오류 없음을 확인했습니다.
- [ ] `npm run sync:content` 실행 후 끊긴 위키링크가 없는지 확인했습니다(있다면 본 PR에서 처리하거나 후속 PR 일정을 남깁니다).
- [ ] `status: 'published'`로 변경한 페이지의 `reviewed_by` 필드에 검수자 식별자가 채워져 있습니다.
- [ ] `source.citation` 인용 정보(연도·기관명·문서 제목)가 정확합니다.

### 접근성 확인

- [ ] 새로 추가한 이미지에는 `![대체텍스트](경로)` 형식의 alt 텍스트가 있고, frontmatter `accessibility.alt_text_complete`가 `true`로 설정됐습니다.
- [ ] 표(table)가 포함된 경우 헤더 행이 명확하고 스크린 리더로 순차 읽기 가능합니다.
- [ ] 본문에 `<`, `{`, `<!--` 등 특수문자를 직접 작성한 경우 CI 경고(`reviewed:accessibility` 라벨 또는 MDX escape 경고)를 확인했습니다.

## 코드 변경 보조 체크리스트

코드/스크립트/스키마를 함께 바꾼 경우만 채워주세요.

- [ ] `npm run test`가 통과합니다.
- [ ] 스키마(`src/types/kb.ts`) 변경 시 `validate-frontmatter`와 `sync-content` 모두 영향을 받지 않는지 확인했습니다.
- [ ] 새 의존성 추가 시 정당성을 본문 또는 PR 설명에 남겼습니다.

## 라벨 정책

### 자동 부착 라벨 (워크플로가 부착)

- `needs:accessibility-review` — 변경된 페이지 중 `alt_text_complete=false`가 있으면 자동 부착. 접근성 검수가 필요하다는 신호.

### 수동 부착 라벨 (검수자가 검수 완료 후 부착)

- `reviewed:editorial` — 내용 검수 완료
- `reviewed:accessibility` — 접근성 검수 완료 (자동 라벨 `needs:accessibility-review`를 제거하고 본 라벨로 교체)
- `reviewed:legal` — 법적/정책 검토 완료

## 참고

- 검증 가이드: `docs/CONTENT_CONVENTIONS.md`
- 이미지 매핑 가이드: `docs/IMAGE_MAPPING_GUIDE.md`
- 아키텍처: `docs/KB_ARCHITECTURE.md`
