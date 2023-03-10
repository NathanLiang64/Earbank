/* eslint-disable no-use-before-define */
import { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { toCurrency } from 'utilities/Generator';

import Layout from 'components/Layout/Layout';
import InformationList from 'components/InformationList';
import { DropdownField, TextInputField, RadioGroupField } from 'components/Fields';
import { FEIBButton } from 'components/elements';

import { EditRecordFormWrapper } from './RecordDetail.style';
import { typeOptions } from '../utils/usgeType';

const EditRecordForm = () => {
  const history = useHistory();
  const { state } = useLocation();

  const [notRecordedMode, setNotRecordedMode] = useState('0'); // 0: 選擇銷帳對象, 1: 自行編輯交易明細
  const [recordTargetList, setRecordTargetList] = useState([]);

  const notRecordedModeOptions = [
    {
      value: '0',
      label: '選擇銷帳對象',
    },
    {
      value: '1',
      label: '自行編輯交易明細',
    },
  ];

  // form: Recorded, notRecorded.1
  const {control, getValues: getInfoValues} = useForm({
    defaultValues: {
      type: '1',
      memo: '',
    },
  });

  // form: notRecorded mode
  const {control: notRecordedControl, watch} = useForm({
    defaultValues: {
      mode: '0',
    },
  });

  // from: notRecorded - select record target
  const {control: recordTargetControl, reset, getValues: getTargetValues} = useForm({
    defaultValues: {
      target: '',
    },
  });

  const onNotRecordedModeChange = () => {
    const watchValue = watch((value) => setNotRecordedMode(value.mode));
    return () => watchValue.unsubscribe();
  };

  const renderInformationContent = (title, info) => <InformationList title={title} content={info} />;

  const renderFormContent = () => (
    <form className="edit_form" onSubmit={() => onSubmit()}>
      <DropdownField labelName="性質" options={typeOptions} name="type" control={control} />
      <TextInputField labelName="備註" type="text" control={control} name="memo" inputProps={{placeholder: '備註'}} />
    </form>
  );

  const onSubmit = () => {
    console.log({
      txStatus: state.txStatus,
      notRecordedMode,
    });

    if (state.txStatus === 1 || (state.txStatus === 2 && notRecordedMode === '1')) {
      const value = getInfoValues();
      console.log('info value', {value});
    } else {
      const value = getTargetValues();
      console.log('target value', {value});
    }
    goBackFunc();
  };

  const goBackFunc = () => history.goBack();

  /* 未入帳－銷帳對象清單 */
  useEffect(() => {
    const response = [
      {
        date: '20220101',
        member: 'AAA',
        memberId: '001',
        amount: '1000',
        memo: 'AA',
      },
      {
        date: '20220101',
        member: 'BBB',
        memberId: '002',
        amount: '1000',
        memo: 'AA',
      },
    ]; // DEBUG mock data, api?

    const targetList = response.map((item) => ({
      value: item.memberId,
      label: `${item.date} ${item.member} ${item.amount} ${item.memo}`,
    }));

    setRecordTargetList(targetList);

    reset(() => ({
      target: targetList[0].value,
    }));
  }, []);

  return (
    <Layout title="編輯交易明細" goBackFunc={goBackFunc}>
      <EditRecordFormWrapper>
        {console.log(state)}
        <div className="info">
          {renderInformationContent('交易日期', state.txDate)}
          {renderInformationContent('轉出成員', state.memberNickName ?? '--')}
          {renderInformationContent('銀行代號', state.bankCode)}
          {renderInformationContent('轉出帳號', state.bankAccount)}
          {renderInformationContent('轉出金額', `NTD${toCurrency(state.txAmount)}`)}
        </div>

        {/* 已入帳 */}
        {state.txStatus === 1 && renderFormContent()}

        {/* 未入帳 */}
        {state.txStatus === 2 && (
          <div>
            <RadioGroupField
              labelName=""
              name="mode"
              control={notRecordedControl}
              options={notRecordedModeOptions}
              onChange={onNotRecordedModeChange}
            />
            <div className="record_target_list">
              {console.log({notRecordedMode})}
              {/* NOTE 若無可銷帳對象，則預設選取自行編輯交易明細 */}
              {(notRecordedMode === '0' && recordTargetList.length !== 0) ? <RadioGroupField labelName="" name="target" control={recordTargetControl} options={recordTargetList} /> : renderFormContent()}
            </div>
          </div>
        )}
        <p className="meta_info">明細只能編輯一次呦！</p>
        <FEIBButton onClick={onSubmit}>確認</FEIBButton>
      </EditRecordFormWrapper>
    </Layout>
  );
};

export default EditRecordForm;
