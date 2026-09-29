/**
 * Ilustracion del panel de acceso: un vehiculo de linea sobre el piso de venta.
 * Es un SVG propio, sin archivos ni servicios externos, para que el repositorio
 * sea autocontenido y la pantalla cargue igual sin conexion.
 */
export default function IlustracionVehiculo() {
  return (
    <svg className="ilustracion" viewBox="0 0 520 320" role="img" aria-label="Vehiculo en el piso de venta">
      <defs>
        <radialGradient id="reflector" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="carroceria" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id="piso" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Luz cenital del showroom */}
      <ellipse cx="260" cy="150" rx="250" ry="150" fill="url(#reflector)" />

      {/* Retícula sutil del piso */}
      <g stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={40 + i * 110} y1="272" x2={-20 + i * 110} y2="316" />
        ))}
        <line x1="10" y1="288" x2="510" y2="288" />
        <line x1="-10" y1="304" x2="530" y2="304" />
      </g>

      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
        {/* Carrocería */}
        <path
          d="M44 206c0-16 10-26 26-29l56-10c16-26 42-45 80-48h90c36 2 60 21 78 44l68 12c22 4 38 15 38 31v8c0 6-4 10-10 10H54c-6 0-10-4-10-10z"
          fill="url(#carroceria)"
          strokeOpacity="0.85"
          strokeWidth="2.4"
        />

        {/* Cristales */}
        <path d="M152 164c13-21 32-34 58-36h30v36z" fill="#ffffff" fillOpacity="0.2" strokeOpacity="0.5" strokeWidth="1.8" />
        <path d="M254 128h40c26 2 44 16 58 34l-98 2z" fill="#ffffff" fillOpacity="0.2" strokeOpacity="0.5" strokeWidth="1.8" />

        {/* Manija y línea de cintura */}
        <path d="M232 186h26" strokeOpacity="0.45" strokeWidth="2.4" />
        <path d="M96 182h58" strokeOpacity="0.25" strokeWidth="1.6" />

        {/* Faro y calavera */}
        <path d="M452 190h20c5 0 9 4 9 9h-29z" fill="#ffffff" fillOpacity="0.5" strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M48 192h22v8H48z" fill="#ffffff" fillOpacity="0.28" strokeOpacity="0.35" strokeWidth="1.4" />

        {/* Ruedas */}
        <g strokeOpacity="0.85">
          <circle cx="152" cy="222" r="40" fill="#0d1c33" fillOpacity="0.55" strokeWidth="2.4" />
          <circle cx="152" cy="222" r="18" fill="none" strokeOpacity="0.55" strokeWidth="2" />
          <circle cx="394" cy="222" r="40" fill="#0d1c33" fillOpacity="0.55" strokeWidth="2.4" />
          <circle cx="394" cy="222" r="18" fill="none" strokeOpacity="0.55" strokeWidth="2" />
        </g>
      </g>

      {/* Piso del showroom */}
      <rect x="10" y="261" width="500" height="2" fill="url(#piso)" />
    </svg>
  );
}
