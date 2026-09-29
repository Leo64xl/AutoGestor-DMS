import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { recuperarSesion } from "./store/authSlice";
import { navegar } from "./store/uiSlice";
import Layout from "./components/Layout";
import LimiteDeError from "./components/LimiteDeError";
import Login from "./pages/Login";
import CambiarPassword from "./pages/CambiarPassword";
import Inicio from "./pages/Inicio";
import Vehiculos from "./pages/Vehiculos";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Ventas from "./pages/Ventas";
import PruebasManejo from "./pages/PruebasManejo";
import Operaciones from "./pages/Operaciones";
import Financiamiento from "./pages/Financiamiento";
import Postventa from "./pages/Postventa";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import Bitacora from "./pages/Bitacora";
import SinAcceso from "./pages/SinAcceso";
import { puedeVerVista } from "./modulos";
import "./App.css";

const VISTAS = {
  inicio: Inicio,
  vehiculos: Vehiculos,
  clientes: Clientes,
  cliente: ClienteDetalle,
  ventas: Ventas,
  pruebas: PruebasManejo,
  operaciones: Operaciones,
  financiamiento: Financiamiento,
  postventa: Postventa,
  reportes: Reportes,
  usuarios: Usuarios,
  bitacora: Bitacora,
};

export default function App() {
  const dispatch = useDispatch();
  const { usuario, iniciando } = useSelector((state) => state.auth);
  const vista = useSelector((state) => state.ui.vista);

  useEffect(() => {
    dispatch(recuperarSesion());
  }, [dispatch]);

  if (iniciando) {
    return <div className="pantalla-carga">Cargando AutoGestor DMS...</div>;
  }

  // RF-001: sin sesion valida no se muestra ningun modulo.
  if (!usuario) return <Login />;

  // RF-002: el primer acceso obliga a definir una contrasena propia.
  if (usuario.requiereCambioPassword) return <CambiarPassword />;

  // RF-004: la vista se dibuja solo si el perfil tiene el permiso del modulo.
  // Evita que una vista quede accesible al navegar por estado sin pasar por el menu.
  const permisos = usuario.rol?.permisos || [];
  const Solicitada = VISTAS[vista];
  const Vista = !Solicitada ? Inicio : puedeVerVista(permisos, vista) ? Solicitada : SinAcceso;

  return (
    <Layout>
      <LimiteDeError vista={vista} onVolver={() => dispatch(navegar("inicio"))}>
        <Vista />
      </LimiteDeError>
    </Layout>
  );
}
