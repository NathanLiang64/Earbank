/* eslint-disable react/destructuring-assignment */
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import {
  accountFormatter, toCurrency, dateToString,
} from 'utilities/Generator';
import { closeFunc, loadFuncParams } from 'utilities/AppScriptProxy';

/* Elements */
import Layout from 'components/Layout/Layout';
import DebitCard from 'components/DebitCard/DebitCard';

/* Styles */
import LoanInterestWrapper from './L00300.style';

const L003001 = (props) => {
  const history = useHistory();
  const [model, setModel] = useState({});

  useEffect(async () => {
    const startParams = await loadFuncParams();

    if (startParams) {
      setModel(startParams);
    } else {
      setModel({
        cardData: props?.location?.state?.cardData,
        singleHistoryData: props?.location?.state?.singleHistoryData,
      });
    }
  }, []);

  const handleGoBack = async () => {
    const startParams = await loadFuncParams();
    if (startParams) {
      closeFunc();
    } else {
      history.goBack();
    }
  };

  return (
    <Layout title="繳款紀錄查詢" goBackFunc={handleGoBack}>
      <LoanInterestWrapper>
        <div className="cardArea">
          <DebitCard
            branch=""
            cardName={model.cardData?.alias || ''}
            account={`${accountFormatter(model.cardData?.accountNo || '')} ${model.cardData.loanNo}`}
            balance={toCurrency(model.cardData?.balance || '')}
            dollarSign={model.cardData?.currency || ''}
            transferTitle=""
            color="lightPurple"
          />
        </div>
        <div className="contentArea">
          <ul className="detailUl">
            <li>
              <span>交易日</span>
              <span>{ dateToString(model.singleHistoryData?.date) }</span>
            </li>
            <li>
              <span>交易種類</span>
              <span>{ model.singleHistoryData?.type }</span>
            </li>
            <li>
              <span>攤還本金</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.splitPrincipal) }
              </span>
            </li>
            <li>
              <span>利息</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.interest) }
              </span>
            </li>
            <li>
              <span>逾期息</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.overInterest) }
              </span>
            </li>
            <li>
              <span>違約金</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.defaultAmount) }
              </span>
            </li>
            <li>
              <span>利率</span>
              <span>
                { model.singleHistoryData?.rate }
                %
              </span>
            </li>
            <li>
              <span>應繳金額</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.amount) }
              </span>
            </li>
            <li>
              <span>本金餘額</span>
              <span>
                $
                { toCurrency(model.singleHistoryData?.balance) }
              </span>
            </li>
          </ul>
        </div>
      </LoanInterestWrapper>
    </Layout>
  );
};

export default L003001;
