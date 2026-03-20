#!/usr/bin/env python3
"""Fuglequiz bilderediger"""

import tkinter as tk
from tkinter import ttk, messagebox
import urllib.request, urllib.parse, json, os, hashlib, io, threading, time, ssl
from PIL import Image, ImageTk

ssl._create_default_https_context = ssl._create_unverified_context

IMAGES_DIR = os.path.expanduser("~/Desktop/Vibes/Fiskequiz/images/fugler")
os.makedirs(IMAGES_DIR, exist_ok=True)

BIRDS = [
    ("Gråspurv","Graspur","Passer domesticus"),
    ("Blåmeis","Blameis","Cyanistes caeruleus"),
    ("Kjøttmeis","Kjottmeis","Parus major"),
    ("Bokfink","Bokfink","Fringilla coelebs"),
    ("Rødstrupe","Rodstrupe","Erithacus rubecula"),
    ("Svarttrost","Svarttrost","Turdus merula"),
    ("Skjære","Skjaere","Pica pica"),
    ("Kråke","Kroke","Corvus cornix"),
    ("Stær","Staer","Sturnus vulgaris"),
    ("Grønnfink","Gronnfink","Chloris chloris"),
    ("Ravn","Ravn","Corvus corax"),
    ("Gråmåke","Gromoke","Larus argentatus"),
    ("Fiskemåke","Fiskemoke","Larus canus"),
    ("Løvsanger","Lovsanger","Phylloscopus trochilus"),
    ("Jernspurv","Jernspurv","Prunella modularis"),
    ("Gjøk","Gjok","Cuculus canorus"),
    ("Strandsnipe","Strandsnipe","Actitis hypoleucos"),
    ("Fossekall","Fossekall","Cinclus cinclus"),
    ("Ringdue","Ringdue","Columba palumbus"),
    ("Vintererle","Vintererle","Motacilla cinerea"),
    ("Tårnfalk","Tonfalk","Falco tinnunculus"),
    ("Spurvehauk","Spurvehauk","Accipiter nisus"),
    ("Hønsehauk","Honsehauk","Accipiter gentilis"),
    ("Orrhane","Orrhane","Lyrurus tetrix"),
    ("Storfugl","Storfugl","Tetrao urogallus"),
    ("Hegre","Hegre","Ardea cinerea"),
    ("Stokkand","Stokkand","Anas platyrhynchos"),
    ("Lunde","Lunde","Fratercula arctica"),
    ("Havørn","Havoern","Haliaeetus albicilla"),
    ("Sanglerke","Sanglerke","Alauda arvensis"),
    ("Kongeørn","Kongeorn","Aquila chrysaetos"),
    ("Vandrefalk","Vandrefalk","Falco peregrinus"),
    ("Horndykker","Horndykker","Podiceps auritus"),
    ("Brushane","Brushane","Calidris pugnax"),
    ("Svartspett","Svartspett","Dryocopus martius"),
    ("Tretåspett","Tretospett","Picoides tridactylus"),
    ("Snøugle","Snougle","Bubo scandiacus"),
    ("Fjellvåk","Fjellvok","Buteo lagopus"),
    ("Smålom","Smolom","Gavia stellata"),
    ("Islandsmåke","Islandsmoake","Larus glaucoides"),
    ("Stillits","Stillits","Carduelis carduelis"),
    ("Rosenflamingo","Rosenflamingo","Phoenicopterus roseus"),
    ("Bieter","Bieter","Merops apiaster"),
    ("Vaktel","Vaktel","Coturnix coturnix"),
    ("Hærfugl","Haerfugl","Upupa epops"),
    ("Albatross","Albatross","Diomedea exulans"),
]

THUMB_W, THUMB_H = 200, 133

def get_image_count(folder):
    i = 0
    while os.path.exists(os.path.join(IMAGES_DIR, f"{folder}_{i+1}.jpg")):
        i += 1
    return i

def get_image_hashes(folder):
    hashes = set()
    i = 1
    while True:
        path = os.path.join(IMAGES_DIR, f"{folder}_{i}.jpg")
        if not os.path.exists(path): break
        try:
            with Image.open(path) as img:
                hashes.add(hashlib.md5(img.resize((16,16)).convert("RGB").tobytes()).hexdigest())
        except: pass
        i += 1
    return hashes

