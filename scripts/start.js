/**
 * Tixora Production Process Runner
 * Supports running as standalone API, standalone Web, or co-located Full-Stack on Render.
 */
const { spawn } = require('child_process');
const path = require('path');

const serviceType = (process.env.SERVICE_TYPE || '').toLowerCase().trim();

function startProcess(command, args, envVars = {}, name = 'PROCESS') {
  console.log(`[Tixora] Spawning ${name}: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...envVars },
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`[${name}] Execution error:`, err);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] Process exited with error code: ${code}`);
      process.exit(code);
    }
  });

  return child;
}

if (serviceType === 'api') {
  console.log('[Tixora] Starting standalone API service...');
  startProcess('node', ['apps/api/dist/server.js'], {}, 'API');
} else if (serviceType === 'web') {
  console.log('[Tixora] Starting standalone Web service...');
  startProcess('npm', ['--workspace=@tixora/web', 'run', 'start'], {}, 'WEB');
} else {
  // Co-located Full-Stack: Backend API + Next.js Frontend together
  const publicPort = process.env.PORT || '3000';
  const internalApiPort = process.env.API_PORT || '8080';

  console.log('====================================================');
  console.log('  TIXORA CINEMA PLATFORM — FULL-STACK INITIALIZATION');
  console.log(`  Backend API:  http://127.0.0.1:${internalApiPort}/api/v1`);
  console.log(`  Frontend Web: http://0.0.0.0:${publicPort}`);
  console.log('====================================================');

  const apiProcess = startProcess(
    'node',
    ['apps/api/dist/server.js'],
    { PORT: internalApiPort, API_PORT: internalApiPort },
    'API'
  );

  const webProcess = startProcess(
    'npm',
    ['--workspace=@tixora/web', 'run', 'start'],
    { PORT: String(publicPort), INTERNAL_API_PORT: internalApiPort },
    'WEB'
  );

  const handleTermination = (signal) => {
    console.log(`[Tixora] Received ${signal}. Gracefully stopping children...`);
    apiProcess.kill('SIGTERM');
    webProcess.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', () => handleTermination('SIGINT'));
  process.on('SIGTERM', () => handleTermination('SIGTERM'));
}

