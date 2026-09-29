import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarVehiculos } from "../store/vehiculosSlice";
import { cargarClientes } from "../store/clientesSlice";
import { cargarModuloVentas } from "../store/ventasSlice";
import { navegar } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Panel, Vacio } from "../components/ui";
import { moneda, soloFecha } from "../components/formato";
import Icono from "../components/Icono";

/** Referencia estable: evita invalidar los useMemo en cada render. */
const SIN_DATOS = [];

/** Tablero de entrada: resumen operativo del MVP. */
export default function Inicio() {
  const dispatch = useDispatch();
  const usuario = useSelector((state) => state.auth.usuario);
  const { lista: vehiculos = [], alertas = [] } = useSelector((state) => state.vehiculos) ?? {};
  const clientes = useSelector((state) => state.clientes?.lista) ?? SIN_DATOS;
  const { cotizaciones = [], apartados = [] } = useSelector((state) => state.ventas) ?? {};
  const puedeVerVentas = useSelector((state) => tienePermiso(state, "ventas.ver"));
  const puedeVerClientes = useSelector((state) => tienePermiso(state, "clientes.ver"));
  const puedeVerVehiculos = useSelector((state) => tienePermiso(state, "vehiculos.ver"));
  // HU-13: la alerta de existencias esta dirigida a quien reordena unidades.
  const puedeGestionarInventario = useSelector((state) => tienePermiso(state, "vehiculos.gestionar"));

  useEffect(() => {
    if (puedeVerVehiculos) dispatch(cargarVehiculos({}));
    if (puedeVerClientes) dispatch(cargarClientes({}));
    if (puedeVerVentas) dispatch(cargarModuloVentas());
  }, [dispatch, puedeVerVehiculos, puedeVerClientes, puedeVerVentas]);

  // Cada indicador se muestra solo si el perfil puede abrir el modulo al que lleva.
  const indicadores = useMemo(
    () =>
      [
        { etiqueta: "Unidades disponibles", valor: vehiculos.filter((v) => v.estatus === "disponible").length, vista: "vehiculos", visible: puedeVerVehiculos },
        { etiqueta: "Unidades apartadas", valor: vehiculos.filter((v) => v.estatus === "apartado").length, vista: "ventas", visible: puedeVerVentas },
        { etiqueta: "Prospectos en cartera", valor: clientes.length, vista: "clientes", visible: puedeVerClientes },
        { etiqueta: "Cotizaciones vigentes", valor: cotizaciones.filter((c) => c.estatus === "vigente").length, vista: "ventas", visible: puedeVerVentas },
      ].filter((i) => i.visible),
    [vehiculos, clientes, cotizaciones, puedeVerVehiculos, puedeVerVentas, puedeVerClientes]
  );

  const apartadosVigentes = apartados.filter((a) => a.estatus === "vigente");

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>
            Perfil: {usuario?.rol?.nombre}. Este es el resumen operativo de la sucursal.
          </p>
        </div>
      </div>

      <div className="tablero-indicadores">
        {indicadores.map((i) => (
          <button key={i.etiqueta} className="indicador" onClick={() => dispatch(navegar(i.vista))}>
            <span className="indicador-valor">{i.valor}</span>
            <span className="indicador-etiqueta">{i.etiqueta}</span>
          </button>
        ))}
      </div>

      {puedeGestionarInventario && alertas.length > 0 && (
        <div className="alerta-inventario">
          <Icono nombre="alerta" tamano={20} />
          <div>
            <strong>Inventario bajo el minimo configurado</strong>
            <ul>
              {alertas.map((a) => (
                <li key={`${a.marca}-${a.modelo}`}>
                  {a.marca} {a.modelo}: {a.disponibles} disponible(s) de {a.minimo} requeridos
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {puedeVerVentas && (
        <Panel titulo="Apartados vigentes">
          {apartadosVigentes.length === 0 ? (
            <Vacio texto="No hay unidades apartadas en este momento." />
          ) : (
            <ul className="lista-simple">
              {apartadosVigentes.map((a) => (
                <li key={a.id}>
                  <span className="monoespaciado">{a.folio}</span>
                  <span>
                    {a.cliente?.nombre} {a.cliente?.apellidos}
                  </span>
                  <span>
                    {a.vehiculo?.marca} {a.vehiculo?.modelo}
                  </span>
                  <span>Anticipo {moneda(a.anticipo)}</span>
                  <span>Vence {soloFecha(a.fechaLimite)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
