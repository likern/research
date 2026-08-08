import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { createDeploymentManifest, writeDeploymentManifest } from '../../scripts/write-deployment-manifest.mjs';

const sourceSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const testedSha = 'c'.repeat(40);
const environment = {
  PINEGA_DEPLOYMENT_REPOSITORY: 'likern/research',
  PINEGA_DEPLOYMENT_PULL_REQUEST: '24',
  PINEGA_DEPLOYMENT_SOURCE_SHA: sourceSha,
  PINEGA_DEPLOYMENT_BASE_SHA: baseSha,
  PINEGA_DEPLOYMENT_TESTED_SHA: testedSha,
  PINEGA_DEPLOYMENT_SOURCE_REF: 'agent/gate-3a-locale-architecture',
  PINEGA_DEPLOYMENT_BASE_REF: 'main',
  PINEGA_DEPLOYMENT_WORKFLOW_NAME: 'Check Pinega Website',
  PINEGA_DEPLOYMENT_WORKFLOW_RUN_ID: '1234567890',
  PINEGA_DEPLOYMENT_WORKFLOW_RUN_ATTEMPT: '2',
  PINEGA_DEPLOYMENT_SERVER_URL: 'https://github.com',
};

test('deployment provenance distinguishes source, base, and tested merge commits', () => {
  assert.deepEqual(createDeploymentManifest(environment), {
    schema_version: 1,
    repository: 'likern/research',
    pull_request: 24,
    source_sha: sourceSha,
    base_sha: baseSha,
    tested_sha: testedSha,
    source_ref: 'agent/gate-3a-locale-architecture',
    base_ref: 'main',
    workflow_name: 'Check Pinega Website',
    workflow_run_id: '1234567890',
    workflow_run_attempt: 2,
    workflow_run_url: 'https://github.com/likern/research/actions/runs/1234567890/attempts/2',
    build_profile: 'cloudflare-pages-preview',
    provider: 'cloudflare-pages',
    expected_environment: 'preview',
  });
});

test('deployment provenance is written as stable newline-terminated JSON', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'pinega-deployment-'));
  const output = resolve(directory, '.well-known/pinega-deployment.json');
  t.after(() => rm(directory, { recursive: true, force: true }));

  const expected = await writeDeploymentManifest(environment, output);
  const contents = await readFile(output, 'utf8');
  assert.ok(contents.endsWith('\n'));
  assert.deepEqual(JSON.parse(contents), expected);
  assert.doesNotMatch(contents, /artifact_sha256/u, 'the artifact cannot contain its own checksum');
});

test('deployment provenance rejects abbreviated or malformed identities', () => {
  assert.throws(
    () => createDeploymentManifest({ ...environment, PINEGA_DEPLOYMENT_TESTED_SHA: 'deadbeef' }),
    /full commit SHA/u,
  );
  assert.throws(
    () => createDeploymentManifest({ ...environment, PINEGA_DEPLOYMENT_PULL_REQUEST: '0' }),
    /positive integer/u,
  );
  assert.throws(
    () => createDeploymentManifest({ ...environment, PINEGA_DEPLOYMENT_SOURCE_REF: 'bad\nref' }),
    /control character/u,
  );
});
