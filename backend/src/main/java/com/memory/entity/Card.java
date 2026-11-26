package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("card")
public class Card {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long noteId;
    private Long deckId;
    private String cardType;
    private String front;
    private String back;
    private String extra;

    private Integer state;
    private LocalDateTime dueDate;
    private LocalDateTime lastReview;
    private Double stability;
    private Double difficulty;
    private Integer elapsedDays;
    private Integer scheduledDays;
    private Integer reps;
    private Integer lapses;
    private Integer learningStep;
    private Integer suspended;
    private Integer leech;
    private Integer favorite;
    private Integer wrong;
    private Integer wrongCount;
    private LocalDateTime lastWrongAt;
    private Integer version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @TableLogic
    private Integer deleted;
}
