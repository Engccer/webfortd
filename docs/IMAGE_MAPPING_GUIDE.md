# M4-C 본문 이미지 매핑 가이드

## 배경

M3 자동 분해 결과의 본문에 등장하는 `(이미지: ...)` 패턴은 출처 docparse 마크다운에서 생성됐다. M3 초기 구현은 이를 매니페스트 첫 이미지로 자동 치환했으나, 페이지마다 매니페스트 커서가 0으로 재시작하는 버그로 데이터 무결성 사고가 발생해 codex-rescue P0 패치에서 자동 삽입을 중단했다.

이후 모든 `(이미지: ...)`는 HTML 주석 마커 `<!-- TODO: image-link source=... -- 원본: (이미지: ...) -->`로 보존되어 검수자(위원장)가 1:1 매핑을 결정한다.

## 현황 확인

```bash
npm run image:report
```

`docs/image-mapping-status.md`에 출처별 마커 수와 페이지별 미매칭 통계가 작성된다.

2026-05-17 시점 현황 예시:
- 총 TODO 마커: 104개 (46개 페이지)
- 2023-hr-guide: TODO 61, 매니페스트 이미지 22 — **마커 수 > 이미지 수** (검수 필요)
- 2024-support-staff-duty-guide: TODO 27, 매니페스트 16 — 마찬가지
- 2024-jbu-work-support-guide: TODO 15, 매니페스트 18 — 매칭 가능
- 2023-disability-types-work-support-report: TODO 1, 매니페스트 3098 — vector graphic 과추출

## 매핑 작성

1. 템플릿 생성

   ```bash
   npm run image:template
   ```

   `content/_image-mappings.template.json`에 모든 TODO 마커가 항목으로 출력된다.

2. 템플릿 복사

   ```bash
   cp content/_image-mappings.template.json content/_image-mappings.json
   ```

3. `content/_image-mappings.json` 편집

   각 항목은 아래 형태:

   ```json
   "2023-hr-1-7#2023-hr-guide#0": {
     "_alt_original": "시도교육청 연락처 표 이미지",
     "_file": "content/regions/2023-hr-1-7.md",
     "manifest_path": null,
     "alt_override": null
   }
   ```

   - 키 형식: `<slug>#<source>#<index>` — 같은 파일에서 동일 source의 N번째 마커.
   - `manifest_path`: 채울 필드. `public/source-images/<source>/page-NNN-fig-MM.png` 형태. 매핑 안 할 마커는 `null` 유지(skip).
   - `alt_override`: 원본 alt 텍스트를 수정해서 사용할 때만 채움. 비우면 `_alt_original` 사용.
   - `_alt_original`, `_file`: 검수 편의용 (apply 시 무시됨).

4. 매핑 적용

   ```bash
   npm run image:apply
   ```

   `content/_image-mappings.json` 명세대로 본문 TODO 마커를 `![alt](/source-images/...)` 마크다운 이미지 링크로 교체한다.

   안전 가드:
   - `manifest_path`가 매니페스트 또는 디스크에 없으면 apply 중단(전체 rollback, 부분 적용 금지).
   - 매핑 명세에 있으나 본문에 없는 키는 경고만 출력하고 계속 진행.
   - 매핑 명세에 없는 TODO 마커는 보존(추후 매핑 가능).

5. 검증

   ```bash
   npm run validate:content
   npm run build
   ```

## 매핑 데이터 무결성 원칙

본 인프라는 자동 매칭 휴리스틱을 의도적으로 제거했다. 검수자가 한 건씩 결정한다.

근거: M3 codex-rescue P0 #1 — manifest 첫 이미지 재사용이 페이지마다 동일 이미지를 다른 alt로 삽입해 데이터 무결성 사고. 자동화는 매니페스트 metadata(page anchor, embedded alt 등)로 1:1 매칭이 가능해질 때까지 보류.

## TODO 마커 형식 (참고)

decompose-source.ts가 `(이미지: ...)`를 다음 형태로 보존:

```markdown
<!-- TODO: image-link source=<source-identifier> -- 원본: (이미지: <alt 텍스트>) -->
```

`apply` 후 결과:

```markdown
![<alt 텍스트>](/source-images/<source>/page-NNN-fig-MM.png)
```

## 미해결 매핑 추적

`content/_image-mappings.json`에서 `manifest_path: null`인 항목 = 미매핑.

검수 완료 페이지의 `accessibility.alt_text_complete`를 `true`로 토글하려면 별도 작업 필요(현재 decompose 출력은 imagePatternCount === 0일 때만 true로 박힘). M4-D에서 처리.

## parent_headings 정리 정책 (M4-B 검수)

분해 페이지 frontmatter의 `parent_headings: string[]`은 출처 문서 내 원본 위치를 보존하는 필드다. splitLevel별 깊이가 다르다:

- splitLevel=2 (`## ` H2 분해): 보통 `["H1 텍스트"]` 1개 항목
- splitLevel=4 (`#### ` 단체협약 조항 단위): `["H1 텍스트", "H2 텍스트", "H3 텍스트"]` 2~3개

검수 시 정리해도 되는 값:
- `"01"`, `"02"` 같은 숫자만으로 된 항목 — 페이지 번호 잔여물.
- `"목 차"`, `"CONTENTS"`, `"INDEX"` — 의미 없는 메타 헤딩.
- 공백·기호만 남은 항목.

검수 시 보존해야 하는 값:
- `"제1장 총칙"`, `"Ⅳ 장애인교원의 권리옹호 지원"` 같이 chapter/section 식별이 가능한 헤딩.
- 위원장이 위치 파악에 유용하다고 판단한 모든 항목.

KbPageLayout은 `parent_headings`이 비어있으면 breadcrumb 자체를 렌더하지 않으므로, 전부 제거하면 깔끔하다.

## codex-rescue M4 P1 #1·#2 가드 (운영 안전망)

- **stale slug**: `_axis-overrides.json`에 분해 결과 slug와 매칭 안 되는 키가 있으면 `tsx scripts/decompose-source.ts --reset` 시 exit 4. 오타 즉시 검출.
- **forcedAxis 충돌**: 단체협약 source(`forcedAxis: 'agreements'`) 페이지를 다른 axis로 override하려 하면 exit 2. 단체협약 분류 무결성 보호.
- **build 체인 stale axis 검출**: `npm run validate:content`에서 `_axis-overrides.json`의 각 slug가 지정 axis 경로에 실제 존재하는지 확인. `decompose --reset` 빼먹은 상태에서 build가 stale 통과하는 사고 방지.
