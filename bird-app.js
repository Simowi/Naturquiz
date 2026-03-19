// ============================================================
// FISKEQUIZ – bird-app.js
// ============================================================

function getRarityTierBird(bird) {
  const r = bird.rarity || 1;
  if (r <= 9)  return { tier: 1, label: 'Vanlig' };
  if (r <= 19) return { tier: 2, label: 'Uvanlig' };
  if (r <= 30) return { tier: 3, label: 'Sjelden' };
  if (r <= 40) return { tier: 4, label: 'Meget sjelden' };
  return        { tier: 5, label: 'Ekstremt sjelden' };
}

// ── State ────────────────────────────────────────────────
let birdScore       = 0;
let birdLives       = 1;
let birdTimeLeft    = 20;
let birdTimerInterval;
let birdGameStartTime;
let birdQuestionCount = 0;
let birdTotalCorrect  = 0;
let birdCurrentBird   = null;
let birdCurrentImageFile = '';
let birdCurrentImageNum  = 1;
let birdAllDiscovered    = new Set();
let birdDiscoveredImages = {};
let birdDiscoveredThisSession = new Set();

// ── localStorage ─────────────────────────────────────────
function birdLoadDiscovered() {
  const saved = localStorage.getItem('birdquiz_discovered');
  if (saved) {
    JSON.parse(saved).forEach(id => birdAllDiscovered.add(id));
  }
  const imgs = localStorage.getItem('birdquiz_discovered_images');
  if (imgs) birdDiscoveredImages = JSON.parse(imgs);
}

function birdSaveDiscovered() {
  localStorage.setItem('birdquiz_discovered', JSON.stringify([...birdAllDiscovered]));
  localStorage.setItem('birdquiz_discovered_images', JSON.stringify(birdDiscoveredImages));
}

function birdUpdateProgressText() {
  const el = document.getElementById('bird-splash-progress');
  if (el) el.textContent = birdAllDiscovered.size + ' / 46 fugler oppdaget';
}

// ── Game flow ─────────────────────────────────────────────
function startBirdGame() {
  const hiddenInput = document.getElementById('bird-player-name-hidden');
  const mainInput = document.getElementById('player-name');
  const playerName = (hiddenInput && hiddenInput.value.trim()) || (mainInput && mainInput.value.trim()) || '';
  if (!playerName) {
    showBirdScreen('screen-splash');
    return;
  }

  birdScore          = 0;
  birdLives          = 1;
  birdQuestionCount  = 0;
  birdTotalCorrect   = 0;
  birdDiscoveredThisSession = new Set();
  birdGameStartTime  = Date.now();

  birdUpdateHUD();
  showBirdScreen('screen-bird-quiz');
  birdLoadQuestion();
}

function birdLoadQuestion() {
  if (birdLives <= 0) { endBirdGame(); return; }

  const weighted = [];
  BIRD_DATA.forEach(b => {
    const w = [8,5,3,2,1][getRarityTierBird(b).tier - 1];
    for (let i = 0; i < w; i++) weighted.push(b);
  });
  const shuffled = weighted
    .sort(() => Math.random() - 0.5)
    .filter((b, i, a) => a.findIndex(x => x.id === b.id) === i);

  birdCurrentBird = shuffled[0];

  const maxImg = birdCurrentBird.maxImg || 5;
  birdCurrentImageNum = Math.floor(Math.random() * maxImg) + 1;
  birdCurrentImageFile = `images/fugler/${birdCurrentBird.folder}_${birdCurrentImageNum}.jpg`;

  const shimmer = document.getElementById('bird-image-shimmer');
  const img = document.getElementById('bird-image');
  if (shimmer) shimmer.style.display = 'block';
  if (img) {
    img.style.opacity = '0';
    img.onload = () => {
      if (shimmer) shimmer.style.display = 'none';
      img.style.transition = 'opacity 0.4s ease';
      img.style.opacity = '1';
    };
    img.onerror = () => { img.src = `images/fugler/${birdCurrentBird.folder}_1.jpg`; };
    img.src = birdCurrentImageFile;
  }

  const wrong = shuffled.slice(1, 4);
  const options = [birdCurrentBird, ...wrong].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('bird-options-grid');
  if (grid) {
    grid.innerHTML = '';
    options.forEach(bird => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = bird.nameNo;
      btn.dataset.birdId = bird.id;
      btn.addEventListener('click', () => selectBirdAnswer(bird.id, btn));
      grid.appendChild(btn);
    });
  }

  birdQuestionCount++;
  const counter = document.getElementById('bird-question-counter');
  if (counter) counter.textContent = `Spørsmål ${birdQuestionCount}`;

  birdStartTimer();
}

