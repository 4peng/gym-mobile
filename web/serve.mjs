import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function resolveRequestPath(requestPath) {
  if (requestPath.startsWith('/shared/')) {
    return path.join(projectRoot, requestPath.replace(/^\/+/, ''));
  }

  if (requestPath === '/' || requestPath === '') {
    return path.join(__dirname, 'index.html');
  }

  return path.join(__dirname, requestPath.replace(/^\/+/, ''));
}

const server = createServer(async (req, res) => {
  try {
    const requestPath = req.url && req.url !== '/' ? req.url.split('?')[0] : '/';
    const resolved = path.resolve(resolveRequestPath(requestPath));
    const allowedRoots = [path.resolve(__dirname), path.resolve(path.join(projectRoot, 'shared'))];

    if (!allowedRoots.some((root) => resolved.startsWith(root))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    const content = await readFile(resolved);
    const contentType = types[path.extname(resolved)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Routine Lab available at http://127.0.0.1:${port}`);
});
