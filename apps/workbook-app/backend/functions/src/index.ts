import {summarizeConsoleValue} from './utils/consoleSummary';
import { Timestamp } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import * as functions from "firebase-functions/v1";
import { https } from "firebase-functions/v1";
//import * as admin from "firebase-admin";
import initializeApp, {
	ADMIN_EMAILS_SECRET,
	getApp,
	getDb,
	getFirebaseEnv,
	getManagerSheetId,
	initializeManagerSheetId,
	MANAGER_SHEET_ID_SECRET,
	PROJECT_CONFIG_SECRET,
} from "./admin";
// import {db} from "./admin";
// import {updateChangeDailyLog, updateChangeTestLog } from "./testDataController";
import {
	checkDeletedImageAssets,
	checkFileAndUpdateAssetData,
	deleteAsset,
	deleteAssetsData,
	processImageToBase64,
	updateAssetsDataInList,
	updateGradeB64Zip,
} from "./controller/assetController";
import { writeSpreadSheet } from "./controller/sheetController";
import { updateChangeTestData } from "./controller/testDataController";
import {
	_START_HOUR,
	_updateAllUserData,
	_updateDailyLog,
	applyChangedDailyLogsByDatePage,
	formatTimestamp,
	initialUserData,
	updateUserData,
} from "./controller/userDataController";
import Asset from "./types/asset";
import type { GradeStr } from "./types/grade";
import { isGrade } from "./types/grade";
import type { TestPlayDataLog } from "./types/settingCard";

const { validationAssetData, getValidationAssetDataRef } = Asset;
process.env.TZ = "Asia/Tokyo";

const getAdminEmails = () =>
	ADMIN_EMAILS_SECRET.value()
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter((email) => email.length > 0);

const assertAdminEmail = (context: functions.https.CallableContext) => {
	if (!context.auth)
		throw new functions.https.HttpsError("unauthenticated", "unauthenticated");

	const email = context.auth.token.email;
	if (!email)
		throw new functions.https.HttpsError(
			"permission-denied",
			"auth email is required",
		);

	const normalizedEmail = email.trim().toLowerCase();
	if (!getAdminEmails().includes(normalizedEmail))
		throw new functions.https.HttpsError(
			"permission-denied",
			"permission-denied",
			normalizedEmail,
		);
};

/**
 * アセット追加時のリスナー
 * @description アセットの追加時にアセット情報とタイムスタンプを更新する
 * @param _objectMetadata
 * @param _context
 * @returns
 */
export const onUpdateAsset = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.storage.object()
	.onFinalize(async (_objectMetadata, _context) => {

		// フォルダの場合(名前の末尾がスラッシュで終わる)は処理を終了する
		try {
			if (_objectMetadata.name === undefined) return null;
			if (_objectMetadata.name?.match(/\/$/i)) {

				return null;
			}
			initializeApp();
			// アセットデータ構造検証
			const { grade, folder, filename } = validationAssetData(_objectMetadata);

			// ファイル名が***.***の形式でない場合は処理を終了する
			if (filename.match(/[^.]*[.][^.]*$/) === null) return null;
			if (
				_objectMetadata.contentType === "application/zip" &&
				folder === "bzip"
			)
				return await updateAssetsDataInList(
					_objectMetadata,
					grade,
					folder,
					filename,
					[".zip"],
				);
			if (folder === "lib")
				return await updateAssetsDataInList(
					_objectMetadata,
					grade,
					folder,
					filename,
					[".js", ".html", ".css", ".ttf", ".woff2"],
				);
			if (_objectMetadata.contentType === "text/plain" && folder === "b64")
				return;
			if (_objectMetadata.contentType === "text/html" && folder === "html")
				return await updateAssetsDataInList(
					_objectMetadata,
					grade,
					folder,
					filename,
					[".html"],
				);
			if (_objectMetadata.contentType === "image/png" && folder === "image")
				return await updateAssetsDataInList(
					_objectMetadata,
					grade,
					folder,
					filename,
					[".png"],
				);

			//　どこにも該当しない場合は削除
			console.error("不明なレギュレーションエラー", summarizeConsoleValue(_objectMetadata.name));
			return await deleteAsset(_objectMetadata.name);
		} catch (e) {
			console.error("onFinalize：処理失敗", e);
			return e;
		}
	});

