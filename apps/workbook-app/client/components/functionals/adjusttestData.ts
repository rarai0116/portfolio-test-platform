import {Platform} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
// import * as RNFS from '@dr.pogodin/react-native-fs';
import seedrandom from 'seedrandom';
import type {TestData} from '../hooks/useGlobalSaveDataContext';
import type {QuestionGradeType} from '../../types/commonUnionType';
import type {AssetList} from './realtimeDatabaseController';
import {logErrorToAnalytics} from './analyticsController';

export const getBase64 = async (localPath: string) => {
  const base64 = await RNFS.readFile(localPath).catch((error: unknown) => {
    console.error(`base64エラー path:${localPath}`, error);
    const error_ =
      typeof error === 'string'
        ? new Error(error)
        : new Error('getBase64において不明なエラーが発生しました');
    throw error_;
  });

  return `data:image/png;base64,${base64}`;
};

const adjustTestData = async (
  testData: TestData,
  localAssetList: AssetList,
  basisDir: string,
) => {
  /*
  const getBase64 = async (id: string) => {
    if (localAssetList === null) {
      console.error('localAssetListがnullです');
      return '';
    }

    const localPath = `${basisDir}${localAssetList[id].localPath!}`;
    // console.log(id, localPath);
    // const fileInfo = await RNFS.stat(localPath);
    // const fileInfo = await FileSystem.getInfoAsync(localPath);
    // console.log(fileInfo.isFile()); // ファイルが存在するかどうか
    // console.log(fileInfo); // ファイルが読み取り可能かどうか
    const base64 = await RNFS.readFile(localPath, 'base64').catch(
      (error: unknown) => {
        console.error(`base64エラー id:[${id}]`, error);
        const error_ =
          typeof error === 'string'
            ? new Error(error)
            : new Error('getBase64において不明なエラーが発生しました');
        throw error_;
      },
    );
    return `data:image/png;base64,${base64}`;
  };
  */

  // console.log('adjustTestData', testData);

  //  const list2 = testDataList.map(async (testData) => {
  // sublectキーをsubjectキーに変更する
  const testData2 = Object.keys(testData).reduce<TestData>((acc, key) => {
    if (key === 'sublect') {
      acc.subject = testData[key] as string;
    } else {
      acc[key] = testData[key];
    }

    return acc;
  }, testData);
  // alt属性をもつimgタグを全て検索
  const promiseList = [];
  for (const [key, _value] of Object.entries(testData2)) {
    if (typeof _value !== 'string') continue;
    // Unicode文字列をアンエスケープ

    const value: string = [
      'text',
      'answerText',
      'answerText1',
      'answerText2',
      'answerText3',
      'answerText4',
      'answerText5',
      'ch1',
      'ch2',
      'ch3',
      'ch4',
      'ch5',
    ].includes(key)
      ? unEscapeUnicode(_value)
      : _value;
    if (value !== _value) {
      // console.log('unEscapeUnicode', value, _value);
      testData2[key as keyof TestData] = value;
    }

    const imgTagList = value.match(/<img.*?alt="(.*?)".*?>/g);
    // console.log('imgTagList', imgTagList);
    // 全てのimgタグにsrc属性をalt属性の値で設定
    // 空のwidth・style(width=""・style="")がある場合は削除
    if (imgTagList) {
      // console.log(key, value, imgTagList);
      const imgTagPromises = imgTagList.map(async (imgTag, index) => {
        try {
          // console.log('⭐️', imgTag);
          const match = /alt="([^"]*?)"(.*)/.exec(imgTag);
          // console.log('match', match);
          if (!match) return {imgTag, key, id: '', src: '', other: ''};
          const [_, id, other] = match;
          if (localAssetList === null) return {imgTag, key, id, src: '', other};
          // console.log('id', id, localAssetList[id]);
          if (!localAssetList[id]?.localPath)
            console.error('localPathがnullです', id);
          const localPath = `${basisDir}${localAssetList[id]?.localPath ?? `_/${id}.b64`}`;
          // console.log(localPath);
          const src = await getBase64(localPath).catch((error: unknown) => {
            console.error('error 画像置き換えをスキップします', error);
            logErrorToAnalytics(
              'adjustTestData',
              `画像置き換えエラー: ${error}`,
              'background process',
              {id, localPath},
            );
            return '';
          });

          // console.log('src', imgTag, src);

          return {imgTag, key, id, src, other};
        } catch (error) {
          throw new Error(
            `An error occurred while processing the image tag. Details: [${index} ${imgTag}]${error}`,
          );
        }
      });
      promiseList.push(...imgTagPromises);
    }

    if (
      [
        'answerText1',
        'answerText2',
        'answerText3',
        'answerText4',
        'answerText5',
      ].includes(key)
    ) {
      testData2[key as keyof TestData] = (
        testData2[key as keyof TestData] as string
      ).replace(/^<p>/i, '<p class="first-p">');
    }
  }

  // console.log('promiseList', promiseList);
  await Promise.allSettled(promiseList)
    .then((results) => {
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          // console.log(result);
          console.error('画像置き換えエラー', result.reason, index);
        } else {
          const resultValues = result.value;
          let {imgTag, key, id, src, other} = resultValues;
          // console.log('🌟⭐️', imgTag, key, id, other);
          if (src && key.length > 0) {
            const data = testData2[key as keyof TestData] as string;
            // otherにzoom: 0.2;が含まれている場合は削除
            other = other.replace(/zoom:\s*0\.2;\s*/g, '');
            if (typeof data !== 'string') continue;
            // console.log('🌟⭐️', id, data);
            testData2[key as keyof TestData] = data.replace(
              imgTag,
              `<img src="${src}" alt="${id}"${other}`,
            );
          }
        }
      }
    })
    .catch((error: unknown) => {
      console.error('画像置き換えの不明なエラー', error);
      throw new Error('画像置き換えの不明なエラー');
    });

  return testData2;
  //  });
};

