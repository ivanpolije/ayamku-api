/**
 * AyamKu Backend - Railway
 * 
 * Fungsi:
 *  - Subscribe MQTT topic ayamku/sensor → simpan ke Firebase Realtime DB + history
 *  - Subscribe Firebase /kontrol, /threshold, /jadwal → publish balik ke ESP32 via MQTT
 *  - HTTP endpoint GET / untuk health check
 */

const express      = require("express");
const cors         = require("cors");
const mqtt         = require("mqtt");
const admin        = require("firebase-admin");

// =============================================
// Firebase Admin
// =============================================
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential:  admin.credential.cert(serviceAccount),
    databaseURL: "https://ayamku-2c344-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

// =============================================
// MQTT Topics
// =============================================
const TOPIC_SENSOR        = "ayamku/sensor";         // ESP32 publish
const TOPIC_KONTROL_FAN   = "ayamku/kontrol/fan";    // Backend publish → ESP32
const TOPIC_KONTROL_LAMP  = "ayamku/kontrol/lamp";   // Backend publish → ESP32
const TOPIC_THRESHOLD     = "ayamku/threshold";      // Backend publish → ESP32
const TOPIC_JADWAL        = "ayamku/jadwal";         // Backend publish → ESP32

// =============================================
// Waktu WIB
// =============================================
function getWaktuWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth()+1)}-${pad(wib.getUTCDate())}` +
         `T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}.000Z`;
}

// =============================================
// MQTT Client
// =============================================
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883", {
  clientId: `ayamku-backend-${Math.random().toString(16).slice(2, 8)}`,
  clean:    true,
  reconnectPeriod: 3000,
});

mqttClient.on("connect", () => {
  console.log("[MQTT] Terhubung ke broker.hivemq.com");

  // Subscribe topic dari ESP32
  mqttClient.subscribe(TOPIC_SENSOR, { qos: 0 }, (err) => {
    if (err) console.error("[MQTT] Gagal subscribe sensor:", err.message);
    else     console.log(`[MQTT] Subscribe: ${TOPIC_SENSOR}`);
  });
});

mqttClient.on("reconnect", () => console.log("[MQTT] Reconnecting..."));
mqttClient.on("error",     (e) => console.error("[MQTT] Error:", e.message));

// =============================================
// Proses data sensor dari ESP32
// =============================================
mqttClient.on("message", async (topic, message) => {
  if (topic !== TOPIC_SENSOR) return;

  let data;
  try {
    data = JSON.parse(message.toString());
  } catch (e) {
    console.error("[MQTT] Payload bukan JSON:", message.toString());
    return;
  }

  const { suhu, kelembaban, mq135 } = data;
  if (suhu === undefined || kelembaban === undefined || mq135 === undefined) {
    console.warn("[MQTT] Field kurang:", data);
    return;
  }

  const waktu = getWaktuWIB();
  console.log(`[SENSOR] Suhu:${suhu} Lemb:${kelembaban} MQ135:${mq135} @ ${waktu}`);

  try {
    // Update node /sensor (data live untuk Flutter)
    await db.ref("sensor").set({
      suhu:       Number(suhu),
      kelembaban: Number(kelembaban),
      mq135:      Number(mq135),
      updatedAt:  waktu
    });

    // Push ke /history (riwayat)
    await db.ref("history").push({
      suhu:       Number(suhu),
      kelembaban: Number(kelembaban),
      mq135:      Number(mq135),
      timestamp:  waktu
    });

    console.log("[FB] Data disimpan ke Firebase");
  } catch (e) {
    console.error("[FB] Gagal simpan:", e.message);
  }
});

// =============================================
// Listen perubahan Firebase → publish ke ESP32
// Saat user ubah kontrol/threshold/jadwal dari app Flutter,
// backend langsung forward ke ESP32 via MQTT
// =============================================

// Kontrol relay
db.ref("kontrol").on("value", (snap) => {
  const data = snap.val();
  if (!data) return;
  mqttClient.publish(TOPIC_KONTROL_FAN,  String(data.fan  === true), { qos: 0, retain: true });
  mqttClient.publish(TOPIC_KONTROL_LAMP, String(data.lamp === true), { qos: 0, retain: true });
  console.log(`[FB→MQTT] kontrol fan:${data.fan} lamp:${data.lamp}`);
});

// Threshold
db.ref("threshold").on("value", (snap) => {
  const data = snap.val();
  if (!data) return;
  mqttClient.publish(TOPIC_THRESHOLD, JSON.stringify(data), { qos: 0, retain: true });
  console.log("[FB→MQTT] threshold:", data);
});

// Jadwal pakan
db.ref("jadwal").on("value", (snap) => {
  const data = snap.val();
  if (!data) return;
  mqttClient.publish(TOPIC_JADWAL, JSON.stringify(data), { qos: 0, retain: true });
  console.log("[FB→MQTT] jadwal:", data);
});

// =============================================
// Express HTTP (health check + Railway keep-alive)
// =============================================
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status:  "AyamKu API running 🐔",
    mqtt:    mqttClient.connected ? "connected" : "disconnected",
    broker:  "broker.hivemq.com:1883",
    topics: {
      subscribe: [TOPIC_SENSOR],
      publish:   [TOPIC_KONTROL_FAN, TOPIC_KONTROL_LAMP, TOPIC_THRESHOLD, TOPIC_JADWAL]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
