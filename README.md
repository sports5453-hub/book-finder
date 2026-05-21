# Book Finder

A static, mobile-friendly book recommendation website. It asks six quick questions, searches Open Library's public catalog, and ranks recommendations using:

- Subject and genre fit
- Mood and theme fit
- Reading length preference
- Inspiration text matches
- Reader ratings and catalog popularity
- Metadata quality, including cover availability

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Shareable link

This can be deployed as a static site to GitHub Pages, Netlify, Vercel, or Cloudflare Pages. Upload the contents of this folder and the app will work without a backend.
