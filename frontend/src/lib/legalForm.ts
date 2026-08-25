/**
 * 별지 제4호서식 입력 (spec.md F7-06 · api-contract `/api/package/text`).
 *
 * **11개 필드 전부 선택이다.** 빈 값이면 그 칸이 공란인 작성 지원본이 나온다 — 계좌번호나
 * 개설점포를 모르는 사용자가 실제로 있고, 모르는 값 때문에 패키지 생성이 막히면 서비스가
 * 목적을 잃는다. 그래서 **폼에 필수 표시(`*`)를 붙이지 않는다.**
 *
 * 값은 PDF 생성에만 쓰고 세션·DB·로그 어디에도 남기지 않는다 (PRD §4.4).
 *
 * 필드명은 백엔드 제안을 그대로 따른다 (`docs/response/backend/legal-form-and-package.md` §1).
 */

export interface ApplicantForm {
  name: string
  birthDate: string
  address: string
  phone: string
  mobile: string
  email: string
}

export interface AccountForm {
  bank: string
  branch: string
  depositType: string
  accountNumber: string
  holderName: string
}

export interface LegalFormValues {
  applicant: ApplicantForm
  account: AccountForm
  /** 명의인이 신청인과 같은지. **폼 상태일 뿐 요청 바디에 넣지 않는다** — 서버는 holderName만 받는다. */
  holderSameAsApplicant: boolean
}

export const EMPTY_LEGAL_FORM: LegalFormValues = {
  applicant: { name: "", birthDate: "", address: "", phone: "", mobile: "", email: "" },
  account: { bank: "", branch: "", depositType: "", accountNumber: "", holderName: "" },
  // 법 제7조 제1항의 이의제기 주체가 명의인이라 둘이 다른 경우가 예외적이다.
  // 기본을 해제로 두면 대다수 사용자가 같은 이름을 두 번 친다.
  holderSameAsApplicant: true,
}

export type LegalFormField =
  | `applicant.${keyof ApplicantForm}`
  | `account.${keyof AccountForm}`

export const MAX_FIELD_LENGTH = 100

/** 서식 기재란 이름 그대로 쓴다 — 은행 담당자가 눈으로 아는 양식이라 우리가 이름을 바꾸지 않는다. */
export const FIELD_LABELS: Record<LegalFormField, string> = {
  "applicant.name": "성명",
  "applicant.birthDate": "생년월일",
  "applicant.address": "주소",
  "applicant.phone": "전화번호",
  "applicant.mobile": "휴대전화번호",
  "applicant.email": "전자우편주소",
  "account.bank": "금융회사",
  "account.branch": "개설점포",
  "account.depositType": "예금종별",
  "account.accountNumber": "계좌번호",
  "account.holderName": "명의인",
}

/** 필드 하나를 읽고 쓴다. 그룹·키를 분해하는 곳을 한 군데로 모은다. */
export function readField(values: LegalFormValues, field: LegalFormField): string {
  const [group, key] = field.split(".") as ["applicant" | "account", string]
  return (values[group] as unknown as Record<string, string>)[key] ?? ""
}

export function writeField(values: LegalFormValues, field: LegalFormField, value: string): LegalFormValues {
  const [group, key] = field.split(".") as ["applicant" | "account", string]
  return { ...values, [group]: { ...values[group], [key]: value } }
}

const BIRTH_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 형식만 맞으면 `1990-13-99`도 통과했다. 생년월일은 **법정 서식에 그대로 실리는 값**이라
 * 달력에 없는 날짜가 은행에 나가면 안 된다. 문자열을 되돌려 대조해 실제 날짜인지 본다
 * (`new Date("1990-13-99")`는 Invalid Date, `1990-02-31`은 3월 3일로 굴러가므로 둘 다 걸린다).
 */
function isRealDate(value: string): boolean {
  const match = BIRTH_DATE.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  )
}

/**
 * 형식 검증 (api-contract). **"선택"은 "비어도 된다"이지 "무엇이든 받는다"가 아니다.**
 * 빈 값은 위반이 아니므로 검사하지 않는다.
 */
export function validateField(field: LegalFormField, value: string): string | null {
  if (value.length > MAX_FIELD_LENGTH) return `${MAX_FIELD_LENGTH}자를 넘을 수 없어요`
  if (field === "applicant.birthDate" && value !== "") {
    if (!BIRTH_DATE.test(value)) return "YYYY-MM-DD 형식으로 적어주세요 (예: 1990-01-01)"
    if (!isRealDate(value)) return "달력에 없는 날짜예요. 다시 확인해주세요"
  }
  return null
}

export function validateAll(values: LegalFormValues): Partial<Record<LegalFormField, string>> {
  const errors: Partial<Record<LegalFormField, string>> = {}
  for (const [key, value] of Object.entries(values.applicant)) {
    const field = `applicant.${key}` as LegalFormField
    const error = validateField(field, value)
    if (error) errors[field] = error
  }
  for (const [key, value] of Object.entries(values.account)) {
    const field = `account.${key}` as LegalFormField
    const error = validateField(field, value)
    if (error) errors[field] = error
  }
  return errors
}

/**
 * `POST /api/package/text` 요청 바디. 서버는 11개 값만 받는다 —
 * `holderSameAsApplicant`는 프론트 폼 상태라 보내지 않는다.
 */
export function toPackageRequest(values: LegalFormValues) {
  return {
    applicant: { ...values.applicant },
    account: {
      ...values.account,
      holderName: values.holderSameAsApplicant ? values.applicant.name : values.account.holderName,
    },
  }
}

/** 채우지 않은 칸. "직접 채워야 하는 항목"으로 안내할 때 쓴다 — 막지는 않는다. */
export function blankFieldLabels(values: LegalFormValues): string[] {
  const request = toPackageRequest(values)
  const out: string[] = []
  for (const [key, value] of Object.entries(request.applicant)) {
    if (!value.trim()) out.push(FIELD_LABELS[`applicant.${key}` as LegalFormField])
  }
  for (const [key, value] of Object.entries(request.account)) {
    if (!value.trim()) out.push(FIELD_LABELS[`account.${key}` as LegalFormField])
  }
  return out
}
