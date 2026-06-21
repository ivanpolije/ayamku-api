const admin = require("firebase-admin");

// Inisialisasi Firebase Admin hanya sekali (cold start safe)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ayamku-2c344-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

// Fungsi waktu WIB (UTC+7) dalam format string
function getWaktuWIB() {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wib = new Date(now.getTime() + wibOffset);

  const year   = wib.getUTCFullYear();
  const month  = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day    = String(wib.getUTCDate()).padStart(2, '0');
  const hour   = String(wib.getUTCHours()).padStart(2, '0');
  const minute = String(wib.getUTCMinutes()).padStart(2, '0');
  const second = String(wib.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

// Vercel serverless handler (tidak pakai app.listen)
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({ status: "AyamKu API running 🐔" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

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

    // Update node sensor (data live untuk Flutter)
    await db.ref("sensor").set({
      suhu:      Number(suhu),
      kelembaban: Number(kelembaban),
      mq135:     Number(mq135),
      updatedAt: waktuWIB
    });

    // Push ke history (riwayat data)
    await db.ref("history").push({
      suhu:      Number(suhu),
      kelembaban: Number(kelembaban),
      mq135:     Number(mq135),
      timestamp: waktuWIB
    });

    return res.status(200).json({
      success: true,
      message: "Data berhasil dikirim ke Realtime Database"
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