function birdStartTimer() {
  clearInterval(birdTimerInterval);
  birdTimeLeft = 20;
  birdUpdateTimerBar();

  birdTimerInterval = setInterval(() => {
    birdTimeLeft--;
    birdUpdateTimerBar();
    if (birdTimeLeft <= 0) {
      clearInterval(birdTimerInterval);
      birdDisableOptions();
      showBirdFeedback(false, null, true);
    }
  }, 1000);
}

function birdUpdateTimerBar() {
  const bar = document.getElementById('bird-timer-bar');
  if (bar) {
    const pct = (birdTimeLeft / 20) * 100;
    bar.style.width = pct + '%';
    bar.style.background = pct > 50 ? '#34c759' : pct > 25 ? '#ff9500' : '#ff3b30';
  }
}

function birdDisableOptions() {
  document.querySelectorAll('#bird-options-grid .option-btn').forEach(b => b.disabled = true);
}

function selectBirdAnswer(birdId, btn) {
  clearInterval(birdTimerInterval);
  birdDisableOptions();

  const correct = birdId === birdCurrentBird.id;

  if (correct) {
    btn.classList.add('correct');
    const points = 1;
    birdScore += points;
    birdTotalCorrect++;

    birdDiscoveredImages[birdCurrentBird.id] = birdCurrentImageNum;
    const isFirstDiscovery = !birdAllDiscovered.has(birdCurrentBird.id);
    if (isFirstDiscovery) {
      birdAllDiscovered.add(birdCurrentBird.id);
      birdDiscoveredThisSession.add(birdCurrentBird.id);
      birdSaveDiscovered();
      localStorage.setItem('birdquiz_newbird', '1');
    }
    birdCurrentBird._isNewDiscovery = isFirstDiscovery;
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('#bird-options-grid .option-btn').forEach(b => {
      if (b.dataset.birdId === birdCurrentBird.id) b.classList.add('correct');
    });
    birdLoseLife();
  }

  birdUpdateHUD();
  setTimeout(() => showBirdFeedback(correct, birdId), 600);
}

function birdLoseLife() {
  birdLives--;
  birdUpdateHUD();
  const wrap = document.getElementById('bird-image-wrap');
  if (wrap) {
    wrap.classList.add('flash-red');
    setTimeout(() => wrap.classList.remove('flash-red'), 500);
  }
}

function birdUpdateHUD() {
  const scoreEl = document.getElementById('bird-score-value');
  if (scoreEl) scoreEl.textContent = birdScore.toLocaleString('no');
}

function showBirdFeedback(correct, birdId, isTimeout = false) {
  const bird = birdCurrentBird;

  const iconEl = document.getElementById('bird-feedback-icon');
  const titleEl = document.getElementById('bird-feedback-title');
  if (iconEl) iconEl.textContent = correct ? '✅' : '❌';
  if (titleEl) titleEl.textContent = correct ? 'Riktig!' : (isTimeout ? 'Tiden er ute!' : 'Beklager – det var feil!');

  const imgEl = document.getElementById('bird-feedback-img');
  if (imgEl) imgEl.src = birdCurrentImageFile;

  const nameEl = document.getElementById('bird-feedback-name-no');
  if (nameEl) nameEl.textContent = bird.nameNo;

  const rtEl = document.getElementById('bird-feedback-rarity');
  if (rtEl) {
    if (correct) {
      const rt = getRarityTierBird(bird);
      rtEl.textContent = rt.label;
      rtEl.className = 'rarity-badge rarity-tier-' + rt.tier;
      rtEl.style.display = 'inline-block';
    } else {
      rtEl.style.display = 'none';
    }
  }

  const typeEl = document.getElementById('bird-feedback-type');
  if (typeEl) {
    typeEl.textContent = bird.type || '';
    typeEl.style.display = bird.type ? 'inline-block' : 'none';
  }

  const nameEnEl = document.getElementById('bird-feedback-name-en');
  if (nameEnEl) nameEnEl.textContent = bird.nameEn;

  const nameLaEl = document.getElementById('bird-feedback-name-la');
  if (nameLaEl) nameLaEl.textContent = bird.nameLa;

  const traitEl = document.getElementById('bird-feedback-trait');
  if (traitEl) traitEl.textContent = bird.trait;

  const infoEl = document.getElementById('bird-feedback-info');
  if (infoEl) infoEl.textContent = bird.info;

  const confEl = document.getElementById('bird-feedback-confusion');
  if (confEl) {
    if (!correct && bird.confusesWith && bird.confusionTip) {
      confEl.innerHTML = '⚠️ Mange forveksler denne med <strong>' + bird.confusesWith + '</strong>: ' + bird.confusionTip;
      confEl.style.display = 'block';
    } else {
      confEl.style.display = 'none';
    }
  }

  const newDisc = document.getElementById('bird-new-discovery');
  if (newDisc) {
    const isNewDisc = correct && bird._isNewDiscovery;
    newDisc.style.display = isNewDisc ? 'block' : 'none';
  }

  const btnNext = document.getElementById('bird-btn-next');
  if (btnNext) btnNext.textContent = correct ? 'Neste fugl →' : 'Se poengsum →';

  showBirdScreen('screen-bird-feedback');
}

