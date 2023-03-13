import { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Theme from 'themes/theme';
import Layout from 'components/Layout/Layout';
import { MainScrollWrapper } from 'components/Layout';
import { FEIBButton, FEIBHintMessage } from 'components/elements';
import { CurrencyInputField, DropdownField, TextInputField } from 'components/Fields';
import { toCurrency, dateToYMD, dateToString } from 'utilities/Generator';
import { showPrompt } from 'utilities/MessageModal';
import { getDurationTuple} from './utils/common';
import {
  generatebindAccountNoOptions, generateCycleModeOptions, generateCycleTimingOptions, generateMonthOptions,
} from './utils/options';
import HeroWithEdit from './components/HeroWithEdit';
import { EditPageWrapper } from './C00600.style';
import { generateEditSchema } from './validationSchema';

/**
 * C00600 存錢計畫 (新增) 編輯頁
 */
const DepositPlanEditPage = () => {
  const history = useHistory();
  const {state} = useLocation();
  const {
    control, handleSubmit, watch, reset, setValue,
  } = useForm({
    defaultValues: {
      name: '',
      cycleDuration: 4,
      cycleMode: 2,
      cycleTiming: '',
      amount: '',
      bindAccountNo: '',
      imageId: '',
    },
    resolver: yupResolver(generateEditSchema(state?.program)),
  });
  const {
    cycleDuration, cycleMode, amount, bindAccountNo, imageId,
  } = watch();

  const getDefaultCycleTiming = () => {
    const date = new Date().getDate();
    return date < 28 ? date : 28;
  };

  const getGoalAmount = (cycleAmount, cycle, mode) => {
    const duration = mode === 1 ? 4 : 1;
    return parseInt(cycleAmount, 10) * cycle * duration;
  };

  const getRemainingBalance = (accountNo) => state?.subAccounts?.find((a) => a.accountNo === accountNo)?.balance ?? 0;

  const onSubmit = (data) => {
    const date = getDurationTuple(new Date(), data.cycleDuration, data.cycleMode, data.cycleTiming);
    const {code, rate} = state.program;
    if (typeof data.imageId !== 'number') {
      showPrompt(<p className="txtCenter">請選擇圖片</p>);
      return;
    }
    const payload = {
      // =====建立存錢計畫所需參數=====
      progCode: code,
      imageId: data.imageId,
      name: data.name,
      startDate: dateToYMD(date.begin),
      endDate: dateToYMD(date.end),
      cycleMode: data.cycleMode,
      cycleTiming: data.cycleTiming,
      amount: data.amount,
      bindAccountNo: data.bindAccountNo === 'new' ? null : data.bindAccountNo,
      currentBalance: getRemainingBalance(data.bindAccountNo),
      // =====渲染需求參數=====
      goalAmount: getGoalAmount(data.amount, data.cycleDuration, data.cycleMode),
      extra: {
        rate,
        period: `${dateToString(new Date())} ~ ${dateToString(date.end)}`,
        nextDeductionDate: dateToString(date.next),
      },
    };
    history.push('/C006004', {...state, isConfirmMode: true, payload });
  };

  useEffect(() => {
    // 如果是專案型計畫，將資料傳入 form 中
    const isProjectType = !!state.program.type;
    // 如果是從 C006004 導向回來，將 payload 帶入
    const {payload} = state;
    // eslint-disable-next-line no-nested-ternary
    const projectName = payload ? payload.name : isProjectType ? state.program.name : '';
    reset((formValues) => ({
      ...formValues,
      name: projectName,
      cycleDuration: isProjectType ? state.program.period : 4,
      cycleMode: 2,
      cycleTiming: getDefaultCycleTiming(),
      amount: payload ? payload.amount : '',
      bindAccountNo: payload ? payload.bindAccountNo ?? 'new' : '',
      imageId: payload ? payload.imageId : '',
    }));
  }, []);

  const {
    program, subAccounts, hasReachedMaxSubAccounts, depositPlans,
  } = state;
  const disabled = !!program.type; // 若是專案型 (!==0)，特定欄位是固定值，不給使用者選擇
  const disabledColor = disabled ? Theme.colors.text.dark : '';

  return (
    <Layout title="新增存錢計畫" hasClearHeader goBackFunc={() => history.replace('C006002', {depositPlans})}>
      <MainScrollWrapper>
        <EditPageWrapper>
          <form onSubmit={handleSubmit(onSubmit)}>
            <HeroWithEdit imageId={imageId} onChange={(id) => setValue('imageId', id)} />

            <div className="flex">

              <TextInputField
                name="name"
                control={control}
                labelName={`${program.type ? '計畫名稱' : '為你的計畫命名吧'}`}
                inputProps={{ maxLength: 7, placeholder: '請輸入7個以內的中英文字、數字或符號', disabled }}
                $color={disabledColor}
              />

              <DropdownField
                options={generateMonthOptions()}
                name="cycleDuration"
                control={control}
                labelName="預計存錢區間"
                inputProps={{disabled}}
                $color={disabledColor}
              />

              <div className="col-2">
                <div className="w-50">
                  <DropdownField
                    options={generateCycleModeOptions()}
                    name="cycleMode"
                    control={control}
                    labelName="存錢頻率"
                    inputProps={{disabled}}
                    $color={disabledColor}
                  />
                </div>
                <div className="w-50">
                  <DropdownField
                    options={generateCycleTimingOptions(cycleMode)}
                    name="cycleTiming"
                    control={control}
                    labelName="日期"
                    inputProps={{disabled}}
                    $color={disabledColor}
                  />
                  <FEIBHintMessage>
                    共
                    {cycleDuration * (cycleMode === 1 ? 4 : 1)}
                    次
                  </FEIBHintMessage>
                </div>
              </div>
              <div>
                <CurrencyInputField
                  name="amount"
                  control={control}
                  labelName="預計每期存錢金額"
                  inputProps={{inputMode: 'numeric'}}
                />
                <FEIBHintMessage className="hint-message">
                  {(amount > 0) && `存款目標為 ＄${toCurrency(getGoalAmount(amount, cycleDuration, cycleMode))}元`}
                </FEIBHintMessage>
              </div>

              <div className="amount-limit">{`金額最低＄${toCurrency(program.amountRange.month.min)} 元，最高＄${toCurrency(program.amountRange.month.max)} 元，以萬元為單位`}</div>

              <div>
                <DropdownField
                  options={generatebindAccountNoOptions(subAccounts, hasReachedMaxSubAccounts)}
                  name="bindAccountNo"
                  control={control}
                  labelName="選擇陪你存錢的帳號"
                />
                <FEIBHintMessage className="hint-message">
                  { ((bindAccountNo !== '*') && (bindAccountNo !== 'new') && !!bindAccountNo) && `存款餘額為 ${toCurrency(getRemainingBalance(bindAccountNo))}元` }
                </FEIBHintMessage>
              </div>

              <FEIBButton type="submit">確認</FEIBButton>
            </div>
          </form>
        </EditPageWrapper>
      </MainScrollWrapper>
    </Layout>
  );
};

export default DepositPlanEditPage;
