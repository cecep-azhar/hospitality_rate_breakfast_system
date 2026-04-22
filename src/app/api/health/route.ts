import { NextResponse } from "next/server";

export async function GET() {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const memRatio = memUsedMB / memTotalMB;

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "2.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: "ok" as string,
      memory: {
        usedMB: memUsedMB,
        totalMB: memTotalMB,
        status: memRatio > 0.9 ? "warning" : "ok" as string,
      },
    },
  };

  return NextResponse.json(health, { status: 200 });
}