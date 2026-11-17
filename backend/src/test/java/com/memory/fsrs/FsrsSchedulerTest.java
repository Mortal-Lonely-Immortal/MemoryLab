package com.memory.fsrs;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FsrsSchedulerTest {

    private final FsrsScheduler scheduler = new FsrsScheduler();
    private final LocalDateTime now = LocalDateTime.of(2026, 1, 1, 9, 0);

    private FsrsScheduler.Snapshot newCard() {
        return new FsrsScheduler.Snapshot(0, 0, 0, 0, 0, null, now, 0, 0);
    }

    @Test
    void newCardGoodShouldScheduleTwoDays() {
        FsrsScheduler.Outcome o = scheduler.review(newCard(), 3, now);
        assertEquals(FsrsScheduler.REVIEW, o.state());
        assertEquals(2.4, o.stability(), 1e-9);
        assertEquals(4.93, o.difficulty(), 1e-9);
        assertEquals(2, o.scheduledDays());
        assertEquals(now.plusDays(2), o.dueDate());
    }

    @Test
    void newCardAgainShouldEnterLearningForTenMinutes() {
        FsrsScheduler.Outcome o = scheduler.review(newCard(), 1, now);
        assertEquals(FsrsScheduler.LEARNING, o.state());
        assertEquals(0.4, o.stability(), 1e-9);
        assertEquals(0, o.scheduledDays());
        assertEquals(now.plusMinutes(10), o.dueDate());
        assertEquals(1, o.lapses());
    }

    @Test
    void retrievabilityAtStabilityShouldBeNinetyPercent() {
        assertEquals(0.9, scheduler.retrievability(30, 30), 1e-9);
        assertEquals(1.0, scheduler.retrievability(0, 30), 1e-9);
    }

    @Test
    void intervalAtNinetyPercentEqualsStability() {
        assertEquals(1, scheduler.intervalDays(0.6));
        assertEquals(2, scheduler.intervalDays(2.4));
        assertEquals(6, scheduler.intervalDays(5.8));
        assertEquals(30, scheduler.intervalDays(30));
    }

    @Test
    void previewShouldOfferFourIncreasingIntervals() {
        List<FsrsScheduler.Preview> preview = scheduler.preview(newCard(), now);
        assertEquals(4, preview.size());
        assertEquals("10 分钟", preview.get(0).label());
        assertTrue(preview.get(1).days() <= preview.get(2).days());
        assertTrue(preview.get(2).days() <= preview.get(3).days());
    }

    @Test
    void successfulReviewShouldGrowStability() {
        FsrsScheduler.Snapshot s = new FsrsScheduler.Snapshot(
                FsrsScheduler.REVIEW, 10.0, 5.0, 3, 0, now.minusDays(10), now, 10, 10);
        FsrsScheduler.Outcome o = scheduler.review(s, 3, now);
        assertEquals(FsrsScheduler.REVIEW, o.state());
        assertTrue(o.stability() > 10.0, "stability should grow after a successful review");
        assertTrue(o.dueDate().isAfter(now));
    }

    @Test
    void lapseShouldEnterRelearningAndNotIncreaseStability() {
        FsrsScheduler.Snapshot s = new FsrsScheduler.Snapshot(
                FsrsScheduler.REVIEW, 20.0, 5.0, 5, 0, now.minusDays(20), now, 20, 20);
        FsrsScheduler.Outcome o = scheduler.review(s, 1, now);
        assertEquals(FsrsScheduler.RELEARNING, o.state());
        assertTrue(o.stability() <= 20.0);
        assertEquals(now.plusMinutes(10), o.dueDate());
        assertEquals(Duration.ofMinutes(10), Duration.between(now, o.dueDate()));
        assertEquals(1, o.lapses());
    }
}
