import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { INTAKE_PAGES, QUESTIONS, REASON_BY_KIND, isFieldVisible } from "../data"
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
import { EMPTY_LEGAL_FORM } from "../lib/legalForm"
import type { LegalFormValues } from "../lib/legalForm"
import { buildDraftLines, buildDraftLinesFromCards } from "../lib/draft"
import { getAmountInfo } from "../lib/amount"
import { getDeadline } from "../lib/deadline"
import { isAnswered } from "../lib/intake"
import { computeReadiness } from "../lib/readiness"
import { buildTimeline, buildTimelineFromCards } from "../lib/timeline"
import { buildTextCards, scrubPii } from "../lib/textEntry"
import { MAX_UPLOADS, REJECT_MESSAGE, validateImageFile } from "../lib/upload"
import type { ExtractedCard } from "../types"
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
  const removeCard = useCallback(
    (eventId: string) => {
      const id = evidenceIdOf(eventId)
      if (id) toggle(id)
    },
    [toggle],
  )

  const addThreat = useCallback(() => {
    setEvidence((prev) => ({ ...prev, threat: true }))
    setDraftShown(false)
  }, [])

  const confirmCard = useCallback((eventId: string) => {
    setCardStates((prev) => ({
      ...prev,
      // 이미 고친 카드를 다시 확인해도 "사용자 수정" 표기는 유지한다.
      [eventId]: { status: prev[eventId]?.edits && Object.keys(prev[eventId].edits).length > 0 ? "user_corrected" : "user_confirmed", edits: prev[eventId]?.edits ?? {} },
    }))
    setDraftShown(false)
  }, [])

  /** 값을 고치면 확인까지 한 것으로 본다 — 고친 사람이 그 값을 본 것이다 (F4-06 ②③). */
  const editCard = useCallback((eventId: string, patch: CardEdits) => {
    setCardStates((prev) => ({
      ...prev,
      [eventId]: { status: "user_corrected", edits: { ...prev[eventId]?.edits, ...patch } },
    }))
    setDraftShown(false)
  }, [])

  const analyze = useCallback(() => {
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      setAnalyzed(true)
      setTimelineRunId((id) => id + 1)
    }, 850)
  }, [])

  /**
   * 직접 첨부 항목(신분증·재직증명서 등)의 보유 표시.
   *
   * **소명서를 무효화하지 않는다.** 이 값은 첨부 서류 체크리스트에만 영향을 주고 소명서
   * 본문에는 들어가지 않는다 — 서비스에 올리지 않는 서류라 문장의 근거가 될 수 없다.
   * 종전에는 F2-03(문진 변경 시 하위 단계 무효화)을 넓게 적용해 여기서도 초안을 지웠는데,
   * 사용자가 소명서를 읽다가 "신분증 있어요"를 누르면 초안이 통째로 사라지고 다시
   * 만들어야 했다. 체크리스트는 이 토글로 즉시 갱신된다.
   */
  const toggleSelfHeld = useCallback((id: string) => {
    setSelfHeld((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

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
    setTimeout(() => {
      setDrafting(false)
      setDraftShown(true)
    }, 1000)
  }, [])

  const openViewer = useCallback((id: ViewerId, note?: string | null) => {
    setViewer(id)
    setViewerNote(note ?? null)
  }, [])

  const closeViewer = useCallback(() => {
    setViewer(null)
    setViewerNote(null)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
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
      revokeUrl(uploadedFiles.find((f) => f.id === id)?.url)
      setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
    },
    [uploadedFiles, revokeUrl],
  )

  const openTextEntry = useCallback((fromFailure = false) => {
    setTextEntryFromFailure(fromFailure)
    setTextEntryOpen(true)
  }, [])

  const closeTextEntry = useCallback(() => setTextEntryOpen(false), [])

  const submitTextEntry = useCallback((raw: string) => {
    // 보내기 전에 가린다 — 이미지에서 사용자가 직접 가린 뒤 전송하는 것과 같은 원칙이다.
    const { text } = scrubPii(raw)
    const cards = buildTextCards(text)
    setTextCards(cards)
    setEntryMode("text")
    setTextEntryOpen(false)
    setCardStates({})
    setFilesReady(true)
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

  const proceedFromUpload = useCallback(() => {
    setEntryMode("upload")
    setFilesReady(true)
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

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
    window.scrollTo(0, 0)
  }, [])

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
  const intakeLastPage = intakePage === INTAKE_PAGES.length - 1
  const hasHistory = historyOverride === null ? intake.history === "있어요" : historyOverride
  const deadline = useMemo(() => getDeadline(intake), [intake])

  const cards = useMemo(
    () =>
      entryMode === "text"
        ? applyCardStates(textCards, cardStates)
        : buildCards(evidence, intake.amount, cardStates),
    [entryMode, textCards, evidence, intake.amount, cardStates],
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
    () => buildChecklist(intake.kind, confirmed, true, selfHeld),
    [intake.kind, confirmed, selfHeld],
  )
  const readiness = useMemo(
    () =>
      computeReadiness(
        intake,
        checklist,
        { pending: unconfirmedCount, blocking: blocking.length },
        historyOverride,
      ),
    [intake, checklist, unconfirmedCount, blocking.length, historyOverride],
  )
  const timeline = useMemo(
    () =>
      !analyzed
        ? []
        : // 텍스트 경로는 **사용자가 쓴 것만** 나와야 한다. 목 시나리오 문구를 섞지 않는다.
          entryMode === "text"
          ? buildTimelineFromCards(cards)
          : buildTimeline(evidence, documentAmount, bankConfirmed),
    [analyzed, entryMode, cards, evidence, documentAmount, bankConfirmed],
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
        : entryMode === "text"
          ? buildTimelineFromCards(cards.filter((card) => card.confirmation_status !== "pending"))
          : buildTimeline(confirmed, documentAmount, bankConfirmed),
    [analyzed, entryMode, cards, confirmed, documentAmount, bankConfirmed],
  )
  // 확인된 카드만 소명서에 들어간다 (F4-06 "미확인 카드의 날짜·금액이 본문에 나타나지 않음").
  const draftLines = useMemo(
    () =>
      !draftShown
        ? []
        : // 텍스트 경로는 목 시나리오 문장을 쓰지 않는다 — 사용자가 말하지 않은 시각이 섞인다.
          entryMode === "text"
          ? buildDraftLinesFromCards(
              intake,
              cards.filter((card) => card.confirmation_status !== "pending"),
              documentAmount,
            )
          : buildDraftLines(intake, confirmed, true, documentAmount),
    [draftShown, entryMode, intake, cards, confirmed, documentAmount],
  )
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
