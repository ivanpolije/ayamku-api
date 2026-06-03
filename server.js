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

function getWaktuIndonesia() {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + wibOffset * 60000);
}

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

    const waktu = getWaktuIndonesia();

    // Update data realtime (Flutter baca ini)
    await db.ref("sensor").set({
      suhu: Number(suhu),
      kelembaban: Number(kelembaban),
      mq135: Number(mq135),
      updatedAt: waktu.toISOString()
    });

    // Simpan ke history
    await db.ref("history").push({
      suhu: Number(suhu),
      kelembaban: Number(kelembaban),
      mq135: Number(mq135),
      timestamp: waktu.toISOString()
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
