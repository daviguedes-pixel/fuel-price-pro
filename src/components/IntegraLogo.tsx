interface IntegraLogoProps {
  className?: string;
  variant?: 'full' | 'symbol';
}

export function IntegraLogo({ className = "", variant = 'full' }: IntegraLogoProps) {
  // Usar o novo arquivo PNG que será adicionado
  const logoPath = "/lovable-uploads/integra-logo.png";
  const fallbackPath = "/lovable-uploads/integra-logo-symbol.png";
  
  if (variant === 'symbol') {
    return (
      <img 
        src={logoPath}
        alt="Integra Logo Symbol"
        className={className}
        onError={(e) => {
          // Fallback para o arquivo antigo se o novo não existir
          const target = e.target as HTMLImageElement;
          if (target.src !== fallbackPath) {
            target.src = fallbackPath;
          } else {
            target.style.display = 'none';
          }
        }}
      />
    );
  }

  return (
    <div className={`flex items-center justify-start ${className}`}>
      <img 
        src={logoPath}
        alt="Integra Logo"
        className="h-[300%] w-auto flex-shrink-0"
        onError={(e) => {
          // Fallback para o arquivo antigo se o novo não existir
          const target = e.target as HTMLImageElement;
          if (target.src !== fallbackPath) {
            target.src = fallbackPath;
          } else {
            target.style.display = 'none';
          }
        }}
        onLoad={() => {
          console.log('Logo carregada com sucesso');
        }}
      />
      <span className="font-light tracking-tight font-righteous text-foreground text-lg -ml-2">
        Integra
      </span>
    </div>
  );
}
