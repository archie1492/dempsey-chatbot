import { useMemo } from "react";
import ChatBot, { Button, type Settings, type Styles } from "react-chatbotify";
import { buildFlow } from "./flow";
import { ArchitectButton, HeaderTitle, LauncherIcon, RestartButton, SendIcon } from "./components";

// Dempsey Design palette (from dempsey-design.com).
const INK = "#1c1c1c";
const PAPER = "#fafafa";
const LINE = "#e4e4e2";
const MUTED = "#7a7a78";
const ACCENT = "#b9c971";
const BODY_FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

const OPTION_BASE = {
  backgroundColor: "#ffffff",
  color: INK,
  border: `1px solid ${INK}`,
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 14px",
  letterSpacing: ".01em",
  transition: "background-color .18s ease, color .18s ease",
} as const;

const SEND_BASE = { backgroundColor: INK, borderRadius: 999, width: 40, height: 40, marginLeft: 8, color: "#fff" } as const;

const LAUNCHER_BASE = {
    width: 60,
    height: 60,
    backgroundImage: "none",
    backgroundColor: INK,
    border: `1px solid rgba(255,255,255,.55)`,
    // A light ring keeps the launcher visible over dark sections of the site.
    boxShadow: "0 0 0 3px rgba(250,250,250,.9), 0 14px 34px -8px rgba(20,20,20,.45)",
    bottom: 24,
    right: 24,
    color: "#ffffff",
  } as const;

const PROMPT_BASE = { color: INK, borderColor: LINE, backgroundColor: "#ffffff", fontSize: 12 } as const;

const settings: Settings = {
  general: {
    primaryColor: INK,
    secondaryColor: INK,
    fontFamily: BODY_FONT,
    showFooter: true,
    embedded: false, },
  device: { applyMobileOptimizations: true },
  tooltip: { mode: "START", text: "Questions? Ask our assistant" },
  chatButton: { icon: LauncherIcon },
  header: {
    title: <HeaderTitle />,
    showAvatar: false,
    buttons: [<RestartButton key="restart" />, Button.CLOSE_CHAT_BUTTON],
  },
  footer: {
    text: "",
    buttons: [<ArchitectButton key="architect" />],
  },
  chatInput: {
    enabledPlaceholderText: "Type a message…",
    disabledPlaceholderText: "One moment…",
    characterLimit: 400,
    botDelay: 650,
    blockSpam: true,
    buttons: [Button.SEND_MESSAGE_BUTTON],
    sendButtonIcon: SendIcon,
  },
  chatWindow: {
    showScrollbar: false,
    showTypingIndicator: true,
    autoJumpToBottom: true,
    showMessagePrompt: true,
    messagePromptText: "New message ↓",
  },
  botBubble: { showAvatar: false, simulateStream: true, streamSpeed: 18, animate: true },
  userBubble: { showAvatar: false, animate: true },
  chatHistory: { disabled: true },
  notification: { disabled: true },
  audio: { disabled: true },
  voice: { disabled: true },
  emoji: { disabled: true },
  fileAttachment: { disabled: true },
};

