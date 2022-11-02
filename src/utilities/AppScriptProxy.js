/* eslint-disable no-bitwise */
/* eslint-disable object-curly-newline */
/* eslint-disable no-use-before-define */
/* eslint-disable brace-style */
import forge from 'node-forge';
import PasswordDrawer from 'components/PasswordDrawer';
import { getTransactionAuthMode, createTransactionAuth } from 'components/PasswordDrawer/api';
import { customPopup, showDrawer, showError } from './MessageModal';

const device = {
  ios: () => !(sessionStorage.getItem('webMode') === 'true') && /iPhone|iPad|iPod/i.test(navigator.userAgent),
  android: () => !(sessionStorage.getItem('webMode') === 'true') && /Android/i.test(navigator.userAgent),
};

/**
 * 執行 APP 提供的 JavaScript（ jstoapp ）
 * @param {*} appJsName APP提供的JavaScript funciton名稱。
 * @param {*} jsParams JavaScript的執行參數。
 * @param {*} needCallback 表示需要從 APP 取得傳回值，所以需要等待 Callback
 * @param {*} webDevTest Web開發測試時的執行方法。(Option)
 * @returns
 */
async function callAppJavaScript(appJsName, jsParams, needCallback, webDevTest) {
  console.log(`\x1b[33mAPP-JS://${appJsName} \x1b[37m - Params = `, jsParams);

  if (!window.AppJavaScriptCallback) {
    window.AppJavaScriptCallback = {};
    window.AppJavaScriptCallbackPromiseResolves = {};
  }

  /**
   * 負責接收 APP JavaScript API callback 的共用方法。
   * @param {*} value APP JavaScript API的傳回值。
   */
  const CallbackFunc = (jsToken, value) => {
  // console.log('*** Result from APP JavaScript : ', value);

    let result;
    try {
      // 若是 JSON 格式，則以物件型態傳回。
      result = JSON.parse(value);
    } catch (ex) {
      result = value;
    }
    window.AppJavaScriptCallbackPromiseResolves[jsToken](result);

    delete window.AppJavaScriptCallbackPromiseResolves[jsToken];
    delete window.AppJavaScriptCallback[jsToken];
  };

  const promise = new Promise((resolve) => {
    const jsToken = `A${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`; // 有千萬分之一的機率重覆。
    window.AppJavaScriptCallback[jsToken] = (value) => CallbackFunc(jsToken, value);
    window.AppJavaScriptCallbackPromiseResolves[jsToken] = resolve;

    // console.log('*** Call APP JavaScript : JS Token = ', jsToken, window.AppJavaScriptCallback);

    const request = {
      ...jsParams,
      callback: (needCallback ? `AppJavaScriptCallback['${jsToken}']` : null), // 此方法可提供所有WebView共用。
    };

    if (device.ios()) {
      const msg = JSON.stringify({ name: appJsName, data: JSON.stringify(request) });
      window.webkit.messageHandlers.jstoapp.postMessage(msg);
    }
    else if (device.android()) {
      window.jstoapp[appJsName](JSON.stringify(request));
    }
    else if (needCallback || webDevTest) {
      window.AppJavaScriptCallback[jsToken](webDevTest(request));
      return;
    }
    // else throw new Error('使用 Web 版未支援的 APP JavaScript 模擬方法(' + appJsName + ')');

    // 若不需要從 APP 取得傳回值，就直接結束。
    if (!needCallback) resolve(null);
  });

  // result 是由 AppJavaScriptCallback 接收，並嘗試用 JSON Parse 轉為物件，轉不成功則以原資料內容傳回。
  const result = await promise;
  console.log(`\x1b[33mAPP-JS://${appJsName} \x1b[37m - Result = `, result);
  return result;
}

/**
 * Web版 Function Controller
 */
