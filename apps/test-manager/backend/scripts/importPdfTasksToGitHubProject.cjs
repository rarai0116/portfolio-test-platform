/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { readFileSync } = require('node:fs');
const path = require('node:path');
const {
  addDraftIssue,
  buildExistingTaskIndex,
  fetchAllProjectItems,
  findFieldByName,
  getDefaultTaskSourcePath,
  getGitHubToken,
  parseArgs,
  promptForMissingOwnerAndNumber,
  resolveProject,
  saveJsonFile,
  setProjectFieldValue,
} = require('./githubProjectShared.cjs');

const TASK_GROUPS = new Set([
  'View関係',
  'プレビューパネル関係',
  'メインパネル関係',
  'main側処理',
  'backend',
  'ユーティリティ関数',
  'その他',
]);

const LANE_BY_TASK_ID = new Map([
  ['T01', 'B_View/Preview'],
  ['T02', 'B_View/Preview'],
  ['T03', 'B_View/Preview'],
  ['T04', 'B_View/Preview'],
  ['T06', 'B_View/Preview'],
  ['T24', 'B_View/Preview'],
  ['T29', 'B_View/Preview'],
  ['T34', 'B_View/Preview'],
  ['T35', 'B_View/Preview'],
  ['T37', 'B_View/Preview'],
  ['T43', 'B_View/Preview'],
  ['T44', 'B_View/Preview'],
  ['T45', 'B_View/Preview'],
  ['T46', 'B_View/Preview'],
  ['OPT04', 'B_View/Preview'],
  ['T07', 'A_メインパネル'],
  ['T12', 'A_メインパネル'],
  ['T13', 'A_メインパネル'],
  ['T14', 'A_メインパネル'],
  ['T15', 'A_メインパネル'],
  ['T18', 'A_メインパネル'],
  ['T19', 'A_メインパネル'],
  ['T20', 'A_メインパネル'],
  ['T21', 'A_メインパネル'],
  ['T22', 'A_メインパネル'],
  ['T26', 'A_メインパネル'],
  ['T27', 'A_メインパネル'],
  ['T28', 'A_メインパネル'],
  ['T36', 'A_メインパネル'],
  ['T38', 'A_メインパネル'],
  ['T40', 'A_メインパネル'],
  ['OPT01', 'A_メインパネル'],
  ['OPT02', 'A_メインパネル'],
  ['OPT03', 'A_メインパネル'],
]);

const TEST_TASK_IDS = new Set(['T30', 'T31', 'T32', 'T33']);

function printHelp() {
  console.log(`Usage:
  node ./scripts/importPdfTasksToGitHubProject.cjs [--owner <owner>] [--number <project-number>] [--source <path>] [--limit <n>] [--out <path>] [--apply]

Options:
  --owner <owner>       Project owner login. 未指定時は対話入力
  --number <number>     Project number. 未指定時は対話入力
  --source <path>       取込元 Markdown。既定: docs/PDF作成モードv2タスク一覧.md
  --limit <n>           先頭 n 件だけ対象にする
  --out <path>          dry-run / 実行結果レポートの保存先 JSON
  --apply               実際に draft issue を作成する。未指定時は dry-run
  --help, -h            ヘルプを表示

Auth:
  - GITHUB_TOKEN または GH_TOKEN
  - または gh auth login --scopes project 済み環境
  - 既存ログインを使う場合は gh auth refresh -h github.com -s project
`);
}

function parseTasksFromMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const tasks = [];
  let currentScope = '';
  let currentGroup = '';
  let currentTask = null;

  const finalizeTask = () => {
    if (!currentTask) return;
    tasks.push({ ...currentTask });
    currentTask = null;
  };

  for (const line of lines) {
    const scopeMatch = line.match(/^##\s+(本体スコープ|オプションスコープ)\s*$/);
    if (scopeMatch) {
      finalizeTask();
      currentScope = scopeMatch[1] === '本体スコープ' ? '本体' : 'オプション';
      currentGroup = '';
      continue;
    }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();

      if (TASK_GROUPS.has(heading)) {
        finalizeTask();
        currentGroup = heading;
        continue;
      }

      const taskMatch = heading.match(/^((?:T\d+|OPT\d+))\s+(.+)$/);
      if (taskMatch) {
        finalizeTask();
        currentTask = {
          taskId: taskMatch[1],
          title: `${taskMatch[1]} ${taskMatch[2]}`,
          scope: currentScope,
          group: currentGroup,
          target: '',
          completion: '',
          verification: '',
          dependencies: 'なし',
        };
      }

      continue;
    }

    if (!currentTask) continue;

    const targetMatch = line.match(/^-\s+対象:\s*(.+)$/);
    if (targetMatch) {
      currentTask.target = targetMatch[1].trim();
      continue;
    }

    const completionMatch = line.match(/^-\s+完了条件:\s*(.+)$/);
    if (completionMatch) {
      currentTask.completion = completionMatch[1].trim();
      continue;
    }

    const verificationMatch = line.match(/^-\s+確認方法:\s*(.+)$/);
    if (verificationMatch) {
      currentTask.verification = verificationMatch[1].trim();
      continue;
    }

    const dependencyMatch = line.match(/^-\s+依存:\s*(.+)$/);
    if (dependencyMatch) {
      currentTask.dependencies = dependencyMatch[1].trim();
    }
  }

  finalizeTask();
  return tasks;
}

function deriveLane(task) {
  if (LANE_BY_TASK_ID.has(task.taskId)) {
    return LANE_BY_TASK_ID.get(task.taskId);
  }

  if (task.group === 'メインパネル関係') return 'A_メインパネル';
  if (task.group === 'View関係' || task.group === 'プレビューパネル関係') {
    return 'B_View/Preview';
  }
  return '共通';
}

