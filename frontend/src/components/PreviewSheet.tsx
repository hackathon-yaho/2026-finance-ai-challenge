import { useCallback, useState } from "react"
import { PdfPreview } from "./PdfPreview"
import { FIELD_LABELS, blankFieldLabels, readField, toPackageRequest } from "../lib/legalForm"
import type { LegalFormField, LegalFormValues } from "../lib/legalForm"
import type { ChecklistItem, DraftLine, ExtractedCard, SourceType, TimelineEvent } from "../types"

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
    <section className="overflow-hidden rounded-2xl border border-border">
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
  const request = toPackageRequest(form)
  const blanks = blankFieldLabels(form)
  const included = draftLines.filter((line) => !excluded.has(line.id))
  /**
   * 4면 증빙자료 목록 — 뒤에 붙는 원본 이미지 페이지의 목차다. **A안으로 확정**
   * (백엔드 회신 2026-08-25). `checklist`가 아니다 — 그건 보유/미보유 표시라 제출본에 넣지 않는다.
   *
   * **정렬은 카드 단위 + `source_image_index` 오름차순**이다 (B안, 2026-08-25 확정).
   * 4면은 목차이지 이미지 목록이 아니다 — 이미지 1장에서 카드가 여러 장 나오므로
   * (`evt_{image_index}_{n}`) 줄 수와 5면 장 수가 다른 것이 정상이고, **"원본 n번"** 으로
   * 대조한다. 이미지가 없는 텍스트 입력 카드는 뒤로 보낸다.
   */
  const attachments = cards
    .filter((card) => card.confirmation_status !== "pending")
    .slice()
    .sort((a, b) => (a.source_image_index ?? Number.MAX_SAFE_INTEGER) - (b.source_image_index ?? Number.MAX_SAFE_INTEGER))
  const hasOriginals = attachments.some((card) => card.source_image_index !== null)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex flex-none items-center gap-3 border-b border-border" style={{ padding: `14px ${pad}px` }}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold tracking-tight">내려받기 전에 확인해주세요</div>
          <div className="mt-0.5 text-xs text-muted">은행에 낼 서류 그대로예요</div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="h-11 w-11 flex-none text-xl text-muted">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: `${pad}px ${pad}px 24px` }}>
        <div className="mx-auto flex max-w-[560px] flex-col gap-4">
          <div className="flex gap-1 rounded-xl bg-surface p-1">
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
          <>
          {/* 표지 — 부족자료 체크리스트를 뺀 자리에 들어간다 (spec.md F7-06).
              **못 갖춘 자료를 적지 않는다.** 적기 시작하면 체크리스트를 뺀 이유가 여기서 되살아난다. */}
          <section className="overflow-hidden rounded-2xl border border-border">
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

          <Page no={2} title="사실관계 진술서">
            <p className="text-[13px] leading-normal text-muted">
              빼고 싶은 문장은 눌러서 뺄 수 있어요. 뺀 문장은 서류에 들어가지 않아요.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {draftLines.map((line) => {
                const off = excluded.has(line.id)
                return (
                  <li key={line.id} className="flex items-start gap-3">
                    <div className={`min-w-0 flex-1 text-[15px] leading-relaxed ${off ? "text-muted line-through" : ""}`}>
                      {line.text}
                      {line.badge && (
                        <span className="ml-2 align-middle text-[11px] font-semibold text-muted">{line.badge}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleExcluded(line.id)}
                      className={`h-11 flex-none rounded-lg border px-3 text-xs font-semibold ${
                        off ? "border-brand text-brand" : "border-border text-muted"
                      }`}
                    >
                      {off ? "다시 넣기" : "빼기"}
                    </button>
                  </li>
                )
              })}
            </ul>
            {included.length === 0 && (
              <p className="mt-3 text-[13px] leading-normal text-warning">
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
            {/* 편집을 막기만 하면 막다른 길이 된다 — 고칠 곳을 알려준다 (F7-04 경로). */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
                {attachments.map((card, i) => (
                  <li key={card.event_id} className="flex gap-2">
                    <span className="flex-none tabular-nums text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {/* 이미지가 없는 카드(F3-04 텍스트 입력)는 자료 유형 자리에 "본인 서술"을
                            쓴다 — 소명서 본문의 "본인 진술" 배지와 같은 취급이다. */}
                        {card.source_image_index === null ? "본인 서술" : SOURCE_LABEL[card.source_type]}
                      </span>
                      {card.source_image_index !== null && (
                        // 계약값은 0-base다. **표시할 때만 +1** 한다 — "원본 0번"이라고 쓸 수 없다.
                        // 백엔드 PDF도 같은 규칙으로 +1 한다 (2026-08-25 확정).
                        <span className="ml-2 text-[13px] text-muted">원본 {card.source_image_index + 1}번</span>
                      )}
                      {card.occurred_at && (
                        <span className="ml-2 text-[13px] tabular-nums text-muted">
                          {card.occurred_at.slice(0, 10).replace(/-/g, ".")}
                        </span>
                      )}
                      <span className="block text-[13px] leading-normal text-muted">{card.summary}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] leading-normal text-muted">올린 자료가 없어 목록이 비어 있어요.</p>
            )}
            {/* B안이라 줄 수와 이미지 장 수가 다를 수 있다 — 한 장에서 여러 사실이 나오기 때문이다.
                "같은 순서로 붙는다"고 쓰면 개수가 맞는다는 뜻으로 읽힌다.
                텍스트 입력만 한 경우엔 붙을 이미지가 아예 없으므로 이 줄을 쓰지 않는다. */}
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
          </>
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
        </div>
      </div>
    </div>
  )
}
