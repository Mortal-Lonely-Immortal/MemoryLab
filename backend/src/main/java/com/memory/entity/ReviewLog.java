package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("review_log")
public class ReviewLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long cardId;
    private Integer rating;
    private Integer stateBefore;
    private Integer stateAfter;
    private Double stabilityBefore;
    private Double stabilityAfter;
    private Double difficultyBefore;
    private Double difficultyAfter;
    private Integer elapsedDays;
    private Integer scheduledDays;
    private Integer reviewDurationMs;
    private LocalDateTime reviewedAt;
    private String clientReqId;
}
