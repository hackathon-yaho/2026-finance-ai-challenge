package com.haebing.backend.stats.service;

import com.haebing.backend.session.Session;

/** docs/backend/phase-6-infra-ops.md 6-2. 익명 통계 적재 — 실패해도 서비스 동작에 영향을 주지 않는다. */
public interface StatsService {

    /** 세션이 처음 이 단계에 도달했을 때만 stage_event(complete)를 적재한다. */
    void recordStageComplete(Session session, int stage);

    /** TTL 만료로 세션이 파기될 때, 마지막으로 도달한 단계를 abandon으로 적재한다. */
    void recordAbandon(Session session);

    /** 세션 종료(명시적 파기 또는 TTL 만료) 시 session_stat 1행을 적재한다. */
    void recordSessionEnd(Session session);
}
