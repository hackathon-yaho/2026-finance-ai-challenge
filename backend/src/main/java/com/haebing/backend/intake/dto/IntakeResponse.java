package com.haebing.backend.intake.dto;

public record IntakeResponse(boolean ok, int nextStage, DeadlineResponse deadline) {
}
