const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Ganti path ini dengan path file serviceAccountKey.json kamu
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Fungsi untuk mengurangi 7 jam dari waktu lokal
function getAdjustedTimestamp() {
  const now = new Date();
  now.setHours(now.getHours());
  return now;
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
      timestamp: getAdjustedTimestamp()
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
