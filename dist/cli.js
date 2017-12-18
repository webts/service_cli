#! /usr/bin/env node
'use strict';

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _index = require('./utils/index');

var _index2 = _interopRequireDefault(_index);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import {buildService} from './utils/factory';
_commander2.default.version('0.1.0').name('service_cli').description('Micro-webservice CLI');

_commander2.default.command('init').description('initiate default configuration').action(function () {
    const defaults = require('./config/Defaults').default;

    _fs2.default.writeFileSync(_path2.default.resolve(process.cwd(), 'defaults.yml'), _jsYaml2.default.safeDump(defaults, {
        indent: 4
    }));
    console.log('defaults.yml created');
});

_commander2.default.command("build").description('generate docker files and docker compose').action(async function () {
    console.log('building...');
    let configs = (0, _index2.default)();

    (0, _index.generateFiles)(configs);
    await (0, _index.composeUp)();
    console.log('build done');
});

_commander2.default.command('run <configFile>').description('run the service with configuration').action(function (configFile) {
    if (typeof configFile === 'undefined') configFile = './run.config.json';
    if (!configFile.endsWith('.json')) throw new Error('Invalid configuration file');
    if (configFile === './') configFile = './run.config.json';

    if (_fs2.default.existsSync(configFile)) {
        try {
            const cf = JSON.parse(_fs2.default.readFileSync(configFile).toString());
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

_commander2.default.command('stop').description('stop all docker services').action(function () {
    (0, _index.composeStop)().then(() => console.log('all stopped'));
});

_commander2.default.command('start').description('start all docker services').action(function () {
    (0, _index.composeStart)().then(() => console.log('all started'));
});

_commander2.default.command('clone db media').description('clone db with media').action(function (db, media) {
    (0, _index.cloneDB)(db, media);
});

_commander2.default.command('create <serviceName> [startDir]').description('create a service folder. must be run from parent project root').action(function (serviceName, startDir) {
    startDir = startDir || _path2.default.resolve(process.cwd(), 'services/');

    if (!_fs2.default.existsSync(startDir)) _fs2.default.mkdirSync(startDir);

    if (_fs2.default.existsSync(_path2.default.resolve(startDir, serviceName))) {
        console.log('service already exists');
    } else {
        const servicePath = _path2.default.resolve(startDir, serviceName);
        const kind = serviceName === 'proxy' ? 'proxy' : 'service';
        let config = {
            kind,
            name: serviceName,
            src: ['./app/src/*.js'],
            npm: []
        };

        _fs2.default.mkdirSync(`${servicePath}`);
        _fs2.default.mkdirSync(`${servicePath}/app/`);
        _fs2.default.mkdirSync(`${servicePath}/app/src`);

        let pkg = _ejs2.default.render(_fs2.default.readFileSync(__dirname + '/templates/_package.json.ejs').toString(), config);
        let cfg = _ejs2.default.render(_fs2.default.readFileSync(__dirname + '/templates/_app.config.ejs').toString(), config);
        _fs2.default.writeFileSync(`${servicePath}/package.json`, pkg);
        _fs2.default.writeFileSync(`${servicePath}/app.config.js`, cfg);
        _fs2.default.writeFileSync(`${servicePath}/app.js`, _fs2.default.readFileSync(__dirname + '/templates/app.js.ejs').toString());
        _fs2.default.writeFileSync(`${servicePath}/app/src/handler.js`, _fs2.default.readFileSync(__dirname + '/templates/_handler.ejs').toString());
        _fs2.default.writeFileSync(`${servicePath}/.babelrc`, _fs2.default.readFileSync(__dirname + '/templates/babelrc.ejs').toString());

        _fs2.default.writeFileSync(`${servicePath}/service.config.yml`, _jsYaml2.default.safeDump(config, { indent: 4 }));

        console.log('You can use git submodule to init git for ' + serviceName + '/');
    }
});

_commander2.default.parse(process.argv);