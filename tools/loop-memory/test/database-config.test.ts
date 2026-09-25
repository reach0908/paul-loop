import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createLoopDb } from '../src/client';
import { repositoryIdentity } from '../src/store';
import { trustedDatabaseConfig } from '../hooks/lib/load-dotenv.mjs';
import { userDatabaseProfile } from './helpers/user-database';

const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async importOriginal => {
  const original = await importOriginal<typeof import('node:os')>();
  return { ...original, userInfo: () => ({ ...original.userInfo(), homedir: state.home }) };
});
let base: string, file: string;
beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'db-authority-')));
  state.home = join(base, 'home');
  mkdirSync(join(state.home, '.config/paul-loop'), { recursive: true, mode: 0o700 });
  file = join(state.home, '.config/paul-loop/memory-databases.json');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(base, { recursive: true, force: true }); });
function configure(url = 'postgresql://fixture@127.0.0.1:5434/loop_memory', extra = {}) {
  writeFileSync(file, JSON.stringify({ [repositoryIdentity(process.cwd()).canonical]: { url, ...extra } }), { mode: 0o600 });
}

it('ignores repository env, plugin options and HOME/XDG redirects without user authorization', () => {
  configure();
  const fake = join(base, 'fake'); mkdirSync(fake);
  for (const [key, value] of Object.entries({ LOOP_DATABASE_URL: 'postgres://fixture@unapproved.invalid/db',
    CLAUDE_PLUGIN_OPTION_LOOP_DATABASE_URL: 'postgres://fixture@other.invalid/db', HOME: fake, XDG_CONFIG_HOME: fake,
    LOOP_MEMORY_CONFIG: fake, PGHOST: 'unapproved.invalid', PGPASSWORD: 'untrusted', PGOPTIONS: 'untrusted', PGSSLMODE: 'no-verify' })) vi.stubEnv(key, value);
  const { pool } = createLoopDb();
  const client = new Client(pool.options);
  expect(client.host).toBe('127.0.0.1'); expect(client.port).toBe(5434);
  expect(client.database).toBe('loop_memory'); expect(client.user).toBe('fixture');
  expect(client.ssl).toBe(false); expect(pool.options.options).toBe(' ');
  expect((pool.options.password as () => string)()).toBe('');
  rmSync(file);
  expect(() => createLoopDb()).toThrow('database_config_missing');
});

it('requires an entry for this repository and safe owned file permissions, without fallback', () => {
  writeFileSync(file, '{}', { mode: 0o600 });
  expect(() => createLoopDb()).toThrow('database_config_missing');
  configure(); chmodSync(file, 0o644);
  expect(() => createLoopDb()).toThrow('database_config_untrusted');
  chmodSync(file, 0o600); const alias = join(base, 'keys');
  writeFileSync(alias, '{}', { mode: 0o600 }); rmSync(file); symlinkSync(alias, file);
  expect(() => createLoopDb()).toThrow('database_config_untrusted');
});

