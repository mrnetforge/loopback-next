// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const yamljs = require('yamljs');
const fs = require('fs');

module.exports.write = function(fileLocation, jsonContent) {
  var yaml = yamljs.stringify(jsonContent, 10, 2);
  fs.write(fileLocation, yaml);
};