/**
 * アセット削除時のリスナー
 * @description アセットの削除時にアセット情報を削除してタイムスタンプを更新する
 * @param _objectMetadata
 * @param _context
 * @returns
 */
export const deleteAssetList = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.storage.object()
	.onDelete(async (_objectMetadata, _context) => {
		try {
			if (!_objectMetadata.name) throw new Error("unresolved to metadata name");

			await new Promise((resolve) => setTimeout(resolve, 5000));

			initializeApp();
			const admin = getApp();
			if (!admin) throw new Error("Failed to initialize Firebase app");


			//ストレージ内にファイルが存在する場合は削除しない
			const fileExists = await admin
				.storage()
				.bucket()
				.file(_objectMetadata.name)
				.exists();
			if (fileExists[0]) {

				return null;
			}
			// フォルダの場合(名前の末尾がスラッシュで終わる)は処理を終了する
			if (_objectMetadata.name?.match(/\/$/i)) {

				return null;
			}
			const { grade, folder, key } = validationAssetData(_objectMetadata);
			return await deleteAssetsData(
				key,
				grade,
				folder,
				folder !== "zip" && folder !== "bzip",
			);
		} catch (e) {
			console.error("onDelete：処理失敗", e);
			return e;
		}
	});

/**
 * 該当ユーザーのカスタムクレームを初期化
 * @param data
 * @param context
 * @returns
 */
export const initilizeCustomClaims = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const admin = getApp();
		if (!admin) throw new Error("Failed to initialize Firebase app");
		const db = getDb();
		const auth = admin.auth();

		const user = await auth.getUser(context.auth.uid);
		const ref = db.collection("users").doc(context.auth.uid);
		const userData = await ref.get().catch((error) => {
			console.error("Failed to read user data", error);
			throw new functions.https.HttpsError(
				"internal",
				"Failed to read user data",
			);
		});
		if (!userData.exists) {
			const name = user.displayName ?? user.email ?? "";
			await updateUserData(
				context.auth.uid,
				{ ...initialUserData, name },
				db,
			).catch((error) => {
				console.error("Failed to initialize user data", error);
				throw new functions.https.HttpsError(
					"internal",
					"Failed to initialize user data",
				);
			});
		}

		// ユーザーデータ作成後に設定し、途中失敗時も次回安全に再試行できるようにする。
		await auth
			.setCustomUserClaims(context.auth.uid, {
				year: new Date().getFullYear(),
				grade: data.grade,
				role: data.role,
			})
			.catch((error) => {
				console.error("Failed to initialize custom claims", error);
				throw new functions.https.HttpsError(
					"internal",
					"Failed to initialize custom claims",
				);
			});

		return {
			status: "success",
			message: userData.exists
				? `initialize customclaims success ${userData.id}`
				: "initialize customclaims and user data success",
		};
	});

/**
 * ユーザーのカスタムレームを更新
 * @param data {claims:{year?:number, grade?:string, role?:string}
 * @param context
 * @returns
 */
export const updateCustomClaims = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const admin = getApp();
		if (!admin) throw new Error("Failed to initialize Firebase app");
		const auth = admin.auth();
		const user = await auth.getUser(context.auth?.uid);
		const claims = user.customClaims;
		// data.claims をそのまま渡すと、クライアントが任意のクレームを自分へ設定できる。
		// このリポジトリの認可はクレームを見ていないため権限昇格には至らないが、
		// 想定しているキーだけを取り出す。
		const requested = (data?.claims ?? {}) as Record<string, unknown>;
		const allowed: Record<string, unknown> = {};
		if (typeof requested.year === "number") allowed.year = requested.year;
		if (typeof requested.grade === "string") allowed.grade = requested.grade;
		if (typeof requested.role === "string") allowed.role = requested.role;
		await auth
			.setCustomUserClaims(context.auth.uid, { ...claims, ...allowed })
			.catch((error) => {
				console.error("Failed to update custom claims", error);
				throw new functions.https.HttpsError(
					"internal",
					"Failed to update custom claims",
				);
			});
		return { status: "success", message: "update customclaims success" };
	});

/**
 * テストデータの最終更新日を現在時刻に更新
 * @description テストデータの更新時にタイムスタンプを更新する
 * @param data
 * @param context
 * @returns
 */