function nextBirdQuestion() {
  if (birdLives <= 0) {
    endBirdGame();
  } else {
    showBirdScreen('screen-bird-quiz');
    birdLoadQuestion();
  }
}

async function endBirdGame() {
  clearInterval(birdTimerInterval);
  const elapsed = Math.floor((Date.now() - birdGameStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const finalScoreEl = document.getElementById('bird-final-score');
  if (finalScoreEl) finalScoreEl.textContent = birdScore;

  const finalStatsEl = document.getElementById('bird-final-stats');
  if (finalStatsEl) {
    finalStatsEl.innerHTML = `
      <div class="stat-row"><span>Riktige svar</span><strong>${birdTotalCorrect} / ${birdQuestionCount}</strong></div>
      <div class="stat-row"><span>Tid brukt</span><strong>${mins}m ${secs}s</strong></div>
      <div class="stat-row"><span>Nye oppdagelser</span><strong>${birdDiscoveredThisSession.size} fugler</strong></div>
      <div class="stat-row"><span>Galleri totalt</span><strong>${birdAllDiscovered.size} / 46</strong></div>
    `;
  }

  localStorage.setItem('birdquiz_hasplayed', '1');
  birdUpdateGalleryButton();
  birdUpdateProgressText();

  const newBirdDot = document.getElementById('bird-gameover-newbird-dot');
  if (newBirdDot) {
    newBirdDot.style.display = localStorage.getItem('birdquiz_newbird') === '1' ? 'inline-block' : 'none';
  }

  // Submit to Supabase
  const nameInput = document.getElementById('bird-player-name');
  const playerName = nameInput ? nameInput.value.trim() : 'Anonym';
  try {
    await supabaseClient.from('leaderboard_birds').insert([{ name: playerName, score: birdScore, week: getWeekKey() }]);
  } catch(e) { console.log('Leaderboard error:', e); }

  showBirdScreen('screen-bird-gameover');
}

// ── Gallery ───────────────────────────────────────────────
function renderBirdGallery() {
  const grid = document.getElementById('bird-gallery-grid');
  const count = document.getElementById('bird-gallery-count');
  if (count) count.textContent = `${birdAllDiscovered.size} / 46`;

  if (!grid) return;
  grid.innerHTML = [...BIRD_DATA].sort((a,b) => (a.rarity||99)-(b.rarity||99)).map(bird => {
    const rt = getRarityTierBird(bird);
    const discovered = birdAllDiscovered.has(bird.id);
    return `
      <div class="gallery-card ${discovered ? 'discovered' : 'undiscovered'} rarity-card-${rt.tier}"
           onclick="${discovered ? `openBirdModal('${bird.id}')` : ''}">
        <div class="gallery-card-inner">
          ${discovered
            ? `<img src="images/fugler/${bird.folder}_${birdDiscoveredImages[bird.id] || 1}.jpg" alt="${bird.nameNo}" loading="lazy" />`
            : `<div class="undiscovered-icon">?</div>`
          }
          ${discovered ? `<div class="gallery-card-rarity rarity-tier-${rt.tier}-text">${rt.label}</div>` : ''}
          <div class="gallery-card-name">${discovered ? bird.nameNo : '???'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openBirdModal(birdId) {
  const bird = BIRD_BY_ID[birdId];
  if (!bird) return;
  const rt = getRarityTierBird(bird);

  document.getElementById('modal-bird-img').src = `images/fugler/${bird.folder}_${birdDiscoveredImages[bird.id] || 1}.jpg`;
  document.getElementById('modal-bird-name-no').textContent = bird.nameNo;
  document.getElementById('modal-bird-name-en').textContent = bird.nameEn;
  document.getElementById('modal-bird-name-la').textContent = bird.nameLa;
  document.getElementById('modal-bird-trait').textContent = bird.trait;
  document.getElementById('modal-bird-info').textContent = bird.info;
  const rarEl = document.getElementById('modal-bird-rarity');
  if (rarEl) { rarEl.textContent = rt.label; rarEl.className = 'rarity-badge rarity-tier-' + rt.tier; }

  document.getElementById('modal-bird').style.display = 'flex';
}

function closeBirdModal() {
  document.getElementById('modal-bird').style.display = 'none';
}

function birdUpdateGalleryButton() {
  const hasPlayed = localStorage.getItem('birdquiz_hasplayed');
  const btn = document.getElementById('btn-show-bird-gallery-splash');
  if (!btn) return;
  btn.disabled = !hasPlayed;
  btn.style.opacity = hasPlayed ? '1' : '0.4';
  btn.style.cursor = hasPlayed ? 'pointer' : 'not-allowed';
}

// ── Leaderboard ───────────────────────────────────────────
let currentBirdLeaderboardTab = 'weekly';

async function loadBirdLeaderboard(tab = 'weekly') {
  currentBirdLeaderboardTab = tab;
  const list = document.getElementById('bird-leaderboard-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Laster...</div>';

  try {
    let query = supabaseClient.from('leaderboard_birds').select('name, score, week').order('score', { ascending: false }).limit(200);
    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];
    if (tab === 'weekly') {
      const wk = getWeekKey();
      rows = rows.filter(r => r.week === wk).slice(0, 10);
    } else {
      rows = rows.slice(0, 10);
    }

    if (rows.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Ingen resultater ennå</div>';
      return;
    }

    list.innerHTML = rows.map((r, i) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank">${i + 1}</span>
        <span class="leaderboard-name">${r.name}</span>
        <span class="leaderboard-score">${r.score}</span>
      </div>
    `).join('');
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Kunne ikke laste ledertavle</div>';
  }
}

function switchBirdLeaderboardTab(tab) {
  currentBirdLeaderboardTab = tab;
  document.getElementById('bird-tab-weekly').className = 'tab-btn' + (tab === 'weekly' ? ' tab-active' : '');
  document.getElementById('bird-tab-alltime').className = 'tab-btn' + (tab === 'alltime' ? ' tab-active' : '');
  loadBirdLeaderboard(tab);
}

// ── Screen navigation ─────────────────────────────────────
function showBirdScreen(id) {
  const birdScreenIds = [
    'screen-bird-splash','screen-bird-quiz','screen-bird-feedback',
    'screen-bird-gameover','screen-bird-gallery','screen-bird-leaderboard'
  ];
  birdScreenIds.forEach(sid => {
    const s = document.getElementById(sid);
    if (s) s.classList.remove('active');
  });
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ── Init ──────────────────────────────────────────────────
function initBirdQuiz() {
  birdLoadDiscovered();
  birdUpdateProgressText();
  birdUpdateGalleryButton();

  const btnStart = document.getElementById('btn-start-bird-game');
  if (btnStart) btnStart.addEventListener('click', startBirdGame);

  const btnGallery = document.getElementById('btn-show-bird-gallery-splash');
  if (btnGallery) btnGallery.addEventListener('click', () => {
    if (!localStorage.getItem('birdquiz_hasplayed')) return;
    localStorage.removeItem('birdquiz_newbird');
    renderBirdGallery();
    showBirdScreen('screen-bird-gallery');
  });

  const btnGalleryGo = document.getElementById('btn-show-bird-gallery-go');
  if (btnGalleryGo) btnGalleryGo.addEventListener('click', () => {
    localStorage.removeItem('birdquiz_newbird');
    renderBirdGallery();
    showBirdScreen('screen-bird-gallery');
  });

  const btnBackGallery = document.getElementById('btn-bird-gallery-back');
  if (btnBackGallery) btnBackGallery.addEventListener('click', () => showBirdScreen('screen-bird-splash'));

  const btnNext = document.getElementById('bird-btn-next');
  if (btnNext) btnNext.addEventListener('click', nextBirdQuestion);

  const btnRestart = document.getElementById('btn-bird-restart');
  if (btnRestart) btnRestart.addEventListener('click', () => showBirdScreen('screen-bird-splash'));

  const btnLeaderboard = document.getElementById('btn-show-bird-leaderboard-splash');
  if (btnLeaderboard) btnLeaderboard.addEventListener('click', () => {
    loadBirdLeaderboard('weekly');
    showBirdScreen('screen-bird-leaderboard');
  });

  const btnLeaderboardGo = document.getElementById('btn-show-bird-leaderboard-go');
  if (btnLeaderboardGo) btnLeaderboardGo.addEventListener('click', () => {
    loadBirdLeaderboard('weekly');
    showBirdScreen('screen-bird-leaderboard');
  });

  const btnLeaderboardBack = document.getElementById('btn-bird-leaderboard-back');
  if (btnLeaderboardBack) btnLeaderboardBack.addEventListener('click', () => showBirdScreen('screen-bird-splash'));

  const modalBird = document.getElementById('modal-bird');
  if (modalBird) modalBird.addEventListener('click', (e) => { if (e.target === modalBird) closeBirdModal(); });
}
