import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import Layout from 'components/Layout/Layout';
import {
  showDrawer, closeDrawer, showCustomPrompt, showAnimationModal,
} from 'utilities/MessageModal';
import { closeFunc, switchLoading, transactionAuth } from 'utilities/AppScriptProxy';
import { accountFormatter } from 'utilities/Generator';

/* Elements */
import {
  FEIBInputLabel,
  FEIBSelect,
  FEIBOption,
  FEIBButton,
  FEIBErrorMessage,
} from 'components/elements';
import AddNewItem from 'components/AddNewItem';
import SettingItem from 'components/SettingItem';
import Accordion from 'components/Accordion';
import AccordionContent from './accordionContent';
import { getAutoDebits, setAutoDebit, getAccountsList } from './api';

/* Styles */
import AutomaticBillPaymentWrapper from './automaticBillPayment.style';

const AutomaticBillPayment = () => {
  const [appliedAutoBill, setAppliedAutoBill] = useState([]);
  const [accountsList, setAccountList] = useState([]);

  /**
   *- 資料驗證
   */
  const schema = yup.object().shape({
    account: yup
      .string()
      .required('請選擇扣款帳號'),
    isFullPay: yup
      .string()
      .required('請選擇扣款方式'),
  });
  const {
    handleSubmit, control, formState: { errors }, setValue,
  } = useForm({
    resolver: yupResolver(schema),
  });

  // 取得帳號清單
  const getAccountsArray = async () => {
    const response = await getAccountsList();
    if (response) {
      const data = response.map((item) => item.account);
      setAccountList(data);
      setValue('account', data[0]);
    }
  };

  // 查詢自動扣繳資訊
  const getAutoDebitData = async () => {
    switchLoading(true);
    const response = await getAutoDebits({});
    switchLoading(false);
    if (response?.code === '0000') {
      setAppliedAutoBill(response.data);
    } else {
      showCustomPrompt({ message: response?.message || '發生錯誤，無法取得自動扣繳資訊', onOk: () => closeFunc(), onClose: () => closeFunc() });
    }
  };

  // 產生狀態
  const renderStatusText = (status) => {
    switch (status) {
      case '1':
        return '申請';
      case '2':
        return '生效';
      case '3':
        return '取消';
      case '4':
        return '退件';
      case '5':
        return '待生效';
      default:
        return '';
    }
  };

  const handleCloseDrawer = () => {
    closeDrawer();
  };

  const deleteAutoBillPay = () => {
  };

  const onSubmit = async (data) => {
    const param = {
      ...data,
      bank: '805',
    };
    const authCode = 0x30;
    const jsRs = await transactionAuth(authCode);
    if (jsRs.result) {
      switchLoading(true);
      const response = await setAutoDebit(param);
      showAnimationModal({
        isSuccess: response?.code === '0000',
        successTitle: '設定成功',
        successDesc: '',
        errorTitle: '設定失敗',
        errorCode: '',
        errorDesc: response.message,
      });
      handleCloseDrawer();
    }
  };

  useEffect(() => {
    getAutoDebitData();
    getAccountsArray();
  }, []);

  const AddForm = () => (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="drawerContainer"
    >
      <FEIBInputLabel>扣款帳號</FEIBInputLabel>
      <Controller
        name="account"
        control={control}
        render={({ field }) => (
          <FEIBSelect
            {...field}
            id="account"
            name="account"
            error={!!errors.account}
          >
            {
              accountsList.map((item) => (
                <FEIBOption key={item} value={item}>{item}</FEIBOption>
              ))
            }
          </FEIBSelect>
        )}
      />
      <FEIBErrorMessage>{errors.account?.message}</FEIBErrorMessage>
      <FEIBInputLabel>扣款方式</FEIBInputLabel>
      <Controller
        name="isFullPay"
        defaultValue="Y"
        control={control}
        render={({ field }) => (
          <FEIBSelect
            {...field}
            id="isFullPay"
            name="isFullPay"
            error={!!errors.type}
          >
            <FEIBOption value="Y">應繳總金額</FEIBOption>
            <FEIBOption value="N">最低應繳金額</FEIBOption>
          </FEIBSelect>
        )}
      />
      <FEIBButton type="submit">同意條款並送出</FEIBButton>
    </form>
  );

  const addAutoBillPay = () => {
    showDrawer(
      '新增自動扣繳',
      (<AddForm />),
    );
  };

  // const editAutoBillPay = () => {
  //   showDrawer(
  //     '編輯自動扣繳',
  //     renderForm(),
  //   );
  // };

  const renderAppliedAutoBill = () => appliedAutoBill.map((item) => (
    <SettingItem
      key={item.account}
      mainLable={accountFormatter(item.account)}
      subLabel={`扣款方式：${item.isFullPay === '100' ? '應繳總金額' : '最低應繳金額'} | 狀態：${renderStatusText(item.status)}`}
      // editClick={editAutoBillPay}
      deleteClick={deleteAutoBillPay}
    />
  ));

  return (
    <Layout title="自動扣繳申請/查詢">
      <AutomaticBillPaymentWrapper>
        <section>
          <AddNewItem onClick={addAutoBillPay} addLabel="新增自動扣繳" />
        </section>
        <section className="billBlock">
          <div className="blockTitle">您已申辦自動扣繳區</div>
          {
            appliedAutoBill.length > 0
              ? renderAppliedAutoBill() : (<div className="item noData">查無資料</div>)
          }
        </section>
        <Accordion space="both">
          <AccordionContent />
        </Accordion>
      </AutomaticBillPaymentWrapper>
    </Layout>
  );
};

export default AutomaticBillPayment;
