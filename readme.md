# MySql Backup - Cloudinary

Node.js application that performs scheduled backups of your MySQL database and uploads them to Cloudinary for secure storage. It utilizes a cron job to automate the backup process based on your desired frequency.

## Features

- **Automatic compression** - Gzip level 9 for maximum compression
- **File splitting** - Automatically splits files >9MB to stay under Cloudinary's 10MB limit
- **Integrity verification** - MD5 checksums for each part stored in manifest.json
- **Retry mechanism** - 3 upload attempts with 2s delay on failure
- **Rollback on failure** - Automatically deletes uploaded parts if backup fails
- **Easy restore** - Includes restore script with checksum verification

## Prerequisites

- Node.js and npm installed in the runtime environment
- Valid Cloudinary credentials and access to a MySQL database

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file in the project root (based on `.env.example`):

```env
# MySQL Database
MYSQL_USERNAME=your_username
MYSQL_PASSWORD=your_password
MYSQL_HOST=your_host
MYSQL_PORT=3306
MYSQL_DATABASE=your_database

# Cloudinary
CLOUD_NAME=your_cloud_name
API_KEY=your_api_key
API_SECRET=your_api_secret

# Cron Schedule (optional, defaults to daily at 1 AM)
BACKUP_CRON_SCHEDULE=0 1 * * *
```

### Cron Schedule Options

Configure the backup frequency in `index.ts`:

| Schedule | Cron Expression | Description |
|----------|-----------------|-------------|
| Daily | `0 1 * * *` | Every day at 1 AM |
| Weekly | `0 3 * * 1` | Mondays at 3 AM |
| Monthly | `0 6 1 * *` | 1st of month at 6 AM |
| Every 2 days | `0 23 */2 * *` | Every 2 days at 11 PM |

## Usage

```bash
npm start
```

The application will automatically perform scheduled backups. Backups are stored in Cloudinary with the following structure:

```
databaseBackups/
└── {year}/
    └── Month-{month}/
        └── backup-{timestamp}/
            ├── backup-{timestamp}.sql.gz.001
            ├── backup-{timestamp}.sql.gz.002
            ├── ...
            └── manifest.json
```

## Restoring a Backup

### Option 1: Using the restore script (Recommended)

1. Download the backup folder from Cloudinary
2. Copy `restore.sh` into the backup folder
3. Run the script:

```bash
cd backup-2026-02-04T21-42-12-677Z
chmod +x restore.sh
./restore.sh
```

The script will:
- Verify checksums for all parts
- Merge the parts into a single file
- Decompress the backup
- Show the command to import into MySQL

### Option 2: Manual restore

```bash
# Navigate to backup folder
cd backup-2026-02-04T21-42-12-677Z

# Merge parts (Linux/Mac/Git Bash)
cat backup-*.sql.gz.* > backup.sql.gz

# Or on Windows CMD:
copy /b *.001+*.002+*.003 backup.sql.gz

# Decompress
gunzip backup.sql.gz

# Import to MySQL
mysql -u your_user -p your_database < backup.sql
```

### Manifest.json Structure

Each backup includes a manifest file with metadata:

```json
{
  "originalFilename": "backup-2026-02-04T21-42-12-677Z.sql.gz",
  "totalParts": 2,
  "totalSize": 13443097,
  "createdAt": "2026-02-04T21:42:12.677Z",
  "parts": [
    {
      "filename": "backup-...sql.gz.001",
      "size": 9437184,
      "checksum": "19bb5b1db138983b23aec26ec6c63b37"
    },
    {
      "filename": "backup-...sql.gz.002",
      "size": 4005913,
      "checksum": "dd3fdb7b0176b17e5b302bc0ff0f5ec1"
    }
  ]
}
```

## Screenshots

### Cloudinary

![Database](./src/assets/cloudinaryPreview.png)

### SQL backup script

![Screenshot 2](./src/assets/sqlPreview.png)

## License

MIT
