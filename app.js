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
let timeLeft = 20;
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
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });

  document.getElementById('btn-show-gallery-splash').addEventListener('click', () => {
    const hasPlayed = localStorage.getItem('fiskequiz_hasplayed');
    if (!hasPlayed) {
      const nameInput = document.getElementById('player-name').value.trim();
      if (!nameInput) {
        alert('Skriv inn navnet ditt og spill minst én runde for å låse opp galleriet!');
        document.getElementById('player-name').focus();
        return;
      }
      alert('Spill minst én runde for å låse opp galleriet!');
      return;
    }
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
function loadQuestion() {
  if (lives <= 0) { endGame(); return; }

  // Pick a random fish
  const shuffled = [...FISH_DATA].sort(() => Math.random() - 0.5);
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

  // Generate 4 options (1 correct + 3 random wrong)
  const wrong = shuffled.slice(1, 4);
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
  timeLeft = 20;
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
  showFeedback(false, null);
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
    if (!allDiscovered.has(currentFish.id)) {
      allDiscovered.add(currentFish.id);
      discoveredFish.add(currentFish.id);
      saveDiscovered();
    }
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

  const hearts = ['❤️', '❤️', '❤️'];
  const livesHTML = hearts.map((h, i) => {
    return `<span class="heart ${i >= lives ? 'lost' : ''}">${i < lives ? '❤️' : '🖤'}</span>`;
  }).join('');
  document.getElementById('lives-display').innerHTML = livesHTML;

  const streakEl = document.getElementById('streak-display');
  streakEl.style.opacity = '0';
}

// ============================================================
// FEEDBACK SCREEN
// ============================================================
function showFeedback(correct, fishId) {
  const fish = currentFish;

  document.getElementById('feedback-icon').textContent = correct ? '✅' : '❌';
  document.getElementById('feedback-title').textContent = correct
    ? (streak > 1 ? `🔥 ${streak}x streak! +${100 + Math.floor(timeLeft * 10) + (streak - 1) * 50} poeng` : 'Riktig!')
    : 'Beklager – det var feil!';

  // Fish card
  document.getElementById('feedback-fish-img').src = currentImageFile;
  document.getElementById('feedback-name-no').textContent = fish.nameNo;
  document.getElementById('feedback-name-en').textContent = fish.nameEn;
  document.getElementById('feedback-name-la').textContent = fish.nameLa;
  document.getElementById('feedback-trait').textContent = fish.trait;
  document.getElementById('feedback-info').textContent = fish.info;

  const newDisc = document.getElementById('new-discovery');
  const isNewDisc = discoveredFish.has(fish.id) && correct;
  newDisc.style.display = isNewDisc ? 'block' : 'none';
  if (isNewDisc) setTimeout(triggerSparkle, 300);

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
async function loadLeaderboard() {
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
      <div class="lb-row ${row.player_name === playerName ? 'lb-you' : ''}">
        <div class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
        <div class="lb-name">${escapeHtml(row.player_name)}</div>
        <div class="lb-score">${Number(row.score).toLocaleString('no')}</div>
        <div class="lb-detail">${row.correct}/${row.questions} riktige</div>
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
  count.textContent = `${allDiscovered.size} / 30`;

  grid.innerHTML = FISH_DATA.map(fish => {
    const discovered = allDiscovered.has(fish.id);
    return `
      <div class="gallery-card ${discovered ? 'discovered' : 'undiscovered'}" 
           onclick="${discovered ? `openFishModal('${fish.id}')` : ''}">
        <div class="gallery-card-inner">
          ${discovered
            ? `<img src="images/${fish.folder}_${discoveredImages[fish.id] || 1}.jpg" alt="${fish.nameNo}" loading="lazy" />`
            : `<div class="undiscovered-icon">?</div>`
          }
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
