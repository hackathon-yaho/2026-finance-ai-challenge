package com.haebing.backend.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** docs/02-architecture/internal-api-contract.md "타임아웃 및 재시도" — /internal/extract는 20초. */
@Configuration
public class AiServerConfig {

    @Bean
    public RestClient extractRestClient(@Value("${app.ai-server-url:}") String aiServerUrl) {
        ClientHttpRequestFactory factory = ClientHttpRequestFactoryBuilder.detect()
                .build(ClientHttpRequestFactorySettings.defaults()
                        .withConnectTimeout(Duration.ofSeconds(20))
                        .withReadTimeout(Duration.ofSeconds(20)));
        return RestClient.builder()
                .baseUrl(aiServerUrl)
                .requestFactory(factory)
                .build();
    }
}
