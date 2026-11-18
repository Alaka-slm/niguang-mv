"""把 storyboard/<镜头号>.png 关键帧拼成分镜总览图 storyboard.png。
文字取自 storyboard.md 的镜头表和衔接表。用法: python storyboard/compose.py"""
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = open(os.path.join(ROOT, 'storyboard.md'), encoding='utf-8').read()
FONT = 'C:/Windows/Fonts/msyh.ttc'
FONT_B = 'C:/Windows/Fonts/msyhbd.ttc'

# ── 解析镜头表与衔接表 ──
shots, chapter = [], None
for line in MD.splitlines():
    m = re.match(r'^### 2\.\d+ (.+?) · ', line)
    if m:
        chapter = m.group(1)
    m = re.match(r'^\| (S\d+|L\d+|I\d+|O\d+) \| ([\d:.]+)–([\d:.]+) \| ([\d.]+) \| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\|', line)
    if m:
        sid, a, b, dur, lyric, scene, action, camera, framing = [g.strip() for g in m.groups()]
        shots.append(dict(id=sid, a=a, b=b, dur=dur, lyric=lyric, scene=scene, action=action, camera=camera, chapter=chapter))
trans = {}
for m in re.finditer(r'^\| (X\d+) \| (\w+)→(\w+) \| ([\d.]+)→([\d.]+) \| ([^|]+)\|', MD, re.M):
    trans[m.group(2)] = (m.group(1), m.group(6).strip())
assert len(shots) == 54, len(shots)


def clean(t):
    t = re.sub(r'`[^`]*`', '', t)          # 去掉 Crab 参数
    t = re.sub(r'★\S*', '', t)
    t = re.sub(r'\*\*', '', t)
    return re.sub(r'\s+', ' ', t).strip(' ，,')


CH_COL = {'前奏': '#6b7bb8', '主歌一 + 导歌': '#5a8a9a', '副歌一': '#d9784e', '间奏': '#7a6a8a', '主歌二 + 导歌': '#4a6a8a',
          '副歌二': '#e0955a', '桥段': '#3a3f70', '副歌三': '#f4b456', '尾声': '#c4844f'}

COLS, TW, TH, CAP, GAP, M, HEAD = 6, 600, 338, 168, 26, 60, 190
rows = (len(shots) + COLS - 1) // COLS
Wd = M * 2 + COLS * TW + (COLS - 1) * GAP
Hd = HEAD + rows * (TH + CAP) + (rows - 1) * GAP + M
img = Image.new('RGB', (Wd, Hd), '#efe8da')
d = ImageDraw.Draw(img)
f_title, f_sub = ImageFont.truetype(FONT_B, 56), ImageFont.truetype(FONT, 26)
f_id, f_txt, f_small = ImageFont.truetype(FONT_B, 24), ImageFont.truetype(FONT, 20), ImageFont.truetype(FONT, 18)
d.text((M, 46), '《逆光》MV 分镜总览 · 关键帧草图', font=f_title, fill='#4a2a1e')
d.text((M, 120), '54 个镜头 · 每句歌词一镜 · 切点吸附 89 BPM 节拍 · 卡点切换（前景扫过 47 / 甩镜 6） · 角色全部由 character.js 绘制', font=f_sub, fill='#7a5a48')
x0 = Wd - M
for name, col in reversed(list(CH_COL.items())):
    w = d.textlength(name, font=f_small) + 34
    x0 -= w + 14
    d.rounded_rectangle((x0, 128, x0 + w, 156), 6, fill=col)
    d.text((x0 + 17, 130), name, font=f_small, fill='white')


def fit(text, font, width):
    if d.textlength(text, font=font) <= width:
        return text
    while text and d.textlength(text + '…', font=font) > width:
        text = text[:-1]
    return text + '…'


for i, s in enumerate(shots):
    r, c = divmod(i, COLS)
    x, y = M + c * (TW + GAP), HEAD + r * (TH + CAP + GAP)
    p = os.path.join(ROOT, 'storyboard', s['id'] + '.png')
    if os.path.exists(p):
        img.paste(Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS), (x, y))
    else:
        d.rectangle((x, y, x + TW, y + TH), fill='#d8d0c0')
        d.text((x + 20, y + 20), '（缺少关键帧）', font=f_txt, fill='#7a5a48')
    col = CH_COL.get(s['chapter'], '#888888')
    d.rectangle((x, y, x + TW, y + TH), outline='#5e2614', width=2)
    d.rectangle((x, y + TH, x + TW, y + TH + CAP), fill='#fbf6ea', outline='#c9b8a0')
    d.rectangle((x, y + TH, x + 8, y + TH + CAP), fill=col)
    tx, ty, tw = x + 18, y + TH + 8, TW - 30
    head = f"{s['id']}   {s['a']}–{s['b']}  ({s['dur']}s)"
    d.text((tx, ty), head, font=f_id, fill='#4a2a1e')
    d.text((tx + tw - d.textlength(s['chapter'], font=f_small), ty + 4), s['chapter'], font=f_small, fill=col)
    lyric = s['lyric'] if not s['lyric'].startswith('（') else s['lyric']
    d.text((tx, ty + 34), fit('歌词：' + lyric if not lyric.startswith('（') else '歌词：' + lyric, f_txt, tw), font=f_txt, fill='#8e2f2a')
    d.text((tx, ty + 62), fit('动作：' + clean(s['action']), f_txt, tw), font=f_txt, fill='#3a2a2a')
    d.text((tx, ty + 90), fit('运镜：' + clean(s['camera']), f_small, tw), font=f_small, fill='#5a4a48')
    if s['id'] in trans:
        xid, how = trans[s['id']]
        d.text((tx, ty + 118), fit(f'→ {xid} ' + clean(how), f_small, tw), font=f_small, fill='#4a6a8a')
    else:
        d.text((tx, ty + 118), '■ 片尾：4:50.5 起随音乐淡出', font=f_small, fill='#4a6a8a')

out = os.path.join(ROOT, 'storyboard.png')
img.save(out, optimize=True)
img.resize((Wd // 3, Hd // 3), Image.LANCZOS).save(os.path.join(ROOT, 'storyboard', '_preview.png'))
print('saved', out, img.size)
