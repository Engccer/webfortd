import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { transformDocumentRow } from '../scripts/sync-content-to-db.ts'

describe('transformDocumentRow', () => {
  test('frontmatter.references → references_data 컬럼 매핑', () => {
    const doc = {
      slug: 'test-doc',
      axis: 'agreements' as const,
      filePath: 'content/agreements/test-doc.md',
      frontmatter: {
        title: '테스트',
        type: '지침' as const,
        disability_types: ['전체' as const],
        domains: ['정책법령' as const],
        regions: ['전국' as const],
        year: 2026,
        status: 'draft' as const,
        source: { organization: 'test', citation: 'test' },
        source_origin: 'test-doc',
        references: [{ citation: 'ref1', type: 'web' as const }],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '본문 발췌',
    }
    const row = transformDocumentRow(doc, '본문 전체 마크다운')
    assert.equal(row.slug, 'test-doc')
    assert.equal(row.axis, 'agreements')
    assert.equal(row.source_path, 'content/agreements/test-doc.md')
    assert.equal(row.content_md, '본문 전체 마크다운')
    assert.deepEqual(row.references_data, [{ citation: 'ref1', type: 'web' }])
    // references 컬럼은 *없어야* 함 (SQL reserved word 회피)
    assert.equal('references' in row, false)
    // status는 draft (D1)
    assert.equal(row.status, 'draft')
  })

  test('frontmatter에 references 없을 때 references_data 빈 배열', () => {
    const doc = {
      slug: 'test-2',
      axis: 'policies' as const,
      filePath: 'content/policies/test-2.md',
      frontmatter: {
        title: '제목',
        type: '지침' as const,
        disability_types: ['시각' as const],
        domains: ['편의지원' as const],
        regions: ['전국' as const],
        year: 2025,
        status: 'draft' as const,
        source: { organization: 'org', citation: 'cite' },
        source_origin: 'test-2',
        references: [],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '',
    }
    const row = transformDocumentRow(doc, '')
    assert.deepEqual(row.references_data, [])
  })

  test('disability_types가 단일 문자열이 아닌 배열', () => {
    const doc = {
      slug: 'multi-type',
      axis: 'disability-types' as const,
      filePath: 'content/disability-types/multi.md',
      frontmatter: {
        title: '복합',
        type: '안내서' as const,
        disability_types: ['시각' as const, '청각' as const],
        domains: ['인사관리' as const],
        regions: ['서울' as const],
        year: 2024,
        status: 'draft' as const,
        source: { organization: 'o', citation: 'c' },
        source_origin: 'multi',
        references: [],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: [],
        parent_headings: [],
      },
      body_excerpt: '',
    }
    const row = transformDocumentRow(doc, '본문')
    assert.deepEqual(row.disability_types, ['시각', '청각'])
  })
})