const funcStack = {
  push: (startItem) => {
    console.log('Start Function : ', startItem);

    const stack = JSON.parse(localStorage.getItem('funcStack') ?? '[]');
    stack.push(startItem);
    localStorage.setItem('funcStack', JSON.stringify(stack));

    // 寫入 Function 啟動參數。
    const params = startItem.funcParams ? { funcParams: startItem.funcParams, keepData: null } : null;
    localStorage.setItem('funcParams', (JSON.stringify(params) ?? null));
  },
  pop: () => {
    localStorage.removeItem('funcParams');

    const stack = JSON.parse(localStorage.getItem('funcStack') ?? '[]');
    if (stack.length === 0) return null;

    const closedItem = stack[stack.length - 1];
    // console.log('POP -> Closed Item : ', closedItem);

    stack.pop();
    localStorage.setItem('funcStack', JSON.stringify(stack));

    // 寫入 Function 啟動參數。
    const startItem = stack[stack.length - 1];
    if (closedItem) {
      const params = { funcParams: startItem?.funcParams, keepData: closedItem.keepData };
      localStorage.setItem('funcParams', JSON.stringify(params));
      console.log('Close Function and Back to (', startItem?.funcID ?? 'Home', ')', params);
    }

    return startItem;
  },
  peek: () => {
    const stack = JSON.parse(localStorage.getItem('funcStack') ?? '[]');
    const lastItem = stack[stack.length - 1];
    return lastItem;
  },
  clear: () => {
    localStorage.setItem('funcStack', '[]');
  },
};

/**
 * 網頁通知APP跳轉至首頁
 */
async function goHome() {
  funcStack.clear();
  await callAppJavaScript('goHome', null, false, () => {
    startFunc('/');
  });
}

/**
 * 網頁通知APP跳轉指定功能
 * @param {*} funcID 單元功能代碼。
 * @param {*} funcParams 提共給啟動的單元功能的參數，被啟動的單元功能是透過 loadFuncParams() 取回。
 * @param {*} keepData 當啟動的單元功能結束後，返回原功能啟動時取回的資料。
 */
