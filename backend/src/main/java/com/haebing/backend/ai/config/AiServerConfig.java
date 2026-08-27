package com.haebing.backend.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/** docs/02-architecture/internal-api-contract.md "타임아웃 및 재시도" — /internal/extract는 20초. */
@Configuration
public class AiServerConfig {

    @Bean
    public RestClient extractRestClient(@Value("${app.ai-server-url:}") String aiServerUrl) {
        return buildClient(aiServerUrl, Duration.ofSeconds(20));
    }

    /**
     * docs/02-architecture/internal-api-contract.md "타임아웃 및 재시도" — /internal/draft는 30초
     * (2026-08-27 AI 회신, draft-timeout-needs-headroom.md: AI-server 1회 시도 상한 25초 + 여유).
     */
    @Bean
    public RestClient draftRestClient(@Value("${app.ai-server-url:}") String aiServerUrl) {
        return buildClient(aiServerUrl, Duration.ofSeconds(30));
    }

    /**
     * docs/request/backend/h2c-upgrade-breaks-ai-call.md — {@code detect()}가 고르는 JDK
     * {@link HttpClient}는 평문 HTTP에서도 h2c(HTTP/2 cleartext) 업그레이드를 시도한다. uvicorn은
     * h2c를 지원하지 않아 {@code Unsupported upgrade request}를 남기고, 그 과정에서 요청 본문이
     * 애플리케이션까지 아예 도달하지 않는다({@code DEMO_MODE=true}에서는 이 경로 자체를 안 타 드러나지
     * 않았다). {@code spring.http.client.factory} 설정으로는 바뀌지 않아({@code detect()}가 이 값을
     * 보지 않음), 클라이언트를 HTTP/1.1로 직접 고정한다. 내부 호출은 한 홉이라 HTTP/2로 얻을 것이 없다.
     */
    private RestClient buildClient(String aiServerUrl, Duration timeout) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(timeout)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(timeout);

        return RestClient.builder()
                .baseUrl(aiServerUrl)
                .requestFactory(factory)
                .build();
    }
}
