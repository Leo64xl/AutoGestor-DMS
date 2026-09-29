import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, patch } from "../api/client";

export const cargarFinanciamiento = createAsyncThunk("financiamiento/cargar", async (_, { rejectWithValue }) => {
  try {
    const [solicitudes, pagos] = await Promise.all([get("/financiamiento/solicitudes"), get("/financiamiento/pagos")]);
    return { solicitudes, pagos };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-031 */
export const crearSolicitud = createAsyncThunk("financiamiento/crear", async (datos, { rejectWithValue }) => {
  try {
    return await post("/financiamiento/solicitudes", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-032: envio a la entidad financiera. */
export const enviarSolicitud = createAsyncThunk("financiamiento/enviar", async (id, { rejectWithValue }) => {
  try {
    return await patch(`/financiamiento/solicitudes/${id}/enviar`);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-032 / RF-033: respuesta y condiciones del credito. */
export const registrarRespuesta = createAsyncThunk("financiamiento/respuesta", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await patch(`/financiamiento/solicitudes/${id}/respuesta`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-034 */
export const registrarPago = createAsyncThunk("financiamiento/pago", async (datos, { rejectWithValue }) => {
  try {
    return await post("/financiamiento/pagos", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

function reemplazar(state, solicitud) {
  const indice = state.solicitudes.findIndex((s) => s.id === solicitud.id);
  if (indice >= 0) state.solicitudes[indice] = solicitud;
}

const financiamientoSlice = createSlice({
  name: "financiamiento",
  initialState: { solicitudes: [], pagos: [], cargando: false, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(cargarFinanciamiento.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarFinanciamiento.fulfilled, (state, action) => {
        state.cargando = false;
        state.solicitudes = action.payload.solicitudes;
        state.pagos = action.payload.pagos;
      })
      .addCase(cargarFinanciamiento.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(crearSolicitud.fulfilled, (state, action) => {
        state.solicitudes.unshift(action.payload);
      })
      .addCase(enviarSolicitud.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(registrarRespuesta.fulfilled, (state, action) => reemplazar(state, action.payload));
  },
});

export default financiamientoSlice.reducer;
