import { SignalPayload, World, signalTopic, tickMs } from '@marauder/shared';

export interface SimulatorClient {
  readonly connected: boolean;
  publish(topic: string, message: string): void;
  on(event: 'connect', listener: () => void): void;
}

export function startSimulation(client: SimulatorClient, world: World, hz: number): void {
  client.on('connect', () => {
    console.log(`simulator connected: ${world.tags.length} tags visiting ${world.rooms.length} rooms, ${hz} Hz`);
  });
  const intervalMs = tickMs(hz);
  setInterval(() => {
    const now = Date.now();
    world.advance(intervalMs / 1000, now);
    if (!client.connected) {
      return;
    }
    for (const { fingerprint, receiverId, rssi, txPower } of world.signals(now)) {
      const payload: SignalPayload = { fingerprint, receiverId, rssi, txPower };
      client.publish(signalTopic(receiverId), JSON.stringify(payload));
    }
  }, intervalMs);
}
