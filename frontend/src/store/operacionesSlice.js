import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, patch } from "../api/client";

export const cargarOperaciones = createAsyncThunk("operaciones/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    return await get("/operaciones", filtros);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-026 a RF-029: registro de la venta con su documentacion. */
export const registrarVenta = createAsyncThunk("operaciones/registrar", async (datos, { rejectWithValue }) => {
  try {
    return await post("/operaciones", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const agregarDocumento = createAsyncThunk("operaciones/documento", async ({ id, datos }, { rejectWithValue }) => {
  try {
    const documento = await post(`/operaciones/${id}/documentos`, datos);
    return { id, documento };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-030: traspaso y entrega. */
export const registrarEntrega = createAsyncThunk("operaciones/entrega", async ({ id, observaciones }, { rejectWithValue }) => {
  try {
    return await patch(`/operaciones/${id}/entrega`, { observaciones });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-028: timbra el CFDI 4.0 de la venta ante el SAT. */
export const timbrarFactura = createAsyncThunk("operaciones/timbrar", async (id, { rejectWithValue }) => {
  try {
    return await post(`/operaciones/${id}/timbrar`);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cancelarCfdi = createAsyncThunk("operaciones/cancelarCfdi", async ({ id, motivo }, { rejectWithValue }) => {
  try {
    return await patch(`/operaciones/${id}/cfdi/cancelar`, { motivo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** Configuracion del timbrado: entorno y si esta en modo simulado. */
export const cargarEstadoCfdi = createAsyncThunk("operaciones/estadoCfdi", async (_, { rejectWithValue }) => {
  try {
    return await get("/operaciones/cfdi/estado");
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

function reemplazar(state, venta) {
  const indice = state.lista.findIndex((v) => v.id === venta.id);
  if (indice >= 0) state.lista[indice] = venta;
}

const operacionesSlice = createSlice({
  name: "operaciones",
  initialState: { lista: [], cfdi: { entorno: "sandbox", simulado: true, emisorConfigurado: false }, cargando: false, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(cargarOperaciones.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarOperaciones.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload;
      })
      .addCase(cargarOperaciones.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(registrarVenta.fulfilled, (state, action) => {
        state.lista.unshift(action.payload);
      })
      .addCase(agregarDocumento.fulfilled, (state, action) => {
        const venta = state.lista.find((v) => v.id === action.payload.id);
        if (venta) venta.documentos = [...(venta.documentos || []), action.payload.documento];
      })
      .addCase(registrarEntrega.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(timbrarFactura.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(cancelarCfdi.fulfilled, (state, action) => reemplazar(state, action.payload))
      .addCase(cargarEstadoCfdi.fulfilled, (state, action) => {
        state.cfdi = action.payload;
      });
  },
});

export default operacionesSlice.reducer;
