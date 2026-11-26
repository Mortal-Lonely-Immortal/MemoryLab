package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memory.common.BizException;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.Deck;
import com.memory.entity.ImportJob;
import com.memory.entity.Note;
import com.memory.importer.DocxImporter;
import com.memory.importer.ParsedNote;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DeckMapper;
import com.memory.mapper.ImportJobMapper;
import com.memory.mapper.NoteMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final DocxImporter docxImporter;
    private final CardClassificationService classificationService;
    private final NoteMapper noteMapper;
    private final CardMapper cardMapper;
    private final DeckMapper deckMapper;
    private final ImportJobMapper importJobMapper;

    public Views.ImportResult importDocx(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择 docx 文件");
        }
        String filename = file.getOriginalFilename() == null ? "handbook.docx" : file.getOriginalFilename();
        ImportJob job = new ImportJob();
        job.setUserId(1L);
        job.setFilename(filename);
        job.setStatus("PARSING");
        job.setTotalNotes(0);
        job.setTotalCards(0);
        job.setCreatedCards(0);
        job.setSkippedCards(0);
        importJobMapper.insert(job);

        try {
            List<ParsedNote> notes = docxImporter.parse(new ByteArrayInputStream(file.getBytes()))
                    .stream()
                    .filter(n -> !isMetaTitle(n.title()))
                    .toList();

            int createdCards = 0;
            int skipped = 0;
            java.util.Map<String, Long> deckCache = new java.util.HashMap<>();
            for (ParsedNote n : notes) {
                String bizKey = sha256(n.title());
                Long exists = noteMapper.selectCount(new LambdaQueryWrapper<Note>()
                        .eq(Note::getUserId, 1L)
                        .eq(Note::getBizKey, bizKey));
                if (exists != null && exists > 0) {
                    skipped++;
                    continue;
                }
                Note note = new Note();
                note.setUserId(1L);
                String book = classificationService.bookFromSource(n.source(), filename);
                String chapterName = classificationService.chapterLabel(n.chapter(), n.source());
                note.setDeckId(classificationService.ensureBookChapter(book, chapterName));
                note.setTitle(n.title());
                note.setContentMd(buildContent(n));
                note.setSource(n.source());
                note.setChapter(n.chapter());
                note.setBizKey(bizKey);
                noteMapper.insert(note);

                createdCards += createCards(note, n);
            }

            job.setStatus("DONE");
            job.setTotalNotes(notes.size());
            job.setCreatedCards(createdCards);
            job.setSkippedCards(skipped);
            job.setTotalCards(createdCards);
            job.setFinishedAt(LocalDateTime.now());
            importJobMapper.updateById(job);

            String msg = "解析 " + notes.size() + " 个知识点，新增 " + createdCards + " 张卡片"
                    + (skipped > 0 ? "，跳过已存在 " + skipped + " 个" : "");
            return new Views.ImportResult(job.getId(), job.getStatus(), notes.size(), createdCards,
                    createdCards, skipped, msg);
        } catch (Exception e) {
            log.error("import failed", e);
            job.setStatus("FAILED");
            String error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            job.setErrorMsg(error.length() > 480 ? error.substring(0, 480) : error);
            job.setFinishedAt(LocalDateTime.now());
            importJobMapper.updateById(job);
            throw new BizException(500, "导入失败：" + job.getErrorMsg());
        }
    }

    public ImportJob getJob(Long id) {
        return importJobMapper.selectById(id);
    }

    private Long ensureDeck() {
        Deck root = deckMapper.selectById(1L);
        if (root != null) {
            return root.getId();
        }
        Deck d = new Deck();
        d.setUserId(1L);
        d.setParentId(0L);
        d.setName("操作系统原理");
        d.setDescription("导入的课件记忆卡");
        d.setSortOrder(0);
        d.setCardCount(0);
        deckMapper.insert(d);
        return d.getId();
    }

    /**
     * 按章建立子卡组（第 1 章、第 2 章…附录 A），让复习队列能按章交错。
     */
    private Long deckFor(String chapter, java.util.Map<String, Long> cache) {
        if (chapter == null || chapter.isBlank()) {
            return ensureDeck();
        }
        Long cached = cache.get(chapter);
        if (cached != null) {
            return cached;
        }
        String name;
        int sortOrder;
        if (chapter.startsWith("LAB")) {
            int num = Integer.parseInt(chapter.substring(3));
            name = "实验 " + num;
            sortOrder = 50 + num;
        } else if ("TEXTBOOK".equals(chapter)) {
            name = "教材翻译";
            sortOrder = 60;
        } else if ("A".equals(chapter)) {
            name = "附录 A";
            sortOrder = 99;
        } else {
            name = "第 " + chapter + " 章";
            sortOrder = Integer.parseInt(chapter);
        }
        Deck d = deckMapper.selectIncludingDeleted(1L, 1L, name);
        if (d == null) {
            d = new Deck();
            d.setUserId(1L);
            d.setParentId(1L);
            d.setName(name);
            d.setDescription(chapter.startsWith("LAB") ? "按实验自动分组" : "按章自动分组");
            d.setSortOrder(sortOrder);
            d.setCardCount(0);
            deckMapper.insert(d);
        } else if (d.getDeleted() != null && d.getDeleted() != 0) {
            deckMapper.restore(d.getId());
            d.setDeleted(0);
        }
        cache.put(chapter, d.getId());
        return d.getId();
    }

    private int createCards(Note note, ParsedNote n) {
        int count = 0;
        java.util.Set<String> seen = new java.util.HashSet<>();
        // New atomic Q/A notes: one explicit question, one focused answer.
        if (n.question() != null && !n.question().isBlank()
                && n.answer() != null && !n.answer().isBlank()) {
            return insertCard(note, "QA", n.question().trim(), n.answer().trim(), "原子知识点", seen);
        }
        if (n.oneLiner() != null && !n.oneLiner().isBlank()) {
            count += insertCard(note, "QA", "「" + n.title() + "」的核心结论是什么？",
                    n.oneLiner(), "一句话", seen);
        }
        if (n.pitfalls() != null && !n.pitfalls().isBlank()) {
            count += insertCard(note, "WHY", "「" + n.title() + "」有哪些易错点？",
                    n.pitfalls(), "易错", seen);
        }
        if (!n.bullets().isEmpty()) {
            String back = String.join("；", n.bullets());
            if (back.length() > 1200) {
                back = back.substring(0, 1200) + "…";
            }
            count += insertCard(note, "QA", "「" + n.title() + "」的要点有哪些？",
                    back, "要点", seen);
        }
        int index = 0;
        for (String table : n.tables()) {
            if (index >= 2) {
                break;
            }
            String tableText = table.length() > 1200
                    ? table.substring(0, 1200) + "\n…（表格过长，已截断）"
                    : table;
            String header = tableText.lines().findFirst().orElse("对比");
            String hint = header.length() > 36 ? header.substring(0, 36) + "…" : header;
            String front = "「" + n.title() + "」的表格" + (n.tables().size() > 1 ? " " + (index + 1) : "")
                    + "（" + hint + "）说了什么？";
            count += insertCard(note, "QA", front, tableText, "表格", seen);
            index++;
        }
        return count;
    }

    private static boolean isMetaTitle(String title) {
        return title.contains("来源覆盖审计")
                || title.contains("阅读指南")
                || title.contains("使用说明")
                || title.contains("校订记录")
                || title.contains("版本记录")
                || title.contains("课件定位")
                || title.contains("本章范围")
                || title.contains("本章结构")
                || title.contains("这份手册")
                || title.contains("记号约定")
                || title.contains("课程安排")
                || title.contains("考核")
                || title.contains("使用建议")
                || title.contains("学习建议")
                || title.contains("学习目标");
    }

    private int insertCard(Note note, String type, String front, String back, String extra,
                           java.util.Set<String> seen) {
        String key = front + "\u0000" + back;
        if (!seen.add(key)) {
            return 0;
        }
        Card c = new Card();
        c.setUserId(1L);
        c.setNoteId(note.getId());
        c.setDeckId(note.getDeckId());
        c.setCardType(type);
        c.setFront(front);
        c.setBack(back);
        c.setExtra(extra);
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
        return 1;
    }

    private static String buildContent(ParsedNote n) {
        StringBuilder sb = new StringBuilder();
        sb.append("## ").append(n.title()).append("\n\n");
        if (n.question() != null) {
            sb.append("**Q**：").append(n.question()).append("\n\n");
        }
        if (n.answer() != null) {
            sb.append("**A**：").append(n.answer()).append("\n\n");
        }
        if (n.oneLiner() != null) {
            sb.append("**一句话**：").append(n.oneLiner()).append("\n\n");
        }
        if (!n.bullets().isEmpty()) {
            sb.append("**要点**\n\n");
            for (String b : n.bullets()) {
                sb.append("- ").append(b).append('\n');
            }
            sb.append('\n');
        }
        if (n.pitfalls() != null) {
            sb.append("**易错**：").append(n.pitfalls()).append("\n\n");
        }
        if (n.corrections() != null) {
            sb.append("**校订**：").append(n.corrections()).append("\n\n");
        }
        if (n.source() != null) {
            sb.append(n.source()).append('\n');
        }
        return sb.toString();
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }
}
