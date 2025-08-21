const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");

// ================= CONFIG =================
const ADMIN = "6287756266682@c.us"; // nomor admin
const EXCLUDED_NUMBERS = [ADMIN]; // nomor yang tidak diproses menu
let IZIN_TELEPON = [];

// Path untuk penyimpanan di Railway Volume
const STORAGE_PATH = "./storage";
const DATA_FILE = path.join(STORAGE_PATH, "data", "sessions.json");
const LOG_DIR = path.join(STORAGE_PATH, "logs");

// Pastikan folder ada
if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH);
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Simpan state user
let userState = {};
if (fs.existsSync(DATA_FILE)) {
  userState = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// ================= MENU =================
const menuUtama = `
📌 *MENU UTAMA*
1️⃣ Top Up
2️⃣ Pesan Pribadi
0️⃣ Kembali ke Menu
`;

const menuTopUp = `
💰 *TOP UP*
1. 150
2. 200
3. 300
4. 500
5. 1/2
6. 1
0. Kembali
`;

const menuPesanPribadi = `
✉ *PESAN PRIBADI*
1. Bon
2. Gadai
3. HP
4. Barang Lain
5. Telepon Admin
0. Kembali
`;

// ================= CLIENT =================
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(STORAGE_PATH, ".wwebjs_auth"),
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// ================= LOGGING =================
function logMessage(type, from, body) {
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  const line = `[${new Date().toISOString()}] [${type}] ${from}: ${body}\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

// Simpan state ke file
function saveState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userState, null, 2), "utf8");
}

// ================= EVENT =================
client.on("qr", (qr) => {
  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
  console.log("🔑 Scan QR di link ini:");
  console.log(qrLink);
});

client.on("ready", () => {
  console.log("✅ Bot WhatsApp aktif!");
});

// ================= HANDLER CHAT =================
client.on("message", async (msg) => {
  const chat = msg.body.trim();
  const from = msg.from;

  logMessage("INCOMING", from, chat);

  // Skip nomor excluded
  if (EXCLUDED_NUMBERS.includes(from)) return;

  // Auto tampilkan menu saat pesan apapun masuk pertama kali
  if (!userState[from]) {
    userState[from] = "menu";
    saveState();
    return msg.reply(menuUtama);
  }

  // Admin command
  if (from === ADMIN) {
    if (chat.toLowerCase() === "close") {
      userState = {};
      saveState();
      return msg.reply("✅ Semua sesi user telah direset.");
    }
    if (chat.startsWith("close ")) {
      const nomor = chat.replace("close ", "").trim() + "@c.us";
      delete userState[nomor];
      saveState();
      return msg.reply(`✅ Sesi untuk ${nomor} telah direset.`);
    }
    if (chat.startsWith("izin ")) {
      const nomor = chat.replace("izin ", "").trim() + "@c.us";
      if (!IZIN_TELEPON.includes(nomor)) IZIN_TELEPON.push(nomor);
      client.sendMessage(nomor, "✅ Kamu diizinkan telepon admin.");
      return msg.reply(`Nomor ${nomor} diizinkan telepon.`);
    }
    if (chat.startsWith("tolak ")) {
      const nomor = chat.replace("tolak ", "").trim() + "@c.us";
      IZIN_TELEPON = IZIN_TELEPON.filter((n) => n !== nomor);
      client.sendMessage(nomor, "❌ Izin telepon admin dicabut.");
      return msg.reply(`Nomor ${nomor} ditolak telepon.`);
    }
  }

  // Menu utama
  if (chat === "menu" || chat === "0") {
    userState[from] = "menu";
    saveState();
    return msg.reply(menuUtama);
  }

  // Pilih menu utama
  if (chat === "1" && userState[from] === "menu") {
    userState[from] = "topup";
    saveState();
    return msg.reply(menuTopUp);
  }
  if (chat === "2" && userState[from] === "menu") {
    userState[from] = "pesan";
    saveState();
    return msg.reply(menuPesanPribadi);
  }

  // Submenu TopUp
  if (userState[from] === "topup") {
    if (["1","2","3","4","5","6"].includes(chat)) {
      const nominal = ["150","200","300","500","1/2","1"][parseInt(chat)-1];
      userState[from] = "menu";
      saveState();
      return msg.reply(`✅ TOP UP ${nominal} diproses. Terima kasih!\n\n${menuUtama}`);
    }
    if (chat === "0") {
      userState[from] = "menu";
      saveState();
      return msg.reply(menuUtama);
    }
    return msg.reply("❌ Pilihan tidak valid. Silakan pilih sesuai menu.");
  }

  // Submenu Pesan Pribadi
  if (userState[from] === "pesan") {
    if (chat === "1") msg.reply("📌 Bon dicatat.");
    else if (chat === "2") msg.reply("📌 Gadai dicatat.");
    else if (chat === "3") msg.reply("📌 HP dicatat.");
    else if (chat === "4") msg.reply("📌 Barang lain dicatat.");
    else if (chat === "5") msg.reply("📞 Permintaan telepon admin dikirim.");
    else if (chat === "0") {
      userState[from] = "menu";
      saveState();
      return msg.reply(menuUtama);
    } else {
      return msg.reply("❌ Pilihan tidak valid. Silakan pilih sesuai menu.");
    }
  }
});

// ================= HANDLER PANGGILAN =================
client.on("call", async (call) => {
  logMessage("CALL", call.from, "Incoming Call");

  if (EXCLUDED_NUMBERS.includes(call.from)) return;

  if (!IZIN_TELEPON.includes(call.from)) {
    await call.reject();
    client.sendMessage(
      call.from,
      "❌ Maaf, panggilan ke admin tidak diizinkan.\nGunakan chat untuk mengakses menu."
    );
    console.log("Panggilan ditolak dari:", call.from);
  } else {
    console.log("Panggilan diizinkan dari:", call.from);
  }
});

// Jalankan bot
client.initialize();