it('shares authorization only with registered worktrees, never an unrelated forged gitfile', () => {
  const approved = join(base, 'approved'), forged = join(base, 'forged'), linked = join(base, 'linked');
  mkdirSync(approved); mkdirSync(forged);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: approved, stdio: 'pipe',
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  git('init', '-q'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture');
  git('worktree', 'add', '--detach', linked);
  writeFileSync(file, JSON.stringify({ [approved]: { url: 'postgresql://fixture@127.0.0.1:5434/db' } }), { mode: 0o600 });
  expect(trustedDatabaseConfig(approved).port).toBe(5434);
  expect(trustedDatabaseConfig(linked).port).toBe(5434);
  mkdirSync(join(linked, 'nested')); expect(trustedDatabaseConfig(join(linked, 'nested')).port).toBe(5434);
  expect(() => trustedDatabaseConfig(forged)).toThrow('database_config_missing');
  writeFileSync(join(forged, '.git'), `gitdir: ${approved}/.git\n`);
  expect(() => trustedDatabaseConfig(forged)).toThrow('database_config_missing');
});

it.each([
  'https://fixture@127.0.0.1:5434/db', 'postgresql://fixture@127.0.0.1/db?host=unapproved.invalid',
  'postgresql://fixture@127.0.0.1/db?port=1', 'postgresql://fixture@127.0.0.1/db?sslkey=/private/key',
  'postgresql://fixture@127.0.0.1/db?sslmode=no-verify', 'postgresql://127.0.0.1/db',
  'postgresql://fixture@127.0.0.1', 'postgresql://fixture@127.0.0.1/db#fragment',
  'postgresql://fixture@127.0.0.1/db?sslmode=disable&sslmode=require',
])('rejects driver reinterpretation before Pool construction: %s', url => {
  configure(url); expect(() => createLoopDb()).toThrow('database_config_invalid');
});

it('requires explicit remote approval and verified TLS; preserves approved sockets and options', () => {
  const remote = 'postgresql://fixture@approved.invalid:5432/db?sslmode=verify-full';
  configure(remote); expect(() => createLoopDb()).toThrow('database_remote_not_approved');
  configure(remote, { allowRemote: true });
  expect(trustedDatabaseConfig(process.cwd())).toMatchObject({ host: 'approved.invalid', ssl: true });
  configure('postgresql://fixture@approved.invalid/db', { allowRemote: true });
  expect(() => createLoopDb()).toThrow('database_remote_not_approved');
  const url = new URL('postgresql://fixture@localhost/db');
  url.searchParams.set('host', '/tmp/loop-memory-fixture/socket'); url.searchParams.set('options', '-c search_path=fixture,public');
  configure(url.toString()); expect(trustedDatabaseConfig(process.cwd())).toMatchObject({ host: '/tmp/loop-memory-fixture/socket', options: '-c search_path=fixture,public' });
});

it('real CLI and heartbeat cannot contact a repository-selected listener; an approved profile can', async () => {
  let contacts = 0;
  const server = createServer(socket => { contacts++; socket.destroy(); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const root = join(base, 'project'); mkdirSync(join(root, '.loop'), { recursive: true });
  const url = `postgresql://fixture@127.0.0.1:${(server.address() as { port: number }).port}/fixture`;
  const home = join(base, 'child-home'); const preload = userDatabaseProfile(home, {});
  const cli = join(import.meta.dirname, '../dist/cli.js');
  const heartbeat = join(import.meta.dirname, '../../loop-engine/hooks/loop-doctor-heartbeat.mjs');
  const env = { PATH: process.env.PATH, LOOP_DATABASE_URL: url, CLAUDE_PLUGIN_OPTION_LOOP_DATABASE_URL: url,
    PGHOST: '127.0.0.1', PGPORT: String((server.address() as { port: number }).port),
    LOOP_MEMORY_SIGNING_KEY: 'fixture', OPENAI_API_KEY: 'fixture', CLAUDE_PROJECT_DIR: root };
  writeFileSync(join(root, '.loop/.env'), `LOOP_DATABASE_URL=${url}\n`);
  const run = (entry: string, args: string[]) => new Promise<{ status: number | null; stdout: string }>((done, reject) => {
    const child = spawn(process.execPath, ['--import', preload, entry, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.resume();
    child.on('error', reject); child.on('close', status => done({ status, stdout }));
  });
  try {
    for (const cmd of ['stats', 'consolidate', 'record-recall']) {
      const result = await run(cli, [cmd, '--json', ...(cmd === 'record-recall' ? ['--hits', '[{"id":"fixture"}]'] : [])]);
      expect(result.status).toBe(1); expect(JSON.parse(result.stdout).reason).toBe('database_config_missing');
    }
    expect((await run(heartbeat, [])).status).toBe(0); expect(contacts).toBe(0);
    userDatabaseProfile(home, { [root]: { url } });
    expect((await run(cli, ['stats', '--json'])).status).toBe(1); // listener is not a Postgres server
    expect(contacts).toBeGreaterThan(0);
    const before = contacts; expect((await run(heartbeat, [])).status).toBe(0); expect(contacts).toBeGreaterThan(before);
  } finally { await new Promise<void>(done => server.close(() => done())); }
}, 15000);
