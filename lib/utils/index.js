import glob from 'glob';
import composeRunner from 'docker-compose';
import ejs from 'ejs';

import {promisify} from 'util';
import {readFileSync, realpathSync, writeFileSync} from 'fs';
import {dirname, extname, resolve} from 'path';
import {safeLoad, safeDump} from 'js-yaml';

const start = promisify(composeRunner.up);
const stop = promisify(composeRunner.stop);
const exec = promisify(require('child_process').exec, {multiArgs: true});
let defaults = require(__dirname + '/../config/Defaults').default;


export function generateFiles(configs) {
    let compose = {
        version: '2.1',
        services: []
    };

    configs.map((config) => {

        // if ('port' in config) {
        //     config.expose = config.port.toString();
        // }
        if (!('ports' in config) && 'port' in config) {
            config.ports = [`${config.port}:${config.port}`];
        }

        if (typeof config.cmd === 'string') {
            //config.command = config.cmd;
            config.cmd = config.cmd.split(/\s+/).map((c) => `"${c}"`).join(',');
        }

        if ('copy' in config) {
            let paths = config.copy
                .map((p) => {
                    return {resolvedPath: resolve(config.root, dirname(p)), original: dirname(p)}
                })
                .concat(
                    {resolvedPath: resolve(config.root, './app.js'), original: './app.js'},
                    {resolvedPath: resolve(config.root, './package.json'), original: './package.json'},
                    {resolvedPath: resolve(config.root, './run.config.json'), original: './run.config.json'}
                );

            config.volumes = paths.map((p) => {
                return `${realpathSync(p.resolvedPath)}:${p.original.replace('./', '/usr/src/app/')}`;
            });

            config.copy = paths.map((p) => {
                return realpathSync(p.resolvedPath).replace(/\\/g, '/');
            });
        }

        let labels = [
            `${defaults.proxyService.name}.backend=${config.name}`,
            `${defaults.proxyService.name}.frontend.rule=${config.name}`
        ]

        if(!('labels' in config)){
            config.labels = labels;
        }

        config.volumes = config.volumes || [];
        config.copy    = config.copy || [];

        config.container_name = config.host || config.name || config.container_name;

        //generate run config
        config.generated = true;
        compose.services.push(config);

        if(config.kind === 'service') {

            if (!('buildPath' in config)) {
                config.buildPath = realpathSync(config.root).replace(/\\/g, '/');
            }
            //generate run config
            writeFileSync(
                resolve(config.buildPath, 'run.config.json'),
                JSON.stringify(config, null, 4)
            );
            //generate Dockerfile
            writeFileSync(
                resolve(config.buildPath, 'Dockerfile'),
                ejs.render(readFileSync(__dirname + '/../templates/_dockerfile.ejs').toString(), config)
            );
        }

    });

    writeFileSync(
        resolve(process.cwd(), 'docker-compose.yml'),
        ejs.render(readFileSync(__dirname + '/../templates/_docker_compose.ejs').toString(), compose)
    );

    writeFileSync(
        resolve(process.cwd(), 'docker-compose.yml'),
        readFileSync(resolve(process.cwd(), 'docker-compose.yml')).toString().replace(/^\s*[\r\n]/gm,'')
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
        ignore: ['**/node_modules/**', 'build/**', 'lib/**', 'src/**','dist/**']
    });
    return cfs
        .map((filePath) => {
            console.log('found at ' + filePath);
            let obj = {kind: ''};

            const ext = extname(filePath).toLowerCase();
            const parent = dirname(filePath);
            try {
                if (ext === '.json') {
                    let content = readFileSync(realpathSync(filePath));
                    obj = JSON.parse(content);
                }
                else if (ext === '.yml') {
                    obj = safeLoad(readFileSync(filePath), 'utf-8');
                }
                else if (ext === '.js') {
                    obj = require(realpathSync('./' + filePath));
                }
            }
            catch (err) {
                console.error(err);
            }


            obj.node_env = process.env.NODE_ENV || 'dev';
            obj.root = parent;

            return obj;
        })
        .map((config) => {
            switch (config.kind) {
                case "service": {
                    config = Object.assign({}, defaults.docker.service, defaults.service, config);
                    config = Object.assign(
                        {
                            db: Object.assign(defaults.db, {logging: defaults.logging}),
                            session: Object.assign(defaults.session, {logging: defaults.logging}),
                            messageBus: Object.assign(defaults.messageBus, {logging: defaults.logging}),
                            logging: defaults.logging
                        },
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

                    if('networks' in defaults && 'internal' in defaults.networks){
                        config = Object.assign({networks: 'internal'}, config);
                    }
                    break;
                }
                case 'proxy':
                    config = Object.assign({}, defaults.docker.proxyService, defaults.proxyService, config);
                    if('networks' in defaults && 'proxy' in defaults.networks){
                        config = Object.assign({networks: 'proxy'}, config);
                    }
                    break;
            }

            return config;
        });
}
