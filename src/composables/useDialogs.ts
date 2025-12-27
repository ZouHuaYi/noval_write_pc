import { reactive } from 'vue';

export type AlertType = 'info' | 'warning' | 'danger';

export interface InputDialogState {
  show: boolean;
  title: string;
  placeholder: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
}

export interface AlertDialogState {
  show: boolean;
  title: string;
  message: string;
  showCancel: boolean;
  type: AlertType;
  onConfirm: () => void;
  onCancel: () => void;
}

export function useDialogs() {
  const inputDialog = reactive<InputDialogState>({
    show: false,
    title: '',
    placeholder: '',
    defaultValue: '',
    onConfirm: () => {}
  });

  const alertDialog = reactive<AlertDialogState>({
    show: false,
    title: '提示',
    message: '',
    showCancel: false,
    type: 'info',
    onConfirm: () => {},
    onCancel: () => {}
  });

  // 显示提示对话框
  const showAlert = (
    message: string, 
    title = '提示', 
    type: AlertType = 'info'
  ) => {
    alertDialog.title = title;
    alertDialog.message = message;
    alertDialog.type = type;
    alertDialog.showCancel = false;
    alertDialog.onConfirm = () => {
      alertDialog.show = false;
    };
    alertDialog.show = true;
  };

  // 显示确认对话框
  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title = '确认',
    type: AlertType = 'warning'
  ) => {
    alertDialog.title = title;
    alertDialog.message = message;
    alertDialog.type = type;
    alertDialog.showCancel = true;
    alertDialog.onConfirm = () => {
      onConfirm();
      alertDialog.show = false;
    };
    alertDialog.onCancel = () => {
      alertDialog.show = false;
    };
    alertDialog.show = true;
  };

  // 显示输入对话框
  const showPrompt = (
    title: string,
    onConfirm: (value: string) => void,
    placeholder = '',
    defaultValue = ''
  ) => {
    inputDialog.title = title;
    inputDialog.placeholder = placeholder;
    inputDialog.defaultValue = defaultValue;
    inputDialog.onConfirm = (value: string) => {
      inputDialog.show = false;
      onConfirm(value);
    };
    inputDialog.show = true;
  };

  return {
    inputDialog,
    alertDialog,
    showAlert,
    showConfirm,
    showPrompt
  };
}

