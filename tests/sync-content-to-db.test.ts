import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  transformDocumentRow,
  upsertDocuments,
  syncWikiBacklinks,
  invertBacklinksToSourcePerspective,
} from '../scripts/sync-content-to-db.ts'

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

  test('D1 regression: frontmatter.status=published → row.status=draft 강제', () => {
    const doc = {
      slug: 'd1-regression',
      axis: 'policies',
      filePath: 'content/policies/d1-regression.md',
      frontmatter: {
        title: '이미 published 상태인 문서',
        type: '지침',
        disability_types: ['전체'],
        domains: ['정책법령'],
        regions: ['전국'],
        year: 2026,
        // frontmatter는 published이지만 transform은 draft 강제 (M5 검수에서만 published 전환)
        status: 'published' as const,
        source: { organization: 'o', citation: 'c' },
        source_origin: 'd1-regression-fixture',
        references: [],
        accessibility: {
          alt_text_complete: true,
          captions_available: false,
          reading_level: 'standard' as const,
          audio_tts_ready: false,
        },
        authors: [],
        reviewed_by: ['reviewer1'],
        parent_headings: [],
      },
      body_excerpt: '',
    }
    const row = transformDocumentRow(doc, '본문')
    assert.equal(row.status, 'draft', 'D1 위반: frontmatter.status가 row.status로 통과')
  })
})

describe('upsertDocuments (mocked client)', () => {
  test('빈 배열 → 0 batches', async () => {
    const upserted: any[] = []
    const mockClient = {
      from: () => ({
        upsert: async (rows: any[]) => {
          upserted.push(...rows)
          return { error: null }
        },
      }),
    } as any
    const result = await upsertDocuments(mockClient, [], { batchSize: 50 })
    assert.equal(result.totalUpserted, 0)
    assert.equal(upserted.length, 0)
  })

  test('150건 → 50 batch 3회', async () => {
    const upserted: any[] = []
    let batchCount = 0
    const mockClient = {
      from: () => ({
        upsert: async (rows: any[]) => {
          batchCount++
          upserted.push(...rows)
          return { error: null }
        },
      }),
    } as any
    const rows = Array.from({ length: 150 }, (_, i) => ({
      slug: `s-${i}`,
      title: `t-${i}`,
    })) as any
    const result = await upsertDocuments(mockClient, rows, { batchSize: 50 })
    assert.equal(result.totalUpserted, 150)
    assert.equal(batchCount, 3)
  })

  test('upsert 실패 → throw with row context', async () => {
    const mockClient = {
      from: () => ({
        upsert: async () => ({
          error: { code: 'PGRST', message: 'unique violation' },
        }),
      }),
    } as any
    await assert.rejects(
      () => upsertDocuments(mockClient, [{ slug: 'x' } as any], { batchSize: 50 }),
      /unique violation/,
    )
  })
})

describe('syncWikiBacklinks (mocked client)', () => {
  test('빈 인덱스 → 0 inserts', async () => {
    const ops: string[] = []
    const mockClient = {
      from: (table: string) => ({
        delete: () => ({
          in: async (_col: string, vals: string[]) => {
            ops.push(`delete:${table}:${vals.length}`)
            return { error: null }
          },
        }),
        insert: async (rows: any[]) => {
          ops.push(`insert:${table}:${rows.length}`)
          return { error: null }
        },
      }),
    } as any
    const result = await syncWikiBacklinks(mockClient, {}, {})
    assert.equal(result.totalInserted, 0)
    assert.equal(ops.length, 0)
  })

  test('3개 source × 평균 2 backlinks → delete + insert', async () => {
    const ops: any[] = []
    const mockClient = {
      from: (table: string) => ({
        delete: () => ({
          in: async (_col: string, vals: string[]) => {
            ops.push({ op: 'delete', table, n: vals.length })
            return { error: null }
          },
        }),
        insert: async (rows: any[]) => {
          ops.push({ op: 'insert', table, n: rows.length })
          return { error: null }
        },
      }),
    } as any
    const slugToId: Record<string, string> = {
      'a': 'id-a',
      'b': 'id-b',
      'c': 'id-c',
    }
    const backlinks: Record<string, { from: string; anchor?: string; link_text?: string }[]> = {
      'a': [{ from: 'b' }, { from: 'c', anchor: 'sec1' }],
      'b': [{ from: 'a' }],
      'c': [{ from: 'a' }, { from: 'b' }],
    }
    const result = await syncWikiBacklinks(mockClient, backlinks, slugToId)
    assert.equal(result.totalInserted, 5)
    // delete는 source_doc_id 배열로 한 번
    const deletes = ops.filter((o) => o.op === 'delete')
    assert.equal(deletes.length, 1)
    assert.equal(deletes[0].n, 3) // 3 source ids
  })

  test('slugToId에 없는 source → skip + warn (반환 미카운트)', async () => {
    const ops: any[] = []
    const mockClient = {
      from: (_table: string) => ({
        delete: () => ({
          in: async () => {
            ops.push('del')
            return { error: null }
          },
        }),
        insert: async (rows: any[]) => {
          ops.push(rows)
          return { error: null }
        },
      }),
    } as any
    const slugToId = { 'a': 'id-a' }
    const backlinks = {
      'a': [{ from: 'b' }], // a는 매핑됨
      'missing-slug': [{ from: 'a' }], // missing은 X
    }
    const result = await syncWikiBacklinks(mockClient, backlinks, slugToId)
    // missing-slug는 skip, 'a'만 inserted
    assert.equal(result.totalInserted, 1)
    assert.equal(result.skippedSources.length, 1)
    assert.equal(result.skippedSources[0], 'missing-slug')
  })
})

describe('invertBacklinksToSourcePerspective', () => {
  test('invertBacklinksToSourcePerspective: target perspective → source', () => {
    const byTarget = {
      'page-a': [{ from: 'page-b' }, { from: 'page-c', anchor: 'sec' }],
      'page-c': [{ from: 'page-a' }],
    }
    const bySource = invertBacklinksToSourcePerspective(byTarget)
    assert.deepEqual(bySource['page-b'], [{ from: 'page-a' }])
    assert.deepEqual(bySource['page-c'], [{ from: 'page-a' }])
    assert.deepEqual(bySource['page-a'], [{ from: 'page-c' }])
  })
})
