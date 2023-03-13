import { useState, useEffect, useRef} from 'react';
import { useHistory, useLocation } from 'react-router';
import uuid from 'react-uuid';

import Layout from 'components/Layout/Layout';
import { MainScrollWrapper } from 'components/Layout';
import SuccessFailureAnimations from 'components/SuccessFailureAnimations';
import InformationList from 'components/InformationList';
import { FEIBButton } from 'components/elements';
import {
  currencySymbolGenerator,
  accountFormatter,
  dateToString,
  weekNumberToChinese,
} from 'utilities/Generator';
import { transactionAuth } from 'utilities/AppScriptProxy';

import { showAnimationModal } from 'utilities/MessageModal';
import { Func } from 'utilities/FuncID';
import { useNavigation } from 'hooks/useNavigation';
import { useDispatch } from 'react-redux';
import { setWaittingVisible } from 'stores/reducers/ModalReducer';
import { createConfirm, createDepositPlan, updateDepositPlan } from './api';
import { AlertInvalidEntry, ConfirmToTransferSubAccountBalance } from './utils/prompts';
import { DetailPageWrapper } from './C00600.style';

/**
 * C00600 存錢計畫 資訊頁
 */
const DepositPlanDetailPage = () => {
  const history = useHistory();
  const {startFunc, closeFunc, goHome} = useNavigation();
  const {state} = useLocation();
  const dispatch = useDispatch();
  const mainRef = useRef();
  const [mode, setMode] = useState(0); // 0=資訊模式(已建立) 1=確認模式（未建立) 2=已建立成功(剛建立完成)
  const [plan, setPlan] = useState();
  const [program, setProgram] = useState();

  useEffect(() => {
    if (state && ('isConfirmMode' in state)) {
      // 資訊頁有二種使用情境：確認新增存錢計畫、閱覽存錢計畫資訊。
      if (state.isConfirmMode) {
        // 設定成 (新增) 確認模式
        setMode(1);
        setProgram(state.payload);
      } else {
        // 設定成 (已建立) 資訊模式
        setMode(0);
        setPlan(state.plan);
      }
    } else {
      // Guard: 此頁面接續上一頁的操作，意指若未在該情況下進入此頁為不正常操作。
      AlertInvalidEntry({ goBack: () => history.goBack(), goHome });
    }
  }, []);

  const handleImageUpload = async (planId) => {
    const payload = {
      planId,
      image: sessionStorage.getItem('C00600-hero'),
    };

    await updateDepositPlan(payload);

    sessionStorage.removeItem('C00600-hero'); // 清除暫存背景圖。
  };

  const handleCreate = async () => {
    const {extra, goalAmount, ...payload} = program;
    // Step 1. 執行 存錢計畫建立
    const response = await createDepositPlan(payload);
    if (!response?.result) return;

    // Step 2. 再執行 transactionAuth
    const auth = await transactionAuth(Func.C006.authCode); // 需通過 2FA 或 網銀密碼 驗證才能建立計劃。
    if (!auth.result) return;

    // Step 3. 成功後再執行 createConfirm
    dispatch(setWaittingVisible(true));
    const {result, tfrResult, message} = await createConfirm(response.planId);
    dispatch(setWaittingVisible(false));

    if (result) {
      // 驗證成功之後，若 imageId=0 再上傳自訂的影像。
      if (payload.imageId === 0) await handleImageUpload(response.planId);
      setMode(2);// 設定成 成功建立模式
      setProgram((prevProgram) => ({...prevProgram, tfrResult}));
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth'});// 建立成功後，將頁面滑至上方。
    } else {
      showAnimationModal({
        isSuccess: false,
        errorTitle: '設定失敗',
        errorDesc: message,
        onClose: () => closeFunc(),
      });
    }
  };

  const handleConfirm = async () => {
    if (program.currentBalance > 0) {
      // 如果所選的子帳戶有餘額，要提示用戶自動轉帳。
      ConfirmToTransferSubAccountBalance({ onOk: () => startFunc(Func.D001.id, {transOut: program.bindAccountNo}), onCancel: () => {} });
    } else {
      handleCreate();
    }
  };

  const renderModeTimingString = (p) => p && (p.cycleMode === 1 ? `每週${weekNumberToChinese(p.cycleTiming === 0 ? 7 : p.cycleTiming)}` : `每月${p.cycleTiming}號`);

  const renderListItem = (list) => list.map((l) => (
    <InformationList
      key={uuid()}
      title={l.label}
      content={l.value}
      caption={l.caption}
      remark={l.next}
      extra={typeof l.extra === 'function' && l.extra()}
    />
  ));

  const renderProgramDetails = () => {
    const list = [
      { label: '存錢計畫名稱', value: program?.name },
      { label: '適用利率', value: `${program?.extra.rate}%` },
      { label: '存錢目標', value: currencySymbolGenerator('NTD', program?.goalAmount, true) },
      { label: '計畫期間', value: program?.extra.period },
      {
        type: 'extra',
        label: '第一筆扣款日',
        value: dateToString(program?.startDate),
        caption: '下一筆扣款日',
        next: program?.extra.nextDeductionDate,
        // eslint-disable-next-line no-nested-ternary
        extra: () => (mode === 2 && typeof program.tfrResult === 'boolean'
          ? program.tfrResult ? '扣款成功' : '扣款失敗'
          : undefined),
      },
      { label: '存錢帳號', value: program?.bindAccountNo ? accountFormatter(program?.bindAccountNo, true) : '加開子帳戶' },
    ];
    return renderListItem(list);
  };

  const renderPlanDetails = () => {
    const list = [
      { label: '存錢計畫名稱', value: plan?.name },
      { label: '存錢計畫之帳號', value: accountFormatter(plan?.bindAccountNo, true) },
      { label: '存錢計畫起始日', value: dateToString(plan?.startDate) },
      { label: '存錢計畫到期日', value: dateToString(plan?.endDate) },
      { label: '存錢週期', value: renderModeTimingString(plan) },
      { label: '第一筆扣款日', value: dateToString(plan?.startDate) },
      { label: '目標金額', value: currencySymbolGenerator('NTD', plan?.goalAmount, true) },
      { label: '每期存款金額', value: currencySymbolGenerator('NTD', plan?.amount, true) },
      { label: '利率', value: `${plan?.progInfo.rate}% (牌告+計畫加碼利率)` },
      { label: '累積存款金額', value: currencySymbolGenerator('NTD', plan?.currentBalance, true) },
    ];
    return renderListItem(list);
  };

  const renderTitle = () => {
    switch (mode) {
      case 0:
        return '存款計劃資訊';
      case 1:
        return '存款計劃確認';
      case 2:
      default:
        return '存款計劃設定結果';
    }
  };

  const goBack = () => history.replace(mode === 1 ? 'C006003' : 'C00600', state);
  return (
    <Layout title={renderTitle()} fid={Func.C006} goBackFunc={goBack}>
      <MainScrollWrapper ref={mainRef}>
        <DetailPageWrapper>
          { mode > 0 && (
            <div className="px-4">
              { mode === 2 && <SuccessFailureAnimations isSuccess successTitle="設定成功" /> }
              <div className="info">
                <div>存錢金額與週期</div>
                <div className="text-primary text-lg balance">{currencySymbolGenerator('NTD', program?.amount, true)}</div>
                <div className="text-primary text-lg">{renderModeTimingString(program)}</div>
                <div className="text-primary">從主帳戶自動扣款</div>
              </div>
            </div>
          )}
          <hr />
          <div className="px-4 list">
            { mode > 0 ? renderProgramDetails() : renderPlanDetails() }
          </div>
          <div className="px-4">
            { mode === 0 && <FEIBButton onClick={() => history.push('/C006005', state)}>編輯</FEIBButton> }
            { mode === 1 && <FEIBButton onClick={handleConfirm}>確認</FEIBButton> }
            { mode === 2 && <FEIBButton onClick={() => history.push('/C00600')}>回存錢計畫首頁</FEIBButton> }
          </div>
        </DetailPageWrapper>
      </MainScrollWrapper>
    </Layout>
  );
};

export default DepositPlanDetailPage;
