const WEBHOOK_URL =
  (import.meta?.env?.VITE_N8N_SCHEDULE_WEBHOOK_URL || '').trim() ||
  'https://woitasen.app.n8n.cloud/webhook-test/chatwoot/schedule-send';

export async function scheduleSend(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    mode: 'cors',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook error ${res.status}: ${text}`);
  }
  try { return await res.json(); } catch { return {}; }
}
