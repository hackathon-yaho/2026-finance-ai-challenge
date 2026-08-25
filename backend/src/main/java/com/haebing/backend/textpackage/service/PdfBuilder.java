package com.haebing.backend.textpackage.service;

import com.haebing.backend.textpackage.dto.Account;
import com.haebing.backend.textpackage.dto.Applicant;
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
import java.util.List;

/**
 * docs/backend/phase-5-draft-package.md 5-4. 표지 + 1~4면을 만든다. 5면(원본 이미지)은 프론트가 만든다(F7-06).
 * 조판 완성도보다 "한글이 정상 렌더되는 PDF"(완료 기준)를 우선한다 — 서식 재디자인은 하지 않되,
 * 원본 스캔 위에 겹치는 대신 같은 표 구조를 새로 그린다(안내 문서 "레이아웃 재디자인 금지"는
 * 칸 구성·순서를 그대로 두라는 취지로 해석했다 — 스캔 오버레이는 좌표 보정 없이는 더 위험하다).
 */
class PdfBuilder implements AutoCloseable {

    private static final float MARGIN = 50;
    private static final float PAGE_WIDTH = PDRectangle.A4.getWidth();
    private static final float PAGE_HEIGHT = PDRectangle.A4.getHeight();
    private static final float CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

    private final PDDocument document = new PDDocument();
    private final PDFont font;

