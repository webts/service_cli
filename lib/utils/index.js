import glob from 'glob';
import composeRunner from 'docker-compose';
import ejs from 'ejs';
import cpy from 'cpy';
import rimraf from 'rimraf';
import {promisify} from 'util';
import fs,{readFileSync, realpathSync, writeFileSync} from 'fs';
import path, {dirname, extname, resolve} from 'path';
import {safeLoad, safeDump} from 'js-yaml';

const start = promisify(composeRunner.up);
const stop = promisify(composeRunner.stop);
const exec = promisify(require('child_process').exec, {multiArgs: true});
let defaults = require(__dirname + '/../config/Defaults').default;


import generate from './generator';

module.exports.generate = generate;

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
    console.log(`building ${config.name}` )
    await exec('yarn install',{cwd: config.root});
    await exec('yarn build',{cwd: config.root});
}

export default () => {
    const cfs = glob.sync('**/service.config.?(js|json|yml)', {
        nodir: true,
        ignore: ['**/node_modules/**', 'build/**', 'lib/**', 'src/**','dist/**']
    });
    return cfs
        .map((filePath) => {
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

            console.log('found config ' + obj.name)

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

                    if(!'src' in config){                           
                        if ('deps' in config) {
                            config.src = config.deps;
                        }
                    }else if('deps' in config){
                        let deps = [config.deps];
                        if (Array.isArray(config.deps))
                            deps = config.deps;
                        if(!fs.existsSync(path.join(config.root,'app','lib')))
                            fs.mkdirSync(path.join(config.root,'app','lib'));
                        if(!fs.existsSync(path.join(config.root,'app','lib','deps')))
                            fs.mkdirSync(path.join(config.root,'app','lib','deps'));
                        else
                            rimraf.sync(path.join(config.root,'app','lib','deps') + "/**");
                                                                
                        deps.forEach((dep) => {
                            console.log('cpy ' +dep)
                            cpy(dep, path.join(config.root,'app','lib','deps'),{cwd:process.cwd(),parents:false,nodir:true});    
                        })  
                        config.copy.push('./app/lib/deps');
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

                    if(typeof config.copy !== 'undefined'){
                        config.copy.forEach((p) => {
                            if(p.startsWith('./')) p = p.replace('./', config.root + '/');
                        })
                    }

                    if('networks' in defaults && 'internal' in defaults.networks){
                        config = Object.assign({networks: 'internal'}, config);
                    }

                    if(!('working_dir' in config)){
                        config.working_dir = '/usr/src/app';
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
