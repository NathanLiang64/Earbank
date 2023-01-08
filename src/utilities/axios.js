/* eslint-disable react/jsx-one-expression-per-line */
/* eslint-disable no-use-before-define */
/* eslint-disable brace-style */
import axios from 'axios';
// import { useNavigation } from 'hooks/useNavigation';
import { showError } from './MessageModal';
import JWEUtil from './JWEUtil';
import JWTUtil from './JWTUtil';
// eslint-disable-next-line import/no-cycle
import {
  getJwtToken, syncJwtToken, getAesKey, forceLogout,
} from './AppScriptProxy';

// Axios instance
const instance = axios.create({
  baseURL: process.env.REACT_APP_URL,
});

const userAxios = () => instance;

/**
 * processRequest
 * @param {*} request
 * @returns
 */
const processRequest = async (request) => {
  console.log(`\x1b[33mAPI : ${request.method.toUpperCase()} /${request.url}`);
  console.log('Request = ', request.data);
  if (request.method === 'get') return request;

  const jwtToken = await getJwtToken();
  if (jwtToken) request.headers.authorization = `Bearer ${jwtToken}`;

  if (request.headers['Content-Type'] === 'multipart/form-data') return request;

  const payload = request.data ? JSON.stringify(request.data) : '';

  // 處理 JWE Request 加密；在完成 Login 之前，都是使用 JWE 加密模式。
  if (request.url.startsWith('/sm')) {
    if (request.url.startsWith('/smJwe/')) { // TODO request.url.startsWith('//auth/')
      const serverPKey = sessionStorage.getItem('serverPKey');
      request.data = JWEUtil.encryptJWEMessage(serverPKey, payload);
    } else {
      const aes = await getAesKey();
      request.data = JWTUtil.encryptJWTMessage(aes.aesKey, aes.iv, payload);
    }

    request.url = request.url.replace('/smApi/', '/api/');
    request.url = request.url.replace('/smJwe/', '/api/');
  }
  // 處理 JWT Request 加密；當通過 Login 驗證之後，所有 POST 全部都是使用 JWT 加密模式。
  else if (jwtToken) {
    const aes = await getAesKey();
    request.data = JWTUtil.encryptJWTMessage(aes.aesKey, aes.iv, payload);
  }
  // console.log(jwtToken);
  // console.log('%cRequest --> %o', 'color: Green;', request); // 列出完整的 Request 資訊。
  return request;
};

/**
 * processResponse
 * @param {*} response
 * @returns
 */
const processResponse = async (response) => {
  // console.log('%cResponse --> \n%c%o', 'color: Yellow;', 'color: Green;', response);
  // console.log(`jwtToken=${response.data.jwtToken}`);
  // eslint-disable-next-line object-curly-newline
  const { code, data, mac, jwtToken } = response.data; // 不論成功或失敗，都一定會更新 jwtToken

  let rqJwtToken; // 來查是否發出的Request有沒有加密
  const headerAuth = response.config.headers.authorization; // 用Request時所使用的 jwtToken 來判斷是否有使用 JWT
  if (headerAuth && headerAuth.startsWith('Bearer ')) {
    // eslint-disable-next-line prefer-destructuring
    rqJwtToken = headerAuth.split(' ')[1];

    // console.log(`\x1b[32m[New JWT] \x1b[92m${jwtToken}`);
    if (!jwtToken) console.log(`\x1b[31m*** WARNING *** ${response.config.url} 將 JWT Token 設為空值！`, response);
    else {
      await syncJwtToken(jwtToken); // BUG! 可能因為多執行緒而錯亂
    }
  }

  const encData = data ?? response.data.encData; // 為相容 SM
  if (code === '0000') {
    let resultData;
    // 處理 JWE Response 解密
    if (encData.recipients) { // TODO 暫時用這種方式檢查 JWE
      console.log('*** Start JWE Decode ***');
      const privateKey = sessionStorage.getItem('privateKey');
      resultData = JSON.parse(JWEUtil.decryptJWEMessage(privateKey, encData));
    }
    // 處理 JWT Response 解密；若Request時沒有使用jwtToken，或例外發生時，傳回的資料都不會加密。
    else if (rqJwtToken) {
      // console.log('*** Start JWT Decode ***');
      const aes = await getAesKey();
      // console.log(aes, encData);
      resultData = JWTUtil.decryptJWTMessage(aes.aesKey, aes.iv, encData, mac);
    }

    // console.log(`Response Data(解密後) --> ${JSON.stringify(resultData)}`);
    if (resultData) {
      response.data = {
        code,
        data: resultData,
        message: response.data.message,
      };
    }
  }

  if (code !== '0000') {
    // const { closeFunc } = useNavigation(); // BUG Error: Invalid hook call.
    const { message } = response.data;
    // TODO: 導向API失敗的例外處理的頁面！
    console.log(`\x1b[31m${response.config.url} - Exception = (\x1b[33m${code}\x1b[31m) ${message}`);
    switch (code) {
      case 'ISG0001':
      case 'WEBCTL0101':
        await showError('因為您已閒置過久未操作系統，為考量資訊安全；銀行端已自動切斷您的連線。若您要繼續使用，請重新登入，造成您的不便敬請見諒。', () => {
          // 理論上不會發生，但若 APP 沒控好，就有可能
          forceLogout('402', 'The ISG session has expired');
        });
        break;

      case 'WEBCTL9003': // 此功能無法在登入前使用。
      case 'WEBCTL0102': // 密碼錯太多次，鎖住帳號並強制登出
        await showError(message, () => forceLogout('403', message, true));
        break;

      case 'WEBCTL1006': // 尚未通過交易授權驗證，無法執行此項服務。
      default:
        // eslint-disable-next-line react/jsx-one-expression-per-line
        await showError((<p>*** {code} ***<br />{message}</p>)); // , closeFunc);
        break;
    }
  }

  console.log(`\x1b[33m${response.config.url} \x1b[37m - Response = `, response.data);

  // 傳回 未加密 或 解密後 的資料
  response.isSuccess = (code === '0000'); // TODO 錯誤處理，不能讓錯誤發生之後仍繼續執行。
  return response;
};

