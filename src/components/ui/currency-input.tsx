import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: number | string;
  onChange?: (value: number) => void;
  maxValue?: number;
  minValue?: number;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, maxValue, minValue = 0, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Formata o valor para exibição com vírgula e separador de milhares
    const formatDisplay = (num: number | string): string => {
      if (num === "" || num === null || num === undefined) return "";
      
      const numValue = typeof num === "number" ? num : parseFloat(num.toString().replace(",", "."));
      if (isNaN(numValue)) return "";
      
      // Formata com separador de milhares (ponto) e decimais (vírgula)
      return numValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Atualiza o display quando o valor externo muda
    React.useEffect(() => {
      setDisplayValue(formatDisplay(value || ""));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Remove tudo exceto números, vírgula e ponto
      inputValue = inputValue.replace(/[^\d,]/g, "");
      
      // Permite apenas uma vírgula
      const parts = inputValue.split(",");
      if (parts.length > 2) {
        inputValue = parts[0] + "," + parts.slice(1).join("");
      }
      
      // Limita a 2 casas decimais
      if (parts.length === 2 && parts[1].length > 2) {
        inputValue = parts[0] + "," + parts[1].substring(0, 2);
      }
      
      setDisplayValue(inputValue);
      
      // Converte para número e notifica onChange
      if (onChange) {
        const cleanValue = inputValue.replace(/\./g, "").replace(",", ".");
        const numValue = cleanValue === "" ? 0 : parseFloat(cleanValue);
        
        if (!isNaN(numValue)) {
          // Aplica limites se definidos
          let finalValue = numValue;
          if (maxValue !== undefined && numValue > maxValue) {
            finalValue = maxValue;
            setDisplayValue(formatDisplay(maxValue));
          }
          if (minValue !== undefined && numValue < minValue) {
            finalValue = minValue;
            setDisplayValue(formatDisplay(minValue));
          }
          
          onChange(finalValue);
        }
      }
    };

    const handleBlur = () => {
      // Formata corretamente ao sair do campo
      if (displayValue && displayValue !== ",") {
        const cleanValue = displayValue.replace(/\./g, "").replace(",", ".");
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
          setDisplayValue(formatDisplay(numValue));
        }
      } else {
        setDisplayValue("0,00");
        if (onChange) onChange(0);
      }
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" translate="no">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          translate="no"
          {...props}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
