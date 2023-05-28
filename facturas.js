// Import necessary modules
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

function mergeFiles() {
  // Define array of types
  const types = ["LN", "LM", "TM", "KCM"];

  // Output file
  const outputFilePath = "output.txt";

  // Clear the output file if it exists
  if (fs.existsSync(outputFilePath)) {
    fs.unlinkSync(outputFilePath);
  }

  // Loop over each type
  for (let type of types) {
    const filePath = `FACTURAS_${type}.txt`;

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file
      const data = fs.readFileSync(filePath, "utf-8");

      // Append the data to the output file
      fs.appendFileSync(outputFilePath, data);
    } else {
      console.log(`File does not exist: ${filePath}`);
    }
  }

  console.log("All files merged into output.txt");
}

// Define array of types
const types = ["LN", "LM", "TM", "KCM"];

/**
 * Scrape data from enlacefiscal.com
 * @async
 * @param {string} TYPE - The type of invoice
 */
async function scrapeData(TYPE) {
  // Launch puppeteer browser in headless mode and enable request interception
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Disable unnecessary resources
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (
      req.resourceType() == "stylesheet" ||
      req.resourceType() == "font" ||
      req.resourceType() == "image"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // Function to read last ID invoice
  function getLastInvoiceId() {
    const data = fs.readFileSync(`FACTURAS_${TYPE}.txt`, "utf8");
    const regex = new RegExp(`Factura ${TYPE} - (\\d+)`, "g");
    let match;
    let lastInvoiceId = "";

    while ((match = regex.exec(data)) !== null) {
      lastInvoiceId = match[1];
    }

    return lastInvoiceId;
  }

  // Assign the last ID invoice to NUMBER
  const NUMBER = getLastInvoiceId();
  console.log(`Last ${TYPE} invoice ID: ${NUMBER}`);
  await page.waitForTimeout(5000);

  /**
   * Navigates to the invoice table
   * @async
   */
  async function goToTable() {
    console.log("Navigating to the invoice table...");
    await page.goto("https://portal.enlacefiscal.com/comprobantes/factura");
    await page.waitForTimeout(2000);
    // Click on series tab based on TYPE
    const serieTabs = {
      KCM: "#serie_tab_4_0",
      TM: "#serie_tab_3_0",
      LM: "#serie_tab_2_0",
      LN: "#serie_tab_1_0",
    };
    await page.click(serieTabs[TYPE] || "");
    // Wait for the table to load
    await page.waitForSelector(".m-datatable__table tbody");
    await page.waitForTimeout(5000);
    console.log("Invoice table loaded.");
  }

  console.log("Starting the scraping process...");
  await page.goto("https://portal.enlacefiscal.com/auth/login");
  await page.waitForTimeout(5000);
  console.log("Logging in...");

  // Fill in the login form and click the submit button
  await page.type('input[name="rfc"]', "OLS140228RA6", { delay: 100 });
  await page.type('input[name="usuario"]', "rocio.lopez", { delay: 100 });
  await page.type('input[name="contrasena"]', "Enero2021#", {
    delay: 100,
  });
  await page.click("#kt_login_signin_submit");

  // Wait for the page to load after login
  await page.waitForTimeout(10000);

  console.log("Logged in successfully.");

  // Call function to go to table
  await goToTable();
  await page.select("#estatus", "0");
  await page.click("#busqueda-facturas");
  await page.waitForTimeout(10000);

  console.log("Starting to scrape invoices...");

  // Get the number of rows
  const numRows = await page.$$eval(
    "#listado-general-factura tbody tr",
    (rows) => rows.length
  );
  console.log(`Number of rows: ${numRows}`);

  // Loop through each invoice in the table
  for (let i = 1; i <= numRows; i++) {
    console.log(`Processing invoice ${i} out of ${numRows}...`);
    await page.waitForSelector(
      `#listado-general-factura tbody tr:nth-child(${i})`
    );

    // Get the numbers from the id cell in the current row
    const idNumber = await page.$eval(
      `#listado-general-factura tbody tr:nth-child(${i}) td[data-field="id"]`,
      (td) => {
        const idText = td.textContent;
        // Extract just the numbers
        const numbers = idText.replace(/\D/g, "");
        return numbers;
      }
    );
    console.log(`Invoice ID: ${idNumber}`);

    if (idNumber > NUMBER) {
      await page.click(`#listado-general-factura tbody tr:nth-child(${i})`);
      await page.waitForTimeout(3000);

      const informacion = await page.evaluate(() => {
        const infoElement = document.querySelector("#texto-bloque");
        const facturaElement = document.querySelector(".m--font-brand");

        let info = infoElement ? infoElement.innerHTML.trim() : "Not found";
        let factura = facturaElement
          ? facturaElement.innerHTML.trim()
          : "Not found";

        return [info, factura];
      });

      let info = informacion[0];
      let factura = informacion[1];
      const re = info.search(
        /(BURU|TRHU|BEAU|CAAU|EGHU|MRSU|MSKU|TCNU|MEDU|EITU|NTCU|TFLU|TLLU|SLVU|VOLU|CMAC|OERU|NYKU|TGBU|TEMU|TMAL|YMMU|WHSU|PILU|PIDU|ONEU|WHLU|PCIU|SZLU|SUDU|WHLN|APHU|BMOU)[0-9]{7}/gm
      );

      fs.appendFileSync(
        `FACTURAS_${TYPE}.txt`,
        `${factura}\n${info}\nCONTENEDOR: ${info.slice(re, re + 11)}\n\n`
      );
      await goToTable();
      await page.waitForTimeout(1000);
    }
  }

  console.log("Finished processing invoices.");

  // Close the browser
  await browser.close();
  console.log("Browser closed. Scraping completed.");
}

// Define an async function to run the scrapeData function for each type sequentially
async function runScrapeDataForAllTypes() {
  for (const type of types) {
    await scrapeData(type).catch(console.error);

    // Merge the files after all scraping is done
    mergeFiles();
  }
}

// Call the function
runScrapeDataForAllTypes();
