package com.memory.importer;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFStyle;
import org.apache.poi.xwpf.usermodel.XWPFStyles;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTShd;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the generated memory handbook:
 * Heading 3 -> note, blue box (E8F1FA) -> one-liner, amber box (FDF3E3) -> pitfalls,
 * bullets -> key points, "来源：" -> source, tables -> comparison content.
 */
@Component
public class DocxImporter {

    private static final String FILL_BLUE = "E8F1FA";
    private static final String FILL_AMBER = "FDF3E3";
    private static final String FILL_GRAY = "F2F2F2";
    private static final Pattern CHAPTER = Pattern.compile("^(\\d+)");
    private static final Pattern LAB = Pattern.compile("^实验\\s*(\\d+)");
    private static final Pattern TEXTBOOK = Pattern.compile("^教材\\d+");
    private static final Pattern CHAPTER_HEADING = Pattern.compile("^第\\s*(\\d+)\\s*章");

    public List<ParsedNote> parse(InputStream in) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(in)) {
            XWPFStyles styles = doc.getStyles();
            List<ParsedNote> notes = new ArrayList<>();
            NoteBuilder current = null;
            String currentChapter = null;

            for (IBodyElement element : doc.getBodyElements()) {
                if (element instanceof XWPFParagraph p) {
                    String text = clean(p.getText());
                    int level = headingLevel(p, styles);
                    if (level > 0) {
                        if (current != null) {
                            addIfUseful(notes, current.build());
                        }
                        String headingChapter = chapterOf(text);
                        if (headingChapter != null) {
                            currentChapter = headingChapter;
                        }
                        current = (level >= 2 && level <= 4 && !text.isEmpty())
                                ? new NoteBuilder(text, currentChapter) : null;
                        continue;
                    }
                    if (current == null || text.isEmpty()) {
                        continue;
                    }
                    String fill = fillOf(p);
                    if (FILL_BLUE.equals(fill) && text.startsWith("一句话")) {
                        current.oneLiner = stripPrefix(text, "一句话");
                    } else if (FILL_AMBER.equals(fill) && text.startsWith("易错")) {
                        current.pitfalls = stripPrefix(text, "易错");
                    } else if (FILL_GRAY.equals(fill) && text.startsWith("校订")) {
                        current.corrections = stripPrefix(text, "校订");
                    } else if (text.startsWith("来源：") || text.startsWith("出处：")) {
                        current.source = text;
                    } else if (isBullet(p, styles)) {
                        current.bullets.add(text);
                    } else if (!text.startsWith("要点") && !text.startsWith("对比")
                            && !text.startsWith("记：") && text.length() > 4) {
                        current.paragraphs.add(text);
                    }
                } else if (element instanceof XWPFTable table && current != null) {
                    String t = tableToText(table);
                    if (!t.isBlank()) {
                        current.tables.add(t);
                    }
                }
            }
            if (current != null) {
                addIfUseful(notes, current.build());
            }
            return notes;
        }
    }

    private static void addIfUseful(List<ParsedNote> notes, ParsedNote n) {        if (n == null) {
            return;
        }
        boolean useful = n.oneLiner() != null || !n.bullets().isEmpty() || n.pitfalls() != null
                || !n.tables().isEmpty();
        if (useful) {
            notes.add(n);
        }
    }

    private static int headingLevel(XWPFParagraph p, XWPFStyles styles) {
        String styleId = p.getStyle();
        if (styleId != null && styles != null) {
            XWPFStyle style = styles.getStyle(styleId);
            if (style != null && style.getName() != null) {
                String name = style.getName().toLowerCase();
                if (name.startsWith("heading ") || name.startsWith("标题 ")) {
                    String num = name.substring(name.indexOf(' ') + 1).trim();
                    try {
                        return Integer.parseInt(num);
                    } catch (NumberFormatException ignored) {
                        // fall through to outline level
                    }
                }
            }
        }
        CTPPr ppr = p.getCTP().getPPr();
        if (ppr != null && ppr.isSetOutlineLvl()) {
            return ppr.getOutlineLvl().getVal().intValue() + 1;
        }
        return 0;
    }

    private static boolean isBullet(XWPFParagraph p, XWPFStyles styles) {
        if (p.getNumID() != null) {
            return true;
        }
        String styleId = p.getStyle();
        if (styleId != null && styles != null) {
            XWPFStyle style = styles.getStyle(styleId);
            if (style != null && style.getName() != null) {
                String name = style.getName().toLowerCase();
                return name.contains("list bullet") || name.contains("list number");
            }
        }
        return false;
    }

    private static String fillOf(XWPFParagraph p) {
        CTPPr ppr = p.getCTP().getPPr();
        if (ppr == null || !ppr.isSetShd()) {
            return null;
        }
        CTShd shd = ppr.getShd();
        Object fill = shd.getFill();
        if (fill instanceof byte[] b) {
            return java.util.HexFormat.of().formatHex(b).toUpperCase();
        }
        return fill == null ? null : fill.toString().toUpperCase();
    }

    private static String stripPrefix(String text, String prefix) {
        String s = text.substring(prefix.length());
        if (s.startsWith("：") || s.startsWith(":")) {
            s = s.substring(1);
        }
        return s.trim();
    }

    private static String clean(String s) {
        return s == null ? "" : s.replace('\u00A0', ' ').trim();
    }

    private static String tableToText(XWPFTable table) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<>();
            for (XWPFTableCell cell : row.getTableCells()) {
                cells.add(clean(cell.getText()).replace('\n', ' '));
            }
            sb.append(String.join(" | ", cells)).append('\n');
        }
        return sb.toString().trim();
    }

    private static String chapterOf(String text) {
        String t = clean(text);
        Matcher m = CHAPTER_HEADING.matcher(t);
        if (m.find()) {
            return m.group(1);
        }
        if (t.startsWith("附录")) {
            return "A";
        }
        if (t.matches("^A[.．].*")) {
            return "A";
        }
        return null;
    }

    private static final class NoteBuilder {
        private final String title;
        private final String chapterHint;
        private String oneLiner;
        private String pitfalls;
        private String corrections;
        private String source;
        private final List<String> bullets = new ArrayList<>();
        private final List<String> tables = new ArrayList<>();
        private final List<String> paragraphs = new ArrayList<>();

        private NoteBuilder(String title, String chapterHint) {
            this.title = title;
            this.chapterHint = chapterHint;
        }

        private ParsedNote build() {
            if (title == null || title.isBlank()) {
                return null;
            }
            List<String> extra = new ArrayList<>(bullets);
            extra.addAll(paragraphs);
            extra.removeIf(NoteBuilder::isNavigation);
            String chapter = chapterHint;
            Matcher lab = LAB.matcher(title);
            Matcher m = CHAPTER.matcher(title);
            if (lab.find()) {
                chapter = "LAB" + Integer.parseInt(lab.group(1));
            } else if (TEXTBOOK.matcher(title).find()) {
                chapter = "TEXTBOOK";
            } else if (m.find()) {
                chapter = m.group(1);
            } else if (title.startsWith("A.")) {
                chapter = "A";
            }
            String oneLinerFinal = oneLiner;
            Set<String> dedup = new LinkedHashSet<>(extra);
            return new ParsedNote(title, chapter, oneLinerFinal, pitfalls, corrections,
                    new ArrayList<>(dedup), tables, source);
        }

        private static boolean isNavigation(String s) {
            String t = s == null ? "" : s.trim();
            return t.matches("^第 \\d+ 章[\\s　].{0,40}$")
                    || t.startsWith("下一章")
                    || t.startsWith("上一章");
        }
    }
}
