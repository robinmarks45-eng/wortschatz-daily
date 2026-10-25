# Wortschatz Daily — Local-first German Reader

**App:** https://robinmarks45-eng.github.io/wortschatz-daily/

Independent app from https://github.com/robinmarks45-eng/wortschatz (original unchanged).

## Daily curriculum (from Day 1 revision 3)

**68 entries/day, 60 General + 8 Medical Extra**

| Track | Active | Passive | Total |
|---|---:|---:|---:|
| General | 25 (10 verbs, 6 adj/adverbs, 5 nouns, 4 function words/phrases) | 35 (mostly nouns) | 60 |
| Medical Extra | 3 patient-friendly verbs/questions | 5 symptom nouns | 8 |

Medical detail reader shows patient-friendly German and professional/clinical example sentences with German TTS.

### Vocabulary prioritization

Proposed hybrid **curriculum-selection** weights (not verified per-word corpus ranks):

- Goethe A1/A2 and CEFR appropriateness — **25%**
- Spoken German: SUBTLEX-DE subtitles + IDS FOLK spontaneous conversation — **30%**
- Written frequency context: Leipzig Corpora and Duden — **15%**
- Everyday usefulness and practical Germany situations — **20%**
- Grammar, collocations, productive patterns — **10%**

The current app sorts by **editorial Core/High tier and qualitative frequency estimate**, *not* numerical, normalized corpus ranks. It does not download or score raw SUBTLEX/FOLK/Leipzig frequencies for each word, and makes no claim to. Terms with no measured source data have no invented frequency count. Language priority is a curriculum guideline, not a scientifically validated score.

References:
- https://www.goethe.de/pro/relaunch/prf/zh/A1_SD1_Wortliste_02.pdf
- https://pubmed.ncbi.nlm.nih.gov/21768069/
- https://agd.ids-mannheim.de/folk.shtml
- https://www.wortschatz.uni-leipzig.de/en/documentation/faq
- https://www.duden.de/hilfe/haeufigkeit

## Passive → Active, without counting the word as new

Passive words can be manually **Promoted to Active** from the Word Detail after the learner can independently produce a new German sentence. The Review screen suggests candidates after being marked Known at least twice, but never promotes just because the learner read a word.

The promotion is saved as a **personal `goalMode` in IndexedDB progress**, so GitHub lesson revisions do not overwrite it. Promote/Return to Passive is reversible; study state and notes persist. An earlier passive lemma promoted for review must **not** be counted again among a future day's 60 *new* General words.

## iPhone App Features

- Sticky German column with horizontally scrollable essential forms, Myanmar meaning, example sentences
- Study order / editorial Priority sort
- All / General Active / General Passive / 🩺 Medical filter
- Word Detail with Back/Next, conjugation/plural, TTS, patient/clinical examples
- Studied / Known / Weak and list-based review, resume, active-recall candidate suggestions
- Offline caching (after first successful online launch) and private IndexedDB progress
- Manual JSON backup/restore, optional manual lesson import

## Publish future daily lessons to GitHub

Upload `lessons/day2.json`, `lessons/day3.json`, etc., and append corresponding items to `lessons/catalog.json` with id, path, releaseDate and revision. A standard new day needs **68 nonduplicated** entries with `track` = `general` or `medical`. The app auto-imports published lessons when online and keeps downloaded lessons locally, no copy/paste required.

To edit an already published lesson, increase its catalog revision. The client currently migrates **Day 1** revisions; editing later already-imported days in place needs a future update to the migration logic.

**GitHub only backs up published vocabulary, not personal data.** Export JSON backup from Settings and save to Files/iCloud Drive. Use it when changing devices, reinstalling Home Screen app, or after clearing website data. Safari and Home Screen PWA can have different local storage containers.

No OpenAI API required. The app **downloads** newly published days automatically, but an external scheduled publisher (automation or workflow) is still needed if future daily lesson generation/upload should happen without a chat request.

## iPhone installation

Safari → open https://robinmarks45-eng.github.io/wortschatz-daily/ → Share → Add to Home Screen. If old UI persists after deployment, reopen/refresh while online so service worker v3 and app v3 can update.


## Day 1 v4 — repair if the Medical words are missing

Day 1 must contain **68 entries**: 25 General Active, 35 General Passive, and 8 Medical Extra (3 active, 5 passive). The first screen shows three section shortcuts; choose **🩺 Medical 8/8** to display the medical list immediately. The All list also contains three visible category headings.

