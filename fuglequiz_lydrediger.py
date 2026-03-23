import tkinter as tk
from tkinter import ttk, messagebox
import urllib.request
import urllib.parse
import json
import os
import subprocess
import threading
import tempfile

KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".xc_api_key")
try:
    with open(KEY_FILE) as f:
        XC_API_KEY = f.read().strip()
except:
    XC_API_KEY = ""

BIRDS = [
    ("Graspur", "passer domesticus", "Gråspurv"),
    ("Blameis", "cyanistes caeruleus", "Blåmeis"),
    ("Kjottmeis", "parus major", "Kjøttmeis"),
    ("Bokfink", "fringilla coelebs", "Bokfink"),
    ("Rodstrupe", "erithacus rubecula", "Rødstrupe"),
    ("Svarttrost", "turdus merula", "Svarttrost"),
    ("Skjaere", "pica pica", "Skjære"),
    ("Kroke", "corvus cornix", "Kråke"),
    ("Staer", "sturnus vulgaris", "Stær"),
    ("Gronnfink", "chloris chloris", "Grønnfink"),
    ("Ravn", "corvus corax", "Ravn"),
    ("Gromoke", "larus argentatus", "Gråmåke"),
    ("Fiskemoke", "larus canus", "Fiskemåke"),
    ("Lovsanger", "phylloscopus trochilus", "Løvsanger"),
    ("Jernspurv", "prunella modularis", "Jernspurv"),
    ("Gjok", "cuculus canorus", "Gjøk"),
    ("Strandsnipe", "actitis hypoleucos", "Strandsnipe"),
    ("Fossekall", "cinclus cinclus", "Fossekall"),
    ("Ringdue", "columba palumbus", "Ringdue"),
    ("Vintererle", "motacilla alba", "Vintererle"),
    ("Tonfalk", "falco tinnunculus", "Tårnfalk"),
    ("Spurvehauk", "accipiter nisus", "Spurvehauk"),
    ("Orrhane", "lyrurus tetrix", "Orrhane"),
    ("Storfugl", "tetrao urogallus", "Storfugl"),
    ("Hegre", "ardea cinerea", "Hegre"),
    ("Stokkand", "anas platyrhynchos", "Stokkand"),
    ("Lunde", "fratercula arctica", "Lunde"),
    ("Havoern", "haliaeetus albicilla", "Havørn"),
    ("Sanglerke", "alauda arvensis", "Sanglerke"),
    ("Kongeorn", "aquila chrysaetos", "Kongeørn"),
    ("Vandrefalk", "falco peregrinus", "Vandrefalk"),
    ("Horndykker", "podiceps auritus", "Horndykker"),
    ("Brushane", "calidris pugnax", "Brushane"),
    ("Svartspett", "dryocopus martius", "Svartspett"),
    ("Tretospett", "picoides tridactylus", "Tretåspett"),
    ("Snougle", "bubo scandiacus", "Snøugle"),
    ("Fjellvok", "buteo lagopus", "Fjellvåk"),
    ("Smolom", "gavia stellata", "Smålom"),
    ("Islandsmoake", "larus glaucoides", "Islandsmåke"),
    ("Stillits", "carduelis carduelis", "Stillits"),
    ("Rosenflamingo", "phoenicopterus roseus", "Rosenflamingo"),
    ("Bieter", "merops apiaster", "Bieter"),
    ("Vaktel", "coturnix coturnix", "Vaktel"),
    ("Haerfugl", "upupa epops", "Hærfugl"),
    ("Albatross", "diomedea exulans", "Albatross"),
]

SOUNDS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds", "fugler")
os.makedirs(SOUNDS_DIR, exist_ok=True)

current_play_process = None

def parse_duration(length_str):
    try:
        parts = str(length_str).split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        return int(float(length_str))
    except:
        return 999

def get_saved_count():
    return len([f for f in os.listdir(SOUNDS_DIR) if f.endswith('.mp3')])

