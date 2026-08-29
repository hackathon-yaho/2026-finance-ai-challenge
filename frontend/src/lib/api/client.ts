import { ApiError, DEFAULT_MESSAGE, toErrorCode } from "./errors"
import type { ApiErrorBody } from "./errors"

/**
 * 공개 API 호출 래퍼 (api-contract.md).
 *
 * 세션은 **커스텀 헤더 `X-Session-Hash`** 로 전달한다. 쿠키를 쓰지 않으므로
 * `credentials: "include"`가 필요 없다 — 프론트(정적 호스팅)와 백엔드(Render)의 도메인이
 * 달라 크로스오리진 쿠키의 `SameSite=None; Secure`와 브라우저 추적 방지 정책을 피한 결정이다.
 */

/** 배포에서는 `VITE_API_BASE_URL`을 주입한다. 비어 있으면 API를 붙이지 않은 상태로 본다. */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

/** API가 연결돼 있는지. 화면은 이 값으로 목/실호출을 가른다. */
export function isApiConfigured(): boolean {
  return API_BASE_URL !== ""
}

/**
 * 타임아웃. **백엔드가 AI-server에 거는 상한보다 넉넉히 잡는다** — 클라이언트가 먼저
 * 끊으면 서버가 정상 응답을 만들고 있는데도 실패로 보인다.
 *
 * | 호출 | 백엔드 상한 | 여기 |
 * | --- | --- | --- |
 * | `/api/evidence` | 20초 (`AiServerConfig.extractRestClient`) | 25초 |
 * | `/api/draft` | **30초** (`AiServerConfig.draftRestClient`) | 35초 |
 *
 * `draft`가 20초였다. 2026-08-27에 백엔드가 15 → 30초로 올렸는데(`256e8ea`, AI가
 * `draft_effort`를 낮추고 예산을 25초로 잡은 것에 맞춘 값) 여기가 따라가지 않아,
 * **서버는 소명서를 만들고 있는데 화면만 "만들지 못했어요"로 끝나는 구간**이 10초
 * 생겼다. 계약의 단일 출처는 `docs/02-architecture/internal-api-contract.md`
 * "타임아웃 및 재시도" 표다.
 *
 * **재시도 1회까지는 덮지 않는다.** 계약상 최악은 50초(25+25)지만, 그만큼 기다리게
 * 하는 것보다 실패로 보이는 편이 낫다고 판단했다. 여기서 덮는 것은 **한 번의 정상
 * 시도**이고, 그 상한이 백엔드의 30초다.
 */
const TIMEOUT_MS = {
  default: 15_000,
  evidence: 25_000,
  draft: 35_000,
  package: 30_000,
} as const

export type TimeoutKind = keyof typeof TIMEOUT_MS

/**
 * 세션 해시는 **탭 단위**로만 산다.
 *
 * `sessionStorage`를 쓰는 이유: 새로고침하면 브라우저 메모리의 원본 이미지는 사라지지만
 * 서버 세션의 추출 결과·소명서는 30분 TTL 동안 남는다(PRD 리스크 레지스터). 해시를 잃으면
 * 그 결과까지 버리게 되어 사용자가 처음부터 다시 해야 한다. 탭을 닫으면 함께 사라지므로
 * "탭을 닫으면 사라져요"라는 화면 약속과도 어긋나지 않는다.
 */
const SESSION_KEY = "haebing.sessionHash"

let sessionHash: string | null = null

export function getSessionHash(): string | null {
  if (sessionHash !== null) return sessionHash
  try {
    sessionHash = window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    // 사파리 프라이빗 모드 등에서 접근이 막힐 수 있다. 메모리에만 두고 진행한다.
    sessionHash = null
  }
  return sessionHash
}

export function setSessionHash(hash: string | null) {
  sessionHash = hash
  try {
    if (hash === null) window.sessionStorage.removeItem(SESSION_KEY)
    else window.sessionStorage.setItem(SESSION_KEY, hash)
  } catch {
    /* 메모리 값만으로 진행한다 */
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE"
  /** JSON 바디. `body`와 함께 쓰지 않는다. */
  json?: unknown
  /** 바이너리 바디(이미지 등). `contentType`을 함께 준다. */
  body?: BodyInit
  contentType?: string
  /** 세션 헤더를 붙이지 않는다. `POST /api/session`·헬스체크만 해당. */
  anonymous?: boolean
  timeout?: TimeoutKind
  signal?: AbortSignal
}

function buildHeaders(options: RequestOptions): HeadersInit {
  const headers: Record<string, string> = {}
  if (options.json !== undefined) headers["Content-Type"] = "application/json"
  if (options.contentType) headers["Content-Type"] = options.contentType

  if (!options.anonymous) {
    const hash = getSessionHash()
    if (hash) headers["X-Session-Hash"] = hash
  }
  return headers
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // 오류 응답이 JSON이 아닐 수 있다 (프록시 502 등).
  }
  const code = toErrorCode(body?.error)
  const message = body?.message?.trim() || DEFAULT_MESSAGE[code]
  return new ApiError(code, response.status, message, body?.fallback ?? null)
}

/**
 * 응답 본문을 파싱하지 않고 `Response`를 돌려준다 — PDF처럼 바이너리를 받는 곳이 쓴다.
 * 오류는 여기서 `ApiError`로 바꿔 던진다.
 */
export async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[options.timeout ?? "default"])
  if (options.signal) options.signal.addEventListener("abort", () => controller.abort(), { once: true })

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: buildHeaders(options),
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      signal: controller.signal,
    })
  } catch (cause) {
    // 사용자가 취소한 것과 시간이 초과된 것을 구분한다.
    if (options.signal?.aborted) throw cause
    const aborted = cause instanceof DOMException && cause.name === "AbortError"
    throw new ApiError(
      aborted ? "TIMEOUT" : "UNKNOWN",
      0,
      aborted ? DEFAULT_MESSAGE.TIMEOUT : DEFAULT_MESSAGE.UNKNOWN,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const error = await toApiError(response)
    // 세션이 만료되면 들고 있던 해시는 더 이상 쓸모가 없다. 다음 호출이 재사용하지 않도록 버린다.
    if (error.code === "SESSION_EXPIRED") setSessionHash(null)
    throw error
  }
  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestRaw(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