If a Home Screen installation previously cached the 60-word lesson, open the app with internet access and reload. The app compares **expectedWords: 68** and **expectedMedical: 8** from the lesson catalog against local IndexedDB. When counts differ, it downloads the canonical Day 1 again, even if the local revision number is already current. A visible **Repair Day 1** button appears if counts are incomplete; Settings also includes **Repair Day 1 (68 words)**.

The repair migrates progress/notes for matching words and preserves previously studied words no longer in the main curriculum in an Archive. Don't uninstall the Home Screen app or clear Safari website data as a troubleshooting step before exporting a JSON backup, as personal learning data is stored locally.

Manual deployment checks: verify `lessons/catalog.json` revision 4 and counts; `lessons/day1.json` revision 4 and 68 words; deploy updated `app.js?v=4`, `styles.css?v=4`, Service Worker v4. GitHub Pages publishing confirms site deployment, not all individual iOS cache states.


## v5 — grammar filters and larger iPhone reading text

The vocabulary toolbar offers **Word type: All types / Nouns / Verbs / Adj / Adv / Other**. The **Nouns** option reveals a second **der / die / das** filter; this uses the article in each noun's German headword. Word-type filters can be combined with General Active, General Passive, Medical, search and review filters. The Day 1 Medical shortcut intentionally clears grammar subfilters so all eight medical words are visible.

Vocabulary list text is now larger by default (**18 px German headwords**, previously 14 px), with increased Myanmar-translation size, row spacing and a wider frozen German column. Use **List text A− / A+** (15–22 px) to adjust it. The choice is saved in the browser's private IndexedDB settings. Changes do not erase notes, study progress or saved promotions.

If an installed iPhone PWA still shows the old controls, open online, refresh and reopen; the deployment includes versioned JavaScript/CSS and a new service-worker cache.


## Day 2 — A1 Foundation (published 2026-10-25)

Day 2 adds **68 new entries** to Day 1's 68 (136 distinct German headwords/phrases overall): General Active 25, General Passive 35, Medical Active 3, Medical Passive 5. Topic: **Food, Time, Family, Travel & Basic Patient Questions**.

- General Active verbs: `essen, trinken, lesen, schreiben, hören, sehen, fahren, nehmen, geben, schlafen`
- Active adj/adverb: `schön, schnell, langsam, teuer, kalt, heute`
- Active nouns: `der Tag, die Woche, der Morgen, der Abend, die Nacht`
- Active function words: `oder, nicht, bitte, auch`
- General Passive: 35 essential nouns on people, home, shopping, time and travel
- Medical Extra: `atmen, schlucken, Haben Sie Allergien?, die Allergie, der Blutdruck, der Puls, die Wunde, die Atemnot`

The file is `lessons/day2.json` and `lessons/catalog.json` must include an entry with `expectedWords:68` and `expectedMedical:8`. The App opens a newly published lesson on its first online import and shows Day 2's General/Medical sections. Existing Day 1 progress and notes remain stored locally. New and old words are checked against Day 1's German headwords after removing articles; no exact lemma collision exists in this release.

Importance and frequency tags remain **editorial estimates**, not verified numeric corpora ranks. Day 2's 68 entries are stored publicly in GitHub, while personal annotations and progress still require local backup.


## Day 3 — Shopping, Directions, Food & Body Parts (2026-10-25)

Published as `lessons/day3.json` and registered in `lessons/catalog.json`. Contains 68 new entries with no exact case-folded/article-stripped lemma duplicates across Days 1–3 (204 total entries): 25 General Active, 35 General Passive, and 8 Medical (3 Active, 5 Passive).

General Active verbs: `kaufen, bezahlen, suchen, finden, fragen, antworten, verstehen, öffnen, schließen, bestellen`. Other new core concepts include `warm, billig, wichtig, richtig, früh, oft, der Monat, die Nummer, die Antwort, der Weg, das Datum, ja, nein, sehr, kein`.

Medical Extra: `zeigen, bewegen, beschreiben, der Kopf, der Bauch, der Rücken, die Brust, das Bein`. Each medical entry includes patient-friendly German and a clinical example.

To retrieve on iPhone: open the app online; the catalog is fetched fresh and Day 3 automatically imports and becomes the selected Today lesson. Alternatively, tap Settings → Check new lessons. Previous lessons and local notes/progress are retained. A1 framework and qualitative ranking labels are editorial, not measured numeric corpus ranks.
