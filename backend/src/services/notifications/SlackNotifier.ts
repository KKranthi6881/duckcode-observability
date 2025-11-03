export class SlackNotifier {
  async send(webhookUrl: string, text: string): Promise<void> {
    try {
      const f: any = (global as any).fetch;
      if (!f) {
        // Skip if fetch is not available in this runtime
        return;
      }
      const res = await f(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        // Non-fatal
        console.warn('[SlackNotifier] Failed to send slack message:', res.status, res.statusText);
      }
    } catch (e) {
      console.warn('[SlackNotifier] Error sending slack message:', e);
    }
  }
}
