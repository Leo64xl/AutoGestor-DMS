import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarModuloVentas, crearCotizacion, cancelarCotizacion, crearApartado, cancelarApartado } from "../store/ventasSlice";
import { cargarVehiculos } from "../store/vehiculosSlice";
import { cargarClientes } from "../store/clientesSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { moneda, soloFecha, ESTATUS_OPERACION } from "../components/formato";

/** Referencia estable: evita invalidar los useMemo en cada render. */
const SIN_DATOS = [];

function enDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Modulo de Cotizaciones y Apartados: RF-018 a RF-022 (UC-01, UC-02). */
export default function Ventas() {
  const dispatch = useDispatch();
  const { cotizaciones = [], apartados = [], accesorios = [], cargando } = useSelector((state) => state.ventas) ?? {};
  const vehiculos = useSelector((state) => state.vehiculos?.lista) ?? SIN_DATOS;
  const clientes = useSelector((state) => state.clientes?.lista) ?? SIN_DATOS;
  const puedeGestionar = useSelector((state) => tienePermiso(state, "ventas.gestionar"));

  const [pestania, setPestania] = useState("cotizaciones");
  const [formCotizacion, setFormCotizacion] = useState(null);
  const [formApartado, setFormApartado] = useState(null);

  useEffect(() => {
    dispatch(cargarModuloVentas());
    dispatch(cargarVehiculos({ estatus: "disponible" }));
    dispatch(cargarClientes({}));
  }, [dispatch]);

  const disponibles = useMemo(() => vehiculos.filter((v) => v.estatus === "disponible"), [vehiculos]);

  /* ----------------------------- Cotizacion (UC-01) ----------------------------- */

  const abrirCotizacion = () =>
    setFormCotizacion({ clienteId: "", vehiculoId: "", formaPago: "contado", diasVigencia: 15, accesorios: {} });

  const vehiculoSeleccionado = formCotizacion ? disponibles.find((v) => v.id === Number(formCotizacion.vehiculoId)) : null;

  // Se extrae con encadenamiento opcional porque el React Compiler toma las
  // dependencias del useMemo a nivel de propiedad y las lee fuera del callback:
  // referirse ahi a formCotizacion.accesorios falla cuando el formulario esta cerrado.
  const seleccionAccesorios = formCotizacion?.accesorios ?? null;

  const totalCotizacion = useMemo(() => {
    if (!seleccionAccesorios) return 0;
    const base = Number(vehiculoSeleccionado?.precio || 0);
    const extras = accesorios
      .filter((a) => seleccionAccesorios[a.id])
      .reduce((suma, a) => suma + Number(a.precio) * seleccionAccesorios[a.id], 0);
    return base + extras;
  }, [seleccionAccesorios, vehiculoSeleccionado, accesorios]);

  const alternarAccesorio = (id) => {
    const seleccion = { ...formCotizacion.accesorios };
    if (seleccion[id]) delete seleccion[id];
    else seleccion[id] = 1;
    setFormCotizacion({ ...formCotizacion, accesorios: seleccion });
  };

  const guardarCotizacion = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      crearCotizacion({
        clienteId: Number(formCotizacion.clienteId),
        vehiculoId: Number(formCotizacion.vehiculoId),
        formaPago: formCotizacion.formaPago,
        diasVigencia: Number(formCotizacion.diasVigencia),
        accesorios: Object.entries(formCotizacion.accesorios).map(([accesorioId, cantidad]) => ({
          accesorioId: Number(accesorioId),
          cantidad,
        })),
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Cotizacion ${accion.payload.folio} generada por ${moneda(accion.payload.total)}`));
      setFormCotizacion(null);
    }
  };

  /* ------------------------------ Apartado (UC-02) ------------------------------ */

  const abrirApartado = (cotizacion) =>
    setFormApartado({
      cotizacionId: cotizacion?.id || "",
      vehiculoId: cotizacion ? "" : "",
      clienteId: cotizacion ? "" : "",
      anticipo: "",
      fechaLimite: enDias(7),
      cotizacion,
    });

  const guardarApartado = async (evento) => {
    evento.preventDefault();
    const cuerpo = formApartado.cotizacionId
      ? { cotizacionId: Number(formApartado.cotizacionId), anticipo: Number(formApartado.anticipo), fechaLimite: formApartado.fechaLimite }
      : {
          vehiculoId: Number(formApartado.vehiculoId),
          clienteId: Number(formApartado.clienteId),
          anticipo: Number(formApartado.anticipo),
          fechaLimite: formApartado.fechaLimite,
        };

    const accion = await dispatch(crearApartado(cuerpo));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Apartado ${accion.payload.folio} registrado; el vehiculo quedo reservado`));
      setFormApartado(null);
      dispatch(cargarVehiculos({ estatus: "disponible" }));
    }
  };

  const cancelar = async (apartado) => {
    const motivo = "Cancelacion solicitada por el cliente";
    const accion = await dispatch(cancelarApartado({ id: apartado.id, motivo }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Apartado cancelado; el vehiculo volvio a estar disponible"));
      dispatch(cargarVehiculos({ estatus: "disponible" }));
    }
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Cotizaciones y apartados</h1>
          <p>Generacion de cotizaciones con accesorios y reservacion de unidades.</p>
        </div>
        {puedeGestionar && (
          <div className="panel-acciones">
            <button className="boton" onClick={() => abrirApartado(null)}>
              Apartado directo
            </button>
            <button className="boton boton-primario" onClick={abrirCotizacion}>
              Nueva cotizacion
            </button>
          </div>
        )}
      </div>

      <nav className="pestanias">
        <button className={pestania === "cotizaciones" ? "activa" : ""} onClick={() => setPestania("cotizaciones")}>
          Cotizaciones ({cotizaciones.length})
        </button>
        <button className={pestania === "apartados" ? "activa" : ""} onClick={() => setPestania("apartados")}>
          Apartados ({apartados.length})
        </button>
      </nav>

      {cargando && <Vacio texto="Cargando operaciones..." />}

      {!cargando && pestania === "cotizaciones" && (
        <Panel>
          {cotizaciones.length === 0 ? (
            <Vacio texto="Aun no se han generado cotizaciones." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Vehiculo</th>
                    <th>Accesorios</th>
                    <th className="derecha">Total</th>
                    <th>Vigencia</th>
                    <th>Estatus</th>
                    {puedeGestionar && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((c) => {
                    const e = ESTATUS_OPERACION[c.estatus] || { texto: c.estatus, tipo: "neutro" };
                    return (
                      <tr key={c.id}>
                        <td className="monoespaciado">{c.folio}</td>
                        <td>
                          {c.cliente?.nombre} {c.cliente?.apellidos}
                        </td>
                        <td>
                          {c.vehiculo?.marca} {c.vehiculo?.modelo} {c.vehiculo?.anio}
                          <br />
                          <small className="monoespaciado">{c.vehiculo?.vin}</small>
                        </td>
                        <td>
                          {c.detalleAccesorios?.length ? (
                            <ul className="lista-accesorios">
                              {c.detalleAccesorios.map((d) => (
                                <li key={d.id}>
                                  {d.accesorio?.nombre} ×{d.cantidad}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="derecha">
                          <strong>{moneda(c.total)}</strong>
                        </td>
                        <td>{soloFecha(c.vigenciaHasta)}</td>
                        <td>
                          <Etiqueta valor={e.texto} tipo={e.tipo} />
                        </td>
                        {puedeGestionar && (
                          <td className="celda-acciones">
                            {c.estatus === "vigente" && (
                              <>
                                <button className="boton boton-texto" onClick={() => abrirApartado(c)}>
                                  Apartar
                                </button>
                                <button
                                  className="boton boton-texto peligro"
                                  onClick={async () => {
                                    const accion = await dispatch(cancelarCotizacion(c.id));
                                    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Cotizacion cancelada"));
                                  }}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {!cargando && pestania === "apartados" && (
        <Panel>
          {apartados.length === 0 ? (
            <Vacio texto="Aun no se han registrado apartados." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Vehiculo</th>
                    <th className="derecha">Anticipo</th>
                    <th>Fecha limite</th>
                    <th>Estatus</th>
                    {puedeGestionar && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {apartados.map((a) => {
                    const e = ESTATUS_OPERACION[a.estatus] || { texto: a.estatus, tipo: "neutro" };
                    return (
                      <tr key={a.id}>
                        <td className="monoespaciado">{a.folio}</td>
                        <td>
                          {a.cliente?.nombre} {a.cliente?.apellidos}
                        </td>
                        <td>
                          {a.vehiculo?.marca} {a.vehiculo?.modelo}
                          <br />
                          <small className="monoespaciado">{a.vehiculo?.vin}</small>
                        </td>
                        <td className="derecha">{moneda(a.anticipo)}</td>
                        <td>{soloFecha(a.fechaLimite)}</td>
                        <td>
                          <Etiqueta valor={e.texto} tipo={e.tipo} />
                        </td>
                        {puedeGestionar && (
                          <td className="celda-acciones">
                            {/* RF-022 */}
                            {a.estatus === "vigente" && (
                              <button className="boton boton-texto peligro" onClick={() => cancelar(a)}>
                                Cancelar y liberar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {formCotizacion && (
        <Modal titulo="Nueva cotizacion" onCerrar={() => setFormCotizacion(null)}>
          <form className="rejilla-formulario" onSubmit={guardarCotizacion}>
            <Campo etiqueta="Cliente" ancho={2}>
              <select
                value={formCotizacion.clienteId}
                onChange={(e) => setFormCotizacion({ ...formCotizacion, clienteId: e.target.value })}
                required
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellidos}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Vehiculo disponible" ancho={2}>
              <select
                value={formCotizacion.vehiculoId}
                onChange={(e) => setFormCotizacion({ ...formCotizacion, vehiculoId: e.target.value })}
                required
              >
                <option value="">Selecciona un vehiculo</option>
                {disponibles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.anio} — {v.color} — {moneda(v.precio)}
                  </option>
                ))}
              </select>
            </Campo>

            {/* RF-019 */}
            <div className="grupo-accesorios">
              <span className="etiqueta-grupo">Accesorios y paquetes opcionales</span>
              {accesorios.map((a) => (
                <label key={a.id} className="opcion-accesorio">
                  <input
                    type="checkbox"
                    checked={Boolean(seleccionAccesorios?.[a.id])}
                    onChange={() => alternarAccesorio(a.id)}
                  />
                  <span>{a.nombre}</span>
                  <span className="precio-accesorio">{moneda(a.precio)}</span>
                </label>
              ))}
            </div>

            <Campo etiqueta="Forma de pago">
              <select
                value={formCotizacion.formaPago}
                onChange={(e) => setFormCotizacion({ ...formCotizacion, formaPago: e.target.value })}
              >
                <option value="contado">Contado</option>
                <option value="financiamiento">Financiamiento</option>
              </select>
            </Campo>
            <Campo etiqueta="Vigencia (dias)">
              <input
                type="number"
                min="1"
                max="90"
                value={formCotizacion.diasVigencia}
                onChange={(e) => setFormCotizacion({ ...formCotizacion, diasVigencia: e.target.value })}
              />
            </Campo>

            <div className="resumen-total">
              <span>Total de la cotizacion</span>
              <strong>{moneda(totalCotizacion)}</strong>
            </div>

            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setFormCotizacion(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Generar cotizacion
              </button>
            </div>
          </form>
        </Modal>
      )}

      {formApartado && (
        <Modal titulo="Registrar apartado" onCerrar={() => setFormApartado(null)}>
          <form className="rejilla-formulario" onSubmit={guardarApartado}>
            {formApartado.cotizacion ? (
              <p className="nota" style={{ gridColumn: "span 2" }}>
                Cotizacion <strong>{formApartado.cotizacion.folio}</strong> — {formApartado.cotizacion.cliente?.nombre}{" "}
                {formApartado.cotizacion.cliente?.apellidos} — {formApartado.cotizacion.vehiculo?.marca}{" "}
                {formApartado.cotizacion.vehiculo?.modelo} por {moneda(formApartado.cotizacion.total)}
              </p>
            ) : (
              <>
                <Campo etiqueta="Cliente">
                  <select
                    value={formApartado.clienteId}
                    onChange={(e) => setFormApartado({ ...formApartado, clienteId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellidos}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Vehiculo disponible">
                  <select
                    value={formApartado.vehiculoId}
                    onChange={(e) => setFormApartado({ ...formApartado, vehiculoId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona un vehiculo</option>
                    {disponibles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} {v.anio} — {moneda(v.precio)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </>
            )}

            {/* RF-020 */}
            <Campo etiqueta="Monto del anticipo">
              <input
                type="number"
                min="1"
                step="0.01"
                value={formApartado.anticipo}
                onChange={(e) => setFormApartado({ ...formApartado, anticipo: e.target.value })}
                required
              />
            </Campo>
            {/* RF-021 */}
            <Campo etiqueta="Fecha limite del apartado">
              <input
                type="date"
                min={enDias(1)}
                value={formApartado.fechaLimite}
                onChange={(e) => setFormApartado({ ...formApartado, fechaLimite: e.target.value })}
                required
              />
            </Campo>

            <p className="nota" style={{ gridColumn: "span 2" }}>
              Al vencer la fecha limite sin formalizar la venta, el sistema libera el vehiculo automaticamente.
            </p>

            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setFormApartado(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Registrar apartado
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
