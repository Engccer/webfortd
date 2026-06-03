import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base64ToArrayBuffer, arrayBufferToBase64 } from '../../src/lib/voice/pcm-base64.ts'

test('roundtrip: arrayBuffer → base64 → arrayBuffer', () => {
  const src = new Uint8Array([0, 1, 2, 254, 255]).buffer
  const b64 = arrayBufferToBase64(src)
  const back = new Uint8Array(base64ToArrayBuffer(b64))
  assert.deepEqual([...back], [0, 1, 2, 254, 255])
})

test('base64ToArrayBuffer: 빈 문자열 → 빈 buffer', () => {
  assert.equal(base64ToArrayBuffer('').byteLength, 0)
})
