
function getWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return now.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function updateProgressText() {
  const el = document.getElementById('splash-progress');
  if (el) el.textContent = allDiscovered.size + ' / 31 fisker oppdaget';
  const el2 = document.getElementById('splash-progress-fish');
  if (el2) el2.textContent = allDiscovered.size + ' / 31 fisker oppdaget';
}

function getRarityTier(fish) {
  const r = fish.rarity || 1;
  if (r <= 6)  return { tier: 1, label: 'Vanlig' };
  if (r <= 12) return { tier: 2, label: 'Uvanlig' };
  if (r <= 19) return { tier: 3, label: 'Sjelden' };
  if (r <= 25) return { tier: 4, label: 'Meget sjelden' };
  return        { tier: 5, label: 'Ekstremt sjelden' };
}
// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = 'https://kxodetdowvwqrhjpunlf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4b2RldGRvd3Z3cXJoanB1bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTc3MzAsImV4cCI6MjA4ODgzMzczMH0.7Hl5UfSv3dqFQ0oPhd1PBTXJ5jH-eNYe6SevMQ-beLU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// GAME STATE
// ============================================================
let playerName = '';
let score = 0;
let lives = 1;
let streak = 0;
let questionCount = 0;
let currentFish = null;
let currentImageFile = null;
let currentImageNum = null;
let shownImages = {};           // { fishId: Set of image numbers shown this session }
let discoveredImages = {};      // { fishId: imageNum } 2013 which image to show in gallery
let timerInterval = null;
let timeLeft = 15;
let gameStartTime = null;
let totalCorrect = 0;
let discoveredFish = new Set(); // fish ids discovered this session
let allDiscovered = new Set();  // fish ids ever discovered (persisted in localStorage)

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadDiscovered();
  setupEventListeners();
  renderGallery();
  updateGalleryButton();
  updateProgressText();
  if (typeof initBirdQuiz === 'function') initBirdQuiz();
});

function loadDiscovered() {
  const saved = localStorage.getItem('fiskequiz_discovered');
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      allDiscovered = new Set(arr);
    } catch(e) {}
  }
}

function saveDiscovered() {
  localStorage.setItem('fiskequiz_discovered', JSON.stringify([...allDiscovered]));
}

function updateGalleryButton() {
  const hasPlayed = localStorage.getItem('fiskequiz_hasplayed');
  const btn = document.getElementById('btn-show-gallery-splash');
  if (!btn) return;
  if (hasPlayed) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    btn.title = 'Spill minst én runde for å låse opp Ditt fiskegalleri';
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.classList.add('screen-enter');
    setTimeout(() => el.classList.remove('screen-enter'), 400);
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Mode selector
  const btnModeFish = document.getElementById('btn-mode-fish');
  if (btnModeFish) btnModeFish.addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { document.getElementById('player-name').focus(); return; }
    updateProgressText();
    showScreen('screen-fish-splash');
  });
  document.getElementById('btn-mode-bird').addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { document.getElementById('player-name').focus(); return; }
    birdUpdateProgressText();
    showScreen('screen-bird-splash');
  });
  document.getElementById('btn-back-to-mode').addEventListener('click', () => showScreen('screen-splash'));
  document.getElementById('btn-back-to-mode-bird').addEventListener('click', () => showScreen('screen-splash'));
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });

  document.getElementById('btn-show-gallery-splash').addEventListener('click', () => {
    if (!localStorage.getItem('fiskequiz_hasplayed')) return;
    localStorage.removeItem('fiskequiz_newfish');
    renderGallery();
    showScreen('screen-gallery');
  });
  document.getElementById('btn-show-leaderboard-splash').addEventListener('click', () => {
    loadLeaderboard();
    showScreen('screen-leaderboard');
  });

  document.getElementById('btn-next').addEventListener('click', nextQuestion);
  document.getElementById('btn-play-again').addEventListener('click', () => showScreen('screen-splash'));
  document.getElementById('btn-show-leaderboard-go').addEventListener('click', () => {
    loadLeaderboard();
    showScreen('screen-leaderboard');
  });
  document.getElementById('btn-show-gallery-go').addEventListener('click', () => {
    renderGallery();
    showScreen('screen-gallery');
  });

  document.getElementById('btn-back-gallery').addEventListener('click', () => showScreen('screen-splash'));
  document.getElementById('btn-back-leaderboard').addEventListener('click', () => showScreen('screen-splash'));

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
}

