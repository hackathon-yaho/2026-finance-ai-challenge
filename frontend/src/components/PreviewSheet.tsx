import { FIELD_LABELS, blankFieldLabels, readField, toPackageRequest } from "../lib/legalForm"
import type { LegalFormField, LegalFormValues } from "../lib/legalForm"
import type { ChecklistItem, DraftLine, TimelineEvent, UploadedFile } from "../types"

interface PreviewSheetProps {
  width: number
  form: LegalFormValues
  draftLines: DraftLine[]
  timeline: TimelineEvent[]
  checklist: ChecklistItem[]
  uploadedFiles: UploadedFile[]
  excluded: ReadonlySet<string>
  onToggleExcluded: (sentenceId: string) => void
  /** 3면 값이 틀렸을 때 되돌아갈 곳 — 편집 불가만 두면 막다른 길이 된다. */
  onBackToEvidence: () => void
  onDownload: () => void
  onClose: () => void
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
  uploadedFiles,
  excluded,
  onToggleExcluded,
  onBackToEvidence,
  onDownload,
  onClose,
}: PreviewSheetProps) {
  const pad = width >= 640 ? 24 : 20
  const request = toPackageRequest(form)
  const blanks = blankFieldLabels(form)
  const included = draftLines.filter((line) => !excluded.has(line.id))
  // 4면 증빙자료 목록 — 뒤에 붙는 원본 이미지 페이지의 목차다.
  // (`checklist`가 아니다 — 그건 보유/미보유 표시라 은행 제출본에 넣지 않기로 했다.
  //  A/B 확정은 백엔드 회신 대기 중이며 A로 그려둔다.)
  const attachments = uploadedFiles

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
            <ul className="flex flex-col gap-2">
              {timeline.map((event, i) => (
                <li key={`${event.time}-${i}`} className="flex gap-3 text-[15px] leading-normal">
                  <span className="w-[112px] flex-none text-[13px] tabular-nums text-muted">{event.time}</span>
                  <span className={`min-w-0 flex-1 ${event.gap ? "text-muted" : ""}`}>{event.text}</span>
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

          <Page no={4} title="증빙자료 목록">
            {attachments.length > 0 ? (
              <ol className="flex flex-col gap-1.5 text-[15px] leading-normal">
                {attachments.map((file, i) => (
                  <li key={file.id} className="flex gap-2">
                    <span className="flex-none tabular-nums text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] leading-normal text-muted">올린 자료가 없어 목록이 비어 있어요.</p>
            )}
            <p className="mt-3 text-[13px] leading-normal text-muted">
              이 목록 뒤에 원본 이미지가 순서대로 붙어요.
            </p>
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
