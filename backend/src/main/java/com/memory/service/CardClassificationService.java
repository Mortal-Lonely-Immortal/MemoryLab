package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.memory.entity.Card;
import com.memory.entity.Deck;
import com.memory.entity.Note;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DeckMapper;
import com.memory.mapper.NoteMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds a two-level card classification:
 *
 *   book deck (parent_id = 0)
 *     +-- chapter deck (parent_id = book deck)
 *
 * Cards keep pointing at the chapter deck. The card browser can therefore
 * filter by book, chapter, or both without adding duplicate book/chapter
 * columns to every card.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CardClassificationService {

    private static final Pattern BOOK_IN_SOURCE = Pattern.compile(
            "\u6559\u6750\u7ffb\u8bd1\\s+([^\u00b7\\n]+?)(?:\\.(?:pdf|docx|pptx|doc))?(?:\\s*\u00b7|$)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CHAPTER_IN_SOURCE = Pattern.compile(
            "\u7b2c\\s*(\\d+)\\s*\u7ae0\\s*([^\u00b7\\n]*)");

    private final NoteMapper noteMapper;
    private final CardMapper cardMapper;
    private final DeckMapper deckMapper;

    /** Derive a human-readable book name from the generated docx source line. */
    public String bookFromSource(String source, String fallback) {
        String text = source == null ? "" : source.trim();
        Matcher m = BOOK_IN_SOURCE.matcher(text);
        if (m.find()) {
            String book = stripExtension(m.group(1).trim());
            if (!book.isBlank()) {
                return book;
            }
        }
        String tail = text;
        int sep = Math.max(tail.indexOf('\uFF1A'), tail.indexOf(':'));
        if (sep >= 0) {
            tail = tail.substring(sep + 1).trim();
        }
        int dot = tail.indexOf('\u00b7');
        if (dot > 0) {
            tail = tail.substring(0, dot).trim();
        }
        tail = stripExtension(tail);
        if (!tail.isBlank() && !tail.startsWith("\u6559\u6750\u7ffb\u8bd1")) {
            return tail;
        }
        String f = stripExtension(fallback == null ? "" : fallback.trim());
        if (f.isBlank() || f.matches("(?i)^cards?[-_].*")) {
            return "\u672a\u5206\u7c7b";
        }
        return f;
    }

    /** Prefer the chapter title from source; fall back to the numeric chapter. */
    public String chapterLabel(String chapter, String source) {
        String src = source == null ? "" : source;
        Matcher m = CHAPTER_IN_SOURCE.matcher(src);
        if (m.find()) {
            String title = m.group(2) == null ? "" : m.group(2).trim();
            return title.isBlank()
                    ? "\u7b2c " + m.group(1) + " \u7ae0"
                    : "\u7b2c" + m.group(1) + "\u7ae0 " + title;
        }
        String c = chapter == null ? "" : chapter.trim();
        if (c.matches("\\d+")) {
            return "\u7b2c " + c + " \u7ae0";
        }
        if (c.startsWith("LAB")) {
            return "\u5b9e\u9a8c " + c.substring(3);
        }
        if ("TEXTBOOK".equals(c)) {
            return "\u6559\u6750\u7ffb\u8bd1";
        }
        if ("A".equals(c)) {
            return "\u9644\u5f55 A";
        }
        return c.isBlank() ? "\u672a\u5206\u7ae0" : c;
    }

    @Transactional
    public Long ensureBookChapter(String book, String chapter) {
        String bookName = (book == null || book.isBlank()) ? "\u672a\u5206\u7c7b" : book.trim();
        String chapterName = (chapter == null || chapter.isBlank()) ? "\u672a\u5206\u7ae0" : chapter.trim();
        Long bookId = ensureDeck(0L, bookName);
        return ensureDeck(bookId, chapterName);
    }

    @Transactional
    public int classifyAll() {
        List<Note> notes = noteMapper.selectList(new LambdaQueryWrapper<Note>()
                .eq(Note::getUserId, 1L));
        int changed = 0;
        for (Note note : notes) {
            String book = bookFromSource(note.getSource(), null);
            String chapter = chapterLabel(note.getChapter(), note.getSource());
            Long deckId = ensureBookChapter(book, chapter);
            if (!deckId.equals(note.getDeckId())) {
                note.setDeckId(deckId);
                noteMapper.updateById(note);
                cardMapper.update(null, new LambdaUpdateWrapper<Card>()
                        .eq(Card::getUserId, 1L)
                        .eq(Card::getNoteId, note.getId())
                        .set(Card::getDeckId, deckId));
                changed++;
            }
        }
        if (changed > 0) {
            log.info("card classification: {} notes moved into book/chapter decks", changed);
        }
        return changed;
    }

    private Long ensureDeck(Long parentId, String name) {
        Deck d = deckMapper.selectIncludingDeleted(1L, parentId, name);
        if (d == null) {
            d = new Deck();
            d.setUserId(1L);
            d.setParentId(parentId);
            d.setName(name);
            d.setDescription(parentId == 0L ? "\u6309\u4e66\u81ea\u52a8\u5206\u7c7b" : "\u6309\u7ae0\u8282\u81ea\u52a8\u5206\u7c7b");
            d.setSortOrder(0);
            d.setCardCount(0);
            deckMapper.insert(d);
        } else if (d.getDeleted() != null && d.getDeleted() != 0) {
            deckMapper.restore(d.getId());
        }
        return d.getId();
    }

    private static String stripExtension(String name) {
        return name.replaceAll("(?i)\\.(pdf|docx|pptx|doc)$", "").trim();
    }
}
