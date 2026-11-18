# 主角：橘色小螃蟹（character.js）

> ✅ **造型已定稿**（2026-11-12，以 crab_sheet.png 为准）。之后修改 character.js 只能扩展（新增道具、动作、表情），不能改动已定稿的造型和色板。

> **约定**：后续所有镜头都只通过 `Crab.draw()` 绘制主角，不在镜头里另画螃蟹，保证造型前后一致。

- 设定图：[crab_sheet.png](crab_sheet.png)（三视图 + 表情表 + 动作表 + 色板），由 [sheet.html](sheet.html) 生成
- 回归测试：[test.html](test.html) → [test_grid.png](test_grid.png)，4 个朝向 × 7 种动作/道具组合。改了 character.js 之后打开它看一眼就行

## 接入
```html
<script src="../opening/lib/p5.min.js"></script>
<script src="../opening/lib/p5.brush.js"></script>
<script src="../character/character.js"></script>
```
画布必须是 `createCanvas(w, h, WEBGL)`，并在 `draw()` 开头执行 `translate(-width/2, -height/2)`（p5.brush 要求）。

## 接口
```js
Crab.draw({
  x, y,                // 脚底中心的画布坐标
  size: 1,             // 1 ≈ 高 175px、宽 250px（含双螯）
  facing: 'front',     // 'front' | 'left' | 'right' | 'back'
  expression: 'neutral', // 'neutral' | 'happy' | 'shy' | 'sad'（背面自动忽略）
  action: 'idle',      // 'idle' | 'walk' | 'jump' | 'hug' | 'hold'
  t: 0,                // 动作相位 0–1：walk = 一个步态循环；jump = 起跳→最高点(0.5)→落地
  prop: null,          // hold / hug 时的道具：'lantern' | 'flower' | 'letter' | 'star'
  holdSide: 'near',    // 用哪只螯拿：'near'（正/背面 = 画面右侧那只；侧面 = 靠镜头那只）| 'far'
  shadow: true,        // 地面投影
});
Crab.registerProp('umbrella', { radius, center: [x, y], draw(p) { /* p.fill / p.outline / p.stroke / p.curve */ } });
```
- **动作做成动画**：每帧传入递增的 `t`，例如 `t = (frameCount % 24) / 24`。走路时 6 条腿交替抬起，跳跃时身体按正弦弧线起落，投影跟着缩放。
- **表情会联动姿态**：`idle` 加 `shy` 时，双螯合拢在肚子前；`idle` 加 `sad` 时，双螯下垂、眼柄外垂，还会挂一滴泪。

## v2 扩展（2026-11-12，为分镜补充；只加不改，定稿造型不动）
| 参数 / 接口 | 取值 | 用途 |
|---|---|---|
| `sit` | `true` | 坐下：身体降低，腿自然折起；可与 idle / hug / hold 叠加 |
| `action` | 新增 `'push'` | 推（正面双螯向前下方；背面双螯举向前上方；侧面平伸） |
| `pose` | `'open'` / `'raise'` / `'chest'` / `'knock'` / `'sweep'` / `'press'` | 张开双螯、举高握持的螯、双螯收在胸前、敲自己的壳、向身后扫、向上按 |
| `expression` | 新增 `'sleepy'` / `'teary-happy'` | 闭眼、笑着带泪 |
| 背面 + `hug` | 带道具时 | 提灯被身体挡住，暖光从身体两侧溢出 |
| `clip` | `[x1,y1,x2,y2]` | 只画矩形内的笔触，比如埋在沙里只露出眼睛 |
| `flipY` | `true` | 垂直镜像，用来画水面倒影 |
| `Crab.drawProp(name, x, y, size)` | — | 单独画道具，和角色手里的道具是同一造型 |
| 新道具 | `'lantern_off'` / `'drawing'` / `'letter_open'` | 熄灭的提灯、信里的蜡笔画、拆开的信 |

升级前的版本备份为 `character.v1.js.bak`。v1 的全部参数行为不变。

## 两条硬约束（由模块保证）
1. **道具不与手分离**：道具坐标的原点就是螯尖的夹口，道具握柄的末端伸进钳口里。绘制顺序为“下钳 → 道具 → 上钳”，所以上钳总是压在握柄上。
2. **道具不遮脸**：绘制前会检测道具的外接圆是否碰到脸部区域（眼睛区和嘴）。如果碰到，就沿远离脸的方向把手臂外伸，直到两者分开。拥抱时，道具固定抱在嘴巴下方的胸前。

新增道具时，在道具的局部坐标里把握柄末端画到原点附近（x < 0 的一侧），`radius` 和 `center` 要如实填写，避让检测才会生效。

## 色板
| 部位 | 色值 |
|---|---|
| 壳 | `#f08a3a` |
| 高光斑 | `#ffbb73` |
| 腹面 / 腿 / 暗部 | `#c9592a` |
| 描边 | `#5e2614` |
| 腮红 | `#f27a8a` |
| 眼白 | `#fffaf0` |
