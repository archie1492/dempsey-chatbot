# Dempsey Design — Website Assistant (Phase 1)

Rule-based chatbot for dempsey-design.com, built with [React ChatBotify](https://react-chatbotify.com) (MIT), React 18 and TypeScript.
No AI APIs, no paid services, no subscriptions.

## Embed (Webflow page or site custom code → before `</body>`)

```html
<script src="https://cdn.jsdelivr.net/gh/OWNER/REPO@vX.Y.Z/dist/dempsey-chatbot.js" defer></script>
```

The stylesheet (`dempsey-chatbot.css`) is loaded automatically from the same folder.
The bot renders inside a Shadow DOM, so it cannot affect site styles and site styles cannot affect it.

## Edit content

All conversation text, menu options, services, contact links and keyword rules live in `src/content.ts`.
Conversation logic and branching live in `src/flow.tsx`. Visual styling: `src/App.tsx` (styles object) and `src/chatbot.css`.

## Build & release

```bash
npm ci
npm run build          # outputs dist/dempsey-chatbot.js + dist/dempsey-chatbot.css
node test/run.mjs      # end-to-end tests (needs `python3 -m http.server 4173` running in the repo root)
git commit -am "..." && git tag vX.Y.Z && git push --tags
```

Then bump the version in the embed URL. Always reference a tag (`@vX.Y.Z`) in production, never `@main`.

## Notes

- `react-dom/server` is aliased to a stub (see `vite.config.ts`) because chat history is disabled. Remove the alias if chat history is enabled.
- Phase 1 stores and sends nothing. Database, CRM and WhatsApp handoff are later phases.
