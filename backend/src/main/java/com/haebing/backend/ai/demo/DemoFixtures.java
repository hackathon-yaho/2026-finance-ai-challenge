package com.haebing.backend.ai.demo;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.haebing.backend.ai.dto.DraftResult;
import com.haebing.backend.ai.dto.DraftSentence;
import com.haebing.backend.ai.dto.EvidenceRef;
import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.QualityFlags;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /**
     * 2026-08-26 프론트 로컬 연동 회신(demo-mode-fixture-ids.md) — 픽스처 파일의 event_id는 그 파일이
     * 만들어질 당시의 시나리오 번호를 그대로 담고 있어, 여러 장을 올리면(예: imageIndex 0·1·2) 서로 다른
     * 픽스처 파일이 같은 event_id("evt_0_1" 등)를 재사용해 충돌한다 — 충돌하면 뒤에 온 카드가 앞 카드를
     * 덮어써 확인할 방법이 없는 카드가 세션에 남고, 그 카드가 저신뢰면 게이팅에 영원히 걸린다.
     * 그래서 반환 직전에 실제 imageIndex 기준으로 event_id·source_image_index를 다시 매긴다 —
     * 픽스처 파일 자체는 AI 담당 납품물이라 손대지 않는다(갱신 때마다 다시 어긋나는 것을 피하려고).
     */
    public ExtractResult extractForImage(int imageIndex) {
        ExtractResult fixture = extractFixtures.get(Math.floorMod(imageIndex, extractFixtures.size()));
        return remapIds(fixture, imageIndex, "evt_" + imageIndex + "_");
    }

    /** 텍스트 입력은 이미지가 없으므로 source_image_index를 null로 고정하고, 별도 접두사로 충돌을 피한다. */
    public ExtractResult extractForText() {
        return remapIds(extractFixtures.get(0), null, "evt_text_");
    }

    /**
     * 소명서 픽스처는 세션 상태와 무관하게 고정 응답이라, evidenceRefs가 가리키는 imageIndex가 실제로
     * 이 세션에서 올린 이미지 범위를 벗어날 수 있다("원본 4번"인데 3장만 올린 경우). 범위를 벗어난
     * evidence 참조는 "본인 진술"(user_text)로 내려 원본 이동 배지가 없는 이미지를 가리키지 않게 한다.
     */
    public DraftResult draft(Set<Integer> validImageIndices) {
        List<DraftSentence> remapped = draftFixture.sentences().stream()
                .map(s -> remapSentence(s, validImageIndices))
                .toList();
        return new DraftResult(draftFixture.draftText(), remapped, draftFixture.factCheckPassed());
    }

    private ExtractResult remapIds(ExtractResult fixture, Integer imageIndex, String idPrefix) {
        Map<String, String> idRemap = new HashMap<>();
        List<ExtractedEvent> remappedCards = new ArrayList<>();
        int seq = 1;
        for (ExtractedEvent card : fixture.cards()) {
            String newId = idPrefix + (seq++);
            idRemap.put(card.eventId(), newId);
            remappedCards.add(new ExtractedEvent(newId, imageIndex, card.sourceType(), card.occurredAt(), card.actor(),
                    card.summary(), card.amount(), card.counterpartyName(), card.payerName(), card.recurrence(),
                    card.identifiers(), card.fieldConfidence(), card.sourceRegion(), card.confirmationStatus()));
        }
        Map<String, QualityFlags> remappedFlags = new LinkedHashMap<>();
        fixture.qualityFlags().forEach((oldId, flags) -> remappedFlags.put(idRemap.getOrDefault(oldId, oldId), flags));
        return new ExtractResult(remappedCards, fixture.signals(), remappedFlags);
    }

    private DraftSentence remapSentence(DraftSentence sentence, Set<Integer> validImageIndices) {
        if (sentence.evidenceRefs() == null) return sentence;
        List<EvidenceRef> remappedRefs = sentence.evidenceRefs().stream()
                .map(ref -> remapRef(ref, validImageIndices))
                .toList();
        return new DraftSentence(sentence.sentenceId(), sentence.text(), remappedRefs);
    }

    private EvidenceRef remapRef(EvidenceRef ref, Set<Integer> validImageIndices) {
        if (!EvidenceRef.TYPE_EVIDENCE.equals(ref.type())) return ref; // intake/user_text는 원래 이미지 참조가 없다
        if (ref.imageIndex() != null && validImageIndices.contains(ref.imageIndex())) return ref;
        return new EvidenceRef(EvidenceRef.TYPE_USER_TEXT, null, null);
    }

    private <T> T read(ObjectMapper objectMapper, String filename, Class<T> type) {
        try {
            return objectMapper.readValue(new ClassPathResource("demo/" + filename).getInputStream(), type);
        } catch (IOException e) {
            throw new IllegalStateException("데모 응답 파일을 읽을 수 없습니다: " + filename, e);
        }
    }
}
