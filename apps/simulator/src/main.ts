import mqtt from 'mqtt';
import {
  DEFAULT_PATH_LOSS_EXPONENT,
  DEFAULT_RECEIVERS,
  DEFAULT_SCENE,
  DEFAULT_TX_POWER,
  createWorld,
  signalTopic,
} from '@marauder/shared';

const TAG_COUNT = Number(process.env.TAG_COUNT ?? 6) || 6;
const HZ = Number(process.env.SIM_HZ ?? 10) || 10;
const SPEED = Number(process.env.SIM_SPEED ?? 1.4) || 1.4;
const NOISE_DB = Number(process.env.SIM_NOISE_DB ?? 1.2) || 1.2;
const DROP_PROB = Number(process.env.SIM_DROP_PROB ?? 0.08);
const DWELL_MIN = Number(process.env.SIM_DWELL_MIN_MS ?? 2500) || 2500;
const DWELL_MAX = Number(process.env.SIM_DWELL_MAX_MS ?? 7000) || 7000;
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

function main(): void {
  const client = mqtt.connect(MQTT_URL);
  const world = createWorld({
    scene: DEFAULT_SCENE,
    receivers: DEFAULT_RECEIVERS,
    tagCount: TAG_COUNT,
    speed: SPEED,
    noiseDb: NOISE_DB,
    dropProb: DROP_PROB,
    dwellMinMs: DWELL_MIN,
    dwellMaxMs: DWELL_MAX,
    txPower: DEFAULT_TX_POWER,
    pathLossExponent: DEFAULT_PATH_LOSS_EXPONENT,
    random: Math.random,
  });
  const dt = 1 / HZ;

  client.on('connect', () => {
    console.log(`simulator connected: ${world.tags.length} tags visiting ${world.rooms.length} rooms, ${HZ} Hz`);
    setInterval(() => {
      const now = Date.now();
      world.advance(dt, now);
      for (const signal of world.signals(now)) {
        client.publish(signalTopic(signal.receiverId), JSON.stringify(signal));
      }
    }, Math.round(1000 / HZ));
  });

  client.on('error', (err) => console.error(err.message));
}

main();