// ============================================================
// GAME START
// ============================================================
function startGame() {
  const nameInput = document.getElementById('player-name').value.trim();
  if (!nameInput) {
    document.getElementById('player-name').classList.add('shake');
    setTimeout(() => document.getElementById('player-name').classList.remove('shake'), 500);
    document.getElementById('player-name').focus();
    return;
  }
  playerName = nameInput;
  score = 0;
  lives = 1;
  streak = 0;
  questionCount = 0;
  totalCorrect = 0;
  discoveredFish = new Set();
  shownImages = {};
  discoveredImages = {};
  gameStartTime = Date.now();

  updateHUD();
  showScreen('screen-quiz');
  loadQuestion();
}

// ============================================================
// QUESTION LOGIC
// ============================================================
// ============================================================
// VISUAL SIMILARITY GROUPS FOR ANSWER OPTIONS
// ============================================================
const VISUAL_GROUPS = [
  ['torsk', 'hyse', 'sei', 'lyr', 'hvitting', 'lysing', 'brosme', 'lange'],
  ['atlantisk_laks', 'orret', 'roye', 'harr', 'sik'],
  ['rodspette', 'kveite'],
  ['sild', 'brisling', 'makrell', 'tobis', 'oyepal'],
  ['abbor', 'gjors', 'gjedde', 'mort'],
  ['al', 'steinbit'],
  ['breiflabb', 'piggskate', 'smaflekket_rodhai', 'piggha'],
  ['uer', 'oyepal'],
];

function getGroupFor(fishId) {
  return VISUAL_GROUPS.find(g => g.includes(fishId)) || null;
}

function getWrongOptions(correctFish, count) {
  const group = getGroupFor(correctFish.id);
  const candidates = [];

  // 70% chance: pick from same group first
  if (group && Math.random() < 0.7) {
    const groupFish = FISH_DATA.filter(f => f.id !== correctFish.id && group.includes(f.id));
    candidates.push(...groupFish.sort(() => Math.random() - 0.5));
  }

  // Fill remaining slots from the rest of the list
  if (candidates.length < count) {
    const usedIds = new Set([correctFish.id, ...candidates.map(f => f.id)]);
    const rest = FISH_DATA.filter(f => !usedIds.has(f.id)).sort(() => Math.random() - 0.5);
    candidates.push(...rest);
  }

  return candidates.slice(0, count);
}

