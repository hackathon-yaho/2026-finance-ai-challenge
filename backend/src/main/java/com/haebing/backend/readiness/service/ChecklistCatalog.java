package com.haebing.backend.readiness.service;

import java.util.List;
import java.util.Map;

import static com.haebing.backend.readiness.dto.ChecklistItem.*;

/**
 * docs/01-product/reason-type-rules.md §2, docs/backend/phase-4-readiness.md 4-3a 단일 출처.
 * 프론트 참조 구현(frontend/src/data.ts EVIDENCE_CATALOG)을 대조했고, 문서와 어긋나는 2곳은
 * 문서를 따랐다 — 상세는 각 항목 주석.
 */
public final class ChecklistCatalog {

    private ChecklistCatalog() {
    }

    static final String LEGAL_PROOF_ID = "legal.proof";
    static final String PAYER_MATCH_ID = "payer_match";

    private static final List<ChecklistEntry> LEGAL_ENTRIES = List.of(
            new ChecklistEntry(LEGAL_PROOF_ID, "사기이용계좌가 아니라는 사실을 증명하는 자료",
                    TIER_LEGAL, FULFILL_UPLOAD, WHEN_MISSING_BLOCKS,
                    "정해진 양식이 없어요. 올리신 자료로 저희가 만들어드려요.", null),
            new ChecklistEntry("legal.id_copy", "명의인 신분증 사본",
                    TIER_LEGAL, FULFILL_SELF, WHEN_MISSING_SILENT,
                    "여기에 올리지 마세요. 은행에 낼 때 직접 첨부해주세요.", null)
    );

    private static final List<ChecklistEntry> SUPPORTING_ENTRIES = List.of(
            new ChecklistEntry("supporting.life_activity", "생계 흔적 (통신비·공과금 자동이체)",
                    TIER_SUPPORTING, FULFILL_UPLOAD, WHEN_MISSING_SILENT, null, List.of("autopay")),
            new ChecklistEntry("supporting.identity", "재직증명서 · 소득금액증명원 · 예금거래내역서",
                    TIER_SUPPORTING, FULFILL_SELF, WHEN_MISSING_SILENT,
                    "함께 제출하는 경우가 많아요. 여기에 올리지 않고 직접 첨부하시면 돼요.", null),
            new ChecklistEntry("supporting.threat", "협박 메시지 (해당하는 경우에만)",
                    TIER_SUPPORTING, FULFILL_UPLOAD, WHEN_MISSING_SILENT, null, List.of("threat")),
            new ChecklistEntry("supporting.police_record", "경찰 신고 접수증 · 수사 결과 통지서 (해당하는 경우에만)",
                    TIER_SUPPORTING, FULFILL_SELF, WHEN_MISSING_SILENT,
                    "신고했거나 수사가 진행 중이라면 도움이 될 수 있어요. 해당 없으면 넘어가세요.", null)
    );

    private static ChecklistEntry bankRecord() {
        return new ChecklistEntry("common.bank_record", "해당 입금 건의 계좌 거래내역",
                TIER_COMMON, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("bank"));
    }

    /**
     * reason-type-rules.md §2-1 — 물품 거래에만 존재한다("용역·급여, 채권 회수, 기타 유형의
     * 체크리스트에는 넣지 않는다"). 프론트 목 구현은 4개 유형 전부에 넣었지만 문서를 따랐다 —
     * 금감원 표준 자체가 물품 거래에만 이 항목을 두고 있다.
     */
    private static ChecklistEntry payerMatch(String label) {
        return new ChecklistEntry(PAYER_MATCH_ID, label,
                TIER_FSS, FULFILL_DERIVED, WHEN_MISSING_SILENT,
                "올리신 대화와 입금 내역에서 저희가 대조해요.", null);
    }

    public static List<ChecklistEntry> forReason(String reason) {
        return CATALOG.getOrDefault(reason, CATALOG.get("unclear"));
    }

