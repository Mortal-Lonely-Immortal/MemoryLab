package com.memory.importer;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocxImporterTest {

    private static CTPPr ppr(XWPFParagraph p) {
        return p.getCTP().isSetPPr() ? p.getCTP().getPPr() : p.getCTP().addNewPPr();
    }

    @Test
    void shouldParseHandbookStructure() throws Exception {
        XWPFDocument doc = new XWPFDocument();

        XWPFParagraph h = doc.createParagraph();
        h.createRun().setText("3.4.2 银行家算法");
        ppr(h).addNewOutlineLvl().setVal(BigInteger.valueOf(2));

        XWPFParagraph blue = doc.createParagraph();
        blue.createRun().setText("一句话：分配前先试分配，能找到安全序列才批准。");
        ppr(blue).addNewShd().setFill("E8F1FA");

        XWPFParagraph bullet = doc.createParagraph();
        bullet.createRun().setText("Need = Max − Allocation");
        bullet.setNumID(BigInteger.ONE);

        XWPFParagraph amber = doc.createParagraph();
        amber.createRun().setText("易错：Need 要逐分量比较，不能只看总量。");
        ppr(amber).addNewShd().setFill("FDF3E3");

        XWPFTable table = doc.createTable(2, 2);
        table.getRow(0).getCell(0).setText("状态");
        table.getRow(0).getCell(1).setText("含义");
        table.getRow(1).getCell(0).setText("安全");
        table.getRow(1).getCell(1).setText("存在安全序列");

        XWPFParagraph src = doc.createParagraph();
        src.createRun().setText("来源：OS_3-2 p13-17");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.write(out);
        doc.close();

        List<ParsedNote> notes = new DocxImporter().parse(new ByteArrayInputStream(out.toByteArray()));

        assertEquals(1, notes.size(), "notes=" + notes);
        ParsedNote n = notes.get(0);
        assertEquals("3.4.2 银行家算法", n.title());
        assertEquals("3", n.chapter());
        assertTrue(n.oneLiner() != null && n.oneLiner().contains("试分配"), "oneLiner=" + n.oneLiner());
        assertTrue(n.pitfalls() != null && n.pitfalls().contains("逐分量"), "pitfalls=" + n.pitfalls());
        assertEquals(1, n.bullets().size(), "bullets=" + n.bullets());
        assertEquals(1, n.tables().size(), "tables=" + n.tables());
        assertTrue(n.tables().get(0).contains("安全序列"));
        assertTrue(n.source() != null && n.source().startsWith("来源：OS_3-2"), "source=" + n.source());
    }
}