function loadQuestion() {
  if (lives <= 0) { endGame(); return; }

  // Pick a random fish
  const weighted = [];
  FISH_DATA.forEach(f => {
    const w = [8,5,3,2,1][getRarityTier(f).tier - 1];
    for (let i = 0; i < w; i++) weighted.push(f);
  });
  const shuffled = weighted
    .sort(() => Math.random() - 0.5)
    .filter((f, i, a) => a.findIndex(x => x.id === f.id) === i);
  currentFish = shuffled[0];

  // Pick a random image not yet shown this session for this fish
  const maxImg = currentFish.maxImg || 5;
  if (!shownImages[currentFish.id]) shownImages[currentFish.id] = new Set();
  const shown = shownImages[currentFish.id];
  const available = [];
  for (let i = 1; i <= maxImg; i++) {
    if (!shown.has(i)) available.push(i);
  }
  // If all images shown, reset so we can continue
  if (available.length === 0) {
    shownImages[currentFish.id] = new Set();
    for (let i = 1; i <= maxImg; i++) available.push(i);
  }
  const imgNum = available[Math.floor(Math.random() * available.length)];
  shown.add(imgNum);
  currentImageNum = imgNum;
  currentImageFile = `images/${currentFish.folder}_${imgNum}.jpg`;

  // Show loading shimmer
  const shimmer = document.getElementById('image-shimmer');
  shimmer.style.display = 'block';
  const img = document.getElementById('fish-image');
  img.style.opacity = '0';
  img.onload = () => {
    shimmer.style.display = 'none';
    img.style.transition = 'opacity 0.4s ease';
    img.style.opacity = '1';
  };
  img.onerror = () => {
    // Try image 1 as fallback
    img.src = `images/${currentFish.folder}_1.jpg`;
  };
  img.src = currentImageFile;

  // Generate 4 options (1 correct + 3 wrong, biased toward visually similar fish)
  const wrong = getWrongOptions(currentFish, 3);
  const options = [currentFish, ...wrong].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  options.forEach(fish => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = fish.nameNo;
    btn.dataset.fishId = fish.id;
    btn.addEventListener('click', () => selectAnswer(fish.id, btn));
    grid.appendChild(btn);
  });

  questionCount++;
  document.getElementById('question-counter').textContent = `Spørsmål ${questionCount}`;

  startTimer();
}

// ============================================================
// TIMER
// ============================================================
function startTimer() {
  timeLeft = 15;
  clearInterval(timerInterval);
  updateTimerBar(20, 20);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerBar(timeLeft, 20);
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timeOut();
    }
  }, 1000);
}

function updateTimerBar(current, max) {
  const bar = document.getElementById('timer-bar');
  const pct = (current / max) * 100;
  bar.style.width = pct + '%';
  if (pct > 50) bar.style.background = 'var(--accent)';
  else if (pct > 25) bar.style.background = '#f0a500';
  else bar.style.background = '#e05252';
}

function timeOut() {
  disableOptions();
  loseLife();
  streak = 0;
  updateHUD();
  showFeedback(false, null, true);
}

// ============================================================
// ANSWER HANDLING
// ============================================================
function selectAnswer(fishId, btn) {
  clearInterval(timerInterval);
  disableOptions();

  const correct = fishId === currentFish.id;

  if (correct) {
    btn.classList.add('correct');
    const points = 1;
    score += points;
    streak = 0;
    totalCorrect++;

    // Always update the gallery image to the one shown in quiz
    discoveredImages[currentFish.id] = currentImageNum;
    const isFirstDiscovery = !allDiscovered.has(currentFish.id);
    if (isFirstDiscovery) {
      allDiscovered.add(currentFish.id);
      discoveredFish.add(currentFish.id);
      saveDiscovered();
      localStorage.setItem('fiskequiz_newfish', '1');
    }
    currentFish._isNewDiscovery = isFirstDiscovery;
  } else {
    btn.classList.add('wrong');
    // Show correct answer
    document.querySelectorAll('.option-btn').forEach(b => {
      if (b.dataset.fishId === currentFish.id) b.classList.add('correct');
    });
    loseLife();
    streak = 0;
  }

  updateHUD();
  setTimeout(() => showFeedback(correct, fishId), 600);
}

function disableOptions() {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
}

function loseLife() {
  lives--;
  updateHUD();
  // Flash red overlay on quiz screen
  const wrap = document.getElementById('fish-image-wrap');
  wrap.classList.add('flash-red');
  setTimeout(() => wrap.classList.remove('flash-red'), 500);
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
  document.getElementById('score-value').textContent = score.toLocaleString('no');

  // No lives display (single life mode)

  const streakEl = document.getElementById('streak-display');
  if (streakEl) streakEl.style.opacity = '0';
}

