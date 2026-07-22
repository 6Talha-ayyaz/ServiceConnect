import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { initRealtime } from "./realtime";

const app = createApp();
const httpServer = http.createServer(app);

initRealtime(httpServer, config.corsOrigins);

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`ServiceConnect API listening on http://localhost:${config.port}`);
});
