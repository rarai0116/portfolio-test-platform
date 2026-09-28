import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export async function startRendererServer(
  rootDir: string,
  port = Number(process.env.RENDERER_HTTP_PORT ?? 3927),
): Promise<{ origin: string; stop: () => Promise<void> }> {
  const normalizedRootDir = resolve(rootDir);
  const indexPath = resolve(normalizedRootDir, 'index.html');

  const resolveRequestPath = (urlPath: string): string | null => {
    let decodedPath: string;

    try {
      decodedPath = decodeURIComponent(urlPath);
    } catch {
      return null;
    }

    const relativePath =
      decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const resolvedPath = resolve(normalizedRootDir, normalize(relativePath));

    if (
      resolvedPath !== indexPath &&
      !resolvedPath.startsWith(normalizedRootDir + sep)
    ) {
      return null;
    }

    return resolvedPath;
  };

  const server = createServer(async (req, res) => {
    if (!req.url) return res.writeHead(400).end('Bad Request');

    const urlPath = req.url.split('?')[0];
    const requestedPath = resolveRequestPath(urlPath);

    if (!requestedPath) {
      return res.writeHead(403).end('Forbidden');
    }

    try {
      let filePath = requestedPath;
      let fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        filePath = resolve(filePath, 'index.html');
        if (
          filePath !== indexPath &&
          !filePath.startsWith(normalizedRootDir + sep)
        ) {
          return res.writeHead(403).end('Forbidden');
        }
        fileStat = await stat(filePath);
      }

      res.setHeader(
        'Content-Type',
        MIME[extname(filePath)] ?? 'application/octet-stream',
      );
      res.setHeader(
        'Cache-Control',
        filePath === indexPath
          ? 'no-cache'
          : 'public,max-age=31536000,immutable',
      );
      return createReadStream(filePath).pipe(res);
    } catch {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(indexPath).pipe(res);
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (err) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw err;
  }

  return {
    origin: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
