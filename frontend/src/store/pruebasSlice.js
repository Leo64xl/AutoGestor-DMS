import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, patch } from "../api/client";

export const cargarPruebas = createAsyncThunk("pruebas/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    return await get("/pruebas", filtros);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-023 */
export const agendarPrueba = createAsyncThunk("pruebas/agendar", async (datos, { rejectWithValue }) => {
  try {
    return await post("/pruebas", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-024 */
export const registrarIdentificacion = createAsyncThunk("pruebas/identificacion", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await patch(`/pruebas/${id}/identificacion`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-025 */
export const registrarResultado = createAsyncThunk("pruebas/resultado", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await patch(`/pruebas/${id}/resultado`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cancelarPrueba = createAsyncThunk("pruebas/cancelar", async ({ id, motivo }, { rejectWithValue }) => {
  try {
    return await patch(`/pruebas/${id}/cancelar`, { motivo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

function reemplazar(state, prueba) {
  const indice = state.lista.findIndex((p) => p.id === prueba.id);
  if (indice >= 0) state.lista[indice] = prueba;
}

const pruebasSlice = createSlice({
  name: "pruebas",
  initialState: { lista: [], filtros: { estatus: "", desde: "", hasta: "" }, cargando: false, error: null },
  reducers: {
    fijarFiltro(state, action) {
      state.filtros[action.payload.campo] = action.payload.valor;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarPruebas.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarPruebas.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload;
      })
      .addCase(cargarPruebas.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(agendarPrueba.fulfilled, (state, action) => {
        state.lista.unshift(action.payload);
      })
      .addCase(registrarIdentificacion.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(registrarResultado.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(cancelarPrueba.fulfilled, (state, action) => reemplazar(state, action.payload));
  },
});

export const { fijarFiltro } = pruebasSlice.actions;
export default pruebasSlice.reducer;