instance.defaults.retry = 3;
instance.defaults.retryDelay = 1000;
// instance.defaults.maxContentLength = Infinity;
// instance.defaults.maxBodyLength = Infinity;
instance.interceptors.request.use(
  processRequest,
  (ex) => {
    // 系統層錯誤！
    // 若是環境問題，則直接顯示；若是WebController未處理的錯誤，則另外處理。
    console.log('\x1b[31mRequest Error --> ', ex);
    Promise.reject(ex);
  },
);
instance.interceptors.response.use(
  processResponse,
  async (ex) => {
    console.log('\x1b[31mResponse Error --> ', ex);
    // 系統層錯誤！
    // 若是環境問題，則直接顯示；若是WebController未處理的錯誤，則另外處理。
    const { response } = ex;
    switch (response.status) {
      case 401: // The Token has expired
        // 理論上不會發生，但若 APP 沒控好，就有可能
        await showError('因為您已閒置過久未操作系統，為考量資訊安全；銀行端已自動切斷您的連線。若您要繼續使用，請重新登入，造成您的不便敬請見諒。', () => {
          forceLogout(response.status, ex.message, true);
        });
        return Promise.reject(ex);

      case 500: // Server Error
      default:
        break;
    }

    // const { closeFunc } = useNavigation(); // BUG Error: Invalid hook call.
    const errMesg = (
      <p>
        主機忙碌中，請通知客服人員或稍後再試。訊息代碼：({response.status})
        <br />
        {/* DEBUG */}
        原因：{response.data.message}
      </p>
    );
    await showError(errMesg); // , closeFunc);

    return Promise.reject(ex);
  },
);

/**
 *
 * @param {*} method 目前只支援 post/get
 * @param {*} url 透過 setupProxy.js 定義轉接 API 名稱。
 * @param {*} data
 * @param {*} config AxiosRequestConfig
 * @returns
 */
export const userRequest = async (method, url, data, config) => {
  instance.defaults.baseURL = (url.startsWith('/sm')) ? process.env.REACT_APP_SM_CTRL_URL : process.env.REACT_APP_URL;
  // console.log(instance.defaults.baseURL + url);

  method = method.toLowerCase();
  const request = (config?.data ?? data); // 在 config 中宣告的 data 優先權高於參數指定值，原因是 FormData 是記在 config 中。
  let result = null;
  switch (method) {
    case 'get':
      result = await instance.get(url, { params: request }, config);
      break;

    case 'post':
      result = await instance.post(url, request, config);
      break;

    // case 'put':
    //   return instance.put(url, data, config);
    // case 'patch':
    //   return instance.patch(url, data, config);
    // case 'delete':
    //   return instance.delete(url, { params: data }, config);
    default:
      console.log(`未支援的 method: ${method}`);
      result = null;
      break;
  }
  return result;
};

/**
 * 透過 axios 叫用指定的 API，並負責處理非正常的傳回狀態。
 * @param {*} url 透過 setupProxy.js 定義轉接 API 名稱。
 * @param {*} request
 * @param {*} config AxiosRequestConfig
 * @returns 將 WebController 提供的結果傳回；當發生異常時，將傳回 null
 */
export const callAPI = async (url, request, config) => {
  let response = null;
  await userRequest('post', url, request, config)
    .then(async (rs) => {
      response = rs.data; // 只需傳回 WebController 傳回的部份，其他由 axios 額外附加的屬性則不傳回。
    })
    .catch((err) => {
      response = err;
    });

  return response;
};

/**
 * 下載檔案。
 * @param {*} url POST API URL
 * @param {*} request
 * @param {*} filename 輸出檔名。
 */
export const download = async (url, request) => {
  console.log(`\x1b[33mAPI :/${url}`);
  console.log('Request = ', request);
  const token = await getJwtToken();
  // Request Payload 加密
  const aes = await getAesKey();
  const encrypt = JWTUtil.encryptJWTMessage(aes.aesKey, aes.iv, JSON.stringify(request));

  return fetch(`${process.env.REACT_APP_URL}${url}`, {
    method: 'POST',
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(encrypt),
  })
    .then((response) => response.blob())
    .then((file) => {
      const fileUrl = URL.createObjectURL(file);

      const a = document.createElement('a');
      a.href = fileUrl;
      a.rel = 'noreferrer noopener';
      a.target = '_blank'; // 測試若不外開是否可執行
      // a.download = filename; // 因使用者體驗因素，改外開瀏覽器方式取代下載
      a.click();
    })
    .catch((e) => {
      console.log(e);
    });
};

export default userAxios();
