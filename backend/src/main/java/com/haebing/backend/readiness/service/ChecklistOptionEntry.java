package com.haebing.backend.readiness.service;

import java.util.List;

public record ChecklistOptionEntry(String id, String label, List<String> sources) {
}
