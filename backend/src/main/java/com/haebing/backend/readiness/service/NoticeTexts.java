package com.haebing.backend.readiness.service;

/**
 * docs/01-product/reason-type-rules.md §4, docs/backend/phase-4-readiness.md 4-6·4-7·4-9.
 * 전부 상수다 — 백엔드가 조합·변형하지 않는다. LLM을 쓰지 않는다.
 */
public final class NoticeTexts {

    private NoticeTexts() {
    }

    public static final String FINAL_DECISION_BY_BANK = "최종 판단은 은행이 합니다";

    /** F6-05 — 세 상태 모두 동일. 누락 개수로 연장일수를 예측하지 않는다. */
    public static final String PROCESSING_PERIOD = """
            이의제기신청서와 소명자료를 충분히 구비하여 제출한 경우 금융회사는 5영업일 내 심사 결과를 통보합니다. 자료 보완이 필요한 경우 처리기간이 추가될 수 있습니다.

            심사 결과 통보와 지급정지 해제는 다릅니다. 통신사기피해환급법 제8조 제2항에 따라, 피해자에게 통보한 날부터 2개월이 지나기 전에는 지급정지를 종료할 수 없습니다. 5영업일 내 해제를 뜻하지 않습니다.""";

    /** F6-09 — 입금액에 따라 바꾸지 않는다. 소액 여부를 서비스가 판정하지 않는다. */
    public static final String SMALL_AMOUNT_NOTICE =
            "특정 소액 입금 건은 금융회사 판단에 따라 간소화된 일부지급정지 절차가 적용될 수 있습니다. 정확한 금액 기준과 적용 여부는 해당 금융회사에 확인해야 합니다.";

    /** F6-04 — 과거 지급정지 이력 케이스 고정 문구. 결과 예측·낙관·위로 표현 없음. */
    public static final String HISTORY_NOTICE =
            "과거 지급정지 이력이 있어 간소화 절차 대상이 아닐 수 있습니다. 은행 확인이 필요하며, 최종 판단은 은행이 합니다.";

    public static final String CONFLICT_AMOUNT_MISMATCH = "올리신 자료들의 금액이 서로 다르게 확인됐습니다. 금융회사 확인이 필요합니다.";

    /** F6-06 — 검증된 고정 템플릿만 사용한다. LLM 다듬기 없음. */
    public static String missingEvidenceExplanation(String label) {
        return label + "이(가) 확인되지 않아 보완이 필요합니다";
    }

    public static String unconfirmedFieldsExplanation() {
        return "확인하지 않은 자료가 있어 보완이 필요합니다";
    }

    /** TC-04 — 응답 문자열에 이 표현이 하나도 없어야 한다. */
    public static final String[] BANNED_PHRASES = {
            "기각될 수 있습니다", "해제 가능성이 높습니다", "그래도 해볼 만합니다", "혹시 모르니",
            "가능성이 높습니다", "해볼만"
    };
}