export const getBaseDirectory = async () => {
  if (Platform.OS === 'ios') {
    const _baseDirectory = RNFS.LibraryDirectoryPath;
    if (!_baseDirectory) {
      throw new Error('LibraryDirectoryPathが取得できませんでした');
    }

    // _baseDirectoryの末尾が/で終わっていない場合は/を追加
    const _baseDirectory2 = _baseDirectory.endsWith('/')
      ? `${_baseDirectory}Application Support/`
      : `${_baseDirectory}/Application Support/`;
    const dirExists = await RNFS.exists(_baseDirectory2);
    if (!dirExists) {
      await RNFS.mkdir(_baseDirectory2).catch((error: unknown) => {
        console.error('ディレクトリ作成失敗', error);
        throw new Error(_baseDirectory2);
      });
    }

    return _baseDirectory2;
  } else {
    const _baseDirectory = `${RNFS.DocumentDirectoryPath}`;
    const dirExists = await RNFS.exists(_baseDirectory);
    // _baseDirectoryの末尾が/で終わっていない場合は/を追加
    const _baseDirectory2 = _baseDirectory.endsWith('/')
      ? `${_baseDirectory}`
      : `${_baseDirectory}/`;

    if (!dirExists) {
      await RNFS.mkdir(_baseDirectory2).catch((error: unknown) => {
        console.error('ディレクトリ作成失敗', error);
        throw new Error(_baseDirectory2);
      });
    }

    return _baseDirectory2;
  }
};

export const getLibDirectory = async () => {
  const baseDirectory = await getBaseDirectory();
  const libDir = `${baseDirectory}_/lib/`;

  const dirExists = await RNFS.exists(libDir);
  if (!dirExists) {
    await RNFS.mkdir(libDir);
  }

  return `${baseDirectory}/_/lib/`;
};

/** 配列からランダムに要素を取得する */
export const getRandomElements = <T>(array: T[], count: number) => {
  if (count <= 0) {
    return array;
  }

  const actualCount = Math.min(count, array.length);
  const shuffledNumbers = array.slice(); // 元の配列を破壊しないようにコピーを作成
  for (let i = shuffledNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledNumbers[i], shuffledNumbers[j]] = [
      shuffledNumbers[j],
      shuffledNumbers[i],
    ];
  }

  return shuffledNumbers.slice(0, actualCount);
};

/**  配列をシャッフルする */
export const shuffleArray = <T>(array: T[]) => {
  const shuffledArray = array.slice(); // 元の配列を破壊しないようにコピーを作成

  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }

  return shuffledArray;
};

export function shuffleArraySeed<T>(array: T[], seed: number): T[] {
  // seedrandom は文字列を受け取るので seed を文字列に変換
  const rng = seedrandom(String(seed));
  // 元の配列を変更しないようにコピーを作成
  const arr = array.slice();
  // Fisher-Yates シャッフルを rng を用いて実施
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export const createChoicesArray = (
  _grade: QuestionGradeType,
  _seed: number,
) => {
  const baseArray = _grade === '1級' ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
  if (_seed === 0) return baseArray;
  return shuffleArraySeed(baseArray, _seed);
};

/** Unicode文字列をアンエスケープする */
export const unEscapeUnicode = (stringData: string): string => {
  // \underlineを\Underlineに変換
  return stringData.replace(
    /(\\\\u[a-fA-F\d]{4})|(\\u[a-fA-F\d]{4})|(\\u.+?)(?=(\\|$))/g,
    (_match: string, g1: string, g2: string, g3: string): string => {
      // console.log('match', match);
      if (g1 && typeof g1 === 'string') {
        // エスケープ済みの文字列はそのまま返す
        // console.log('g1', g1);
        return g1;
      } else if (g2 && typeof g2 === 'string') {
        // Unicode文字列と判定されたものはアンエスケープして返す
        /* console.log(
          'g2:Unicode文字列',
          g2,
          String.fromCodePoint(Number.parseInt(g2, 16)),
        );
        */
        return String.fromCodePoint(Number.parseInt(g2, 16));
      } else if (g3 && typeof g3 === 'string') {
        // Unicode文字列と判定されなかったものはエスケープする
        // console.log('g3:katex構文', g3, `\\\\${g3}`);
        return `\\${g3}`;
      }

      return '';
    },
  );
};

export default adjustTestData;
