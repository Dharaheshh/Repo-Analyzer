const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

export const analyzeRepo = (repoUrl) =>
  request('/analyze', { method: 'POST', body: JSON.stringify({ repoUrl }) })

export const getAnalyses = (page = 1, q = '') =>
  request(`/analyses?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`)

export const getAnalysis = (id) => request(`/analyses/${id}`)
