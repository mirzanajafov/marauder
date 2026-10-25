import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EntityDiscoveredEvent, EntityUpdatedEvent, PositionsBatchEvent, WsEvents } from '@marauder/shared';

@WebSocketGateway()
export class TrackingGateway {
  @WebSocketServer()
  server!: Server;

  @OnEvent('entity.discovered')
  onDiscovered(payload: EntityDiscoveredEvent): void {
    this.server.emit(WsEvents.EntityDiscovered, payload);
  }

  @OnEvent('entity.updated')
  onUpdated(payload: EntityUpdatedEvent): void {
    this.server.emit(WsEvents.EntityUpdated, payload);
  }

  @OnEvent('positions.batch')
  onPositions(payload: PositionsBatchEvent): void {
    this.server.emit(WsEvents.PositionsBatch, payload);
  }
}
