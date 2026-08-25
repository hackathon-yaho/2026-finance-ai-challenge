package com.haebing.backend.textpackage.service;

import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * PDFBox는 자동 줄바꿈을 지원하지 않는다 — 한글 문단을 최대 너비에 맞춰 직접 감싼다.
 * 완벽한 조판이 목표가 아니라, "한글이 정상 렌더되는 PDF"(완료 기준)를 만드는 최소 도구다.
 */
class PdfTextWriter {

    private final PDPageContentStream stream;
    private final PDFont font;
    private final float fontSize;
    private final float leading;

    PdfTextWriter(PDPageContentStream stream, PDFont font, float fontSize) {
        this.stream = stream;
        this.font = font;
        this.fontSize = fontSize;
        this.leading = fontSize * 1.5f;
    }

    /** 한 줄을 지정 좌표에 쓴다. */
    float drawLine(String text, float x, float y) throws IOException {
        stream.beginText();
        stream.setFont(font, fontSize);
        stream.newLineAtOffset(x, y);
        stream.showText(text == null ? "" : text);
        stream.endText();
        return y - leading;
    }

    /** 문단을 maxWidth에 맞춰 줄바꿈하며 쓴다. 다음 줄을 시작할 y좌표를 반환한다. */
    float drawParagraph(String text, float x, float y, float maxWidth) throws IOException {
        for (String line : wrap(text == null ? "" : text, maxWidth)) {
            y = drawLine(line, x, y);
        }
        return y;
    }

    private List<String> wrap(String text, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        for (String paragraph : text.split("\n", -1)) {
            StringBuilder current = new StringBuilder();
            for (int i = 0; i < paragraph.length(); i++) {
                char c = paragraph.charAt(i);
                current.append(c);
                if (width(current.toString()) > maxWidth) {
                    current.deleteCharAt(current.length() - 1);
                    lines.add(current.toString());
                    current = new StringBuilder().append(c);
                }
            }
            lines.add(current.toString());
        }
        return lines;
    }

    private float width(String text) throws IOException {
        return font.getStringWidth(text) / 1000 * fontSize;
    }
}
