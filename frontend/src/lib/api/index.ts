import { request, requestRaw, setSessionHash } from "./client"
import { evidenceLimiter } from "./limiter"
import type {
  ConfirmRequest,
  ConfirmResponse,
  DraftResponse,
  EvidenceResponse,
  HealthResponse,
  IntakeRequest,
  IntakeResponse,
  PackageRequest,
  ReadinessResponse,
  ReviseResponse,
  ReviseSentence,
  SelfHeldResponse,
  SessionResponse,
  TimelineResponse,
} from "./contract"

export * from "./contract"
export * from "./errors"
export { API_BASE_URL, getSessionHash, isApiConfigured, setSessionHash } from "./client"

/**
 * 공개 API 엔드포인트 (api-contract.md).
 *
 * 화면은 이 함수들만 부른다. 백엔드가 엔드포인트를 하나씩 열 때마다 해당 화면의 목 데이터를
 * 이 호출로 갈아끼우면 되고, 그 외에는 손댈 것이 없다.
 */

/** 최초 진입 시 한 번. 응답의 해시를 저장해 이후 모든 호출에 실어 보낸다. */
export async function createSession(): Promise<SessionResponse> {
  const session = await request<SessionResponse>("/api/session", { method: "POST", anonymous: true })
  setSessionHash(session.sessionHash)
  return session
}

/** 세션 즉시 파기. 응답은 `204`다. */
export async function destroySession(): Promise<void> {
  try {
    await request<void>("/api/session", { method: "DELETE" })
  } finally {
    // 서버가 실패해도 클라이언트가 해시를 들고 있을 이유는 없다.
    setSessionHash(null)
  }
}

export function saveIntake(body: IntakeRequest): Promise<IntakeResponse> {
  return request<IntakeResponse>("/api/intake", { method: "POST", json: body })
}

/**
 * 이미지 1장 판독.
 *
 * **1장씩 병렬로 호출한다** — 응답이 도착하는 순서대로 파일별 "읽음 / 실패"를 칠 수 있어
 * SSE·폴링 인프라 없이 F3-03(파일별 진행 표시)을 만족한다. 동시 4개 상한은 `evidenceLimiter`가
 * 지킨다. `uploadEvidenceBatch`를 쓰면 신경 쓸 것이 없다.
 */
export function uploadEvidence(file: Blob, signal?: AbortSignal): Promise<EvidenceResponse> {
  const form = new FormData()
  form.append("files", file)
  return evidenceLimiter(() =>
    request<EvidenceResponse>("/api/evidence", {
      method: "POST",
      body: form,
      // FormData는 브라우저가 boundary를 붙여야 하므로 Content-Type을 직접 설정하지 않는다.
      timeout: "evidence",
      signal,
    }),
  )
}

export interface BatchResult {
  index: number
  status: "ok" | "failed"
  data?: EvidenceResponse
  error?: unknown
}

/**
 * 여러 장을 한 번에 맡긴다. **한 장이 실패해도 나머지는 계속 간다** — 부분 실패 시
 * 해당 파일만 스킵하고 진행하는 것이 F4-05다.
 *
 * `onSettled`는 응답이 도착하는 대로 불린다(업로드 순서가 아니다). 화면이 파일별 상태를
 * 그때그때 칠 수 있게 하기 위한 것이다.
 */
export async function uploadEvidenceBatch(
  files: Blob[],
  onSettled?: (result: BatchResult) => void,
): Promise<BatchResult[]> {
  return Promise.all(
    files.map(async (file, index) => {
      try {
        const data = await uploadEvidence(file)
        const result: BatchResult = { index, status: "ok", data }
        onSettled?.(result)
        return result
      } catch (error) {
        const result: BatchResult = { index, status: "failed", error }
        onSettled?.(result)
        return result
      }
    }),
  )
}

