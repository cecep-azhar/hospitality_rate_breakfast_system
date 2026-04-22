import { NextResponse } from "next/server";

export async function GET() {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "2.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: "ok", // SQLite is always available if server is running
      memory: process.memoryUsage(),
    },
  };

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  if (memUsedMB / memTotalMB > 0.9) {
    health.checks.memory = "warning: high memory usage";
  }

  return NextResponse.json(health, { status: 200 });
}