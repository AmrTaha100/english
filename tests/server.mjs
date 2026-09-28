import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg"
};

function safePath(urlPath) {
  const decoded =
    decodeURIComponent(
      urlPath.split("?")[0]
    );

  const relative =
    decoded === "/"
      ? "index.html"
      : decoded.replace(/^\/+/, "");

  const absolute =
    path.resolve(root, relative);

  if (
    absolute !== root &&
    !absolute.startsWith(root + path.sep)
  ) {
    return null;
  }

  return absolute;
}

const server =
  http.createServer((request, response) => {
    try {
      const filePath =
        safePath(request.url || "/");

      if (!filePath) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      if (!fs.existsSync(filePath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const stat =
        fs.statSync(filePath);

      if (!stat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(
        200,
        {
          "Content-Type":
            mimeTypes[
              path.extname(filePath)
                .toLowerCase()
            ] ||
            "application/octet-stream",
          "Cache-Control": "no-store"
        }
      );

      fs.createReadStream(
        filePath
      ).pipe(response);
    } catch (error) {
      response.writeHead(500);
      response.end("Internal server error");
      console.error(error);
    }
  });

server.listen(
  4173,
  "127.0.0.1",
  () => {
    console.log(
      "Vocabulary Master E2E server listening on http://127.0.0.1:4173"
    );
  }
);
