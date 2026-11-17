package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memory.common.BizException;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.Note;
import com.memory.mapper.CardMapper;
import com.memory.mapper.NoteMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteMapper noteMapper;
    private final CardMapper cardMapper;

    public List<Views.NoteView> list(Long deckId, String keyword) {
        LambdaQueryWrapper<Note> q = new LambdaQueryWrapper<Note>()
                .eq(Note::getUserId, 1L)
                .orderByAsc(Note::getId);
        if (deckId != null) {
            q.eq(Note::getDeckId, deckId);
        }
        if (StringUtils.hasText(keyword)) {
            q.and(w -> w.like(Note::getTitle, keyword).or().like(Note::getContentMd, keyword));
        }
        List<Note> notes = noteMapper.selectList(q);
        List<Views.NoteView> out = new ArrayList<>(notes.size());
        for (Note n : notes) {
            out.add(toView(n));
        }
        return out;
    }

    public Views.NoteView get(Long id) {
        Note n = noteMapper.selectById(id);
        if (n == null) {
            throw new BizException(404, "知识点不存在");
        }
        return toView(n);
    }

    @Transactional
    public Views.NoteView create(Dtos.NoteRequest req) {
        Note n = new Note();
        n.setUserId(1L);
        n.setDeckId(req.deckId());
        n.setTitle(req.title().trim());
        n.setContentMd(req.contentMd());
        n.setSource(req.source());
        n.setChapter(req.chapter());
        noteMapper.insert(n);
        return toView(n);
    }

    @Transactional
    public Views.NoteView update(Long id, Dtos.NoteRequest req) {
        Note n = noteMapper.selectById(id);
        if (n == null) {
            throw new BizException(404, "知识点不存在");
        }
        n.setDeckId(req.deckId());
        n.setTitle(req.title().trim());
        n.setContentMd(req.contentMd());
        n.setSource(req.source());
        n.setChapter(req.chapter());
        noteMapper.updateById(n);
        return toView(n);
    }

    @Transactional
    public void delete(Long id) {
        noteMapper.deleteById(id);
        cardMapper.delete(new LambdaQueryWrapper<Card>().eq(Card::getNoteId, id));
    }

    private static Views.NoteView toView(Note n) {
        return new Views.NoteView(n.getId(), n.getDeckId(), n.getTitle(), n.getContentMd(),
                n.getSource(), n.getChapter());
    }
}
