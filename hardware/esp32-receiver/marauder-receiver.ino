#include <WiFi.h>
#include <PubSubClient.h>
#include <NimBLEDevice.h>

static const char* WIFI_SSID = "your-wifi";
static const char* WIFI_PASSWORD = "your-wifi-password";
static const char* MQTT_HOST = "192.168.1.10";
static const uint16_t MQTT_PORT = 1883;
static const char* RECEIVER_ID = "R1";
static const char* TAG_PREFIX = "";
static const int DEFAULT_TX_POWER = -59;
static const int SCAN_SECONDS = 1;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
  }
}

void ensureMqtt() {
  if (mqtt.connected()) {
    return;
  }
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqtt.connected()) {
    String clientId = String("marauder-") + RECEIVER_ID + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(clientId.c_str())) {
      break;
    }
    delay(500);
  }
}

class ScanHandler : public NimBLEScanCallbacks {
  void onResult(const NimBLEAdvertisedDevice* device) override {
    String name = device->getName().c_str();
    if (strlen(TAG_PREFIX) > 0 && name.indexOf(TAG_PREFIX) < 0) {
      return;
    }
    String fingerprint = device->getAddress().toString().c_str();
    int txPower = device->haveTXPower() ? device->getTXPower() : DEFAULT_TX_POWER;
    char topic[64];
    snprintf(topic, sizeof(topic), "sensors/%s/signals", RECEIVER_ID);
    char payload[192];
    snprintf(payload, sizeof(payload),
      "{\"fingerprint\":\"%s\",\"receiverId\":\"%s\",\"rssi\":%d,\"txPower\":%d}",
      fingerprint.c_str(), RECEIVER_ID, device->getRSSI(), txPower);
    mqtt.publish(topic, payload);
  }
};

void setup() {
  ensureWifi();
  ensureMqtt();
  NimBLEDevice::init("");
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setScanCallbacks(new ScanHandler(), false);
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(90);
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();
  NimBLEDevice::getScan()->start(SCAN_SECONDS * 1000, false);
}
