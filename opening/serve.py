"""本地预览服务器：提供静态页面，并接收页面 POST 上来的 PNG 存盘。
用法: python serve.py [根目录] [端口]
  默认根目录为本文件所在的 opening/，端口 8765（打开 http://localhost:8765/pixel.html）。
  python opening/serve.py . 8766 → 以 mv/ 为根（打开 http://localhost:8766/character/sheet.html）。
PNG 只能存到根目录或其下一级子目录，文件名限字母数字。"""
import http.server, os, re, sys, urllib.parse

ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(u.query).get('name', [''])[0]
        if u.path != '/save' or not re.fullmatch(r'([\w\-]+/)?[\w\-]+\.png', name):
            self.send_error(400)
            return
        data = self.rfile.read(int(self.headers['Content-Length']))
        with open(os.path.join(ROOT, name), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'saved')


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
