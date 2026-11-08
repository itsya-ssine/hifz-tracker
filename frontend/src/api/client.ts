const BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api/v1'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Auth endpoints must never trigger the silent refresh (it would loop or hide real errors).
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']

let refreshInFlight: Promise<boolean> | null = null

/** Single-flight: concurrent 401s share one refresh request. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`
  let message = response.statusText
  try {
    const data = await response.json()
    if (typeof data?.code === 'string') code = data.code
    if (typeof data?.detail === 'string') message = data.detail
  } catch {
    // not JSON: keep defaults
  }
  return new ApiError(response.status, code, message)
}

export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path) && (await refreshSession())) {
    response = await send(path, options)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
