import { useState } from 'react';
import { useHistory } from 'react-router';

import Layout from 'components/Layout/Layout';
import { FEIBButton } from 'components/elements';
import { transactionAuth } from 'utilities/AppScriptProxy';
import { cancelReserveTransfer } from 'pages/D00800_ReserveTransferSearch/api';

import { AuthCode } from 'utilities/TxnAuthCode';
import { useDispatch } from 'react-redux';
import { setDrawerVisible, setWaittingVisible } from 'stores/reducers/ModalReducer';
import { useNavigation } from 'hooks/useNavigation';
import SuccessFailureAnimations from 'components/SuccessFailureAnimations';
import { FuncID } from 'utilities/FuncID';
import { AddMemberIcon } from 'assets/images/icons';
import { showDrawer, showInfo } from 'utilities/MessageModal';
import AccountEditor from 'pages/D00500_FrequentContacts/D00500_AccountEditor';
import { addFrequentAccount } from 'pages/D00500_FrequentContacts/api';
import { renderFooter, renderHeader, renderBody} from './utils';
import { ReserveTransferSearchWrapper } from './D00800.style';

const ReserveTransferSearch1 = ({ location }) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const {closeFunc} = useNavigation();
  const [cancelResult, setCancelResult] = useState();
  const goBack = () => history.goBack();

  const onConfirmHandler = async () => {
    if (!cancelResult) {
      // 執行取消預約轉帳
      dispatch(setWaittingVisible(true));
      const {result} = await transactionAuth(AuthCode.D00800);
      if (result) {
        const {
          reserveData: {
            // 只帶 API 需要參數
            txCd, bankName, dscpt1, periodic, ...param
          },
        } = location.state;
        const res = await cancelReserveTransfer(param);
        // 基本上若 code!=='0000' 的情況下，底層就會跳出錯誤
        setCancelResult(res);
      }
      dispatch(setWaittingVisible(false));
    } else {
      // 已經執行過取消，導向子首頁
      history.push(FuncID.D00800);
    }
  };
  const showExistedInfo = async () => {
    const message = '這個帳號已加入您的常用帳號名單中嚕！';
    await showInfo(message, () => dispatch(setDrawerVisible(false)));
  };

  const createRepeatableAccount = async () => {
    const onFinished = async (newAcct) => {
      dispatch(setWaittingVisible(true));
      const freqAccts = await addFrequentAccount(newAcct);
      dispatch(setWaittingVisible(false));
      // 如果新增已存在的帳號，freqAccts 會是 null
      if (freqAccts) showExistedInfo();
    };

    // 給 AccountEditor 預設值，且直接進到設定暱稱。
    const acctData = {
      bankId: location.state.reserveData.receiveBank, // '常用轉入帳戶-銀行代碼',
      acctId: location.state.reserveData.receiveAccountNo, // '常用轉入帳戶-帳號',
      nickName: '',
    };

    await showDrawer(
      '新增常用帳號',
      <AccountEditor initData={acctData} onFinished={onFinished} />,
    );
  };

  if (!location.state) closeFunc();
  const {reserveData, selectedAccount} = location.state;
  console.log('reserveData', reserveData);
  return (
    <Layout title="取消預約轉帳" goBackFunc={goBack}>
      <ReserveTransferSearchWrapper>
        {!!cancelResult && (
          <SuccessFailureAnimations
            isSuccess={cancelResult.isSuccess}
            successTitle="設定成功"
            errorTitle="設定失敗"
            errorDesc={cancelResult.message}
          />
        )}
        {/* 當尚未執行取消或是取消成功的情況下才顯示 */}
        {(!cancelResult || cancelResult.isSuccess) && (
          <>
            <section className="confrimDataContainer">
              {renderHeader(reserveData)}
              {cancelResult?.isSuccess && (
              <button type="button">
                <AddMemberIcon />
                <span onClick={createRepeatableAccount}>加入常用轉帳</span>
              </button>
              )}
            </section>
            <section className="informationListContainer">
              {renderBody(reserveData, selectedAccount)}
            </section>
            <section className="accordionContainer">
              {renderFooter(reserveData, selectedAccount)}
            </section>
          </>
        )}

        <FEIBButton className="buttonContainer" onClick={onConfirmHandler}>
          {cancelResult ? '確認' : '確認取消'}
        </FEIBButton>
      </ReserveTransferSearchWrapper>
    </Layout>
  );
};

export default ReserveTransferSearch1;