// ============================================================
// FEEDBACK SCREEN
// ============================================================
function showFeedback(correct, fishId, isTimeout = false) {
  const fish = currentFish;

  // Toast
  const toastMsg = correct ? '✅ Riktig!' : (isTimeout ? '⏱ Tiden gikk ut!' : '❌ Feil svar');
  const toastColor = correct ? 'var(--correct)' : 'var(--wrong)';
  const toast = document.getElementById('feedback-toast');
  toast.textContent = toastMsg;
  toast.style.background = toastColor;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);

  // Card border
  const card = document.getElementById('fish-card-reveal');
  card.classList.remove('card-correct', 'card-wrong');
  card.classList.add(correct ? 'card-correct' : 'card-wrong');

  // Fish card
  document.getElementById('feedback-fish-img').src = currentImageFile;
  document.getElementById('feedback-name-no').textContent = fish.nameNo;
  const rtEl = document.getElementById('feedback-rarity');
  const typeEl = document.getElementById('feedback-type');
  if (rtEl) {
    if (correct) {
      const rt = getRarityTier(fish);
      rtEl.textContent = rt.label;
      rtEl.className = 'rarity-badge rarity-tier-' + rt.tier;
      rtEl.style.display = 'inline-block';
    } else {
      rtEl.style.display = 'none';
    }
  }
  if (typeEl) typeEl.style.display = fish.type ? 'inline-block' : 'none';

  document.getElementById('feedback-type').textContent = fish.type || '';
  document.getElementById('feedback-name-en').textContent = fish.nameEn;
  document.getElementById('feedback-name-la').textContent = fish.nameLa;
  document.getElementById('feedback-trait').textContent = fish.trait;
  document.getElementById('feedback-info').textContent = fish.info;

  const newDisc = document.getElementById('new-discovery');
  const isNewDisc = correct && fish._isNewDiscovery;
  newDisc.style.display = isNewDisc ? 'block' : 'none';
  if (isNewDisc) setTimeout(triggerSparkle, 300);

  document.getElementById('btn-next').textContent = correct ? 'Neste fisk →' : 'Se poengsum →';
  const confEl = document.getElementById('feedback-confusion');
  if (confEl) {
    if (!correct && fish.confusesWith && fish.confusionTip) {
      confEl.innerHTML = '⚠️ Mange forveksler denne med <strong>' + fish.confusesWith + '</strong>: ' + fish.confusionTip;
      confEl.style.display = 'block';
    } else {
      confEl.style.display = 'none';
    }
  }
  showScreen('screen-feedback');
}

function nextQuestion() {
  if (lives <= 0) {
    endGame();
  } else {
    showScreen('screen-quiz');
    loadQuestion();
  }
}

// ============================================================
// GAME OVER
// ============================================================
async function endGame() {
  clearInterval(timerInterval);
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  document.getElementById('final-score').textContent = score;
  document.getElementById('final-stats').innerHTML = `
    <div class="stat-row"><span>Riktige svar</span><strong>${totalCorrect} / ${questionCount}</strong></div>
    <div class="stat-row"><span>Tid brukt</span><strong>${mins}m ${secs}s</strong></div>
    <div class="stat-row"><span>Nye oppdagelser</span><strong>${discoveredFish.size} fisker</strong></div>
    <div class="stat-row"><span>Galleri totalt</span><strong>${allDiscovered.size} / 31</strong></div>
  `;

  localStorage.setItem('fiskequiz_hasplayed', '1');
  updateGalleryButton();
  updateProgressText();
  const newFishDot = document.getElementById('gameover-newfish-dot');
  if (newFishDot) newFishDot.style.display = localStorage.getItem('fiskequiz_newfish') === '1' ? 'inline-block' : 'none';
  showScreen('screen-gameover');

  // Save to Supabase
  try {
    await supabaseClient.from('leaderboard').insert({
      player_name: playerName,
      score: score,
      correct: totalCorrect,
      questions: questionCount,
      duration_seconds: elapsed
    });
  } catch(e) {
    console.warn('Leaderboard save failed:', e);
  }
}

// ============================================================
// LEADERBOARD
// ============================================================
async function loadLeaderboard(tab = 'weekly') {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<div class="loading-msg">Laster...</div>';
  await loadGlobalLeaderboard();
}

