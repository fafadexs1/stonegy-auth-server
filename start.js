const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '2020';

const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');

if (fs.existsSync(standaloneServer)) {
  console.log(`🚀 Iniciando Next.js Standalone em 0.0.0.0:${process.env.PORT}...`);
  require(standaloneServer);
} else {
  console.log(`🚀 Iniciando Next.js padrão em 0.0.0.0:${process.env.PORT}...`);
  const nextCli = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextCli, 'start', '-H', '0.0.0.0', '-p', process.env.PORT], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}
