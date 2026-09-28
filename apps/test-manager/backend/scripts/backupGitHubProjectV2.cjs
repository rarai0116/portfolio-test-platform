/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const path = require('node:path');

const {
  fetchAllProjectItems,
  getGitHubToken,
  parseArgs,
  promptForMissingOwnerAndNumber,
  resolveOutputPath,
  resolveProject,
  saveJsonFile,
} = require('./githubProjectShared.cjs');

function printHelp() {
  console.log(`Usage:
  node ./scripts/backupGitHubProjectV2.cjs [--owner <owner>] [--number <project-number>] [--out <path>]

Options:
  --owner <owner>       Project owner login. 未指定時は対話入力
  --number <number>     Project number. 未指定時は対話入力
  --out <path>          保存先 JSON パス。未指定時はカレントディレクトリへ保存
  --help, -h            ヘルプを表示

Auth:
  - GITHUB_TOKEN または GH_TOKEN
  - または gh auth login --scopes project 済み環境
  - 既存ログインを使う場合は gh auth refresh -h github.com -s project
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const { owner, number } = await promptForMissingOwnerAndNumber(args);
  const token = getGitHubToken();
  const project = await resolveProject({ token, owner, number });
  const items = await fetchAllProjectItems({ token, projectId: project.id });

  const payload = {
    exportedAt: new Date().toISOString(),
    owner,
    projectNumber: number,
    project: {
      id: project.id,
      title: project.title,
      url: project.url,
      number: project.number,
    },
    fields: project.fields,
    items,
  };

  const outputPath = resolveOutputPath({
    outputPath: args.outputPath,
    prefix: 'github-project-v2-backup',
    owner,
    number,
    extension: 'json',
    defaultDirectory: path.resolve(process.cwd(), '_tmp'),
  });

  const savedPath = saveJsonFile(outputPath, payload);
  console.log(
    formatSummary({
      owner,
      number,
      title: project.title,
      fieldCount: project.fields.length,
      itemCount: items.length,
      savedPath,
    }),
  );
}

function formatSummary({ owner, number, title, fieldCount, itemCount, savedPath }) {
  return [
    '[backup-github-project-v2] completed',
    `owner=${owner}`,
    `number=${number}`,
    `title=${title}`,
    `fields=${fieldCount}`,
    `items=${itemCount}`,
    `saved=${savedPath}`,
  ].join(' ');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[backup-github-project-v2] ${message}`);
  process.exitCode = 1;
});