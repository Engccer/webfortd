#!/usr/bin/env node
/**
 * 4종 cross-validation (Phase 1.5b PR B Task B2).
 *
 * 입력: content/_slug-raster-map.json (B1 매핑 사전, 79건)
 *       content/_image-mappings.json  (_alt_original 전체 텍스트 소스)
 * 출력: content/_image-mappings-candidates.json (apply/review 결정)
 *
 * 합의 게이트:
 *   - 4 YES → apply
 *   - 3 YES + NO 0 (ERROR 1) → apply (안전망)
 *   - 그 외 → review
 *
 * known_answer 7건은 PR A A8 검증된 ground truth라 cross-validation skip 후 즉시 apply.
 *
 * cache resume: /tmp/image-match-poc/cross-validate-cache.json
 * 각 모델 호출마다 즉시 저장 — 중단 후 재실행 시 자동 resume.
 *
 * 4종 호출 (병렬):
 *   - Claude: Anthropic API (ANTHROPIC_API_KEY 환경변수, base64 inline)
 *   - Gemini: gemini CLI (REPO 내 상대 경로로 호출)
 *   - Gemma: ~/bin/gemma-vision (로컬 llama.cpp 서버)
 *   - Codex: codex exec -i (CLI)
 *
 * 중요: alt 텍스트는 slug-raster-map의 truncated alt 대신
 *       image-mappings.json의 _alt_original (전체 텍스트) 사용.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";

const REPO = "/Users/hunyongkim/Mac-Projects/webfortd";
const MAP_PATH = `${REPO}/content/_slug-raster-map.json`;
const MAPPINGS_PATH = `${REPO}/content/_image-mappings.json`;
const CACHE_FILE = "/tmp/image-match-poc/cross-validate-cache.json";
const OUT = `${REPO}/content/_image-mappings-candidates.json`;

// B1 매핑 사전 (source·raster·method 포함, alt는 truncated)
const slugMap = JSON.parse(readFileSync(MAP_PATH, "utf8")).mappings;

// _alt_original 전체 텍스트 소스 (image-mappings.json)
const allMappings = JSON.parse(readFileSync(MAPPINGS_PATH, "utf8")).mappings;

// cache: 중단-재실행 resume 지원
mkdirSync("/tmp/image-match-poc", { recursive: true });
let cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

const anthropic = new Anthropic();

// ─── 프롬프트 / 파서 ────────────────────────────────────────────

function buildPrompt(alt) {
  return `다음 설명이 첨부된 이미지를 정확히 묘사하는지 평가해 주세요.

설명: ${alt}

이미지를 자세히 보고 설명과 비교하세요. 핵심 객체와 그 형태·색상·구성이 일치하면 YES, 명백히 다른 객체이거나 핵심 묘사가 어긋나면 NO입니다.

마지막 줄에 'YES' 또는 'NO' 한 단어로만 결론을 적으세요.`;
}

function parseYesNo(text) {
  const upper = text.toUpperCase();
  const lastLine = upper.trim().split("\n").filter(Boolean).pop() || "";
  if (/\bYES\b/.test(lastLine) && !/\bNO\b/.test(lastLine)) return "YES";
  if (/\bNO\b/.test(lastLine) && !/\bYES\b/.test(lastLine)) return "NO";
  const yesCount = (upper.match(/\bYES\b/g) || []).length;
  const noCount = (upper.match(/\bNO\b/g) || []).length;
  if (yesCount > noCount) return "YES";
  if (noCount > yesCount) return "NO";
  return "UNCERTAIN";
}

function hashAlt(alt) {
  let h = 0;
  for (let i = 0; i < alt.length; i++) h = ((h << 5) - h + alt.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

// ─── execAsync: 자식 프로세스 래퍼 ──────────────────────────────

function execAsync(file, args, opts = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { ...opts, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) resolve({ ok: false, err: err.message, stdout: stdout || "", stderr: stderr || "" });
        else if (!stdout || stdout.trim().length === 0)
          resolve({ ok: false, err: "empty stdout", stdout: "", stderr: stderr || "" });
        else resolve({ ok: true, stdout, stderr });
      }
    );
    // Codex는 stdin EOF를 기다림 → 명시적 close
    try { child.stdin?.end(); } catch {}
    if (opts.timeout) setTimeout(() => { try { child.kill(); } catch {} }, opts.timeout);
  });
}

// ─── 4종 모델 호출 ────────────────────────────────────────────

async function callClaude(absPath, alt) {
  const key = `claude:${absPath}::${hashAlt(alt)}`;
  if (cache[key]) return cache[key];
  try {
    const buf = readFileSync(absPath);
    const b64 = buf.toString("base64");
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            { type: "text", text: buildPrompt(alt) },
          ],
        },
      ],
    });
    const text = resp.content.map((c) => ("text" in c ? c.text : "")).join("\n");
    cache[key] = { raw: text.trim().slice(-300), verdict: parseYesNo(text) };
  } catch (e) {
    cache[key] = { raw: `ERROR: ${String(e).slice(0, 200)}`, verdict: "ERROR" };
  }
  saveCache();
  return cache[key];
}

async function callGemini(absPath, alt) {
  const key = `gemini:${absPath}::${hashAlt(alt)}`;
  if (cache[key]) return cache[key];
  // REPO 내 상대 경로로 호출 — gemini CLI는 @<relpath> 형식 지원
  const relPath = absPath.replace(REPO + "/", "");
  const prompt = `${buildPrompt(alt)}\n\n이미지: @${relPath}`;
  const r = await execAsync("gemini", ["--skip-trust", "-p", prompt], { cwd: REPO, timeout: 90000 });
  if (r.ok) cache[key] = { raw: r.stdout.trim().slice(-300), verdict: parseYesNo(r.stdout) };
  else cache[key] = { raw: `ERROR: ${r.err.slice(0, 200)}`, verdict: "ERROR" };
  saveCache();
  return cache[key];
}

async function callGemma(absPath, alt) {
  const key = `gemma:${absPath}::${hashAlt(alt)}`;
  if (cache[key]) return cache[key];
  const r = await execAsync(
    `${process.env.HOME}/bin/gemma-vision`,
    [absPath, buildPrompt(alt)],
    { timeout: 90000 }
  );
  if (r.ok) cache[key] = { raw: r.stdout.trim().slice(-300), verdict: parseYesNo(r.stdout) };
  else cache[key] = { raw: `ERROR: ${r.err.slice(0, 200)}`, verdict: "ERROR" };
  saveCache();
  return cache[key];
}

async function callCodex(absPath, alt) {
  const key = `codex:${absPath}::${hashAlt(alt)}`;
  if (cache[key]) return cache[key];
  const r = await execAsync(
    "codex",
    ["exec", "-i", absPath, "--skip-git-repo-check", buildPrompt(alt)],
    { timeout: 120000 }
  );
  if (r.ok) cache[key] = { raw: r.stdout.trim().slice(-300), verdict: parseYesNo(r.stdout) };
  else cache[key] = { raw: `ERROR: ${r.err.slice(0, 200)}`, verdict: "ERROR" };
  saveCache();
  return cache[key];
}

// ─── 합의 게이트 ────────────────────────────────────────────────

/**
 * 4종 verdicts → apply / review
 *   - 4 YES → apply
 *   - 3 YES + NO 0 (ERROR 1) → apply (안전망)
 *   - 명시적 NO ≥ 1 또는 YES < 3 → review
 */
