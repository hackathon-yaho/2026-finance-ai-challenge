package com.haebing.backend.textpackage.service;

import com.haebing.backend.textpackage.dto.Account;
import com.haebing.backend.textpackage.dto.Applicant;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * docs/backend/phase-5-draft-package.md 5-4. 표지 + 1~4면을 만든다. 5면(원본 이미지)은 프론트가 만든다(F7-06).
 *
 * <p>1면은 실제 법정서식 PDF(docs/00-context/법정서식-별지제4호서식-이의제기신청서.pdf ·
 * {@code forms/이의제기신청서-별지4호.pdf}로 복사해 둠)를 그대로 불러와 값만 덧그린다(2026-08-26 결정 —
 * "레이아웃을 새로 그리는 것보다 실물 위에 값만 얹는 쪽이 은행 담당자가 아는 양식과 완전히 같아 반려
 * 위험이 낮다"는 사용자 판단). 이전 판단("좌표 보정 없는 스캔 오버레이가 더 위험하다")은 좌표를
 * 실측(PDFTextStripper로 라벨 위치 추출)하면서 해소했다. 2~4면은 정해진 실물 서식이 없어 표를
 * 직접 그리되, 표 전체 테두리·헤더 음영·페이지 넘침 시 이어그리기를 갖춘다(2026-08-26 개선 —
 * 종전엔 표 아래 가로선 하나뿐이라 표처럼 안 보였고, 행이 많으면 페이지 밖으로 넘쳐 안 보이는
 * 카드가 있었다).
 */
class PdfBuilder implements AutoCloseable {

    private static final float MARGIN = 50;
    private static final float PAGE_WIDTH = PDRectangle.A4.getWidth();
    private static final float PAGE_HEIGHT = PDRectangle.A4.getHeight();
    private static final float CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
    private static final float FOOTER_RESERVED = 40; // 표가 이 아래로는 안 내려가게 — 푸터와 겹치지 않도록
    private static final float HEADER_GRAY = 0.90f;

    private final PDDocument document = new PDDocument();
    private final PDFont font;

    PdfBuilder() throws IOException {
        this.font = loadFont(document);
    }

    /**
     * embedSubset=true로 로드해 고유 서브셋 접두("ABCDEF+NanumGothic")를 강제한다 — 1면은 템플릿
     * 문서에서 이 폰트를 새로 로드해 쓰고 나중에 {@code document}로 합치는데, 접두 없이 로드하면
     * 원본 서식이 쓰는 폰트와 BaseFont 이름이 같아져(둘 다 순정 "NanumGothic") 합친 뒤 일부
     * 뷰어가 폰트를 혼동해 글자가 깨지는 문제가 있었다(2026-08-26 실측으로 발견).
     */
    private static PDFont loadFont(PDDocument targetDocument) throws IOException {
        try (InputStream is = PdfBuilder.class.getClassLoader().getResourceAsStream("fonts/NanumGothic-Regular.ttf")) {
            if (is == null) throw new IOException("나눔고딕 폰트를 찾을 수 없습니다 (fonts/NanumGothic-Regular.ttf)");
            return PDType0Font.load(targetDocument, is, true);
        }
    }

    void addCoverPage() throws IOException {
        try (var page = newPage()) {
            var w = page.writer();
            float y = PAGE_HEIGHT - MARGIN;
            y = w.drawLine("제출 서류 목록", MARGIN, y);
            y -= 20;
            y = w.drawLine("이 문서에 포함된 것", MARGIN, y);
            y -= 5;
            y = w.drawLine("1. 이의제기신청서 (작성 지원본)", MARGIN + 15, y);
            y = w.drawLine("2. 사실관계 진술서", MARGIN + 15, y);
            y = w.drawLine("3. 거래 타임라인", MARGIN + 15, y);
            y = w.drawLine("4. 증빙자료 목록", MARGIN + 15, y);
            y = w.drawLine("5. 증빙 원본 이미지", MARGIN + 15, y);
            y -= 20;
            y = w.drawLine("신청인이 따로 첨부하는 것", MARGIN, y);
            y -= 5;
            y = w.drawLine("· 명의인 신분증 사본", MARGIN + 15, y);
            y = w.drawLine("· 1면 서명란 자필 서명", MARGIN + 15, y);
        }
    }

    /**
     * 법정서식 실물 위에 값만 덧그린다. 좌표는 원본 PDF를 {@code PDFTextStripper}로 라벨 위치를 실측해
     * 구했다(단위 pt, PDF 좌하단 원점 기준으로 환산 완료). 서식 자체의 칸·선·문구는 손대지 않는다 —
     * "접수번호"·"접수일자"·서명란은 원래도 비워두는 자리라 그대로 둔다.
     */
    void addPage1(Applicant applicant, Account account, String statementText, LocalDate downloadDate) throws IOException {
        Applicant a = applicant != null ? applicant : new Applicant(null, null, null, null, null, null);
        Account acc = account != null ? account : new Account(null, null, null, null, null);

        byte[] templateBytes;
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("forms/이의제기신청서-별지4호.pdf")) {
            if (is == null) throw new IOException("법정서식 템플릿을 찾을 수 없습니다 (forms/이의제기신청서-별지4호.pdf)");
            templateBytes = is.readAllBytes();
        }

        // document.importPage()는 이 템플릿의 임베디드 폰트(CID-키 TrueType)를 옮기며 인코딩을 깨뜨렸다
        // (실측으로 발견 — 원본 라벨 텍스트가 렌더 시 깨진 글자로 나왔다). 대신 템플릿을 별도 PDDocument로
        // 열어 그 문서 자신의 페이지에 직접 그리고(폰트도 이 문서 전용으로 새로 로드), 완성된 문서를
        // PDFMergerUtility로 합친다 — 여러 문서를 하나로 합치는 표준 경로라 폰트 보존이 훨씬 안정적이다.
        try (PDDocument templateDoc = Loader.loadPDF(templateBytes)) {
            PDFont templateFont = loadFont(templateDoc);
            PDPage page = templateDoc.getPage(0);

            try (PDPageContentStream cs = new PDPageContentStream(templateDoc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                PdfTextWriter w = new PdfTextWriter(cs, templateFont, 10);
                // 전화번호·휴대전화번호·전자우편주소 3칸은 서식 원래 칸 폭이 좁다(특히 휴대전화번호 칸은
                // 라벨 뺀 실 너비가 ~60pt) — 10pt로는 "010-1234-1234"조차 다음 칸 라벨과 겹친다(실측 확인).
                PdfTextWriter wSmall = new PdfTextWriter(cs, templateFont, 7);

                drawValue(w, 150, 665.9f, a.name());
                drawValue(w, 390, 668.9f, a.birthDate());
                drawValue(w, 150, 636.8f, a.address());
                drawValue(wSmall, 148, 609f, a.phone());
                drawValue(wSmall, 284, 609f, a.mobile());
                drawValue(wSmall, 402, 609f, a.email());
                drawValue(w, 160, 570.6f, acc.bank());
                drawValue(w, 320, 570.6f, acc.branch());
                drawValue(w, 440, 570.6f, acc.depositType());
                drawValue(w, 160, 541.4f, acc.accountNumber());
                drawValue(w, 430, 541.4f, acc.holderName());

                // "이의제기 사유(구체적으로 기재합니다)" 박스 — 소명서 전문 대신 요약 + 참조 안내(안내.md "구현 시 반드시 지킬 것" ④)
                String summary = (statementText == null || statementText.isBlank())
                        ? "(확인된 사실관계가 없습니다.)"
                        : truncate(statementText, 110);
                float ySummary = w.drawParagraph(summary, 65, 481, CONTENT_WIDTH - 30);
                w.drawLine("상세 내용은 별지 사실관계 진술서를 참조하시기 바랍니다.", 65, Math.min(ySummary - 10, 440));

                // 작성일자 — 서식이 인쇄해 둔 "년   월   일" 자리를 흰 사각형으로 지우고 실제 값을 다시 쓴다.
                whiteOut(cs, 422, 210, 85, 16);
                w.drawLine(downloadDate.getYear() + "년 " + downloadDate.getMonthValue() + "월 " + downloadDate.getDayOfMonth() + "일",
                        426, 215.6f);

                // "○○○ 금융회사  귀하" — 은행명이 있으면 실제 값으로 교체(은행 배포본과 같은 관행, 안내.md 참조). 없으면 그대로 둔다.
                if (acc.bank() != null && !acc.bank().isBlank()) {
                    whiteOut(cs, 64, 152, 150, 16);
                    w.drawLine(acc.bank() + " 금융회사   귀하", 68, 158.4f);
                }
            }

            // PDFMergerUtility가 "방금 값을 그려 넣은, 아직 저장 전인" 문서를 바로 합치면 그 새 글자만
            // 깨졌다(실측으로 재현·격리 확인 — 서식 원문은 멀쩡한데 우리가 그린 값만 깨지거나 사라짐).
            // 한 번 저장했다 다시 읽어 들이면(라운드트립) 문서 내부 구조가 온전히 굳어져 정상 합쳐진다.
            ByteArrayOutputStream drawnOut = new ByteArrayOutputStream();
            templateDoc.save(drawnOut);
            try (PDDocument reloaded = Loader.loadPDF(drawnOut.toByteArray())) {
                new PDFMergerUtility().appendDocument(document, reloaded);
            }
        }
    }

    void addPage2(String statementText, String footer) throws IOException {
        try (var page = newPage()) {
            var w = page.writer();
            float y = PAGE_HEIGHT - MARGIN;
            y = w.drawLine("사실관계 진술서", MARGIN, y);
            y -= 20;
            w.drawParagraph(statementText == null || statementText.isBlank() ? "(확인된 사실관계가 없습니다.)" : statementText,
                    MARGIN, y, CONTENT_WIDTH);
            drawFooter(page.stream(), page.writer(), footer);
        }
    }

    private static final float[] PAGE3_WEIGHTS = {0.22f, 0.13f, 0.65f};
    private static final float[] PAGE4_WEIGHTS = {0.08f, 0.14f, 0.58f, 0.20f};

    void addPage3(List<TimelineRow> rows, String footer) throws IOException {
        List<String[]> data = new ArrayList<>();
        for (TimelineRow r : rows) {
            data.add(new String[]{r.occurredAt(), r.actor(), r.summary() + " · " + r.amountText()});
        }
        drawTablePages("시간순 거래 타임라인", new String[]{"일시", "행위 주체", "요약 · 금액"}, PAGE3_WEIGHTS, data, footer);
    }

    void addPage4(List<EvidenceRow> rows, String footer) throws IOException {
        List<String[]> data = new ArrayList<>();
        for (EvidenceRow r : rows) {
            data.add(new String[]{String.valueOf(r.sequence()), r.sourceTypeLabel(),
                    r.occurredAt() + " · " + r.summary(), r.originLabel()});
        }
        drawTablePages("증빙자료 목록", new String[]{"순번", "자료 유형", "확인된 일시 · 요약", "원본"}, PAGE4_WEIGHTS, data, footer);
    }

    byte[] build() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        document.save(out);
        return out.toByteArray();
    }

    @Override
    public void close() throws IOException {
        document.close();
    }

    /**
     * 표가 한 페이지에 다 안 들어가면 이어서 새 페이지에 헤더를 다시 그리고 계속한다 — 종전엔 행이
     * 많으면(예: 타임라인 30행 이상) 페이지 아래로 넘쳐 안 보이는 카드가 있었다(2026-08-26 발견).
     */
    private void drawTablePages(String title, String[] header, float[] weights, List<String[]> rows, String footer)
            throws IOException {
        float rowH = 22;
        float bottomLimit = MARGIN + FOOTER_RESERVED;
        int index = 0;
        int pageNum = 0;
        do {
            pageNum++;
            try (var page = newPage()) {
                PDPageContentStream cs = page.stream();
                PdfTextWriter w = page.writer();
                float left = MARGIN, right = PAGE_WIDTH - MARGIN;
                float y = PAGE_HEIGHT - MARGIN;
                y = w.drawLine(pageNum == 1 ? title : title + " (이어서)", MARGIN, y);
                y -= 15;
                y = drawHeaderRow(cs, w, left, y, right, rowH, weights, header);
                while (index < rows.size() && y - rowH > bottomLimit) {
                    y = drawWeightedRow(cs, w, left, y, right, rowH, weights, rows.get(index));
                    index++;
                }
                drawHLine(cs, left, right, y);
                drawFooter(cs, w, footer);
            }
        } while (index < rows.size());
    }

    private void drawFooter(PDPageContentStream cs, PdfTextWriter w, String footer) throws IOException {
        w.drawLine(footer, MARGIN, MARGIN - 20);
    }

    /** 헤더 행에 옅은 회색 배경을 깔아 데이터 행과 구분한다(나눔고딕엔 볼드가 없어 음영으로 대신한다). */
    private float drawHeaderRow(PDPageContentStream cs, PdfTextWriter w, float left, float y, float right,
                                 float rowH, float[] weights, String[] values) throws IOException {
        cs.setNonStrokingColor(HEADER_GRAY, HEADER_GRAY, HEADER_GRAY);
        cs.addRect(left, y - rowH, right - left, rowH);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);
        return drawWeightedRow(cs, w, left, y, right, rowH, weights, values);
    }

    /** 열 너비를 weights 비율로 나누고, 각 행마다 사방 테두리(가로 위·세로 칸 구분선)를 그려 실제 표처럼 보이게 한다. */
    private float drawWeightedRow(PDPageContentStream cs, PdfTextWriter w, float left, float y, float right,
                                   float rowH, float[] weights, String[] values) throws IOException {
        drawHLine(cs, left, right, y);
        float tableWidth = right - left;
        float x = left;
        for (int i = 0; i < weights.length; i++) {
            float colWidth = tableWidth * weights[i];
            drawVLine(cs, x, y, y - rowH);
            w.drawLine(fitToWidth(values[i], colWidth - 8), x + 4, y - rowH + 8);
            x += colWidth;
        }
        drawVLine(cs, right, y, y - rowH);
        return y - rowH;
    }

    private void drawHLine(PDPageContentStream cs, float left, float right, float y) throws IOException {
        cs.setLineWidth(0.5f);
        cs.moveTo(left, y);
        cs.lineTo(right, y);
        cs.stroke();
    }

    private void drawVLine(PDPageContentStream cs, float x, float yTop, float yBottom) throws IOException {
        cs.setLineWidth(0.5f);
        cs.moveTo(x, yTop);
        cs.lineTo(x, yBottom);
        cs.stroke();
    }

    /** 서식이 이미 인쇄해 둔 자리(작성일자·수신처)를 지우고 실제 값을 다시 쓸 때만 쓴다. */
    private void whiteOut(PDPageContentStream cs, float x, float y, float width, float height) throws IOException {
        cs.setNonStrokingColor(1f, 1f, 1f);
        cs.addRect(x, y, width, height);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);
    }

    private void drawValue(PdfTextWriter w, float x, float y, String value) throws IOException {
        if (value == null || value.isBlank()) return;
        w.drawLine(value, x, y);
    }

    private String truncate(String text, int maxChars) {
        if (text == null) return "";
        return text.length() <= maxChars ? text : text.substring(0, maxChars - 1) + "…";
    }

    /** 실제 폰트 폭으로 측정해 maxWidth를 넘기 직전까지 자르고 말줄임표를 붙인다. */
    private String fitToWidth(String text, float maxWidth) throws IOException {
        if (text == null) return "";
        if (stringWidth(text) <= maxWidth) return text;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            String candidate = sb.toString() + text.charAt(i) + "…";
            if (stringWidth(candidate) > maxWidth) break;
            sb.append(text.charAt(i));
        }
        return sb + "…";
    }

    private float stringWidth(String text) throws IOException {
        return font.getStringWidth(text) / 1000 * 10; // 표 폰트 크기 10pt (PdfTextWriter와 동일)
    }

    private PageContext newPage() throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        PDPageContentStream cs = new PDPageContentStream(document, page);
        return new PageContext(cs, new PdfTextWriter(cs, font, 10));
    }

    /** 페이지 하나의 스트림 + 텍스트 라이터를 묶어 try-with-resources로 스트림을 확실히 닫는다. */
    private record PageContext(PDPageContentStream stream, PdfTextWriter writer) implements AutoCloseable {
        @Override
        public void close() throws IOException {
            stream.close();
        }
    }
}
