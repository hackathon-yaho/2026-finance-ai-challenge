package com.haebing.backend.health.service;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class HealthServiceImplTest {

    @Test
    void ping_insertsAndPurgesKeepaliveRows() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        new HealthServiceImpl(dataSource).ping();

        verify(statement).execute("insert into keepalive default values");
        verify(statement).execute("delete from keepalive where pinged_at < now() - interval '7 days'");
        verify(connection).close();
    }

    @Test
    void ping_wrapsSqlExceptionAsIllegalState() throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));

        assertThatThrownBy(() -> new HealthServiceImpl(dataSource).ping())
                .isInstanceOf(IllegalStateException.class)
                .hasCauseInstanceOf(SQLException.class);
    }
}
