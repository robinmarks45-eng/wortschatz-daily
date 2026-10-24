# Wortschatz Daily — A1 Foundation

**Live iPhone PWA:** https://robinmarks45-eng.github.io/wortschatz-daily/

Independent List-first German vocabulary app (does not touch the original `wortschatz` repository).

## Learning design

- **Day 1 (rev 2):** 60 foundational words — 25 Active + 35 Passive, progressively covering Goethe A1-style everyday communication.
- "Importance" and "frequencyEstimate" are **editorial, qualitative tags**, not measured corpus rank scores. A1.1 and A1.2 boundaries differ among schools.
- German word stays pinned when swiping the table horizontally; essential forms, Myanmar meaning and example occupy the next columns.
- Tap for reader detail, Back/Next, pronunciation, grammar, notes and Weak/Studied/Known.
- Learning data lives locally in IndexedDB; the app is usable offline after an online visit.

## Updating future days on GitHub

Publish `lessons/day2.json`, `lessons/day3.json`, etc., then append entries to `lessons/catalog.json`, e.g.:

```json
{"id":"day2","path":"lessons/day2.json","revision":1,"releaseDate":"YYYY-MM-DD"}
```

The app checks the public catalog at launch, when it comes online and when you press **Settings → Check new lessons**. Published lessons will be added to local vocabulary without requiring JSON copy/paste. Do not reuse word IDs. Validate every new lesson's German grammar and avoid duplicate lemmas. Increment a lesson's `revision` in the catalog for an amended published Day 1.

Day 1 v1 → v2 migration matches German lemmas to preserve notes and review marks, and keeps previously studied/annotated removed words in an Archive lesson.

**Publishing lessons is NOT backing up private study data.** Local notes, progress and review history do **not** sync to GitHub. Use Settings → Export JSON backup and save to Files/iCloud Drive periodically. Restore only after reviewing it.

No OpenAI API payment. To automatically *publish* a new day daily, a separate scheduled GitHub-writing workflow is required; this app only automatically **downloads** what's published.

## PWA Install

iPhone: open the HTTPS site in Safari → Share → Add to Home Screen. Offline caching needs one successful online launch.

Existing original app: https://github.com/robinmarks45-eng/wortschatz (unchanged).
