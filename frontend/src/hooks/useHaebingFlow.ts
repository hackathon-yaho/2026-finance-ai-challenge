import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildChecklist, buildDraft } from "../lib/draft"
import { buildTimeline } from "../lib/timeline"
import { computeVerdict } from "../lib/verdict"
import type { EvidenceId, EvidenceState, IntakeAnswers, IntakeField } from "../types"

const INITIAL_INTAKE: IntakeAnswers = { when: null, amount: null, kind: null, history: null, usage: null }
const INITIAL_EVIDENCE: EvidenceState = { chat: true, deposit: true, shipping: true, autopay: true, threat: false }

export function useHaebingFlow() {
  const [stage, setStage] = useState(0)
  const [intake, setIntake] = useState<IntakeAnswers>(INITIAL_INTAKE)
  const [evidence, setEvidence] = useState<EvidenceState>(INITIAL_EVIDENCE)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [historyOverride, setHistoryOverride] = useState<boolean | null>(null)
  const [draftGenerating, setDraftGenerating] = useState(false)
  const [draftRevealed, setDraftRevealed] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const goStage = useCallback((n: number) => setStage(Math.max(0, Math.min(5, n))), [])

  const selectIntake = useCallback((field: IntakeField, value: string) => {
    setIntake((prev) => ({ ...prev, [field]: value }))
    setAnalyzed(false)
    setDraftRevealed(false)
  }, [])

  const toggleEvidence = useCallback((id: EvidenceId) => {
    setEvidence((prev) => ({ ...prev, [id]: !prev[id] }))
    setAnalyzed(false)
    setDraftRevealed(false)
  }, [])

  const addThreat = useCallback(() => {
    setEvidence((prev) => ({ ...prev, threat: true }))
  }, [])

  const analyze = useCallback(() => {
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      setAnalyzed(true)
    }, 900)
  }, [])

  const toggleHistoryDemo = useCallback(() => {
    setHistoryOverride((prev) => (prev === true ? false : true))
    setDraftRevealed(false)
  }, [])

  const generateDraft = useCallback(() => {
    setDraftGenerating(true)
    setDraftRevealed(false)
    setTimeout(() => {
      setDraftGenerating(false)
      setDraftRevealed(true)
    }, 1100)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  const restart = useCallback(() => {
    setStage(0)
    setIntake(INITIAL_INTAKE)
    setEvidence(INITIAL_EVIDENCE)
    setAnalyzing(false)
    setAnalyzed(false)
    setHistoryOverride(null)
    setDraftGenerating(false)
    setDraftRevealed(false)
    setToast(null)
  }, [])

  const verdict = useMemo(() => computeVerdict(intake, evidence, historyOverride), [intake, evidence, historyOverride])
  const timeline = useMemo(() => (analyzed ? buildTimeline(evidence) : []), [analyzed, evidence])
  const draftParagraphs = useMemo(
    () => (draftRevealed ? buildDraft(intake, evidence, verdict) : []),
    [draftRevealed, intake, evidence, verdict],
  )
  const checklist = useMemo(() => (draftRevealed ? buildChecklist(intake, evidence) : []), [draftRevealed, intake, evidence])
  const allAnswered = useMemo(() => Object.values(intake).every((v) => v !== null), [intake])

  return {
    stage,
    goStage,
    intake,
    selectIntake,
    allAnswered,
    evidence,
    toggleEvidence,
    addThreat,
    analyzing,
    analyzed,
    analyze,
    historyOverride,
    toggleHistoryDemo,
    draftGenerating,
    draftRevealed,
    generateDraft,
    verdict,
    timeline,
    draftParagraphs,
    checklist,
    toast,
    showToast,
    restart,
  }
}
