const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Ganti path ini dengan path file serviceAccountKey.json kamu
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Fungsi untuk mendapatkan waktu WIB (UTC+7)
function getWaktuIndonesia() {
  const now = new Date();
  const wibOffset = 7 * 60; // dalam menit
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + wibOffset * 60000);
}

// Endpoint untuk kirim data sensor ke Firestore
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

    await db.collection("history").add({
      suhu: Number(suhu),
      kelembaban: Number(kelembaban),
      mq135: Number(mq135),
      timestamp: getWaktuIndonesia()
    });

    return res.status(200).json({
      success: true,
      message: "Data berhasil dikirim ke Firestore"
    });
  } catch (error) {
    console.error("Error mengirim data:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Port default
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
