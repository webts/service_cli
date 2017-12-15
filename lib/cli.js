#! /usr/bin/env node

import args from 'commander';
import getConfigs, {build, cloneDB, composeStart, composeStop, composeUp, generateFiles} from './utils/index';
//import {buildService} from './utils/factory';
import fs from 'fs';
import dot from 'dot';
import yaml from 'js-yaml';
import path from 'path';

args
    .version('0.1.0')
    .name('service_cli')
    .description('Micro-webservice CLI');

args.command("build", 'generate docker files and docker compose')
    .action(function () {
        let configs = getConfigs();

        generateFiles(configs);
        composeUp().then(() => console.log('build done'));
    });

args.command('run <configFile>', 'run the service with configuration')
    .action(function (configFile) {
        if (typeof configFile === 'undefined') configFile = './run.config.json';
        if (!configFile.endsWith('.json')) throw new Error('Invalid configuration file');
        if (configFile === './') configFile = './run.config.json';

        if (fs.existsSync(configFile)) {
            try {
                const cf = JSON.parse(fs.readFileSync(configFile).toString());
                cf.root = './build/';
                build(cf).then(() => {
                    const service = buildService(cf);
                    if (service !== null)
                        service.start();
                });

            } catch (err) {
                console.error(err);
            }
        }
        else {
            console.log('Configuration file not exists');
        }
    });

args.command('stop', 'stop all docker services')
    .action(function () {
        composeStop().then(() => console.log('all stopped'));
    });

args.command('start', 'start all docker services')
    .action(function () {
        composeStart().then(() => console.log('all started'));
    });

args.command('clone db media', 'clone db with media')
    .action(function (db, media) {
        cloneDB(db, media);
    });

args.command('create <serviceName> [startDir]', 'create a service folder. must be run from parent project root')
    .action(function (serviceName, startDir)
    {
        startDir = startDir || process.cwd();

        if (fs.existsSync(path.resolve(startDir,serviceName))) {
            console.log('service already exists');
        }
        else {
            const servicePath = path.resolve(startDir,serviceName)
            fs.mkdirSync(`${servicePath}`);
            fs.mkdirSync(`${servicePath}/app/`);
            fs.mkdirSync(`${servicePath}/app/src`);

            let pkg = dot.template(fs.readFileSync(__dirname + '/templates/_package.json.dot').toString())(
                {
                    name: serviceName,
                    npm: []
                }
            );
            fs.writeFileSync(`${servicePath}/package.json`, pkg);
            fs.writeFileSync(`${servicePath}/app.js`, fs.readFileSync(__dirname + '/templates/app.js').toString());
            fs.writeFileSync(`${servicePath}/.babelrc`, fs.readFileSync(__dirname + '/templates/.babelrc').toString());
            fs.writeFileSync(`${servicePath}/service.config.yml`,
                yaml.safeDump({
                    kind: "service",
                    name: serviceName,
                    src: ['./handlers/'],

                },{
                    indent:4
                })
            );
        }

    });

args.parse(process.argv);

