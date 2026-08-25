package com.haebing.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class HaebingApplication {

    public static void main(String[] args) {
        SpringApplication.run(HaebingApplication.class, args);
    }
}