function consensusGate(verdicts) {
  const v = [verdicts.claude, verdicts.gemini, verdicts.gemma, verdicts.codex];
  const yes = v.filter((x) => x === "YES").length;
  const no = v.filter((x) => x === "NO").length;
  const err = v.filter((x) => x === "ERROR").length;
  if (no >= 1) return { decision: "review", reason: `명시적 NO ${no}건` };
  if (yes === 4) return { decision: "apply", reason: "4/4 YES" };
  if (yes === 3 && err === 1) return { decision: "apply", reason: "3 YES + 1 ERROR (안전망)" };
  return { decision: "review", reason: `YES=${yes} NO=${no} ERROR=${err}` };
}

// ─── page_number_seed ±10 window 헬퍼 ──────────────────────────

/**
 * page_number_seed 매핑에 ±10 raster window cross-validation 적용.
 * 1) Gemma 로컬 1차 stamp로 후보 좁힘
 * 2) Gemma YES 후보만 4종 합의 게이트
 * 3) 최선(score) raster 선정
 *
 * 반환: { decision: "apply"|"review", raster, verdicts, yesCount, noCount, reason }
 */
async function processPageNumberSeedWindow(key, entry, altOriginal) {
  const source = entry.source;
  const seedRaster = entry.raster; // "page-NNN-render.png"
  const seedMatch = seedRaster.match(/^page-(\d+)-render\.png$/);
  if (!seedMatch) return null;
  const seedNum = parseInt(seedMatch[1], 10);

  const WINDOW = 10;
  const candidatesList = [];
  for (let n = Math.max(1, seedNum - WINDOW); n <= seedNum + WINDOW; n++) {
    const raster = `page-${String(n).padStart(3, "0")}-render.png`;
    const absPath = `${REPO}/public/source-images/${source}/${raster}`;
    if (!existsSync(absPath)) continue;
    candidatesList.push({ raster, absPath, num: n });
  }

  // 1차 Gemma stamp
  const stamped = [];
  for (const cand of candidatesList) {
    const verdict = await callGemma(cand.absPath, altOriginal);
    if (verdict.verdict === "YES") stamped.push(cand);
    process.stderr.write(`    gemma p${cand.num}: ${verdict.verdict}\n`);
  }

  if (stamped.length === 0) {
    return {
      decision: "review",
      raster: seedRaster,
      verdicts: { gemma: "NO" },
      yesCount: 0,
      noCount: candidatesList.length,
      reason: `Gemma 1차 stamp 0 YES (±${WINDOW} window, ${candidatesList.length} 후보)`,
    };
  }

  // 2차 4종 합의 게이트 (Gemma YES 후보들)
  let best = null;
  for (const cand of stamped) {
    const [claude, gemini, codex] = await Promise.all([
      callClaude(cand.absPath, altOriginal),
      callGemini(cand.absPath, altOriginal),
      callCodex(cand.absPath, altOriginal),
    ]);
    const gemmaCached = await callGemma(cand.absPath, altOriginal); // cache hit
    const verdicts = {
      claude: claude.verdict,
      gemini: gemini.verdict,
      gemma: gemmaCached.verdict,
      codex: codex.verdict,
    };
    const yes = Object.values(verdicts).filter((v) => v === "YES").length;
    const no = Object.values(verdicts).filter((v) => v === "NO").length;
    const err = Object.values(verdicts).filter((v) => v === "ERROR").length;
    const okFourFour = yes === 4;
    const okThreeFour = yes === 3 && no === 0;
    const decision = okFourFour || okThreeFour ? "apply" : "review";
    process.stderr.write(
      `    p${cand.num} 4종: C=${verdicts.claude} G=${verdicts.gemini} M=${verdicts.gemma} X=${verdicts.codex} → ${decision} (yes=${yes} no=${no})\n`
    );
    if (decision === "apply") {
      const score = yes - no - err * 0.5;
      if (!best || score > best.score) {
        best = { score, raster: cand.raster, verdicts, yes, no, num: cand.num };
      }
    }
  }

  if (best) {
    return {
      decision: "apply",
      raster: best.raster,
      verdicts: best.verdicts,
      yesCount: best.yes,
      noCount: best.no,
      reason: `±${WINDOW} window 최선 p${best.num} (yes=${best.yes}, no=${best.no})`,
    };
  }

  return {
    decision: "review",
    raster: seedRaster,
    verdicts: {},
    yesCount: 0,
    noCount: 0,
    reason: `±${WINDOW} window ${stamped.length}건 Gemma YES, 4종 합의 미달`,
  };
}

