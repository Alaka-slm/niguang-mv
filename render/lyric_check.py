"""歌词对齐复核（模板法，不受转场前景干扰）
对每句歌词：取句中时刻的歌词字形掩膜作模板，在 [起唱−0.6s, 起唱+0.6s] 与 [结束−0.6s, 结束+0.6s] 内逐帧计算
当前帧掩膜与模板的重合度（IoU），第一帧/最后一帧 IoU≥0.6 即为歌词实际出现/消失的帧，与 lyrics.srt 比较。
结果并入 render/check_report.json（lyrics_template 字段）。"""
import json, os, subprocess

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '逆光_MV.mp4')
FPS, W, H, BW, BH = 30, 1920, 1080, 960, 80
p = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', OUT, '-vf', f'crop={W}:160:0:{H - 160},scale={BW}:{BH}', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], capture_output=True)
rgb = np.frombuffer(p.stdout, np.uint8).reshape(-1, BH, BW, 3).astype(np.int16)
# 歌词正文为米白 #fff4dc，外描深褐色描边：取“米白且附近有深色描边”的像素
R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
cream = (R > 235) & (G > 222) & (B > 190) & (B < 240) & (R - B > 12)
dark = (R + G + B) < 200
near_dark = np.zeros_like(dark)
for dy in (-2, 0, 2):
    for dx in (-2, 0, 2):
        near_dark |= np.roll(np.roll(dark, dy, 1), dx, 2)
mask = cream & near_dark
rep = json.load(open(os.path.join(ROOT, 'render', 'check_report.json'), encoding='utf-8'))
rows = []
for L in rep['lyrics']:
    mid = int(round((L['start'] + L['end']) / 2 * FPS)); T = mask[mid]
    iou = lambda f: (mask[f] & T).sum() / max(1, (mask[f] | T).sum())
    on = [f for f in range(int((L['start'] - 0.6) * FPS), int((L['start'] + 0.6) * FPS) + 1) if iou(f) >= 0.6]
    off = [f for f in range(int((L['end'] - 0.6) * FPS), min(len(mask) - 1, int((L['end'] + 0.6) * FPS)) + 1) if iou(f) >= 0.6]
    f_on, f_off = (min(on) if on else None), (max(off) + 1 if off else None)
    rows.append({'i': L['i'], 'text': L['text'], 'srt_start': L['start'], 'srt_end': L['end'], 'template_px': int(T.sum()),
                 'shown_frame': f_on, 'shown_at': f_on / FPS if f_on is not None else None, 'hidden_at': f_off / FPS if f_off is not None else None,
                 'on_err_ms': round((f_on / FPS - L['start']) * 1000) if f_on is not None else None,
                 'off_err_ms': round((f_off / FPS - L['end']) * 1000) if f_off is not None else None,
                 'vocal_onset': L['vocal_onset'], 'onset_vs_srt_ms': L['onset_vs_srt_ms']})
ok = [r for r in rows if r['on_err_ms'] is not None]
rep['lyrics_template'] = rows
rep['lyric_summary_template'] = {'lines': len(rows), 'detected': len(ok), 'max_abs_on_err_ms': max(abs(r['on_err_ms']) for r in ok),
                                 'max_abs_off_err_ms': max(abs(r['off_err_ms']) for r in ok if r['off_err_ms'] is not None),
                                 'frame_ms': round(1000 / FPS, 1)}
json.dump(rep, open(os.path.join(ROOT, 'render', 'check_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
import sys; sys.stdout.reconfigure(encoding='utf-8')
print(rep['lyric_summary_template'])
for r in rows: print(r['i'], r['srt_start'], r['on_err_ms'], r['off_err_ms'], r['template_px'])
