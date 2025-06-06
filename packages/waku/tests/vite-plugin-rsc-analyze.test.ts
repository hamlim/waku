import { build } from 'vite';
import { expect, test, describe } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LoggingFunction, RollupLog } from 'rollup';

import { rscAnalyzePlugin } from '../src/lib/plugins/vite-plugin-rsc-analyze.js';

const root = fileURLToPath(new URL('./fixtures', import.meta.url));

const onwarn = (warning: RollupLog, defaultHandler: LoggingFunction) => {
  if (
    warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
    /"use (client|server)"/.test(warning.message)
  ) {
    return;
  } else if (
    warning.code === 'SOURCEMAP_ERROR' &&
    warning.loc?.column === 0 &&
    warning.loc?.line === 1
  ) {
    return;
  }
  defaultHandler(warning);
};

async function runTest(
  root: string,
  isClient: boolean,
  inputFile: string,
  expectedClientFileSet: Set<string>,
  expectedServerFileSet: Set<string>,
) {
  const clientFileMap = new Map<string, string>();
  const serverFileMap = new Map<string, string>();
  await build({
    root: root,
    logLevel: 'silent',
    build: {
      write: false,
      rollupOptions: {
        onwarn,
        cache: false,
        input: path.resolve(root, inputFile),
      },
    },
    plugins: [
      isClient
        ? rscAnalyzePlugin({
            isClient: true,
            clientFileMap,
            serverFileMap,
          })
        : rscAnalyzePlugin({
            isClient: false,
            clientFileMap,
            serverFileMap,
          }),
    ],
  });
  // remove the base path
  [...clientFileMap].forEach(([value]) => {
    clientFileMap.delete(value);
    clientFileMap.set(path.relative(root, value), 'hash');
  });
  [...serverFileMap].forEach(([value]) => {
    serverFileMap.delete(value);
    serverFileMap.set(path.relative(root, value), 'hash');
  });

  expect(new Set(clientFileMap.keys())).toEqual(expectedClientFileSet);
  expect(new Set(serverFileMap.keys())).toEqual(expectedServerFileSet);
}

describe('vite-plugin-rsc-analyze', () => {
  test('server - server', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      false,
      'server.ts',
      new Set(),
      new Set(['server.ts']),
    );
  });

  test('client - server', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      true,
      'server.ts',
      new Set(),
      new Set(['server.ts']),
    );
  });

  test('server - client', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      false,
      'client.ts',
      new Set(['client.ts']),
      new Set(),
    );
  });

  test('client - client', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      true,
      'client.ts',
      new Set(['client.ts']),
      new Set(),
    );
  });

  test('server - import client', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      false,
      'import-client.ts',
      new Set(['client.ts']),
      new Set(),
    );
  });

  test('client - import client', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      true,
      'import-client.ts',
      new Set(['client.ts']),
      new Set(),
    );
  });

  test('server - import server', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      false,
      'import-server.ts',
      new Set(),
      new Set(['server.ts']),
    );
  });

  test('client - import server', async () => {
    await runTest(
      path.resolve(root, './plugin-rsc-analyze'),
      true,
      'import-server.ts',
      new Set(),
      new Set(['server.ts']),
    );
  });
});
