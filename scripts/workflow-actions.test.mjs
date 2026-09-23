import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

test('workflow actions use full commit SHAs; local reusable workflows stay local', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const files = readdirSync(directory).filter(name => /\.ya?ml$/.test(name));
  assert.ok(files.length, 'no workflow files checked');
  for (const file of files) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    // ponytail: checks this repo's block-style uses entries; adopt a YAML parser if flow mappings are introduced.
    const entries = [...source.matchAll(/^[ \t]*(?:- +)?uses: +["']?([^\s"'#]+)["']?[ \t]*(?:#.*)?$/gm)];
    assert.ok(entries.length, `${file}: no uses entries checked`);
    for (const [, reference] of entries) {
      if (reference.startsWith('./')) continue;
      assert.match(reference, /^[^@]+@[0-9a-f]{40}$/, `${file}: mutable action ${reference}`);
    }
  }
});
