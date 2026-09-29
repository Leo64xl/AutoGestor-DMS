import { configureStore, isRejectedWithValue } from "@reduxjs/toolkit";
import authReducer, { sesionExpirada } from "./authSlice";
import uiReducer, { mostrarAviso } from "./uiSlice";
import vehiculosReducer from "./vehiculosSlice";
import clientesReducer from "./clientesSlice";
import ventasReducer from "./ventasSlice";
import pruebasReducer from "./pruebasSlice";
import operacionesReducer from "./operacionesSlice";
import financiamientoReducer from "./financiamientoSlice";
import postventaReducer from "./postventaSlice";
import reportesReducer from "./reportesSlice";
import usuariosReducer from "./usuariosSlice";
import bitacoraReducer from "./bitacoraSlice";

/**
 * Middleware transversal de errores:
 * - un 401 significa que la sesion caduco por inactividad (RNF-005),
 * - cualquier otro rechazo se muestra como aviso al usuario.
 */
const manejoErrores = (store) => (next) => (action) => {
  if (isRejectedWithValue(action) && !action.type.startsWith("auth/sesion")) {
    const texto = String(action.payload || "");
    if (texto.includes("expirada") || texto.includes("Sesion no iniciada")) {
      store.dispatch(sesionExpirada());
    } else if (!action.type.startsWith("auth/")) {
      store.dispatch(mostrarAviso({ tipo: "error", texto }));
    }
  }
  return next(action);
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    vehiculos: vehiculosReducer,
    clientes: clientesReducer,
    ventas: ventasReducer,
    pruebas: pruebasReducer,
    operaciones: operacionesReducer,
    financiamiento: financiamientoReducer,
    postventa: postventaReducer,
    reportes: reportesReducer,
    usuarios: usuariosReducer,
    bitacora: bitacoraReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(manejoErrores),
});
