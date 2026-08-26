import { useCallback, useState } from "react"
import { PdfPreview } from "./PdfPreview"
import { FIELD_LABELS, blankFieldLabels, readField, toPackageRequest } from "../lib/legalForm"
import type { LegalFormField, LegalFormValues } from "../lib/legalForm"
import type { ChecklistItem, DraftLine, ExtractedCard, SourceType, TimelineEvent } from "../types"
import { Close } from "./icons"

interface PreviewSheetProps {
  width: number
  form: LegalFormValues
  draftLines: DraftLine[]
  timeline: TimelineEvent[]
  checklist: ChecklistItem[]
  /** 4면 증빙자료 목록 = 확인된 카드. **파일명이 아니다** — 개인정보가 섞인다 (F8-01) */
  cards: ExtractedCard[]
  excluded: ReadonlySet<string>
  onToggleExcluded: (sentenceId: string) => void
  /** 인쇄용 5면 원본 (F8-02). 화면에는 나오지 않는다. */
  files: { id: string; url: string }[]
  /** 문장 자유 편집 (F7-08). `POST /api/draft/revise`로 간다. */
  onRevise: (sentenceId: string, text: string) => Promise<void>
  reviseWarning: string | null
  /** 3면 값이 틀렸을 때 되돌아갈 곳 — 편집 불가만 두면 막다른 길이 된다. */
  onBackToEvidence: () => void
  /** 내려받을 파일을 만든다. 미리보기와 산출물이 **같은 함수**를 쓰게 해 어긋날 수 없게 한다. */
  buildPdf: () => Promise<Blob>
  /** 서버 텍스트 면(`/api/package/text`)이 아직 없는 상태인지 */
  textPagesPending: boolean
  onDownload: () => void
  onClose: () => void
}

/** 자료 유형 표기. 카드 화면(ConfirmCard)과 같은 말을 쓴다. */
const SOURCE_LABEL: Record<SourceType, string> = {
  chat: "대화 캡처",
  bank: "입출금 내역",
  shipping: "배송·운송장",
  threat: "협박 메시지",
  autopay: "자동이체 내역",
  unknown: "미분류 자료",
  // 4면에서 걸러내므로 여기 쓰이지 않는다. Record를 채우기 위해 둔다.
  intake: "직접 답한 내용",
}

const APPLICANT_ORDER: LegalFormField[] = [
  "applicant.name",
  "applicant.birthDate",
  "applicant.address",
  "applicant.phone",
  "applicant.mobile",
  "applicant.email",
]

const ACCOUNT_ORDER: LegalFormField[] = [
  "account.bank",
  "account.branch",
  "account.depositType",
  "account.accountNumber",
]

function Page({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <section className="print-page overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-subtle px-4 py-3">
        <span className="flex-none rounded-md bg-bg px-2 text-[11px] font-semibold leading-[22px] text-muted">
          {no}면
        </span>
        <span className="text-[15px] font-semibold tracking-tight">{title}</span>
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  )
}

/**
 * 제출 패키지 미리보기 (S04-2).
 *
 * **왜 필요한가**: `spec.md` F8-01이 PDF 각 면 하단에 "AI 초안 · 사용자 확인 완료 {시각}"을
 * 찍는데, 확인 단계가 없으면 그 표기가 사실이 아니다. 그리고 F7-02는 *없는 사실을 지어낸*
 * 문장만 막고 *있는 사실을 틀리게 쓴* 문장("발송"을 "수령"으로 뒤집는 경우)은 막지 못한다.
 *
 * **1면을 HTML로 재현하지 않는다.** 서버가 별지 제4호서식 원본 레이아웃을 그대로 그리는데
 * 프론트가 같은 표를 다시 만들면 한쪽만 고쳤을 때 조용히 어긋난다. 사용자가 확인해야 할 것은
 * **자기가 입력한 값이 맞는지**이지 표 선의 위치가 아니다.
 * 근거: `docs/response/backend/draft-preview-and-edit.md` §4-1.
 */
