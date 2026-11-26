package com.memory.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class Dtos {

    private Dtos() {
    }

    public record DeckRequest(@NotBlank String name, String description, Long parentId) {
    }

    public record NoteRequest(@NotNull Long deckId, @NotBlank String title, String contentMd,
                              String source, String chapter) {
    }

    public record CardRequest(@NotNull Long deckId, Long noteId, String cardType,
                              @NotBlank String front, @NotBlank String back, String extra) {
    }

    public record CardBatchDelete(java.util.List<Long> ids) {
    }

    public record CardFilter(Long bookId, Long deckId, String keyword, Integer state,
                             Boolean favorite, Boolean wrong) {
    }

    public record ReviewRequest(@NotNull @Min(1) @Max(4) Integer rating,
                                Integer durationMs, String clientReqId) {
    }

    public record SettingsRequest(Integer dailyNewLimit, Integer dailyReviewLimit,
                                  Double desiredRetention) {
    }
}
