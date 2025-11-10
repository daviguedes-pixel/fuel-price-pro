import * as React from "react";
import { cn } from "@/lib/utils";

interface DecimalInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: number | string;
  onChange?: (value: number) => void;
  decimals?: number;
  maxValue?: number;
  minValue?: number;
}

const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ className, value, onChange, decimals = 2, maxValue, minValue, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Formata o valor para exibição com vírgula
    const formatDisplay = (num: number | string): string => {
      if (num === "" || num === null || num === undefined) return "";
      
      const numValue = typeof num === "number" ? num : parseFloat(num.toString().replace(",", "."));
      if (isNaN(numValue)) return "";
      
      return numValue.toFixed(decimals).replace(".", ",");
    };

    // Atualiza o display quando o valor externo muda
    React.useEffect(() => {
      setDisplayValue(formatDisplay(value || ""));
    }, [value, decimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Remove tudo exceto números e vírgula
      inputValue = inputValue.replace(/[^\d,]/g, "");
      
      // Permite apenas uma vírgula
      const parts = inputValue.split(",");
      if (parts.length > 2) {
        inputValue = parts[0] + "," + parts.slice(1).join("");
      }
      
      // Limita casas decimais
      if (parts.length === 2 && parts[1].length > decimals) {
        inputValue = parts[0] + "," + parts[1].substring(0, decimals);
      }
      
      setDisplayValue(inputValue);
      
      // Converte para número e notifica onChange
      if (onChange) {
        const numValue = inputValue === "" ? 0 : parseFloat(inputValue.replace(",", "."));
        
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
        const numValue = parseFloat(displayValue.replace(",", "."));
        if (!isNaN(numValue)) {
          setDisplayValue(formatDisplay(numValue));
        }
      } else {
        setDisplayValue("");
      }
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        translate="no"
        {...props}
      />
    );
  },
);
DecimalInput.displayName = "DecimalInput";

export { DecimalInput };
