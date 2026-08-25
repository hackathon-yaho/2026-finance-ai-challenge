package com.haebing.backend.evidence.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** docs/backend/phase-3-evidence-timeline.md 단위 테스트 — 매직바이트 위조. */
class FileValidatorTest {

    private final FileValidator validator = new FileValidator();

    @Test
    void hasAllowedExtension_acceptsJpgJpegPng() {
        assertThat(validator.hasAllowedExtension("photo.png")).isTrue();
        assertThat(validator.hasAllowedExtension("photo.JPG")).isTrue();
        assertThat(validator.hasAllowedExtension("photo.jpeg")).isTrue();
        assertThat(validator.hasAllowedExtension("photo.gif")).isFalse();
        assertThat(validator.hasAllowedExtension("photo")).isFalse();
        assertThat(validator.hasAllowedExtension(null)).isFalse();
    }

    @Test
    void detectContentType_realPng_returnsImagePng() {
        byte[] pngHeader = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A};
        assertThat(validator.detectContentType(pngHeader)).isEqualTo("image/png");
    }

    @Test
    void detectContentType_realJpeg_returnsImageJpeg() {
        byte[] jpegHeader = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
        assertThat(validator.detectContentType(jpegHeader)).isEqualTo("image/jpeg");
    }

    @Test
    void detectContentType_forgedExtension_realBytesAreNotImage_returnsNull() {
        // 확장자는 .png지만 실제로는 텍스트 파일인 경우 — F3-02 수용 기준
        byte[] textBytes = "this is not an image".getBytes();
        assertThat(validator.detectContentType(textBytes)).isNull();
    }

    @Test
    void detectContentType_emptyBytes_returnsNull() {
        assertThat(validator.detectContentType(new byte[0])).isNull();
    }
}
