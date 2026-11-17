package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.DailyStat;
import com.memory.entity.ReviewLog;
import com.memory.mapper.CardMapper;
import com.memory.mapper.DailyStatMapper;
import com.memory.mapper.ReviewLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final CardMapper cardMapper;
    private final ReviewLogMapper reviewLogMapper;
    private final DailyStatMapper dailyStatMapper;

    public Views.Overview overview() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();

        long due = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .ne(Card::getState, 0)
                .eq(Card::getSuspended, 0)
                .le(Card::getDueDate, now));
        long newCards = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .eq(Card::getState, 0)
                .eq(Card::getSuspended, 0));
        long reviewed = reviewLogMapper.selectCount(new LambdaQueryWrapper<ReviewLog>()
                .eq(ReviewLog::getUserId, 1L)
                .ge(ReviewLog::getReviewedAt, todayStart));

        LocalDateTime weekAgo = now.minusDays(7);
        List<ReviewLog> weekLogs = reviewLogMapper.selectList(new LambdaQueryWrapper<ReviewLog>()
                .eq(ReviewLog::getUserId, 1L)
                .ge(ReviewLog::getReviewedAt, weekAgo)
                .select(ReviewLog::getRating));
        long passed = weekLogs.stream().filter(l -> l.getRating() >= 3).count();
        double retention = weekLogs.isEmpty() ? 0 : (double) passed / weekLogs.size();

        long total = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L).eq(Card::getSuspended, 0));
        long mature = cardMapper.selectCount(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L).eq(Card::getSuspended, 0).ge(Card::getStability, 21.0));

        return new Views.Overview(due, newCards, reviewed, round(retention),
                streak(), total, mature);
    }

    public List<Views.HeatmapItem> heatmap(int days) {
        LocalDate from = LocalDate.now().minusDays(Math.max(1, Math.min(days, 365)) - 1L);
        List<DailyStat> stats = dailyStatMapper.selectList(new LambdaQueryWrapper<DailyStat>()
                .eq(DailyStat::getUserId, 1L)
                .ge(DailyStat::getStatDate, from)
                .orderByAsc(DailyStat::getStatDate));
        List<Views.HeatmapItem> out = new ArrayList<>(stats.size());
        for (DailyStat s : stats) {
            out.add(new Views.HeatmapItem(s.getStatDate(), s.getReviewCount()));
        }
        return out;
    }

    public List<Views.ForecastItem> forecast(int days) {
        LocalDate today = LocalDate.now();
        QueryWrapper<Card> q = new QueryWrapper<>();
        q.select("DATE(due_date) AS d", "COUNT(*) AS c")
                .eq("user_id", 1L)
                .eq("suspended", 0)
                .eq("deleted", 0)
                .ne("state", 0)
                .ge("due_date", today.atStartOfDay())
                .lt("due_date", today.plusDays(days + 1L).atStartOfDay())
                .groupBy("DATE(due_date)")
                .orderByAsc("d");
        List<Map<String, Object>> rows = cardMapper.selectMaps(q);
        List<Views.ForecastItem> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            LocalDate d = toDate(value(row, "d"));
            long c = ((Number) value(row, "c")).longValue();
            if (d != null) {
                out.add(new Views.ForecastItem(d, c));
            }
        }
        return out;
    }

    public List<Views.CardView> leeches() {
        List<Card> cards = cardMapper.selectList(new LambdaQueryWrapper<Card>()
                .eq(Card::getUserId, 1L)
                .ge(Card::getLapses, 4)
                .orderByDesc(Card::getLapses)
                .last("limit 50"));
        return cards.stream().map(CardService::toView).toList();
    }

    public List<Views.DailyPoint> daily(int days) {
        int n = Math.max(7, Math.min(days, 365));
        LocalDate from = LocalDate.now().minusDays(n - 1L);
        List<DailyStat> stats = dailyStatMapper.selectList(new LambdaQueryWrapper<DailyStat>()
                .eq(DailyStat::getUserId, 1L)
                .ge(DailyStat::getStatDate, from)
                .orderByAsc(DailyStat::getStatDate));
        java.util.Map<LocalDate, DailyStat> byDate = new java.util.HashMap<>();
        for (DailyStat s : stats) {
            byDate.put(s.getStatDate(), s);
        }
        List<Views.DailyPoint> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            LocalDate d = from.plusDays(i);
            DailyStat s = byDate.get(d);
            out.add(new Views.DailyPoint(d,
                    s == null ? 0 : s.getNewCount(),
                    s == null ? 0 : s.getReviewCount(),
                    s == null ? 0.0 : s.getRetention()));
        }
        return out;
    }

    public List<Views.StateCount> cardStates() {
        QueryWrapper<Card> q = new QueryWrapper<>();
        q.select("state", "COUNT(*) AS c")
                .eq("user_id", 1L)
                .eq("suspended", 0)
                .eq("deleted", 0)
                .groupBy("state");
        List<Map<String, Object>> rows = cardMapper.selectMaps(q);
        List<Views.StateCount> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object state = value(row, "state");
            Object c = value(row, "c");
            if (state instanceof Number sn && c instanceof Number cn) {
                out.add(new Views.StateCount(sn.intValue(), cn.longValue()));
            }
        }
        out.sort(java.util.Comparator.comparingInt(Views.StateCount::state));
        return out;
    }

    private int streak() {
        List<DailyStat> stats = dailyStatMapper.selectList(new LambdaQueryWrapper<DailyStat>()
                .eq(DailyStat::getUserId, 1L)
                .gt(DailyStat::getReviewCount, 0)
                .orderByDesc(DailyStat::getStatDate)
                .last("limit 400"));
        Set<LocalDate> days = new HashSet<>();
        for (DailyStat s : stats) {
            days.add(s.getStatDate());
        }
        LocalDate cursor = LocalDate.now();
        if (!days.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }
        int streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    private static Object value(Map<String, Object> row, String key) {
        for (Map.Entry<String, Object> e : row.entrySet()) {
            if (e.getKey().equalsIgnoreCase(key)) {
                return e.getValue();
            }
        }
        return null;
    }

    private static LocalDate toDate(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof LocalDate d) {
            return d;
        }
        if (o instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        if (o instanceof java.util.Date d) {
            return new java.sql.Date(d.getTime()).toLocalDate();
        }
        return LocalDate.parse(o.toString());
    }
}
