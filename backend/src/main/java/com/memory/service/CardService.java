package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.memory.common.BizException;
import com.memory.common.PageResult;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.Deck;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DeckMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CardService {

    private final CardMapper cardMapper;
    private final DeckMapper deckMapper;
    private final CardClassificationService classificationService;

    public PageResult<Views.CardView> page(long page, long size, Long bookId, Long deckId, String keyword,
                                            Integer state, Boolean favorite, Boolean wrong) {
        LambdaQueryWrapper<Card> q = filterQuery(bookId, deckId, keyword, state, favorite, wrong)
                .orderByDesc(Card::getId);
        Page<Card> p = cardMapper.selectPage(new Page<>(page, size), q);
        return PageResult.of(p.getTotal(), p.getCurrent(), p.getSize(),
                p.getRecords().stream().map(CardService::toView).toList());
    }

    @Transactional
    public int deleteBatch(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        return cardMapper.delete(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .in(Card::getId, ids));
    }

    @Transactional
    public int deleteByFilter(Dtos.CardFilter filter) {
        LambdaQueryWrapper<Card> q = filterQuery(filter.bookId(), filter.deckId(), filter.keyword(),
                filter.state(), filter.favorite(), filter.wrong());
        return cardMapper.delete(q);
    }

    @Transactional
    public int reclassify() {
        return classificationService.classifyAll();
    }

    private LambdaQueryWrapper<Card> filterQuery(Long bookId, Long deckId, String keyword, Integer state,
                                                  Boolean favorite, Boolean wrong) {
        LambdaQueryWrapper<Card> q = new LambdaQueryWrapper<Card>().eq(Card::getUserId, 1L);
        if (bookId != null) {
            List<Long> deckIds = deckIdsForBook(bookId);
            if (deckIds.isEmpty()) {
                q.eq(Card::getId, -1L);
            } else {
                q.in(Card::getDeckId, deckIds);
            }
        }
        if (deckId != null) {
            q.eq(Card::getDeckId, deckId);
        }
        if (state != null) {
            q.eq(Card::getState, state);
        }
        if (favorite != null) {
            q.eq(Card::getFavorite, favorite ? 1 : 0);
        }
        if (wrong != null) {
            q.eq(Card::getWrong, wrong ? 1 : 0);
        }
        if (StringUtils.hasText(keyword)) {
            q.and(w -> w.like(Card::getFront, keyword).or().like(Card::getBack, keyword));
        }
        return q;
    }

    private List<Long> deckIdsForBook(Long bookId) {
        List<Deck> children = deckMapper.selectList(new LambdaQueryWrapper<Deck>()
                .eq(Deck::getUserId, 1L)
                .eq(Deck::getParentId, bookId));
        List<Long> ids = new java.util.ArrayList<>();
        ids.add(bookId);
        for (Deck d : children) {
            ids.add(d.getId());
        }
        return ids;
    }

    public Views.CardView get(Long id) {
        return toView(require(id));
    }

    @Transactional
    public Views.CardView create(Dtos.CardRequest req) {
        Card c = new Card();
        c.setUserId(1L);
        c.setDeckId(req.deckId());
        c.setNoteId(req.noteId());
        c.setCardType(req.cardType() == null ? "QA" : req.cardType());
        c.setFront(req.front().trim());
        c.setBack(req.back().trim());
        c.setExtra(req.extra());
        c.setState(0);
        c.setDueDate(LocalDateTime.now());
        c.setStability(0.0);
        c.setDifficulty(0.0);
        c.setElapsedDays(0);
        c.setScheduledDays(0);
        c.setReps(0);
        c.setLapses(0);
        c.setLearningStep(0);
        c.setSuspended(0);
        c.setLeech(0);
        c.setFavorite(0);
        c.setWrong(0);
        c.setWrongCount(0);
        c.setVersion(0);
        cardMapper.insert(c);
        return toView(c);
    }

    @Transactional
    public Views.CardView update(Long id, Dtos.CardRequest req) {
        Card c = require(id);
        c.setDeckId(req.deckId());
        c.setNoteId(req.noteId());
        if (req.cardType() != null) {
            c.setCardType(req.cardType());
        }
        c.setFront(req.front().trim());
        c.setBack(req.back().trim());
        c.setExtra(req.extra());
        cardMapper.updateById(c);
        return toView(c);
    }

    @Transactional
    public void delete(Long id) {
        cardMapper.deleteById(id);
    }

    @Transactional
    public Views.CardView favorite(Long id, boolean favorite) {
        Card c = require(id);
        c.setFavorite(favorite ? 1 : 0);
        cardMapper.updateById(c);
        return toView(c);
    }

    public List<Card> collection(Boolean favorite, Boolean wrong, int limit) {
        LambdaQueryWrapper<Card> q = new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .orderByDesc(Card::getLastWrongAt)
                .orderByDesc(Card::getId)
                .last("limit " + Math.max(1, Math.min(limit, 500)));
        if (favorite != null) q.eq(Card::getFavorite, favorite ? 1 : 0);
        if (wrong != null) q.eq(Card::getWrong, wrong ? 1 : 0);
        return cardMapper.selectList(q);
    }

    public Views.CollectionSummary collectionSummary() {
        long favorites = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L).eq(Card::getFavorite, 1));
        long wrong = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L).eq(Card::getWrong, 1));
        return new Views.CollectionSummary(favorites, wrong);
    }

    @Transactional
    public Views.CardView suspend(Long id, boolean suspend) {
        Card c = require(id);
        c.setSuspended(suspend ? 1 : 0);
        cardMapper.updateById(c);
        return toView(c);
    }

    public Card require(Long id) {
        Card c = cardMapper.selectById(id);
        if (c == null) {
            throw new BizException(404, "卡片不存在");
        }
        return c;
    }

    public static Views.CardView toView(Card c) {
        return new Views.CardView(c.getId(), c.getNoteId(), c.getDeckId(), c.getCardType(),
                c.getFront(), c.getBack(), c.getExtra(), c.getState(), c.getDueDate(),
                c.getStability(), c.getDifficulty(), c.getReps(), c.getLapses(),
                c.getSuspended(), c.getLeech(), c.getFavorite(), c.getWrong(),
                c.getWrongCount(), c.getLastWrongAt());
    }
}
