# FIFA World Cup 2026 Schedule Site

A dependency-free static website for browsing the FIFA World Cup 2026 match schedule, visual group tables, and knockout bracket path.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Data

The schedule embedded in `index.html` comes from the public-domain openfootball `worldcup.json` dataset for the 2026 tournament. On page load, `script.js` attempts to fetch the same source once per day with a date cache key, so newly published scores can update the group tables and knockout cards without changing the static files. If the network request fails, the embedded data remains as a fallback. The page links to the source dataset in the footer.
