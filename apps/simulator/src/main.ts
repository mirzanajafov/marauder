import mqtt from 'mqtt';
import { createDefaultWorld, signalTopic } from '@marauder/shared';
import { loadConfig } from './config';

const config = loadConfig(process.env);

function main(): void {
  const client = mqtt.connect(config.mqttUrl);
  const world = createDefaultWorld({ ...config.traffic, random: Math.random });
  const dt = 1 / config.hz;

  client.on('connect', () => {
    console.log(`simulator connected: ${world.tags.length} tags visiting ${world.rooms.length} rooms, ${config.hz} Hz`);
    setInterval(
      () => {
        const now = Date.now();
        world.advance(dt, now);
        for (const signal of world.signals(now)) {
          client.publish(signalTopic(signal.receiverId), JSON.stringify(signal));
        }
      },
      Math.round(1000 / config.hz),
    );
  });

  client.on('error', (err) => console.error(err.message));
}

main();
