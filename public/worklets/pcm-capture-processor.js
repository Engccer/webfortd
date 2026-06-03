/**
 * PCM 캡처 프로세서 — 마이크 입력을 16kHz Int16 PCM으로 변환
 * AudioWorkletProcessor로 메인 스레드 블로킹 없이 동작
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 640; // ~40ms at 16kHz (Google 권장 20–40ms, Deepgram 권장 20–50ms)
    this._resampleOffset = 0; // 프레임 간 분수 위치 추적 — 정확한 16kHz 유지
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputData = input[0]; // Float32, device sampleRate
    const deviceRate = sampleRate; // AudioWorklet 글로벌
    const targetRate = 16000;

    // 선형 보간 리샘플링: device sampleRate → 16kHz
    // _resampleOffset으로 프레임 경계 분수 위치를 추적하여 정확한 16kHz 출력 보장
    // (offset 미추적 시 48kHz에서 유효 출력이 15,750Hz로 1.6% 낮아짐)
    const ratio = deviceRate / targetRate;
    let srcIdx = this._resampleOffset;
    while (srcIdx < inputData.length) {
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(idx0 + 1, inputData.length - 1);
      const frac = srcIdx - idx0;
      // Float32 선형 보간 → Int16 변환
      const s = Math.max(-1, Math.min(1,
        inputData[idx0] * (1 - frac) + inputData[idx1] * frac
      ));
      this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
      srcIdx += ratio;
    }
    // 다음 프레임에서 이어갈 분수 오프셋 저장
    this._resampleOffset = srcIdx - inputData.length;

    // 버퍼가 충분히 차면 메인 스레드로 전송
    if (this._buffer.length >= this._bufferSize) {
      const chunk = new Int16Array(this._buffer.splice(0, this._bufferSize));
      this.port.postMessage({ type: "pcm", data: chunk.buffer }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
