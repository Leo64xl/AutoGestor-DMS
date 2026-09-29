import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  cargarPruebas,
  agendarPrueba,
  registrarIdentificacion,
  registrarResultado,
  cancelarPrueba,
  fijarFiltro,
} from "../store/pruebasSlice";
import { cargarVehiculos } from "../store/vehiculosSlice";
import { cargarClientes } from "../store/clientesSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { fechaHora, soloFecha } from "../components/formato";

/** Referencia estable: evita invalidar los useMemo en cada render. */
const SIN_DATOS = [];

const ESTATUS = {
  agendada: { texto: "Agendada", tipo: "aviso" },
  realizada: { texto: "Realizada", tipo: "exito" },
  cancelada: { texto: "Cancelada", tipo: "error" },
};

const RESULTADOS = {
  interesado: "Interesado",
  no_interesado: "No interesado",
  requiere_otra_unidad: "Requiere otra unidad",
};

const IDENTIFICACIONES = { ine: "INE", pasaporte: "Pasaporte", cedula: "Cedula profesional", otra: "Otra" };

/** Modulo de Pruebas de Manejo: RF-023 a RF-025 (UC-04). */
export default function PruebasManejo() {
  const dispatch = useDispatch();
  const { lista = [], filtros = {}, cargando } = useSelector((state) => state.pruebas) ?? {};
  const vehiculos = useSelector((state) => state.vehiculos?.lista) ?? SIN_DATOS;
  const clientes = useSelector((state) => state.clientes?.lista) ?? SIN_DATOS;
  const puedeGestionar = useSelector((state) => tienePermiso(state, "pruebas.gestionar"));

  const [agenda, setAgenda] = useState(null);
  const [identificacion, setIdentificacion] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    dispatch(cargarPruebas(filtros));
    dispatch(cargarVehiculos({}));
    dispatch(cargarClientes({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const buscar = (evento) => {
    evento.preventDefault();
    dispatch(cargarPruebas(filtros));
  };

  const guardarAgenda = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      agendarPrueba({
        clienteId: Number(agenda.clienteId),
        vehiculoId: Number(agenda.vehiculoId),
        fechaHora: agenda.fechaHora,
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Prueba ${accion.payload.folio} agendada; se notifico al vendedor asignado`));
      setAgenda(null);
    }
  };

  const guardarIdentificacion = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(registrarIdentificacion({ id: identificacion.id, datos: identificacion }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Identificacion y licencia registradas"));
      setIdentificacion(null);
    }
  };

  const guardarResultado = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(registrarResultado({ id: resultado.id, datos: resultado }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Resultado de la prueba registrado"));
      setResultado(null);
    }
  };

  const cancelar = async (prueba) => {
    const accion = await dispatch(cancelarPrueba({ id: prueba.id, motivo: "Cancelada por el cliente" }));
    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Prueba de manejo cancelada"));
  };

  const disponiblesParaPrueba = vehiculos.filter((v) => v.estatus !== "vendido");

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Pruebas de manejo</h1>
          <p>Agenda de citas, identificacion del cliente y resultado de cada prueba.</p>
        </div>
        {puedeGestionar && (
          <button
            className="boton boton-primario"
            onClick={() => setAgenda({ clienteId: "", vehiculoId: "", fechaHora: "" })}
          >
            Agendar prueba
          </button>
        )}
      </div>

      <Panel titulo="Filtros">
        <form className="rejilla-filtros" onSubmit={buscar}>
          <Campo etiqueta="Estatus">
            <select value={filtros.estatus} onChange={(e) => dispatch(fijarFiltro({ campo: "estatus", valor: e.target.value }))}>
              <option value="">Todos</option>
              {Object.entries(ESTATUS).map(([valor, { texto }]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Desde">
            <input type="date" value={filtros.desde} onChange={(e) => dispatch(fijarFiltro({ campo: "desde", valor: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Hasta">
            <input type="date" value={filtros.hasta} onChange={(e) => dispatch(fijarFiltro({ campo: "hasta", valor: e.target.value }))} />
          </Campo>
          <div className="acciones-filtros">
            <button type="submit" className="boton boton-primario">
              Buscar
            </button>
          </div>
        </form>
      </Panel>

      <Panel titulo={`Citas (${lista.length})`}>
        {cargando ? (
          <Vacio texto="Cargando pruebas de manejo..." />
        ) : lista.length === 0 ? (
          <Vacio texto="No hay pruebas de manejo registradas." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha y hora</th>
                  <th>Cliente</th>
                  <th>Vehiculo</th>
                  <th>Identificacion</th>
                  <th>Resultado</th>
                  <th>Estatus</th>
                  {puedeGestionar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const e = ESTATUS[p.estatus] || { texto: p.estatus, tipo: "neutro" };
                  return (
                    <tr key={p.id}>
                      <td className="monoespaciado">{p.folio}</td>
                      <td>{fechaHora(p.fechaHora)}</td>
                      <td>
                        {p.cliente?.nombre} {p.cliente?.apellidos}
                      </td>
                      <td>
                        {p.vehiculo?.marca} {p.vehiculo?.modelo} {p.vehiculo?.anio}
                        <br />
                        <small className="monoespaciado">{p.vehiculo?.vin}</small>
                      </td>
                      <td>
                        {p.licenciaNumero ? (
                          <>
                            {IDENTIFICACIONES[p.identificacionTipo]} {p.identificacionNumero}
                            <br />
                            <small>Licencia {p.licenciaNumero} · vence {soloFecha(p.licenciaVigencia)}</small>
                          </>
                        ) : (
                          <small>Pendiente</small>
                        )}
                      </td>
                      <td>
                        {p.resultado ? RESULTADOS[p.resultado] : "—"}
                        {p.observaciones && (
                          <>
                            <br />
                            <small>{p.observaciones}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <Etiqueta valor={e.texto} tipo={e.tipo} />
                      </td>
                      {puedeGestionar && (
                        <td className="celda-acciones">
                          {p.estatus === "agendada" && (
                            <>
                              {/* RF-024 */}
                              {!p.licenciaNumero && (
                                <button
                                  className="boton boton-texto"
                                  onClick={() =>
                                    setIdentificacion({
                                      id: p.id,
                                      identificacionTipo: "ine",
                                      identificacionNumero: "",
                                      licenciaNumero: "",
                                      licenciaVigencia: "",
                                    })
                                  }
                                >
                                  Registrar identificacion
                                </button>
                              )}
                              {/* RF-025 */}
                              {p.licenciaNumero && (
                                <button
                                  className="boton boton-texto"
                                  onClick={() => setResultado({ id: p.id, resultado: "interesado", observaciones: "" })}
                                >
                                  Registrar resultado
                                </button>
                              )}
                              <button className="boton boton-texto peligro" onClick={() => cancelar(p)}>
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

      {agenda && (
        <Modal titulo="Agendar prueba de manejo" onCerrar={() => setAgenda(null)}>
          <form className="rejilla-formulario" onSubmit={guardarAgenda}>
            <Campo etiqueta="Cliente">
              <select value={agenda.clienteId} onChange={(e) => setAgenda({ ...agenda, clienteId: e.target.value })} required>
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellidos}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Vehiculo">
              <select value={agenda.vehiculoId} onChange={(e) => setAgenda({ ...agenda, vehiculoId: e.target.value })} required>
                <option value="">Selecciona un vehiculo</option>
                {disponiblesParaPrueba.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.anio} — {v.color}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fecha y hora de la cita" ancho={2}>
              <input
                type="datetime-local"
                value={agenda.fechaHora}
                onChange={(e) => setAgenda({ ...agenda, fechaHora: e.target.value })}
                required
              />
            </Campo>
            <p className="nota">
              El sistema valida que no exista otra prueba agendada para la misma unidad en ese horario.
            </p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setAgenda(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Agendar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {identificacion && (
        <Modal titulo="Identificacion y licencia del cliente" onCerrar={() => setIdentificacion(null)}>
          <form className="rejilla-formulario" onSubmit={guardarIdentificacion}>
            <Campo etiqueta="Tipo de identificacion">
              <select
                value={identificacion.identificacionTipo}
                onChange={(e) => setIdentificacion({ ...identificacion, identificacionTipo: e.target.value })}
              >
                {Object.entries(IDENTIFICACIONES).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Numero de identificacion">
              <input
                value={identificacion.identificacionNumero}
                onChange={(e) => setIdentificacion({ ...identificacion, identificacionNumero: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Numero de licencia">
              <input
                value={identificacion.licenciaNumero}
                onChange={(e) => setIdentificacion({ ...identificacion, licenciaNumero: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Vigencia de la licencia">
              <input
                type="date"
                value={identificacion.licenciaVigencia}
                onChange={(e) => setIdentificacion({ ...identificacion, licenciaVigencia: e.target.value })}
                required
              />
            </Campo>
            <p className="nota">Si la licencia esta vencida la prueba no puede realizarse y debe cancelarse indicando el motivo.</p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setIdentificacion(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resultado && (
        <Modal titulo="Resultado de la prueba de manejo" onCerrar={() => setResultado(null)}>
          <form className="rejilla-formulario" onSubmit={guardarResultado}>
            <Campo etiqueta="Resultado" ancho={2}>
              <select value={resultado.resultado} onChange={(e) => setResultado({ ...resultado, resultado: e.target.value })}>
                {Object.entries(RESULTADOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Observaciones" ancho={2}>
              <textarea
                rows="3"
                value={resultado.observaciones}
                onChange={(e) => setResultado({ ...resultado, observaciones: e.target.value })}
              />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setResultado(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar resultado
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
