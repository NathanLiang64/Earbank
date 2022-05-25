import { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import { useDispatch } from 'react-redux';

import Layout from 'components/Layout/Layout';
import { MainScrollWrapper } from 'components/Layout';
import SwiperLayout from 'components/SwiperLayout';
import { setWaittingVisible } from 'stores/reducers/ModalReducer';

import DepositPlanHeroSlide from 'components/DepositPlanHeroSlide';
import EmptySlide from './components/EmptySlide';
import EmptyPlan from './components/EmptyPlan';
import DepositPlan from './components/DepositPlan';

import {
  showNoMainAccountAlert,
  showUnavaliableSubAccountAlert,
  showNonZeroBalanceAlert,
} from './utils/customPrompts';

import { getDepositPlans } from './api';

const renderSlides = (plans) => {
  const slides = Array.from({ length: 3 }, () => <EmptySlide />);

  if (plans) {
    plans.forEach((p, i) => {
      slides[i] = <DepositPlanHeroSlide account={p.bindAccountNo} {...p} />;
    });
  }

  return slides;
};

const renderContents = (plans) => {
  const slides = Array.from({ length: 3 }, () => <EmptyPlan />);

  if (plans) {
    plans.forEach((p, i) => {
      const currentValue = p.amount / 10000;
      slides[i] = <DepositPlan currentValue={currentValue} expireDate={p.endDate} {...p} />;
    });
  }

  return slides;
};

/**
 * C00600 存錢計畫
 */
const DepositPlanPage = () => {
  const history = useHistory();
  const location = useLocation();
  const dispatch = useDispatch();
  const [plans, setPlans] = useState(undefined);

  useEffect(async () => {
    dispatch(setWaittingVisible(true));

    // TODO: 是否已申請bankee帳戶(台幣)
    // eslint-disable-next-line
    if (false) {
      // TODO：沒有「台幣帳戶」導去申請
      showNoMainAccountAlert({ onDismiss: () => history.goBack() });
    }

    const res = getDepositPlans();

    if ('focusToAccountNo' in location.state) {
      console.debug('do something with accountNo', location.state.focusToAccountNo);
    }

    // 是否已開立8個子帳戶
    if (res.totalSubAccountCount >= 8) {
      // TODO: 是否至少一個子帳號是沒有綁定帳本或存錢計畫
      // eslint-disable-next-line
      if (false) {
        showUnavaliableSubAccountAlert({ onDismiss: () => history.goBack() });
      }

      // TODO: 該子帳戶餘額是否為0
      // eslint-disable-next-line
      if (false) {
        showNonZeroBalanceAlert({ onDismiss: () => history.goBack() });
      }
    }

    setPlans(res.plans);

    dispatch(setWaittingVisible(false));
  }, []);

  return (
    <Layout title="存錢計畫" hasClearHeader>
      <MainScrollWrapper>
        <SwiperLayout slides={renderSlides(plans)}>
          { renderContents(plans) }
        </SwiperLayout>
      </MainScrollWrapper>
    </Layout>
  );
};

export default DepositPlanPage;
