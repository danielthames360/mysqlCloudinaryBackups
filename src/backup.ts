import { v2 as cloudinary } from "cloudinary";
import { createReadStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import mysqldump from "mysqldump";
import env from "./config";

cloudinary.config({
  cloud_name: env.CLOUDINARY.CLOUD_NAME,
  api_key: env.CLOUDINARY.API_KEY,
  api_secret: env.CLOUDINARY.API_SECRET,
});

const uploadToCloudinary = async ({
  name,
  path,
}: {
  name: string;
  path: string;
}) => {
  console.log("Uploading backup to Cloudinary...");
  const date = new Date();

  await cloudinary.uploader.upload(path, {
    public_id: name,
    resource_type: "raw",
    folder: `databaseBackups/${date.getFullYear()}/Month-${date.getMonth() + 1}`,
  });

  console.log("Backup uploaded to Cloudinary...");
};

const dumpDatabase = async (path: string) => {
  console.log("Dumping database...");

  await mysqldump({
    connection: {
      host: env.DATABASE.MYSQL_HOST!,
      user: env.DATABASE.MYSQL_USERNAME!,
      password: env.DATABASE.MYSQL_PASSWORD!,
      database: env.DATABASE.MYSQL_DATABASE!,
      port: Number(env.DATABASE.MYSQL_PORT),
    },
    dumpToFile: path,
  });

  console.log("Database dumped successfully...");
};

const compressFile = async (inputPath: string, outputPath: string) => {
  console.log("Compressing backup...");

  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  const gzip = createGzip({ level: 9 }); // Maximum compression

  await pipeline(source, gzip, destination);

  console.log("Backup compressed successfully...");
};

const deleteFile = async (path: string) => {
  console.log(`Deleting file: ${path}`);
  await unlink(path);
};

export const backup = async () => {
  console.log("Initiating DB backup...");

  const date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const compressedFilename = `${filename}.gz`;
  const filepath = `/tmp/${filename}`;
  const compressedFilepath = `/tmp/${compressedFilename}`;

  try {
    await dumpDatabase(filepath);
    await compressFile(filepath, compressedFilepath);
    await uploadToCloudinary({ name: compressedFilename, path: compressedFilepath });
    await deleteFile(filepath);
    await deleteFile(compressedFilepath);
  } catch (error) {
    console.log("An error occurred!", error);
  }

  console.log("DB backup complete...");
};
