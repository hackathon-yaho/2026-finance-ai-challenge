package com.haebing.backend.common.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * docs/02-architecture/api-contract.md "CORS 허용 origin·헤더" 절.
 * 쿠키를 쓰지 않으므로 allowCredentials는 켜지 않는다. 와일드카드 origin은 쓰지 않는다.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Session-Hash")
                .allowCredentials(false);
    }
}
