import { WebSocket } from "ws";

export class ConnectionRegistry {
  private connections = new Map<number, Set<WebSocket>>();

  connect(userId: number, socket: WebSocket) {
    const set = this.connections.get(userId) ?? new Set<WebSocket>();
    set.add(socket);
    this.connections.set(userId, set);
  }
  disconnect(userId: number, socket: WebSocket) {
    const set = this.connections.get(userId);
    set?.delete(socket);
    if (set?.size === 0) this.connections.delete(userId);
  }
  broadcast(event: unknown, userIds: Iterable<number>) {
    for (const userId of new Set(userIds)) {
      for (const socket of this.connections.get(userId) ?? []) {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
        else this.disconnect(userId, socket);
      }
    }
  }
}
