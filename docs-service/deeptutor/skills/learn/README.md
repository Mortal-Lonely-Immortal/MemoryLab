# learn —— 把材料学成讲义

一个面向 AI agent 的学习类 skill：给一段材料（课本、PPT、源码、面试题），它先定靶子砍量，
再讲解配图、出题检验、记录掌握状态、排复习，产出 `讲义.docx` + `讲义.md` + `记录.md`。

## 装在哪

标准 skill 目录结构，`learn/SKILL.md` 是入口。

| 用途 | 路径 |
|---|---|
| 所有项目可用（推荐） | `~/.dsh/skills/learn/`（Windows：`C:\Users\<你>\.dsh\skills\learn\`） |
| 仅某个项目 | `<项目根>/.dsh/skills/learn/` |
| Claude Code / Codex 等其他 harness | 放进它们对应的 skills 目录 |

注意：很多 harness **只扫描一层**，必须是 `skills/learn/SKILL.md`，不能是 `skills/some-bucket/learn/SKILL.md`。

装完重启（或用 `/learn` 触发一次）即可。

## 怎么用

```
/learn 学《计算机网络》第三章，PDF 在 D:\讲义\ch3.pdf
```

或者直接说「帮我把这份材料学懂」，模型会按 description 自动加载。

## 它比普通「帮我总结一下」多了什么

1. **先定靶子**（第 0 步）：问清目标岗位、经验、离 deadline 的时间，再决定学什么。
2. **三级砍量**：必背 / 懂概念 / 不看，砍完再讲——同一份材料对不同目标和不同，砍法不同。
3. **一条主线**：知识点挂在数据流上（默认「一次请求的生命周期」），不是按章节顺序铺。
4. **每步有判据**：做到什么算完成，没过往哪退，都写死了。
5. **真图**：每章至少一张 PNG/SVG，表格和字符画不算图。
6. **内联解释**：专业名词和英文术语首次出现时补 `（中文解释）`。
7. **状态与复习**：知识点只有 `未测 / 待复习 / 已掌握` 三态，没有作答不许标已掌握。

## 文件说明

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 主文件：不变量、第 0 步、9 步流程、产物契约 |
| `references/mission.md` | 定靶子、三级砍量、三条主线、知识地图模板 |
| `references/modes.md` | 课本 / PPT / 源码三种入口的差异与检查表 |
| `references/lesson-format.md` | 讲义 docx/md 结构、PPT 还原法、记录模板 |
| `references/figure-spec.md` | 图式选择、验收标准、无图形工具时怎么画 |
| `references/quiz-rules.md` | 题型配比、先答后看、判分口径、状态更新 |
| `references/review-plan.md` | 间隔重复节奏与复习队列 |

## 依赖

- **生成 docx**：`SKILL.md` 里写的是用 `office-docx` skill。没有的话直接用 `python-docx` 也行（`pip install python-docx`）。
- **画图**：默认 Mermaid/SVG；机器上没有 graphviz/mermaid/matplotlib 时，用 Pillow 手绘（`pip install pillow`），字体用系统里任意中文字体。
- **LaTeX**（可选）：如果要把讲义导成 PDF，需要 XeLaTeX。

## 自定义

- 改 `metadata.owner` 成你自己；
- 想让它只在你手动调用时出现，加一行 `disable-model-invocation: true`；
- 想改判定标准，改 `references/mission.md` 的砍量规则和 `quiz-rules.md` 的判分口径。

## 已知限制

- 一次只推进一个主题：整本书会按章拆成多轮，不会一次铺满。
- 判据靠自觉：`未测` 必须等你作答才会变，模型不会替你判定已掌握。
- 图是程序画的：结构清楚但不精美，需要好看得换 Mermaid 或手绘工具。
