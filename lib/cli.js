#! /usr/bin/env node

import args from 'commander';
import getConfigs, { build, cloneDB, composeStart, composeStop, composeUp, generate } from './utils/index';
import fs from 'fs';
import ejs from 'ejs';
import yaml from 'js-yaml';
import path from 'path';
import { exec } from 'child_process';
let defaults = require(__dirname + '/config/Defaults').default;
delete defaults.__esModule;

args
    .version('0.1.0')
    .name('service_cli')
    .description('Micro-webservice CLI');

args.command('init')
    .description('initiate default configuration')
    .action(function () {
        let defs = defaults;

        if (fs.existsSync(path.resolve(process.cwd(), 'defaults.yml'))) {
            defs = yaml.safeLoad(path.resolve(process.cwd(), 'defaults.yml'));
            fs.unlinkSync(path.resolve(process.cwd(), 'defaults.yml'));
        }

        fs.writeFileSync(
            path.resolve(process.cwd(), 'defaults.js'),
            'module.exports = \n' + JSON.stringify(defaults, null, 4) + ';'
        );
        console.log('defaults.js created');

    });

args.command("clean")
    .description('remove all service images')
    .action(async function () {
        let configs = getConfigs();
        const cmd = 'docker rm ' + configs.filter((cf) => cf.kind === 'service').map((cf) => cf.name).join(' ');
        console.log('remove all service containers "' + cmd + '"');
        await exec(cmd);
    });

args.command("build")
    .description('generate docker files and docker compose')
    .option(
    '-g, --generateOnly',
    'generate Dockerfiles without building images'
    )
    .action(async function (command) {
        console.log('building...' + command.generateOnly);
        let configs = getConfigs();

        generate(configs, defaults);
        if (!command.generateOnly) {
            await (async () => {
                const cmd = 'docker rm ' + configs.filter((cf) => cf.kind === 'service').map((cf) => cf.name).join(' ');
                console.log('remove all service containes "' + cmd + '"');
                await exec(cmd);
            })();
            await composeUp();
        }
        console.log('build done');
    });

args.command('run <configFile>')
    .description('run the service with configuration')
    .action(function (configFile) {
        if (typeof configFile === 'undefined') configFile = './run.config.json';
        if (!configFile.endsWith('.json')) {

        }
        if (configFile === './') configFile = './run.config.json';

        if (fs.existsSync(configFile)) {
            try {
                const cf = JSON.parse(fs.readFileSync(configFile).toString());
                if (!('root' in cf))
                    cf.root = path.dirname(configFile);
                build(cf).then(() => {
                    exec("yarn start", { cwd: cf.root });
                });

            } catch (err) {
                console.error(err);
            }
        }
        else {
            console.log('Configuration file does not exist');
        }
    });

args.command('stop')
    .description('stop all docker services')
    .action(function () {
        composeStop().then(() => console.log('all stopped'));
    });

args.command('start')
    .description('start all docker services')
    .action(function () {
        composeStart().then(() => console.log('all started'));
    });

args.command('clone db media')
    .description('clone db with media')
    .action(function (db, media) {
        cloneDB(db, media);
    });

args.command('create <serviceName> [startDir]')
    .description('create a service folder. must be run from parent project root')
    .action(function (serviceName, startDir) {
        startDir = startDir || path.resolve(process.cwd(), 'services/');

        if (!fs.existsSync(startDir))
            fs.mkdirSync(startDir);

        if (fs.existsSync(path.resolve(startDir, serviceName))) {
            console.log('service already exists');
        }
        else {
            const servicePath = path.resolve(startDir, serviceName);
            const kind = serviceName === 'proxy' ? 'proxy' : 'service';
            let config = {
                kind,
                name: serviceName,
                src: ['./app/src/*.js'],
                npm: []
            };

            fs.mkdirSync(`${servicePath}`);
            fs.mkdirSync(`${servicePath}/app/`);
            fs.mkdirSync(`${servicePath}/app/src`);
            
            fs.writeFileSync(`${servicePath}/service.config.yml`,
                yaml.safeDump(config, { indent: 4 })
            );

            console.log('You can use git submodule to init git for ' + serviceName + '/');
        }

    });

args.parse(process.argv);

