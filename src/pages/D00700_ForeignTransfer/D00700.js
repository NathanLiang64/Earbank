/* eslint-disable object-curly-newline */
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { setWaittingVisible } from 'stores/reducers/ModalReducer';
import { loadFuncParams } from 'hooks/useNavigation';
import { Func } from 'utilities/FuncID';
import { getCurrenyInfo } from 'utilities/Generator';
import { getAccountsList } from 'utilities/CacheData';

/* Elements */
import Accordion from 'components/Accordion';
import Layout from 'components/Layout/Layout';
import { FEIBButton } from 'components/elements';
import AccountOverview from 'components/AccountOverview/AccountOverview';
import { CurrencyInputField, DropdownField, TextInputField } from 'components/Fields';

/* Styles */
import NoteContent from './noteContent';
import { getAgreedAccount, getExchangePropertyList } from './api';
import ForeignCurrencyTransferWrapper from './D00700.style';

/**
 * D00700 外幣轉帳首頁
 * @param {{location: {state: {viewModel, model}}}} props
 */
const D00700 = (props) => {
  const { location: {state} } = props;
  const history = useHistory();
  const dispatch = useDispatch();

  // ViewModel
  const [viewModel, setViewModel] = useState({
    inAccounts: [{ label: '請選擇轉入帳號', value: '*', disabledOption: true }], // 可轉入的外幣帳號清單
    properties: [{ label: '請選擇匯款性質', value: '*', disabledOption: true }], // 外幣匯款性質清單
    outAccount: null, // 轉出帳號(詳細資訊)
    inAccount: null, // 轉入帳號(詳細資訊)
    currency: null, // 轉帳幣別(詳細資訊)
    amount: null, // 轉帳金額
    currencyList: [],
  });

  // 資料驗證
  const schema = yup.object().shape({
    inAccount: yup.string().required('請選擇轉入帳號').test('emptyAccount', '請選擇轉入帳號', (type) => type !== '*'),
    amount: yup.number().moreThan(0, '請輸入轉帳金額').when('currency', (currency, s) => {
      const {balance} = viewModel.currencyList.find((item) => item.currency === currency);
      return s.max(balance, '轉出金額不得高於帳戶餘額');
    }).required('請輸入轉帳金額')
      .typeError('請輸入轉帳金額'),
    property: yup.string().required('請選擇匯款性質').test('emptyType', '請選擇匯款性質', (type) => type !== '*'),
  });

  const { handleSubmit, control, reset, setValue } = useForm({
    resolver: yupResolver(schema),
    // Model
    defaultValues: {
      outAccount: '', // 轉出帳號
      inAccount: '*', // 轉入帳號
      currency: '', // 轉帳幣別
      amount: '', // 轉帳金額
      property: '*', // 性質別
      memo: '', // 備註
    },
  });

  const processStartParams = async (accountNo, currencyList) => {
    // TODO 如果回傳的列表是空值，提示使用者沒有可轉入的帳號
    // 取得約定轉入帳號列表，並且只篩選出「遠銀」且為「外幣」的帳戶
    const agreedAccounts = await getAgreedAccount(accountNo);
    const foreignAgreedAccts = agreedAccounts.filter((acct) => acct.isForeign && acct.bankId === '805');
    const options = foreignAgreedAccts.map(({ acctId }) => ({ label: acctId, value: acctId }));
    const inAccounts = [...viewModel.inAccounts, ...options];

    // 預設的幣別
    let {currency} = currencyList[0];
    const params = await loadFuncParams();
    if (params) currency = currencyList.find((acct) => acct.currency === params.currency).currency;

    return { currency, inAccounts };
  };

  // 取得帳戶清單
  const getForeignCurrencyAccounts = async () => {
    dispatch(setWaittingVisible(true));

    // 取得帳號基本資料，不含跨轉優惠次數，且餘額「非即時」。
    getAccountsList('F', async (accts) => {
      const { details, ...restDetails } = accts[0];
      const outAccount = accts[0].accountNo;
      const currencyList = details.map((detail) => ({ ...restDetails, ...detail })); // By 幣別的卡片列表

      // 重設 viewModel
      const vModel = state?.viewModel || await processStartParams(outAccount, currencyList);
      setViewModel((vm) => ({ ...vm, currencyList, ...vModel }));

      // 重設 model
      const model = state?.model || {outAccount};
      reset((formValues) => ({ ...formValues, ...model }));

      dispatch(setWaittingVisible(false));
    });
  };

  // 取得交易性質
  const getTransTypeOptions = async () => {
    if (state && state.viewModel) return;
    const exchangePropertyList = await getExchangePropertyList({ trnsType: 3 });
    const opts = exchangePropertyList.map((option) => ({ label: option.leglDesc, value: option.leglCode }));
    setViewModel((vm) => ({ ...vm, properties: [...vm.properties, ...opts] }));
  };

  const onSubmit = (values) => {
    // {outAccount, inAccount, currency, amount, property, memo} = values;
    history.push('/D007001', {model: values, viewModel});
  };

  const onAccountChanged = (index) => {
    setViewModel((vm) => ({ ...vm, currency: viewModel.currencyList[index].currency }));
    setValue('currency', viewModel.currencyList[index].currency);
  };

  useEffect(() => {
    getForeignCurrencyAccounts();
    getTransTypeOptions();
  }, []);

  const { currencyList, currency, inAccounts, properties } = viewModel;
  return (
    <Layout fid={Func.D007} title="轉帳">
      <ForeignCurrencyTransferWrapper>
        <AccountOverview
          transferMode
          showFreeTransferInfo={false}
          accounts={currencyList}
          defaultSlide={currencyList.findIndex((item) => item.currency === currency)}
          onAccountChanged={onAccountChanged}
        />
        <div className="formContainer">
          <div className="formTitle">本行同幣別外幣轉帳</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div>
              <DropdownField name="inAccount" labelName="帳號" control={control} options={inAccounts} />
            </div>

            <div>
              <CurrencyInputField
                name="amount"
                symbol={currency ? getCurrenyInfo(currency).symbol : '$'}
                control={control}
                labelName="金額"
                inputProps={{ inputMode: 'numeric', placeholder: '請輸入金額' }}
              />
            </div>

            <div>
              <DropdownField name="property" labelName="匯款性質" control={control} options={properties} />
            </div>

            <div>
              <TextInputField name="memo" labelName="備註" control={control} />
            </div>

            <Accordion><NoteContent /></Accordion>
            <FEIBButton type="submit">轉帳</FEIBButton>
            <div className="warnText">轉帳前多思考，避免被騙更苦惱</div>
          </form>
        </div>
      </ForeignCurrencyTransferWrapper>
    </Layout>
  );
};

export default D00700;
