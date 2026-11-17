package com.memory.fsrs;

import com.memory.entity.Card;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * FSRS v4.5 scheduler. Pure functions, no Spring dependency.
 * Formulas: https://open-spaced-repetition.github.io/ts-fsrs/guide/model/fsrs-4dot5
 */
public final class FsrsScheduler {

    public static final int NEW = 0;
    public static final int LEARNING = 1;
    public static final int REVIEW = 2;
    public static final int RELEARNING = 3;

    public static final double[] DEFAULT_W = {
            0.4, 0.6, 2.4, 5.8,
            4.93, 0.94, 0.86, 0.01,
            1.49, 0.14, 0.94,
            2.18, 0.05, 0.34, 1.26,
            0.29, 2.61
    };

    private static final double MIN_S = 0.1;
    private static final double MAX_S = 36500.0;
    private static final double MIN_D = 1.0;
    private static final double MAX_D = 10.0;
    private static final double F = 19.0 / 81.0;

    private final double[] w;
    private final double retention;
    private final int maxIntervalDays;

    public FsrsScheduler() {
        this(DEFAULT_W, 0.9, 36500);
    }

    public FsrsScheduler(double[] weights, double retention, int maxIntervalDays) {
        if (weights == null || weights.length < 17) {
            throw new IllegalArgumentException("FSRS v4.5 needs 17 weights");
        }
        this.w = weights.clone();
        this.retention = retention;
        this.maxIntervalDays = maxIntervalDays;
    }

    public record Snapshot(int state, double stability, double difficulty, int reps, int lapses,
                           LocalDateTime lastReview, LocalDateTime dueDate,
                           int scheduledDays, int elapsedDays) {
        public static Snapshot of(Card c) {
            return new Snapshot(
                    c.getState() == null ? NEW : c.getState(),
                    c.getStability() == null ? 0 : c.getStability(),
                    c.getDifficulty() == null ? 0 : c.getDifficulty(),
                    c.getReps() == null ? 0 : c.getReps(),
                    c.getLapses() == null ? 0 : c.getLapses(),
                    c.getLastReview(), c.getDueDate(),
                    c.getScheduledDays() == null ? 0 : c.getScheduledDays(),
                    c.getElapsedDays() == null ? 0 : c.getElapsedDays());
        }
    }

    public record Outcome(int state, double stability, double difficulty, int reps, int lapses,
                          LocalDateTime dueDate, int scheduledDays, int elapsedDays) {
    }

    public record Preview(int rating, int days, LocalDateTime dueDate, String label) {
    }

    public Outcome review(Snapshot s, int rating, LocalDateTime now) {
        checkRating(rating);
        int state = s.state();
        double stability = clamp(s.stability(), MIN_S, MAX_S);
        double difficulty = clamp(s.difficulty(), MIN_D, MAX_D);

        if (state == NEW) {
            double s0 = clamp(w[rating - 1], MIN_S, MAX_S);
            double d0 = clamp(w[4] - (rating - 3) * w[5], MIN_D, MAX_D);
            if (rating == 1) {
                return new Outcome(LEARNING, s0, d0, 1, 1, now.plusMinutes(10), 0, 0);
            }
            int days = intervalDays(s0);
            return new Outcome(REVIEW, s0, d0, 1, 0, now.plusDays(days), days, 0);
        }

        if (state == LEARNING || state == RELEARNING) {
            if (rating == 1) {
                int lapses = s.lapses() + (state == RELEARNING ? 1 : 0);
                return new Outcome(state, stability, difficulty, s.reps(), lapses, now.plusMinutes(10), 0,
                        s.elapsedDays());
            }
            double s0 = clamp(w[rating - 1], MIN_S, MAX_S);
            double sNew = Math.max(stability, s0);
            double dNow = clamp(difficulty - w[6] * (rating - 3), MIN_D, MAX_D);
            double dNew = clamp(w[7] * w[4] + (1 - w[7]) * dNow, MIN_D, MAX_D);
            int days = intervalDays(sNew);
            return new Outcome(REVIEW, sNew, dNew, s.reps() + 1, s.lapses(), now.plusDays(days), days,
                    s.elapsedDays());
        }

        double elapsed = elapsedDays(s.lastReview(), now);
        double r = retrievability(elapsed, stability);
        double dNow = clamp(difficulty - w[6] * (rating - 3), MIN_D, MAX_D);
        double dNew = clamp(w[7] * w[4] + (1 - w[7]) * dNow, MIN_D, MAX_D);

        if (rating == 1) {
            double sf = w[11] * Math.pow(difficulty, -w[12])
                    * (Math.pow(stability + 1, w[13]) - 1)
                    * Math.exp(w[14] * (1 - r));
            double sNew = clamp(Math.min(sf, stability), MIN_S, MAX_S);
            return new Outcome(RELEARNING, sNew, dNew, s.reps(), s.lapses() + 1,
                    now.plusMinutes(10), 0, (int) Math.floor(elapsed));
        }

        double hg = rating == 2 ? w[15] : 1.0;
        double eg = rating == 4 ? w[16] : 1.0;
        double growth = Math.exp(w[8]) * (11 - difficulty) * Math.pow(stability, -w[9])
                * (Math.exp(w[10] * (1 - r)) - 1) * hg * eg;
        double sNew = clamp(stability * (1 + growth), MIN_S, MAX_S);
        int days = intervalDays(sNew);
        return new Outcome(REVIEW, sNew, dNew, s.reps() + 1, s.lapses(),
                now.plusDays(days), days, (int) Math.floor(elapsed));
    }

    public List<Preview> preview(Snapshot s, LocalDateTime now) {
        List<Preview> out = new ArrayList<>(4);
        for (int rating = 1; rating <= 4; rating++) {
            Outcome o = review(s, rating, now);
            int days = o.scheduledDays();
            out.add(new Preview(rating, days, o.dueDate(), label(days)));
        }
        return out;
    }

    public double retrievability(double elapsedDays, double stability) {
        if (stability <= 0) {
            return 0;
        }
        return Math.pow(1 + F * Math.max(0, elapsedDays) / stability, -0.5);
    }

    public int intervalDays(double stability) {
        double days = stability * (81.0 / 19.0) * (Math.pow(retention, -2) - 1);
        long rounded = Math.round(days);
        if (rounded < 1) {
            rounded = 1;
        }
        if (rounded > maxIntervalDays) {
            rounded = maxIntervalDays;
        }
        return (int) rounded;
    }

    private static String label(int days) {
        if (days <= 0) {
            return "10 分钟";
        }
        if (days == 1) {
            return "1 天";
        }
        if (days < 30) {
            return days + " 天";
        }
        if (days < 365) {
            return Math.round(days / 30.0) + " 个月";
        }
        return Math.round(days / 365.0) + " 年";
    }

    private static double elapsedDays(LocalDateTime lastReview, LocalDateTime now) {
        if (lastReview == null) {
            return 0;
        }
        long minutes = Duration.between(lastReview, now).toMinutes();
        return Math.max(0, minutes / 1440.0);
    }

    private static void checkRating(int rating) {
        if (rating < 1 || rating > 4) {
            throw new IllegalArgumentException("rating must be 1..4");
        }
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
