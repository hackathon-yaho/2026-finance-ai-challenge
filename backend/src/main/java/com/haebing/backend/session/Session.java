package com.haebing.backend.session;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * docs/02-architecture/data-model.md "인메모리 세션". DB에 쓰지 않는다.
 * 30분 TTL(무활동 기준)이 있어 expiresAt이 요청마다 갱신되고, 문진 변경 시 readiness/draftText가
 * 초기화된다(F2-03) — 둘 다 값 교체가 필요해 record가 아닌 가변 클래스로 둔다.
 */
@Getter
public class Session {

    private final String hash;
    @Setter
    private volatile Instant expiresAt;

    private final Map<String, String> intake = new ConcurrentHashMap<>();
    private final List<ExtractedEvent> timeline = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final List<MergeCandidate> mergeCandidates = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final Set<String> rejectedMergeGroupIds = java.util.concurrent.ConcurrentHashMap.newKeySet();
    /** F5-02 승인된 병합에서 대표 카드에 흡수된 나머지 카드 — 출처 보존을 위해 timeline에서 지우지 않고 타임라인 표시에서만 뺀다. */
    private final Set<String> mergedAwayEventIds = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final Map<String, Boolean> cardConfirmed = new ConcurrentHashMap<>();
    private final Map<String, Boolean> selfHeldItems = new ConcurrentHashMap<>();
    private final List<SentenceEvidence> sentenceEvidence = new java.util.concurrent.CopyOnWriteArrayList<>();
    /** 문장 텍스트·제외 여부의 현재 상태. `/api/draft`가 새로 채우고 `/api/draft/revise`가 갱신한다. */
    private final List<StoredSentence> sentences = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final Map<String, QualityFlags> qualityFlags = new ConcurrentHashMap<>();

    /** F3-02 — 세션당 누적 10장 제한. 검증 통과한 이미지마다 1씩 늘린다 (추출 성공 여부와 무관). */
    private final AtomicInteger uploadedImageCount = new AtomicInteger(0);

    @Setter
    private volatile Signals signals;
    @Setter
    private volatile Readiness readiness;
    @Setter
    private volatile String draftText;
    /** F11-02 — session_stat/stage_event 적재용. 세션이 도달한 마지막 단계(1~5), 아직 없으면 0. */
    @Setter
    private volatile int lastStage = 0;

    public Session(String hash, Instant expiresAt) {
        this.hash = hash;
        this.expiresAt = expiresAt;
        this.signals = Signals.empty();
    }

    /** F2-03 — 문진이 바뀌면 하위 단계 결과를 무효화한다. */
    public void invalidateDownstream() {
        this.readiness = null;
        this.draftText = null;
    }

    /**
     * event_id 중복은 백엔드가 처리한다 (2026-08-25 확정) — 같은 event_id가 이미 있으면 기존 카드를 대체한다.
     * AI-server는 무상태라 같은 image_index로 재추출하면 ID가 충돌할 수 있다.
     */
    public void upsertCard(ExtractedEvent card) {
        for (int i = 0; i < timeline.size(); i++) {
            if (timeline.get(i).eventId().equals(card.eventId())) {
                timeline.set(i, card);
                return;
            }
        }
        timeline.add(card);
    }

    public java.util.Optional<ExtractedEvent> findCard(String eventId) {
        return timeline.stream().filter(c -> c.eventId().equals(eventId)).findFirst();
    }

    public void removeCard(String eventId) {
        timeline.removeIf(c -> c.eventId().equals(eventId));
    }

    /** 새 소명서를 받으면 이전 문장·근거를 전부 교체한다. */
    public void replaceSentences(List<StoredSentence> newSentences, List<SentenceEvidence> newEvidence) {
        sentences.clear();
        sentences.addAll(newSentences);
        sentenceEvidence.clear();
        sentenceEvidence.addAll(newEvidence);
    }

    public java.util.Optional<StoredSentence> findSentence(String sentenceId) {
        return sentences.stream().filter(s -> s.sentenceId().equals(sentenceId)).findFirst();
    }

    public void updateSentence(StoredSentence updated) {
        for (int i = 0; i < sentences.size(); i++) {
            if (sentences.get(i).sentenceId().equals(updated.sentenceId())) {
                sentences.set(i, updated);
                return;
            }
        }
    }

    public void replaceSentenceEvidence(String sentenceId, List<SentenceEvidence> refs) {
        sentenceEvidence.removeIf(e -> e.sentenceId().equals(sentenceId));
        sentenceEvidence.addAll(refs);
    }
}
