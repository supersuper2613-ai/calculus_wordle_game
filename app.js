// ── Topics ─────────────────────────────────────────────────────────
const TOPICS = {
  calc1: ['All', 'Limits', 'Derivatives', 'Integrals', 'Applications'],
  calc2: ['All', 'Integration Techniques', 'Series & Sequences', 'Applications', 'Polar & Parametric'],
};

// ── Game State ─────────────────────────────────────────────────────
const state = {
  mode: 'daily',
  subject: 'calc1',
  topic: 'All',
  score: 0,
  streak: 0,
  wins: 0,
  difficulty: 'medium',
  question: null,
  answered: false,
  loading: false,
  endlessRound: 0,
  seenQuestions: new Set(), // tracks question texts to prevent repeats
};

// ── Topic bar ──────────────────────────────────────────────────────
function renderTopicBar() {
  const bar = document.getElementById('topic-bar');
  bar.innerHTML = '';

  const lbl = document.createElement('span');
  lbl.className = 'bar-label';
  lbl.textContent = 'Topic';
  bar.appendChild(lbl);

  TOPICS[state.subject].forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn topic-btn' + (state.topic === t ? ' active' : '');
    btn.textContent = t;
    btn.onclick = () => setTopic(t);
    bar.appendChild(btn);
  });
}

function setTopic(t) {
  state.topic = t;
  state.endlessRound = 0;
  renderTopicBar();
  loadQuestion();
}

// ── Difficulty ─────────────────────────────────────────────────────
function getDifficulty() {
  if (state.mode === 'daily') return 'medium';
  const block = Math.floor(state.endlessRound / 5);
  return block === 0 ? 'easy' : block === 1 ? 'medium' : 'hard';
}

// ── AI Question Generator ──────────────────────────────────────────
const LOADING_MSGS = [
  'Generating question…',
  'Consulting the calculus gods…',
  'Integrating creativity…',
  'Deriving a challenge for you…',
  'Summoning a theorem…',
  'Epsilon-delta thinking…',
  'Checking convergence…',
  'Applying the chain rule…',
];

function pickLoadingMsg() {
  return LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
}

function buildPrompt(subject, difficulty, topic) {
  const subjectName = subject === 'calc1' ? 'Calculus 1' : 'Calculus 2';
  const topicLine = topic !== 'All'
    ? `Topic: ${topic}`
    : `Topic: any standard ${subjectName} topic`;

  const diffGuide = {
    easy:   'straightforward, single-concept question suitable for a student just learning the material',
    medium: 'moderately challenging question requiring application of one or two concepts',
    hard:   'challenging question requiring deeper understanding, multi-step reasoning, or synthesis of concepts',
  }[difficulty];

  const seenList = [...state.seenQuestions].slice(-30).join(' ||| ');
  const avoidLine = seenList
    ? `\n\nIMPORTANT: Do NOT generate a question similar to any of these already-seen questions:\n${seenList}`
    : '';

  return `You are a ${subjectName} professor creating a quiz question.

Generate ONE multiple-choice question with the following specs:
- Course: ${subjectName}
- ${topicLine}
- Difficulty: ${difficulty} — ${diffGuide}
- 4 answer choices (just the text values, no A/B/C/D labels)
- Exactly one correct answer
- A clear, concise explanation of why the answer is correct${avoidLine}

Respond ONLY with valid JSON in this exact format (no markdown, no backticks, no preamble):
{
  "question": "the question text",
  "topic": "specific topic name",
  "choices": ["choice1", "choice2", "choice3", "choice4"],
  "answer": "the exact correct choice text",
  "explanation": "clear explanation of why this is correct"
}

Rules:
- Use plain Unicode math (e.g. x², ∫, →, ∞, √, π, ·) not LaTeX
- The answer must exactly match one of the choices
- Make wrong choices plausible but clearly incorrect on reflection
- Keep the question concise and unambiguous`;
}

