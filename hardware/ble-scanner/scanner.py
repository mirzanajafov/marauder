import asyncio
import json
import os
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass

import paho.mqtt.client as mqtt
from bleak import BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData
from paho.mqtt.enums import CallbackAPIVersion

RECEIVER_ID_PATTERN = re.compile(r"[A-Za-z0-9][\w.:-]{0,39}", re.ASCII)
NO_SIGNAL_DBM = -127
HIGHEST_DBM = 20


class SettingsError(ValueError):
    pass


@dataclass(frozen=True)
class Settings:
    mqtt_host: str
    mqtt_port: int
    receiver_id: str
    tag_prefix: str
    tx_power: float

    @property
    def topic(self) -> str:
        return f"sensors/{self.receiver_id}/signals"


def read_settings(env: Mapping[str, str]) -> Settings:
    receiver_id = env.get("RECEIVER_ID", "R1")
    if not RECEIVER_ID_PATTERN.fullmatch(receiver_id):
        message = (
            "RECEIVER_ID must be 1 to 40 letters, digits, dots, colons, dashes or underscores, "
            "starting with a letter or digit"
        )
        raise SettingsError(message)
    try:
        mqtt_port = int(env.get("MQTT_PORT", "1883"))
    except ValueError:
        message = "MQTT_PORT must be a port number"
        raise SettingsError(message) from None
    try:
        tx_power = float(env.get("TX_POWER", "-59"))
    except ValueError:
        message = "TX_POWER must be a number of dBm"
        raise SettingsError(message) from None
    if not NO_SIGNAL_DBM < tx_power <= HIGHEST_DBM:
        message = f"TX_POWER must be above {NO_SIGNAL_DBM} and at most {HIGHEST_DBM} dBm"
        raise SettingsError(message)
    return Settings(
        mqtt_host=env.get("MQTT_HOST", "localhost"),
        mqtt_port=mqtt_port,
        receiver_id=receiver_id,
        tag_prefix=env.get("TAG_PREFIX", ""),
        tx_power=tx_power,
    )


def reading(settings: Settings, address: str, local_name: str | None, rssi: int) -> dict[str, object] | None:
    if settings.tag_prefix and settings.tag_prefix not in (local_name or ""):
        return None
    if not NO_SIGNAL_DBM < rssi <= HIGHEST_DBM:
        return None
    return {"fingerprint": address, "receiverId": settings.receiver_id, "rssi": rssi, "txPower": settings.tx_power}


async def scan(settings: Settings, client: mqtt.Client) -> None:
    def on_device(device: BLEDevice, adv: AdvertisementData) -> None:
        payload = reading(settings, device.address, adv.local_name, adv.rssi)
        if payload is not None:
            client.publish(settings.topic, json.dumps(payload))

    scanner = BleakScanner(detection_callback=on_device)
    await scanner.start()
    print(
        f"scanning as receiver {settings.receiver_id}, publishing to "
        f"{settings.mqtt_host}:{settings.mqtt_port} topic {settings.topic}"
    )
    await asyncio.Event().wait()


def main() -> None:
    try:
        settings = read_settings(os.environ)
    except SettingsError as error:
        sys.exit(str(error))
    client = mqtt.Client(CallbackAPIVersion.VERSION2)
    client.connect(settings.mqtt_host, settings.mqtt_port, 60)
    client.loop_start()
    asyncio.run(scan(settings, client))


if __name__ == "__main__":
    main()
