package com.haebing.backend.evidence.validation;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/** docs/backend/phase-3-evidence-timeline.md 3-2 "파일 검증 (F3-02)" — 확장자 화이트리스트 + 매직바이트. */
@Component
public class FileValidator {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png");

    /** 확장자가 화이트리스트에 있는지. */
    public boolean hasAllowedExtension(String filename) {
        if (filename == null) return false;
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return false;
        String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        return ALLOWED_EXTENSIONS.contains(ext);
    }

    /**
     * 실제 매직바이트로 판별한 Content-Type. 확장자를 위조해도 이 값이 실제 포맷이다.
     * PNG/JPEG가 아니면 null (F3-02 수용 기준 — 위조 파일 거부).
     */
    public String detectContentType(byte[] bytes) {
        if (bytes.length >= 4
                && bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes.length >= 3
                && bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return "image/jpeg";
        }
        return null;
    }
}
