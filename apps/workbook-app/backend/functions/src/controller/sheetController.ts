import {google} from 'googleapis';

/** SpreadSheetに書き込み
 * @param sheetId
 * @param sheetName
 * @param data
 */
export const writeSpreadSheet = async (
  sheetId: string,
  range: string,
  data: any,
) => {
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets('v4');
  return await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    responseDateTimeRenderOption: 'FORMATTED_STRING',
    requestBody: {
      values: data,
    },
  });
};
