#! /usr/bin/env node
"use strict";

var _commander = _interopRequireDefault(require("commander"));

var _index = _interopRequireWildcard(require("./utils/index"));

var _fs = _interopRequireDefault(require("fs"));

var _ejs = _interopRequireDefault(require("ejs"));

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import {buildService} from './utils/factory';
let defaults = require(__dirname + '/config/Defaults').default;

delete defaults.__esModule;

_commander.default.version('0.1.0').name('service_cli').description('Micro-webservice CLI');

_commander.default.command('init').description('initiate default configuration').action(function () {
  console.log('default ' + JSON.stringify(defaults));

  _fs.default.writeFileSync(_path.default.resolve(process.cwd(), 'defaults.yml'), _jsYaml.default.safeDump(defaults, {
    indent: 4
  }));

  console.log('defaults.yml created');
});

_commander.default.command("build").description('generate docker files and docker compose').action(async function () {
  console.log('building...');
  let configs = (0, _index.default)();
  (0, _index.generateFiles)(configs);
  await (0, _index.composeUp)();
  console.log('build done');
});

_commander.default.command('run <configFile>').description('run the service with configuration').action(function (configFile) {
  if (typeof configFile === 'undefined') configFile = './run.config.json';
  if (!configFile.endsWith('.json')) throw new Error('Invalid configuration file');
  if (configFile === './') configFile = './run.config.json';

  if (_fs.default.existsSync(configFile)) {
    try {
      const cf = JSON.parse(_fs.default.readFileSync(configFile).toString());
      cf.root = './build/';
      (0, _index.build)(cf).then(() => {
        const service = buildService(cf);
        if (service !== null) service.start();
      });
    } catch (err) {
      console.error(err);
    }
  } else {
    console.log('Configuration file not exists');
  }
});

_commander.default.command('stop').description('stop all docker services').action(function () {
  (0, _index.composeStop)().then(() => console.log('all stopped'));
});

_commander.default.command('start').description('start all docker services').action(function () {
  (0, _index.composeStart)().then(() => console.log('all started'));
});

_commander.default.command('clone db media').description('clone db with media').action(function (db, media) {
  (0, _index.cloneDB)(db, media);
});

_commander.default.command('create <serviceName> [startDir]').description('create a service folder. must be run from parent project root').action(function (serviceName, startDir) {
  startDir = startDir || _path.default.resolve(process.cwd(), 'services/');
  if (!_fs.default.existsSync(startDir)) _fs.default.mkdirSync(startDir);

  if (_fs.default.existsSync(_path.default.resolve(startDir, serviceName))) {
    console.log('service already exists');
  } else {
    const servicePath = _path.default.resolve(startDir, serviceName);

    const kind = serviceName === 'proxy' ? 'proxy' : 'service';
    let config = {
      kind,
      name: serviceName,
      src: ['./app/src/*.js'],
      npm: []
    };

    _fs.default.mkdirSync(`${servicePath}`);

    _fs.default.mkdirSync(`${servicePath}/app/`);

    _fs.default.mkdirSync(`${servicePath}/app/src`);

    let pkg = _ejs.default.render(_fs.default.readFileSync(__dirname + '/templates/_package.json.ejs').toString(), config);

    let cfg = _ejs.default.render(_fs.default.readFileSync(__dirname + '/templates/_app.config.ejs').toString(), config);

    _fs.default.writeFileSync(`${servicePath}/package.json`, pkg);

    _fs.default.writeFileSync(`${servicePath}/app.config.js`, cfg);

    _fs.default.writeFileSync(`${servicePath}/app.js`, _fs.default.readFileSync(__dirname + '/templates/app.js.ejs').toString());

    _fs.default.writeFileSync(`${servicePath}/app/src/handler.js`, _fs.default.readFileSync(__dirname + '/templates/_handler.ejs').toString());

    _fs.default.writeFileSync(`${servicePath}/.babelrc`, _fs.default.readFileSync(__dirname + '/templates/babelrc.ejs').toString());

    _fs.default.writeFileSync(`${servicePath}/service.config.yml`, _jsYaml.default.safeDump(config, {
      indent: 4
    }));

    console.log('You can use git submodule to init git for ' + serviceName + '/');
  }
});

_commander.default.parse(process.argv);