async function fetchAIQuestion() {
  const { subject, difficulty, topic } = state;
  const prompt = buildPrompt(subject, difficulty, topic);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errText}`);
  }
  const data = await response.json();

  const raw = data.content?.find(b => b.type === 'text')?.text || '';
  const clean = raw.replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(clean);

  if (!parsed.question || !parsed.choices || !parsed.answer || !parsed.explanation) {
    throw new Error('Invalid question format from AI');
  }
  if (!parsed.choices.includes(parsed.answer)) {
    throw new Error('Answer not found in choices');
  }

  return parsed;
}

// ── Load question ──────────────────────────────────────────────────
async function loadQuestion() {
  if (state.loading) return;
  state.loading = true;
  state.answered = false;
  state.difficulty = getDifficulty();

  setLoadingUI(true);
  hideError();
  document.getElementById('end-card').style.display = 'none';
  document.getElementById('choices-grid').style.display = 'none';
  document.getElementById('loading-text').textContent = pickLoadingMsg();
  lockControls(true);
  updateProgressBar();

  let question = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const q = await fetchAIQuestion();
      if (state.seenQuestions.has(q.question)) continue; // duplicate — retry
      question = q;
      state.seenQuestions.add(q.question);
      break;
    } catch (err) {
      console.error(`Attempt ${attempts} failed:`, err);
      if (attempts >= maxAttempts) {
        showError('Could not generate a question. Please check your connection and try again.');
        setLoadingUI(false);
        state.loading = false;
        lockControls(false);
        return;
      }
    }
  }

  state.question = question;
  state.loading = false;
  lockControls(false);
  renderQuestion();
}

function setLoadingUI(loading) {
  document.getElementById('loading-state').style.display = loading ? 'flex' : 'none';
  document.getElementById('question-body').style.display  = loading ? 'none' : 'block';
}

function lockControls(lock) {
  document.querySelectorAll('.pill-btn').forEach(b => b.disabled = lock);
}

// ── Render question ────────────────────────────────────────────────
function renderQuestion() {
  const q = state.question;
  if (!q) return;

  setLoadingUI(false);

  document.getElementById('question-text').textContent = q.question;
  document.getElementById('topic-tag').textContent = q.topic || state.topic;

  const diffMap = {
    easy:   ['diff-easy',   'Easy'],
    medium: ['diff-medium', 'Medium'],
    hard:   ['diff-hard',   'Hard'],
  };
  const [cls, lbl] = diffMap[state.difficulty];
  document.getElementById('diff-badge').innerHTML =
    `<span class="difficulty-badge ${cls}">${lbl}</span>`;

  document.getElementById('ai-dot').className = 'ai-dot static';
  document.getElementById('ai-label').textContent = 'AI Generated';

  // Render shuffled choices
  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  grid.style.display = 'grid';

  const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
  shuffled.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = c;
    btn.onclick = () => handleChoice(c, btn);
    grid.appendChild(btn);
  });
}

// ── Handle answer ──────────────────────────────────────────────────
function handleChoice(selected, btn) {
  if (state.answered || !state.question || state.loading) return;
  state.answered = true;
  const correct = selected === state.question.answer;

  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === state.question.answer) b.classList.add('reveal-correct');
  });

  if (correct) {
    btn.classList.add('selected-correct');
    const pts = { easy: 100, medium: 200, hard: 350 }[state.difficulty];
    state.score += pts;
    state.streak++;
    state.wins++;
    showToast(`✓ Correct! +${pts} pts`);
  } else {
    btn.classList.add('selected-wrong');
    state.streak = 0;
    showToast('✗ Not quite…');
  }

  updateStats();
  setTimeout(() => showEndCard(correct), 600);
}

// ── End card ───────────────────────────────────────────────────────
function showEndCard(correct) {
  // Reset solution state for fresh card
  solutionOpen = false;
  solutionLoaded = false;
  solutionStreaming = false;

  const panel    = document.getElementById('solution-panel');
  const solBtn   = document.getElementById('solution-toggle');
  const solLabel = document.getElementById('solution-toggle-label');
  panel.classList.remove('visible');
  solBtn.classList.remove('open');
  solLabel.textContent = 'Show Full Solution';
  document.getElementById('solution-body').innerHTML =
    '<div class="solution-loading" id="solution-loading">' +
    '<div class="mini-spin"></div>Generating solution…</div>';

  const card = document.getElementById('end-card');
  card.style.display = 'block';
  document.getElementById('end-title').textContent =
    correct ? '🎓 Correct!' : '📖 Keep Studying';
  document.getElementById('end-answer').textContent = state.question.answer;
  document.getElementById('end-explanation').textContent = state.question.explanation;

  const nb = document.getElementById('next-btn');
  nb.disabled = false;
  if (state.mode === 'daily') {
    nb.textContent = 'Play Endless →';
    nb.onclick = () => setMode('endless');
  } else {
    nb.textContent = 'Next Question →';
    nb.onclick = nextRound;
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextRound() {
  state.endlessRound++;
  loadQuestion();
}

// ── Progress bar ───────────────────────────────────────────────────
function updateProgressBar() {
  if (state.mode === 'endless') {
    document.getElementById('endless-info').style.display = 'block';
    const block  = Math.floor(state.endlessRound / 5);
    const within = (state.endlessRound % 5) + 1;
    const dl     = ['Easy', 'Medium', 'Hard'][Math.min(block, 2)];
    document.getElementById('round-info-text').textContent =
      `Round ${state.endlessRound + 1} · ${dl} (${within}/5)`;
    document.getElementById('progress-fill').style.width =
      `${((state.endlessRound % 5) / 5) * 100}%`;
  } else {
    document.getElementById('endless-info').style.display = 'none';
  }
}

// ── Stats ──────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-streak').textContent = state.streak;
  document.getElementById('stat-score').textContent  = state.score;
  document.getElementById('stat-wins').textContent   = state.wins;
}

// ── Mode / Course / Topic switches ────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  state.endlessRound = 0;
  document.getElementById('btn-daily').classList.toggle('active',   mode === 'daily');
  document.getElementById('btn-endless').classList.toggle('active', mode === 'endless');
  loadQuestion();
}

function setCalc(subject) {
  state.subject = subject;
  state.topic = 'All';
  state.endlessRound = 0;
  document.getElementById('btn-calc1').classList.toggle('active', subject === 'calc1');
  document.getElementById('btn-calc2').classList.toggle('active', subject === 'calc2');
  renderTopicBar();
  loadQuestion();
}

// ── Error handling ─────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg + ' — click to retry.';
  el.style.display = 'block';
  el.onclick = () => { hideError(); loadQuestion(); };
  setLoadingUI(false);
  document.getElementById('question-text').textContent = '⚠ Question generation failed';
  document.getElementById('question-body').style.display = 'block';
  document.getElementById('loading-state').style.display = 'none';
}

function hideError() {
  document.getElementById('error-banner').style.display = 'none';
}

// ── Toast ──────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── Solution panel ─────────────────────────────────────────────────
let solutionOpen      = false;
let solutionLoaded    = false;
let solutionStreaming = false;

function toggleSolution() {
  const panel = document.getElementById('solution-panel');
  const btn   = document.getElementById('solution-toggle');
  const label = document.getElementById('solution-toggle-label');

  solutionOpen = !solutionOpen;
  panel.classList.toggle('visible', solutionOpen);
  btn.classList.toggle('open', solutionOpen);
  label.textContent = solutionOpen ? 'Hide Solution' : 'Show Full Solution';

  if (solutionOpen && !solutionLoaded && !solutionStreaming) {
    fetchStreamingSolution();
  }
}

async function fetchStreamingSolution() {
  if (!state.question || solutionStreaming) return;
  solutionStreaming = true;

  const q = state.question;
  const subjectName = state.subject === 'calc1' ? 'Calculus 1' : 'Calculus 2';
  const prompt =
    `You are a ${subjectName} tutor. Provide a clear, step-by-step solution to this problem.\n\n` +
    `Question: ${q.question}\n` +
    `Correct Answer: ${q.answer}\n\n` +
    `Write a numbered step-by-step solution (3–6 steps). For each step:\n` +
    `- Start with "Step N:" on its own line\n` +
    `- Explain what you're doing and why\n` +
    `- Show the math clearly using plain Unicode (x², ∫, →, ∞, √, π, ·, ÷, ≈, ≠, ≤, ≥)\n\n` +
    `After the steps, add a short "Key Insight:" line summarizing the core concept.\n\n` +
    `Be concise but thorough. No LaTeX. No markdown. Plain text only.`;

  const bodyEl = document.getElementById('solution-body');
  const loadEl = document.getElementById('solution-loading');

  bodyEl.innerHTML = '';
  bodyEl.appendChild(loadEl);
  loadEl.style.display = 'flex';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    loadEl.style.display = 'none';
    const textEl = document.createElement('div');
    textEl.className = 'cursor-blink';
    bodyEl.appendChild(textEl);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer   = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            textEl.textContent = fullText;
            document.getElementById('solution-panel')
              .scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch { /* ignore parse errors on partial chunks */ }
      }
    }

    // Done streaming — remove cursor
    textEl.className = '';
    textEl.textContent = fullText;
    solutionLoaded = true;

  } catch (err) {
    console.error('Solution fetch failed:', err);
    loadEl.style.display = 'none';
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:#c97a7a;font-size:0.75rem;';
    errEl.textContent = '⚠ Could not generate solution. Click "Show Full Solution" again to retry.';
    bodyEl.appendChild(errEl);
    solutionLoaded = false; // allow retry
  }

  solutionStreaming = false;
}

// ── Init ───────────────────────────────────────────────────────────
renderTopicBar();
loadQuestion();
