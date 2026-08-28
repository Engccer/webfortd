import { createHash } from 'node:crypto'

/** 이미지 매핑 키의 alt 해시 = alt 앞 40자 sha1 8자. image-mappings.ts와 테스트가 공유한다. */
export function altHash(alt: string): string {
  return createHash('sha1').update(alt.trim().slice(0, 40)).digest('hex').slice(0, 8)
}
