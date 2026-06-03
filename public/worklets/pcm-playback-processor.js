/**
 * PCM 재생 프로세서 — Gemini Live API의 24kHz PCM 오디오를 스피커로 출력
 *
 * AudioContext를 24kHz로 생성하여 리샘플링 불필요 (Google 공식 예제 패턴).
 * 브라우저가 24kHz → 하드웨어 출력 변환을 내부적으로 처리.
 * FIFO 큐 + offset 추적으로 GC 부담 최소화.
 *
 * Grace period: 버퍼가 비어도 즉시 재생 중단하지 않고, 짧은 유예 기간 동안
 * 무음을 출력하며 다음 청크를 기다림 → WebSocket 청크 간 갭에서 오디오 끊김 방지
 */
class PcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];       // Float32Array 청크 큐
    this._currentChunk = null;
    this._currentOffset = 0;
    this._playing = false;

    // 브라우저가 24kHz AudioContext를 지원하지 않으면 리샘플링 폴백
    this._needsResample = Math.abs(sampleRate - 24000) > 1;

    // 큐 용량 제한 없음(unbounded). Gemini Live는 긴 응답 오디오를 real-time보다
    // 훨씬 빠른 burst로 송신하므로(WebSocket로 수 초치가 1~2초 내 도착), 용량 cap을
    // 두면 오래된 청크(=다음에 재생될 청크)가 중간에 drop되어 응답 중간이 사라진다.
    // Google 공식 레퍼런스(live-api-web-console)도 unbounded 큐로 구현되어 있음.
    // 긴 응답 메모리 상한(예: 60s × 24kHz × 4B = 5.76MB)은 실용적으로 충분.

    // Grace period / softFlush는 실제 출력 sampleRate 기준
    this._graceSamples = Math.floor(sampleRate * 0.2);   // 200ms
    this._silentSamplesCount = 0;
    this._softFlushKeep = Math.floor(sampleRate * 0.15); // 150ms

    this.port.onmessage = (e) => {
      if (e.data.type === "pcm") {
        this._enqueuePcm(e.data.data);
      } else if (e.data.type === "flush") {
        this._queue = [];
        this._currentChunk = null;
        this._currentOffset = 0;
        this._playing = false;
        this._silentSamplesCount = 0;
      } else if (e.data.type === "softFlush") {
        this._softFlushQueue();
      }
    };
  }

  /** 큐에 남은 총 샘플 수 (currentChunk 제외, 큐만) */
  _totalQueued() {
    let n = 0;
    for (let i = 0; i < this._queue.length; i++) {
      n += this._queue[i].length;
    }
    return n;
  }

  _enqueuePcm(arrayBuffer) {
    const int16 = new Int16Array(arrayBuffer);

    if (this._needsResample) {
      const ratio = sampleRate / 24000;
      const outLen = Math.floor(int16.length * ratio);
      const float32 = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i / ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, int16.length - 1);
        const frac = srcIdx - idx0;
        float32[i] = (int16[idx0] * (1 - frac) + int16[idx1] * frac) / 32768;
      }
      this._queue.push(float32);
    } else {
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }
      this._queue.push(float32);
    }
    this._playing = true;
    this._silentSamplesCount = 0;
  }

  _softFlushQueue() {
    // 현재 재생 위치부터 최대 150ms만 남기고 이후를 모두 버림
    let keep = this._softFlushKeep;

    if (this._currentChunk) {
      const remaining = this._currentChunk.length - this._currentOffset;
      if (remaining >= keep) {
        this._currentChunk = this._currentChunk.subarray(
          this._currentOffset, this._currentOffset + keep
        );
        this._currentOffset = 0;
        this._queue = [];
        return;
      }
      keep -= remaining;
    }

    const kept = [];
    for (const chunk of this._queue) {
      if (keep <= 0) break;
      if (chunk.length <= keep) {
        kept.push(chunk);
        keep -= chunk.length;
      } else {
        kept.push(chunk.subarray(0, keep));
        keep = 0;
      }
    }
    this._queue = kept;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];

    if (!this._playing) {
      channel.fill(0);
      return true;
    }

    for (let i = 0; i < channel.length; i++) {
      if (this._currentChunk && this._currentOffset < this._currentChunk.length) {
        channel[i] = this._currentChunk[this._currentOffset++];
        this._silentSamplesCount = 0;
      } else if (this._queue.length > 0) {
        this._currentChunk = this._queue.shift();
        this._currentOffset = 0;
        channel[i] = this._currentChunk[this._currentOffset++];
        this._silentSamplesCount = 0;
      } else {
        channel[i] = 0;
        this._currentChunk = null;
        this._currentOffset = 0;
        this._silentSamplesCount++;
      }
    }

    // Grace period 초과 시에만 재생 종료
    if (this._silentSamplesCount >= this._graceSamples && this._queue.length === 0) {
      this._playing = false;
      this._silentSamplesCount = 0;
      this.port.postMessage({ type: "playbackEnded" });
    }

    return true;
  }
}

registerProcessor("pcm-playback-processor", PcmPlaybackProcessor);
