import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarClientes, crearCliente, editarCliente, fijarFiltro, cargarCatalogosSat } from "../store/clientesSlice";
import { mostrarAviso, navegar } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { ESTATUS_CLIENTE, ORIGEN_CLIENTE } from "../components/formato";

const FORMULARIO_VACIO = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  origen: "showroom",
  rfc: "",
  razonSocial: "",
  regimenFiscal: "",
  codigoPostalFiscal: "",
  usoCfdi: "",
};

/** Referencia estable mientras el store no trae los catalogos del SAT. */
const CATALOGOS_VACIOS = { regimenesFiscales: [], usosCfdi: [] };

/** Modulo de Clientes y Prospectos: RF-013 a RF-017. */
export default function Clientes() {
  const dispatch = useDispatch();
  const { lista = [], filtros = {}, catalogosSat = CATALOGOS_VACIOS, cargando } = useSelector((state) => state.clientes) ?? {};
  const puedeGestionar = useSelector((state) => tienePermiso(state, "clientes.gestionar"));
  const [formulario, setFormulario] = useState(null);

  useEffect(() => {
    dispatch(cargarClientes(filtros));
    dispatch(cargarCatalogosSat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const buscar = (evento) => {
    evento.preventDefault();
    dispatch(cargarClientes(filtros));
  };

  const cambiarFiltro = (campo) => (evento) => dispatch(fijarFiltro({ campo, valor: evento.target.value }));

  const guardar = async (evento) => {
    evento.preventDefault();
    const accion = formulario.id
      ? await dispatch(editarCliente({ id: formulario.id, datos: formulario }))
      : await dispatch(crearCliente(formulario));

    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(formulario.id ? "Cliente actualizado" : "Prospecto registrado con estatus \"nuevo\""));
      setFormulario(null);
    }
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Clientes y prospectos</h1>
          <p>Registro, origen de contacto y seguimiento comercial.</p>
        </div>
        {puedeGestionar && (
          <button className="boton boton-primario" onClick={() => setFormulario({ ...FORMULARIO_VACIO })}>
            Registrar prospecto
          </button>
        )}
      </div>

      <Panel titulo="Busqueda">
        <form className="rejilla-filtros" onSubmit={buscar}>
          <Campo etiqueta="Nombre, correo o telefono" ancho={2}>
            <input value={filtros.busqueda} onChange={cambiarFiltro("busqueda")} placeholder="Buscar..." />
          </Campo>
          <Campo etiqueta="Estatus">
            <select value={filtros.estatus} onChange={cambiarFiltro("estatus")}>
              <option value="">Todos</option>
              {Object.entries(ESTATUS_CLIENTE).map(([valor, { texto }]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Origen">
            <select value={filtros.origen} onChange={cambiarFiltro("origen")}>
              <option value="">Todos</option>
              {Object.entries(ORIGEN_CLIENTE).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </Campo>
          <div className="acciones-filtros">
            <button type="submit" className="boton boton-primario">
              Buscar
            </button>
          </div>
        </form>
      </Panel>

      <Panel titulo={`Cartera (${lista.length})`}>
        {cargando ? (
          <Vacio texto="Cargando cartera..." />
        ) : lista.length === 0 ? (
          <Vacio texto="No hay clientes o prospectos que cumplan la busqueda." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Origen</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const estatus = ESTATUS_CLIENTE[c.estatus] || { texto: c.estatus, tipo: "neutro" };
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>
                          {c.nombre} {c.apellidos}
                        </strong>
                      </td>
                      <td>
                        {c.email || "—"}
                        <br />
                        <small>{c.telefono || "sin telefono"}</small>
                      </td>
                      <td>{ORIGEN_CLIENTE[c.origen] || c.origen}</td>
                      <td>
                        <Etiqueta valor={estatus.texto} tipo={estatus.tipo} />
                      </td>
                      <td className="celda-acciones">
                        <button
                          className="boton boton-texto"
                          onClick={() => dispatch(navegar({ vista: "cliente", parametro: c.id }))}
                        >
                          Ver historial
                        </button>
                        {puedeGestionar && (
                          <button className="boton boton-texto" onClick={() => setFormulario({ ...c })}>
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {formulario && (
        <Modal titulo={formulario.id ? "Editar cliente" : "Registrar prospecto"} onCerrar={() => setFormulario(null)}>
          <form className="rejilla-formulario" onSubmit={guardar}>
            <Campo etiqueta="Nombre(s)">
              <input value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Apellidos">
              <input value={formulario.apellidos} onChange={(e) => setFormulario({ ...formulario, apellidos: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Correo electronico">
              <input type="email" value={formulario.email || ""} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} />
            </Campo>
            <Campo etiqueta="Telefono">
              <input value={formulario.telefono || ""} onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} />
            </Campo>
            {/* RF-014 */}
            <Campo etiqueta="Origen del prospecto" ancho={2}>
              <select value={formulario.origen} onChange={(e) => setFormulario({ ...formulario, origen: e.target.value })}>
                {Object.entries(ORIGEN_CLIENTE).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <p className="nota">Captura al menos un dato de contacto: correo electronico o telefono.</p>

            {/* RF-028: datos que el SAT exige del receptor para timbrar el CFDI 4.0. */}
            <div className="grupo-accesorios">
              <span className="etiqueta-grupo">Datos fiscales (necesarios para facturar)</span>
            </div>
            <Campo etiqueta="RFC">
              <input
                value={formulario.rfc || ""}
                onChange={(e) => setFormulario({ ...formulario, rfc: e.target.value.toUpperCase() })}
                placeholder="XAXX010101000"
                maxLength={13}
                className="monoespaciado"
              />
            </Campo>
            <Campo etiqueta="Codigo postal fiscal">
              <input
                value={formulario.codigoPostalFiscal || ""}
                onChange={(e) => setFormulario({ ...formulario, codigoPostalFiscal: e.target.value })}
                placeholder="42780"
                maxLength={5}
                inputMode="numeric"
              />
            </Campo>
            <Campo etiqueta="Nombre o razon social fiscal" ancho={2}>
              <input
                value={formulario.razonSocial || ""}
                onChange={(e) => setFormulario({ ...formulario, razonSocial: e.target.value.toUpperCase() })}
                placeholder="Tal como aparece en la constancia de situacion fiscal"
              />
            </Campo>
            <Campo etiqueta="Regimen fiscal">
              <select
                value={formulario.regimenFiscal || ""}
                onChange={(e) => setFormulario({ ...formulario, regimenFiscal: e.target.value })}
              >
                <option value="">Sin capturar</option>
                {(catalogosSat.regimenesFiscales || []).map((r) => (
                  <option key={r.clave} value={r.clave}>
                    {r.clave} · {r.descripcion}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Uso del CFDI">
              <select value={formulario.usoCfdi || ""} onChange={(e) => setFormulario({ ...formulario, usoCfdi: e.target.value })}>
                <option value="">Sin capturar</option>
                {(catalogosSat.usosCfdi || []).map((u) => (
                  <option key={u.clave} value={u.clave}>
                    {u.clave} · {u.descripcion}
                  </option>
                ))}
              </select>
            </Campo>
            <p className="nota">
              Puedes dejarlos vacios mientras sea un prospecto. Se vuelven obligatorios al timbrar la factura de una venta.
            </p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setFormulario(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
