#!/usr/bin/env node
/**
 * Task B2의 apply 판정 케이스를 _image-mappings.json의 manifest_path에 머지.
 * PR #5 _alt_original 가드는 npm run image:apply가 자체 검증.
 *
 * 입력: content/_image-mappings-candidates.json
 * 갱신: content/_image-mappings.json (manifest_path null → apply 후보 path)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const MAPPINGS_PATH = resolve(ROOT, "content/_image-mappings.json");
const CAND_PATH = resolve(ROOT, "content/_image-mappings-candidates.json");

const data = JSON.parse(readFileSync(MAPPINGS_PATH, "utf8"));
const { candidates } = JSON.parse(readFileSync(CAND_PATH, "utf8"));

let merged = 0;
let alreadyMapped = 0;
let missing = 0;
for (const [key, cand] of Object.entries(candidates)) {
  if (cand.decision !== "apply") continue;
  const entry = data.mappings[key];
  if (!entry) {
    console.error(`SKIP ${key}: _image-mappings.json에 key 없음`);
    missing += 1;
    continue;
  }
  if (entry.manifest_path !== null) {
    console.error(`SKIP ${key}: 이미 manifest_path 있음 (${entry.manifest_path})`);
    alreadyMapped += 1;
    continue;
  }
  entry.manifest_path = cand.manifest_path;
  entry.notes = `Phase 1.5b 자동 매핑 (method=${cand.method}, ${cand.reason})`;
  merged += 1;
}

writeFileSync(MAPPINGS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
console.error(`머지 완료: ${merged}건 manifest_path 채움. alreadyMapped: ${alreadyMapped}, missing: ${missing}.`);
