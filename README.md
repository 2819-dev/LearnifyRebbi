# Guide

Plain-English Gemara class for kids: Hebrew on the page, a real Rebbe voice in your ear.

Repo can stay `LearnifyRebbi`. The product name is **Guide**.

## What works

- Pick a daf of **Bava Metzia** (default **21a**, Hashavas Aveidah / Eilu Metziot)
- See the **Hebrew** Gemara from Sefaria
- Hear a classroom **Rebbe** explain each line in English (Gemini)
- Choose a curated **Rebbe voice** (Gemini TTS — not browser defaults)
- Ask questions; answers stay grounded in the current line + curriculum notes

## Setup

```bash
cp .env.example .env
# GEMINI_API_KEY=...
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

## Deploy

Site: https://learnifyrebbi.netlify.app

`GEMINI_API_KEY` is set as a Netlify env secret. `netlify.toml` builds the Vite app and serves `/api/rebbe` + `/api/health`.

## Honesty

Guide is a study helper, not a posek and not a replacement for a real Rebbe.
