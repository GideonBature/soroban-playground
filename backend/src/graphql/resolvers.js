// GraphQL Resolvers
// Delegates to the same services used by the REST API — no duplication.
// Per-request DataLoaders (context.loaders) batch per-id lookups so an N+1
// fan-out collapses to a single batched SQL query per relation (issue #724).

import {
  compileQueued,
  compileBatch,
  getCompileSnapshot,
  compileProgressBus,
} from '../services/compileService.js';
import {
  deployBatchContracts,
  deployProgressBus,
  getDeploymentState,
} from '../services/deployService.js';
import {
  invokeSorobanContract,
  invokeProgressBus,
} from '../services/invokeService.js';
import { listProjects } from '../services/projectService.js';
import { listFiles } from '../services/fileService.js';
import { listTemplates } from '../services/templateService.js';
import { getCached, setCached, invalidateCache } from './cache.js';

// ── JSON scalar ───────────────────────────────────────────────────────────────
const JSONScalar = {
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral(ast) {
    if (ast.kind === 'StringValue') return JSON.parse(ast.value);
    if (ast.kind === 'ObjectValue') return parseObject(ast);
    return null;
  },
};

function parseObject(ast) {
  const obj = {};
  for (const field of ast.fields) {
    obj[field.name.value] = parseLiteralValue(field.value);
  }
  return obj;
}

function parseLiteralValue(ast) {
  switch (ast.kind) {
    case 'StringValue':
      return ast.value;
    case 'BooleanValue':
      return ast.value;
    case 'IntValue':
      return parseInt(ast.value, 10);
    case 'FloatValue':
      return parseFloat(ast.value);
    case 'ListValue':
      return ast.values.map(parseLiteralValue);
    case 'ObjectValue':
      return parseObject(ast);
    default:
      return null;
  }
}

// ── Pagination helpers ────────────────────────────────────────────────────────
function encodeCursor(index) {
  return Buffer.from(`cursor:${index}`).toString('base64');
}

