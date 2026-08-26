/**
 * 공개 API 오류 (api-contract.md "공통 오류 응답").
 *
 * 서버는 `{ error, message, fallback }` 형태로 내려준다. 화면은 **`message`를 그대로
 * 노출**하고 순화하지 않는다 — 법령 근거 문구가 섞여 있어 우리가 다듬으면 계약 위반이다.
 */

export type ApiErrorCode =
  | "EXTRACTION_FAILED"
  | "TIMEOUT"
  | "SESSION_EXPIRED"
  | "UNCONFIRMED_FIELDS"
  | "INVALID_FORM_FIELD"
  | "QUOTA_EXCEEDED"
  /**
   * AI-server 설정 오류 (`500`, 계약 v1.12). LLM 키 미설정·인증 실패 등 **사용자 입력과 무관**하다.
   *
   * **텍스트 입력으로 유도하지 않는다.** 무엇을 다시 올리든 결과가 같아서, 사용자를 다른 경로로
   * 보내면 같은 자리를 맴돌 뿐이다. 백엔드도 이 코드는 재시도하지 않는다.
   */
  | "AI_CONFIG_ERROR"
  /** `/api/draft` 생성 실패 (`502`, 계약 v1.9). **`fallback`이 없다** — 대체 경로가 없다. */
  | "DRAFT_FAILED"
  /** 계약에 없는 상태(5xx·네트워크 끊김 등). 화면은 일반 오류로 다룬다. */
  | "UNKNOWN"

export interface ApiErrorBody {
  error: string
  message?: string
  fallback?: string
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  /** 서버가 알려준 대체 경로. 예: `/api/evidence/text` */
  readonly fallback: string | null

  constructor(code: ApiErrorCode, status: number, message: string, fallback: string | null = null) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.fallback = fallback
  }
}

const KNOWN: ApiErrorCode[] = [
  "EXTRACTION_FAILED",
  "TIMEOUT",
  "SESSION_EXPIRED",
  "UNCONFIRMED_FIELDS",
  "INVALID_FORM_FIELD",
  "QUOTA_EXCEEDED",
  "DRAFT_FAILED",
  "AI_CONFIG_ERROR",
]

export function toErrorCode(value: unknown): ApiErrorCode {
  return typeof value === "string" && (KNOWN as string[]).includes(value) ? (value as ApiErrorCode) : "UNKNOWN"
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/**
 * 코드별 기본 화면 문구. **서버가 `message`를 주면 그걸 쓰고, 이건 없을 때만 쓴다.**
 * 승인·기각을 예측하는 표현을 넣지 않는다.
 */
export const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  /**
   * **경로별로 문구가 다르다** (계약 v1.12). 이미지 경로만 `fallback`으로 텍스트 입력을
   * 안내하고, 텍스트 경로에는 `fallback`이 없다 — 이미 텍스트로 보낸 요청에 텍스트 입력을
   * 다시 권하면 같은 자리를 맴돈다. 서버가 경로에 맞는 `message`를 주므로 그걸 쓰고,
   * 여기 기본값은 **어느 경로에서도 틀리지 않은 문장**으로 둔다.
   */
  EXTRACTION_FAILED: "올려주신 자료에서 거래 정보를 찾지 못했어요.",
  TIMEOUT: "일부 자료를 읽지 못했어요. 읽은 것만 먼저 보여드릴게요.",
  SESSION_EXPIRED: "30분 동안 움직임이 없어 처음부터 다시 해야 해요. 올린 자료는 서버에 없어서 다시 올려주셔야 해요.",
  UNCONFIRMED_FIELDS: "먼저 확인해야 하는 자료가 있어요. 확인하고 다시 시도해주세요.",
  INVALID_FORM_FIELD: "입력한 값의 형식을 확인해주세요.",
  QUOTA_EXCEEDED: "지금은 예시 데이터로 보여드릴게요.",
  // 재시도 외에 할 수 있는 것이 없다. 사용자 탓으로 읽히는 문구를 쓰지 않는다.
  DRAFT_FAILED: "소명서를 만들지 못했어요. 잠시 후 다시 시도해주세요. 확인한 자료는 그대로 있어요.",
  // 사용자가 자료를 다시 올려서 풀 수 있는 문제가 아니다. 다른 경로를 권하지 않는다.
  AI_CONFIG_ERROR: "일시적인 오류로 처리하지 못했어요. 잠시 후 다시 시도해주세요.",
  UNKNOWN: "잠시 문제가 생겼어요. 다시 시도해주세요.",
}