def has_sound(folder_name):
    return os.path.exists(os.path.join(SOUNDS_DIR, folder_name + ".mp3"))

def get_credits(folder_name):
    path = os.path.join(SOUNDS_DIR, folder_name + ".txt")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return None

def search_xeno_canto(latin_name):
    order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
    query = 'sp:"{}" cnt:"norway"'.format(latin_name)
    encoded = urllib.parse.quote(query)
    url = "https://xeno-canto.org/api/3/recordings?query={}&key={}".format(encoded, XC_API_KEY)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NaturquizApp/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
            recs = data.get("recordings", [])
            recs = [r for r in recs if parse_duration(r.get("length", "999")) <= 60]
            if recs:
                recs.sort(key=lambda x: order.get(x.get("q", "E"), 5))
                return recs, "Norge"
    except Exception as e:
        print("Norge-sok feil:", e)
    query2 = 'sp:"{}"'.format(latin_name)
    encoded2 = urllib.parse.quote(query2)
    url2 = "https://xeno-canto.org/api/3/recordings?query={}&key={}".format(encoded2, XC_API_KEY)
    try:
        req2 = urllib.request.Request(url2, headers={"User-Agent": "NaturquizApp/1.0"})
        with urllib.request.urlopen(req2, timeout=15) as r2:
            data2 = json.loads(r2.read().decode())
            recs2 = data2.get("recordings", [])
            recs2 = [r for r in recs2 if parse_duration(r.get("length", "999")) <= 60]
            recs2.sort(key=lambda x: order.get(x.get("q", "E"), 5))
            return recs2, "Globalt"
    except Exception as e:
        print("Globalt sok feil:", e)
    return [], "Ingen"

def is_commercial_ok(lic):
    return "nc" not in lic.lower()

def stop_playback():
    global current_play_process
    if current_play_process:
        try:
            current_play_process.terminate()
        except:
            pass
        current_play_process = None

def play_url(url):
    global current_play_process
    stop_playback()
    def _play():
        global current_play_process
        try:
            tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp.close()
            urllib.request.urlretrieve(url, tmp.name)
            current_play_process = subprocess.Popen(["afplay", tmp.name])
            current_play_process.wait()
            os.unlink(tmp.name)
        except Exception as e:
            print("Avspillingsfeil:", e)
    threading.Thread(target=_play, daemon=True).start()

