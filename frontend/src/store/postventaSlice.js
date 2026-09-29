import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, patch } from "../api/client";

export const cargarPostventa = createAsyncThunk("postventa/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    const [servicios, elegibles] = await Promise.all([
      get("/postventa/servicios", filtros),
      get("/postventa/vehiculos-elegibles"),
    ]);
    return { servicios, elegibles };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-036 (HU-23): historial de servicios de una unidad. */
export const cargarHistorial = createAsyncThunk("postventa/historial", async (vehiculoId, { rejectWithValue }) => {
  try {
    return await get(`/postventa/vehiculos/${vehiculoId}/historial`);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-035 */
export const agendarServicio = createAsyncThunk("postventa/agendar", async (datos, { rejectWithValue }) => {
  try {
    return await post("/postventa/servicios", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cerrarServicio = createAsyncThunk("postventa/cerrar", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await patch(`/postventa/servicios/${id}/realizado`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cancelarServicio = createAsyncThunk("postventa/cancelar", async ({ id, motivo }, { rejectWithValue }) => {
  try {
    return await patch(`/postventa/servicios/${id}/cancelar`, { motivo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

function reemplazar(state, servicio) {
  const indice = state.servicios.findIndex((s) => s.id === servicio.id);
  if (indice >= 0) state.servicios[indice] = servicio;
}

const postventaSlice = createSlice({
  name: "postventa",
  initialState: { servicios: [], elegibles: [], historial: null, cargando: false, error: null },
  reducers: {
    limpiarHistorial(state) {
      state.historial = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarPostventa.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarPostventa.fulfilled, (state, action) => {
        state.cargando = false;
        state.servicios = action.payload.servicios;
        state.elegibles = action.payload.elegibles;
      })
      .addCase(cargarPostventa.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(cargarHistorial.fulfilled, (state, action) => {
        state.historial = action.payload;
      })
      .addCase(agendarServicio.fulfilled, (state, action) => {
        state.servicios.unshift(action.payload);
      })
      .addCase(cerrarServicio.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(cancelarServicio.fulfilled, (state, action) => reemplazar(state, action.payload));
  },
});

export const { limpiarHistorial } = postventaSlice.actions;
export default postventaSlice.reducer;
