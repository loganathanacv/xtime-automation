# Automate xTime leads uploads into Clear Car systems

## Overview:
1. This scripts download the cc_imports_<date>.zip from the SFTP MAX systems and will be saved in the exports folder.
2. Unzip the files and read the xlsx files and capture the store/ dealer name
3. Start uploading each files into Clear Car portal by comparing the file name and the store name
4. Capture the uploaded and failurs stores in the app.log file & console.


# set up & running:
1. Install Node 18 or above and run "npm install"
2. Configure the "token" variable with your access token from the graphQL request both staging & PROD.
3. comment the section you don't want to run "staging" or "PROD"
4. "npm run start" 

# Issues or Queries:   lpandurengan@acvauctions.com / mmurugesan@acvauctions.com
 # xtime-automation
This automation scripts helps to download the leads files from SFTP and upload into Clear Car systems
