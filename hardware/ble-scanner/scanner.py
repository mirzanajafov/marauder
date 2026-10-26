import asyncio
import json
import os

from bleak import BleakScanner
import paho.mqtt.client as mqtt

MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
RECEIVER_ID = os.environ.get("RECEIVER_ID", "R1")
TAG_PREFIX = os.environ.get("TAG_PREFIX", "")
DEFAULT_TX_POWER = int(os.environ.get("TX_POWER", "-59"))
LOWEST_DBM = -127
HIGHEST_DBM = 20

client = mqtt.Client()
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()
topic = f"sensors/{RECEIVER_ID}/signals"


def on_device(device, adv):
    name = adv.local_name or ""
    if TAG_PREFIX and TAG_PREFIX not in name:
        return
    advertised = adv.tx_power
    in_range = advertised is not None and LOWEST_DBM <= advertised <= HIGHEST_DBM
    tx_power = advertised if in_range else DEFAULT_TX_POWER
    payload = json.dumps(
        {
            "fingerprint": device.address,
            "receiverId": RECEIVER_ID,
            "rssi": adv.rssi,
            "txPower": tx_power,
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
