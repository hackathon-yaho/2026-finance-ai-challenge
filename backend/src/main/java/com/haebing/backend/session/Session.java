package com.haebing.backend.session;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
    private final Map<String, Boolean> cardConfirmed = new ConcurrentHashMap<>();
    private final Map<String, Boolean> selfHeldItems = new ConcurrentHashMap<>();
    private final List<SentenceEvidence> sentenceEvidence = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final Map<String, QualityFlags> qualityFlags = new ConcurrentHashMap<>();

    @Setter
    private volatile Signals signals;
    @Setter
    private volatile Readiness readiness;
    @Setter
    private volatile String draftText;

    public Session(String hash, Instant expiresAt) {
        this.hash = hash;
        this.expiresAt = expiresAt;
    }

    /** F2-03 — 문진이 바뀌면 하위 단계 결과를 무효화한다. */
    public void invalidateDownstream() {
        this.readiness = null;
        this.draftText = null;
    }
}
