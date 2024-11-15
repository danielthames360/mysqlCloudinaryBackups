import { v2 as cloudinary } from "cloudinary";
import { unlink, unlinkSync, createReadStream, createWriteStream } from "fs";
import mysqldump from "mysqldump";
import zlib from "zlib";
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
    folder: `databaseBackups/${date.getFullYear()}/Month-${
      date.getMonth() + 1
    }`,
  });

  console.log("Backup uploaded to Cloudinary...");
};

const dumpAndCompress = async (path: string) => {
  console.log("Dumping and compressing DB...");
  const dumpPath = path.replace(".gz", "");

  // Realizar el volcado de la base de datos a un archivo temporal
  await mysqldump({
    connection: {
      host: env.DATABASE.MYSQL_HOST,
      user: env.DATABASE.MYSQL_USERNAME || "defaultUsername",
      password: env.DATABASE.MYSQL_PASSWORD || "defaultPassword",
      database: env.DATABASE.MYSQL_DATABASE || "defaultDatabase",
      port: Number(env.DATABASE.MYSQL_PORT), // Asegurarse de que sea un número
    },
    dumpToFile: dumpPath,
  });

  // Comprimir el archivo de volcado
  await new Promise<void>((resolve, reject) => {
    const fileContents = createReadStream(dumpPath);
    const writeStream = createWriteStream(path);
    const gzip = zlib.createGzip();

    fileContents
      .pipe(gzip)
      .pipe(writeStream)
      .on("finish", () => {
        // Eliminar el archivo de volcado sin comprimir
        unlinkSync(dumpPath);
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });

  console.log("DB dumped and compressed successfully...");
};

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise<void>((resolve, reject) => {
    unlink(path, (err) => {
      if (err) {
        reject({ error: JSON.stringify(err) });
        return;
      }
      resolve();
    });
  });
};

export const backup = async () => {
  console.log("Initiating compressed DB backup...");

  const date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `backup-${timestamp}.sql.gz`;
  const filepath = `/tmp/${filename}`;

  try {
    await dumpAndCompress(filepath);
    await uploadToCloudinary({ name: filename, path: filepath });
    await deleteFile(filepath);
  } catch (error) {
    console.log("An error occurred!", error);
  }

  console.log("Compressed DB backup complete...");
};
