package com.haebing.backend.ai.demo;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.haebing.backend.ai.dto.DraftResult;
import com.haebing.backend.ai.dto.ExtractResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

/**
 * docs/backend/phase-6-infra-ops.md 6-1. DEMO_MODE=true일 때 AI-server를 호출하지 않고
 * ai-server/demo/(→ src/main/resources/demo/)의 고정 응답을 반환한다 — 네트워크 경로 자체를 타지 않는다.
 * TC 매핑은 백엔드 재량이라 imageIndex를 6개 추출 픽스처에 순환 배정한다.
 */
@Slf4j
@Component
public class DemoFixtures {

    private static final String[] EXTRACT_FILES = {
            "extract-tc01.json", "extract-tc02.json", "extract-tc03.json",
            "extract-tc04.json", "extract-tc05.json", "extract-tc06.json"
    };
    private static final String DRAFT_FILE = "draft-tc01.json";

    private final List<ExtractResult> extractFixtures;
    private final DraftResult draftFixture;

    public DemoFixtures(ObjectMapper objectMapper) {
        // 픽스처엔 계약 확장분(checklist 등)이 앞서 반영돼 있어, 공유 빈을 건드리지 않는 사본으로 관대하게 읽는다.
        ObjectMapper lenient = objectMapper.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.extractFixtures = java.util.Arrays.stream(EXTRACT_FILES)
                .map(f -> read(lenient, f, ExtractResult.class))
                .toList();
        this.draftFixture = read(lenient, DRAFT_FILE, DraftResult.class);
        log.info("[DemoFixtures] 데모 응답 {}건 로딩 완료", extractFixtures.size() + 1);
    }

    public ExtractResult extractForImage(int imageIndex) {
        return extractFixtures.get(Math.floorMod(imageIndex, extractFixtures.size()));
    }

    public ExtractResult extractForText() {
        return extractFixtures.get(0);
    }

    public DraftResult draft() {
        return draftFixture;
    }

    private <T> T read(ObjectMapper objectMapper, String filename, Class<T> type) {
        try {
            return objectMapper.readValue(new ClassPathResource("demo/" + filename).getInputStream(), type);
        } catch (IOException e) {
            throw new IllegalStateException("데모 응답 파일을 읽을 수 없습니다: " + filename, e);
        }
    }
}
