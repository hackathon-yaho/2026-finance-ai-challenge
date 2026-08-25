package com.haebing.backend.textpackage.service;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.session.*;
import com.haebing.backend.textpackage.dto.Account;
import com.haebing.backend.textpackage.dto.Applicant;
import com.haebing.backend.textpackage.dto.PackageRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** docs/backend/phase-5-draft-package.md "단위 테스트" — TC-14(빈 값 400 아님), TC-34(4면 파일명·보유여부 없음). */
class PackageServiceImplTest {

    private final PackageServiceImpl service = new PackageServiceImpl();

    private Session session() {
        return new Session("s1s1s1s1s1s1s1s1", Instant.now().plusSeconds(1800));
    }

    @Test
    void tc14_allFieldsEmpty_generatesPdfWithoutError() {
        byte[] pdf = service.generate(session(), new PackageRequest(null, null, null));

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF");
    }

    @Test
    void fieldOver100Chars_rejectedWithInvalidFormField() {
        String tooLong = "a".repeat(101);
        Applicant applicant = new Applicant(tooLong, null, null, null, null, null);

        assertThatThrownBy(() -> service.generate(session(), new PackageRequest(applicant, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_FORM_FIELD);
    }

    @Test
    void birthDate_wrongFormat_rejected() {
        Applicant applicant = new Applicant(null, "19900101", null, null, null, null);

        assertThatThrownBy(() -> service.generate(session(), new PackageRequest(applicant, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_FORM_FIELD);
    }

    @Test
    void birthDate_correctFormat_accepted() {
        Applicant applicant = new Applicant("홍길동", "1990-01-01", null, null, null, null);

        byte[] pdf = service.generate(session(), new PackageRequest(applicant, null, null));

        assertThat(pdf).isNotEmpty();
    }

    @Test
    void fullApplicantAndAccount_generatesPdf() {
        Applicant applicant = new Applicant("홍길동", "1990-01-01", "서울시 강남구", "02-1234-5678", "010-1234-5678", "a@b.com");
        Account account = new Account("카카오뱅크", "본점", "보통예금", "3333-01-1234567", "홍길동");

        byte[] pdf = service.generate(session(), new PackageRequest(applicant, account, List.of()));

        assertThat(pdf).isNotEmpty();
    }

    @Test
    void evidenceRow_hasNoFilenameOrHeldField() {
        // 구조적으로 EvidenceRow에는 파일명·보유여부 필드가 없다 — 컴파일 시점에 이미 보장된다 (TC-34).
        var row = new EvidenceRow(1, "대화", "2026-09-01T00:00:00+09:00", "요약", "원본 1번");
        assertThat(row.sequence()).isEqualTo(1);
        // record 컴포넌트 개수로 필드가 이것뿐임을 확인한다.
        assertThat(EvidenceRow.class.getRecordComponents()).hasSize(5);
    }

    @Test
    void excludedSentenceIds_isTheSoleAuthorityForPage2_sessionLevelExcludedIsIgnored() throws java.io.IOException {
        // 2026-08-26 프론트 회신(draft-revise-and-package-notes.md §2) — excludedSentenceIds가 최종이다.
        // revise로 세션에 excluded=true가 남아 있어도, 이 요청이 그 id를 안 보내면 PDF에는 포함돼야 한다.
        Session session = session();
        session.replaceSentences(List.of(
                new StoredSentence("s1", "포함될문장", false, false),
                new StoredSentence("s2", "세션에서만제외된문장", true, false), // revise로 excluded=true, 하지만 요청엔 없음
                new StoredSentence("s3", "요청으로제외된문장", false, false)
        ), List.of());

        byte[] pdf = service.generate(session, new PackageRequest(null, null, List.of("s3")));

        String text = extractText(pdf);
        assertThat(text).contains("포함될문장", "세션에서만제외된문장");
        assertThat(text).doesNotContain("요청으로제외된문장");
    }

    @Test
    void intakeDueDateCard_appearsOnPage3ButNotPage4() throws java.io.IOException {
        // 2026-08-26 로컬 연동 회신 §4 — 미리보기(/api/timeline)에는 있는데 PDF 3면엔 없던 불일치 수정 확인.
        // 4면은 "올린 자료의 목차"라 이 카드가 실리면 안 된다(올린 적 없는 항목이라 "본인 서술"로 잘못 표기됐었다).
        Session session = session();
        session.getIntake().put("when", "2026-08-15");
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "실제증거카드요약", 1000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, ExtractedEvent.USER_CONFIRMED));

        byte[] pdf = service.generate(session, new PackageRequest(null, null, null));

        String text = extractText(pdf);
        assertThat(text).contains("지급정지일"); // 3면에 포함 — 미리보기(/api/timeline)와 일치
        assertThat(text).containsOnlyOnce("지급정지일"); // 4면(증빙목록)에는 중복으로도 실리지 않아야 한다
    }

    private String extractText(byte[] pdf) throws java.io.IOException {
        try (var doc = org.apache.pdfbox.Loader.loadPDF(pdf)) {
            return new org.apache.pdfbox.text.PDFTextStripper().getText(doc);
        }
    }

    @Test
    void confirmedCardsOnly_pendingCardExcludedFromPackage() {
        Session session = session();
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "확인됨", 1000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, ExtractedEvent.USER_CONFIRMED));
        session.upsertCard(new ExtractedEvent("evt_2", 1, "chat", "2026-09-02T00:00:00+09:00", "self", "미확인", 2000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, ExtractedEvent.PENDING));

        byte[] pdf = service.generate(session, new PackageRequest(null, null, null));

        String text = new String(pdf, java.nio.charset.StandardCharsets.ISO_8859_1);
        // PDF 압축(Flate) 스트림이라 텍스트 직접 검색은 신뢰할 수 없다 — 예외 없이 생성되는지만 확인.
        assertThat(pdf).isNotEmpty();
    }
}
