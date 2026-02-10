const FILE_PATH = 'money-tracker.enc'
const API_BASE = 'https://api.github.com'

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

interface FileInfo {
  sha: string
  content?: string
  encoding?: string
  size?: number
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function getFile(
  repo: string,
  token: string,
): Promise<{ data: Uint8Array; sha: string } | null> {
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${FILE_PATH}`, {
    headers: headers(token),
  })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)

  const file: FileInfo = await res.json()

  // Small files: content is inline base64
  if (file.content) {
    return { data: base64ToBytes(file.content), sha: file.sha }
  }

  // Large files (>1MB): Contents API omits content, use Git Blobs API
  const blobRes = await fetch(`${API_BASE}/repos/${repo}/git/blobs/${file.sha}`, {
    headers: headers(token),
  })
  if (!blobRes.ok) throw new Error(`GitHub Blob API error: ${blobRes.status}`)
  const blob: { content: string; sha: string } = await blobRes.json()
  return { data: base64ToBytes(blob.content), sha: blob.sha }
}

export async function putFile(
  repo: string,
  token: string,
  data: Uint8Array,
  existingSha: string | null,
): Promise<string> {
  // Base64 encode the binary data
  const chunks: string[] = []
  for (let i = 0; i < data.length; i += 8192) {
    chunks.push(String.fromCharCode(...data.subarray(i, i + 8192)))
  }
  const content = btoa(chunks.join(''))

  const body: Record<string, string> = {
    message: `sync: ${new Date().toISOString()}`,
    content,
  }
  if (existingSha) {
    body.sha = existingSha
  }

  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub API error: ${res.status} ${err.message || ''}`)
  }

  const result = await res.json()
  return result.content.sha
}

export async function getFileMeta(
  repo: string,
  token: string,
): Promise<{ sha: string } | null> {
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${FILE_PATH}`, {
    method: 'HEAD',
    headers: headers(token),
  })

  if (res.status === 404) return null
  if (!res.ok) return null

  // HEAD doesn't return body, re-fetch with GET for sha
  const getRes = await fetch(`${API_BASE}/repos/${repo}/contents/${FILE_PATH}`, {
    headers: headers(token),
  })
  if (!getRes.ok) return null
  const file = await getRes.json()
  return { sha: file.sha }
}

export async function validateCredentials(repo: string, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/repos/${repo}`, {
    headers: headers(token),
  })
  return res.ok
}
