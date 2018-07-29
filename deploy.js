//Talik Kasozi
//Automation deployment 

let cmd = require('node-cmd');
let path, node_ssh, ssh, fs, config = require('./config/config'), project,
host_ = config.host,
hs_key = config.hs_key;
fs = require('fs');
path = require('path');
project = path.basename(config.project)

node_ssh = require('node-ssh');
ssh = new node_ssh();

const dotenv = require('dotenv');

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: '.env' });

// the method that starts the deployment process
function main() {
  console.log('Deployment started.');
  //console.log(process.env.AWS_PROJECTXY_KEY);
  //cmd.run(`mkdir ${project} && cp -r ${config.project}/* ${project}/`);
  sshConnect();
}

// installs PM2
function installPM2() {
  return ssh.execCommand(
    'sudo npm install pm2 -g', {
      cwd: '/home/ubuntu'
  });
}

// transfers local project to the remote server
function transferProjectToRemote(failed, successful) {
  return ssh.putDirectory(
    `../${project}`,
    `/home/ubuntu/${project}-temp`,
    {
      recursive: true,
      concurrency: 1,
      validate: function(itemPath) {
        const baseName = path.basename(itemPath);
        return (
          baseName.substr(0, 1) !== '.' && baseName !== 'node_modules' // do not allow dot files
        ); // do not allow node_modules
      },
      tick: function(localPath, remotePath, error) {
        if (error) {
          failed.push(localPath);
          console.log('failed.push: ' + localPath);
        } else {
          successful.push(localPath);
          console.log('successful.push: ' + localPath);
        }
      }
    }
  );
}

// creates a temporary folder on the remote server
function createRemoteTempFolder(projectName) {
  return ssh.execCommand(
    `rm -rf ${project}-temp && mkdir ${project}-temp`, {
      cwd: '/home/ubuntu'
  });
}

// stops mongodb and node services on the remote server
function stopRemoteServices() {
  return ssh.execCommand(
    'pm2 stop all && sudo service mongod stop', {
      cwd: '/home/ubuntu'
  });
}

// updates the project source on the server
function updateRemoteApp() {
  return ssh.execCommand(
    `cp -r ${project}-temp/* ${project}/ && rm -rf ${project}-temp`, {
      cwd: '/home/ubuntu'
  });
}

// restart mongodb and node services on the remote server
function restartRemoteServices() {
  return ssh.execCommand(
    `cd  ${project}-temp && sudo service mongod start && pm2 start app.js`, {
      cwd: '/home/ubuntu'
  });
}

// connect to the remote server
function sshConnect() {
  console.log('Connecting to the server...');

  ssh
    .connect({
      // TODO: ADD YOUR IP ADDRESS BELOW (e.g. '12.34.5.67')
      host: host_,
      username: 'ubuntu',
      privateKey: hs_key
    })
    .then(function() {
      console.log('SSH Connection established.');
      console.log('Installing PM2...');
      return installPM2();
    })
    .then(function() {
      console.log(`Creating ${project}-temp folder.`);
      return createRemoteTempFolder();
    })
    .then(function(result) {
      const failed = [];
      const successful = [];
      if (result.stdout) {
        console.log('STDOUT: ' + result.stdout);
      }
      if (result.stderr) {
        console.log('STDERR: ' + result.stderr);
        return Promise.reject(result.stderr);
      }
      console.log('Transferring files to remote server...');
      return transferProjectToRemote(failed, successful);
    })
    .then(function(status) {
      if (status) {
        console.log('Stopping remote services.');
        return stopRemoteServices();
      } else {
        return Promise.reject(failed.join(', '));
      }
    })
    .then(function(status) {
      if (status) {
        console.log('Updating remote app.');
        return updateRemoteApp();
      } else {
        return Promise.reject(failed.join(', '));
      }
    })
    .then(function(status) {
      if (status) {
        console.log('Restarting remote services...');
        return restartRemoteServices();
      } else {
        return Promise.reject(failed.join(', '));
      }
    })
    .then(function() {
      console.log('DEPLOYMENT COMPLETE!');
      process.exit(1);
    })
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

main();
