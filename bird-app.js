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
let birdGameMode = 'relaxed';
let birdQuizType = 'sound'; // 'sprint' eller 'relaxed'
let birdScore       = 0;
let birdLives       = 1;
let birdTimeLeft    = 20;
let birdTimerInterval;
let birdRelaxedTimerInterval;
let birdRelaxedTimeElapsed = 0;
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
  if (el) el.textContent = birdAllDiscovered.size + ' / 45 fugler oppdaget';
}


function birdSetMode(mode) {
  birdGameMode = mode;
  document.getElementById('bird-toggle-sprint').classList.toggle('active', mode === 'sprint');
  document.getElementById('bird-toggle-relaxed').classList.toggle('active', mode === 'relaxed');
  const desc = document.getElementById('bird-mode-desc');
  if (desc) desc.textContent = mode === 'sprint'
    ? 'Med klokke · 20 sekunder per spørsmål'
    : 'Uten klokke · ubegrenset tid';
  var soundBtn = document.getElementById('bird-type-sound');
  var visualBtn = document.getElementById('bird-type-visual');
  if (mode === 'sprint') {
    birdQuizType = 'visual';
    if (visualBtn) { visualBtn.classList.add('active'); }
    if (soundBtn) { soundBtn.classList.remove('active'); soundBtn.style.display = 'none'; }
  } else {
    if (soundBtn) soundBtn.style.display = '';
  }
}

function birdSetType(type) {
  birdQuizType = type;
  const vBtn = document.getElementById('bird-type-visual');
  const sBtn = document.getElementById('bird-type-sound');
  if (vBtn) vBtn.classList.toggle('active', type === 'visual');
  if (sBtn) sBtn.classList.toggle('active', type === 'sound');
}

// ── Visuelle grupper for fugler ───────────────────────────
const BIRD_VISUAL_GROUPS = [
  ["graspur", "jernspurv", "bokfink", "gronnfink", "stillits"],
  ["blameis", "kjottmeis", "rodstrupe", "jernspurv"],
  ["svarttrost", "staer", "kroke", "ravn"],
  ["skjaere", "kroke", "ravn", "svartspett"],
  ["ravn", "kroke", "svartspett", "svarttrost"],
  ["gromoke", "fiskemoke", "islandsmoake"],
  ["lovsanger", "jernspurv", "graspur", "bokfink"],
  ["gjok", "spurvehauk", "tonfalk", "vandrefalk"],
  ["strandsnipe", "brushane", "smolom"],
  ["fossekall", "svarttrost", "staer"],
  ["ringdue", "kroke", "gromoke"],
  ["tonfalk", "spurvehauk", "vandrefalk", "gjok"],
  ["spurvehauk", "tonfalk", "vandrefalk", "gjok"],
  ["spurvehauk", "tonfalk", "vandrefalk"],
  ["orrhane", "storfugl", "ravn", "skjaere"],
  ["storfugl", "orrhane", "ravn"],
  ["hegre", "rosenflamingo", "smolom"],
  ["stokkand", "horndykker", "smolom"],
  ["lunde", "gromoke", "fiskemoke"],
  ["havoern", "kongeorn", "fjellvok", "spurvehauk"],
  ["sanglerke", "graspur", "jernspurv", "bokfink"],
  ["kongeorn", "havoern", "fjellvok", "vandrefalk"],
  ["vandrefalk", "tonfalk", "spurvehauk", "kongeorn"],
  ["horndykker", "stokkand", "smolom"],
  ["brushane", "strandsnipe", "smolom"],
  ["svartspett", "tretospett", "ravn", "kroke"],
  ["tretospett", "svartspett"],
  ["snougle", "fjellvok"],
  ["fjellvok", "havoern", "kongeorn", "snougle"],
  ["smolom", "stokkand", "horndykker", "strandsnipe"],
  ["islandsmoake", "gromoke", "fiskemoke"],
  ["stillits", "bokfink", "gronnfink", "graspur"],
  ["rosenflamingo", "hegre"],
  ["bieter", "stillits", "haerfugl"],
  ["vaktel", "graspur", "jernspurv"],
  ["haerfugl", "bieter", "stillits"],
  ["albatross", "gromoke", "fiskemoke", "islandsmoake"],
  ["vintererle", "strandsnipe", "fossekall"],
  ["gjok", "spurvehauk", "tonfalk"],
  ["staer", "svarttrost", "kroke"],
  ["gronnfink", "bokfink", "graspur", "stillits"],
  ["ravn", "kroke", "svarttrost", "skjaere"],
  ["lovsanger", "graspur", "jernspurv"],
  ["brushane", "strandsnipe"],
  ["sanglerke", "lovsanger", "graspur"],
  ["islandsmoake", "gromoke", "fiskemoke"],
];