async function loadGlobalLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  try {
    const { data, error } = await supabaseClient
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML = '<div class="loading-msg">Ingen scores ennå – vær den første!</div>';
      return;
    }

    list.innerHTML = data.map((row, i) => `
      <div class="lb-row">
        <div class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
        <div class="lb-name">${row.name || 'Anonym'}</div>
        <div class="lb-score">${Number(row.score).toLocaleString('no')}</div>
      </div>
    `).join('');
  } catch(e) {
    list.innerHTML = '<div class="loading-msg">Kunne ikke laste leaderboard.</div>';
  }
}



// ============================================================
// SPARKLE ANIMATION
// ============================================================
function triggerSparkle() {
  const container = document.createElement('div');
  container.className = 'sparkle-container';
  document.body.appendChild(container);

  const colors = ['#ffd60a', '#ff9500', '#ff3b30', '#34c759', '#0071e3', '#bf5af2'];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    const angle = (i / count) * 360;
    const dist = 80 + Math.random() * 120;
    const tx = Math.cos(angle * Math.PI / 180) * dist;
    const ty = Math.sin(angle * Math.PI / 180) * dist - 60;
    s.style.cssText = `
      left: 50%; top: 55%;
      background: ${colors[i % colors.length]};
      --tx: ${tx}px; --ty: ${ty}px;
      animation-delay: ${Math.random() * 0.2}s;
      width: ${4 + Math.random() * 7}px;
      height: ${4 + Math.random() * 7}px;
    `;
    container.appendChild(s);
  }

  setTimeout(() => container.remove(), 1400);
}

// ============================================================
// GALLERY
// ============================================================
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const count = document.getElementById('gallery-count');
  count.textContent = `${allDiscovered.size} / 31`;

  grid.innerHTML = [...FISH_DATA].sort((a,b) => (a.rarity||99)-(b.rarity||99)).map(fish => {
    const rt = getRarityTier(fish);
    const discovered = allDiscovered.has(fish.id);
    return `
      <div class="gallery-card ${discovered ? 'discovered' : 'undiscovered'} rarity-card-${rt.tier}" 
           onclick="${discovered ? `openFishModal('${fish.id}')` : ''}">
        <div class="gallery-card-inner">
          ${discovered
            ? `<img src="images/${fish.folder}_${discoveredImages[fish.id] || 1}.jpg" alt="${fish.nameNo}" loading="lazy" />`
            : `<div class="undiscovered-icon">?</div>`
          }
          ${discovered ? '<div class="gallery-card-rarity rarity-tier-' + rt.tier + '-text">' + rt.label + '</div>' : ''}
          <div class="gallery-card-name">${discovered ? fish.nameNo : '???'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openFishModal(fishId) {
  const fish = FISH_BY_ID[fishId];
  if (!fish) return;

  document.getElementById('modal-fish-img').src = `images/${fish.folder}_${discoveredImages[fish.id] || 1}.jpg`;
  document.getElementById('modal-name-no').textContent = fish.nameNo;
  document.getElementById('modal-name-en').textContent = fish.nameEn;
  document.getElementById('modal-name-la').textContent = fish.nameLa;
  document.getElementById('modal-trait').textContent = fish.trait;
  document.getElementById('modal-desc').textContent = fish.info;

  const modal = document.getElementById('modal-fish');
  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-fish').classList.remove('open');
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Leaderboard tab switching ───────────────────────────
let currentLeaderboardTab = 'weekly';
function switchLeaderboardTab(tab) {
  currentLeaderboardTab = tab;
  document.getElementById('tab-weekly').className = 'tab-btn' + (tab === 'weekly' ? ' tab-active' : '');
  document.getElementById('tab-alltime').className = 'tab-btn' + (tab === 'alltime' ? ' tab-active' : '');
  const list = document.getElementById('leaderboard-list');
  if (list) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Laster...</div>';
  }
  loadLeaderboard(tab);
}
