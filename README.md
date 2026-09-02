# Lomed

Kid-friendly Gemara learning: Hebrew on the page, an English-speaking Rebbe in your ear.

The GitHub repo can stay `LearnifyRebbi`. The product name is **Lomed** (“one who learns”).

## What this MVP does

- Pick a daf of **Bava Metzia** (default **21a**, Hashavas Aveidah / Eilu Metziot)
- See the **Hebrew** Gemara from [Sefaria](https://www.sefaria.org)
- Hear a patient **Rebbe** explain each line in **English** (Gemini)
- Choose a **browser voice** (free Web Speech API)
- Ask questions; answers are grounded in the current line + a Hashavas Aveidah curriculum pack

## Free / very cheap stack

| Piece | Cost |
| --- | --- |
| App UI | Free (Vite + React) |
| Gemara text | Free (Sefaria API) |
| Rebbe brain | Free Gemini API tier (Google AI Studio) |
| Voice | Free (browser speech synthesis) |
| Local hosting | Free |

If you ever leave the free tier, stay on a cheap Flash model.

## Setup

1. Copy `.env.example` to `.env`
2. Create a free key at https://aistudio.google.com/apikey and paste it as `GEMINI_API_KEY`
3. Install and run:

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:8787  

## Deploy (Netlify)

Site: `https://LearnifyRebbi.netlify.app`

```bash
# set secrets (once)
netlify env:set GEMINI_API_KEY "your-key" --context production
netlify env:set GEMINI_API_KEY "your-key" --context deploy-preview
netlify env:set GEMINI_API_KEY "your-key" --context branch-deploy

# deploy
netlify deploy --prod --dir=dist
# or let Netlify build from git with netlify.toml
```

`netlify.toml` publishes `dist` and serves `/api/rebbe` + `/api/health` as Functions.

## Important honesty note

Lomed is a study helper, not a posek and not a replacement for a real Rebbe. The model is instructed to stay close to the provided Gemara line and curriculum notes, and to say when it is unsure.
