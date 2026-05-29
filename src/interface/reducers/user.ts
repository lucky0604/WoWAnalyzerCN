import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { captureException } from 'common/errorLogger';

interface User {
  name: string;
  avatar?: string;
  premium: boolean;
  github?: {
    premium?: boolean;
    expires?: string;
  };
  patreon?: {
    premium?: boolean;
  };
  wcl?: {
    validAuth?: boolean;
  };
}

export const fetchUser = createAsyncThunk<User | false | null>('user/fetchUser', async () => {
  if (import.meta.env.VITE_DISABLE_USER_FETCH === 'true') {
    return false;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_SERVER_BASE}user`, {
      credentials: 'include',
    });

    if (response.status !== 200) {
      if (response.status === 401 || response.status === 403) {
        // Unauthorized
        // We need to store this explicitely so we know the diff between "unknown" and "logged out"
        return false;
      }
      throw new Error(response.statusText);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return false;
    }

    const data = await response.json();
    return data satisfies User;
  } catch (err: unknown) {
    captureException(err, {
      extra: {
        location: 'user',
      },
    });
    // fail silently since this only enhances the experience, if we're shortly down it shouldn't *kill* the experience.
    return false;
  }
});

export const logout = createAsyncThunk('user/logout', async () => {
  try {
    await fetch(`${import.meta.env.VITE_SERVER_BASE}logout`, {
      credentials: 'include',
    });
  } catch (err: unknown) {
    captureException(err);
    console.error(err);
    // fail silently since this only enhances the experience, if we're shortly down it shouldn't *kill* the experience.
  }
  return;
});

type UserState = User | false | null;
const initialState: UserState = null as UserState;

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUser.fulfilled, (state, action) => {
      const payload = action.payload;
      return payload;
    });
    builder.addCase(logout.fulfilled, () => {
      return null;
    });
  },
});

export default userSlice.reducer;
