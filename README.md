# Dempsey Design — Website Assistant

Rule-based consultation assistant for dempsey-design.com, built with [React ChatBotify](https://react-chatbotify.com) (MIT), React 18 and TypeScript. No AI APIs, no paid services, no subscriptions.

## Embed (Webflow page custom code → before `</body>`)

```html
<script src="https://cdn.jsdelivr.net/gh/archie1492/dempsey-chatbot@<commit-sha>/dist/dempsey-chatbot.js"
        integrity="sha384-…" crossorigin="anonymous" defer></script>
```

The stylesheet (`dempsey-chatbot.css`) loads automatically from the same folder. The assistant renders inside a Shadow DOM, so it cannot affect site styles and site styles cannot affect it. Pin a commit SHA (or tag) in production — never `@main`.

## How the conversation works

A slot-filling intake rather than a fixed tree:

1. Every message — chip or typed — goes through `engine/conversation.ts › handle()`.
2. Typed text is read by rule-based extractors (`engine/extract.ts`): sector and project type, location, square footage, keys/seats, budget, timeline, site status, documents, special requirements, RFQ numbers, contact details.
3. The resolver (`nextRoute`) walks the ordered question list in `content/pathways.ts` and asks the first question that applies and isn't answered yet — so nothing is asked twice.
4. After the core questions a checkpoint offers *Continue* (optional questions) or *Review and send*.
5. The review card lists every answer with *Edit*; *Send to the studio* opens a pre-filled email.

## Where to edit

| What | File |
| --- | --- |
| Everything the assistant says (welcome, notes, FAQ answers, fee wording) | `src/conversation/content/copy.ts` |
| Questions, order, options, budget bands, branch conditions | `src/conversation/content/pathways.ts` |
| Keyword lists for understanding typed text | `src/conversation/content/lexicon.ts` |
| Recognised places and licensing regions | `src/conversation/content/places.ts` |
| Engine (developer) | `src/conversation/engine/*` |
| ChatBotify adapter and visual components | `src/flow.tsx`, `src/components.tsx`, `src/App.tsx`, `src/chatbot.css` |

## Data record (Phase 4)

`engine/summary.ts › toRecord()` produces a versioned (`schemaVersion: 1`) inquiry record: answers with their source (`chip` / `text` / `inferred`), contact, page and UTM source, and `summaryText` for WhatsApp. Phase 3 stores and transmits nothing.

## Build & test

```bash
npm ci
npm run build        # dist/dempsey-chatbot.js + dist/dempsey-chatbot.css
npm run test:unit    # engine and extractor tests (Node's built-in runner)
python3 -m http.server 4173 &  && npm run test:e2e   # browser tests per pathway
```

## Notes

- `react-dom/server` is aliased to a stub (see `vite.config.ts`) because chat history is disabled. Remove the alias if chat history is enabled.
- ChatBotify replaces (rather than merges) base styles on hover; hover styles in `App.tsx` therefore repeat their base style.
