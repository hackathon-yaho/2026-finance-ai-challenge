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
  EXTRACTION_FAILED: "이미지에서 내용을 읽지 못했어요. 텍스트로 직접 적어주세요.",
  TIMEOUT: "일부 자료를 읽지 못했어요. 읽은 것만 먼저 보여드릴게요.",
  SESSION_EXPIRED: "30분 동안 움직임이 없어 처음부터 다시 해야 해요. 올린 자료는 서버에 없어서 다시 올려주셔야 해요.",
  UNCONFIRMED_FIELDS: "판독 신뢰도가 낮은 자료를 먼저 확인해주세요.",
  INVALID_FORM_FIELD: "입력한 값의 형식을 확인해주세요.",
  QUOTA_EXCEEDED: "지금은 예시 데이터로 보여드릴게요.",
  UNKNOWN: "잠시 문제가 생겼어요. 다시 시도해주세요.",
}
