package com.memory.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public final class MethodDtos {

    private MethodDtos() {
    }

    public record PlanItemRequest(Long methodId, String customName,
                                  @Min(1) @Max(7) Integer targetDays) {
    }

    public record CreatePlanRequest(@NotNull LocalDate weekStart, @NotNull List<PlanItemRequest> items,
                                    String note) {
    }

    public record ScoreRequest(@NotNull Long itemId, @NotNull LocalDate date,
                               @NotNull @Min(1) @Max(5) Integer score,
                               String note, @Min(0) Integer durationMin) {
    }

    public record DecisionRequest(@NotNull Long itemId, @NotNull String decision) {
    }

    public record ReviewRequest(@NotNull Long planId, List<DecisionRequest> decisions, String note) {
    }
}
