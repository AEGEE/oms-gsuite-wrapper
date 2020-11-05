// Copyright 2014-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const log = require('./util/logger.js');

const {google} = require('googleapis');
const config = require('./config/configFile.js');

// Create JWT auth object
const jwt = new google.auth.JWT(
  config.GsuiteKeys.client_email,
  null,
  config.GsuiteKeys.private_key,
  [
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/admin.directory.group.member',
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  config.GsuiteKeys.delegatedUser,
);


async function runGsuiteOperation(operation, payload) {

  try {
    const authRes = await jwt.authorize();
    log.debug('auth: ' + JSON.stringify(authRes));
  } catch (AuthError){
    log.error('Authentication error! ' + AuthError.toString());
    throw { errors: [{message: 'Authentication errorrrr'}], code: 500 };
  }

  const res = await operation(jwt, payload);
  const operationResult = {success: true, code: res.status, data: res.data};
  if (operation.name.indexOf('add') > -1 && operationResult.code === 200) { operationResult.code = 201; };
  if (operationResult.code === 204) { operationResult.code = 200; };

  return operationResult;
};


const gsuiteOperations = {

  // Insert group in the system
  addGroup: async function addGroup(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.groups.insert({
      requestBody: {
        name: data.groupName,
        email: data.primaryEmail,
      },
      auth: jwt,
    });
    return result;
  },

  // Change group description
  editGroup: async function addGroup(jwt, data){
    throw GsuiteError;
  },

  // Change some user membership type
  changeUserGroupPrivilege: async function addGroup(jwt, data){
    throw GsuiteError;
  },

  // Delete the group
  deleteGroup: async function deleteGroup(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.groups.delete({
      groupKey: data.primaryEmail,
      auth: jwt,
    });
    return result;
  },

  // Insert user account in the system
  addAccount: async function addAccount(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.users.insert({
      requestBody: data,
      auth: jwt,
    });

    return result;
  },

  // Edit account e.g. change pic, change pw (until we have SSO)
  // Assumption: at least one of pic or anything else MUST be specified
  editAccount: async function editAccount(jwt, data){
    const admin = google.admin('directory_v1');

    const userKey = data.userKey;
    delete data.userKey;

    const photo = data.photoData || null;
    delete data.photoData;

    let result = { data: [], code_photo: null, code_update: null };

    if (Object.keys(data).length > 0){
      const result_update = await admin.users.update({
        userKey: userKey,
        requestBody: data,
        auth: jwt,
      });

      result.data.push(result_update.data);
      result.code_update = result_update.status;
    }

    if (photo){
      const result_photo = await admin.users.photos.update({
        userKey: userKey,
        resource: {
          photoData: photo,
        },
        auth: jwt,
      });

      result.data.push(result_photo.data);
      result.code_photo = result_photo.status;
    }

    if (result.code_update && result.code_photo){
      result.status = result.code_update !== result.code_photo ? '207' : result.code_update;
    } else {
      result.status = result.code_photo ? result.code_photo : result.code_update;
    }

    return result;
  },

  // List user accounts present in the system (only for the initial sync script)
  listAccounts: async function addAccount(jwt, data){
    const admin = google.admin('directory_v1');
    data.auth = jwt;
    const result = await admin.users.list(data);
    return result;
  },

  // Delete the account FIXME: make it suspended
  deleteAccount: async function deleteaccount(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.users.delete({
      userKey: data.primaryEmail,
      auth: jwt,
    });
    return result;
  },

  // Insert member in Google group
  addUserInGroup: async function addUserInGroup(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.members.insert({
      groupKey: data.primaryEmail,
      requestBody: {
        email: data.userName,
      },
      auth: jwt,
    });
    return result;
  },

  // Remove member from Google group
  removeUserFromGroup: async function removeUserFromGroup(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.members.delete({
      groupKey: data.primaryEmail,
      memberKey: data.userName,
      auth: jwt,
    });

    return result;
  },

  // Add gsuite alias (e.g. netcom-xxx@aegeee.eu)
  addEmailAlias: async function addEmailAlias(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.users.aliases.insert({
      userKey: data.primaryEmail,
      requestBody: {
        alias: data.aliasName,
      },
      auth: jwt,
    });

    return result;
  },

  // Remove gsuite alias (e.g. netcom-xxx@aegeee.eu)
  removeEmailAlias: async function removeEmailAlias(jwt, data){
    const admin = google.admin('directory_v1');
    const result = await admin.users.aliases.delete({
      userKey: data.primaryEmail,
      alias: data.aliasName,
      auth: jwt,
    });

    return result;
  },

  // Insert event in the system
  addEvent: async function addEvent(jwt, data){
    const calendar = google.calendar('v3');
    const result = await calendar.events.insert({
      auth: jwt,
      calendarId: 'member.aegee.org_pmfkss8cqipbjlg3qf3306bmjo@group.calendar.google.com',
      resource: data,
    });
    return result;
  },

  // Change title or start/end time
  editEvent: async function addEvent(jwt, data){
    throw GsuiteError;
  },

};

exports.runGsuiteOperation = runGsuiteOperation;
exports.gsuiteOperations = gsuiteOperations;
