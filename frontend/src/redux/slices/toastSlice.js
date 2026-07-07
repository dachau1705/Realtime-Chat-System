import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  toast: null,
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    setToast: (state, action) => {
      state.toast = action.payload;
      console.warn('Toast warning triggered from Redux:', action.payload);
    },
    clearToast: (state) => {
      state.toast = null;
    }
  }
});

export const { setToast, clearToast } = toastSlice.actions;
export default toastSlice.reducer;
