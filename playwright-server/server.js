const express = require('express');
const cors = require('cors');
const { runPromptOnAllLLMs, runClaudeFollowUp } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());

let isRunning = false;

// Status page
app.get('/', (req, res) => res.send(`
  <body style="font-family:sans-serif;padding:2rem;background:#f9fafb">
    <h2>🎭 Playwright LLM Server</h2>
    <p style="color:green;font-weight:bold">✅ Server is running on port 3001</p>
    <p>POST <code>/run-prompt</code> with <code>{ "prompt": "..." }</code> to run all 3 LLMs.</p>
    <p>Make sure <strong>start-chrome.bat</strong> is open and you are logged in to ChatGPT, Claude, and Gemini.</p>
  </body>
`));
app.get('/health', (req, res) => res.json({ ok: true }));

// Main endpoint — React calls this with { prompt }
// Returns SSE stream so dashboard updates per-model as each finishes
app.post('/run-prompt', async (req, res) => {
  const { prompt, selectedModels, deepResearch = false } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (isRunning) {
    return res.status(429).json({ error: 'Already running a prompt. Wait for it to finish.' });
  }

  // Use SSE so frontend gets partial updates as each model finishes
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  isRunning = true;
  try {
    const result = await runPromptOnAllLLMs(prompt, (type, partial) => {
      send({ type, ...partial });
    }, selectedModels, deepResearch);

    send({ type: 'complete', ...result });
  } catch (e) {
    console.error('Playwright error:', e);
    send({ type: 'error', message: e.message });
  } finally {
    isRunning = false;
    res.end();
  }
});

app.post('/follow-up', async (req, res) => {
  const { originalPrompt, previousAnswer, followUpQuestion, selectedModels } = req.body;
  if (!followUpQuestion || !followUpQuestion.trim()) {
    return res.status(400).json({ error: 'followUpQuestion is required' });
  }
  if (!previousAnswer || !previousAnswer.trim()) {
    return res.status(400).json({ error: 'previousAnswer is required' });
  }
  if (isRunning) {
    return res.status(429).json({ error: 'Already running a prompt. Wait for it to finish.' });
  }

  isRunning = true;
  try {
    const result = await runClaudeFollowUp({
      originalPrompt: originalPrompt || '',
      previousAnswer,
      followUpQuestion,
      selectedModels,
    });
    res.json(result);
  } catch (e) {
    console.error('Claude follow-up error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    isRunning = false;
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n Playwright LLM server ready on http://localhost:${PORT}`);
  console.log(' Make sure you have logged in to ChatGPT, Claude, and Gemini first.');
  console.log(' Run  node login.js  to open browser for first-time login.\n');
});
