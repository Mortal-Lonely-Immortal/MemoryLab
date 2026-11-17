package com.memory.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.memory.common.BizException;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.entity.FsrsParam;
import com.memory.entity.SysUser;
import com.memory.fsrs.FsrsScheduler;
import com.memory.mapper.FsrsParamMapper;
import com.memory.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FsrsService {

    private final SysUserMapper userMapper;
    private final FsrsParamMapper paramMapper;
    private final ObjectMapper objectMapper;

    public FsrsScheduler scheduler() {
        SysUser user = userMapper.selectById(1L);
        double retention = user != null && user.getDesiredRetention() != null
                ? user.getDesiredRetention() : 0.9;
        double[] weights = FsrsScheduler.DEFAULT_W;
        FsrsParam param = paramMapper.selectOne(new LambdaQueryWrapper<FsrsParam>()
                .eq(FsrsParam::getUserId, 1L)
                .eq(FsrsParam::getVersion, "v4.5")
                .last("limit 1"));
        if (param != null && param.getWeights() != null) {
            try {
                weights = objectMapper.readValue(param.getWeights(), double[].class);
            } catch (Exception e) {
                log.warn("bad fsrs weights, fallback to default: {}", e.getMessage());
            }
        }
        return new FsrsScheduler(weights, retention, 36500);
    }

    public FsrsScheduler.Outcome apply(Card card, int rating) {
        return scheduler().review(FsrsScheduler.Snapshot.of(card), rating, LocalDateTime.now());
    }

    public List<Views.PreviewView> preview(Card card) {
        List<FsrsScheduler.Preview> list = scheduler().preview(FsrsScheduler.Snapshot.of(card), LocalDateTime.now());
        List<Views.PreviewView> out = new ArrayList<>(4);
        for (FsrsScheduler.Preview p : list) {
            out.add(new Views.PreviewView(p.rating(), p.days(), p.label(), p.dueDate()));
        }
        return out;
    }

    public Card requireCard(Card card) {
        if (card == null) {
            throw new BizException(404, "卡片不存在");
        }
        return card;
    }
}
