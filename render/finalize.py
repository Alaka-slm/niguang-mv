"""成片封装与校验。用法: python render/finalize.py [h264=render/film.h264]
1) 封装：WebCodecs 码流（视频，流复制）+ 逆光.mp4 原音轨（流复制，不重新编码）→ 逆光_MV.mp4
2) 规格：分辨率 / 帧率 / 时长
3) 歌词对齐：ffmpeg 抽出画面下方歌词带的逐帧画面，检测每句歌词实际出现与消失的帧，
   与 lyrics.srt 时间轴对比；再用 ffmpeg 抽出音轨，在人声频段内找每句起唱附近的起音点，核对与演唱对齐
4) 响度：ffmpeg ebur128 分别测原曲与成片的综合响度（LUFS）与真峰值
结果写入 render/check_report.json，并输出歌词帧拼图 render/lyric_frames.png"""
import json, os, re, subprocess, sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '逆光.mp4')
H264 = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'render/film.h264')
OUT = os.path.join(ROOT, '逆光_MV.mp4')
FPS, W, H = 30, 1920, 1080
run = lambda args, **k: subprocess.run([FF, '-hide_banner'] + args, capture_output=True, **k)

# 1) 封装
r = run(['-y', '-framerate', str(FPS), '-i', H264, '-i', SRC, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', OUT])
assert r.returncode == 0, r.stderr.decode('utf-8', 'ignore')[-1500:]

# 2) 规格
info = run(['-i', OUT]).stderr.decode('utf-8', 'ignore')
dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info); dur = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3])
vs = re.search(r'Video: (\w+).*?, (\d+)x(\d+).*?, ([\d.]+) fps', info); aus = re.search(r'Audio: (\w+).*?(\d+) Hz, (\w+)', info)
spec = {'file': os.path.basename(OUT), 'duration_s': dur, 'video_codec': vs[1], 'width': int(vs[2]), 'height': int(vs[3]), 'fps': float(vs[4]),
        'audio_codec': aus[1], 'audio_rate': int(aus[2]), 'audio_layout': aus[3]}

# 3a) 歌词带逐帧检测（画面下方 1920×160，缩到 480×40 灰度）
BW, BH = 480, 40
p = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', OUT, '-vf', f'crop={W}:160:0:{H - 160},scale={BW}:{BH},format=gray', '-f', 'rawvideo', '-'], capture_output=True)
band = np.frombuffer(p.stdout, np.uint8).reshape(-1, BH, BW).astype(np.int16)
txt = band > 225                                  # 歌词正文为米白色，明显亮于画面
def srt(path):
    tc = lambda s: (lambda h, m, x: int(h) * 3600 + int(m) * 60 + float(x.replace(',', '.')))(*s.strip().split(':'))
    out = []
    for b in open(path, encoding='utf-8').read().strip().split('\n\n'):
        L = b.strip().split('\n'); a, z = L[1].split('-->'); out.append({'i': int(L[0]), 'start': tc(a), 'end': tc(z), 'text': ' '.join(L[2:]).strip()})
    return out
lines = srt(os.path.join(ROOT, 'lyrics.srt'))
diff = np.r_[0, (txt[1:] != txt[:-1]).sum(axis=(1, 2))]   # 相邻帧文字掩膜变化像素数
rows = []
for L in lines:
    win = range(max(1, int((L['start'] - 0.5) * FPS)), min(len(diff), int((L['start'] + 0.5) * FPS)))
    f_on = max(win, key=lambda f: diff[f]); t_on = f_on / FPS
    win2 = range(max(1, int((L['end'] - 0.5) * FPS)), min(len(diff), int((L['end'] + 0.5) * FPS)))
    f_off = max(win2, key=lambda f: diff[f]); t_off = f_off / FPS
    mid = int((L['start'] + L['end']) / 2 * FPS); present = bool(txt[min(mid, len(txt) - 1)].sum() > 40)
    rows.append({**L, 'shown_at': round(t_on, 3), 'hidden_at': round(t_off, 3), 'on_err_ms': round((t_on - L['start']) * 1000), 'off_err_ms': round((t_off - L['end']) * 1000), 'visible_mid': present})

# 3b) 与演唱对齐：人声频段（300–3400 Hz）起音检测
p = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', OUT, '-vn', '-ac', '1', '-ar', '16000', '-af', 'highpass=f=300,lowpass=f=3400', '-f', 's16le', '-'], capture_output=True)
a = np.frombuffer(p.stdout, np.int16).astype(np.float32) / 32768
hop = 160; e = np.sqrt(np.convolve(a ** 2, np.ones(400) / 400, 'same')[::hop] + 1e-12); le = 20 * np.log10(e)
flux = np.maximum(0, np.r_[0, np.diff(le)]); flux = np.convolve(flux, np.ones(5) / 5, 'same')
for R in rows:
    i0, i1 = int((R['start'] - 0.4) * 100), int((R['start'] + 0.4) * 100)
    k = i0 + int(np.argmax(flux[i0:i1])); R['vocal_onset'] = round(k / 100, 2); R['onset_vs_srt_ms'] = round((k / 100 - R['start']) * 1000)

# 4) 响度
def loud(path):
    s = run(['-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.decode('utf-8', 'ignore')
    summ = s[s.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', summ)[1])
    return {'integrated_LUFS': g('I'), 'LRA_LU': g('LRA'), 'true_peak_dBTP': g('Peak')}
lufs = {'original': loud(SRC), 'export': loud(OUT)}
lufs['diff_LU'] = round(lufs['export']['integrated_LUFS'] - lufs['original']['integrated_LUFS'], 2)

# 拼图：每句歌词起唱后 0.1 s 的画面
import PIL.Image as I, PIL.ImageDraw as D, PIL.ImageFont as F
tiles = []
for R in rows:
    t = R['start'] + 0.1
    jpg = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', OUT, '-frames:v', '1', '-vf', 'scale=480:-1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    import io; tiles.append((R, I.open(io.BytesIO(jpg)).convert('RGB')))
cols = 6; tw, th = 480, 270; sheet = I.new('RGB', (cols * tw, ((len(tiles) + cols - 1) // cols) * (th + 30)), '#efe8da'); d = D.Draw(sheet)
f = F.truetype('C:/Windows/Fonts/msyh.ttc', 18)
for n, (R, im) in enumerate(tiles):
    x, y = (n % cols) * tw, (n // cols) * (th + 30); sheet.paste(im, (x, y))
    d.text((x + 6, y + th + 4), f"#{R['i']} srt {R['start']:.2f}s · 显示 {R['shown_at']:.2f}s ({R['on_err_ms']:+d}ms)", font=f, fill='#4a2a1e')
sheet.save(os.path.join(ROOT, 'render', 'lyric_frames.png'))

rep = {'spec': spec, 'loudness': lufs, 'lyrics': rows,
       'lyric_summary': {'lines': len(rows), 'max_abs_on_err_ms': max(abs(r['on_err_ms']) for r in rows), 'max_abs_off_err_ms': max(abs(r['off_err_ms']) for r in rows),
                         'all_visible_mid': all(r['visible_mid'] for r in rows), 'median_abs_onset_vs_srt_ms': float(np.median([abs(r['onset_vs_srt_ms']) for r in rows]))}}
json.dump(rep, open(os.path.join(ROOT, 'render', 'check_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'spec': spec, 'loudness': lufs, 'lyric_summary': rep['lyric_summary']}, ensure_ascii=False, indent=1))
