let csrfPromise = null

export function resetCsrf() {
  csrfPromise = null
}

async function ensureCsrf() {
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'include' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data?.detail || 'Could not initialize CSRF protection')
        return data.csrf_token
      })
      .catch(error => {
        csrfPromise = null
        throw error
      })
  }
  return csrfPromise
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const method = (options.method || 'GET').toUpperCase()
  const authExchange = ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(path)
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && !authExchange) {
    headers.set('X-CSRF-Token', await ensureCsrf())
  }
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE' && options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  })

  if (response.status === 204) return null
  const text = await response.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) {
    const error = new Error(data?.detail || data?.message || `Request failed (${response.status})`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export function unwrapList(data, key) {
  if (Array.isArray(data)) return data
  if (data?.items) return data.items
  if (data?.results) return data.results
  if (key && data?.[key]) return data[key]
  return []
}
