# Ministry Companion hosting

Deploy the hosting/railway branch as one always-on Railway web service with Node 24. Attach a persistent volume at /data before the first production launch. The app uses RAILWAY_VOLUME_MOUNT_PATH for SQLite, which keeps the push signing keys and reminder schedules across deployments. Generate a public HTTPS domain and redeploy so RAILWAY_PUBLIC_DOMAIN is available. For a custom domain, set PUBLIC_ORIGIN to its exact HTTPS origin. Keep one replica and turn off serverless sleeping so the reminder scheduler continues running.

For local use, set DATA_DIR to a writable directory and run npm ci and npm start. PORT defaults to 3000. Verify /health, /api/reminders, and /api/research?q=resurrection. Test a reminder with the app closed on a subscribed device.

## Move an existing device

Open the old app in the same browser or Home Screen installation containing the records. Export a JSON backup in Local Phone Data & Backup. Open the new address and import that backup using the same menu. On iPhone, import inside the Home Screen app you intend to use. Verify your students, return visits and reminder times, then enable notifications on the new address. After confirming delivery on the new host, turn off notifications on the old app to avoid duplicate alerts.