export const writeTestDataLastUpdate = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const admin = getApp();
		if (!admin) throw new Error("Failed to initialize Firebase app");
		if (data.gradeID === "firstGrade") {
			const writeResult = await admin
				.firestore()
				.collection("metadata")
				.doc("firstGradeLastUpdate")
				.update({ test: Timestamp.now() });

			return writeResult;
		}
		if (data.gradeID === "secondGrade") {
			const writeResult = await admin
				.firestore()
				.collection("metadata")
				.doc("secondGradeLastUpdate")
				.update({ test: Timestamp.now() });

			return writeResult;
		}
		return null;
	});

/*
export const deletetestData = functions.region('asia-northeast1').https.onRequest(async (data, context) => {
//    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'unauthenticated');
    const writeResult = await admin.database().ref(`test/`).remove();
    console.log(writeResult);
    return writeResult;
});
*/

/**
 * お問い合わせAPI
 * お問い合わせ情報をスプレットシートに書き込む
 * @param data
 * @param context
 * @returns
 */

export const writeContact = functions
	.region("asia-northeast1")
	.runWith({ secrets: [MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (data, context) => {
		await initializeManagerSheetId();
		const managerSheetId = getManagerSheetId();
		try {
			if (!context.auth)
				throw new functions.https.HttpsError(
					"unauthenticated",
					"unauthenticated",
				);
			// const writeResult = await writeContactData(data.uid, Timestamp.now().toDate().toString(), data.context, data.meta);
			await writeSpreadSheet(managerSheetId, "問い合わせ!C:F", [
				[Timestamp.now().toDate(), "未処理", data.uid, data.context, data.meta],
			]);

			return data;
		} catch (e) {
			throw new https.HttpsError("unknown", "unknown error", {
				error: e,
				managerSheetId,
			});
		}
	});

/**
 * 問題不備報告API
 * 問題不備情報をスプレットシートに書き込む
 * @param data
 * @param context
 * @returns
 */
export const writeProblemReport = functions
	.region("asia-northeast1")
	.runWith({ secrets: [MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (data, context) => {
		await initializeManagerSheetId();
		const managerSheetId = getManagerSheetId();
		try {
			if (!context.auth)
				throw new functions.https.HttpsError(
					"unauthenticated",
					"unauthenticated",
				);
			// const writeResult = await writeProblemReportData(data.uid, Timestamp.now().toDate().toString(), data.context, data.meta);
			await writeSpreadSheet(managerSheetId, "問題不備報告!C:J", [
				[
					Timestamp.now().toDate(),
					"未処理",
					data.uid,
					data.grade,
					data.subject,
					data.year,
					data.no,
					data.problemTypes,
					data.other,
					data.meta,
				],
			]);

			return data;
		} catch (e) {
			throw new https.HttpsError("unknown", "unknown error", {
				error: e,
				managerSheetId,
			});
		}
	});

/**
 * ユーザー情報を更新
 * @param data
 * @param context
 * @returns
 */
export const updateUserDataByAdmin = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const db = getDb();
		try {
			const writeResult = await updateUserData(
				context.auth.uid,
				data.userData,
				db,
			);

			return writeResult;
		} catch (e) {
			throw new https.HttpsError("unknown", "unknown error", e);
		}
	});

/** DB内のアセットデータの削除チェック
 * @param data {grade:string, role:string}
 * @param context
 * @returns
 */
export const checkDeletedAssetsData = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		try {
			const result = await checkDeletedImageAssets(data.grade);

			return result;
		} catch (e) {
			throw new https.HttpsError("unknown", "unknown error", e);
		}
	});

/** userTestDataStoreが更新された時にユーザーのテストデータを更新する
 * @param data
 * @param context
 * @returns result | Error
 * @description ユーザーのテストデータを更新する
 */

