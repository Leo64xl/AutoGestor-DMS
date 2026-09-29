import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  cargarVehiculos,
  crearVehiculo,
  editarVehiculo,
  cambiarEstatusVehiculo,
  darDeBajaVehiculo,
  fijarFiltro,
  limpiarFiltros,
  cargarOpciones,
} from "../store/vehiculosSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import Icono from "../components/Icono";
import SubidaFotos from "../components/SubidaFotos";
import DetalleVehiculo from "../components/DetalleVehiculo";
import { eliminar, urlArchivo } from "../api/client";
import { moneda, ESTATUS_VEHICULO } from "../components/formato";

const FORMULARIO_VACIO = { vin: "", marca: "", modelo: "", anio: "", color: "", precio: "", fichaTecnica: "", fotos: [] };

/** Referencia estable para cuando el store aun no trae las opciones. */
const OPCIONES_VACIAS = { marcas: [], modelos: [], colores: [], anios: [], modelosPorMarca: {} };

const ORDENES = [
  ["relevancia", "Marca y modelo"],
  ["precio_asc", "Precio: menor a mayor"],
  ["precio_desc", "Precio: mayor a menor"],
  ["anio_desc", "Anio: mas reciente"],
  ["anio_asc", "Anio: mas antiguo"],
];

/** Modulo de Vehiculos e Inventario: RF-007 a RF-012 (UC-05). */
export default function Vehiculos() {
  const dispatch = useDispatch();
  const {
    lista = [],
    alertas = [],
    filtros = {},
    opciones = OPCIONES_VACIAS,
    cargando,
  } = useSelector((state) => state.vehiculos) ?? {};
  const puedeGestionar = useSelector((state) => tienePermiso(state, "vehiculos.gestionar"));

  const [formulario, setFormulario] = useState(null); // null | FORMULARIO_VACIO | vehiculo
  const [baja, setBaja] = useState(null);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [validacion, setValidacion] = useState(null);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    dispatch(cargarVehiculos(filtros));
    dispatch(cargarOpciones());
    // Solo en el montaje: los filtros se aplican con el boton "Buscar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Al elegir una marca, el desplegable de modelos se acota a los de esa marca.
  const modelosDisponibles = filtros.marca ? opciones.modelosPorMarca?.[filtros.marca] || [] : opciones.modelos || [];

  const filtrosActivos = Object.entries(filtros).filter(
    ([campo, valor]) => campo !== "orden" && valor !== "" && valor != null
  ).length;

  const buscar = (evento) => {
    evento.preventDefault();
    // Se valida antes de pedir para responder de inmediato y no gastar una consulta.
    const min = Number(filtros.precioMin);
    const max = Number(filtros.precioMax);
    if (filtros.precioMin && filtros.precioMax && min > max) {
      return setValidacion("El precio minimo no puede ser mayor al precio maximo.");
    }
    setValidacion(null);
    dispatch(cargarVehiculos(filtros));
  };

  const limpiar = () => {
    setValidacion(null);
    dispatch(limpiarFiltros());
    dispatch(cargarVehiculos({}));
  };

  const cambiarFiltro = (campo) => (evento) => {
    setValidacion(null);
    dispatch(fijarFiltro({ campo, valor: evento.target.value }));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const datos = {
      ...formulario,
      anio: Number(formulario.anio),
      precio: Number(formulario.precio),
      fotos: formulario.fotos || [],
    };

    const accion = formulario.id
      ? await dispatch(editarVehiculo({ id: formulario.id, datos }))
      : await dispatch(crearVehiculo(datos));

    if (accion.meta.requestStatus === "fulfilled") {
      // Las imagenes que el usuario quito del formulario ya no pertenecen a
      // ninguna ficha: se borran del disco para no dejar archivos huerfanos.
      const retiradas = (formulario.fotosOriginales || []).filter((f) => !datos.fotos.includes(f));
      await Promise.all(retiradas.map((url) => eliminar("/vehiculos/fotos", { url }).catch(() => null)));

      dispatch(mostrarAviso(formulario.id ? "Vehiculo actualizado" : "Vehiculo registrado en el inventario"));
      setFormulario(null);
      setDetalle(null);
    }
  };

  const confirmarBaja = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(darDeBajaVehiculo({ id: baja.id, motivo: motivoBaja }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Vehiculo dado de baja; su historial se conserva"));
      setBaja(null);
      setMotivoBaja("");
    }
  };

  const cambiarEstatus = async (vehiculo, estatus) => {
    const accion = await dispatch(cambiarEstatusVehiculo({ id: vehiculo.id, estatus }));
    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Estatus actualizado"));
  };

  const abrirEdicion = (vehiculo) => {
    setDetalle(null);
    setFormulario({
      ...vehiculo,
      fichaTecnica: vehiculo.fichaTecnica || "",
      fotos: vehiculo.fotos || [],
      // Copia de referencia para saber que imagenes se quitaron al guardar.
      fotosOriginales: vehiculo.fotos || [],
    });
  };

  const abrirBaja = (vehiculo) => {
    setDetalle(null);
    setBaja(vehiculo);
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Vehiculos e inventario</h1>
          <p>{puedeGestionar ? "Catalogo, disponibilidad y alertas de existencias." : "Catalogo y disponibilidad de unidades para ofrecer al cliente."}</p>
        </div>
        {puedeGestionar && (
          <button className="boton boton-primario" onClick={() => setFormulario({ ...FORMULARIO_VACIO })}>
            Registrar vehiculo
          </button>
        )}
      </div>

      {/* RF-012 / HU-13: dirigida al perfil que reordena unidades, no al vendedor. */}
      {puedeGestionar && alertas.length > 0 && (
        <div className="alerta-inventario">
          <Icono nombre="alerta" tamano={20} />
          <div>
            <strong>Inventario bajo el minimo</strong>
            <ul>
              {alertas.map((a) => (
                <li key={`${a.marca}-${a.modelo}`}>
                  {a.marca} {a.modelo}: {a.disponibles} disponible(s), minimo configurado {a.minimo}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* RF-009 */}
      <Panel titulo="Buscar en el catalogo">
        <form onSubmit={buscar}>
          {/* Busqueda libre: abarca marca, modelo, VIN y color en una sola caja. */}
          <div className="barra-busqueda">
            <span className="barra-busqueda-campo">
              <Icono nombre="buscar" tamano={18} />
              <input
                type="search"
                value={filtros.busqueda}
                onChange={cambiarFiltro("busqueda")}
                placeholder="Buscar por marca, modelo, VIN o color..."
                aria-label="Busqueda libre en el catalogo"
              />
            </span>
            <button type="submit" className="boton boton-primario">
              Buscar
            </button>
            <button type="button" className="boton" onClick={limpiar} disabled={filtrosActivos === 0 && filtros.orden === "relevancia"}>
              Limpiar
            </button>
          </div>

          {/* RF-009: filtros por marca, modelo, precio, anio y estatus. */}
          <div className="rejilla-filtros">
            <Campo etiqueta="Marca">
              <select value={filtros.marca} onChange={cambiarFiltro("marca")}>
                <option value="">Todas</option>
                {(opciones.marcas || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Modelo">
              <select value={filtros.modelo} onChange={cambiarFiltro("modelo")}>
                <option value="">Todos</option>
                {modelosDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Anio">
              <select value={filtros.anio} onChange={cambiarFiltro("anio")}>
                <option value="">Todos</option>
                {(opciones.anios || []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Color">
              <select value={filtros.color} onChange={cambiarFiltro("color")}>
                <option value="">Todos</option>
                {(opciones.colores || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Estatus">
              <select value={filtros.estatus} onChange={cambiarFiltro("estatus")}>
                <option value="">Todos</option>
                {Object.entries(ESTATUS_VEHICULO).map(([valor, { texto }]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Precio desde">
              <input type="number" min="0" step="1000" value={filtros.precioMin} onChange={cambiarFiltro("precioMin")} placeholder="Sin minimo" />
            </Campo>
            <Campo etiqueta="Precio hasta">
              <input type="number" min="0" step="1000" value={filtros.precioMax} onChange={cambiarFiltro("precioMax")} placeholder="Sin maximo" />
            </Campo>
            <Campo etiqueta="Ordenar por">
              <select value={filtros.orden} onChange={cambiarFiltro("orden")}>
                {ORDENES.map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {validacion && <p className="mensaje-error mensaje-filtros">{validacion}</p>}
        </form>
      </Panel>

      {cargando ? (
        <Panel>
          <Vacio texto="Cargando catalogo..." icono="auto" />
        </Panel>
      ) : lista.length === 0 ? (
        <Panel>
          <Vacio texto="Ningun vehiculo cumple los filtros aplicados." icono="buscar" />
          {filtrosActivos > 0 && (
            <div className="panel-acciones" style={{ justifyContent: "center", paddingBottom: 4 }}>
              <button type="button" className="boton" onClick={limpiar}>
                Limpiar los filtros
              </button>
            </div>
          )}
        </Panel>
      ) : (
        /* El catalogo se presenta como fichas: es la vista que el vendedor usa
           frente al cliente, donde la unidad y su precio pesan mas que la tabla. */
        <>
        <p className="conteo-resultados">
          {lista.length} unidad{lista.length === 1 ? "" : "es"}
          {filtrosActivos > 0 ? ` con ${filtrosActivos} filtro${filtrosActivos === 1 ? "" : "s"} aplicado${filtrosActivos === 1 ? "" : "s"}` : " en el catalogo"}
        </p>
        <div className="catalogo">
          {lista.map((v) => {
            const estatus = ESTATUS_VEHICULO[v.estatus] || { texto: v.estatus, tipo: "neutro" };
            const foto = (v.fotos || [])[0];
            return (
              <article className="ficha" key={v.id}>
                {/* La ficha completa abre el detalle; las acciones quedan fuera del boton. */}
                <button type="button" className="ficha-abrir" onClick={() => setDetalle(v)} title="Ver detalle de la unidad">
                  <div className="ficha-imagen">
                    {foto ? (
                      <img src={urlArchivo(foto)} alt={`${v.marca} ${v.modelo}`} loading="lazy" />
                    ) : (
                      <Icono nombre="auto" tamano={46} />
                    )}
                    <span className="ficha-estatus">
                      <Etiqueta valor={estatus.texto} tipo={estatus.tipo} />
                    </span>
                    {(v.fotos || []).length > 1 && <span className="ficha-conteo-fotos">{v.fotos.length} fotos</span>}
                  </div>

                  <div className="ficha-cuerpo">
                    <div className="ficha-titulo">
                      {v.marca} {v.modelo}
                    </div>
                    <div className="ficha-detalle">
                      {v.anio} · {v.color}
                    </div>
                    <div className="ficha-precio">{moneda(v.precio)}</div>
                    <div className="ficha-detalle ficha-vin monoespaciado">{v.vin}</div>
                  </div>
                </button>

                {puedeGestionar && (
                  <div className="ficha-acciones">
                    <button className="boton boton-texto" onClick={() => abrirEdicion(v)}>
                      Editar
                    </button>
                    {/* RF-008 */}
                    {v.estatus === "en_transito" && (
                      <button className="boton boton-texto" onClick={() => cambiarEstatus(v, "disponible")}>
                        Marcar disponible
                      </button>
                    )}
                    {v.estatus === "disponible" && (
                      <button className="boton boton-texto" onClick={() => cambiarEstatus(v, "en_transito")}>
                        En transito
                      </button>
                    )}
                    {/* RF-010 */}
                    <button className="boton boton-texto peligro" onClick={() => abrirBaja(v)}>
                      Dar de baja
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        </>
      )}

      {formulario && (
        <Modal titulo={formulario.id ? "Editar vehiculo" : "Registrar vehiculo"} onCerrar={() => setFormulario(null)}>
          <form className="rejilla-formulario" onSubmit={guardar}>
            <Campo etiqueta="VIN" ancho={2}>
              <input
                value={formulario.vin}
                onChange={(e) => setFormulario({ ...formulario, vin: e.target.value })}
                disabled={Boolean(formulario.id)}
                required
              />
            </Campo>
            <Campo etiqueta="Marca">
              <input value={formulario.marca} onChange={(e) => setFormulario({ ...formulario, marca: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Modelo">
              <input value={formulario.modelo} onChange={(e) => setFormulario({ ...formulario, modelo: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Anio">
              <input
                type="number"
                min="1980"
                max="2100"
                value={formulario.anio}
                onChange={(e) => setFormulario({ ...formulario, anio: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Color">
              <input value={formulario.color} onChange={(e) => setFormulario({ ...formulario, color: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Precio de lista" ancho={2}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.precio}
                onChange={(e) => setFormulario({ ...formulario, precio: e.target.value })}
                required
              />
            </Campo>
            {/* RF-011 */}
            <Campo etiqueta="Ficha tecnica" ancho={2}>
              <textarea
                rows="3"
                value={formulario.fichaTecnica}
                onChange={(e) => setFormulario({ ...formulario, fichaTecnica: e.target.value })}
              />
            </Campo>
            {/* RF-011: fotografias cargadas desde el equipo del usuario. */}
            <div className="grupo-accesorios">
              <span className="etiqueta-grupo">Fotografias de la unidad</span>
              <SubidaFotos fotos={formulario.fotos} onCambio={(fotos) => setFormulario({ ...formulario, fotos })} />
            </div>
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

      {baja && (
        <Modal titulo={`Dar de baja ${baja.marca} ${baja.modelo}`} onCerrar={() => setBaja(null)}>
          <form className="rejilla-formulario" onSubmit={confirmarBaja}>
            <p className="nota">El vehiculo sale del catalogo activo pero conserva todo su historial (RF-010).</p>
            <Campo etiqueta="Motivo de la baja" ancho={2}>
              <select value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)} required>
                <option value="">Selecciona un motivo</option>
                <option value="Venta externa">Venta externa</option>
                <option value="Traslado a otra sucursal">Traslado a otra sucursal</option>
                <option value="Siniestro">Siniestro</option>
                <option value="Otro">Otro</option>
              </select>
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setBaja(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-peligro">
                Confirmar baja
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detalle && (
        <DetalleVehiculo
          /* Remontar por unidad reinicia la galeria en la primera fotografia. */
          key={detalle.id}
          vehiculo={detalle}
          onCerrar={() => setDetalle(null)}
          onEditar={puedeGestionar ? abrirEdicion : undefined}
          onDarDeBaja={puedeGestionar && detalle.estatus !== "apartado" ? abrirBaja : undefined}
        />
      )}
    </>
  );
}