const styles: Styles = {
  chatWindowStyle: {
    width: 384,
    height: 620,
    borderRadius: 16,
    backgroundColor: PAPER,
    boxShadow: "0 24px 60px -12px rgba(20,20,20,.28), 0 2px 8px rgba(20,20,20,.08)",
    border: `1px solid ${LINE}`,
    bottom: 96,
    right: 24,
  },
  headerStyle: {
    backgroundImage: "none",
    backgroundColor: INK,
    padding: "16px 14px 16px 18px",
    borderBottom: "none",
    maxHeight: "none",
    alignItems: "center",
  },
  bodyStyle: { backgroundColor: PAPER, paddingTop: 8 },
  botBubbleStyle: {
    backgroundColor: "#ffffff",
    color: INK,
    border: `1px solid ${LINE}`,
    borderRadius: "4px 16px 16px 16px",
    fontSize: 14,
    lineHeight: 1.55,
    padding: "11px 14px",
    maxWidth: "82%",
    whiteSpace: "pre-line",
    boxShadow: "none",
  },
  userBubbleStyle: {
    backgroundColor: INK,
    color: "#ffffff",
    borderRadius: "16px 4px 16px 16px",
    fontSize: 14,
    lineHeight: 1.5,
    padding: "10px 14px",
    maxWidth: "78%",
  },
  botOptionStyle: OPTION_BASE,
  // ChatBotify replaces (not merges) the base style on hover, so the hover
  // style repeats it; otherwise the chip changes size under the cursor.
  botOptionHoveredStyle: { ...OPTION_BASE, backgroundColor: INK, color: "#ffffff" },
  botCheckboxRowStyle: {
    backgroundColor: "#ffffff",
    color: INK,
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    minHeight: 36,
    maxHeight: "none",
    width: "auto",
    maxWidth: "88%",
    paddingRight: 14,
  },
  botCheckboxNextStyle: {
    backgroundColor: INK,
    color: "#ffffff",
    borderColor: INK,
    borderWidth: 1,
    borderRadius: 999,
    fontSize: 18,
    minHeight: 36,
    width: 96,
  },
  botCheckMarkStyle: { backgroundColor: "#f0f0ee", color: "transparent", width: 18, height: 18 },
  botCheckMarkSelectedStyle: { backgroundColor: INK, color: "#ffffff", width: 18, height: 18 },
  chatInputContainerStyle: {
    backgroundColor: "#ffffff",
    borderTop: `1px solid ${LINE}`,
    padding: "12px 12px 12px 14px",
  },
  chatInputAreaStyle: {
    border: `1px solid ${LINE}`,
    borderRadius: 999,
    fontSize: 14,
    padding: "10px 16px",
    backgroundColor: PAPER,
    color: INK,
    boxShadow: "none",
  },
  chatInputAreaFocusedStyle: { border: `1px solid ${INK}`, boxShadow: "none", outline: "none" },
  chatInputAreaDisabledStyle: { backgroundColor: "#f0f0ee", color: MUTED },
  sendButtonStyle: SEND_BASE,
  sendButtonHoveredStyle: { ...SEND_BASE, backgroundColor: "#000" },
  sendButtonDisabledStyle: { ...SEND_BASE, backgroundColor: "#c9c9c6" },
  sendIconStyle: { width: 18, height: 18, color: "#ffffff" },
  characterLimitStyle: { color: MUTED, fontSize: 11 },
  footerStyle: {
    backgroundColor: "#ffffff",
    borderTop: `1px solid ${LINE}`,
    padding: "10px 14px 12px",
    maxHeight: "none",
    justifyContent: "center",
    alignItems: "center",
  },
  chatButtonStyle: LAUNCHER_BASE,
  chatButtonHoveredStyle: { ...LAUNCHER_BASE, backgroundColor: "#000000", transform: "translateY(-2px)" },
  chatIconStyle: { color: "#ffffff", width: 26, height: 26 },
  tooltipStyle: {
    backgroundColor: "#ffffff",
    color: INK,
    fontFamily: BODY_FONT,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${LINE}`,
    borderRadius: 999,
    padding: "9px 14px",
    boxShadow: "0 10px 30px -10px rgba(20,20,20,.3)",
    right: 96,
    bottom: 36,
  },
  closeChatButtonStyle: { backgroundColor: "transparent", borderRadius: 999 },
  closeChatIconStyle: { fill: "#ffffff", stroke: "#ffffff", width: 18, height: 18 },
  rcbTypingIndicatorDotStyle: { backgroundColor: ACCENT },
  chatMessagePromptStyle: PROMPT_BASE,
  chatMessagePromptHoveredStyle: { ...PROMPT_BASE, color: "#ffffff", borderColor: INK, backgroundColor: INK },
};

export default function App() {
  const flow = useMemo(() => buildFlow(), []);
  return <ChatBot flow={flow} settings={settings} styles={styles} />;
}

export { ACCENT, INK, LINE, MUTED, PAPER };