export const updateUserTestData = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET] })
	.firestore.document("/userTestDataStore/{uid}")
	.onCreate(async (snapshot, _context) => {
		const data = snapshot.data() as TestPlayDataLog;
		// validation check
		if (data === undefined)
			throw new functions.https.HttpsError("invalid-argument", "invalid data");
		if (!data.uid || !data.testId || !data.controll || !data.changeAt) {
			throw new https.HttpsError(
				"invalid-argument",
				"invalid data",
				"data is invalid",
			);
		}
		try {
			initializeApp();
			const db = getDb();
			const result = await updateChangeTestData(data, db);

			return result;
		} catch (e) {
			if (e instanceof Error) throw new Error(e.message);
			if (typeof e === "string") throw new https.HttpsError("internal", e);
			throw new https.HttpsError("unknown", "unknown error", e);
		}
	});

/**  全てのDailyLogを再適用するAPI
 *  @returns result | Error
 * @description 全てのDailyLogを再適用する
 */
export const updateAllDailyLog = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (_data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const result = await _updateDailyLog(0, true).catch((e) => {
			throw new https.HttpsError("unknown", "unknown error", e);
		});

		if (!result)
			throw new https.HttpsError("unknown", "updateDailyLog Error", result);

		initializeManagerSheetId();
		const managerSheetId = getManagerSheetId();
		await writeSpreadSheet(
			managerSheetId,
			"日次処理!A:D",
			result.writeData,
		).catch((e) => {
			console.error("onCall：処理失敗", e);
			throw new https.HttpsError("unknown", "Write Spread Sheet Error", {
				error: e,
				result: result,
			});
		});
		return result;
	});

export const updateDailyLogTest = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		if (typeof Number(data.rollback) !== "number")
			throw new functions.https.HttpsError(
				"invalid-argument",
				`invalid argument of rollback->${data.rollback}`,
			);
		initializeApp();
		const result = await _updateDailyLog(
			Number(data.rollback),
			data.isAllTarget,
		).catch((e) => {
			throw new https.HttpsError("unknown", "unknown error", e);
		});

		if (!result)
			throw new https.HttpsError("unknown", "updateDailyLog Error", result);

		initializeManagerSheetId();
		const managerSheetId = getManagerSheetId();
		await writeSpreadSheet(
			managerSheetId,
			"日次処理!A:D",
			result.writeData,
		).catch((e) => {
			console.error("onCall：処理失敗", e);
			throw new https.HttpsError("unknown", "Write Spread Sheet Error", {
				error: e,
				result: result,
			});
		});
		return result;
	});

/**  ユーザーデータをアップデート*/
export const updateAllUserData = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (_data, context) => {
		if (!context.auth)
			throw new functions.https.HttpsError(
				"unauthenticated",
				"unauthenticated",
			);
		initializeApp();
		const result = await _updateAllUserData().catch((e) => {
			throw new https.HttpsError("unknown", "unknown error", e);
		});

		if (!result)
			throw new https.HttpsError("unknown", "updateAllUserData Error", result);
		return result;
	});
/**テストデータアップデート
 * @param data
 * @param context
 * @returns result | Error
 * @description テストデータを更新する
 */
/*
export const updateTestData = functions.region('asia-northeast1').https.onCall(async (data, context) => {
    try {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'unauthenticated');
    if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'uid is not defined');
        // トランザクション処理
        const writeResult = await db.runTransaction(async (transaction) => {
            const ref = db.collection('users').doc('_log');
            const testId = !data.id ? await createTestID(context.auth!.uid) : data.testID;
            await updateChangeTestLog(transaction, ref, {...data, 'id':testId}, context);
            await updateChangeDailyLog(transaction, ref, {...data, 'id':testId}, context);
        });
        console.log(writeResult);
        return writeResult;
    } catch (e) {
        throw new https.HttpsError('unknown', 'unknown error', e);
    }
});
*/

/** テストデータを作成してIDを返す
 *  @returns {testId} テストID　｜　{Error} エラー
 */
/*
export const createTestData = functions.region('asia-northeast1').https.onCall(async (data, context) => {
    try {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'unauthenticated');
        if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'uid is not defined');
        const testId = await createTestID(context.auth!.uid);
        console.log(testId);
        return testId;
    } catch (e) {
        throw new https.HttpsError('unknown', 'unknown error', e);
    }
});
*/

/** Zipデータを更新 */