def add_scroll(canvas, frame):
    """Enable two-finger trackpad scroll on macOS"""
    def on_scroll(event):
        canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
    def on_scroll_mac(event):
        canvas.yview_scroll(int(-1 * event.delta), "units")
    canvas.bind_all("<MouseWheel>", on_scroll)
    canvas.bind_all("<Button-4>", lambda e: canvas.yview_scroll(-1, "units"))
    canvas.bind_all("<Button-5>", lambda e: canvas.yview_scroll(1, "units"))
    # macOS two-finger scroll
    frame.bind("<MouseWheel>", on_scroll_mac)

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Fuglequiz bilderediger")
        self.root.geometry("1200x800")
        self.selected = None
        self.load_gen = 0
        self.rotation = 0
        self.preview_data = None
        self.current_url = None
        self.selected_frame = None
        self.thumb_frames = {}  # url -> frame, for marking saved
        self.selected_urls = set()  # multi-select
        self._build()

    def _build(self):
        left = tk.Frame(self.root, width=210, bg="#f5f5f5")
        left.pack(side=tk.LEFT, fill=tk.Y)
        left.pack_propagate(False)
        tk.Label(left, text="Fuglearter", bg="#f5f5f5", font=("Helvetica",13,"bold")).pack(pady=(10,4))
        self.listbox = tk.Listbox(left, font=("Helvetica",12), selectbackground="#007aff", activestyle="none")
        self.listbox.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)
        for name, folder, _ in BIRDS:
            self.listbox.insert(tk.END, f"{name} ({get_image_count(folder)})")
        self.listbox.bind("<<ListboxSelect>>", self.on_select)

        right = tk.Frame(self.root)
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        nb = ttk.Notebook(right)
        nb.pack(fill=tk.BOTH, expand=True)
        self.tab_gallery = tk.Frame(nb)
        self.tab_inat = tk.Frame(nb)
        nb.add(self.tab_gallery, text="📷 Nåværende bilder")
        nb.add(self.tab_inat, text="🌐 iNaturalist")
        self._build_gallery()
        self._build_inat()

    # ── GALLERY ──────────────────────────────────────────
    def _build_gallery(self):
        self.gal_canvas = tk.Canvas(self.tab_gallery)
        sb = ttk.Scrollbar(self.tab_gallery, orient="vertical", command=self.gal_canvas.yview)
        self.gal_inner = tk.Frame(self.gal_canvas)
        self.gal_canvas.create_window((0,0), window=self.gal_inner, anchor="nw")
        self.gal_canvas.configure(yscrollcommand=sb.set)
        self.gal_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.gal_inner.bind("<Configure>", lambda e: self.gal_canvas.configure(scrollregion=self.gal_canvas.bbox("all")))
        self.gal_canvas.bind("<MouseWheel>", lambda e: self.gal_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))
        self.gal_inner.bind("<MouseWheel>", lambda e: self.gal_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))

    def refresh_gallery(self):
        for w in self.gal_inner.winfo_children(): w.destroy()
        if not self.selected: return
        name, folder, _ = self.selected
        tk.Label(self.gal_inner, text=f"{name}", font=("Helvetica",13,"bold")).grid(row=0,column=0,columnspan=5,pady=8,padx=8,sticky="w")
        col, row, i = 0, 1, 1
        while True:
            path = os.path.join(IMAGES_DIR, f"{folder}_{i}.jpg")
            if not os.path.exists(path): break
            try:
                img = Image.open(path).resize((THUMB_W, THUMB_H))
                photo = ImageTk.PhotoImage(img)
                fr = tk.Frame(self.gal_inner, bd=2, relief="solid", bg="#ddd")
                fr.grid(row=row, column=col, padx=6, pady=6)
                lbl = tk.Label(fr, image=photo, bg="#ddd")
                lbl.image = photo
                lbl.pack()
                tk.Label(fr, text=f"Bilde #{i}", font=("Helvetica",10)).pack()
                del_btn = tk.Label(fr, text="🗑 Slett", bg="#ff3b30", fg="white", cursor="hand2", padx=8, pady=3)
                del_btn.pack(fill=tk.X)
                del_btn.bind("<Button-1>", lambda e, n=i, f=folder: self.delete_image(f, n))
                # Scroll on gallery items
                for w in [fr, lbl]:
                    w.bind("<MouseWheel>", lambda e: self.gal_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))
            except Exception as ex:
                print(ex)
            i += 1; col += 1
            if col >= 4: col=0; row+=1
        if i == 1:
            tk.Label(self.gal_inner, text="Ingen bilder ennå", fg="#888", font=("Helvetica",12)).grid(row=1,column=0,padx=16,pady=16)

    def delete_image(self, folder, idx):
        if not messagebox.askyesno("Slett", f"Slette bilde #{idx}?"): return
        os.remove(os.path.join(IMAGES_DIR, f"{folder}_{idx}.jpg"))
        i = idx + 1
        while os.path.exists(os.path.join(IMAGES_DIR, f"{folder}_{i}.jpg")):
            os.rename(os.path.join(IMAGES_DIR, f"{folder}_{i}.jpg"),
                      os.path.join(IMAGES_DIR, f"{folder}_{i-1}.jpg"))
            i += 1
        self.refresh_gallery()
        self.refresh_list()

    # ── INAT ─────────────────────────────────────────────
    def _build_inat(self):
        top = tk.Frame(self.tab_inat)
        top.pack(fill=tk.X, padx=10, pady=8)
        tk.Label(top, text="Latinsk navn:", font=("Helvetica",12)).pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        entry = tk.Entry(top, textvariable=self.search_var, width=32, font=("Helvetica",12))
        entry.pack(side=tk.LEFT, padx=6)
        entry.bind("<Return>", lambda e: self.search())
        btn = tk.Label(top, text="  Søk  ", bg="#007aff", fg="white", cursor="hand2", font=("Helvetica",12), pady=4, padx=8)
        btn.pack(side=tk.LEFT)
        btn.bind("<Button-1>", lambda e: self.search())
        self.status = tk.Label(top, text="", fg="#555", font=("Helvetica",11))
        self.status.pack(side=tk.LEFT, padx=12)

        main = tk.Frame(self.tab_inat)
        main.pack(fill=tk.BOTH, expand=True)

        res_frame = tk.Frame(main)
        res_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.res_canvas = tk.Canvas(res_frame)
        sb = ttk.Scrollbar(res_frame, orient="vertical", command=self.res_canvas.yview)
        self.res_inner = tk.Frame(self.res_canvas)
        self.res_canvas.create_window((0,0), window=self.res_inner, anchor="nw")
        self.res_canvas.configure(yscrollcommand=sb.set)
        self.res_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.res_inner.bind("<Configure>", lambda e: self.res_canvas.configure(scrollregion=self.res_canvas.bbox("all")))
        # Two-finger scroll for results
        self.res_canvas.bind("<MouseWheel>", lambda e: self.res_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))
        self.res_inner.bind("<MouseWheel>", lambda e: self.res_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))

        prev = tk.Frame(main, width=300, bg="#f0f0f0")
        prev.pack(side=tk.RIGHT, fill=tk.Y, padx=8, pady=8)
        prev.pack_propagate(False)
        tk.Label(prev, text="Forhåndsvisning", bg="#f0f0f0", font=("Helvetica",12,"bold")).pack(pady=8)
        self.prev_lbl = tk.Label(prev, bg="#f0f0f0", text="Klikk på et bilde", fg="#888", font=("Helvetica",11))
        self.prev_lbl.pack(pady=8)
        rot = tk.Frame(prev, bg="#f0f0f0")
        rot.pack()
        for deg, txt in [(-90,"↺ 90°"),(90,"↻ 90°")]:
            b = tk.Label(rot, text=txt, bg="#555", fg="white", padx=10, pady=4, cursor="hand2")
            b.pack(side=tk.LEFT, padx=4)
            b.bind("<Button-1>", lambda e, d=deg: self.rotate(d))
        self.save_btn = tk.Label(prev, text="💾 Lagre", bg="#34c759", fg="white",
                                  font=("Helvetica",13,"bold"), pady=8, cursor="hand2")
        self.save_btn.pack(fill=tk.X, padx=16, pady=12)
        self.save_btn.bind("<Button-1>", lambda e: self.save())
        self.dup_lbl = tk.Label(prev, text="", bg="#f0f0f0", wraplength=260, font=("Helvetica",11))
        self.dup_lbl.pack(padx=8)

    def on_select(self, e):
        sel = self.listbox.curselection()
        if not sel: return
        self.selected = BIRDS[sel[0]]
        self.search_var.set(self.selected[2])
        self.rotation = 0
        self.thumb_frames = {}
        self.selected_urls = set()
        self.refresh_gallery()

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for name, folder, _ in BIRDS:
            self.listbox.insert(tk.END, f"{name} ({get_image_count(folder)})")

    def search(self):
        q = self.search_var.get().strip()
        if not q: return
        self.status.config(text="Søker...")
        self.load_gen += 1
        gen = self.load_gen
        self.thumb_frames = {}
        self.selected_urls = set()
        for w in self.res_inner.winfo_children(): w.destroy()
        self.selected_frame = None
        threading.Thread(target=self._fetch, args=(q, gen), daemon=True).start()

    def _fetch(self, query, gen):
        try:
            # Step 1: get exact taxon_id
            url = f"https://api.inaturalist.org/v1/taxa?q={urllib.parse.quote(query)}&rank=species&per_page=5"
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"FuglequizApp/1.0"}), timeout=10) as r:
                data = json.loads(r.read())
            if not data.get("results"):
                self.root.after(0, lambda: self.status.config(text="Ingen treff"))
                return

            # Find exact latin name match
            tid = None
            for taxon in data["results"]:
                if taxon.get("name","").lower() == query.lower():
                    tid = taxon["id"]
                    break
            if not tid:
                tid = data["results"][0]["id"]

            # Step 2: fetch observations using taxon_id (exact match) + only birds
            obs_url = (f"https://api.inaturalist.org/v1/observations"
                       f"?taxon_id={tid}"
                       f"&iconic_taxon_name=Aves"
                       f"&has[]=photos"
                       f"&quality_grade=research"
                       f"&per_page=30"
                       f"&order_by=votes")
            with urllib.request.urlopen(urllib.request.Request(obs_url, headers={"User-Agent":"FuglequizApp/1.0"}), timeout=10) as r2:
                obs = json.loads(r2.read())

            # Step 3: filter – only include obs where taxon name matches exactly
            urls = []
            for o in obs.get("results", []):
                obs_taxon = o.get("taxon", {})
                obs_name = obs_taxon.get("name", "")
                # Skip if taxon doesn't match (catches misidentified observations)
                if obs_name.lower() != query.lower():
                    continue
                for p in o.get("photos", []):
                    u = p.get("url","").replace("square","medium")
                    if u: urls.append(u)

            self.root.after(0, lambda: self._show_results(urls, gen))
        except Exception as ex:
            msg = str(ex)
            self.root.after(0, lambda: self.status.config(text=f"Feil: {msg}"))

    def _show_results(self, urls, gen):
        if gen != self.load_gen: return
        # Clear old results
        for w in self.res_inner.winfo_children():
            w.destroy()
        self.res_inner.update_idletasks()

        if not urls:
            self.status.config(text="Ingen bilder funnet med eksakt latinsk navn")
            tk.Label(self.res_inner, text="Ingen treff – prøv å justere søket", fg="#888", font=("Helvetica",12)).grid(row=0,column=0,padx=20,pady=20)
            return

        self.status.config(text=f"{len(urls)} bilder funnet – klikk for å velge")
        existing = get_image_hashes(self.selected[1]) if self.selected else set()
        col, row = 0, 0
        for url in urls:
            fr = tk.Frame(self.res_inner, bd=3, relief="solid", bg="#ddd", cursor="hand2")
            fr.grid(row=row, column=col, padx=5, pady=5)
            lbl = tk.Label(fr, text="Laster...", width=22, height=9, bg="#eee", fg="#888")
            lbl.pack()
            status_lbl = tk.Label(fr, text="", font=("Helvetica",9), bg="#ddd", pady=2)
            status_lbl.pack(fill=tk.X)
            self.thumb_frames[url] = (fr, status_lbl)
            fr.bind("<Button-1>", lambda e, u=url, f=fr: self.select_thumb(u, f))
            lbl.bind("<Button-1>", lambda e, u=url, f=fr: self.select_thumb(u, f))
            for w in [fr, lbl, status_lbl]:
                w.bind("<MouseWheel>", lambda e: self.res_canvas.yview_scroll(int(-1*(e.delta/120)),"units"))
            threading.Thread(target=self._load_thumb, args=(url, lbl, status_lbl, existing, gen), daemon=True).start()
            col += 1
            if col >= 3: col=0; row+=1

    def _load_thumb(self, url, lbl, status_lbl, existing_hashes, gen):
        time.sleep(0.03)
        if gen != self.load_gen: return
        try:
            req = urllib.request.Request(url, headers={"User-Agent":"FuglequizApp/1.0","Referer":"https://www.inaturalist.org"})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
            img = Image.open(io.BytesIO(data))
            h = hashlib.md5(img.resize((16,16)).convert("RGB").tobytes()).hexdigest()
            is_dup = h in existing_hashes
            thumb = img.resize((THUMB_W, THUMB_H))
            photo = ImageTk.PhotoImage(thumb)
            if gen == self.load_gen:
                st = "✓ Allerede lagret" if is_dup else ""
                sbg = "#34c759" if is_dup else "#ddd"
                sfg = "white" if is_dup else "#ddd"
                self.root.after(0, lambda: self._set_thumb(lbl, status_lbl, photo, st, sbg, sfg))
        except: pass

    def _set_thumb(self, lbl, status_lbl, photo, st, sbg, sfg):
        lbl.config(image=photo, text="", width=THUMB_W, height=THUMB_H)
        lbl.image = photo
        status_lbl.config(text=st, bg=sbg, fg=sfg)

    def select_thumb(self, url, frame):
        if url in self.selected_urls:
            # Deselect
            self.selected_urls.discard(url)
            frame.config(bg="#ddd", bd=3)
            if self.current_url == url:
                self.current_url = next(iter(self.selected_urls), None)
        else:
            # Select
            self.selected_urls.add(url)
            frame.config(bg="#007aff", bd=4)
            self.current_url = url
            self.prev_lbl.config(text="Laster...", image="")
            threading.Thread(target=self._load_preview, args=(url,), daemon=True).start()
        n = len(self.selected_urls)
        self.save_btn.config(text=f"💾 Lagre {n} bilde{'r' if n != 1 else ''}" if n > 0 else "💾 Lagre")
        self.dup_lbl.config(text="", fg="#333")

    def _load_preview(self, url):
        try:
            big = url.replace("medium","large")
            req = urllib.request.Request(big, headers={"User-Agent":"FuglequizApp/1.0","Referer":"https://www.inaturalist.org"})
            with urllib.request.urlopen(req, timeout=15) as r:
                self.preview_data = r.read()
            self._render_preview()
        except Exception as ex:
            print(f"Preview: {ex}")

    def _render_preview(self):
        if not self.preview_data: return
        img = Image.open(io.BytesIO(self.preview_data))
        if self.rotation:
            img = img.rotate(-self.rotation, expand=True)
        img.thumbnail((270, 200))
        photo = ImageTk.PhotoImage(img)
        self.root.after(0, lambda: self._update_prev(photo))

    def _update_prev(self, photo):
        self.prev_lbl.config(image=photo, text="")
        self.prev_lbl.image = photo

    def rotate(self, deg):
        self.rotation = (self.rotation + deg) % 360
        self._render_preview()

    def save(self):
        if not self.selected_urls or not self.selected:
            self.dup_lbl.config(text="Velg minst ett bilde først", fg="#ff3b30")
            return
        name, folder, _ = self.selected
        saved, dupes, errors = 0, 0, 0
        existing = get_image_hashes(folder)
        urls_to_save = list(self.selected_urls)
        self.save_btn.config(text="Lagrer...", bg="#aaa")
        self.root.update_idletasks()

        for url in urls_to_save:
            try:
                big = url.replace("medium","large")
                req = urllib.request.Request(big, headers={"User-Agent":"FuglequizApp/1.0","Referer":"https://www.inaturalist.org"})
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = r.read()
                img = Image.open(io.BytesIO(data)).convert("RGB")
                # Only apply rotation to current_url (the one previewed)
                if url == self.current_url and self.rotation:
                    img = img.rotate(-self.rotation, expand=True)
                h = hashlib.md5(img.resize((16,16)).convert("RGB").tobytes()).hexdigest()
                if h in existing:
                    dupes += 1
                    continue
                n = get_image_count(folder) + 1
                img.save(os.path.join(IMAGES_DIR, f"{folder}_{n}.jpg"), "JPEG", quality=90)
                existing.add(h)
                saved += 1
                # Mark green
                if url in self.thumb_frames:
                    fr, st_lbl = self.thumb_frames[url]
                    self.root.after(0, lambda f=fr, s=st_lbl: (f.config(bg="#34c759", bd=4), s.config(text="✓ Lagret", bg="#34c759", fg="white")))
            except Exception as ex:
                errors += 1
                print(f"Feil: {ex}")

        # Reset selection
        self.selected_urls = set()
        self.save_btn.config(text="💾 Lagre", bg="#34c759")

        parts = []
        if saved: parts.append(f"✅ {saved} lagret")
        if dupes: parts.append(f"⚠️ {dupes} duplikat")
        if errors: parts.append(f"❌ {errors} feil")
        self.dup_lbl.config(text="  ".join(parts) if parts else "", fg="#34c759")
        self.refresh_gallery()
        self.refresh_list()

if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
