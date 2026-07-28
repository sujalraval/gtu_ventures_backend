import { Response } from 'express';

interface SSEClient {
  userId: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient[]> = new Map();

  add(userId: string, res: Response) {
    const existing = this.clients.get(userId) || [];
    existing.push({ userId, res });
    this.clients.set(userId, existing);
  }

  remove(userId: string, res: Response) {
    const existing = this.clients.get(userId) || [];
    const updated = existing.filter(c => c.res !== res);
    if (updated.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, updated);
    }
  }

  // Send event to a specific user
  send(userId: string, event: string, data: object) {
    const clients = this.clients.get(userId) || [];
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.res.write(payload);
      } catch {
        // Client disconnected — will be cleaned up on 'close'
      }
    }
  }

  // Broadcast to all connected staff/admin users
  broadcast(event: string, data: object) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        try {
          client.res.write(payload);
        } catch {}
      }
    }
  }
}

export const sseManager = new SSEManager();
