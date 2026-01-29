import { chromium } from "playwright";

const URL =
  "https://www.montevideo.gub.uy/sae/agendarReserva/Paso1.xhtml?agenda=TRYCV&recurso=3-EMPADRONAMIENTOS&pagina_retorno=http%3A//www.montevideo.gub.uy&solo_cuerpo=false";

async function getMonthLabel(page) {
  const loc = page.locator("td.rich-calendar-month div").first();
  await loc.waitFor({ timeout: 15000 });
  return (await loc.innerText()).trim().replace(/\s+/g, " ");
}

async function nextMonth(page) {
  const before = await getMonthLabel(page);

  await page.locator("div.rich-calendar-tool-btn[onclick*='nextMonth']").first().click();

  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector("td.rich-calendar-month div");
      const now = (el?.textContent || "").trim().replace(/\s+/g, " ");
      return now && now !== prev;
    },
    before,
    { timeout: 15000 }
  );
}

export async function checkCupos({ monthsToCheck = 4, headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector("td.diaConCupo, td.diaSinCupo", { timeout: 15000 });

    const results = [];

    for (let i = 0; i < monthsToCheck; i++) {
      const monthLabel = await getMonthLabel(page);

      const diasConCupo = await page.$$eval("td.diaConCupo", (tds) =>
        tds
          .map((td) => (td.textContent || "").trim())
          .filter((t) => /^\d{1,2}$/.test(t))
          .map(Number)
          .sort((a, b) => a - b)
      );

      results.push({ monthLabel, diasConCupo });

      if (i < monthsToCheck - 1) {
        await nextMonth(page);
      }
    }

    // Resumen
    const firstWithCupo = results.find((r) => r.diasConCupo.length > 0) || null;

    return {
      url: URL,
      checkedAt: new Date().toISOString(),
      results,              // lista por mes
      hasCupo: !!firstWithCupo,
      firstWithCupo,        // {monthLabel, diasConCupo} o null
    };
  } finally {
    await browser.close();
  }
}