function deriveTaskType(task) {
  if (TEST_TASK_IDS.has(task.taskId)) return 'テスト';
  if (task.taskId === 'T42') return 'ドキュメント';
  return '実装';
}

function buildDraftBody(task, sourcePath) {
  const normalizedSource = path.relative(process.cwd(), sourcePath).replace(/\\/g, '/');
  return [
    `<!-- source-task-id: ${task.taskId} -->`,
    `<!-- source-path: ${normalizedSource} -->`,
    '',
    `## スコープ`,
    task.scope,
    '',
    `## 作業グループ`,
    task.group,
    '',
    `## 対象`,
    task.target || '未記載',
    '',
    `## 完了条件`,
    task.completion || '未記載',
    '',
    `## 確認方法`,
    task.verification || '未記載',
    '',
    `## 依存`,
    task.dependencies || 'なし',
  ].join('\n');
}

function buildFieldAssignments(task) {
  return [
    { fieldName: 'Status', value: 'backlog' },
    { fieldName: 'フェーズ', value: '4_PDF作成モード' },
    { fieldName: '作業グループ', value: task.group },
    { fieldName: 'スコープ', value: task.scope },
    { fieldName: '担当レーン', value: deriveLane(task) },
    { fieldName: 'タスク種別', value: deriveTaskType(task) },
    { fieldName: '依存タスク', value: task.dependencies || 'なし' },
  ];
}

function buildImportPlan({ tasks, sourcePath, existingIndex }) {
  return tasks.map((task) => {
    const existingById = existingIndex.byTaskId.get(task.taskId) || null;
    const existingByTitle = existingIndex.byTitle.get(task.title) || null;
    const existingItem = existingById || existingByTitle;

    return {
      ...task,
      lane: deriveLane(task),
      taskType: deriveTaskType(task),
      fieldAssignments: buildFieldAssignments(task),
      body: buildDraftBody(task, sourcePath),
      skipReason: existingItem ? 'already-exists' : '',
      existingItemId: existingItem?.id || '',
    };
  });
}

function validateParsedTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('取込対象タスクを Markdown から抽出できませんでした');
  }

  for (const task of tasks) {
    if (!task.taskId || !task.title) {
      throw new Error('taskId または title の抽出に失敗したタスクがあります');
    }

    if (!task.scope) {
      throw new Error(`scope の抽出に失敗しました: ${task.taskId}`);
    }

    if (!task.group) {
      throw new Error(`作業グループの抽出に失敗しました: ${task.taskId}`);
    }
  }
}

async function applyPlan({ token, project, plan }) {
  let createdCount = 0;

  for (const item of plan) {
    if (item.skipReason) {
      console.log(
        `[import-pdf-tasks] skip ${item.taskId} title=${item.title} reason=${item.skipReason}`,
      );
      continue;
    }

    const itemId = await addDraftIssue({
      token,
      projectId: project.id,
      title: item.title,
      body: item.body,
    });

    for (const assignment of item.fieldAssignments) {
      const field = findFieldByName(project.fieldIndex, assignment.fieldName);
      await setProjectFieldValue({
        token,
        projectId: project.id,
        itemId,
        field,
        value: assignment.value,
      });
    }

    createdCount += 1;
    console.log(`[import-pdf-tasks] created ${item.taskId} title=${item.title}`);
  }

  return { createdCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const sourcePath = path.resolve(args.sourcePath || getDefaultTaskSourcePath());
  const markdown = readFileSync(sourcePath, 'utf8');
  let tasks = parseTasksFromMarkdown(markdown);
  validateParsedTasks(tasks);

  if (args.limit > 0) {
    tasks = tasks.slice(0, args.limit);
  }

  const { owner, number } = await promptForMissingOwnerAndNumber(args);
  const token = getGitHubToken();

  const project = await resolveProject({ token, owner, number });
  const existingItems = await fetchAllProjectItems({ token, projectId: project.id });
  const existingIndex = buildExistingTaskIndex(existingItems);
  const plan = buildImportPlan({ tasks, sourcePath, existingIndex });

  const summary = {
    owner,
    projectNumber: number,
    projectTitle: project.title,
    sourcePath,
    taskCount: plan.length,
    createTargetCount: plan.filter((item) => !item.skipReason).length,
    skipCount: plan.filter((item) => Boolean(item.skipReason)).length,
    apply: args.apply,
    tasks: plan.map((item) => ({
      taskId: item.taskId,
      title: item.title,
      scope: item.scope,
      group: item.group,
      lane: item.lane,
      taskType: item.taskType,
      dependencies: item.dependencies,
      skipReason: item.skipReason,
    })),
  };

  if (args.outputPath) {
    const savedPath = saveJsonFile(args.outputPath, summary);
    console.log(`[import-pdf-tasks] report saved: ${savedPath}`);
  }

  console.log(
    [
      '[import-pdf-tasks] ready',
      `owner=${owner}`,
      `number=${number}`,
      `project=${project.title}`,
      `tasks=${summary.taskCount}`,
      `create=${summary.createTargetCount}`,
      `skip=${summary.skipCount}`,
      `mode=${args.apply ? 'apply' : 'dry-run'}`,
    ].join(' '),
  );

  if (!args.apply) {
    return;
  }

  const result = await applyPlan({ token, project, plan });
  console.log(`[import-pdf-tasks] completed created=${result.createdCount}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[import-pdf-tasks] ${message}`);
  process.exitCode = 1;
});