import glob from 'glob';
import defaults from '../config/Defaults';
import composeRunner from 'docker-compose';
import dot from 'dot';

import {promisify} from 'util';
import {readFileSync, writeFileSync} from 'fs';
import {dirname, extname, resolve} from 'path';
import {fromJS} from 'immutable';
import {safeLoad} from 'js-yaml';

const start = promisify(composeRunner.up);
const stop = promisify(composeRunner.stop);
const exec = promisify(require('child_process').exec, {multiArgs: true});

const generateYml = dot.template(readFileSync(__dirname + '/../templates/_docker_compose.dot').toString());
const generateDockerfile = dot.template(readFileSync(__dirname + '/../templates/_dockerfile.dot').toString());

export function generateFiles(configs)
{
    let compose = {
        version: '3',
        services: []
    };

    configs.map((config) =>
    {

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
        writeFileSync(resolve(config.buildPath, 'run.config.json'), JSON.stringify(config));
        //generate Dockerfile
        writeFileSync(resolve(config.buildPath, 'Dockerfile'), generateDockerfile(config));

        compose.services.push(config);
    });

    let yml = generateYml(compose);
    writeFileSync(process.cwd() + '/docker-compose.yml', yml, {encoding: 'utf-8'});
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
            let obj = {kind: ''};

            const ext = extname(filePath).toLowerCase;
            const parent = dirname(filePath);
            try {
                if (ext === 'json') {
                    let content = readFileSync(filePath);
                    obj = JSON.parse(content);
                }
                else if (ext === 'yml') {
                    obj = safeLoad(readFileSync(filePath), 'utf-8');
                }

                if (obj) {
                    obj = fromJS(obj);
                }
            }
            catch (err) {
                console.error(err);
            }
            obj.copy = [];


            if('deps' in obj){
                obj.src = obj.deps;
            }

            if('src' in obj){
                if(Array.isArray(obj.src))
                    Array.prototype.push.apply(obj.copy, obj.src);
                else
                    obj.copy.push(obj.src);
            }

            if('views' in obj){
                if(Array.isArray(obj.views))
                    Array.prototype.push.apply(obj.copy, obj.views);
                else
                    obj.copy.push(obj.views);
            }

            obj.node_env = process.env.NODE_ENV || 'dev';
            obj.root = parent;
            return obj;
        })
        .map((config) => {
            switch (config.kind) {
                case "service":
                    config = Object.assign({}, defaults.docker.service, config);

                    break;
                case 'proxy':
                    config = Object.assign({}, defaults.docker.proxyService, config);
                    break;
                case 'db':
                    config = Object.assign({}, defaults.docker.db, config);
            }

            return config;
        });
}
