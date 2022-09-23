// eslint-disable-next-line no-unused-vars
import { BlockSelectedIcon } from 'assets/images/icons';
import FavoriteBlockButtonStyle from 'components/FavoriteBlockButton/favoriteBlockButton.style';
import React from 'react';
import { useController } from 'react-hook-form';
// import "./CheckBox.css";

export const CheckBoxField = ({
  disabled, icon, setShowTip, label, ...props
}) => {
  const { field } = useController(props);
  const {onChange, name, value} = field;
  const onChangeHandler = () => {
    if (disabled) {
      setShowTip(true);
    } else {
      onChange(!value);
    }
  };

  return (
    <FavoriteBlockButtonStyle
      className={`favoriteBlockButton ${value ? 'selected' : ''}`}
    >
      <label htmlFor={name} style={{width: '100%', height: '100%'}}>
        {icon}
        <p>{label}</p>
        <input
          type="checkbox"
          onChange={onChangeHandler}
          id={name}
          style={{display: 'none'}}
          checked={!!value}
        />
        <BlockSelectedIcon className="selectedIcon" />
      </label>
    </FavoriteBlockButtonStyle>

  );
};
