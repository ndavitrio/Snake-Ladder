/* ════════════════════════════════════════════════════════════════════
   Snake & Quiz – Multiplayer Snakes & Ladders with Quiz
   Firebase Realtime Database + Vanilla JS
   ════════════════════════════════════════════════════════════════════

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create a project → Enable Realtime Database (test mode for dev)
   3. Replace the FIREBASE_CONFIG object below with your project's config
   4. Deploy to GitHub Pages: push index.html, style.css, script.js
      → Settings → Pages → Deploy from branch (main / root)
   ════════════════════════════════════════════════════════════════════ */

/* ─── Firebase Configuration ─────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA6g-BQBRFB8CnN75aRYZiDZDeU_52d3hM",
  authDomain:        "snake-ladder-dd026.firebaseapp.com",
  databaseURL:       "https://snake-ladder-dd026-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId:         "snake-ladder-dd026",
  storageBucket:     "snake-ladder-dd026.firebasestorage.app",
  messagingSenderId: "278761980230",
  appId:             "1:278761980230:web:8965793b58d4830f9ce547"
};

/* ─── Board Layout Constants ─────────────────────────────────────── */
const BOARD_SIZE   = 10;           // 10×10 grid  (tiles 1–100)
const TOTAL_TILES  = 100;
const QUIZ_TILES   = new Set([5,12,18,25,32,38,44,51,58,65,72,78,85,92]);

/* Snakes: head → tail */
const SNAKES = {
  97: 78, 95: 56, 87: 24, 64: 60,
  54: 34, 47: 26, 43: 18, 35: 8
};

/* Ladders: foot → top */
const LADDERS = {
  4: 14, 9: 31, 20: 38, 28: 84,
  40: 59, 51: 67, 63: 81, 71: 91
};

/* Player tokens (emoji) and colours (must match CSS vars order) */
const PLAYER_COLORS  = ["#f5a623", "#4cc9f0", "#f72585", "#7fff6b"];
const PLAYER_TOKENS  = ["🟡", "🔵", "🔴", "🟢"];
const DICE_FACES     = ["⚀","⚁","⚂","⚃","⚄","⚅"];

/* ─── Quiz Bank ──────────────────────────────────────────────────── */
const QUIZ_BANK = [
  { q:"What is 7 × 8?", opts:["54","56","64","48"], ans:1 },
  { q:"Which planet is closest to the Sun?", opts:["Venus","Earth","Mercury","Mars"], ans:2 },
  { q:"What is the capital of Japan?", opts:["Beijing","Seoul","Tokyo","Bangkok"], ans:2 },
  { q:"How many sides does a hexagon have?", opts:["5","6","7","8"], ans:1 },
  { q:"What gas do plants absorb from the air?", opts:["Oxygen","Nitrogen","CO₂","Hydrogen"], ans:2 },
  { q:"Who wrote Romeo and Juliet?", opts:["Dickens","Shakespeare","Hemingway","Tolstoy"], ans:1 },
  { q:"What is the square root of 144?", opts:["11","12","13","14"], ans:1 },
  { q:"Which ocean is the largest?", opts:["Atlantic","Indian","Arctic","Pacific"], ans:3 },
  { q:"HTML stands for…?", opts:["HyperText Markup Language","HighText Machine Language","Hyperlink & Text Markup","HyperText Modern Language"], ans:0 },
  { q:"What colour do you get mixing blue + yellow?", opts:["Purple","Orange","Green","Brown"], ans:2 },
  { q:"In what year did World War II end?", opts:["1943","1944","1945","1946"], ans:2 },
  { q:"How many bones are in the adult human body?", opts:["196","206","216","226"], ans:1 },
  { q:"What is the chemical symbol for gold?", opts:["Go","Gd","Au","Ag"], ans:2 },
  { q:"Which continent is Egypt in?", opts:["Asia","Europe","Africa","South America"], ans:2 },
  { q:"What is 15² ?", opts:["200","215","225","235"], ans:2 },
  { q:"Speed of light is approximately…?", opts:["300,000 km/s","30,000 km/s","3,000 km/s","300 km/s"], ans:0 },
  { q:"Which language runs in the browser natively?", opts:["Python","Java","Ruby","JavaScript"], ans:3 },
  { q:"What is the powerhouse of the cell?", opts:["Nucleus","Ribosome","Mitochondria","Golgi"], ans:2 },
  { q:"How many planets are in our solar system?", opts:["7","8","9","10"], ans:1 },
  { q:"What does CPU stand for?", opts:["Core Processing Unit","Central Processing Unit","Computer Personal Unit","Central Program Utility"], ans:1 },
];

