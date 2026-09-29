import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post } from "../api/client";

export const iniciarSesion = createAsyncThunk("auth/login", async (credenciales, { rejectWithValue }) => {
  try {
    return await post("/auth/login", credenciales);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const recuperarSesion = createAsyncThunk("auth/sesion", async (_, { rejectWithValue }) => {
  try {
    return await get("/auth/sesion");
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cambiarPassword = createAsyncThunk("auth/cambiarPassword", async (datos, { rejectWithValue }) => {
  try {
    return await post("/auth/cambiar-password", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cerrarSesion = createAsyncThunk("auth/logout", async () => {
  await post("/auth/logout");
});

const estadoInicial = {
  usuario: null,
  cargando: false,
  // true mientras se resuelve el GET /auth/sesion del arranque
  iniciando: true,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState: estadoInicial,
  reducers: {
    limpiarError(state) {
      state.error = null;
    },
    // La API respondio 401: la sesion expiro por inactividad (RNF-005).
    sesionExpirada(state) {
      state.usuario = null;
      state.error = "Tu sesion expiro por inactividad. Inicia sesion de nuevo.";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(iniciarSesion.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(iniciarSesion.fulfilled, (state, action) => {
        state.cargando = false;
        state.usuario = action.payload.usuario;
      })
      .addCase(iniciarSesion.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload || "No fue posible iniciar sesion";
      })
      .addCase(recuperarSesion.pending, (state) => {
        state.iniciando = true;
      })
      .addCase(recuperarSesion.fulfilled, (state, action) => {
        state.iniciando = false;
        state.usuario = action.payload.usuario;
      })
      .addCase(recuperarSesion.rejected, (state) => {
        state.iniciando = false;
        state.usuario = null;
      })
      .addCase(cambiarPassword.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cambiarPassword.fulfilled, (state, action) => {
        state.cargando = false;
        state.usuario = action.payload.usuario;
      })
      .addCase(cambiarPassword.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload || "No fue posible cambiar la contrasena";
      })
      .addCase(cerrarSesion.fulfilled, (state) => {
        state.usuario = null;
      });
  },
});

export const { limpiarError, sesionExpirada } = authSlice.actions;

export const seleccionarUsuario = (state) => state.auth.usuario;
/** RF-004: el menu y las acciones se dibujan a partir de los permisos del perfil. */
export const tienePermiso = (state, permiso) => {
  const permisos = state.auth.usuario?.rol?.permisos || [];
  return permisos.includes("*") || permisos.includes(permiso);
};

export default authSlice.reducer;
