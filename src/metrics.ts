import client from "prom-client";
import { logger } from "./logger.js";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

export const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});
register.registerMetric(httpRequestTotal);

export const pipelineRunsTotal = new client.Counter({
  name: "memok_pipeline_runs_total",
  help: "Total number of pipeline runs",
  labelNames: ["pipeline", "status"],
});
register.registerMetric(pipelineRunsTotal);

export const pipelineDuration = new client.Histogram({
  name: "memok_pipeline_duration_seconds",
  help: "Duration of memok pipeline runs in seconds",
  labelNames: ["pipeline"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
});
register.registerMetric(pipelineDuration);

export const dbQueryTotal = new client.Counter({
  name: "memok_db_queries_total",
  help: "Total number of DB queries executed",
  labelNames: ["operation"],
});
register.registerMetric(dbQueryTotal);

export const sseConnectionsTotal = new client.Gauge({
  name: "memok_sse_connections_active",
  help: "Number of active SSE connections",
});
register.registerMetric(sseConnectionsTotal);

export function metricsMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const start = process.hrtime.bigint();
  const route = req.route?.path || req.path;

  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const status = res.statusCode.toString();
    const labels = { method: req.method, route, status_code: status };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);

    logger.trace(
      { method: req.method, route, status, duration },
      "HTTP request completed",
    );
  });

  next();
}

export function getMetricsHandler(
  _req: import("express").Request,
  res: import("express").Response,
): void {
  res.set("Content-Type", register.contentType);
  register.metrics().then((data) => res.send(data));
}

export { register };
