import { createSlice } from "@reduxjs/toolkit";

/**
 * Navegacion y avisos de la aplicacion.
 * La vista activa vive en Redux: no se usa un enrutador externo.
 */
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    vista: "inicio",
    parametro: null,
    aviso: null, // { tipo: "exito" | "error", texto }
  },
  reducers: {
    navegar(state, action) {
      const { vista, parametro = null } = typeof action.payload === "string" ? { vista: action.payload } : action.payload;
      state.vista = vista;
      state.parametro = parametro;
    },
    mostrarAviso(state, action) {
      const { tipo = "exito", texto } = typeof action.payload === "string" ? { texto: action.payload } : action.payload;
      state.aviso = { tipo, texto };
    },
    ocultarAviso(state) {
      state.aviso = null;
    },
  },
});

export const { navegar, mostrarAviso, ocultarAviso } = uiSlice.actions;
export default uiSlice.reducer;
