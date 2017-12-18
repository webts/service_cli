import glob from 'glob';
import defaults from '../config/Defaults';
import composeRunner from 'docker-compose';
import ejs from 'ejs';

import {promisify} from 'util';
import {readFileSync, realpathSync, writeFileSync} from 'fs';
import {dirname, extname, resolve} from 'path';
import {safeLoad} from 'js-yaml';

const start = promisify(composeRunner.up);
const stop = promisify(composeRunner.stop);
const exec = promisify(require('child_process').exec, {multiArgs: true});


export function generateFiles(configs) {
    let compose = {
        version: '2.1',
        services: []
    };

    configs.map((config) => {

        // if ('port' in config) {
        //     config.expose = config.port.toString();
        // }
        if (!('ports' in config)) {
            config.ports = [`${config.port}:${config.port}`];
        }
        if (!('buildPath' in config)) {
            config.buildPath = realpathSync(config.root).replace(/\\/g,'/');
        }

        if (typeof config.cmd === 'string') {
            //config.command = config.cmd;
            config.cmd = config.cmd.split(/\s+/).map((c) => `"${c}"`).join(',');
        }

        if ('copy' in config) {
            let paths = config.copy
                .map((p) => {return {resolvedPath: resolve(config.root, dirname(p)), original: dirname(p)} })
                .concat(
                    {resolvedPath: resolve(config.root, './app.js'), original: './app.js'},
                    {resolvedPath: resolve(config.root, './package.json'), original: './package.json'},
                    {resolvedPath: resolve(config.root, './run.config.json'), original:  './run.config.json'}
                );

            config.volumes = paths.map((p) => {
                return `${realpathSync(p.resolvedPath)}:${p.original.replace('./', '/usr/src/app/')}`;
            });

            config.copy = paths.map((p) => {
                return realpathSync(p.resolvedPath).replace(/\\/g, '/');
            });
        }

        config.container_name = config.host || config.name || config.container_name;

        //generate run config
        config.generated = true;

        console.log(config);
        writeFileSync(resolve(config.buildPath, 'run.config.json'), JSON.stringify(config, null, 4));
        //generate Dockerfile
        writeFileSync(
            resolve(config.buildPath, 'Dockerfile'),
            ejs.render(readFileSync(__dirname + '/../templates/_dockerfile.ejs').toString(), config)
        );

        compose.services.push(config);
    });

    writeFileSync(
        resolve(process.cwd(), 'docker-compose.yml'),
        ejs.render(readFileSync(__dirname + '/../templates/_docker_compose.ejs').toString(), compose)
    );

    console.log('docker-compose.yml generated');
}

export async function composeUp(yml) {
    try {
        await start({cwd: process.cwd(), log: true});
        console.log('docker containers started');
    }
    catch (err) {
        console.error(err);
    }
}

export async function composeStop(yml) {
    try {
        await stop({cwd: process.cwd(), log: true});
        console.log('docker containers stopped');
    }
    catch (err) {
        console.error(err)
    }
}

export async function composeStart(yml) {
    try {
        await exec('docker-compose start');
        console.log('docker containers stopped');
    }
    catch (err) {
        console.error(err)
    }
}

export async function cloneDB(db, media) {
    media = media || true;
    try {
        console.log('db cloning');
        await exec(`docker-compose run --rm commander clone ${db} ${media}`);
    }
    catch (err) {
        console.error(err)
    }
}

export async function build(config) {
    await exec('npm install');
    await exec('npm build');
}

export default () => {
    const cfs = glob.sync('**/service.config.?(js|json|yml)', {
        nodir: true,
        ignore: ['node_modules/**', 'build/**', 'lib/**', 'src/**']
    });
    return cfs
        .map((filePath) => {
            console.log('found at ' + filePath);
            let obj = {kind: ''};

            const ext = extname(filePath).toLowerCase();
            console.log(ext);
            const parent = dirname(filePath);
            try {
                if (ext === '.json') {
                    let content = readFileSync(filePath);
                    obj = JSON.parse(content);
                }
                else if (ext === '.yml') {
                    obj = safeLoad(readFileSync(filePath), 'utf-8');
                }

            }
            catch (err) {
                console.error(err);
            }


            obj.node_env = process.env.NODE_ENV || 'dev';
            obj.root = parent;

            console.log(obj);
            console.log('...');
            return obj;
        })
        .map((config) => {
            switch (config.kind) {
                case "service":
                    config = Object.assign({}, defaults.docker.service, defaults.service, config);

                    break;
                case 'proxy':
                    config = Object.assign({}, defaults.docker.proxyService, defaults.proxyService, config);
                    break;
            }

            config = Object.assign({},
                {db: Object.assign(defaults.db, {logging: defaults.logging})},
                {session: Object.assign(defaults.session, {logging: defaults.logging})},
                {messageBus: Object.assign(defaults.messageBus, {logging: defaults.logging})},
                {logging: defaults.logging},
                config);

            config.copy = [];


            if ('deps' in config) {
                config.src = config.deps;
            }

            if ('src' in config) {
                if (Array.isArray(config.src))
                    Array.prototype.push.apply(config.copy, config.src);
                else
                    config.copy.push(config.src);
            }

            if ('views' in config) {
                if (Array.isArray(config.views))
                    Array.prototype.push.apply(config.copy, config.views);
                else
                    config.copy.push(config.views);
            }

            return config;
        });
}