export const updateZip = functions
	.region("asia-northeast1")
	.runWith({
		secrets: [
			PROJECT_CONFIG_SECRET,
			MANAGER_SHEET_ID_SECRET,
			ADMIN_EMAILS_SECRET,
		],
	})
	.https.onCall(async (data: { grade: GradeStr }, context) => {
		// 管理権限を持つユーザーのみ実行可能
		if (getFirebaseEnv() === "prod")
			throw new functions.https.HttpsError(
				"permission-denied",
				"permission-denied",
				getFirebaseEnv(),
			);
		assertAdminEmail(context);
		initializeApp();

		if (isGrade(data.grade) === false)
			throw new functions.https.HttpsError("invalid-argument", "invalid grade");
		try {
			const result = await updateGradeB64Zip(data.grade);

			return result;
		} catch (e) {
			console.error("onCall：処理失敗", e);
			throw new https.HttpsError("unknown", "update zip error", e);
		}
	});

/*
/* assets/firstGrade/image/DeF69FCI-AE53f9E6J7iQtM1oLi5mUMAe.pngをbase64に変換するonCallAPI */
export const processImageTest = functions
	.region("asia-northeast1")
	.runWith({
		secrets: [
			PROJECT_CONFIG_SECRET,
			MANAGER_SHEET_ID_SECRET,
			ADMIN_EMAILS_SECRET,
		],
	})
	.https.onCall(async (_data, context) => {
		// 管理権限を持つユーザーのみ実行可能
		if (getFirebaseEnv() === "prod")
			throw new functions.https.HttpsError(
				"permission-denied",
				"permission-denied",
				getFirebaseEnv(),
			);
		assertAdminEmail(context);
		initializeApp();
		try {
			const result = await processImageToBase64(
				"assets/firstGrade/image/DeF69FCI-AE53f9E6J7iQtM1oLi5mUMAe.png",
			);

			return result;
		} catch (e) {
			console.error("onCall：処理失敗", e);
			throw new https.HttpsError("unknown", "process image error", e);
		}
	});

export const taskImagesToBase64 = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.tasks.taskQueue({
		retryConfig: {
			maxAttempts: 5, // 最大再試行回数
		},
		rateLimits: {
			maxConcurrentDispatches: 10, // 同時実行数
		},
	})
	.onDispatch(
		async (data: { grade: GradeStr; files: string[]; taskId: string }) => {
			const { grade, files, taskId } = data;

			if (!grade || !files || !Array.isArray(files)) {
				throw new Error("Invalid task data: 'grade' and 'files' are required");
			}
			initializeApp();
			const admin = getApp();
			if (!admin) {
				throw new Error("Failed to initialize Firebase app");
			}
			// バケット取得
			const failedFiles: string[] = [];

			for (const filePath of files) {
				await processImageToBase64(filePath).catch((error) => {
					console.error(`Failed to process file: ${filePath}`, error);
					failedFiles.push(filePath);
					return null;
				});

				getValidationAssetDataRef(
					filePath.replace(/(.*\/)([^/]*)(.png)$/i, "$2"),
					grade,
					"b64",
				).update({
					status: "processing",
				});

				// Firestoreに失敗したファイルを保存
				if (failedFiles.length > 0) {
					const db = admin.database();
					await db.ref(`info/${taskId}`).update({
						failedFiles,
						completedAt: Timestamp.now(),
					});
				}
				// 成功したファイル情報をDBに保存
				console.info("onDispatch：処理情報", summarizeConsoleValue({ status: "completed", failedFiles }));
			}
		},
	);
export const batchImagesToBase64 = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth) {
			throw new functions.https.HttpsError(
				"unauthenticated",
				"The function must be called while authenticated.",
			);
		}

		initializeApp();
		const admin = getApp();
		if (!admin) {
			throw new functions.https.HttpsError(
				"internal",
				"Failed to initialize Firebase app",
			);
		}

		const { grade } = data;

		if (!grade || !isGrade(grade)) {
			throw new functions.https.HttpsError(
				"invalid-argument",
				"Invalid request: 'grade' is required and must be valid",
			);
		}

		try {
			const bucket = admin.storage().bucket();
			const [files] = await bucket.getFiles({
				prefix: `assets/${grade}/image/`,
			});

			// PNGファイルのみを対象とする
			const pngFiles = files.filter((file) => file.name.endsWith(".png"));

			if (pngFiles.length === 0) {
				return { status: "success", message: "No PNG files found" };
			}
			// ファイルを10枚ずつ分割
			const batches = [];
			for (let i = 0; i < pngFiles.length; i += 10) {
				batches.push(pngFiles.slice(i, i + 10));
			}

			// タスクキューにタスクを追加
			const taskQueue = getFunctions(admin).taskQueue(
				"locations/asia-northeast1/functions/taskImagesToBase64",
			);
			// タスクIDを生成
			const taskId = `task-${Date.now()}`;
			for (const batch of batches) {
				await taskQueue.enqueue({
					grade,
					files: batch.map((file) => file.name),
					taskId,
				});
			}

			return { status: "success", message: "Tasks enqueued successfully" };
		} catch (error) {
			console.error("Failed to enqueue tasks:", error);
			throw new functions.https.HttpsError(
				"internal",
				"Failed to enqueue tasks",
				error,
			);
		}
	});

