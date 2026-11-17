package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memory.common.BizException;
import com.memory.dto.MethodDtos;
import com.memory.dto.MethodViews;
import com.memory.entity.LearningMethod;
import com.memory.entity.MethodLog;
import com.memory.entity.WeeklyPlan;
import com.memory.entity.WeeklyPlanItem;
import com.memory.mapper.LearningMethodMapper;
import com.memory.mapper.MethodLogMapper;
import com.memory.mapper.WeeklyPlanItemMapper;
import com.memory.mapper.WeeklyPlanMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MethodLabService {

    private final LearningMethodMapper methodMapper;
    private final WeeklyPlanMapper planMapper;
    private final WeeklyPlanItemMapper itemMapper;
    private final MethodLogMapper logMapper;

    public List<MethodViews.MethodView> methods() {
        return methodMapper.selectList(new LambdaQueryWrapper<LearningMethod>()
                        .eq(LearningMethod::getUserId, 1L)
                        .eq(LearningMethod::getActive, 1))
                .stream()
                .sorted(Comparator.comparingInt(m -> evidenceRank(m.getEvidenceLevel())))
                .map(m -> new MethodViews.MethodView(m.getId(), m.getName(), m.getCategory(),
                        m.getDescription(), m.getEvidenceLevel(), m.getSource(),
                        m.getBuiltin() != null && m.getBuiltin() == 1))
                .toList();
    }

    public MethodViews.PlanView current() {
        LocalDate weekStart = mondayOf(LocalDate.now());
        WeeklyPlan plan = findPlan(weekStart);
        if (plan == null) {
            plan = createPlan(weekStart, suggest(weekStart), "本周自动生成，可调整", "ACTIVE");
        }
        return toView(plan);
    }

    public MethodViews.PlanView plan(Long id) {
        WeeklyPlan plan = planMapper.selectById(id);
        if (plan == null) {
            throw new BizException(404, "周计划不存在");
        }
        return toView(plan);
    }

    public WeeklyPlan findPlan(LocalDate weekStart) {
        return planMapper.selectOne(new LambdaQueryWrapper<WeeklyPlan>()
                .eq(WeeklyPlan::getUserId, 1L)
                .eq(WeeklyPlan::getWeekStart, weekStart)
                .last("limit 1"));
    }

    @Transactional
    public MethodViews.PlanView create(MethodDtos.CreatePlanRequest req) {
        if (req.items() == null || req.items().size() < 3 || req.items().size() > 5) {
            throw new BizException(400, "每周请选择 3–5 个学习方法");
        }
        LocalDate weekStart = mondayOf(req.weekStart());
        WeeklyPlan existing = findPlan(weekStart);
        if (existing != null) {
            long logs = logMapper.selectCount(new LambdaQueryWrapper<MethodLog>()
                    .eq(MethodLog::getUserId, 1L)
                    .in(MethodLog::getItemId, itemIds(existing.getId())));
            if (logs > 0) {
                throw new BizException(400, "这一周已经有打分记录，不能再改计划");
            }
            itemMapper.delete(new LambdaQueryWrapper<WeeklyPlanItem>()
                    .eq(WeeklyPlanItem::getPlanId, existing.getId()));
            existing.setNote(req.note());
            existing.setStatus("REVIEWED".equals(existing.getStatus()) ? "DRAFT" : existing.getStatus());
            planMapper.updateById(existing);
            for (MethodDtos.PlanItemRequest item : req.items()) {
                insertItem(existing.getId(), item);
            }
            return toView(existing);
        }
        String status = weekStart.isAfter(mondayOf(LocalDate.now())) ? "DRAFT" : "ACTIVE";
        WeeklyPlan plan = createPlan(weekStart, req.items().stream()
                .map(i -> new MethodDtos.PlanItemRequest(i.methodId(), i.customName(), i.targetDays()))
                .toList(), req.note(), status);
        return toView(plan);
    }

    @Transactional
    public MethodViews.PlanView score(MethodDtos.ScoreRequest req) {
        WeeklyPlanItem item = itemMapper.selectById(req.itemId());
        if (item == null) {
            throw new BizException(404, "方法条目不存在");
        }
        WeeklyPlan plan = planMapper.selectById(item.getPlanId());
        if (plan == null) {
            throw new BizException(404, "周计划不存在");
        }
        if (req.date().isBefore(plan.getWeekStart()) || req.date().isAfter(plan.getWeekEnd())) {
            throw new BizException(400, "只能给本周打分");
        }
        if (req.score() == null || req.score() < 1 || req.score() > 5) {
            throw new BizException(400, "分数需在 1–5 之间");
        }
        MethodLog log = logMapper.selectOne(new LambdaQueryWrapper<MethodLog>()
                .eq(MethodLog::getItemId, req.itemId())
                .eq(MethodLog::getLogDate, req.date())
                .last("limit 1"));
        if (log == null) {
            log = new MethodLog();
            log.setUserId(1L);
            log.setItemId(req.itemId());
            log.setLogDate(req.date());
            log.setScore(req.score());
            log.setNote(req.note());
            log.setDurationMin(req.durationMin() == null ? 0 : req.durationMin());
            logMapper.insert(log);
        } else {
            log.setScore(req.score());
            log.setNote(req.note());
            log.setDurationMin(req.durationMin() == null ? 0 : req.durationMin());
            logMapper.updateById(log);
        }
        item.setAvgScore(avgOf(item.getId()));
        itemMapper.updateById(item);
        return toView(plan);
    }

    @Transactional
    public MethodViews.PlanView review(MethodDtos.ReviewRequest req) {
        WeeklyPlan plan = planMapper.selectById(req.planId());
        if (plan == null) {
            throw new BizException(404, "周计划不存在");
        }
        Map<Long, String> decisions = req.decisions() == null ? Map.of()
                : req.decisions().stream()
                .filter(d -> d.itemId() != null && d.decision() != null)
                .collect(Collectors.toMap(MethodDtos.DecisionRequest::itemId,
                        d -> d.decision().toUpperCase(), (a, b) -> b));
        List<WeeklyPlanItem> items = itemMapper.selectList(new LambdaQueryWrapper<WeeklyPlanItem>()
                .eq(WeeklyPlanItem::getPlanId, plan.getId()));
        for (WeeklyPlanItem item : items) {
            String d = decisions.get(item.getId());
            if (d == null) {
                d = suggestDecision(item.getAvgScore());
            }
            if (!Set.of("KEEP", "DROP", "TRIAL").contains(d)) {
                throw new BizException(400, "decision 只能是 KEEP/DROP/TRIAL");
            }
            item.setDecision(d);
            item.setAvgScore(avgOf(item.getId()));
            itemMapper.updateById(item);
        }
        plan.setStatus("REVIEWED");
        plan.setNote(req.note());
        planMapper.updateById(plan);
        return toView(plan);
    }

    @Transactional
    public MethodViews.PlanView ensureNextWeekDraft() {
        LocalDate nextMonday = mondayOf(LocalDate.now()).plusWeeks(1);
        WeeklyPlan plan = findPlan(nextMonday);
        if (plan == null) {
            plan = createPlan(nextMonday, suggest(nextMonday), "周日晚自动生成，待确认", "DRAFT");
        }
        return toView(plan);
    }

    public List<MethodDtos.PlanItemRequest> suggest(LocalDate weekStart) {
        LocalDate from = weekStart.minusWeeks(4);
        List<WeeklyPlan> recent = planMapper.selectList(new LambdaQueryWrapper<WeeklyPlan>()
                .eq(WeeklyPlan::getUserId, 1L)
                .ge(WeeklyPlan::getWeekStart, from)
                .le(WeeklyPlan::getWeekStart, weekStart));
        Set<Long> used = new HashSet<>();
        Set<Long> dropped = new HashSet<>();
        List<Long> keep = new ArrayList<>();
        for (WeeklyPlan p : recent) {
            for (WeeklyPlanItem item : itemMapper.selectList(new LambdaQueryWrapper<WeeklyPlanItem>()
                    .eq(WeeklyPlanItem::getPlanId, p.getId()))) {
                if (item.getMethodId() == null) {
                    continue;
                }
                used.add(item.getMethodId());
                if ("DROP".equals(item.getDecision())) {
                    dropped.add(item.getMethodId());
                }
                if ("KEEP".equals(item.getDecision())
                        && p.getWeekStart().equals(weekStart.minusWeeks(1))) {
                    keep.add(item.getMethodId());
                }
            }
        }

        List<MethodDtos.PlanItemRequest> out = new ArrayList<>();
        for (Long id : keep) {
            if (out.size() < 3 && out.stream().noneMatch(i -> id.equals(i.methodId()))) {
                out.add(new MethodDtos.PlanItemRequest(id, null, 5));
            }
        }

        List<LearningMethod> active = methodMapper.selectList(new LambdaQueryWrapper<LearningMethod>()
                        .eq(LearningMethod::getUserId, 1L)
                        .eq(LearningMethod::getActive, 1))
                .stream()
                .sorted(Comparator.comparingInt(m -> evidenceRank(m.getEvidenceLevel())))
                .toList();
        for (LearningMethod m : active) {
            if (out.size() >= 3) {
                break;
            }
            if (!used.contains(m.getId()) && !dropped.contains(m.getId())
                    && out.stream().noneMatch(i -> m.getId().equals(i.methodId()))) {
                out.add(new MethodDtos.PlanItemRequest(m.getId(), null, 5));
            }
        }
        for (LearningMethod m : active) {
            if (out.size() >= 3) {
                break;
            }
            if (out.stream().noneMatch(i -> m.getId().equals(i.methodId()))) {
                out.add(new MethodDtos.PlanItemRequest(m.getId(), null, 5));
            }
        }
        return out;
    }

    private WeeklyPlan createPlan(LocalDate weekStart, List<MethodDtos.PlanItemRequest> items,
                                  String note, String status) {
        WeeklyPlan plan = new WeeklyPlan();
        plan.setUserId(1L);
        plan.setWeekStart(weekStart);
        plan.setWeekEnd(weekStart.plusDays(6));
        plan.setStatus(status);
        plan.setNote(note);
        planMapper.insert(plan);
        for (MethodDtos.PlanItemRequest i : items) {
            insertItem(plan.getId(), i);
        }
        return plan;
    }

    private void insertItem(Long planId, MethodDtos.PlanItemRequest req) {
        if (req.methodId() == null && (req.customName() == null || req.customName().isBlank())) {
            throw new BizException(400, "方法条目需要 methodId 或名称");
        }
        WeeklyPlanItem item = new WeeklyPlanItem();
        item.setPlanId(planId);
        item.setMethodId(req.methodId());
        item.setCustomName(req.customName());
        item.setTargetDays(req.targetDays() == null ? 5 : Math.max(1, Math.min(7, req.targetDays())));
        itemMapper.insert(item);
    }

    private List<Long> itemIds(Long planId) {
        return itemMapper.selectList(new LambdaQueryWrapper<WeeklyPlanItem>()
                        .eq(WeeklyPlanItem::getPlanId, planId))
                .stream().map(WeeklyPlanItem::getId).toList();
    }

    private Double avgOf(Long itemId) {
        List<MethodLog> logs = logMapper.selectList(new LambdaQueryWrapper<MethodLog>()
                .eq(MethodLog::getItemId, itemId));
        if (logs.isEmpty()) {
            return null;
        }
        double avg = logs.stream().mapToInt(MethodLog::getScore).average().orElse(0);
        return Math.round(avg * 100.0) / 100.0;
    }

    private MethodViews.PlanView toView(WeeklyPlan plan) {
        List<WeeklyPlanItem> items = itemMapper.selectList(new LambdaQueryWrapper<WeeklyPlanItem>()
                .eq(WeeklyPlanItem::getPlanId, plan.getId())
                .orderByAsc(WeeklyPlanItem::getId));
        LocalDate today = LocalDate.now();
        List<MethodViews.PlanItemView> itemViews = new ArrayList<>();
        Set<LocalDate> allDays = new HashSet<>();
        double sum = 0;
        int n = 0;
        for (WeeklyPlanItem item : items) {
            List<MethodLog> logs = logMapper.selectList(new LambdaQueryWrapper<MethodLog>()
                    .eq(MethodLog::getItemId, item.getId())
                    .orderByAsc(MethodLog::getLogDate));
            List<MethodViews.LogView> logViews = new ArrayList<>();
            Integer todayScore = null;
            for (MethodLog log : logs) {
                logViews.add(new MethodViews.LogView(log.getLogDate(), log.getScore(),
                        log.getNote(), log.getDurationMin()));
                allDays.add(log.getLogDate());
                if (log.getLogDate().equals(today)) {
                    todayScore = log.getScore();
                }
            }
            LearningMethod method = item.getMethodId() == null ? null : methodMapper.selectById(item.getMethodId());
            String name = method != null ? method.getName()
                    : (item.getCustomName() == null ? "未命名方法" : item.getCustomName());
            String category = method == null ? "other" : method.getCategory();
            String desc = method == null ? null : method.getDescription();
            String evidence = method == null ? "MEDIUM" : method.getEvidenceLevel();
            Double avg = item.getAvgScore() != null ? item.getAvgScore() : avgOf(item.getId());
            if (avg != null) {
                sum += avg;
                n++;
            }
            itemViews.add(new MethodViews.PlanItemView(item.getId(), item.getMethodId(), name, category,
                    desc, evidence, item.getTargetDays(), avg, item.getDecision(), todayScore,
                    logViews.size(), logViews));
        }
        Double weekAvg = n == 0 ? null : Math.round(sum / n * 100.0) / 100.0;
        return new MethodViews.PlanView(plan.getId(), plan.getWeekStart(), plan.getWeekEnd(),
                plan.getStatus(), plan.getNote(), itemViews, weekAvg, allDays.size());
    }

    private static String suggestDecision(Double avg) {
        if (avg == null) {
            return "TRIAL";
        }
        if (avg >= 3.5) {
            return "KEEP";
        }
        if (avg <= 2.5) {
            return "DROP";
        }
        return "TRIAL";
    }

    public static LocalDate mondayOf(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private static int evidenceRank(String level) {
        if (level == null) {
            return 1;
        }
        return switch (level.toUpperCase()) {
            case "HIGH" -> 0;
            case "LOW" -> 2;
            default -> 1;
        };
    }
}
