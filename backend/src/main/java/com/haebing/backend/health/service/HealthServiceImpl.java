package com.haebing.backend.health.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

@Service
@RequiredArgsConstructor
public class HealthServiceImpl implements HealthService {

    private final DataSource dataSource;

    @Override
    public void ping() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("insert into keepalive default values");
            statement.execute("delete from keepalive where pinged_at < now() - interval '7 days'");
        } catch (SQLException e) {
            throw new IllegalStateException("DB 헬스체크 실패", e);
        }
    }
}