async function startFunc(funcID, funcParams, keepData) {
  if (!funcID) {
    showError('此功能尚未完成！');
    return;
  }

  funcID = funcID.replace(/^\/*/, ''); // 移掉前置的 '/' 符號,
  const data = {
    funcID,
    funcParams: JSON.stringify(funcParams),
    keepData: JSON.stringify(keepData),
  };
  funcStack.push(data);

  // 只要不是 A00100 這種格式的頁面，一律視為 WebPage 而不透過 APP 的 Function Controller 轉導。
  const isFunction = (/^[A-Z]\d{5}$/.test(funcID));
  if (isFunction) {
    await callAppJavaScript('startFunc', data, false, () => {
      window.location.pathname = `${process.env.REACT_APP_ROUTER_BASE}/${funcID}`;
    });
  } else {
    window.location.pathname = `${process.env.REACT_APP_ROUTER_BASE}/${funcID}`;
  }
}

/**
 * 觸發APP返回上一頁功能
 * @param {*} response 傳回值，會暫存在 SessionStorate("FuncRs") 中。
 */
async function closeFunc(response) {
  // NOTE 必需排除 event 物件。
  if (response && (!response.target && !response.type)) {
    sessionStorage.setItem('FuncRs', JSON.stringify(response));
  }

  const closeItem = funcStack.peek(); // 因為 funcStack 還沒 pop，所以用 peek 還以取得正在執行中的 單元功能(例：A00100) 或是 頁面(例：moreTransactions)
  const isFunction = !closeItem || (/^[A-Z]\d{5}$/.test(closeItem.funcID)); // 表示 funcID 是由 Function Controller 控制的單元功能。

  const startItem = funcStack.pop();
  const webCloseFunc = async () => {
    const rootPath = `${process.env.REACT_APP_ROUTER_BASE}/`;
    // 當 funcStack.pop 不出項目時，表示可能是由 APP 先啟動了某項功能（例：首頁卡片或是下方MenuBar）
    if (startItem) {
      // 表示返回由 WebView 啟動的單元功能或頁面，例：從「更多」啟動了某項單元功能，當此單元功能關閉時，就會進到這裡。
      window.location.pathname = `${rootPath}${startItem.funcID}`; // keepData 存入 localStorage 'funcParams'
    } else {
      // 雖然 Web端的 funcStack 已經空了，但有可能要返回的功能是由 APP 啟動的；所以，要先詢問 APP 是否有正在執行中的單元功能。
      const appJsRs = await callAppJavaScript('getActiveFuncID', null, true); // 取得 APP 目前的 FuncID
      if (appJsRs) {
        // 例：首頁卡片 啟動 存錢計劃，當 存錢計劃 選擇返回前一功能時，就會進到這裡。（因為此時的 funcStack 是空的）
        window.location.pathname = `${rootPath}${appJsRs.funcID}`;
      } else window.location.pathname = rootPath;
    }
  };

  if (isFunction) {
    await callAppJavaScript('closeFunc', null, false, webCloseFunc);
  } else {
    await webCloseFunc();
  }
}

/**
 * 取得 APP Function Controller 提供的功能啟動參數。
 * @returns 若參數當時是以 JSON 物件儲存，則同樣會轉成物件傳回。
 */
async function loadFuncParams() {
  try {
    const funcItem = funcStack.peek(); // 因為功能已經啟動，所以用 peek 取得正在執行中的 單元功能(例：A00100) 或是 頁面(例：moreTransactions)
    const isFunction = !funcItem || (/^[A-Z]\d{5}$/.test(funcItem.funcID)); // 表示 funcID 是由 Function Controller 控制的單元功能。

    const webGetFuncParams = () => {
      const params = localStorage.getItem('funcParams');
      if (!params || params === 'null') return null;
      if (params.startsWith('{')) return JSON.parse(params);
      return params;
    };

    const data = isFunction ? (await callAppJavaScript('getPagedata', null, true, webGetFuncParams)) : webGetFuncParams();
    let params = null;
    if (data && data !== 'undefined') {
      // 解析由 APP 傳回的資料, 只要有 keepData 就表示是由叫用的功能結束返回
      // 因此，要以 keepData 為單元功能的啟動參數。
      // 反之，表示是單元功能被啟動，此時才是以 funcParams 為單元功能的啟動參數。
      const dataStr = (data.keepData ?? data.funcParams);
      params = (dataStr && dataStr.startsWith('{')) ? JSON.parse(dataStr) : null; // NOTE 只支援APP JS傳回JSON格式資料！
    }

    // 取得 Function 在 closeFunc 時提供的傳回值。
    const response = sessionStorage.getItem('FuncRs');
    console.log('>> Function 傳回值 : ', response);
    sessionStorage.removeItem('FuncRs');
    if (response) {
      params = {
        ...params,
        response: JSON.parse(response),
      };
    }

    // await showAlert(`>> Function 啟動參數 : ${JSON.stringify(params)}`);
    console.log('>> Function 啟動參數 : ', params);
    return params;
  } catch (error) {
    console.log('>> Function 啟動參數 ** ERROR ** : ', error);
    await showAlert(JSON.stringify(error));
    return error;
  }
}

/**
 * 開啟/關閉APP Loading等待畫面
 * @param {boolean} visible
 */
async function switchLoading(visible) {
  const data = { open: visible ? 'Y' : 'N' };
  await callAppJavaScript('onLoading', data, false);
}

/**
 * 啟動APP OCR畫面及識別流程, APP在處理結束後會呼叫callback Web JS將傳給網頁
 * @param {*} imageType 影像類型。1.身份證正面, 2.身份證反面
 * @returns 辨識結果。例：{"rtcode":"", "rtmsg":"","data":[{"type":"name","data":"林宜美"},{"type":"birthday","data":"69/5/20"},{"type":"sex","data":"女"}]}
 */
async function doOCR(imageType) {
  const data = { ocrType: imageType };
  return await callAppJavaScript('onOCR', data, true);
}

/**
 * 以 Popup 模式開啟 APP 原生的 WebView，不會影響到目前運做中的 WebView。
 * 注意：Page間的資料傳遞與傳回值的取得，需由 Page 自行處理。
 * @param {*} url 要開啟的畫面連結
 */
async function showPopup(url) {
  const data = { url };
  await callAppJavaScript('openPopWebView', data, false, () => {
    // TODO 用 MessageModal 的 customPopup 模擬。
  });
}

/**
 * 開啟原生的 Alert 視窗。
 * @param {*} message 要顯示的訊息。
 */
async function showAlert(message) {
  const data = { message };
  await callAppJavaScript('showAlert', data, false, () => {
    alert(message);
  });
}

/**
 * 開啟 APP 分享功能。
 * @param {*} message 要分享的訊息內容，內容為 HTML 格式。
 */
async function shareMessage(message) {
  const data = { webtext: message };
  await callAppJavaScript('setShareText', data, false, () => {
    // 測試版的分享功能。
    customPopup('分享功能 (測試版)', message);
  });
}

// Note setWebLogdata 用不到

// TODO 提供 Exception 資訊給 APP 寫入回報，就有需要了。

/**
 * 取得 JWT Payload 加密用的 AES Key 及 IV
 * @returns
 */
async function getAesKey() {
  const aesKey = sessionStorage.getItem('aesKey');
  if (aesKey) {
    return {
      aesKey,
      iv: sessionStorage.getItem('iv'),
    };
  }
  const rs = await callAppJavaScript('getEnCrydata', null, true);
  return {
    aesKey: forge.util.decode64(rs.Crydata).substring(7),
    iv: forge.util.decode64(rs.Enivec).substring(7),
  };
}

/**
 * 通知 APP 同步 WebView 的 JwtToken
 * @param {*} jwtToken WebView 最新取得的 JwtToken
 */
async function syncJwtToken(jwtToken) {
  if (jwtToken) {
    sessionStorage.setItem('jwtToken', jwtToken);
  } else {
    sessionStorage.removeItem('jwtToken');
    console.log('\x1b[31m*** WARNING *** syncJwtToken 將 JWT Token 設為空值！');
  }

  const data = { auth: jwtToken };
  await callAppJavaScript('setAuthdata', data, false);
}

/**
 * 取得 JwtToken。
 * 為保持 Token 的連續性，因此必須優先使用 Web 端的 Token；因為 APP 端有可能因為背景功能發動API而更新了 Token。
 * @param {boolean} force 表示強制使用 APP 端的 JwtToken
 * @returns 最新的 JwtToken
 */
async function getJwtToken(force) {
  let jwtToken = sessionStorage.getItem('jwtToken'); // 每次收到 Response 時，就會寫入 sessionStorage
  if (!jwtToken || force) {
    // 從 APP 取得 JWT Token，並存入 sessionStorage 給之後的 WebView 功能使用。
    const result = await callAppJavaScript('getAPPAuthdata', null, true, () => null); // 傳回值： {"auth":""}
    jwtToken = result?.auth; // NOTE 不應該為 null, 不論是 result 或 auth。
    if (jwtToken) {
      sessionStorage.setItem('jwtToken', jwtToken);
    } else {
      sessionStorage.removeItem('jwtToken');
      console.log('\x1b[31m*** WARNING *** getJwtToken 取得的 JWT Token 為空值！');
    }
  }
  // console.log(`\x1b[32m[JWT] \x1b[92m${jwtToken}`);
  return jwtToken;
}

// NOTE onVerification 不符合需求

/**
 * 由 APP 發起交易驗證功能，包含輸入網銀帳密、生物辨識、OTP...。
 * @param {Number} authCode 要求進行的驗證模式的代碼。
 * @param {String?} otpMobile 簡訊識別碼發送的手機門號。當綁定或變更門號時，因為需要確認手機號碼的正確性，所以要再驗OTP
 * @returns {Promise<{
 *  result: 驗證結果。
 *  message: 驗證失敗狀況描述。
 *  netbankPwd: 因為之後叫用交易相關 API 時可能會需要用到，所以傳回 E2EE 加密後的密碼。
 * }>}
 */
async function transactionAuth(authCode, otpMobile) {
  const data = {
    authCode,
    otpMobile,
  };
  // return await callAppJavaScript('transactionAuth', data, true, appTransactionAuth);

  // DEBUG 在 APP 還沒完成交易驗證之前，先用 Web版進行測試。
  const result = await appTransactionAuth(data);
  return result;
}

/**
 * 進行雙因子驗證，最多進行三次；若都失敗 或是 使用者取消，則傳回 false。
 * @param {*} authKey 建立授權驗證時傳回的金鑰，用來檢核使用者輸入。
 * @returns {
 *   result: 驗證結果(true/false)。
 *   message: 驗證失敗狀況描述。
 *   netbankPwd: 因為之後叫用交易相關 API 時可能會需要用到，所以傳回 E2EE 加密後的密碼。
 * }
 */
async function verifyBio(authCode) {
  const data = {
    authCode,
  };
  return await callAppJavaScript('chkQLfeature', data, true, () => ({ result: true })); // Call /v1/setBioResult
}

/**
 * 查詢快速登入綁定狀態
 * @returns {
 *  result: 驗證結果(true/false)。
 *  message: 駿證失敗狀況描述。
 *  QLStatus: 本裝置快速登入綁定狀態：(result為true時有值) 0：未綁定 1：已正常綁定 2：綁定但已鎖定 3：已在其它裝置綁定 4：本裝置已綁定其他帳號
 *  QLType: 快登裝置綁定所使用驗證方式(正常綁定狀態有值) (type->1:生物辨識/2:圖形辨識)
 * }
 */
async function getQLStatus() {
  return await callAppJavaScript('getQLStatus', null, true, () => {
    console.log('web 執行取得綁定狀態');
    return {
      result: 'true',
      QLStatus: '0',
    };
  });
}

/**
 * 設定快登認證資料
 * @param {*} QLtype 快登裝置綁定所使用驗證方式(type->1:生物辨識/2:圖形辨識)
 * @returns {
 *  result: 驗證結果(true/false)。
 *  message: 駿證失敗狀況描述。
 * }
 */
async function regQLfeature(QLtype) {
  const data = {
    QLtype,
  };
  return await callAppJavaScript('regQLfeature', data, true, () => {
    console.log('web 通知 APP 設定快登資料');
    return {
      result: 'true',
    };
  });
}

/**
 * 綁定快登裝置
 * @param {*} QLtype 快登裝置綁定所使用驗證方式(type->1:生物辨識/2:圖形辨識)
 * @param {*} pwdE2ee E2EE加密後的密碼
 * @param {*} midToken 由 Controller 提供的 MID Login 取得的 Auth Token
 * @returns {
 *  result: 驗證結果(true/false)。
 *  message: 駿證失敗狀況描述。
 * }
 */
async function regQL(QLtype, pwdE2ee) {
  const data = {
    QLtype,
    pwdE2ee,
  };
  return await callAppJavaScript('regQL', data, true, () => {
    console.log('web 通知 APP 綁定快登資料');
    return {
      result: 'true',
    };
  });
}

/**
 * 解除快登綁定
 * @param {*} delQL 快登裝置綁定所使用驗證方式(type->1:生物辨識/2:圖形辨識)
 * @returns {
 *  result: 驗證結果(true/false)。
 *  message: 駿證失敗狀況描述。
 * }
 */
async function delQL() {
  return await callAppJavaScript('delQL', null, true, () => {
    console.log('web 通知 APP 解除快登綁定');
    return {
      result: 'true',
    };
  });
}

/**
 * 模擬 APP 要求使用者進行交易授權驗證。
 * @param request {
 *   authCode: 要求進行的驗證模式的代碼。
 *   otpMobile: 簡訊識別碼發送的手機門號。當綁定或變更門號時，因為需要確認手機號碼的正確性，所以要再驗OTP
 * }
 * @returns { 要求進行驗證的來源 JavaScript 提供的 Callback JavaScript
 *     result: 驗證結果(true/false)
 *     message: 驗證失敗狀況描述。
 *     netbankPwd: 因為之後叫用交易相關 API 時可能會需要用到，所以傳回 E2EE 加密後的密碼。
 *   }
 */
async function appTransactionAuth(request) {
  const { authCode, otpMobile } = request;

  // 取得目前執行中的單元功能代碼，要求 Controller 發送或驗出時，皆需提供此參數。
  const funcCode = funcStack.peek()?.funcID ?? '/'; // 首頁因為沒有功能代碼，所以用'/'表示。
  // 取得需要使用者輸入驗證的項目。
  const authMode = await getTransactionAuthMode(authCode); // 要驗 2FA 還是密碼，要以 create 時的為準。
  const allowed2FA = (authMode & 0x01) !== 0; // 表示需要通過 生物辨識或圖形鎖 驗證。
  let allowedPWD = (authMode & 0x02) !== 0; // 表示需要通過 網銀密碼 驗證。
  const allowedOTP = (authMode & 0x04) !== 0; // 表示需要通過 OTP 驗證。

  const failResult = (message) => ({ result: false, message });

  // NOTE 沒有 boundMID，但又限定只能使用 2FA 時；傳回 false 尚未進行行動裝置綁定，無法使用此功能！
  if (!authMode || authMode === 0x00) { // 當 authMode 為 null 時，表示有例外發生。
    return failResult('尚未完成行動裝置綁定，無法使用此功能！');
  }

  // 建立交易授權驗證。
  const txnAuth = await createTransactionAuth({ // 傳回值包含發送簡訊的手機門號及簡訊識別碼。
    funcCode,
    authCode: authCode + 0x96c1fc6b98e00, // TODO 這個 HashCode 要由 Controller 在 Login 的 Response 傳回。
    otpMobile,
  });
  if (!txnAuth) { // createTransactionAuth 發生異常就結束。
    return failResult('無法建立交易授權驗證。');
  }

  // 進行雙因子驗證，呼叫 APP 進行驗證。
  if (allowed2FA) {
    const rs = await verifyBio(txnAuth.key); // 若生物辨識三次不通過 或是 使用者取消，才會傳回 false！
    // 因為已綁MID，所以 密碼 也可以當第二因子；因此改用密碼驗證。
    if (rs.result === false) allowedPWD = true;

    // NOTE 驗證成功(allowedPWD一定是false)但不用驗OTP，就直接傳回成功。
    //      若是驗證失敗或是還要驗OTP，就要開 Drawer 進行密碼或OTP驗證。
    if (!allowedPWD && !allowedOTP) return rs;
  }

  let result = null;
  const onFinished = (value) => { result = value; };

  const body = (
    // inputPWD 由 allowedPWD 暫時改為 true
    <PasswordDrawer funcCode={funcCode} authData={txnAuth} inputPWD onFinished={onFinished} />
  );

  await showDrawer('交易授權驗證 (Web版)', body, null, () => { result = failResult('使用者取消驗證。'); });

  return result;
}

export {
  goHome,
  startFunc,
  closeFunc,
  loadFuncParams,
  switchLoading,
  doOCR,
  showPopup,
  showAlert,
  getAesKey,
  syncJwtToken,
  getJwtToken,
  transactionAuth,
  shareMessage,
  getQLStatus,
  regQLfeature,
  regQL,
  delQL,
};
