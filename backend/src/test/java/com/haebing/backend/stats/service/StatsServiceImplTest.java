package com.haebing.backend.stats.service;

import com.haebing.backend.session.Readiness;
import com.haebing.backend.session.Session;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class StatsServiceImplTest {

    @Test
    void recordStageComplete_firstTime_insertsAndAdvancesLastStage() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        Session session = new Session("abc", Instant.now());

        new StatsServiceImpl(dataSource).recordStageComplete(session, 2);

        verify(statement).setString(1, "abc");
        verify(statement).setInt(2, 2);
        verify(statement).setString(3, "complete");
        verify(statement).executeUpdate();
        org.assertj.core.api.Assertions.assertThat(session.getLastStage()).isEqualTo(2);
    }

    @Test
    void recordStageComplete_alreadyReached_doesNotInsertAgain() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Session session = new Session("abc", Instant.now());
        session.setLastStage(3);

        new StatsServiceImpl(dataSource).recordStageComplete(session, 2);

        verifyNoInteractions(dataSource);
    }

    @Test
    void recordAbandon_neverReachedAnyStage_doesNotInsert() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Session session = new Session("abc", Instant.now());

        new StatsServiceImpl(dataSource).recordAbandon(session);

        verifyNoInteractions(dataSource);
    }

    @Test
    void recordSessionEnd_readsIntakeAndReadinessOntoRow() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        Session session = new Session("abc", Instant.now());
        session.getIntake().put("kind", "goods");
        session.setReadiness(new Readiness(null, "SUBMISSION_READY"));
        session.setLastStage(5);

        new StatsServiceImpl(dataSource).recordSessionEnd(session);

        verify(statement).setString(3, "goods");
        verify(statement).setString(4, "SUBMISSION_READY");
        verify(statement).setBoolean(6, true);
        verify(statement).executeUpdate();
    }

    @Test
    void sqlExceptionDuringInsert_isSwallowed() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));
        Session session = new Session("abc", Instant.now());

        org.assertj.core.api.Assertions.assertThatCode(() -> new StatsServiceImpl(dataSource).recordStageComplete(session, 1))
                .doesNotThrowAnyException();
    }
}
