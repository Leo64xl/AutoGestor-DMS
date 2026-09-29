import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, descargar } from "../api/client";

/** RF-037, RF-038, RF-039: los tres reportes comparten el mismo flujo de consulta. */
export const cargarReporte = createAsyncThunk("reportes/cargar", async ({ tipo, filtros = {} }, { rejectWithValue }) => {
  try {
    const datos = await get(`/reportes/${tipo}`, filtros);
    return { tipo, datos };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-041: exportacion del reporte a Excel con los filtros aplicados. */
export const exportarReporte = createAsyncThunk("reportes/exportar", async ({ tipo, filtros = {} }, { rejectWithValue }) => {
  try {
    await descargar(`/reportes/${tipo}/excel`, { params: filtros, nombrePorDefecto: `reporte-${tipo}.xlsx` });
    return tipo;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const hoy = new Date();
const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);

const reportesSlice = createSlice({
  name: "reportes",
  initialState: {
    tipo: "ventas",
    filtros: { desde: primerDiaDelMes, hasta: hoy.toISOString().slice(0, 10), marca: "", modelo: "", estatus: "" },
    datos: null,
    cargando: false,
    exportando: false,
    error: null,
  },
  reducers: {
    fijarTipo(state, action) {
      state.tipo = action.payload;
      state.datos = null;
    },
    fijarFiltro(state, action) {
      state.filtros[action.payload.campo] = action.payload.valor;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarReporte.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarReporte.fulfilled, (state, action) => {
        state.cargando = false;
        state.tipo = action.payload.tipo;
        state.datos = action.payload.datos;
      })
      .addCase(cargarReporte.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(exportarReporte.pending, (state) => {
        state.exportando = true;
      })
      .addCase(exportarReporte.fulfilled, (state) => {
        state.exportando = false;
      })
      .addCase(exportarReporte.rejected, (state) => {
        state.exportando = false;
      });
  },
});

export const { fijarTipo, fijarFiltro } = reportesSlice.actions;
export default reportesSlice.reducer;
