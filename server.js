const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ayamku-2c344-default-rtdb.firebaseio.com"
});

const db = admin.database();

// Fungsi waktu WIB (UTC+7) dalam format string
function getWaktuWIB() {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000; // 7 jam dalam ms
  const wib = new Date(now.getTime() + wibOffset);

  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  const hour = String(wib.getUTCHours()).padStart(2, '0');
  const minute = String(wib.getUTCMinutes()).padStart(2, '0');
  const second = String(wib.getUTCSeconds()).padStart(2, '0');

  // Format: 2026-06-08T14:37:00.000Z tapi sudah dalam WIB
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

// Endpoint kirim data sensor
app.post("/api/kirimdata", async (req, res) => {
  try {
    console.log("Data diterima:", req.body);
    const { suhu, kelembaban, mq135 } = req.body;

    if (suhu === undefined || kelembaban === undefined || mq135 === undefined) {
      return res.status(400).json({
        success: false,
        message: "Field 'suhu', 'kelembaban', dan 'mq135' wajib diisi"
      });
    }

    const waktuWIB = getWaktuWIB();

    // Update data realtime
    await db.ref("sensor").set({
      suhu: Number(suhu),
      kelembaban: Number(kelembaban),
      mq135: Number(mq135),
      updatedAt: waktuWIB
    });

    // Simpan ke history
    await db.ref("history").push({
      suhu: Number(suhu),
      kelembaban: Number(kelembaban),
      mq135: Number(mq135),
      timestamp: waktuWIB
    });

    return res.status(200).json({
      success: true,
      message: "Data berhasil dikirim ke Realtime Database"
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