/** 텍스트 직접 입력 대체 경로 (F3-04). 판독이 전부 실패했을 때의 폴백이기도 하다. */
export function submitEvidenceText(rawText: string): Promise<{ cards: EvidenceResponse["cards"] }> {
  return request<{ cards: EvidenceResponse["cards"] }>("/api/evidence/text", {
    method: "POST",
    json: { rawText },
  })
}

/** 카드 확인·수정 저장. `confirmed: true`인 카드만 준비도·소명서의 입력이 된다. */
export function confirmCard(body: ConfirmRequest): Promise<ConfirmResponse> {
  return request<ConfirmResponse>("/api/evidence/confirm", { method: "POST", json: body })
}

export function getTimeline(): Promise<TimelineResponse> {
  return request<TimelineResponse>("/api/timeline")
}

/** 병합 승인·거절. 응답은 갱신된 타임라인 전체라 화면을 통째로 갱신하면 된다. */
export function mergeTimeline(mergeGroupIds: string[], approved: boolean): Promise<TimelineResponse> {
  return request<TimelineResponse>("/api/timeline/merge", {
    method: "POST",
    json: { mergeGroupIds, approved },
  })
}

/**
 * 준비도 점검. 날짜·금액이 low 신뢰도인 미확인 카드가 남아 있으면 서버가
 * `409 UNCONFIRMED_FIELDS`로 거부한다 — 프론트 차단(F4-06)과 별개의 방어선이다.
 */
export function checkReadiness(): Promise<ReadinessResponse> {
  return request<ReadinessResponse>("/api/readiness", { method: "POST" })
}

/**
 * 서비스에 올리지 않는 자료의 보유 표시 (F7-03 자가 진술).
 *
 * **전용 엔드포인트인 이유**: 체크리스트를 쓰는 화면이 Stage 3(`/api/readiness`)과
 * Stage 4(`/api/draft`) 둘이다. `/api/readiness` 요청 바디에만 실으면 서버에 남지 않아
 * **두 화면이 서로 다른 체크리스트를 보게 된다.**
 *
 * 응답은 **갱신된 전체 체크리스트**다 — 택일 그룹은 옵션 하나가 바뀌면 그룹 상태도
 * 바뀌므로 부분 갱신이 성립하지 않는다.
 */
export function setSelfHeld(itemId: string, held: boolean): Promise<SelfHeldResponse> {
  return request<SelfHeldResponse>("/api/checklist/self-held", {
    method: "POST",
    json: { itemId, held },
  })
}

/**
 * 미리보기에서 고친 문장을 서버가 다시 검증한다 (F7-02 재실행).
 *
 * 근거와 매칭되지 않아도 **문장을 지우지 않는다** — 경고와 함께 `user_text`로 남긴다.
 * 자동 삭제는 LLM 출력에 적용하는 규칙이고(FR-045 ③, 2026-08-25 PRD 개정),
 * 사람이 자기 사실을 적은 문장에 같은 규칙을 쓰면 성격이 다르다.
 */
export function reviseDraft(sentences: ReviseSentence[]): Promise<ReviseResponse> {
  return request<ReviseResponse>("/api/draft/revise", {
    method: "POST",
    json: { sentences },
    timeout: "draft",
  })
}

export function generateDraft(): Promise<DraftResponse> {
  return request<DraftResponse>("/api/draft", { method: "POST", timeout: "draft" })
}

/**
 * 텍스트 PDF 생성. 응답은 `application/pdf` **바이너리**이며, 프론트는 이걸 그대로
 * `pdf-lib`에 넘겨 브라우저가 만든 원본 이미지 페이지와 병합한다.
 *
 * 요청 바디의 서식 값은 **서버가 PDF 생성에만 쓰고 세션·DB·로그에 남기지 않는다.**
 */
export async function generatePackagePdf(body: PackageRequest): Promise<Blob> {
  const response = await requestRaw("/api/package/text", {
    method: "POST",
    json: body,
    timeout: "package",
  })
  return response.blob()
}

/** 킵얼라이브용. 세션 헤더가 필요 없다. */
export function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/actuator/health", { anonymous: true })
}
