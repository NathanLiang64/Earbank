export const calcSelectedLength = (list) => {
  let count = 0;
  for (const key in list) {
    if (list[key]) count++;
  }
  return count;
};

export const extractGroupItems = (groups) => {
  const initialValues = groups.reduce((acc, group) => {
    group.items.forEach((item) => {
      const isFavorite = !!parseInt(item.isFavorite, 10);
      acc[item.actKey] = isFavorite;
    });
    return acc;
  }, {});
  return initialValues;
};

export const findExistedValue = (watchedValues, key) => {
  // console.log(watc)
  for (const watchedKey in watchedValues) {
    if (watchedValues[watchedKey] && watchedKey === key) return true;
  }
  return false;
};

export const generateTrimmedList = (list, maxLength, emptyValue) => {
  const trimmedList = list.reduce((acc, cur) => {
    if (cur) acc.push(cur);
    return acc;
  }, []);

  while (trimmedList.length < maxLength) {
    trimmedList.push(emptyValue);
  }
  return trimmedList;
};

export const generateReorderList = (initialValues, editedBlockList) => {
  const defaultList = [];
  const selectedList = [];
  // eslint-disable-next-line guard-for-in
  for (const key in editedBlockList) {
    const foundedItem = initialValues.find((value) => value.actKey === key);
    if (editedBlockList[key]) {
      if (foundedItem) {
        defaultList[foundedItem.position] = foundedItem.actKey;
      } else {
        selectedList.push(key);
      }
    }
  }
  return [...defaultList, ...selectedList];
  // return { defaultList, selectedList };
};

export const reorder = (list, startIndex, endIndex) => {
  const updatedItems = Array.from(list.items);
  const [removed] = updatedItems.splice(startIndex, 1);
  updatedItems.splice(endIndex, 0, removed);
  return {...list, items: updatedItems};
};

export const move = (source, destination, droppableSource, droppableDestination) => {
  const sourceClone = Array.from(source.items);
  const destClone = Array.from(destination.items);
  const [removed] = sourceClone.splice(droppableSource.index, 1);
  destClone.splice(droppableDestination.index, 0, removed);
  if (source.id === 'left') return [{...source, items: sourceClone}, {...destination, items: destClone}];
  return [{...destination, items: destClone}, {...source, items: sourceClone}];
};

export const combineLeftAndRight = (left, right) => {
  const leftList = Array.from(left);
  const rightList = Array.from(right);
  const arr = [];
  while (leftList.length || rightList.length) {
    arr.push(leftList.shift());
    arr.push(rightList.shift());
  }
  return arr;
};
