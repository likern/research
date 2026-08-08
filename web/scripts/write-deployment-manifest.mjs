import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const deploymentManifestPath = resolve(webRoot, 'dist/.well-known/pinega-deployment.json');

export function createDeploymentManifest(environment = process.env) {
  const repository = required(environment, 'PINEGA_DEPLOYMENT_REPOSITORY');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new TypeError('PINEGA_DEPLOYMENT_REPOSITORY must use owner/repository form');
  }

  const pullRequest = positiveInteger(environment, 'PINEGA_DEPLOYMENT_PULL_REQUEST');
  const sourceSha = commitSha(environment, 'PINEGA_DEPLOYMENT_SOURCE_SHA');
  const baseSha = commitSha(environment, 'PINEGA_DEPLOYMENT_BASE_SHA');
  const testedSha = commitSha(environment, 'PINEGA_DEPLOYMENT_TESTED_SHA');
  const sourceRef = gitRef(environment, 'PINEGA_DEPLOYMENT_SOURCE_REF');
  const baseRef = gitRef(environment, 'PINEGA_DEPLOYMENT_BASE_REF');
  const workflowName = boundedString(environment, 'PINEGA_DEPLOYMENT_WORKFLOW_NAME', 256);
  const workflowRunId = required(environment, 'PINEGA_DEPLOYMENT_WORKFLOW_RUN_ID');
  if (!/^\d+$/u.test(workflowRunId)) throw new TypeError('PINEGA_DEPLOYMENT_WORKFLOW_RUN_ID must be decimal digits');
  const workflowRunAttempt = positiveInteger(environment, 'PINEGA_DEPLOYMENT_WORKFLOW_RUN_ATTEMPT');
  const serverUrl = new URL(required(environment, 'PINEGA_DEPLOYMENT_SERVER_URL'));
  if (serverUrl.protocol !== 'https:') throw new TypeError('PINEGA_DEPLOYMENT_SERVER_URL must use HTTPS');

  return {
    schema_version: 1,
    repository,
    pull_request: pullRequest,
    source_sha: sourceSha,
    base_sha: baseSha,
    tested_sha: testedSha,
    source_ref: sourceRef,
    base_ref: baseRef,
    workflow_name: workflowName,
    workflow_run_id: workflowRunId,
    workflow_run_attempt: workflowRunAttempt,
    workflow_run_url: `${serverUrl.origin}/${repository}/actions/runs/${workflowRunId}/attempts/${workflowRunAttempt}`,
    build_profile: 'cloudflare-pages-preview',
    provider: 'cloudflare-pages',
    expected_environment: 'preview',
  };
}

export async function writeDeploymentManifest(environment = process.env, outputPath = deploymentManifestPath) {
  const manifest = createDeploymentManifest(environment);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function required(environment, key) {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${key} is required`);
  return value.trim();
}

function boundedString(environment, key, maximum) {
  const value = required(environment, key);
  if (value.length > maximum) throw new TypeError(`${key} must not exceed ${maximum} characters`);
  return value;
}

function positiveInteger(environment, key) {
  const value = required(environment, key);
  if (!/^[1-9]\d*$/u.test(value)) throw new TypeError(`${key} must be a positive integer`);
  return Number(value);
}

function commitSha(environment, key) {
  const value = required(environment, key);
  if (!/^[0-9a-f]{40,64}$/u.test(value)) throw new TypeError(`${key} must be a lowercase full commit SHA`);
  return value;
}

function gitRef(environment, key) {
  const value = boundedString(environment, key, 256);
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`${key} contains a control character`);
  return value;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const manifest = await writeDeploymentManifest();
  console.log(`Wrote deployment provenance for ${manifest.tested_sha} to ${deploymentManifestPath}`);
}
