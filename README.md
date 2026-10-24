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