/* ══════════════════════════════════════════════════════════════════
   APP STATE
══════════════════════════════════════════════════════════════════ */
let db;                  // Firebase database ref
let roomRef;             // Firebase ref for current room
let localPlayerId = null; // index 0-3 for this browser
let roomCode      = null;
let isHost        = false;
let gameState     = null; // mirrored from Firebase
let unsubscribe   = null; // Firebase listener unsubscribe fn

/* Canvas drawing */
let canvas, ctx;
const CELL = 60; // cell size in px (resized dynamically)

/* ══════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  initLobbyUI();

  canvas = document.getElementById("board-canvas");
  ctx    = canvas.getContext("2d");
});

function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch (e) {
    showLobbyError("Firebase init failed. Check your config in script.js.");
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════════
   LOBBY UI
══════════════════════════════════════════════════════════════════ */
function initLobbyUI() {
  /* Tab switching */
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  /* Player count selection */
  document.querySelectorAll(".count-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".count-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("btn-create").addEventListener("click", handleCreate);
  document.getElementById("btn-join").addEventListener("click", handleJoin);

  /* Allow Enter key on code input */
  document.getElementById("join-code").addEventListener("keydown", e => {
    if (e.key === "Enter") handleJoin();
  });
}

function handleCreate() {
  const name = document.getElementById("create-name").value.trim();
  if (!name) { showLobbyError("Enter your name."); return; }
  const maxPlayers = parseInt(document.querySelector(".count-btn.active").dataset.count);
  const code = generateRoomCode();
  createRoom(code, name, maxPlayers);
}

function handleJoin() {
  const name = document.getElementById("join-name").value.trim();
  const code = document.getElementById("join-code").value.trim().toUpperCase();
  if (!name) { showLobbyError("Enter your name."); return; }
  if (code.length !== 6) { showLobbyError("Enter a valid 6-character room code."); return; }
  joinRoom(code, name);
}

function showLobbyError(msg) {
  const el = document.getElementById("lobby-error");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

/* ══════════════════════════════════════════════════════════════════
   ROOM MANAGEMENT
══════════════════════════════════════════════════════════════════ */
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createRoom(code, hostName, maxPlayers) {
  if (!db) { showLobbyError("Firebase not connected."); return; }
  roomCode = code;
  isHost   = true;
  localPlayerId = 0;

  const initialState = {
    roomCode,
    maxPlayers,
    status: "waiting",    // waiting | playing | finished
    currentTurn: 0,       // index of whose turn it is
    winner: null,
    players: {
      0: { name: hostName, position: 0, active: true, color: PLAYER_COLORS[0] }
    },
    dice: { value: null, rolling: false },
    quiz: { active: false, tileIndex: null, questionIndex: null, answered: false },
    log: [],
    lastAction: null,
  };

  roomRef = db.ref(`rooms/${code}`);
  await roomRef.set(initialState);

  // Clean up on disconnect (host leaving)
  roomRef.onDisconnect().remove();

  subscribeToRoom();
  showScreen("screen-waiting");
  document.getElementById("display-room-code").textContent = code;
  setupWaitingButtons();
}

async function joinRoom(code, playerName) {
  if (!db) { showLobbyError("Firebase not connected."); return; }
  const snap = await db.ref(`rooms/${code}`).get();
  if (!snap.exists()) { showLobbyError("Room not found."); return; }

  const state = snap.val();
  if (state.status !== "waiting") { showLobbyError("Game already started."); return; }

  const existingPlayers = state.players ? Object.keys(state.players).map(Number) : [];
  if (existingPlayers.length >= state.maxPlayers) { showLobbyError("Room is full."); return; }

  /* Assign next available slot */
  let slot = 0;
  while (existingPlayers.includes(slot)) slot++;

  roomCode      = code;
  localPlayerId = slot;
  isHost        = false;

  roomRef = db.ref(`rooms/${code}`);
  await roomRef.child(`players/${slot}`).set({
    name: playerName, position: 0, active: true, color: PLAYER_COLORS[slot]
  });

  subscribeToRoom();
  showScreen("screen-waiting");
  document.getElementById("display-room-code").textContent = code;
  setupWaitingButtons();
}

function setupWaitingButtons() {
  document.getElementById("btn-copy-code").onclick = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    document.getElementById("btn-copy-code").textContent = "✅";
    setTimeout(() => document.getElementById("btn-copy-code").textContent = "📋", 1500);
  };

  document.getElementById("btn-start").onclick = startGame;
  document.getElementById("btn-leave-lobby").onclick = leaveRoom;
}

function leaveRoom() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (roomRef) {
    if (isHost) {
      roomRef.remove();
    } else {
      roomRef.child(`players/${localPlayerId}`).remove();
    }
    roomRef = null;
  }
  resetLocalState();
  showScreen("screen-lobby");
}

