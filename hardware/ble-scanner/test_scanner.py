import pytest

from scanner import Settings, SettingsError, read_settings, reading

SETTINGS = Settings(mqtt_host="localhost", mqtt_port=1883, receiver_id="R1", tag_prefix="tag-", tx_power=-59)


def test_reads_the_defaults_when_nothing_is_set() -> None:
    assert read_settings({}) == Settings(
        mqtt_host="localhost",
        mqtt_port=1883,
        receiver_id="R1",
        tag_prefix="",
        tx_power=-59,
    )


def test_reads_a_fractional_tx_power() -> None:
    assert read_settings({"TX_POWER": "-61.3", "RECEIVER_ID": "hall-a.2"}).tx_power == -61.3


@pytest.mark.parametrize(
    ("env", "complaint"),
    [
        ({"RECEIVER_ID": "Hall A"}, "RECEIVER_ID"),
        ({"RECEIVER_ID": "_R1"}, "RECEIVER_ID"),
        ({"RECEIVER_ID": "R" * 41}, "RECEIVER_ID"),
        ({"RECEIVER_ID": "R1\n"}, "RECEIVER_ID"),
        ({"RECEIVER_ID": "Rü"}, "RECEIVER_ID"),
        ({"MQTT_PORT": "abc"}, "MQTT_PORT"),
        ({"MQTT_PORT": "0"}, "MQTT_PORT"),
        ({"MQTT_PORT": "70000"}, "MQTT_PORT"),
        ({"MQTT_HOST": ""}, "MQTT_HOST"),
        ({"TX_POWER": "x"}, "TX_POWER"),
        ({"TX_POWER": "-127"}, "TX_POWER"),
        ({"TX_POWER": "21"}, "TX_POWER"),
        ({"TX_POWER": "nan"}, "TX_POWER"),
    ],
)
def test_refuses_a_setting_the_api_would_drop_and_names_it(env: dict[str, str], complaint: str) -> None:
    with pytest.raises(SettingsError, match=complaint):
        read_settings(env)


def test_sends_the_calibrated_tx_power_whatever_the_tag_advertises() -> None:
    assert reading(SETTINGS, "aa:bb:cc", "tag-7", -70) == {
        "fingerprint": "aa:bb:cc",
        "receiverId": "R1",
        "rssi": -70,
        "txPower": -59,
    }


@pytest.mark.parametrize(
    ("local_name", "rssi"),
    [
        ("phone", -70),
        ("xtag-7", -70),
        (None, -70),
        ("tag-7", -127),
        ("tag-7", 127),
    ],
)
def test_skips_other_devices_and_rssi_that_means_not_available(local_name: str | None, rssi: int) -> None:
    assert reading(SETTINGS, "aa:bb:cc", local_name, rssi) is None
