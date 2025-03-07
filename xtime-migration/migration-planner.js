/**
 * 1. Download zip file
 * 2. unzip file
 * 3. read file name
 * 4. find specific dealer
 * 5. upload file against dealer which matches the file name
 */

import fs from 'fs';
import unzipper from 'unzipper';
import FormData from 'form-data';
import axios from 'axios';
import downloadAsZip from './download-zip.js';
import { fileURLToPath } from 'url';
import path from 'path';
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let gloablStores = null

//Staging
// const token = '<TODO: token from graphQL request>';
// const url = 'https://stage.hasura.drivably.com/v1/graphql';
// const fileUploadURL = 'https://api-test-rnfxls4laa-wl.a.run.app/Servicelane/file-upload';

// //PROD:
// const token ='<TODO: token from graphQL request>';
// const url = 'https://hasura.drivably.com/v1/graphql';
// const fileUploadURL = 'https://api-mpzsor2amq-wl.a.run.app/Servicelane/file-upload';

const now = new Date();
const formattedDate = now.toISOString().split('T')[0];
const unzipFilePath = `${__dirname}/exports/cc_imports_${formattedDate}.zip`;
const unzipFolderPath = `out_${formattedDate}`

async function fetchStores() {
  let res = await fetch(url, {
    "headers": {
      "authorization": `${token}`,
      "content-type": "application/json",
    },
    //"body": "{\"operationName\":\"UserFindById\",\"variables\":{\"id\":6000},\"query\":\"query UserFindById($id: Int!) {\\n  users(where: {id: {_eq: $id}}) {\\n    id\\n    name\\n    email\\n    managed_stores: portal_roles(where: {store: {managed: {_eq: true}}}) {\\n      store {\\n        id\\n        name\\n        managed\\n        enable_consumer_guaranteed_price\\n        enable_dealer_guaranteed_price\\n        data_bulk_upload\\n        vehicles(\\n          where: {moved_to_appointment_at: {_is_null: false}, _not: {appraisals: {appraiser_id: {_is_null: false}}}}\\n          limit: 1\\n        ) {\\n          moved_to_appointment_at\\n          appraisals {\\n            appraiser_id\\n            __typename\\n          }\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    portal_roles {\\n      store {\\n        id\\n        name\\n        data_bulk_upload\\n        enable_consumer_guaranteed_price\\n        enable_dealer_guaranteed_price\\n        vehicles_aggregate(where: {appraisals: {appraiser_id: {_is_null: false}}}) {\\n          aggregate {\\n            count\\n            __typename\\n          }\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\"}",
    "body": "{\"operationName\":\"UserFindById\",\"variables\":{\"id\":\"7092\"},\"query\":\"query UserFindById($id: Int!) {\\n  users(where: {id: {_eq: $id}}) {\\n    id\\n    name\\n    email\\n    managed_stores: portal_roles(where: {store: {managed: {_eq: true}}}) {\\n      store {\\n        id\\n        name\\n        managed\\n        enable_consumer_guaranteed_price\\n        enable_dealer_guaranteed_price\\n        data_bulk_upload\\n        vehicles(\\n          where: {moved_to_appointment_at: {_is_null: false}, _not: {appraisals: {appraiser_id: {_is_null: false}}}}\\n          limit: 1\\n        ) {\\n          moved_to_appointment_at\\n          appraisals {\\n            appraiser_id\\n            __typename\\n          }\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    portal_roles {\\n      store {\\n        id\\n        name\\n        data_bulk_upload\\n        enable_consumer_guaranteed_price\\n        enable_dealer_guaranteed_price\\n        vehicles_aggregate(where: {appraisals: {appraiser_id: {_is_null: false}}}) {\\n          aggregate {\\n            count\\n            __typename\\n          }\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\"}",
    "method": "POST"
  });

  res = await res.json();

  return res
}

async function uploadFileService(formData) {
  try {
    logger.info('Uploading file:', formData.getHeaders()['content-disposition']);
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: fileUploadURL,
      headers: {
        ...formData.getHeaders()
      },
      data: formData
    };

    const res = await axios.request(config);

    return res.data;
  } catch (err) {
    logger.error('Error while uploading file:', err);
  }
}

async function unzip() {
  return new Promise((resolve, reject) => {
    fs.createReadStream(unzipFilePath)
      .pipe(unzipper.Extract({ path: unzipFolderPath }))
      .on('close', () => {
        logger.info('Unzip completed');
        resolve();
      })
      .on('error', reject);
  });
}

async function uploadFiles() {
  try {
    const files = await fs.promises.readdir(unzipFolderPath);

    for (const fileName of files) {
      logger.info('Uploading file:', fileName);
      const file = fileName.replace('cc_import_', '').replace(`_${formattedDate}.xlsx`, '').replaceAll('_', ' ').toLowerCase();
      const storeId = gloablStores.find(store => store.store.name.toLowerCase() === file)?.store?.id;
      console.log('File Details :', fileName, storeId);
      if (storeId) {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(`${unzipFolderPath}/${fileName}`));
        formData.append('lead_type', 'eLead');
        formData.append('store_id', storeId);
        await uploadFileService(formData);
        console.log('File uploaded :', fileName);
      } else {
        console.log('Store not found:', fileName);
      }
    }
  } catch (err) {
    logger.error('Error reading folder:', err);
  }
}

async function main() {
  try {
    logger.info('Migration Planner started');
    await downloadAsZip();
    logger.info('Download zip completed');

    logger.info('Fetching stores');
    const data = await fetchStores();
    gloablStores = data.data.users[0].portal_roles
    console.log('Stores Values:',  data.data.users[0].portal_roles);
    logger.info('Fetching stores finished');
    await unzip();
    await uploadFiles();
    logger.info('Migration Planner completed');
  } catch (err) {
    logger.error('Error while running the process', err);
    console.error('Error:', err);
  }
}

main();
