# ∫CALCLE — AI-Powered Calculus Wordle

A calculus quiz game with infinite AI-generated questions, daily & endless modes, topic filters, and step-by-step solutions.

## Project Structure

```
calcwordle/
├── public/
│   ├── index.html   ← markup
│   ├── style.css    ← styles
│   └── app.js       ← game logic
├── server.js        ← Node.js proxy server
├── package.json
├── .env.example
└── .gitignore
```

> **Why a server?** Browsers block direct calls to the Anthropic API (CORS policy). The proxy server forwards requests from the frontend to Anthropic using your secret API key, which never touches the browser.

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/calcwordle.git
cd calcwordle
npm install
```

### 2. Add your API key

```bash
cp .env.example .env
# Edit .env and paste your Anthropic API key
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Move frontend files into `/public`

```bash
mkdir public
mv index.html style.css app.js public/
```

### 4. Run locally

```bash
npm start
# Open http://localhost:3000
```

---

## Deploy to Render (free)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect your repo
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add environment variable: `ANTHROPIC_API_KEY` = your key
6. Deploy — Render gives you a live URL

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add variable: `ANTHROPIC_API_KEY` = your key
4. Done — Railway auto-detects Node.js and deploys

---

## How it works

- The frontend (`app.js`) calls `/api/chat` and `/api/chat/stream` on your own server
- `server.js` adds your API key and forwards the request to Anthropic
- Your API key is **never exposed** to the browser
