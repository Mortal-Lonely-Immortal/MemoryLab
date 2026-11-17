package com.memory.dto;

import java.time.LocalDate;
import java.util.List;

public final class MethodViews {

    private MethodViews() {
    }

    public record MethodView(Long id, String name, String category, String description,
                             String evidenceLevel, String source, boolean builtin) {
    }

    public record LogView(LocalDate date, Integer score, String note, Integer durationMin) {
    }

    public record PlanItemView(Long id, Long methodId, String name, String category, String description,
                               String evidenceLevel, Integer targetDays, Double avgScore, String decision,
                               Integer todayScore, int daysScored, List<LogView> logs) {
    }

    public record PlanView(Long id, LocalDate weekStart, LocalDate weekEnd, String status, String note,
                           List<PlanItemView> items, Double weekAvg, int daysScored) {
    }
}
