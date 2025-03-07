import SftpClient from "ssh2-sftp-client";
import fs from "fs";
import csv from "csv-parser";
import moment from "moment-timezone";
import ExcelJS from "exceljs";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import path from 'path';
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sftp = new SftpClient();

// Timezone and Date Formatting
const formattedDate = moment().tz("America/Chicago").format("DDMMMYYYY"); // US/Central timezone
const fileName = `/Appts_ClearCar_${formattedDate}.csv`;
const remotePath = `/`;
const remoteFile = `${remotePath}${fileName}`;

// SFTP Connection Details
const config = {
  host: "sftp.maxdigital.com",
  port: 22,
  username: "xtime",
  password: "Lfmq*M@Jdn6b3-Fq*rNJ",
};

const pilotDealers = [
  { DEALER: "Ira Toyota of Danvers Service", WEB_KEY: "iratoyotadanvers", ZipCode: "01923" },
  { DEALER: "BMW Mobile Service", WEB_KEY: "bmwmobile", ZipCode: "36606" },
  { DEALER: "Honda Bay County Service", WEB_KEY: "hondapnmacty", ZipCode: "32404" },
  { DEALER: "VW Panama City Service", WEB_KEY: "vlkswgnpnmacty", ZipCode: "32404" },
  { DEALER: "World Ford Pensacola Service", WEB_KEY: "worldfordpensaco", ZipCode: "32505" },
  { DEALER: "Peck Honda Gulfport Service", WEB_KEY: "patpeckhonda", ZipCode: "39503" },
  { DEALER: "Ira Lexus Danvers Service", WEB_KEY: "iralexusdanvers", ZipCode: "01923" },
  { DEALER: "Ira Subaru Service", WEB_KEY: "irasubaru", ZipCode: "01923" },
  { DEALER: "Audi Peabody Service", WEB_KEY: "iraaudi", ZipCode: "01960" },
  { DEALER: "Porsche Westwood Service", WEB_KEY: "xtm202110191251xx1", ZipCode: "02090" },
  { DEALER: "Toyota Saco Service", WEB_KEY: "xtm202110251103xx1", ZipCode: "04072" },
  { DEALER: "Honda Saco Service", WEB_KEY: "xtm20211022802xx1", ZipCode: "04072" },
  { DEALER: "Ford Saco Service", WEB_KEY: "xtm20211019939xx1", ZipCode: "04072" },
  { DEALER: "Mercedes-Benz Scarborough Service", WEB_KEY: "xtm20211024747xx1", ZipCode: "04074" },
  { DEALER: "Ira Toyota Manchester Service", WEB_KEY: "iratoyotamanches", ZipCode: "03103" },
  { DEALER: "Ira Subaru Manchester Service", WEB_KEY: "xtm202002171001xx1", ZipCode: "03103" },
  { DEALER: "Mercedes Benz Manchester Service", WEB_KEY: "xtm20211024806xx1", ZipCode: "03103" },
  { DEALER: "BMW Stratham Service", WEB_KEY: "bmwofstratham", ZipCode: "03885" }
];

async function downloadAndParseCSV() {
  try {
    logger.info("Connecting to SFTP server...");
    await sftp.connect(config);

    // Download the file to a local temporary path
    const localFilePath = `./${fileName}`;
    logger.info(`Downloading file ${remoteFile} to ${localFilePath}...`);
    await sftp.get(remoteFile, localFilePath);

    // Close the SFTP connection
    logger.info("Closing SFTP connection...");
    await sftp.end();

    // Read and parse the CSV file
    return new Promise((resolve, reject) => {
      const results = [];

      fs.createReadStream(localFilePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => {
          // Add file name to each row
          logger.info(`Parsed ${results.length} records from ${fileName}`);
          results.forEach(row => {
            row.file_name = fileName;
          });

          logger.info(`Deleting local file ${localFilePath}...`);
          fs.unlinkSync(localFilePath);

          resolve(results);
        }).on("error", (error) => {
          logger.error(`Error parsing CSV file: ${error.message}`);
          reject(error)
        });
    });
  } catch (error) {
    logger.error(`Error downloading or parsing CSV file: ${error}`);
    throw error;
  }
}

function processCSVData(data) {
  return data
    .map(row => {
      // Find matching dealer
      const dealer = pilotDealers.find(d => d.WEB_KEY === row.WEB_KEY);
      if (!dealer) return null; // Ignore records without matching dealer

      return {
        "VIN #": row.VIN || null,
        "Year": row.YEAR || null,
        "Make": row.MAKE || null,
        "Model": row.MODEL || null,
        "Model Code": "",  // Default empty
        "Color": "WHITE",  // Default WHITE
        "Projected Current Miles": row.MILEAGE && row.MILEAGE !== "0" ? row.MILEAGE : "1",
        "ZipCode": dealer.ZipCode || "",
        "Consumer First Name": row.CUSTOMER_FIRST ? row.CUSTOMER_FIRST.toUpperCase() : "MISSING",
        "Consumer Last Name": row.CUSTOMER_LAST ? row.CUSTOMER_LAST.toUpperCase() : "MISSING",
        "Phone Number": row.MOBILE_PHONE ? String(row.MOBILE_PHONE) : "8888888888",
        "DEALER": dealer.DEALER
      };
    })
    .filter(row => row !== null && row["VIN #"]); // Remove rows without VIN
}

async function exportDealerFiles(finalData) {
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const uniqueDealers = [...new Set(finalData.map(row => row.DEALER))];
  const zipFilename = `cc_imports_${formattedDate}.zip`;
  const outputDir = path.resolve(__dirname, "exports");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const zipPath = path.join(outputDir, zipFilename);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    // Now safe to delete Excel files
    fs.readdir(outputDir, (err, files) => {
      if (err) {
        throw err;
      }

      files.forEach((file) => {
        if (file.endsWith(".xlsx")) {
          fs.unlink(path.join(outputDir, file), err => {
            if (err) throw err;
          });
        }
      });
    });
  });

  archive.on("error", (err) => {
    logger.error(`Error creating ZIP archive: ${err}`);
    throw err;
  });

  archive.pipe(output);

  const excelFiles = [];

  for (const dealer of uniqueDealers) {
    const dealerData = finalData.filter(row => row.DEALER === dealer).map(({ DEALER, ...rest }) => rest);

    if (dealerData.length === 0) continue;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");

    worksheet.columns = Object.keys(dealerData[0]).map(key => ({ header: key, key }));
    dealerData.forEach(row => worksheet.addRow(row));

    const sanitizedDealer = dealer.replace(/\s+/g, "_").toLowerCase();
    const fileName = `cc_import_${sanitizedDealer}_${formattedDate}.xlsx`;
    const filePath = path.join(outputDir, fileName);

    // Save the Excel file asynchronously and track its promise
    const saveFilePromise = workbook.xlsx.writeFile(filePath).then(() => {
      archive.file(filePath, { name: fileName });
    }).catch(err => {
      logger.error(`Error saving Excel file ${fileName}: ${err}`);
      throw err;
    });

    excelFiles.push(saveFilePromise);
  }

  // Wait for all Excel files to be written before finalizing ZIP
  await Promise.all(excelFiles);

  archive.finalize();
}


export default async function main() {
  try {
    logger.info("Starting download-zip script");
    const records = await downloadAndParseCSV();
    logger.info("Processing CSV data...");
    const processedData = processCSVData(records);
    logger.info("Exporting dealer files to zip...");
    await exportDealerFiles(processedData); 
    logger.info("Finished download-zip script");
  } catch (error) {
    logger.error(`Error in download-zip script: ${error}`);
    throw error;
  }
}

