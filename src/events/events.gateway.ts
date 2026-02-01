import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface EventPayload {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: string;
  createdAt: string;
}

@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  broadcastEvent(event: EventPayload): void {
    this.server?.emit('event', event);
  }
}
