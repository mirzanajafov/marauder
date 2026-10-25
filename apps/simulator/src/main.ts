import mqtt from 'mqtt';
import { createDefaultWorld } from '@marauder/shared';
import { loadConfig } from './config';
import { startSimulation } from './simulation';

const config = loadConfig(process.env);
const world = createDefaultWorld({ ...config.traffic, random: Math.random });
const client = mqtt.connect(config.mqttUrl);
client.on('error', (err) => console.error(err.message));

startSimulation(client, world, config.hz);
