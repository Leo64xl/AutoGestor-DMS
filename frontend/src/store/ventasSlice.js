import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, patch } from "../api/client";

export const cargarModuloVentas = createAsyncThunk("ventas/cargar", async (_, { rejectWithValue }) => {
  try {
    const [cotizaciones, apartados, accesorios] = await Promise.all([
      get("/ventas/cotizaciones"),
      get("/ventas/apartados"),
      get("/ventas/accesorios"),
    ]);
    return { cotizaciones, apartados, accesorios };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-018 / RF-019 */
export const crearCotizacion = createAsyncThunk("ventas/crearCotizacion", async (datos, { rejectWithValue }) => {
  try {
    return await post("/ventas/cotizaciones", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cancelarCotizacion = createAsyncThunk("ventas/cancelarCotizacion", async (id, { rejectWithValue }) => {
  try {
    return await patch(`/ventas/cotizaciones/${id}/cancelar`);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-020 / RF-021 */
export const crearApartado = createAsyncThunk("ventas/crearApartado", async (datos, { rejectWithValue }) => {
  try {
    return await post("/ventas/apartados", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-022 */
export const cancelarApartado = createAsyncThunk("ventas/cancelarApartado", async ({ id, motivo }, { rejectWithValue }) => {
  try {
    return await patch(`/ventas/apartados/${id}/cancelar`, { motivo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

function reemplazar(coleccion, registro) {
  const indice = coleccion.findIndex((r) => r.id === registro.id);
  if (indice >= 0) coleccion[indice] = registro;
}

const ventasSlice = createSlice({
  name: "ventas",
  initialState: { cotizaciones: [], apartados: [], accesorios: [], cargando: false, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(cargarModuloVentas.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarModuloVentas.fulfilled, (state, action) => {
        state.cargando = false;
        state.cotizaciones = action.payload.cotizaciones;
        state.apartados = action.payload.apartados;
        state.accesorios = action.payload.accesorios;
      })
      .addCase(cargarModuloVentas.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(crearCotizacion.fulfilled, (state, action) => {
        state.cotizaciones.unshift(action.payload);
      })
      .addCase(cancelarCotizacion.fulfilled, (state, action) => {
        const cotizacion = state.cotizaciones.find((c) => c.id === action.payload.id);
        if (cotizacion) cotizacion.estatus = action.payload.estatus;
      })
      .addCase(crearApartado.fulfilled, (state, action) => {
        state.apartados.unshift(action.payload);
        if (action.payload.cotizacionId) {
          const cotizacion = state.cotizaciones.find((c) => c.id === action.payload.cotizacionId);
          if (cotizacion) cotizacion.estatus = "apartada";
        }
      })
      .addCase(cancelarApartado.fulfilled, (state, action) => {
        reemplazar(state.apartados, action.payload);
        if (action.payload.cotizacionId) {
          const cotizacion = state.cotizaciones.find((c) => c.id === action.payload.cotizacionId);
          if (cotizacion) cotizacion.estatus = "vigente";
        }
      });
  },
});

export default ventasSlice.reducer;