function decodeCursor(cursor) {
  const str = Buffer.from(cursor, 'base64').toString('utf8');
  const match = str.match(/^cursor:(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function paginate(items, first = 20, after) {
  const startIndex = after ? decodeCursor(after) + 1 : 0;
  const limit = Math.min(first, 50);
  const slice = items.slice(startIndex, startIndex + limit);

  return {
    edges: slice.map((node, i) => ({
      cursor: encodeCursor(startIndex + i),
      node,
    })),
    pageInfo: {
      hasNextPage: startIndex + limit < items.length,
      hasPreviousPage: startIndex > 0,
      startCursor: slice.length ? encodeCursor(startIndex) : null,
      endCursor: slice.length
        ? encodeCursor(startIndex + slice.length - 1)
        : null,
    },
    totalCount: items.length,
  };
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireRole(context, role) {
  if (!context.user?.roles?.includes(role)) {
    throw new Error(`Unauthorized: requires role "${role}"`);
  }
}

// ── Resolvers ─────────────────────────────────────────────────────────────────
export const resolvers = {
  JSON: JSONScalar,

  Query: {
    health: () => 'ok',

    compileStats: async (_parent, _args, context) => {
      const cacheKey = 'compileStats';
      const cached = await getCached(cacheKey, {});
      if (cached) return cached;

      const snapshot = await getCompileSnapshot();
      const totalCompiles = snapshot?.stats?.totalCompiles ?? 0;
      const cacheHits = snapshot?.stats?.cacheHits ?? 0;
      const result = {
        activeWorkers: snapshot?.stats?.activeWorkers ?? 0,
        maxWorkers: 8,
        queueLength: snapshot?.stats?.queueLength ?? 0,
        estimatedWaitTimeMs: (snapshot?.stats?.queueLength ?? 0) * 1500,
        cacheHitRate:
          totalCompiles > 0
            ? parseFloat((cacheHits / totalCompiles).toFixed(2))
            : 0.0,
        totalCompiles,
        cacheHits,
        slowCompiles: snapshot?.stats?.slowCompiles ?? 0,
        memoryPeakBytes: 130023424,
        cacheBytes: 12582912,
        artifactsCount: snapshot?.history?.length ?? 0,
      };

      await setCached(cacheKey, {}, result, 10_000);
      return result;
    },

    compileHistory: async (_parent, _args, context) => {
      const snapshot = await getCompileSnapshot();
      // Return raw history rows. Per-item artifact resolution is delegated to
      // the CompileHistoryItem.artifact field resolver, which routes through
      // context.loaders.compileArtifact — so N items with the same hash only
      // trigger one snapshot read for the whole batch (the loader caches by
      // hash within the request).
      return (snapshot?.history ?? []).map((item, i) => ({
        id: item.id ?? item.requestId ?? item.hash ?? String(i),
        requestId: item.requestId ?? `req_${i}`,
        hash: item.hash ?? '',
        cached: item.cached ?? false,
        durationMs: item.durationMs ?? 0,
        timestamp: item.timestamp ?? new Date().toISOString(),
      }));
    },

    deployHistory: async (_parent, { first = 20, after }, context) => {
      // getDeploymentState() is the actual export from deployService; the
      // previous dynamic-import fallback referenced readDeployHistory which
      // was never exported, so the catch branch always ran.
      let history = [];
      try {
        history = getDeploymentState()?.history ?? [];
      } catch {
        history = [];
      }

      const items = history.map((item, i) => ({
        id: item.id ?? String(i),
        contractId: item.contractId ?? '',
        contractName: item.contractName ?? '',
        network: item.network ?? 'testnet',
        status: item.status ?? 'unknown',
        deployedAt: item.deployedAt ?? new Date().toISOString(),
      }));

      return paginate(items, first, after);
    },

    invokeLog: async (_parent, { contractId, first = 20, after }, context) => {
      requireRole(context, 'admin');
      // Placeholder — real impl would query invoke log file filtered by contractId
      return null;
    },

    // ── Projects / Files / Templates (issue #724) ─────────────────────────────
    // Top-level list resolvers issue one SQL query each. Per-parent relations
    // (Project.files, File.project, etc.) are resolved via context.loaders so
    // an N-parent fan-out collapses to one batched SQL query per relation.
    projects: async (_parent, _args, _context) => listProjects(),

    project: async (_parent, { id }, context) =>
      context.loaders.project.load(id),

    files: async (_parent, _args, _context) => listFiles(),

    templates: async (_parent, _args, _context) => listTemplates(),

    template: async (_parent, { id }, context) =>
      context.loaders.template.load(id),
  },

  // ── Type-level field resolvers (relations routed through DataLoaders) ────────
  Project: {
    files: (parent, _args, context) =>
      context.loaders.filesByProject.load(parent.id),
  },

  File: {
    project: (parent, _args, context) =>
      parent.projectId == null
        ? null
        : context.loaders.project.load(parent.projectId),
    template: (parent, _args, context) =>
      parent.templateId == null
        ? null
        : context.loaders.template.load(parent.templateId),
  },

  Template: {
    files: (parent, _args, context) =>
      context.loaders.filesByTemplate.load(parent.id),
  },

  CompileHistoryItem: {
    // Field-level resolver so per-item artifact lookups batch through the
    // loader — duplicate hashes within one query hit the cache for free.
    artifact: (parent, _args, context) => {
      if (!parent.hash) return null;
      return context.loaders.compileArtifact.load(parent.hash);
    },
  },

  Mutation: {
    compile: async (_parent, { input }, context) => {
      await invalidateCache();
      const result = await compileQueued({
        requestId: `gql-compile-${Date.now()}`,
        code: input.code,
        dependencies: input.dependencies ?? {},
      });
      return {
        success: true,
        cached: result.cached,
        hash: result.hash,
        durationMs: result.durationMs ?? null,
        logs: result.logs ?? [],
        artifact: {
          name: result.artifact.name,
          sizeBytes: result.artifact.sizeBytes,
          path: result.artifact.path,
        },
        message: result.cached
          ? 'Compiled from cache'
          : 'Compiled successfully',
      };
    },

    compileBatch: async (_parent, { contracts }, context) => {
      await invalidateCache();
      const jobs = contracts.slice(0, 4).map((c, i) => ({
        requestId: `gql-batch-${Date.now()}-${i}`,
        code: c.code,
        dependencies: c.dependencies ?? {},
      }));
      const results = await compileBatch(jobs);
      return {
        success: true,
        results: results.map((r, i) => ({
          contractIndex: i,
          success: r.success ?? !r.error,
          hash: r.hash ?? null,
          durationMs: r.durationMs ?? null,
          cached: r.cached ?? false,
          error: r.error ?? null,
        })),
      };
    },

    deploy: async (_parent, { input }, context) => {
      await invalidateCache();
      // Mirrors the REST deploy endpoint behaviour
      const contractId =
        'C' + Math.random().toString(36).substring(2, 54).toUpperCase();
      const deployedAt = new Date().toISOString();
      return {
        success: true,
        contractId,
        contractName: input.contractName,
        network: input.network ?? 'testnet',
        wasmPath: input.wasmPath,
        deployedAt,
        message: `Contract "${input.contractName}" deployed successfully to ${input.network ?? 'testnet'}`,
      };
    },

    invoke: async (_parent, { input }, context) => {
      await invalidateCache();
      const requestId = `gql-invoke-${Date.now()}`;
      const result = await invokeSorobanContract(
        {
          requestId,
          contractId: input.contractId,
          functionName: input.functionName,
          args: input.args ?? {},
          network: input.network,
          sourceAccount: input.sourceAccount,
        },
        {}
      );
      return {
        success: true,
        contractId: result.contractId,
        functionName: result.functionName,
        output: result.parsed,
        stdout: result.stdout ?? null,
        stderr: result.stderr ?? null,
        message: `Function "${result.functionName}" invoked successfully`,
        invokedAt: result.endedAt ?? new Date().toISOString(),
      };
    },
  },

  Subscription: {
    compileProgress: {
      subscribe: async function* (_parent, { requestId }) {
        const queue = [];
        let resolve;
        const next = () =>
          new Promise((r) => {
            resolve = r;
          });

        const handler = (event) => {
          if (!requestId || event.requestId === requestId) {
            queue.push(event);
            if (resolve) {
              resolve();
              resolve = null;
            }
          }
        };

        compileProgressBus.on('progress', handler);
        try {
          while (true) {
            if (queue.length === 0) await next();
            const event = queue.shift();
            yield {
              compileProgress: {
                ...event,
                timestamp: event.timestamp ?? new Date().toISOString(),
              },
            };
          }
        } finally {
          compileProgressBus.off('progress', handler);
        }
      },
    },

    deployProgress: {
      subscribe: async function* (_parent, { requestId }) {
        const queue = [];
        let resolve;
        const next = () =>
          new Promise((r) => {
            resolve = r;
          });

        const handler = (event) => {
          if (!requestId || event.requestId === requestId) {
            queue.push(event);
            if (resolve) {
              resolve();
              resolve = null;
            }
          }
        };

        deployProgressBus.on('progress', handler);
        try {
          while (true) {
            if (queue.length === 0) await next();
            const event = queue.shift();
            yield {
              deployProgress: {
                ...event,
                timestamp: event.timestamp ?? new Date().toISOString(),
              },
            };
          }
        } finally {
          deployProgressBus.off('progress', handler);
        }
      },
    },

    invokeProgress: {
      subscribe: async function* (_parent, { requestId }) {
        const queue = [];
        let resolve;
        const next = () =>
          new Promise((r) => {
            resolve = r;
          });

        const handler = (event) => {
          if (!requestId || event.requestId === requestId) {
            queue.push(event);
            if (resolve) {
              resolve();
              resolve = null;
            }
          }
        };

        invokeProgressBus.on('progress', handler);
        try {
          while (true) {
            if (queue.length === 0) await next();
            const event = queue.shift();
            yield {
              invokeProgress: {
                ...event,
                timestamp: event.timestamp ?? new Date().toISOString(),
              },
            };
          }
        } finally {
          invokeProgressBus.off('progress', handler);
        }
      },
    },
  },
};
