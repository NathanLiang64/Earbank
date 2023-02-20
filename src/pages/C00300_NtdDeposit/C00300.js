/* eslint-disable no-use-before-define */
/* eslint-disable object-curly-newline */
import { useEffect, useReducer, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';

/* Elements */
import Layout from 'components/Layout/Layout';
import AccountOverview from 'components/AccountOverview/AccountOverview';
import DepositDetailPanel from 'components/DepositDetailPanel/depositDetailPanel';
import { FEIBInputLabel, FEIBInput } from 'components/elements';

/* Reducers & JS functions */
import { setWaittingVisible } from 'stores/reducers/ModalReducer';
import { customPopup } from 'utilities/MessageModal';
import { switchZhNumber, toCurrency } from 'utilities/Generator';
import { getAccountsList, getAccountBonus, updateAccount, cleanupAccount, getAccountInterest } from 'utilities/CacheData';
import { Func } from 'utilities/FuncID';
import { useNavigation, loadFuncParams } from 'hooks/useNavigation';
import ThreeColumnInfoPanel from 'components/ThreeColumnInfoPanel';
import { getTransactions, setAccountAlias } from './api';
import PageWrapper from './C00300.style';

/**
 * C00300 臺幣帳戶首頁
 */
const C00300 = () => {
  const dispatch = useDispatch();
  const { startFunc, closeFunc } = useNavigation();
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const { register, unregister, handleSubmit } = useForm();

  const [accounts, setAccounts] = useState();
  const [selectedAccountIdx, setSelectedAccountIdx] = useState();

  const selectedAccount = accounts ? accounts[selectedAccountIdx ?? 0] : null;

  // 優存(利率/利息)資訊 顯示模式（true.優惠利率, false.累積利息)
  const [showRate, setShowRate] = useState(true);

  /**
   * 頁面啟動，初始化
   */
  useEffect(() => {
    dispatch(setWaittingVisible(true));

    // 取得帳號基本資料，不含跨轉優惠次數，且餘額「非即時」。
    // NOTE 使用非同步方式更新畫面，一開始會先顯示帳戶基本資料，待取得跨轉等資訊時再更新一次畫面。
    getAccountsList('MC', async (items) => { // M=臺幣主帳戶、C=臺幣子帳戶
      items.forEach((item) => {
        item.balance = item.details[0].balance;
        item.currency = item.details[0].currency;
      });
      setAccounts(items);
      await processStartParams(items);
      dispatch(setWaittingVisible(false));
    });
    return () => setAccounts(null);
  }, []);

  /**
   * 處理 Function Controller 提供的啟動參數。
   * @param {[*]} accts
   */
  const processStartParams = async (accts) => {
    // startParams: {
    //   defaultAccount: 預設帳號
    //   showRate: 優存(利率/利息)資訊 顯示模式
    // }
    const startParams = await loadFuncParams();
    // 取得 Function Controller 提供的 keepData(model)
    if (startParams && (startParams instanceof Object)) {
      const index = accts.findIndex((acc) => acc.accountNo === startParams.defaultAccount);
      setSelectedAccountIdx(index);
      setShowRate(startParams.showRate);
    } else {
      setSelectedAccountIdx(0); // setSelectedAccountIdx 內傳入的值若於前值不同，會觸發再刷一次畫面

      /**
       * NOTE 清除交易明細的工作交給 Layout 的兩個功能 1. 回上頁 2. 回首頁
       * 1. 回上頁 => 觸發下方定義的 goBackFunc
       * 2. 返回首頁，會導向彩頁，WebView 被關閉 => redux 資料清空，不需要額外去清除交易明細 (除非 webview 沒被關閉，就需要特別處理)
       */

      // 只要是重新登入，而不是從呼叫的功能返回（例：轉帳），就清掉交易明細快取。
      // accts.forEach((acc) => {
      //   delete acc.isLoadingTxn; // 可能因為在載入中就關閉功能，而導致此旗標未被清除。但會有 Bug (race condition)，導致重複拿取交易紀錄
      //   delete acc.txnDetails;
      // });
      // forceUpdate(); // 因為在執行此方法前，已經先 setAccounts 輸出到畫面上了，所以需要再刷一次畫面。
    }
  };

  /**
   * 更新帳戶交易明細清單。
   * @returns 需有傳回明細清單供顯示。
  */
  const loadTransactions = (account) => {
    const { txnDetails } = account;
    if (!account.isLoadingTxn && !txnDetails) {
      account.isLoadingTxn = true; // 避免因為非同步執行造成的重覆下載
      // 取得帳戶交易明細（三年內的前25筆即可）
      getTransactions(account.accountNo).then((transData) => {
        const details = transData.acctTxDtls.slice(0, 10); // 最多只需保留 10筆。
        account.txnDetails = details;

        // 更新餘額。
        if (transData.acctTxDtls.length > 0) account.balance = details[0].balance;

        delete account.isLoadingTxn; // 載入完成才能清掉旗標！
        updateAccount(account);
        forceUpdate();
      });
    }
    return txnDetails;
  };

  /**
   * 下載 優存資訊
   */
  const loadExtraInfo = async (account) => {
    if (!account.bonus || !account.bonus.loading) {
      account.bonus = { loading: true };
      getAccountBonus(account.accountNo, (info) => {
        account.bonus = info; // info 已經不包含 loading 旗標
        forceUpdate();
      });
    }
  };

  /**
   * 下載利率/利息資訊
   */
  const loadInterest = async (account, index) => {
    if (!account.details[index].loading) {
      const { accountNo, currency} = account;
      account.details[index].loading = true;
      getAccountInterest({accountNo, currency}, (newDetail) => {
        account.details[index] = newDetail; // newDetail 已經不包含 loading 旗標
        forceUpdate();
      });
    }
  };

  /**
   * 顯示 優存(利率/利息)資訊
   */
  const renderBonusInfoPanel = () => {
    if (!selectedAccount) return null;

    const { bonus, acctType, currency, details } = selectedAccount;
    const dtlIndex = details.findIndex((dtl) => dtl.currency === currency);

    if (!bonus) loadExtraInfo(selectedAccount); // 下載 優存資訊
    const { freeWithdrawRemain = '-', freeTransferRemain = '-', bonusQuota } = bonus ?? {};

    if (details[dtlIndex] && !('interest' in details[dtlIndex])) loadInterest(selectedAccount, dtlIndex); // 下載 利率/利息資訊
    const {interest = '-', rate = '-'} = details[dtlIndex] ?? {};

    const panelContent = [
      {
        label: '免費跨提/轉',
        value: `${freeWithdrawRemain}/${freeTransferRemain}`,
        iconType: 'Arrow',
      },
      {
        label: showRate ? '目前利率' : '累積利息',
        value: showRate ? `${rate}%` : toCurrency(interest),
        iconType: 'switch',
        onClick: () => setShowRate(!showRate),
      },
      {
        label: '優惠利率額度',
        value: acctType === 'M' ? `${switchZhNumber(bonusQuota, false)}` : 0,
        iconType: acctType === 'M' ? 'Arrow' : undefined,
        onClick: acctType === 'M' ? () => handleFunctionClick('depositPlus') : undefined,
      },
    ];

    return (
      <div className="panel">
        <ThreeColumnInfoPanel content={panelContent} />
      </div>
    );
  };

  /**
   * 編輯帳戶名稱
   * @param {*} name 原始帳戶名稱
   */
  const showRenameDialog = async (name) => {
    // Note: 因為這個 Dialog 是動態產生的，所以一定要刪掉註冊的元件。
    //       否則，下次註冊將失效，而且持續傳回最後一次的輪入值，而不會改變。
    unregister('newName', { keepDirty: false });

    const body = (
      <>
        <FEIBInputLabel>新的帳戶名稱</FEIBInputLabel>
        <FEIBInput
          {...register('newName')}
          autoFocus
          inputProps={{ maxLength: 10, placeholder: '請設定此帳戶的專屬名稱', defaultValue: name, autoComplete: 'off' }}
        />
      </>
    );
    const onOk = (values) => {
      selectedAccount.alias = values.newName; // 變更卡片上的帳戶名稱
      setAccountAlias(selectedAccount.accountNo, selectedAccount.alias);
      forceUpdate();

      // NOTE 明細資料不需要存入Cache，下次進入C00300時才會更新。
      const newAccount = {...selectedAccount};
      delete newAccount.txnDetails;
      updateAccount(newAccount);
    };
    await customPopup('帳戶名稱編輯', body, handleSubmit(onOk));
  };

  /**
   * 執行指定的單元功能。
   * @param {*} funcCode 功能代碼
   */
  const handleFunctionClick = async (funcCode) => {
    let params = null;
    const keepData = { defaultAccount: selectedAccount.accountNo, showRate };
    switch (funcCode) {
      case 'moreTranscations': // 更多明細
        params = {
          ...selectedAccount, // 直接提供帳戶摘要資訊就不用再下載。
          cardColor: 'purple',
        };
        break;

      case Func.D001.id:
        params = { transOut: selectedAccount.accountNo };
        break;

      case Func.D003.id: // 無卡提款，只有母帳號才可以使用。 // TODO 帶參數過去
        params = { transOut: selectedAccount.accountNo };
        break;

      case Func.E001.id: // TODO 帶參數過去
        params = { transOut: selectedAccount.accountNo };
        break;

      case Func.C008.id: // 匯出存摺
        params = { accountNo: selectedAccount.accountNo };
        break;

      case Func.D008.id: // 預約轉帳查詢/取消
        params = { accountNo: selectedAccount.accountNo };
        break;

      case 'Rename': // 帳戶名稱編輯
        showRenameDialog(selectedAccount.alias);
        return;

      case 'depositPlus':
      default:
        break;
    }

    startFunc(funcCode, params, keepData);
  };

  const goBackFunc = () => {
    cleanupAccount();
    closeFunc();
  };

  /**
   * 頁面輸出
   */
  return (
    <Layout fid={Func.C003} title="臺幣活存" goBackFunc={goBackFunc}>
      <PageWrapper small>
        {selectedAccount
          ? (
            <>
              <AccountOverview
                accounts={accounts}
                defaultSlide={selectedAccountIdx}
                onAccountChanged={setSelectedAccountIdx}
                onFunctionClick={handleFunctionClick}
                cardColor="purple"
                funcList={[
                  { fid: Func.D001.id, title: '轉帳' },
                  { fid: Func.E001.id, title: '換匯' },
                  { fid: Func.D003.id, title: '無卡提款', hidden: (selectedAccount.acctType !== 'M') },
                ]}
                moreFuncs={[
                  // { fid: null, title: '定存', icon: 'fixedDeposit', enabled: false }, // TODO: 此階段隱藏
                  { fid: Func.D008.id, title: '預約轉帳查詢/取消', icon: 'reserve' },
                  { fid: Func.C008.id, title: '匯出存摺', icon: 'coverDownload' },
                  { fid: 'Rename', title: '帳戶名稱編輯', icon: 'edit' },
                ]}
              />

              {/* 顯示 優惠利率資訊面版 */}
              { renderBonusInfoPanel() }

              <DepositDetailPanel
                details={loadTransactions(selectedAccount)}
                onMoreFuncClick={() => handleFunctionClick('moreTranscations')}
              />
            </>
          ) : null}
      </PageWrapper>
    </Layout>
  );
};

export default C00300;