    private static final Map<String, List<ChecklistEntry>> CATALOG = Map.of(
            "goods", concat(LEGAL_ENTRIES, List.of(
                    new ChecklistEntry("goods.chat", "거래 상대방과의 대화 · 중고거래 앱 거래 내역",
                            TIER_FSS, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("chat")),
                    new ChecklistEntry("goods.trade_doc", "거래 사실을 보이는 서류",
                            TIER_FSS, FULFILL_SELF,
                            // reason-type-rules.md: "사후에 만들면 증거 조작" — notice는 "가서 받아오라"는
                            // 뉘앙스라 원칙과 어긋난다. 프론트 목은 notice+upload(sources 없음)였으나 문서를 따랐다.
                            // AI source_type에 이 서류를 가리키는 값이 없어 upload로는 판정할 수 없다 — self로 둔다.
                            WHEN_MISSING_SILENT,
                            "이 중 하나만 있으면 돼요. 개인 간 거래라 셋 다 없어도 괜찮아요.", null,
                            List.of(
                                    new ChecklistOptionEntry("goods.trade_doc.contract", "계약서", null),
                                    new ChecklistOptionEntry("goods.trade_doc.tax_invoice", "세금계산서", null),
                                    new ChecklistOptionEntry("goods.trade_doc.statement", "거래명세서", null)
                            )),
                    payerMatch("구매자–송금인 일치 여부"),
                    new ChecklistEntry("goods.business_reg", "사업자등록증",
                            TIER_FSS, FULFILL_SELF, WHEN_MISSING_SILENT, "사업자가 아니면 넘어가세요.", null),
                    bankRecord(),
                    new ChecklistEntry("goods.delivery", "물품 발송 증빙 (택배 송장 등)",
                            TIER_COMMON, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("shipping"))
            ), SUPPORTING_ENTRIES),

            "service", concat(LEGAL_ENTRIES, List.of(
                    new ChecklistEntry("service.employment", "일한 사실을 보이는 서류",
                            TIER_FSS, FULFILL_SELF, WHEN_MISSING_BLOCKS,
                            "이 중 하나만 있으면 돼요. 정부24·건강보험공단에서 바로 뗄 수 있어요.", null,
                            List.of(
                                    new ChecklistOptionEntry("service.employment.insurance", "건강보험 자격득실 확인서", null),
                                    new ChecklistOptionEntry("service.employment.certificate", "재직증명서", null)
                            )),
                    new ChecklistEntry("service.payroll", "급여 입금내역",
                            TIER_FSS, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("bank")),
                    new ChecklistEntry("service.work_record", "용역 내용·결과물 전달 기록",
                            TIER_COMMON, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("chat"))
            ), SUPPORTING_ENTRIES),

            "debt", concat(LEGAL_ENTRIES, List.of(
                    new ChecklistEntry("debt.contact", "상대방과의 대화·연락 기록",
                            TIER_COMMON, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("chat")),
                    bankRecord(),
                    new ChecklistEntry("debt.loan_record", "빌려준 사실을 보이는 자료 (차용증·최초 이체 기록)",
                            TIER_COMMON, FULFILL_SELF, WHEN_MISSING_SILENT,
                            "차용증이 없어도 괜찮아요. 송금 기록과 대화로도 대여 사실을 보일 수 있어요.", null)
            ), SUPPORTING_ENTRIES),

            "unclear", concat(LEGAL_ENTRIES, List.of(
                    new ChecklistEntry("unclear.contact", "상대방과의 대화·연락 기록",
                            TIER_COMMON, FULFILL_UPLOAD, WHEN_MISSING_NOTICE, null, List.of("chat")),
                    bankRecord()
            ), SUPPORTING_ENTRIES)
    );

    @SafeVarargs
    private static List<ChecklistEntry> concat(List<ChecklistEntry>... parts) {
        return java.util.Arrays.stream(parts).flatMap(List::stream).toList();
    }
}
