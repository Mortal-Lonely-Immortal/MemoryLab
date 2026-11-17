package com.memory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.memory.entity.Deck;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface DeckMapper extends BaseMapper<Deck> {

    @Select("SELECT * FROM deck WHERE user_id = #{userId} AND parent_id = #{parentId} " +
            "AND name = #{name} LIMIT 1")
    Deck selectIncludingDeleted(@Param("userId") Long userId,
                                @Param("parentId") Long parentId,
                                @Param("name") String name);

    @Update("UPDATE deck SET deleted = 0 WHERE id = #{id}")
    int restore(@Param("id") Long id);
}
