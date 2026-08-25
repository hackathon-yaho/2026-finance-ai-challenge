package com.haebing.backend.stats.service;

import com.haebing.backend.session.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * docs/backend/phase-6-infra-ops.md 6-2. session_stat/stage_event에 raw JDBC로 적재한다
 * (data-model.md 스키마를 db/migration.sql로만 관리하므로 JPA 엔티티를 따로 두지 않는다 — HealthServiceImpl과 같은 방식).
 * 개인 식별 정보(이미지·텍스트·소명서 본문)는 어떤 컬럼에도 넣지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsServiceImpl implements StatsService {

    private final DataSource dataSource;

    @Override
    public void recordStageComplete(Session session, int stage) {
        if (session.getLastStage() >= stage) return; // F11-02 — 같은 단계를 두 번 적재하지 않는다(재호출·재추출 대비)
        session.setLastStage(stage);
        insert("insert into stage_event (session_hash, stage, event) values (?, ?, ?)",
                ps -> {
                    ps.setString(1, session.getHash());
                    ps.setInt(2, stage);
                    ps.setString(3, "complete");
                }, "stage_event(complete)");
    }

    @Override
    public void recordAbandon(Session session) {
        if (session.getLastStage() <= 0) return; // 아무 단계도 완료하지 못한 세션은 잡음이라 적재하지 않는다
        insert("insert into stage_event (session_hash, stage, event) values (?, ?, ?)",
                ps -> {
                    ps.setString(1, session.getHash());
                    ps.setInt(2, session.getLastStage());
                    ps.setString(3, "abandon");
                }, "stage_event(abandon)");
    }

    @Override
    public void recordSessionEnd(Session session) {
        String reasonType = session.getIntake().get("kind");
        String readiness = session.getReadiness() == null ? null : session.getReadiness().readiness();
        int evidenceCnt = session.getUploadedImageCount().get();
        boolean completed = session.getLastStage() >= 5;

        insert("insert into session_stat (session_hash, last_stage, reason_type, readiness, evidence_cnt, completed) " +
                        "values (?, ?, ?, ?, ?, ?)",
                ps -> {
                    ps.setString(1, session.getHash());
                    ps.setInt(2, session.getLastStage());
                    ps.setString(3, reasonType);
                    ps.setString(4, readiness);
                    ps.setInt(5, evidenceCnt);
                    ps.setBoolean(6, completed);
                }, "session_stat");
    }

    private void insert(String sql, SqlBinder binder, String label) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            binder.bind(statement);
            statement.executeUpdate();
        } catch (SQLException e) {
            // 통계 적재 실패가 서비스 흐름을 막아서는 안 된다 (spec.md §6 외부 연동 명세).
            log.warn("[StatsService] {} 적재 실패 — 무시하고 계속 진행", label, e);
        }
    }

    @FunctionalInterface
    private interface SqlBinder {
        void bind(PreparedStatement statement) throws SQLException;
    }
}