// DBのassets/{GradeStr}/b64/{filename}のデータの中からstatusがprocessingのパスを取得して
// そのstutasをcheckFileAndUpdateAssetDataを使ってactiveに変更する
export const updateProcessingB64Files = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.https.onCall(async (data, context) => {
		if (!context.auth) {
			throw new functions.https.HttpsError(
				"unauthenticated",
				"The function must be called while authenticated.",
			);
		}
		initializeApp();
		const admin = getApp();
		if (!admin) {
			throw new functions.https.HttpsError(
				"internal",
				"Failed to initialize Firebase app",
			);
		}
		const db = admin.database();
		try {
			const { grade } = data;
			if (!grade || !isGrade(grade)) {
				throw new functions.https.HttpsError(
					"invalid-argument",
					"Invalid request: 'grade' is required and must be valid",
				);
			}
			const snapshot = await db
				.ref(`assets/${grade}/b64`)
				.orderByChild("status")
				.equalTo("processing")
				.once("value");
			const processingFiles = snapshot.val();
			if (!processingFiles) {
				return { status: "success", message: "No processing files found" };
			}

			const filePaths = Object.keys(processingFiles);

			// タスクキューにタスクを追加
			const taskQueue = getFunctions(admin).taskQueue(
				"locations/asia-northeast1/functions/checkFilesAndUpdateAssetDataTask",
			);
			const BATCH_SIZE = 10;
			for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
				const batch = filePaths.slice(i, i + BATCH_SIZE);
				await taskQueue.enqueue({ grade, files: batch });
			}

			return { status: "success", message: "Tasks enqueued successfully" };
		} catch (error) {
			console.error("Failed to enqueue tasks:", error);
			throw new functions.https.HttpsError(
				"internal",
				"Failed to enqueue tasks",
				error,
			);
		}
	});

export const checkFilesAndUpdateAssetDataTask = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.tasks.taskQueue({
		retryConfig: {
			maxAttempts: 5, // 最大再試行回数
		},
		rateLimits: {
			maxConcurrentDispatches: 10, // 同時実行数
		},
	})
	.onDispatch(async (data: { grade: GradeStr; files: string[] }) => {
		const { grade, files } = data;
		if (!grade || !files || !Array.isArray(files)) {
			throw new Error("Invalid task data: 'grade' and 'files' are required");
		}
		initializeApp();
		const admin = getApp();
		if (!admin) {
			throw new Error("Failed to initialize Firebase app");
		}
		// バケット取得
		for (const filePath of files) {
			await checkFileAndUpdateAssetData(filePath, grade, "b64").catch(
				(error) => {
					console.error(`Failed to process file: ${filePath}`, error);
					return null;
				},
			);
		}
	});