/* ══════════════════════════════════════════════════════════════════
   FIREBASE SUBSCRIPTION (single source of truth)
══════════════════════════════════════════════════════════════════ */
function subscribeToRoom() {
  if (unsubscribe) unsubscribe();

  const listener = roomRef.on("value", snap => {
    if (!snap.exists()) {
      /* Room was deleted (host left) */
      resetLocalState();
      showScreen("screen-lobby");
      return;
    }
    gameState = snap.val();
    renderState(gameState);
  });

  /* Store unsubscribe function */
  unsubscribe = () => roomRef.off("value", listener);
}

/* ══════════════════════════════════════════════════════════════════
   STATE RENDERER  – decides which screen to show and updates UI
══════════════════════════════════════════════════════════════════ */
function renderState(state) {
  if (state.status === "waiting") {
    renderWaiting(state);
  } else if (state.status === "playing") {
    showScreen("screen-game");
    renderGame(state);
  } else if (state.status === "finished") {
    renderWinner(state);
  }
}

/* ─── Waiting Screen ───────────────────────────────────────────── */
function renderWaiting(state) {
  const players   = state.players || {};
  const playerArr = Object.entries(players);
  const maxP      = state.maxPlayers;

  const container = document.getElementById("waiting-players");
  container.innerHTML = "";

  playerArr.forEach(([idx, p]) => {
    const row = document.createElement("div");
    row.className = "waiting-player-row";
    const isMe = Number(idx) === localPlayerId;
    row.innerHTML = `
      <div class="waiting-player-dot" style="background:${p.color}"></div>
      <span class="waiting-player-name">${escHtml(p.name)}${isMe ? " (you)" : ""}</span>
      ${Number(idx) === 0 ? '<span class="waiting-player-host">HOST</span>' : ""}
    `;
    container.appendChild(row);
  });

  const statusEl = document.getElementById("waiting-status");
  const startBtn = document.getElementById("btn-start");

  if (playerArr.length < 2) {
    statusEl.textContent = `Waiting for at least 2 players… (${playerArr.length}/${maxP})`;
    startBtn.classList.add("hidden");
  } else if (playerArr.length < maxP) {
    statusEl.textContent = `${playerArr.length}/${maxP} players joined. Host can start now.`;
    if (isHost) startBtn.classList.remove("hidden");
  } else {
    statusEl.textContent = `Room full (${maxP}/${maxP}). Ready to start!`;
    if (isHost) startBtn.classList.remove("hidden");
  }
}

