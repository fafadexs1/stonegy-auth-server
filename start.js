const fs = require('fs');
const path = require('path');

process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '2020';

const standaloneDir = path.join(__dirname, '.next', 'standalone');
const standaloneServer = path.join(standaloneDir, 'server.js');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(standaloneServer)) {
  console.log(`📦 Sincronizando arquivos estáticos (.next/static & public)...`);
  const srcStatic = path.join(__dirname, '.next', 'static');
  const targetStatic = path.join(standaloneDir, '.next', 'static');
  const srcPublic = path.join(__dirname, 'public');
  const targetPublic = path.join(standaloneDir, 'public');

  if (fs.existsSync(srcStatic)) {
    copyDirSync(srcStatic, targetStatic);
  }
  if (fs.existsSync(srcPublic)) {
    copyDirSync(srcPublic, targetPublic);
  }

  process.chdir(standaloneDir);
  console.log(`🚀 Next.js Standalone rodando perfeitamente em 0.0.0.0:${process.env.PORT}`);
  require(standaloneServer);
} else {
  console.log(`🚀 Next.js padrão rodando em 0.0.0.0:${process.env.PORT}`);
  const { spawn } = require('child_process');
  const nextCli = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextCli, 'start', '-H', '0.0.0.0', '-p', process.env.PORT], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}
