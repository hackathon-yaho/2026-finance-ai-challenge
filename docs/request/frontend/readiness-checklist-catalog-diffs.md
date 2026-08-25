# [백엔드 → 프론트] Phase 4 구현 — 체크리스트 목과 다른 점 2가지

> **상태: ✅ 회신 완료 (2026-08-26)**
> - 회신: `../../response/backend/readiness-checklist-catalog-diffs.md`
> - **결론 요약**: 2건 전부 수용 — `payer_match`를 `goods` 전용으로, `goods.trade_doc`을 `self`/`silent`로 정정. 화면은 `fulfillBy` 분기라 값만 바꿔 자가진술 자리로 이동
> - **남은 것**: 없음
>
> 아래 본문은 **요청 당시 원문**입니다.

- 작성: 백엔드 · 2026-08-26
- 관련 문서: `../../01-product/reason-type-rules.md` §2-1·§3-1, `../../../backend/docs/api-spec.md` 5.1 절

`POST /api/readiness`를 구현하면서 `frontend/src/data.ts`의 `EVIDENCE_CATALOG`(참조 구현)를 대조했습니다. 대부분 그대로 따랐지만, **문서(`reason-type-rules.md`)와 목이 어긋나는 2곳은 문서를 따랐습니다.** 실제 API를 붙이면 화면에 영향이 있어 미리 알려드립니다.

## 1. `payer_match`("구매자–송금인 일치 여부") — `goods`에만 있습니다

목에는 4개 사유유형(goods/service/debt/unclear) 전부에 이 항목이 있고, 유형별로 라벨만 바꿔 두셨습니다("일을 맡긴 사람–송금인 일치 여부" 등).

**`reason-type-rules.md`는 이 항목이 "② 금감원 표준 층에만 존재한다(물품 거래). 용역·급여, 채권 회수, 기타 유형의 체크리스트에는 넣지 않는다"고 명시하고 있습니다.** 실제 금감원 표준 소명자료 표에도 물품 거래 행에만 이 항목이 있고, 용역·급여 행에는 없습니다.

**실제 API 응답**: `reason: "service"` / `"debt"` / `"unclear"`일 때 `checklist` 배열에 `payer_match` 항목이 **아예 없습니다.**

**확인 부탁**: service/debt/unclear 화면에서 이 카드를 렌더하고 계셨다면, 그 사유유형에서는 카드 자체를 지워주세요 (배열에 없으니 별도 분기 없이 자연히 안 그려질 겁니다).

## 2. `goods.trade_doc`(계약서·세금계산서·거래명세서) — `whenMissing`·`fulfillBy`가 다릅니다

| | 목 | 실제 API |
| --- | --- | --- |
| `whenMissing` | `notice` | **`silent`** |
| `fulfillBy` | `upload` | **`self`** |

**이유**: `reason-type-rules.md`가 이 서류를 "사후에 만들면 증거 조작"이라고 못 박고 있는데, `notice`는 "미보유 — 보완 요청 사유가 될 수 있어요"처럼 **가서 받아오라는 뉘앙스**라 원칙과 어긋납니다. 그리고 AI 카드의 `source_type`(chat/bank/shipping/threat/autopay/unknown) 중 이 서류를 가리키는 값이 없어서, 애초에 `upload` 판정 자체가 불가능했습니다 — 목에서도 `sources`를 비워두고 "실제 판정은 백엔드가 카드로 한다"고 주석을 남기셨더군요.

그래서 **자가 진술(`POST /api/checklist/self-held`)로 받도록 구현했습니다.** 셋 중 하나만 `held: true`로 보내면 택일 그룹 전체가 `met`이 됩니다(TC-23).

**확인 부탁**: 이 항목이 업로드 화면이 아니라 **다른 자가진술 항목(신분증 사본 등)과 같은 자리**에 노출되도록 화면 구성을 맞춰주세요.

## 회신에 담아 주실 것

1. §1 — service/debt/unclear 화면에서 `payer_match` 카드를 지우는 데 문제없는지
2. §2 — `goods.trade_doc`을 자가진술 UI로 옮기는 데 문제없는지
