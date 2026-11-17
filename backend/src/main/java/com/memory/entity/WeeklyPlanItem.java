package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("weekly_plan_item")
public class WeeklyPlanItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long planId;
    private Long methodId;
    private String customName;
    private Integer targetDays;
    private Double avgScore;
    private String decision;
    private LocalDateTime createdAt;
}
