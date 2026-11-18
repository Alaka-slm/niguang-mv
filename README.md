# 《逆光》MV · 蜡笔手绘绘本

为孙燕姿《逆光》制作的一支 MV：一只害怕被爱的橘色小螃蟹，一次次推开那盏为它亮着的小提灯，最后在日出时发现，光一直就在身旁。

全片用代码绘制：p5.js 加 p5.brush 实现蜡笔笔刷，主角统一由 `character/character.js` 绘制，最后用 ffmpeg 封装。

**成片下载**：见本仓库的 [Releases](../../releases)（1920×1080 · 30 fps · 4:54）。原曲音频不包含在仓库中。

## 目录
| 路径 | 内容 |
|---|---|
| [song.md](song.md) | 歌曲分析：歌词解读、主题与情绪走向、BPM 与段落时间轴 |
| [lyrics.srt](lyrics.srt) | 带时间轴的歌词（Whisper 转写，经人工确认） |
| [opening/](opening/) | 开场画面的三种画风样图（像素 / 纸艺 / 蜡笔），最终选定蜡笔手绘 |
| [character/](character/) | 主角小螃蟹：`character.js` 模块、设定图、回归测试 |
| [storyboard.md](storyboard.md) · [storyboard.png](storyboard.png) | 分镜：54 个镜头、53 处卡点转场；关键帧草图在 [storyboard/](storyboard/) |
| [render/](render/) | 成片渲染器、时间线、封装与检查脚本，以及检查报告 |

## 本地预览与重新渲染
需要 Python 3（以及装有 `imageio-ffmpeg` 的环境，用于渲染服务）。

```bash
python opening/serve.py . 8766
```
启动后打开 http://localhost:8766/character/sheet.html 等页面即可预览。重新渲染成片的步骤见 [render/README.md](render/README.md)。

## 说明
歌曲《逆光》的版权归原作者及唱片公司所有。本项目为个人创作练习。
