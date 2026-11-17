package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("method_log")
public class MethodLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long itemId;
    private LocalDate logDate;
    private Integer score;
    private String note;
    private Integer durationMin;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