    PdfBuilder() throws IOException {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("fonts/NanumGothic-Regular.ttf")) {
            if (is == null) throw new IOException("나눔고딕 폰트를 찾을 수 없습니다 (fonts/NanumGothic-Regular.ttf)");
            this.font = PDType0Font.load(document, is);
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

    /** docs/00-context/법정서식-별지제4호서식-안내.md "서식 실물 구성"을 그대로 옮긴다. */
    void addPage1(Applicant applicant, Account account, LocalDate downloadDate) throws IOException {
        Applicant a = applicant != null ? applicant : new Applicant(null, null, null, null, null, null);
        Account acc = account != null ? account : new Account(null, null, null, null, null);

        try (var page = newPage()) {
            var cs = page.stream();
            var w = page.writer();
            float y = PAGE_HEIGHT - MARGIN;
            y = w.drawLine("이의제기신청서", MARGIN, y);
            y -= 10;

            float tableTop = y;
            float left = MARGIN;
            float right = PAGE_WIDTH - MARGIN;
            float rowH = 26;
            String[][] rows = {
                    {"접수번호", "", "접수일자", ""},
                    {"성명", nz(a.name()), "생년월일", nz(a.birthDate())},
                    {"주소", nz(a.address())},
                    {"전화번호", nz(a.phone()), "휴대전화번호", nz(a.mobile()), "전자우편주소", nz(a.email())},
                    {"금융회사", nz(acc.bank()), "개설점포", nz(acc.branch()), "예금종별", nz(acc.depositType())},
                    {"계좌번호", nz(acc.accountNumber()), "명의인", nz(acc.holderName())},
            };

            float rowY = tableTop;
            for (String[] row : rows) {
                drawTableRow(cs, w, left, rowY, right, rowH, row);
                rowY -= rowH;
            }
            drawHLine(cs, left, right, rowY);

            y = rowY - 40;
            y = w.drawParagraph(
                    "「전기통신금융사기 피해 방지 및 피해금 환급에 관한 특별법」 제7조제1항 및 같은 법 시행령 제7조에 따라 "
                            + "본인의 계좌에 대한 지급정지, 전자금융거래 제한 또는 채권소멸절차에 대하여 위와 같이 이의제기를 신청합니다.",
                    left, y, CONTENT_WIDTH);
            y -= 30;
            y = w.drawLine("작성일자: " + downloadDate, left, y);
            y -= 10;
            y = w.drawLine("신청인  성 명                              (서명 또는 인)", left, y);
            y -= 40;
            String bank = (acc.bank() == null || acc.bank().isBlank()) ? "○○○ 금융회사" : acc.bank();
            w.drawLine(bank + "  귀하", left, y);
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
            drawFooter(page.stream(), w, footer);
        }
    }

    private static final float[] PAGE3_WEIGHTS = {0.22f, 0.13f, 0.65f};
    private static final float[] PAGE4_WEIGHTS = {0.08f, 0.14f, 0.58f, 0.20f};

    void addPage3(List<TimelineRow> rows, String footer) throws IOException {
        try (var page = newPage()) {
            var cs = page.stream();
            var w = page.writer();
            float y = PAGE_HEIGHT - MARGIN;
            y = w.drawLine("시간순 거래 타임라인", MARGIN, y);
            y -= 15;
            float left = MARGIN, right = PAGE_WIDTH - MARGIN, rowH = 22;
            y = drawWeightedRow(cs, w, left, y, right, rowH, PAGE3_WEIGHTS, new String[]{"일시", "행위 주체", "요약 · 금액"});
            for (TimelineRow r : rows) {
                y = drawWeightedRow(cs, w, left, y, right, rowH, PAGE3_WEIGHTS,
                        new String[]{r.occurredAt(), r.actor(), r.summary() + " · " + r.amountText()});
            }
            drawHLine(cs, left, right, y);
            drawFooter(cs, w, footer);
        }
    }

    void addPage4(List<EvidenceRow> rows, String footer) throws IOException {
        try (var page = newPage()) {
            var cs = page.stream();
            var w = page.writer();
            float y = PAGE_HEIGHT - MARGIN;
            y = w.drawLine("증빙자료 목록", MARGIN, y);
            y -= 15;
            float left = MARGIN, right = PAGE_WIDTH - MARGIN, rowH = 22;
            y = drawWeightedRow(cs, w, left, y, right, rowH, PAGE4_WEIGHTS,
                    new String[]{"순번", "자료 유형", "확인된 일시 · 요약", "원본"});
            for (EvidenceRow r : rows) {
                y = drawWeightedRow(cs, w, left, y, right, rowH, PAGE4_WEIGHTS,
                        new String[]{String.valueOf(r.sequence()), r.sourceTypeLabel(),
                                r.occurredAt() + " · " + r.summary(), r.originLabel()});
            }
            drawHLine(cs, left, right, y);
            drawFooter(cs, w, footer);
        }
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

    private void drawFooter(PDPageContentStream cs, PdfTextWriter w, String footer) throws IOException {
        w.drawLine(footer, MARGIN, MARGIN - 20);
    }

    private void drawTableRow(PDPageContentStream cs, PdfTextWriter w, float left, float y, float right, float rowH,
                               String[] labelValuePairs) throws IOException {
        drawHLine(cs, left, right, y);
        int cols = labelValuePairs.length / 2;
        float colWidth = (right - left) / Math.max(cols, 1);
        for (int i = 0; i < cols; i++) {
            float x = left + i * colWidth;
            String label = labelValuePairs[i * 2];
            String value = labelValuePairs[i * 2 + 1];
            String text = value == null || value.isEmpty() ? label : label + ": " + value;
            w.drawLine(truncate(text, 24), x + 4, y - rowH + 8);
        }
    }

    /** 열 너비를 weights 비율로 나누고, 실제 픽셀 폭으로 잘라 넣는다(고정 글자수 자르기는 좁은 열엔 너무 길고 넓은 열은 낭비였다). */
    private float drawWeightedRow(PDPageContentStream cs, PdfTextWriter w, float left, float y, float right,
                                   float rowH, float[] weights, String[] values) throws IOException {
        drawHLine(cs, left, right, y);
        float tableWidth = right - left;
        float x = left;
        for (int i = 0; i < weights.length; i++) {
            float colWidth = tableWidth * weights[i];
            w.drawLine(fitToWidth(values[i], colWidth - 8), x + 4, y - rowH + 8);
            x += colWidth;
        }
        return y - rowH;
    }

    private void drawHLine(PDPageContentStream cs, float left, float right, float y) throws IOException {
        cs.setLineWidth(0.5f);
        cs.moveTo(left, y);
        cs.lineTo(right, y);
        cs.stroke();
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

    private String nz(String value) {
        return value == null ? "" : value;
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
