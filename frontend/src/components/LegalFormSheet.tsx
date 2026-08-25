import { useState } from "react"
import {
  EMPTY_LEGAL_FORM,
  FIELD_LABELS,
  MAX_FIELD_LENGTH,
  blankFieldLabels,
  readField,
  validateAll,
  validateField,
  writeField,
} from "../lib/legalForm"
import type { LegalFormField, LegalFormValues } from "../lib/legalForm"

interface LegalFormSheetProps {
  width: number
  initial?: LegalFormValues
  onSubmit: (values: LegalFormValues) => void
  onClose: () => void
}

const APPLICANT_FIELDS: { field: LegalFormField; hint?: string }[] = [
  { field: "applicant.name" },
  { field: "applicant.birthDate", hint: "1990-01-01 형식" },
  { field: "applicant.address" },
  { field: "applicant.phone" },
  { field: "applicant.mobile" },
  // 지점이 없는 인터넷은행은 이메일·팩스로 접수해서 회신 경로가 된다.
  { field: "applicant.email", hint: "이메일로 접수하는 은행은 여기로 회신해요" },
]

const ACCOUNT_FIELDS: { field: LegalFormField; hint?: string }[] = [
  { field: "account.bank", hint: "지급정지된 계좌를 관리하는 곳이에요" },
  { field: "account.branch" },
  { field: "account.depositType", hint: "예: 보통예금" },
  { field: "account.accountNumber" },
]

export function LegalFormSheet({ width, initial, onSubmit, onClose }: LegalFormSheetProps) {
  const [values, setValues] = useState<LegalFormValues>(initial ?? EMPTY_LEGAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<LegalFormField, string>>>({})

  const read = (field: LegalFormField): string => readField(values, field)

  const write = (field: LegalFormField, value: string) => {
    setValues((prev) => writeField(prev, field, value))
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) ?? undefined }))
  }

  const submit = () => {
    const found = validateAll(values)
    setErrors(found)
    // 빈 값은 위반이 아니다. 형식이 틀린 값만 막는다.
    if (Object.keys(found).length === 0) onSubmit(values)
  }

  const blanks = blankFieldLabels(values)
  const pad = width >= 640 ? 24 : 20

  const renderField = ({ field, hint }: { field: LegalFormField; hint?: string }) => (
    <label key={field} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{FIELD_LABELS[field]}</span>
      <input
        value={read(field)}
        maxLength={MAX_FIELD_LENGTH}
        onChange={(e) => write(field, e.target.value)}
        placeholder={field === "applicant.birthDate" ? "1990-01-01" : "모르면 비워두세요"}
        className={`h-12 rounded-xl border bg-bg px-3.5 text-[15px] ${
          errors[field] ? "border-danger" : "border-neutral"
        }`}
      />
      {errors[field] ? (
        <span className="text-xs leading-normal text-danger">{errors[field]}</span>
      ) : (
        hint && <span className="text-xs leading-normal text-muted">{hint}</span>
      )}
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex flex-none items-center gap-3 border-b border-border" style={{ padding: `14px ${pad}px` }}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold tracking-tight">이의제기신청서 작성</div>
          <div className="mt-0.5 text-xs text-muted">시행령 별지 제4호서식</div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="h-11 w-11 flex-none text-xl text-muted">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: `${pad}px ${pad}px 24px` }}>
        <div className="mx-auto flex max-w-[520px] flex-col gap-6">
          {/* 전부 선택이라는 것을 맨 위에서 말한다. 필수 표시(*)를 쓰지 않는다. */}
          <p className="rounded-2xl bg-brand-subtle px-4 py-3.5 text-[13px] leading-normal">
            <b>모두 선택 입력이에요.</b> 모르는 칸은 비워두면 그 자리가 빈 서식이 나와요. 나중에 손으로 채우셔도 돼요.
            여기 적은 값은 <b>서류를 만드는 데만 쓰고 저장하지 않아요.</b>
          </p>

          <div className="flex flex-col gap-4">
            <div className="text-[15px] font-semibold tracking-tight">신청인</div>
            {APPLICANT_FIELDS.map(renderField)}
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-[15px] font-semibold tracking-tight">지급정지된 계좌</div>
            {ACCOUNT_FIELDS.map(renderField)}

            {/* PRD §4.4가 "신청인과 동일 여부 확인"으로 적어둔 항목. 대개 같으므로 기본을 체크로 둔다. */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">{FIELD_LABELS["account.holderName"]}</span>
              <button
                type="button"
                role="checkbox"
                aria-checked={values.holderSameAsApplicant}
                onClick={() => setValues((prev) => ({ ...prev, holderSameAsApplicant: !prev.holderSameAsApplicant }))}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left"
              >
                <span
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-[1.5px] text-[13px] font-bold text-white ${
                    values.holderSameAsApplicant ? "border-brand bg-brand" : "border-neutral bg-bg"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1 text-[15px]">신청인과 같아요</span>
              </button>
              {!values.holderSameAsApplicant && renderField({ field: "account.holderName" })}
            </div>
          </div>

          {blanks.length > 0 && (
            <div className="rounded-2xl bg-surface px-4 py-3.5">
              <div className="text-[13px] font-semibold">비워둔 칸 {blanks.length}개</div>
              <p className="mt-1 text-[13px] leading-normal text-muted">
                {blanks.join(" · ")} — 서식에는 빈칸으로 나가고, 부족자료 목록에 "직접 채워야 하는 항목"으로 적어둘게요.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-none border-t border-border bg-bg" style={{ padding: `12px ${pad}px 20px` }}>
        <button
          type="button"
          onClick={submit}
          className="h-13 w-full rounded-2xl bg-brand text-[17px] font-bold text-white"
          style={{ height: 52 }}
        >
          다음
        </button>
      </div>
    </div>
  )
}
