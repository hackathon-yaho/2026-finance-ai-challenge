package com.haebing.backend.health.service;

public interface HealthService {

    /**
     * F11-01 — 단순 상태 반환이 아니라 DB에 실제로 쓴다.
     * keepalive에 행을 하나 남기고 7일이 지난 행은 지운다. 실패하면 예외가 그대로 올라간다.
     */
    void ping();
}
