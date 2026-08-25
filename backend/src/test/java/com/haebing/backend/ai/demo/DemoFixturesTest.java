package com.haebing.backend.ai.demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.haebing.backend.ai.dto.DraftSentence;
import com.haebing.backend.ai.dto.EvidenceRef;
import com.haebing.backend.ai.dto.ExtractResult;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** docs/request/backend/demo-mode-fixture-ids.md — event_id 충돌 + source_image_index 불일치 회귀 방지. */
class DemoFixturesTest {

    private final DemoFixtures fixtures = new DemoFixtures(new ObjectMapper());

    @Test
    void extractForImage_reassignsSourceImageIndexToTheRequestedOne() {
        ExtractResult result = fixtures.extractForImage(4);

        assertThat(result.cards()).isNotEmpty();
        assertThat(result.cards()).allSatisfy(card -> assertThat(card.sourceImageIndex()).isEqualTo(4));
    }

    @Test
    void extractForImage_eventIdsAreUniqueAcrossMultipleCalls() {
        // §1 — 서로 다른 이미지 3장이 각자 다른 픽스처 파일을 타도, 합친 event_id는 전부 달라야 한다.
        Set<String> allIds = new HashSet<>();
        int totalCards = 0;
        for (int imageIndex = 0; imageIndex <= 2; imageIndex++) {
            List<com.haebing.backend.session.ExtractedEvent> cards = fixtures.extractForImage(imageIndex).cards();
            totalCards += cards.size();
            cards.forEach(c -> allIds.add(c.eventId()));
        }

        assertThat(allIds).hasSize(totalCards); // 충돌이 있었다면 고유 id 수가 카드 수보다 적었을 것이다
    }

    @Test
    void extractForImage_qualityFlagsKeysStayInSyncWithRemappedEventIds() {
        ExtractResult result = fixtures.extractForImage(2);

        Set<String> cardIds = new HashSet<>(result.cards().stream().map(c -> c.eventId()).toList());
        assertThat(result.qualityFlags().keySet()).isEqualTo(cardIds);
    }

    @Test
    void extractForText_hasNullSourceImageIndexAndDistinctIdPrefix() {
        ExtractResult result = fixtures.extractForText();

        assertThat(result.cards()).allSatisfy(card -> {
            assertThat(card.sourceImageIndex()).isNull();
            assertThat(card.eventId()).startsWith("evt_text_");
        });
    }

    @Test
    void draft_evidenceRefOutOfValidImageRange_downgradesToUserText() {
        // §3 — 세션에 이미지가 1장(index 0)뿐인데 픽스처가 imageIndex 1~3을 참조하면 user_text로 내린다.
        var result = fixtures.draft(Set.of(0));

        List<EvidenceRef> allRefs = result.sentences().stream()
                .flatMap(s -> s.evidenceRefs() == null ? java.util.stream.Stream.empty() : s.evidenceRefs().stream())
                .toList();
        assertThat(allRefs).isNotEmpty();
        for (EvidenceRef ref : allRefs) {
            if (EvidenceRef.TYPE_EVIDENCE.equals(ref.type())) {
                assertThat(ref.imageIndex()).isEqualTo(0);
            } else {
                assertThat(ref.type()).isEqualTo(EvidenceRef.TYPE_USER_TEXT);
                assertThat(ref.imageIndex()).isNull();
            }
        }
    }

    @Test
    void draft_allImagesValid_keepsOriginalEvidenceRefs() {
        var result = fixtures.draft(Set.of(0, 1, 2, 3));

        List<DraftSentence> sentences = result.sentences();
        assertThat(sentences).isNotEmpty();
        long evidenceRefCount = sentences.stream()
                .flatMap(s -> s.evidenceRefs().stream())
                .filter(r -> EvidenceRef.TYPE_EVIDENCE.equals(r.type()))
                .count();
        assertThat(evidenceRefCount).isGreaterThan(0);
    }
}