function getBirdVisualGroup(bird) {
  const id = bird.id;
  for (const group of BIRD_VISUAL_GROUPS) {
    if (group.includes(id)) return group;
  }
  return null;
}

function getBirdWrongAnswers(correctBird, allBirds) {
  const group = getBirdVisualGroup(correctBird);
  let pool = [];
  if (group) {
    pool = allBirds.filter(b => b.id !== correctBird.id && group.includes(b.id));
  }
  // If not enough in group, fill with weighted random
  if (pool.length < 3) {
    const extra = allBirds.filter(b => b.id !== correctBird.id && !pool.find(p => p.id === b.id));
    const weighted = [];
    extra.forEach(f => {
      const w = [8,5,3,2,1][getRarityTierBird(f).tier - 1];
      for (let i = 0; i < w; i++) weighted.push(f);
    });
    weighted.sort(() => Math.random() - 0.5);
    const seen = new Set(pool.map(p => p.id));
    for (const b of weighted) {
      if (!seen.has(b.id)) { pool.push(b); seen.add(b.id); }
      if (pool.length >= 3) break;
    }
  }
  // Shuffle and take 3
  pool.sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
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
  birdRelaxedTimeElapsed = 0;

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
  const soundWrap = document.getElementById('bird-sound-wrap');

  if (birdQuizType === 'sound') {
    if (img) { img.style.display = 'none'; }
    if (shimmer) shimmer.style.display = 'none';
    if (soundWrap) {
      soundWrap.style.display = 'flex';
      var globalAudio = document.getElementById('bird-audio-global');
      if (globalAudio) {
        globalAudio.src = 'sounds/fugler/' + birdCurrentBird.folder + '.mp3';
        globalAudio.loop = true;
        globalAudio.load();
        globalAudio.play();
        var qBtn = document.getElementById('bird-quiz-play-btn');
        if (qBtn) qBtn.textContent = '⏸';
        globalAudio.onended = null;
      }
    }
  } else {
    if (soundWrap) soundWrap.style.display = 'none';
    if (img) { img.style.display = 'block'; }
    if (shimmer) shimmer.style.display = 'block';
    if (img) {
      img.style.opacity = '0';
      img.onload = () => {
        if (shimmer) shimmer.style.display = 'none';
        img.style.transition = 'opacity 0.4s ease';
        img.style.opacity = '1';
      };
      img.onerror = () => { img.src = 'images/fugler/' + birdCurrentBird.folder + '_1.jpg'; };
      img.src = birdCurrentImageFile;
    }
  }

  const wrong = getBirdWrongAnswers(birdCurrentBird, BIRD_DATA);
  const options = [birdCurrentBird, ...wrong].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('bird-options-grid');
  if (grid) {
    grid.innerHTML = '';
    grid.className = birdQuizType === 'sound' ? 'options-grid options-grid-image' : 'options-grid';
    options.forEach(function(bird) {
      var btn = document.createElement('button');
      if (birdQuizType === 'sound') {
        btn.className = 'option-btn option-btn-image';
        var imgNum = Math.floor(Math.random() * (bird.maxImg || 5)) + 1;
        var imgSrc = 'images/fugler/' + bird.folder + '_' + imgNum + '.jpg';
        var fallback = 'images/fugler/' + bird.folder + '_1.jpg';
        var img = document.createElement('img');
        img.src = imgSrc;
        img.alt = bird.nameNo;
        img.onerror = function() { this.src = fallback; };
        var span = document.createElement('span');
        span.textContent = bird.nameNo;
        btn.appendChild(img);
        btn.appendChild(span);
      } else {
        btn.className = 'option-btn';
        btn.textContent = bird.nameNo;
      }
      btn.dataset.birdId = bird.id;
      btn.addEventListener('click', function() { selectBirdAnswer(bird.id, btn); });
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
  clearInterval(birdRelaxedTimerInterval);

  const bar = document.getElementById('bird-timer-bar');

  if (birdGameMode === 'sprint') {
    birdTimeLeft = 20;
    if (bar) bar.style.display = 'block';
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
  } else {
    // Rolig-modus
    if (bar) bar.style.display = 'none';
    birdRelaxedTimerInterval = setInterval(() => {
      birdRelaxedTimeElapsed++;
    }, 1000);
  }
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
  clearInterval(birdRelaxedTimerInterval);
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
  if (imgEl) {
    imgEl.style.display = 'block';
    imgEl.src = birdCurrentImageFile;
  }
  var fbPlayBtn = document.getElementById('bird-feedback-play-btn');
  var globalAudio = document.getElementById('bird-audio-global');
  // Vis alltid soundDesc hvis lydmodus
  var fbSoundDescAlways = document.getElementById('bird-feedback-sound-desc');
  if (fbSoundDescAlways) {
    if (birdQuizType === 'sound') {
      fbSoundDescAlways.textContent = birdCurrentBird.soundDesc || '';
      fbSoundDescAlways.style.display = 'block';
    } else {
      fbSoundDescAlways.style.display = 'none';
    }
  }
  if (birdQuizType === 'sound') {
    if (globalAudio) {
      globalAudio.loop = false;
      globalAudio.currentTime = 0;
      globalAudio.play();
      globalAudio.onended = function() {
        if (fbPlayBtn) fbPlayBtn.textContent = '▶';
      };
    }
    if (fbPlayBtn) {
      fbPlayBtn.style.display = 'inline-flex';
      fbPlayBtn.textContent = '⏸';
    }
  } else {
    if (fbPlayBtn) fbPlayBtn.style.display = 'none';
  }

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
    if (!correct && bird.confusesWith && bird.confusionTip && birdQuizType !== 'sound') {
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

function toggleQuizAudio() {
  var audio = document.getElementById('bird-audio-global');
  var btn = document.getElementById('bird-quiz-play-btn');
  if (!audio) return;
  if (audio.paused) {
    audio.play();
    if (btn) btn.textContent = '⏸';
  } else {
    audio.pause();
    if (btn) btn.textContent = '▶';
  }
}

function toggleFeedbackAudio() {
  var audio = document.getElementById('bird-audio-global');
  var btn = document.getElementById('bird-feedback-play-btn');
  if (!audio) return;
  if (audio.paused) {
    audio.currentTime = 0;
    audio.play();
    if (btn) btn.textContent = '⏸';
  } else {
    audio.pause();
    if (btn) btn.textContent = '▶';
  }
}

function nextBirdQuestion() {
  // Stopp eventuell lyd som spilles
  var globalAudio = document.getElementById('bird-audio-global');
  if (globalAudio) { globalAudio.pause(); globalAudio.currentTime = 0; globalAudio.loop = false; globalAudio.onended = null; }

  if (birdLives <= 0) {
    endBirdGame();
  } else {
    showBirdScreen('screen-bird-quiz');
    birdLoadQuestion();
  }
}

async function endBirdGame() {
  clearInterval(birdTimerInterval);
  clearInterval(birdRelaxedTimerInterval);
  const elapsed = birdGameMode === 'sprint'
    ? Math.floor((Date.now() - birdGameStartTime) / 1000)
    : birdRelaxedTimeElapsed;
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
      <div class="stat-row"><span>Galleri totalt</span><strong>${birdAllDiscovered.size} / 45</strong></div>
    `;
  }

  localStorage.setItem('birdquiz_hasplayed', '1');
  birdUpdateGalleryButton();
  birdUpdateProgressText();

  const newBirdDot = document.getElementById('bird-gameover-newbird-dot');
  if (newBirdDot) {
    newBirdDot.style.display = localStorage.getItem('birdquiz_newbird') === '1' ? 'inline-block' : 'none';
  }

  // Submit to Supabase BEFORE showing game over screen
  const hiddenNameInput = document.getElementById('bird-player-name-hidden');
  const mainNameInput = document.getElementById('player-name');
  const playerName = (hiddenNameInput && hiddenNameInput.value.trim()) || (mainNameInput && mainNameInput.value.trim()) || 'Anonym';
  try {
    const birdTable = birdGameMode === 'sprint' ? 'leaderboard_birds' : 'leaderboard_birds_relaxed';
    await supabaseClient.from(birdTable).insert([{ name: playerName, score: birdScore, week: getWeekKey() }]);
  } catch(e) { console.log('Leaderboard error:', e); }

  // Save collector data
  try {
    var fishCount = typeof allDiscovered !== 'undefined' ? allDiscovered.size : 0;
    var birdCount = birdAllDiscovered.size;
    var total = fishCount + birdCount;
    var existing = await supabaseClient
      .from('leaderboard_collectors')
      .select('id, fish_discovered, bird_discovered')
      .eq('player_name', playerName)
      .order('total_species', { ascending: false })
      .limit(1);
    var rows = existing.data || [];
    if (rows.length > 0) {
      var best = rows[0];
      if (total > (best.fish_discovered + best.bird_discovered)) {
        await supabaseClient.from('leaderboard_collectors').update({
          fish_discovered: fishCount,
          bird_discovered: birdCount,
          total_species: total
        }).eq('id', best.id);
      }
    } else {
      await supabaseClient.from('leaderboard_collectors').insert({
        player_name: playerName,
        fish_discovered: fishCount,
        bird_discovered: birdCount,
        total_species: total,
        total_possible: 76
      });
    }
  } catch(e) {
    console.warn('Collector save failed:', e);
  }

  showBirdScreen('screen-bird-gameover');
}

// ── Gallery ───────────────────────────────────────────────
function renderBirdGallery() {
  const grid = document.getElementById('bird-gallery-grid');
  const count = document.getElementById('bird-gallery-count');
  if (count) count.textContent = `${birdAllDiscovered.size} / 45`;

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

async function loadBirdLeaderboard(tab = 'sprint') {
  currentBirdLeaderboardTab = tab;
  const list = document.getElementById('bird-leaderboard-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Laster...</div>';

  const birdLbTable = tab === 'sprint' ? 'leaderboard_birds' : 'leaderboard_birds_relaxed';
  try {
    const { data, error } = await supabaseClient
      .from(birdLbTable)
      .select('name, score')
      .order('score', { ascending: false })
      .limit(10);
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Ingen resultater ennå</div>';
      return;
    }

    list.innerHTML = rows.map((r, i) => {
      const rank = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : '#' + (i + 1);
      return '<div class="lb-row"><div class="lb-rank">' + rank + '</div><div class="lb-name">' + (r.name || 'Anonym') + '</div><div class="lb-score">' + r.score + '</div></div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Kunne ikke laste ledertavle</div>';
  }
}

function switchBirdLeaderboardTab(tab) {
  currentBirdLeaderboardTab = tab;
  document.getElementById('bird-tab-sprint').className = 'tab-btn' + (tab === 'sprint' ? ' tab-active' : '');
  document.getElementById('bird-tab-relaxed').className = 'tab-btn' + (tab === 'relaxed' ? ' tab-active' : '');
  document.getElementById('bird-tab-collectors').className = 'tab-btn' + (tab === 'collectors' ? ' tab-active' : '');
  if (tab === 'collectors') {
    loadCollectorsLeaderboard('bird-leaderboard-list');
  } else {
    loadBirdLeaderboard(tab);
  }
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
    loadBirdLeaderboard('sprint');
    showBirdScreen('screen-bird-leaderboard');
  });

  const btnLeaderboardGo = document.getElementById('btn-show-bird-leaderboard-go');
  if (btnLeaderboardGo) btnLeaderboardGo.addEventListener('click', () => {
    loadBirdLeaderboard(birdGameMode === 'sprint' ? 'sprint' : 'relaxed');
    showBirdScreen('screen-bird-leaderboard');
  });

  const btnLeaderboardBack = document.getElementById('btn-bird-leaderboard-back');
  if (btnLeaderboardBack) btnLeaderboardBack.addEventListener('click', () => showBirdScreen('screen-bird-splash'));

  const modalBird = document.getElementById('modal-bird');
  if (modalBird) modalBird.addEventListener('click', (e) => { if (e.target === modalBird) closeBirdModal(); });
}