export const applyChangedDailyLogsTask = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.tasks.taskQueue({
		retryConfig: { maxAttempts: 5 },
		rateLimits: { maxConcurrentDispatches: 5 },
	})
	.onDispatch(
		async (data: { date: string; pageSize?: number; lastDocId?: string }) => {
			const { date, pageSize = 200, lastDocId } = data;
			if (!date || typeof date !== "string" || date.length !== 8) {
				throw new Error("Invalid task data: 'date' (YYYYMMDD) is required");
			}

			initializeApp();
			const admin = getApp();
			if (!admin) throw new Error("Failed to initialize Firebase app");

			const db = getDb();
			const rtdb = admin.database();
			const aggRef = rtdb.ref(`info/dailyLog/${date}`);

			// 初期化（存在しなければ）
			await aggRef.transaction((curr) => {
				if (curr) return curr;
				return {
					processed: 0,
					success: 0,
					error: 0,
					startedAt: Date.now(),
					updatedAt: Date.now(),
					written: false,
				};
			});

			// 1ページ処理
			const res = await applyChangedDailyLogsByDatePage(
				date,
				pageSize,
				lastDocId,
				db,
			);


			// 集計値を加算（常に number 加算）
			await aggRef.transaction((curr) => {
				const processed = Number(curr?.processed ?? 0);
				const success = Number(curr?.success ?? 0);
				const error = Number(curr?.error ?? 0);
				return {
					...curr,
					processed: processed + Number(res.processed ?? 0),
					success: success + Number(res.success ?? 0),
					error: error + Number(res.error ?? 0),
					updatedAt: Date.now(),
				};
			});

			// 次ページがある場合は再投入
			if (res.hasMore && res.lastDocId) {
				const tq = getFunctions(admin).taskQueue(
					"locations/asia-northeast1/functions/applyChangedDailyLogsTask",
				);
				await tq.enqueue({ date, pageSize, lastDocId: res.lastDocId });
				return;
			}

			// 最終ページ: 書き込みロック（written を transaction で "writing" にできたら自身が書く）
			const lock = await aggRef.child("written").transaction((v) => {
				if (v === true || v === "writing") return v;
				return "writing";
			});

			if (!lock.committed || lock.snapshot.val() !== "writing") {

				return;
			}

			const snap = await aggRef.once("value");
			const agg = snap.val() as {
				processed?: unknown;
				success?: unknown;
				error?: unknown;
			};

			await initializeManagerSheetId();
			const managerSheetId = getManagerSheetId();
			const formatTime = formatTimestamp(
				Timestamp.now(),
				"YYYY/MM/DD hh:mm:ss",
			);

			// 数値化してから書く
			const toNum = (v: unknown) => {
				if (typeof v === "number") return v;
				if (typeof v === "string") {
					const m = v.match(/\d+/g);
					return m ? Number(m.join("")) : 0;
				}
				return Number(v) || 0;
			};

			const row = [
				formatTime,
				toNum(agg?.success),
				toNum(agg?.error),
				`date=${date}`,
			];

			try {
				await writeSpreadSheet(managerSheetId, "日次処理!A:D", [row]);

				await aggRef.update({ written: true, completedAt: Date.now() });
			} catch (e) {
				console.error(
					`[applyChangedDailyLogsTask] write spreadsheet failed for date=${date}`,
					e,
				);
				// 失敗したらロック解除（再実行を許可）
				await aggRef.update({ written: false, lastWriteErrorAt: Date.now() });
			}
		},
	);
// 期間を指定して、各日の最初のページタスクを投入（バックフィル用）
export const backfillChangedDailyLogs = functions
	.region("asia-northeast1")
	.runWith({
		secrets: [
			PROJECT_CONFIG_SECRET,
			MANAGER_SHEET_ID_SECRET,
			ADMIN_EMAILS_SECRET,
		],
	})
	.https.onCall(
		async (
			data: { startDate?: string; endDate?: string; pageSize?: number },
			context,
		) => {
			// 管理者のみ許可（必要に応じて調整）
			assertAdminEmail(context);

			initializeApp();
			const admin = getApp();
			if (!admin)
				throw new functions.https.HttpsError(
					"internal",
					"Failed to initialize Firebase app",
				);

			// デフォルトは 2024-06-25 から 今日 まで
			const start =
				data.startDate && /^\d{8}$/.test(data.startDate)
					? data.startDate
					: "20250625";
			const today = new Date();
			const endDefault = [
				today.getFullYear().toString().padStart(4, "0"),
				(today.getMonth() + 1).toString().padStart(2, "0"),
				today.getDate().toString().padStart(2, "0"),
			].join("");
			const end =
				data.endDate && /^\d{8}$/.test(data.endDate)
					? data.endDate
					: endDefault;

			const pageSize = data.pageSize ?? 200;

			// 日付をインクリメントしながら全日分の最初のページを投入
			const dates: string[] = [];
			const sY = Number(start.slice(0, 4));
			const sM = Number(start.slice(4, 6)) - 1;
			const sD = Number(start.slice(6, 8));
			const eY = Number(end.slice(0, 4));
			const eM = Number(end.slice(4, 6)) - 1;
			const eD = Number(end.slice(6, 8));
			const sDate = new Date(sY, sM, sD);
			const eDate = new Date(eY, eM, eD);

			for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
				const ymd = [
					d.getFullYear().toString().padStart(4, "0"),
					(d.getMonth() + 1).toString().padStart(2, "0"),
					d.getDate().toString().padStart(2, "0"),
				].join("");
				dates.push(ymd);
			}

			const tq = getFunctions(admin).taskQueue(
				"locations/asia-northeast1/functions/applyChangedDailyLogsTask",
			);
			for (const date of dates) {
				await tq.enqueue({ date, pageSize });
			}

			return { status: "enqueued", dates: dates.length, start, end, pageSize };
		},
	);

