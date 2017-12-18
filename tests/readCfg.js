const yaml = require('js-yaml');
const fs   = require('fs');
const assert = require('assert');

const json =(require('./_service.config.json'));
const yml  =(yaml.safeLoad(fs.readFileSync(__dirname + '/_service.config.yml').toString()));

console.log(yml);

assert.equal(JSON.stringify(json), JSON.stringify(yml), "yaml parser failed");
