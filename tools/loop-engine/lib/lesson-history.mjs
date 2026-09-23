// Historical snapshots are hints, never current verification or promotion inputs.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { lessonContentHash, lessonState } from './lesson-state.mjs';
import { verifiedLessonSummary } from './lesson-evidence.mjs';
import { evidenceDir, readEvidence } from './evidence-graph.mjs';
import { sha256 } from './workspace-identity.mjs';

const lessonId = id => typeof id === 'string' && /^[a-f0-9]{16}$/.test(id);
export function readLessonFile(file) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile()) throw Error('lesson file must be a regular file');
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}
function store(root, create = false) {
  const common = realpathSync(resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()));
  let dir = common;
  for (const part of ['loop', 'lesson-history']) {
    dir = join(dir, part);
    if (create) {
      try { mkdirSync(dir, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    try {
      if (!lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink()) throw Error('history directory must not be a symlink or file');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return { dir, repository: sha256(common) };
}
function readSnapshot(file, repository) {
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) throw Error('invalid history file');
  const record = JSON.parse(readLessonFile(file));
  const { content_hash, ...body } = record;
  const { id, preserved_at, ...payload } = body;
  if (sha256(JSON.stringify(body)) !== content_hash || sha256(JSON.stringify(payload)) !== id ||
      record.schema_version !== 1 || record.kind !== 'lesson-history' || record.repository !== repository ||
      record.current_verified !== false || record.lesson?.verified !== false || !lessonId(record.lesson?.id) ||
      !Number.isFinite(Date.parse(preserved_at)) || basename(file) !== `${id}.json`) {
    throw Error('history checksum, repository or schema mismatch');
  }
  return record;
}

export function preserveLesson(file, id, root = process.cwd()) {
  if (process.env.LOOP_LEARNING_OFF === '1') throw Error('learning_off');
  if (!lessonId(id)) throw Error('invalid lesson id');
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) throw Error('invalid lesson file');
  const lesson = JSON.parse(readLessonFile(file));
  if (typeof lesson?.title !== 'string' || typeof lesson.fix !== 'string' ||
      !Array.isArray(lesson.signature) || !lesson.signature.every(line => typeof line === 'string')) throw Error('invalid lesson content');
  const state = lessonState(lesson, { root });
  if (lesson.id !== id || !state.verified || state.invalidated || state.rejected || state.retired) {
    throw Error('preserve requires an active lesson with original local verification receipts');
  }
  // Ordinary recall can use a surviving valid run; preservation must not silently drop broken history.
  for (const candidate of lesson.verification.receipts) verifiedLessonSummary(lesson, lessonContentHash(lesson), candidate, root);
  const { dir, repository } = store(root);
  const ids = [...new Set(state.receipts.flatMap(r => [r.failure_id, r.id, r.seal_id]))];
  const payload = {
    schema_version: 1, kind: 'lesson-history', repository, current_verified: false,
    source_root: realpathSync(root),
    lesson: { id, title: lesson.title, fix: lesson.fix, signature: lesson.signature, verified: false },
    evidence: ids.map(key => readEvidence(evidenceDir(root), key)),
  };
  const key = sha256(JSON.stringify(payload)), target = join(dir, `${key}.json`);
  const body = { ...payload, id: key, preserved_at: new Date().toISOString() };
  const record = { ...body, content_hash: sha256(JSON.stringify(body)) };
  store(root, true);
  const temp = join(dir, `.${key}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
    try { linkSync(temp, target); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  } finally {
    try { unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  // Publish only a complete file, without replacing an earlier snapshot on retries or concurrent writes.
  return readSnapshot(target, repository);
}

export function lessonHistory(id, root = process.cwd()) {
  if (!lessonId(id)) throw Error('history requires a valid --id');
  const { dir, repository } = store(root);
  if (!existsSync(dir)) return [];
  // ponytail: scan local snapshots; add an index only if measured history volume needs it.
  return readdirSync(dir).filter(name => name.endsWith('.json')).sort()
    .map(name => readSnapshot(join(dir, name), repository)).filter(record => record.lesson.id === id);
}
