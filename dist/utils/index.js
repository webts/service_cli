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

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

var _util = require('util');

var _fs = require('fs');

var _path = require('path');

var _immutable = require('immutable');

var _jsYaml = require('js-yaml');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const start = (0, _util.promisify)(_dockerCompose2.default.up);
const stop = (0, _util.promisify)(_dockerCompose2.default.stop);
const exec = (0, _util.promisify)(require('child_process').exec, { multiArgs: true });

const generateYml = _dot2.default.template((0, _fs.readFileSync)(__dirname + '/../templates/_docker_compose.dot').toString());
const generateDockerfile = _dot2.default.template((0, _fs.readFileSync)(__dirname + '/../templates/_dockerfile.dot').toString());

function generateFiles(configs) {
    let compose = {
        version: '3',
        services: []
    };

    configs.map(config => {

        if ('port' in config) {
            config.expose = config.port.toString();
        }
        if (!('ports' in config)) {
            config.ports = [`${config.expose}:${config.expose}`];
        }
        if (!('buildPath' in config)) {
            config.buildPath = config.root;
        }

        if (typeof config.cmd === 'string') {
            config.command = config.cmd;
            config.cmd = config.cmd.split(/\s+/);
        }

        config.container_name = config.host || config.name || config.container_name;

        //generate run config
        config.generated = true;
        (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'run.config.json'), JSON.stringify(config));
        //generate Dockerfile
        (0, _fs.writeFileSync)((0, _path.resolve)(config.buildPath, 'Dockerfile'), generateDockerfile(config));

        compose.services.push(config);
    });

    let yml = generateYml(compose);
    (0, _fs.writeFileSync)(process.cwd() + '/docker-compose.yml', yml, { encoding: 'utf-8' });
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
        let obj = { kind: '' };

        const ext = (0, _path.extname)(filePath).toLowerCase;
        const parent = (0, _path.dirname)(filePath);
        try {
            if (ext === 'json') {
                let content = (0, _fs.readFileSync)(filePath);
                obj = JSON.parse(content);
            } else if (ext === 'yml') {
                obj = (0, _jsYaml.safeLoad)((0, _fs.readFileSync)(filePath), 'utf-8');
            }

            if (obj) {
                obj = (0, _immutable.fromJS)(obj);
            }
        } catch (err) {
            console.error(err);
        }
        obj.copy = [];

        if ('deps' in obj) {
            obj.src = obj.deps;
        }

        if ('src' in obj) {
            if (Array.isArray(obj.src)) Array.prototype.push.apply(obj.copy, obj.src);else obj.copy.push(obj.src);
        }

        if ('views' in obj) {
            if (Array.isArray(obj.views)) Array.prototype.push.apply(obj.copy, obj.views);else obj.copy.push(obj.views);
        }

        obj.node_env = process.env.NODE_ENV || 'dev';
        obj.root = parent;
        return obj;
    }).map(config => {
        switch (config.kind) {
            case "service":
                config = _extends({}, _Defaults2.default.docker.service, config);

                break;
            case 'proxy':
                config = _extends({}, _Defaults2.default.docker.proxyService, config);
                break;
            case 'db':
                config = _extends({}, _Defaults2.default.docker.db, config);
        }

        return config;
    });
};