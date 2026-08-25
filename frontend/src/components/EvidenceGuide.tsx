import { EVIDENCE_CATALOG } from "../data"
import { reasonOf } from "../lib/checklist"
import type { ChecklistEntry } from "../types"

interface EvidenceGuideProps {
  kind: string | null
}

/**
 * 사유별 업로드 안내 (spec.md F3-07).
 *
 * 종전 업로드 화면은 사유와 무관한 고정 문구 한 줄("대화·입금 내역·송장 캡처를 올리면…")이라,
 * "용역·알바 대가"를 고른 사용자에게도 송장을 안내했다. 그리고 사유별 목록(F7-03)이 Stage 4에
 * 있어서 **자료를 다 올린 뒤에야** 무엇이 필요했는지 알게 되는 구조였다.
 *
 * **목록은 `EVIDENCE_CATALOG`를 F7-03 체크리스트와 공유한다.** 두 곳에 복사하면 반드시 어긋난다.
 *
 * 지켜야 할 것 (F3-07 금지 조항):
 * - 해당 없는 항목을 붉은 경고로 표시하지 않는다. 개인 중고거래자는 사업자등록증을 발급받을 수 없다
 * - "이걸 내면 통과됩니다" 류의 표현을 쓰지 않는다
 */
function labelOf(entry: ChecklistEntry): string {
  if (!entry.anyOf) return entry.label
  return `${entry.anyOf.map((o) => o.label).join(" · ")} 중 하나`
}

export function EvidenceGuide({ kind }: EvidenceGuideProps) {
  const entries = EVIDENCE_CATALOG[reasonOf(kind)]

  // 올릴 것 / 직접 챙길 것 / 서비스가 채우는 것은 성격이 달라서 한 목록에 섞지 않는다.
  const uploads = entries.filter((e) => e.fulfillBy === "upload" && e.tier !== "legal")
  const selfHeld = entries.filter((e) => e.fulfillBy === "self")
  const derived = entries.filter((e) => e.fulfillBy === "derived")

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="text-[15px] font-semibold">
        {kind ? "이 거래에는 이런 자료가 도움이 돼요" : "이런 자료가 도움이 돼요"}
      </div>
      {!kind && (
        <p className="mt-1 text-[13px] leading-normal text-muted">
          거래 성격을 고르지 않아 공통 자료만 안내해요.
        </p>
      )}

      <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] leading-normal">
        {uploads.map((entry) => (
          <li key={entry.id}>· {labelOf(entry)}</li>
        ))}
      </ul>

      {derived.length > 0 && (
        <p className="mt-2.5 text-[13px] leading-normal text-muted">
          {derived.map((e) => e.label).join(" · ")}는 올리신 자료에서 저희가 확인해요.
        </p>
      )}

      {selfHeld.length > 0 && (
        <div className="mt-3.5 border-t border-border pt-3">
          <div className="text-[13px] font-semibold">따로 챙기실 것 · 여기에 올리지 않아요</div>
          <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-normal text-muted">
            {selfHeld.map((entry) => (
              <li key={entry.id}>· {labelOf(entry)}</li>
            ))}
            {/* 서류가 아니라 행위라 카탈로그에 두지 않는다. 서식에 (서명 또는 인) 란이 있고
                전자서명은 범위 밖이라 출력해서 직접 서명해야 한다. */}
            <li>· 신청서 자필 서명 — 출력해서 직접 서명한 뒤 제출해주세요</li>
          </ul>
          <p className="mt-2 text-xs leading-normal text-muted">해당 없는 항목은 넘어가셔도 돼요.</p>
        </div>
      )}
    </div>
  )
}
