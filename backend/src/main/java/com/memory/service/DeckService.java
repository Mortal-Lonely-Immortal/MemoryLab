package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memory.common.BizException;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.Deck;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DeckMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DeckService {

    private final DeckMapper deckMapper;
    private final CardMapper cardMapper;

    public List<Views.DeckView> list() {
        List<Deck> decks = deckMapper.selectList(new LambdaQueryWrapper<Deck>()
                .eq(Deck::getUserId, 1L)
                .orderByAsc(Deck::getSortOrder)
                .orderByAsc(Deck::getId));
        List<Views.DeckView> out = new ArrayList<>(decks.size());
        for (Deck d : decks) {
            long count = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                    .eq(Card::getUserId, 1L)
                    .eq(Card::getDeckId, d.getId())
                    .eq(Card::getSuspended, 0));
            out.add(new Views.DeckView(d.getId(), d.getParentId(), d.getName(), d.getDescription(), (int) count));
        }
        return out;
    }

    @Transactional
    public Views.DeckView create(Dtos.DeckRequest req) {
        Deck d = new Deck();
        d.setUserId(1L);
        d.setParentId(req.parentId() == null ? 0L : req.parentId());
        d.setName(req.name().trim());
        d.setDescription(req.description());
        d.setSortOrder(0);
        d.setCardCount(0);
        deckMapper.insert(d);
        return new Views.DeckView(d.getId(), d.getParentId(), d.getName(), d.getDescription(), 0);
    }

    @Transactional
    public Views.DeckView update(Long id, Dtos.DeckRequest req) {
        Deck d = deckMapper.selectById(id);
        if (d == null) {
            throw new BizException(404, "卡组不存在");
        }
        d.setName(req.name().trim());
        d.setDescription(req.description());
        if (req.parentId() != null) {
            d.setParentId(req.parentId());
        }
        deckMapper.updateById(d);
        return new Views.DeckView(d.getId(), d.getParentId(), d.getName(), d.getDescription(), d.getCardCount());
    }

    @Transactional
    public void delete(Long id) {
        if (id == 1L) {
            throw new BizException(400, "默认卡组不能删除");
        }
        long cards = cardMapper.selectCount(new LambdaQueryWrapper<Card>().eq(Card::getDeckId, id));
        if (cards > 0) {
            throw new BizException(400, "卡组下还有卡片，先移动或删除卡片");
        }
        deckMapper.deleteById(id);
    }
}
