package com.haebing.backend.ai.config;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** docs/request/backend/h2c-upgrade-breaks-ai-call.md 검증용 — 실제 소켓으로 h2c 업그레이드 헤더가 안 나가는지 확인한다. */
class AiServerConfigH2cVerifyTest {

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void extractRestClient_doesNotSendH2cUpgradeHeader_plaintextHttp() throws IOException {
        AtomicReference<Map<String, String>> capturedHeaders = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/extract", exchange -> {
            Map<String, String> snapshot = new LinkedHashMap<>();
            exchange.getRequestHeaders().forEach((k, v) -> snapshot.put(k, String.join(",", v)));
            capturedHeaders.set(snapshot);
            byte[] body = "{\"cards\":[],\"signals\":{\"threat_detected\":false,\"delivery_evidence\":false,\"life_activity\":false,\"quality_flags\":{\"blurry\":false,\"missing_date\":false,\"amount_mismatch\":false}},\"qualityFlags\":{}}".getBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        int port = server.getAddress().getPort();

        AiServerConfig config = new AiServerConfig();
        RestClient client = config.extractRestClient("http://127.0.0.1:" + port);

        String response = client.post()
                .uri("/internal/extract")
                .header("Content-Type", "application/json")
                .body("{\"rawText\":\"테스트\"}")
                .retrieve()
                .body(String.class);

        Map<String, String> headers = capturedHeaders.get();
        System.out.println(">>> [검증] 캡처된 요청 헤더 수: " + (headers == null ? "null" : headers.size()));
        if (headers != null) headers.forEach((k, v) -> System.out.println(">>> [검증]   " + k + ": " + v));
        System.out.println(">>> [검증] 응답 본문 도착: " + response);

        assertThat(headers).isNotNull();
        assertThat(headers.keySet()).anySatisfy(k -> assertThat(k).isEqualToIgnoringCase("Host")); // 정상 요청이면 반드시 있어야 함
        assertThat(headers).doesNotContainKey("Upgrade");
        assertThat(headers).doesNotContainKey("Http2-settings");
        assertThat(response).contains("\"cards\"");
    }
}
