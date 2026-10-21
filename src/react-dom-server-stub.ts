// react-chatbotify imports react-dom/server ONLY to serialize JSX messages into
// chat history. Chat history is disabled in this build, so we swap in a tiny stub
// to cut ~100 KB from the bundle. Remove the alias in vite.config.ts if chat
// history is ever enabled.
const renderToString = (): string => "";
export { renderToString };
export default { renderToString };
