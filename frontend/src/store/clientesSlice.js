import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, put, patch } from "../api/client";

export const cargarClientes = createAsyncThunk("clientes/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    return await get("/clientes", filtros);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-016: ficha con historial de seguimientos, cotizaciones y apartados. */
export const cargarCliente = createAsyncThunk("clientes/detalle", async (id, { rejectWithValue }) => {
  try {
    return await get(`/clientes/${id}`);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** Catalogos del SAT para los desplegables de datos fiscales (RF-028). */
export const cargarCatalogosSat = createAsyncThunk("clientes/catalogosSat", async (_, { rejectWithValue }) => {
  try {
    return await get("/clientes/catalogos-sat");
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const crearCliente = createAsyncThunk("clientes/crear", async (datos, { rejectWithValue }) => {
  try {
    return await post("/clientes", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const editarCliente = createAsyncThunk("clientes/editar", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await put(`/clientes/${id}`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cambiarEstatusCliente = createAsyncThunk("clientes/estatus", async ({ id, estatus }, { rejectWithValue }) => {
  try {
    return await patch(`/clientes/${id}/estatus`, { estatus });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-015: actividad de seguimiento (llamada, visita, mensaje, correo). */
export const agregarSeguimiento = createAsyncThunk("clientes/seguimiento", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await post(`/clientes/${id}/seguimientos`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const filtrosIniciales = { busqueda: "", estatus: "", origen: "" };

function reemplazar(state, cliente) {
  const indice = state.lista.findIndex((c) => c.id === cliente.id);
  if (indice >= 0) state.lista[indice] = { ...state.lista[indice], ...cliente };
}

const clientesSlice = createSlice({
  name: "clientes",
  initialState: {
    lista: [],
    detalle: null,
    filtros: filtrosIniciales,
    catalogosSat: { regimenesFiscales: [], usosCfdi: [] },
    cargando: false,
    error: null,
  },
  reducers: {
    fijarFiltro(state, action) {
      state.filtros[action.payload.campo] = action.payload.valor;
    },
    limpiarDetalle(state) {
      state.detalle = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarClientes.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarClientes.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload;
      })
      .addCase(cargarClientes.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(cargarCliente.pending, (state) => {
        state.cargando = true;
        state.detalle = null;
      })
      .addCase(cargarCliente.fulfilled, (state, action) => {
        state.cargando = false;
        state.detalle = action.payload;
      })
      .addCase(cargarCliente.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(cargarCatalogosSat.fulfilled, (state, action) => {
        state.catalogosSat = action.payload;
      })
      .addCase(crearCliente.fulfilled, (state, action) => {
        state.lista.unshift(action.payload);
      })
      .addCase(editarCliente.fulfilled, (state, action) => {
        reemplazar(state, action.payload);
        if (state.detalle?.id === action.payload.id) state.detalle = { ...state.detalle, ...action.payload };
      })
      .addCase(cambiarEstatusCliente.fulfilled, (state, action) => {
        reemplazar(state, action.payload);
        if (state.detalle?.id === action.payload.id) state.detalle = { ...state.detalle, ...action.payload };
      })
      .addCase(agregarSeguimiento.fulfilled, (state, action) => {
        const { seguimiento, cliente } = action.payload;
        reemplazar(state, cliente);
        if (state.detalle?.id === cliente.id) {
          state.detalle.estatus = cliente.estatus;
          state.detalle.seguimientos = [...(state.detalle.seguimientos || []), seguimiento];
        }
      });
  },
});

export const { fijarFiltro, limpiarDetalle } = clientesSlice.actions;
export default clientesSlice.reducer;
