import { chromium } from "playwright";

const BASE = "https://web-production-ec6b96.up.railway.app";
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "rjuandavid2002@gmail.com");
await page.fill("#password", "El_gatofly2");
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);

await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const before = await page.getByRole("button").allTextContents();
console.log("before:", before);

await page.getByRole("button", { name: "Deshabilitar" }).click();
await page.waitForTimeout(2000);

const after = await page.getByRole("button").allTextContents();
console.log("after:", after);

await page.screenshot({ path: "scratch-admin-after.png", fullPage: true });

await browser.close();
