package com.memory.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class Views {

    private Views() {
    }

    public record UserView(Long id, String nickname, String timezone,
                           Integer dailyNewLimit, Integer dailyReviewLimit, Double desiredRetention) {
    }

    public record DeckView(Long id, Long parentId, String name, String description, Integer cardCount) {
    }

    public record NoteView(Long id, Long deckId, String title, String contentMd, String source, String chapter) {
    }

    public record CardView(Long id, Long noteId, Long deckId, String cardType, String front, String back,
                           String extra, Integer state, LocalDateTime dueDate, Double stability,
                           Double difficulty, Integer reps, Integer lapses, Integer suspended, Integer leech,
                           Integer favorite, Integer wrong, Integer wrongCount, LocalDateTime lastWrongAt) {
    }

    public record PreviewView(int rating, int days, String label, LocalDateTime dueDate) {
    }

    public record QueueItem(CardView card, List<PreviewView> previews) {
    }

    public record ReviewResult(Long cardId, Integer state, LocalDateTime dueDate, Integer scheduledDays,
                               List<PreviewView> previews) {
    }

    public record CollectionSummary(long favorites, long wrong) {
    }

    public record Overview(long todayDue, long todayNew, long todayReviewed, double retention7d,
                           int streak, long totalCards, long matureCards) {
    }

    public record HeatmapItem(LocalDate date, int count) {
    }

    public record ForecastItem(LocalDate date, long count) {
    }

    public record DailyPoint(LocalDate date, int newCount, int reviewCount, double retention) {
    }

    public record StateCount(int state, long count) {
    }

    public record ImportResult(Long jobId, String status, int totalNotes, int totalCards,
                               int createdCards, int skippedCards, String message) {
    }
}
