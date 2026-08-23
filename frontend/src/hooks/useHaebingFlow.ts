import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { INTAKE_PAGES } from "../data"
import { buildChecklist, buildDraftLines } from "../lib/draft"
import { getAmountInfo } from "../lib/amount"
import { getDeadlineNotice, isDeadlineUrgent } from "../lib/deadline"
import { computeReadiness } from "../lib/readiness"
import { buildTimeline } from "../lib/timeline"
import { MAX_UPLOADS, REJECT_MESSAGE, validateImageFile } from "../lib/upload"
import type { EvidenceId, EvidenceState, IntakeAnswers, IntakeField, PendingUpload, UploadedFile, ViewerId } from "../types"

const INITIAL_INTAKE: IntakeAnswers = { when: null, notice: null, amount: null, kind: null, history: null, usage: null }
const INITIAL_EVIDENCE: EvidenceState = { autopay: true, chat: true, bank: true, shipping: true, threat: false }

export function useHaebingFlow() {
  const [stage, setStage] = useState(0)
  const [intakePage, setIntakePage] = useState(0)
  const [intakeDir, setIntakeDir] = useState<1 | -1>(1)
  const [intake, setIntake] = useState<IntakeAnswers>(INITIAL_INTAKE)
  const [evidence, setEvidence] = useState<EvidenceState>(INITIAL_EVIDENCE)
  const [bankConfirmed, setBankConfirmed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [timelineRunId, setTimelineRunId] = useState(0)
  const [historyOverride, setHistoryOverride] = useState<boolean | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftShown, setDraftShown] = useState(false)
  const [viewer, setViewer] = useState<ViewerId | null>(null)
  const [viewerNote, setViewerNote] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // 발급한 object URL 장부. revoke하지 않으면 blob이 탭이 닫힐 때까지 메모리에 남는다.
  const liveUrls = useRef(new Set<string>())

  const [filesReady, setFilesReady] = useState(false)
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
    setStage(Math.max(0, Math.min(5, n)))
    setIntakePage(0)
    setIntakeDir(1)
    setViewer(null)
    setViewerNote(null)
    window.scrollTo(0, 0)
  }, [])

  // 상황 접수 안에서만 움직이는 서브스텝 이동. dir은 진입 애니메이션 방향에 쓴다.
  const goIntakePage = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(INTAKE_PAGES.length - 1, n))
      setIntakeDir(next >= intakePage ? 1 : -1)
      setIntakePage(next)
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

  const pick = useCallback((field: IntakeField, value: string) => {
    setIntake((prev) => ({ ...prev, [field]: value }))
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

  const toggle = useCallback((id: EvidenceId) => {
    setEvidence((prev) => ({ ...prev, [id]: !prev[id] }))
    setAnalyzed(false)
    setDraftShown(false)
  }, [])

  const addThreat = useCallback(() => {
    setEvidence((prev) => ({ ...prev, threat: true }))
    setDraftShown(false)
  }, [])

  const confirmBank = useCallback(() => {
    setBankConfirmed(true)
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

  const toggleHistory = useCallback(() => {
    setHistoryOverride((prev) => (prev === true ? false : true))
    setDraftShown(false)
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

  const proceedFromUpload = useCallback(() => {
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
    setIntakeDir(1)
    setIntake(INITIAL_INTAKE)
    setEvidence(INITIAL_EVIDENCE)
    setBankConfirmed(false)
    setAnalyzing(false)
    setAnalyzed(false)
    setHistoryOverride(null)
    setDrafting(false)
    setDraftShown(false)
    setViewer(null)
    setViewerNote(null)
    setToast(null)
    setFilesReady(false)
    liveUrls.current.forEach((url) => URL.revokeObjectURL(url))
    liveUrls.current.clear()
    setPendingQueue([])
    setUploadedFiles([])
    setLightboxFileId(null)
    setEditingFileId(null)
    window.scrollTo(0, 0)
  }, [])

  const amountInfo = useMemo(() => getAmountInfo(intake.amount), [intake.amount])
  const allAnswered = useMemo(() => Object.values(intake).every((v) => v !== null), [intake])
  const intakePageAnswered = useMemo(
    () => INTAKE_PAGES[intakePage].fields.every((field) => intake[field] !== null),
    [intakePage, intake],
  )
  const intakeLastPage = intakePage === INTAKE_PAGES.length - 1
  const hasHistory = historyOverride === null ? intake.history === "있어요" : historyOverride
  const deadlineNotice = useMemo(() => getDeadlineNotice(intake.notice), [intake.notice])
  const deadlineUrgent = useMemo(() => isDeadlineUrgent(intake.notice), [intake.notice])

  const readiness = useMemo(
    () => computeReadiness(intake, evidence, bankConfirmed, historyOverride),
    [intake, evidence, bankConfirmed, historyOverride],
  )
  const timeline = useMemo(
    () => (analyzed ? buildTimeline(evidence, intake.amount, bankConfirmed) : []),
    [analyzed, evidence, intake.amount, bankConfirmed],
  )
  const draftLines = useMemo(
    () => (draftShown ? buildDraftLines(intake, evidence, bankConfirmed) : []),
    [draftShown, intake, evidence, bankConfirmed],
  )
  const checklist = useMemo(
    () => (draftShown ? buildChecklist(intake, evidence, bankConfirmed) : []),
    [draftShown, intake, evidence, bankConfirmed],
  )
  const confirmedCount = useMemo(() => {
    const base = (["chat", "shipping", "autopay"] as EvidenceId[]).filter((id) => evidence[id]).length
    return base + (evidence.bank && bankConfirmed ? 1 : 0) + (evidence.threat ? 1 : 0)
  }, [evidence, bankConfirmed])
  const droppedCount = useMemo(() => {
    const missing = (["chat", "bank", "shipping", "autopay"] as EvidenceId[]).filter((id) => !evidence[id]).length
    return missing + (evidence.bank && !bankConfirmed ? 1 : 0)
  }, [evidence, bankConfirmed])

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
    intakeDir,
    goIntakePage,
    intakePageAnswered,
    intakeLastPage,
    intake,
    pick,
    allAnswered,
    evidence,
    toggle,
    addThreat,
    bankConfirmed,
    confirmBank,
    analyzing,
    analyzed,
    analyze,
    timelineRunId,
    historyOverride,
    hasHistory,
    toggleHistory,
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
    deadlineNotice,
    deadlineUrgent,
    readiness,
    timeline,
    draftLines,
    checklist,
    confirmedCount,
    droppedCount,
    filesReady,
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