/** 0:00になった時にDailyLogにユーザーデータをバッチ処理で一斉適用する
 * @param context
 * @returns result | Error
 * @description ユーザーデータを更新する
 **/
// 既存: 日次スケジュールを「前日分の最初のページをキューに積む」だけに変更
export const updateDailyLog = functions
	.region("asia-northeast1")
	.runWith({ secrets: [PROJECT_CONFIG_SECRET, MANAGER_SHEET_ID_SECRET] })
	.pubsub.schedule(`0 ${_START_HOUR} * * *`)
	.timeZone("Asia/Tokyo")
	.onRun(async () => {
		initializeApp();
		const admin = getApp();
		if (!admin)
			throw new functions.https.HttpsError(
				"internal",
				"Failed to initialize Firebase app",
			);

		// 前日の日付(YYYYMMDD)を算出
		const now = Timestamp.now().toDate();
		const y = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - 1,
			0,
			0,
			0,
		);
		const prevDate = formatTimestamp(Timestamp.fromDate(y), "YYYYMMDD");

		const tq = getFunctions(admin).taskQueue(
			"locations/asia-northeast1/functions/applyChangedDailyLogsTask",
		);
		await tq.enqueue({ date: prevDate, pageSize: 300 });

		// ここでは「キュー投入」のみ。詳細な件数集計が必要なら、最後のページで集計→スプレッドシート書き込みを追加可能

		return { status: "enqueued", date: prevDate };
	});

import { createHash } from "node:crypto"; // 追加: Nodeのハッシュ

// 管理者限定: MANAGER_SHEET_ID_SECRET の確認と書き込みテスト
export const debugManagerSheet = functions
	.region("asia-northeast1")
	.runWith({
		secrets: [
			PROJECT_CONFIG_SECRET,
			MANAGER_SHEET_ID_SECRET,
			ADMIN_EMAILS_SECRET,
		],
	})
	.https.onCall(async (_data, context) => {
		// 管理者のみ
		assertAdminEmail(context);
		const auth = context.auth as NonNullable<typeof context.auth>;

		initializeApp();
		initializeManagerSheetId();
		const managerSheetId = getManagerSheetId();
		const env = getFirebaseEnv();

		// 値の存在チェックとマスク
		const present = !!managerSheetId && managerSheetId.length > 0;
		const len = managerSheetId ? managerSheetId.length : 0;
		const prefix = managerSheetId ? managerSheetId.slice(0, 4) : "";
		const suffix = managerSheetId ? managerSheetId.slice(-4) : "";
		const hash = managerSheetId
			? createHash("sha256").update(managerSheetId).digest("hex").slice(0, 12) // 先頭12桁だけ
			: "";

		// スプレッドシートへの書き込みテスト（1行）
		let writeOk = false;
		let writeError = null;
		try {
			const now = Timestamp.now();
			const row = [now.toDate(), "healthcheck", env, `uid=${auth.uid}`];
			await writeSpreadSheet(managerSheetId, "日次処理!A:D", [row]);
			writeOk = true;
		} catch (e) {
			writeError = e instanceof Error ? e.message : String(e);
		}

		return {
			env,
			present,
			len,
			prefix,
			suffix,
			hash, // 値の一致確認用。必要なら手元で期待IDのハッシュを計算して比較できます
			writeOk,
			writeError,
		};
	});
