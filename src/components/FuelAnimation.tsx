export function FuelAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fuel pump animations positioned around the screen */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="absolute opacity-5 animate-pulse"
          style={{
            left: `${20 + i * 30}%`,
            top: `${10 + i * 20}%`,
            animationDelay: `${i * 2}s`,
            animationDuration: '6s'
          }}
        >
          <FuelPumpIcon />
        </div>
      ))}
      
      {/* Fuel flow lines */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              x1={`${Math.random() * 100}%`}
              y1="0%"
              x2={`${Math.random() * 100}%`}
              y2="100%"
              stroke="url(#flowGradient)"
              strokeWidth="1"
              strokeDasharray="4,8"
              className="animate-[flow_4s_linear_infinite]"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating fuel droplets */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`drop-${i}`}
          className="absolute w-1 h-2 bg-accent rounded-full opacity-20 animate-[float_8s_ease-in-out_infinite]"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${6 + Math.random() * 4}s`
          }}
        />
      ))}
    </div>
  );
}

function FuelPumpIcon() {
  return (
    <svg width="120" height="160" viewBox="0 0 120 160" fill="none">
      {/* Fuel pump base */}
      <rect x="20" y="40" width="60" height="100" rx="8" fill="hsl(var(--primary))" fillOpacity="0.3" />
      {/* Pump nozzle */}
      <rect x="85" y="60" width="30" height="8" rx="4" fill="hsl(var(--accent))" fillOpacity="0.4" />
      {/* Display screen */}
      <rect x="30" y="50" width="40" height="25" rx="4" fill="hsl(var(--accent))" fillOpacity="0.5" />
      {/* Hose */}
      <path 
        d="M85 64 Q100 70, 110 80 Q115 85, 110 90 Q105 95, 100 90"
        stroke="hsl(var(--primary))" 
        strokeWidth="3" 
        fill="none" 
        strokeOpacity="0.4"
      />
    </svg>
  );
}