export function PreviewSheet({
  width,
  form,
  draftLines,
  timeline,
  checklist,
  cards,
  excluded,
  onToggleExcluded,
  files,
  onRevise,
  reviseWarning,
  onBackToEvidence,
  buildPdf,
  textPagesPending,
  onDownload,
  onClose,
}: PreviewSheetProps) {
  /**
   * 두 가지 보기를 둔다.
   *
   * - **정리해서 보기(기본)**: 문장을 빼고 넣는 편집이 즉시 반영된다. 실제 PDF는 서버가
   *   만들므로 편집할 때마다 다시 부르면 느리다
   * - **실제 문서**: 내려받을 파일 그대로. 한글 폰트 깨짐처럼 **HTML 미리보기가 구조적으로
   *   못 잡는 사고**를 사용자가 받기 전에 볼 수 있다
   */
  const [view, setView] = useState<"summary" | "document">("summary")
  const build = useCallback(() => buildPdf(), [buildPdf])
  const pad = width >= 640 ? 24 : 20
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const request = toPackageRequest(form)
  const blanks = blankFieldLabels(form)
  const included = draftLines.filter((line) => !excluded.has(line.id))
  /**
   * 4면 증빙자료 목록 — 뒤에 붙는 원본 이미지 페이지의 **목차**다. **A안으로 확정**
   * (백엔드 회신 2026-08-25). `checklist`가 아니다 — 그건 보유/미보유 표시라 제출본에 넣지 않는다.
   *
   * **묶는 단위는 원본(첨부)이다** (2026-08-26 ② 재정정). 종전에는 카드 단위였는데, 그러면
   * 3면(타임라인)과 **열만 다를 뿐 같은 표**가 된다. 캡처 한 장에서 카드가 여러 개 나오면
   * (대화 1장 → 3장) 3·4면에 똑같이 흩어져 "무엇을 제출했는지"에 답이 안 됐다. 백엔드
   * 실측으로 35줄 → 5줄이 됐다. `source_image_index` 오름차순, 텍스트 입력(`null`)은 맨 뒤.
   *
   * **서버 PDF와 같은 규칙으로 묶어야 한다.** 같은 면을 두 곳에서 그리므로, 여기가 어긋나면
   * 미리보기와 내려받은 파일이 갈린다 — `evt_intake_when`·3면 미확인 카드 때와 같은 유형의
   * 사고다. 규칙 단일 출처는 `spec.md` F8-01 "원본 단위 한 줄의 구성"이다.
   */
  const attachments = (() => {
    const usable = cards
      .filter((card) => card.confirmation_status !== "pending")
      // `intake` 카드(백엔드가 문진 지급정지일로 합성)는 **증빙자료가 아니다.** 3면에는 남지만
      // 이 목록에는 넣지 않는다 — 올린 적 없는 항목이 "올린 자료의 목차"에 실리게 된다.
      .filter((card) => card.source_type !== "intake")

    const groups = new Map<number | null, ExtractedCard[]>()
    for (const card of usable) {
      const key = card.source_image_index
      const bucket = groups.get(key)
      if (bucket) bucket.push(card)
      else groups.set(key, [card])
    }

    // `source_image_index` 오름차순, 이미지가 없는 그룹(F3-04)은 맨 뒤 한 줄.
    return [...groups.entries()]
      .sort(([a], [b]) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER))
      .map(([imageIndex, group]) => {
        const known = group
          .map((card) => card.occurred_at)
          .filter((at): at is string => at !== null)
          .sort()
        const unknown = group.length - known.length
        const fmt = (at: string) =>
          at.includes("T") ? `${at.slice(0, 10).replace(/-/g, ".")} ${at.slice(11, 16)}` : at.slice(0, 10).replace(/-/g, ".")
        let when: string
        if (known.length === 0) when = "시각 미상"
        else if (known[0] === known[known.length - 1]) when = fmt(known[0])
        else when = `${fmt(known[0])} ~ ${fmt(known[known.length - 1])}`
        if (known.length > 0 && unknown > 0) when += ` (시각 미상 ${unknown}건 포함)`
        return {
          imageIndex,
          // 한 원본은 보통 한 유형이라 첫 카드 기준으로 충분하다 (명세 그대로).
          label: imageIndex === null ? "본인 서술" : SOURCE_LABEL[group[0].source_type],
          when,
          // 개별 사실은 이미 3면에 있다. 4면에서 다시 나열하지 않는다.
          summary: group.length === 1 ? group[0].summary : `${group.length}건 확인됨`,
        }
      })
  })()
  const hasOriginals = attachments.some((row) => row.imageIndex !== null)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="no-print flex flex-none items-center gap-3 border-b border-border" style={{ padding: `14px ${pad}px` }}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold tracking-tight">내려받기 전에 확인해주세요</div>
          <div className="mt-0.5 text-xs text-muted">은행에 낼 서류 그대로예요</div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="h-11 w-11 flex-none flex items-center justify-center text-muted">
          <Close size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: `${pad}px ${pad}px 24px` }}>
        <div className="mx-auto flex max-w-[560px] flex-col gap-4">
          <div className="no-print flex gap-1 rounded-xl bg-surface p-1">
            {([
              ["summary", "정리해서 보기"],
              ["document", "실제 문서"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-pressed={view === value}
                className={`h-11 flex-1 rounded-lg text-[15px] font-semibold ${
                  view === value ? "bg-bg text-ink shadow-sm" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "document" ? (
            <PdfPreview build={build} textPagesPending={textPagesPending} />
          ) : (
          /* F8-02 — **PDF 생성이 실패했을 때의 대체 경로.** 이 묶음만 인쇄되고 화면 장치는
             빠진다. 인쇄물이 PDF와 같은 서류가 되도록 5면 원본 이미지도 인쇄에만 붙인다 —
             원본이 빠지면 "대체 경로"가 실제로 대체가 되지 않는다. */
          <div className="print-doc flex flex-col gap-4">
          {/* 표지 — 부족자료 체크리스트를 뺀 자리에 들어간다 (spec.md F7-06).
              **못 갖춘 자료를 적지 않는다.** 적기 시작하면 체크리스트를 뺀 이유가 여기서 되살아난다. */}
          <section className="print-page overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-subtle px-4 py-3">
              <span className="flex-none rounded-md bg-bg px-2 text-[11px] font-semibold leading-[22px] text-muted">
                표지
              </span>
              <span className="text-[15px] font-semibold tracking-tight">제출 서류 목록</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="text-[13px] font-semibold">이 문서에 포함된 것</div>
              <ol className="mt-1.5 flex flex-col gap-1 text-[13px] leading-normal text-muted">
                <li>1. 이의제기신청서 (작성 지원본)</li>
                <li>2. 사실관계 진술서</li>
                <li>3. 거래 타임라인</li>
                <li>4. 증빙자료 목록</li>
                <li>5. 증빙 원본 이미지</li>
              </ol>
              <div className="mt-3 text-[13px] font-semibold">신청인이 따로 첨부하는 것</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] leading-normal text-muted">
                <li>· 명의인 신분증 사본</li>
                <li>· 1면 서명란 자필 서명</li>
              </ul>
            </div>
          </section>

          <Page no={1} title="이의제기신청서 (별지 제4호서식)">
            <p className="text-[13px] leading-normal text-muted">
              법에 정해진 서식 그대로 만들어져요. 아래는 여기에 들어갈 값이에요.
            </p>
            <dl className="mt-3 divide-y divide-border">
              {[...APPLICANT_ORDER, ...ACCOUNT_ORDER].map((field) => {
                const value = readField(form, field)
                return (
                  <div key={field} className="flex items-center gap-3 py-2">
                    <dt className="w-[92px] flex-none text-[13px] text-muted">{FIELD_LABELS[field]}</dt>
                    <dd className={`min-w-0 flex-1 text-[15px] ${value ? "" : "text-muted"}`}>{value || "비어 있음"}</dd>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 py-2">
                <dt className="w-[92px] flex-none text-[13px] text-muted">{FIELD_LABELS["account.holderName"]}</dt>
                <dd className={`min-w-0 flex-1 text-[15px] ${request.account.holderName ? "" : "text-muted"}`}>
                  {request.account.holderName || "비어 있음"}
                  {form.holderSameAsApplicant && request.account.holderName && (
                    <span className="ml-2 text-[13px] text-muted">신청인과 동일</span>
                  )}
                </dd>
              </div>
            </dl>
            {blanks.length > 0 && (
              <p className="mt-3 text-[13px] leading-normal text-muted">
                비워둔 칸 {blanks.length}개는 서식에 빈칸으로 나가요. 출력한 뒤 손으로 채우셔도 돼요.
              </p>
            )}
            {/* 전자서명은 서비스 범위 밖이라 서명란이 공란으로 나간다. 모르고 파일만 보내면 반려될 수 있다. */}
            <p className="mt-2 text-[13px] leading-normal font-semibold">
              서명란은 비어 있어요. 출력해서 직접 서명한 뒤 내세요.
            </p>
          </Page>

          {/* F7-08 편집 범위 — 2면만 문장 수정·제외가 된다. 3·4면은 편집 불가이고,
              대신 3면 옆에 자료 확인으로 돌아가는 길을 둔다(막다른 길 방지). */}
          <Page no={2} title="사실관계 진술서">
            <p className="no-print text-[13px] leading-normal text-muted">
              틀린 문장은 고치고, 빼고 싶은 문장은 뺄 수 있어요. 뺀 문장은 서류에 들어가지 않아요.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {draftLines.map((line) => {
                const off = excluded.has(line.id)
                const editing = editingId === line.id
                if (editing) {
                  return (
                    <li key={line.id} className="no-print flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-brand bg-bg p-3 text-[15px] leading-relaxed"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await onRevise(line.id, editText)
                            setEditingId(null)
                          }}
                          className="h-11 rounded-lg bg-ink px-4 text-[13px] font-semibold text-white"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-11 rounded-lg border border-border px-4 text-[13px] font-semibold text-muted"
                        >
                          취소
                        </button>
                        {/* **"될 수 있어요"가 아니라 "됩니다"** — 서버는 고친 값이 여전히 근거와
                            맞는지 다시 확인하지 않고, `text`가 오면 무조건 `user_text`로 낮춘다
                            (계약 v2026-08-26 ⑤ 정정). 오타만 고쳐도 마찬가지다. 조건부로 쓰면
                            "내 경우엔 안 끊기겠지"로 읽혀서, 배지가 바뀐 걸 보고 놀라게 된다. */}
                        <span className="text-xs leading-normal text-muted">
                          고치면 근거 연결이 끊겨 "본인 진술"이 돼요 (오타만 고쳐도 그래요)
                        </span>
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={line.id} className="flex items-start gap-2">
                    <div className={`min-w-0 flex-1 text-[15px] leading-relaxed ${off ? "text-muted line-through" : ""}`}>
                      {line.text}
                      {line.badge && (
                        <span className="ml-2 align-middle text-[11px] font-semibold text-muted">{line.badge}</span>
                      )}
                    </div>
                    {/* 뺀 문장은 고칠 수 없다 — 서류에 안 들어가는 문장을 다듬게 두면
                        무엇이 최종본인지 헷갈린다. 되돌린 뒤에 고치면 된다. */}
                    {!off && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(line.id)
                          setEditText(line.text)
                        }}
                        className="no-print h-11 flex-none rounded-lg border border-border px-3 text-xs font-semibold text-muted"
                      >
                        고치기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleExcluded(line.id)}
                      className={`no-print h-11 flex-none rounded-lg border px-3 text-xs font-semibold ${
                        off ? "border-brand text-brand" : "border-border text-muted"
                      }`}
                    >
                      {off ? "다시 넣기" : "빼기"}
                    </button>
                  </li>
                )
              })}
            </ul>
            {/* 서버가 준 문구를 그대로 쓴다. 문장은 지우지 않고 살린 채로 무엇을 잃었는지만 알린다. */}
            {reviseWarning && (
              <p className="no-print mt-3 rounded-xl bg-warning-subtle p-3 text-[13px] leading-normal text-warning">
                {reviseWarning}
              </p>
            )}
            {included.length === 0 && (
              <p className="no-print mt-3 text-[13px] leading-normal text-warning">
                문장을 모두 뺐어요. 진술서가 비어 있는 채로 나가요.
              </p>
            )}
          </Page>

          <Page no={3} title="시간순 거래 타임라인">
            {/* **증거 공백(`gap`)은 제출본에 넣지 않는다** (spec.md F8-01).
                부족자료 체크리스트를 뺀 것과 같은 이유 — "못 갖춘 것"을 은행에 스스로
                정리해 건네지 않는다. 공백은 화면(S02 타임라인)에만 남는다. */}
            <ul className="flex flex-col gap-2">
              {timeline
                .filter((event) => !event.gap)
                .map((event, i) => (
                  <li key={`${event.time}-${i}`} className="flex gap-3 text-[15px] leading-normal">
                    <span className="w-[112px] flex-none text-[13px] tabular-nums text-muted">{event.time}</span>
                    <span className="min-w-0 flex-1">{event.text}</span>
                  </li>
                ))}
            </ul>
            {/* 편집을 막기만 하면 막다른 길이 된다 — 고칠 곳을 알려준다 (F7-04 경로).
                화면에서만 필요한 길이라 인쇄물에는 넣지 않는다. */}
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] leading-normal text-muted">
                값이 다르면 자료 확인으로 돌아가 고칠 수 있어요.
              </p>
              <button
                type="button"
                onClick={onBackToEvidence}
                className="h-11 flex-none rounded-xl border border-border px-3.5 text-[13px] font-semibold text-ink"
              >
                자료 확인으로
              </button>
            </div>
          </Page>

          {/* 4면 — 순번 · 자료 유형 · 확인된 일시 · 한 줄 요약 (spec.md F8-01).
              **파일명을 넣지 않는다** — `카톡_김철수_20260901.png`처럼 개인정보가 섞인다.
              **보유/미보유도 넣지 않는다** — 못 갖춘 것을 제출본에 적지 않기로 한 것과 같은 이유다. */}
          <Page no={4} title="증빙자료 목록">
            {attachments.length > 0 ? (
              <ol className="flex flex-col gap-2 text-[15px] leading-normal">
                {attachments.map((row, i) => (
                  <li key={row.imageIndex ?? "self"} className="flex gap-2">
                    <span className="flex-none tabular-nums text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{row.label}</span>
                      {row.imageIndex !== null && (
                        // 계약값은 0-base다. **표시할 때만 +1** 한다 — "원본 0번"이라고 쓸 수 없다.
                        // 백엔드 PDF도 같은 규칙으로 +1 한다.
                        <span className="ml-2 text-[13px] text-muted">원본 {row.imageIndex + 1}번</span>
                      )}
                      <span className="ml-2 text-[13px] tabular-nums text-muted">{row.when}</span>
                      <span className="block text-[13px] leading-normal text-muted">{row.summary}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] leading-normal text-muted">올린 자료가 없어 목록이 비어 있어요.</p>
            )}
            {/* 원본 단위가 되면서 **한 줄 = 원본 한 장**이 됐다(텍스트 입력 줄은 예외).
                그래도 "같은 순서"라고 쓰지 않는다 — 확인하지 않은 카드만 있는 원본은 이 목록에
                없지만 이미지는 5면에 그대로 붙으므로, 개수가 어긋날 수 있다. */}
            {hasOriginals && (
              <p className="mt-3 text-[13px] leading-normal text-muted">
                뒤에 원본 이미지가 붙어요. <b>"원본 n번"</b>이 몇 번째 이미지인지 가리켜요.
              </p>
            )}
          </Page>

          <div className="rounded-2xl bg-brand-subtle px-4 py-4">
            <div className="text-[15px] font-semibold">따로 챙기실 것</div>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] leading-normal">
              <li>· 신청서 자필 서명 — 출력해서 직접 서명한 뒤 제출</li>
              <li>· 명의인 신분증 사본 — 은행에 낼 때 직접 첨부</li>
              {checklist
                .filter((item) => item.fulfillBy === "self" && item.status !== "met" && item.id !== "legal.id_copy")
                .slice(0, 3)
                .map((item) => (
                  <li key={item.id}>· {item.label}</li>
                ))}
            </ul>
          </div>

          {/* 5면 — **인쇄할 때만 나온다.** 화면에서는 위쪽 카드 목록으로 이미 봤고, 여기서
              다시 크게 늘어놓으면 미리보기가 길어지기만 한다. 인쇄물에는 있어야 한다. */}
          {files.length > 0 && (
            <div className="print-only">
              {files.map((file, i) => (
                <div key={file.id} className="print-page">
                  <div className="mb-2 text-[13px] font-semibold">원본 {i + 1}번</div>
                  <img src={file.url} alt={`원본 ${i + 1}번`} className="w-full" />
                </div>
              ))}
            </div>
          )}
          </div>
          )}
        </div>
      </div>

      {/* 본문이 max-w-[560px]로 가운데 정렬돼 있어, 버튼만 화면 폭을 다 쓰면 따로 논다. */}
      <div className="flex-none border-t border-border bg-bg" style={{ padding: `12px ${pad}px 20px` }}>
        <div className="mx-auto max-w-[560px]">
          <button
            type="button"
            onClick={onDownload}
            className="w-full rounded-2xl bg-brand text-[17px] font-bold text-white"
            style={{ height: 52 }}
          >
            이대로 내려받기
          </button>
          {/* F8-02 — PDF가 안 만들어질 때 쓰는 길. 눈에 띄게 두지 않되 **찾을 수는 있어야**
              한다. 여기서 막히면 사용자는 아무것도 못 내고 끝난다. */}
          {view === "summary" && (
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-2 h-11 w-full rounded-xl border border-border text-[13px] font-semibold text-muted"
            >
              내려받기가 안 되면 인쇄하기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
