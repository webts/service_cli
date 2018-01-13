import path from 'path';
var exec = require('child_process').exec;
var fs  =require('fs');
var rimraf = require('rimraf');


test("test service_cli init", () => {

  if (fs.existsSync(path.resolve(process.cwd(), 'defaults.js'))){
    fs.unlinkSync(path.resolve(process.cwd(), 'defaults.js'));
  }

  exec("node dist/cli.js init", (error, stdout, stderr) => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'defaults.js'))).toBe(true);
  });
});

test("test service_cli build", () => {

});

test("test service_cli stop", () => {
  exec("node dist/cli.js stop", (error, stdout, stderr) => {
  });
});

test("test service_cli start", () => {
  exec("node dist/cli.js start", (error, stdout, stderr) => {
  });
});
test("test service_cli create", () => {

  if (fs.existsSync(path.resolve(process.cwd(), 'services/test_service'))){
    rimraf(path.resolve(process.cwd(), 'services/test_service'), function () { });
  }

  exec("node dist/cli.js create test_service", (error, stdout, stderr) => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'services/test_service/app/app.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'services/test_service/app/package.json'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'services/test_service/app/service.config.yml'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'services/test_service/app/app.config.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'services/test_service/app/.babelrc'))).toBe(true);
  });
});