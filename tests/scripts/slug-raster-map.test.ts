// ⚠ v3 이미지 매핑 자산(2026-08-29 3층 재생성으로 content/_archive-v3/에 보존, 읽기 전용)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// 7건 known-answer (출처: /tmp/image-match-poc/sample-results-summary.md §2)
// PR A Task A8 시뮬레이션에서 수동 매핑으로 3종 모델 7/7 YES 만장일치 확인된 ground truth.
const GROUND_TRUTH: Array<{
  key: string;
  source: string;
  expectedRaster: string;
}> = [
  { key: "2023-hr-p-046#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-024-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#1", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-052#2023-hr-guide#2", source: "2023-hr-guide", expectedRaster: "page-046-render.png" },
  { key: "2023-hr-p-057#2023-hr-guide#0", source: "2023-hr-guide", expectedRaster: "page-060-render.png" },
  { key: "2023-hr-p-057#2023-hr-guide#1", source: "2023-hr-guide", expectedRaster: "page-060-render.png" },
  { key: "2024-staff-p-023#2024-support-staff-duty-guide#0", source: "2024-support-staff-duty-guide", expectedRaster: "page-025-render.png" },
];

test("slug-raster-map: 7건 known-answer 매핑 정확", async () => {
  const mapPath = resolve(process.cwd(), "content/_archive-v3/_slug-raster-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8")) as {
    mappings: Record<string, { source: string; raster: string; method: string }>;
  };

  for (const { key, source, expectedRaster } of GROUND_TRUTH) {
    const entry = map.mappings[key];
    assert.ok(entry, `매핑 사전에 ${key} 없음`);
    assert.equal(entry.source, source, `${key}: source 불일치`);
    assert.equal(entry.raster, expectedRaster, `${key}: raster 불일치 (expected ${expectedRaster}, got ${entry.raster})`);
  }
});

test("slug-raster-map: unresolved JSON 존재 + 구조 검증", async () => {
  const unresolvedPath = resolve(process.cwd(), "content/_archive-v3/_slug-raster-unresolved.json");
  const data = JSON.parse(await readFile(unresolvedPath, "utf8")) as {
    unresolved: Array<{ key: string; source: string; reason: string }>;
  };
  assert.ok(Array.isArray(data.unresolved), "unresolved 배열 누락");
});

test("slug-raster-map: 매핑 성공률 >= 60% (spec §3.1.1 acceptance criteria)", async () => {
  const mapPath = resolve(process.cwd(), "content/_archive-v3/_slug-raster-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8")) as { mappings: Record<string, unknown> };
  const unresolvedPath = resolve(process.cwd(), "content/_archive-v3/_slug-raster-unresolved.json");
  const unresolved = JSON.parse(await readFile(unresolvedPath, "utf8")) as { unresolved: unknown[] };

  const total = Object.keys(map.mappings).length + unresolved.unresolved.length;
  const success = Object.keys(map.mappings).length;
  const rate = success / total;
  assert.ok(rate >= 0.6, `매핑 성공률 ${(rate * 100).toFixed(1)}% — spec §3.1.1 60% 임계 미달`);
});
