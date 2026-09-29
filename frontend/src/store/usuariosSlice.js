import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, put, patch } from "../api/client";

export const cargarUsuarios = createAsyncThunk("usuarios/cargar", async (_, { rejectWithValue }) => {
  try {
    const [lista, roles] = await Promise.all([get("/usuarios"), get("/usuarios/roles")]);
    return { lista, roles };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-003 / RF-004 */
export const crearUsuario = createAsyncThunk("usuarios/crear", async (datos, { rejectWithValue }) => {
  try {
    return await post("/usuarios", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const editarUsuario = createAsyncThunk("usuarios/editar", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await put(`/usuarios/${id}`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-005 */
export const cambiarEstadoUsuario = createAsyncThunk("usuarios/estado", async ({ id, activo }, { rejectWithValue }) => {
  try {
    return await patch(`/usuarios/${id}/estado`, { activo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const resetearPassword = createAsyncThunk("usuarios/reset", async ({ id, passwordTemporal }, { rejectWithValue }) => {
  try {
    return await post(`/usuarios/${id}/reset-password`, { passwordTemporal });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const usuariosSlice = createSlice({
  name: "usuarios",
  initialState: { lista: [], roles: [], cargando: false, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(cargarUsuarios.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarUsuarios.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload.lista;
        state.roles = action.payload.roles;
      })
      .addCase(cargarUsuarios.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      // El alta devuelve el perfil publico; la lista se refresca desde la pagina
      // para recuperar los campos completos (activo, ultimoAcceso).
      .addCase(crearUsuario.fulfilled, (state, action) => {
        state.lista.push({ ...action.payload, activo: true });
      })
      .addCase(cambiarEstadoUsuario.fulfilled, (state, action) => {
        const usuario = state.lista.find((u) => u.id === action.payload.id);
        if (usuario) usuario.activo = action.payload.activo ?? usuario.activo;
      });
  },
});

export default usuariosSlice.reducer;
