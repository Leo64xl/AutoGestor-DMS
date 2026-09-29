import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post, put, patch } from "../api/client";

/** RF-009: el catalogo se pide al backend con los filtros aplicados. */
export const cargarVehiculos = createAsyncThunk("vehiculos/cargar", async (filtros = {}, { rejectWithValue }) => {
  try {
    const [lista, alertas] = await Promise.all([get("/vehiculos", filtros), get("/vehiculos/alertas")]);
    return { lista, alertas };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** Valores presentes en el catalogo, para los desplegables de la busqueda. */
export const cargarOpciones = createAsyncThunk("vehiculos/opciones", async (_, { rejectWithValue }) => {
  try {
    return await get("/vehiculos/opciones");
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const crearVehiculo = createAsyncThunk("vehiculos/crear", async (datos, { rejectWithValue }) => {
  try {
    return await post("/vehiculos", datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const editarVehiculo = createAsyncThunk("vehiculos/editar", async ({ id, datos }, { rejectWithValue }) => {
  try {
    return await put(`/vehiculos/${id}`, datos);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cambiarEstatusVehiculo = createAsyncThunk("vehiculos/estatus", async ({ id, estatus }, { rejectWithValue }) => {
  try {
    return await patch(`/vehiculos/${id}/estatus`, { estatus });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

/** RF-010: baja logica con motivo. */
export const darDeBajaVehiculo = createAsyncThunk("vehiculos/baja", async ({ id, motivo }, { rejectWithValue }) => {
  try {
    return await post(`/vehiculos/${id}/baja`, { motivo });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const filtrosIniciales = {
  busqueda: "",
  marca: "",
  modelo: "",
  color: "",
  anio: "",
  estatus: "",
  precioMin: "",
  precioMax: "",
  orden: "relevancia",
};

const opcionesIniciales = { marcas: [], modelos: [], colores: [], anios: [], modelosPorMarca: {} };

function reemplazar(state, vehiculo) {
  const indice = state.lista.findIndex((v) => v.id === vehiculo.id);
  if (indice >= 0) state.lista[indice] = vehiculo;
}

const vehiculosSlice = createSlice({
  name: "vehiculos",
  initialState: { lista: [], alertas: [], opciones: opcionesIniciales, filtros: filtrosIniciales, cargando: false, error: null },
  reducers: {
    fijarFiltro(state, action) {
      const { campo, valor } = action.payload;
      state.filtros[campo] = valor;
      // Cambiar de marca invalida el modelo elegido, que pertenece a la marca anterior.
      if (campo === "marca") state.filtros.modelo = "";
    },
    limpiarFiltros(state) {
      state.filtros = filtrosIniciales;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cargarVehiculos.pending, (state) => {
        state.cargando = true;
        state.error = null;
      })
      .addCase(cargarVehiculos.fulfilled, (state, action) => {
        state.cargando = false;
        state.lista = action.payload.lista;
        state.alertas = action.payload.alertas;
      })
      .addCase(cargarVehiculos.rejected, (state, action) => {
        state.cargando = false;
        state.error = action.payload;
      })
      .addCase(cargarOpciones.fulfilled, (state, action) => {
        state.opciones = action.payload;
      })
      .addCase(crearVehiculo.fulfilled, (state, action) => {
        state.lista.unshift(action.payload.vehiculo);
        state.alertas = action.payload.alertas;
      })
      .addCase(editarVehiculo.fulfilled, (state, action) => {
        reemplazar(state, action.payload);
      })
      .addCase(cambiarEstatusVehiculo.fulfilled, (state, action) => {
        reemplazar(state, action.payload.vehiculo);
        state.alertas = action.payload.alertas;
      })
      .addCase(darDeBajaVehiculo.fulfilled, (state, action) => {
        state.lista = state.lista.filter((v) => v.id !== action.payload.vehiculo.id);
        state.alertas = action.payload.alertas;
      });
  },
});

export const { fijarFiltro, limpiarFiltros } = vehiculosSlice.actions;
export default vehiculosSlice.reducer;
