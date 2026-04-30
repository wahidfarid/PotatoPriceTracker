import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("Navigating to BigMagic...");

  page.on("request", (request) =>
    console.log(">>", request.method(), request.url()),
  );
  page.on("response", (response) =>
    console.log("<<", response.status(), response.url()),
  );

  await page.goto(
    "https://www.bigweb.co.jp/ver2/magic/search?search_word=Sheoldred",
  );

  // Wait for content
  try {
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Sheoldred") ||
        document.body.innerText.includes("円"),
      { timeout: 15000 },
    );
  } catch (e) {
    console.log("Timeout waiting for text content");
  }

  const content = await page.content();
  const fs = require("fs");
  fs.writeFileSync("inspect_bigmagic.html", content);
  console.log("Dumped HTML to inspect_bigmagic.html");

  await browser.close();
}

main().catch(console.error);
