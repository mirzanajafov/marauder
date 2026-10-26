import asyncio
import json
import os
import re
import sys

from bleak import BleakScanner
import paho.mqtt.client as mqtt

MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
RECEIVER_ID = os.environ.get("RECEIVER_ID", "R1")
TAG_PREFIX = os.environ.get("TAG_PREFIX", "")
TX_POWER = int(os.environ.get("TX_POWER", "-59"))
RECEIVER_ID_PATTERN = re.compile(r"[A-Za-z0-9][\w.:-]{0,39}", re.ASCII)
LOWEST_DBM = -127
HIGHEST_DBM = 20

if not RECEIVER_ID_PATTERN.fullmatch(RECEIVER_ID):
    sys.exit(
        "RECEIVER_ID must be 1 to 40 letters, digits, dots, colons, dashes or underscores, "
        "starting with a letter or digit"
    )
if not LOWEST_DBM <= TX_POWER <= HIGHEST_DBM:
    sys.exit(f"TX_POWER must be between {LOWEST_DBM} and {HIGHEST_DBM} dBm")

client = mqtt.Client()
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()
topic = f"sensors/{RECEIVER_ID}/signals"


def on_device(device, adv):
    name = adv.local_name or ""
    if TAG_PREFIX and TAG_PREFIX not in name:
        return
    payload = json.dumps(
        {
            "fingerprint": device.address,
            "receiverId": RECEIVER_ID,
            "rssi": adv.rssi,
            "txPower": TX_POWER,
        }
    )
    client.publish(topic, payload)


async def main():
    scanner = BleakScanner(detection_callback=on_device)
    await scanner.start()
    print(f"scanning as receiver {RECEIVER_ID}, publishing to {MQTT_HOST}:{MQTT_PORT} topic {topic}")
    while True:
        await asyncio.sleep(3600)


asyncio.run(main())
