package com.memory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("fsrs_param")
public class FsrsParam {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String version;
    private String weights;
    private Double desiredRetention;
    private Integer maxInterval;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
