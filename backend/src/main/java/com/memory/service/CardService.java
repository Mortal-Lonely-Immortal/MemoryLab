package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.memory.common.BizException;
import com.memory.common.PageResult;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.mapper.CardMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class CardService {

    private final CardMapper cardMapper;

    public PageResult<Views.CardView> page(long page, long size, Long deckId, String keyword, Integer state) {
        LambdaQueryWrapper<Card> q = new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .orderByDesc(Card::getId);
        if (deckId != null) {
            q.eq(Card::getDeckId, deckId);
        }
        if (state != null) {
            q.eq(Card::getState, state);
        }
        if (StringUtils.hasText(keyword)) {
            q.and(w -> w.like(Card::getFront, keyword).or().like(Card::getBack, keyword));
        }
        Page<Card> p = cardMapper.selectPage(new Page<>(page, size), q);
        return PageResult.of(p.getTotal(), p.getCurrent(), p.getSize(),
                p.getRecords().stream().map(CardService::toView).toList());
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
                c.getSuspended(), c.getLeech());
    }
}
