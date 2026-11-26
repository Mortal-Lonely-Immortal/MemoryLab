package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memory.common.BizException;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.DailyStat;
import com.memory.entity.Deck;
import com.memory.entity.ReviewLog;
import com.memory.entity.SysUser;
import com.memory.fsrs.FsrsScheduler;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DailyStatMapper;
import com.memory.mapper.DeckMapper;
import com.memory.mapper.ReviewLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final CardMapper cardMapper;
    private final ReviewLogMapper reviewLogMapper;
    private final DailyStatMapper dailyStatMapper;
    private final DeckMapper deckMapper;
    private final FsrsService fsrsService;
    private final SettingsService settingsService;

    public List<Views.QueueItem> queue(int limit, String mode) {
        SysUser user = settingsService.user();
        LocalDateTime now = LocalDateTime.now();
        int want = Math.max(1, Math.min(limit, 200));

        List<Card> due = "new".equalsIgnoreCase(mode)
                ? List.of()
                : cardMapper.selectList(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .ne(Card::getState, 0)
                .eq(Card::getSuspended, 0)
                .le(Card::getDueDate, now)
                .orderByAsc(Card::getDueDate)
                .last("limit " + Math.min(want, user.getDailyReviewLimit())));

        List<Card> fresh = "due".equalsIgnoreCase(mode)
                ? List.of()
                : newCards(user, want);

        Map<Long, Deque<Card>> byDeck = new LinkedHashMap<>();
        for (Card c : due) {
            byDeck.computeIfAbsent(c.getDeckId(), k -> new ArrayDeque<>()).addLast(c);
        }
        for (Card c : fresh) {
            byDeck.computeIfAbsent(c.getDeckId(), k -> new ArrayDeque<>()).addLast(c);
        }

        List<Card> mixed = new ArrayList<>();
        boolean added = true;
        while (mixed.size() < want && added) {
            added = false;
            for (Deque<Card> dq : byDeck.values()) {
                if (!dq.isEmpty() && mixed.size() < want) {
                    mixed.add(dq.pollFirst());
                    added = true;
                }
            }
        }

        List<Views.QueueItem> out = new ArrayList<>(mixed.size());
        for (Card c : mixed) {
            out.add(new Views.QueueItem(CardService.toView(c), fsrsService.preview(c)));
        }
        return out;
    }

    private List<Card> newCards(SysUser user, int want) {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        long learnedToday = reviewLogMapper.selectCount(new LambdaQueryWrapper<ReviewLog>()
                .eq(ReviewLog::getUserId, 1L)
                .eq(ReviewLog::getStateBefore, 0)
                .ge(ReviewLog::getReviewedAt, todayStart));
        long quota = Math.max(0, user.getDailyNewLimit() - learnedToday);
        if (quota == 0) {
            return List.of();
        }
        int n = (int) Math.min(Math.min(quota, want), user.getDailyNewLimit());
        List<Deck> decks = deckMapper.selectList(new LambdaQueryWrapper<Deck>()
                .eq(Deck::getUserId, 1L)
                .orderByDesc(Deck::getParentId)
                .orderByAsc(Deck::getSortOrder)
                .orderByAsc(Deck::getId));
        Map<Long, Deque<Card>> byDeck = new LinkedHashMap<>();
        for (Deck d : decks) {
            List<Card> cards = cardMapper.selectList(new LambdaQueryWrapper<Card>()
                    .eq(Card::getUserId, 1L)
                    .eq(Card::getDeckId, d.getId())
                    .eq(Card::getState, 0)
                    .eq(Card::getSuspended, 0)
                    .orderByAsc(Card::getId)
                    .last("limit " + n));
            if (!cards.isEmpty()) {
                byDeck.put(d.getId(), new ArrayDeque<>(cards));
            }
        }

        List<Card> out = new ArrayList<>(n);
        boolean added = true;
        while (out.size() < n && added) {
            added = false;
            for (Deque<Card> dq : byDeck.values()) {
                if (!dq.isEmpty() && out.size() < n) {
                    out.add(dq.pollFirst());
                    added = true;
                }
            }
        }
        return out;
    }

    @Transactional
    public Views.ReviewResult review(Long cardId, Dtos.ReviewRequest req) {
        Card card = cardMapper.selectById(cardId);
        if (card == null) {
            throw new BizException(404, "卡片不存在");
        }
        LocalDateTime now = LocalDateTime.now();

        if (req.clientReqId() != null && !req.clientReqId().isBlank()) {
            ReviewLog exists = reviewLogMapper.selectOne(new LambdaQueryWrapper<ReviewLog>()
                    .eq(ReviewLog::getUserId, 1L)
                    .eq(ReviewLog::getClientReqId, req.clientReqId())
                    .last("limit 1"));
            if (exists != null) {
                return new Views.ReviewResult(card.getId(), card.getState(), card.getDueDate(),
                        card.getScheduledDays(), fsrsService.preview(card));
            }
        }

        int prevState = card.getState() == null ? 0 : card.getState();
        double prevS = card.getStability() == null ? 0 : card.getStability();
        double prevD = card.getDifficulty() == null ? 0 : card.getDifficulty();

        FsrsScheduler.Outcome o = fsrsService.apply(card, req.rating());

        card.setState(o.state());
        card.setStability(o.stability());
        card.setDifficulty(o.difficulty());
        card.setDueDate(o.dueDate());
        card.setLastReview(now);
        card.setReps(o.reps());
        card.setLapses(o.lapses());
        card.setScheduledDays(o.scheduledDays());
        card.setElapsedDays(o.elapsedDays());
        card.setVersion((card.getVersion() == null ? 0 : card.getVersion()) + 1);
        if (req.rating() <= 2) {
            card.setWrong(1);
            card.setWrongCount((card.getWrongCount() == null ? 0 : card.getWrongCount()) + 1);
            card.setLastWrongAt(now);
        } else {
            card.setWrong(0);
        }
        if (o.lapses() >= 4) {
            card.setLeech(1);
        }
        cardMapper.updateById(card);

        ReviewLog log = new ReviewLog();
        log.setUserId(1L);
        log.setCardId(card.getId());
        log.setRating(req.rating());
        log.setStateBefore(prevState);
        log.setStateAfter(o.state());
        log.setStabilityBefore(prevS);
        log.setStabilityAfter(o.stability());
        log.setDifficultyBefore(prevD);
        log.setDifficultyAfter(o.difficulty());
        log.setElapsedDays(o.elapsedDays());
        log.setScheduledDays(o.scheduledDays());
        log.setReviewDurationMs(req.durationMs() == null ? 0 : Math.max(0, req.durationMs()));
        log.setReviewedAt(now);
        log.setClientReqId(req.clientReqId());
        reviewLogMapper.insert(log);

        updateDailyStat(prevState, req.rating(), log.getReviewDurationMs(), now.toLocalDate());

        return new Views.ReviewResult(card.getId(), card.getState(), card.getDueDate(),
                card.getScheduledDays(), fsrsService.preview(card));
    }

    private void updateDailyStat(int prevState, int rating, int durationMs, LocalDate date) {
        DailyStat stat = dailyStatMapper.selectOne(new LambdaQueryWrapper<DailyStat>()
                .eq(DailyStat::getUserId, 1L)
                .eq(DailyStat::getStatDate, date)
                .last("limit 1"));
        if (stat == null) {
            stat = new DailyStat();
            stat.setUserId(1L);
            stat.setStatDate(date);
            stat.setNewCount(0);
            stat.setReviewCount(0);
            stat.setAgainCount(0);
            stat.setHardCount(0);
            stat.setGoodCount(0);
            stat.setEasyCount(0);
            stat.setRetention(0.0);
            stat.setStudyMs(0L);
            stat.setDueCount(0);
        }
        if (prevState == 0) {
            stat.setNewCount(stat.getNewCount() + 1);
        }
        stat.setReviewCount(stat.getReviewCount() + 1);
        switch (rating) {
            case 1 -> stat.setAgainCount(stat.getAgainCount() + 1);
            case 2 -> stat.setHardCount(stat.getHardCount() + 1);
            case 3 -> stat.setGoodCount(stat.getGoodCount() + 1);
            case 4 -> stat.setEasyCount(stat.getEasyCount() + 1);
            default -> {
            }
        }
        int total = stat.getAgainCount() + stat.getHardCount() + stat.getGoodCount() + stat.getEasyCount();
        int passed = stat.getHardCount() + stat.getGoodCount() + stat.getEasyCount();
        stat.setRetention(total == 0 ? 0.0 : (double) passed / total);
        stat.setStudyMs(stat.getStudyMs() + durationMs);
        if (stat.getId() == null) {
            dailyStatMapper.insert(stat);
        } else {
            dailyStatMapper.updateById(stat);
        }
    }
}
