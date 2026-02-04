import { v2 as cloudinary } from "cloudinary";
import { unlink, createReadStream, createWriteStream } from "fs";
import { exec } from "child_process";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import env from "./config";

cloudinary.config({
  cloud_name: env.CLOUDINARY.CLOUD_NAME,
  api_key: env.CLOUDINARY.API_KEY,
  api_secret: env.CLOUDINARY.API_SECRET,
});

const uploadToCloudinary = async ({ name, path }: { name: string, path: string }) => {
  console.log("Uploading backup to Cloudinary...");
  const date = new Date();

  await cloudinary.uploader.upload(path, {
    public_id: name,
    resource_type: 'auto',
    folder: `databaseBackups/${date.getFullYear()}/Month-${date.getMonth() + 1}`,
  });

  console.log("Backup uploaded to Cloudinary...");
};

const dumpToFile = async (path: string) => {
  console.log("Dumping DB to file...");

  await new Promise((resolve, reject) => {
    const command = `mysqldump --user=${env.DATABASE.MYSQL_USERNAME} --password=${env.DATABASE.MYSQL_PASSWORD} --host=${env.DATABASE.MYSQL_HOST} --port=${env.DATABASE.MYSQL_PORT}  --single-transaction --routines --triggers --databases ${env.DATABASE.MYSQL_DATABASE} > ${path}`;
    exec(command, (error, _, stderr) => {
      if (error) {
        reject({ error: JSON.stringify(error), stderr });
        return;
      }
      resolve(undefined);
    });
  });

  console.log("DB dumped to file...");
};

const deleteFile = async (path: string) => {
  console.log(`Deleting file: ${path}`);
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      if (err) {
        reject({ error: JSON.stringify(err) });
        return;
      }
      resolve(undefined);
    });
  });
};

const compressFile = async (inputPath: string, outputPath: string) => {
  console.log("Compressing backup with gzip...");

  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  const gzip = createGzip({ level: 9 }); // Maximum compression

  await pipeline(source, gzip, destination);

  console.log("Backup compressed successfully...");
};



export const backup = async () => {
  console.log("Initiating DB backup...");

  let date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const compressedFilename = `${filename}.gz`;
  const filepath = `/tmp/${filename}`;
  const compressedFilepath = `/tmp/${compressedFilename}`;

  try {
    await dumpToFile(filepath);
    await compressFile(filepath, compressedFilepath);
    await uploadToCloudinary({ name: compressedFilename, path: compressedFilepath });
    await deleteFile(filepath);
    await deleteFile(compressedFilepath);
  } catch (error) {
    console.log('An error ocurred!', error);
  }

  console.log("DB backup complete...");
};
