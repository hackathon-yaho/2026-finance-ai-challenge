import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DELIVERY_BY_LABEL, INTAKE_PAGES, QUESTIONS, REASON_BY_KIND, USAGE_BY_LABEL, isFieldVisible } from "../data"
import {
  applyCardStates,
  blockingCards,
  buildCards,
  confirmedBankAmount,
  confirmedEvidence,
  evidenceIdOf,
  pendingCards,
} from "../lib/cards"
import type { CardState } from "../lib/cards"
import { buildChecklist } from "../lib/checklist"
import { EMPTY_LEGAL_FORM, toPackageRequest } from "../lib/legalForm"
import type { LegalFormValues } from "../lib/legalForm"
import { buildDraftLines, buildDraftLinesFromCards } from "../lib/draft"
import { getAmountInfo } from "../lib/amount"
import { getDeadline } from "../lib/deadline"
import { isAnswered } from "../lib/intake"
import { computeReadiness } from "../lib/readiness"
import { buildTimeline, buildTimelineFromCards } from "../lib/timeline"
import { buildTextCards, scrubPii } from "../lib/textEntry"
import { MAX_UPLOADS, REJECT_MESSAGE, validateImageFile } from "../lib/upload"
import { buildPackagePdf } from "../lib/pdf"
import * as api from "../lib/api"
import { toDeadlineInfo, toDraftLines, toReadinessResult, toSubmitTimeline, toTimelineEvents } from "../lib/api/adapt"
import type { ChecklistItem, DraftLine, ExtractedCard, ReadinessResult, TimelineEvent } from "../types"
import type { DeadlineInfo } from "../lib/deadline"
import type {
  CardEdits,
  DueNoticeStatus,
  EvidenceId,
  EvidenceState,
  IntakeAnswers,
  IntakeField,
  PendingUpload,
  UploadedFile,
  ViewerId,
} from "../types"

const INITIAL_INTAKE: IntakeAnswers = {
  when: null,
  whenUnknown: false,
  noticeStatus: null,
  noticeDate: null,
  amount: null,
  amountUnknown: false,
  kind: null,
  delivery: null,
  history: null,
  usage: null,
}
const INITIAL_EVIDENCE: EvidenceState = { autopay: true, chat: true, bank: true, shipping: true, threat: false }

/**
 * 서버가 준 값. **하나라도 차 있으면 그 자리의 목 계산을 덮는다.**
 *
 * 목을 지우지 않고 남겨 둔 이유: `VITE_API_BASE_URL`이 비어 있으면 백엔드 없이도 화면이
 * 끝까지 돌아야 한다. 배포본이 백엔드보다 먼저 뜨는 구간이 있고, 데모에서 백엔드가 죽어도
 * 화면은 살아 있어야 한다. 판정 규칙의 단일 소스는 서버지만(`reason-type-rules.md`),
 * **연결되지 않은 상태에서 빈 화면을 보여주는 것보다 목이 낫다.**
 */
interface ServerState {
  deadline: DeadlineInfo | null
  cards: ExtractedCard[] | null
  timeline: TimelineEvent[] | null
  submitTimeline: TimelineEvent[] | null
  checklist: ChecklistItem[] | null
  readiness: ReadinessResult | null
  draftLines: DraftLine[] | null
  /** `/api/evidence/confirm` 응답. 준비도 신호 문구가 이 값을 쓴다. */
  unconfirmedCount: number | null
  /** `/api/evidence` 응답의 `signals.threat_detected`. 한 번 켜지면 내리지 않는다. */
  threatDetected: boolean
}

const EMPTY_SERVER: ServerState = {
  deadline: null,
  cards: null,
  timeline: null,
  submitTimeline: null,
  checklist: null,
  readiness: null,
  draftLines: null,
  unconfirmedCount: null,
  threatDetected: false,
}

