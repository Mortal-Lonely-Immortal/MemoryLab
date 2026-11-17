package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("learning_method")
public class LearningMethod {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String name;
    private String category;
    private String description;
    private String evidenceLevel;
    private String source;
    private Integer builtin;
    private Integer active;
    private LocalDateTime createdAt;
}
