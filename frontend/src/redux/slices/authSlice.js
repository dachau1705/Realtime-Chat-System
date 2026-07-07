import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  company_id: 'default_company_123',
  building_id: 'default_building_456',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthContext: (state, action) => {
      state.company_id = action.payload.company_id;
      state.building_id = action.payload.building_id;
    },
    clearAuthContext: (state) => {
      state.company_id = null;
      state.building_id = null;
    }
  }
});

export const { setAuthContext, clearAuthContext } = authSlice.actions;
export default authSlice.reducer;
