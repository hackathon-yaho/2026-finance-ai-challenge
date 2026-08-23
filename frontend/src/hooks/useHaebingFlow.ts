import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildChecklist, buildDraftLines } from "../lib/draft"
import { getAmountInfo } from "../lib/amount"
import { getDeadlineNotice, isDeadlineUrgent } from "../lib/deadline"
import { computeReadiness } from "../lib/readiness"
import { buildTimeline } from "../lib/timeline"
import type { EvidenceId, EvidenceState, IntakeAnswers, IntakeField, PendingUpload, UploadedFile, ViewerId } from "../types"

const INITIAL_INTAKE: IntakeAnswers = { when: null, notice: null, amount: null, kind: null, history: null, usage: null }
const INITIAL_EVIDENCE: EvidenceState = { autopay: true, chat: true, bank: true, shipping: true, threat: false }

export function useHaebingFlow() {
  const [stage, setStage] = useState(0)
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

  const [filesReady, setFilesReady] = useState(false)
  const [pendingQueue, setPendingQueue] = useState<PendingUpload[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [lightboxFileId, setLightboxFileId] = useState<string | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const go = useCallback((n: number) => {
    setStage(Math.max(0, Math.min(5, n)))
    setViewer(null)
    setViewerNote(null)
    window.scrollTo(0, 0)
  }, [])

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

  const addFiles = useCallback((fileList: FileList) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result
        if (typeof dataUrl !== "string") return
        setPendingQueue((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, dataUrl }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const confirmMasking = useCallback(
    (maskedDataUrl: string, wasMasked: boolean) => {
      const current = pendingQueue[0]
      if (!current) return
      setPendingQueue((prev) => prev.slice(1))
      setUploadedFiles((files) => [...files, { id: current.id, name: current.name, dataUrl: maskedDataUrl, masked: wasMasked }])
    },
    [pendingQueue],
  )

  const cancelActiveUpload = useCallback(() => {
    setPendingQueue((prev) => prev.slice(1))
  }, [])

  const removeUploadedFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

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
    (maskedDataUrl: string, addedMoreMasking: boolean) => {
      const id = editingFileId
      if (!id) return
      setEditingFileId(null)
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, dataUrl: maskedDataUrl, masked: f.masked || addedMoreMasking } : f)),
      )
    },
    [editingFileId],
  )

  const restart = useCallback(() => {
    setStage(0)
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
    setPendingQueue([])
    setUploadedFiles([])
    setLightboxFileId(null)
    setEditingFileId(null)
    window.scrollTo(0, 0)
  }, [])

  const amountInfo = useMemo(() => getAmountInfo(intake.amount), [intake.amount])
  const allAnswered = useMemo(() => Object.values(intake).every((v) => v !== null), [intake])
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
