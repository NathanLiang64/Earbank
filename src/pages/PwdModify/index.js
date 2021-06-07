import { useState } from 'react';
// import { useHistory } from 'react-router';
import { useCheckLocation, usePageInfo } from 'hooks';
import * as yup from 'yup';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { closeFunc } from 'utilities/BankeePlus';

/* Elements */
import {
  FEIBButton,
} from 'components/elements';
import PasswordInput from 'components/PasswordInput';
import Dialog from 'components/Dialog';
import ConfirmButtons from 'components/ConfirmButtons';
import Alert from 'components/Alert';
import e2ee from '../../utilities/E2ee';

/* Styles */
// import theme from 'themes/theme';
import PwdModifyWrapper from './pwdModify.style';

const PwdModify = () => {
  /**
   *- 資料驗證
   */
  const schema = yup.object().shape({
    password: yup
      .string()
      .required('請輸入您的網銀密碼')
      .min(8, '您輸入的網銀密碼長度有誤，請重新輸入。')
      .max(20, '您輸入的網銀密碼長度有誤，請重新輸入。'),
    newPassword: yup
      .string()
      .required('請輸入新的網銀密碼')
      .min(8, '您輸入的網銀密碼長度有誤，請重新輸入。')
      .max(20, '您輸入的網銀密碼長度有誤，請重新輸入。'),
    newPasswordCheck: yup
      .string()
      .required('請再輸入一次新網銀密碼')
      .min(8, '您輸入的網銀密碼長度有誤，請重新輸入。')
      .max(20, '您輸入的網銀密碼長度有誤，請重新輸入。')
      .oneOf([yup.ref('newPassword'), null], '必須與新網銀密碼相同'),
  });
  const {
    handleSubmit, control, formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const forceModify = true;
  const [form, setForm] = useState({
    password: '',
    newPassword: '',
    newPasswordCheck: '',
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  // const handleFormChange = ({ target }) => {
  //   const formObject = { ...form };
  //   formObject[target.name] = target.value;
  //   setForm({ ...formObject });
  // };

  const handlePasswordModify = () => {
    setShowConfirmDialog(false);
    setShowResultDialog(true);
    closeFunc();
  };

  const handleWarnConfirm = () => {
    setShowWarningDialog(false);
    // closeFunc();
  };

  const handleResultButton = () => {
    setShowResultDialog(false);
  };

  const onSubmit = async (data) => {
    data.password = await e2ee(data.password);
    data.newPassword = await e2ee(data.newPassword);
    setForm({ ...data });
    setShowConfirmDialog(true);
    // setpassword(data.password);
    // setOpenDialog(true);
  };

  const WarningDialog = () => (
    <Dialog
      isOpen={showWarningDialog}
      onClose={() => setShowWarningDialog(false)}
      content={(
        <>
          <p>您確定不要變更網銀密碼嗎？</p>
          <p>久未更新網銀密碼可能會有...風險</p>
        </>
      )}
      action={(
        <ConfirmButtons
          mainButtonOnClick={handleWarnConfirm}
          subButtonOnClick={() => setShowWarningDialog(false)}
        />
      )}
    />
  );

  const ConfirmDialog = () => (
    <Dialog
      isOpen={showConfirmDialog}
      onClose={() => setShowConfirmDialog(false)}
      content={<p>您確定要變更網銀密碼嗎？</p>}
      action={(
        <ConfirmButtons
          mainButtonOnClick={handlePasswordModify}
          subButtonOnClick={() => setShowConfirmDialog(false)}
        />
      )}
    />
  );

  const ResultDialog = () => (
    <Dialog
      isOpen={showResultDialog}
      onClose={() => setShowResultDialog(false)}
      content={(
        <>
          <Alert state="success">變更成功</Alert>
          <p>
            您的網銀密碼已變更成功囉！
          </p>
          <p>
            下次請使用新設定之密碼進行登入，謝謝。
          </p>
        </>
      )}
      action={(
        <FEIBButton onClick={handleResultButton}>
          確定
        </FEIBButton>
      )}
    />
  );

  useCheckLocation();
  usePageInfo('/api/pwdModify');

  return (
    <PwdModifyWrapper>
      <form onSubmit={handleSubmit(onSubmit)}>
        <PasswordInput
          label="您的網銀密碼"
          id="password"
          name="password"
          control={control}
          errorMessage={errors.password?.message}
        />
        <PasswordInput
          label="新的網銀密碼"
          id="newPassword"
          name="newPassword"
          control={control}
          errorMessage={errors.newPassword?.message}
        />
        <PasswordInput
          label="請確認新的網銀密碼"
          id="newPasswordCheck"
          name="newPasswordCheck"
          control={control}
          errorMessage={errors.newPasswordCheck?.message}
        />
        {
          forceModify ? (
            <ConfirmButtons
              subButtonValue="維持不變"
              mainButtonValue="儲存變更"
              // mainButtonDisabled={
              //   !form.password
              //   || !form.newPassword
              //   || !form.newPasswordCheck
              //   || (form.newPassword !== form.newPasswordCheck)
              // }
              subButtonOnClick={(event) => {
                event.preventDefault();
                setShowWarningDialog(true);
              }}
            />
          ) : (
            <FEIBButton
              type="submit"
            >
              儲存變更
            </FEIBButton>
          )
        }
      </form>
      <WarningDialog />
      <ConfirmDialog />
      <ResultDialog />
    </PwdModifyWrapper>
  );
};

export default PwdModify;
