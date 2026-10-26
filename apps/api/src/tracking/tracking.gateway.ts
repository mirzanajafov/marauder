import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EntityDiscoveredEvent, EntityUpdatedEvent, PositionsBatchEvent, WsEvents } from '@marauder/shared';

@WebSocketGateway()
export class TrackingGateway {
  @WebSocketServer()
  server!: Server;

  @OnEvent(WsEvents.EntityDiscovered)
  onDiscovered(payload: EntityDiscoveredEvent): void {
    this.server.emit(WsEvents.EntityDiscovered, payload);
  }

  @OnEvent(WsEvents.EntityUpdated)
  onUpdated(payload: EntityUpdatedEvent): void {
    this.server.emit(WsEvents.EntityUpdated, payload);
  }

  @OnEvent(WsEvents.PositionsBatch)
  onPositions(payload: PositionsBatchEvent): void {
    this.server.emit(WsEvents.PositionsBatch, payload);
  }
}
