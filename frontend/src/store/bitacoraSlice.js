import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get } from "../api/client";

/** RF-040 / RNF-012: la bitacora solo se consulta; no hay acciones de escritura. */
export const cargarBitacora = createAsyncThunk("bitacora/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    return await get("/bitacora", filtros);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const filtrosIniciales = { usuario: "", accion: "", entidad: "", desde: "", hasta: "" };

const bitacoraSlice = createSlice({
  name: "bitacora",
  initialState: { lista: [], filtros: filtrosIniciales, cargando: false, error: null },
  reducers: {
    fijarFiltro(state, action) {
      state.filtros[action.payload.campo] = action.payload.valor;
    },
    limpiarFiltros(state) {
      state.filtros = filtrosIniciales;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarBitacora.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarBitacora.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload;
      })
      .addCase(cargarBitacora.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      });
  },
});

export const { fijarFiltro, limpiarFiltros } = bitacoraSlice.actions;
export default bitacoraSlice.reducer;
