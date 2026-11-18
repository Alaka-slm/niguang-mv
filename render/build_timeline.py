"""从 storyboard.md 解析镜头表与衔接表，生成 render/timeline.json（渲染器的唯一时间来源）。"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = open(os.path.join(ROOT, 'storyboard.md'), encoding='utf-8').read()
ts = lambda s: int(s.split(':')[0]) * 60 + float(s.split(':')[1])

shots, chapter = [], None
for line in md.splitlines():
    m = re.match(r'^### 2\.\d+ (.+?) · ', line)
    if m: chapter = m.group(1)
    m = re.match(r'^\| (S\d+|L\d+|I\d+|O\d+) \| ([\d:.]+)–([\d:.]+) \| [\d.]+ \| ([^|]+)\|', line)
    if m: shots.append({'id': m.group(1), 'start': round(ts(m.group(2)), 3), 'end': round(ts(m.group(3)), 3), 'lyric': m.group(4).strip(), 'chapter': chapter})

OBJ = [('沙', 'sand'), ('窗帘', 'curtain'), ('门板', 'door'), ('枯叶', 'leaves'), ('落叶', 'leaves'), ('浪花', 'splash'), ('水花', 'splash'), ('水珠', 'splash'),
       ('大浪', 'wave'), ('水膜', 'waterfilm'), ('涟漪', 'ripple'), ('云影', 'cloud'), ('灯塔', 'lighthouse'), ('火焰', 'flame'), ('光斑', 'flare'),
       ('光带', 'flare'), ('雾气', 'fog'), ('信纸', 'paper'), ('窗扇', 'pane'), ('灰尘', 'dust')]
trans = []
for m in re.finditer(r'^\| (X\d+) \| (\w+)→(\w+) \| ([\d.]+)→([\d.]+) \| ([^|]+)\| ([^|]+)\|', md, re.M):
    xid, a, b, w0, w1, how, carry = m.groups()
    how = how.strip()
    if how.startswith('甩镜'):
        d = re.search(r'向(右|左|上|下)', how).group(1)
        t = {'kind': 'whip', 'dir': {'右': 'right', '左': 'left', '上': 'up', '下': 'down'}[d]}
    else:
        obj = next((v for k, v in OBJ if k in how), 'curtain')
        d = re.search(r'（(左|右|上|下)→(左|右|上|下)）', how)
        dirn = {'左右': 'ltr', '右左': 'rtl', '上下': 'ttb', '下上': 'btt'}[d.group(1) + d.group(2)] if d else 'ltr'
        t = {'kind': 'wipe', 'obj': obj, 'dir': dirn}
    t.update(id=xid, out=a, inn=b, w0=float(w0), T=float(w1), how=how, carry=carry.strip())
    trans.append(t)

assert len(shots) == 54 and len(trans) == 53
json.dump({'duration': 294.61, 'fps': 30, 'width': 1920, 'height': 1080, 'shots': shots, 'transitions': trans},
          open(os.path.join(ROOT, 'render', 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print('shots', len(shots), 'transitions', len(trans), Counter(t.get('obj', t['kind']) for t in trans))
