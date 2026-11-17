package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

@Data
@TableName("daily_stat")
public class DailyStat {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private LocalDate statDate;
    private Integer newCount;
    private Integer reviewCount;
    private Integer againCount;
    private Integer hardCount;
    private Integer goodCount;
    private Integer easyCount;
    private Double retention;
    private Long studyMs;
    private Integer dueCount;
}
