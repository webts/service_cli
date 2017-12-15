#! /usr/bin/env node
'use strict';

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _index = require('./utils/index');

var _index2 = _interopRequireDefault(_index);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import {buildService} from './utils/factory';
_commander2.default.version('0.1.0').name('service_cli').description('Micro-webservice CLI');

_commander2.default.command("build", 'generate docker files and docker compose').action(function () {
    let configs = (0, _index2.default)();

    (0, _index.generateFiles)(configs);
    (0, _index.composeUp)().then(() => console.log('build done'));
});

_commander2.default.command('run <configFile>', 'run the service with configuration').action(function (configFile) {
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

_commander2.default.command('stop', 'stop all docker services').action(function () {
    (0, _index.composeStop)().then(() => console.log('all stopped'));
});

_commander2.default.command('start', 'start all docker services').action(function () {
    (0, _index.composeStart)().then(() => console.log('all started'));
});

_commander2.default.command('clone db media', 'clone db with media').action(function (db, media) {
    (0, _index.cloneDB)(db, media);
});

_commander2.default.command('create <serviceName> [startDir]', 'create a service folder. must be run from parent project root').action(function (serviceName, startDir) {
    startDir = startDir || process.cwd();

    if (_fs2.default.existsSync(_path2.default.resolve(startDir, serviceName))) {
        console.log('service already exists');
    } else {
        const servicePath = _path2.default.resolve(startDir, serviceName);
        _fs2.default.mkdirSync(`${servicePath}`);
        _fs2.default.mkdirSync(`${servicePath}/app/`);
        _fs2.default.mkdirSync(`${servicePath}/app/src`);

        let pkg = _dot2.default.template(_fs2.default.readFileSync(__dirname + '/templates/_package.json.dot').toString())({
            name: serviceName,
            npm: []
        });
        _fs2.default.writeFileSync(`${servicePath}/package.json`, pkg);
        _fs2.default.writeFileSync(`${servicePath}/app.js`, _fs2.default.readFileSync(__dirname + '/templates/app.js').toString());
        _fs2.default.writeFileSync(`${servicePath}/.babelrc`, _fs2.default.readFileSync(__dirname + '/templates/.babelrc').toString());
        _fs2.default.writeFileSync(`${servicePath}/service.config.yml`, _jsYaml2.default.safeDump({
            kind: "service",
            name: serviceName,
            src: ['./handlers/']

        }, {
            indent: 4
        }));
    }
});

_commander2.default.parse(process.argv);