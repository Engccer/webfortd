import 'server-only'

/**
 * GitHub Contents API 얇은 래퍼(fetch 직접, octokit 불추가, 호출 2종뿐).
 * master 고정: 감수자 반영 경로는 master 직행이 위원장 확정 결정(spec §2).
 */
export type GithubResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'conflict' | 'not_found' | 'auth' | 'network' }

const REPO = () => process.env.GITHUB_CONTENT_REPO ?? 'khudt-org/webfortd'
const BRANCH = 'master'

function headers(): Record<string, string> {
  return {
    authorization: `Bearer ${process.env.GITHUB_CONTENT_TOKEN ?? ''}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  }
}

function failFromStatus(status: number): GithubResult<never> {
  if (status === 401 || status === 403) return { ok: false, reason: 'auth' }
  if (status === 404) return { ok: false, reason: 'not_found' }
  if (status === 409 || status === 422) return { ok: false, reason: 'conflict' }
  return { ok: false, reason: 'network' }
}

export async function getContentFile(
  path: string,
): Promise<GithubResult<{ text: string; sha: string }>> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO()}/contents/${path}?ref=${BRANCH}`,
      { headers: headers(), cache: 'no-store' },
    )
    if (!res.ok) return failFromStatus(res.status)
    const json = (await res.json()) as { content: string; sha: string }
    const text = Buffer.from(json.content, 'base64').toString('utf-8')
    return { ok: true, value: { text, sha: json.sha } }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function putContentFile(args: {
  path: string
  text: string
  sha: string
  message: string
}): Promise<GithubResult<{ commitSha: string; contentSha: string }>> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO()}/contents/${args.path}`,
      {
        method: 'PUT',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({
          message: args.message,
          content: Buffer.from(args.text, 'utf-8').toString('base64'),
          sha: args.sha,
          branch: BRANCH,
        }),
      },
    )
    if (!res.ok) return failFromStatus(res.status)
    const json = (await res.json()) as { commit: { sha: string }; content: { sha: string } }
    return { ok: true, value: { commitSha: json.commit.sha, contentSha: json.content.sha } }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
