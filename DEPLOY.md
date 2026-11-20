# Ministry Companion reminders

Deploy this project to the existing Ministry Companion Netlify site so people can keep using their current address and the records saved in that browser.

## Deploy

Use a connected Git repository containing these files at its root, or use the Netlify CLI from the extracted folder. For the CLI, sign in with the site owner's account, then run:

    npm ci
    npx netlify-cli link
    npx netlify-cli deploy --build --prod

Select the existing Ministry Companion site when linking. Netlify needs to build the project and deploy both functions. A static drag-and-drop upload of the site folder alone cannot schedule notifications. Netlify Blobs stores the app's push keys on first use. Keep the reminder-config store across deploys.

## Check delivery after deployment

1. Open the app on the device that should receive reminders. On an iPhone running iOS 16.4 or later, add the site to the Home Screen first and open that copy.
2. Expand “Visit and study reminders”, choose “Enable notifications”, and allow the request.
3. Edit a Bible student and set the next study reminder a few minutes ahead, or edit a return visit and set its next planned date and reminder time. Save and check for the synced message.
4. Close the app and wait for the notification. Tap it to see the local reminder list. Repeat for the other record type. Check the send-reminders function logs if a test fails.
5. To cancel, clear the optional reminder field and save while online. The server uses the last synced schedule until it receives a change.

The scheduler checks every minute on the production deployment. Delivery depends on connectivity and device notification settings. Each study reminder covers one appointment. Marking a return visit as visited moves its planned date forward seven days and keeps its reminder time. Only the appointment type and time, plus the device subscription needed for delivery, go to the reminder service. People’s names, contact details and study notes stay in the app.
