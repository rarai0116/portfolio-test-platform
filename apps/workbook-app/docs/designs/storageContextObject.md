# AsyncStorageに保存されるデータ

以下のデータがローカルストレージに保存されます。

## StorageContextObject

`StorageContextObject`は以下のメソッドを提供します。

### readData

- **Key**: string
- **Value**: Promise<StorageData>
- **Description**: 指定したキーに関連付けられたデータを読み込みます。

### storeData

- **Key**: string
- **Value**: any
- **Description**: 指定したキーにデータを保存します。

### getBoolData

- **Key**: string
- **Value**: Promise<boolean | null>
- **Description**: 指定したキーに関連付けられたboolean型のデータを取得します。

### getNumberData

- **Key**: string
- **Value**: Promise<number | null>
- **Description**: 指定したキーに関連付けられたnumber型のデータを取得します。

### getStringData

- **Key**: string
- **Value**: Promise<string | null>
- **Description**: 指定したキーに関連付けられたstring型のデータを取得します。

### getStringArrayData

- **Key**: string
- **Value**: Promise<string[] | null>
- **Description**: 指定したキーに関連付けられたstring型の配列を取得します。

### getStringDataId

- **Key**: string
- **Id**: string
- **Value**: Promise<string | null>
- **Description**: 指定したキーとIDに関連付けられたstring型のデータを取得します。

### getNumberArrayData

- **Key**: string
- **Value**: Promise<number[] | null>
- **Description**: 指定したキーに関連付けられたnumber型の配列を取得します。

### getAssetData

- **Id**: string
- **Value**: Promise<Asset | null>
- **Description**: 指定したIDに関連付けられたAsset型のデータを取得します。

### getAssetListInStorage

- **Value**: Promise<AssetList | null>
- **Description**: ストレージ内のAssetList型のデータを取得します。

### getSettingCardDataMap

- **Key**: string
- **Value**: Promise<SettingCardDataMap | null>
- **Description**: 指定したキーに関連付けられたSettingCardDataMap型のデータを取得します。

### getTestPlayData

- **Key**: string
- **Value**: Promise<TestPlayData | null>
- **Description**: 指定したキーに関連付けられたTestPlayData型のデータを取得します。