/* ─── Game Screen ──────────────────────────────────────────────── */
function renderGame(state) {
  /* HUD */
  document.getElementById("hud-room").innerHTML =
    `Room <span>${state.roomCode}</span>`;

  const players   = state.players || {};
  const playerArr = Object.entries(players).sort((a,b) => Number(a[0]) - Number(b[0]));
  const myTurn    = state.currentTurn === localPlayerId;
  const curPlayer = players[state.currentTurn];

  document.getElementById("hud-turn").textContent =
    myTurn ? "🎯 Your turn!" : `${curPlayer ? curPlayer.name : "?"}'s turn`;

  /* Player chips */
  const chipsEl = document.getElementById("hud-players");
  chipsEl.innerHTML = "";
  playerArr.forEach(([idx, p]) => {
    const chip = document.createElement("div");
    chip.className = `hud-player-chip${Number(idx) === state.currentTurn ? " active-chip" : ""}`;
    chip.innerHTML = `
      <div class="chip-dot" style="background:${p.color}"></div>
      <span>${escHtml(p.name)}</span>
      <span class="chip-pos">${p.position === 0 ? "Start" : `#${p.position}`}</span>
    `;
    chipsEl.appendChild(chip);
  });

  /* Dice */
  const diceEl   = document.getElementById("dice-display");
  const rollBtn  = document.getElementById("btn-roll");
  const statusEl = document.getElementById("roll-status");

  if (state.dice.value !== null) {
    diceEl.textContent = DICE_FACES[state.dice.value - 1];
  }

  /* Only show roll button if: my turn, no active quiz, game playing */
  const quizActive = state.quiz && state.quiz.active;
  const canRoll    = myTurn && !quizActive && state.status === "playing";
  rollBtn.disabled = !canRoll;
  if (quizActive && myTurn) {
    statusEl.textContent = "Answer the quiz first!";
  } else if (myTurn) {
    statusEl.textContent = "It's your turn – roll!";
  } else {
    statusEl.textContent = `Waiting for ${curPlayer ? curPlayer.name : ""}…`;
  }

  /* Quiz panel */
  renderQuizPanel(state);

  /* Board */
  drawBoard(state);

  /* Log */
  renderLog(state.log);
}

/* ─── Quiz Panel ───────────────────────────────────────────────── */
function renderQuizPanel(state) {
  const quizPanel = document.getElementById("quiz-panel");
  const quiz = state.quiz;

  if (!quiz || !quiz.active) {
    quizPanel.classList.add("hidden");
    return;
  }

  quizPanel.classList.remove("hidden");
  const q = QUIZ_BANK[quiz.questionIndex];

  document.getElementById("quiz-question").textContent = q.q;

  const optsEl  = document.getElementById("quiz-options");
  const resultEl = document.getElementById("quiz-result");
  optsEl.innerHTML = "";

  const myTurn   = state.currentTurn === localPlayerId;
  const answered = quiz.answered;

  q.opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className  = "quiz-opt";
    btn.textContent = opt;
    btn.disabled   = answered || !myTurn;

    if (answered) {
      if (i === q.ans)       btn.classList.add("correct");
      if (i === quiz.chosen && i !== q.ans) btn.classList.add("wrong");
    }

    if (!answered && myTurn) {
      btn.addEventListener("click", () => submitQuizAnswer(i, q));
    }
    optsEl.appendChild(btn);
  });

  resultEl.classList.add("hidden");
  if (answered) {
    resultEl.classList.remove("hidden");
    if (quiz.chosen === q.ans) {
      resultEl.textContent = "✅ Correct! Bonus turn awarded.";
      resultEl.className   = "quiz-result good";
    } else {
      resultEl.textContent = "❌ Wrong! Moving back 1 space.";
      resultEl.className   = "quiz-result bad";
    }
  }
}

/* ─── Game Log ─────────────────────────────────────────────────── */
function renderLog(log) {
  const logEl = document.getElementById("game-log");
  if (!log) return;
  const entries = Object.values(log).slice(-40); // last 40
  logEl.innerHTML = "";
  entries.reverse().forEach(entry => {
    const el = document.createElement("div");
    el.className  = `log-entry${entry.type ? " log-"+entry.type : ""}`;
    el.innerHTML  = entry.text;
    logEl.appendChild(el);
  });
}

/* ─── Winner Screen ────────────────────────────────────────────── */
function renderWinner(state) {
  showScreen("screen-winner");
  const winner = state.players[state.winner];
  document.getElementById("winner-name").textContent = winner ? winner.name : "???";

  /* Leaderboard by position descending */
  const sorted = Object.entries(state.players)
    .sort((a,b) => b[1].position - a[1].position);

  const lb = document.getElementById("final-leaderboard");
  lb.innerHTML = "";
  const medals = ["🥇","🥈","🥉","🏅"];
  sorted.forEach(([idx, p], rank) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `
      <span class="lb-rank">${medals[rank] || (rank+1)}</span>
      <div class="lb-dot" style="background:${p.color}"></div>
      <span class="lb-name">${escHtml(p.name)}</span>
      <span class="lb-pos">Tile ${p.position}</span>
    `;
    lb.appendChild(row);
  });

  launchConfetti();

  document.getElementById("btn-play-again").onclick = () => {
    if (isHost) restartGame();
  };
  document.getElementById("btn-new-room").onclick = () => {
    leaveRoom();
    showScreen("screen-lobby");
  };

  /* Non-host gets play again button disabled unless host restarts */
  if (!isHost) document.getElementById("btn-play-again").disabled = true;
}

/* ══════════════════════════════════════════════════════════════════
   GAME ACTIONS  (write to Firebase)
══════════════════════════════════════════════════════════════════ */

/* ─── Start Game ───────────────────────────────────────────────── */
async function startGame() {
  if (!isHost || !roomRef) return;
  const snap = await roomRef.child("players").get();
  const players = snap.val() || {};
  if (Object.keys(players).length < 2) { alert("Need at least 2 players."); return; }

  await roomRef.update({
    status: "playing",
    currentTurn: 0,
    winner: null,
    dice: { value: null, rolling: false },
    quiz: { active: false },
    log: { 0: { text: "🎮 Game started! Good luck everyone.", type: "system" } },
  });
}

/* ─── Roll Dice ────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-roll").addEventListener("click", handleRoll);
});

async function handleRoll() {
  if (!gameState || gameState.currentTurn !== localPlayerId) return;
  if (gameState.quiz && gameState.quiz.active)               return;

  const value = Math.floor(Math.random() * 6) + 1;

  /* Animate dice locally */
  const diceEl = document.getElementById("dice-display");
  diceEl.classList.add("rolling");
  setTimeout(() => diceEl.classList.remove("rolling"), 620);

  /* Save roll to Firebase */
  await roomRef.update({ "dice/value": value, "dice/rolling": true });

  /* Short delay, then process movement */
  setTimeout(() => processMove(value), 700);
}

/* ─── Process Movement ──────────────────────────────────────────── */
async function processMove(roll) {
  const state   = gameState;
  const pidx    = localPlayerId;
  const player  = state.players[pidx];
  let   newPos  = player.position + roll;
  const logKey  = Date.now();
  const updates = {};

  /* Can't overshoot 100 */
  if (newPos > TOTAL_TILES) newPos = player.position;

  const playerName = player.name;
  updates[`dice/rolling`] = false;
  updates[`log/${logKey}`] = {
    text: `<span class="log-who" style="color:${player.color}">${escHtml(playerName)}</span> rolled a <b>${roll}</b> → tile ${newPos}.`,
    type: ""
  };
  updates[`players/${pidx}/position`] = newPos;

  /* Check WIN */
  if (newPos === TOTAL_TILES) {
    updates["status"]  = "finished";
    updates["winner"]  = pidx;
    updates[`log/${logKey+1}`] = {
      text: `🏆 <span class="log-who" style="color:${player.color}">${escHtml(playerName)}</span> wins the game!`,
      type: "system"
    };
    await roomRef.update(updates);
    return;
  }

  /* Check QUIZ TILE */
  if (QUIZ_TILES.has(newPos)) {
    const qIdx = Math.floor(Math.random() * QUIZ_BANK.length);
    updates["quiz/active"]        = true;
    updates["quiz/tileIndex"]     = newPos;
    updates["quiz/questionIndex"] = qIdx;
    updates["quiz/answered"]      = false;
    updates["quiz/chosen"]        = -1;
    updates[`log/${logKey+2}`] = {
      text: `📚 <span class="log-who" style="color:${player.color}">${escHtml(playerName)}</span> landed on a quiz tile!`,
      type: ""
    };
    await roomRef.update(updates);
    return; // wait for quiz answer
  }

  /* Check SNAKE */
  if (SNAKES[newPos]) {
    const tail = SNAKES[newPos];
    updates[`players/${pidx}/position`] = tail;
    updates[`log/${logKey+3}`] = {
      text: `🐍 <span class="log-who" style="color:${player.color}">${escHtml(playerName)}</span> was swallowed by a snake! ${newPos} → ${tail}`,
      type: "snake"
    };
    updates["currentTurn"] = nextTurn(state);
    await roomRef.update(updates);
    return;
  }

  /* Check LADDER */
  if (LADDERS[newPos]) {
    const top = LADDERS[newPos];
    updates[`players/${pidx}/position`] = top;
    updates[`log/${logKey+4}`] = {
      text: `🪜 <span class="log-who" style="color:${player.color}">${escHtml(playerName)}</span> climbed a ladder! ${newPos} → ${top}`,
      type: "ladder"
    };
    updates["currentTurn"] = nextTurn(state);
    await roomRef.update(updates);
    return;
  }

  /* Normal move – advance turn */
  updates["currentTurn"] = nextTurn(state);
  await roomRef.update(updates);
}

/* ─── Submit Quiz Answer ────────────────────────────────────────── */
async function submitQuizAnswer(chosenIdx, question) {
  if (!gameState || gameState.currentTurn !== localPlayerId) return;

  const correct    = (chosenIdx === question.ans);
  const pidx       = localPlayerId;
  const player     = gameState.players[pidx];
  const currentPos = player.position;
  const logKey     = Date.now();
  const updates    = {};

  updates["quiz/answered"] = true;
  updates["quiz/chosen"]   = chosenIdx;

  if (correct) {
    /* Bonus turn – stays as current turn */
    updates["currentTurn"]   = pidx;
    updates["quiz/active"]   = false;
    updates[`log/${logKey}`] = {
      text: `✅ <span class="log-who" style="color:${player.color}">${escHtml(player.name)}</span> answered correctly – bonus turn!`,
      type: "good"
    };
  } else {
    /* Move back 1 */
    const penaltyPos = Math.max(1, currentPos - 1);
    updates[`players/${pidx}/position`] = penaltyPos;
    updates["currentTurn"]  = nextTurn(gameState);
    updates["quiz/active"]  = false;
    updates[`log/${logKey}`] = {
      text: `❌ <span class="log-who" style="color:${player.color}">${escHtml(player.name)}</span> answered wrong – back to ${penaltyPos}.`,
      type: "bad"
    };
  }

  /* Show result briefly before clearing quiz */
  await roomRef.update(updates);

  /* Auto-close quiz panel after 2s */
  setTimeout(async () => {
    await roomRef.update({ "quiz/active": false });
  }, 2200);
}

/* ─── Turn Logic ────────────────────────────────────────────────── */
function nextTurn(state) {
  const playerIds = Object.keys(state.players).map(Number).sort();
  const curIdx    = playerIds.indexOf(state.currentTurn);
  return playerIds[(curIdx + 1) % playerIds.length];
}

/* ─── Restart ───────────────────────────────────────────────────── */
async function restartGame() {
  if (!isHost || !roomRef) return;
  const snap = await roomRef.child("players").get();
  const players = snap.val() || {};

  /* Reset all positions */
  const resetPlayers = {};
  Object.keys(players).forEach(idx => {
    resetPlayers[idx] = { ...players[idx], position: 0 };
  });

  await roomRef.update({
    status:      "playing",
    currentTurn: 0,
    winner:      null,
    players:     resetPlayers,
    dice:        { value: null, rolling: false },
    quiz:        { active: false },
    log:         { 0: { text: "🔄 Game restarted! Good luck!", type: "system" } },
  });
}

/* ══════════════════════════════════════════════════════════════════
   CANVAS BOARD RENDERER
══════════════════════════════════════════════════════════════════ */
function drawBoard(state) {
  /* Responsive sizing */
  const wrapper = document.querySelector(".board-wrapper");
  const maxPx   = Math.min(wrapper.clientWidth - 20, wrapper.clientHeight - 20, 600);
  const cell    = Math.floor(maxPx / BOARD_SIZE);
  const totalPx = cell * BOARD_SIZE;

  canvas.width  = totalPx;
  canvas.height = totalPx;

  ctx.clearRect(0, 0, totalPx, totalPx);

  /* Draw cells */
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile   = tileNumber(row, col);
      const { x, y } = tileToXY(tile, cell);

      /* Cell background */
      const isQuiz   = QUIZ_TILES.has(tile);
      const isSnakeH = Object.keys(SNAKES).map(Number).includes(tile);
      const isLadderF= Object.keys(LADDERS).map(Number).includes(tile);

      if (isQuiz)   ctx.fillStyle = "#1a2e3d";
      else if (isSnakeH)  ctx.fillStyle = "#2a1010";
      else if (isLadderF) ctx.fillStyle = "#102218";
      else ctx.fillStyle = (row + col) % 2 === 0 ? "#182a1b" : "#1f3523";

      ctx.fillRect(x, y, cell, cell);

      /* Border */
      ctx.strokeStyle = "#2d4e32";
      ctx.lineWidth   = 1;
      ctx.strokeRect(x + .5, y + .5, cell - 1, cell - 1);

      /* Tile number */
      ctx.fillStyle  = "#5a7a5e";
      ctx.font       = `bold ${Math.max(8, cell * 0.18)}px system-ui`;
      ctx.textAlign  = "left";
      ctx.textBaseline = "top";
      ctx.fillText(tile, x + 3, y + 2);

      /* Icons for special tiles */
      const iconSize = cell * 0.38;
      ctx.font       = `${iconSize}px serif`;
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      if (isQuiz)    ctx.fillText("📚", x + cell/2, y + cell/2);
      else if (isSnakeH)  ctx.fillText("🐍", x + cell/2, y + cell/2);
      else if (isLadderF) ctx.fillText("🪜", x + cell/2, y + cell/2);
    }
  }

  /* Draw snake paths */
  drawSnakesAndLadders(cell);

  /* Draw player tokens */
  if (state && state.players) {
    drawPlayerTokens(state.players, cell);
  }
}

function drawSnakesAndLadders(cell) {
  /* Snakes */
  Object.entries(SNAKES).forEach(([head, tail]) => {
    const h = tileToXY(Number(head), cell);
    const t = tileToXY(Number(tail), cell);
    drawCurvedPath(h.x + cell/2, h.y + cell/2, t.x + cell/2, t.y + cell/2, "#e05252", 3, cell);
  });

  /* Ladders */
  Object.entries(LADDERS).forEach(([foot, top]) => {
    const f = tileToXY(Number(foot), cell);
    const tp = tileToXY(Number(top), cell);
    drawCurvedPath(f.x + cell/2, f.y + cell/2, tp.x + cell/2, tp.y + cell/2, "#f5a623", 2.5, cell);
  });
}

function drawCurvedPath(x1, y1, x2, y2, color, lineW, cell) {
  const cx = (x1 + x2) / 2 + (y2 - y1) * 0.25;
  const cy = (y1 + y2) / 2 - (x2 - x1) * 0.25;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineW;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* Arrow head at destination */
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const ahl   = cell * 0.18;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ahl * Math.cos(angle - 0.4), y2 - ahl * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - ahl * Math.cos(angle + 0.4), y2 - ahl * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle   = color;
  ctx.globalAlpha = 0.65;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPlayerTokens(players, cell) {
  const playerArr = Object.entries(players).sort((a,b) => Number(a[0]) - Number(b[0]));
  /* Group players on same tile */
  const groups = {};
  playerArr.forEach(([idx, p]) => {
    if (!groups[p.position]) groups[p.position] = [];
    groups[p.position].push({ idx: Number(idx), p });
  });

  Object.entries(groups).forEach(([pos, arr]) => {
    if (Number(pos) === 0) return; // haven't started
    const { x, y } = tileToXY(Number(pos), cell);
    const r = cell * 0.18;
    const offsets = [
      [-cell*.22, -cell*.22], [cell*.22, -cell*.22],
      [-cell*.22,  cell*.22], [cell*.22,  cell*.22],
    ];

    arr.forEach(({ idx, p }, i) => {
      const ox = (arr.length > 1 ? offsets[i][0] : 0);
      const oy = (arr.length > 1 ? offsets[i][1] : 0);
      const cx = x + cell/2 + ox;
      const cy = y + cell/2 + oy;

      /* Glow for current turn */
      if (Number(idx) === (gameState && gameState.currentTurn)) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "55";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle   = p.color;
      ctx.strokeStyle = "#000";
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();

      /* Player index label */
      ctx.fillStyle    = "#000";
      ctx.font         = `bold ${r * 1.2}px system-ui`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(idx + 1, cx, cy);
    });
  });
}

/* ─── Tile coordinate helpers ─── */
/* Tile 1 = bottom-left, 100 = top-left, snake pattern */
function tileNumber(row, col) {
  const rowFromBottom = BOARD_SIZE - 1 - row;
  if (rowFromBottom % 2 === 0) {
    return rowFromBottom * BOARD_SIZE + col + 1;
  } else {
    return rowFromBottom * BOARD_SIZE + (BOARD_SIZE - col);
  }
}

function tileToXY(tile, cell) {
  /* Reverse: given tile 1-100, find canvas x,y (top-left of cell) */
  const rowFromBottom = Math.floor((tile - 1) / BOARD_SIZE);
  const colInRow      = (tile - 1) % BOARD_SIZE;
  const row           = BOARD_SIZE - 1 - rowFromBottom;
  const col           = rowFromBottom % 2 === 0 ? colInRow : (BOARD_SIZE - 1 - colInRow);
  return { x: col * cell, y: row * cell };
}

/* ══════════════════════════════════════════════════════════════════
   CONFETTI
══════════════════════════════════════════════════════════════════ */
function launchConfetti() {
  const container = document.getElementById("confetti-container");
  container.innerHTML = "";
  const colors = ["#f5a623","#4cc9f0","#f72585","#7fff6b","#fff","#ff6b6b"];

  for (let i = 0; i < 80; i++) {
    const el       = document.createElement("div");
    el.className   = "confetti-piece";
    el.style.left  = `${Math.random() * 100}%`;
    el.style.background    = colors[Math.floor(Math.random() * colors.length)];
    el.style.width         = `${6 + Math.random() * 8}px`;
    el.style.height        = `${6 + Math.random() * 8}px`;
    el.style.borderRadius  = Math.random() > .5 ? "50%" : "2px";
    el.style.animationDuration  = `${2 + Math.random() * 3}s`;
    el.style.animationDelay     = `${Math.random() * 2}s`;
    container.appendChild(el);
  }
}

/* ══════════════════════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function resetLocalState() {
  roomCode      = null;
  isHost        = false;
  localPlayerId = null;
  gameState     = null;
  roomRef       = null;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/* Redraw board on window resize */
window.addEventListener("resize", () => {
  if (gameState && gameState.status === "playing") drawBoard(gameState);
});