export function useHaebingFlow() {
  const [stage, setStage] = useState(0)
  const [intakePage, setIntakePage] = useState(0)
  // 0 = 방향 없음(최초 진입·재시작). 진입 애니메이션을 세로 상승으로 둔다.
  const [navDir, setNavDir] = useState<0 | 1 | -1>(0)
  const [intake, setIntake] = useState<IntakeAnswers>(INITIAL_INTAKE)
  // 열려 있는 날짜 선택 시트가 어느 문항의 것인지. 시트 자체는 App이 그린다.
  const [dateSheet, setDateSheet] = useState<"when" | "notice" | null>(null)
  const [evidence, setEvidence] = useState<EvidenceState>(INITIAL_EVIDENCE)
  // 카드별 확인·수정 상태. 판독 결과 자체는 lib/cards가 만들고, 사용자가 손댄 것만 여기 쌓인다.
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [timelineRunId, setTimelineRunId] = useState(0)
  const [historyOverride, setHistoryOverride] = useState<boolean | null>(null)
  // fulfillBy: "self" 항목(신분증·재직증명서 등)은 서비스에 올리지 않으므로 보유 여부를
  // 판정할 방법이 없다. 사용자가 직접 표시한 것만 충족으로 본다.
  const [selfHeld, setSelfHeld] = useState<ReadonlySet<string>>(() => new Set())
  // 별지 제4호서식 11필드 (S04-1). 값은 PDF 생성에만 쓰고 어디에도 저장하지 않는다.
  const [legalForm, setLegalForm] = useState<LegalFormValues>(EMPTY_LEGAL_FORM)
  const [legalFormOpen, setLegalFormOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  /**
   * 미리보기에서 뺀 문장. `/api/package/text` 요청의 `excludedSentenceIds`로 나간다.
   *
   * **토글할 때마다 서버를 부르지 않는다.** 제외는 문장을 고치는 게 아니라 체크박스에
   * 가까워서, 왕복하면 느리고 실패 처리만 늘어난다. 내려받기 직전에 최종 목록을 한 번
   * 보낸다. `/api/draft/revise`는 **문장 텍스트를 실제로 고쳤을 때만** 부른다.
   *
   * 이 전제(=`excludedSentenceIds`가 제외의 최종 소스)는 백엔드에 확인을 요청해 뒀다
   * (`docs/response/backend/draft-revise-and-package-notes.md` §2). 아니라면 토글마다
   * 서버를 불러야 해서 이 상태의 성격이 달라진다.
   */
  const [excludedSentences, setExcludedSentences] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * 사용자가 미리보기를 거쳐 내려받은 시각. F8-01 하단 표기의 `{시각}`이 이 값이다.
   * **확인 단계를 거치기 전에는 "확인 완료"라고 적지 않는다** — 그 표기가 사실이어야 한다.
   */
  const [packageConfirmedAt, setPackageConfirmedAt] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftShown, setDraftShown] = useState(false)
  const [viewer, setViewer] = useState<ViewerId | null>(null)
  const [viewerNote, setViewerNote] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // 발급한 object URL 장부. revoke하지 않으면 blob이 탭이 닫힐 때까지 메모리에 남는다.
  const liveUrls = useRef(new Set<string>())

  const [filesReady, setFilesReady] = useState(false)
  /**
   * 텍스트 직접 입력 (F3-04).
   *
   * `entryMode`가 `"text"`면 카드가 목 이미지가 아니라 사용자가 쓴 글에서 나온다.
   * 두 경로의 카드를 섞지 않는다 — 섞으면 사용자가 올리지도 쓰지도 않은 사건이 문서에 들어간다.
   */
  const [entryMode, setEntryMode] = useState<"upload" | "text">("upload")
  const [textEntryOpen, setTextEntryOpen] = useState(false)
  const [textEntryFromFailure, setTextEntryFromFailure] = useState(false)
  const [textCards, setTextCards] = useState<ExtractedCard[]>([])
  const [pendingQueue, setPendingQueue] = useState<PendingUpload[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [lightboxFileId, setLightboxFileId] = useState<string | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)

  /** `VITE_API_BASE_URL`이 설정돼 있으면 실제 호출, 아니면 목. 실행 중에 바뀌지 않는다. */
  const live = useRef(api.isApiConfigured()).current
  const [server, setServer] = useState<ServerState>(EMPTY_SERVER)
  /** `/api/draft/revise`가 준 경고. 서버 문자열을 그대로 노출한다. */
  const [reviseWarning, setReviseWarning] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(!live)
  /** `/api/evidence` 판독이 도는 중. 화면이 "읽었어요"라고 말하기 전에 알아야 한다. */
  const [extracting, setExtracting] = useState(false)
  // `runLive`가 `restart`보다 위에 있어야 하는데 서로를 참조한다. ref로 끊는다.
  const restartRef = useRef<(() => void) | null>(null)
  /** 이미 `/api/evidence`로 보낸 파일 수. 다음 `imageIndex`의 시작점이기도 하다. */
  const sentCount = useRef(0)

  // 세션은 진입 시 한 번. 실패해도 화면을 막지 않는다 — 목으로라도 끝까지 가는 편이 낫다.
  useEffect(() => {
    if (!live) return
    let cancelled = false
    api
      .createSession()
      .catch(() => null)
      .then(() => {
        if (!cancelled) setSessionReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [live])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  /**
   * 서버 호출 한 건을 감싼다.
   *
   * **오류를 삼키지 않는다** — `message`는 서버가 단일 소스인 문구라 그대로 띄우고,
   * 우리가 순화하지 않는다. `SESSION_EXPIRED`(410)만 특별히 다룬다: 세션이 사라지면
   * 그 뒤 호출이 전부 같은 오류를 내므로 처음으로 되돌린다. **원본 이미지는 서버에 없었으니
   * 다시 올려야 한다는 것까지 말해준다** — 그걸 모르면 사용자는 자료가 남아 있는 줄 안다.
   */
  /**
   * 서버 호출 한 번. 실패하면 토스트를 띄우고 `null`을 돌려준다.
   *
   * `failMessage`는 **그 호출에만 맞는 문구**를 쓰고 싶을 때 준다. 기본 문구는 코드 단위라
   * 여러 호출이 나눠 쓰는데, 같은 `TIMEOUT`이어도 자료 판독 실패와 소명서 생성 실패는
   * 사용자가 해야 할 일이 다르다. **세션 만료는 예외** — 그때는 화면이 처음으로 돌아가므로
   * 무슨 일이 일어났는지 말해주는 쪽이 맞다.
   */
  const runLive = useCallback(
    async <T,>(call: () => Promise<T>, failMessage?: string): Promise<T | null> => {
      try {
        return await call()
      } catch (error) {
        const expired = api.isApiError(error) && error.code === "SESSION_EXPIRED"
        const serverMessage = api.isApiError(error) ? error.message : api.DEFAULT_MESSAGE.UNKNOWN
        if (expired) {
          setServer(EMPTY_SERVER)
          restartRef.current?.()
        }
        showToast(expired || !failMessage ? serverMessage : failMessage)
        return null
      }
    },
    [showToast],
  )


  useEffect(() => {
    const urls = liveUrls.current
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const trackUrl = useCallback((url: string) => {
    liveUrls.current.add(url)
    return url
  }, [])

  const revokeUrl = useCallback((url: string | null | undefined) => {
    if (url && liveUrls.current.delete(url)) URL.revokeObjectURL(url)
  }, [])

  const go = useCallback((n: number) => {
    const next = Math.max(0, Math.min(5, n))
    // 같은 단계를 다시 고르는 경우도 문진 쪽이 0으로 되감기므로 후진으로 본다.
    setNavDir(next > stage ? 1 : -1)
    setStage(next)
    setIntakePage(0)
    setDateSheet(null)
    setViewer(null)
    setViewerNote(null)
    window.scrollTo(0, 0)
  }, [stage])

  // 상황 접수 안에서만 움직이는 서브스텝 이동. dir은 진입 애니메이션 방향에 쓴다.
  const goIntakePage = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(INTAKE_PAGES.length - 1, n))
      setNavDir(next >= intakePage ? 1 : -1)
      setIntakePage(next)
      setDateSheet(null)
      window.scrollTo(0, 0)
    },
    [intakePage],
  )

  // 뒤로가기는 서브스텝을 먼저 소진한 뒤에 이전 단계로 나간다.
  const back = useCallback(() => {
    if (stage === 1 && intakePage > 0) {
      goIntakePage(intakePage - 1)
      return
    }
    go(stage - 1)
  }, [stage, intakePage, goIntakePage, go])

  /**
   * 문진 응답 변경. F2-03에 따라 손을 대는 즉시 준비도·소명서를 무효화한다 —
   * 앞 단계 답이 바뀐 채로 뒤 단계 결과가 남아 있으면 틀린 서류가 만들어진다.
   */
  const editIntake = useCallback((patch: (prev: IntakeAnswers) => Partial<IntakeAnswers>) => {
    setIntake((prev) => ({ ...prev, ...patch(prev) }))
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

  const pick = useCallback(
    (field: IntakeField, value: string) => {
      editIntake((prev) => {
        // 거래 성격을 물품이 아닌 것으로 바꾸면 거래 방식(F2-01a)은 물어본 적 없는 값이 된다.
        // 남겨두면 화면에 보이지 않는 값이 그대로 서버로 나간다.
        if (field === "kind" && REASON_BY_KIND[value] !== "goods" && prev.delivery !== null) {
          return { kind: value, delivery: null }
        }
        return { [field]: value }
      })
    },
    [editIntake],
  )

  const openDateSheet = useCallback((field: "when" | "notice") => {
    setDateSheet(field)
  }, [])

  const closeDateSheet = useCallback(() => {
    setDateSheet(null)
  }, [])

  /** 날짜 시트에서 고른 값을 열려 있던 문항에 적는다. */
  const commitDate = useCallback(
    (iso: string) => {
      if (dateSheet === "when") editIntake(() => ({ when: iso, whenUnknown: false }))
      else if (dateSheet === "notice") editIntake(() => ({ noticeDate: iso }))
      setDateSheet(null)
    },
    [dateSheet, editIntake],
  )

  // "모름"과 입력값은 동시에 유효하지 않다. 켤 때 값을 비워 둘이 어긋나지 않게 한다.
  const toggleWhenUnknown = useCallback(() => {
    editIntake((prev) => (prev.whenUnknown ? { whenUnknown: false } : { whenUnknown: true, when: null }))
  }, [editIntake])

  const setNoticeStatus = useCallback(
    (status: DueNoticeStatus) => {
      // 통지받음이 아니면 공고일은 의미가 없다. 남겨두면 기한 계산에 유령 값이 섞인다.
      editIntake((prev) => ({ noticeStatus: status, noticeDate: status === "notified" ? prev.noticeDate : null }))
    },
    [editIntake],
  )

  const setAmount = useCallback(
    (value: number | null) => {
      editIntake(() => ({ amount: value, amountUnknown: false }))
    },
    [editIntake],
  )

  const toggleAmountUnknown = useCallback(() => {
    editIntake((prev) => (prev.amountUnknown ? { amountUnknown: false } : { amountUnknown: true, amount: null }))
  }, [editIntake])

  const toggle = useCallback((id: EvidenceId) => {
    setEvidence((prev) => ({ ...prev, [id]: !prev[id] }))
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

  /** 카드 빼기 = 그 자료를 없는 것으로 둔다. 타임라인 공백 액션으로 다시 넣을 수 있다. */
  /**
   * 카드 삭제 (F4-06 처리 ④). 서버에서는 `confirmed: false`가 삭제다 (계약 v1.8).
   *
   * 목에서는 증거 유형 토글을 끄는 것으로 흉내 냈다 — 유형당 카드가 하나뿐이라 성립하던
   * 근사다. 서버 카드는 한 이미지에서 여러 장이 나오므로 `event_id` 단위로 지운다.
   */
  const removeCard = useCallback(
    (eventId: string) => {
      if (live) {
        setServer((prev) => ({ ...prev, cards: prev.cards?.filter((c) => c.event_id !== eventId) ?? null }))
        void runLive(() =>
          api.deleteCard(eventId).then((res) => setServer((prev) => ({ ...prev, unconfirmedCount: res.unconfirmedCount }))),
        )
        setDraftShown(false)
        return
      }
      const id = evidenceIdOf(eventId)
      if (id) toggle(id)
    },
    [live, runLive, toggle],
  )

  /**
   * `[협박 문자 캡처 추가하기]`.
   *
   * **연결된 상태에서는 업로드 화면으로 보낸다.** 목에서는 증거 유형 토글을 켜는 것으로
   * 흉내 냈는데, 서버에 붙으면 카드도 타임라인도 서버 값이 우선이라 **이 토글이 화면에
   * 아무 영향을 주지 않는다** — 눌러도 아무 일이 없으면서 사용자는 첨부됐다고 믿는다.
   * 협박 대응은 P0(FR-024)라 그런 채로 둘 수 없다.
   *
   * 실제로 필요한 동작은 "그 캡처를 올리는 것"이고, 올리면 AI가 `source_type: "threat"`으로
   * 분류하며 `signals.threat_detected`가 켜져 상단 배너로 이어진다 (F10-02).
   */
  const addThreat = useCallback(() => {
    if (live) {
      setFilesReady(false)
      return
    }
    setEvidence((prev) => ({ ...prev, threat: true }))
    setDraftShown(false)
  }, [live])

  /**
   * 카드 상태를 화면에 **먼저** 반영하고 서버에 보낸다.
   *
   * 낙관적 갱신이 맞다고 본 이유: 확인은 사용자가 "이 값이 맞다"고 선언하는 행위지 서버가
   * 판정하는 것이 아니다. 왕복을 기다리면 체크 하나 누를 때마다 화면이 멈춘다. 실패하면
   * `runLive`가 오류를 띄우고, 다음 단계(`/api/readiness`)가 서버 기준으로 다시 막는다.
   */
  const pushCardState = useCallback(
    (eventId: string, edits: CardEdits) => {
      if (!live) return
      const corrections = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== undefined))
      void runLive(() =>
        api
          .confirmCard({ cardId: eventId, confirmed: true, corrections })
          .then((res) => setServer((prev) => ({ ...prev, unconfirmedCount: res.unconfirmedCount }))),
      )
    },
    [live, runLive],
  )

  const confirmCard = useCallback(
    (eventId: string) => {
      setCardStates((prev) => ({
        ...prev,
        // 이미 고친 카드를 다시 확인해도 "사용자 수정" 표기는 유지한다.
        [eventId]: { status: prev[eventId]?.edits && Object.keys(prev[eventId].edits).length > 0 ? "user_corrected" : "user_confirmed", edits: prev[eventId]?.edits ?? {} },
      }))
      setDraftShown(false)
      setCardStates((prev) => {
        pushCardState(eventId, prev[eventId]?.edits ?? {})
        return prev
      })
    },
    [pushCardState],
  )

  /** 값을 고치면 확인까지 한 것으로 본다 — 고친 사람이 그 값을 본 것이다 (F4-06 ②③). */
  const editCard = useCallback(
    (eventId: string, patch: CardEdits) => {
      setCardStates((prev) => ({
        ...prev,
        [eventId]: { status: "user_corrected", edits: { ...prev[eventId]?.edits, ...patch } },
      }))
      setDraftShown(false)
      setCardStates((prev) => {
        pushCardState(eventId, { ...prev[eventId]?.edits, ...patch })
        return prev
      })
    },
    [pushCardState],
  )

  const analyze = useCallback(() => {
    setAnalyzing(true)
    if (live) {
      void runLive(() => api.getTimeline())
        .then((res) => {
          if (res) {
            setServer((prev) => ({
              ...prev,
              timeline: toTimelineEvents(res),
              // 제출본 3면은 확인된 카드만, 공백 없이 (F8-01).
              submitTimeline: toSubmitTimeline(res),
            }))
          }
        })
        .finally(() => {
          setAnalyzing(false)
          setAnalyzed(true)
          setTimelineRunId((id) => id + 1)
        })
      return
    }
    setTimeout(() => {
      setAnalyzing(false)
      setAnalyzed(true)
      setTimelineRunId((id) => id + 1)
    }, 850)
  }, [live, runLive])

  /**
   * 직접 첨부 항목(신분증·재직증명서 등)의 보유 표시.
   *
   * **소명서를 무효화하지 않는다.** 이 값은 첨부 서류 체크리스트에만 영향을 주고 소명서
   * 본문에는 들어가지 않는다 — 서비스에 올리지 않는 서류라 문장의 근거가 될 수 없다.
   * 종전에는 F2-03(문진 변경 시 하위 단계 무효화)을 넓게 적용해 여기서도 초안을 지웠는데,
   * 사용자가 소명서를 읽다가 "신분증 있어요"를 누르면 초안이 통째로 사라지고 다시
   * 만들어야 했다. 체크리스트는 이 토글로 즉시 갱신된다.
   */
  const toggleSelfHeld = useCallback(
    (id: string) => {
      setSelfHeld((prev) => {
        const next = new Set(prev)
        const held = !next.delete(id)
        if (held) next.add(id)
        if (live) {
          // 응답은 **갱신된 전체 체크리스트**다 — 택일 그룹은 옵션 하나가 바뀌면 그룹
          // 상태도 바뀌므로 부분 갱신이 성립하지 않는다.
          void runLive(() =>
            api.setSelfHeld(id, held).then((res) => setServer((s) => ({ ...s, checklist: res.checklist }))),
          )
        }
        return next
      })
    },
    [live, runLive],
  )

  const toggleHistory = useCallback(() => {
    setHistoryOverride((prev) => (prev === true ? false : true))
    setDraftShown(false)
  }, [])

  const openLegalForm = useCallback(() => setLegalFormOpen(true), [])
  const closeLegalForm = useCallback(() => setLegalFormOpen(false), [])
  const submitLegalForm = useCallback((values: LegalFormValues) => {
    setLegalForm(values)
    setLegalFormOpen(false)
    setPreviewOpen(true)
  }, [])

  const closePreview = useCallback(() => setPreviewOpen(false), [])

  const toggleExcludedSentence = useCallback((sentenceId: string) => {
    setExcludedSentences((prev) => {
      const next = new Set(prev)
      if (!next.delete(sentenceId)) next.add(sentenceId)
      return next
    })
  }, [])

  const confirmPackage = useCallback(() => {
    setPreviewOpen(false)
    setPackageConfirmedAt(
      new Date().toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }),
    )
  }, [])

  const makeDraft = useCallback(() => {
    setDrafting(true)
    if (live) {
      // **실패하면 소명서 화면으로 넘기지 않는다.** 넘기면 문장 0개인 화면이 성공한 것처럼
      // 보이고, 그대로 내보내면 1·2면이 "확인된 사실관계가 없습니다"로 찍힌 서류가 은행에
      // 간다. `draftShown`을 안 올리면 [초안 만들기] 버튼이 남아 다시 시도할 수 있다.
      void runLive(
        () => api.generateDraft(),
        "소명서를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      )
        .then((res) => {
          if (!res) return
          setServer((prev) => ({ ...prev, draftLines: toDraftLines(res), checklist: res.checklist }))
          setDraftShown(true)
        })
        .finally(() => setDrafting(false))
      return
    }
    setTimeout(() => {
      setDrafting(false)
      setDraftShown(true)
    }, 900)
  }, [live, runLive])

  const openViewer = useCallback((id: ViewerId, note?: string | null) => {
    setViewer(id)
    setViewerNote(note ?? null)
  }, [])

  const closeViewer = useCallback(() => {
    setViewer(null)
    setViewerNote(null)
  }, [])


  const addFiles = useCallback(
    async (fileList: FileList) => {
      const picked = Array.from(fileList)
      const room = Math.max(0, MAX_UPLOADS - (uploadedFiles.length + pendingQueue.length))
      const overflowed = picked.length > room

      // F3-02: 위반한 파일만 걸러내고 나머지는 정상 처리한다.
      const accepted: PendingUpload[] = []
      let firstReject: string | null = null
      for (const file of picked.slice(0, room)) {
        const reason = await validateImageFile(file)
        if (reason) {
          firstReject ??= REJECT_MESSAGE[reason]
          continue
        }
        accepted.push({ id: crypto.randomUUID(), name: file.name, url: trackUrl(URL.createObjectURL(file)) })
      }

      if (overflowed) showToast(`이미지는 최대 ${MAX_UPLOADS}장까지 올릴 수 있어요`)
      else if (firstReject) showToast(firstReject)

      if (accepted.length > 0) setPendingQueue((prev) => [...prev, ...accepted])
    },
    [uploadedFiles.length, pendingQueue.length, showToast, trackUrl],
  )

  const confirmMasking = useCallback(
    (masked: Blob, wasMasked: boolean) => {
      const current = pendingQueue[0]
      if (!current) return
      // 마스킹 결과만 남기고 원본 blob은 즉시 버린다 (F3-06 — 원본은 전송하지 않는다).
      revokeUrl(current.url)
      const url = trackUrl(URL.createObjectURL(masked))
      setPendingQueue((prev) => prev.slice(1))
      setUploadedFiles((files) => [...files, { id: current.id, name: current.name, url, masked: wasMasked }])
    },
    [pendingQueue, revokeUrl, trackUrl],
  )

  const cancelActiveUpload = useCallback(() => {
    revokeUrl(pendingQueue[0]?.url)
    setPendingQueue((prev) => prev.slice(1))
  }, [pendingQueue, revokeUrl])

  const removeUploadedFile = useCallback(
    (id: string) => {
      /**
       * **이미 판독을 보낸 파일은 목록에서 뺄 수 없다.**
       *
       * `imageIndex`가 곧 배열 위치다. 가운데 하나를 빼면 뒤가 앞으로 당겨져, 서버 카드의
       * `source_image_index`가 **다른 이미지를 가리키게 된다** — "원본 보기"와 4면
       * "원본 n번"이 통째로 어긋나고, 사용자는 어긋난 줄도 모른다.
       *
       * 자료를 빼고 싶으면 카드의 `[이 자료 빼기]`를 쓰면 된다 — 그건 서버에서도 지운다.
       */
      const index = uploadedFiles.findIndex((f) => f.id === id)
      if (live && index !== -1 && index < sentCount.current) {
        showToast("이미 읽은 자료예요. 빼려면 아래 카드에서 [이 자료 빼기]를 눌러주세요")
        return
      }
      revokeUrl(uploadedFiles.find((f) => f.id === id)?.url)
      setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
    },
    [live, uploadedFiles, revokeUrl, showToast],
  )

  const openTextEntry = useCallback((fromFailure = false) => {
    setTextEntryFromFailure(fromFailure)
    setTextEntryOpen(true)
  }, [])

  const closeTextEntry = useCallback(() => setTextEntryOpen(false), [])

  const submitTextEntry = useCallback(
    (raw: string) => {
      // 보내기 전에 가린다 — 이미지에서 사용자가 직접 가린 뒤 전송하는 것과 같은 원칙이다.
      // **서버가 아니라 여기서 가린다** (FR-027 확정) — LLM이 애초에 보지 않는다.
      const { text } = scrubPii(raw)
      setTextCards(buildTextCards(text))
      setEntryMode("text")
      setTextEntryOpen(false)
      setCardStates({})
      setFilesReady(true)
      setAnalyzed(false)
      setDraftShown(false)
      if (!live) return
      setExtracting(true)
      void runLive(() =>
        api.submitEvidenceText(text).then((res) => setServer((prev) => ({ ...prev, cards: res.cards }))),
      ).finally(() => setExtracting(false))
    },
    [live, runLive],
  )

  const proceedFromUpload = useCallback(() => {
    setEntryMode("upload")
    setFilesReady(true)
    setAnalyzed(false)
    setDraftShown(false)
    if (!live) return
    // 연결돼 있으면 카드의 출처는 **오직 서버**다. 자료를 하나도 안 올렸으면 카드도 없다 —
    // 여기서 빈 배열로 확정하지 않으면 목 카드 5장이 나와 **올린 적 없는 자료를 보여준다.**
    setServer((prev) => ({ ...prev, cards: prev.cards ?? [] }))
    /**
     * **아직 안 보낸 것만 보낸다.** `[자료 더 올리기]`로 돌아왔다 다시 진행하면 이 함수가
     * 또 불리는데, 매번 전체를 보내면 같은 이미지가 두 번 판독되고 카드가 두 벌 생긴다.
     *
     * `imageIndex`는 **세션 누적 배열 위치**다 (백엔드 확정 2026-08-26). 배치 안 순번을
     * 쓰면 두 번째 묶음이 0부터 다시 시작해 카드의 `source_image_index`가 통째로 어긋난다.
     * 그래서 배열 위치를 그대로 인덱스로 쓴다 — 이미 보낸 개수가 곧 다음 인덱스다.
     */
    const pending = uploadedFiles.slice(sentCount.current)
    if (pending.length === 0) return
    const offset = sentCount.current
    sentCount.current = uploadedFiles.length
    setExtracting(true)
    void runLive(async () => {
      const uploads = await Promise.all(
        pending.map(async (file, i) => ({ blob: await (await fetch(file.url)).blob(), imageIndex: offset + i })),
      )
      const results = await api.uploadEvidenceBatch(uploads)
      const failed = results.filter((r) => r.status === "failed").length
      const fresh = results.flatMap((r) => r.data?.cards ?? [])

      /**
       * F3-04 진입 경로 ② — **전체 판독 실패 시 텍스트 입력으로 자동 전환**.
       *
       * 종전에는 `openTextEntry(true)`를 부르는 곳이 없어 이 경로가 죽어 있었다. 자료를
       * 한 장도 못 읽은 사용자는 토스트 한 줄만 보고 **다음 단계 버튼이 열리지 않는 화면에
       * 갇혔다.** 제출본 명세가 약속한 동작이기도 하다.
       *
       * **첫 묶음이 통째로 실패했을 때만** 전환한다(`offset === 0`). `[자료 더 올리기]`로
       * 한 장을 더 올렸다가 그것만 실패한 경우까지 끌고 가면, 이미 읽은 카드를 보고 있던
       * 사용자를 글쓰기 화면으로 낚아채게 된다.
       *
       * **"못 읽은 것"일 때만 전환한다 — 허용 목록으로 좁힌다.** 실패를 싸잡아 넘기면
       * 세션 만료·설정 오류·서버 다운에도 글쓰기 화면이 뜨는데, 그 셋은 **글을 다 쓴 뒤
       * 전송도 똑같이 실패**해서 사용자를 두 번 헛수고시킨다. `AI_CONFIG_ERROR`를 텍스트
       * 입력으로 유도하지 않는다는 `spec.md` F4-05 규정도 같은 취지다.
       *
       * 배치 안 업로드는 개별 실패를 삼켜 `status: "failed"`로 내려오므로 코드를 직접 본다.
       */
      const unreadable = (r: (typeof results)[number]) =>
        api.isApiError(r.error) && (r.error.code === "EXTRACTION_FAILED" || r.error.code === "TIMEOUT")
      const allFailed =
        offset === 0 && failed === results.length && fresh.length === 0 && results.every(unreadable)
      if (allFailed) {
        openTextEntry(true)
      } else if (failed > 0) {
        // **한 장이 실패해도 나머지는 간다** (F4-05). 몇 장을 못 읽었는지는 말해준다.
        showToast(`자료 ${failed}장을 읽지 못했어요. 읽은 것만 정리할게요`)
      }
      // F10-02 — 협박 감지는 **판정과 독립적으로** 산출된다. 한 장이라도 켜지면 켠다.
      const threat = results.some((r) => r.data?.signals.threat_detected === true)
      setServer((prev) => ({
        ...prev,
        cards: [...(prev.cards ?? []), ...fresh],
        threatDetected: prev.threatDetected || threat,
      }))
      return results
    }).finally(() => setExtracting(false))
  }, [live, runLive, showToast, uploadedFiles, openTextEntry])

  const backToUpload = useCallback(() => {
    setFilesReady(false)
  }, [])

  const openLightbox = useCallback((id: string) => {
    setLightboxFileId(id)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxFileId(null)
  }, [])

  const startEditFile = useCallback((id: string) => {
    setEditingFileId(id)
  }, [])

  const cancelEditFile = useCallback(() => {
    setEditingFileId(null)
  }, [])

  const confirmEditFile = useCallback(
    (masked: Blob, addedMoreMasking: boolean) => {
      const id = editingFileId
      const previous = uploadedFiles.find((f) => f.id === id)
      if (!id || !previous) return
      setEditingFileId(null)
      const url = trackUrl(URL.createObjectURL(masked))
      revokeUrl(previous.url)
      setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, url, masked: f.masked || addedMoreMasking } : f)))
    },
    [editingFileId, uploadedFiles, revokeUrl, trackUrl],
  )

  const restart = useCallback(() => {
    setStage(0)
    setIntakePage(0)
    setNavDir(0)
    setIntake(INITIAL_INTAKE)
    setDateSheet(null)
    setEvidence(INITIAL_EVIDENCE)
    setCardStates({})
    setAnalyzing(false)
    setAnalyzed(false)
    setHistoryOverride(null)
    setSelfHeld(new Set())
    setLegalForm(EMPTY_LEGAL_FORM)
    setLegalFormOpen(false)
    setPreviewOpen(false)
    setExcludedSentences(new Set())
    setPackageConfirmedAt(null)
    setDrafting(false)
    setDraftShown(false)
    setViewer(null)
    setViewerNote(null)
    setToast(null)
    setFilesReady(false)
    setEntryMode("upload")
    setTextEntryOpen(false)
    setTextCards([])
    liveUrls.current.forEach((url) => URL.revokeObjectURL(url))
    liveUrls.current.clear()
    setPendingQueue([])
    setUploadedFiles([])
    setLightboxFileId(null)
    setEditingFileId(null)
    setServer(EMPTY_SERVER)
    setReviseWarning(null)
    setExtracting(false)
    sentCount.current = 0
    /**
     * **이전 세션을 서버에서 지우고** 새로 판다.
     *
     * 5단계 완료 시 자동 파기(트리거 ③)는 구현하지 않기로 결정됐다 (2026-08-26) — 다운로드
     * 직후 지우면 문장을 고쳐 다시 받는 흐름이 막히기 때문이다. 그래서 남는 파기 경로는
     * 30분 TTL과 **명시적 `DELETE`(트리거 ②)** 뿐이다.
     *
     * 여기서 지우지 않으면 `[처음으로]`를 눌러도 앞사람의 카드가 서버에 최대 30분 남는다.
     * 화면은 "탭을 닫으면 사라져요"라고 말하고 있으므로, 처음으로 돌아가는 것도 같아야 한다.
     */
    if (live) {
      void api
        .destroySession()
        .catch(() => null)
        .then(() => api.createSession())
        .catch(() => null)
    }
    window.scrollTo(0, 0)
  }, [live])

  restartRef.current = restart
  // 목 경로에서 편집할 때 기준이 될 현재 문장들. `draftLines`가 아래에서 계산되므로 ref로 받는다.
  const draftLinesRef = useRef<DraftLine[]>([])

  /**
   * `imageIndex` → 브라우저 메모리의 업로드 파일 (F7-05).
   *
   * **서버는 이미지 파일을 주지 않는다** — 참조(`imageIndex`)만 온다. 원본은 우리 메모리에만
   * 있고, 새로고침하면 사라진다. 그래서 **없을 수 있다는 것이 정상**이고, 호출부는 `null`을
   * 받으면 "원본을 다시 올리면 확인할 수 있어요"로 안내한다.
   */
  const findSource = useCallback(
    (imageIndex: number) => uploadedFiles[imageIndex] ?? null,
    [uploadedFiles],
  )

  /**
   * 문장 자유 편집 (F7-08 · `POST /api/draft/revise`).
   *
   * **왜 필요한가**: 소명서 문장은 대부분 LLM이 만든 값이고, "발송했습니다"를
   * "수령했습니다"로 뒤집는 실수는 근거와 매칭되므로 F7-02가 잡지 못한다. 읽기 전용이면
   * 사용자는 틀린 문장을 **발견만 하고 고치지 못한 채** 내려받는다.
   *
   * **고친 문장은 지우지 않는다.** 경고를 띄우되 문장은 살리고 배지를 "본인 진술"로 바꾼다 —
   * 자동 삭제는 LLM 출력에 적용하는 규칙이지 사람이 자기 사실을 적은 문장에 쓸 규칙이 아니다
   * (FR-045 ③ 개정).
   *
   * **매칭 여부를 따지지 않는다.** 서버가 `text`를 받으면 재검증 없이 항상 `user_text`로
   * 낮춘다 (계약 2026-08-26 ⑤ 정정 — 재검증 엔드포인트가 계약에 없다). 오타만 고쳐도 같다.
   */
  const reviseSentence = useCallback(
    async (sentenceId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const apply = (lines: DraftLine[]): DraftLine[] =>
        lines.map((line) =>
          line.id === sentenceId
            ? // 손으로 고친 문장은 더 이상 이미지 근거가 아니다. 배지와 원본 연결을 함께 뗀다 —
              // 경고 문구는 읽고 넘겨도, 배지가 바뀌는 건 눈에 보인다.
              { ...line, text: trimmed, badge: "본인 진술", ref: null, imageIndex: null }
            : line,
        )
      if (!live) {
        setServer((prev) => ({ ...prev, draftLines: apply(prev.draftLines ?? draftLinesRef.current) }))
        // 목은 근거 재검증을 할 수 없다. 할 수 있는 척하지 않고 같은 취지를 그대로 말한다.
        setReviseWarning("수정하신 문장은 업로드 자료와 연결되지 않아 '본인 진술'로 표시됩니다.")
        return
      }
      const res = await runLive(() => api.reviseDraft([{ sentenceId, text: trimmed }]))
      if (!res) return
      setReviseWarning(res.warning ?? null)
      setServer((prev) => {
        const base = apply(prev.draftLines ?? draftLinesRef.current)
        // 서버가 돌려준 문장만 갱신한다. **응답 배열로 통째로 갈아끼우지 않는다** —
        // 제외한 문장이 배열에서 빠져 오므로(계약 v1.9) 덮으면 되돌릴 수단이 사라진다.
        const revised = new Map(res.sentences.map((sentence) => [sentence.sentenceId, sentence]))
        return {
          ...prev,
          draftLines: base.map((line) => {
            const hit = revised.get(line.id)
            if (!hit) return line
            const imageRef = hit.evidenceRefs.find((ref) => ref.type === "evidence" && ref.imageIndex !== undefined)
            return {
              ...line,
              text: hit.text,
              badge: imageRef ? `근거 · 원본 ${(imageRef.imageIndex ?? 0) + 1}번` : "본인 진술",
              imageIndex: imageRef?.imageIndex ?? null,
            }
          }),
        }
      })
    },
    [live, runLive],
  )

  /**
   * 제출 패키지 PDF. **텍스트 5면은 서버가, 원본 이미지 면은 브라우저가 만든다** (F8-01).
   *
   * 미리보기와 다운로드가 **같은 함수를 쓴다** — 따로 만들면 보여준 것과 받는 것이 갈린다.
   * 서버가 없으면 원본 이미지 면만으로 만든다(목 경로). 그때 미리보기가 "지금은 증빙 원본
   * 이미지 면만 보여요"라고 알린다.
   */
  const buildPackage = useCallback(async () => {
    if (!live) return buildPackagePdf(null, uploadedFiles)
    const serverPdf = await api.generatePackagePdf({
      ...toPackageRequest(legalForm),
      // 제외 문장의 **최종 소스는 이 값이다** (계약 v1.10). `revise`를 따로 부르지 않는다.
      excludedSentenceIds: [...excludedSentences],
    })
    return buildPackagePdf(serverPdf, uploadedFiles)
  }, [live, legalForm, excludedSentences, uploadedFiles])

  const amountInfo = useMemo(() => getAmountInfo(intake.amount), [intake.amount])
  // 숨어 있는 문항(F2-01a 조건부)은 답할 대상이 아니므로 완료 판정에서 뺀다.
  const allAnswered = useMemo(
    () => QUESTIONS.filter((q) => isFieldVisible(q.id, intake.kind)).every((q) => isAnswered(intake, q.id)),
    [intake],
  )
  const intakePageAnswered = useMemo(
    () =>
      INTAKE_PAGES[intakePage].fields
        .filter((field) => isFieldVisible(field, intake.kind))
        .every((field) => isAnswered(intake, field)),
    [intakePage, intake],
  )
  /**
   * 문진을 서버에 올린다 — **다 답한 뒤 답이 바뀔 때마다.** 계약상 `/api/intake`는 전체 교체이므로
   * (v1.10) 사용자가 요약 칩으로 돌아가 답을 고치면 그대로 다시 보내면 된다. `null`로 보낸
   * 필드는 서버에서도 지워진다.
   *
   * **단계 이동이 아니라 "다 답했는가"로 거는 이유**: 기한 배너(FR-014)는 문진 화면에
   * 떠 있고, 계산의 단일 소스는 서버다. 다음 단계로 넘어간 뒤에 덮으면 정작 배너를 보는
   * 동안에는 목 값이 떠 있게 된다.
   *
   * 응답이 오기 전이나 실패했을 때는 같은 규칙을 계산해 둔 목이 자리를 지킨다.
   */
  useEffect(() => {
    if (!live || !sessionReady || !allAnswered) return
    void runLive(() =>
      api
        .saveIntake({
          when: intake.when,
          dueNoticeStatus: intake.noticeStatus ?? "unknown",
          dueNoticeDate: intake.noticeDate,
          amount: intake.amount,
          kind: REASON_BY_KIND[intake.kind ?? ""] ?? "unclear",
          history: intake.history === "있어요",
          usage: USAGE_BY_LABEL[intake.usage ?? ""] ?? "occasional",
          // 물품 거래가 아니면 `null`이다 (F2-01a).
          deliveryMethod: DELIVERY_BY_LABEL[intake.delivery ?? ""] ?? null,
        })
        .then((res) => setServer((prev) => ({ ...prev, deadline: toDeadlineInfo(res) }))),
    )
  }, [live, sessionReady, allAnswered, intake, runLive])

  const intakeLastPage = intakePage === INTAKE_PAGES.length - 1
  const hasHistory = historyOverride === null ? intake.history === "있어요" : historyOverride
  const deadline = useMemo(() => server.deadline ?? getDeadline(intake), [server.deadline, intake])

  const cards = useMemo(
    () =>
      // 서버가 준 카드에도 사용자의 확인·수정 상태를 그대로 입힌다.
      server.cards
        ? applyCardStates(server.cards, cardStates)
        : entryMode === "text"
        ? applyCardStates(textCards, cardStates)
        : buildCards(evidence, intake.amount, cardStates),
    [server.cards, entryMode, textCards, evidence, intake.amount, cardStates],
  )
  const blocking = useMemo(() => blockingCards(cards), [cards])
  const unconfirmedCount = useMemo(() => pendingCards(cards).length, [cards])
  // 확인된 카드만 준비도·체크리스트·소명서의 입력이 된다 (F6-03).
  const confirmed = useMemo(() => confirmedEvidence(cards), [cards])
  const bankConfirmed = confirmed.bank
  /**
   * 문서에 쓰는 입금액. **확인된 입금 카드가 있으면 그 값이 이긴다** — 사용자가 F4-06에서
   * 고친 금액이 소명서·타임라인에 그대로 반영돼야 한다. 카드가 아직 없거나 확인 전이면
   * 문진 응답으로 되돌아간다.
   */
  const documentAmount = useMemo(() => confirmedBankAmount(cards) ?? intake.amount, [cards, intake.amount])

  // 체크리스트가 준비도의 입력이다 — Stage 3과 Stage 4가 같은 값을 봐야 한다.
  const checklist = useMemo(
    () => server.checklist ?? buildChecklist(intake.kind, confirmed, true, selfHeld),
    [server.checklist, intake.kind, confirmed, selfHeld],
  )
  const readiness = useMemo(
    () =>
      server.readiness ??
      computeReadiness(
        intake,
        checklist,
        { pending: unconfirmedCount, blocking: blocking.length },
        historyOverride,
      ),
    [server.readiness, intake, checklist, unconfirmedCount, blocking.length, historyOverride],
  )

  /**
   * 준비도 점검 — Stage 3에 들어올 때 한 번.
   *
   * 저신뢰 미확인 카드가 남아 있으면 서버가 `409 UNCONFIRMED_FIELDS`로 거부한다.
   * **프론트 차단(F4-06)과 별개의 방어선**이라 여기서 실패해도 정상이다 —
   * `runLive`가 서버 문구를 그대로 띄우고, 화면은 목 판정으로 남는다.
   */
  useEffect(() => {
    if (!live || !sessionReady || stage !== 3) return
    void runLive(() => api.checkReadiness()).then((res) => {
      if (res) {
        setServer((prev) => ({
          ...prev,
          checklist: res.checklist,
          readiness: toReadinessResult(res, prev.unconfirmedCount ?? 0, hasHistory),
        }))
      }
    })
    // `hasHistory`는 화면의 "켜 보기" 토글로 바뀌지만, 그때마다 서버를 다시 부르지 않는다 —
    // 그 토글은 판정이 어떻게 달라지는지 보여주는 장치라 목 계산으로 충분하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, sessionReady, stage, runLive])
  const timeline = useMemo(
    () =>
      !analyzed
        ? []
        : server.timeline
          ? server.timeline
          : // 텍스트 경로는 **사용자가 쓴 것만** 나와야 한다. 목 시나리오 문구를 섞지 않는다.
            entryMode === "text"
            ? buildTimelineFromCards(cards)
            : buildTimeline(evidence, documentAmount, bankConfirmed),
    [server.timeline, analyzed, entryMode, cards, evidence, documentAmount, bankConfirmed],
  )
  /**
   * **제출본 3면에 실을 타임라인.** 화면 타임라인과 달리 확인된 카드만 담는다 — 2면은
   * 미확인 카드의 문장을 빼고 4면은 `pending`을 거르는데 3면만 다 실으면, 같은 묶음 안에서
   * 4면 1줄 / 3면 5줄처럼 어긋난다. 미확인 판독을 은행에 보내지 않는다는 F4-06 취지도 같다.
   *
   * **백엔드 회신으로 확정됐다** (2026-08-26, A안) — `spec.md` F8-01 3면 행에 명시됐다.
   * 3면 항목(일시·주체·요약·금액)이 FR-028이 게이팅하는 바로 그 필드라, 미확인 값을 표로
   * 올리면 서술문보다 더 사실처럼 읽힌다는 것이 백엔드가 덧붙인 근거다.
   */
  const submitTimeline = useMemo(
    () =>
      !analyzed
        ? []
        : server.submitTimeline
          ? server.submitTimeline
          : entryMode === "text"
            ? buildTimelineFromCards(cards.filter((card) => card.confirmation_status !== "pending"))
            : buildTimeline(confirmed, documentAmount, bankConfirmed),
    [server.submitTimeline, analyzed, entryMode, cards, confirmed, documentAmount, bankConfirmed],
  )
  // 확인된 카드만 소명서에 들어간다 (F4-06 "미확인 카드의 날짜·금액이 본문에 나타나지 않음").
  const draftLines = useMemo(
    () =>
      !draftShown
        ? []
        : server.draftLines
          ? server.draftLines
          : // 텍스트 경로는 목 시나리오 문장을 쓰지 않는다 — 사용자가 말하지 않은 시각이 섞인다.
            entryMode === "text"
            ? buildDraftLinesFromCards(
                intake,
                cards.filter((card) => card.confirmation_status !== "pending"),
                documentAmount,
              )
            : buildDraftLines(intake, confirmed, true, documentAmount),
    [server.draftLines, draftShown, entryMode, intake, cards, confirmed, documentAmount],
  )
  /**
   * 협박 감지 (F10-02 · FR-024) — **상단 고정 배너**의 조건이다.
   *
   * 세 갈래를 함께 본다. ① 서버 `signals.threat_detected` ② 협박 카드가 하나라도 있음
   * (`/api/evidence/text`는 `signals`를 주지 않아 카드로 판단해야 한다) ③ 목의 증거 토글.
   *
   * **한 번 켜지면 내리지 않는다.** 협박을 당하는 중인 사람에게 "돈을 보내지 마세요"를
   * 화면을 옮겼다고 거두면 안 된다. 명세도 감지 시점부터 상단 고정이라고 정해 두었다.
   */
  const threatDetected =
    server.threatDetected || evidence.threat || cards.some((card) => card.source_type === "threat")

  draftLinesRef.current = draftLines
  const confirmedCount = cards.length - unconfirmedCount
  // 확인하지 않아 문서에서 빠진 자료 수. 사용자가 "왜 문장이 적지?"를 알 수 있어야 한다.
  const droppedCount = unconfirmedCount

  const activeUpload = pendingQueue[0] ?? null
  const lightboxFile = useMemo(
    () => uploadedFiles.find((f) => f.id === lightboxFileId) ?? null,
    [uploadedFiles, lightboxFileId],
  )
  const editingFile = useMemo(
    () => uploadedFiles.find((f) => f.id === editingFileId) ?? null,
    [uploadedFiles, editingFileId],
  )

  return {
    stage,
    go,
    back,
    intakePage,
    navDir,
    goIntakePage,
    intakePageAnswered,
    intakeLastPage,
    intake,
    pick,
    allAnswered,
    dateSheet,
    openDateSheet,
    closeDateSheet,
    commitDate,
    toggleWhenUnknown,
    setNoticeStatus,
    setAmount,
    toggleAmountUnknown,
    evidence,
    toggle,
    addThreat,
    cards,
    confirmCard,
    editCard,
    removeCard,
    blockingCount: blocking.length,
    unconfirmedCount,
    bankConfirmed,
    analyzing,
    analyzed,
    extracting,
    threatDetected,
    analyze,
    timelineRunId,
    historyOverride,
    hasHistory,
    toggleHistory,
    selfHeld,
    toggleSelfHeld,
    legalForm,
    legalFormOpen,
    openLegalForm,
    closeLegalForm,
    submitLegalForm,
    previewOpen,
    closePreview,
    excludedSentences,
    toggleExcludedSentence,
    confirmPackage,
    packageConfirmedAt,
    drafting,
    draftShown,
    makeDraft,
    viewer,
    viewerNote,
    openViewer,
    closeViewer,
    toast,
    showToast,
    restart,
    amountInfo,
    deadline,
    readiness,
    timeline,
    submitTimeline,
    buildPackage,
    findSource,
    reviseSentence,
    reviseWarning,
    live,
    draftLines,
    checklist,
    confirmedCount,
    droppedCount,
    filesReady,
    entryMode,
    textEntryOpen,
    textEntryFromFailure,
    openTextEntry,
    closeTextEntry,
    submitTextEntry,
    uploadedFiles,
    maxUploads: MAX_UPLOADS,
    uploadsLeft: Math.max(0, MAX_UPLOADS - (uploadedFiles.length + pendingQueue.length)),
    activeUpload,
    queueLength: pendingQueue.length,
    addFiles,
    confirmMasking,
    cancelActiveUpload,
    removeUploadedFile,
    proceedFromUpload,
    backToUpload,
    lightboxFile,
    openLightbox,
    closeLightbox,
    editingFile,
    startEditFile,
    cancelEditFile,
    confirmEditFile,
  }
}