// ─── 메인 루프 ──────────────────────────────────────────────────

const candidates = {};
const keys = Object.keys(slugMap);
console.error(`=== B2 cross-validation 시작 — 입력 ${keys.length}건 ===`);

let idx = 0;
for (const key of keys) {
  idx++;
  const entry = slugMap[key];
  const imgEntry = allMappings[key] ?? {};

  // _alt_original: image-mappings.json의 전체 텍스트 우선, 없으면 slug-map의 alt로 fallback
  const altOriginal = imgEntry._alt_original ?? entry.alt ?? "";
  const absPath = `${REPO}/public/source-images/${entry.source}/${entry.raster}`;

  // ── known_answer 7건: cross-validation skip → 즉시 apply ──
  if (entry.method === "known_answer") {
    candidates[key] = {
      decision: "apply",
      manifest_path: `public/source-images/${entry.source}/${entry.raster}`,
      method: entry.method,
      verdicts: { claude: "SKIP", gemini: "SKIP", gemma: "SKIP", codex: "SKIP" },
      yesCount: 0,
      noCount: 0,
      reason: "known_answer (PR A A8 검증)",
    };
    process.stderr.write(`[${idx}/${keys.length}] ${key} → apply (known_answer)\n`);
    continue;
  }

  // ── page_number_seed 13건: ±10 window cross-validation ──
  if (entry.method === "page_number_seed") {
    process.stderr.write(`[${idx}/${keys.length}] ${key} page_number_seed → ±10 window\n`);
    const result = await processPageNumberSeedWindow(key, entry, altOriginal);
    if (result) {
      candidates[key] = {
        decision: result.decision,
        manifest_path: `public/source-images/${entry.source}/${result.raster}`,
        method: entry.method,
        verdicts: result.verdicts,
        yesCount: result.yesCount ?? 0,
        noCount: result.noCount ?? 0,
        reason: result.reason,
      };
      continue;
    }
  }

  // ── raster 파일 존재 확인 ──
  if (!existsSync(absPath)) {
    candidates[key] = {
      decision: "skip",
      manifest_path: `public/source-images/${entry.source}/${entry.raster}`,
      method: entry.method,
      verdicts: { claude: "SKIP", gemini: "SKIP", gemma: "SKIP", codex: "SKIP" },
      yesCount: 0,
      noCount: 0,
      reason: `raster 없음: ${entry.raster}`,
    };
    process.stderr.write(`[${idx}/${keys.length}] ${key} → skip (raster 없음)\n`);
    continue;
  }

  process.stderr.write(`[${idx}/${keys.length}] ${key} (raster=${entry.raster})\n`);

  // ── 4종 병렬 호출 ──
  const [claude, gemini, gemma, codex] = await Promise.all([
    callClaude(absPath, altOriginal),
    callGemini(absPath, altOriginal),
    callGemma(absPath, altOriginal),
    callCodex(absPath, altOriginal),
  ]);

  const verdicts = {
    claude: claude.verdict,
    gemini: gemini.verdict,
    gemma: gemma.verdict,
    codex: codex.verdict,
  };

  const gate = consensusGate(verdicts);
  const yesCount = Object.values(verdicts).filter((x) => x === "YES").length;
  const noCount = Object.values(verdicts).filter((x) => x === "NO").length;

  candidates[key] = {
    decision: gate.decision,
    manifest_path: `public/source-images/${entry.source}/${entry.raster}`,
    method: entry.method,
    verdicts,
    yesCount,
    noCount,
    reason: gate.reason,
  };

  process.stderr.write(
    `    C=${verdicts.claude} G=${verdicts.gemini} M=${verdicts.gemma} X=${verdicts.codex}` +
      ` → ${gate.decision} (${gate.reason})\n`
  );
}

// ─── 출력 ────────────────────────────────────────────────────────

writeFileSync(OUT, JSON.stringify({ candidates }, null, 2));

const stats = { apply: 0, review: 0, skip: 0 };
for (const c of Object.values(candidates)) {
  const d = c.decision;
  if (d in stats) stats[d]++;
}

console.error("\n=== 결과 요약 ===");
console.error(`apply: ${stats.apply}건, review: ${stats.review}건, skip: ${stats.skip}건`);
console.error(`총 ${Object.keys(candidates).length}건 / 입력 ${keys.length}건`);
