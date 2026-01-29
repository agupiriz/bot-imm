import "dotenv/config";
import { checkCupos } from "./check-cupos-core.js";
import fs from "node:fs";

const MODE = process.env.MODE || "check"; // "check" o "status"
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

const MONTHS_TO_CHECK = Number(process.env.MONTHS_TO_CHECK || 4);
const HEADLESS = true;

const STATE_FILE = "state.json";

async function sendTelegram(message) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: message,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram error: ${res.status}`);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { lastSignature: null }; }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
function signatureFromResult(r) {
  return JSON.stringify(r.results.map(x => ({ m: x.monthLabel, d: x.diasConCupo })));
}

function formatFoundMessage(r) {
  const fw = r.firstWithCupo;
  return `✅ HAY CUPOS DISPONIBLES\n\n📅 Mes: ${fw.monthLabel}\n🟢 Días: ${fw.diasConCupo.join(", ")}\n\n🔗 ${r.url}`;
}
function formatStatusMessage(r) {
  const lines = r.results.map(x =>
    x.diasConCupo.length ? `✅ ${x.monthLabel}: ${x.diasConCupo.join(", ")}` : `❌ ${x.monthLabel}: sin cupos`
  );
  return `🔎 Estado (sigo buscando)\n\n${lines.join("\n")}\n\n🔗 ${r.url}`;
}

(async () => {
  if (!TG_TOKEN || !TG_CHAT_ID) throw new Error("Faltan TG_TOKEN/TG_CHAT_ID");

  const r = await checkCupos({ monthsToCheck: MONTHS_TO_CHECK, headless: HEADLESS });
  const state = loadState();
  const sig = signatureFromResult(r);

  if (MODE === "check") {
    // solo avisa si hay cupo y cambió (anti-spam)
    if (r.hasCupo && sig !== state.lastSignature) {
      await sendTelegram(formatFoundMessage(r));
      state.lastSignature = sig;
      saveState(state);
    }
  } else {
    // status cada 30 min
    await sendTelegram(formatStatusMessage(r));
  }
})();
