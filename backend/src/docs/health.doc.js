/**
 * @openapi
 * /health:
 *   get:
 *     summary: System health and metrics
 *     description: Returns detailed health status, dependency checks, and system metrics.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System health information retrieved successfully
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Returns 200 when the process is running.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Process is alive
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Returns 200 when critical dependencies are ready, otherwise 503.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *       503:
 *         description: Service is not ready
 * /api/health:
 *   get:
 *     summary: Legacy system health endpoint
 *     description: Backward-compatible alias for the health payload.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System health information retrieved successfully
 */
const healthDocs = {};
export default healthDocs;
