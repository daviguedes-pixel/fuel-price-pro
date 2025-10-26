interface SaoRoqueLogoProps {
  className?: string;
  variant?: 'full' | 'symbol';
}

export function SaoRoqueLogo({ className = "", variant = 'full' }: SaoRoqueLogoProps) {
  if (variant === 'symbol') {
    return (
      <img 
        src="/lovable-uploads/44cbde0a-2ae0-4c17-995a-57c1dd722b55.png"
        alt="São Roque Logo Symbol"
        className={className}
      />
    );
  }

  return (
    <img 
      src="/lovable-uploads/7aa47576-a7cc-4f91-ab30-be02ff769818.png"
      alt="São Roque Logo"
      className={className}
    />
  );
}