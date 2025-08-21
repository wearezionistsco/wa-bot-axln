const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");

// ================= CONFIG =================
const ADMIN = "6287756266682@c.us"; // ganti dengan nomor adminmu
const ALLOWED_NUMBERS = [
  ADMIN,
  "6285179911407@c.us", // contoh whitelist
  "6289876543210@c.us"
];

const SESSION_PATH = path.join(__dirname, "storage/.wwebjs_auth");
const LOG_FILE = path.join(__dirname, "storage/bot.log");

let userState = {};   // simpan state per user

// ================= MENU =================
const menuUtama = `
📌 *MENU UTAMA*
1️⃣ TOP UP
2️⃣ PESAN PRIBADI
0️⃣ MENU
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

// ================= HELPER =================
function logMessage(from, message) {
  const time = new Date().toISOString();
  const log = `[${time}] ${from}: ${message}\n`;
  fs.appendFileSync(LOG_FILE, log, "utf8");
}

function resetSession(from) {
  delete userState[from];
}

// ================= CLIENT =================
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: SESSION_PATH, // simpan session di volume
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// QR Code hanya muncul di log Railway
client.on("qr", (qr) => {
  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
  console.log("🔑 Scan QR lewat link ini:");
  console.log(qrLink);
});

// Bot siap
client.on("ready", () => {
  console.log("✅ Bot WhatsApp aktif!");
});

// ================= HANDLER CHAT =================
client.on("message", async (msg) => {
  const chat = msg.body.trim();
  const from = msg.from;

  logMessage(from, chat);

  // Command admin
  if (from === ADMIN) {
    if (chat === "close") {
      userState = {};
      return msg.reply("✅ Semua sesi user berhasil direset.");
    }
    if (chat.startsWith("close ")) {
      const nomor = chat.replace("close ", "").trim() + "@c.us";
      resetSession(nomor);
      return msg.reply(`✅ Sesi untuk ${nomor} berhasil direset.`);
    }
  }

  // Jika user belum punya state → langsung kirim menu
  if (!userState[from]) {
    userState[from] = "menu";
    return msg.reply(menuUtama);
  }

  // --- MENU UTAMA ---
  if (chat === "menu" || chat === "0") {
    userState[from] = "menu";
    return msg.reply(menuUtama);
  }

  // --- PILIH MENU UTAMA ---
  if (chat === "1" && userState[from] === "menu") {
    userState[from] = "topup";
    return msg.reply(menuTopUp);
  }
  if (chat === "2" && userState[from] === "menu") {
    userState[from] = "pesan";
    return msg.reply(menuPesanPribadi);
  }

  // --- SUB MENU TOP UP ---
  if (userState[from] === "topup") {
    if (["1","2","3","4","5","6"].includes(chat)) {
      const nominal = ["150","200","300","500","1/2","1"][parseInt(chat)-1];
      resetSession(from);
      return msg.reply(`✅ TOP UP *${nominal}* diproses. Terima kasih!\n\n${menuUtama}`);
    }
    if (chat === "0") {
      userState[from] = "menu";
      return msg.reply(menuUtama);
    }
    return msg.reply("❌ Pilihan tidak valid. Silakan pilih sesuai menu.");
  }

  // --- SUB MENU PESAN PRIBADI ---
  if (userState[from] === "pesan") {
    if (chat === "1") { resetSession(from); return msg.reply("📌 Bon dicatat.\n\n" + menuUtama); }
    if (chat === "2") { resetSession(from); return msg.reply("📌 Gadai dicatat.\n\n" + menuUtama); }
    if (chat === "3") { resetSession(from); return msg.reply("📌 HP dicatat.\n\n" + menuUtama); }
    if (chat === "4") { resetSession(from); return msg.reply("📌 Barang lain dicatat.\n\n" + menuUtama); }
    if (chat === "5") { resetSession(from); return msg.reply("📞 Permintaan telepon admin dikirim.\n\n" + menuUtama); }
    if (chat === "0") { userState[from] = "menu"; return msg.reply(menuUtama); }
    return msg.reply("❌ Pilihan tidak valid. Silakan pilih sesuai menu.");
  }
});

// ================= HANDLER PANGGILAN =================
client.on("call", async (call) => {
  if (ALLOWED_NUMBERS.includes(call.from)) {
    console.log("📞 Panggilan diizinkan dari:", call.from);
    return;
  }

  await call.reject();
  client.sendMessage(
    call.from,
    "❌ Maaf, panggilan tidak diizinkan.\nSilakan gunakan chat untuk akses menu."
  );
  console.log("🚫 Panggilan ditolak dari:", call.from);
});

// Jalankan bot
client.initialize();
