import "dotenv/config";
import { checkCupos } from "./check-cupos-core.js";
import fs from "node:fs";

const MODE = process.env.MODE || "check"; // "check" o "status"
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

const MONTHS_TO_CHECK = 4
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

function formatFoundMessage(r) {
  const lines = r.results.map(x =>
    x.diasConCupo.length ? `✅ ${x.monthLabel}: ${x.diasConCupo.join(", ")}` : `❌ ${x.monthLabel}: sin cupos`
  );
  return `✅ HAY CUPOS DISPONIBLES\n\n${lines.join("\n")}\n\n🔗 ${r.url}`;
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

  if (MODE === "check") {
    // solo avisa si hay cupo y cambió (anti-spam)
    if (r.hasCupo) {
      await sendTelegram(formatFoundMessage(r));
    }
  } else {
    // status cada 30 min
    await sendTelegram(formatStatusMessage(r));
  }
})();
