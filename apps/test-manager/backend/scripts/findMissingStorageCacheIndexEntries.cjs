const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === '--project') {
      args.project = value;
      i += 1;
      continue;
    }

    if (key === '--collection') {
      args.collection = value;
      i += 1;
      continue;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.collection) {
    throw new Error('--collection は必須です');
  }

  const projectId =
    args.project || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new Error('--project または GCLOUD_PROJECT を指定してください');
  }

  initializeApp({ projectId });
  const db = getFirestore();

  const storageSnap = await db.collection(args.collection).get();
  const storageIds = new Set(storageSnap.docs.map((doc) => doc.id));

  const cacheIndexPrefix = `${args.collection.replaceAll('/', '_')}_`;
  const cacheIndexSnap = await db.collection('cacheIndex').get();

  const cacheIds = new Set();
  for (const doc of cacheIndexSnap.docs) {
    if (!doc.id.startsWith(cacheIndexPrefix)) {
      continue;
    }

    const data = doc.data();
    const items = data.items ?? {};
    for (const docId of Object.keys(items)) {
      cacheIds.add(docId);
    }
  }

  const missingInCacheIndex = [...storageIds].filter((docId) => !cacheIds.has(docId));

  console.log(
    JSON.stringify(
      {
        collection: args.collection,
        storageCount: storageIds.size,
        cacheIndexCount: cacheIds.size,
        missingCount: missingInCacheIndex.length,
        missingDocIds: missingInCacheIndex.sort(),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});