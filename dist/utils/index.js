'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.generateFiles = generateFiles;
exports.composeUp = composeUp;
exports.composeStop = composeStop;
exports.composeStart = composeStart;
exports.cloneDB = cloneDB;
exports.build = build;

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _Defaults = require('../config/Defaults');

var _Defaults2 = _interopRequireDefault(_Defaults);

var _dockerCompose = require('docker-compose');

var _dockerCompose2 = _interopRequireDefault(_dockerCompose);

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _util = require('util');

var _fs = require('fs');

var _path = require('path');

var _jsYaml = require('js-yaml');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const start = (0, _util.promisify)(_dockerCompose2.default.up);
const stop = (0, _util.promisify)(_dockerCompose2.default.stop);
const exec = (0, _util.promisify)(require('child_process').exec, { multiArgs: true });

function generateFiles(configs) {
    let compose = {
        version: '2.1',
        services: []
    };

    configs.map(config => {

        // if ('port' in config) {
        //     config.expose = config.port.toString();
        // }
        if (!('ports' in config)) {
            config.ports = [`${config.port}:${config.port}`];
        }
        if (!('buildPath' in config)) {
            config.buildPath = (0, _fs.realpathSync)(config.root).replace(/\\/g, '/');
        }

        if (typeof config.cmd === 'string') {
            //config.command = config.cmd;
            config.cmd = config.cmd.split(/\s+/).map(c => `"${c}"`).join(',');
        }

        if ('copy' in config) {
            let paths = config.copy.map(p => {
                return { resolvedPath: (0, _path.resolve)(config.root, (0, _path.dirname)(p)), original: (0, _path.dirname)(p) };
            }).concat({ resolvedPath: (0, _path.resolve)(config.root, './app.js'), original: './app.js' }, { resolvedPath: (0, _path.resolve)(config.root, './package.json'), original: './package.json' }, { resolvedPath: (0, _path.resolve)(config.root, './run.config.json'), original: './run.config.json' });

            config.volumes = paths.map(p => {
                return `${(0, _fs.realpathSync)(p.resolvedPath)}:${p.original.replace('./', '/usr/src/app/')}`;
            });

            config.copy = paths.map(p => {
                return (0, _fs.realpathSync)(p.resolvedPath).replace(/\\/g, '/');
            });
        }

        config.container_name = config.host || config.name || config.container_name;

        //generate run config
        config.generated = true;

        console.log(config);
        (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'run.config.json'), JSON.stringify(config, null, 4));
        //generate Dockerfile
        (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'Dockerfile'), _ejs2.default.render((0, _fs.readFileSync)(__dirname + '/../templates/_dockerfile.ejs').toString(), config));

        compose.services.push(config);
    });

    (0, _fs.writeFileSync)((0, _path.resolve)(process.cwd(), 'docker-compose.yml'), _ejs2.default.render((0, _fs.readFileSync)(__dirname + '/../templates/_docker_compose.ejs').toString(), compose));

    console.log('docker-compose.yml generated');
}

async function composeUp(yml) {
    try {
        await start({ cwd: process.cwd(), log: true });
        console.log('docker containers started');
    } catch (err) {
        console.error(err);
    }
}

async function composeStop(yml) {
    try {
        await stop({ cwd: process.cwd(), log: true });
        console.log('docker containers stopped');
    } catch (err) {
        console.error(err);
    }
}

async function composeStart(yml) {
    try {
        await exec('docker-compose start');
        console.log('docker containers stopped');
    } catch (err) {
        console.error(err);
    }
}

async function cloneDB(db, media) {
    media = media || true;
    try {
        console.log('db cloning');
        await exec(`docker-compose run --rm commander clone ${db} ${media}`);
    } catch (err) {
        console.error(err);
    }
}

async function build(config) {
    await exec('npm install');
    await exec('npm build');
}

exports.default = () => {
    const cfs = _glob2.default.sync('**/service.config.?(js|json|yml)', {
        nodir: true,
        ignore: ['node_modules/**', 'build/**', 'lib/**', 'src/**']
    });
    return cfs.map(filePath => {
        console.log('found at ' + filePath);
        let obj = { kind: '' };

        const ext = (0, _path.extname)(filePath).toLowerCase();
        console.log(ext);
        const parent = (0, _path.dirname)(filePath);
        try {
            if (ext === '.json') {
                let content = (0, _fs.readFileSync)(filePath);
                obj = JSON.parse(content);
            } else if (ext === '.yml') {
                obj = (0, _jsYaml.safeLoad)((0, _fs.readFileSync)(filePath), 'utf-8');
            }
        } catch (err) {
            console.error(err);
        }

        obj.node_env = process.env.NODE_ENV || 'dev';
        obj.root = parent;

        console.log(obj);
        console.log('...');
        return obj;
    }).map(config => {
        switch (config.kind) {
            case "service":
                config = _extends({}, _Defaults2.default.docker.service, _Defaults2.default.service, config);

                break;
            case 'proxy':
                config = _extends({}, _Defaults2.default.docker.proxyService, _Defaults2.default.proxyService, config);
                break;
        }

        config = _extends({}, { db: _extends(_Defaults2.default.db, { logging: _Defaults2.default.logging }) }, { session: _extends(_Defaults2.default.session, { logging: _Defaults2.default.logging }) }, { messageBus: _extends(_Defaults2.default.messageBus, { logging: _Defaults2.default.logging }) }, { logging: _Defaults2.default.logging }, config);

        config.copy = [];

        if ('deps' in config) {
            config.src = config.deps;
        }

        if ('src' in config) {
            if (Array.isArray(config.src)) Array.prototype.push.apply(config.copy, config.src);else config.copy.push(config.src);
        }

        if ('views' in config) {
            if (Array.isArray(config.views)) Array.prototype.push.apply(config.copy, config.views);else config.copy.push(config.views);
        }

        return config;
    });
};