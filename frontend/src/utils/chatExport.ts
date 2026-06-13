/**
 * Chat export helpers — convert a transcript into text/HTML/Word and
 * trigger a browser download. Mirrors the legacy implementation so any
 * existing exported file format remains stable.
 */

export interface ChatMessage {
  role: "user" | "assistant" | string;
  content: string;
  timestamp: string | number | Date;
}

export interface ExportOptions {
  title?: string;
  userName?: string;
  aiName?: string;
  includeTimestamp?: boolean;
  includeSeparator?: boolean;
  filename?: string;
}

function fmtTime(ts: string | number | Date): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatChatToText(messages: ChatMessage[], options: ExportOptions = {}): string {
  const {
    title = "Chat Conversation",
    userName = "You",
    aiName = "AI Assistant",
    includeTimestamp = true,
    includeSeparator = true,
  } = options;

  let content = "";
  content += `${"=".repeat(50)}\n`;
  content += `${title}\n`;
  content += `Exported on: ${new Date().toLocaleString()}\n`;
  content += `${"=".repeat(50)}\n\n`;

  messages.forEach((msg, index) => {
    const role = msg.role === "user" ? userName : aiName;
    const timestamp = includeTimestamp ? ` (${fmtTime(msg.timestamp)})` : "";
    content += `${role}${timestamp}:\n`;
    content += `${msg.content}\n`;
    content += includeSeparator && index < messages.length - 1
      ? `\n${"-".repeat(40)}\n\n`
      : "\n";
  });

  content += `\n${"=".repeat(50)}\n`;
  content += `End of conversation\n`;
  content += `${"=".repeat(50)}\n`;
  return content;
}

export function formatChatToHTML(messages: ChatMessage[], options: ExportOptions = {}): string {
  const { title = "Chat Conversation", userName = "You", aiName = "AI Assistant" } = options;
  const head = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;background:#f5f5f5;color:#333}.header{text-align:center;margin-bottom:40px;padding-bottom:20px;border-bottom:2px solid #e0e0e0}.message{margin-bottom:24px;padding:20px;border-radius:12px;background:white;box-shadow:0 1px 3px rgba(0,0,0,.1)}.message.user{border-left:4px solid #1a1a1a}.message.assistant{border-left:4px solid #f97316}.role.user{color:#1a1a1a;font-weight:600}.role.assistant{color:#f97316;font-weight:600}.timestamp{font-size:12px;color:#999}.content{line-height:1.6;white-space:pre-wrap}</style></head><body>`;

  let body = `<div class="header"><h1>${title}</h1><p>Exported on ${new Date().toLocaleString()}</p></div>`;
  for (const msg of messages) {
    const role = msg.role === "user" ? userName : aiName;
    const roleClass = msg.role === "user" ? "user" : "assistant";
    const content = msg.content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^- (.*)$/gm, "<li>$1</li>")
      .replace(/^(\d+)\. (.*)$/gm, "<li>$2</li>");
    body += `<div class="message ${roleClass}"><div class="message-header"><span class="role ${roleClass}">${role}</span><span class="timestamp">${fmtTime(msg.timestamp)}</span></div><div class="content">${content}</div></div>`;
  }
  body += `<div class="footer"><p>End of conversation</p></div></body></html>`;
  return head + body;
}

export function downloadAsFile(content: string, filename: string, mimeType = "text/plain"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportChatAsText(messages: ChatMessage[], options: ExportOptions = {}): void {
  const filename = options.filename ?? "chat-conversation.txt";
  downloadAsFile(formatChatToText(messages, options), filename, "text/plain");
}

export function exportChatAsHTML(messages: ChatMessage[], options: ExportOptions = {}): void {
  const filename = options.filename ?? "chat-conversation.html";
  downloadAsFile(formatChatToHTML(messages, options), filename, "text/html");
}

export function exportChatAsDoc(messages: ChatMessage[], options: ExportOptions = {}): void {
  const {
    filename = "chat-conversation.doc",
    title = "Chat Conversation",
    userName = "You asked",
    aiName = "AI said",
  } = options;

  let doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:1in}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5}h1{font-size:18pt;color:#1a1a1a}.date{color:#666;font-size:10pt;margin-bottom:20pt}.message{margin-bottom:20pt}.role{font-weight:bold;font-size:11pt}.role.user{color:#1a1a1a}.role.ai{color:#ea580c}.timestamp{color:#999;font-size:9pt}.separator{border-bottom:1px solid #ddd;margin:15pt 0}</style></head><body><h1>${title}</h1><p class="date">Exported on ${new Date().toLocaleString()}</p><div class="separator"></div>`;

  messages.forEach((msg, index) => {
    const role = msg.role === "user" ? userName : aiName;
    const roleClass = msg.role === "user" ? "user" : "ai";
    const content = msg.content
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/\n/g, "<br>");
    doc += `<div class="message"><p class="role ${roleClass}">${role}:</p><div class="content">${content}</div><p class="timestamp">${fmtTime(msg.timestamp)}</p></div>`;
    if (index < messages.length - 1) doc += `<div class="separator"></div>`;
  });

  doc += `<div class="separator"></div><p style="text-align:center;color:#666;font-size:10pt">End of conversation</p></body></html>`;
  downloadAsFile(doc, filename, "application/msword");
}
