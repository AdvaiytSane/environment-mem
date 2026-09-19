import http from 'node:http';
import { createRouter } from './registry.js';

export function createServer() {
  const router = createRouter();
  return http.createServer((req, res) => {
    router.handle(req, res);
  });
}

export function start(port = 0) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => resolve(server));
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  start(port).then((server) => {
    const address = server.address();
    console.log('listening on ' + address.port);
  });
}
