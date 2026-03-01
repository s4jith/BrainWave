/**
 * chatExport – utility to download a chat conversation as a Word .doc file.
 * Used by ChatbotPanel and AIPanel.
 */

interface ChatMessage {
    role: 'user' | 'assistant' | string;
    content: string;
    timestamp: string | Date;
}

interface ExportOptions {
    title?: string;
    userName?: string;
    aiName?: string;
    filename?: string;
}

// Generates a basic .doc (HTML-wrapped) file and triggers browser download
export function exportChatAsDoc(messages: ChatMessage[], options: ExportOptions = {}): void {
    const {
        title = 'Study Chat',
        userName = 'You',
        aiName = 'AI Assistant',
        filename = `chat-${Date.now()}.doc`,
    } = options;

    // Build simple HTML that Word can open
    const rows = messages.map((m) => {
        const sender = m.role === 'user' ? userName : aiName;
        const time = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        const bg = m.role === 'user' ? '#eef2ff' : '#f8fafc';
        return `
        <tr>
          <td style="background:${bg};padding:10px 14px;border-radius:6px;vertical-align:top;min-width:80px">
            <b>${sender}</b><br/><small style="color:#888">${time}</small>
          </td>
          <td style="padding:10px 14px;background:${bg}">
            ${String(m.content).replace(/\n/g, '<br/>')}
          </td>
        </tr>`;
    }).join('');

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="UTF-8"/>
<title>${title}</title>
<style>body{font-family:Calibri,sans-serif;font-size:12pt}table{border-collapse:collapse;width:100%}td{border:1px solid #e5e7eb}</style>
</head>
<body>
<h2>${title}</h2>
<p style="color:#555">Exported ${new Date().toLocaleDateString()}</p>
<table>${rows}</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[chatExport] Exported', messages.length, 'messages as', filename);
}
