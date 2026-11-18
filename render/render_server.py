"""MV 渲染服务器：静态提供 mv/ 目录；接收浏览器逐帧 POST 的 JPEG，经管道直接送入 ffmpeg 编码为 H.264。
用法（需带 imageio-ffmpeg 的 Python）: python render/render_server.py [端口=8767]
  POST /stream/start?out=render/seg_01.mp4&fps=30   开始一个分段
  POST /stream/frame                                 追加一帧（JPEG 字节）
  POST /stream/end                                   结束分段，返回 ffmpeg 退出码
  POST /save?name=render/xxx.png                     存一张图（调试用）
  POST /truncate?name=render/film.h264 · /append?name=…  浏览器 WebCodecs 编码后的 H.264 码流写入/追加"""
import http.server, json, os, re, subprocess, sys, threading, urllib.parse

import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SAFE = re.compile(r'render/[\w\-]+\.(png|jpg|mp4|h264|json)')
state = {'proc': None, 'frames': 0, 'out': None, 'log': None}
lock = threading.Lock()


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def reply(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        body = self.rfile.read(int(self.headers.get('Content-Length', 0) or 0))
        with lock:
            if u.path == '/save':
                name = q.get('name', [''])[0]
                if not SAFE.fullmatch(name): return self.reply({'err': 'bad name'}, 400)
                open(os.path.join(ROOT, name), 'wb').write(body); return self.reply({'ok': True})
            if u.path in ('/append', '/truncate'):   # WebCodecs 编好的 H.264 码流逐段追加写入
                name = q.get('name', [''])[0]
                if not SAFE.fullmatch(name): return self.reply({'err': 'bad name'}, 400)
                with open(os.path.join(ROOT, name), 'ab' if u.path == '/append' else 'wb') as f: f.write(body)
                return self.reply({'ok': True, 'size': os.path.getsize(os.path.join(ROOT, name))})
            if u.path == '/stream/start':
                out = q.get('out', [''])[0]; fps = q.get('fps', ['30'])[0]
                if not SAFE.fullmatch(out) or state['proc']: return self.reply({'err': 'bad out or busy'}, 400)
                logp = os.path.join(ROOT, out + '.log')
                state['log'] = open(logp, 'wb')
                fmt = q.get('fmt', ['raw'])[0]
                src = (['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-framerate', fps, '-i', '-'] if fmt == 'raw'
                       else ['-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', fps, '-i', '-'])
                cmd = [FFMPEG, '-y', '-hide_banner'] + src + [
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', fps, os.path.join(ROOT, out)]
                state.update(proc=subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=state['log']), frames=0, out=out)
                return self.reply({'ok': True})
            if u.path == '/stream/frame':
                if not state['proc']: return self.reply({'err': 'no stream'}, 400)
                state['proc'].stdin.write(body); state['frames'] += 1
                return self.reply({'frames': state['frames']})
            if u.path == '/stream/end':
                p = state['proc']
                if not p: return self.reply({'err': 'no stream'}, 400)
                p.stdin.close(); rc = p.wait(); state['log'].close()
                res = {'rc': rc, 'frames': state['frames'], 'out': state['out']}
                state.update(proc=None, frames=0, out=None)
                return self.reply(res)
        self.reply({'err': 'unknown'}, 404)


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