def save_recording(url, folder_name, credits_text):
    mp3_path = os.path.join(SOUNDS_DIR, folder_name + ".mp3")
    txt_path = os.path.join(SOUNDS_DIR, folder_name + ".txt")
    try:
        urllib.request.urlretrieve(url, mp3_path)
        with open(txt_path, "w") as f:
            f.write(credits_text)
        return True
    except Exception as e:
        print("Lagringsfeil:", e)
        return False

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Fuglequiz Lydrediger")
        self.geometry("1050x720")
        self.configure(bg="#fafaf3")
        self.recordings = []
        self.filtered = []
        self.selected_bird = None
        self.check_vars = []
        self.search_scope = ""
        self._build_ui()
        self._refresh_list()

    def _build_ui(self):
        left = tk.Frame(self, bg="#f4f4ed", width=200)
        left.pack(side=tk.LEFT, fill=tk.Y)
        left.pack_propagate(False)

        tk.Label(left, text="Fuglearter", font=("Helvetica", 12, "bold"),
                 bg="#f4f4ed", fg="#1a1c18", pady=10).pack(anchor="w", padx=12)

        self.count_label = tk.Label(left, text="0 / 45 lagret",
                                     font=("Helvetica", 10), bg="#f4f4ed", fg="#737971")
        self.count_label.pack(anchor="w", padx=12, pady=(0,8))

        self.bird_listbox = tk.Listbox(
            left, font=("Helvetica", 11),
            bg="#f4f4ed", fg="#1a1c18",
            selectbackground="#17361d", selectforeground="white",
            borderwidth=0, highlightthickness=0,
            activestyle="none", relief=tk.FLAT)
        self.bird_listbox.pack(fill=tk.BOTH, expand=True, padx=4)
        self.bird_listbox.bind("<<ListboxSelect>>", self._on_bird_select)

        right = tk.Frame(self, bg="#fafaf3")
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=16, pady=12)

        top = tk.Frame(right, bg="#fafaf3")
        top.pack(fill=tk.X, pady=(0,6))

        self.bird_label = tk.Label(top, text="Velg en fugl til venstre",
                                    font=("Helvetica", 16, "bold"),
                                    bg="#fafaf3", fg="#1a1c18")
        self.bird_label.pack(side=tk.LEFT)

        self.status_label = tk.Label(top, text="",
                                      font=("Helvetica", 11),
                                      bg="#fafaf3", fg="#737971")
        self.status_label.pack(side=tk.LEFT, padx=12)

        btn_frame = tk.Frame(right, bg="#fafaf3")
        btn_frame.pack(fill=tk.X, pady=(0,6))

        self.search_btn = tk.Button(
            btn_frame, text="  Sok Xeno-canto  ",
            font=("Helvetica", 12, "bold"),
            bg="#17361d", fg="white", activebackground="#2e4d32",
            activeforeground="white", relief=tk.FLAT,
            padx=16, pady=8, cursor="hand2",
            command=self._search)
        self.search_btn.pack(side=tk.LEFT, padx=(0,10))

        self.save_selected_btn = tk.Button(
            btn_frame, text="  Lagre valgte  ",
            font=("Helvetica", 12, "bold"),
            bg="#2563a8", fg="white", activebackground="#1a4a80",
            activeforeground="white", relief=tk.FLAT,
            padx=16, pady=8, cursor="hand2",
            state=tk.DISABLED,
            command=self._save_selected)
        self.save_selected_btn.pack(side=tk.LEFT, padx=(0,10))

        tk.Button(btn_frame, text="  Stopp all lyd  ",
                  font=("Helvetica", 12), bg="#eeeee7", fg="#1a1c18",
                  activebackground="#e3e3dc", relief=tk.FLAT,
                  padx=16, pady=8, cursor="hand2",
                  command=stop_playback).pack(side=tk.LEFT)

        filter_frame = tk.Frame(right, bg="#fafaf3")
        filter_frame.pack(fill=tk.X, pady=(0,4))

        self.commercial_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            filter_frame,
            text="Vis kun kommersielt OK (CC BY / CC BY-SA)",
            variable=self.commercial_var,
            font=("Helvetica", 10), bg="#fafaf3", fg="#424841",
            activebackground="#fafaf3",
            command=self._apply_filter
        ).pack(side=tk.LEFT)

        tk.Label(right,
                 text="Huk av rader og trykk 'Lagre valgte'  |  Maks 60 sek  |  Sortert etter kvalitet",
                 font=("Helvetica", 10), bg="#fafaf3", fg="#737971").pack(anchor="w", pady=(0,4))

        self.credits_label = tk.Label(right, text="", font=("Helvetica", 10, "italic"),
                                       bg="#fafaf3", fg="#17361d", anchor="w")
        self.credits_label.pack(fill=tk.X, pady=(0,4))

        frame_tree = tk.Frame(right, bg="#fafaf3")
        frame_tree.pack(fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(frame_tree, bg="white", highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(frame_tree, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.rows_frame = tk.Frame(self.canvas, bg="white")
        self.canvas_window = self.canvas.create_window((0, 0), window=self.rows_frame, anchor="nw")
        self.rows_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(self.canvas_window, width=e.width))
        self.canvas.bind_all("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-1*(e.delta/120)), "units"))

        hdr = tk.Frame(right, bg="#eeeee7")
        hdr.pack(fill=tk.X, before=frame_tree)
        for text, w in [("", 30), ("Kval.", 50), ("Lisens", 130), ("Type", 100),
                         ("Lengde", 60), ("Opptaker", 150), ("Sted", 190), ("Dato", 85),
                         ("Spill", 80), ("Stopp", 70)]:
            tk.Label(hdr, text=text, font=("Helvetica", 10, "bold"),
                     bg="#eeeee7", fg="#1a1c18", width=max(1, w//8),
                     anchor="w").pack(side=tk.LEFT, padx=2)

    def _refresh_list(self):
        self.bird_listbox.delete(0, tk.END)
        for folder_name, latin, display in BIRDS:
            prefix = "✓  " if has_sound(folder_name) else "    "
            self.bird_listbox.insert(tk.END, prefix + display)
        self.count_label.config(text="{} / {} lagret".format(get_saved_count(), len(BIRDS)))

    def _on_bird_select(self, event):
        sel = self.bird_listbox.curselection()
        if not sel:
            return
        stop_playback()
        idx = sel[0]
        self.selected_bird = BIRDS[idx]
        folder_name, latin, display = self.selected_bird
        self.bird_label.config(text=display)
        credits = get_credits(folder_name)
        if has_sound(folder_name):
            self.status_label.config(text="({})  Lagret".format(latin), fg="#17361d")
            self.credits_label.config(text="Lagret kreditt: " + (credits or ""))
        else:
            self.status_label.config(text="({})".format(latin), fg="#737971")
            self.credits_label.config(text="")
        self.recordings = []
        self.filtered = []
        self._render_rows([])
        self.save_selected_btn.config(state=tk.DISABLED)

    def _search(self):
        if not self.selected_bird:
            messagebox.showinfo("Velg fugl", "Velg en fugl i listen til venstre forst.")
            return
        self.search_btn.config(text="  Soker...  ", state=tk.DISABLED)
        folder_name, latin, display = self.selected_bird
        self.status_label.config(text="Henter fra Xeno-canto...", fg="#737971")

        def _do():
            recs, scope = search_xeno_canto(latin)
            self.recordings = recs
            self.search_scope = scope
            self.after(0, lambda: self._apply_filter())

        threading.Thread(target=_do, daemon=True).start()

    def _apply_filter(self):
        self.search_btn.config(text="  Sok Xeno-canto  ", state=tk.NORMAL)
        if self.commercial_var.get():
            self.filtered = [r for r in self.recordings if is_commercial_ok(r.get("lic", ""))]
        else:
            self.filtered = self.recordings

        if not self.filtered:
            self.status_label.config(text="Ingen opptak funnet", fg="#c0392b")
            self._render_rows([])
            return

        scope_txt = " – globalt sok" if self.search_scope == "Globalt" else " – norske opptak"
        self.status_label.config(
            text="{} opptak (under 60 sek{})".format(len(self.filtered), scope_txt),
            fg="#17361d" if self.search_scope != "Globalt" else "#c97000")
        self._render_rows(self.filtered)

    def _render_rows(self, recs):
        for widget in self.rows_frame.winfo_children():
            widget.destroy()
        self.check_vars = []

        for i, r in enumerate(recs[:50]):
            var = tk.BooleanVar()
            self.check_vars.append(var)

            bg = "white" if i % 2 == 0 else "#f9f9f6"
            row = tk.Frame(self.rows_frame, bg=bg)
            row.pack(fill=tk.X, pady=1)

            tk.Checkbutton(row, variable=var, bg=bg, activebackground=bg,
                           command=self._update_save_btn).pack(side=tk.LEFT, padx=4)

            q = r.get("q", "?")
            lic = r.get("lic", "")
            lic_short = lic.replace("https://creativecommons.org/licenses/", "")
            lic_short = lic_short.replace("/", " ").strip()
            comm_mark = " ✓" if is_commercial_ok(lic) else ""
            typ = (r.get("type", "") or "")[:14]
            dur = r.get("length", "?")
            rec_name = (r.get("rec", "?") or "?")[:20]
            loc = (r.get("loc", "?") or "?")[:26]
            date = r.get("date", "?")

            for text, w in [(q, 4), (lic_short + comm_mark, 16), (typ, 12), (dur, 6),
                             (rec_name, 18), (loc, 22), (date, 10)]:
                tk.Label(row, text=text, font=("Helvetica", 10),
                         bg=bg, fg="#1a1c18", anchor="w",
                         width=w).pack(side=tk.LEFT, padx=2)

            idx = i
            def make_play(rec=r, index=idx):
                return lambda: self._play_row(rec, index)

            tk.Button(row, text="▶ Spill",
                      font=("Helvetica", 10, "bold"),
                      bg="#17361d", fg="white",
                      activebackground="#2e4d32",
                      relief=tk.RAISED, bd=2,
                      padx=8, pady=4, cursor="hand2",
                      command=make_play()).pack(side=tk.LEFT, padx=4)

            tk.Button(row, text="■ Stopp",
                      font=("Helvetica", 10, "bold"),
                      bg="#c0392b", fg="white",
                      activebackground="#a93226",
                      relief=tk.RAISED, bd=2,
                      padx=8, pady=4, cursor="hand2",
                      command=stop_playback).pack(side=tk.LEFT, padx=2)

        self.canvas.yview_moveto(0)

    def _play_row(self, r, idx):
        file_url = r.get("file", "")
        if not file_url:
            return
        if not file_url.startswith("http"):
            file_url = "https:" + file_url
        rec = r.get("rec", "Ukjent")
        lic = r.get("lic", "")
        xc_id = r.get("id", "")
        self.credits_label.config(
            text="Spiller: {} | {} | xeno-canto.org/{}".format(rec, lic, xc_id))
        play_url(file_url)

    def _update_save_btn(self):
        any_checked = any(v.get() for v in self.check_vars)
        self.save_selected_btn.config(state=tk.NORMAL if any_checked else tk.DISABLED)

    def _save_selected(self):
        if not self.selected_bird:
            return
        folder_name, latin, display = self.selected_bird
        selected = [(i, r) for i, (r, v) in enumerate(
            zip(self.filtered[:50], self.check_vars)) if v.get()]

        if not selected:
            return

        if len(selected) > 1:
            if not messagebox.askyesno("Lagre valgte",
                    "Du har valgt {} opptak. Lagre det forste (beste kvalitet)?".format(len(selected))):
                return
            selected = [selected[0]]

        idx, r = selected[0]
        file_url = r.get("file", "")
        if not file_url.startswith("http"):
            file_url = "https:" + file_url

        rec = r.get("rec", "Ukjent")
        lic = r.get("lic", "")
        xc_id = r.get("id", "")
        dur = r.get("length", "?")
        q = r.get("q", "?")
        credits_text = "Opptaker: {} | Lisens: {} | xeno-canto.org/{} | Lengde: {} | Kvalitet: {}".format(
            rec, lic, xc_id, dur, q)

        if not is_commercial_ok(lic):
            if not messagebox.askyesno("Advarsel",
                    "NC-lisens – tillater ikke kommersiell bruk.\nLagre likevel?"):
                return

        stop_playback()
        self.status_label.config(text="Lagrer {}...".format(display), fg="#737971")

        def _save():
            ok = save_recording(file_url, folder_name, credits_text)
            if ok:
                self.after(0, lambda: self.status_label.config(
                    text="Lagret {}.mp3".format(display), fg="#17361d"))
                self.after(0, lambda: self.credits_label.config(
                    text="Lagret kreditt: " + credits_text))
                self.after(0, self._refresh_list)
            else:
                self.after(0, lambda: self.status_label.config(
                    text="Feil ved lagring", fg="#c0392b"))

        threading.Thread(target=_save, daemon=True).start()

if __name__ == "__main__":
    if not XC_API_KEY:
        print("FEIL: Ingen API-nokkel funnet i .xc_api_key")
    else:
        app = App()
        app.mainloop()
