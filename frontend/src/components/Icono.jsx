/**
 * Iconografia del sistema: trazos simples de 24x24, sin dependencias externas.
 * Se dibujan con `currentColor` para que hereden el color del contexto.
 */
const TRAZOS = {
  inicio: "M3 11.2 12 4l9 7.2M5.5 9.8V20h13V9.8M10 20v-5.5h4V20",
  auto: "M4.5 15.5h15M6 15.5V18a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-2.5M19.5 15.5V18a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1v-2.5M3.5 15.5l1.3-5.2A2 2 0 0 1 6.7 8.8h10.6a2 2 0 0 1 1.9 1.5l1.3 5.2M7 12.6h10",
  personas: "M15.5 19v-1.5a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V19M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20.5 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.7a3 3 0 0 1 0 5.8",
  volante: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 15v6M9.4 10.5 4.2 8.6M14.6 10.5l5.2-1.9",
  etiqueta: "M4 11.3V5a1 1 0 0 1 1-1h6.3a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-6.3 6.3a1 1 0 0 1-1.4 0L4.3 12a1 1 0 0 1-.3-.7ZM8.5 8.5h.01",
  documento: "M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8M14 3.5 18.5 8M14 3.5V8h4.5M9 12.5h6M9 16h6",
  tarjeta: "M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5ZM3.5 10.5h17M7 14.5h3",
  llave: "m14.5 4 5.5 5.5-2.2 2.2-1.6-1.6-1.6 1.6-1.6-1.6-4.4 4.4a3.9 3.9 0 1 1-2.2-2.2ZM7 17h.01",
  grafica: "M4 19.5h16M7.5 16V10M12 16V5.5M16.5 16v-4",
  escudo: "M12 3.5 5 6.2v5c0 4.2 2.9 7.6 7 9.3 4.1-1.7 7-5.1 7-9.3v-5ZM9.5 12l1.8 1.8 3.2-3.4",
  historial: "M4 12a8 8 0 1 0 2.5-5.8M4 5v3.6h3.6M12 8v4.3l3 1.7",
  alerta: "M12 4.5 3.5 19h17ZM12 10v4M12 16.8h.01",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  salir: "M9.5 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4h3.5M15 15.5l4-3.5-4-3.5M19 12H9.5",
  imagen: "M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2ZM9 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4.8 16.6l4-3.6 3.5 3 2.4-2 4.5 3.6",
  vacio: "M4.5 8.5 12 4.5l7.5 4v7L12 19.5l-7.5-4ZM12 12.5v7M12 12.5 4.5 8.5M12 12.5l7.5-4",
};

export default function Icono({ nombre, tamano = 20, className = "" }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;

  return (
    <svg
      className={`icono ${className}`.trim()}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={trazo} />
    </svg>
  );
}
