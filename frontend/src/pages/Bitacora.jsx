import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarBitacora, fijarFiltro, limpiarFiltros } from "../store/bitacoraSlice";
import { Campo, Panel, Vacio } from "../components/ui";
import { fechaHora } from "../components/formato";

/** RF-040 / RNF-012 (HU-12): consulta de la bitacora en modo de solo lectura. */
export default function Bitacora() {
  const dispatch = useDispatch();
  const { lista = [], filtros = {}, cargando } = useSelector((state) => state.bitacora) ?? {};

  useEffect(() => {
    dispatch(cargarBitacora(filtros));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const cambiarFiltro = (campo) => (evento) => dispatch(fijarFiltro({ campo, valor: evento.target.value }));

  const buscar = (evento) => {
    evento.preventDefault();
    dispatch(cargarBitacora(filtros));
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Bitacora de eventos</h1>
          <p>Registro inmutable de las operaciones del sistema. Esta vista es de solo lectura.</p>
        </div>
      </div>

      <Panel titulo="Filtros">
        <form className="rejilla-filtros" onSubmit={buscar}>
          <Campo etiqueta="Usuario">
            <input value={filtros.usuario} onChange={cambiarFiltro("usuario")} />
          </Campo>
          <Campo etiqueta="Accion">
            <input value={filtros.accion} onChange={cambiarFiltro("accion")} placeholder="LOGIN, ALTA_VEHICULO..." />
          </Campo>
          <Campo etiqueta="Entidad">
            <select value={filtros.entidad} onChange={cambiarFiltro("entidad")}>
              <option value="">Todas</option>
              <option value="usuario">Usuario</option>
              <option value="vehiculo">Vehiculo</option>
              <option value="cliente">Cliente</option>
              <option value="cotizacion">Cotizacion</option>
              <option value="apartado">Apartado</option>
            </select>
          </Campo>
          <Campo etiqueta="Desde">
            <input type="date" value={filtros.desde} onChange={cambiarFiltro("desde")} />
          </Campo>
          <Campo etiqueta="Hasta">
            <input type="date" value={filtros.hasta} onChange={cambiarFiltro("hasta")} />
          </Campo>
          <div className="acciones-filtros">
            <button type="submit" className="boton boton-primario">
              Buscar
            </button>
            <button
              type="button"
              className="boton"
              onClick={() => {
                dispatch(limpiarFiltros());
                dispatch(cargarBitacora({}));
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </Panel>

      <Panel titulo={`Eventos (${lista.length})`}>
        <p className="nota">
          Los registros no pueden editarse ni eliminarse desde la interfaz: el sistema no expone ninguna accion de escritura sobre la
          bitacora.
        </p>
        {cargando ? (
          <Vacio texto="Cargando bitacora..." />
        ) : lista.length === 0 ? (
          <Vacio texto="No hay eventos que cumplan los filtros aplicados." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td>{fechaHora(e.createdAt)}</td>
                    <td className="monoespaciado">{e.usuarioNombre || "—"}</td>
                    <td>
                      <span className="monoespaciado">{e.accion}</span>
                    </td>
                    <td>
                      {e.entidad || "—"}
                      {e.entidadId ? ` #${e.entidadId}` : ""}
                    </td>
                    <td>{e.detalle || "—"}</td>
                    <td className="monoespaciado">{e.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
