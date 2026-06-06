import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// نحتاج نشغل reportGenerator مباشرة
// نختبر puppeteer أولاً
import puppeteer from "puppeteer-core";
import QRCode from "qrcode";

async function main() {
  console.log("Testing puppeteer...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  });
  
  const page = await browser.newPage();
  
  // اختبار QR Code
  const qr = await QRCode.toDataURL("https://forms.office.com/r/7ipTRHD4QJ", { width: 130, margin: 1 });
  console.log("QR Code generated:", qr.length > 0 ? "OK" : "FAIL");
  
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; direction: rtl; }
.qr { text-align: center; }
</style>
</head>
<body>
<h1>اختبار التقرير</h1>
<div class="qr"><img src="${qr}" width="130" height="130"/></div>
<p>محمد علي الشمراني - لم يحل الاختبار</p>
</body>
</html>`;
  
  await page.setContent(html, { waitUntil: "load" });
  await new Promise(r => setTimeout(r, 500));
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await page.close();
  await browser.close();
  
  console.log("PDF generated successfully - size:", pdf.length, "bytes");
}

main().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
