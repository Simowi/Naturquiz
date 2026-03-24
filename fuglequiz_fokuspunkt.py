import tkinter as tk
from tkinter import ttk
import re, os
from PIL import Image, ImageTk

BASE = '/Users/sivert.moe.winther/Desktop/Vibes/Fiskequiz'
BIRD_DATA_FILE = os.path.join(BASE, 'bird-data.js')
IMAGE_DIR = os.path.join(BASE, 'images', 'fugler')

def parse_field(key, line):
    r = re.search(key + r':\s*"([^"]*)"', line)
    return r.group(1) if r else ''

def parse_int(key, line):
    r = re.search(key + r':\s*(\d+)', line)
    return int(r.group(1)) if r else 1

def load_birds():
    with open(BIRD_DATA_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    birds = []
    for line in content.split('\n'):
        if '{ id:' not in line:
            continue
        bird_id = parse_field('id', line)
        if not bird_id:
            continue
        birds.append({
            'id': bird_id,
            'folder': parse_field('folder', line),
            'nameNo': parse_field('nameNo', line),
            'imgPosition': parse_field('imgPosition', line),
            'maxImg': parse_int('maxImg', line),
        })
    print(f'Lastet {len(birds)} fugler')
    return birds, content

def save_position(bird_id, pos, content):
    pattern = r'(\{ id: "' + re.escape(bird_id) + r'"[^\n]+?)(,\s*imgPosition:\s*"[^"]*")?(,\s*maxImg:)'
    def rep(m):
        return m.group(1) + ', imgPosition: "' + pos + '"' + m.group(3)
    new, n = re.subn(pattern, rep, content)
    if n:
        with open(BIRD_DATA_FILE, 'w', encoding='utf-8') as f:
            f.write(new)
    return new, n > 0

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Fuglequiz - Fokuspunkt-setter')
        self.geometry('1100x750')
        self.configure(bg='#1a1c18')
        self.birds, self.content = load_birds()
        self.bi = 0
        self.ii = 0
        self.fx = 0.5
        self.fy = 0.3
        self._pil = None
        self._build()
        self.bind('<Up>', lambda e: self._nav_bird(-1))
        self.bind('<Down>', lambda e: self._nav_bird(1))
        self.bind('<Left>', lambda e: self._nav_img(-1))
        self.bind('<Right>', lambda e: self._nav_img(1))
        self.bind('<Return>', lambda e: self._save())
        self.after(200, self._init_load)

    def _build(self):
        lf = tk.Frame(self, bg='#2a2c28', width=200)
        lf.pack(side=tk.LEFT, fill=tk.Y)
        lf.pack_propagate(False)
        tk.Label(lf, text='Fugler', font=('Helvetica',12,'bold'),
                 bg='#2a2c28', fg='#fafaf3', pady=10).pack(anchor='w', padx=10)
        self.prog = tk.Label(lf, text='', font=('Helvetica',9),
                              bg='#2a2c28', fg='#888')
        self.prog.pack(anchor='w', padx=10)
        sb = ttk.Scrollbar(lf)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.lb = tk.Listbox(lf, font=('Helvetica',11), bg='#2a2c28',
                              fg='#ccc', selectbackground='#17361d',
                              selectforeground='#fff', borderwidth=0,
                              highlightthickness=0, yscrollcommand=sb.set)
        self.lb.pack(fill=tk.BOTH, expand=True)
        sb.config(command=self.lb.yview)
        self.lb.bind('<<ListboxSelect>>', self._on_lb)
        for b in self.birds:
            has = bool(b.get('imgPosition',''))
            self.lb.insert(tk.END, ('checkmark ' if has else '  ') + b['nameNo'])

        cf = tk.Frame(self, bg='#1a1c18')
        cf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        top = tk.Frame(cf, bg='#17361d', height=40)
        top.pack(fill=tk.X)
        top.pack_propagate(False)
        self.name_lbl = tk.Label(top, text='', font=('Helvetica',13,'bold'),
                                  bg='#17361d', fg='#fff')
        self.name_lbl.pack(side=tk.LEFT, padx=14, pady=8)
        self.img_lbl = tk.Label(top, text='', font=('Helvetica',10),
                                 bg='#17361d', fg='#a0c8a0')
        self.img_lbl.pack(side=tk.LEFT, padx=6)
        self.pos_lbl = tk.Label(top, text='', font=('Helvetica',10),
                                 bg='#17361d', fg='#c7ecc7')
        self.pos_lbl.pack(side=tk.RIGHT, padx=14)

        self.cv = tk.Canvas(cf, bg='#111', highlightthickness=0, cursor='crosshair')
        self.cv.pack(fill=tk.BOTH, expand=True, padx=12, pady=8)
        self.cv.bind('<Button-1>', self._click)
        self.cv.bind('<Motion>', self._motion)
        self.cv.bind('<Configure>', lambda e: self._draw())

        bot = tk.Frame(cf, bg='#1a1c18', height=48)
        bot.pack(fill=tk.X)
        bot.pack_propagate(False)
        for txt, cmd in [('< Forrige fugl', lambda: self._nav_bird(-1)),
                          ('Neste fugl >', lambda: self._nav_bird(1)),
                          ('Forrige bilde', lambda: self._nav_img(-1)),
                          ('Neste bilde', lambda: self._nav_img(1))]:
            tk.Button(bot, text=txt, command=cmd, font=('Helvetica',10),
                      bg='#2a2c28', fg='#ccc', relief=tk.FLAT,
                      padx=10, pady=5, cursor='hand2').pack(side=tk.LEFT, padx=4, pady=8)
        self.save_lbl = tk.Label(bot, text='', font=('Helvetica',10),
                                  bg='#1a1c18', fg='#34c759')
        self.save_lbl.pack(side=tk.RIGHT, padx=8)
        tk.Button(bot, text='Lagre (Enter)', command=self._save,
                  font=('Helvetica',11,'bold'), bg='#17361d', fg='#fff',
                  relief=tk.FLAT, padx=14, pady=5, cursor='hand2').pack(
                  side=tk.RIGHT, padx=12, pady=8)

        rf = tk.Frame(self, bg='#1a1c18', width=260)
        rf.pack(side=tk.RIGHT, fill=tk.Y)
        rf.pack_propagate(False)
        tk.Label(rf, text='Forhandsvisning', font=('Helvetica',11,'bold'),
                 bg='#1a1c18', fg='#888', pady=10).pack(anchor='w', padx=10)
        tk.Label(rf, text='Quiz (16:9)', font=('Helvetica',9),
                 bg='#1a1c18', fg='#555').pack(anchor='w', padx=10)
        self.pv_quiz = tk.Canvas(rf, width=240, height=135, bg='#2a2c28',
                                  highlightthickness=1, highlightbackground='#3a3c38')
        self.pv_quiz.pack(padx=10, pady=4)
        tk.Label(rf, text='Galleri (16:9)', font=('Helvetica',9),
                 bg='#1a1c18', fg='#555').pack(anchor='w', padx=10, pady=(8,0))
        self.pv_gall = tk.Canvas(rf, width=120, height=68, bg='#2a2c28',
                                  highlightthickness=1, highlightbackground='#3a3c38')
        self.pv_gall.pack(padx=10, pady=4, anchor='w')
        tk.Label(rf,
                 text='\nKlikk paa bildet for aa\nsette fokuspunkt\n\n'
                      '<- -> Bytt fugl\nOpp Ned Bytt bilde\nEnter = Lagre',
                 font=('Helvetica',10), bg='#1a1c18', fg='#555',
                 justify=tk.LEFT).pack(anchor='w', padx=10, pady=12)
        tk.Label(rf, text='Lagret posisjon:', font=('Helvetica',9),
                 bg='#1a1c18', fg='#555').pack(anchor='w', padx=10)
        self.saved_lbl = tk.Label(rf, text='(ingen)', font=('Helvetica',10,'bold'),
                                   bg='#1a1c18', fg='#c7ecc7')
        self.saved_lbl.pack(anchor='w', padx=10)

    def _init_load(self):
        if self.birds:
            self._load_bird(0)
        else:
            self.name_lbl.config(text='Ingen fugler funnet!')

    def _load_bird(self, i):
        self.bi = i
        self.ii = 0
        b = self.birds[i]
        pos = b.get('imgPosition', '')
        if pos and '%' in pos:
            parts = pos.replace('%','').split()
            try:
                self.fx = float(parts[0]) / 100
                self.fy = float(parts[1]) / 100
            except:
                self.fx, self.fy = 0.5, 0.3
        else:
            self.fx, self.fy = 0.5, 0.3
        self.name_lbl.config(text=b['nameNo'])
        self.saved_lbl.config(text=pos or '(ingen)')
        self.lb.selection_clear(0, tk.END)
        self.lb.selection_set(i)
        self.lb.see(i)
        self._load_img()
        self._update_prog()

    def _load_img(self):
        b = self.birds[self.bi]
        num = self.ii + 1
        self.img_lbl.config(text=f'Bilde {num}/{b["maxImg"]}')
        path = os.path.join(IMAGE_DIR, f'{b["folder"]}_{num}.jpg')
        if not os.path.exists(path):
            path = os.path.join(IMAGE_DIR, f'{b["folder"]}_1.jpg')
        try:
            self._pil = Image.open(path)
            self._draw()
        except Exception as e:
            self.cv.delete('all')
            self.cv.create_text(400, 300, text=f'Feil: {e}',
                                fill='#ff3b30', font=('Helvetica',12))

    def _draw(self):
        if not self._pil:
            return
        cw = self.cv.winfo_width()
        ch = self.cv.winfo_height()
        if cw < 10 or ch < 10:
            self.after(50, self._draw)
            return
        img = self._pil.copy()
        iw, ih = img.size
        scale = min(cw/iw, ch/ih)
        nw, nh = int(iw*scale), int(ih*scale)
        img = img.resize((nw, nh), Image.LANCZOS)
        ox, oy = (cw-nw)//2, (ch-nh)//2
        self._photo = ImageTk.PhotoImage(img)
        self._ir = (ox, oy, nw, nh)
        self.cv.delete('all')
        self.cv.create_image(ox, oy, anchor='nw', image=self._photo)
        fx = ox + int(self.fx * nw)
        fy = oy + int(self.fy * nh)
        self.cv.create_line(fx, oy, fx, oy+nh, dash=(4,6), fill='#888')
        self.cv.create_line(ox, fy, ox+nw, fy, dash=(4,6), fill='#888')
        self.cv.create_oval(fx-14, fy-14, fx+14, fy+14, outline='#fff', width=2)
        self.cv.create_oval(fx-5, fy-5, fx+5, fy+5, fill='#34c759', outline='')
        self.pos_lbl.config(text=f'Fokus: {int(self.fx*100)}% {int(self.fy*100)}%')
        self._update_previews()

    def _update_previews(self):
        if not self._pil:
            return
        img = self._pil.copy()
        iw, ih = img.size
        def crop(ow, oh):
            ratio = ow/oh
            if iw/ih > ratio:
                ch2 = ih; cw2 = int(ih*ratio)
            else:
                cw2 = iw; ch2 = int(iw/ratio)
            cx = max(0, min(int(self.fx*iw)-cw2//2, iw-cw2))
            cy = max(0, min(int(self.fy*ih)-ch2//2, ih-ch2))
            return img.crop((cx, cy, cx+cw2, cy+ch2)).resize((ow,oh), Image.LANCZOS)
        self._pq = ImageTk.PhotoImage(crop(240,135))
        self.pv_quiz.delete('all')
        self.pv_quiz.create_image(0, 0, anchor='nw', image=self._pq)
        self._pg = ImageTk.PhotoImage(crop(120,68))
        self.pv_gall.delete('all')
        self.pv_gall.create_image(0, 0, anchor='nw', image=self._pg)

    def _click(self, e):
        if not hasattr(self, '_ir'):
            return
        ox, oy, nw, nh = self._ir
        if ox <= e.x <= ox+nw and oy <= e.y <= oy+nh:
            self.fx = (e.x-ox)/nw
            self.fy = (e.y-oy)/nh
            self.save_lbl.config(text='Ikke lagret', fg='#ff9500')
            self._draw()

    def _motion(self, e):
        if not hasattr(self, '_ir'):
            return
        ox, oy, nw, nh = self._ir
        if ox <= e.x <= ox+nw and oy <= e.y <= oy+nh:
            self.pos_lbl.config(
                text=f'Musepeker: {int((e.x-ox)/nw*100)}% {int((e.y-oy)/nh*100)}%')

    def _save(self):
        b = self.birds[self.bi]
        pos = f'{int(self.fx*100)}% {int(self.fy*100)}%'
        self.content, ok = save_position(b['id'], pos, self.content)
        if ok:
            b['imgPosition'] = pos
            self.saved_lbl.config(text=pos)
            self.save_lbl.config(text='Lagret!', fg='#34c759')
            self._update_list()
            self._update_prog()
            self.after(2000, lambda: self.save_lbl.config(text=''))
        else:
            self.save_lbl.config(text='FEIL', fg='#ff3b30')

    def _nav_bird(self, d):
        ni = max(0, min(self.bi+d, len(self.birds)-1))
        if ni != self.bi:
            self._load_bird(ni)

    def _nav_img(self, d):
        b = self.birds[self.bi]
        ni = max(0, min(self.ii+d, b['maxImg']-1))
        if ni != self.ii:
            self.ii = ni
            self._load_img()

    def _on_lb(self, e):
        sel = self.lb.curselection()
        if sel and sel[0] != self.bi:
            self._load_bird(sel[0])

    def _update_list(self):
        for i, b in enumerate(self.birds):
            has = bool(b.get('imgPosition',''))
            self.lb.delete(i)
            self.lb.insert(i, ('OK ' if has else '   ') + b['nameNo'])
            self.lb.itemconfig(i, fg='#34c759' if has else '#ccc')
        self.lb.selection_set(self.bi)

    def _update_prog(self):
        done = sum(1 for b in self.birds if b.get('imgPosition',''))
        self.prog.config(text=f'{done} / {len(self.birds)} har fokuspunkt')

if __name__ == '__main__':
    app = App()
    app.mainloop()
