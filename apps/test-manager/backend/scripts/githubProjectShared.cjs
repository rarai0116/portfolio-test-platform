/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const DEFAULT_TASK_SOURCE_PATH = path.resolve(
  __dirname,
  '../../../docs/PDF作成モードv2タスク一覧.md',
);

function getDefaultTaskSourcePath() {
  return DEFAULT_TASK_SOURCE_PATH;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function parseArgs(argv) {
  const out = {
    owner: '',
    number: '',
    sourcePath: '',
    outputPath: '',
    limit: 0,
    apply: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--owner') {
      out.owner = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--number') {
      out.number = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--source') {
      out.sourcePath = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--out') {
      out.outputPath = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      out.limit = Number(argv[index + 1] || '0');
      index += 1;
      continue;
    }

    if (arg === '--apply') {
      out.apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }

  return out;
}

async function promptForMissingOwnerAndNumber(args) {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const owner = args.owner || (await rl.question('GitHub Project owner: '));
    const numberRaw =
      args.number || (await rl.question('GitHub Project number: '));
    return {
      owner: String(owner || '').trim(),
      number: parseProjectNumber(numberRaw),
    };
  } finally {
    rl.close();
  }
}

function parseProjectNumber(value) {
  const number = Number(String(value || '').trim());
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('project number は 1 以上の整数で指定してください');
  }
  return number;
}

function getGitHubToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (fromEnv) {
    return fromEnv.trim();
  }

  const result = spawnSync('gh', ['auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  throw new Error(
    [
      'GitHub token を取得できませんでした。',
      'GITHUB_TOKEN または GH_TOKEN を設定するか、gh auth login --scopes project または gh auth refresh -h github.com -s project を実行してください。',
    ].join(' '),
  );
}

async function graphqlRequest({ token, query, variables = {} }) {
  const payload = await graphqlRequestPayload({ token, query, variables });

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((item) => item.message).join(' / ');
    throw new Error(`GitHub GraphQL error: ${message}`);
  }

  return payload.data;
}

async function graphqlRequestPayload({ token, query, variables = {} }) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'demo-test-manager-github-project-script',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `GitHub GraphQL request failed: ${response.status} ${response.statusText}`,
    );
  }

  return payload;
}

function isIgnorableOwnerResolutionError(message, owner) {
  const normalizedMessage = String(message || '');
  const escapedOwner = String(owner || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^Could not resolve to an (?:Organization|User) with the login of '${escapedOwner}'\\.?$`,
  );
  return pattern.test(normalizedMessage);
}

function normalizeFieldNode(node) {
  if (!node) return null;

  const normalized = {
    id: node.id,
    name: node.name,
    dataType: node.dataType,
    options: [],
  };

  if (Array.isArray(node.options)) {
    normalized.options = node.options
      .filter(Boolean)
      .map((option) => ({ id: option.id, name: option.name }));
  }

  return normalized;
}

function buildFieldIndex(fields) {
  const byName = new Map();

  for (const field of fields) {
    byName.set(field.name, field);
  }

  return byName;
}

function findFieldByName(fieldIndex, name) {
  const field = fieldIndex.get(name);
  if (!field) {
    throw new Error(`field が見つかりません: ${name}`);
  }
  return field;
}

function findSingleSelectOption(field, optionName) {
  const exact = field.options.find((option) => option.name === optionName);
  if (exact) return exact;

  const lower = String(optionName).toLowerCase();
  const insensitive = field.options.find(
    (option) => String(option.name).toLowerCase() === lower,
  );
  if (insensitive) return insensitive;

  throw new Error(
    `single select option が見つかりません: field=${field.name}, option=${optionName}`,
  );
}

async function resolveProject({ token, owner, number }) {
  const query = `
    query ResolveProject($owner: String!, $number: Int!) {
      userOwner: user(login: $owner) {
        login
        projectV2(number: $number) {
          ...ProjectCore
        }
      }
      organizationOwner: organization(login: $owner) {
        login
        projectV2(number: $number) {
          ...ProjectCore
        }
      }
    }

    fragment ProjectCore on ProjectV2 {
      id
      title
      url
      number
      fields(first: 100) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            dataType
            options {
              id
              name
            }
          }
        }
      }
    }
  `;

  const payload = await graphqlRequestPayload({
    token,
    query,
    variables: { owner, number },
  });

  const nonIgnorableErrors = (payload.errors || []).filter(
    (item) => !isIgnorableOwnerResolutionError(item?.message, owner),
  );

  if (nonIgnorableErrors.length > 0) {
    const message = nonIgnorableErrors.map((item) => item.message).join(' / ');
    throw new Error(`GitHub GraphQL error: ${message}`);
  }

  const data = payload.data;

  const project =
    data?.userOwner?.projectV2 || data?.organizationOwner?.projectV2 || null;

  if (!project) {
    throw new Error(
      `Project v2 が見つかりませんでした: owner=${owner}, number=${number}`,
    );
  }

  const fields = (project.fields?.nodes || [])
    .map(normalizeFieldNode)
    .filter(Boolean);

  return {
    id: project.id,
    title: project.title,
    url: project.url,
    number: project.number,
    owner,
    fields,
    fieldIndex: buildFieldIndex(fields),
  };
}

async function fetchAllProjectItems({ token, projectId }) {
  const query = `
    query ProjectItems($projectId: ID!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              type
              isArchived
              createdAt
              updatedAt
              content {
                __typename
                ... on DraftIssue {
                  id
                  title
                  body
                }
                ... on Issue {
                  id
                  number
                  title
                  body
                  url
                  repository {
                    nameWithOwner
                  }
                }
                ... on PullRequest {
                  id
                  number
                  title
                  body
                  url
                  repository {
                    nameWithOwner
                  }
                }
              }
              fieldValues(first: 100) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    optionId
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                        dataType
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const items = [];
  let after = null;

  for (;;) {
    const data = await graphqlRequest({
      token,
      query,
      variables: { projectId, after },
    });

    const connection = data?.node?.items;
    const nodes = connection?.nodes || [];
    items.push(...nodes);

    if (!connection?.pageInfo?.hasNextPage) {
      break;
    }

    after = connection.pageInfo.endCursor;
  }

  return items;
}

