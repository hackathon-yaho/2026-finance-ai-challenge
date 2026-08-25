package com.haebing.backend.readiness.dto;

import java.util.List;

public record SelfHeldResponse(List<ChecklistItem> checklist) {
}