function extractTaskMarker(body) {
  const match = String(body || '').match(/source-task-id:\s*([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : '';
}

function buildExistingTaskIndex(items) {
  const byTaskId = new Map();
  const byTitle = new Map();

  for (const item of items) {
    const title = item?.content?.title || '';
    if (title) {
      byTitle.set(title, item);
    }

    const taskId = extractTaskMarker(item?.content?.body || '');
    if (taskId) {
      byTaskId.set(taskId, item);
    }
  }

  return { byTaskId, byTitle };
}

async function addDraftIssue({ token, projectId, title, body }) {
  const mutation = `
    mutation AddDraftIssue($projectId: ID!, $title: String!, $body: String!) {
      addProjectV2DraftIssue(
        input: { projectId: $projectId, title: $title, body: $body }
      ) {
        projectItem {
          id
        }
      }
    }
  `;

  const data = await graphqlRequest({
    token,
    query: mutation,
    variables: { projectId, title, body },
  });

  const itemId = data?.addProjectV2DraftIssue?.projectItem?.id || '';
  if (!itemId) {
    throw new Error(`draft issue の作成に失敗しました: ${title}`);
  }

  return itemId;
}

async function setProjectFieldValue({ token, projectId, itemId, field, value }) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (field.dataType === 'SINGLE_SELECT') {
    const option = findSingleSelectOption(field, value);
    const mutation = `
      mutation SetSingleSelect(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $optionId: String!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphqlRequest({
      token,
      query: mutation,
      variables: {
        projectId,
        itemId,
        fieldId: field.id,
        optionId: option.id,
      },
    });
    return;
  }

  if (field.dataType === 'TEXT') {
    const mutation = `
      mutation SetText(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $text: String!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { text: $text }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphqlRequest({
      token,
      query: mutation,
      variables: {
        projectId,
        itemId,
        fieldId: field.id,
        text: String(value),
      },
    });
    return;
  }

  if (field.dataType === 'NUMBER') {
    const mutation = `
      mutation SetNumber(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $number: Float!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { number: $number }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphqlRequest({
      token,
      query: mutation,
      variables: {
        projectId,
        itemId,
        fieldId: field.id,
        number: Number(value),
      },
    });
    return;
  }

  if (field.dataType === 'DATE') {
    const mutation = `
      mutation SetDate(
        $projectId: ID!
        $itemId: ID!
        $fieldId: ID!
        $date: Date!
      ) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { date: $date }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphqlRequest({
      token,
      query: mutation,
      variables: {
        projectId,
        itemId,
        fieldId: field.id,
        date: String(value),
      },
    });
    return;
  }

  throw new Error(
    `未対応の field dataType です: ${field.name} (${field.dataType})`,
  );
}

function buildTimestamp() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${date}-${hour}${minute}${second}`;
}

function resolveOutputPath({
  outputPath,
  prefix,
  owner,
  number,
  extension,
  defaultDirectory = process.cwd(),
}) {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const fileName = `${prefix}-${owner}-${number}-${buildTimestamp()}.${extension}`;
  return path.resolve(defaultDirectory, fileName);
}

function saveJsonFile(filePath, value) {
  const resolved = path.resolve(filePath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${formatJson(value)}${os.EOL}`, 'utf8');
  return resolved;
}

module.exports = {
  addDraftIssue,
  buildExistingTaskIndex,
  findFieldByName,
  fetchAllProjectItems,
  formatJson,
  getDefaultTaskSourcePath,
  getGitHubToken,
  parseArgs,
  promptForMissingOwnerAndNumber,
  resolveOutputPath,
  resolveProject,
  saveJsonFile,
  setProjectFieldValue,
};